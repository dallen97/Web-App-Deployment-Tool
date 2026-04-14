import { useState, useEffect, useCallback } from "react";
import { Container, Button, OverlayTrigger, Tooltip } from "react-bootstrap";
import UserTables, { type userInfo } from "../components/userTables";
import Cards from "../components/Card";
import { useNavigate } from "react-router-dom";
import getCookie from "../components/GetCookie";

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
      const raw: any[] = [];
      let page = 1;
      let hasNext = true;

      while (hasNext) {
        const response = await fetch(`/api/get_all_containers_admin/?page=${page}`, {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);

        const payload = await response.json();
        raw.push(...(payload.data ?? []));
        hasNext = !!payload.pagination?.has_next;
        page += 1;
      }

      // Check if users have started a container yet or not
      const organized: userInfo[] = raw.flatMap((user: any) =>
        user.containers.length === 0
          ? [
              {
                name: user.username,
                userId: user.user_id,
                role: user.role,
                con_name: user.name,
                con_status: user.status,
                con_id: user.container_id,
                started_at: user.started_at ?? null,
                max_runtime_seconds: user.max_runtime_seconds ?? 86400,
              },
            ]
          : user.containers.map((container: any) => ({
              name: user.username,
              userId: user.user_id,
              role: user.role,
              con_name: container.name,
              con_status: container.status,
              con_id: container.container_id,
              started_at: container.started_at ?? null,
              max_runtime_seconds: container.max_runtime_seconds ?? 86400,
            })),
      );

      setData(organized);
    } catch (error) {
      console.error("Failed to fetch container data");
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
    window.confirm(
      `Are you sure you want to delete your organization? This cannot be undone.`,
    ) && deleteOrg();
  };

  const deleteOrg = async () => {
    const response = await fetch(`/api/delete_organization/${orgID}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("wadt_csrftoken") || "",
      },
      credentials: "include",
      body: JSON.stringify({
        org_id: orgID,
      }),
    });
    const data = await response.json();
    if (data.status === "success") {
      navigate("/dashboard");
    } else {
      console.log("ERROR in leaving organization");
    }
  };

  const admin_dash = () => {
    return (
      <>
        <Container
          fluid
          className="d-flex justify-content-end align-items-center"
          style={{ gap: "10px", paddingTop: "10px" }}
        >
          <Button className="start_button" size="sm" onClick={handleUser}>
            Return to User Dashboard
          </Button>

          <OverlayTrigger
            placement="bottom"
            delay={{ show: 250, hide: 400 }}
            overlay={<Tooltip id="button-tooltip">Delete organization</Tooltip>}
          >
            <Button onClick={handleDelete} size="sm" variant="danger">
              ✕
            </Button>
          </OverlayTrigger>
        </Container>

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
        const response = await fetch("/api/current_user/", {
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
      {views === "admin_dash" && admin_dash()}
    </>
  );
}

export default AdminPage;
