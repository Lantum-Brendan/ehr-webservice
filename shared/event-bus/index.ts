import { IEventBus, Event, EventHandler } from "./event-bus.interface.js";

class SharedEventBus implements IEventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private wildcardHandlers: Set<EventHandler> = new Set();

  publish<T extends Event>(event: T): Promise<void> {
    const { type } = event;
    const typeHandlers = this.handlers.get(type) || new Set();
    const allHandlers = [...typeHandlers, ...this.wildcardHandlers];

    allHandlers.forEach((handler) => {
      Promise.resolve()
        .then(() => handler(event))
        .catch((error) => {
          console.error(`Event handler error for ${type}:`, error);
        });
    });

    return Promise.resolve();
  }

  subscribe<T extends Event>(
    eventType: string,
    handler: EventHandler<T>,
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler as EventHandler);
    return () => {
      this.handlers.get(eventType)?.delete(handler as EventHandler);
    };
  }

  subscribeAll(handler: EventHandler): () => void {
    this.wildcardHandlers.add(handler);
    return () => {
      this.wildcardHandlers.delete(handler);
    };
  }

  clear(): void {
    this.handlers.clear();
    this.wildcardHandlers.clear();
  }
}

export const sharedEventBus = new SharedEventBus();
