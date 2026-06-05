import sqlite3
import os
import json
import uuid
import numpy as np

DB_FILE = os.path.join(os.path.dirname(__file__), "audiovision.db")

def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    os.makedirs(os.path.dirname(DB_FILE), exist_ok=True)
    with get_connection() as conn:
        # Create documents table
        conn.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            upload_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            file_type TEXT,
            size INTEGER
        );
        """)
        
        # Create document chunks table (with embedding as BLOB)
        conn.execute("""
        CREATE TABLE IF NOT EXISTS document_chunks (
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL,
            chunk_text TEXT NOT NULL,
            embedding BLOB NOT NULL,
            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
        );
        """)
        
        # Create chat sessions table
        conn.execute("""
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        """)
        
        # Create chat messages table
        conn.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            rag_context TEXT, -- JSON array of sources
            FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
        );
        """)
        conn.commit()

# --- DOCUMENT METHODS ---

def insert_document(doc_id, name, file_type, size):
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO documents (id, name, file_type, size) VALUES (?, ?, ?, ?)",
            (doc_id, name, file_type, size)
        )
        conn.commit()

def insert_chunks(chunks):
    """
    chunks is a list of tuples: (chunk_id, doc_id, chunk_text, embedding_list)
    """
    with get_connection() as conn:
        for chunk_id, doc_id, text, emb in chunks:
            # Convert list of floats to binary float32 blob
            emb_blob = np.array(emb, dtype=np.float32).tobytes()
            conn.execute(
                "INSERT INTO document_chunks (id, document_id, chunk_text, embedding) VALUES (?, ?, ?, ?)",
                (chunk_id, doc_id, text, emb_blob)
            )
        conn.commit()

def get_all_documents():
    with get_connection() as conn:
        rows = conn.execute("SELECT id, name, upload_time, file_type, size FROM documents ORDER BY upload_time DESC").fetchall()
        return [dict(r) for r in rows]

def delete_document(doc_id):
    with get_connection() as conn:
        conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
        conn.commit()

def get_all_chunks(document_ids=None):
    """
    Fetch chunks and their embeddings.
    If document_ids is provided, limit to those documents.
    """
    query = "SELECT id, document_id, chunk_text, embedding FROM document_chunks"
    params = []
    
    if document_ids:
        placeholders = ",".join("?" for _ in document_ids)
        query += f" WHERE document_id IN ({placeholders})"
        params = document_ids
        
    with get_connection() as conn:
        rows = conn.execute(query, params).fetchall()
        chunks = []
        for r in rows:
            emb = np.frombuffer(r["embedding"], dtype=np.float32).tolist()
            chunks.append({
                "id": r["id"],
                "document_id": r["document_id"],
                "chunk_text": r["chunk_text"],
                "embedding": emb
            })
        return chunks

# --- CHAT METHODS ---

def create_chat_session(title=None):
    session_id = str(uuid.uuid4())
    if not title:
        title = "New Chat Session"
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO chat_sessions (id, title) VALUES (?, ?)",
            (session_id, title)
        )
        conn.commit()
    return session_id

def get_chat_sessions():
    with get_connection() as conn:
        rows = conn.execute("SELECT id, title, created_at FROM chat_sessions ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]

def update_session_title(session_id, title):
    with get_connection() as conn:
        conn.execute("UPDATE chat_sessions SET title = ? WHERE id = ?", (title, session_id))
        conn.commit()

def delete_chat_session(session_id):
    with get_connection() as conn:
        conn.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))
        conn.commit()

def insert_chat_message(session_id, role, content, rag_context=None):
    msg_id = str(uuid.uuid4())
    context_str = json.dumps(rag_context) if rag_context else None
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO chat_messages (id, session_id, role, content, rag_context) VALUES (?, ?, ?, ?, ?)",
            (msg_id, session_id, role, content, context_str)
        )
        conn.commit()
    return msg_id

def get_chat_history(session_id):
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT role, content, timestamp, rag_context FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC",
            (session_id,)
        )
        messages = []
        for r in rows:
            msg = dict(r)
            if msg["rag_context"]:
                msg["rag_context"] = json.loads(msg["rag_context"])
            messages.append(msg)
        return messages

# Auto initialize when imported
init_db()
