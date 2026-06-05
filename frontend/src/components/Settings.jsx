import React, { useState, useEffect } from "react";
import { api } from "../api";

export default function Settings({ onKeyChange }) {
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState("checking");
  const [statusMsg, setStatusMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem("gemini_api_key") || "";
    setApiKey(savedKey);
    checkCurrentKey(savedKey);
  }, []);

  async function checkCurrentKey(key) {
    if (!key) {
      setStatus("missing");
      setStatusMsg("No API Key configured. Please enter your Gemini API key below.");
      return;
    }
    setStatus("checking");
    try {
      const res = await api.checkConfig(key);
      if (res.status === "valid") {
        setStatus("valid");
        setStatusMsg("Connection successful! Gemini LLM & RAG indexing features are enabled.");
      } else {
        setStatus("invalid");
        setStatusMsg(res.message || "Invalid API key or network connection failed.");
      }
    } catch (err) {
      setStatus("invalid");
      setStatusMsg("Failed to connect to backend server.");
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const trimmed = apiKey.trim();
      const res = await api.checkConfig(trimmed);
      if (res.status === "valid") {
        localStorage.setItem("gemini_api_key", trimmed);
        setStatus("valid");
        setStatusMsg("API key saved successfully! Gemini LLM & RAG features are active.");
        if (onKeyChange) onKeyChange(trimmed);
      } else {
        setStatus("invalid");
        setStatusMsg(res.message || "API connection check failed. Key not saved.");
      }
    } catch (err) {
      setStatus("invalid");
      setStatusMsg(err.message || "Failed to check configuration.");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    localStorage.removeItem("gemini_api_key");
    setApiKey("");
    setStatus("missing");
    setStatusMsg("API Key cleared.");
    if (onKeyChange) onKeyChange("");
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <i className="bi bi-gear-fill" style={{ color: "var(--primary)" }}></i>
            Settings &amp; Configuration
          </div>
        </div>

        {status === "checking" && (
          <div className="alert alert-info">
            <i className="bi bi-info-circle-fill"></i>
            Checking Gemini API Key status...
          </div>
        )}
        {status === "valid" && (
          <div className="alert alert-success">
            <i className="bi bi-check-circle-fill"></i>
            {statusMsg}
          </div>
        )}
        {status === "invalid" && (
          <div className="alert alert-error">
            <i className="bi bi-exclamation-triangle-fill"></i>
            {statusMsg}
          </div>
        )}
        {status === "missing" && (
          <div className="alert alert-warning">
            <i className="bi bi-exclamation-circle-fill"></i>
            {statusMsg}
          </div>
        )}

        <form onSubmit={handleSave} style={{ marginTop: "20px" }}>
          <div className="form-group">
            <label className="form-label">Google Gemini API Key</label>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                type={showKey ? "text" : "password"}
                className="input-text"
                placeholder="AIzaSy..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn"
                onClick={() => setShowKey(!showKey)}
                title={showKey ? "Hide Key" : "Show Key"}
              >
                <i className={showKey ? "bi bi-eye-slash-fill" : "bi bi-eye-fill"}></i>
              </button>
            </div>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "6px" }}>
              Your key is saved locally in your browser storage and never transmitted to anyone except the local backend.
            </p>
          </div>

          <div className="btn-group">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <i className="bi bi-arrow-repeat animate-spin"></i> Testing Connection...
                </>
              ) : (
                <>
                  <i className="bi bi-save2-fill"></i> Save API Key
                </>
              )}
            </button>
            {apiKey && (
              <button type="button" className="btn btn-danger" onClick={handleClear}>
                <i className="bi bi-trash-fill"></i> Clear Key
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
