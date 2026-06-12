import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const API = 'http://localhost:3000';
const socket = io(API);

const STATUS_COLORS = {
  pending:    '#f59e0b',
  processing: '#3b82f6',
  completed:  '#10b981',
  failed:     '#ef4444',
};

export default function App() {
  const [jobs, setJobs]           = useState({});   // keyed by id for O(1) updates
  const [metrics, setMetrics]     = useState(null);
  const [graphData, setGraphData] = useState([]);
  const [selected, setSelected]   = useState(null);
  const [form, setForm]           = useState({ type: 'send_email', payload: '{}' });
  const [submitting, setSubmitting] = useState(false);

  // Load initial jobs
  useEffect(() => {
    axios.get(`${API}/jobs?limit=100`).then(({ data }) => {
      const map = {};
      data.jobs.forEach(j => { map[j.id] = j; });
      setJobs(map);
    });
  }, []);

  // Socket.IO listeners
  useEffect(() => {
    socket.on('job:created', (job) => {
      setJobs(prev => ({ ...prev, [job.id]: job }));
    });

    socket.on('job:updated', (update) => {
      setJobs(prev => {
        if (!prev[update.id]) return prev;
        return { ...prev, [update.id]: { ...prev[update.id], ...update } };
      });
    });

    return () => {
      socket.off('job:created');
      socket.off('job:updated');
    };
  }, []);

  // Poll metrics every 5s
  useEffect(() => {
    const fetchMetrics = () => {
      axios.get(`${API}/metrics`).then(({ data }) => {
        setMetrics(data);
        setGraphData(prev => {
          const next = [...prev, {
            time:  new Date().toLocaleTimeString(),
            depth: data.queue.depth,
          }];
          return next.slice(-20);  // keep last 20 data points
        });
      });
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  async function submitJob() {
    let payload;
    try { payload = JSON.parse(form.payload); }
    catch { return alert('Payload must be valid JSON'); }

    setSubmitting(true);
    await axios.post(`${API}/jobs`, { type: form.type, payload });
    setSubmitting(false);
  }

  async function replayJob(id, e) {
    e.stopPropagation();
    await axios.post(`${API}/jobs/${id}/replay`);
  }

  const jobList = Object.values(jobs).sort(
    (a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at)
  );

  const columns = ['pending', 'processing', 'completed', 'failed'];

  return (
    <div style={{ fontFamily: 'monospace', padding: 24, background: '#0f172a', minHeight: '100vh', color: '#e2e8f0' }}>

      {/* Metrics Bar */}
      {metrics && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          {columns.map(s => (
            <div key={s} style={{
              flex: 1, padding: '12px 16px', borderRadius: 8,
              background: '#1e293b', borderLeft: `4px solid ${STATUS_COLORS[s]}`
            }}>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>{s}</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{metrics.jobs[s] || 0}</div>
            </div>
          ))}
          <div style={{ flex: 1, padding: '12px 16px', borderRadius: 8, background: '#1e293b', borderLeft: '4px solid #8b5cf6' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>Avg time</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{metrics.performance.avg_processing_ms}ms</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>

        {/* Queue depth graph */}
        <div style={{ background: '#1e293b', borderRadius: 8, padding: 16 }}>
          <div style={{ marginBottom: 12, color: '#94a3b8', fontSize: 12 }}>QUEUE DEPTH (last 20 polls)</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={graphData}>
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: 'none', fontSize: 12 }} />
              <Line type="monotone" dataKey="depth" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Submit form */}
        <div style={{ background: '#1e293b', borderRadius: 8, padding: 16 }}>
          <div style={{ marginBottom: 12, color: '#94a3b8', fontSize: 12 }}>SUBMIT JOB</div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#94a3b8' }}>Type</label>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px',
                background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6 }}
            >
              {['send_email','generate_report','resize_image'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#94a3b8' }}>Payload (JSON)</label>
            <textarea
              value={form.payload}
              onChange={e => setForm(f => ({ ...f, payload: e.target.value }))}
              rows={3}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px',
                background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155',
                borderRadius: 6, fontFamily: 'monospace', fontSize: 12, boxSizing: 'border-box' }}
            />
          </div>
          <button
            onClick={submitJob}
            disabled={submitting}
            style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff',
              border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'monospace',
              opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? 'Submitting...' : 'Submit Job'}
          </button>
        </div>
      </div>

      {/* Kanban columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {columns.map(status => (
          <div key={status} style={{ background: '#1e293b', borderRadius: 8, padding: 12 }}>
            <div style={{
              marginBottom: 10, fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              color: STATUS_COLORS[status], letterSpacing: 1
            }}>
              {status} ({jobList.filter(j => j.status === status).length})
            </div>
            {jobList.filter(j => j.status === status).slice(0, 15).map(job => (
              <div
                key={job.id}
                onClick={() => setSelected(job)}
                style={{
                  padding: '8px 10px', marginBottom: 6, borderRadius: 6,
                  background: '#0f172a', cursor: 'pointer', fontSize: 12,
                  border: selected?.id === job.id ? `1px solid ${STATUS_COLORS[status]}` : '1px solid transparent',
                }}
              >
                <div style={{ color: '#e2e8f0', marginBottom: 2 }}>{job.type}</div>
                <div style={{ color: '#64748b', fontSize: 10 }}>{(job.id || '').slice(0, 8)}…</div>
                {job.retry_count > 0 && (
                  <div style={{ color: '#f59e0b', fontSize: 10 }}>retries: {job.retry_count}</div>
                )}
                {status === 'failed' && (
                  <button
                    onClick={(e) => replayJob(job.id, e)}
                    style={{ marginTop: 6, padding: '3px 8px', fontSize: 10,
                      background: '#7c3aed', color: '#fff', border: 'none',
                      borderRadius: 4, cursor: 'pointer' }}
                  >
                    Replay
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Job detail panel */}
      {selected && (
        <div style={{ background: '#1e293b', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>JOB DETAIL</span>
            <button
              onClick={() => setSelected(null)}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16 }}
            >✕</button>
          </div>
          <pre style={{ margin: 0, fontSize: 12, color: '#e2e8f0', overflowX: 'auto' }}>
            {JSON.stringify(selected, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}