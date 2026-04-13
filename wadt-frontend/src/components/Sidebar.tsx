import { useState } from "react";
import {
  Button,
  Offcanvas,
  Form,
  Navbar,
  Badge,
  Spinner,
} from "react-bootstrap";
import { useNavigate } from "react-router-dom";

/** Sidebar.tsx contains features in the offcanvas, including:
 *    - Our mission statement
 *    - Join Group Code and it's logic
 */

export default function Sidebar() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [orgCode, setOrgCode] = useState<string>("");
  const [groupName, setGroupName] = useState<string>("");
  const [status, setStatus] = useState<string>("none");
  const [showBadge, setShowBadge] = useState(false);
  const [spinner, setSpinner] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const showBadgeTimer = () => {
    setShowBadge(true);
    setTimeout(() => setShowBadge(false), 5000);
  };

  const joinOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setSpinner(true);

    const response = await fetch("/api/join_organization/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
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
  };

  const leaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setSpinner(true);
    const response = await fetch("/api/leave_organization/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  const handleAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/admin");
  };

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
              {spinner === false && groupName && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={leaveOrg}
                  className="w-100 mt-1"
                >
                  Leave Organization
                </Button>
              )}
              {spinner === true && groupName && (
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
              )}
            </Form>
            <div className="d-flex align-items-center my-3">
              <hr className="flex-grow-1" />
              <span className="mx-2">OR</span>
              <hr className="flex-grow-1" />
            </div>

            <Button
              onClick={handleAdmin}
              className="start_button w-100"
              size="sm"
            >
              Create Group
            </Button>

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
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}
