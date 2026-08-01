// src/layouts/ManagerLayout.jsx
import { Routes, Route } from "react-router-dom";
import ManagerSidebar from "../sidebars/ManagerSidebar.jsx";

// Pages (Manager Equivalents)
import ManagerDashboard from "../../pages/manager/ManagerDashboard.jsx";
import IncomeReport from "../../pages/manager/ManagerIncomeReport.jsx";
import ExpensesReport from "../../pages/manager/ManagerExpensesReport.jsx";
import EmployeeReport from "../../pages/manager/ManagerEmployeeReport.jsx";
import Employees from "../../pages/manager/ManagerEmployees.jsx";
import Advances from "../../pages/manager/ManagerAdvances.jsx";
import StaffPerformance from "../../pages/owner/OwnerStaffReport.jsx";
import LateFeesReport from "../../pages/manager/ManagerLateFeesReport.jsx";
import TagFeesReport from "../../pages/manager/ManagerTagFeesReport.jsx";

const ManagerLayout = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <ManagerSidebar />
      <main className="min-h-screen w-full overflow-x-hidden p-4 pt-20 md:ml-64 md:w-[calc(100%-16rem)] md:p-6">
        <Routes>

          {/* Dashboard */}
          <Route index element={<ManagerDashboard />} />
          <Route path="dashboard" element={<ManagerDashboard />} />

          {/* Income Reports */}
          {/* Employee operations */}
          <Route path="employees-management" element={<Employees />} />

          {/* Staff Performance */}
          <Route path="staff-performance" element={<StaffPerformance />} />

        </Routes>
      </main>
    </div>
  );
};

export default ManagerLayout;
