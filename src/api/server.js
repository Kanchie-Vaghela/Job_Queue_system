// src/api/server.js
const express = require('express');
const config = require('../config');
const { runMigrations } = require('../db/migrations');
const jobRoutes = require('./routes/jobs');
const metricsRoutes = require('./routes/metrics');

const app = express();
app.use(express.json());

app.use('/jobs', jobRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/metrics', metricsRoutes);

async function start() {
  await runMigrations();
  app.listen(config.port, () => {
    console.log(`API server listening on port ${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start API server:', err);
  process.exit(1);
});