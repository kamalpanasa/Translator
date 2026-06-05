import easyocr
import numpy as np
from PIL import Image
import re
from utils.error_handler import handle_ocr_error

_reader_cache = {}


import streamlit as st

@st.cache_resource
def get_reader(langs=('en',)):
    """
    Using st.cache_resource ensures the model is only loaded/downloaded 
    ONCE and kept in memory, without blocking the app startup.
    """
    return easyocr.Reader(list(langs), gpu=False)


def extract_text_from_image(uploaded_image, langs=('en',), confidence_threshold=0.3):
    try:
        img = Image.open(uploaded_image).convert("RGB")
        img_np = np.array(img)

        reader = get_reader(langs)
        results = reader.readtext(img_np)

        # Filter by confidence score and extract text
        texts = [
            item[1]
            for item in results
            if item[2] >= confidence_threshold
        ]

        text = " ".join(texts)
        text = re.sub(r"\s+", " ", text).strip()

        if not text:
            return "No text detected in the image."

        return text

    except Exception as e:
        return handle_ocr_error(e)


def extract_text_with_boxes(uploaded_image, langs=('en',)):
    """Returns list of (text, confidence, bounding_box) for visualization."""
    try:
        img = Image.open(uploaded_image).convert("RGB")
        img_np = np.array(img)

        reader = get_reader(langs)
        results = reader.readtext(img_np)

        return [
            {"text": item[1], "confidence": round(item[2] * 100, 1), "box": item[0]}
            for item in results
        ]

    except Exception as e:
        return []

def extract_text_from_array(img_np, langs=('en',), confidence_threshold=0.3):
    """
    Directly process a raw numpy array (like a webcam frame) to save time.
    """
    try:
        reader = get_reader(langs)
        results = reader.readtext(img_np)

        # Filter by confidence score and extract text
        texts = [item[1] for item in results if item[2] >= confidence_threshold]

        text = " ".join(texts)
        text = re.sub(r"\s+", " ", text).strip()

        return text if text else None
    except Exception as e:
        return None