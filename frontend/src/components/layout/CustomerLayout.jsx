import { Routes, Route } from "react-router-dom";
import CustomerSidebar from "../sidebars/CustomerSidebar.jsx";

import CustomerDashboard from "../../pages/customer/CustomerDashboard.jsx"
import CustomerAppointments from "../../pages/customer/CustomerAppointments.jsx";

const CustomerLayout = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <CustomerSidebar />
      <main className="min-h-screen w-full overflow-x-hidden p-4 pt-20 md:ml-64 md:w-[calc(100%-16rem)] md:p-6">
        <Routes>
          {/* Dashboard */}
          <Route index element={<CustomerDashboard />} />
          <Route path="dashboard" element={<CustomerDashboard />} />

          {/* View My Appointments */}
          <Route path="appointments" element={<CustomerAppointments />} />

        </Routes>
      </main>
    </div>
  );
};

export default CustomerLayout;
