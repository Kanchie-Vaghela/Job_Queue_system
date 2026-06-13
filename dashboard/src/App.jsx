import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const API = "http://localhost:3000";
const socket = io(API);

const STATUS_COLORS = {
  pending: "#f59e0b",
  processing: "#6366f1",
  completed: "#10b981",
  failed: "#ef4444",
};

const STATUS_BG = {
  pending: "#fef3c7",
  processing: "#e0e7ff",
  completed: "#d1fae5",
  failed: "#fee2e2",
};

export default function App() {
  const [jobs, setJobs] = useState({});
  const [metrics, setMetrics] = useState(null);
  const [graphData, setGraphData] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ type: "send_email", payload: "{}" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axios.get(`${API}/jobs?limit=100`).then(({ data }) => {
      const map = {};
      data.jobs.forEach((j) => {
        map[j.id] = j;
      });
      setJobs(map);
    });
  }, []);

  useEffect(() => {
    socket.on("job:created", (job) => {
      setJobs((prev) => ({ ...prev, [job.id]: job }));
    });
    socket.on("job:updated", (update) => {
      setJobs((prev) => {
        if (!prev[update.id]) return prev;
        return { ...prev, [update.id]: { ...prev[update.id], ...update } };
      });
    });
    return () => {
      socket.off("job:created");
      socket.off("job:updated");
    };
  }, []);

  useEffect(() => {
    const fetchMetrics = () => {
      axios.get(`${API}/metrics`).then(({ data }) => {
        setMetrics(data);
        setGraphData((prev) => {
          const next = [
            ...prev,
            { time: new Date().toLocaleTimeString(), depth: data.queue.depth },
          ];
          return next.slice(-20);
        });
      });
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  async function submitJob() {
    let payload;
    try {
      payload = JSON.parse(form.payload);
    } catch {
      return alert("Payload must be valid JSON");
    }
    setSubmitting(true);
    await axios.post(`${API}/jobs`, { type: form.type, payload });
    setSubmitting(false);
  }

  async function replayJob(id, e) {
    e.stopPropagation();
    await axios.post(`${API}/jobs/${id}/replay`);
  }

  const jobList = Object.values(jobs).sort(
    (a, b) =>
      new Date(b.createdAt || b.created_at) -
      new Date(a.createdAt || a.created_at),
  );

  const columns = ["pending", "processing", "completed", "failed"];

  const card = {
    background: "#ffffff",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)",
  };

  const label = {
    fontSize: 12,
    fontWeight: 600,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 14,
  };

  return (
    <div
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        padding: 0,
        background: "#f8fafc",
        minHeight: "100vh",
        color: "#1e293b",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
    maxWidth: "1600px",
    margin: "0 auto",
    padding: "24px",
  }}
      >
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            marginBottom: 24,
            color: "#0f172a",
          }}
        >
          Job Queue Dashboard
        </h1>

        {/* Metrics Bar */}
        {metrics && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 16,
              marginBottom: 24,
            }}
          >
            {columns.map((s) => (
              <div key={s} style={card}>
                <div style={{ ...label, marginBottom: 8 }}>{s}</div>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: STATUS_COLORS[s],
                  }}
                >
                  {metrics.jobs[s] || 0}
                </div>
              </div>
            ))}
            <div style={card}>
              <div style={{ ...label, marginBottom: 8 }}>Avg time</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#6366f1" }}>
                {Math.round(metrics.performance.avg_processing_ms)}
                <span style={{ fontSize: 16, color: "#94a3b8" }}>ms</span>
              </div>
            </div>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: 16,
            marginBottom: 24,
          }}
        >
          {/* Queue depth graph */}
          <div style={card}>
            <div style={label}>Queue Depth — last 20 polls</div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={graphData}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="depth"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Submit form */}
          <div style={card}>
            <div style={label}>Submit Job</div>
            <div style={{ marginBottom: 14 }}>
              <label
                style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}
              >
                Type
              </label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, type: e.target.value }))
                }
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 6,
                  padding: "10px 12px",
                  background: "#f8fafc",
                  color: "#1e293b",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  fontSize: 13,
                  fontFamily: "inherit",
                  outline: "none",
                }}
              >
                {["send_email", "generate_report", "resize_image"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}
              >
                Payload (JSON)
              </label>
              <textarea
                value={form.payload}
                onChange={(e) =>
                  setForm((f) => ({ ...f, payload: e.target.value }))
                }
                rows={3}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 6,
                  padding: "10px 12px",
                  background: "#f8fafc",
                  color: "#1e293b",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  fontFamily: "monospace",
                  fontSize: 12,
                  boxSizing: "border-box",
                  outline: "none",
                  resize: "vertical",
                }}
              />
            </div>
            <button
              onClick={submitJob}
              disabled={submitting}
              style={{
                width: "100%",
                padding: "12px 20px",
                background: "#6366f1",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 600,
                opacity: submitting ? 0.6 : 1,
                transition: "background 0.15s",
              }}
            >
              {submitting ? "Submitting…" : "Submit Job"}
            </button>
          </div>
        </div>

        {/* Kanban columns */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            marginBottom: 24,
          }}
        >
          {columns.map((status) => (
            <div key={status} style={{ ...card, padding: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 14,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#334155",
                    textTransform: "capitalize",
                  }}
                >
                  {status}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: STATUS_COLORS[status],
                    background: STATUS_BG[status],
                    borderRadius: 999,
                    padding: "2px 10px",
                  }}
                >
                  {jobList.filter((j) => j.status === status).length}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  maxHeight: 480,
                  overflowY: "auto",
                }}
              >
                {jobList
                  .filter((j) => j.status === status)
                  .slice(0, 15)
                  .map((job) => (
                    <div
                      key={job.id}
                      onClick={() => setSelected(job)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        background:
                          selected?.id === job.id ? "#f1f5f9" : "#f8fafc",
                        cursor: "pointer",
                        fontSize: 13,
                        border:
                          "1px solid " +
                          (selected?.id === job.id
                            ? STATUS_COLORS[status]
                            : "#f1f5f9"),
                        transition: "background 0.1s",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          color: "#1e293b",
                          marginBottom: 2,
                        }}
                      >
                        {job.type}
                      </div>
                      <div
                        style={{
                          color: "#94a3b8",
                          fontSize: 11,
                          fontFamily: "monospace",
                        }}
                      >
                        {(job.id || "").slice(0, 8)}…
                      </div>
                      {job.retry_count > 0 && (
                        <div
                          style={{
                            color: "#f59e0b",
                            fontSize: 11,
                            marginTop: 4,
                            fontWeight: 500,
                          }}
                        >
                          retries: {job.retry_count}
                        </div>
                      )}
                      {status === "failed" && (
                        <button
                          onClick={(e) => replayJob(job.id, e)}
                          style={{
                            marginTop: 8,
                            padding: "4px 10px",
                            fontSize: 11,
                            fontWeight: 600,
                            background: "#6366f1",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                          }}
                        >
                          Replay
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {/* Job detail panel */}
        {selected && (
          <div style={card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <span style={label.color ? label : { ...label, marginBottom: 0 }}>
                Job Detail
              </span>
              <button
                onClick={() => setSelected(null)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  fontSize: 14,
                  borderRadius: 8,
                  width: 28,
                  height: 28,
                }}
              >
                ✕
              </button>
            </div>
            <pre
              style={{
                margin: 0,
                fontSize: 12,
                color: "#334155",
                overflowX: "auto",
                background: "#f8fafc",
                padding: 16,
                borderRadius: 10,
                fontFamily: "monospace",
              }}
            >
              {JSON.stringify(selected, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
