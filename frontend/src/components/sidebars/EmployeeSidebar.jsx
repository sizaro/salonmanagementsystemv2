import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import SidebarFooter from "../common/SidebarFooter";
import { useData } from "../../context/DataContext";

export default function EmployeeSidebar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef();
  const location = useLocation();
  const { user, loading } = useData();

  const isActive = (path) => location.pathname === path;
  const linkClass = (path) =>
    `dashboard-nav-link ${
      isActive(path) ? "dashboard-nav-active" : ""
    }`;

  // Close mobile on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-600">
        Loading user...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-600">
        No user found. Please login.
      </div>
    );
  }

  return (
    <>
      {/* Top Mobile Header */}
      <div className="dashboard-sidebar md:hidden p-4 flex justify-between items-center fixed top-0 left-0 right-0 z-50">
        <span className="font-bold text-lg">{user.last_name} Dashboard</span>
        <button
          onClick={() => setMenuOpen(true)}
          className="text-2xl focus:outline-none"
        >
          ☰
        </button>
      </div>

      {/* Desktop Sidebar */}
      <aside className="dashboard-sidebar hidden md:flex w-64 h-screen fixed top-0 left-0 flex-col shadow-xl pt-12">
        <div className="px-6 font-bold text-xl mb-4">
          {user.last_name} Dashboard
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          <ul className="space-y-1 text-sm">

            <li>
              <Link to="/employee/dashboard" className={linkClass("/employee/dashboard")}>
                Dashboard
              </Link>
            </li>

            <li>
              <Link
                to="/employee/income-report"
                className={linkClass("/employee/income-report")}
              >
                Income Reports
              </Link>
            </li>

            <li className="mt-10">
              <SidebarFooter />
            </li>

          </ul>
        </div>
      </aside>

      {/* Mobile Slide-Out Menu */}
      <div
        ref={menuRef}
        className={`dashboard-sidebar fixed top-0 left-0 h-screen w-[min(88vw,22rem)] z-50 transform transition-transform duration-300 pt-16 px-4 md:hidden shadow-2xl ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setMenuOpen(false)}
          className="absolute top-4 right-4 text-xl focus:outline-none"
        >
          ✕
        </button>

        <div className="px-6 font-bold text-xl mt-0">{user.last_name} Dashboard</div>

        <div className="h-full overflow-y-auto mt-6 mb-10">
          <ul className="space-y-1 text-sm">

            <li>
              <Link
                to="/employee/dashboard"
                onClick={() => setMenuOpen(false)}
                className={linkClass("/employee/dashboard")}
              >
                Dashboard
              </Link>
            </li>

            <li>
              <Link
                to="/employee/income-report"
                onClick={() => setMenuOpen(false)}
                className={linkClass("/employee/income-report")}
              >
                Income Reports
              </Link>
            </li>

            <li className="mt-10">
              <SidebarFooter />
            </li>

          </ul>
        </div>
      </div>
    </>
  );
}
