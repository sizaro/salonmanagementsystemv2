import { Routes, Route } from "react-router-dom";
import CustomerSidebar from "../sidebars/CustomerSidebar.jsx";

import CustomerDashboard from "../../pages/customer/CustomerDashboard.jsx"
import CustomerAppointments from "../../pages/customer/CustomerAppointments.jsx";
import CustomerServiceHistory from "../../pages/customer/CustomerServiceHistory.jsx";
import CustomerSettings from "../../pages/customer/CustomerSettings.jsx";

const CustomerLayout = () => {
  return (
    <div className="dashboard-shell">
      <CustomerSidebar />
      <main className="dashboard-main">
        <Routes>
          {/* Dashboard */}
          <Route index element={<CustomerDashboard />} />
          <Route path="dashboard" element={<CustomerDashboard />} />

          {/* View My Appointments */}
          <Route path="appointments" element={<CustomerAppointments />} />
          <Route path="history" element={<CustomerServiceHistory />} />
          <Route path="settings" element={<CustomerSettings />} />

        </Routes>
      </main>
    </div>
  );
};

export default CustomerLayout;
