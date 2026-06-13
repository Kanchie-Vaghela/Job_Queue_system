// src/db/pool.js
const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({
  ...config.db,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL client error:', err.message);
});

module.exports = pool;