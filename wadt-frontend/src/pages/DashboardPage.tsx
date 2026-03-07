import { useState, useEffect } from "react";
import Docker from "../components/Docker";
import Footer from "../components/Footer";
import { Container, Row, Col, Button } from "react-bootstrap"


function DashboardContent() {

  const [username, setUsername] = useState<string>("");

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

  return (

    <Col
      xs={10}
      style={{ transition: "all 0.3s ease" }}
    >
     <div className="d-flex flex-column min-vh-100">    
      <main className="flex-grow-1">
        <Container
          className="mx-auto"
          style={{ marginTop: "50px" , textAlign: "center"}}
        >
          <h1>Welcome {username}</h1>
        </Container>

        <Container style={{ marginTop: "100px"}}>
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
              {
                name: "Bonus Docker",
                imageName: "vulnerables/web-dvwa",
                startlink: "/",
                stoplink: "/",
                restartlink: "/",
              },
              {
                name: "Bonus Docker",
                imageName: "vulnerables/web-dvwa",
                startlink: "/",
                stoplink: "/",
                restartlink: "/",
              },
              {
                name: "Bonus Docker",
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

                <p>Still In Development</p>
            </Col>
            
          </Row>
        </Container>
      </main>
      <Footer />
      
    </div>
     </Col>
  );
}

export default DashboardContent;
