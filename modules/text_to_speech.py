from gtts import gTTS
import uuid
import os
import io
import re
import concurrent.futures
from utils.error_handler import handle_audio_error

OUTPUT_DIR = "temp"


def _split_sentences(text: str, max_chars: int = 200) -> list[str]:
    """
    Split text into sentence-sized chunks.
    gTTS is faster on short chunks sent in parallel.
    """
    # Split on sentence boundaries
    raw = re.split(r'(?<=[.!?])\s+', text.strip())
    chunks = []
    current = ""
    for sentence in raw:
        if len(current) + len(sentence) <= max_chars:
            current = (current + " " + sentence).strip()
        else:
            if current:
                chunks.append(current)
            current = sentence
    if current:
        chunks.append(current)
    return chunks if chunks else [text.strip()]

def _tts_chunk(args) -> bytes | None:
    """Generate TTS for a single chunk. Returns mp3 bytes or None on error."""
    text, lang = args
    try:
        buf = io.BytesIO()
        gTTS(text=text, lang=lang, slow=False, lang_check=False).write_to_fp(buf)
        return buf.getvalue()
    except Exception:
        return None


def text_to_speech(text: str, lang: str = "en"):
    """
    Split text into sentence chunks, generate TTS in parallel,
    concatenate raw MP3 bytes. Returns BytesIO ready for st.audio().
    """
    try:
        os.makedirs(OUTPUT_DIR, exist_ok=True)

        chunks = _split_sentences(text)

        # Parallel generation — up to 5 concurrent requests
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
            results = list(ex.map(_tts_chunk, [(c, lang) for c in chunks]))

        # Concatenate all MP3 chunks (MP3 frames are self-contained, safe to concat)
        combined = b"".join(r for r in results if r)

        if not combined:
            return "⚠️ Audio generation failed."

        # Save to disk
        filename = os.path.join(OUTPUT_DIR, f"tts_{uuid.uuid4().hex}.mp3")
        with open(filename, "wb") as f:
            f.write(combined)

        return io.BytesIO(combined)

    except Exception as e:
        return handle_audio_error(e)


def cleanup_old_files():
    try:
        for f in os.listdir(OUTPUT_DIR):
            if f.startswith("tts_") and f.endswith(".mp3"):
                os.remove(os.path.join(OUTPUT_DIR, f))
    except Exception:
        pass