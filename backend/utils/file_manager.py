import tempfile
import os

def save_uploaded_audio(uploaded_file, suffix=".wav"):
    """
    Save a file-like object (Streamlit or FastAPI UploadFile) to a temp path and return path.
    If a string path is passed, returns it as-is.
    """
    if isinstance(uploaded_file, str):
        return uploaded_file
        
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_audio:
        if hasattr(uploaded_file, "getvalue"): # Streamlit
            temp_audio.write(uploaded_file.getvalue())
        elif hasattr(uploaded_file, "file"): # FastAPI UploadFile
            uploaded_file.file.seek(0)
            temp_audio.write(uploaded_file.file.read())
        elif hasattr(uploaded_file, "read"): # Standard file-like
            uploaded_file.seek(0)
            temp_audio.write(uploaded_file.read())
        elif isinstance(uploaded_file, bytes):
            temp_audio.write(uploaded_file)
        else:
            raise ValueError("Unsupported file upload type")
            
        return temp_audio.name


def save_uploaded_image(uploaded_image, suffix=".png"):
    """
    Save a file-like object to a temp path and return path.
    If a string path is passed, returns it as-is.
    """
    if isinstance(uploaded_image, str):
        return uploaded_image
        
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_img:
        if hasattr(uploaded_image, "getvalue"):
            temp_img.write(uploaded_image.getvalue())
        elif hasattr(uploaded_image, "file"):
            uploaded_image.file.seek(0)
            temp_img.write(uploaded_image.file.read())
        elif hasattr(uploaded_image, "read"):
            uploaded_image.seek(0)
            temp_img.write(uploaded_image.read())
        elif isinstance(uploaded_image, bytes):
            temp_img.write(uploaded_image)
        else:
            raise ValueError("Unsupported file upload type")
            
        return temp_img.name


def ensure_temp_dir(path="temp"):
    """Create temp directory if it doesn't exist."""
    os.makedirs(path, exist_ok=True)
    return path


def cleanup_temp_files(directory="temp", extension=".mp3"):
    """Delete old temp files with given extension."""
    try:
        if os.path.exists(directory):
            for f in os.listdir(directory):
                if f.endswith(extension):
                    try:
                        os.remove(os.path.join(directory, f))
                    except:
                        pass
    except Exception:
        pass
