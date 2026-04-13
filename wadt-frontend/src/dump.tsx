import React, { useState, useEffect } from "react";
import {
  Form,
  Button,
  Container,
  InputGroup,
  Table,
  Card,
} from "react-bootstrap";

// NOTE: Now I have it making the organization in the backend and making the proper api calls.
// NOTE: LOGIN WORKS!!!!
// NOTE: JOIN ORG CODE WORKS!!!!

// BUG: Some issues that I noticed was that after each page refresh, the code will reset, as well as the session.

// TODO: Next step is to populate the admin page with users.

// NOTE: The current system is an AI attempt at making this happen. Might be best to edit it later.

function Sandbox() {
  interface userInfo {
    name: string;
    container_name: string;
    container_status: string;
    time_remaining: number;
  }

  /** */
  const testUser: userInfo = {
    name: "John Doe",
    container_name: "my-container",
    container_status: "running",
    time_remaining: 120,
  };

  const [userData, setUserData] = useState<userInfo[]>([]);
  const [groupCode, setGroupCode] = useState<string>(() => {
    return localStorage.getItem("groupCode") || "";
  });
  const [orgCode, setOrgCode] = useState<string>("");

  // ITEM: method to create user group
  const createGroup = async () => {
    try {
      const response = await fetch("/api/create_organization/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "thirdTesting",
        }),
        credentials: "include",
      });
      const data = await response.json();
      if (response.ok) {
        console.log("GROUP CREATED", data);
        setGroupCode(data.org_code);
      } else {
        console.error("GROUP CREATION FAILED");
      }
    } catch (error) {
      console.error("PROCESS FAILED", error);
    }
  };

  // ITEM: Method to get user info
  const getUserInfo = async () => {
    try {
      const response = await fetch("/api/get_all_containers_admin/", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Raw response:", data);
      console.log("data.data:", data.data);
      console.log("data.organization_scope:", data.organization_scope);
      console.log("pagination:", data.pagination);

      const organizeData: userInfo[] = data.data.flatMap((user: any) =>
        user.containers.map((container: any) => ({
          name: user.username, // API uses "username" not "name"
          container_name: container.name,
          container_status: container.status,
          time_remaining: 0, // API doesn't return this, default to 0
        })),
      );

      console.log("Organized Data:", organizeData);
      setUserData(organizeData);
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
  };

  // ITEM: Method to join organization
  const joinOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/join_organization/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          org_code: orgCode,
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        console.log("ORGANIZATION JOINED", data);
      } else {
        console.log("ERROR JOINING ORGANIZATION", data);
      }
    } catch (error) {
      console.log("ERROR IN COMPLETING TASK", error);
    }
  };

  const leaveOrganization = async () => {
    const response = await fetch("/api/leave_organization/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error("ERROR: Failed to pull information");
    }

    console.log("Organization Left!");
  };

  useEffect(() => {
    localStorage.setItem("groupCode", groupCode);
  }, [groupCode]);

  useEffect(() => {
    const cached = localStorage.getItem("userData");
  });

  useEffect(() => {
    const cached = localStorage.getItem("userData");
    if (cached) {
      setUserData(JSON.parse(cached));
    } else {
      // swap getUserInfo() back in when API is ready
      setUserData([testUser]);
      localStorage.setItem("userData", JSON.stringify([testUser]));
    }
  }, []);

  // ITEM: HTML element, or what goes on the front page
  // NOTE: Now the table works!! So the next step is to properly pull the API of userlogins.

  /******************************************************************************** */
  // NOTE: I will be writing some new code to kinda reset my logic

  // ITEM: userinfo interface
  interface userInfo2 {
    name: string;
    container_name: string;
    container_status: string;
    time_remaining: number;
  }

  const get_user_info = async () => {
    const current_user = await fetch("/api/current_user");
    if (!current_user.ok) {
      console.error("ERROR");
    }

    const data = current_user.json();

    console.log(data);
  };

  return (
    <>
      <h2>Admin Dashboard - User Containers</h2>
      <Button onClick={createGroup}>Press me to make group code</Button>
      <p>Group Code: {groupCode}</p>
      <Table>
        <thead>
          <tr>
            <th>User</th>
            <th>Container Names</th>
            <th>Container Status</th>
            <th>Time Remaining</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {userData.length === 0 ? (
            <tr>
              <td colSpan={5}>No Container Data Available</td>
            </tr> // wrap in <td>
          ) : (
            userData.map((user, index) => (
              <tr key={`${user.name}-${user.container_name}-${index}`}>
                <td>{user.name}</td>
                <td>{user.container_name}</td>
                <td>{user.container_status}</td> {/* Add */}
                <td>{user.time_remaining}</td> {/* Add */}
                <td>{/* Actions buttons go here */}</td>
              </tr>
            ))
          )}
          <tr></tr>
        </tbody>
      </Table>

      <div style={{ marginTop: "100px" }}>
        <Form onSubmit={joinOrganization}>
          <InputGroup>
            <Form.Control
              type="text"
              placeholder="Enter Group Code"
              value={orgCode}
              onChange={(e) => setOrgCode(e.target.value)}
            />
            <Button type="submit">Join Organization</Button>
          </InputGroup>
        </Form>
      </div>

      <div>
        <hr style={{ width: "100%", marginTop: "40px" }}></hr>

        <Button
          style={{ marginTop: "50px", color: "red" }}
          onClick={get_user_info}
        >
          get_user_info
        </Button>
        <br></br>
        <Button style={{ marginTop: "25px" }} onClick={getUserInfo}>
          get_all_containers_admin
        </Button>

        <br></br>

        <Button style={{ marginTop: "25px" }} onClick={leaveOrganization}>
          Leave Organization
        </Button>
      </div>
    </>
  );
}

export default Sandbox;
