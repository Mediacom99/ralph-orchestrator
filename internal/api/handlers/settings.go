package handlers

import (
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
	GitHubToken    string `json:"github_token"`
	HasGitHubToken bool   `json:"has_github_token"`
}

type settingsUpdateRequest struct {
	GitHubToken *string `json:"github_token"`
}

func (h *SettingsHandler) Get(c *fiber.Ctx) error {
	token := h.settings.GetGitHubToken()
	return c.JSON(settingsResponse{
		GitHubToken:    maskToken(token),
		HasGitHubToken: token != "",
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
	token := h.settings.GetGitHubToken()
	return c.JSON(settingsResponse{
		GitHubToken:    maskToken(token),
		HasGitHubToken: token != "",
	})
}

func maskToken(token string) string {
	if len(token) <= 4 {
		return ""
	}
	return "****" + token[len(token)-4:]
}
