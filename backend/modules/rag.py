import os
import re
import uuid
import numpy as np
import google.generativeai as genai
from pypdf import PdfReader
from database.db import insert_document, insert_chunks, get_all_chunks

def extract_text_from_file(file_path: str) -> str:
    """
    Extracts text from PDF, TXT, or MD files.
    """
    _, ext = os.path.splitext(file_path.lower())
    text = ""
    
    if ext == ".pdf":
        try:
            reader = PdfReader(file_path)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        except Exception as e:
            print(f"Error parsing PDF {file_path}: {e}")
            raise ValueError(f"Failed to parse PDF: {str(e)}")
    elif ext in [".txt", ".md"]:
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
        except Exception as e:
            print(f"Error reading text file {file_path}: {e}")
            raise ValueError(f"Failed to read text file: {str(e)}")
    else:
        raise ValueError(f"Unsupported file format: {ext}")
        
    return text.strip()


def chunk_text(text: str, chunk_size: int = 700, chunk_overlap: int = 100) -> list[str]:
    """
    Recursively splits text into character chunks with overlap.
    """
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = ""
    
    for paragraph in paragraphs:
        paragraph = paragraph.strip()
        if not paragraph:
            continue
            
        if len(current_chunk) + len(paragraph) > chunk_size:
            if len(paragraph) > chunk_size:
                # Chunks current accumulator
                if current_chunk:
                    chunks.append(current_chunk)
                    current_chunk = ""
                
                # Split paragraph into sentences
                sentences = re.split(r'(?<=[.!?])\s+', paragraph)
                for sentence in sentences:
                    if len(current_chunk) + len(sentence) > chunk_size:
                        if current_chunk:
                            chunks.append(current_chunk)
                            overlap_start = max(0, len(current_chunk) - chunk_overlap)
                            current_chunk = current_chunk[overlap_start:]
                        
                        if len(sentence) > chunk_size:
                            # Split by words
                            words = sentence.split(" ")
                            for word in words:
                                if len(current_chunk) + len(word) > chunk_size:
                                    chunks.append(current_chunk)
                                    overlap_start = max(0, len(current_chunk) - chunk_overlap)
                                    current_chunk = current_chunk[overlap_start:]
                                current_chunk = (current_chunk + " " + word).strip()
                        else:
                            current_chunk = (current_chunk + " " + sentence).strip()
                    else:
                        current_chunk = (current_chunk + " " + sentence).strip()
            else:
                chunks.append(current_chunk)
                overlap_start = max(0, len(current_chunk) - chunk_overlap)
                current_chunk = current_chunk[overlap_start:]
                current_chunk = (current_chunk + "\n\n" + paragraph).strip()
        else:
            current_chunk = (current_chunk + "\n\n" + paragraph).strip()
            
    if current_chunk:
        chunks.append(current_chunk)
        
    return chunks


_embedding_model_name = None

def _get_embedding_model_name(api_key: str) -> str:
    global _embedding_model_name
    if _embedding_model_name is not None:
        return _embedding_model_name
        
    genai.configure(api_key=api_key)
    try:
        models = genai.list_models()
        embedding_models = [
            m.name for m in models 
            if "embedContent" in m.supported_generation_methods
        ]
        
        # Priority order for text embeddings
        preferred = ["models/text-embedding-004", "models/gemini-embedding-001"]
        for pref in preferred:
            if pref in embedding_models:
                _embedding_model_name = pref
                return _embedding_model_name
            elif pref.replace("models/", "") in embedding_models:
                _embedding_model_name = pref.replace("models/", "")
                return _embedding_model_name
                
        # Fallback to any model containing 'embedding'
        for m in embedding_models:
            if "embedding" in m.lower():
                _embedding_model_name = m
                return _embedding_model_name
                
        if embedding_models:
            _embedding_model_name = embedding_models[0]
            return _embedding_model_name
    except Exception as e:
        print("Error listing embedding models, falling back to models/text-embedding-004:", e)
        
    _embedding_model_name = "models/text-embedding-004"
    return _embedding_model_name

def get_embedding(text: str, api_key: str, is_query: bool = False) -> list[float]:
    """
    Generates embedding vector for a text string using Gemini API.
    """
    genai.configure(api_key=api_key)
    model_name = _get_embedding_model_name(api_key)
    task_type = "retrieval_query" if is_query else "retrieval_document"
    try:
        response = genai.embed_content(
            model=model_name,
            content=text,
            task_type=task_type
        )
        return response["embedding"]
    except Exception as e:
        print(f"Gemini embedding error with model {model_name}: {e}")
        raise RuntimeError(f"Embedding failed: {str(e)}")


def get_embeddings_batch(texts: list[str], api_key: str) -> list[list[float]]:
    """
    Generates embedding vectors in batches for speed.
    """
    genai.configure(api_key=api_key)
    model_name = _get_embedding_model_name(api_key)
    try:
        response = genai.embed_content(
            model=model_name,
            content=texts,
            task_type="retrieval_document"
        )
        return response["embedding"]
    except Exception as e:
        print(f"Gemini batch embedding error with model {model_name}: {e}")
        raise RuntimeError(f"Batch embedding failed: {str(e)}")


def index_document(file_path: str, filename: str, file_size: int, api_key: str) -> str:
    """
    Parses a file, chunks the text, computes Gemini embeddings, and inserts them into the DB.
    """
    text = extract_text_from_file(file_path)
    if not text:
        raise ValueError("No text extracted from document.")
        
    # Split text into chunks
    chunks = chunk_text(text)
    if not chunks:
        raise ValueError("Could not split text into chunks.")
        
    # Insert document record
    doc_id = str(uuid.uuid4())
    _, ext = os.path.splitext(filename.lower())
    insert_document(doc_id, filename, ext, file_size)
    
    # Generate embeddings in batches of 50 chunks
    batch_size = 50
    chunk_records = []
    
    for i in range(0, len(chunks), batch_size):
        batch_chunks = chunks[i:i+batch_size]
        try:
            embeddings = get_embeddings_batch(batch_chunks, api_key)
            for text_chunk, emb in zip(batch_chunks, embeddings):
                chunk_id = str(uuid.uuid4())
                chunk_records.append((chunk_id, doc_id, text_chunk, emb))
        except Exception as e:
            # Fallback to one-by-one embedding if batch fails
            print(f"Batch embedding failed: {e}. Falling back to single mode.")
            for text_chunk in batch_chunks:
                chunk_id = str(uuid.uuid4())
                emb = get_embedding(text_chunk, api_key, is_query=False)
                chunk_records.append((chunk_id, doc_id, text_chunk, emb))
                
    # Bulk insert chunks to SQLite
    insert_chunks(chunk_records)
    return doc_id


def search_documents(query: str, api_key: str, document_ids: list[str] = None, top_k: int = 4) -> list[dict]:
    """
    Perform Cosine Similarity Vector search locally using NumPy.
    Returns list of dicts: {"text": chunk_text, "score": similarity_score, "document_id": doc_id}
    """
    # 1. Fetch chunks matching the selected document IDs
    chunks = get_all_chunks(document_ids)
    if not chunks:
        return []
        
    # 2. Get embedding of query
    query_emb = np.array(get_embedding(query, api_key, is_query=True), dtype=np.float32)
    
    # Normalize query embedding
    query_norm = np.linalg.norm(query_emb)
    if query_norm == 0:
        return []
        
    # 3. Calculate cosine similarities
    results = []
    for chunk in chunks:
        chunk_emb = np.array(chunk["embedding"], dtype=np.float32)
        chunk_norm = np.linalg.norm(chunk_emb)
        
        if chunk_norm == 0:
            similarity = 0.0
        else:
            similarity = float(np.dot(query_emb, chunk_emb) / (query_norm * chunk_norm))
            
        results.append({
            "chunk_text": chunk["chunk_text"],
            "document_id": chunk["document_id"],
            "score": similarity
        })
        
    # 4. Sort results and take top_k
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:top_k]
