def handle_empty_text(text):
    if text is None or str(text).strip() == "":
        return "No text provided."
    return text.strip()


def handle_audio_error(exception):
    return f"⚠️ Audio processing error: {str(exception)}"


def handle_ocr_error(exception):
    return f"⚠️ OCR error: {str(exception)}"


def handle_translation_error(exception):
    return f"⚠️ Translation error: {str(exception)}"


def handle_file_error(exception):
    return f"⚠️ File error: {str(exception)}"
