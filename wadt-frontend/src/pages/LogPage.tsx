import ContainerDropdown from "../components/ContainerDropdown";
import { Card, Button, Spinner } from "react-bootstrap";
import { useState, useEffect } from "react";

/* TODO: 
    Clear logs button -> make it actually do something
    Make look better
    Search bar
    add button for redirect back to dashboard from log page
    Try to test errors
    Redirect back to dashboard button
    */
// track running containers
interface ContainerInfo {
  id: string;
  name: string;
  url: string | null;
  terminal_url?: string | null;
}

function LogPage() {
  // states
  const [runningContainers, setRunningContainers] = useState<ContainerInfo[]>(
    [],
  );
  const [currentContainer, setCurrentContainer] =
    useState<ContainerInfo | null>(null);
  const [logs, setLogs] = useState<
    { timestamp: string; source: string; message: string }[]
  >([]); // log messages
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<string>("ALL"); // Filter for logs

  // Dashboard manages multiple contaners, just need to manage 1 at a time for logs
  // Adjusted code from dashboard for single container
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

  // Call API for stopping container
  const handleStop = async () => {
    if (!currentContainer) return;
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/stop_container/${currentContainer.id}/`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie("wadt_csrftoken") || "",
          },
        },
      );
      if (response.ok) {
        // Update action buttons when container stopped
        setCurrentContainer(null);
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date().toISOString(),
            source: "SYSTEM",
            message: `Container ${currentContainer.name} was stopped.`,
          },
        ]);
        setCurrentContainer(null);
        window.dispatchEvent(new Event("wadt:containers-changed"));
      } else console.error("Failed to stop container");
    } catch (err) {
      console.error("Error stopping container:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Call api for reset container
  const handleReset = async () => {
    if (!currentContainer) return;
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/reset_container/${currentContainer.id}/`,
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
        // Update currentContainer with the new id (might not be needed)
        setCurrentContainer((prev) =>
          prev ? { ...prev, id: data.new_id } : null,
        );
        window.dispatchEvent(new Event("wadt:containers-changed")); //update dashboard
        const data = await response.json();
      } else console.error("Failed to reset container:", data.error);
    } catch (err) {
      console.error("Error resetting container:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Call API for restarting container
  const handleRestart = async () => {
    if (!currentContainer) return;
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/restart_container/${currentContainer.id}/`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie("wadt_csrftoken") || "",
          },
        },
      );
      if (response.ok)
        window.dispatchEvent(new Event("wadt:containers-changed")); //update dashboard
      else console.error("Failed to restart container");
    } catch (err) {
      console.error("Error restarting container:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Get list of running containers when opening page
  useEffect(() => {
    const refresh = () => {
      fetch("/api/get_containers/", { credentials: "include" })
        .then((res) => res.json())
        .then((data) => {
          const containers = data
            // ALLOW 'starting' status through to the UI
            .filter(
              (c: any) => c.status === "running" || c.status === "starting",
            )
            .map((c: any) => ({
              id: c.id,
              name: c.name,
              image: c.image,
              url: c.external_url ?? null,
              terminal_url: c.terminal_url ?? null,
            }));

          setRunningContainers(containers);

          const urlParams = new URLSearchParams(window.location.search);
          const targetContainerId = urlParams.get("container");

          setCurrentContainer(
            (prev) =>
              containers.find(
                (c: ContainerInfo) => c.id === targetContainerId,
              ) ??
              containers.find((c: ContainerInfo) => c.id === prev?.id) ??
              containers[0] ??
              null,
          );
        })
        .catch((err) => console.error("Failed to fetch containers:", err));
    };

    refresh();

    // NEW: Poll every 5 seconds so the buttons unlock automatically!
    const intervalId = setInterval(refresh, 5000);
    window.addEventListener("wadt:containers-changed", refresh);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("wadt:containers-changed", refresh);
    };
  }, []);

  // Log filtering
  const filteredLogs = (
    activeFilter === "ALL"
      ? logs
      : logs.filter((log) => log.source === activeFilter)
  )
    .slice()
    .reverse();

  // update logs when current container changes
  useEffect(() => {
    if (!currentContainer) return;

    // fetch logs immediately when container is selected
    const fetchLogs = () => {
      fetch(`/api/get_container_logs/${currentContainer.id}/`, {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) =>
          setLogs(
            (data.logs ?? [])
              .filter((log: any) => log.message.trim() !== "") // Hide empty logs
              .filter((log: any) => !log.message.includes("was stopped.")) // remove duplicate stopped message
              // Apply filter for finding errors in logs
              .map((log: any) => ({
                ...log,
                source:
                  log.message.toLowerCase().includes("error") ||
                  log.message.toLowerCase().includes("exception") ||
                  log.message.toLowerCase().includes("fatal")
                    ? "ERROR"
                    : log.source,
              })),
          ),
        );
    };

    fetchLogs();
    const intervalId = setInterval(fetchLogs, 5000); // update every 5 seconds

    return () => clearInterval(intervalId); // stop  when container changes
  }, [currentContainer]);

  return (
    // Header card
    <>
      <Card>
        <Card.Body
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {/* Filter buttons */}
          <div style={{ display: "flex", gap: "10px" }}>
            {["ALL", "SYSTEM", "CONTAINER", "ERROR"].map((filter) => (
              <Button
                key={filter}
                variant={
                  activeFilter === filter ? "primary" : "outline-secondary"
                }
                onClick={() => setActiveFilter(filter)}
              >
                {filter === "ALL"
                  ? "All Logs"
                  : filter.charAt(0) + filter.slice(1).toLowerCase()}
              </Button>
            ))}
          </div>
          {/* Search bar */}
          <div
            style={{
              display: "flex",
              gap: "10px",
              flex: 1,
              maxWidth: "700px",
              marginLeft: "20px",
            }}
          >
            <Button
              variant="outline-secondary"
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <input
                type="text"
                placeholder="Search logs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  flex: 1,
                  color: "var(--bs-secondary-color)",
                }}
              />
            </Button>

            {/* Clear search button */}
            <Button
              variant="outline-secondary"
              onClick={() => setSearchQuery("")}
            >
              Clear Search
            </Button>
          </div>
        </Card.Body>
      </Card>
      {/* Second card with stop, restart, reset and clear logs buttons */}
      <Card className="mt-2">
        <Card.Body
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {!currentContainer ? (
            <span style={{ color: "gray", fontStyle: "italic" }}>
              Select a container to see actions
            </span>
          ) : (
            <div style={{ display: "flex", gap: "10px" }}>
              {/* Loading spinner */}
              {isLoading && (
                <Button variant="primary" disabled>
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
              {/* Stop button */}
              <Button
                variant="danger"
                disabled={isLoading}
                onClick={handleStop}
              >
                Stop
              </Button>
              {/* Reset button */}
              <Button variant="info" disabled={isLoading} onClick={handleReset}>
                Reset
              </Button>
              {/* Restart button*/}
              <Button
                variant="warning"
                disabled={isLoading}
                onClick={handleRestart}
              >
                Restart
              </Button>
            </div>
          )}
          {/* Clear Logs, Open app, Open Terminal buttons */}
          <div style={{ display: "flex", gap: "10px" }}>
            <Button
              variant={currentContainer?.url ? "success" : "secondary"}
              disabled={!currentContainer?.url}
              onClick={() => {
                if (currentContainer?.url)
                  window.open(currentContainer.url, "_blank");
              }}
            >
              {currentContainer?.url ? "Open App" : "App Starting..."}
            </Button>

            <Button
              variant="dark"
              disabled={!currentContainer?.terminal_url}
              onClick={() => {
                if (currentContainer?.terminal_url)
                  window.open(currentContainer.terminal_url, "_blank");
              }}
            >
              {currentContainer?.terminal_url
                ? "Terminal"
                : "Terminal Starting..."}
            </Button>

            <Button variant="outline-secondary">Clear Logs</Button>
          </div>
        </Card.Body>
      </Card>
      {/* Thrid Card with search bar*/}

      {/*Fourth Card with Filter for types of logs*/}
      {/* TODO: Implement error button */}
      <Card className="mt-2">
        <Card.Body
          style={{
            display: "flex",
            gap: "10px",
          }}
        >
          {["ALL", "SYSTEM", "CONTAINER", "ERROR", "TERMINAL"].map((filter) => (
            <Button
              key={filter}
              variant={
                activeFilter === filter ? "primary" : "outline-secondary"
              }
              disabled={filter === "ERROR"}
              onClick={() => setActiveFilter(filter)}
              style={{ opacity: filter === "ERROR" ? 0.5 : 1 }}
            >
              {filter === "ALL"
                ? "All Logs"
                : filter.charAt(0) + filter.slice(1).toLowerCase()}
            </Button>
          ))}
        </Card.Body>
      </Card>

      {/* Fifth Card The actual logs */}
      <Card className="mt-2">
        <Card.Body>
          {filteredLogs.length === 0 ? (
            <span style={{ color: "gray", fontStyle: "italic" }}>
              No logs to display
            </span>
          ) : (
            filteredLogs.map((log, i) => (
              <div
                key={i}
                style={{
                  marginBottom: "15px",
                  padding: "10px",
                  borderRadius: "5px",
                  backgroundColor:
                    log.source === "ERROR" ? "#2d0000" : "transparent",
                  border: "2px solid #333",
                }}
              >
                {/* Box and timestamp */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "5px",
                  }}
                >
                  <span
                    style={{
                      backgroundColor:
                        log.source === "SYSTEM"
                          ? "#0d6efd"
                          : log.source === "TERMINAL"
                            ? "#212529"
                            : "#198754",
                      color: "white",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "0.8rem",
                      fontWeight: "bold",
                    }}
                  >
                    {log.source}
                  </span>
                  <span style={{ color: "gray", fontSize: "0.85rem" }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {/* Message */}
                <div style={{ fontSize: "0.9rem" }}>{log.message}</div>
              </div>
            ))
          )}
        </Card.Body>
      </Card>
    </>
  );
}
export default LogPage;
