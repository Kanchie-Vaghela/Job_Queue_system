const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const config = require('../config');
const { runMigrations } = require('../db/migrations');
const jobRoutes = require('./routes/jobs');
const metricsRoutes = require('./routes/metrics');
const cors = require('cors');

const app = express();
const httpServer = http.createServer(app);

app.use(cors());

const io = new Server(httpServer, {
  cors: { origin: '*' }
});

// Make io available to route handlers
app.set('io', io);

app.use(express.json());
app.use('/jobs', jobRoutes);
app.use('/metrics', metricsRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

io.on('connection', (socket) => {
  console.log(`Dashboard connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Dashboard disconnected: ${socket.id}`);
  });
});

const { createClient } = require('../queue/redis');
const subClient = createClient();

subClient.subscribe('job:events', (err) => {
  if (err) console.error('Redis subscribe error:', err.message);
});

subClient.on('message', (_channel, message) => {
  try {
    const { event, data } = JSON.parse(message);
    io.emit(event, data);
  } catch (err) {
    console.error('Failed to parse job event:', err.message);
  }
});

async function start() {
  await runMigrations();
  httpServer.listen(config.port, () => {
    console.log(`API server listening on port ${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

module.exports = { io };