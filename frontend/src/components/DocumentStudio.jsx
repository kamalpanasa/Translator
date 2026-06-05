import React, { useState, useEffect, useRef } from "react";
import { api } from "../api";

export default function DocumentStudio() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadDocs();
  }, []);

  async function loadDocs() {
    setLoading(true);
    try {
      const data = await api.listDocuments();
      setDocuments(data);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to load uploaded documents. Make sure backend is running.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(file) {
    if (!file) return;
    setErrorMsg("");
    setSuccessMsg("");
    
    // Check key
    const hasKey = localStorage.getItem("gemini_api_key");
    if (!hasKey) {
      setErrorMsg("Please enter your Gemini API Key in the Settings page first before uploading.");
      return;
    }

    setUploading(true);
    try {
      const res = await api.uploadDocument(file);
      if (res.status === "success") {
        setSuccessMsg(`"${file.name}" uploaded and indexed successfully into local RAG database!`);
        loadDocs();
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Failed to process and index document.");
    } finally {
      setUploading(false);
    }
  }

  function handleDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }

  function handleFileSelect(e) {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  }

  async function handleDelete(docId, name) {
    if (!confirm(`Are you sure you want to delete "${name}" from RAG workspace?`)) return;
    try {
      await api.deleteDocument(docId);
      setSuccessMsg(`Document "${name}" deleted.`);
      loadDocs();
    } catch (err) {
      setErrorMsg("Failed to delete document.");
    }
  }

  function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }

  return (
    <div className="grid-1-3">
      {/* Sidebar/Upload Zone */}
      <div>
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <i className="bi bi-file-earmark-arrow-up-fill" style={{ color: "var(--primary)" }}></i>
              Upload Documents
            </div>
          </div>
          
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "16px" }}>
            Add PDFs, TXT, or MD files to the AuraVision workspace. They will be chunked and embedded locally using Gemini.
          </p>

          <div
            className={`file-uploader ${dragActive ? "dragging" : ""}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              style={{ display: "none" }}
              accept=".pdf,.txt,.md"
            />
            <div className="uploader-icon">
              <i className="bi bi-cloud-arrow-up"></i>
            </div>
            {uploading ? (
              <div>
                <p style={{ fontWeight: 600 }}>Indexing chunks...</p>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "4px" }}>
                  Generating vector embeddings
                </p>
              </div>
            ) : (
              <div>
                <p style={{ fontWeight: 600 }}>Click to browse or drag file here</p>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "4px" }}>
                  Supports PDF, TXT, MD up to 20MB
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main List Workspace */}
      <div>
        <div className="card" style={{ minHeight: "350px" }}>
          <div className="card-header">
            <div className="card-title">
              <i className="bi bi-folder-fill" style={{ color: "var(--secondary)" }}></i>
              RAG Knowledge Library ({documents.length})
            </div>
          </div>

          {errorMsg && (
            <div className="alert alert-error">
              <i className="bi bi-exclamation-triangle-fill"></i>
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="alert alert-success">
              <i className="bi bi-check-circle-fill"></i>
              {successMsg}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
              <i className="bi bi-arrow-repeat animate-spin" style={{ fontSize: "1.8rem", display: "block", marginBottom: "10px" }}></i>
              Loading files library...
            </div>
          ) : documents.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 40px", color: "var(--text-muted)" }}>
              <i className="bi bi-file-earmark-text" style={{ fontSize: "3rem", display: "block", marginBottom: "15px" }}></i>
              <p style={{ fontSize: "1rem", fontWeight: 600 }}>No documents uploaded yet</p>
              <p style={{ fontSize: "0.85rem", marginTop: "4px" }}>Upload files on the left to start asking questions against your local knowledge base.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.92rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}>
                    <th style={{ padding: "12px 8px" }}>Name</th>
                    <th style={{ padding: "12px 8px" }}>Format</th>
                    <th style={{ padding: "12px 8px" }}>Size</th>
                    <th style={{ padding: "12px 8px" }}>Indexed On</th>
                    <th style={{ padding: "12px 8px", textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr
                      key={doc.id}
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                      className="hover-row"
                    >
                      <td style={{ padding: "14px 8px", fontWeight: 500, color: "#fff" }}>
                        <i className="bi bi-file-text-fill" style={{ marginRight: "8px", color: "var(--primary)" }}></i>
                        {doc.name}
                      </td>
                      <td style={{ padding: "14px 8px", color: "var(--text-secondary)" }}>
                        <span style={{
                          background: "rgba(255,255,255,0.04)",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          textTransform: "uppercase"
                        }}>
                          {doc.file_type.replace(".", "")}
                        </span>
                      </td>
                      <td style={{ padding: "14px 8px", color: "var(--text-secondary)" }}>
                        {formatBytes(doc.size)}
                      </td>
                      <td style={{ padding: "14px 8px", color: "var(--text-secondary)" }}>
                        {new Date(doc.upload_time).toLocaleString()}
                      </td>
                      <td style={{ padding: "14px 8px", textAlign: "center" }}>
                        <button
                          className="btn btn-danger"
                          style={{ padding: "6px 10px", borderRadius: "6px" }}
                          onClick={() => handleDelete(doc.id, doc.name)}
                          title="Delete Document"
                        >
                          <i className="bi bi-trash-fill"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
