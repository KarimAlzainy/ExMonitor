import { EmergencyEvent } from '../types/telemetry';

export type MeshMessage =
  | { type: 'EMERGENCY_SOS'; payload: EmergencyEvent }
  | { type: 'ACKNOWLEDGE_EMERGENCY'; payload: { eventId: string; acknowledgedBy: string } }
  | { type: 'NODE_ANNOUNCE'; payload: { nodeId: string; name: string; role: string } };

type MessageCallback = (msg: MeshMessage) => void;

interface MeshIdentity {
  name: string;
  role: string;
}

function isMeshMessage(value: unknown): value is MeshMessage {
  if (!value || typeof value !== 'object') return false;
  const type = (value as { type?: unknown }).type;
  return type === 'EMERGENCY_SOS' || type === 'ACKNOWLEDGE_EMERGENCY' || type === 'NODE_ANNOUNCE';
}

class ExtemMeshBroadcastService {
  private nodeId: string;
  private ws: WebSocket | null = null;
  private channel: BroadcastChannel | null = null;
  private listeners: Set<MessageCallback> = new Set();
  private connectionListeners: Set<(online: boolean) => void> = new Set();
  private isConnected: boolean = false;
  private reconnectTimer: number | null = null;
  private identity: MeshIdentity = { name: 'ExMonitor Crew', role: 'Crew' };

  constructor() {
    this.nodeId = this.loadOrCreateNodeId();
    this.initBroadcastChannel();
    this.initWebSocket();
  }

  private loadOrCreateNodeId(): string {
    const fallback = 'NODE-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      const stored = window.sessionStorage.getItem('exmonitor.mesh.nodeId');
      if (stored) return stored;
      window.sessionStorage.setItem('exmonitor.mesh.nodeId', fallback);
    } catch {
      // Private mode / storage disabled.
    }
    return fallback;
  }

  public getNodeId(): string {
    return this.nodeId;
  }

  public dispose() {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
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
        // Ignore
      }
      this.ws = null;
    }
    if (this.channel) {
      try {
        this.channel.close();
      } catch {
        // Ignore
      }
      this.channel = null;
    }
    this.setConnected(false);
  }

  public isNetworkConnected(): boolean {
    return this.isConnected;
  }

  public onConnectionChange(callback: (online: boolean) => void): () => void {
    this.connectionListeners.add(callback);
    callback(this.isConnected);
    return () => {
      this.connectionListeners.delete(callback);
    };
  }

  public setIdentity(name: string, role: string) {
    this.identity = { name, role };
  }

  public announcePresence(name: string, role: string) {
    this.setIdentity(name, role);
    this.announceIdentity();
  }

  private announceIdentity() {
    this.send({
      type: 'NODE_ANNOUNCE',
      payload: { nodeId: this.nodeId, ...this.identity }
    });
  }

  private setConnected(online: boolean) {
    if (this.isConnected === online) return;
    this.isConnected = online;
    this.connectionListeners.forEach((fn) => {
      try {
        fn(online);
      } catch (err) {
        console.error('Mesh connection listener failed:', err);
      }
    });
  }

  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('exmonitor_extem_mesh');
        this.channel.onmessage = (event) => {
          if (isMeshMessage(event.data)) this.notifyListeners(event.data);
        };
      } catch (err) {
        console.warn('BroadcastChannel not supported:', err);
      }
    }
  }

  private initWebSocket() {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const hostname = window.location.hostname || 'localhost';
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const wsUrl = `${scheme}://${hostname}:8080`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.setConnected(true);
        this.announceIdentity();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: unknown = JSON.parse(event.data);
          if (isMeshMessage(msg)) this.notifyListeners(msg);
        } catch {
          // Ignore non-json
        }
      };

      this.ws.onclose = () => {
        this.setConnected(false);
        this.ws = null;
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.setConnected(false);
      };
    } catch {
      // Local server not running yet, fallback to BroadcastChannel
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || typeof window === 'undefined') return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.initWebSocket();
    }, 4000);
  }

  public subscribe(callback: MessageCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(msg: MeshMessage) {
    this.listeners.forEach((fn) => {
      try {
        fn(msg);
      } catch (e) {
        console.error('Error in mesh message listener:', e);
      }
    });
  }

  public broadcastEmergency(emergency: EmergencyEvent) {
    this.send({
      type: 'EMERGENCY_SOS',
      payload: emergency
    });
  }

  public acknowledgeEmergency(eventId: string, acknowledgedBy: string) {
    this.send({
      type: 'ACKNOWLEDGE_EMERGENCY',
      payload: { eventId, acknowledgedBy }
    });
  }

  private send(msg: MeshMessage) {
    // 1. Broadcast via local browser channel (for same-machine multi-tab demo)
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch {
        // Ignore
      }
    }

    // 2. Broadcast via WebSocket (for local Wi-Fi / hotspot multi-device demo)
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg));
      } catch {
        // Ignore
      }
    }
  }
}

export const meshBroadcast = new ExtemMeshBroadcastService();

// Vite hot reloads can re-evaluate this module; close the old relay socket so
// the mesh does not accumulate ghost nodes during a live demo.
if (import.meta.hot) {
  import.meta.hot.dispose(() => meshBroadcast.dispose());
}
