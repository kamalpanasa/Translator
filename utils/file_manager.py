import tempfile
import os


def save_uploaded_audio(uploaded_file, suffix=".wav"):
    """Save a Streamlit uploaded audio file to a temp path and return path."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_audio:
        temp_audio.write(uploaded_file.getvalue())
        return temp_audio.name


def save_uploaded_image(uploaded_image, suffix=".png"):
    """Save a Streamlit uploaded image file to a temp path and return path."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_img:
        temp_img.write(uploaded_image.getvalue())
        return temp_img.name


def ensure_temp_dir(path="temp"):
    """Create temp directory if it doesn't exist."""
    os.makedirs(path, exist_ok=True)
    return path


def cleanup_temp_files(directory="temp", extension=".mp3"):
    """Delete old temp files with given extension."""
    try:
        for f in os.listdir(directory):
            if f.endswith(extension):
                os.remove(os.path.join(directory, f))
    except Exception:
        pass
