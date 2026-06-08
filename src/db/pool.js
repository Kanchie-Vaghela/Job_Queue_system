// src/db/pool.js
const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool(config.db);

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL client error:', err.message);
});

module.exports = pool;