import {Col, Button, Accordion} from 'react-bootstrap';




function Sidebar() {
 return (
    <Col
      xs={2}
      style={{
        transition: "all 0.3s ease",
        overflow: "hidden",
        background: "#00000049",
        borderRight: "1px solid rgb(255, 255, 255)",
        minHeight: "100vh"
      }}
    >
        
        <div className="p-3 text-light">
          <h5>Dashboard</h5>

          <Accordion flush alwaysOpen>

            <Accordion.Item eventKey="2">
              <Accordion.Header>Documentation</Accordion.Header>
              <Accordion.Body>
                <div className="d-grid gap-2">
                    <Button variant="outline-light" size="sm" style={{color: "white"}}>
                    Instructions
                  </Button>
                  <Button variant="outline-light" size="sm" style={{color: "white"}}>
                    Terms of Service
                  </Button>
                </div>
              </Accordion.Body>
            </Accordion.Item>

            <Accordion.Item eventKey="1">
              <Accordion.Header>Account</Accordion.Header>
              <Accordion.Body>
                <Button variant="outline-danger" size="sm">
                  Logout
                </Button>
              </Accordion.Body>
            </Accordion.Item>

          </Accordion>
        </div>
    </Col>
  );
};

export default Sidebar;