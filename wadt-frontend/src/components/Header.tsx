import { useState } from "react";
import type React from "react";
import OffCanvas from "react-bootstrap/Offcanvas";
import Button from "react-bootstrap/Button";

export interface HeaderButton {
  link: string;
  text: string;
}

export interface HeaderProps {
  buttons?: HeaderButton[];
  wadtEnabled?: boolean;
  align?: "left" | "right" | "center";
}

const getAlignClass = (align: "left" | "right" | "center") => {
  switch (align) {
    case "right":
      return "justify-content-end";
    case "center":
      return "justify-content-center";
    case "left":
      return "justify-content-start";
    default:
      return "";
  }
};

const Header = ({
  buttons = [],
  wadtEnabled = true,
  align = "left",
}: HeaderProps) => {
  const [show, setShow] = useState(false);

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);
  const alignClass = getAlignClass(align);

  return (
    <div data-bs-theme="dark">
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <ul
          className={`nav w-100 d-flex align-items-center container-fluid ${alignClass}`}
        >
          {wadtEnabled && (
            <>
              <Button variant="light" onClick={handleShow}>
                WADT
              </Button>
              <OffCanvas show={show} onHide={handleClose}>
                <OffCanvas.Title>Web App Deployment Tool</OffCanvas.Title>
                <OffCanvas.Body>
                  Our goal for the Web App Deployment Tool is to ensure that the
                  user has a seamless experience using docker containers.
                </OffCanvas.Body>
              </OffCanvas>
            </>
          )}

          {buttons.map((btn, index) => (
            <li key={index} className="nav-item">
              <a className="nav-link" href={btn.link}>
                {btn.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default Header;
