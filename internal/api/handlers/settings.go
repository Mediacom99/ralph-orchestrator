package handlers

import (
	"os"
	"path/filepath"

	"github.com/gofiber/fiber/v2"

	"github.com/edoardo/ralph-orchestrator/internal/store"
)

type SettingsHandler struct {
	settings *store.SettingsStore
}

func NewSettingsHandler(settings *store.SettingsStore) *SettingsHandler {
	return &SettingsHandler{settings: settings}
}

type settingsResponse struct {
	GitHubToken       string `json:"github_token"`
	HasGitHubToken    bool   `json:"has_github_token"`
	AnthropicAPIKey   string `json:"anthropic_api_key"`
	HasAnthropicKey   bool   `json:"has_anthropic_api_key"`
	AuthMode          string `json:"auth_mode"`
}

type settingsUpdateRequest struct {
	GitHubToken     *string `json:"github_token"`
	AnthropicAPIKey *string `json:"anthropic_api_key"`
}

func (h *SettingsHandler) Get(c *fiber.Ctx) error {
	ghToken := h.settings.GetGitHubToken()
	apiKey := h.settings.GetAnthropicAPIKey()
	return c.JSON(settingsResponse{
		GitHubToken:     maskToken(ghToken),
		HasGitHubToken:  ghToken != "",
		AnthropicAPIKey: maskToken(apiKey),
		HasAnthropicKey: apiKey != "",
		AuthMode:        detectAuthMode(apiKey),
	})
}

func (h *SettingsHandler) Update(c *fiber.Ctx) error {
	var req settingsUpdateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.GitHubToken != nil {
		if err := h.settings.SetGitHubToken(*req.GitHubToken); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "failed to save settings"})
		}
	}
	if req.AnthropicAPIKey != nil {
		if err := h.settings.SetAnthropicAPIKey(*req.AnthropicAPIKey); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "failed to save settings"})
		}
	}
	ghToken := h.settings.GetGitHubToken()
	apiKey := h.settings.GetAnthropicAPIKey()
	return c.JSON(settingsResponse{
		GitHubToken:     maskToken(ghToken),
		HasGitHubToken:  ghToken != "",
		AnthropicAPIKey: maskToken(apiKey),
		HasAnthropicKey: apiKey != "",
		AuthMode:        detectAuthMode(apiKey),
	})
}

// detectAuthMode checks how Claude authentication is configured.
// Priority: subscription credentials file > API key > none.
func detectAuthMode(apiKey string) string {
	home, err := os.UserHomeDir()
	if err == nil {
		credPath := filepath.Join(home, ".claude", ".credentials.json")
		if _, err := os.Stat(credPath); err == nil {
			return "subscription"
		}
	}
	if apiKey != "" || os.Getenv("ANTHROPIC_API_KEY") != "" {
		return "api_key"
	}
	return "none"
}

func maskToken(token string) string {
	if len(token) <= 4 {
		return ""
	}
	return "****" + token[len(token)-4:]
}
