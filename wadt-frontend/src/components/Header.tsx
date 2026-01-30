import Button from "react-bootstrap/Button";
import React, { useEffect, useState } from "react";
import Dropdown from "../ui/Dropdown";
import { Link } from "react-router-dom"; // Use this for links on page headers

// I need to make the header file dynamic so it could do the following
/*
  Take in number of buttons, and for each button
    - Link -> string
    - text -> string
*/

export interface HeaderButton {
  link: string;
  text: string;
}

export interface HeaderProps {
  buttons?: HeaderButton[];
}

const Header: React.FC<HeaderProps> = ({ buttons = [] }) => {
  return (
    <div data-bs-theme="dark">
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <ul className="nav w-100 align-items-center container-fluid">
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

export default Header
