import { Container, Row } from "react-bootstrap";
import Sidebar from "./Sidebar";
import DashboardContent from "../pages/DashboardPage";

const DashboardLayout = () => {

  return (
    <Container fluid style={{ padding: 0 }}>
      <Row className="g-0">
        <Sidebar/>
        <DashboardContent />
      </Row>
    </Container>
  );
};

export default DashboardLayout;