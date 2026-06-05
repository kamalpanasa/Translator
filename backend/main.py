import os
import sys
import io

# Force stdout/stderr to UTF-8 encoding to prevent Windows cp1252/charmap UnicodeEncodeErrors
if sys.platform.startswith("win"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import uuid
import shutil
import json
from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, Form, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import google.generativeai as genai

# Add backend and parent directory to sys.path to allow absolute imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db
from modules import speech_to_text, text_to_speech, translation, ocr_module, waveform_visualizer, rag

app = FastAPI(title="AuraVision Backend API", version="1.0.0")

# Setup CORS to allow React frontend (typically on port 5173) to communicate
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_DIR = os.path.join(os.path.dirname(__file__), "temp")
os.makedirs(TEMP_DIR, exist_ok=True)

def get_api_key(x_gemini_api_key: Optional[str] = Header(None)) -> str:
    """
    Retrieve Gemini API key from request headers or fallback to environment variables.
    """
    api_key = x_gemini_api_key or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="Gemini API Key is missing. Please set it in Settings or environment variables."
        )
    return api_key

@app.get("/api/config/check")
def check_config(x_gemini_api_key: Optional[str] = Header(None)):
    """
    Validates the Gemini API key.
    """
    api_key = x_gemini_api_key or os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {"status": "missing", "message": "API Key is not configured."}
    
    try:
        genai.configure(api_key=api_key)
        # Attempt to list models to verify the key works
        genai.list_models()
        return {"status": "valid", "message": "Gemini API connection successful."}
    except Exception as e:
        return {"status": "invalid", "message": f"Connection failed: {str(e)}"}

# --- SPEECH ENGINE ENDPOINTS ---

@app.post("/api/speech/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = Form("en-US")
):
    try:
        # Save upload to a temp path
        suffix = os.path.splitext(file.filename)[1] or ".wav"
        temp_file_path = os.path.join(TEMP_DIR, f"upload_{uuid.uuid4().hex}{suffix}")
        
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # 1. Transcribe the audio
        text = speech_to_text.recognize_from_audio_file(temp_file_path, language=language)
        
        # 2. Generate Plotly figure from user's original visualizer module
        fig = waveform_visualizer.plot_waveform(temp_file_path)
        waveform_data = json.loads(fig.to_json())
        
        # Cleanup file after usage
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
            
        return {
            "transcription": text,
            "waveform": waveform_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- VOICE STUDIO ENDPOINTS ---

@app.post("/api/voice/tts")
def generate_speech(data: dict):
    text = data.get("text", "")
    lang = data.get("lang", "en")
    
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text parameter is required")
        
    try:
        audio_io = text_to_speech.text_to_speech(text, lang=lang)
        if isinstance(audio_io, str) and audio_io.startswith("⚠️"):
            raise HTTPException(status_code=500, detail=audio_io)
            
        # Return audio streaming response
        audio_io.seek(0)
        return StreamingResponse(audio_io, media_type="audio/mp3")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- TRANSLATION ENDPOINTS ---

@app.post("/api/translation/translate")
def translate(
    data: dict,
    x_gemini_api_key: Optional[str] = Header(None)
):
    text = data.get("text", "")
    target_lang = data.get("target_lang", "en")
    
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text parameter is required")
        
    api_key = x_gemini_api_key or os.getenv("GEMINI_API_KEY")
    result = translation.translate_text(text, target_lang, api_key=api_key)
    return {"translated_text": result}

# --- VISION OCR ENDPOINTS ---

@app.post("/api/vision/ocr")
async def process_ocr(
    file: UploadFile = File(...),
    langs: str = Form("en-US")
):
    try:
        # Parse selected languages (comma separated, e.g., 'en,hi')
        langs_list = tuple(langs.split(","))
        
        suffix = os.path.splitext(file.filename)[1] or ".png"
        temp_file_path = os.path.join(TEMP_DIR, f"ocr_{uuid.uuid4().hex}{suffix}")
        
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Extract text and bounding boxes
        text = ocr_module.extract_text_from_image(temp_file_path, langs=langs_list)
        detections = ocr_module.extract_text_with_boxes(temp_file_path, langs=langs_list)
        
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
            
        return {
            "text": text,
            "detections": detections
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- DOCUMENT RAG ENDPOINTS ---

@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    api_key: str = Header(None, alias="X-Gemini-API-Key")
):
    if not api_key:
        raise HTTPException(status_code=400, detail="Gemini API Key is required for RAG operations.")
        
    suffix = os.path.splitext(file.filename)[1].lower()
    if suffix not in [".pdf", ".txt", ".md"]:
        raise HTTPException(status_code=400, detail="Only PDF, TXT, and MD files are supported.")
        
    try:
        # Save temp file
        temp_file_path = os.path.join(TEMP_DIR, f"doc_{uuid.uuid4().hex}{suffix}")
        file_size = 0
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            file_size = os.path.getsize(temp_file_path)
            
        # Index document using RAG pipeline
        doc_id = rag.index_document(
            file_path=temp_file_path,
            filename=file.filename,
            file_size=file_size,
            api_key=api_key
        )
        
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
            
        return {"status": "success", "document_id": doc_id, "filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/documents/list")
def list_documents():
    return db.get_all_documents()

@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: str):
    try:
        db.delete_document(doc_id)
        return {"status": "success", "message": "Document deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- CHAT & RAG ENDPOINTS ---

@app.get("/api/chat/sessions")
def get_chat_sessions():
    return db.get_chat_sessions()

@app.post("/api/chat/sessions")
def create_session(data: dict = None):
    title = data.get("title") if data else "New Chat Session"
    session_id = db.create_chat_session(title)
    return {"session_id": session_id, "title": title}

@app.delete("/api/chat/sessions/{session_id}")
def delete_session(session_id: str):
    try:
        db.delete_chat_session(session_id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chat/history/{session_id}")
def get_history(session_id: str):
    return db.get_chat_history(session_id)

@app.post("/api/chat/send")
def send_chat_message(
    data: dict,
    api_key: str = Header(None, alias="X-Gemini-API-Key")
):
    if not api_key:
        raise HTTPException(status_code=400, detail="Gemini API Key is required.")
        
    session_id = data.get("session_id")
    user_message = data.get("message", "").strip()
    use_rag = data.get("use_rag", False)
    document_ids = data.get("document_ids", [])
    
    if not session_id or not user_message:
        raise HTTPException(status_code=400, detail="session_id and message are required.")
        
    try:
        rag_context = []
        context_prompt = ""
        
        # 1. RAG Retrieve chunks
        if use_rag and document_ids:
            search_results = rag.search_documents(user_message, api_key, document_ids=document_ids, top_k=4)
            if search_results:
                context_blocks = []
                for idx, res in enumerate(search_results):
                    # Save context citation
                    rag_context.append({
                        "text": res["chunk_text"],
                        "score": round(res["score"], 3),
                        "document_id": res["document_id"]
                    })
                    context_blocks.append(f"Source [{idx+1}]: {res['chunk_text']}")
                
                context_prompt = "You are a helpful assistant. Use the following context details extracted from uploaded files to answer the user's question. If the answer cannot be found in the context, use your general knowledge but mention that it was not in the context.\n\nContext Details:\n" + "\n\n".join(context_blocks) + "\n\n"
        
        # 2. Add message history to the prompt
        history = db.get_chat_history(session_id)
        
        # Structure the prompt for Gemini
        genai.configure(api_key=api_key)
        
        # Dynamically determine the best supported model for this API key to prevent 404 errors
        model_name = "gemini-1.5-flash"
        try:
            available_models = [m.name for m in genai.list_models() if "generateContent" in m.supported_generation_methods]
            preferred = ["models/gemini-1.5-flash", "models/gemini-1.5-flash-latest", "models/gemini-pro", "models/gemini-1.5-pro"]
            for pref in preferred:
                if pref in available_models:
                    model_name = pref
                    break
                elif pref.replace("models/", "") in available_models:
                    model_name = pref.replace("models/", "")
                    break
            else:
                geminis = [m for m in available_models if "gemini" in m.lower()]
                if geminis:
                    model_name = geminis[0]
                elif available_models:
                    model_name = available_models[0]
        except Exception as e:
            print("Error listing models, falling back to gemini-1.5-flash:", e)
            
        print(f"Using dynamic chat model: {model_name}")
        model = genai.GenerativeModel(model_name)
        
        # Re-pack history into Gemini API-friendly format or construct system prompt
        contents = []
        for msg in history[-8:]:  # Limit history to last 8 messages for speed
            contents.append({
                "role": "user" if msg["role"] == "user" else "model",
                "parts": [msg["content"]]
            })
            
        # Append the new user message with RAG context prepended
        full_user_input = context_prompt + f"Question: {user_message}"
        contents.append({
            "role": "user",
            "parts": [full_user_input]
        })
        
        # 3. Generate response
        response = model.generate_content(contents)
        assistant_reply = response.text
        
        # 4. Save messages to SQLite Database
        db.insert_chat_message(session_id, "user", user_message, rag_context=None)
        db.insert_chat_message(session_id, "assistant", assistant_reply, rag_context=rag_context)
        
        # Auto rename chat session based on the first message
        if len(history) == 0:
            summary_prompt = f"Summarize this question in 3-5 words to use as a title: '{user_message}'"
            try:
                title_res = model.generate_content(summary_prompt)
                title = title_res.text.strip().replace('"', '').replace("'", "")
                if len(title) > 30:
                    title = title[:27] + "..."
                db.update_session_title(session_id, title)
            except:
                pass
                
        return {
            "reply": assistant_reply,
            "rag_context": rag_context
        }
        
    except Exception as e:
        print("Chat send error:", e)
        raise HTTPException(status_code=500, detail=str(e))

# Serve static files from frontend/dist if the folder exists
frontend_dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))

if os.path.exists(frontend_dist_path):
    app.mount("/", StaticFiles(directory=frontend_dist_path, html=True), name="frontend")
    
    # Catch-all route to serve index.html for any client-side routes (SPA support)
    @app.exception_handler(404)
    async def custom_404_handler(request, exc):
        if request.url.path.startswith("/api"):
            return JSONResponse(status_code=404, content={"detail": "Not Found"})
        return FileResponse(os.path.join(frontend_dist_path, "index.html"))
else:
    print(f"Warning: Frontend dist directory not found at {frontend_dist_path}. Frontend will not be served.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
