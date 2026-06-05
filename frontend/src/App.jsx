import React, { useState, useEffect } from "react";
import { api } from "./api";
import Settings from "./components/Settings";
import DocumentStudio from "./components/DocumentStudio";
import ChatAssistant from "./components/ChatAssistant";
import SpeechHub from "./components/SpeechHub";
import VoiceStudio from "./components/VoiceStudio";
import VisionScan from "./components/VisionScan";

export default function App() {
  const [activeTab, setActiveTab] = useState("chat");
  const [apiKeyStatus, setApiKeyStatus] = useState("checking"); // 'checking' | 'valid' | 'missing' | 'invalid'

  useEffect(() => {
    checkKeyStatus();
  }, []);

  async function checkKeyStatus(keyOverride = null) {
    const key = keyOverride !== null ? keyOverride : (localStorage.getItem("gemini_api_key") || "");
    if (!key) {
      setApiKeyStatus("missing");
      return;
    }
    
    setApiKeyStatus("checking");
    try {
      const res = await api.checkConfig(key);
      if (res.status === "valid") {
        setApiKeyStatus("valid");
      } else {
        setApiKeyStatus("invalid");
      }
    } catch (err) {
      setApiKeyStatus("invalid");
    }
  }

  function handleKeyChange(newKey) {
    checkKeyStatus(newKey);
  }

  function getTabTitle() {
    switch (activeTab) {
      case "chat":
        return "AuraVision Chat";
      case "documents":
        return "Document RAG Knowledge Studio";
      case "speech":
        return "Real-time Speech Engine Hub";
      case "voice":
        return "Voice Narration TTS Studio";
      case "ocr":
        return "Vision Scanner & OCR Hub";
      case "settings":
        return "System Settings & Connection";
      default:
        return "AuraVision Studio";
    }
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-icon">
              <i className="bi bi-soundwave"></i>
            </div>
            <div className="brand-title">AuraVision</div>
          </div>
        </div>

        <nav className="sidebar-menu">
          <div
            className={`menu-item ${activeTab === "chat" ? "active" : ""}`}
            onClick={() => setActiveTab("chat")}
          >
            <i className="bi bi-chat-dots-fill"></i>
            <span>Chat Assistant</span>
          </div>

          <div
            className={`menu-item ${activeTab === "documents" ? "active" : ""}`}
            onClick={() => setActiveTab("documents")}
          >
            <i className="bi bi-database-fill-gear"></i>
            <span>RAG Document Studio</span>
          </div>

          <div
            className={`menu-item ${activeTab === "speech" ? "active" : ""}`}
            onClick={() => setActiveTab("speech")}
          >
            <i className="bi bi-mic-fill"></i>
            <span>Speech Hub</span>
          </div>

          <div
            className={`menu-item ${activeTab === "voice" ? "active" : ""}`}
            onClick={() => setActiveTab("voice")}
          >
            <i className="bi bi-volume-up-fill"></i>
            <span>Voice Studio</span>
          </div>

          <div
            className={`menu-item ${activeTab === "ocr" ? "active" : ""}`}
            onClick={() => setActiveTab("ocr")}
          >
            <i className="bi bi-eye-fill"></i>
            <span>Vision Scan</span>
          </div>

          <div
            style={{ margin: "15px 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}
          />

          <div
            className={`menu-item ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            <i className="bi bi-gear-fill"></i>
            <span>Settings</span>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="api-status">
            <div className={`status-dot ${
              apiKeyStatus === "valid" ? "active" : 
              (apiKeyStatus === "missing" || apiKeyStatus === "invalid") ? "missing" : ""
            }`}></div>
            <span>
              {apiKeyStatus === "valid" && "Gemini Connected"}
              {apiKeyStatus === "checking" && "Checking Connection..."}
              {apiKeyStatus === "missing" && "Gemini API Key Missing"}
              {apiKeyStatus === "invalid" && "Invalid API Key"}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="content-header">
          <h1 className="header-title">{getTabTitle()}</h1>
          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
            AuraVision v2.0
          </div>
        </header>

        <div className="viewport">
          {activeTab === "chat" && <ChatAssistant />}
          {activeTab === "documents" && <DocumentStudio />}
          {activeTab === "speech" && <SpeechHub />}
          {activeTab === "voice" && <VoiceStudio />}
          {activeTab === "ocr" && <VisionScan />}
          {activeTab === "settings" && <Settings onKeyChange={handleKeyChange} />}
        </div>
      </main>
    </div>
  );
}
