/**
 * Event Bus interface for domain event dispatching
 * This is a simple in-process event bus that can be replaced with a message queue
 */

export interface Event {
  type: string;
  aggregateId: string;
  aggregateType: string;
  occurredOn: Date;
  metadata?: Record<string, any>;
  payload: Record<string, any>;
}

export interface EventHandler<T extends Event = Event> {
  (event: T): Promise<void> | void;
}

export interface IEventBus {
  /**
   * Publish an event to all interested handlers
   */
  publish<T extends Event>(event: T): Promise<void>;

  /**
   * Subscribe to events of a specific type
   * Returns unsubscribe function
   */
  subscribe<T extends Event>(
    eventType: string,
    handler: EventHandler<T>,
  ): () => void;

  /**
   * Subscribe to all events (wildcard)
   */
  subscribeAll(handler: EventHandler): () => void;

  /**
   * Clear all subscriptions (useful for testing)
   */
  clear(): void;
}

/**
 * In-memory event bus implementation
 * Replace with BullMQ or external message queue for distributed systems
 */
export class InMemoryEventBus implements IEventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private wildcardHandlers: Set<EventHandler> = new Set();

  publish<T extends Event>(event: T): Promise<void> {
    const { type } = event;
    const typeHandlers = this.handlers.get(type) || new Set();
    const allHandlers = [...typeHandlers, ...this.wildcardHandlers];

    // Execute handlers asynchronously but don't await
    // This allows events to be fire-and-forget but errors are caught
    allHandlers.forEach((handler) => {
      Promise.resolve()
        .then(() => handler(event))
        .catch((error) => {
          // In production, send to dead letter queue or log
          // eslint-disable-next-line no-console
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

    // Return unsubscribe function
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
