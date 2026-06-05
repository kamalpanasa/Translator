import streamlit as st
import base64
import time

from modules.speech_to_text import recognize_from_audio_file
from modules.text_to_speech import text_to_speech, cleanup_old_files
from modules.translation import translate_text, SUPPORTED_LANGUAGES
from modules.ocr_module import extract_text_from_image, extract_text_with_boxes
from modules.waveform_visualizer import plot_waveform
from modules.context_assistant import analyze_intent

from utils.error_handler import handle_empty_text
from utils.file_manager import ensure_temp_dir

# -------------------------------------------------
# INIT
# -------------------------------------------------
ensure_temp_dir("temp")

# -------------------------------------------------
# PAGE CONFIG
# -------------------------------------------------

st.set_page_config(
    page_title="AudioVision — Multimodal Intelligence", 
    page_icon="🌊", 
    layout="wide",
    initial_sidebar_state="collapsed"
)

# -------------------------------------------------
# LOAD CSS + FONTS
# -------------------------------------------------
def load_css(path: str):
    with open(path, "r", encoding="utf-8") as f:
        css = f.read()
    st.markdown(
        f"""
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap');
            @import url('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css');
            {css}
        </style>
        """,
        unsafe_allow_html=True
    )

load_css("static/style.css")

# -------------------------------------------------
# CONTEXT ASSISTANT RENDERER
# -------------------------------------------------
def render_context_assistant(text: str):
    """Renders a rich context assistant card below any transcribed text."""
    analysis = analyze_intent(text)
    if not analysis:
        return
    actions_html = ""
    for icon_label, desc in analysis["actions"]:
        actions_html += f"""
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);
        border-radius:8px;padding:10px 14px;margin-bottom:8px;">
          <div style="color:#e2e8f0;font-size:0.88rem;font-weight:600;margin-bottom:3px;">{icon_label}</div>
          <div style="color:#64748b;font-size:0.82rem;line-height:1.5;">{desc}</div>
        </div>"""

    st.markdown(f"""
        <div style="background:rgba(15,23,42,0.7);border:1px solid {analysis['border']};
        border-left:4px solid {analysis['color']};border-radius:12px;
        padding:20px 22px;margin-top:18px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
            <div style="background:{analysis['bg']};border:1px solid {analysis['border']};
            border-radius:8px;padding:4px 12px;display:inline-block;">
              <span style="color:{analysis['color']};font-weight:700;font-size:0.82rem;
              letter-spacing:0.06em;text-transform:uppercase;">{analysis['intent']}</span>
            </div>
          </div>
          <div style="color:#cbd5e1;font-size:0.93rem;margin-bottom:14px;line-height:1.6;">
            {analysis['advice']}
          </div>
          <div>{actions_html}</div>
          <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.05);
          color:#475569;font-size:0.78rem;font-style:italic;">
            💡 {analysis['tip']}
          </div>
        </div>
    """, unsafe_allow_html=True)

# -------------------------------------------------
# HEADER
# -------------------------------------------------
st.markdown("""
<div class="site-header">
    <div class="site-title">AudioVision</div>
    <div class="site-subtitle">Hear · Translate · Read · Understand</div>
</div>
""", unsafe_allow_html=True)

# -------------------------------------------------
# TABS
# -------------------------------------------------
tabs = st.tabs([
    "🎤  Speech Engine",
    "🔊  Voice Studio",
    "🖼️  Vision Assistant",
])

# -------------------------------------------------
# TAB 1 — SPEECH ENGINE
# -------------------------------------------------
with tabs[0]:
    st.markdown('<div class="card">', unsafe_allow_html=True)
    st.markdown('<div class="card-title"><span class="icon">🎤</span> Speech Engine</div>', unsafe_allow_html=True)

    if "stt_mode" not in st.session_state:
        st.session_state["stt_mode"] = "record"

    c1, c2, c3 = st.columns([1, 2, 1])
    with c2:
        p1, p2 = st.columns(2)
        with p1:
            if st.button("🎙  Record Audio", use_container_width=True, type="primary" if st.session_state["stt_mode"]=="record" else "secondary"):
                st.session_state["stt_mode"] = "record"
                st.rerun()
        with p2:
            if st.button("📁  Upload Audio", use_container_width=True, type="primary" if st.session_state["stt_mode"]=="upload" else "secondary"):
                st.session_state["stt_mode"] = "upload"
                st.rerun()

        st.markdown("<br>", unsafe_allow_html=True)
        
        # ── Universal Translation UI ──
        stt_source_options = {
            "English": "en-US", "Hindi": "hi-IN", "Telugu": "te-IN", "Tamil": "ta-IN", 
            "Kannada": "kn-IN", "Malayalam": "ml-IN", "Marathi": "mr-IN", "Bengali": "bn-IN", 
            "Urdu": "ur-IN", "Arabic": "ar-SA", "French": "fr-FR", "Spanish": "es-ES", 
            "German": "de-DE", "Japanese": "ja-JP", "Chinese": "zh-CN"
        }
        
        stt_target_options = {
            "No Translation (Transcription Only)": "none",
            "English": "en", "Hindi": "hi", "Telugu": "te", "Tamil": "ta", "Kannada": "kn", 
            "Malayalam": "ml", "Marathi": "mr", "Bengali": "bn", "Urdu": "ur", 
            "Arabic": "ar", "French": "fr", "Spanish": "es", "German": "de", 
            "Japanese": "ja", "Chinese (Simplified)": "zh-CN"
        }

        col_src, col_tgt = st.columns(2)
        with col_src:
            source_lang_label = st.selectbox("🗣️ Spoken Language:", list(stt_source_options.keys()), index=0)
            source_lang_code = stt_source_options[source_lang_label]
        with col_tgt:
            target_lang_label = st.selectbox("🌍 Translate into:", list(stt_target_options.keys()), index=0)
            target_lang_code = stt_target_options[target_lang_label]

    # ── RECORD AUDIO
    if st.session_state["stt_mode"] == "record":
        st.markdown("""
            <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);
            border-radius:10px;padding:10px 16px;margin-bottom:14px;font-size:0.85rem;color:#94a3b8;">
            💡 <b>Select your spoken language and your target language. The AI will transcribe and translate your voice instantly!
            </div>
        """, unsafe_allow_html=True)
        
        audio_note = st.audio_input("Record a voice note")
        
        if audio_note:
            with st.spinner("Transcribing your voice..."):
                text = recognize_from_audio_file(audio_note, language=source_lang_code)
            st.markdown(f'<div class="result-label">Original Transcription ({source_lang_label})</div><div class="result-box">{text}</div>', unsafe_allow_html=True)
            
            # TRANSLATION INJECTION
            if target_lang_code != "none" and text:
                with st.spinner(f"Translating to {target_lang_label}..."):
                    translated = translate_text(text, target_lang_code)
                    st.markdown(f"""
                        <div class="result-label" style="margin-top:16px;">Translated Text ({target_lang_label})</div>
                        <div class="result-box" style="border-left-color:#38bdf8; background:rgba(56,189,248,0.05);">
                            {translated}
                        </div>
                    """, unsafe_allow_html=True)

            render_context_assistant(text)

    # ── UPLOAD AUDIO
    else:
        uploaded_file = st.file_uploader("Upload an audio file", type=["wav", "mp3", "m4a", "ogg"], key="stt_upload")
        if uploaded_file:
            st.audio(uploaded_file)
            st.markdown('<div class="divider"></div>', unsafe_allow_html=True)

            with st.spinner("Transcribing…"):
                uploaded_file.seek(0)
                fig = plot_waveform(uploaded_file)
                uploaded_file.seek(0)
                text = recognize_from_audio_file(uploaded_file, language=source_lang_code)
                # Pass the source_lang_code here as well
                text = recognize_from_audio_file(uploaded_file, language=source_lang_code)

            st.plotly_chart(fig, use_container_width=True)
            st.markdown(f'<div class="result-label">Original Transcription ({source_lang_label})</div><div class="result-box">{text}</div>', unsafe_allow_html=True)
            
            # TRANSLATION INJECTION
            if target_lang_code != "none" and text:
                with st.spinner(f"Translating to {target_lang_label}..."):
                    translated = translate_text(text, target_lang_code)
                    st.markdown(f"""
                        <div class="result-label" style="margin-top:16px;">Translated Text ({target_lang_label})</div>
                        <div class="result-box" style="border-left-color:#38bdf8; background:rgba(56,189,248,0.05);">
                            {translated}
                        </div>
                    """, unsafe_allow_html=True)

            render_context_assistant(text)

    st.markdown('</div>', unsafe_allow_html=True)

# --------------------------------------------------
# TAB 2 — VOICE STUDIO
# --------------------------------------------------
with tabs[1]:
    st.markdown('<div class="card">', unsafe_allow_html=True)
    st.markdown('<div class="card-title"><span class="icon">🔊</span> Voice Studio — Text to Speech &amp; Translation</div>', unsafe_allow_html=True)
    st.markdown("""
        <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);
        border-radius:10px;padding:10px 16px;margin-bottom:14px;font-size:0.85rem;color:#94a3b8;">
        💡 <b>Voice Studio:</b> Type or paste your script below, choose a target language, and instantly generate a high-fidelity voiceover!
        </div>
    """, unsafe_allow_html=True)

    VOICE_LANG_MAP = {
        "English": "en", "Hindi": "hi", "Telugu": "te", "Tamil": "ta", "Kannada": "kn", "Malayalam": "ml",
        "Marathi": "mr", "Bengali": "bn", "Gujarati": "gu", "Punjabi": "pa", "Urdu": "ur", "Arabic": "ar",
        "French": "fr", "Spanish": "es", "German": "de", "Japanese": "ja", "Chinese (Simplified)": "zh-CN",
        "Korean": "ko", "Russian": "ru", "Portuguese": "pt", "Italian": "it",
    }

    col1, col2 = st.columns([3, 1])
    with col1:
        vs_text = st.text_area("Enter text (any language)", height=160, key="vs_text")
    with col2:
        vs_lang_label = st.selectbox("Target language", list(VOICE_LANG_MAP.keys()), key="vs_lang")
        vs_lang_code  = VOICE_LANG_MAP[vs_lang_label]
        st.markdown("<br>", unsafe_allow_html=True)
        vs_generate = st.button("🔊  Generate", use_container_width=True)

    if vs_generate and vs_text.strip():
        word_count = len(vs_text.split())
        
        with st.spinner(f"Translating to {vs_lang_label}…"):
            translated = translate_text(vs_text, vs_lang_code)
            
        if translated and translated.startswith("⚠️"):
            st.error(translated)
            speak_text = vs_text
            show_translation_box = False
        else:
            speak_text = translated
            show_translation_box = (translated.strip().lower() != vs_text.strip().lower())

        with st.spinner(f"Generating audio ({word_count} words)…"):
            audio_buf = text_to_speech(speak_text, lang=vs_lang_code)

        if isinstance(audio_buf, str):
            st.error(audio_buf)
        else:
            if show_translation_box:
                st.markdown(f'<div class="result-label">Translated Text ({vs_lang_label})</div><div class="result-box">{translated}</div>', unsafe_allow_html=True)
                st.markdown('<div class="divider"></div>', unsafe_allow_html=True)
                
            st.markdown('<div class="result-label">Generated Audio</div>', unsafe_allow_html=True)
            st.audio(audio_buf, format="audio/mp3", autoplay=True)
        cleanup_old_files()

    st.markdown('</div>', unsafe_allow_html=True)
# --------------------------------------------------
# TAB 3 — VISION ASSISTANT
# --------------------------------------------------
with tabs[2]:
    st.markdown('<div class="card">', unsafe_allow_html=True)
    st.markdown('<div class="card-title"><span class="icon">👁️</span> Vision Assistant (OCR + TTS)</div>', unsafe_allow_html=True)

    # 1. Set default state to 'upload'
    if "ocr_mode_sel" not in st.session_state:
        st.session_state["ocr_mode_sel"] = "upload"

    c1, c2, c3 = st.columns([1, 2, 1])
    with c2:
        p1, p2 = st.columns(2)
        # 2. Upload Image is now first (p1)
        with p1:
            if st.button("🖼️  Upload Image", use_container_width=True, type="primary" if st.session_state["ocr_mode_sel"]=="upload" else "secondary"):
                st.session_state["ocr_mode_sel"] = "upload"
                st.rerun()
        # 3. Camera Reader is now second (p2)
        with p2:
            if st.button("📷  Camera Reader", use_container_width=True, type="primary" if st.session_state["ocr_mode_sel"]=="camera" else "secondary"):
                st.session_state["ocr_mode_sel"] = "camera"
                st.rerun()

    st.markdown('<div class="divider"></div>', unsafe_allow_html=True)

    ocr_lang_options = {
        "English Only": ('en',), 
        "English + Hindi": ('en', 'hi'),
        "English + Urdu": ('en', 'ur'),
        "English + Telugu": ('en', 'te'),
        "English + Tamil": ('en', 'ta'),
        "English + Kannada": ('en', 'kn'),
        "English + Malayalam": ('en', 'ml'),
        "English + Marathi": ('en', 'mr'),
        "English + Bengali": ('en', 'bn')
    }

    # ── CAMERA READER
    if st.session_state["ocr_mode_sel"] == "camera":
        
        # INSTRUCTION BLOCK ADDED HERE
        st.markdown("""
            <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);
            border-radius:10px;padding:10px 16px;margin-bottom:14px;font-size:0.85rem;color:#94a3b8;">
            💡 <b>Live Scanner:</b> Take a picture of any text, document, or sign. The AI will extract the words and can read them aloud for you!
            </div>
        """, unsafe_allow_html=True)

        col_cam, col_res = st.columns([1, 1])

        with col_cam:
            live_lang_label = st.selectbox("Language", list(ocr_lang_options.keys()), key="live_lang")
            live_langs = ocr_lang_options[live_lang_label]
            st.markdown("<br>", unsafe_allow_html=True)
            
            camera_photo = st.camera_input("Take a picture to read")

        with col_res:
            st.markdown('<div class="result-label">Detected Text</div>', unsafe_allow_html=True)
            vision_text_slot = st.empty()
            audio_slot       = st.empty()
            
            if not camera_photo:
                vision_text_slot.markdown('<div class="result-box" style="min-height:120px;color:#475569;font-style:italic;">Waiting for image…</div>', unsafe_allow_html=True)
            else:
                with st.spinner("Analyzing image..."):
                    detected_text = extract_text_from_image(camera_photo, langs=live_langs)
                    
                    if detected_text and detected_text != "No text detected in the image.":
                        vision_text_slot.markdown(f"""
                            <div class="result-box" style="border-left-color:#4ade80;min-height:120px;">
                            <span style="color:#4ade80;font-weight:700;font-size:0.75rem;
                            letter-spacing:0.1em;text-transform:uppercase;display:block;margin-bottom:8px;">
                            ● Extracted</span>{detected_text}
                            </div>
                        """, unsafe_allow_html=True)
                        
                        audio_buf = text_to_speech(detected_text, lang="en")
                        if not isinstance(audio_buf, str):
                            b64 = base64.b64encode(audio_buf.getvalue()).decode()
                            audio_slot.markdown(
                                f'<audio autoplay controls style="width:100%; margin-top:15px;"><source src="data:audio/mp3;base64,{b64}" type="audio/mp3"></audio>',
                                unsafe_allow_html=True
                            )
                    else:
                        vision_text_slot.warning("No readable text found. Please try a clearer angle.")

    # ── UPLOAD IMAGE
    else:
        col1, col2 = st.columns([3, 1])
        with col1:
            image = st.file_uploader("Upload image (PNG, JPG, JPEG)", type=["png", "jpg", "jpeg"])
        with col2:
            ocr_lang_label = st.selectbox("OCR Language", list(ocr_lang_options.keys()))
            ocr_langs = ocr_lang_options[ocr_lang_label]

        if image:
            col_img, col_res = st.columns([1, 1])
            with col_img:
                st.image(image, caption="Uploaded Image", use_column_width=True)
            with col_res:
                with st.spinner("Reading text..."):
                    image.seek(0)
                    ocr_text = extract_text_from_image(image, langs=ocr_langs)
                    image.seek(0)
                    detections = extract_text_with_boxes(image, langs=ocr_langs)

                st.markdown(f'<div class="result-label">Extracted Text</div><div class="result-box">{ocr_text}</div>', unsafe_allow_html=True)

                if detections:
                    st.markdown('<div class="divider"></div><div class="result-label">Detection Confidence</div>', unsafe_allow_html=True)
                    for d in detections[:8]:
                        conf = d["confidence"]
                        color = "#4ade80" if conf >= 70 else "#facc15" if conf >= 40 else "#f87171"
                        st.markdown(f"""
                            <div class="conf-bar-wrap">
                                <div class="conf-bar-label">"{d['text']}" — {conf}%</div>
                                <div class="conf-bar-bg">
                                    <div class="conf-bar-fill" style="width:{conf}%;background:{color}"></div>
                                </div>
                            </div>
                        """, unsafe_allow_html=True)

    st.markdown('</div>', unsafe_allow_html=True)