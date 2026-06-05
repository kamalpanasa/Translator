import os
import speech_recognition as sr
from utils.file_manager import save_uploaded_audio
from utils.error_handler import handle_audio_error

_whisper_model = None

def _get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        import whisper
        _whisper_model = whisper.load_model("tiny")
    return _whisper_model

def recognize_from_audio_file(uploaded_file, language="en-US"):
    """
    Transcribe uploaded WAV.
    Architecture: Dynamic Routing.
    - Uses Google Cloud STT directly for Indian regional languages (High accuracy).
    - Uses local Whisper 'tiny' for English/European languages (Fast local inference).
    """
    temp_path = save_uploaded_audio(uploaded_file)
    whisper_lang = language.split("-")[0].lower()

    direct_google_langs = ["te", "hi", "ta", "kn", "ml", "mr", "bn", "gu", "ur"]

    if whisper_lang not in direct_google_langs:
        try:
            model = _get_whisper_model()
            result = model.transcribe(
                temp_path,
                language=whisper_lang,
                task="transcribe",
                fp16=False,
                verbose=False,
                condition_on_previous_text=False,
                best_of=5,
                beam_size=5,
                patience=1.0 
            )
            
            text = result.get("text", "").strip()
            if text:
                if os.path.exists(temp_path):
                    try: os.remove(temp_path)
                    except: pass
                return text

        except Exception:
            pass

    recognizer = sr.Recognizer()
    try:
        with sr.AudioFile(temp_path) as source:
            audio = recognizer.record(source)
        return recognizer.recognize_google(audio, language=language)
    except sr.UnknownValueError:
        return "Could not understand the audio."
    except sr.RequestError as e:
        return handle_audio_error(e)
    except Exception as e:
        return handle_audio_error(e)
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass