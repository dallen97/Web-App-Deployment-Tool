import { useState, useEffect } from "react";
import Docker from "../components/Docker";
import Footer from "../components/Footer";
import Header from "../components/Header";
import { Container, Row, Col, Button } from "react-bootstrap";
import { Link } from "react-router-dom";

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
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Not authenticated");
        return res.json();
      })
      .then((data) => setUsername(data.username))
      .catch(() => setUsername("Guest"));
  }, []);

  //Fetch containers
  useEffect(() => {
    const fetchContainers = () => {
      fetch("/api/get_containers/", {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => setContainers(data))
        .catch((err) => console.error("Failed to fetch containers:", err));
    };

    fetchContainers();

    const interval = setInterval(fetchContainers, 10000); // poll every 10 seconds
    const onContainersChanged = () => fetchContainers();
    window.addEventListener("wadt:containers-changed", onContainersChanged);

    return () => {
      clearInterval(interval);
      window.removeEventListener(
        "wadt:containers-changed",
        onContainersChanged,
      );
    };
  }, []);

  // Live timer tick (UI-only)
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="d-flex flex-column min-vh-100">
      <Header
        buttons={[
          { link: "#", text: `Welcome, ${username}`, isText: true },
          { link: "/login/", text: "Logout" },
        ]}
        align="left"
      />
      <main className="flex-grow-1">
        {/* <Form onSubmit={joinOrg}>
          <InputGroup>
            <Form.Control
              onChange={(e) => setOrgCode(e.target.value)}
            ></Form.Control>
          </InputGroup>
        </Form>*/}
        <Container
          className="mx-auto"
          style={{ marginTop: "25px", textAlign: "center" }}
        >
          <p className="small_text">User Dashboard</p>
          <h1>
            Welcome{" "}
            <span style={{ color: "var(--primary-theme1)" }}>{username}</span>
          </h1>
        </Container>

        <Container style={{ marginTop: "50px", marginBottom: "50px" }}>
          <Row>
            <Col className="containers_card" style={{ marginLeft: "50px" }}>
              <h4
                className="card-title d-flex justify-content-center align-center"
                style={{ marginTop: "10px" }}
              >
                Available Containers
              </h4>
              <hr
                style={{ width: "100%", margin: "16px auto", padding: "0" }}
              />
              <Docker
                docker={[
                  {
                    name: "PyGoat",
                    appKey: "pygoat",
                    startlink: "/",
                    stoplink: "/",
                    restartlink: "/",
                    runningContainers:
                      containers.find((c) => c.name === "PyGoat")?.status ??
                      "idle",
                  },
                  {
                    name: "Juice Shop",
                    appKey: "juice-shop",
                    startlink: "/",
                    stoplink: "/",
                    restartlink: "/",
                    runningContainers:
                      containers.find((c) => c.name === "Juice Shop")?.status ??
                      "idle",
                  },
                  {
                    name: "Grafana",
                    appKey: "grafana",
                    startlink: "/",
                    stoplink: "/",
                    restartlink: "/",
                    runningContainers:
                      containers.find((c) => c.name === "Grafana")?.status ??
                      "idle",
                  },
                  {
                    name: "DVWA",
                    appKey: "dvwa",
                    startlink: "/",
                    stoplink: "/",
                    restartlink: "/",
                    runningContainers:
                      containers.find((c) => c.name === "DVWA")?.status ??
                      "idle",
                  },
                  {
                    name: "Apache Struts",
                    appKey: "apache-struts",
                    startlink: "/",
                    stoplink: "/",
                    restartlink: "/",
                    runningContainers:
                      containers.find((c) => c.name === "apache-struts")
                        ?.status ?? "idle",
                  },
                  {
                    name: "Shellshock",
                    appKey: "shellshock",
                    startlink: "/",
                    stoplink: "/",
                    restartlink: "/",
                    runningContainers:
                      containers.find((c) => c.name === "shellshock")?.status ??
                      "idle",
                  },
                  {
                    name: "Tiredful API",
                    appKey: "tiredful-api",
                    startlink: "/",
                    stoplink: "/",
                    restartlink: "/",
                    runningContainers:
                      containers.find((c) => c.name === "shellshock")?.status ??
                      "idle",
                  },
                ]}
              />
            </Col>
            <Col
              className="mx-auto"
              style={{ minWidth: "10px", maxWidth: "100px" }}
            ></Col>
            <Col className="containers_card" style={{ marginLeft: "10px" }}>
              <h4
                className="card-title d-flex justify-content-center align-center"
                style={{ marginTop: "10px" }}
              >
                Container Status
              </h4>
              <hr />
              {containers.length > 0 ? (
                <ul className="list-unstyled">
                  {containers.map((container, index) => (
                    <li key={index} className="mb-3">
                      <strong>{container.name}</strong>
                      <Link to={`/logs/${container.id}`}>
                        {" "}
                        <strong> View Logs</strong>
                      </Link>
                      <br />
                      {container.started_at ? (
                        (() => {
                          const startedMs = Date.parse(container.started_at);
                          const uptimeSeconds = Number.isFinite(startedMs)
                            ? Math.max(0, (nowMs - startedMs) / 1000)
                            : null;
                          const maxSeconds =
                            typeof container.max_runtime_seconds === "number"
                              ? container.max_runtime_seconds
                              : 86400;
                          const timeLeftSeconds =
                            uptimeSeconds === null
                              ? null
                              : maxSeconds - uptimeSeconds;
                          return (
                            <>
                              Uptime:{" "}
                              {uptimeSeconds === null
                                ? container.uptime
                                : formatDuration(uptimeSeconds)}
                              <br />
                              Time left:{" "}
                              {timeLeftSeconds === null
                                ? container.time_left
                                : timeLeftSeconds <= 0
                                  ? "Expired"
                                  : formatDuration(timeLeftSeconds)}
                            </>
                          );
                        })()
                      ) : (
                        <>
                          Uptime: {container.uptime}
                          <br />
                          Time left: {container.time_left}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p
                  className="small_text d-flex justify-content-center align-center"
                  style={{ marginTop: "25px" }}
                >
                  No running containers.
                </p>
              )}
            </Col>
          </Row>
        </Container>
      </main>
      <Footer></Footer>
    </div>
  );
}

export default DashboardContent;
