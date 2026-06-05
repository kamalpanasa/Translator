from deep_translator import GoogleTranslator
from utils.error_handler import handle_translation_error
import google.generativeai as genai

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


def translate_with_gemini(text, target_language, api_key):
    try:
        genai.configure(api_key=api_key)
        
        # Resolve best model
        model_name = "models/gemini-1.5-flash"
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
        except:
            pass

        model = genai.GenerativeModel(model_name)
        prompt = f"Translate the following text to the language with ISO code or name '{target_language}'. Respond with ONLY the translated text, no explanation or markdown formatting:\n\n{text}"
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        print("Gemini translation error:", e)
        return None


def translate_text(text, target_language, api_key=None):
    try:
        if not text or not text.strip():
            return "Please enter text to translate."

        # Try translating using Gemini first if API key is provided
        if api_key:
            translated = translate_with_gemini(text, target_language, api_key)
            if translated:
                return translated

        # Fallback to Google Translator
        translator = GoogleTranslator(source="auto", target=target_language)
        result = translator.translate(text.strip())

        if not result:
            return "Translation returned empty. Please try again."

        return result

    except Exception as e:
        return handle_translation_error(e)
