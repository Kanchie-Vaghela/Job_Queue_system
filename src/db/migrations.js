// src/db/migrations.js
const pool = require('./pool');

async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type          VARCHAR(100) NOT NULL,
      payload       JSONB NOT NULL DEFAULT '{}',
      status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','completed','failed')),
      retry_count   INTEGER NOT NULL DEFAULT 0,
      max_retries   INTEGER NOT NULL DEFAULT 3,
      error_message TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at    TIMESTAMPTZ,
      completed_at  TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
  `);

  console.log('Migrations complete');
}

module.exports = { runMigrations };