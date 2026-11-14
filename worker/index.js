export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/downloads/')) {
      const key = decodeURIComponent(url.pathname.slice('/downloads/'.length));
      if (!key || key.includes('/') || key.includes('..')) {
        return new Response('Not found', { status: 404 });
      }

      const rangeHeader = request.headers.get('range');
      const object = await env.DOWNLOADS.get(key, rangeHeader ? { range: request.headers } : undefined);
      if (!object) {
        return new Response('This download is not available yet. Try again after the next build.', {
          status: 404,
          headers: { 'content-type': 'text/plain; charset=utf-8' }
        });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('content-type', 'application/zip');
      headers.set('content-disposition', `attachment; filename="${key}"`);
      headers.set('etag', object.httpEtag);
      headers.set('cache-control', 'public, max-age=300');
      headers.set('x-content-type-options', 'nosniff');

      if (rangeHeader && object.range) {
        const start = object.range.offset;
        const length = object.range.length;
        headers.set('content-range', `bytes ${start}-${start + length - 1}/${object.size}`);
        return new Response(object.body, { status: 206, headers });
      }

      return new Response(object.body, { headers });
    }

    return env.ASSETS.fetch(request);
  }
};
