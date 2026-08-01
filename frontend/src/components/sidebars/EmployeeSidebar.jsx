import React, { useState, useRef, useEffect } from "react";
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
    `block px-4 py-2 rounded transition-colors ${
      isActive(path) ? "bg-gray-700 font-semibold" : "hover:bg-gray-700"
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
      <div className="md:hidden bg-gray-900 p-4 flex justify-between items-center text-white fixed top-0 left-0 right-0 z-50">
        <span className="font-bold text-lg">{user.last_name} Dashboard</span>
        <button
          onClick={() => setMenuOpen(true)}
          className="text-2xl focus:outline-none"
        >
          ☰
        </button>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 h-screen bg-gray-900 text-white fixed top-0 left-0 flex-col shadow-lg pt-16">
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
        className={`fixed top-0 left-0 h-screen w-full bg-gray-900 text-white z-50 transform transition-transform duration-300 pt-16 px-4 md:hidden ${
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
