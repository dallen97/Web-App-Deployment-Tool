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

  //Fetch username
  useEffect(() => {
    fetch("wadtapp/api/me/", {
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
      fetch("wadtapp/containers/", {
        credentials: "include"
      })
      .then(res => res.json())
      .then(data => setContainers(data))
      .catch(err => console.error("Failed to fetch containers:", err));
    };

    fetchContainers();

    const interval = setInterval(fetchContainers, 10000); // poll every 10 seconds

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
                imageName: "pygoat/pygoat",
                startlink: "/",
                stoplink: "/",
                restartlink: "/",
              },
              {
                name: "Juice Shop",
                imageName: "bkimminich/juice-shop",
                startlink: "/",
                stoplink: "/",
                restartlink: "/",
              },
              {
                name: "Grafana",
                imageName: "grafana/grafana:8.3.0",
                startlink: "/",
                stoplink: "/",
                restartlink: "/",
              },
              {
                name: "Damn Vulnerable Web App",
                imageName: "vulnerables/web-dvwa",
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
                        Uptime: {container.uptime}<br/>
                        Time left: {container.time_left}
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
