import React, { useState, useEffect, useRef } from "react";
import { api } from "../api";

export default function SpeechHub() {
  const [sttMode, setSttMode] = useState("record"); // 'record' | 'upload'
  const [sourceLang, setSourceLang] = useState("en-US");
  const [targetLang, setTargetLang] = useState("none");
  const [transcribing, setTranscribing] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [translationText, setTranslationText] = useState("");
  
  // Waveform data returned from backend
  const [waveformPoints, setWaveformPoints] = useState(null);

  // Recording state
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const leftChannelSamplesRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  


  const STT_SOURCES = {
    "English": "en-US", "Hindi": "hi-IN", "Telugu": "te-IN", "Tamil": "ta-IN", 
    "Kannada": "kn-IN", "Malayalam": "ml-IN", "Marathi": "mr-IN", "Bengali": "bn-IN", 
    "Urdu": "ur-IN", "Arabic": "ar-SA", "French": "fr-FR", "Spanish": "es-ES", 
    "German": "de-DE", "Japanese": "ja-JP", "Chinese": "zh-CN"
  };
  
  const STT_TARGETS = {
    "No Translation (Transcription Only)": "none",
    "English": "en", "Hindi": "hi", "Telugu": "te", "Tamil": "ta", "Kannada": "kn", 
    "Malayalam": "ml", "Marathi": "mr", "Bengali": "bn", "Urdu": "ur", 
    "Arabic": "ar", "French": "fr", "Spanish": "es", "German": "de", 
    "Japanese": "ja", "Chinese (Simplified)": "zh-CN"
  };



  // Timer for recording
  useEffect(() => {
    if (recording) {
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setRecordingDuration(0);
    }
    return () => clearInterval(timerRef.current);
  }, [recording]);

  function formatTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  // Web Audio PCM WAV Encoder Helpers
  function writeUTFBytes(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  function encodeWAV(samples, sampleRate = 16000) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    /* RIFF identifier */
    writeUTFBytes(view, 0, 'RIFF');
    /* file length */
    view.setUint32(4, 36 + samples.length * 2, true);
    /* RIFF type */
    writeUTFBytes(view, 8, 'WAVE');
    /* format chunk identifier */
    writeUTFBytes(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw PCM = 1) */
    view.setUint16(20, 1, true);
    /* channel count (mono) */
    view.setUint16(22, 1, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * 2, true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, 2, true);
    /* bits per sample */
    view.setUint16(34, 16, true);
    /* data chunk identifier */
    writeUTFBytes(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, samples.length * 2, true);

    // Write PCM audio samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  // Web Audio Recording handlers
  async function startRecording() {
    leftChannelSamplesRef.current = [];
    setRecordedBlob(null);
    setTranscription("");
    setTranslationText("");
    setWaveformPoints(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      
      const source = audioCtx.createMediaStreamSource(stream);
      // ScriptProcessorNode: 4096 buffer size, 1 input channel, 1 output channel
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        leftChannelSamplesRef.current.push(...inputData);
      };
      
      source.connect(processor);
      processor.connect(audioCtx.destination);
      
      setRecording(true);
    } catch (err) {
      console.error(err);
      alert("Microphone access denied or unsupported browser: " + err.message);
    }
  }

  function stopRecording() {
    if (recording) {
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      setRecording(false);
      
      // Encode collected samples to WAV format
      const samples = new Float32Array(leftChannelSamplesRef.current);
      const wavBlob = encodeWAV(samples, 16000);
      setRecordedBlob(wavBlob);
      
      // Auto transcribe once stopped
      processAudio(wavBlob);
    }
  }

  async function processAudio(blob) {
    setTranscribing(true);
    setTranscription("");
    setTranslationText("");
    
    try {
      // Package file upload (convert blob into file-like representation)
      const audioFile = new File([blob], "recorded_audio.wav", { type: "audio/wav" });
      const res = await api.transcribeAudio(audioFile, sourceLang);
      
      setTranscription(res.transcription);
      setWaveformPoints(res.waveform);
      
      // Perform translation if target language is selected
      if (targetLang !== "none" && res.transcription && !res.transcription.startsWith("⚠️")) {
        const transRes = await api.translateText(res.transcription, targetLang);
        setTranslationText(transRes.translated_text);
      }
    } catch (err) {
      console.error(err);
      setTranscription(`⚠️ Transcription error: ${err.message}`);
    } finally {
      setTranscribing(false);
    }
  }

  function handleFileChange(e) {
    if (e.target.files && e.target.files[0]) {
      setRecordedBlob(null);
      setTranscription("");
      setTranslationText("");
      setWaveformPoints(null);
      processAudio(e.target.files[0]);
    }
  }

  return (
    <div className="grid-2">
      {/* Configuration & Controls */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <i className="bi bi-mic-fill" style={{ color: "var(--primary)" }}></i>
              Audio Processing
            </div>
            
            <div className="btn-tab-group">
              <button className={`btn-tab ${sttMode === "record" ? "active" : ""}`} onClick={() => setSttMode("record")}>
                Record Voice
              </button>
              <button className={`btn-tab ${sttMode === "upload" ? "active" : ""}`} onClick={() => setSttMode("upload")}>
                Upload File
              </button>
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">🗣️ Spoken Language</label>
              <select className="select-input" value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
                {Object.entries(STT_SOURCES).map(([label, val]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">🌍 Translate Speech To</label>
              <select className="select-input" value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
                {Object.entries(STT_TARGETS).map(([label, val]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: "16px", textAlign: "center" }}>
            {sttMode === "record" ? (
              <div style={{ padding: "20px 0" }}>
                {recording ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                    <div className="brand-icon animate-pulse" style={{ background: "var(--accent-red)", width: "70px", height: "70px", borderRadius: "50%", cursor: "pointer", fontSize: "1.8rem" }} onClick={stopRecording}>
                      <i className="bi bi-stop-fill"></i>
                    </div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>Recording... {formatTime(recordingDuration)}</div>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Click the red button to stop and transribe.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                    <div className="brand-icon" style={{ width: "70px", height: "70px", borderRadius: "50%", cursor: "pointer", fontSize: "1.8rem" }} onClick={startRecording}>
                      <i className="bi bi-mic"></i>
                    </div>
                    <div style={{ fontWeight: 600 }}>Start voice note recording</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Select Audio File (WAV, MP3, OGG)</label>
                <input
                  type="file"
                  className="input-text"
                  accept="audio/*"
                  onChange={handleFileChange}
                />
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Outputs */}
      <div>
        <div className="card" style={{ minHeight: "260px" }}>
          <div className="card-header">
            <div className="card-title">
              <i className="bi bi-file-earmark-text-fill" style={{ color: "var(--accent-cyan)" }}></i>
              Transcription
            </div>
          </div>

          {transcribing ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
              <i className="bi bi-arrow-repeat animate-spin" style={{ fontSize: "2rem", display: "block", marginBottom: "10px" }}></i>
              Transcribing audio voice note...
            </div>
          ) : transcription ? (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--panel-border)", borderRadius: "10px", padding: "16px", minHeight: "150px", fontSize: "1rem", whiteSpace: "pre-wrap", color: "#fff" }}>
              {transcription}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "60px 40px", color: "var(--text-muted)", fontStyle: "italic" }}>
              Speak or upload a file to view transcription transcript.
            </div>
          )}
        </div>

        {translationText && (
          <div className="card" style={{ minHeight: "200px" }}>
            <div className="card-header">
              <div className="card-title">
                <i className="bi bi-translate" style={{ color: "var(--secondary)" }}></i>
                Live Translation
              </div>
            </div>
            <div style={{ background: "rgba(6,182,212,0.03)", border: "1px solid rgba(6,182,212,0.12)", borderRadius: "10px", padding: "16px", minHeight: "100px", fontSize: "1rem", whiteSpace: "pre-wrap", color: "#fff" }}>
              {translationText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
