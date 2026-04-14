import { useEffect, useState } from "react";
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

export interface DockerList {
  docker?: DockerProps[];
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

const Docker = ({ docker = [] }: DockerList) => {
  // State to track status: 'idle', 'loading', or 'ready' for each container by name
  const [containerStatus, setContainerStatus] = useState<{
    [key: string]: "idle" | "loading" | "ready";
  }>({});

  // State to store the dynamic URL (e.g., localhost:55001) once ready
  const [containerUrls, setContainerUrls] = useState<{ [key: string]: string }>(
    {},
  );

  const [terminalUrls, setTerminalUrls] = useState<{ [key: string]: string }>(
    {},
  );

  // State to store container ID's for stopping and restarting
  const [containerIds, setContainerIds] = useState<{ [key: string]: string }>(
    {},
  );

  const [startErrors, setStartErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    // Hydrate running containers after a page reload so buttons show "Open App"
    const hydrateRunningContainers = async () => {
      try {
        const response = await fetch("/api/get_containers/", {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) return;

        const data = (await response.json()) as Array<{
          id: string;
          name: string;
          status: string;
          external_url: string | null;
          terminal_url: string | null;
        }>;

        const nextIds: { [key: string]: string } = {};
        const nextStatuses: { [key: string]: "idle" | "loading" | "ready" } = {};
        const nextUrls: { [key: string]: string } = {};
        const nextTerminalUrls: { [key: string]: string } = {};

        for (const c of data) {
          if (!c?.name || !c?.id) continue;
          nextIds[c.name] = c.id;

          if (c.external_url) {
            nextUrls[c.name] = c.external_url;
            nextTerminalUrls[c.name] = c.terminal_url ?? "";
            nextStatuses[c.name] = "ready";
          } else if (c.status === "starting" || c.status === "running") {
            // It's still starting, keep the spinner going
            nextStatuses[c.name] = "loading";
            pollForReadiness(c.id, c.name);
          } else {
            // Explicitly clear stale ready state after external stop/restart actions.
            nextStatuses[c.name] = "idle";
          }
        }

        setStartErrors((prev) => {
          const next = { ...prev };
          for (const c of data) {
            if (c?.name) delete next[c.name];
          }
          return next;
        });
        setContainerIds((prev) => ({ ...prev, ...nextIds }));
        setContainerStatus((prev) => ({ ...prev, ...nextStatuses }));
        setContainerUrls(nextUrls);
        setTerminalUrls(nextTerminalUrls);
      } catch {
        // ignore (user may be logged out or backend down)
      }
    };

    hydrateRunningContainers();
    const intervalId = setInterval(hydrateRunningContainers, 5000);
    window.addEventListener("wadt:containers-changed", hydrateRunningContainers);
    // Only run on mount; state updates happen via setters above
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      clearInterval(intervalId);
      window.removeEventListener("wadt:containers-changed", hydrateRunningContainers);
    };
  }, []);

  // 1. Start Container
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
        window.dispatchEvent(new Event("wadt:containers-changed"));
        pollForReadiness(data.id, containerName);
        setContainerIds((prev) => ({ ...prev, [containerName]: data.id }));
      } else {
        console.error("Start failed:", data);
        // Reset to start button on failure
        setContainerStatus((prev) => ({ ...prev, [containerName]: "idle" }));
      }
    } catch (error) {
      console.error("Error:", error);
      setContainerStatus((prev) => ({ ...prev, [containerName]: "idle" }));
    }
  };

  // 2. Poll for Readiness (The Real Health Check)
  const pollForReadiness = (containerId: string, containerName: string) => {
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
          setContainerStatus((prev) => ({ ...prev, [containerName]: "idle" }));
          return;
        }

        const data = await response.json();

        if (data.ready) {
          clearInterval(intervalId); // Stop checking
          
          // Same URLs as the logs page: always from get_containers (not check_container_ready JSON).
          try {
            const rc = await fetch("/api/get_containers/", {
              method: "GET",
              credentials: "include",
            });
            if (rc.ok) {
              const list = (await rc.json()) as Array<{
                id: string;
                name: string;
                external_url: string | null;
                terminal_url: string | null;
              }>;
              const row = list.find((x) => x.id === containerId);
              if (row?.external_url) {
                setContainerUrls((prev) => ({
                  ...prev,
                  [containerName]: row.external_url as string,
                }));
                setTerminalUrls((prev) => ({
                  ...prev,
                  [containerName]: (row.terminal_url ?? "") as string,
                }));
                console.log("Container is officially ready at:", row.external_url);
                setContainerStatus((prev) => ({ ...prev, [containerName]: "ready" }));
                window.dispatchEvent(new Event("wadt:containers-changed"));
                return;
              }
            }
          } catch {
            /* fall through */
          }
          const appUrl = (data.url as string) ?? "";
          const termUrl = (data.terminal_url as string | undefined) ?? "";
          setContainerUrls((prev) => ({ ...prev, [containerName]: appUrl }));
          setTerminalUrls((prev) => ({ ...prev, [containerName]: termUrl }));

          setContainerStatus((prev) => ({ ...prev, [containerName]: "ready" }));
          window.dispatchEvent(new Event("wadt:containers-changed"));
        }
        // If data.ready is false, the loop simply continues until the 502 goes away!
      } catch (error) {
        console.error("Polling error", error);
        clearInterval(intervalId);
        setContainerStatus((prev) => ({ ...prev, [containerName]: "idle" }));
      }
    }, 2000); // Check every 2 seconds
  };

  // 3. Open in New Tab
  const handleView = (containerName: string) => {
    const url = containerUrls[containerName];
    if (url) window.open(url, "_blank");
  };

  // 4. Stop Container
  const handleStop = async (containerName: string) => {
    setContainerStatus((prev) => ({ ...prev, [containerName]: "loading" }));

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
        window.dispatchEvent(new Event("wadt:containers-changed"));
        // Reset start button state
        setContainerStatus((prev) => ({ ...prev, [containerName]: "idle" }));
        setContainerUrls((prev) => {
          const newUrls = { ...prev };
          delete newUrls[containerName];
          return newUrls;
        });
      } else {
        console.error("Unable to stop container ", data);
      }
    } catch (error) {
      console.error("Error stopping container :(", error);
    }
  };

  // 5. Restart Container
  const handleRestart = async (containerName: string) => {
    const containerId = containerIds[containerName];
    setContainerStatus((prev) => ({ ...prev, [containerName]: "loading" }));

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
        window.dispatchEvent(new Event("wadt:containers-changed"));
        pollForReadiness(containerId, containerName);
      } else {
        console.error("Restart failed", data);
        setContainerStatus((prev) => ({ ...prev, [containerName]: "idle" }));
      }
    } catch (error) {
      console.error("Restart error", error);
      setContainerStatus((prev) => ({ ...prev, [containerName]: "idle" }));
    }
  };

  // 6. Reset container
  const handleReset = async (containerId: string) => {
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
                  {/* 1. IDLE STATE: Show Start Button */}
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
                  {/* 2. LOADING STATE: Show Spinner */}
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
                    <span style={{ marginLeft: "10px", fontSize: "14px", color: "gray" }}>Container starting, this may take a few minutes...</span>
                    </>
                  )}
                  {/* 3. READY STATE: Show Open App Button */}
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

                  {/* 4. Stop, Restart, Reset when running */}
                  {(containerStatus[d.name] === "loading" ||
                    containerStatus[d.name] === "ready") && (
                    <>
                      <Button
                        variant="danger"
                        style={{ marginLeft: "10px" }}
                        onClick={() => handleStop(d.name)}
                        size="sm"
                      >
                        Stop
                      </Button>
                      <Button
                        variant="warning"
                        style={{ marginLeft: "10px" }}
                        onClick={() => handleRestart(d.name)}
                        size="sm"
                      >
                        Restart
                      </Button>
                      <Button
                        variant="info"
                        style={{ marginLeft: "10px" }}
                        onClick={() => handleReset(containerIds[d.name])}
                        size="sm"
                      >
                        Reset
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
