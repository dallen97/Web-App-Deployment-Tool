import Container from "react-bootstrap/Container";
import Navbar from "react-bootstrap/Navbar";

function Footer() {
  return (
    <Navbar className="navbar" data-bs-theme="dark">
      <Container>
        <Navbar.Brand href="#home" className="small_text">
          Web App Deployment Tool
        </Navbar.Brand>
        <Navbar.Toggle />
        <Navbar.Collapse className="justify-content-end">
          <Navbar.Text className="small_text">
            Contact Information: <a href="#login">contactlink</a>
          </Navbar.Text>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default Footer;
