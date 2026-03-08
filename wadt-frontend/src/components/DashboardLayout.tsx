import { Container, Row } from "react-bootstrap";
import DashboardContent from "../pages/DashboardPage";

// Plan to Add sidebar at a later stage

const DashboardLayout = () => {

  return (
    <Container fluid style={{ padding: 0 }}>
      <Row className="g-0">
        <DashboardContent />
      </Row>
    </Container>
  );
};

export default DashboardLayout;