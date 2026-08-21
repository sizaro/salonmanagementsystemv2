import { useEffect, useMemo, useState } from "react";

import Modal from "../../components/Modal.jsx";
import ServiceForm from "../../components/ServiceForm";
import ExpenseForm from "../../components/ExpenseForm";
import AdvanceForm from "../../components/AdvanceForm";
import ClockForm from "../../components/ClockForm";
import CancelReasonForm from "../../components/CancelReasonForm.jsx";

import { useData } from "../../context/DataContext.jsx";

export default function CashierDashboard() {
  // ======================================================
  // STATIC FILE BASE URL
  // ======================================================

  const staticBaseUrl =
    import.meta.env.MODE === "development"
      ? "http://localhost:5500"
      : "https://salonmanagementsystemv2-ru0i.onrender.com";

  // ======================================================
  // LOCAL STATE
  // ======================================================

  const [modalType, setModalType] = useState(null);

  const [showCancelModal, setShowCancelModal] = useState(false);

  const [cancelServiceId, setCancelServiceId] = useState(null);

  const [activeTab, setActiveTab] = useState("pending");

  const [completingAppointment, setCompletingAppointment] = useState(null);

  const [loadingCompletion, setLoadingCompletion] = useState(false);

  // ======================================================
  // DATA CONTEXT
  // ======================================================

  const {
    transactions = [],

    sendFormData,

    activeClockings = [],

    fetchActiveClockings,

    users = [],

    fetchUsers,

    serviceDefinitions = [],

    serviceMaterials = [],

    serviceRoles = [],

    sections = [],

    fetchSections,

    fetchServiceDefinitions,

    fetchServiceMaterials,

    createServiceTransaction,

    fetchServiceTransactions,

    fetchServiceTransactionsApp,

    fetchServiceTransactionById,

    updateServiceTransactionAppointment,
  } = useData();

  // ======================================================
  // SERVICES WITH MATERIALS
  // ======================================================

  const servicesWithMaterials = useMemo(() => {
    return (transactions || []).map((service) => {
      const matchedMaterials = (serviceMaterials || []).filter(
        (material) =>
          Number(material.service_definition_id) ===
          Number(service.service_definition_id),
      );

      return {
        ...service,

        materials:
          matchedMaterials.length > 0
            ? matchedMaterials
            : service.materials || [],
      };
    });
  }, [transactions, serviceMaterials]);

  // ======================================================
  // ACTIVE EMPLOYEES
  // ======================================================

  const Employees = useMemo(() => {
    return (users || []).filter((user) => {
      const role = String(user.role || "")
        .trim()
        .toLowerCase();

      const status = String(user.status || "active")
        .trim()
        .toLowerCase();

      return (
        ["employee", "manager", "cashier"].includes(role) &&
        status !== "inactive"
      );
    });
  }, [users]);

  // ======================================================
  // CUSTOMERS
  // ======================================================

  const Customers = useMemo(() => {
    return (users || []).filter(
      (user) =>
        String(user.role || "")
          .trim()
          .toLowerCase() === "customer",
    );
  }, [users]);

  // ======================================================
  // OWNER ID
  // ======================================================
  //
  // Your backend now controls created_by using req.user,
  // so this value is not trusted by the backend anyway.
  //
  // It is kept because ServiceForm currently accepts
  // createdBy as a prop.
  // ======================================================

  const createdbyID = useMemo(() => {
    return (users || []).find(
      (user) =>
        String(user.role || "")
          .trim()
          .toLowerCase() === "owner",
    );
  }, [users]);

  // ======================================================
  // FORMAT APPOINTMENT TIME
  // ======================================================

  const formatTime12h = (time24) => {
    if (!time24) return "N/A";

    const value = String(time24).slice(0, 5);

    let [hour, minute] = value.split(":").map(Number);

    const ampm = hour >= 12 ? "PM" : "AM";

    if (hour === 0) {
      hour = 12;
    } else if (hour > 12) {
      hour -= 12;
    }

    return `${hour}:${String(minute).padStart(2, "0")} ${ampm}`;
  };

  // ======================================================
  // FORMAT DATE
  // ======================================================

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";

    const value = String(dateString).slice(0, 10);

    const [year, month, day] = value.split("-");

    if (!year || !month || !day) {
      return value;
    }

    return `${day}/${month}/${year}`;
  };

  // ======================================================
  // CUSTOMER NAME
  // ======================================================

  const getCustomerName = (service) => {
    if (service.customer_name?.trim()) {
      return service.customer_name.trim();
    }

    const customer = Customers.find(
      (entry) =>
        Number(entry.id) ===
        Number(service.active_customer_id ?? service.customer_id),
    );

    if (!customer) {
      return "N/A";
    }

    return `${customer.first_name || ""} ${customer.last_name || ""}`.trim();
  };

  // ======================================================
  // DETERMINE WHETHER TRANSACTION IS AN APPOINTMENT
  // ======================================================
  //
  // New transactions:
  //
  // service_source = online_booking
  //
  // Older transactions may still have service_source NULL.
  // appointment_date therefore remains our legacy fallback.
  //
  // This is VERY important now that normal walk-in services
  // also have status = completed.
  // ======================================================

  const isAppointment = (service) => {
    const source = String(service.service_source || "")
      .trim()
      .toLowerCase();

    return source === "online_booking" || Boolean(service.appointment_date);
  };

  // ======================================================
  // APPOINTMENTS ONLY
  // ======================================================

  const appointmentTransactions = useMemo(() => {
    return servicesWithMaterials.filter(isAppointment);
  }, [servicesWithMaterials]);

  // ======================================================
  // APPOINTMENTS BY STATUS
  // ======================================================

  const appointmentsByStatus = useMemo(() => {
    return {
      pending: appointmentTransactions.filter(
        (service) =>
          String(service.status || "")
            .trim()
            .toLowerCase() === "pending",
      ),

      confirmed: appointmentTransactions.filter(
        (service) =>
          String(service.status || "")
            .trim()
            .toLowerCase() === "confirmed",
      ),

      completed: appointmentTransactions.filter(
        (service) =>
          String(service.status || "")
            .trim()
            .toLowerCase() === "completed",
      ),

      cancelled: appointmentTransactions.filter(
        (service) =>
          String(service.status || "")
            .trim()
            .toLowerCase() === "cancelled",
      ),
    };
  }, [appointmentTransactions]);

  // ======================================================
  // GET ACTUAL PROFESSIONAL NAME
  // ======================================================

  const getActualProfessionalName = (performer) => {
    const name = `${performer.first_name || ""} ${
      performer.last_name || ""
    }`.trim();

    return name || null;
  };

  // ======================================================
  // GET CUSTOMER PREFERRED PROFESSIONAL NAME
  // ======================================================

  const getPreferredProfessionalName = (performer) => {
    // If backend already returned preferred employee names,
    // use them directly.

    const directName = `${performer.preferred_first_name || ""} ${
      performer.preferred_last_name || ""
    }`.trim();

    if (directName) {
      return directName;
    }

    // Otherwise resolve using preferred_employee_id
    // against users already loaded in DataContext.

    if (!performer.preferred_employee_id) {
      return null;
    }

    const employee = Employees.find(
      (entry) => Number(entry.id) === Number(performer.preferred_employee_id),
    );

    if (!employee) {
      return null;
    }

    return `${employee.first_name || ""} ${employee.last_name || ""}`.trim();
  };

  // ======================================================
  // CLOSE MAIN MODAL
  // ======================================================

  const closeModal = () => {
    setModalType(null);

    setCompletingAppointment(null);
  };

  // ======================================================
  // CREATE EXPENSE
  // ======================================================

  const createExpense = async (formData) => {
    try {
      await sendFormData("createExpense", formData);

      closeModal();
    } catch (error) {
      console.error(
        "Failed to submit expense:",
        error.response?.data || error.message,
      );
    }
  };

  // ======================================================
  // CREATE ADVANCE
  // ======================================================

  const createAdvance = async (formData) => {
    try {
      await sendFormData("createAdvance", formData);

      closeModal();
    } catch (error) {
      console.error(
        "Failed to submit advance:",
        error.response?.data || error.message,
      );
    }
  };

  // ======================================================
  // EMPLOYEE CLOCKING
  // ======================================================

  const handleClocking = async (type, formData) => {
    try {
      let result;

      if (type === "clockin") {
        result = await sendFormData("createClocking", formData);
      } else if (type === "clockout") {
        result = await sendFormData("updateClocking", formData);
      } else {
        throw new Error("Invalid clocking type");
      }

      await fetchActiveClockings();

      return result;
    } catch (error) {
      console.error(
        "Error handling clocking:",
        error.response?.data || error.message,
      );

      throw error;
    }
  };

  // ======================================================
  // INITIAL DATA
  // ======================================================

  useEffect(() => {
    fetchUsers();

    fetchSections();

    fetchServiceDefinitions();

    fetchServiceMaterials();

    fetchServiceTransactions();

    fetchActiveClockings();
  }, []);

  // ======================================================
  // REFRESH APPOINTMENT DATA
  // ======================================================

  const refreshAppointments = async () => {
    await Promise.all([
      fetchServiceTransactions(),
      fetchServiceTransactionsApp(),
    ]);
  };

  // ======================================================
  // CONFIRM / CANCEL APPOINTMENT
  // ======================================================
  //
  // IMPORTANT:
  //
  // Pending -> Confirmed
  //
  // DOES NOT require actual employee_id values.
  //
  // Customer preferences stay as preferred_employee_id.
  //
  // Actual worker assignment happens when completing.
  // ======================================================

  const handleAppointmentStatus = async (
    serviceId,
    newStatus,
    cancel_reason = null,
  ) => {
    try {
      const service = await fetchServiceTransactionById(serviceId);

      if (!service) {
        return;
      }

      await updateServiceTransactionAppointment(serviceId, {
        status: newStatus,

        cancel_reason,

        performers: service.performers || [],
      });

      if (newStatus !== "cancelled") {
        setActiveTab(newStatus);
      }

      await refreshAppointments();
    } catch (error) {
      console.error(
        "Failed to update appointment:",
        error.response?.data || error.message,
      );
    }
  };

  // ======================================================
  // OPEN APPOINTMENT COMPLETION FORM
  // ======================================================
  //
  // Clicking "Complete Service" MUST NOT directly change
  // confirmed -> completed anymore.
  //
  // We first load the complete appointment and then open
  // ServiceForm in administrative mode.
  // ======================================================

  const handleOpenCompletion = async (serviceId) => {
    try {
      setLoadingCompletion(true);

      const appointment = await fetchServiceTransactionById(serviceId);

      if (!appointment) {
        throw new Error("Appointment could not be loaded");
      }

      console.log("CASHIER COMPLETION APPOINTMENT:", appointment);

      setCompletingAppointment(appointment);

      setModalType("complete_appointment");
    } catch (error) {
      console.error(
        "Unable to load appointment for completion:",
        error.response?.data || error.message,
      );
    } finally {
      setLoadingCompletion(false);
    }
  };

  // ======================================================
  // COMPLETE APPOINTMENT
  // ======================================================
  //
  // ServiceForm will require all actual employee IDs because
  // isCustomer = false.
  //
  // It passes:
  //
  // onSubmit(transactionId, payload)
  //
  // We send the actual performers through the appointment
  // completion endpoint.
  // ======================================================

  const handleCompleteAppointment = async (transactionId, formData) => {
    try {
      const payload = {
        status: "completed",

        cancel_reason: null,

        performers: formData.performers || [],
      };

      console.log("CASHIER COMPLETING APPOINTMENT:", {
        transactionId,
        payload,
      });

      const result = await updateServiceTransactionAppointment(
        transactionId,
        payload,
      );

      await refreshAppointments();

      setActiveTab("completed");

      closeModal();

      return result;
    } catch (error) {
      console.error(
        "Failed to complete appointment:",
        error.response?.data || error.message,
      );

      throw error;
    }
  };

  // ======================================================
  // SERVICE DEFINITION HELPERS
  // ======================================================

  const getRolesFromDef = (definition) =>
    definition.roles || definition.service_roles || definition.role_list || [];

  const getMaterialsFromDef = (definition) =>
    definition.materials ||
    definition.service_materials ||
    definition.material_list ||
    [];

  const sumRolesAmount = (roles) =>
    Array.isArray(roles)
      ? roles.reduce(
          (sum, role) =>
            sum +
            (parseFloat(
              role.amount || role.role_amount || role.earned_amount || 0,
            ) || 0),
          0,
        )
      : 0;

  const sumMaterialsCost = (materials) =>
    Array.isArray(materials)
      ? materials.reduce(
          (sum, material) =>
            sum +
            (parseFloat(material.cost || material.material_cost || 0) || 0),
          0,
        )
      : 0;

  // ======================================================
  // CURRENT TAB
  // ======================================================

  const currentAppointments = appointmentsByStatus[activeTab] || [];

  // ======================================================
  // UI
  // ======================================================

  return (
    <div className="dashboard-page space-y-6">
      {/* ==================================================
          CASHIER QUICK ACTIONS
      ================================================== */}

      <section className="dashboard-panel">
        <div className="mb-5">
          <p className="salon-eyebrow text-[var(--salon-copper)]">
            Cashier workspace
          </p>

          <h2 className="mt-1 font-serif text-2xl font-semibold text-[var(--salon-ink)]">
            Quick Actions
          </h2>

          <p className="mt-1 text-sm text-stone-500">
            Record daily salon activity and manage staff operations from one
            place.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* SERVICE OPERATIONS */}

          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
                Services
              </p>

              <h3 className="mt-1 font-semibold text-stone-900">
                Service Operations
              </h3>

              <p className="mt-1 text-sm text-stone-500">
                Record services performed for salon customers.
              </p>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setModalType("service")}
                className="
                  group
                  flex
                  w-full
                  items-center
                  justify-between
                  rounded-xl
                  border
                  border-stone-200
                  bg-white
                  px-4
                  py-3.5
                  text-left
                  transition
                  hover:border-[var(--salon-copper)]
                  hover:bg-stone-50
                  hover:shadow-sm
                "
              >
                <span>
                  <span className="block text-sm font-semibold text-stone-800">
                    Add Service
                  </span>

                  <span className="mt-0.5 block text-xs text-stone-500">
                    Record a completed walk-in service
                  </span>
                </span>

                <span className="text-xl text-stone-400 transition group-hover:translate-x-1 group-hover:text-[var(--salon-copper)]">
                  →
                </span>
              </button>
            </div>
          </div>

          {/* STAFF / FINANCE */}

          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
                Staff & Finance
              </p>

              <h3 className="mt-1 font-semibold text-stone-900">
                Daily Records
              </h3>

              <p className="mt-1 text-sm text-stone-500">
                Record staff clocking, salon expenses and employee advances.
              </p>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setModalType("clocking")}
                className="group flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3.5 text-left transition hover:border-[var(--salon-copper)] hover:bg-stone-50 hover:shadow-sm"
              >
                <span>
                  <span className="block text-sm font-semibold text-stone-800">
                    Employee Clocking
                  </span>

                  <span className="mt-0.5 block text-xs text-stone-500">
                    Clock employees in or out
                  </span>
                </span>

                <span className="text-xl text-stone-400 transition group-hover:translate-x-1 group-hover:text-[var(--salon-copper)]">
                  →
                </span>
              </button>

              <button
                type="button"
                onClick={() => setModalType("expense")}
                className="group flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3.5 text-left transition hover:border-[var(--salon-copper)] hover:bg-stone-50 hover:shadow-sm"
              >
                <span>
                  <span className="block text-sm font-semibold text-stone-800">
                    Add Expense
                  </span>

                  <span className="mt-0.5 block text-xs text-stone-500">
                    Record a salon operating expense
                  </span>
                </span>

                <span className="text-xl text-stone-400 transition group-hover:translate-x-1 group-hover:text-[var(--salon-copper)]">
                  →
                </span>
              </button>

              <button
                type="button"
                onClick={() => setModalType("advance")}
                className="group flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3.5 text-left transition hover:border-[var(--salon-copper)] hover:bg-stone-50 hover:shadow-sm"
              >
                <span>
                  <span className="block text-sm font-semibold text-stone-800">
                    Add Advance
                  </span>

                  <span className="mt-0.5 block text-xs text-stone-500">
                    Record an employee salary advance
                  </span>
                </span>

                <span className="text-xl text-stone-400 transition group-hover:translate-x-1 group-hover:text-[var(--salon-copper)]">
                  →
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================
          APPOINTMENTS
      ================================================== */}

      <section className="dashboard-panel">
        <div className="mb-5">
          <p className="salon-eyebrow text-[var(--salon-copper)]">
            Client bookings
          </p>

          <h2 className="mt-1 font-serif text-2xl font-semibold text-[var(--salon-ink)]">
            Appointments
          </h2>

          <p className="mt-1 text-sm text-stone-500">
            Confirm bookings, review customer preferences and record the actual
            professionals when the service is completed.
          </p>
        </div>

        {/* APPOINTMENT TABS */}

        <div className="dashboard-tabs mb-5">
          {["pending", "confirmed", "completed", "cancelled"].map((status) => (
            <button
              key={status}
              type="button"
              className={`dashboard-tab ${
                activeTab === status ? "dashboard-tab-active" : ""
              }`}
              onClick={() => setActiveTab(status)}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}

              <span className="dashboard-count">
                {appointmentsByStatus[status]?.length || 0}
              </span>
            </button>
          ))}
        </div>

        {/* APPOINTMENT CARDS */}

        {currentAppointments.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {currentAppointments.map((service) => {
              const performers = service.performers || [];

              const preferences = performers.filter(
                (performer) => performer.preferred_employee_id,
              );

              const actualAssignments = performers.filter(
                (performer) => performer.employee_id,
              );

              const hasPreferences = preferences.length > 0;

              const hasActualAssignments = actualAssignments.length > 0;

              const transactionId = service.transaction_id ?? service.id;

              return (
                <article
                  key={transactionId}
                  className={`dashboard-card border ${
                    activeTab === "pending"
                      ? "border-amber-200 bg-amber-50/70"
                      : activeTab === "confirmed"
                        ? "border-emerald-200 bg-emerald-50/60"
                        : activeTab === "completed"
                          ? "border-blue-200 bg-blue-50/60"
                          : "border-rose-200 bg-rose-50/60"
                  }`}
                >
                  {/* HEADER */}

                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                        Online booking
                      </p>

                      <h3 className="mt-1 font-semibold text-stone-900">
                        {service.service_name || "Service"}
                      </h3>
                    </div>

                    <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold capitalize text-stone-600">
                      {service.status}
                    </span>
                  </div>

                  {/* BOOKING INFORMATION */}

                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-stone-500">Customer:</span>{" "}
                      <span className="font-semibold text-stone-800">
                        {getCustomerName(service)}
                      </span>
                    </div>

                    <div>
                      <span className="text-stone-500">Date:</span>{" "}
                      <span className="font-medium text-stone-800">
                        {formatDate(service.appointment_date)}
                      </span>
                    </div>

                    <div>
                      <span className="text-stone-500">Time:</span>{" "}
                      <span className="font-medium text-stone-800">
                        {formatTime12h(service.appointment_time)}
                      </span>
                    </div>

                    {service.customer_note && (
                      <div>
                        <span className="text-stone-500">Customer Note:</span>{" "}
                        <span className="text-stone-700">
                          {service.customer_note}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* CUSTOMER PREFERENCES */}

                  <div className="mt-4 rounded-xl border border-stone-200 bg-white/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                      Customer preference
                    </p>

                    {hasPreferences ? (
                      <div className="mt-2 space-y-1.5">
                        {preferences.map((performer, index) => (
                          <div
                            key={`preference-${performer.role_id ?? index}`}
                            className="text-sm"
                          >
                            <span className="text-stone-500">
                              {performer.role_name || "Professional"}:
                            </span>{" "}
                            <span className="font-semibold text-stone-800">
                              {getPreferredProfessionalName(performer) ||
                                "Preferred professional"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm font-medium text-stone-600">
                        Anyone available
                      </p>
                    )}
                  </div>

                  {/* ACTUAL PROFESSIONALS */}

                  <div className="mt-3 rounded-xl border border-stone-200 bg-white/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                      Actual professionals
                    </p>

                    {hasActualAssignments ? (
                      <div className="mt-2 space-y-1.5">
                        {actualAssignments.map((performer, index) => (
                          <div
                            key={`actual-${performer.role_id ?? index}`}
                            className="text-sm"
                          >
                            <span className="text-stone-500">
                              {performer.role_name || "Professional"}:
                            </span>{" "}
                            <span className="font-semibold text-stone-800">
                              {getActualProfessionalName(performer) ||
                                "Assigned"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-stone-500">
                        No actual employees assigned yet.
                      </p>
                    )}
                  </div>

                  {/* CANCELLATION REASON */}

                  {service.status === "cancelled" && service.cancel_reason && (
                    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">
                        Cancellation reason
                      </p>

                      <p className="mt-1 text-sm text-rose-700">
                        {service.cancel_reason}
                      </p>
                    </div>
                  )}

                  {/* PENDING ACTIONS */}

                  {activeTab === "pending" && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleAppointmentStatus(transactionId, "confirmed")
                        }
                        className="
                            rounded-xl
                            bg-emerald-600
                            px-4
                            py-2
                            text-sm
                            font-semibold
                            text-white
                            transition
                            hover:bg-emerald-700
                          "
                      >
                        Confirm
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCancelServiceId(transactionId);

                          setShowCancelModal(true);
                        }}
                        className="
                            rounded-xl
                            border
                            border-rose-200
                            bg-white
                            px-4
                            py-2
                            text-sm
                            font-semibold
                            text-rose-600
                            transition
                            hover:bg-rose-50
                          "
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* CONFIRMED ACTIONS */}

                  {activeTab === "confirmed" && (
                    <div className="mt-4">
                      {!hasActualAssignments && (
                        <p className="mb-3 text-xs leading-5 text-stone-500">
                          Select the employees who actually performed the
                          service before marking this appointment completed.
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={loadingCompletion}
                          onClick={() => handleOpenCompletion(transactionId)}
                          className="
                              rounded-xl
                              bg-[var(--salon-copper)]
                              px-4
                              py-2
                              text-sm
                              font-semibold
                              text-white
                              transition
                              hover:opacity-90
                              disabled:cursor-not-allowed
                              disabled:opacity-50
                            "
                        >
                          {loadingCompletion
                            ? "Loading..."
                            : "Complete Service"}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setCancelServiceId(transactionId);

                            setShowCancelModal(true);
                          }}
                          className="
                              rounded-xl
                              border
                              border-rose-200
                              bg-white
                              px-4
                              py-2
                              text-sm
                              font-semibold
                              text-rose-600
                              transition
                              hover:bg-rose-50
                            "
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-200 py-10 text-center">
            <p className="font-medium text-stone-700">
              No {activeTab} appointments
            </p>

            <p className="mt-1 text-sm text-stone-500">
              Appointments with this status will appear here.
            </p>
          </div>
        )}
      </section>

      {/* ==================================================
          SERVICE DEFINITIONS — READ ONLY
      ================================================== */}

      <section className="dashboard-panel">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-stone-900">
            Service Definitions
          </h3>

          <p className="mt-1 text-sm text-stone-600">
            Reference prices, employee roles and service requirements. Setup
            changes are managed by the owner or manager.
          </p>
        </div>

        <div className="dashboard-table-wrap">
          <table className="dashboard-table">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-4 py-2 text-left">Name</th>

                <th className="border px-4 py-2 text-left">Image</th>

                <th className="border px-4 py-2 text-left">Section</th>

                <th className="border px-4 py-2 text-left">Roles</th>

                <th className="border px-4 py-2 text-left">Other Services</th>

                <th className="border px-4 py-2 text-left">
                  Employees Total Amount
                </th>

                <th className="border px-4 py-2 text-left">
                  Other Services Total Costs
                </th>

                <th className="border px-4 py-2 text-left">Salon Amount</th>

                <th className="border px-4 py-2 text-left">Full Amount</th>
              </tr>
            </thead>

            <tbody>
              {serviceDefinitions.length > 0 ? (
                serviceDefinitions.map((service) => {
                  const roles = getRolesFromDef(service);

                  const materials = getMaterialsFromDef(service);

                  const totalRoles = sumRolesAmount(roles);

                  const totalMaterials = sumMaterialsCost(materials);

                  const displayName =
                    service.name ||
                    service.service_name ||
                    service.serviceName ||
                    "N/A";

                  const displayImage = service.image_url
                    ? `${staticBaseUrl}${service.image_url}`
                    : null;

                  const displaySalon =
                    service.salon_amount ??
                    service.salonAmount ??
                    service.salon ??
                    "0";

                  const displayFull =
                    service.full_amount ??
                    service.service_amount ??
                    service.price ??
                    "0";

                  const section = sections.find(
                    (entry) => Number(entry.id) === Number(service.section_id),
                  );

                  const sectionName =
                    section?.section_name ||
                    section?.name ||
                    service.section_name ||
                    "N/A";

                  return (
                    <tr key={service.id}>
                      <td className="border px-4 py-2 align-top">
                        {displayName}
                      </td>

                      <td className="border px-4 py-2 align-top">
                        {displayImage ? (
                          <img
                            src={displayImage}
                            alt={displayName}
                            className="h-14 w-14 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="text-sm text-stone-400">
                            No image
                          </span>
                        )}
                      </td>

                      <td className="border px-4 py-2 align-top">
                        {sectionName}
                      </td>

                      <td className="border px-4 py-2 align-top">
                        {roles.length > 0 ? (
                          <ul className="ml-4 list-disc">
                            {roles.map((role, index) => (
                              <li key={index}>
                                {role.role_name ||
                                  role.role ||
                                  role.name ||
                                  "role"}
                                :{" "}
                                <span className="font-semibold">
                                  {(
                                    role.role_amount ||
                                    role.amount ||
                                    role.earned_amount ||
                                    0
                                  ).toString()}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-gray-500">None</span>
                        )}
                      </td>

                      <td className="border px-4 py-2 align-top">
                        {materials.length > 0 ? (
                          <ul className="ml-4 list-disc">
                            {materials.map((material, index) => (
                              <li key={index}>
                                {material.material_name ||
                                  material.name ||
                                  "material"}
                                :{" "}
                                <span className="font-semibold">
                                  {(
                                    material.material_cost ||
                                    material.cost ||
                                    0
                                  ).toString()}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-gray-500">None</span>
                        )}
                      </td>

                      <td className="border px-4 py-2 align-top font-semibold">
                        {totalRoles}
                      </td>

                      <td className="border px-4 py-2 align-top font-semibold">
                        {totalMaterials}
                      </td>

                      <td className="border px-4 py-2 align-top font-semibold">
                        {displaySalon}
                      </td>

                      <td className="border px-4 py-2 align-top font-semibold">
                        {displayFull}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="border px-4 py-4" colSpan={9}>
                    No service definitions available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ==================================================
          MAIN MODAL
      ================================================== */}

      <Modal
        isOpen={modalType !== null}
        onClose={closeModal}
        sizeClass={
          modalType === "complete_appointment" ? "max-w-3xl" : "max-w-2xl"
        }
      >
        {/* ==================================================
            CREATE WALK-IN SERVICE
        ================================================== */}

        {modalType === "service" && (
          <ServiceForm
            isCustomer={false}
            onSubmit={createServiceTransaction}
            onClose={closeModal}
            Services={serviceDefinitions}
            Roles={serviceRoles}
            Employees={Employees}
            Sections={sections}
            createdBy={createdbyID?.id}
            /*
             * A service entered by the cashier is a service
             * that has actually been performed.
             *
             * Therefore its status is COMPLETED.
             *
             * ServiceForm will require actual employee IDs.
             */
            serviceStatus="completed"
            entryType="current"
          />
        )}

        {/* ==================================================
            COMPLETE CONFIRMED APPOINTMENT
        ================================================== */}

        {modalType === "complete_appointment" && completingAppointment && (
          <ServiceForm
            isCustomer={false}
            onSubmit={handleCompleteAppointment}
            onClose={closeModal}
            Services={serviceDefinitions}
            Roles={serviceRoles}
            Employees={Employees}
            Sections={sections}
            createdBy={createdbyID?.id}
            customerId={
              completingAppointment.active_customer_id ??
              completingAppointment.customer_id
            }
            serviceStatus="completed"
            serviceData={completingAppointment}
            entryType={completingAppointment.entry_type || "current"}
          />
        )}

        {/* ==================================================
            EXPENSE
        ================================================== */}

        {modalType === "expense" && (
          <ExpenseForm onSubmit={createExpense} onClose={closeModal} />
        )}

        {/* ==================================================
            ADVANCE
        ================================================== */}

        {modalType === "advance" && (
          <AdvanceForm onSubmit={createAdvance} onClose={closeModal} />
        )}

        {/* ==================================================
            CLOCKING
        ================================================== */}

        {modalType === "clocking" && (
          <ClockForm
            onSubmit={handleClocking}
            onClose={closeModal}
            employees={Employees}
            activeClockings={activeClockings}
          />
        )}
      </Modal>

      {/* ==================================================
          CANCEL APPOINTMENT MODAL
      ================================================== */}

      <Modal
        isOpen={showCancelModal}
        onClose={() => {
          setShowCancelModal(false);

          setCancelServiceId(null);
        }}
      >
        <CancelReasonForm
          serviceId={cancelServiceId}
          onSubmit={handleAppointmentStatus}
          onClose={() => {
            setShowCancelModal(false);

            setCancelServiceId(null);
          }}
        />
      </Modal>
    </div>
  );
}
