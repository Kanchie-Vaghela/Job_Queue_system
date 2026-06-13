import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 10 },   // ramp up to 10 concurrent users
    { duration: '20s', target: 50 },   // ramp up to 50
    { duration: '20s', target: 50 },   // sustain 50
    { duration: '10s', target: 0 },    // ramp down
  ],
};

const jobTypes = ['send_email', 'generate_report', 'resize_image'];

export default function () {
  const payload = JSON.stringify({
    type: jobTypes[Math.floor(Math.random() * jobTypes.length)],
    payload: { test: true },
  });

  const res = http.post('http://localhost:3000/jobs', payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 202': (r) => r.status === 202,
    'has jobId': (r) => JSON.parse(r.body).jobId !== undefined,
  });

  sleep(0.1);
}