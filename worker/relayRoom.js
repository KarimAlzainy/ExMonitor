const MAX_MESSAGE_BYTES = 512 * 1024;

/**
 * One shared room for the crew link. Every console and sensor page that opens
 * the hosted app connects here. A message from one device is copied to every
 * other device, never back to the sender, which matches the launcher relay.
 */
export class RelayRoom {
  constructor(state) {
    this.state = state;
    this.sockets = new Set();
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.endsWith('/stats')) {
      return Response.json({ clients: this.sockets.size });
    }

    const upgrade = request.headers.get('upgrade');
    if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
      return new Response('This address is for the crew link. Open the console instead.', {
        status: 426,
        headers: { 'content-type': 'text/plain; charset=utf-8' }
      });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();
    this.sockets.add(server);

    const drop = () => {
      this.sockets.delete(server);
    };

    server.addEventListener('close', drop);
    server.addEventListener('error', drop);
    server.addEventListener('message', (event) => {
      const data = event.data;
      if (typeof data !== 'string') return;

      if (data.length > MAX_MESSAGE_BYTES) {
        try {
          server.close(1009, 'Message too large');
        } catch {
          // The socket may already be closed.
        }
        drop();
        return;
      }

      for (const socket of this.sockets) {
        if (socket === server) continue;
        try {
          socket.send(data);
        } catch {
          this.sockets.delete(socket);
        }
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }
}