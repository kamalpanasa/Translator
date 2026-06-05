import React, { useState, useEffect, useRef } from "react";
import { api } from "../api";

export default function ChatAssistant() {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // RAG configurations
  const [useRag, setUseRag] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [showDocSelector, setShowDocSelector] = useState(false);

  const [hasApiKey, setHasApiKey] = useState(false);

  const historyEndRef = useRef(null);

  useEffect(() => {
    const key = localStorage.getItem("gemini_api_key");
    setHasApiKey(!!key);
    loadSessions();
    loadDocuments();
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      loadHistory(activeSessionId);
    } else {
      setMessages([]);
    }
  }, [activeSessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function scrollToBottom() {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function loadSessions() {
    try {
      const data = await api.listSessions();
      setSessions(data);
      if (data.length > 0 && !activeSessionId) {
        setActiveSessionId(data[0].id);
      }
    } catch (err) {
      console.error("Failed to load chat sessions:", err);
    }
  }

  async function loadDocuments() {
    try {
      const data = await api.listDocuments();
      setDocuments(data);
      // Select all documents by default
      setSelectedDocIds(data.map(d => d.id));
    } catch (err) {
      console.error("Failed to load documents list:", err);
    }
  }

  async function loadHistory(sessId) {
    setLoadingHistory(true);
    try {
      const history = await api.getSessionHistory(sessId);
      setMessages(history);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleCreateSession() {
    try {
      const res = await api.createSession("New Session");
      setSessions(prev => [res, ...prev]);
      setActiveSessionId(res.session_id);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteSession(sessId, e) {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this chat session?")) return;
    try {
      await api.deleteSession(sessId);
      setSessions(prev => prev.filter(s => s.id !== sessId));
      if (activeSessionId === sessId) {
        setActiveSessionId("");
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || sendingMessage || !activeSessionId) return;

    if (!hasApiKey) {
      alert("Please configure your Gemini API Key in Settings first.");
      return;
    }

    // Optimistically add user message
    const tempUserMsg = { role: "user", content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, tempUserMsg]);
    setInputText("");
    setSendingMessage(true);

    try {
      const res = await api.sendChatMessage(
        activeSessionId,
        text,
        useRag,
        useRag ? selectedDocIds : []
      );
      
      // Update history
      loadHistory(activeSessionId);
      
      // Reload sessions list in case first message renamed it
      if (messages.length === 0) {
        loadSessions();
      }
    } catch (err) {
      console.error(err);
      // Add error message as assistant bubble
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `⚠️ Failed to get reply: ${err.message}`,
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setSendingMessage(false);
    }
  }

  function toggleDocSelection(docId) {
    if (selectedDocIds.includes(docId)) {
      setSelectedDocIds(prev => prev.filter(id => id !== docId));
    } else {
      setSelectedDocIds(prev => [...prev, docId]);
    }
  }

  // Helper to find document name by ID
  function getDocName(docId) {
    const doc = documents.find(d => d.id === docId);
    return doc ? doc.name : "Unknown Document";
  }

  return (
    <div className="grid-1-3" style={{ height: "calc(100vh - 140px)" }}>
      {/* Sessions list sidebar */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%" }}>
        <button className="btn btn-primary" onClick={handleCreateSession} style={{ width: "100%" }}>
          <i className="bi bi-chat-left-text-fill"></i> New Conversation
        </button>

        <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "16px 10px" }}>
          <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-secondary)", textTransform: "uppercase", padding: "0 10px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            Recent Chats
          </div>
          <div style={{ flex: 1, overflowY: "auto", marginTop: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
            {sessions.map((sess) => (
              <div
                key={sess.id}
                onClick={() => setActiveSessionId(sess.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  background: activeSessionId === sess.id ? "rgba(99, 102, 241, 0.08)" : "transparent",
                  border: activeSessionId === sess.id ? "1px solid var(--panel-border-glow)" : "1px solid transparent",
                  transition: "var(--transition)"
                }}
                className="hover-row"
              >
                <div style={{ fontSize: "0.88rem", fontWeight: activeSessionId === sess.id ? 600 : 400, color: activeSessionId === sess.id ? "#fff" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: "8px" }}>
                  <i className="bi bi-chat-right-quote" style={{ marginRight: "8px", color: activeSessionId === sess.id ? "var(--primary)" : "var(--text-muted)" }}></i>
                  {sess.title}
                </div>
                <button
                  style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                  onClick={(e) => handleDeleteSession(sess.id, e)}
                  title="Delete Session"
                >
                  <i className="bi bi-x-circle-fill hover-danger"></i>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main chat window */}
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {!activeSessionId ? (
          <div className="card" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
            <div style={{ textAlign: "center" }}>
              <i className="bi bi-chat-dots" style={{ fontSize: "3rem", display: "block", marginBottom: "15px" }}></i>
              <p style={{ fontWeight: 600 }}>No conversation selected</p>
              <p style={{ fontSize: "0.85rem", marginTop: "4px" }}>Create a new chat or select one from the list to get started.</p>
            </div>
          </div>
        ) : (
          <div className="chat-container">
            {/* Header */}
            <div style={{ padding: "16px 24px", background: "rgba(3,7,18,0.3)", borderBottom: "1px solid var(--panel-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, color: "#fff" }}>
                  {sessions.find(s => s.id === activeSessionId)?.title || "Active Chat"}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  {useRag ? (
                    <span style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>
                      <i className="bi bi-database-fill"></i> Local RAG Mode Active ({selectedDocIds.length} files selected)
                    </span>
                  ) : (
                    <span>General Gemini 1.5 Chat</span>
                  )}
                </div>
              </div>
            </div>

            {/* Messages history */}
            <div className="chat-history">
              {!hasApiKey && (
                <div className="alert alert-warning" style={{ margin: "0 0 16px" }}>
                  <i className="bi bi-exclamation-triangle-fill"></i>
                  Please configure your Google Gemini API Key in the <b>Settings</b> panel to enable Chat features.
                </div>
              )}
              
              {loadingHistory ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-secondary)" }}>
                  <i className="bi bi-arrow-repeat animate-spin" style={{ fontSize: "1.6rem", marginRight: "10px" }}></i>
                  Loading conversation history...
                </div>
              ) : messages.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" }}>
                  <div className="brand-icon" style={{ width: "60px", height: "60px", fontSize: "1.8rem", marginBottom: "15px" }}>
                    <i className="bi bi-cpu"></i>
                  </div>
                  <p style={{ fontWeight: 600, color: "#fff" }}>Ask AuraVision Gemini Agent</p>
                  <p style={{ fontSize: "0.85rem", textAlign: "center", maxWidth: "340px", marginTop: "4px" }}>
                    Send a message to start conversation. You can enable <b>RAG Context</b> below to ask questions about your documents.
                  </p>
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div key={index} className={`chat-message ${msg.role}`}>
                    <div className="message-bubble">
                      <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
                      
                      {/* RAG Context Display */}
                      {msg.role === "assistant" && msg.rag_context && msg.rag_context.length > 0 && (
                        <div className="rag-sources">
                          <div className="rag-source-header" onClick={() => document.getElementById(`ref-${index}`).classList.toggle("hidden-block")}>
                            <i className="bi bi-database-check"></i>
                            Sources Consulted ({msg.rag_context.length})
                          </div>
                          <div id={`ref-${index}`} className="rag-ref-container">
                            {msg.rag_context.map((source, sIdx) => (
                              <div key={sIdx} className="rag-source-card">
                                <div>"{source.text}"</div>
                                <div className="source-meta">
                                  <span><i className="bi bi-file-earmark-text"></i> {getDocName(source.document_id)}</span>
                                  <span>Match: {(source.score * 100).toFixed(1)}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="message-timestamp">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              )}
              {sendingMessage && (
                <div className="chat-message assistant">
                  <div className="message-bubble" style={{ background: "rgba(255,255,255,0.02)", display: "flex", gap: "6px" }}>
                    <span style={{ animation: "pulse-slow 0.8s infinite alternate" }}>●</span>
                    <span style={{ animation: "pulse-slow 0.8s infinite alternate 0.2s" }}>●</span>
                    <span style={{ animation: "pulse-slow 0.8s infinite alternate 0.4s" }}>●</span>
                  </div>
                </div>
              )}
              <div ref={historyEndRef} />
            </div>

            {/* Input form */}
            <form onSubmit={handleSend} className="chat-input-area">
              {/* Toggles bar */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: "10px" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", cursor: "pointer", color: useRag ? "#fff" : "var(--text-secondary)" }}>
                  <input
                    type="checkbox"
                    checked={useRag}
                    onChange={(e) => {
                      setUseRag(e.target.checked);
                      if (e.target.checked && documents.length === 0) {
                        loadDocuments();
                      }
                    }}
                    style={{ accentColor: "var(--primary)" }}
                  />
                  <span>Retrieve from Knowledge Documents (RAG)</span>
                </label>

                {useRag && documents.length > 0 && (
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      className="btn"
                      style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "0.78rem" }}
                      onClick={() => setShowDocSelector(!showDocSelector)}
                    >
                      <i className="bi bi-funnel-fill"></i> Select Files ({selectedDocIds.length}/{documents.length})
                    </button>
                    {showDocSelector && (
                      <div style={{ position: "absolute", bottom: "100%", left: 0, background: "var(--bg-color)", border: "1px solid var(--panel-border)", borderRadius: "8px", padding: "12px", zIndex: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.5)", width: "240px", maxHeight: "180px", overflowY: "auto", marginBottom: "8px" }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "6px" }}>Filter Files</div>
                        {documents.map((doc) => (
                          <label key={doc.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", padding: "4px 0", cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={selectedDocIds.includes(doc.id)}
                              onChange={() => toggleDocSelection(doc.id)}
                            />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="chat-input-row">
                <input
                  type="text"
                  className="input-text"
                  placeholder={useRag ? "Ask something about your indexed documents..." : "Ask Gemini anything..."}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={sendingMessage || !activeSessionId}
                  style={{ flex: 1 }}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={sendingMessage || !inputText.trim() || !activeSessionId}
                >
                  <i className="bi bi-send-fill"></i> Send
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
