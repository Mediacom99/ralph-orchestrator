package events

import (
	"log/slog"
	"sync"
)

type Event struct {
	Type   string `json:"type"`   // "status_update", "loop_started", "loop_stopped", etc.
	LoopID string `json:"loop_id"`
	Data   any    `json:"data,omitempty"`
}

type subscriber struct {
	ch     chan Event
	loopID string // empty = all loops
}

type EventBus struct {
	mu          sync.RWMutex
	subscribers map[string]*subscriber
	logger      *slog.Logger
}

func NewEventBus(logger *slog.Logger) *EventBus {
	return &EventBus{
		subscribers: make(map[string]*subscriber),
		logger:      logger,
	}
}

func (b *EventBus) Subscribe(id, loopID string) <-chan Event {
	ch := make(chan Event, 64)
	b.mu.Lock()
	b.subscribers[id] = &subscriber{ch: ch, loopID: loopID}
	b.mu.Unlock()
	return ch
}

func (b *EventBus) Unsubscribe(id string) {
	b.mu.Lock()
	if sub, ok := b.subscribers[id]; ok {
		close(sub.ch)
		delete(b.subscribers, id)
	}
	b.mu.Unlock()
}

func (b *EventBus) Publish(event Event) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	for id, sub := range b.subscribers {
		if sub.loopID != "" && sub.loopID != event.LoopID {
			continue
		}
		select {
		case sub.ch <- event:
		default:
			b.logger.Warn("dropped event for slow subscriber", "subscriber", id)
		}
	}
}
