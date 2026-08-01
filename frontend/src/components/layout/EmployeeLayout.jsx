import { Routes, Route } from "react-router-dom";
import EmployeeSidebar from "../sidebars/EmployeeSidebar.jsx";

import EmployeeDashboard from "../../pages/employee/EmployeeDashboard.jsx";
import EmployeeIncomeReport from "../../pages/employee/EmployeeIncomeReport.jsx";

const EmployeeLayout = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <EmployeeSidebar />

      <main className="min-h-screen w-full overflow-x-hidden p-4 pt-20 md:ml-64 md:w-[calc(100%-16rem)] md:p-6">
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
