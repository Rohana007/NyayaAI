# ── Stage 1: Build React frontend ──
FROM node:20-alpine AS frontend-build
WORKDIR /app/nyaya-ui
COPY nyaya-ui/package.json ./
RUN npm install
COPY nyaya-ui/ ./
# Build with empty VITE_API_BASE so it uses relative /api/v1
RUN VITE_API_BASE= npm run build

# ── Stage 2: Python backend + serve frontend ──
FROM python:3.11-slim
WORKDIR /app

# System deps for chromadb / tokenizers
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc g++ \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend into frontend-dist (where main.py looks for it)
COPY --from=frontend-build /app/nyaya-ui/dist ./frontend-dist/

# Data directory for ChromaDB and SQLite
RUN mkdir -p ./data/chromadb

# Expose port
EXPOSE 8000

# Start uvicorn
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
