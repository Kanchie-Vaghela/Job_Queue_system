// src/worker/worker.js
const pool = require('../db/pool');
const { createClient } = require('../queue/redis');
const config = require('../config');

const subscriber = createClient();  // blocks on BRPOPLPUSH
const publisher  = createClient();  // free for other commands

const WORKER_ID = `worker-${process.pid}`;

async function processJob(jobId) {
  // 1. Fetch full job from Postgres
  const result = await pool.query(
    `UPDATE jobs
     SET status = 'processing', started_at = NOW()
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [jobId]
  );

  if (result.rows.length === 0) {
    console.log(`[${WORKER_ID}] Job ${jobId} already taken or missing — skipping`);
    return;
  }

  const job = result.rows[0];
  console.log(`[${WORKER_ID}] Processing job ${job.id} type=${job.type}`);

  try {
    await executeJob(job);

    await pool.query(
      `UPDATE jobs
       SET status = 'completed', completed_at = NOW()
       WHERE id = $1`,
      [job.id]
    );

    await publisher.lrem('job_processing', 1, jobId);
    console.log(`[${WORKER_ID}] Job ${job.id} completed`);

  } catch (err) {
    console.error(`[${WORKER_ID}] Job ${job.id} failed:`, err.message);
    await handleFailure(job, err.message);
  }
}

async function executeJob(job) {
  // Simulated job execution — replace with real logic in Week 2
  switch (job.type) {
    case 'send_email':
      await sleep(500);
      console.log(`  → Sending email with payload:`, job.payload);
      break;
    case 'generate_report':
      await sleep(1000);
      console.log(`  → Generating report:`, job.payload);
      break;
    case 'resize_image':
      await sleep(800);
      if (Math.random() < 0.3) throw new Error('Simulated image processing failure');
      console.log(`  → Resizing image:`, job.payload);
      break;
    default:
      await sleep(300);
      console.log(`  → Processing generic job:`, job.payload);
  }
}

async function handleFailure(job, errorMessage) {
  const newRetryCount = job.retry_count + 1;

  if (newRetryCount >= job.max_retries) {
    // Move to dead letter queue
    await pool.query(
      `UPDATE jobs
       SET status = 'failed', retry_count = $1, error_message = $2, completed_at = NOW()
       WHERE id = $3`,
      [newRetryCount, errorMessage, job.id]
    );
    await publisher.lpush(config.queues.dead, job.id);
    await publisher.lrem(config.queues.processing, 1, job.id);
    console.log(`[${WORKER_ID}] Job ${job.id} moved to dead letter queue after ${newRetryCount} attempts`);
    return;
  }

  // Exponential backoff: 1s, 2s, 4s
  const delay = Math.pow(2, newRetryCount) * 1000;

  await pool.query(
    `UPDATE jobs
     SET status = 'pending', retry_count = $1, error_message = $2
     WHERE id = $3`,
    [newRetryCount, errorMessage, job.id]
  );

  await publisher.lrem(config.queues.processing, 1, job.id);

  console.log(`[${WORKER_ID}] Job ${job.id} will retry in ${delay}ms (attempt ${newRetryCount}/${job.max_retries})`);
  await sleep(delay);
  await publisher.lpush(config.queues.main, job.id);
}

async function run() {
  console.log(`[${WORKER_ID}] Worker started`);
  await waitForRedis(publisher); 
  
  while (true) {
    try {
      // BRPOPLPUSH: atomically pop from job_queue, push to job_processing
      // Blocks for up to 30s waiting for a job
      const jobId = await subscriber.brpoplpush(
        config.queues.main,
        config.queues.processing,
        30  // timeout in seconds
      );

      if (jobId) {
        await processJob(jobId);
      }
    } catch (err) {
      console.error(`[${WORKER_ID}] Worker loop error:`, err.message);
      await sleep(1000);
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// src/worker/worker.js  — add this before the run() call

async function waitForRedis(client, maxAttempts = 10) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await client.ping();
      console.log(`[${WORKER_ID}] Redis is ready`);
      return;
    } catch (err) {
      console.log(`[${WORKER_ID}] Waiting for Redis... attempt ${i}/${maxAttempts}`);
      await sleep(2000);
    }
  }
  throw new Error('Redis not available after max attempts');
}



run().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});