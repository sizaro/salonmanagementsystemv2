import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Modal from "../../components/Modal.jsx";
import ServiceForm from "../../components/ServiceForm";
import CancelReasonForm from "../../components/CancelReasonForm.jsx";
import { useData } from "../../context/DataContext.jsx";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const defaultAppointmentSettings = {
  opening_time: "08:00",
  closing_time: "23:30",
  slot_interval_minutes: 30,
  minimum_notice_minutes: 60,
  maximum_booking_days: 90,
  customer_cancellation_notice_minutes: 0,
  allow_unassigned_confirmation: true,
};

const statuses = ["pending", "confirmed", "completed", "cancelled"];
const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(
        new Date(value),
      )
    : "Date not set";
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [appointmentSettings, setAppointmentSettings] = useState(defaultAppointmentSettings);
  const [settingsError, setSettingsError] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const {
    transactions = [],
    users = [],
    serviceDefinitions = [],
    serviceRoles = [],
    sections = [],
    fetchUsers,
    fetchSections,
    fetchServiceDefinitions,
    fetchServiceTransactions,
    fetchServiceTransactionsApp,
    fetchServiceTransactionById,
    updateServiceTransactionAppointment,
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

  useEffect(() => {
    let active = true;
    axios
      .get(`${API_URL}/services/appointment-settings`, { withCredentials: true })
      .then((response) => {
        if (active && response.data?.data) {
          setAppointmentSettings((current) => ({ ...current, ...response.data.data }));
        }
      })
      .catch(() => {
        // Booking still uses the server defaults; surface an error only if the
        // owner opens the protected settings panel.
      });
    return () => {
      active = false;
    };
  }, []);

  const employees = useMemo(
    () =>
      users.filter(
        (user) =>
          ["employee", "manager", "cashier"].includes(String(user.role || "").toLowerCase()) &&
          String(user.status || "active").toLowerCase() !== "inactive",
      ),
    [users],
  );
  const owner = useMemo(
    () => users.find((user) => String(user.role || "").toLowerCase() === "owner"),
    [users],
  );
  const customers = useMemo(
    () => users.filter((user) => String(user.role || "").toLowerCase() === "customer"),
    [users],
  );
  const appointments = useMemo(
    () =>
      transactions.filter(
        (service) =>
          String(service.service_source || "")
            .trim()
            .toLowerCase() === "online_booking" || Boolean(service.appointment_date),
      ),
    [transactions],
  );
  const appointmentsByStatus = useMemo(
    () =>
      Object.fromEntries(
        statuses.map((status) => [
          status,
          appointments.filter((service) => String(service.status || "").toLowerCase() === status),
        ]),
      ),
    [appointments],
  );
  const activeAppointments = appointmentsByStatus[activeTab] || [];

  const customerName = (service) => {
    if (service.customer_name?.trim()) return service.customer_name.trim();
    const customer = customers.find(
      (entry) => Number(entry.id) === Number(service.active_customer_id ?? service.customer_id),
    );
    return customer
      ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim()
      : "Customer not recorded";
  };
  const professionalName = (performer, preferred = false) => {
    const direct = preferred
      ? `${performer.preferred_first_name || ""} ${performer.preferred_last_name || ""}`.trim()
      : `${performer.first_name || ""} ${performer.last_name || ""}`.trim();
    if (direct) return direct;
    const id = preferred ? performer.preferred_employee_id : performer.employee_id;
    const employee = employees.find((entry) => Number(entry.id) === Number(id));
    return employee ? `${employee.first_name || ""} ${employee.last_name || ""}`.trim() : null;
  };
  const refreshAppointments = () =>
    Promise.all([fetchServiceTransactions(), fetchServiceTransactionsApp()]);
  const updateStatus = async (serviceId, status, cancel_reason = null) => {
    const service = await fetchServiceTransactionById(serviceId);
    if (!service) return;
    await updateServiceTransactionAppointment(serviceId, {
      status,
      cancel_reason,
      performers: service.performers || [],
    });
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
    await updateServiceTransactionAppointment(transactionId, {
      status: "completed",
      cancel_reason: null,
      performers: formData.performers || [],
    });
    await refreshAppointments();
    setCompletingAppointment(null);
    setActiveTab("completed");
  };
  const saveAppointmentSettings = async (event) => {
    event.preventDefault();
    try {
      setSavingSettings(true);
      setSettingsError("");
      const response = await axios.put(
        `${API_URL}/services/appointment-settings`,
        appointmentSettings,
        { withCredentials: true },
      );
      setAppointmentSettings((current) => ({ ...current, ...(response.data?.data || {}) }));
      setSettingsOpen(false);
    } catch (error) {
      setSettingsError(error?.response?.data?.message || "Could not save appointment settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="workspace-page space-y-5">
      <header className="workspace-page-header">
        <div>
          <p className="workspace-section-kicker">Client bookings</p>
          <h1>Appointments</h1>
          <p>
            Review bookings, confirm them, assign actual professionals, and complete the service
            when it is done.
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
          onClick={() => {
            setSettingsError("");
            setSettingsOpen(true);
          }}
        >
          Booking settings
        </button>
      </header>
      <section className="workspace-data-panel workspace-appointments-panel">
        <div className="workspace-appointment-tabs" role="tablist" aria-label="Appointment status">
          {statuses.map((status) => (
            <button
              key={status}
              type="button"
              role="tab"
              aria-selected={activeTab === status}
              onClick={() => setActiveTab(status)}
              className={activeTab === status ? "workspace-appointment-tab-active" : ""}
            >
              {status}
              <span>{appointmentsByStatus[status]?.length || 0}</span>
            </button>
          ))}
        </div>
        {activeAppointments.length ? (
          <div className="workspace-appointment-list">
            {activeAppointments.map((service) => {
              const performers = service.performers || [];
              const actual = performers.filter((performer) => performer.employee_id);
              const preferred = performers.filter((performer) => performer.preferred_employee_id);
              const id = service.transaction_id ?? service.id;
              return (
                <article key={id} className="workspace-appointment-card">
                  <div className="workspace-appointment-card-header">
                    <div>
                      <p>{service.service_name || "Service"}</p>
                      <strong>{customerName(service)}</strong>
                    </div>
                    <span
                      className={`workspace-appointment-status workspace-appointment-status-${String(service.status || "").toLowerCase()}`}
                    >
                      {service.status}
                    </span>
                  </div>
                  <div className="workspace-appointment-meta">
                    <span>{formatDate(service.appointment_date)}</span>
                    <span>{formatTime(service.appointment_time)}</span>
                  </div>
                  {service.customer_note && (
                    <p className="workspace-appointment-note">{service.customer_note}</p>
                  )}
                  {preferred.length > 0 && (
                    <div className="workspace-assignment">
                      <span>Preferred</span>
                      <p>
                        {preferred
                          .map(
                            (performer) =>
                              `${performer.role_name || "Professional"}: ${professionalName(performer, true) || "Not available"}`,
                          )
                          .join(" · ")}
                      </p>
                    </div>
                  )}
                  {activeTab === "confirmed" && (
                    <div className="workspace-assignment">
                      <span>Actual team</span>
                      <p>
                        {actual.length
                          ? actual
                              .map(
                                (performer) =>
                                  `${performer.role_name || "Professional"}: ${professionalName(performer) || "Assigned"}`,
                              )
                              .join(" · ")
                          : "Select the actual professionals before completing this service."}
                      </p>
                    </div>
                  )}
                  {activeTab === "cancelled" && service.cancel_reason && (
                    <p className="workspace-appointment-note">
                      Cancellation: {service.cancel_reason}
                    </p>
                  )}
                  {activeTab === "pending" && (
                    <div className="workspace-appointment-actions">
                      <button
                        type="button"
                        className="workspace-confirm-action"
                        onClick={() => updateStatus(id, "confirmed")}
                      >
                        Confirm booking
                      </button>
                      <button
                        type="button"
                        className="workspace-delete-action"
                        onClick={() => setCancelServiceId(id)}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {activeTab === "confirmed" && (
                    <div className="workspace-appointment-actions">
                      <button
                        type="button"
                        className="workspace-primary-action"
                        disabled={loadingCompletion}
                        onClick={() => openCompletion(id)}
                      >
                        {loadingCompletion ? "Loading…" : "Complete service"}
                      </button>
                      <button
                        type="button"
                        className="workspace-delete-action"
                        onClick={() => setCancelServiceId(id)}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="workspace-table-empty">No {activeTab} appointments right now.</div>
        )}
      </section>
      <Modal
        isOpen={Boolean(completingAppointment)}
        onClose={() => setCompletingAppointment(null)}
        sizeClass="max-w-3xl"
      >
        {completingAppointment && (
          <ServiceForm
            isCustomer={false}
            onSubmit={completeAppointment}
            onClose={() => setCompletingAppointment(null)}
            Services={serviceDefinitions}
            Roles={serviceRoles}
            Employees={employees}
            Sections={sections}
            createdBy={owner?.id}
            customerId={
              completingAppointment.active_customer_id ?? completingAppointment.customer_id
            }
            serviceStatus="completed"
            serviceData={completingAppointment}
            entryType={completingAppointment.entry_type || "current"}
          />
        )}
      </Modal>
      <Modal isOpen={Boolean(cancelServiceId)} onClose={() => setCancelServiceId(null)}>
        <CancelReasonForm
          serviceId={cancelServiceId}
          onSubmit={updateStatus}
          onClose={() => setCancelServiceId(null)}
        />
      </Modal>
      <Modal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} sizeClass="max-w-xl">
        <form onSubmit={saveAppointmentSettings} className="space-y-5 p-1">
          <div>
            <p className="workspace-section-kicker">Owner configuration</p>
            <h2 className="mt-1 text-xl font-semibold text-stone-900">Booking settings</h2>
            <p className="mt-1 text-sm text-stone-500">
              These rules are applied by the server to every customer booking.
            </p>
          </div>
          {settingsError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{settingsError}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-stone-700">Opening time
              <input type="time" value={String(appointmentSettings.opening_time || "").slice(0, 5)} required onChange={(event) => setAppointmentSettings((current) => ({ ...current, opening_time: event.target.value }))} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
            </label>
            <label className="text-sm font-medium text-stone-700">Closing time
              <input type="time" value={String(appointmentSettings.closing_time || "").slice(0, 5)} required onChange={(event) => setAppointmentSettings((current) => ({ ...current, closing_time: event.target.value }))} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
            </label>
            <label className="text-sm font-medium text-stone-700">Slot interval
              <select value={appointmentSettings.slot_interval_minutes} onChange={(event) => setAppointmentSettings((current) => ({ ...current, slot_interval_minutes: Number(event.target.value) }))} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2">
                <option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>60 minutes</option>
              </select>
            </label>
            <label className="text-sm font-medium text-stone-700">Minimum notice (minutes)
              <input type="number" min="0" max="10080" value={appointmentSettings.minimum_notice_minutes} required onChange={(event) => setAppointmentSettings((current) => ({ ...current, minimum_notice_minutes: Number(event.target.value) }))} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
            </label>
            <label className="text-sm font-medium text-stone-700">Booking horizon (days)
              <input type="number" min="1" max="730" value={appointmentSettings.maximum_booking_days} required onChange={(event) => setAppointmentSettings((current) => ({ ...current, maximum_booking_days: Number(event.target.value) }))} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
            </label>
            <label className="text-sm font-medium text-stone-700">Customer cancellation notice (minutes)
              <input type="number" min="0" max="10080" value={appointmentSettings.customer_cancellation_notice_minutes} required onChange={(event) => setAppointmentSettings((current) => ({ ...current, customer_cancellation_notice_minutes: Number(event.target.value) }))} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
            </label>
          </div>
          <label className="flex items-start gap-3 text-sm text-stone-700">
            <input type="checkbox" checked={Boolean(appointmentSettings.allow_unassigned_confirmation)} onChange={(event) => setAppointmentSettings((current) => ({ ...current, allow_unassigned_confirmation: event.target.checked }))} className="mt-1" />
            <span><strong>Allow unassigned confirmation</strong><br />A customer booking can remain unassigned until the actual service is completed.</span>
          </label>
          <div className="flex justify-end gap-3">
            <button type="button" className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50" onClick={() => setSettingsOpen(false)}>Cancel</button>
            <button type="submit" className="workspace-primary-action" disabled={savingSettings}>{savingSettings ? "Saving…" : "Save settings"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
