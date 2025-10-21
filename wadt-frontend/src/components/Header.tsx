import Button from "react-bootstrap/Button";
import React from "react";
import Dropdown from "../ui/Dropdown";
import { Breadcrumb } from "react-bootstrap";
import {Link} from 'react-router-dom' // Use this for links on page headers

function Header(): React.ReactElement {
  return (
    <div className="card card-header d-flex">
      <nav>
        <ul className="nav w-100 align-items-center">
          <li className="nav-item">
            <a className="nav-link active" aria-current="page" href="#">
              <Dropdown />
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" href="#">
              <Button variant="dark">Button2</Button>
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" href="#">
              <Button variant="dark">Button3</Button>
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" href="#">
              <Button variant="dark">Button4</Button>
            </a>
          </li>
          <li className="nav-item ms-auto">
            <Link className="nav-link" to="/login">
              <Button variant="dark">Login</Button>
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export default Header;
