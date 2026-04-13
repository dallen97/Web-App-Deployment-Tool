import { useEffect, useState, useRef } from "react";
import { Button, Table } from "react-bootstrap";
import getCookie from "./GetCookie";
import { OverlayTrigger, Tooltip } from "react-bootstrap";

export interface userInfo {
  name: string;
  userId: number;
  role: string;
  con_name: string | null;
  con_status: string | null;
  con_id: string | null;
  started_at: string | null;
  max_runtime_seconds: number;
}

interface UserTablesProps {
  data: userInfo[];
  onStop: (row: userInfo) => Promise<void>;
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
  return name ? name.slice(0, 2).toUpperCase() : undefined;
}

const formatDuration = (totalSeconds: number) => {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(clamped / 86400);
  const hours = Math.floor((clamped % 86400) / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

const makeCoadmin = async (row: userInfo) => {
  const promote = await fetch(`/api/approve_teacher/${row.userId}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("wadt_csrftoken") || "",
    },
    credentials: "include",
    body: JSON.stringify({
      target_user_id: row.userId,
    }),
  });
  if (!promote.ok) console.log("ERROR");
  console.log("User is now coadmin");
};

function UserTables({ data, onStop }: UserTablesProps) {
  const [extended, setExtended] = useState<Record<string, boolean>>({});
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [loadingKeys, setLoadingKeys] = useState<Record<string, boolean>>({});

  const runSinceRef = useRef<Record<string, number>>({});

  // 1-second tick
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync runSinceRef when data changes
  useEffect(() => {
    const now = Date.now();
    data.forEach((row) => {
      const key = `${row.name}-${row.con_name}`;
      if (row.con_status === "RUN" && !(key in runSinceRef.current)) {
        const startedMs = row.started_at ? Date.parse(row.started_at) : now;
        runSinceRef.current[key] = Number.isFinite(startedMs) ? startedMs : now;
      }
      if (row.con_status !== "RUN") {
        delete runSinceRef.current[key];
      }
    });
  }, [data]);

  // Auto-expand new users
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

  const handleRemoveUser = async (row: userInfo) => {
    try {
      const response = await fetch(`/api/remove_member/${row.userId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("wadt_csrftoken") || "",
        },
        credentials: "include",
        body: JSON.stringify({
          target_user_id: row.userId,
        }),
      });
      if (!response.ok) return;

      console.log("SUCCESSFULLY REMOVED");
    } catch (error) {
      console.error("ERROR REMOVING FROM ORG");
    }
  };

  const handleStop = async (row: userInfo) => {
    const key = `${row.name}-${row.con_name}`;
    setLoadingKeys((prev) => ({ ...prev, [key]: true }));
    try {
      await onStop(row);
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
                    <tr>
                      <td
                        key={username}
                        onClick={() => toggleUser(username)}
                        style={{ cursor: "pointer" }}
                      >
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
                        {rows[0].role === "ADMIN" ? (
                          <>
                            <strong style={{ color: "red" }}>{username}</strong>
                          </>
                        ) : rows[0].role === "COADMIN" ? (
                          <>
                            <strong style={{ color: "yellow" }}>
                              {username}
                            </strong>
                          </>
                        ) : (
                          <strong>{username}</strong>
                        )}
                      </td>
                      <td>
                        {/*Alter the 'container field if member has opened a container */}
                        {rows.some((row) => !row.con_name)
                          ? "0 containers"
                          : `${rows.length} container${rows.length !== 1 ? "s" : ""}`}
                      </td>
                      <td>{runCount} running</td>
                      <td>—</td>
                      <td>
                        {rows[0].role !== "ADMIN" ? (
                          <>
                            <OverlayTrigger
                              placement="bottom"
                              delay={{ show: 250, hide: 250 }}
                              overlay={
                                <Tooltip id="button-tooltip">
                                  Promote to co-admin
                                </Tooltip>
                              }
                            >
                              <Button
                                size="sm"
                                variant="outline-warning"
                                style={{ marginLeft: "5px" }}
                                disabled={rows[0].role === "COADMIN"}
                                onClick={() => makeCoadmin(rows[0])}
                              >
                                CO
                              </Button>
                            </OverlayTrigger>
                            <OverlayTrigger
                              placement="bottom"
                              delay={{ show: 250, hide: 250 }}
                              overlay={
                                <Tooltip id="button-tooltip">
                                  Remove User
                                </Tooltip>
                              }
                            >
                              <Button
                                size="sm"
                                variant="outline-danger"
                                style={{ marginLeft: "5px" }}
                                onClick={() => handleRemoveUser(rows[0])}
                              >
                                ✕
                              </Button>
                            </OverlayTrigger>
                          </>
                        ) : (
                          <></>
                        )}
                      </td>
                    </tr>

                    {isOpen &&
                      rows.some((row) => row.con_name) &&
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
