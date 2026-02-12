import { useState, useEffect } from "react";
import Docker from "../components/Docker";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { Container, Row, Col } from "react-bootstrap"

const HeaderComponent = Header as unknown as React.ComponentType<any>;



function DashboardPage() {

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
    <div className="d-flex flex-column min-vh-100">
      <HeaderComponent buttons={[{ text: "Account", link: "/account" }]} />
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
                name: "Damn Vulnerable Web App",
                imageName: "vulnerables/web-dvwa",
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

                <p>Still In Development</p>
            </Col>
            
          </Row>
          
        </Container>
      </main>
      <Footer />
    </div>
  );
}

export default DashboardPage;
