import { EventEmitter } from "node:events";
import type { DomainEvents } from "../events/types.js";
import type { Logger } from "./logger.js";

type Handler<K extends keyof DomainEvents> = (payload: DomainEvents[K]) => void | Promise<void>;

/**
 * In-process typed event bus for domain events (see events/types.ts).
 *
 * Intentionally in-process for now, not Redis/queue-backed: at current
 * scale a single Node process handles all traffic, and a message broker
 * would be complexity with no present justification (see docs/adr/0001).
 * The publish/subscribe shape here is what would move behind a queue
 * client later without touching call sites.
 */
export class EventBus {
  private readonly emitter = new EventEmitter();

  constructor(private readonly logger: Logger) {
    // Domain events can fan out to several subscribers (stats, ranking,
    // news, notifications...); raise the default cap instead of silently
    // dropping listeners.
    this.emitter.setMaxListeners(50);
  }

  on<K extends DomainEventName>(event: K, handler: Handler<K>): void {
    this.emitter.on(event, (payload: DomainEvents[K]) => {
      // Handlers can throw synchronously or return a rejected promise —
      // both must be caught here, or one misbehaving subscriber (e.g. the
      // news generator) could crash the whole process on a domain event.
      try {
        Promise.resolve(handler(payload)).catch((error: unknown) => {
          this.logger.error({ event, error }, "domain event handler threw");
        });
      } catch (error) {
        this.logger.error({ event, error }, "domain event handler threw");
      }
    });
  }

  emit<K extends DomainEventName>(event: K, payload: DomainEvents[K]): void {
    this.logger.debug({ event, payload }, "domain event emitted");
    this.emitter.emit(event, payload);
  }
}

type DomainEventName = keyof DomainEvents;
