import Docker from "../components/Docker";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { Container } from "react-bootstrap";

const HeaderComponent = Header as unknown as React.ComponentType<any>;

function DashboardPage() {
  return (
    <div className="d-flex flex-column min-vh-100">
      <HeaderComponent buttons={[{ text: "Account", link: "/account" }]} />
      <main className="flex-grow-1">
        <Container
          className="mx-auto"
          style={{ textAlign: "center", marginTop: "50px" }}
        >
          <h1>Welcome User!</h1>
        </Container>

        <Container
          className="border rounded-4 mx-auto p-3 bg-light "
          style={{ maxWidth: 650, marginTop: "100px" }}
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
        </Container>
      </main>
      <Footer />
    </div>
  );
}

export default DashboardPage;
