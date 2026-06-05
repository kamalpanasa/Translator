# Use a Python base image
FROM python:3.10-slim

# Install system dependencies (including nodejs and npm to build the React frontend)
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    ffmpeg \
    git \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set up user with UID 1000 (Hugging Face requirement for security and writes)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

# Copy dependency files first for caching
COPY --chown=user backend/requirements.txt backend/requirements.txt
COPY --chown=user frontend/package*.json frontend/

# Install python dependencies
RUN pip install --no-cache-dir --user -r backend/requirements.txt

# Install node dependencies
WORKDIR $HOME/app/frontend
RUN npm install

# Copy the rest of the application
WORKDIR $HOME/app
COPY --chown=user . .

# Build the frontend
WORKDIR $HOME/app/frontend
RUN npm run build

# Go back to the backend directory
WORKDIR $HOME/app/backend

# Create a temp directory inside backend for runtime uploads and database
RUN mkdir -p temp database && chmod 777 temp database

# Expose port 7860
EXPOSE 7860

# Start the FastAPI server on port 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
