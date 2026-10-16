import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3, BriefcaseBusiness, CalendarDays, ChartNoAxesCombined, CircleDollarSign,
  ClipboardList, CreditCard, FileBarChart2, HandCoins, LayoutDashboard, LogOut,
  MoreHorizontal, ReceiptText, Scissors, Settings2, UserRound, UsersRound,
  WalletCards, X,
} from "lucide-react";
import { useData } from "../../context/DataContext.jsx";

const navigationByRole = {
  owner: [
    { path: "/owner/dashboard", label: "Dashboard", icon: LayoutDashboard, primary: true },
    { path: "/owner/employees-management", label: "Employees", icon: UsersRound, primary: true },
    { path: "/owner/finance", label: "Employee Finance", icon: WalletCards, primary: true },
    { path: "/owner/statistics", label: "Statistics", icon: ChartNoAxesCombined, primary: true },
    { path: "/owner/appointments", label: "Appointments", icon: CalendarDays },
    { path: "/owner/setup", label: "Salon Setup", icon: Settings2 },
    { path: "/owner/advances", label: "Advances", icon: HandCoins },
    { path: "/owner/income-report", label: "Income Reports", icon: BarChart3 },
    { path: "/owner/expenses-report", label: "Expense Reports", icon: ReceiptText },
    { path: "/owner/employee-report", label: "Employee Report", icon: FileBarChart2 },
    { path: "/owner/salon-report", label: "Salon Report", icon: ClipboardList },
    { path: "/owner/staff-performance", label: "Staff Performance", icon: BriefcaseBusiness },
    { path: "/owner/intelligence", label: "Goals & Campaigns", icon: Settings2 },
    { path: "/owner/late-fees-report", label: "Late Fees Report", icon: CircleDollarSign },
    { path: "/owner/tag-fees-report", label: "Tag Fees Report", icon: CreditCard },
  ],
  manager: [
    { path: "/manager/dashboard", label: "Dashboard", icon: LayoutDashboard, primary: true },
    { path: "/manager/employees-management", label: "Employees", icon: UsersRound, primary: true },
    { path: "/manager/finance", label: "Employee Finance", icon: WalletCards, primary: true },
    { path: "/manager/statistics", label: "Statistics", icon: ChartNoAxesCombined, primary: true },
    { path: "/manager/staff-performance", label: "Staff Performance", icon: BriefcaseBusiness },
    { path: "/manager/staff-finance", label: "Staff Finance", icon: HandCoins },
    { path: "/manager/income-review", label: "Daily Services", icon: BarChart3 },
  ],
  employee: [
    { path: "/employee/dashboard", label: "Dashboard", icon: LayoutDashboard, primary: true },
    { path: "/employee/finance", label: "My Finance", icon: WalletCards, primary: true },
    { path: "/employee/income-report", label: "Income", icon: BarChart3, primary: true },
    { path: "/employee/profile", label: "My Profile", icon: UserRound, primary: true },
  ],
  cashier: [
    { path: "/cashier/dashboard", label: "Dashboard", icon: LayoutDashboard, primary: true },
    { path: "/cashier/staff-payments", label: "Staff Payments", icon: WalletCards, primary: true },
    { path: "/cashier/income-review", label: "Income Review", icon: BarChart3, primary: true },
    { path: "/cashier/staff-finance", label: "Staff Finance", icon: HandCoins, primary: true },
  ],
  customer: [
    { path: "/customer/dashboard", label: "Dashboard", icon: LayoutDashboard, primary: true },
    { path: "/customer/appointments", label: "Appointments", icon: CalendarDays, primary: true },
    { path: "/customer/history", label: "Service History", icon: Scissors, primary: true },
    { path: "/customer/settings", label: "Settings", icon: Settings2, primary: true },
  ],
};

const isCurrent = (pathname, path) => pathname === path || pathname.startsWith(`${path}/`);

function NavLink({ item, active, onNavigate, badge = 0, compact = false }) {
  const Icon = item.icon;
  return <Link to={item.path} onClick={onNavigate} aria-current={active ? "page" : undefined} className={`workspace-nav-link ${active ? "workspace-nav-link-active" : ""} ${compact ? "workspace-nav-link-compact" : ""}`}>
    <span className="workspace-nav-icon"><Icon aria-hidden="true" size={compact ? 19 : 21} /></span>
    <span className="workspace-nav-label">{item.label}</span>
    {badge > 0 && <span className="workspace-nav-badge" aria-label={`${badge} pending appointments`}>{badge > 99 ? "99+" : badge}</span>}
  </Link>;
}

export default function WorkspaceNavigation({ role }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logoutUser, pendingCount = 0, fetchServiceTransactions, user } = useData();
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const desktopRef = useRef(null);
  const mobileRef = useRef(null);
  const items = navigationByRole[role] || [];
  const primaryItems = items.filter((item) => item.primary).slice(0, 4);
  const moreItems = items.filter((item) => !primaryItems.includes(item));
  const desktopItems = items.slice(0, 6);
  const desktopMoreItems = items.slice(6);
  const ownerOrCashier = role === "owner" || role === "cashier";
  const title = role === "employee" && user?.last_name ? `${user.last_name}'s workspace` : "Salehish workspace";
  const moreIsActive = moreItems.some((item) => isCurrent(location.pathname, item.path));

  useEffect(() => {
    if (ownerOrCashier) fetchServiceTransactions();
    // The context exposes a fresh fetch function on each provider render.
    // Navigation should load this indicator once per mounted workspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerOrCashier]);

  useEffect(() => {
    const onPointerDown = (event) => {
      const inDesktop = desktopRef.current?.contains(event.target);
      const inMobile = mobileRef.current?.contains(event.target);
      if (!inDesktop && !inMobile) {
        setMoreOpen(false);
        setAccountOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setMoreOpen(false);
        setAccountOpen(false);
      }
    };
    if (moreOpen || accountOpen) { document.addEventListener("mousedown", onPointerDown); document.addEventListener("keydown", onKeyDown); }
    return () => { document.removeEventListener("mousedown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [moreOpen, accountOpen]);

  const logout = async () => { setMoreOpen(false); setAccountOpen(false); await logoutUser(); navigate("/"); };
  const closeMore = () => setMoreOpen(false);
  const isDashboard = (item) => item.path.endsWith("/dashboard");

  return <nav className="workspace-navigation" aria-label={`${title} navigation`}>
    <div className="workspace-dock" ref={desktopRef}>
      <button type="button" className="workspace-dock-brand workspace-account-trigger" onClick={() => { setAccountOpen((open) => !open); setMoreOpen(false); }} aria-expanded={accountOpen} aria-controls={`workspace-account-${role}`}><img src="/salehishicon.webp" alt="" /><span className="workspace-dock-brand-copy"><strong>Salehish</strong><small>{role} workspace</small></span></button>
      <div className="workspace-dock-links">{desktopItems.map((item) => <NavLink key={item.path} item={item} active={isCurrent(location.pathname, item.path)} badge={isDashboard(item) && ownerOrCashier ? pendingCount : 0} />)}
        {desktopMoreItems.length > 0 && <button type="button" className={`workspace-nav-link workspace-more-trigger ${moreOpen || moreIsActive ? "workspace-nav-link-active" : ""}`} onClick={() => { setMoreOpen((open) => !open); setAccountOpen(false); }} aria-expanded={moreOpen} aria-controls={`workspace-desktop-more-${role}`}><span className="workspace-nav-icon"><MoreHorizontal aria-hidden="true" size={21} /></span><span className="workspace-nav-label">More</span></button>}
      </div>
      {accountOpen && <section id={`workspace-account-${role}`} className="workspace-account-panel" aria-label="Workspace account menu"><div className="workspace-account-summary"><span className="workspace-account-icon"><UserRound aria-hidden="true" size={18} /></span><div><p>Signed in to</p><strong>Salehish {role} workspace</strong></div></div><button type="button" className="workspace-account-logout" onClick={logout}><LogOut aria-hidden="true" size={18} />Log out</button></section>}
      {moreOpen && desktopMoreItems.length > 0 && <section id={`workspace-desktop-more-${role}`} className="workspace-more-panel" aria-label="More navigation options"><div className="workspace-more-panel-heading"><div><p>More tools</p><strong>Everything you can access</strong></div><button type="button" onClick={closeMore} aria-label="Close more navigation"><X size={19} /></button></div><div className="workspace-more-grid">{desktopMoreItems.map((item) => <NavLink key={item.path} item={item} active={isCurrent(location.pathname, item.path)} onNavigate={closeMore} compact />)}</div></section>}
    </div>
    <div className="workspace-mobile-nav" ref={mobileRef}>{primaryItems.map((item) => <NavLink key={item.path} item={item} active={isCurrent(location.pathname, item.path)} onNavigate={closeMore} badge={isDashboard(item) && ownerOrCashier ? pendingCount : 0} compact />)}
      <button type="button" className={`workspace-nav-link workspace-more-trigger workspace-nav-link-compact ${moreOpen || moreIsActive ? "workspace-nav-link-active" : ""}`} onClick={() => setMoreOpen((open) => !open)} aria-expanded={moreOpen} aria-controls={`workspace-mobile-more-${role}`}><span className="workspace-nav-icon"><MoreHorizontal aria-hidden="true" size={19} /></span><span className="workspace-nav-label">More</span></button>
      {moreOpen && <section id={`workspace-mobile-more-${role}`} className="workspace-mobile-more" aria-label="More navigation options"><div className="workspace-more-panel-heading"><div><p>{title}</p><strong>More tools</strong></div><button type="button" onClick={closeMore} aria-label="Close more navigation"><X size={19} /></button></div><div className="workspace-more-grid">{moreItems.map((item) => <NavLink key={item.path} item={item} active={isCurrent(location.pathname, item.path)} onNavigate={closeMore} compact />)}</div><button type="button" className="workspace-mobile-logout" onClick={logout}><LogOut size={18} />Log out</button></section>}
    </div>
  </nav>;
}
