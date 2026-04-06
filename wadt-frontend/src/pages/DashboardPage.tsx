import { useState, useEffect } from "react";
import Docker from "../components/Docker";
import Footer from "../components/Footer";
import { Container, Row, Col, Button } from "react-bootstrap"

/*
  Things to add:
  - Footer
  - Sidebar
*/

function DashboardContent() {

  const [username, setUsername] = useState<string>("");
  const [containers, setContainers] = useState<any[]>([]);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const formatDuration = (totalSeconds: number) => {
    const clamped = Math.max(0, Math.floor(totalSeconds));
    const days = Math.floor(clamped / 86400);
    const hours = Math.floor((clamped % 86400) / 3600);
    const minutes = Math.floor((clamped % 3600) / 60);
    const seconds = clamped % 60;
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  };

  //Fetch username
  useEffect(() => {
    fetch("/api/current_user/", {
      credentials: "include"
    })
    .then(res => {
        if (!res.ok) throw new Error("Not authenticated");
        return res.json();
      })
      .then(data => setUsername(data.username))
      .catch(() => setUsername("Guest"));
  }, []);

  //Fetch containers
  useEffect(() => {
    const fetchContainers = () => {
      fetch("/api/get_containers/", {
        credentials: "include"
      })
      .then(res => res.json())
      .then(data => setContainers(data))
      .catch(err => console.error("Failed to fetch containers:", err));
    };

    fetchContainers();

    const interval = setInterval(fetchContainers, 10000); // poll every 10 seconds
    const onContainersChanged = () => fetchContainers();
    window.addEventListener("wadt:containers-changed", onContainersChanged);

    return () => {
      clearInterval(interval);
      window.removeEventListener("wadt:containers-changed", onContainersChanged);
    };
  }, []);

  // Live timer tick (UI-only)
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
     <div className="d-flex flex-column min-vh-100">    
      <main className="flex-grow-1">
        <Container
          className="mx-auto"
          style={{ marginTop: "50px" , textAlign: "center"}}
        >
          <h1>Welcome {username}</h1>
          <p>Not you? <a href="/login/">Logout</a></p>
        </Container>

        <Container style={{ marginTop: "50px"}}>
          <Row>
            <Col
            className="border rounded-4 ms-0 p-3 bg-light "
          style={{ marginLeft: "50px"}}
            >
               <h3>Available Containers</h3>
          <Docker
            docker={[
              {
                name: "PyGoat",
                appKey: "pygoat",
                startlink: "/",
                stoplink: "/",
                restartlink: "/",
              },
              {
                name: "Juice Shop",
                appKey: "juice-shop",
                startlink: "/",
                stoplink: "/",
                restartlink: "/",
              },
              {
                name: "Grafana",
                appKey: "grafana",
                startlink: "/",
                stoplink: "/",
                restartlink: "/",
              },
              {
                name: "Damn Vulnerable Web App",
                appKey: "dvwa",
                startlink: "/",
                stoplink: "/",
                restartlink: "/",
              },
            ]}
          />
            </Col>
            <Col
            className="mx-auto"
            style={{minWidth: "10px", maxWidth: "100px"}}>
            
            </Col>
            <Col
            className="border rounded-4 ms-0 p-3 bg-light "
          style={{ marginLeft: "10px"}}
          >
                <h3>Container Status</h3>
                {containers.length > 0 ? (
                  <ul className="list-unstyled">
                    {containers.map((container, index) => (
                      <li key={index} className="mb-3">
                        <strong>{container.name}</strong><br/>
                        {container.started_at ? (
                          (() => {
                            const startedMs = Date.parse(container.started_at);
                            const uptimeSeconds = Number.isFinite(startedMs)
                              ? Math.max(0, (nowMs - startedMs) / 1000)
                              : null;
                            const maxSeconds = typeof container.max_runtime_seconds === "number"
                              ? container.max_runtime_seconds
                              : 86400;
                            const timeLeftSeconds = uptimeSeconds === null ? null : maxSeconds - uptimeSeconds;
                            return (
                              <>
                                Uptime: {uptimeSeconds === null ? container.uptime : formatDuration(uptimeSeconds)}<br/>
                                Time left: {timeLeftSeconds === null ? container.time_left : (timeLeftSeconds <= 0 ? "Expired" : formatDuration(timeLeftSeconds))}
                              </>
                            );
                          })()
                        ) : (
                          <>
                            Uptime: {container.uptime}<br/>
                            Time left: {container.time_left}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No running containers.</p>
                )}
            </Col>
            
          </Row>
        </Container>
      </main>      
    </div>
  );
}

export default DashboardContent;
