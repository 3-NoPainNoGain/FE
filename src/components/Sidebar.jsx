import { NavLink, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";


export default function Sidebar() {
  const nav = useNavigate();

  return (
    <aside className="sb">
      <div
        className="sb__header"
        role="button"
        tabIndex={0}
        onClick={() => nav("/")}
        onKeyDown={(e) => e.key === "Enter" && nav("/")}
        style={{ cursor: "pointer" }}
      >
        <img src={logo} alt="Handoc" className="sb__logo" />
        <div className="sb__brand">Handoc</div>
      </div>

      <nav className="sb__nav">
        <NavLink
          to="/prepare"
          end
          className={({ isActive }) => `sb__item${isActive ? " active" : ""}`}
        >
          대면 진료
        </NavLink>
        <NavLink
          to="/tele/doctor-list"
          className={({ isActive }) => `sb__item${isActive ? " active" : ""}`}
        >
          비대면 진료
        </NavLink>
      </nav>
    </aside>
  );
}
