import React from "react";
import Header from "../components/Header.tsx";
import Card from "../components/Card.tsx";
import Footer from "../components/Footer.tsx";

const HeaderComponent = Header as unknown as React.ComponentType<any>;

function LandingPage() {
  return (
    <div className="">
      <HeaderComponent
        wadtEnabled={false}
        align="right"
        buttons={[{ text: "Sign in", link: "/login" }]}
      />
      <br />
      <br />
      <div style={{ marginTop: "25px" }}>
        <h1 className="d-flex align-items-center justify-content-center">
          WEB APP DEPLOYMENT TOOL
        </h1>
      </div>
      <div style={{ marginTop: "200px" }}>
        <p className="small_text text-center">
          The WADT is a software that will provide you with a simulated
          environment to hone your
          <br />
          <p className="small_text text-center">
            <b>Cyber Security Skills</b>
          </p>
        </p>
      </div>
      <div>
        <div style={{ marginTop: "600px" }}>
          <h3
            className="d-flex justify-content-center"
            style={{ marginBottom: "150px" }}
          >
            Develop Your Skills Here!
          </h3>
          <div
            style={{
              margin: "0 auto",
              marginBottom: "100px",
              display: "flex",
              justifyContent: "center",
              gap: "1rem",
            }}
          >
            <Card
              cardWidth="30rem"
              title="Work With Docker"
              text="Spin up isolated environments in seconds. Learn to build, ship, and run containers like a pro."
            ></Card>
            <Card
              cardWidth="30rem"
              title="Hone Your Cyber Security Skills"
              text="Put your hacking skills to the test against intentionally vulnerable applications. Learn to think like an attacker — ethically and legally."
            ></Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
