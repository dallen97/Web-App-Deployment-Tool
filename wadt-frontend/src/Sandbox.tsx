import { useEffect, useState, useCallback } from "react";
import { Container, Row, Col, Button, Table, Form } from "react-bootstrap";

interface userInfo {
  name: string;
  con_name: string;
  con_status: string;
  time_rem: number;
}

function groupByUser(data: userInfo[]): Record<string, userInfo[]> {
  return data.reduce(
    (acc, row) => {
      if (!acc[row.name]) acc[row.name] = [];
      acc[row.name].push(row);
      return acc;
    },
    {} as Record<string, userInfo[]>,
  );
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function formatTime(seconds: number) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function Sandbox() {
  const [data, setData] = useState<userInfo[]>([]);
  const [extended, setExtended] = useState<Record<string, boolean>>({});
  const [isPolling, setIsPolling] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const poll = useCallback(async () => {
    try {
      const response = await fetch("/api/get_all_containers_admin/", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const { data } = await response.json();

      const organizeData: userInfo[] = data.flatMap((user: any) =>
        user.containers.map((container: any) => ({
          name: user.username,
          con_name: container.name,
          con_status: container.status,
          time_rem: 0,
        })),
      );

      setData(organizeData);
      setError(null);
      console.log("Organized Data: ", organizeData);
    } catch (error) {
      setError("Failed to fetch container data.");
      console.log("ERROR fetching data");
    }
  }, []);

  // Pause polling when tab is hidden
  useEffect(() => {
    const handle = () => setIsPolling(!document.hidden);
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, []);

  // Polling loop
  useEffect(() => {
    poll();
    if (!isPolling) return;
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [isPolling, poll]);

  // Auto-expand new users without collapsing existing ones
  useEffect(() => {
    if (!data.length) return;
    const grouped = groupByUser(data);
    setExtended((prev) => {
      const next = { ...prev };
      Object.keys(grouped).forEach((name) => {
        if (!(name in next)) next[name] = true;
      });
      return next;
    });
  }, [data]);

  const toggleUser = (name: string) => {
    setExtended((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const grouped = groupByUser(data);

  return (
    <>
      <div style={{ marginTop: "100px" }}>
        {/* Polling indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <span
            title={isPolling ? "Live polling" : "Paused"}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: isPolling ? "#639922" : "#888780",
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: 12, color: "#888780" }}>
            {isPolling ? "Live" : "Paused"}
          </span>
        </div>

        {error && <p style={{ color: "red", fontSize: 13 }}>{error}</p>}

        <Table bordered hover>
          <thead>
            <tr>
              <th>User</th>
              <th>Container</th>
              <th>Status</th>
              <th>Time Remaining</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center" }}>
                  No container data available
                </td>
              </tr>
            ) : (
              Object.entries(grouped).map(([username, rows]) => {
                const isOpen = !!extended[username];
                const runCount = rows.filter(
                  (r) => r.con_status === "RUN",
                ).length;
                return (
                  <>
                    {/* User header row */}
                    <tr
                      key={username}
                      onClick={() => toggleUser(username)}
                      style={{ cursor: "pointer", background: "#f8f8f7" }}
                    >
                      <td>
                        <span
                          style={{
                            marginRight: 8,
                            fontSize: 11,
                            display: "inline-block",
                            transition: "transform 0.15s",
                            transform: isOpen
                              ? "rotate(90deg)"
                              : "rotate(0deg)",
                          }}
                        >
                          ▶
                        </span>
                        <strong>{username}</strong>
                      </td>
                      <td>
                        {rows.length} container{rows.length !== 1 ? "s" : ""}
                      </td>
                      <td>{runCount} running</td>
                      <td>—</td>
                      <td>—</td>
                    </tr>

                    {/* Container child rows */}
                    {isOpen &&
                      rows.map((row) => (
                        <tr
                          key={`${row.name}-${row.con_name}`}
                          style={{ background: "#ffffff" }}
                        >
                          <td style={{ paddingLeft: 32, color: "#888780" }}>
                            {initials(row.name)}
                          </td>
                          <td>{row.con_name}</td>
                          <td>{row.con_status}</td>
                          <td>{formatTime(row.time_rem)}</td>
                          <td>
                            <Button size="sm" variant="outline-secondary">
                              {row.con_status === "RUN" ? "Stop" : "Start"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </>
                );
              })
            )}
          </tbody>
        </Table>
      </div>
    </>
  );
}

export default Sandbox;
