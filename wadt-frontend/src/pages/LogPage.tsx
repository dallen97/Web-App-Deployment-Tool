import ContainerDropdown from "../components/ContainerDropdown";
import {Card, Button, Spinner, Badge, ListGroup} from 'react-bootstrap';
import {useState, useEffect} from 'react';
import { useParams, useNavigate } from "react-router-dom";

// track running containers
interface ContainerInfo 
{
    id: string;
    name: string;
    url: string | null;
    terminal_url?: string | null;
}

function LogPage(){

  // states
  const [runningContainers, setRunningContainers] = useState<ContainerInfo[]>([]);
  const [currentContainer, setCurrentContainer] = useState<ContainerInfo | null>(null);
  const [logs, setLogs] = useState<{timestamp: string; source: string; message: string}[]>([]); // log messages
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<string>("ALL"); // Filter for logs
  const [searchQuery, setSearchQuery] = useState<string>(""); // Search bar query
  const [logCache, setLogCache] = useState<{[id: string]: {timestamp: string; source: string; message: string}[]}>({}); // cache of logs incase they were stopped


  const { id: selectedContainerId } = useParams(); // Track selected container from dashboard
  const navigate = useNavigate();

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
      const response = await fetch(`/api/stop_container/${currentContainer.id}/`, {
          method: "POST",
          credentials: "include",
          headers: {
              "Content-Type": "application/json",
              "X-CSRFToken": getCookie("wadt_csrftoken") || "",
          },
      });
        if (response.ok) {
            // CHANGED: write stopped message into cache for this container
            setLogCache(prev => ({
                ...prev,
                [currentContainer.id]: [
                    ...(prev[currentContainer.id] ?? []),
                    {
                        timestamp: new Date().toISOString(),
                        source: "SYSTEM",
                        message: `Container ${currentContainer.name} was stopped.`
                    }
                ]
            }));
            window.dispatchEvent(new Event("wadt:containers-changed"));
        }
        else 
          console.error("Failed to stop container");
      
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
          const response = await fetch(`/api/reset_container/${currentContainer.id}/`, {
              method: "POST",
              credentials: "include",
              headers: {
                  "Content-Type": "application/json",
                  "X-CSRFToken": getCookie("wadt_csrftoken") || "",
              },
          });
          const data = await response.json();
          if (response.ok) {
              // Update currentContainer with the new id (might not be needed)
              setCurrentContainer(prev => prev ? { ...prev, id: data.new_id } : null);
              window.dispatchEvent(new Event("wadt:containers-changed")); //update dashboard
          } 
          else 
              console.error("Failed to reset container:", data.error);    
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
          const response = await fetch(`/api/restart_container/${currentContainer.id}/`, {
              method: "POST",
              credentials: "include",
              headers: {
                  "Content-Type": "application/json",
                  "X-CSRFToken": getCookie("wadt_csrftoken") || "",
              },
          });
          if (response.ok) 
              window.dispatchEvent(new Event("wadt:containers-changed")); //update dashboard
          else 
              console.error("Failed to restart container");
      } catch (err) {
          console.error("Error restarting container:", err);
      } finally {
          setIsLoading(false);
      }
  };

  // Default to chosen container from dashboard
  useEffect(() => {
      if (!selectedContainerId || runningContainers.length === 0) 
          return;

      const selected = runningContainers.find(c => c.id === selectedContainerId);
      if (selected)
          setCurrentContainer(selected);
      }, [selectedContainerId, runningContainers]);

  // Get list of running containers when opening page
  useEffect(() => {
      const refresh = ()=>{
          fetch("/api/get_containers/", { credentials: "include" })
          .then(res => res.json())
          .then(data => {
              const containers = data
              // ALLOW 'starting' status through to the UI
              .filter((c: any) => c.status === "running" || c.status === "starting")
              .map((c: any) => ({ 
                  id: c.id, 
                  name: c.name, 
                  image: c.image, 
                  url: c.external_url ?? null,
                  terminal_url: c.terminal_url ?? null 
              }));
              
              setRunningContainers(containers);
              // Default if not redirecting from dashboard page link
              if (!selectedContainerId) 
                  setCurrentContainer(containers[0] ?? null);
          })
          .catch(err => console.error("Failed to fetch containers:", err));
      };

      refresh();
      
      // NEW: Poll every 5 seconds so the buttons unlock automatically!
      const intervalId = setInterval(refresh, 5000); 
      window.addEventListener("wadt:containers-changed", refresh); 
      
      return () => {
          clearInterval(intervalId);
          window.removeEventListener("wadt:containers-changed", refresh); 
      }
  }, []);

  // Log filtering
  const currentLogs = logCache[currentContainer?.id ?? ""] ?? []
  const filteredLogs = (activeFilter === "ALL" ? currentLogs :
      logs.filter(log => log.source === activeFilter))
  .filter(log => searchQuery === "" || log.message.toLowerCase().includes(searchQuery.toLowerCase()))
  .slice().reverse();

      // fetch logs immediately when container is selected
      useEffect(() => {
    if (!currentContainer) return;

    const fetchLogs = () => {
        fetch(`/api/get_container_logs/${currentContainer.id}/`, { credentials: "include" })
        .then(res => res.json())
        .then(data => {
            const processedLogs = (data.logs ?? [])
                .filter((log: any) => log.message.trim() !== "")
                .filter((log: any) => !log.message.includes("was stopped."))
                .map((log: any) => ({
                    ...log,
                    source: log.message.toLowerCase().includes("error") || 
                            log.message.toLowerCase().includes("exception") || 
                            log.message.toLowerCase().includes("fatal") ? "ERROR" : log.source
                }));
            // save to cache
            setLogCache(prev => ({ ...prev, [currentContainer.id]: processedLogs }));
        });
    };

    fetchLogs();
    const intervalId = setInterval(fetchLogs, 5000);
    return () => clearInterval(intervalId);
}, [currentContainer])

  return (
  // Back to dashboard, Title, Container dropwdown
  <>
  <div className="containers_card" style ={{padding: "1vh"}}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Button style ={{fontFamily: "Exo2"}}variant="outline-primary" onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>

        <h2 className="card-title">
            Container Logs
        </h2>

        <ContainerDropdown
            runningContainers={runningContainers.map(c => c.name)}
            currentContainer={currentContainer?.name ?? null}
            setCurrentContainer={(name) => {
                const findContainer = runningContainers.find(c => c.name === name) ?? null;
                setCurrentContainer(findContainer);
            }}/>
    </div>
  </div>

  {/* Second card with stop, restart, reset and clear logs buttons */}
  <div className="containers_card" style ={{padding: "1vh"}}>
      <div style={{display: "flex",justifyContent: "space-between", alignItems: "center", height: "100%"}}>
          {!currentContainer ? (
              <span style={{color: "white", fontStyle: "italic"}}>
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
                  {/* Stop, Reset, Restart buttons, terminal */}
                  <div style = {{display: "flex", gap: "10px"}}>
                      <Button variant="danger" disabled={isLoading} onClick={handleStop}>Stop</Button>
                      <Button variant="info" disabled={isLoading} onClick={handleReset}>Reset</Button>
                      <Button variant="warning" disabled={isLoading} onClick={handleRestart}>Restart</Button>
                  </div>
              </div>
          )}
          {/* Open app buttons when restart chosen*/}
          <div style={{ display: "flex", gap: "10px" }}>
            {currentContainer && (
              <>
                <Button
                    variant={currentContainer.url ? "success" : "secondary"}
                    disabled={!currentContainer.url}
                    onClick={() => { if (currentContainer.url) window.open(currentContainer.url, "_blank"); }}>
                    {currentContainer.url ? "Open App" : "App Starting..."}
                </Button>

                <Button
                    variant="dark"
                    disabled={!currentContainer.terminal_url}
                    onClick={() => { if (currentContainer.terminal_url) window.open(currentContainer.terminal_url, "_blank"); }}>
                    {currentContainer.terminal_url ? "Terminal" : "Terminal Starting..."}
                </Button>
            </>
           )}

              <Button variant="outline-secondary">
                  Clear Logs
              </Button>
          </div>
      </div>
  </div>

  {/* Filter + search card */}
  <div className="containers_card mt-0" style={{ padding: "1vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "10px" }}>
              {["ALL", "SYSTEM", "CONTAINER", "ERROR", "TERMINAL"].map((filter) => (
            <Button
                key={filter}
                variant={activeFilter === filter ? "primary" : "outline-secondary"}
                style={activeFilter === filter ? {
                    backgroundColor: "var(--secondary-theme1)",
                    borderColor: "var(--secondary-theme1)",
                } : {}}
                onClick={() => setActiveFilter(filter)}>
                {filter === "ALL" ? "All Logs" : filter.charAt(0) + filter.slice(1).toLowerCase()}
            </Button>
              ))}
          </div>
          <div style={{ display: "flex", gap: "10px", flex: 1, maxWidth: "700px", marginLeft: "20px" }}>
              <Button variant="outline-secondary"
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <input
                      type="text"
                      placeholder="Search logs"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ border: "none", outline: "none", background: "transparent", flex: 1, color: "var(--bs-secondary-color)" }}
                  />
              </Button>
              <Button variant="outline-secondary" onClick={() => setSearchQuery("")}>
                  Clear Search
              </Button>
          </div>
      </div>
  </div>

  {/* Logs card */}
  <div className="containers_card mt-0" style={{ padding: "1vh", minHeight: "200px" }}>
      {filteredLogs.length === 0 ? (
        <span style={{color: "white", fontStyle: "italic"}}>
            No logs to display
        </span>
      ) : (
          <ListGroup>
              {filteredLogs.map((log, i) => (
                  <ListGroup.Item
                      key={i}
                      variant={log.source === "ERROR" ? "danger" : undefined}
                      style={{ backgroundColor: "rgb(10,10,10)", color: "white", borderColor: "rgba(36, 150, 237, 0.2)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "5px" }}>
                          <Badge bg={
                              log.source === "SYSTEM" ? "primary"
                              : log.source === "CONTAINER" ? "success"
                              : log.source === "ERROR" ? "danger"
                              : "secondary"}>
                              {log.source}
                          </Badge>
                          <span style={{ color: "gray", fontSize: "0.85rem" }}>
                              {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                      </div>
                      <div style={{ fontSize: "0.9rem" }}>
                          {log.message}
                      </div>
                  </ListGroup.Item>
              ))}
          </ListGroup>
      )}
  </div>
  </>        
  );        
}    
export default LogPage;

