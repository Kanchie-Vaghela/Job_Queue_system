// src/config.js
require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  db: {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME     || 'jobqueue',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || null,
  },
  queues: {
    main:       'job_queue',
    processing: 'job_processing',
    dead:       'job_dead',
  },
};