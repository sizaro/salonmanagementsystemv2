import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import SidebarFooter from '../common/SidebarFooter';
import { useData } from '../../context/DataContext';

export default function OwnerSidebar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef();
  const location = useLocation();
  const { pendingCount, fetchServiceTransactions } = useData();


  const isActive = (path) => location.pathname === path;
  const linkClass = (path) =>
    `block px-4 py-2 rounded transition-colors ${
      isActive(path) ? 'bg-gray-700 font-semibold' : 'hover:bg-gray-700'
    }`;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  useEffect(()=>{
    fetchServiceTransactions();
  }, [])

  return (
    <>
      {/* Top Mobile Header */}
      <div className="md:hidden bg-gray-900 p-4 flex justify-between items-center text-white fixed top-0 left-0 right-0 z-50">
        <span className="font-bold text-lg">Salon Management</span>
        <div className="relative">
  <Link to="/owner/dashboard" className={linkClass('/owner/dashboard')}>
    pending:

    {/* Pending Badge */}
    {pendingCount > 0 && (
      <span className="top-1/2 -translate-y-1/2 bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
        {pendingCount}
      </span>
    )}
  </Link>
</div>

        <button onClick={() => setMenuOpen(true)} className="text-2xl focus:outline-none">☰</button>
      </div>
      <li className="relative">
  <Link to="/owner/dashboard" className={linkClass('/owner/dashboard')}>
    pending:

    {/* 🔥 Pending Badge */}
    {pendingCount > 0 && (
      <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-red-600 text-white text-xs px-2 py-0.5 list-none rounded-full">
        {pendingCount}
      </span>
    )}
  </Link>
</li>


      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 h-screen bg-gray-900 text-white fixed top-0 left-0 flex-col shadow-lg pt-16">
        <div className="px-6 font-bold text-xl mb-4">Salon Management</div>
        <div className="flex-1 overflow-y-auto px-2">
          <ul className="space-y-1 text-sm">
            <li className="relative">
            <Link to="/owner/dashboard" className={linkClass('/owner/dashboard')}>
              pending:

              {/*Pending Badge */}
              {pendingCount > 0 && (
                <span className="top-1/2 -translate-y-1/2 bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </Link>
          </li>
            <li><Link to="/owner/dashboard" className={linkClass('/owner/dashboard')}>Dashboard</Link></li>
            <li><Link to="/owner/income-report" className={linkClass('/owner/income-report')}>Income Reports</Link></li>
            <li><Link to="/owner/expenses-report" className={linkClass('/owner/expenses-report')}>Expenses Reports</Link></li>
            <li><Link to="/owner/employees-management" className={linkClass('/owner/employee-management')}>Employee Management</Link></li>
            <li><Link to="/owner/employee-report" className={linkClass('/owner/employee-report')}>Employee Report</Link></li>
            <li><Link to="/owner/advances" className={linkClass('/owner/advances')}>Employees Advances</Link></li>
            <li><Link to="/owner/staff-performance" className={linkClass('/owner/staff-performance')}>Staff Performance</Link></li>
            <li><Link to="/owner/late-fees-report" className={linkClass('/owner/late-fees-report')}>Late Fees Reports</Link></li>
            <li><Link to="/owner/tag-fees-report" className={linkClass('/owner/tag-fees-report')}>Tag Fees Reports</Link></li>
            <li className='mt-10'><SidebarFooter /></li>
          </ul>
        </div>
      </aside>

      {/* Mobile Slide-Out Menu */}
      <div
        ref={menuRef}
        className={`fixed top-0 left-0 h-screen w-full bg-gray-900 text-white z-50 transform transition-transform duration-300 pt-16 px-4 md:hidden ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-6 font-bold text-xl mt-0">Salon Management</div>
        <button onClick={() => setMenuOpen(false)} className="absolute top-4 right-4 text-xl focus:outline-none">✕</button>
        <div className="h-full overflow-y-auto mt-6 mb-10">
          <ul className="space-y-1 text-sm">
            <li><Link to="/owner/dashboard" onClick={() => setMenuOpen(false)} className={linkClass('/owner/dashboard')}>Dashboard</Link></li>
            <li><Link to="/owner/income-report" onClick={() => setMenuOpen(false)} className={linkClass('/owner/income-report')}>Income Reports</Link></li>
            <li><Link to="/owner/expenses-report" onClick={() => setMenuOpen(false)} className={linkClass('/owner/expenses-report')}>Expenses Reports</Link></li>
            <li><Link to="/owner/employee-report" onClick={() => setMenuOpen(false)} className={linkClass('/owner/employee-report')}>Employee Report</Link></li>
            <li><Link to="/owner/advances" onClick={() => setMenuOpen(false)} className={linkClass('/owner/advances')}>Employees Advances</Link></li>
            <li><Link to="/owner/staff-performance" onClick={() => setMenuOpen(false)} className={linkClass('/owner/staff-performance')}>Staff Performance</Link></li>
            <li><Link to="/owner/late-fees-report" onClick={() => setMenuOpen(false)} className={linkClass('/owner/late-fees-report')}>Late Fees Reports</Link></li>
            <li><Link to="/owner/tag-fees-report" onClick={() => setMenuOpen(false)} className={linkClass('/owner/tag-fees-report')}>Tag Fees Reports</Link></li>
            <li className='mt-10'><SidebarFooter /></li>
          </ul>
        </div>
      </div>
    </>
  );
}
