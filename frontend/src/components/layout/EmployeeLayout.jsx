import { Routes, Route } from "react-router-dom";
import EmployeeSidebar from "../sidebars/EmployeeSidebar.jsx";

import EmployeeDashboard from "../../pages/employee/EmployeeDashboard.jsx";
import EmployeeIncomeReport from "../../pages/employee/EmployeeIncomeReport.jsx";
import EmployeeFinanceWorkspace from "../../pages/finance/EmployeeFinanceWorkspace.jsx";
import EmployeeProfilePage from "../../pages/employees/EmployeeProfilePage.jsx";

const EmployeeLayout = () => {
  return (
    <div className="dashboard-shell">
      <EmployeeSidebar />

      <main className="dashboard-main">
        <Routes>
          <Route index element={<EmployeeDashboard />} />
          <Route path="dashboard" element={<EmployeeDashboard />} />
          <Route path="income-report" element={<EmployeeIncomeReport />} />
          <Route path="finance" element={<EmployeeFinanceWorkspace />} />
          <Route path="profile" element={<EmployeeProfilePage self />} />
        </Routes>
      </main>
    </div>
  );
};

export default EmployeeLayout;
