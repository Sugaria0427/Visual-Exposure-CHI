import { submitBatchEvents } from '../api';

type TelemetryEvent = {
  event_seq: number;
  event_type: string;
  phase: string;
  payload?: any;
  client_timestamp: string;
};

class EventQueueManager {
  private queue: TelemetryEvent[] = [];
  private currentSeq = 1;
  private sessionId: string | null = null;
  private timer: number | null = null;
  private isFlushing = false;

  public init(sessionId: string) {
    this.sessionId = sessionId;
    this.currentSeq = 1;
    this.queue = [];
    if (this.timer) {
      window.clearInterval(this.timer);
    }
    this.timer = window.setInterval(() => this.flush(), 2500);
  }

  public record(eventType: string, phase: string, payload?: any) {
    const ev: TelemetryEvent = {
      event_seq: this.currentSeq++,
      event_type: eventType,
      phase,
      payload,
      client_timestamp: new Date().toISOString(),
    };
    this.queue.push(ev);

    if (this.queue.length >= 10) {
      this.flush();
    }
  }

  public async flush(): Promise<void> {
    if (!this.sessionId || this.queue.length === 0 || this.isFlushing) {
      return;
    }

    this.isFlushing = true;
    const batch = [...this.queue];
    try {
      await submitBatchEvents(this.sessionId, batch);
      // Remove sent events from queue
      this.queue = this.queue.slice(batch.length);
    } catch (err) {
      console.warn('Failed to flush telemetry events, will retry:', err);
    } finally {
      this.isFlushing = false;
    }
  }

  public dispose() {
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.flush();
  }
}

export const eventQueue = new EventQueueManager();
