.PHONY: dev build clean

build: build-frontend build-backend

# M8: Set up fnm PATH for environments using fnm-managed Node.
build-frontend:
	export PATH="$$HOME/.local/share/fnm/aliases/default/bin:$$PATH" && cd web && npm ci && npm run build

build-backend:
	go build -o orchestrator ./cmd/orchestrator

dev:
	DEV_MODE=true go run ./cmd/orchestrator

clean:
	rm -f orchestrator
	rm -rf web/dist
