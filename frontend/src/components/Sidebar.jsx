import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

export default function Sidebar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [expensesOpen, setExpensesOpen] = useState(false);
  const [workersOpen, setWorkersOpen] = useState(false);

  const menuRef = useRef();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const linkClass = (path) =>
    `block px-4 py-2 rounded transition-colors ${
      isActive(path) ? "bg-gray-700 font-semibold" : "hover:bg-gray-700"
    }`;

  // Close mobile menu on outside click
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
      <div className="fixed top-0 right-0 left-0 z-50 flex items-center justify-between bg-gray-900 p-4 text-white md:hidden">
        <span className="text-lg font-bold">Salon Management</span>
        <button onClick={() => setMenuOpen(true)} className="text-2xl focus:outline-none">
          ☰
        </button>
      </div>

      {/* Desktop Sidebar */}
      <aside className="fixed top-0 left-0 hidden h-screen w-64 flex-col bg-gray-900 pt-16 text-white shadow-lg md:flex">
        <div className="mb-4 px-6 text-xl font-bold">Salon Management</div>
        <div className="flex-1 overflow-y-auto px-2">
          <ul className="space-y-1 text-sm">
            <li>
              <Link to="/" className={linkClass("/")}>
                Dashboard
              </Link>
            </li>

            {/* Income */}
            <li>
              <div
                onClick={() => setIncomeOpen(!incomeOpen)}
                className="flex cursor-pointer justify-between rounded px-4 py-2 hover:bg-gray-700"
              >
                <span>Income Reports</span>
                <span>{incomeOpen ? "▾" : "▸"}</span>
              </div>
              {incomeOpen && (
                <ul className="mt-1 ml-4 space-y-1">
                  <li>
                    <Link
                      to="/pages/IncomeDailyReport"
                      className={linkClass("/pages/IncomeDailyReport")}
                    >
                      Daily
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/pages/IncomeWeeklyReport"
                      className={linkClass("/pages/IncomeWeeklyReport")}
                    >
                      Weekly
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/pages/IncomeMonthlyReport"
                      className={linkClass("/pages/IncomeMonthlyReport")}
                    >
                      Monthly
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/pages/IncomeYearlyReport"
                      className={linkClass("/pages/IncomeYearlyReport")}
                    >
                      Yearly
                    </Link>
                  </li>
                </ul>
              )}
            </li>

            {/* Expenses */}
            <li>
              <div
                onClick={() => setExpensesOpen(!expensesOpen)}
                className="flex cursor-pointer justify-between rounded px-4 py-2 hover:bg-gray-700"
              >
                <span>Expenses Reports</span>
                <span>{expensesOpen ? "▾" : "▸"}</span>
              </div>
              {expensesOpen && (
                <ul className="mt-1 ml-4 space-y-1">
                  <li>
                    <Link
                      to="/pages/ExpensesDailyReport"
                      className={linkClass("/pages/ExpensesDailyReport")}
                    >
                      Daily
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/pages/ExpensesWeeklyReport"
                      className={linkClass("/pages/ExpensesWeeklyReport")}
                    >
                      Weekly
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/pages/ExpensesMonthlyReport"
                      className={linkClass("/pages/ExpensesMonthlyReport")}
                    >
                      Monthly
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/pages/ExpensesYearlyReport"
                      className={linkClass("/pages/ExpensesYearlyReport")}
                    >
                      Yearly
                    </Link>
                  </li>
                </ul>
              )}
            </li>

            {/* Employees */}

            <li>
              <Link to="/pages/Employees" className={linkClass("/pages/Employees")}>
                Employees
              </Link>
            </li>

            {/* Advances */}

            <li>
              <Link to="/pages/Advances" className={linkClass("/pages/Advances")}>
                Employees Advances
              </Link>
            </li>

            {/* Workers */}
            <li>
              <div
                onClick={() => setWorkersOpen(!workersOpen)}
                className="flex cursor-pointer justify-between rounded px-4 py-2 hover:bg-gray-700"
              >
                <span>Worker Performance</span>
                <span>{workersOpen ? "▾" : "▸"}</span>
              </div>
              {workersOpen && (
                <ul className="mt-1 ml-4 space-y-1">
                  <li>
                    <Link
                      to="/pages/WorkDailyReport"
                      className={linkClass("/pages/WorkDailyReport")}
                    >
                      Daily
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/pages/WorkWeeklyReport"
                      className={linkClass("/pages/WorkWeeklyReport")}
                    >
                      Weekly
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/pages/WorkMonthlyReport"
                      className={linkClass("/pages/WorkMonthlyReport")}
                    >
                      Monthly
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/pages/WorkYearlyReport"
                      className={linkClass("/pages/WorkYearlyReport")}
                    >
                      Yearly
                    </Link>
                  </li>
                </ul>
              )}
            </li>
          </ul>
        </div>
      </aside>

      {/* Mobile Slide-Out Menu */}
      <div
        ref={menuRef}
        className={`fixed top-0 left-0 z-50 h-screen w-full transform bg-gray-900 px-4 pt-16 text-white transition-transform duration-300 sm:hidden ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Close button */}
        <button
          onClick={() => setMenuOpen(false)}
          className="absolute top-4 right-4 text-xl focus:outline-none"
        >
          ✕
        </button>

        <div className="mt-6 h-full overflow-y-auto">
          <ul className="space-y-1 text-sm">
            <li>
              <Link to="/" onClick={() => setMenuOpen(false)} className={linkClass("/")}>
                Dashboard
              </Link>
            </li>

            {/* Income */}
            <li>
              <div
                onClick={() => setIncomeOpen(!incomeOpen)}
                className="flex cursor-pointer justify-between rounded px-4 py-2 hover:bg-gray-700"
              >
                <span>Income Reports</span>
                <span>{incomeOpen ? "▾" : "▸"}</span>
              </div>
              {incomeOpen && (
                <ul className="mt-1 ml-4 space-y-1">
                  <li>
                    <Link
                      to="/pages/IncomeDailyReport"
                      onClick={() => setMenuOpen(false)}
                      className={linkClass("/pages/IncomeDailyReport")}
                    >
                      Daily
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/pages/IncomeWeeklyReport"
                      onClick={() => setMenuOpen(false)}
                      className={linkClass("/pages/IncomeWeeklyReport")}
                    >
                      Weekly
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/pages/IncomeMonthlyReport"
                      onClick={() => setMenuOpen(false)}
                      className={linkClass("/pages/IncomeMonthlyReport")}
                    >
                      Monthly
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/pages/IncomeYearlyReport"
                      onClick={() => setMenuOpen(false)}
                      className={linkClass("/pages/IncomeYearlyReport")}
                    >
                      Yearly
                    </Link>
                  </li>
                </ul>
              )}
            </li>

            {/* Expenses */}
            <li>
              <div
                onClick={() => setExpensesOpen(!expensesOpen)}
                className="flex cursor-pointer justify-between rounded px-4 py-2 hover:bg-gray-700"
              >
                <span>Expenses Reports</span>
                <span>{expensesOpen ? "▾" : "▸"}</span>
              </div>
              {expensesOpen && (
                <ul className="mt-1 ml-4 space-y-1">
                  <li>
                    <Link
                      to="/pages/ExpensesDailyReport"
                      onClick={() => setMenuOpen(false)}
                      className={linkClass("/pages/ExpensesDailyReport")}
                    >
                      Daily
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/pages/ExpensesWeeklyReport"
                      onClick={() => setMenuOpen(false)}
                      className={linkClass("/pages/ExpensesWeeklyReport")}
                    >
                      Weekly
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/pages/ExpensesMonthlyReport"
                      onClick={() => setMenuOpen(false)}
                      className={linkClass("/pages/ExpensesMonthlyReport")}
                    >
                      Monthly
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/pages/ExpensesYearlyReport"
                      onClick={() => setMenuOpen(false)}
                      className={linkClass("/pages/ExpensesYearlyReport")}
                    >
                      Yearly
                    </Link>
                  </li>
                </ul>
              )}
            </li>

            {/* Employees */}
            <li>
              <Link to="/pages/Employees" className={linkClass("/pages/Employees")}>
                Employees
              </Link>
            </li>

            {/* Employees Advances */}
            <li>
              <Link to="/pages/Advances" className={linkClass("/pages/Advances")}>
                Employees Advances
              </Link>
            </li>

            {/* Workers */}
            <li>
              <div
                onClick={() => setWorkersOpen(!workersOpen)}
                className="flex cursor-pointer justify-between rounded px-4 py-2 hover:bg-gray-700"
              >
                <span>Worker Performance</span>
                <span>{workersOpen ? "▾" : "▸"}</span>
              </div>
              {workersOpen && (
                <ul className="mt-1 ml-4 space-y-1">
                  <li>
                    <Link
                      to="/pages/WorkDailyReport"
                      onClick={() => setMenuOpen(false)}
                      className={linkClass("/pages/WorkDailyReport")}
                    >
                      Daily
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/pages/WorkWeeklyReport"
                      onClick={() => setMenuOpen(false)}
                      className={linkClass("/pages/WorkWeeklyReport")}
                    >
                      Weekly
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/pages/WorkMonthlyReport"
                      onClick={() => setMenuOpen(false)}
                      className={linkClass("/pages/WorkMonthlyReport")}
                    >
                      Monthly
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/pages/WorkYearlyReport"
                      onClick={() => setMenuOpen(false)}
                      className={linkClass("/pages/WorkYearlyReport")}
                    >
                      Yearly
                    </Link>
                  </li>
                </ul>
              )}
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
