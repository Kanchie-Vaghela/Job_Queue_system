# Job Queue System with Real-Time Dashboard

A producer/consumer job processing system built with Node.js, Redis, PostgreSQL, and Docker — featuring retry logic with exponential backoff, dead letter queues, horizontal worker scaling, and a live WebSocket dashboard.


<img width="1897" height="920" alt="Screenshot 2026-06-13 132732" src="https://github.com/user-attachments/assets/503fc4ae-db68-4457-8a52-d58ab13a8f72" />


*Jobs move live across Pending → Processing → Completed/Failed columns. Failed jobs retry with exponential backoff (1s, 2s, 4s) before landing in the dead letter queue, with one-click replay.*


## What It Does

- Submit a job via API → get a job ID instantly (`202 Accepted`)
- Workers pull jobs from a Redis queue using atomic `BRPOPLPUSH`
- Failed jobs retry automatically with exponential backoff
- After 3 failures, jobs move to a dead letter queue — replayable via API
- 3 worker containers process jobs concurrently with zero duplicate execution
- React dashboard shows everything live via Socket.IO — no polling


## Tech Stack

**Backend:** Node.js, Express, PostgreSQL (pg), Redis (ioredis), Socket.IO <br/>
**Frontend:** React, Vite, Recharts, socket.io-client<br/>
**Infra:** Docker, docker-compose (multi-container, horizontally scalable)


## Architecture (high level)

```
Client -> API (Express) -> PostgreSQL (job records)
                         -> Redis job_queue (LIST)
                                |
                       BRPOPLPUSH (atomic)
                                |
                +---------------+---------------+
                v               v               v
            Worker 1        Worker 2        Worker 3
                |               |               |
                +----- status updates ----------+
                                |
                       Redis pub/sub (job:events)
                                |
                       API (Socket.IO) -> Dashboard
```


## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/jobs` | Submit a job. `{ "type": string, "payload": object }` -> returns `jobId` |
| `GET` | `/jobs/:id` | Get full job details |
| `GET` | `/jobs` | List jobs, filter by `status`/`type`, paginated |
| `POST` | `/jobs/:id/replay` | Requeue a failed job |
| `GET` | `/metrics` | Queue depth, job counts, avg processing time |

## Running Locally

```bash
git clone https://github.com/Kanchie-Vaghela/Job_Queue_system.git
cd job-queue-system
cp .env.example .env
docker-compose up --build --scale worker=3
```

- API: `http://localhost:3000`
- Dashboard: `http://localhost:8080`

```bash
# Submit a job
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{"type":"send_email","payload":{"to":"test@example.com"}}'
```
## Scaling Proof

60 jobs submitted to a 3-worker cluster:

<img width="1300" height="210" alt="image" src="https://github.com/user-attachments/assets/d02f4fe2-cbce-4140-8b1b-0215351ebcdd" />
