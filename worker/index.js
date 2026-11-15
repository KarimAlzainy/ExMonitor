// ExMonitor hosted Worker.
// Built with AI assistance: written in a pair-programming loop with an AI
// coding agent and reviewed by the author.
import { RelayRoom } from './relayRoom.js';

export { RelayRoom };

// The ZIPs live as assets on the repository's "downloads" release, which keeps
// every deploy small. The link on the page still points at this Worker, so the
// address stays the same if the files ever move again.
const DEFAULT_RELEASE =
  'https://github.com/KarimAlzainy/ExMonitor/releases/download/downloads';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // A visitor who typed the address without https is sent to the secure
    // version first, so the camera, notifications and install work.
    const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
    if (url.protocol === 'http:' && !local) {
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === '/relay') {
      const upgrade = request.headers.get('upgrade');
      if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
        return new Response('This address is for the crew link. Open the console instead.', {
          status: 426,
          headers: { 'content-type': 'text/plain; charset=utf-8' }
        });
      }

      const room = env.RELAY.get(env.RELAY.idFromName('crew-link'));
      return room.fetch(request);
    }

    if (url.pathname === '/health') {
      let clients = 0;
      try {
        const room = env.RELAY.get(env.RELAY.idFromName('crew-link'));
        const stats = await room.fetch('https://relay.internal/stats');
        const data = await stats.json();
        if (typeof data?.clients === 'number') clients = data.clients;
      } catch {
        // Health must answer even when the room is cold.
      }

      return Response.json({
        service: 'ExMonitor crew link relay',
        status: 'online',
        app: true,
        hosted: true,
        clients,
        time: new Date().toISOString()
      });
    }

    if (url.pathname.startsWith('/downloads/')) {
      const key = decodeURIComponent(url.pathname.slice('/downloads/'.length));
      if (!key || key.includes('/') || key.includes('..') || !key.endsWith('.zip')) {
        return new Response('Not found', { status: 404 });
      }

      const release = (env.DOWNLOAD_RELEASE || DEFAULT_RELEASE).replace(/\/$/, '');
      return new Response(null, {
        status: 302,
        headers: {
          location: `${release}/${encodeURIComponent(key)}`,
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff'
        }
      });
    }

    return env.ASSETS.fetch(request);
  }
};