export interface RelayEnvelope {
  protocol: 'exmonitor/1';
  id: string;
  type: string;
  payload: unknown;
  sentAt: number;
  originId: string;
}

type RelayListener = (message: RelayEnvelope) => void;
type ConnectionListener = (relayOnline: boolean, localChannel: boolean) => void;

const PROTOCOL = 'exmonitor/1';
const CHANNEL_NAME = 'exmonitor.crew-link.v1';
const SEEN_WINDOW_MS = 20000;

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isEnvelope(value: unknown): value is RelayEnvelope {
  if (!value || typeof value !== 'object') return false;
  const envelope = value as Partial<RelayEnvelope>;
  return (
    envelope.protocol === PROTOCOL &&
    typeof envelope.id === 'string' &&
    typeof envelope.type === 'string' &&
    typeof envelope.sentAt === 'number' &&
    typeof envelope.originId === 'string'
  );
}

/**
 * One shared transport for the crew link and the sensor page.
 * It prefers the same-origin relay socket and mirrors every message to the
 * BroadcastChannel so two tabs still work without the relay running.
 */
class RelayClient {
  private readonly originId: string;
  private ws: WebSocket | null = null;
  private channel: BroadcastChannel | null = null;
  private listeners = new Set<RelayListener>();
  private connectionListeners = new Set<ConnectionListener>();
  private seen = new Map<string, number>();
  private reconnectTimer: number | null = null;
  private reconnectDelay = 2000;
  private relayOnline = false;
  private disposed = false;

  constructor() {
    this.originId = this.loadOriginId();
    this.initChannel();
    this.initSocket();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
    }
  }

  private loadOriginId(): string {
    // Per tab, not per browser: two tabs are two consoles and must be able to
    // alert each other for the local-only crew link. A reload keeps the id.
    try {
      const stored = window.sessionStorage.getItem('exmonitor.origin.v1');
      if (stored) return stored;
      const next = `node-${makeId().slice(0, 8)}`;
      window.sessionStorage.setItem('exmonitor.origin.v1', next);
      return next;
    } catch {
      return `node-${makeId().slice(0, 8)}`;
    }
  }

  public getOriginId(): string {
    return this.originId;
  }

  public hasLocalChannel(): boolean {
    return Boolean(this.channel);
  }

  public isRelayOnline(): boolean {
    return this.relayOnline;
  }

  public onConnectionChange(callback: ConnectionListener): () => void {
    this.connectionListeners.add(callback);
    callback(this.relayOnline, Boolean(this.channel));
    return () => {
      this.connectionListeners.delete(callback);
    };
  }

  public subscribe(listener: RelayListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public send(type: string, payload: unknown): void {
    const envelope: RelayEnvelope = {
      protocol: PROTOCOL,
      id: makeId(),
      type,
      payload,
      sentAt: Date.now(),
      originId: this.originId
    };

    this.remember(envelope.id);

    if (this.channel) {
      try {
        this.channel.postMessage(envelope);
      } catch {
        // The channel can be closed while a tab is being torn down.
      }
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(envelope));
      } catch {
        // The socket can close between the readyState check and the send.
      }
    }
  }

  private initChannel(): void {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    try {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event) => {
        this.accept(event.data);
      };
    } catch {
      this.channel = null;
    }
  }

  private initSocket(): void {
    if (typeof window === 'undefined' || this.disposed) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${scheme}://${window.location.host}/relay`;

    try {
      const socket = new WebSocket(url);
      this.ws = socket;

      socket.onopen = () => {
        this.reconnectDelay = 2000;
        this.setRelayState(true);
      };

      socket.onmessage = (event) => {
        try {
          this.accept(JSON.parse(event.data as string));
        } catch {
          // Ignore anything that is not one of our messages.
        }
      };

      socket.onclose = () => {
        if (this.ws === socket) this.ws = null;
        this.setRelayState(false);
        this.scheduleReconnect();
      };

      socket.onerror = () => {
        this.setRelayState(false);
      };
    } catch {
      this.setRelayState(false);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.disposed || this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.initSocket();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(15000, this.reconnectDelay + 1000);
  }

  private handleOnline = () => {
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.initSocket();
    }
  };

  private setRelayState(online: boolean): void {
    if (this.relayOnline === online) return;
    this.relayOnline = online;
    this.connectionListeners.forEach((callback) => {
      try {
        callback(online, Boolean(this.channel));
      } catch {
        // A broken listener must not stop the transport.
      }
    });
  }

  private accept(raw: unknown): void {
    if (!isEnvelope(raw)) return;
    if (this.seen.has(raw.id)) return;
    this.remember(raw.id);
    this.listeners.forEach((listener) => {
      try {
        listener(raw);
      } catch (error) {
        console.error('Crew link listener failed:', error);
      }
    });
  }

  private remember(id: string): void {
    const now = Date.now();
    this.seen.set(id, now);
    if (this.seen.size > 400) {
      for (const [seenId, at] of this.seen) {
        if (now - at > SEEN_WINDOW_MS) this.seen.delete(seenId);
      }
    }
  }

  public dispose(): void {
    this.disposed = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    window.removeEventListener('online', this.handleOnline);
    this.listeners.clear();
    this.connectionListeners.clear();
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      try {
        this.ws.close();
      } catch {
        // Ignore.
      }
      this.ws = null;
    }
    if (this.channel) {
      try {
        this.channel.close();
      } catch {
        // Ignore.
      }
      this.channel = null;
    }
  }
}

export const relayClient = new RelayClient();

if (import.meta.hot) {
  import.meta.hot.dispose(() => relayClient.dispose());
}
