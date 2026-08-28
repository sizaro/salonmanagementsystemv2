import { useEffect, useMemo, useState } from "react";

import Modal from "../../components/Modal.jsx";
import ServiceForm from "../../components/ServiceForm";
import SectionForm from "../../components/SectionForm.jsx";
import NewServiceForm from "../../components/NewServiceForm.jsx";
import ExpenseForm from "../../components/ExpenseForm";
import AdvanceForm from "../../components/AdvanceForm";
import ClockForm from "../../components/ClockForm";
import TagFeeForm from "../../components/TagFeeForm.jsx";
import LateFeeForm from "../../components/LateFeeForm.jsx";
import CancelReasonForm from "../../components/CancelReasonForm.jsx";
import AddPastService from "../../components/AddPastService";

import useSalonSessionTimer from "../../hooks/useSalonSessionTimer";
import Button from "../../components/Button";

import { useData } from "../../context/DataContext.jsx";

export default function OwnerDashboard() {
  // ======================================================
  // STATIC BASE URL
  // ======================================================

  const staticBaseUrl =
    import.meta.env.MODE === "development"
      ? "http://localhost:5500"
      : "https://salonmanagementsystemv2-ru0i.onrender.com";

  // ======================================================
  // LOCAL STATE
  // ======================================================

  const [modalType, setModalType] = useState(null);

  const [salonStatus, setSalonStatus] = useState("closed");

  const [selectedFee, setSelectedFee] = useState(null);

  const [edittingServiceDefinition, setEdittingServiceDefinition] =
    useState(null);

  const [edittingSection, setEdittingSection] = useState(null);

  const [showCancelModal, setShowCancelModal] = useState(false);

  const [cancelServiceId, setCancelServiceId] = useState(null);

  const [activeTab, setActiveTab] = useState("pending");

  // Appointment that is currently being completed.
  //
  // We fetch the full transaction before opening the form
  // because we need:
  //
  // role_id
  // preferred_employee_id
  // existing employee_id
  // appointment information
  //
  const [completingAppointment, setCompletingAppointment] = useState(null);

  const [loadingCompletion, setLoadingCompletion] = useState(false);

  // ======================================================
  // DATA CONTEXT
  // ======================================================

  const {
    transactions = [],

    sendFormData,

    sessions,

    users = [],

    fetchUsers,

    updateServiceTransactionById,

    updateServiceTransactionAppointment,

    fetchServiceTransactionById,

    sections = [],

    serviceDefinitions = [],

    createServiceDefinition,

    updateServiceDefinition,

    fetchServiceDefinitionById,

    deleteServiceDefinition,

    serviceMaterials = [],

    serviceRoles = [],

    fetchSections,

    createSection,

    updateSection,

    deleteSection,

    fetchServiceDefinitions,

    fetchServiceMaterials,

    createServiceTransaction,

    fetchServiceTransactions,

    fetchServiceTransactionsApp,

    activeClockings = [],

    fetchActiveClockings,

    fetchSectionById,

    openSalonSession,

    closeSalonSession,
  } = useData();

  // ======================================================
  // CURRENT SALON SESSION
  // ======================================================

  const session = Array.isArray(sessions) ? sessions[0] : sessions || null;

  const sessionDuration = useSalonSessionTimer(
    session?.open_date,
    session?.open_time,
  );

  // ======================================================
  // SERVICE DATA WITH MATERIALS
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
  // EMPLOYEES
  // ======================================================

  const Employees = useMemo(() => {
    return (users || []).filter(
      (user) =>
        ["employee", "manager", "cashier"].includes(
          String(user.role || "").toLowerCase(),
        ) && String(user.status || "active").toLowerCase() !== "inactive",
    );
  }, [users]);

  // ======================================================
  // OWNER
  // ======================================================

  const createdbyID = useMemo(() => {
    return (users || []).find(
      (user) => String(user.role || "").toLowerCase() === "owner",
    );
  }, [users]);

  // ======================================================
  // CUSTOMERS
  // ======================================================

  const Customers = useMemo(() => {
    return (users || []).filter(
      (user) => String(user.role || "").toLowerCase() === "customer",
    );
  }, [users]);

  // ======================================================
  // FORMAT TIME
  // ======================================================

  const formatTime12h = (time24) => {
    if (!time24) return "N/A";

    let [hour, minute] = String(time24).slice(0, 5).split(":").map(Number);

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

    const rawDate = String(dateString).slice(0, 10);

    const [year, month, day] = rawDate.split("-");

    if (!year || !month || !day) {
      return rawDate;
    }

    return `${day}/${month}/${year}`;
  };

  // ======================================================
  // GET CUSTOMER NAME
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
  // IS APPOINTMENT?
  // ======================================================
  //
  // New records:
  // service_source = online_booking
  //
  // Old records:
  // may still have service_source NULL,
  // so appointment_date also acts as a legacy fallback.
  //
  // This prevents completed walk-in services from appearing
  // in the Appointments -> Completed tab.
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
        (service) => String(service.status || "").toLowerCase() === "pending",
      ),

      confirmed: appointmentTransactions.filter(
        (service) => String(service.status || "").toLowerCase() === "confirmed",
      ),

      completed: appointmentTransactions.filter(
        (service) => String(service.status || "").toLowerCase() === "completed",
      ),

      cancelled: appointmentTransactions.filter(
        (service) => String(service.status || "").toLowerCase() === "cancelled",
      ),
    };
  }, [appointmentTransactions]);

  // ======================================================
  // ACTUAL PROFESSIONAL NAME
  // ======================================================

  const getActualProfessionalName = (performer) => {
    const name = `${performer.first_name || ""} ${
      performer.last_name || ""
    }`.trim();

    return name || null;
  };

  // ======================================================
  // PREFERRED PROFESSIONAL NAME
  // ======================================================

  const getPreferredProfessionalName = (performer) => {
    const directName = `${performer.preferred_first_name || ""} ${
      performer.preferred_last_name || ""
    }`.trim();

    if (directName) {
      return directName;
    }

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
  // SALON SESSION
  // ======================================================

  const handleSalonSession = async (status) => {
    try {
      if (status === "open") {
        const result = await openSalonSession();

        console.log("SALON OPENED:", result);

        setSalonStatus("open");
      } else {
        const result = await closeSalonSession();

        console.log("SALON CLOSED:", result);

        setSalonStatus("closed");
      }
    } catch (error) {
      console.error(
        "Salon session error:",
        error.response?.data || error.message,
      );
    }
  };

  // ======================================================
  // CLOSE MODAL
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
      console.error("Failed to submit expense", error);
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
      console.error("Failed to submit advance", error);
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
  // TAG FEE
  // ======================================================

  const CreateTagFee = async (formData) => {
    try {
      await sendFormData("createTagFee", formData);

      closeModal();
    } catch (error) {
      console.error("Failed to submit tag fee", error);
    }
  };

  // ======================================================
  // LATE FEE
  // ======================================================

  const CreateLateFee = async (formData) => {
    try {
      await sendFormData("createLateFee", formData);

      closeModal();
    } catch (error) {
      console.error("Failed to submit late fee", error);
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
  // SESSION STATUS
  // ======================================================

  useEffect(() => {
    setSalonStatus(session?.status || "closed");
  }, [session?.status]);

  // ======================================================
  // REFRESH APPOINTMENTS
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
  // Confirmed appointments DO NOT need actual employee IDs.
  //
  // Customer preferences remain preferences.
  //
  // Actual employees become mandatory only when completing.
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

        // Preserve performer rows and customer preferences.
        performers: service.performers || [],
      });

      if (newStatus !== "cancelled") {
        setActiveTab(newStatus);
      }

      await refreshAppointments();
    } catch (error) {
      console.error(
        "Failed to update appointment status:",
        error.response?.data || error.message,
      );
    }
  };

  // ======================================================
  // OPEN COMPLETION FORM
  // ======================================================

  const handleOpenCompletion = async (serviceId) => {
    try {
      setLoadingCompletion(true);

      const service = await fetchServiceTransactionById(serviceId);

      if (!service) {
        throw new Error("Appointment could not be loaded");
      }

      console.log("APPOINTMENT BEING COMPLETED:", service);

      setCompletingAppointment(service);

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
  // ServiceForm calls:
  //
  // onSubmit(transactionId, payload)
  //
  // We deliberately use the appointment endpoint here.
  //
  // The backend now:
  // 1. validates actual employees,
  // 2. rejects missing employee_id,
  // 3. writes completion date/time,
  // 4. stores the actual performers,
  // 5. retains preferred_employee_id.
  // ======================================================

  const handleCompleteAppointment = async (transactionId, formData) => {
    try {
      const payload = {
        status: "completed",

        cancel_reason: null,

        performers: formData.performers || [],
      };

      console.log("COMPLETING APPOINTMENT:", {
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
  // EDIT SECTION
  // ======================================================

  const handleEditSection = async (id) => {
    try {
      const sectionObject = await fetchSectionById(id);

      setEdittingSection(sectionObject);

      setModalType("edit_section");
    } catch (error) {
      console.error("Failed to fetch section:", error);
    }
  };

  // ======================================================
  // EDIT SERVICE DEFINITION
  // ======================================================

  const handleEditServiceDefinition = async (id) => {
    try {
      const serviceDefinition = await fetchServiceDefinitionById(id);

      setEdittingServiceDefinition(serviceDefinition);

      setModalType("edit_service_definition");
    } catch (error) {
      console.error("Failed to fetch service definition:", error);
    }
  };

  // ======================================================
  // ADD SERVICE DEFINITION
  // ======================================================

  const handleAddServiceDefinition = async (formData) => {
    try {
      await createServiceDefinition(formData);

      closeModal();
    } catch (error) {
      console.error("Failed to create service definition", error);
    }
  };

  // ======================================================
  // UPDATE SECTION
  // ======================================================

  const handleUpdateSection = async (formData) => {
    try {
      if (!edittingSection || !edittingSection.id) {
        throw new Error("No section selected for update");
      }

      await updateSection(formData.id, formData);

      closeModal();
    } catch (error) {
      console.error("Failed to update section", error);
    }
  };

  // ======================================================
  // UPDATE SERVICE DEFINITION
  // ======================================================

  const handleUpdateServiceDefinition = async (id, formData) => {
    try {
      if (!formData) {
        throw new Error("No service definition selected for update");
      }

      await updateServiceDefinition(id, formData);

      closeModal();
    } catch (error) {
      console.error("Failed to update service definition", error);
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
  // DELETE SECTION
  // ======================================================

  const handleDeleteSectionClick = async (id) => {
    try {
      await deleteSection(id);
    } catch (error) {
      console.error("Failed to delete section", error);
    }
  };

  // ======================================================
  // DELETE SERVICE DEFINITION
  // ======================================================

  const handleDeleteServiceDefinitionClick = async (id) => {
    try {
      await deleteServiceDefinition(id);
    } catch (error) {
      console.error("Failed to delete service definition", error);
    }
  };

  // ======================================================
  // CURRENT TAB APPOINTMENTS
  // ======================================================

  const currentAppointments = appointmentsByStatus[activeTab] || [];

  // ======================================================
  // UI
  // ======================================================

  return (
    <div className="dashboard-page space-y-6">
      {/* ==================================================
          QUICK ACTIONS
      ================================================== */}

      <section className="dashboard-panel">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="salon-eyebrow text-[var(--salon-copper)]">
              Owner controls
            </p>

            <h2 className="mt-1 font-serif text-2xl font-semibold text-[var(--salon-ink)]">
              Quick Actions
            </h2>

            <p className="mt-1 text-sm text-stone-500">
              Manage today's salon operations from one place.
            </p>
          </div>

          <div
            className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${
              salonStatus === "open"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-stone-100 text-stone-600"
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                salonStatus === "open" ? "bg-emerald-500" : "bg-stone-400"
              }`}
            />

            {salonStatus === "open" ? "Salon Open" : "Salon Closed"}
          </div>
        </div>

        {/* SALON SESSION */}

        <div className="mb-5 rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-stone-800">
                Salon Session
              </p>

              {salonStatus === "open" ? (
                <p className="mt-1 text-sm text-stone-500">
                  Open for{" "}
                  <span className="font-semibold text-stone-700">
                    {sessionDuration.hours} hrs {sessionDuration.minutes} mins
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-stone-500">
                  Start today's salon session when operations begin.
                </p>
              )}
            </div>

            {salonStatus === "closed" ? (
              <button
                type="button"
                onClick={() => handleSalonSession("open")}
                className="
                  inline-flex
                  items-center
                  justify-center
                  rounded-xl
                  bg-emerald-600
                  px-5
                  py-2.5
                  text-sm
                  font-semibold
                  text-white
                  shadow-sm
                  transition
                  hover:bg-emerald-700
                  focus:outline-none
                  focus:ring-2
                  focus:ring-emerald-500
                  focus:ring-offset-2
                "
              >
                Open Salon
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSalonSession("closed")}
                className="
                  inline-flex
                  items-center
                  justify-center
                  rounded-xl
                  bg-rose-600
                  px-5
                  py-2.5
                  text-sm
                  font-semibold
                  text-white
                  shadow-sm
                  transition
                  hover:bg-rose-700
                  focus:outline-none
                  focus:ring-2
                  focus:ring-rose-500
                  focus:ring-offset-2
                "
              >
                Close Salon
              </button>
            )}
          </div>
        </div>

        {/* ACTION GROUPS */}

        <div className="grid gap-5 lg:grid-cols-3">
          {/* OPERATIONS */}

          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
                Operations
              </p>

              <h3 className="mt-1 font-semibold text-stone-900">Daily Work</h3>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setModalType("service")}
                className="group flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-left transition hover:border-[var(--salon-copper)] hover:bg-stone-50"
              >
                <span>
                  <span className="block text-sm font-semibold text-stone-800">
                    Add Service
                  </span>

                  <span className="mt-0.5 block text-xs text-stone-500">
                    Record a service performed today
                  </span>
                </span>

                <span className="text-xl text-stone-400 transition group-hover:translate-x-1 group-hover:text-[var(--salon-copper)]">
                  →
                </span>
              </button>

              <button
                type="button"
                onClick={() => setModalType("past_service")}
                className="group flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-left transition hover:border-[var(--salon-copper)] hover:bg-stone-50"
              >
                <span>
                  <span className="block text-sm font-semibold text-stone-800">
                    Add Past Service
                  </span>

                  <span className="mt-0.5 block text-xs text-stone-500">
                    Record a service performed earlier
                  </span>
                </span>

                <span className="text-xl text-stone-400 transition group-hover:translate-x-1 group-hover:text-[var(--salon-copper)]">
                  →
                </span>
              </button>

              <button
                type="button"
                onClick={() => setModalType("clocking")}
                className="group flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-left transition hover:border-[var(--salon-copper)] hover:bg-stone-50"
              >
                <span>
                  <span className="block text-sm font-semibold text-stone-800">
                    Employee Clocking
                  </span>

                  <span className="mt-0.5 block text-xs text-stone-500">
                    Clock staff in or out
                  </span>
                </span>

                <span className="text-xl text-stone-400 transition group-hover:translate-x-1 group-hover:text-[var(--salon-copper)]">
                  →
                </span>
              </button>
            </div>
          </div>

          {/* FINANCE */}

          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
                Finance
              </p>

              <h3 className="mt-1 font-semibold text-stone-900">
                Money Records
              </h3>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setModalType("expense")}
                className="group flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-left transition hover:border-[var(--salon-copper)] hover:bg-stone-50"
              >
                <span>
                  <span className="block text-sm font-semibold text-stone-800">
                    Add Expense
                  </span>

                  <span className="mt-0.5 block text-xs text-stone-500">
                    Record a salon expense
                  </span>
                </span>

                <span className="text-xl text-stone-400 transition group-hover:translate-x-1 group-hover:text-[var(--salon-copper)]">
                  →
                </span>
              </button>

              <button
                type="button"
                onClick={() => setModalType("advance")}
                className="group flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-left transition hover:border-[var(--salon-copper)] hover:bg-stone-50"
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

              <button
                type="button"
                onClick={() => setModalType("tagfee")}
                className="group flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-left transition hover:border-[var(--salon-copper)] hover:bg-stone-50"
              >
                <span>
                  <span className="block text-sm font-semibold text-stone-800">
                    Add Tag Fee
                  </span>

                  <span className="mt-0.5 block text-xs text-stone-500">
                    Record an employee tag fee
                  </span>
                </span>

                <span className="text-xl text-stone-400 transition group-hover:translate-x-1 group-hover:text-[var(--salon-copper)]">
                  →
                </span>
              </button>

              <button
                type="button"
                onClick={() => setModalType("latefee")}
                className="group flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-left transition hover:border-[var(--salon-copper)] hover:bg-stone-50"
              >
                <span>
                  <span className="block text-sm font-semibold text-stone-800">
                    Add Late Fee
                  </span>

                  <span className="mt-0.5 block text-xs text-stone-500">
                    Record a staff lateness deduction
                  </span>
                </span>

                <span className="text-xl text-stone-400 transition group-hover:translate-x-1 group-hover:text-[var(--salon-copper)]">
                  →
                </span>
              </button>
            </div>
          </div>

          {/* SETUP */}

          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
                Setup
              </p>

              <h3 className="mt-1 font-semibold text-stone-900">
                Salon Configuration
              </h3>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setModalType("new_section")}
                className="group flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-left transition hover:border-[var(--salon-copper)] hover:bg-stone-50"
              >
                <span>
                  <span className="block text-sm font-semibold text-stone-800">
                    Add Section
                  </span>

                  <span className="mt-0.5 block text-xs text-stone-500">
                    Create a new salon service section
                  </span>
                </span>

                <span className="text-xl text-stone-400 transition group-hover:translate-x-1 group-hover:text-[var(--salon-copper)]">
                  →
                </span>
              </button>

              <button
                type="button"
                onClick={() => setModalType("new_service_definition")}
                className="group flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-left transition hover:border-[var(--salon-copper)] hover:bg-stone-50"
              >
                <span>
                  <span className="block text-sm font-semibold text-stone-800">
                    Add New Service
                  </span>

                  <span className="mt-0.5 block text-xs text-stone-500">
                    Configure pricing, roles and materials
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
            professionals before completing a service.
          </p>
        </div>

        {/* TABS */}

        <div className="dashboard-tabs mb-5">
          {["pending", "confirmed", "completed", "cancelled"].map((status) => (
            <button
              key={status}
              type="button"
              className={`dashboard-tab ${
                activeTab === status ? "dashboard-tab-active" : ""
              } ${status === "pending" && (appointmentsByStatus.pending?.length || 0) > 0 ? activeTab === status ? "!border-rose-600 !bg-rose-600 !text-white" : "border-rose-300 bg-rose-50 text-rose-700 ring-1 ring-rose-200" : ""}`}
              onClick={() => setActiveTab(status)}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}

              <span className="dashboard-count">
                {appointmentsByStatus[status]?.length || 0}
              </span>
            </button>
          ))}
        </div>

        {/* CARDS */}

        {currentAppointments.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {currentAppointments.map((service) => {
              const performers = service.performers || [];

              const actualAssignments = performers.filter(
                (performer) => performer.employee_id,
              );

              const preferences = performers.filter(
                (performer) => performer.preferred_employee_id,
              );

              const hasPreferences = preferences.length > 0;

              const hasActualEmployees = actualAssignments.length > 0;

              return (
                <article
                  key={service.transaction_id ?? service.id}
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
                  {/* SERVICE NAME */}

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

                  {/* CUSTOMER */}

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
                        <span className="text-stone-500">Note:</span>{" "}
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

                  {/* ACTUAL ASSIGNMENTS */}

                  <div className="mt-3 rounded-xl border border-stone-200 bg-white/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                      Actual professionals
                    </p>

                    {hasActualEmployees ? (
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
                        No actual staff assigned yet.
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
                          handleAppointmentStatus(
                            service.transaction_id ?? service.id,
                            "confirmed",
                          )
                        }
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                      >
                        Confirm
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCancelServiceId(
                            service.transaction_id ?? service.id,
                          );

                          setShowCancelModal(true);
                        }}
                        className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* CONFIRMED ACTIONS */}

                  {activeTab === "confirmed" && (
                    <div className="mt-4">
                      {!hasActualEmployees && (
                        <p className="mb-3 text-xs leading-5 text-stone-500">
                          Actual professionals must be selected before this
                          appointment can be completed.
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={loadingCompletion}
                          onClick={() =>
                            handleOpenCompletion(
                              service.transaction_id ?? service.id,
                            )
                          }
                          className="rounded-xl bg-[var(--salon-copper)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {loadingCompletion
                            ? "Loading..."
                            : "Complete Service"}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setCancelServiceId(
                              service.transaction_id ?? service.id,
                            );

                            setShowCancelModal(true);
                          }}
                          className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
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
          SECTIONS
      ================================================== */}

      <section className="mt-6">
        <h3 className="mb-2 text-md font-semibold">Sections</h3>

        <div className="overflow-x-auto rounded-xl border border-gray-300">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-100">
                <th className="border-b px-4 py-2 text-left">Name</th>

                <th className="border-b px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {sections.length > 0 ? (
                sections.map((section) => (
                  <tr key={section.id}>
                    <td className="border-b px-4 py-2">
                      {section.section_name}
                    </td>

                    <td className="border-b px-4 py-2">
                      <div className="flex gap-2">
                        <Button onClick={() => handleEditSection(section.id)}>
                          Edit
                        </Button>

                        <Button
                          onClick={() => handleDeleteSectionClick(section.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-4" colSpan={2}>
                    No sections available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ==================================================
          SERVICE DEFINITIONS
      ================================================== */}

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-md font-semibold">Service Definitions</h3>

          <span className="text-sm text-gray-500">
            Scroll this list to view all services
          </span>
        </div>

        <div className="max-h-[34rem] overflow-auto rounded-lg border border-gray-300 bg-white">
          <table className="min-w-[1100px] w-full border-collapse">
            <thead className="sticky top-0 z-20">
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

                <th className="sticky right-0 border bg-gray-100 px-4 py-2">
                  Actions
                </th>
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

                      <td className="sticky right-0 border bg-white px-4 py-2 align-top">
                        <div className="flex gap-2">
                          <Button
                            onClick={() =>
                              handleEditServiceDefinition(service.id)
                            }
                          >
                            Edit
                          </Button>

                          <Button
                            onClick={() =>
                              handleDeleteServiceDefinitionClick(service.id)
                            }
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="border px-4 py-2" colSpan={10}>
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
        {/* ADD CURRENT WALK-IN SERVICE */}

        {modalType === "service" && (
          <ServiceForm
            onSubmit={createServiceTransaction}
            onClose={closeModal}
            Services={serviceDefinitions}
            Roles={serviceRoles}
            Employees={Employees}
            Sections={sections}
            createdBy={createdbyID?.id}
            serviceStatus="completed"
            entryType="current"
          />
        )}

        {/* COMPLETE APPOINTMENT */}

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

        {/* PAST SERVICE */}

        {modalType === "past_service" && (
          <AddPastService
            onSubmit={createServiceTransaction}
            onClose={closeModal}
            Services={serviceDefinitions}
            Roles={serviceRoles}
            Employees={Employees}
            Sections={sections}
            createdBy={createdbyID?.id}
            serviceStatus="completed"
            entryType="past"
          />
        )}

        {/* EXPENSE */}

        {modalType === "expense" && (
          <ExpenseForm onSubmit={createExpense} onClose={closeModal} />
        )}

        {/* ADVANCE */}

        {modalType === "advance" && (
          <AdvanceForm onSubmit={createAdvance} onClose={closeModal} />
        )}

        {/* CLOCKING */}

        {modalType === "clocking" && (
          <ClockForm
            onSubmit={handleClocking}
            onClose={closeModal}
            employees={Employees}
            activeClockings={activeClockings}
          />
        )}

        {/* TAG FEE */}

        {modalType === "tagfee" && (
          <TagFeeForm
            onSubmit={CreateTagFee}
            onClose={closeModal}
            feeData={selectedFee}
            employees={Employees || []}
          />
        )}

        {/* LATE FEE */}

        {modalType === "latefee" && (
          <LateFeeForm
            onSubmit={CreateLateFee}
            onClose={closeModal}
            feeData={selectedFee}
            employees={Employees || []}
          />
        )}

        {/* NEW SECTION */}

        {modalType === "new_section" && (
          <SectionForm
            onSubmit={createSection}
            onClose={closeModal}
            sectionData={null}
          />
        )}

        {/* EDIT SECTION */}

        {modalType === "edit_section" && (
          <SectionForm
            onSubmit={handleUpdateSection}
            onClose={closeModal}
            existingSection={edittingSection}
          />
        )}

        {/* NEW SERVICE DEFINITION */}

        {modalType === "new_service_definition" && (
          <NewServiceForm
            onSubmit={handleAddServiceDefinition}
            onClose={closeModal}
            Sections={sections}
          />
        )}

        {/* EDIT SERVICE DEFINITION */}

        {modalType === "edit_service_definition" && (
          <NewServiceForm
            onSubmit={handleUpdateServiceDefinition}
            onClose={closeModal}
            Sections={sections}
            serviceData={edittingServiceDefinition}
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
