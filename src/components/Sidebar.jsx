import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import logo from "../assets/logo.png";
import collapseIcon from "../assets/fold-sidebar.png";
import "./Sidebar.css";

export default function Sidebar() {
  const nav = useNavigate();
  const [openTele, setOpenTele] = useState(true);

  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("sidebar:collapsed");
    if (saved != null) setCollapsed(saved === "true");
  }, []);
  useEffect(() => {
    localStorage.setItem("sidebar:collapsed", String(collapsed));
  }, [collapsed]);

  const { isLoggedIn, user } = useAuth();
  const isPatient = user?.role === "ROLE_PATIENT";
  const isDoctor = user?.role === "ROLE_DOCTOR";

  const toggleCollapsed = () => setCollapsed((v) => !v);

  return (
    <aside className={`sb${collapsed ? " sb--collapsed" : ""}`}>
      <div
        className="sb__header"
        role="button"
        tabIndex={0}
        onClick={() => nav("/")}
        onKeyDown={(e) => e.key === "Enter" && nav("/")}
      >
        <img src={logo} alt="Handdoc" className="sb__logo" />
        <div className="sb__brand">HandDoc</div>

        <button
          type="button"
          className="sb__collapseBtn"
          aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          aria-expanded={!collapsed}
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapsed();
          }}
          title={collapsed ? "펼치기" : "접기"}
        >
          <img
            src={collapseIcon}
            alt=""
            aria-hidden="true"
            className={`sb__collapseIcon${collapsed ? " is-collapsed" : ""}`}
          />
        </button>
      </div>

      <hr className="sb__divider" />

      <nav className="sb__nav">
        <NavLink
          to="/prepare"
          end
          className={({ isActive }) => `sb__item${isActive ? " active" : ""}`}
          title="대면 진료"
        >
          <span className="sb__arrow" />
          <span className="sb__label">대면 진료</span>
        </NavLink>

        {isLoggedIn && (
          <div className="sb__group">
            <div
              className={`sb__item sb__dropdown${
                collapsed ? " sb__dropdown--disabled" : ""
              }`}
              onClick={() => {
                if (collapsed) return;
                setOpenTele((prev) => !prev);
              }}
              title="비대면 진료"
            >
              {!collapsed && (
                <span className="sb__arrow">{openTele ? "▾" : "▸"}</span>
              )}
              <span className="sb__label">비대면 진료</span>
            </div>

            {!collapsed && openTele && (
              <div className="sb__submenu">
                {isPatient && (
                  <>
                    <NavLink
                      to="/tele/doctor-list"
                      className={({ isActive }) =>
                        `sb__subitem${isActive ? " active" : ""}`
                      }
                      title="진료 예약"
                    >
                      <span className="sb__label">진료 예약</span>
                    </NavLink>

                    <NavLink
                      to="/telemed/history"
                      className={({ isActive }) =>
                        `sb__subitem${isActive ? " active" : ""}`
                      }
                      title="진료 내역"
                    >
                      <span className="sb__label">진료 내역</span>
                    </NavLink>
                  </>
                )}

                {isDoctor && (
                  <NavLink
                    to="/doctor/reservations"
                    className={({ isActive }) =>
                      `sb__subitem${isActive ? " active" : ""}`
                    }
                    title="진료 예약 관리"
                  >
                    <span className="sb__label">진료 예약 관리</span>
                  </NavLink>
                )}
              </div>
            )}
          </div>
        )}
      </nav>
    </aside>
  );
}
