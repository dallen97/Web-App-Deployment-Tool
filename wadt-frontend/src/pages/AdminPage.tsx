import { useState, useEffect, useCallback } from "react";
import { Form, Container, InputGroup, Button } from "react-bootstrap";
import UserTables, { type userInfo } from "../components/userTables";
import Cards from "../components/Card";
import { useNavigate } from "react-router-dom";

function getCookie(name: string) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === name + "=") {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

function AdminPage() {
  const navigate = useNavigate();
  const [views, setViews] = useState("loading");
  const [orgID, setOrgID] = useState<number>(0);
  const [groupName, setGroupName] = useState<string>("");
  const [groupCode, setGroupCode] = useState<string>("XXXXXX");
  const [data, setData] = useState<userInfo[]>([]);
  const [isPolling, setIsPolling] = useState(true);

  const numMembers = new Set(data.map((d) => d.name)).size;

  const poll = useCallback(async () => {
    try {
      const response = await fetch("/api/get_all_containers_admin/", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const { data: raw } = await response.json();

      const organized: userInfo[] = raw.flatMap((user: any) =>
        user.containers.map((container: any) => ({
          name: user.username,
          con_name: container.name,
          con_status: container.status,
          con_id: container.container_id ?? "",
          started_at: container.started_at ?? null,
          max_runtime_seconds: container.max_runtime_seconds ?? 86400,
        })),
      );

      setData(organized);
    } catch {
      console.log("Failed to fetch container data");
    }
  }, []);

  useEffect(() => {
    const handle = () => setIsPolling(!document.hidden);
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, []);

  useEffect(() => {
    poll();
    if (!isPolling) return;
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [isPolling, poll]);

  const handleStop = async (row: userInfo) => {
    const response = await fetch(`/api/stop_container/${row.con_id}/`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("wadt_csrftoken") || "",
      },
    });
    if (response.ok) {
      await poll();
    } else {
      console.error("Stop failed", await response.json());
    }
  };

  const handleUser = () => {
    navigate("/dashboard");
  };

  const handleDelete = () => {
    if (
      window.confirm(
        `Are you sure you want to delete your organization? This cannot be undone.`,
      )
    ) {
      deleteOrg();
    }
  };

  const deleteOrg = async () => {
    const response = await fetch(`/api/delete_organization/${orgID}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("wadt_csrftoken") || "",
      },
      body: JSON.stringify({
        org_id: orgID,
      }),
    });
    const data = await response.json();
    if (data.status === "success") {
      setViews("createClass");
    } else {
      console.log("ERROR in leaving organization");
    }
  };

  const createClass = () => {
    const createGroup = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        const response = await fetch("/api/create_organization/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie("wadt_csrftoken") || "",
          },
          body: JSON.stringify({
            name: groupName,
          }),
          credentials: "include",
        });
        const data = await response.json();
        if (response.ok) {
          console.log("Group created successfully:", data);
          setViews("admin_dash");
          setGroupCode(data.org_code);
          setOrgID(data.org_id);
        } else {
          console.error("Failed to create group:", data);
        }
      } catch (error) {
        console.error("Error creating group:", error);
      }
    };

    return (
      <>
        <div className="d-flex flex-column min-vh-100 justify-content-center align-items-center">
          <h3 style={{ marginBottom: "50px" }}>Enter Organization Name</h3>
          <Form onSubmit={createGroup}>
            <InputGroup className="mb-3">
              <Form.Control
                type="text"
                placeholder="Enter Group Name"
                style={{
                  display: "inline-block",
                  width: "200px",
                  marginLeft: "10px",
                }}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </InputGroup>
          </Form>
          <div className="d-flex align-items-center my-3">
            <hr className="flex-grow-1" />
            <span className="mx-2">OR</span>
            <hr className="flex-grow-1" />
          </div>
          <div className="d-flex align-items-center my-3">
            <hr className="flex-grow-1" />
            <Button className="start_button" onClick={handleUser}>
              Return to User Dashboard
            </Button>
            <hr className="flex-grow-1" />
          </div>
        </div>
      </>
    );
  };

  const admin_dash = () => {
    return (
      <>
        <div style={{ position: "relative" }}>
          <Button
            onClick={handleDelete}
            size="sm"
            className="start_button"
            style={{ position: "absolute", top: "2", right: "2" }}
          >
            Delete Organization
          </Button>
        </div>
        <div className="d-flex flex-column min-vh-100">
          <main className="flex-grow-1 d-flex align-items-center justify-content-center">
            <Container className="text-center" style={{ maxWidth: "1000px" }}>
              <h1>Welcome Admin</h1>
              <Container>
                <div
                  className="d-flex justify-content-center align-center"
                  style={{ marginTop: "20px", marginBottom: "100px" }}
                >
                  <Cards
                    header="Number of Members"
                    cardWidth="15rem"
                    cardHeight="35px"
                    text={numMembers}
                  />
                  <Cards
                    header="Group Name"
                    cardWidth="15rem"
                    cardHeight="35px"
                    text={groupName}
                  />
                  <Cards
                    header="Group Code"
                    cardWidth="15rem"
                    cardHeight="35px"
                    text={groupCode}
                  />
                </div>
              </Container>
              <UserTables data={data} onStop={handleStop} />
            </Container>
          </main>
        </div>
      </>
    );
  };

  // On page load, checks if organization exists.
  useEffect(() => {
    const pageLoad = async () => {
      try {
        const response = await fetch("/api/current_user", {
          credentials: "include",
        });
        if (!response.ok) {
          navigate("/login");
          return;
        }
        const data = await response.json();
        console.log("current_user data:", data);

        if (data?.organization) {
          setGroupName(data.organization.name);
          setGroupCode(data.organization.org_code);
          setOrgID(data.organization.id);
          setViews("admin_dash");
        } else {
          setViews("createClass");
        }
      } catch (error) {
        console.error("Error: ", error);
        setViews("createClass");
      }
    };
    pageLoad();
  }, []);

  return (
    <>
      {/*switches view state*/}
      {views === "loading" && <p>Loading ...</p>}
      {views === "createClass" && createClass()}
      {views === "admin_dash" && admin_dash()}
    </>
  );
}

export default AdminPage;
