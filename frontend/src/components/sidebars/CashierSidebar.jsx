import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import SidebarFooter from "../common/SidebarFooter";
import { useData } from "../../context/DataContext";

export default function CashierSidebar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef();
  const location = useLocation();

  const { pendingCount, fetchServiceTransactions } = useData();

  const isActive = (path) => location.pathname === path;

  const linkClass = (path) =>
    `dashboard-nav-link ${
      isActive(path)
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

    return () =>
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
  }, [menuOpen]);

  useEffect(() => {
    fetchServiceTransactions();
  }, []);

  return (
    <>
      {/* ================= Mobile Header ================= */}
      <div className="dashboard-sidebar md:hidden p-4 flex justify-between items-center fixed top-0 left-0 right-0 z-50">
        <span className="font-bold text-lg">
          Salon Management
        </span>

        <div className="relative">
          <Link
            to="/cashier/dashboard"
            className={linkClass("/cashier/dashboard")}
          >
            Pending:

            {pendingCount > 0 && (
              <span className="top-1/2 -translate-y-1/2 bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </Link>
        </div>

        <button
          onClick={() => setMenuOpen(true)}
          className="text-2xl focus:outline-none"
        >
          ☰
        </button>
      </div>

      {/* ================= Desktop Sidebar ================= */}
      <aside className="dashboard-sidebar hidden md:flex w-64 h-screen fixed top-0 left-0 flex-col shadow-xl pt-12">
        <div className="px-6 font-bold text-xl mb-4">
          Salon Management
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          <ul className="space-y-1 text-sm">

            <li className="relative">
              <Link
                to="/cashier/dashboard"
                className={linkClass("/cashier/dashboard")}
              >
                Pending:

                {pendingCount > 0 && (
                  <span className="top-1/2 -translate-y-1/2 bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </Link>
            </li>

            <li>
              <Link
                to="/cashier/dashboard"
                className={linkClass("/cashier/dashboard")}
              >
                Dashboard
              </Link>
            </li>
            <li><Link to="/cashier/staff-payments" className={linkClass("/cashier/staff-payments")}>Staff Payments</Link></li>
            <li><Link to="/cashier/income-review" className={linkClass("/cashier/income-review")}>Income Review</Link></li>

            <li>
              {/* <Link
                to="/cashier/income-report"
                className={linkClass("/cashier/income-report")}
              >
                Income Reports
              </Link> */}
            </li>

            <li>
              {/* <Link
                to="/cashier/expenses-report"
                className={linkClass("/cashier/expenses-report")}
              >
                Expenses Reports
              </Link> */}
            </li>

            <li>
              {/* <Link
                to="/cashier/employees-management"
                className={linkClass("/cashier/employees-management")}
              >
                Employee Management
              </Link> */}
            </li>

            <li>
              {/* <Link
                to="/cashier/advances"
                className={linkClass("/cashier/advances")}
              >
                Employees Advances
              </Link> */}
            </li>

            {/*
            <li>
              <Link
                to="/cashier/late-fees-report"
                className={linkClass("/cashier/late-fees-report")}
              >
                Late Fees Reports
              </Link>
            </li>

            <li>
              <Link
                to="/cashier/tag-fees-report"
                className={linkClass("/cashier/tag-fees-report")}
              >
                Tag Fees Reports
              </Link>
            </li>
            */}

            <li className="mt-10">
              <SidebarFooter />
            </li>
          </ul>
        </div>
      </aside>

      {/* ================= Mobile Menu ================= */}
      <div
        ref={menuRef}
        className={`dashboard-sidebar fixed top-0 left-0 h-screen w-[min(88vw,22rem)] z-50 transform transition-transform duration-300 pt-16 px-4 md:hidden shadow-2xl ${
          menuOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        <div className="px-6 font-bold text-xl">
          Salon Management
        </div>

        <button
          onClick={() => setMenuOpen(false)}
          className="absolute top-4 right-4 text-xl focus:outline-none"
        >
          ✕
        </button>

        <div className="h-full overflow-y-auto mt-6 mb-10">
          <ul className="space-y-1 text-sm">

            <li>
              <Link
                to="/cashier/dashboard"
                onClick={() => setMenuOpen(false)}
                className={linkClass("/cashier/dashboard")}
              >
                Dashboard
              </Link>
            </li>
            <li><Link to="/cashier/staff-payments" onClick={() => setMenuOpen(false)} className={linkClass("/cashier/staff-payments")}>Staff Payments</Link></li>
            <li><Link to="/cashier/income-review" onClick={() => setMenuOpen(false)} className={linkClass("/cashier/income-review")}>Income Review</Link></li>

            <li>
              {/* <Link
                to="/cashier/income-report"
                onClick={() => setMenuOpen(false)}
                className={linkClass("/cashier/income-report")}
              >
                Income Reports
              </Link> */}
            </li>

            <li>
              {/* <Link
                to="/cashier/expenses-report"
                onClick={() => setMenuOpen(false)}
                className={linkClass("/cashier/expenses-report")}
              >
                Expenses Reports
              </Link> */}
            </li>

            <li>
              {/* <Link
                to="/cashier/employees-management"
                onClick={() => setMenuOpen(false)}
                className={linkClass("/cashier/employees-management")}
              >
                Employee Management
              </Link> */}
            </li>

            <li>
              {/* <Link
                to="/cashier/employee-report"
                onClick={() => setMenuOpen(false)}
                className={linkClass("/cashier/employee-report")}
              >
                Employee Report
              </Link> */}
            </li>

            <li>
              {/* <Link
                to="/cashier/advances"
                onClick={() => setMenuOpen(false)}
                className={linkClass("/cashier/advances")}
              >
                Employees Advances
              </Link> */}
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
