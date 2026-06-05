const getApiBase = () => {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    if (window.location.port === "5173") {
      return "http://localhost:8000/api";
    }
  }
  return window.location.origin + "/api";
};
const API_BASE = getApiBase();

function getHeaders() {
  const headers = {
    "Content-Type": "application/json",
  };
  const key = localStorage.getItem("gemini_api_key");
  if (key) {
    headers["X-Gemini-API-Key"] = key;
  }
  return headers;
}

export const api = {
  // Check configurations
  async checkConfig(key = null) {
    const headers = { ...getHeaders() };
    if (key) {
      headers["X-Gemini-API-Key"] = key;
    }
    const res = await fetch(`${API_BASE}/config/check`, { headers });
    return res.json();
  },

  // Speech engine
  async transcribeAudio(file, language = "en-US") {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("language", language);
    
    const key = localStorage.getItem("gemini_api_key");
    const headers = {};
    if (key) {
      headers["X-Gemini-API-Key"] = key;
    }

    const res = await fetch(`${API_BASE}/speech/transcribe`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Transcription failed");
    }
    return res.json();
  },

  // Voice Studio (TTS)
  async generateSpeech(text, lang = "en") {
    const res = await fetch(`${API_BASE}/voice/tts`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ text, lang }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "TTS generation failed");
    }
    return res.blob(); // Returns audio stream blob
  },

  // Translation
  async translateText(text, targetLang) {
    const res = await fetch(`${API_BASE}/translation/translate`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ text, target_lang: targetLang }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Translation failed");
    }
    return res.json();
  },

  // Vision OCR
  async processOCR(file, langs = "en") {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("langs", langs);

    const key = localStorage.getItem("gemini_api_key");
    const headers = {};
    if (key) {
      headers["X-Gemini-API-Key"] = key;
    }

    const res = await fetch(`${API_BASE}/vision/ocr`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "OCR failed");
    }
    return res.json();
  },

  // Documents (RAG)
  async uploadDocument(file) {
    const formData = new FormData();
    formData.append("file", file);

    const key = localStorage.getItem("gemini_api_key");
    const headers = {};
    if (key) {
      headers["X-Gemini-API-Key"] = key;
    }

    const res = await fetch(`${API_BASE}/documents/upload`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Document upload failed");
    }
    return res.json();
  },

  async listDocuments() {
    const res = await fetch(`${API_BASE}/documents/list`);
    if (!res.ok) throw new Error("Failed to load documents");
    return res.json();
  },

  async deleteDocument(docId) {
    const res = await fetch(`${API_BASE}/documents/${docId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete document");
    return res.json();
  },

  // Chat sessions
  async listSessions() {
    const res = await fetch(`${API_BASE}/chat/sessions`);
    if (!res.ok) throw new Error("Failed to load chat sessions");
    return res.json();
  },

  async createSession(title = "New Chat Session") {
    const res = await fetch(`${API_BASE}/chat/sessions`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error("Failed to create chat session");
    return res.json();
  },

  async deleteSession(sessionId) {
    const res = await fetch(`${API_BASE}/chat/sessions/${sessionId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete chat session");
    return res.json();
  },

  async getSessionHistory(sessionId) {
    const res = await fetch(`${API_BASE}/chat/history/${sessionId}`);
    if (!res.ok) throw new Error("Failed to load chat history");
    return res.json();
  },

  async sendChatMessage(sessionId, message, useRag = false, documentIds = []) {
    const res = await fetch(`${API_BASE}/chat/send`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        session_id: sessionId,
        message,
        use_rag: useRag,
        document_ids: documentIds,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to send message");
    }
    return res.json();
  },
};
