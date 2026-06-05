from deep_translator import GoogleTranslator
from utils.error_handler import handle_translation_error

SUPPORTED_LANGUAGES = {
    "English": "en",
    "Hindi": "hi",
    "Telugu": "te",
    "Tamil": "ta",
    "Kannada": "kn",
    "Malayalam": "ml",
    "Marathi": "mr",
    "Bengali": "bn",
    "Gujarati": "gu",
    "Punjabi": "pa",
    "Urdu": "ur",
    "Arabic": "ar",
    "French": "fr",
    "Spanish": "es",
    "German": "de",
    "Japanese": "ja",
    "Chinese (Simplified)": "zh-CN",
    "Korean": "ko",
    "Russian": "ru",
    "Portuguese": "pt",
    "Italian": "it",
}


def translate_text(text, target_language):
    try:
        if not text or not text.strip():
            return "Please enter text to translate."

        translator = GoogleTranslator(source="auto", target=target_language)
        result = translator.translate(text.strip())

        if not result:
            return "Translation returned empty. Please try again."

        return result

    except Exception as e:
        return handle_translation_error(e)
