import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Ex-Monitor launcher.
 *
 * One file, no npm packages. It serves the built app (./app when packaged,
 * ./dist in the repository) and runs the crew-link relay at /relay on the
 * same port, so every device only needs one address.
 *
 *   node server.js                 open the console
 *   node server.js --relay-only    start only the relay for `npm run dev`
 *   node server.js --port 8080     choose a starting port
 *   node server.js --no-open       do not open a browser
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const relayOnly = argv.includes('--relay-only');
const noOpen = argv.includes('--no-open') || relayOnly;

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (!Number.isFinite(nodeMajor) || nodeMajor < 18) {
  console.error('');
  console.error('  Ex-Monitor needs Node.js 18 or newer.');
  console.error(`  This copy is Node ${process.versions.node}. Install a newer one from https://nodejs.org`);
  console.error('');
  process.exit(1);
}

function argValue(name, fallback) {
  const index = argv.indexOf(name);
  if (index === -1) return fallback;
  const value = Number(argv[index + 1]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const startPort = argValue('--port', Number(process.env.PORT) || 8080);
const appDir =
  [path.join(here, 'app'), path.join(here, 'dist')].find((candidate) =>
    fs.existsSync(path.join(candidate, 'index.html'))
  ) ?? null;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8'
};

function sendText(res, status, text, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(text);
}

function serveApp(req, res) {
  if (!appDir) {
    sendText(
      res,
      503,
      [
        'Ex-Monitor has not been built yet.',
        '',
        'In the project folder run:',
        '  npm install',
        '  npm run build',
        '',
        'Then start this launcher again. The packaged download already contains the built app.'
      ].join('\n')
    );
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendText(res, 405, 'Only GET and HEAD are supported.');
    return;
  }

  const url = new URL(req.url ?? '/', 'http://localhost');
  let relative;
  try {
    relative = decodeURIComponent(url.pathname);
  } catch {
    sendText(res, 400, 'That address is not valid.');
    return;
  }

  if (relative === '/' || relative === '') relative = '/index.html';

  const root = path.resolve(appDir);
  let filePath = path.resolve(root, relative.replace(/^[/\\]+/, ''));
  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    sendText(res, 403, 'That address is outside the app folder.');
    return;
  }

  try {
    let stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      stat = fs.statSync(filePath);
    }

    const extension = path.extname(filePath).toLowerCase();
    const headers = {
      'Content-Type': MIME[extension] ?? 'application/octet-stream',
      'Content-Length': stat.size,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': filePath.includes(`${path.sep}assets${path.sep}`)
        ? 'public, max-age=31536000, immutable'
        : 'no-store'
    };

    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  } catch {
    sendText(res, 404, 'Not found. Open the console at / and the sensor page at /sensors.html.');
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (url.pathname === '/health') {
    sendText(
      res,
      200,
      JSON.stringify({
        service: 'Ex-Monitor crew link relay',
        status: 'online',
        app: Boolean(appDir),
        clients: clients.size,
        time: new Date().toISOString()
      }),
      'application/json; charset=utf-8'
    );
    return;
  }

  if (url.pathname === '/relay') {
    sendText(res, 426, 'This address is for the crew link WebSocket. Open the console instead.');
    return;
  }

  if (relayOnly && (url.pathname === '/' || url.pathname === '/index.html')) {
    sendText(
      res,
      200,
      'Ex-Monitor relay is running. The app is served by the Vite dev server during development.'
    );
    return;
  }

  serveApp(req, res);
});

const clients = new Set();
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_MESSAGE_BYTES = 512 * 1024;

function frame(opcode, payload = Buffer.alloc(0)) {
  const length = payload.length;
  let header;
  if (length < 126) {
    header = Buffer.from([0x80 | opcode, length]);
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  return Buffer.concat([header, payload]);
}

function closeClient(client, reason = '') {
  clients.delete(client);
  if (client.socket.destroyed) return;
  try {
    client.socket.write(frame(0x8, Buffer.from(reason)));
    client.socket.end();
  } catch {
    client.socket.destroy();
  }
}

function broadcast(text, sender) {
  const payload = Buffer.from(text, 'utf8');
  const message = frame(0x1, payload);
  for (const client of clients) {
    if (client === sender || client.socket.destroyed) continue;
    try {
      client.socket.write(message);
    } catch {
      clients.delete(client);
    }
  }
}

function handleData(client, chunk) {
  client.buffer = client.buffer.length ? Buffer.concat([client.buffer, chunk]) : chunk;

  while (true) {
    const buffer = client.buffer;
    if (buffer.length < 2) return;

    const finished = (buffer[0] & 0x80) !== 0;
    const opcode = buffer[0] & 0x0f;
    const masked = (buffer[1] & 0x80) !== 0;
    let length = buffer[1] & 0x7f;
    let offset = 2;

    if (length === 126) {
      if (buffer.length < 4) return;
      length = buffer.readUInt16BE(2);
      offset = 4;
    } else if (length === 127) {
      if (buffer.length < 10) return;
      const big = buffer.readBigUInt64BE(2);
      if (big > BigInt(MAX_MESSAGE_BYTES)) {
        closeClient(client, 'Message too large');
        return;
      }
      length = Number(big);
      offset = 10;
    }

    if (length > MAX_MESSAGE_BYTES) {
      closeClient(client, 'Message too large');
      return;
    }

    let mask = null;
    if (masked) {
      if (buffer.length < offset + 4) return;
      mask = buffer.subarray(offset, offset + 4);
      offset += 4;
    }

    if (buffer.length < offset + length) return;

    const payload = Buffer.from(buffer.subarray(offset, offset + length));
    client.buffer = buffer.subarray(offset + length);

    if (mask && mask.length === 4) {
      for (let index = 0; index < payload.length; index += 1) {
        payload[index] ^= mask[index % 4];
      }
    }

    if (opcode === 0x8) {
      closeClient(client);
      return;
    }
    if (opcode === 0x9) {
      try {
        client.socket.write(frame(0xa, payload));
      } catch {
        closeClient(client);
      }
      continue;
    }
    if (opcode === 0xa) {
      client.alive = true;
      continue;
    }

    if (opcode === 0x0 || opcode === 0x1 || opcode === 0x2) {
      client.fragments.push(payload);
      if (!finished) continue;
      const whole = Buffer.concat(client.fragments);
      client.fragments = [];
      if (whole.length > 0) broadcast(whole.toString('utf8'), client);
    }
  }
}

server.on('upgrade', (req, socket) => {
  let pathname = '/';
  try {
    pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
  } catch {
    pathname = '/';
  }

  if (pathname !== '/relay') {
    socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  const key = req.headers['sec-websocket-key'];
  if (typeof key !== 'string' || !key) {
    socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '\r\n'
    ].join('\r\n')
  );
  socket.setNoDelay(true);

  const client = {
    socket,
    buffer: Buffer.alloc(0),
    fragments: [],
    alive: true,
    connectedAt: Date.now()
  };
  clients.add(client);

  socket.on('data', (chunk) => handleData(client, chunk));
  socket.on('close', () => clients.delete(client));
  socket.on('error', () => clients.delete(client));
});

const heartbeat = setInterval(() => {
  for (const client of clients) {
    if (!client.alive) {
      closeClient(client, 'No heartbeat');
      continue;
    }
    client.alive = false;
    try {
      client.socket.write(frame(0x9));
    } catch {
      clients.delete(client);
    }
  }
}, 25000);
heartbeat.unref?.();

function lanAddresses() {
  const addresses = [];
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) addresses.push(entry.address);
    }
  }
  return addresses;
}

function openBrowser(url) {
  const command =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(command, () => {
    // Opening the browser is a convenience; failure is not fatal.
  });
}

function ready(port) {
  const localUrl = `http://localhost:${port}`;
  console.log('');
  console.log('  Ex-Monitor crew link relay');
  console.log(`  Console     ${localUrl}`);
  console.log(`  Sensors     ${localUrl}/sensors.html`);
  console.log(`  Relay       ws://localhost:${port}/relay`);
  for (const address of lanAddresses()) {
    console.log(`  On network  http://${address}:${port}`);
  }
  if (!appDir) {
    console.log('');
    console.log('  No built app found next to this file (app/ or dist/).');
    console.log('  The relay still works for the Vite dev server.');
  }
  console.log('');
  if (!noOpen) openBrowser(localUrl);
}

function start(port, remaining) {
  const onError = (error) => {
    server.removeListener('listening', onListening);
    if (error.code === 'EADDRINUSE' && remaining > 0) {
      console.log(`Port ${port} is in use, trying ${port + 1}.`);
      start(port + 1, remaining - 1);
      return;
    }
    console.error(`Could not start the launcher: ${error.message}`);
    process.exit(1);
  };

  const onListening = () => {
    server.removeListener('error', onError);
    ready(port);
  };

  server.once('error', onError);
  server.once('listening', onListening);
  server.listen(port, '0.0.0.0');
}

start(startPort, 10);
