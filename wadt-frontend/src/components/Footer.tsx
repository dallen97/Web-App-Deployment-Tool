import Container from "react-bootstrap/Container";
import Navbar from "react-bootstrap/Navbar";

function Footer() {
  return (
    <Navbar className="navbar navbar-expand-lg bg-dark" data-bs-theme="dark">
      <Container>
        <Navbar.Brand href="#home">Web App Deployment Tool</Navbar.Brand>
        <Navbar.Toggle />
        <Navbar.Collapse className="justify-content-end">
          <Navbar.Text>
            Contact Information: <a href="#login">contactlink</a>
          </Navbar.Text>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default Footer;