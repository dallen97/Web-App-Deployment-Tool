import { useState } from "react";
import Button from "react-bootstrap/Button";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";

export interface DockerProps {
  name: string;
  startlink: string;
  stoplink: string;
  restartlink: string;
  /** Catalog key for POST /api/start_container/ (e.g. pygoat, juice-shop). */
  appKey: string;
  imageName?: string;
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
  // State to store the dynamic URL (e.g., localhost:55001) once ready
  const [containerUrls, setContainerUrls] = useState<{ [key: string]: string }>(
    {},
  );

  // State to store container ID's for stopping and restarting
  const [containerIds, setContainerIds] = useState<{ [key: string]: string }>(
    {},
  );

  const [startErrors, setStartErrors] = useState<{ [key: string]: string }>({});

  const handleStart = async (appKey: string, containerName: string) => {
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
        let message =
          typeof data?.error === "string" ? data.error : "Could not start container.";
        if (response.status === 403) {
          message =
            typeof data?.error === "string"
              ? data.error
              : "Unknown or unauthorized application.";
        } else if (response.status === 429) {
          message =
            typeof data?.error === "string"
              ? data.error
              : "Container quota exceeded.";
        }
        setStartErrors((prev) => ({ ...prev, [containerName]: message }));
        setContainerStatus((prev) => ({ ...prev, [containerName]: "idle" }));
      }
    } catch (error) {
      console.error("Error:", error);
      setStartErrors((prev) => ({
        ...prev,
        [containerName]: "Network error. Try again.",
      }));
      setContainerStatus((prev) => ({ ...prev, [containerName]: "idle" }));
    }
  };

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
          console.error("!!! FRONTEND 401 DETECTED !!!");
          console.log("Timestamp:", new Date().toISOString());
          console.log("Current Browser Cookies:", document.cookie);
          console.log("Am I trying to send credentials? YES (include)");

          // Stop polling so we don't spam the logs
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
  // 5. Restart Container
  const handleRestart = async (containerName: string) => {
    const containerId = containerIds[containerName];
    if (!containerId) return;
    setContainerStatus((prev) => ({ ...prev, [containerName]: "loading" }));

    try {
      const response = await fetch(
        `/api/restart_container/${containerId}/`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie("wadt_csrftoken") || "",
          },
        },
      );
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
      <div style={{ fontSize: "20px" }}>
        {docker.map((d, i) => (
          <div key={i} style={{ marginTop: "35px" }}>
            {d.name} container
            {/* 1. IDLE STATE: Show Start Button */}
            {(!containerStatus[d.name] ||
              containerStatus[d.name] === "idle") && (
              <Button
                variant="primary"
                onClick={() => handleStart(d.appKey, d.name)}
                style={{ marginLeft: "10px" }}
              >
                Start
              </Button>
            )}
            {/* 2. LOADING STATE: Show Spinner */}
            {containerStatus[d.name] === "loading" && (
              <Button variant="primary" disabled style={{ marginLeft: "10px" }}>
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
            {startErrors[d.name] && (
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
            )}
          </div>
        ))}
        <br />
        <br />
      </div>
    </>
  );
};

export default Docker;
