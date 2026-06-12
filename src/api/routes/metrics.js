const express = require('express');
const router = express.Router();
const pool = require('../../db/pool');
const { createClient } = require('../../queue/redis');
const config = require('../../config');

const redis = createClient();

router.get('/', async (req, res) => {
  try {
    const [statusCounts, avgTime, queueDepth, processingDepth, deadDepth] =
      await Promise.all([
        pool.query(`
          SELECT status, COUNT(*) as count
          FROM jobs
          GROUP BY status
        `),
        pool.query(`
          SELECT ROUND(
            AVG(
              EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000
            )::numeric, 2
          ) AS avg_ms
          FROM jobs
          WHERE status = 'completed'
            AND started_at IS NOT NULL
            AND completed_at IS NOT NULL
        `),
        redis.llen(config.queues.main),
        redis.llen(config.queues.processing),
        redis.llen(config.queues.dead),
      ]);

    const counts = { pending: 0, processing: 0, completed: 0, failed: 0 };
    for (const row of statusCounts.rows) {
      counts[row.status] = parseInt(row.count);
    }

    return res.json({
      jobs:          counts,
      queue: {
        depth:      queueDepth,
        processing: processingDepth,
        dead:       deadDepth,
      },
      performance: {
        avg_processing_ms: parseFloat(avgTime.rows[0].avg_ms) || 0,
      },
    });
  } catch (err) {
    console.error('GET /metrics error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

module.exports = router;