import { useEffect, useMemo, useState } from "react";
import Modal from "../../components/Modal.jsx";
import ServiceForm from "../../components/ServiceForm";
import CancelReasonForm from "../../components/CancelReasonForm.jsx";
import { useData } from "../../context/DataContext.jsx";

const statuses = ["pending", "confirmed", "completed", "cancelled"];
const formatDate = (value) => value ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "Date not set";
const formatTime = (value) => {
  if (!value) return "Time not set";
  const [hours, minutes] = String(value).slice(0, 5).split(":").map(Number);
  const meridiem = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${meridiem}`;
};

export default function OwnerAppointments() {
  const [activeTab, setActiveTab] = useState("pending");
  const [completingAppointment, setCompletingAppointment] = useState(null);
  const [cancelServiceId, setCancelServiceId] = useState(null);
  const [loadingCompletion, setLoadingCompletion] = useState(false);
  const {
    transactions = [], users = [], serviceDefinitions = [], serviceRoles = [], sections = [],
    fetchUsers, fetchSections, fetchServiceDefinitions, fetchServiceTransactions, fetchServiceTransactionsApp,
    fetchServiceTransactionById, updateServiceTransactionAppointment,
  } = useData();

  useEffect(() => {
    fetchUsers();
    fetchSections();
    fetchServiceDefinitions();
    fetchServiceTransactions();
    fetchServiceTransactionsApp();
    // These provider functions are intentionally loaded once on page entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const employees = useMemo(() => users.filter((user) => ["employee", "manager", "cashier"].includes(String(user.role || "").toLowerCase()) && String(user.status || "active").toLowerCase() !== "inactive"), [users]);
  const owner = useMemo(() => users.find((user) => String(user.role || "").toLowerCase() === "owner"), [users]);
  const customers = useMemo(() => users.filter((user) => String(user.role || "").toLowerCase() === "customer"), [users]);
  const appointments = useMemo(() => transactions.filter((service) => String(service.service_source || "").trim().toLowerCase() === "online_booking" || Boolean(service.appointment_date)), [transactions]);
  const appointmentsByStatus = useMemo(() => Object.fromEntries(statuses.map((status) => [status, appointments.filter((service) => String(service.status || "").toLowerCase() === status)])), [appointments]);
  const activeAppointments = appointmentsByStatus[activeTab] || [];

  const customerName = (service) => {
    if (service.customer_name?.trim()) return service.customer_name.trim();
    const customer = customers.find((entry) => Number(entry.id) === Number(service.active_customer_id ?? service.customer_id));
    return customer ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim() : "Customer not recorded";
  };
  const professionalName = (performer, preferred = false) => {
    const direct = preferred ? `${performer.preferred_first_name || ""} ${performer.preferred_last_name || ""}`.trim() : `${performer.first_name || ""} ${performer.last_name || ""}`.trim();
    if (direct) return direct;
    const id = preferred ? performer.preferred_employee_id : performer.employee_id;
    const employee = employees.find((entry) => Number(entry.id) === Number(id));
    return employee ? `${employee.first_name || ""} ${employee.last_name || ""}`.trim() : null;
  };
  const refreshAppointments = () => Promise.all([fetchServiceTransactions(), fetchServiceTransactionsApp()]);
  const updateStatus = async (serviceId, status, cancel_reason = null) => {
    const service = await fetchServiceTransactionById(serviceId);
    if (!service) return;
    await updateServiceTransactionAppointment(serviceId, { status, cancel_reason, performers: service.performers || [] });
    setCancelServiceId(null);
    if (status !== "cancelled") setActiveTab(status);
    await refreshAppointments();
  };
  const openCompletion = async (serviceId) => {
    try {
      setLoadingCompletion(true);
      const service = await fetchServiceTransactionById(serviceId);
      if (service) setCompletingAppointment(service);
    } finally {
      setLoadingCompletion(false);
    }
  };
  const completeAppointment = async (transactionId, formData) => {
    await updateServiceTransactionAppointment(transactionId, { status: "completed", cancel_reason: null, performers: formData.performers || [] });
    await refreshAppointments();
    setCompletingAppointment(null);
    setActiveTab("completed");
  };

  return <div className="workspace-page space-y-5">
    <header className="workspace-page-header">
      <div><p className="workspace-section-kicker">Client bookings</p><h1>Appointments</h1><p>Review bookings, confirm them, assign actual professionals, and complete the service when it is done.</p></div>
    </header>
    <section className="workspace-data-panel workspace-appointments-panel">
      <div className="workspace-appointment-tabs" role="tablist" aria-label="Appointment status">
        {statuses.map((status) => <button key={status} type="button" role="tab" aria-selected={activeTab === status} onClick={() => setActiveTab(status)} className={activeTab === status ? "workspace-appointment-tab-active" : ""}>{status}<span>{appointmentsByStatus[status]?.length || 0}</span></button>)}
      </div>
      {activeAppointments.length ? <div className="workspace-appointment-list">{activeAppointments.map((service) => {
        const performers = service.performers || [];
        const actual = performers.filter((performer) => performer.employee_id);
        const preferred = performers.filter((performer) => performer.preferred_employee_id);
        const id = service.transaction_id ?? service.id;
        return <article key={id} className="workspace-appointment-card">
          <div className="workspace-appointment-card-header"><div><p>{service.service_name || "Service"}</p><strong>{customerName(service)}</strong></div><span className={`workspace-appointment-status workspace-appointment-status-${String(service.status || "").toLowerCase()}`}>{service.status}</span></div>
          <div className="workspace-appointment-meta"><span>{formatDate(service.appointment_date)}</span><span>{formatTime(service.appointment_time)}</span></div>
          {service.customer_note && <p className="workspace-appointment-note">{service.customer_note}</p>}
          {preferred.length > 0 && <div className="workspace-assignment"><span>Preferred</span><p>{preferred.map((performer) => `${performer.role_name || "Professional"}: ${professionalName(performer, true) || "Not available"}`).join(" · ")}</p></div>}
          {activeTab === "confirmed" && <div className="workspace-assignment"><span>Actual team</span><p>{actual.length ? actual.map((performer) => `${performer.role_name || "Professional"}: ${professionalName(performer) || "Assigned"}`).join(" · ") : "Select the actual professionals before completing this service."}</p></div>}
          {activeTab === "cancelled" && service.cancel_reason && <p className="workspace-appointment-note">Cancellation: {service.cancel_reason}</p>}
          {activeTab === "pending" && <div className="workspace-appointment-actions"><button type="button" className="workspace-confirm-action" onClick={() => updateStatus(id, "confirmed")}>Confirm booking</button><button type="button" className="workspace-delete-action" onClick={() => setCancelServiceId(id)}>Cancel</button></div>}
          {activeTab === "confirmed" && <div className="workspace-appointment-actions"><button type="button" className="workspace-primary-action" disabled={loadingCompletion} onClick={() => openCompletion(id)}>{loadingCompletion ? "Loading…" : "Complete service"}</button><button type="button" className="workspace-delete-action" onClick={() => setCancelServiceId(id)}>Cancel</button></div>}
        </article>;
      })}</div> : <div className="workspace-table-empty">No {activeTab} appointments right now.</div>}
    </section>
    <Modal isOpen={Boolean(completingAppointment)} onClose={() => setCompletingAppointment(null)} sizeClass="max-w-3xl">
      {completingAppointment && <ServiceForm isCustomer={false} onSubmit={completeAppointment} onClose={() => setCompletingAppointment(null)} Services={serviceDefinitions} Roles={serviceRoles} Employees={employees} Sections={sections} createdBy={owner?.id} customerId={completingAppointment.active_customer_id ?? completingAppointment.customer_id} serviceStatus="completed" serviceData={completingAppointment} entryType={completingAppointment.entry_type || "current"} />}
    </Modal>
    <Modal isOpen={Boolean(cancelServiceId)} onClose={() => setCancelServiceId(null)}>
      <CancelReasonForm serviceId={cancelServiceId} onSubmit={updateStatus} onClose={() => setCancelServiceId(null)} />
    </Modal>
  </div>;
}
