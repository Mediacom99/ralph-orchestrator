package middleware

import (
	"net/http"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestNoKeyPassthrough(t *testing.T) {
	app := fiber.New()
	app.Use(BearerAuth(""))
	app.Get("/api/loops", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req, _ := http.NewRequest("GET", "/api/loops", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200 (no key = passthrough)", resp.StatusCode)
	}
}

func TestMissingHeader401(t *testing.T) {
	app := fiber.New()
	app.Use(BearerAuth("secret"))
	app.Get("/api/loops", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req, _ := http.NewRequest("GET", "/api/loops", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 401 {
		t.Errorf("status = %d, want 401", resp.StatusCode)
	}
}

func TestWrongToken401(t *testing.T) {
	app := fiber.New()
	app.Use(BearerAuth("secret"))
	app.Get("/api/loops", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req, _ := http.NewRequest("GET", "/api/loops", nil)
	req.Header.Set("Authorization", "Bearer wrong")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 401 {
		t.Errorf("status = %d, want 401", resp.StatusCode)
	}
}

func TestCorrectTokenPass(t *testing.T) {
	app := fiber.New()
	app.Use(BearerAuth("secret"))
	app.Get("/api/loops", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req, _ := http.NewRequest("GET", "/api/loops", nil)
	req.Header.Set("Authorization", "Bearer secret")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}
}

func TestHealthSkipped(t *testing.T) {
	app := fiber.New()
	app.Use(BearerAuth("secret"))
	app.Get("/api/health", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req, _ := http.NewRequest("GET", "/api/health", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200 (health skipped)", resp.StatusCode)
	}
}

func TestQueryParamToken(t *testing.T) {
	app := fiber.New()
	app.Use(BearerAuth("secret"))
	app.Get("/ws", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req, _ := http.NewRequest("GET", "/ws?token=secret", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200 (query param)", resp.StatusCode)
	}
}
