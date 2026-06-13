const Redis = require('ioredis');
const config = require('../config');

function createClient() {
  const options = {
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null,
    retryStrategy(times) {
      return Math.min(times * 100, 3000);
    },
  };

  if (config.redis.password) {
    options.password = config.redis.password;
  }

  if (process.env.REDIS_TLS === 'true') {
    options.tls = {};
  }

  const client = new Redis(options);
  client.on('connect', () => console.log('Redis connected'));
  client.on('error', (err) => console.error('Redis error:', err.message));
  return client;
}

module.exports = { createClient };