import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import os from 'os';

const WS_PORT = 8080;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    service: 'ExMonitor EXTEM-Mesh Local Relay',
    status: 'ONLINE',
    time: new Date().toISOString()
  }));
});

const wss = new WebSocketServer({ server });

let clientCount = 0;

wss.on('connection', (ws, req) => {
  clientCount++;
  const clientIp = req.socket.remoteAddress;
  console.log(`[EXTEM-Mesh] Node connected from ${clientIp}. Total active nodes: ${clientCount}`);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'EMERGENCY_SOS') {
        console.log(`\n🚨 [CRITICAL ALERT BROADCAST] 🚨`);
        console.log(`Astronaut: ${data.payload.astronautName} (${data.payload.astronautRole})`);
        console.log(`Hazard: ${data.payload.title}`);
        console.log(`Vitals: HR ${data.payload.triggerVitals.heartRate} BPM, SpO2 ${data.payload.triggerVitals.spO2}%, Rad ${data.payload.triggerVitals.radiationDoseRate.toFixed(2)} mSv/hr`);
      }

      // Broadcast to every other connected node on the local network
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message.toString());
        }
      });
    } catch (e) {
      console.error('[EXTEM-Mesh] Invalid packet:', e);
    }
  });

  ws.on('close', () => {
    clientCount--;
    console.log(`[EXTEM-Mesh] Node disconnected. Remaining active nodes: ${clientCount}`);
  });
});

server.listen(WS_PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`   🛰️  EXMONITOR - EXTEM-MESH LOCAL SYNC RELAY       `);
  console.log(`====================================================`);
  console.log(`[Status] Relay active on port ${WS_PORT} (0.0.0.0)`);
  console.log(`\nLocal Network IP Addresses for Two-Device Hotspot Demo:`);

  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`  -> Wi-Fi / Hotspot URL: http://${net.address}:5173`);
        console.log(`     WebSocket Relay:    ws://${net.address}:${WS_PORT}\n`);
      }
    }
  }
  console.log(`Connect your phone/tablet to the same Wi-Fi or laptop hotspot`);
  console.log(`and open the URL above to see real-time peer-to-peer SOS sync!`);
  console.log(`====================================================\n`);
});
