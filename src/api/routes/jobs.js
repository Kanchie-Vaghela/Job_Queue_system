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

    const io = req.app.get('io');
    io.emit('job:created', {
      id:        job.id,
      type:      job.type,
      status:    job.status,
      payload:   payload,
      createdAt: job.created_at,
    });

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

router.get('/', async (req, res) => {
  const { status, type, limit = 50, offset = 0 } = req.query;

  const conditions = [];
  const values = [];
  let idx = 1;

  if (status) {
    conditions.push(`status = $${idx++}`);
    values.push(status);
  }
  if (type) {
    conditions.push(`type = $${idx++}`);
    values.push(type);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  values.push(parseInt(limit));
  values.push(parseInt(offset));

  try {
    const result = await pool.query(
      `SELECT id, type, payload, status, retry_count, max_retries,
              error_message, created_at, started_at, completed_at
       FROM jobs
       ${where}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      values
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM jobs ${where}`,
      values.slice(0, conditions.length)
    );

    return res.json({
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
      jobs: result.rows,
    });
  } catch (err) {
    console.error('GET /jobs error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

router.post('/:id/replay', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE jobs
       SET status     = 'pending',
           retry_count = 0,
           error_message = NULL,
           started_at  = NULL,
           completed_at = NULL
       WHERE id = $1 AND status = 'failed'
       RETURNING id, type, status`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        error: 'Job not found or not in failed state'
      });
    }

    const job = result.rows[0];
    await redisClient.lpush('job_queue', job.id);

    const io = req.app.get('io');
    io.emit('job:updated', {
      id:     job.id,
      status: 'pending',
    });
    
    return res.json({
      message: 'Job requeued',
      jobId:   job.id,
      status:  job.status,
    });
  } catch (err) {
    console.error('POST /jobs/:id/replay error:', err.message);
    return res.status(500).json({ error: 'Failed to replay job' });
  }
});

module.exports = router;