// src/api/routes/jobs.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../../db/pool');
const { createClient } = require('../../queue/redis');

const redisClient = createClient();

router.post('/', async (req, res) => {
  const { type, payload = {} } = req.body;

  if (!type) {
    return res.status(400).json({ error: 'Job type is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO jobs (type, payload, status)
       VALUES ($1, $2, 'pending')
       RETURNING id, type, status, created_at`,
      [type, JSON.stringify(payload)]
    );

    const job = result.rows[0];

    await redisClient.lpush('job_queue', job.id);

    return res.status(202).json({
      jobId:     job.id,
      type:      job.type,
      status:    job.status,
      createdAt: job.created_at,
    });
  } catch (err) {
    console.error('POST /jobs error:', err.message);
    return res.status(500).json({ error: 'Failed to enqueue job' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, type, payload, status, retry_count, max_retries,
              error_message, created_at, started_at, completed_at
       FROM jobs WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /jobs/:id error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch job' });
  }
});

module.exports = router;