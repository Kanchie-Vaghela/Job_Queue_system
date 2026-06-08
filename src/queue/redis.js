// src/queue/redis.js
const Redis = require('ioredis');
const config = require('../config');

function createClient() {
  const client = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null,   // required for blocking commands
    retryStrategy(times) {
      const delay = Math.min(times * 100, 3000);
      console.log(`Redis reconnecting... attempt ${times}, delay ${delay}ms`);
      return delay;
    },
  });

  client.on('connect',   () => console.log('Redis connected'));
  client.on('error', (err) => console.error('Redis error:', err.message));

  return client;
}

module.exports = { createClient };