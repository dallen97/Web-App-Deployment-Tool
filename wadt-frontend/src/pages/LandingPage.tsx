import React from "react";
import Header from "../components/Header.tsx";
import Card from "../components/Card.tsx";
import Footer from "../components/Footer.tsx";

const HeaderComponent = Header as unknown as React.ComponentType<any>;

/**
 * Structure of the Landing Page
 * - Header
 * - Title
 * - Description
 * - Call to Action
 *
 * For scrolling down the page, add transitions between sections
 */

function LandingPage() {
  return (
    <div className="">
      <HeaderComponent />
      <br />
      <br />
      <div style={{ marginTop: "25px" }}>
        <h1 className="display-2 font-monospace text-center">
          WEB APP DEPLOYMENT TOOL
        </h1>
      </div>
      <div style={{ marginTop: "200px" }}>
        <p className="lead font-monospace text-center">
          The WADT is a software that will provide you with a simulated
          environment to hone your
          <br />
          <p className="lead font-monospace text-center">
            <b>Cyber Security Skills</b>
          </p>
        </p>
      </div>
      <div>
        <div style={{ marginTop: "600px" }}>
          <h1 className="display-6 font-monospace text-center">
            Develop Your Skills Here!
          </h1>
          <div
            style={{
              marginTop: "200px",
              margin: "0 auto",
              display: "flex",
              gap: "1rem",
            }}
          >
            <Card
              cardWidth="18rem"
              title="Work With Docker"
              text="
        Lorem ipsum dolor sit amet. 
        Quo fuga explicabo ut voluptates laudantium et repellat voluptates quo consequatur 
        ipsa et enim veritatis et dicta accusamus non omnis cupiditate.
        "
            ></Card>
            <Card
              cardWidth="18rem"
              title="Deploy Web Applications"
              text="
        Lorem ipsum dolor sit amet. 
        Quo fuga explicabo ut voluptates laudantium et repellat voluptates quo consequatur 
        ipsa et enim veritatis et dicta accusamus non omnis cupiditate.
        "
            ></Card>
            <Card
              cardWidth="20rem"
              title="Hone Your Cyber Security Skills"
              text="
        Lorem ipsum dolor sit amet. 
        Quo fuga explicabo ut voluptates laudantium et repellat voluptates quo consequatur 
        ipsa et enim veritatis et dicta accusamus non omnis cupiditate.
        "
            ></Card>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "500px" }}></div>
      <Footer />
    </div>
  );
}

export default LandingPage;
