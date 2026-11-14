import { RelayRoom } from './relayRoom.js';

export { RelayRoom };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
        service: 'Ex-Monitor crew link relay',
        status: 'online',
        app: true,
        hosted: true,
        clients,
        time: new Date().toISOString()
      });
    }

    if (url.pathname.startsWith('/downloads/')) {
      const key = decodeURIComponent(url.pathname.slice('/downloads/'.length));
      if (!key || key.includes('/') || key.includes('..')) {
        return new Response('Not found', { status: 404 });
      }

      const assetUrl = new URL(`/downloads/${encodeURIComponent(key)}`, url.origin);
      const assetHeaders = new Headers(request.headers);
      assetHeaders.delete('range');
      const assetRequest = new Request(assetUrl, {
        method: request.method === 'HEAD' ? 'HEAD' : 'GET',
        headers: assetHeaders
      });
      const asset = await env.ASSETS.fetch(assetRequest);

      if (!asset.ok) {
        return new Response('This download is not available yet. Try again after the next build.', {
          status: 404,
          headers: { 'content-type': 'text/plain; charset=utf-8' }
        });
      }

      const headers = new Headers(asset.headers);
      headers.set('content-type', 'application/zip');
      headers.set('content-disposition', `attachment; filename="${key}"`);
      headers.set('cache-control', 'public, max-age=300');
      headers.set('x-content-type-options', 'nosniff');
      headers.set('accept-ranges', 'bytes');

      const rangeHeader = request.headers.get('range');
      if (rangeHeader && request.method !== 'HEAD') {
        const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
        if (match) {
          const buffer = await asset.arrayBuffer();
          const size = buffer.byteLength;
          let start = match[1] ? Number(match[1]) : null;
          let end = match[2] ? Number(match[2]) : null;

          if (start === null && end !== null) {
            start = Math.max(0, size - end);
            end = size - 1;
          }

          if (start !== null) {
            if (end === null || end >= size) end = size - 1;

            if (size === 0 || start > end || start >= size) {
              return new Response('Range not satisfiable', {
                status: 416,
                headers: { 'content-range': `bytes */${size}` }
              });
            }

            const chunk = buffer.slice(start, end + 1);
            headers.set('content-range', `bytes ${start}-${end}/${size}`);
            headers.set('content-length', String(chunk.byteLength));
            return new Response(chunk, { status: 206, headers });
          }
        }
      }

      return new Response(asset.body, { status: asset.status, headers });
    }

    return env.ASSETS.fetch(request);
  }
};