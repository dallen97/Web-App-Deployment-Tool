import { useEffect, useState, useCallback, useRef } from "react";
import { Button, Table } from "react-bootstrap";

interface userInfo {
  name: string;
  con_name: string;
  con_status: string;
  con_id: string;
  started_at: string | null;
  max_runtime_seconds: number;
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

const formatDuration = (totalSeconds: number) => {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(clamped / 86400);
  const hours = Math.floor((clamped % 86400) / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

function getCookie(name: string) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === name + "=") {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

function UserTables() {
  const [data, setData] = useState<userInfo[]>([]);
  const [extended, setExtended] = useState<Record<string, boolean>>({});
  const [isPolling, setIsPolling] = useState(true);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [loadingKeys, setLoadingKeys] = useState<Record<string, boolean>>({});

  const runSinceRef = useRef<Record<string, number>>({});

  // 1-second tick
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const poll = useCallback(async () => {
    try {
      const response = await fetch("/api/get_all_containers_admin/", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const { data } = await response.json();

      const organized: userInfo[] = data.flatMap((user: any) =>
        user.containers.map((container: any) => ({
          name: user.username,
          con_name: container.name,
          con_status: container.status,
          con_id: container.container_id ?? "",
          started_at: container.started_at ?? null,
          max_runtime_seconds: container.max_runtime_seconds ?? 86400,
        })),
      );

      const now = Date.now();
      organized.forEach((row) => {
        const key = `${row.name}-${row.con_name}`;
        if (row.con_status === "RUN" && !(key in runSinceRef.current)) {
          const startedMs = row.started_at ? Date.parse(row.started_at) : now;
          runSinceRef.current[key] = Number.isFinite(startedMs)
            ? startedMs
            : now;
        }
        if (row.con_status !== "RUN") {
          delete runSinceRef.current[key];
        }
      });

      setData(organized);
    } catch {
      console.log("Failed to fetch Container Data");
    }
  }, []);

  useEffect(() => {
    const handle = () => setIsPolling(!document.hidden);
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, []);

  useEffect(() => {
    poll();
    if (!isPolling) return;
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [isPolling, poll]);

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

  const getTimeLeft = (row: userInfo): string => {
    if (row.con_status !== "RUN") return "—";
    const key = `${row.name}-${row.con_name}`;
    const startedMs = runSinceRef.current[key];
    if (!startedMs) return "—";
    const uptimeSeconds = (nowMs - startedMs) / 1000;
    const timeLeftSeconds = row.max_runtime_seconds - uptimeSeconds;
    return timeLeftSeconds <= 0 ? "Expired" : formatDuration(timeLeftSeconds);
  };

  const handleStop = async (row: userInfo) => {
    const key = `${row.name}-${row.con_name}`;
    setLoadingKeys((prev) => ({ ...prev, [key]: true }));
    try {
      const response = await fetch(`/api/stop_container/${row.con_id}/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("wadt_csrftoken") || "",
        },
      });
      if (response.ok) {
        await poll();
      } else {
        console.error("Stop failed", await response.json());
      }
    } catch (err) {
      console.error("Stop error", err);
    } finally {
      setLoadingKeys((prev) => ({ ...prev, [key]: false }));
    }
  };

  const grouped = groupByUser(data);

  return (
    <>
      <div>
        <Table bordered hover>
          <thead>
            <tr>
              <th
                className="small_text"
                style={{
                  backgroundColor: "#001124",
                  color: "rgb(255, 255, 255)",
                }}
              >
                User
              </th>
              <th
                className="small_text"
                style={{
                  backgroundColor: "#001124",
                  color: "rgb(255, 255, 255)",
                }}
              >
                Container
              </th>
              <th
                className="small_text"
                style={{
                  backgroundColor: "#001124",
                  color: "rgb(255, 255, 255)",
                }}
              >
                Status
              </th>
              <th
                className="small_text"
                style={{
                  backgroundColor: "#001124",
                  color: "rgb(255, 255, 255)",
                }}
              >
                Time Remaining
              </th>
              <th
                className="small_text"
                style={{
                  backgroundColor: "#001124",
                  color: "rgb(255, 255, 255)",
                }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="table-body">
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
                    <tr
                      key={username}
                      onClick={() => toggleUser(username)}
                      style={{ cursor: "pointer", background: "#00637c" }}
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

                    {isOpen &&
                      rows.map((row) => {
                        const key = `${row.name}-${row.con_name}`;
                        const isLoading = !!loadingKeys[key];
                        return (
                          <tr
                            key={key}
                            style={{
                              background: "#023578",
                            }}
                          >
                            <td style={{ paddingLeft: 32, color: "#888780" }}>
                              {initials(row.name)}
                            </td>
                            <td>{row.con_name}</td>
                            <td>{row.con_status}</td>
                            <td>{getTimeLeft(row)}</td>
                            <td>
                              {row.con_status === "RUN" ? (
                                <Button
                                  size="sm"
                                  variant="outline-danger"
                                  disabled={isLoading}
                                  onClick={() => handleStop(row)}
                                >
                                  {isLoading ? "Stopping..." : "Stop"}
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline-secondary"
                                  disabled
                                >
                                  Stopped
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
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

export default UserTables;
