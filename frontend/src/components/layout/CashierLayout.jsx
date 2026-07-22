import { Routes, Route } from "react-router-dom";
import CashierSidebar from "../sidebars/CashierSidebar.jsx";

// Pages
import CashierDashboard from "../../pages/cashier/CashierDashboard.jsx";
// import CashierIncomeReport from "../../pages/cashier/CashierIncomeReport.jsx";
// import CashierExpensesReport from "../../pages/cashier/CashierExpensesReport.jsx";
import CashierEmployeeReport from "../../pages/cashier/CashierEmployeeReport.jsx";
// import CashierEmployees from "../../pages/cashier/CashierEmployees.jsx";
// import CashierAdvances from "../../pages/cashier/CashierAdvances.jsx";
import CashierStaffReport from "../../pages/cashier/CashierStaffReport.jsx";
// import CashierLateFeesReport from "../../pages/cashier/CashierLateFeesReport.jsx";
// import CashierTagFeesReport from "../../pages/cashier/CashierTagFeesReport.jsx";

const CashierLayout = () => {
  return (
    <div className="flex h-screen bg-gray-100">
      <CashierSidebar />

      <main className="flex-1 p-6 overflow-y-auto w-full mt-18 ml-[-10px] md:ml-64 md:mt-6">
        <Routes>
          {/* Dashboard */}
          <Route index element={<CashierDashboard />} />
          <Route path="dashboard" element={<CashierDashboard />} />

          {/* Income Reports
          <Route
            path="income-report"
            element={<CashierIncomeReport />}
          /> */}

          {/* Expenses Reports
          <Route
            path="expenses-report"
            element={<CashierExpensesReport />}
          /> */}

          {/* Employees & Advances */}
          <Route
            path="employees"
            element={<CashierEmployeeReport />}
          />

          {/* <Route
            path="advances"
            element={<CashierAdvances />}
          /> */}

          {/* <Route
            path="employees-management"
            element={<CashierEmployees />}
          /> */}

          <Route
            path="employee-report"
            element={<CashierEmployeeReport />}
          />

          {/* Staff Performance */}
          <Route
            path="staff-performance"
            element={<CashierStaffReport />}
          />

          {/* Late Fees Reports */}
          {/* <Route
            path="late-fees-report"
            element={<CashierLateFeesReport />}
          /> */}

          {/* Tag Fees Reports */}
          {/* <Route
            path="tag-fees-report"
            element={<CashierTagFeesReport />}
          /> */}
        </Routes>
      </main>
    </div>
  );
};

export default CashierLayout;