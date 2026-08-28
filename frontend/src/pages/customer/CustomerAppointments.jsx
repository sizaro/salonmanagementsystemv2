import { useState, useMemo } from "react";
import { useData } from "../../context/DataContext.jsx";
import Modal from "../../components/Modal.jsx";
import CancelReasonForm from "../../components/CancelReasonForm.jsx";

export default function CustomerAppointments() {
  const { user, users, transactions = [], serviceMaterials = [], updateServiceTransactionAppointment } = useData();
  const [activeTab, setActiveTab] = useState("pending");
  const [actionId, setActionId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [cancelAppointmentId, setCancelAppointmentId] = useState(null);

  // Enrich services with their materials
  const servicesWithMaterials = useMemo(() => {
    return transactions.map((service) => {
      const matchedMaterials = serviceMaterials.filter(
        (m) => m.service_definition_id === service.service_definition_id
      );
      return { ...service, materials: matchedMaterials.length > 0 ? matchedMaterials : [] };
    });
  }, [transactions, serviceMaterials]);

  // The API already limits customer sessions to their own transactions. Avoid
  // comparing portal and legacy transaction IDs a second time in the browser.
  const myAppointments = servicesWithMaterials;

  const formatDate = (dateString) => {
  if (!dateString) return "N/A";

  const [year, month, day] = dateString.split("-").map(Number);

  const date = new Date(year, month - 1, day);
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
        const emp = users.find((u) => Number(u.id) === Number(p.employee_id));
        return emp ? `${p.role_name}: ${emp.first_name} ${emp.last_name}` : null;
      })
      .filter(Boolean)
      .join(", ");
  };

  // Get a readable list of materials for the service
  const getMaterialsList = (appointment) => {
    if (!appointment.materials || appointment.materials.length === 0) return "None";
    return appointment.materials
      .map((material) => material.material_name || material.name)
      .filter(Boolean)
      .join(", ") || "None";
  };

  const filteredByStatus = myAppointments.filter((a) => a.status === activeTab);

  const cancelAppointment = async (appointmentId, status, reason) => {
    try {
      setActionError("");
      setActionId(appointmentId);
      await updateServiceTransactionAppointment(appointmentId, {
        status,
        cancel_reason: reason,
      });
      setActiveTab("cancelled");
    } catch (error) {
      setActionError(error?.response?.data?.message || "The appointment could not be cancelled.");
      throw error;
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="dashboard-page space-y-6">
      <header className="dashboard-hero"><p className="salon-eyebrow text-[var(--salon-copper)]">Your visits</p><h1 className="relative z-10 mt-2 font-serif text-3xl font-semibold sm:text-4xl">
        {user ? `${user.first_name}'s Appointments` : "Your Appointments"}
      </h1><p className="relative z-10 mt-2 text-stone-600">Review upcoming visits and keep a clear record of completed or cancelled bookings.</p></header>

      {/* Tabs */}
      <div className="dashboard-tabs">
        {["pending", "confirmed", "completed", "cancelled"].map((status) => {
          const count = myAppointments.filter((appointment) => appointment.status === status).length;
          return (
          <button
            key={status}
            className={`dashboard-tab ${activeTab === status ? "dashboard-tab-active" : ""} ${status === "pending" && count > 0 ? activeTab === status ? "!border-rose-600 !bg-rose-600 !text-white" : "border-rose-300 bg-rose-50 text-rose-700 ring-1 ring-rose-200" : ""}`}
            onClick={() => setActiveTab(status)}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)} <span className="dashboard-count">{count}</span>
          </button>
          );
        })}
      </div>

      {actionError && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}

      {filteredByStatus.length === 0 ? (
        <div className="dashboard-panel text-center text-gray-600">
          You have no {activeTab} appointments at the moment.
        </div>
      ) : (
        <div className="dashboard-table-wrap">
          <table className="dashboard-table">
            <thead>
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
                {(activeTab === "pending" || activeTab === "confirmed") && <th className="py-3 px-4 text-left font-medium text-gray-700 border-b">Action</th>}

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
                  {(activeTab === "pending" || activeTab === "confirmed") && (
                    <td className="py-3 px-4 border-b">
                      <button
                        type="button"
                        disabled={actionId === appointment.transaction_id}
                        onClick={() => setCancelAppointmentId(appointment.transaction_id)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {actionId === appointment.transaction_id ? "Cancelling…" : "Cancel"}
                      </button>
                    </td>
                  )}

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={Boolean(cancelAppointmentId)} onClose={() => setCancelAppointmentId(null)}>
        <CancelReasonForm
          serviceId={cancelAppointmentId}
          onSubmit={cancelAppointment}
          onClose={() => setCancelAppointmentId(null)}
        />
      </Modal>
    </div>
  );
}
