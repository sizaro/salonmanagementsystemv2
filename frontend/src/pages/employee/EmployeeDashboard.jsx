import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { DateTime } from "luxon";
import { useData } from "../../context/DataContext.jsx";
import Button from "../../components/Button.jsx";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const formatMoney = (amount) => `${Number(amount || 0).toLocaleString()} UGX`;

export default function EmployeeDashboard() {
  const { user, users, services = [], serviceMaterials = [] } = useData();
  const [activeTab, setActiveTab] = useState("pending");
  const [myAppointments, setMyAppointments] = useState([]);
  const [paySummary, setPaySummary] = useState(null);

  // Enrich services with their materials
  const servicesWithMaterials = useMemo(() => {
    return services.map((service) => {
      const matchedMaterials = serviceMaterials.filter(
        (m) => m.service_definition_id === service.service_definition_id
      );
      return { ...service, materials: matchedMaterials.length > 0 ? matchedMaterials : [] };
    });
  }, [services, serviceMaterials]);

  // Filter services where this employee is assigned
  useEffect(() => {
    if (!user || servicesWithMaterials.length === 0) return;

    const assigned = servicesWithMaterials.filter((svc) =>
      (svc.performers || []).some((p) => p.employee_id === user.id)
    );

    setMyAppointments(assigned);
  }, [servicesWithMaterials, user]);

  useEffect(() => {
    if (!user?.id) return;
    const now = DateTime.now().setZone("Africa/Kampala");
    axios.get(`${API_URL}/reports/my-payroll`, {
      params: { period: "monthly", year: now.year, month: now.month },
      withCredentials: true,
    }).then(({ data }) => setPaySummary(data.employee)).catch(() => setPaySummary(null));
  }, [user?.id]);

  // Tab filter
  const filteredByStatus = myAppointments.filter(
    (a) => a.status === activeTab
  );

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-UG", { timeZone: "Africa/Kampala" });
  };

  const formatTime12h = (time24) => {
    if (!time24) return "N/A";
    let [hour, minute] = time24.split(":").map(Number);
    const ampm = hour >= 12 ? "PM" : "AM";
    if (hour === 0) hour = 12;
    else if (hour > 12) hour -= 12;
    return `${hour}:${minute.toString().padStart(2, "0")} ${ampm}`;
  };

  const getCustomerName = (customerId) => {
    const customer = users.find((u) => u.id === customerId);
    return customer ? `${customer.first_name} ${customer.last_name}` : "N/A";
  };

  const getEmployeeRole = (appointment) => {
    const performer = (appointment.performers || []).find((p) => p.employee_id === user.id);
    return performer ? performer.role_name : "N/A";
  };

  const getMaterialsList = (appointment) => {
    if (!appointment.materials || appointment.materials.length === 0) return "None";
    return appointment.materials.map((m) => m.name).join(", ");
  };

  if (!user || !user.id || users.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-600">
        Loading your appointments...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold mb-6">
        {user ? `${user.first_name}'s Appointments` : "Your Appointments"}
      </h1>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="text-lg font-semibold text-slate-900">My pay summary</h2><p className="text-sm text-slate-600">Current month’s completed service earnings.</p></div>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${paySummary?.isClockedIn ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{paySummary?.isClockedIn ? "You are clocked in" : "You are clocked out"}</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Gross earnings</p><p className="mt-1 text-lg font-semibold">{formatMoney(paySummary?.grossSalary)}</p></div>
          <div className="rounded-xl bg-amber-50 p-3"><p className="text-xs uppercase tracking-wide text-amber-700">Advances</p><p className="mt-1 text-lg font-semibold text-amber-800">{formatMoney(paySummary?.advances)}</p></div>
          <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs uppercase tracking-wide text-emerald-700">Net amount</p><p className="mt-1 text-lg font-semibold text-emerald-800">{formatMoney(paySummary?.netSalary)}</p></div>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {["pending", "confirmed"].map((status) => (
          <Button
            key={status}
            className={`px-4 py-2 rounded ${
              activeTab === status
                ? "bg-blue-500 text-white"
                : "bg-green-500 text-gray-700 hover:bg-green-300"
            }`}
            onClick={() => setActiveTab(status)}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Button>
        ))}
      </div>

      {filteredByStatus.length === 0 ? (
        <p className="text-gray-600">No {activeTab} appointments at the moment.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-3 px-4 text-left font-medium text-gray-700 border-b">
                  Service
                </th>
                <th className="py-3 px-4 text-left font-medium text-gray-700 border-b">
                  Customer
                </th>
                <th className="py-3 px-4 text-left font-medium text-gray-700 border-b">
                  Materials
                </th>
                <th className="py-3 px-4 text-left font-medium text-gray-700 border-b">
                  Date
                </th>
                <th className="py-3 px-4 text-left font-medium text-gray-700 border-b">
                  Time
                </th>
                <th className="py-3 px-4 text-left font-medium text-gray-700 border-b">
                  Your Role
                </th>
                <th className="py-3 px-4 text-left font-medium text-gray-700 border-b">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredByStatus.map((appointment) => (
                <tr key={appointment.transaction_id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 border-b">{appointment.service_name || "N/A"}</td>
                  <td className="py-3 px-4 border-b">{getCustomerName(appointment.customer_id)}</td>
                  <td className="py-3 px-4 border-b">{getMaterialsList(appointment)}</td>
                  <td className="py-3 px-4 border-b">{formatDate(appointment.appointment_date)}</td>
                  <td className="py-3 px-4 border-b">{formatTime12h(appointment.appointment_time)}</td>
                  <td className="py-3 px-4 border-b">{getEmployeeRole(appointment)}</td>
                  <td className="py-3 px-4 border-b capitalize">{appointment.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
