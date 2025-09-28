// src/components/Sidebar.jsx
import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import logo from "../assets/logo.png";
import "./Sidebar.css";

export default function Sidebar() {
  const nav = useNavigate();
  const [openTele, setOpenTele] = useState(true);
  const { isLoggedIn, user } = useAuth();

  const isPatient = user?.role === "ROLE_PATIENT";
  const isDoctor = user?.role === "ROLE_DOCTOR";

  return (
    <aside className="sb">
      {/* 로고 + 브랜드 */}
      <div
        className="sb__header"
        role="button"
        tabIndex={0}
        onClick={() => nav("/")}
        onKeyDown={(e) => e.key === "Enter" && nav("/")}
      >
        <img src={logo} alt="Handoc" className="sb__logo" />
        <div className="sb__brand">Handoc</div>
      </div>

      <hr className="sb__divider" />

      <nav className="sb__nav">
        {/* 항상 보이는 메뉴 */}
        <NavLink
          to="/prepare"
          end
          className={({ isActive }) => `sb__item${isActive ? " active" : ""}`}
        >
          <span className="sb__arrow" />
          대면 진료
        </NavLink>

        {/* 로그인 상태일 때만 비대면 진료 노출 */}
        {isLoggedIn && (
          <div className="sb__group">
            <div
              className="sb__item sb__dropdown"
              onClick={() => setOpenTele((prev) => !prev)}
            >
              <span className="sb__arrow">{openTele ? "▾" : "▸"}</span>
              비대면 진료
            </div>

            {openTele && (
              <div className="sb__submenu">
                {isPatient && (
                  <>
                    <NavLink
                      to="/tele/doctor-list"
                      className={({ isActive }) =>
                        `sb__subitem${isActive ? " active" : ""}`
                      }
                    >
                      진료 예약
                    </NavLink>

                    {/* ✅ 경로 수정: /tele/history → /telemed/history */}
                    <NavLink
                      to="/telemed/history"
                      className={({ isActive }) =>
                        `sb__subitem${isActive ? " active" : ""}`
                      }
                    >
                      진료 내역
                    </NavLink>
                  </>
                )}

                {/* ❌ 의사 뷰: ‘진료 내역’ 메뉴 제거, 예약 관리만 노출 */}
                {isDoctor && (
                  <>
                    <NavLink
                      to="/doctor/reservations"
                      className={({ isActive }) =>
                        `sb__subitem${isActive ? " active" : ""}`
                      }
                    >
                      진료 예약 관리
                    </NavLink>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </nav>
    </aside>
  );
}
