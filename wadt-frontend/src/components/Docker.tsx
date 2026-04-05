import { useEffect, useState } from "react";
import Spinner from "react-bootstrap/Spinner";
import { Container, Row, Col, Button, Table } from "react-bootstrap";
import DashboardPage from "../pages/DashboardPage";

export interface DockerProps {
  name: string;
  startlink: string;
  stoplink: string;
  restartlink: string;
  imageName: string;
  runningContainers: string;
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

  // State to store container ID's for stopping and restarting
  const [containerIds, setContainerIds] = useState<{ [key: string]: string }>(
    {},
  );

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
        }>;

        for (const c of data) {
          if (!c?.name || !c?.id) continue;

          setContainerIds((prev) => ({ ...prev, [c.name]: c.id }));

          if (c.external_url) {
            setContainerUrls((prev) => ({
              ...prev,
              [c.name]: c.external_url as string,
            }));
            setContainerStatus((prev) => ({ ...prev, [c.name]: "ready" }));
          } else if (c.status === "running") {
            // Container is running but URL isn't ready yet; reuse readiness polling
            setContainerStatus((prev) => ({ ...prev, [c.name]: "loading" }));
            pollForReadiness(c.id, c.name);
          }
        }
      } catch {
        // ignore (user may be logged out or backend down)
      }
    };

    hydrateRunningContainers();
    // Only run on mount; state updates happen via setters above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ITEM: useEffect case for watching if containers are still running after admin shuts them down
  useEffect(() => {
    docker.forEach((d) => {
      setContainerStatus((prev) => {
        if (
          d.runningContainers !== "running" &&
          (prev[d.name] === "ready" || prev[d.name] === "loading")
        ) {
          setContainerUrls((prevUrls) => {
            const updated = { ...prevUrls };
            delete updated[d.name];
            return updated;
          });
          return { ...prev, [d.name]: "idle" };
        }
        return prev;
      });
    });
  }, [docker]);

  // 1. Start Container
  const handleStart = async (imageName: string, containerName: string) => {
    // Immediately show spinner
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
          imageName: imageName,
          name: containerName,
        }),
      });

      const data = await response.json();

      if (response.ok && data.id) {
        console.log("Container started, waiting for port...", data.id);
        window.dispatchEvent(new Event("wadt:containers-changed"));
        // Begin polling the new endpoint to see when the port is open
        pollForReadiness(data.id, containerName);
        // Store the container ID on start
        setContainerIds((prev) => ({ ...prev, [containerName]: data.id }));
      } else {
        console.error("Start failed:", data);
        // Reset to start button on failure
        setContainerStatus((prev) => ({ ...prev, [containerName]: "idle" }));
      }
    } catch (error) {
      console.error("Error: ", error);
      setContainerStatus((prev) => ({ ...prev, [containerName]: "idle" }));
    }
  };

  // 2. Poll for Readiness (The "Health Check")
  const pollForReadiness = (containerId: string, containerName: string) => {
    const intervalId = setInterval(async () => {
      try {
        // Using the new RESTful URL structure: containers/<id>/check-ready/
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
          console.error("!!! FRONTEND 401 DETECTED !!!");
          console.log("Timestamp:", new Date().toISOString());
          console.log("Current Browser Cookies:", document.cookie);
          console.log("Am I trying to send credentials? YES (include)");

          // Stop polling so we don't spam the logs
          clearInterval(intervalId);
          setContainerStatus((prev) => ({ ...prev, [containerName]: "idle" }));
          return;
        }

        const data = await response.json();

        if (data.ready) {
          console.log("Container is ready at:", data.url);
          clearInterval(intervalId); // Stop checking
          setContainerUrls((prev) => ({ ...prev, [containerName]: data.url }));
          setContainerStatus((prev) => ({ ...prev, [containerName]: "ready" }));
        }
        // If data.ready is false, the loop simply continues...
      } catch (error) {
        console.error("Polling error", error);
        clearInterval(intervalId); // Stop checking on network error
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

  return (
    <>
      <div style={{ fontSize: "20px", color: "rgb(0, 170, 255)" }}>
        {docker.map((d, i) => (
          <div key={i} style={{ marginTop: "35px" }}>
            <Table></Table>
            <Container className="mb-3">
              <Row className="align-items-center">
                <Col>
                  <strong>{d.name} container</strong>
                </Col>

                <Col className="text-end">
                  {/* 1. IDLE STATE: Show Start Button */}
                  {(!containerStatus[d.name] ||
                    containerStatus[d.name] === "idle") && (
                    <Button
                      variant="primary"
                      onClick={() => handleStart(d.imageName, d.name)}
                      style={{ marginLeft: "0px" }}
                    >
                      Start
                    </Button>
                  )}
                  {/* 2. LOADING STATE: Show Spinner */}
                  {containerStatus[d.name] === "loading" && (
                    <Button
                      variant="primary"
                      disabled
                      style={{ marginLeft: "10px" }}
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
                  )}
                  {/* 3. READY STATE: Show Open App Button */}
                  {containerStatus[d.name] === "ready" && (
                    <Button
                      variant="success"
                      onClick={() => handleView(d.name)}
                      style={{ marginLeft: "10px" }}
                    >
                      Open App
                    </Button>
                  )}
                  {/* Stop Container*/}
                  <Button
                    variant="danger"
                    onClick={() => handleStop(d.name)}
                    style={{ marginLeft: "10px" }}
                  >
                    Stop
                  </Button>
                  {/*Restart Contaienr*/}
                  <Button
                    variant="warning"
                    onClick={() => handleRestart(d.name)}
                    style={{ marginLeft: "10px" }}
                  >
                    Restart
                  </Button>
                </Col>
              </Row>
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
