import { useCallback, useEffect, useRef, useState } from "react";
import Spinner from "react-bootstrap/Spinner";
import { Container, Row, Col, Button, Alert } from "react-bootstrap";

export interface DockerProps {
  name: string;
  startlink: string;
  stoplink: string;
  restartlink: string;
  runningContainers: string;
  /** Catalog key for POST /api/start_container/ (e.g. pygoat, juice-shop). */
  appKey: string;
  /** Docker image name (e.g. pygoat:latest). */
  imageName: string;
}

/** One row from GET /api/get_containers/ (parent polls; Docker syncs from this). */
export type ServerContainerRow = {
  id: string;
  name: string;
  status: string;
  external_url: string | null;
  terminal_url: string | null;
};

export interface DockerList {
  docker?: DockerProps[];
  serverContainers?: ServerContainerRow[];
}

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

type UiStatus =
  | "idle"
  | "loading"
  | "ready"
  | "resetting"
  | "restarting"
  | "stopping";

function proposedStatusFromRow(
  row: ServerContainerRow | undefined,
): "idle" | "loading" | "ready" {
  if (!row) return "idle";
  if (row.external_url) return "ready";
  const s = (row.status || "").toLowerCase();
  if (s === "starting" || s === "running") return "loading";
  return "idle";
}

/** Do not let a stale GET /api/get_containers/ snapshot clobber in-flight UI. */
function mergeUiStatus(
  prev: UiStatus | undefined,
  proposed: "idle" | "loading" | "ready",
  row: ServerContainerRow | undefined,
): UiStatus {
  const runningish =
    !!row &&
    (row.external_url != null ||
      ["running", "starting"].includes((row.status || "").toLowerCase()));

  if (prev === "stopping") {
    if (
      row &&
      !row.external_url &&
      !["running", "starting"].includes((row.status || "").toLowerCase())
    ) {
      return "idle";
    }
    return "stopping";
  }

  if (prev === "restarting") {
    if (row?.external_url) return "ready";
    if (runningish && !row?.external_url) return "loading";
    return "restarting";
  }

  if (prev === "resetting") {
    if (
      row &&
      !row.external_url &&
      !["running", "starting"].includes((row.status || "").toLowerCase())
    ) {
      return "idle";
    }
    return "resetting";
  }

  if (prev === "loading") {
    if (row?.external_url) return "ready";
    return "loading";
  }

  return proposed;
}

const Docker = ({ docker = [], serverContainers = [] }: DockerList) => {
  const [containerStatus, setContainerStatus] = useState<{
    [key: string]: "idle" | "loading" | "ready" | "resetting" | "restarting" | "stopping";
  }>({});

  const [containerUrls, setContainerUrls] = useState<{ [key: string]: string }>(
    {},
  );

  const [terminalUrls, setTerminalUrls] = useState<{ [key: string]: string }>(
    {},
  );

  const [containerIds, setContainerIds] = useState<{ [key: string]: string }>(
    {},
  );

  const [startErrors, setStartErrors] = useState<{ [key: string]: string }>({});

  const pollingIdsRef = useRef<Set<string>>(new Set());

  const pollForReadiness = useCallback((containerId: string, containerName: string) => {
    if (pollingIdsRef.current.has(containerId)) return;
    pollingIdsRef.current.add(containerId);

    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/check_container_ready/${containerId}/`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "X-CSRFToken": getCookie("wadt_csrftoken") || "",
            },
          },
        );

        if (response.status === 401) {
          clearInterval(intervalId);
          pollingIdsRef.current.delete(containerId);
          setContainerStatus((prev) => ({ ...prev, [containerName]: "idle" }));
          return;
        }

        const data = await response.json();

        if (data.ready) {
          clearInterval(intervalId);
          pollingIdsRef.current.delete(containerId);

          const appUrl = (data.url as string) ?? "";
          const termUrl = (data.terminal_url as string | undefined) ?? "";
          setContainerUrls((prev) => ({ ...prev, [containerName]: appUrl }));
          setTerminalUrls((prev) => ({ ...prev, [containerName]: termUrl }));
          setContainerStatus((prev) => ({ ...prev, [containerName]: "ready" }));
          window.dispatchEvent(new Event("wadt:containers-changed"));
        }
      } catch (error) {
        console.error("Polling error", error);
        clearInterval(intervalId);
        pollingIdsRef.current.delete(containerId);
        setContainerStatus((prev) => ({ ...prev, [containerName]: "idle" }));
      }
    }, 2000);
  }, []);

  useEffect(() => {
    const data = serverContainers;

    const nextIds: { [key: string]: string } = {};

    for (const c of data) {
      if (!c?.name || !c?.id) continue;
      nextIds[c.name] = c.id;
    }

    setStartErrors((prev) => {
      const next = { ...prev };
      for (const c of data) {
        if (c?.name) delete next[c.name];
      }
      return next;
    });

    setContainerIds((prev) => ({ ...prev, ...nextIds }));

    setContainerUrls((prev) => {
      const n = { ...prev };
      for (const d of docker) {
        const row = data.find((c) => c.name === d.name);
        if (row?.external_url) n[d.name] = row.external_url;
        else delete n[d.name];
      }
      return n;
    });

    setTerminalUrls((prev) => {
      const n = { ...prev };
      for (const d of docker) {
        const row = data.find((c) => c.name === d.name);
        if (row?.external_url && row.terminal_url != null) {
          n[d.name] = row.terminal_url;
        } else if (!row?.external_url) delete n[d.name];
      }
      return n;
    });

    setContainerStatus((prev) => {
      const next = { ...prev };
      for (const d of docker) {
        const row = data.find((c) => c.name === d.name);
        const proposed = proposedStatusFromRow(row);
        next[d.name] = mergeUiStatus(prev[d.name], proposed, row);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- docker catalog is static
  }, [serverContainers]);

  useEffect(() => {
    const data = serverContainers;
    for (const d of docker) {
      const row = data.find((c) => c.name === d.name);
      if (
        row &&
        !row.external_url &&
        ["running", "starting"].includes((row.status || "").toLowerCase()) &&
        !pollingIdsRef.current.has(row.id)
      ) {
        pollForReadiness(row.id, d.name);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `docker` is a new array literal each Dashboard render
  }, [serverContainers, pollForReadiness]);

  const handleStart = async (
    appKey: string,
    imageName: string,
    containerName: string,
  ) => {
    setStartErrors((prev) => {
      const next = { ...prev };
      delete next[containerName];
      return next;
    });
    setContainerStatus((prev) => ({ ...prev, [containerName]: "loading" }));

    try {
      const response = await fetch("/api/start_container/", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("wadt_csrftoken") || "",
        },
        body: JSON.stringify({
          app_key: appKey,
          imageName: imageName,
          name: containerName,
        }),
      });

      const data = await response.json();

      if (response.ok && data.id) {
        console.log("Container started, waiting for port...", data.id);
        setContainerIds((prev) => ({ ...prev, [containerName]: data.id }));
        pollForReadiness(data.id, containerName);
        queueMicrotask(() =>
          window.dispatchEvent(new Event("wadt:containers-changed")),
        );
      } else {
        console.error("Start failed:", data);
        setContainerStatus((prev) => ({ ...prev, [containerName]: "idle" }));
      }
    } catch (error) {
      console.error("Error:", error);
      setContainerStatus((prev) => ({ ...prev, [containerName]: "idle" }));
    }
  };

  const handleView = (containerName: string) => {
    const url = containerUrls[containerName];
    if (url) window.open(url, "_blank");
  };

  const handleStop = async (containerName: string) => {
    setContainerStatus((prev) => ({ ...prev, [containerName]: "stopping" }));

    const containerId = containerIds[containerName];

    try {
      const response = await fetch(`/api/stop_container/${containerId}/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("wadt_csrftoken") || "",
        },
      });
      const data = await response.json();

      if (response.ok) {
        console.log(containerName, "container stopped.");
        setContainerStatus((prev) => ({ ...prev, [containerName]: "idle" }));
        setContainerUrls((prev) => {
          const newUrls = { ...prev };
          delete newUrls[containerName];
          return newUrls;
        });
        setTerminalUrls((prev) => {
          const next = { ...prev };
          delete next[containerName];
          return next;
        });
        queueMicrotask(() =>
          window.dispatchEvent(new Event("wadt:containers-changed")),
        );
      } else {
        console.error("Unable to stop container ", data);
        setContainerStatus((prev) => ({ ...prev, [containerName]: "ready" }));
      }
    } catch (error) {
      console.error("Error stopping container :(", error);
      setContainerStatus((prev) => ({ ...prev, [containerName]: "ready" }));
    }
  };

  const handleRestart = async (containerName: string) => {
    const containerId = containerIds[containerName];
    setContainerStatus((prev) => ({ ...prev, [containerName]: "restarting" }));

    try {
      const response = await fetch(`/api/restart_container/${containerId}/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("wadt_csrftoken") || "",
        },
      });
      const data = await response.json();

      if (response.ok) {
        console.log(containerName, "has restarted");
        pollForReadiness(containerId, containerName);
        queueMicrotask(() =>
          window.dispatchEvent(new Event("wadt:containers-changed")),
        );
      } else {
        console.error("Restart failed", data);
        setContainerStatus((prev) => ({ ...prev, [containerName]: "ready" }));
      }
    } catch (error) {
      console.error("Restart error", error);
      setContainerStatus((prev) => ({ ...prev, [containerName]: "ready" }));
    }
  };

  const handleReset = async (containerId: string) => {
    const containerName = Object.keys(containerIds).find(
      (key) => containerIds[key] === containerId,
    );

    if (containerName)
      setContainerStatus((prev) => ({ ...prev, [containerName]: "resetting" }));
    try {
      const response = await fetch(`/api/reset_container/${containerId}/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("wadt_csrftoken") || "",
        },
      });
      const data = await response.json();
      if (response.ok)
        window.dispatchEvent(new Event("wadt:containers-changed"));
      else console.error("Failed to reset container:", data.error);
    } catch (err) {
      console.error("Error resetting container:", err);
    } finally {
      if (containerName) {
        setContainerStatus((prev) => ({ ...prev, [containerName]: "idle" }));
      }
    }
  };

  return (
    <>
      <div style={{ fontSize: "20px", color: "rgb(0, 170, 255)" }}>
        {docker.map((d, i) => (
          <div key={i} style={{ marginTop: "35px" }}>
            <Container className="mb-3">
              <Row className="align-items-center">
                <Col md={3}>
                  <strong>{d.name}</strong>
                </Col>

                <Col className="text-end">
                  {(!containerStatus[d.name] ||
                    containerStatus[d.name] === "idle") && (
                    <Button
                      className="start_button"
                      onClick={() => handleStart(d.appKey, d.imageName, d.name)}
                      style={{ marginLeft: "10px" }}
                      size="sm"
                    >
                      Start
                    </Button>
                  )}
                  {containerStatus[d.name] === "loading" && (
                    <>
                      <Button
                        variant="primary"
                        disabled
                        style={{ marginLeft: "10px" }}
                        size="sm"
                      >
                        <Spinner
                          as="span"
                          animation="border"
                          size="sm"
                          role="status"
                          aria-hidden="true"
                        />
                        <span className="visually-hidden">Loading...</span>
                      </Button>
                      <span
                        style={{
                          marginLeft: "10px",
                          fontSize: "14px",
                          color: "gray",
                        }}
                      >
                        Container starting, this may take a few minutes...
                      </span>
                    </>
                  )}
                  {containerStatus[d.name] === "ready" && (
                    <>
                      <Button
                        variant="success"
                        onClick={() => handleView(d.name)}
                        style={{ marginLeft: "10px" }}
                        size="sm"
                      >
                        Open App
                      </Button>
                      <Button
                        variant="dark"
                        onClick={() => {
                          const tUrl = terminalUrls[d.name];
                          if (tUrl) window.open(tUrl, "_blank");
                        }}
                        style={{ marginLeft: "10px" }}
                        size="sm"
                      >
                        Terminal
                      </Button>
                    </>
                  )}

                  {(containerStatus[d.name] === "loading" ||
                    containerStatus[d.name] === "ready" ||
                    containerStatus[d.name] === "restarting" ||
                    containerStatus[d.name] === "resetting" ||
                    containerStatus[d.name] == "stopping") && (
                    <>
                      <Button
                        variant={
                          containerStatus[d.name] === "stopping"
                            ? "secondary"
                            : "danger"
                        }
                        style={{ marginLeft: "10px" }}
                        onClick={() => handleStop(d.name)}
                        disabled={containerStatus[d.name] === "stopping"}
                        size="sm"
                      >
                        {containerStatus[d.name] === "stopping"
                          ? "Stopping..."
                          : "Stop"}
                      </Button>
                      <Button
                        variant={
                          containerStatus[d.name] === "restarting"
                            ? "secondary"
                            : "warning"
                        }
                        style={{ marginLeft: "10px" }}
                        onClick={() => handleRestart(d.name)}
                        disabled={containerStatus[d.name] === "restarting"}
                        size="sm"
                      >
                        {containerStatus[d.name] === "restarting"
                          ? "Restarting..."
                          : "Restart"}
                      </Button>
                      <Button
                        variant={
                          containerStatus[d.name] === "resetting"
                            ? "secondary"
                            : "info"
                        }
                        style={{ marginLeft: "10px" }}
                        onClick={() => handleReset(containerIds[d.name])}
                        disabled={containerStatus[d.name] === "resetting"}
                        size="sm"
                      >
                        {containerStatus[d.name] === "resetting"
                          ? "Resetting..."
                          : "Reset"}
                      </Button>
                    </>
                  )}
                </Col>
              </Row>

              {startErrors[d.name] && (
                <Row>
                  <Col>
                    <Alert
                      variant="danger"
                      className="mt-2 mb-0 py-2"
                      dismissible
                      onClose={() =>
                        setStartErrors((prev) => {
                          const next = { ...prev };
                          delete next[d.name];
                          return next;
                        })
                      }
                    >
                      {startErrors[d.name]}
                    </Alert>
                  </Col>
                </Row>
              )}
            </Container>
          </div>
        ))}
        <br />
        <br />
      </div>
    </>
  );
};

export default Docker;
