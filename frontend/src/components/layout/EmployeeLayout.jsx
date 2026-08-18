import { Routes, Route } from "react-router-dom";
import EmployeeSidebar from "../sidebars/EmployeeSidebar.jsx";

import EmployeeDashboard from "../../pages/employee/EmployeeDashboard.jsx";
import EmployeeIncomeReport from "../../pages/employee/EmployeeIncomeReport.jsx";

const EmployeeLayout = () => {
  return (
    <div className="dashboard-shell">
      <EmployeeSidebar />

      <main className="dashboard-main">
        <Routes>
          <Route index element={<EmployeeDashboard />} />
          <Route path="dashboard" element={<EmployeeDashboard />} />
          <Route path="income-report" element={<EmployeeIncomeReport />} />
        </Routes>
      </main>
    </div>
  );
};

export default EmployeeLayout;
