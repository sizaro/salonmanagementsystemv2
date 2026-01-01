import { useState, useEffect, useMemo } from "react";
import { useData } from "../../context/DataContext.jsx";

export default function CustomerAppointments() {
  const { user, users, services = [], serviceMaterials = [] } = useData();
  const [myAppointments, setMyAppointments] = useState([]);
  const [activeTab, setActiveTab] = useState("pending");

  // Enrich services with their materials
  const servicesWithMaterials = useMemo(() => {
    return services.map((service) => {
      const matchedMaterials = serviceMaterials.filter(
        (m) => m.service_definition_id === service.service_definition_id
      );
      return { ...service, materials: matchedMaterials.length > 0 ? matchedMaterials : [] };
    });
  }, [services, serviceMaterials]);

  // Filter services for the logged-in customer
  useEffect(() => {
    if (user && servicesWithMaterials.length > 0) {
      const filtered = servicesWithMaterials.filter(
        (service) => service.customer_id === user.id
      );
      setMyAppointments(filtered);
    }
  }, [servicesWithMaterials, user]);

  const formatDate = (dateString) => {
  console.log("date in the page for customer", dateString);
  if (!dateString) return "N/A";

  const [year, month, day] = dateString.split("-").map(Number);

  const date = new Date(year, month - 1, day);
  console.log("date in the customer page", date)

  return date.toLocaleDateString("en-UG");
};


  const formatTime12h = (time24) => {
    if (!time24) return "N/A";
    let [hour, minute] = time24.split(":").map(Number);
    const ampm = hour >= 12 ? "PM" : "AM";
    if (hour === 0) hour = 12;
    else if (hour > 12) hour -= 12;
    return `${hour}:${minute.toString().padStart(2, "0")} ${ampm}`;
  };

  // Get assigned employees from the 'performers' array
  const getAssignedEmployees = (appointment) => {
    if (!appointment.performers || appointment.performers.length === 0) return "N/A";

    return appointment.performers
      .map((p) => {
        const emp = users.find((u) => u.id === p.employee_id);
        return emp ? `${p.role_name}: ${emp.first_name} ${emp.last_name}` : null;
      })
      .filter(Boolean)
      .join(", ");
  };

  // Get a readable list of materials for the service
  const getMaterialsList = (appointment) => {
    if (!appointment.materials || appointment.materials.length === 0) return "None";
    return appointment.materials.map((m) => m.name).join(", ");
  };

  const filteredByStatus = myAppointments.filter((a) => a.status === activeTab);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        {user ? `${user.first_name}'s Appointments` : "Your Appointments"}
      </h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {["pending", "confirmed", "completed", "cancelled"].map((status) => (
          <button
            key={status}
            className={`px-4 py-2 rounded ${
              activeTab === status
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
            onClick={() => setActiveTab(status)}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {filteredByStatus.length === 0 ? (
        <p className="text-gray-600">
          You have no {activeTab} appointments at the moment.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-3 px-4 text-left font-medium text-gray-700 border-b">
                  Service
                </th>
                <th className="py-3 px-4 text-left font-medium text-gray-700 border-b">
                  Description
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
                  Employees Assigned
                </th>
                <th className="py-3 px-4 text-left font-medium text-gray-700 border-b">
                  Status
                </th>
                <th className="py-3 px-4 text-left font-medium text-gray-700 border-b">
                {activeTab === "cancelled" ? "Cancel Reason" : "Customer Note"}
              </th>

              </tr>
            </thead>
            <tbody>
              {filteredByStatus.map((appointment) => (
                <tr key={appointment.transaction_id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 border-b">{appointment.service_name || "N/A"}</td>
                  <td className="py-3 px-4 border-b">{appointment.description || "N/A"}</td>
                  <td className="py-3 px-4 border-b">{getMaterialsList(appointment)}</td>
                  <td className="py-3 px-4 border-b">{formatDate(appointment.appointment_date)}</td>
                  <td className="py-3 px-4 border-b">{formatTime12h(appointment.appointment_time)}</td>
                  <td className="py-3 px-4 border-b">{getAssignedEmployees(appointment)}</td>
                  <td className="py-3 px-4 border-b capitalize">{appointment.status}</td>
                  <td
                    className={`py-3 px-4 border-b ${
                      activeTab === "cancelled" ? "bg-red-100 text-red-800" : ""
                    }`}
                  >
                    {activeTab === "cancelled"
                      ? appointment.cancel_reason || "N/A"
                      : appointment.customer_note || "N/A"}
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
