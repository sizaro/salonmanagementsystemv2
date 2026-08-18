import { Routes, Route } from "react-router-dom";
import CashierSidebar from "../sidebars/CashierSidebar.jsx";
import SalonOpeningGate from "../common/SalonOpeningGate.jsx";

// Pages
import CashierDashboard from "../../pages/cashier/CashierDashboard.jsx";
import CashierStaffPayments from "../../pages/cashier/CashierStaffPayments.jsx";
import CashierIncomeReview from "../../pages/cashier/CashierIncomeReview.jsx";
// import CashierIncomeReport from "../../pages/cashier/CashierIncomeReport.jsx";
// import CashierExpensesReport from "../../pages/cashier/CashierExpensesReport.jsx";
// import CashierEmployees from "../../pages/cashier/CashierEmployees.jsx";
// import CashierAdvances from "../../pages/cashier/CashierAdvances.jsx";
// import CashierLateFeesReport from "../../pages/cashier/CashierLateFeesReport.jsx";
// import CashierTagFeesReport from "../../pages/cashier/CashierTagFeesReport.jsx";

const CashierLayout = () => {
  return (
    <SalonOpeningGate><div className="dashboard-shell">
      <CashierSidebar />

      <main className="dashboard-main">
        <Routes>
          {/* Dashboard */}
          <Route index element={<CashierDashboard />} />
          <Route path="dashboard" element={<CashierDashboard />} />
          <Route path="staff-payments" element={<CashierStaffPayments />} />
          <Route path="income-review" element={<CashierIncomeReview />} />

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
    </div></SalonOpeningGate>
  );
};

export default CashierLayout;
