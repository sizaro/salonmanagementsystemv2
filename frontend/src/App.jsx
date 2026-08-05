import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/common/ProtectedRoute.jsx";
import PublicLayout from "./layouts/PublicLayout.jsx";
import Home from "./pages/home/index.jsx";
import About from "./pages/about/index.jsx";
import Services from "./pages/services/index.jsx";
import Contact from "./pages/contact/index.jsx";
import Gallery from "./pages/gallery/index.jsx";
import SalonLife from "./pages/salon-life/index.jsx";
import EventsNews from "./pages/events-news/index.jsx";

import ResetPassword from "./pages/landing/ResetPassword.jsx";

import OwnerLayout from "./components/layout/OwnerLayout.jsx";
import ManagerLayout from "./components/layout/ManagerLayout.jsx";
import EmployeeLayout from "./components/layout/EmployeeLayout.jsx";
import CustomerLayout from "./components/layout/CustomerLayout.jsx";

import CashierLayout from "./components/layout/CashierLayout.jsx";


function App() {
  return (
      <Routes>
        {/* Public Landing Routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/services" element={<Services />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/salon-life" element={<SalonLife />} />
          <Route path="/events-news" element={<EventsNews />} />
        </Route>
        {/* Reset Password (public) */}
      <Route path="/reset-password/:token" element={<ResetPassword />} />
        

        {/* Owner Routes */}
        <Route
          path="/owner/*"
          element={
            <ProtectedRoute role="owner">
              <OwnerLayout />
            </ProtectedRoute>
          }
        />

        {/*  Manager Routes */}
        <Route
          path="/manager/*"
          element={
            <ProtectedRoute role="manager">
              <ManagerLayout />
            </ProtectedRoute>
          }
        />

        {/* Employee Routes */}
        <Route
          path="/employee/*"
          element={
            <ProtectedRoute role="employee">
              <EmployeeLayout />
            </ProtectedRoute>
          }
        />

        {/* Customer Routes */}
        <Route
          path="/customer/*"
          element={
            <ProtectedRoute role="customer">
              <CustomerLayout />
            </ProtectedRoute>
          }
        />


        <Route
  path="/cashier/*"
  element={
    <ProtectedRoute role="cashier">
      <CashierLayout />
    </ProtectedRoute>
  }
/>
      </Routes>
  );
}

export default App;
