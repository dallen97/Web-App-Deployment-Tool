import Button from "react-bootstrap/Button";
import React, { useEffect, useState } from "react";
import Dropdown from "../ui/Dropdown";
import { Link } from "react-router-dom"; // Use this for links on page headers
function Header(): React.ReactElement {
  return (
    <div data-bs-theme="dark">
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <ul className="nav w-100 align-items-center container-fluid">
          <li className="nav-item">
            <a className="nav-link active" aria-current="page" href="#">
              <Dropdown />
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" href="#">
              <Button variant="light">Button2</Button>
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" href="#">
              <Button variant="light">Button3</Button>
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" href="#">
              <Button variant="light">Button4</Button>
            </a>
          </li>
          <li className="nav-item ms-auto">
            <Link className="nav-link" to="/login">
              <Button variant="light">Login</Button>
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export default Header;
