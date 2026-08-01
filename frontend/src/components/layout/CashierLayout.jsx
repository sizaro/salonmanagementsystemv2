import { Routes, Route } from "react-router-dom";
import CashierSidebar from "../sidebars/CashierSidebar.jsx";

// Pages
import CashierDashboard from "../../pages/cashier/CashierDashboard.jsx";
import CashierStaffPayments from "../../pages/cashier/CashierStaffPayments.jsx";
// import CashierIncomeReport from "../../pages/cashier/CashierIncomeReport.jsx";
// import CashierExpensesReport from "../../pages/cashier/CashierExpensesReport.jsx";
// import CashierEmployees from "../../pages/cashier/CashierEmployees.jsx";
// import CashierAdvances from "../../pages/cashier/CashierAdvances.jsx";
// import CashierLateFeesReport from "../../pages/cashier/CashierLateFeesReport.jsx";
// import CashierTagFeesReport from "../../pages/cashier/CashierTagFeesReport.jsx";

const CashierLayout = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <CashierSidebar />

      <main className="min-h-screen w-full overflow-x-hidden p-4 pt-20 md:ml-64 md:w-[calc(100%-16rem)] md:p-6">
        <Routes>
          {/* Dashboard */}
          <Route index element={<CashierDashboard />} />
          <Route path="dashboard" element={<CashierDashboard />} />
          <Route path="staff-payments" element={<CashierStaffPayments />} />

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
