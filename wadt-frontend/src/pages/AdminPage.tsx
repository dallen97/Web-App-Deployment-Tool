import { useState, useEffect } from "react";
import { Form, Container, InputGroup } from "react-bootstrap";
import UserTables from "../components/userTables";
import Cards from "../components/Card";

const fontStyle: React.CSSProperties = {
  fontFamily: "monospace",
  fontVariantCaps: "all-small-caps",
  fontSize: 20,
  color: "var(--primary-theme1)",
};

function AdminPage() {
  const [views, setViews] = useState("loading");
  const [numMembers] = useState<number>(0);
  const [numContainers] = useState<number>(0);
  const [groupName, setGroupName] = useState<string>("");
  const [groupCode, setGroupCode] = useState<string>("XXXXXX");

  const createClass = () => {
    // NOTE: Current testing: testing to see if forms works

    // ITEM: Make submit form for creating group

    const createGroup = async (e: React.FormEvent) => {
      e.preventDefault(); // Prevents form submission upon reloading the page
      try {
        const response = await fetch("/api/create_organization/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
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
        </div>
      </>
    );
  };

  const admin_dash = () => {
    return (
      <>
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
                    text="0"
                  />
                  <Cards
                    header="Number of Containers"
                    cardWidth="15rem"
                    cardHeight="35px"
                    text="0"
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
              <UserTables />
            </Container>
          </main>
        </div>
      </>
    );
  };

  // ITEM: On page load, checks if organization exists.
  useEffect(() => {
    const pageLoad = async () => {
      try {
        const response = await fetch("/api/current_user", {
          credentials: "include",
        });

        const data = await response.json();

        if (data?.organization) {
          setGroupName(data.organization.name);
          setGroupCode(data.organization.code);
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
