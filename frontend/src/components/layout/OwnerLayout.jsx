import { Routes, Route } from "react-router-dom";
import OwnerSidebar from "../sidebars/OwnerSidebar.jsx";

// Pages
import OwnerDashboard from "../../pages/owner/OwnerDashboard.jsx";
import IncomeReport from "../../pages/owner/OwnerIncomeReport.jsx";
import ExpensesReport from "../../pages/owner/OwnerExpensesReport.jsx";
import EmployeeReport from "../../pages/owner/OwnerEmployeeReport.jsx";
import Employees from "../../pages/owner/OwnerEmployees.jsx";
import Advances from "../../pages/owner/OwnerAdvances.jsx";
import StaffPerformance from "../../pages/owner/OwnerStaffReport.jsx";
import LateFeesReport from "../../pages/owner/OwnerLateFeesReport.jsx";
import TagFeesReport from "../../pages/owner/OwnerTagFeesReport.jsx";
import OwnerSalonReport from "../../pages/owner/OwnerSalonReport.jsx";

const OwnerLayout = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <OwnerSidebar />
      <main className="min-h-screen w-full overflow-x-hidden p-4 pt-20 md:ml-64 md:w-[calc(100%-16rem)] md:p-6">
        <Routes>
          {/* Dashboard */}
          <Route index element={<OwnerDashboard />} />
          <Route path="dashboard" element={<OwnerDashboard />} />

          {/* Income Reports */}
          <Route path="income-report" element={<IncomeReport />} />

          {/* Expenses Reports */}
          <Route path="expenses-report" element={<ExpensesReport />} />

          {/* Employees & Advances */}
          <Route path="employees" element={<EmployeeReport />} />
          <Route path="advances" element={<Advances />} />
          <Route path="employees-management" element={<Employees />} />
          <Route path="employee-report" element={<EmployeeReport />} />
          <Route path="salon-report" element={<OwnerSalonReport />} />

          {/* Staff Performance */}
          <Route path="staff-performance" element={<StaffPerformance />} />

          {/* Late Fees Reports */}
          <Route path="late-fees-report" element={<LateFeesReport />} />

          {/* Tag Fees Reports */}
          <Route path="tag-fees-report" element={<TagFeesReport />} />
        </Routes>
      </main>
    </div>
  );
};

export default OwnerLayout;
