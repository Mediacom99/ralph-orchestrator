package handlers

import (
	"encoding/json"
	"log/slog"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
	"github.com/google/uuid"

	"github.com/edoardo/ralph-orchestrator/internal/events"
)

const (
	wsPongWait   = 30 * time.Second
	wsPingPeriod = (wsPongWait * 9) / 10
)

func SetupWebSocket(app *fiber.App, bus *events.EventBus, logger *slog.Logger) {
	app.Use("/ws", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	app.Get("/ws", websocket.New(func(c *websocket.Conn) {
		subID := uuid.New().String()[:12] // I7: 12 chars (48 bits) instead of 8
		loopID := c.Query("loop_id")      // optional filter
		ch := bus.Subscribe(subID, loopID)
		defer bus.Unsubscribe(subID)
		// B4: Explicitly close connection so the read-pump goroutine exits promptly.
		defer c.Close()

		logger.Debug("ws connected", "sub_id", subID, "loop_id", loopID)

		// I4: Set up ping/pong to detect dead connections.
		_ = c.SetReadDeadline(time.Now().Add(wsPongWait))
		c.SetPongHandler(func(string) error {
			return c.SetReadDeadline(time.Now().Add(wsPongWait))
		})

		// Read pump — closes done channel when the client disconnects.
		done := make(chan struct{})
		go func() {
			defer close(done)
			for {
				if _, _, err := c.ReadMessage(); err != nil {
					break
				}
			}
		}()

		ticker := time.NewTicker(wsPingPeriod)
		defer ticker.Stop()

		for {
			select {
			case event, ok := <-ch:
				if !ok {
					return
				}
				data, err := json.Marshal(event)
				if err != nil {
					continue
				}
				if err := c.WriteMessage(websocket.TextMessage, data); err != nil {
					return
				}
			case <-ticker.C:
				if err := c.WriteMessage(websocket.PingMessage, nil); err != nil {
					return
				}
			case <-done:
				return
			}
		}
	}))
}
