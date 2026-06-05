import React, { useState, useRef, useEffect } from "react";
import { api } from "../api";

export default function VisionScan() {
  const [ocrMode, setOcrMode] = useState("upload"); // 'upload' | 'camera'
  const [ocrLangs, setOcrLangs] = useState("en");
  const [loading, setLoading] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [detections, setDetections] = useState([]);
  
  // Image states
  const [imageUrl, setImageUrl] = useState("");
  const [originalWidth, setOriginalWidth] = useState(0);
  const [originalHeight, setOriginalHeight] = useState(0);
  
  // Audio playback
  const [audioUrl, setAudioUrl] = useState("");
  const [playingAudio, setPlayingAudio] = useState(false);

  // Camera scanner references
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);

  const OCR_LANG_OPTIONS = {
    "English Only": "en", 
    "English + Hindi": "en,hi",
    "English + Urdu": "en,ur",
    "English + Telugu": "en,te",
    "English + Tamil": "en,ta",
    "English + Kannada": "en,kn",
    "English + Malayalam": "en,ml",
    "English + Marathi": "en,mr",
    "English + Bengali": "en,bn"
  };

  // Stop camera stream when component unmounts or mode changes
  useEffect(() => {
    if (ocrMode !== "camera") {
      stopCamera();
    }
  }, [ocrMode]);

  async function startCamera() {
    setCameraActive(true);
    setExtractedText("");
    setDetections([]);
    setImageUrl("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error(err);
      alert("Unable to access camera.");
      setCameraActive(false);
    }
  }

  function stopCamera() {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Save image info
    setOriginalWidth(canvas.width);
    setOriginalHeight(canvas.height);

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
      stopCamera();
      
      const file = new File([blob], "captured_ocr.png", { type: "image/png" });
      runOCR(file);
    }, "image/png");
  }

  function handleFileSelect(e) {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      setExtractedText("");
      setDetections([]);
      
      // Get image dimensions to scale coordinates
      const img = new Image();
      img.onload = () => {
        setOriginalWidth(img.width);
        setOriginalHeight(img.height);
        runOCR(file);
      };
      img.src = url;
    }
  }

  async function runOCR(file) {
    setLoading(true);
    setAudioUrl("");
    try {
      const res = await api.processOCR(file, ocrLangs);
      setExtractedText(res.text);
      setDetections(res.detections || []);
    } catch (err) {
      console.error(err);
      setExtractedText(`⚠️ OCR processing failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function readTextAloud() {
    if (!extractedText || playingAudio) return;
    setPlayingAudio(true);
    try {
      const audioBlob = await api.generateSpeech(extractedText, "en");
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
    } catch (err) {
      console.error("Audio generation failed:", err);
      alert("TTS Engine failed: " + err.message);
    } finally {
      setPlayingAudio(false);
    }
  }

  // Calculate box styles dynamically relative to loaded image container dimensions
  function getBoxStyle(box) {
    if (!imgRef.current || originalWidth === 0 || originalHeight === 0) return {};
    
    const displayWidth = imgRef.current.clientWidth;
    const displayHeight = imgRef.current.clientHeight;

    const scaleX = displayWidth / originalWidth;
    const scaleY = displayHeight / originalHeight;

    // EasyOCR bounding box coordinates: [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
    // Find min and max X & Y
    const xCoords = box.map(pt => pt[0]);
    const yCoords = box.map(pt => pt[1]);
    
    const minX = Math.min(...xCoords) * scaleX;
    const maxX = Math.max(...xCoords) * scaleX;
    const minY = Math.min(...yCoords) * scaleY;
    const maxY = Math.max(...yCoords) * scaleY;

    return {
      left: `${minX}px`,
      top: `${minY}px`,
      width: `${maxX - minX}px`,
      height: `${maxY - minY}px`,
    };
  }

  function getConfColor(conf) {
    if (conf >= 70) return "var(--accent-green)";
    if (conf >= 40) return "var(--accent-yellow)";
    return "var(--accent-red)";
  }

  return (
    <div className="grid-2">
      {/* Visual Input Panel */}
      <div>
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <i className="bi bi-eye-fill" style={{ color: "var(--primary)" }}></i>
              Visual Input Stream
            </div>
            
            <div className="btn-tab-group">
              <button className={`btn-tab ${ocrMode === "upload" ? "active" : ""}`} onClick={() => setOcrMode("upload")}>
                Upload Image
              </button>
              <button className={`btn-tab ${ocrMode === "camera" ? "active" : ""}`} onClick={() => setOcrMode("camera")}>
                Camera Scanner
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">OCR Recognition Languages</label>
            <select className="select-input" value={ocrLangs} onChange={(e) => setOcrLangs(e.target.value)}>
              {Object.entries(OCR_LANG_OPTIONS).map(([label, val]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {ocrMode === "camera" ? (
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              {cameraActive ? (
                <div>
                  <video ref={videoRef} autoPlay playsInline style={{ width: "100%", borderRadius: "8px", background: "#000", maxHeight: "280px" }}></video>
                  <canvas ref={canvasRef} style={{ display: "none" }}></canvas>
                  <div className="btn-group" style={{ marginTop: "12px", justifyContent: "center" }}>
                    <button className="btn btn-primary" onClick={capturePhoto}>
                      <i className="bi bi-camera-fill"></i> Capture Frame
                    </button>
                    <button className="btn" onClick={stopCamera}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: "40px 0" }}>
                  <button className="btn btn-primary" onClick={startCamera}>
                    <i className="bi bi-camera-video-fill"></i> Turn on Live Camera
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Select Document / Sign Image</label>
              <input
                type="file"
                className="input-text"
                accept="image/*"
                onChange={handleFileSelect}
              />
            </div>
          )}

          {imageUrl && (
            <div style={{ marginTop: "20px" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "8px", textTransform: "uppercase" }}>
                Interactive Bounding Box View
              </div>
              <div className="ocr-viewer">
                <div className="ocr-image-wrapper">
                  <img
                    ref={imgRef}
                    src={imageUrl}
                    className="ocr-image"
                    alt="Source Scan"
                  />
                  {/* Overlay bounding boxes */}
                  {!loading && detections.map((det, idx) => (
                    <div
                      key={idx}
                      className="ocr-bounding-box"
                      style={getBoxStyle(det.box)}
                      title={`Confidence: ${det.confidence}%`}
                    >
                      <div className="ocr-tooltip">{det.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* OCR Text Result Panel */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div className="card" style={{ flex: 1, minHeight: "260px" }}>
          <div className="card-header">
            <div className="card-title">
              <i className="bi bi-file-text" style={{ color: "var(--accent-cyan)" }}></i>
              Detected OCR Text
            </div>
            {extractedText && !loading && (
              <button className="btn" onClick={readTextAloud} disabled={playingAudio} style={{ padding: "6px 12px", borderRadius: "8px", fontSize: "0.8rem" }}>
                {playingAudio ? <i className="bi bi-arrow-repeat animate-spin"></i> : <i className="bi bi-megaphone-fill"></i>}
                Auto-Read
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
              <i className="bi bi-arrow-repeat animate-spin" style={{ fontSize: "2rem", display: "block", marginBottom: "10px" }}></i>
              Executing OCR Scan...
            </div>
          ) : extractedText ? (
            <div>
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--panel-border)", borderRadius: "10px", padding: "16px", minHeight: "130px", fontSize: "0.95rem", whiteSpace: "pre-wrap", color: "#fff" }}>
                {extractedText}
              </div>
              
              {audioUrl && (
                <div style={{ marginTop: "14px" }}>
                  <audio src={audioUrl} controls autoPlay style={{ width: "100%" }}></audio>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "60px 40px", color: "var(--text-muted)", fontStyle: "italic" }}>
              Upload or capture an image to perform text extraction.
            </div>
          )}
        </div>

        {detections.length > 0 && !loading && (
          <div className="card" style={{ maxHeight: "250px", overflowY: "auto" }}>
            <div className="card-header">
              <div className="card-title" style={{ fontSize: "0.95rem" }}>
                OCR Detection Scores
              </div>
            </div>
            {detections.slice(0, 8).map((det, idx) => (
              <div key={idx} className="conf-bar-wrap">
                <div className="conf-bar-label">
                  "{det.text}" — {det.confidence}%
                </div>
                <div className="conf-bar-bg">
                  <div
                    className="conf-bar-fill"
                    style={{ width: `${det.confidence}%`, background: getConfColor(det.confidence) }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
