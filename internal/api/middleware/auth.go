package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
)

// BearerAuth returns middleware that validates a bearer token.
// If apiKey is empty, auth is disabled (dev mode).
func BearerAuth(apiKey string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if apiKey == "" {
			return c.Next()
		}

		// Skip health endpoint (Docker healthcheck).
		if c.Path() == "/api/health" {
			return c.Next()
		}

		// Check Authorization header first.
		token := ""
		auth := c.Get("Authorization")
		if strings.HasPrefix(auth, "Bearer ") {
			token = strings.TrimPrefix(auth, "Bearer ")
		}

		// Fall back to query param for WebSocket (browsers can't send WS headers).
		if token == "" {
			token = c.Query("token")
		}

		if token != apiKey {
			return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
		}

		return c.Next()
	}
}
