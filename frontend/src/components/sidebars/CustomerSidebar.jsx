import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import SidebarFooter from "../common/SidebarFooter";

const CustomerSidebar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef();
  const location = useLocation();

  const menuItems = [
    { path: "/customer/dashboard", label: "Dashboard" },
    { path: "/customer/appointments", label: "My Appointments" },
  ];

  const linkClass = (path) =>
    `dashboard-nav-link ${
      location.pathname === path
        ? "dashboard-nav-active"
        : ""
    }`;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  return (
    <>
      {/* Top Mobile Header */}
      <div className="dashboard-sidebar md:hidden p-4 flex justify-between items-center fixed top-0 left-0 right-0 z-50">
        <span className="font-bold text-lg">Customer Panel</span>
        <button
          onClick={() => setMenuOpen(true)}
          className="text-2xl focus:outline-none"
        >
          ☰
        </button>
      </div>

      {/* Desktop Sidebar */}
      <aside className="dashboard-sidebar hidden md:flex w-64 h-screen shadow-xl fixed top-0 left-0 flex-col">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">
            Customer Panel
          </h2>
        </div>
        <nav className="p-4 flex-1 overflow-y-auto">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.path}>
                <Link to={item.path} className={linkClass(item.path)}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <SidebarFooter />
      </aside>

      {/* Mobile Slide-Out Menu */}
      <div
        ref={menuRef}
        className={`dashboard-sidebar fixed top-0 left-0 h-screen w-[min(88vw,22rem)] z-50 transform transition-transform duration-300 pt-16 px-4 md:hidden shadow-2xl ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">
            Customer Panel
          </h2>
          <button
            onClick={() => setMenuOpen(false)}
            className="absolute top-4 right-4 text-xl focus:outline-none"
          >
            ✕
          </button>
        </div>
        <nav className="mt-4 mb-10 overflow-y-auto">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={() => setMenuOpen(false)}
                  className={linkClass(item.path)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <SidebarFooter />
      </div>
    </>
  );
};

export default CustomerSidebar;
