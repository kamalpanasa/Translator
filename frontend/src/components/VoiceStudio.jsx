import React, { useState } from "react";
import { api } from "../api";

export default function VoiceStudio() {
  const [text, setText] = useState("");
  const [lang, setLang] = useState("en");
  const [generating, setGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [autoTranslate, setAutoTranslate] = useState(true);

  const VOICE_LANGS = {
    "English": "en", "Hindi": "hi", "Telugu": "te", "Tamil": "ta", "Kannada": "kn", "Malayalam": "ml",
    "Marathi": "mr", "Bengali": "bn", "Gujarati": "gu", "Punjabi": "pa", "Urdu": "ur", "Arabic": "ar",
    "French": "fr", "Spanish": "es", "German": "de", "Japanese": "ja", "Chinese (Simplified)": "zh-CN",
    "Korean": "ko", "Russian": "ru", "Portuguese": "pt", "Italian": "it"
  };

  async function handleGenerate(e) {
    e.preventDefault();
    if (!text.trim() || generating) return;
    
    setGenerating(true);
    setErrorMsg("");
    setAudioUrl("");
    setTranslatedText("");

    try {
      let textToSynthesize = text;
      if (autoTranslate) {
        try {
          const transRes = await api.translateText(text, lang);
          if (transRes && transRes.translated_text) {
            textToSynthesize = transRes.translated_text;
            setTranslatedText(transRes.translated_text);
          }
        } catch (transErr) {
          console.warn("Translation failed, falling back to original script:", transErr);
        }
      }

      const audioBlob = await api.generateSpeech(textToSynthesize, lang);
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Failed to generate text-to-speech audio.");
    } finally {
      setGenerating(false);
    }
  }



  function getWordCount() {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }

  return (
    <div className="grid-2">
      {/* Script Generator & Controls */}
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

        {/* Text Input area */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <i className="bi bi-volume-up-fill" style={{ color: "var(--primary)" }}></i>
              Synthesize Speech
            </div>
          </div>

          <form onSubmit={handleGenerate}>
            <div className="form-group">
              <label className="form-label">Voice Script Narration</label>
              <textarea
                className="textarea-input"
                rows="6"
                placeholder="Type or paste narration script content here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={1000}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                <span>Word count: {getWordCount()}</span>
                <span>Max 1000 chars</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Target Voice Language / Accent</label>
              <select className="select-input" value={lang} onChange={(e) => setLang(e.target.value)}>
                {Object.entries(VOICE_LANGS).map(([label, val]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ flexDirection: "row", alignItems: "center", gap: "8px", display: "flex", marginTop: "12px", marginBottom: "16px" }}>
              <input
                type="checkbox"
                id="autoTranslate"
                checked={autoTranslate}
                onChange={(e) => setAutoTranslate(e.target.checked)}
                style={{ cursor: "pointer", width: "16px", height: "16px" }}
              />
              <label htmlFor="autoTranslate" style={{ cursor: "pointer", fontSize: "0.85rem", userSelect: "none" }}>
                Auto-translate script to target language before speech
              </label>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={generating || !text.trim()}>
              {generating ? (
                <>
                  <i className="bi bi-arrow-repeat animate-spin"></i> Rendering voiceover...
                </>
              ) : (
                <>
                  <i className="bi bi-soundwave"></i> Generate Voiceover Audio
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Outputs */}
      <div>
        <div className="card" style={{ minHeight: "260px" }}>
          <div>
            <div className="card-header">
              <div className="card-title">
                <i className="bi bi-play-btn-fill" style={{ color: "var(--accent-cyan)" }}></i>
                Studio Player Output
              </div>
            </div>

            {errorMsg && (
              <div className="alert alert-error">
                <i className="bi bi-exclamation-triangle-fill"></i>
                {errorMsg}
              </div>
            )}

            {translatedText && (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--panel-border)", borderRadius: "10px", padding: "16px", marginBottom: "16px" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary)", marginBottom: "6px", textTransform: "uppercase" }}>
                  Translated Script ({Object.keys(VOICE_LANGS).find(k => VOICE_LANGS[k] === lang) || lang})
                </div>
                <div style={{ fontSize: "0.95rem", color: "#fff", whiteSpace: "pre-wrap" }}>
                  {translatedText}
                </div>
              </div>
            )}

            {generating ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
                <i className="bi bi-arrow-repeat animate-spin" style={{ fontSize: "2rem", display: "block", marginBottom: "10px" }}></i>
                Synthesizing high-fidelity AI audio...
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "4px" }}>Splitting sentences and resolving TTS concurrently</p>
              </div>
            ) : audioUrl ? (
              <div style={{ padding: "20px 0", textAlign: "center" }}>
                <div className="brand-icon animate-pulse" style={{ width: "64px", height: "64px", borderRadius: "50%", margin: "0 auto 20px", fontSize: "1.6rem", background: "var(--primary)" }}>
                  <i className="bi bi-headphones"></i>
                </div>
                <p style={{ fontWeight: 600, color: "#fff", marginBottom: "12px" }}>Audio synthesis complete!</p>
                <audio src={audioUrl} controls autoPlay style={{ width: "100%", marginTop: "10px" }}></audio>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "60px 40px", color: "var(--text-muted)", fontStyle: "italic" }}>
                Generate a voiceover from the script panel to enable the player.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
