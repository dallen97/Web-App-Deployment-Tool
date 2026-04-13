import { useState, useEffect } from "react";
import {
  Button,
  Offcanvas,
  Form,
  Navbar,
  Badge,
  Spinner,
  Card,
  InputGroup,
} from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import getCookie from "../components/GetCookie";

export default function Sidebar() {
  const navigate = useNavigate();
  const [show, setShow] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [orgCode, setOrgCode] = useState<string>("");
  const [groupName, setGroupName] = useState<string>("");
  const [newGroupName, setNewGroupName] = useState<string>("");
  const [status, setStatus] = useState<string>("none");
  const [showBadge, setShowBadge] = useState(false);
  const [spinner, setSpinner] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const showBadgeTimer = () => {
    setShowBadge(true);
    setTimeout(() => setShowBadge(false), 5000);
  };

  const getCurrentUser = async () => {
    try {
      const response = await fetch("/api/current_user/", {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("wadt_csrftoken") || "",
        },
      });
      return await response.json();
    } catch (error) {
      return null;
    }
  };

  const joinOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setSpinner(true);
    try {
      const response = await fetch("/api/join_organization/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("wadt_csrftoken") || "",
          credentials: "include",
        },
        body: JSON.stringify({ org_code: orgCode }),
      });
      const data = await response.json();
      if (data.status === "success") {
        setStatus("success");
        setGroupName(data.organization_name);
      } else {
        setStatus("failed");
      }
      setSpinner(false);
      showBadgeTimer(); // trigger badge after every submit
    } catch (error) {
      setSpinner(false);
      setStatus("failed");
    }
  };

  const leaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setSpinner(true);
    const response = await fetch("/api/leave_organization/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("wadt_csrftoken") || "",
      },
      credentials: "include",
    });

    const data = await response.json();
    if (data.status === "success") {
      setStatus("none");
      setTimeout(() => setGroupName(data.organization_name), 2000);
    } else {
      setStatus("Failed");
    }

    setSpinner(false);
  };

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/create_organization/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("wadt_csrftoken") || "",
        },
        body: JSON.stringify({ name: newGroupName }),
        credentials: "include",
      });
      const data = await response.json();
      if (response.ok) {
        console.log("Group created successfully:", data);
      } else {
        console.error("Failed to create group:", data);
      }
      navigate("/admin");
    } catch (error) {
      console.error("Error creating group:", error);
    }
  };

  // Checks if the user is already in a group
  // This is usually for admins who go into user dashboard
  const checkGroupAdmin = async () => {
    const data = await getCurrentUser();
    setGroupName(data.organization?.name || "");
    data.role === "STUDENT" ? setIsAdmin(false) : setIsAdmin(true);
  };

  const joinGroupSection = () => {
    return (
      <>
        <p className="section-header">Join Group</p>
        <div className="section-body">
          <Form onSubmit={joinOrg}>
            <Form.Group>
              <Form.Label>Group Code</Form.Label>
              <Form.Control
                type="text"
                onChange={(e) => setOrgCode(e.target.value)}
              />
            </Form.Group>

            {spinner === false && !groupName && (
              <Button
                type="submit"
                size="sm"
                className="w-100 start_button mt-1"
              >
                Join Group
              </Button>
            )}

            {spinner === true && !groupName && (
              <Button
                type="submit"
                size="sm"
                className="w-100 start_button mt-1"
                disabled
              >
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                ></Spinner>
              </Button>
            )}
          </Form>
          <div>
            {status === "failed" && showBadge && (
              <Badge bg={"danger"}>Failed, please try again</Badge>
            )}
            {status === "success" && showBadge && (
              <Badge bg={"success"}>Success, joined {groupName}</Badge>
            )}
            {status === "none" && showBadge && (
              <Badge bg={"secondary"}>Left {groupName}</Badge>
            )}
          </div>

          <div className="d-flex align-items-center my-3">
            <hr className="flex-grow-1" />
            <span className="mx-2">OR</span>
            <hr className="flex-grow-1" />
          </div>
        </div>
        <p className="section-header">Create Group</p>

        <div className="section-body">
          <Form onSubmit={createGroup}>
            <Form.Label>Group Name</Form.Label>
            <InputGroup className="mb-3">
              <Form.Control
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
            </InputGroup>
            <Button className="w-100 start_button mt-1" size="sm" type="submit">
              Create Group
            </Button>
          </Form>
        </div>
      </>
    );
  };

  const yourGroupSection = () => {
    return (
      <>
        <p className="section-header">Your Group</p>
        <Card
          style={{
            background: "rgba(33, 150, 243, .12)",
            border: "1px solid rgba(33, 150, 243, .35)",
            borderRadius: "6px",
          }}
        >
          <Card.Body
            className="d-flex align-items-center gap-2"
            style={{ color: "var(--primary-theme1)" }}
          >
            <div
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                background: "#1976d2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                color: "white",
                flexShrink: 0,
              }}
            >
              ✓
            </div>
            You are a member of
            <span style={{ color: "white", fontWeight: "600" }}>
              {groupName}
            </span>
          </Card.Body>
        </Card>
        {!isAdmin ? (
          <div>
            {spinner === false && (
              <div className="d-grid gap-2" style={{ marginTop: "40px" }}>
                <Button
                  variant="outline-danger"
                  onClick={leaveOrg}
                  className="w-100 mt-1"
                >
                  Leave {groupName}
                </Button>
              </div>
            )}
            {spinner === true && (
              <div className="d-grid gap-2" style={{ marginTop: "40px" }}>
                <Button
                  variant="danger"
                  size="sm"
                  disabled
                  className="w-100 mt-1"
                >
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    role="status"
                    aria-hidden="true"
                  ></Spinner>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="d-grid gap-2" style={{ marginTop: "40px" }}>
            <Button
              variant="outline-secondary"
              style={{ color: "white" }}
              onClick={() => navigate("/admin")}
            >
              Go To Admin Dashboard
            </Button>
          </div>
        )}
      </>
    );
  };

  useEffect(() => {
    checkGroupAdmin();
  }, []);

  return (
    <>
      <Navbar.Brand
        as={Button}
        className="navbar_button"
        onClick={(e) => {
          e.currentTarget.blur();
          handleShow();
        }}
      >
        WADT
      </Navbar.Brand>
      <Offcanvas show={show} onHide={handleClose} placement="start">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title className="offcanvas-title">
            Web App Deployment Tool
          </Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <p className="section-header">Mission</p>
          <div className="section-body">
            <p className="section-text" style={{ fontSize: "16px" }}>
              Our goal for the Web App Deployment Tool is to ensure that the
              user has a seamless experience using docker containers.
            </p>
          </div>
          <hr />
          <br />
          {!groupName && joinGroupSection()}
          {groupName && yourGroupSection()}
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}

