

export interface HeaderButton {
  link: string;
  text: string;
}

export interface HeaderProps {
  buttons?: HeaderButton[];
}

const Header = ({ buttons = [] }:HeaderProps) => {
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
