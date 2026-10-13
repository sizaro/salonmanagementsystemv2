import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Modal from "../../components/Modal.jsx";
import ServiceForm from "../../components/ServiceForm";
import ExpenseForm from "../../components/ExpenseForm";
import AdvanceForm from "../../components/AdvanceForm";
import ClockForm from "../../components/ClockForm";
import TagFeeForm from "../../components/TagFeeForm.jsx";
import LateFeeForm from "../../components/LateFeeForm.jsx";
import AddPastService from "../../components/AddPastService";

import useSalonSessionTimer from "../../hooks/useSalonSessionTimer";

import { useData } from "../../context/DataContext.jsx";

export default function OwnerDashboard() {
  const navigate = useNavigate();
  // ======================================================
  // LOCAL STATE
  // ======================================================

  const [modalType, setModalType] = useState(null);

  // The fee forms accept this optional value for future edit flows.
  // This dashboard currently opens them in create mode.
  const selectedFee = null;

  const [salonStatus, setSalonStatus] = useState("closed");

  const [openActionMenu, setOpenActionMenu] = useState(null);

  // ======================================================
  // DATA CONTEXT
  // ======================================================

  const {
    transactions = [],

    sendFormData,

    sessions,

    users = [],

    fetchUsers,

    sections = [],

    serviceDefinitions = [],

    serviceRoles = [],

    fetchSections,

    fetchServiceDefinitions,

    createServiceTransaction,

    fetchServiceTransactions,

    activeClockings = [],

    fetchActiveClockings,

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
  // APPOINTMENT OVERVIEW
  // ======================================================

  const appointmentsByStatus = useMemo(() => {
    const appointments = (transactions || []).filter((service) => {
      const source = String(service.service_source || "").trim().toLowerCase();
      return source === "online_booking" || Boolean(service.appointment_date);
    });
    return ["pending", "confirmed", "completed", "cancelled"].reduce((groups, status) => {
      groups[status] = appointments.filter((service) => String(service.status || "").toLowerCase() === status);
      return groups;
    }, {});
  }, [transactions]);
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

    fetchServiceTransactions();

    fetchActiveClockings();
  }, []);

  // ======================================================
  // SESSION STATUS
  // ======================================================

  useEffect(() => {
    setSalonStatus(session?.status || "closed");
  }, [session?.status]);

  const dashboardMetrics = useMemo(() => {
    const dateKey = (date) => [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    const today = dateKey(new Date());
    const startOfWeek = new Date();
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
    const weekStart = dateKey(startOfWeek);
    const completed = (transactions || []).filter(
      (service) => String(service.status || "").toLowerCase() === "completed",
    );
    const dateFor = (service) => String(
      service.completed_date || service.service_date || service.transaction_date || service.created_at || "",
    ).slice(0, 10);
    const amountFor = (service) => Number(
      service.full_amount ?? service.service_amount ?? service.price ?? 0,
    ) || 0;
    const todayServices = completed.filter((service) => dateFor(service) === today);
    const weekServices = completed.filter((service) => {
      const date = dateFor(service);
      return date >= weekStart && date <= today;
    });
    return {
      todayServices: todayServices.length,
      todayRevenue: todayServices.reduce((sum, service) => sum + amountFor(service), 0),
      weekServices: weekServices.length,
      weekRevenue: weekServices.reduce((sum, service) => sum + amountFor(service), 0),
    };
  }, [transactions]);

  // ======================================================
  // UI
  // ======================================================

  return (
    <div className="dashboard-page space-y-6">
      <section className="workspace-session-control">
        <div className={`workspace-session-status ${salonStatus === "open" ? "workspace-session-open" : ""}`}>
          <span aria-hidden="true" />
          <div><p>Salon session</p><strong>{salonStatus === "open" ? "Salon is open" : "Salon is closed"}</strong></div>
        </div>
        <p>{salonStatus === "open" ? `Open for ${sessionDuration.hours} hrs ${sessionDuration.minutes} mins` : "Open the salon when daily operations begin."}</p>
        <button type="button" className={salonStatus === "open" ? "workspace-session-close" : "workspace-primary-action"} onClick={() => handleSalonSession(salonStatus === "open" ? "closed" : "open")}>{salonStatus === "open" ? "Close salon" : "Open salon"}</button>
      </section>
      {/* ==================================================
          QUICK ACTIONS
      ================================================== */}

      <section className="workspace-dashboard-overview" aria-label="Owner dashboard summary">
        <div className="workspace-dashboard-overview-heading">
          <div>
            <p className="workspace-section-kicker">Owner workspace</p>
            <h1>Today at Salehish</h1>
            <p>Completed-service figures are kept here for a quick daily and weekly view. Detailed analysis remains in Statistics.</p>
          </div>
          <button type="button" className="workspace-overview-link" onClick={() => navigate("/owner/statistics")}>Open Statistics</button>
        </div>
        <div className="workspace-overview-periods">
          <article className="workspace-overview-period">
            <div className="workspace-overview-period-label"><span>Today</span><small>Completed services</small></div>
            <div className="workspace-overview-metric"><span>Revenue</span><strong>UGX {dashboardMetrics.todayRevenue.toLocaleString()}</strong></div>
            <div className="workspace-overview-metric"><span>Services</span><strong>{dashboardMetrics.todayServices}</strong></div>
          </article>
          <article className="workspace-overview-period">
            <div className="workspace-overview-period-label"><span>This week</span><small>Monday to today</small></div>
            <div className="workspace-overview-metric"><span>Revenue</span><strong>UGX {dashboardMetrics.weekRevenue.toLocaleString()}</strong></div>
            <div className="workspace-overview-metric"><span>Services</span><strong>{dashboardMetrics.weekServices}</strong></div>
          </article>
        </div>
      </section>

      <section className="dashboard-panel">
        <div className="mb-4">
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

        </div>

        {/* ACTION GROUPS */}

        <div className="grid gap-3 lg:grid-cols-3">
          {/* OPERATIONS */}

          <details className="workspace-action-menu" open={openActionMenu === "operations"} onToggle={(event) => setOpenActionMenu(event.currentTarget.open ? "operations" : null)}>
            <summary className="workspace-action-menu-trigger">
              <span>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
                Operations
              </p>

              <h3 className="mt-1 font-semibold text-stone-900">Daily Work</h3>
              </span>
              <span aria-hidden="true">⌄</span>
            </summary>

            <div className="workspace-action-menu-content space-y-2">
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
          </details>

          {/* FINANCE */}

          <details className="workspace-action-menu" open={openActionMenu === "finance"} onToggle={(event) => setOpenActionMenu(event.currentTarget.open ? "finance" : null)}>
            <summary className="workspace-action-menu-trigger">
              <span>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
                Finance
              </p>

              <h3 className="mt-1 font-semibold text-stone-900">
                Money Records
              </h3>
              </span>
              <span aria-hidden="true">⌄</span>
            </summary>

            <div className="workspace-action-menu-content space-y-2">
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
                onClick={() => setModalType("past_expense")}
                className="group flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-left transition hover:border-[var(--salon-copper)] hover:bg-stone-50"
              >
                <span><span className="block text-sm font-semibold text-stone-800">Add Past Expense</span><span className="mt-0.5 block text-xs text-stone-500">Record an expense using its original business date.</span></span>
              </button>

              <button
                type="button"
                onClick={() => navigate("/owner/finance?action=advance")}
                className="group flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-left transition hover:border-[var(--salon-copper)] hover:bg-stone-50"
              >
                <span>
                  <span className="block text-sm font-semibold text-stone-800">
                    Create Advance Request
                  </span>

                  <span className="mt-0.5 block text-xs text-stone-500">
                    Start the approval and disbursement workflow
                  </span>
                </span>

                <span className="text-xl text-stone-400 transition group-hover:translate-x-1 group-hover:text-[var(--salon-copper)]">
                  →
                </span>
              </button>

              {/* PAST ADVANCE */}

              <button
                type="button"
                onClick={() => setModalType("past_advance")}
                className="group flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-left transition hover:border-[var(--salon-copper)] hover:bg-stone-50"
              >
                <span>
                  <span className="block text-sm font-semibold text-stone-800">
                    Add Past Advance
                  </span>

                  <span className="mt-0.5 block text-xs text-stone-500">
                    Record an employee advance from an earlier date
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

              <button type="button" onClick={() => setModalType("past_tagfee")} className="group flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-left transition hover:border-[var(--salon-copper)] hover:bg-stone-50">
                <span><span className="block text-sm font-semibold text-stone-800">Add Past Tag Fee</span><span className="mt-0.5 block text-xs text-stone-500">Record a historical equipment fee with its original time.</span></span>
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

              <button type="button" onClick={() => setModalType("past_latefee")} className="group flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-left transition hover:border-[var(--salon-copper)] hover:bg-stone-50">
                <span><span className="block text-sm font-semibold text-stone-800">Add Past Late Fee</span><span className="mt-0.5 block text-xs text-stone-500">Record a historical late-arrival fee with its original time.</span></span>
              </button>
            </div>
          </details>

          {/* SETUP */}

          <details className="workspace-action-menu" open={openActionMenu === "setup"} onToggle={(event) => setOpenActionMenu(event.currentTarget.open ? "setup" : null)}>
            <summary className="workspace-action-menu-trigger">
              <span>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
                Setup
              </p>

              <h3 className="mt-1 font-semibold text-stone-900">
                Salon Configuration
              </h3>
              </span>
              <span aria-hidden="true">⌄</span>
            </summary>

            <div className="workspace-action-menu-content space-y-2">
              <button
                type="button"
                onClick={() => navigate("/owner/setup")}
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
                onClick={() => navigate("/owner/setup")}
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
          </details>
        </div>
      </section>

      {/* ==================================================
          WORKSPACE OVERVIEW CARDS
      ================================================== */}

      <section className="workspace-dashboard-cards" aria-label="Salon workspace overview">
        <article className="workspace-overview-card">
          <div className="workspace-overview-card-heading"><div><p className="workspace-section-kicker">Client bookings</p><h2>Appointments</h2></div><span className="workspace-overview-card-count">{(appointmentsByStatus.pending?.length || 0) + (appointmentsByStatus.confirmed?.length || 0)}</span></div>
          <p>Review booking work without opening the full appointment workspace.</p>
          <div className="workspace-overview-card-metrics"><span><strong>{appointmentsByStatus.pending?.length || 0}</strong>Pending</span><span><strong>{appointmentsByStatus.confirmed?.length || 0}</strong>Confirmed</span><span><strong>{appointmentsByStatus.completed?.length || 0}</strong>Completed</span></div>
          <button type="button" className="workspace-card-action" onClick={() => navigate("/owner/appointments")}>{appointmentsByStatus.pending?.length ? `Review ${appointmentsByStatus.pending.length} pending booking${appointmentsByStatus.pending.length === 1 ? "" : "s"}` : "Open appointments"}</button>
        </article>
        <article className="workspace-overview-card">
          <div className="workspace-overview-card-heading"><div><p className="workspace-section-kicker">Salon setup</p><h2>Sections</h2></div><span className="workspace-overview-card-count">{sections.length}</span></div>
          <p>Current categories used to organize services.</p>
          <ul className="workspace-overview-card-list">{sections.slice(0, 4).map((section) => <li key={section.id}>{section.section_name}</li>)}{sections.length > 4 && <li>+ {sections.length - 4} more</li>}{sections.length === 0 && <li>No sections created yet.</li>}</ul>
          <button type="button" className="workspace-card-action" onClick={() => navigate("/owner/setup")}>Manage sections</button>
        </article>
        <article className="workspace-overview-card">
          <div className="workspace-overview-card-heading"><div><p className="workspace-section-kicker">Salon setup</p><h2>Service Definitions</h2></div><span className="workspace-overview-card-count">{serviceDefinitions.length}</span></div>
          <p>Configured services, pricing, roles, and supply requirements.</p>
          <ul className="workspace-overview-card-list">{serviceDefinitions.slice(0, 4).map((service) => <li key={service.id}>{service.name || service.service_name || service.serviceName || "Unnamed service"}</li>)}{serviceDefinitions.length > 4 && <li>+ {serviceDefinitions.length - 4} more services</li>}{serviceDefinitions.length === 0 && <li>No services created yet.</li>}</ul>
          <button type="button" className="workspace-card-action" onClick={() => navigate("/owner/setup")}>Manage service definitions</button>
        </article>
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

        {modalType === "past_expense" && (
          <ExpenseForm onSubmit={createExpense} onClose={closeModal} entryType="past" />
        )}

        {/* CURRENT ADVANCE */}

        {modalType === "advance" && (
          <AdvanceForm
            onSubmit={createAdvance}
            onClose={closeModal}
            entryType="current"
          />
        )}

        {/* PAST ADVANCE */}

        {modalType === "past_advance" && (
          <AdvanceForm
            onSubmit={createAdvance}
            onClose={closeModal}
            entryType="past"
          />
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

        {modalType === "past_tagfee" && (
          <TagFeeForm onSubmit={CreateTagFee} onClose={closeModal} feeData={selectedFee} employees={Employees || []} entryType="past" />
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

        {modalType === "past_latefee" && (
          <LateFeeForm onSubmit={CreateLateFee} onClose={closeModal} feeData={selectedFee} employees={Employees || []} entryType="past" />
        )}

      </Modal>

    </div>
  );
}
