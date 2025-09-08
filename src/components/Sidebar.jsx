// src/components/Sidebar.jsx
import { NavLink, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png"; 

export default function Sidebar() {
  const nav = useNavigate();

  return (
    <aside className="visit__sidebar">
      {/* 로고 클릭 → 랜딩(/) */}
      <div
        className="sb__header"
        role="button"
        tabIndex={0}
        onClick={() => nav("/")}
        onKeyDown={(e) => e.key === "Enter" && nav("/")}
        style={{ cursor: "pointer" }}
      >
{/* 프로젝트에 맞는 로고 경로 사용 */}
<img
  src={logo}
  alt="Handoc"
  className="sb__logo"
/>
        <div className="sb__brand">Handoc</div>
      </div>

      <nav className="sb__nav">
        {/* 대면 진료 → 항상 /prepare 로 이동 */}
        <NavLink
          to="/prepare"
          end
          className={({ isActive }) => `sb__item${isActive ? " active" : ""}`}
        >
          대면 진료
        </NavLink>
        {/* 예: 기존 그대로 */}
<NavLink to="/tele" className={({isActive}) => `sb__item${isActive ? " active" : ""}`}>
  비대면 진료
</NavLink>


      </nav>

      <div className="sb__footer">
        <div className="sb__user">
          <span className="dot" />
          Ready
        </div>
      </div>
    </aside>
  );
}
