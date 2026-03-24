## Stage 1: Build frontend
FROM node:20-alpine AS frontend
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ .
RUN npm run build

## Stage 2: Build Go binary
FROM golang:1.24-alpine AS builder
RUN apk add --no-cache git
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend /web/dist web/dist/
RUN CGO_ENABLED=0 go build -ldflags="-w -s" -o orchestrator ./cmd/orchestrator

## Stage 3: Runtime — node:20-alpine provides Node.js required by claude-code
FROM node:20-alpine
RUN apk add --no-cache git bash jq coreutils

# Install claude-code globally (needs Node.js)
RUN npm install -g @anthropic-ai/claude-code

# Create app user before installing ralph (install.sh writes to $HOME)
RUN addgroup -S app && adduser -S -G app app
RUN mkdir -p /data && chown app:app /data

# Install ralph-claude-code as app user so paths go to /home/app/
USER app
RUN git clone --depth 1 https://github.com/frankbria/ralph-claude-code.git /tmp/ralph \
    && cd /tmp/ralph && chmod +x install.sh && ./install.sh \
    && rm -rf /tmp/ralph
ENV PATH="/home/app/.local/bin:$PATH"

WORKDIR /app
USER root
COPY --from=builder /app/orchestrator .
RUN chown app:app /app/orchestrator
USER app

EXPOSE 8080
ENV DATA_DIR=/data
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/health || exit 1
ENTRYPOINT ["./orchestrator"]
