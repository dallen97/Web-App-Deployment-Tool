import { useState } from "react";
import { Form, InputGroup } from "react-bootstrap";

export default function JoinGroup() {
  const [orgCode, setOrgCode] = useState<string>("");

  const joinOrg = async (e: React.FormEvent) => {
    e.preventDefault();

    const response = await fetch("/api/join_organization/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        org_code: orgCode,
      }),
    });
    const ret = await response.json();
    console.log(ret);
  };

  return (
    <>
      <Form onSubmit={joinOrg}>
        <InputGroup>
          <Form.Control
            onChange={(e) => setOrgCode(e.target.value)}
          ></Form.Control>
        </InputGroup>
      </Form>
    </>
  );
}
