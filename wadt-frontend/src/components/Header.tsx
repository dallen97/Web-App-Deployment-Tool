import { Navbar } from "react-bootstrap";
import Sidebar from "./Sidebar";
export interface HeaderButton {
  link: string;
  text: string;
  isText?: boolean; // for putting text in header that does not look like the clickable stuff
  onClick?: () => void;
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
  const alignClass = getAlignClass(align);

  return (
    <div>
      <Navbar className="navbar">
        <ul
          className={`nav w-100 d-flex align-items-center container-fluid ${alignClass}`}
        >
          {wadtEnabled && <Sidebar />}
          <ul className={`nav ms-auto d-flex align-items-center`}></ul>
          {buttons.map((btn, index) => (
            <li key={index} className="small_text">
              {/* Check for text in header and make it look different*/}
              {btn.isText ? (
                <span
                  className="nav-link"
                  style={{ color: "var(--text-theme1)" }}
                >
                  {btn.text}
                </span>
              ) : (
                <a
                  className="nav-link"
                  style={{ color: "var(--primary-theme1)" }}
                  href={btn.link}
                  onClick={btn.onClick}
                >
                  {btn.text}
                </a>
              )}
            </li>
          ))}
        </ul>
      </Navbar>
    </div>
  );
};

export default Header;
