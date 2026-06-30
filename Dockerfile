# ==========================================
# Stage 1: Build the React Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy package files and install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy source code and build React app
COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Serve application from Flask
# ==========================================
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies (required for Postgres connectors if needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy Flask backend code
COPY backend/ ./backend

# Copy compiled frontend from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port (Render binds automatically using the PORT env var)
EXPOSE 10000

# Set Cwd to backend directory
WORKDIR /app/backend

# Run server using Gunicorn (respects Render's PORT environment variable, defaults to 10000)
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-10000} app:app"]
