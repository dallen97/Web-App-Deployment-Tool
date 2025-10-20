import React from "react";
import Header from "../components/Header.tsx";

const HeaderComponent = Header as unknown as React.ComponentType<any>;

function LandingPage() {
  return (
    <div>
      <HeaderComponent />
      <br />
      <br />
      <h1 className="display-1 font-monospace text-center">
        WEB APP DEPLOYMENT TOOL
      </h1>
      <br />
      <br />
      <br />
      <br />
      <p className="lead font-monospace text-center">
        The WADT is a software that will provide you with a simulated
        environment to hone your
      </p>
      <p className="lead font-monospace text-center">
        <b>Cyber Security Skills</b>
      </p>
    </div>
  );
}

export default LandingPage;
