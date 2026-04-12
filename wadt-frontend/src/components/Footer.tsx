import Container from "react-bootstrap/Container";
import Navbar from "react-bootstrap/Navbar";

function Footer() {
  return (
    <Navbar className="navbar" data-bs-theme="dark">
      <Container>
        <Navbar.Brand className="small_text">
          Web App Deployment Tool
        </Navbar.Brand>
        <Navbar.Toggle />
      </Container>
    </Navbar>
  );
}

export default Footer;
