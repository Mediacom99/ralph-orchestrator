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

## Stage 3: Install ralph-claude-code (separate stage so runtime stays slim)
FROM node:20-alpine AS ralph-installer
RUN apk add --no-cache git bash
RUN npm install -g @anthropic-ai/claude-code
RUN git clone --depth 1 https://github.com/frankbria/ralph-claude-code.git /tmp/ralph \
    && cd /tmp/ralph && chmod +x install.sh && ./install.sh \
    && rm -rf /tmp/ralph

## Stage 4: Runtime — M6: only git and bash needed at runtime.
FROM alpine:3.21
RUN apk add --no-cache git bash
RUN mkdir -p /data
WORKDIR /app
COPY --from=builder /app/orchestrator .
# Copy ralph and claude-code binaries from installer stage
COPY --from=ralph-installer /usr/local/bin/ralph /usr/local/bin/ralph
COPY --from=ralph-installer /usr/local/bin/claude /usr/local/bin/claude
RUN addgroup -g 1000 app && adduser -D -u 1000 -G app app
RUN chown -R app:app /data /app
USER app
EXPOSE 8080
ENV DATA_DIR=/data
# M7: Add HEALTHCHECK so container orchestrators can detect unresponsive app.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/health || exit 1
ENTRYPOINT ["./orchestrator"]
