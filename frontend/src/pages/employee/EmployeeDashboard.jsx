import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { DateTime } from "luxon";
import { useData } from "../../context/DataContext.jsx";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const ZONE = "Africa/Kampala";

const ITEMS_PER_PAGE = 10;

const formatMoney = (amount) =>
  `${Number(amount || 0).toLocaleString("en-UG")} UGX`;

const TABS = [
  {
    key: "services",
    label: "Services",
    description: "Normal services performed",
  },
  {
    key: "pending",
    label: "Pending",
    description: "Appointments awaiting confirmation",
  },
  {
    key: "confirmed",
    label: "Confirmed",
    description: "Confirmed appointments",
  },
  {
    key: "completed",
    label: "Completed",
    description: "Completed appointments",
  },
  {
    key: "cancelled",
    label: "Cancelled",
    description: "Cancelled appointments",
  },
];

export default function EmployeeDashboard() {
  const {
    user,
    users = [],
    transactions = [],
    serviceMaterials = [],
  } = useData();

  // ======================================================
  // STATE
  // ======================================================

  const [activeTab, setActiveTab] = useState("services");

  const [currentPage, setCurrentPage] = useState(1);

  const [paySummary, setPaySummary] = useState(null);

  const [payLoading, setPayLoading] = useState(false);

  const [payError, setPayError] = useState("");

  // ======================================================
  // ENRICH TRANSACTIONS WITH MATERIALS
  // ======================================================

  const servicesWithMaterials = useMemo(() => {
    return transactions.map((service) => {
      const matchedMaterials = serviceMaterials.filter(
        (material) =>
          Number(material.service_definition_id) ===
          Number(service.service_definition_id),
      );

      return {
        ...service,
        materials: matchedMaterials,
      };
    });
  }, [transactions, serviceMaterials]);

  // ======================================================
  // SERVICES ASSIGNED TO LOGGED-IN EMPLOYEE
  // ======================================================

  const myServices = useMemo(() => {
    if (!user?.id) return [];

    return servicesWithMaterials.filter((service) =>
      (service.performers || []).some(
        (performer) => Number(performer.employee_id) === Number(user.id),
      ),
    );
  }, [servicesWithMaterials, user?.id]);

  // ======================================================
  // GROUP BY STATUS
  //
  // null status = normal service
  // ======================================================

  const servicesByStatus = useMemo(() => {
    return {
      services: myServices.filter(
        (service) =>
          service.status === null ||
          service.status === undefined ||
          service.status === "",
      ),

      pending: myServices.filter(
        (service) => String(service.status || "").toLowerCase() === "pending",
      ),

      confirmed: myServices.filter(
        (service) => String(service.status || "").toLowerCase() === "confirmed",
      ),

      completed: myServices.filter(
        (service) => String(service.status || "").toLowerCase() === "completed",
      ),

      cancelled: myServices.filter(
        (service) => String(service.status || "").toLowerCase() === "cancelled",
      ),
    };
  }, [myServices]);

  // ======================================================
  // CURRENT TAB DATA
  // ======================================================

  const currentTabServices = servicesByStatus[activeTab] || [];

  // ======================================================
  // PAGINATION
  // ======================================================

  const totalPages = Math.max(
    1,
    Math.ceil(currentTabServices.length / ITEMS_PER_PAGE),
  );

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;

  const endIndex = startIndex + ITEMS_PER_PAGE;

  const paginatedServices = currentTabServices.slice(startIndex, endIndex);

  const displayStart = currentTabServices.length === 0 ? 0 : startIndex + 1;

  const displayEnd = Math.min(endIndex, currentTabServices.length);

  // Reset to page 1 whenever employee changes tab
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  // If records change and current page becomes invalid
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // ======================================================
  // PERFORMED WORK COUNT
  // ======================================================

  const performedServicesCount =
    servicesByStatus.services.length + servicesByStatus.completed.length;

  // ======================================================
  // EARNINGS FROM CURRENTLY LOADED SERVICES
  // ======================================================

  const loadedServiceEarnings = useMemo(() => {
    const performed = [
      ...servicesByStatus.services,
      ...servicesByStatus.completed,
    ];

    return performed.reduce((total, service) => {
      const assignment = (service.performers || []).find(
        (performer) => Number(performer.employee_id) === Number(user?.id),
      );

      const amount = Number(
        assignment?.role_amount ?? assignment?.earned_amount ?? 0,
      );

      return total + amount;
    }, 0);
  }, [servicesByStatus.services, servicesByStatus.completed, user?.id]);

  // ======================================================
  // FETCH MONTHLY PAY SUMMARY
  // ======================================================

  useEffect(() => {
    if (!user?.id) return;

    let active = true;

    const fetchPaySummary = async () => {
      try {
        setPayLoading(true);
        setPayError("");

        const now = DateTime.now().setZone(ZONE);

        const { data } = await axios.get(`${API_URL}/reports/my-payroll`, {
          params: {
            period: "monthly",
            year: now.year,
            month: now.month,
          },
          withCredentials: true,
        });

        if (!active) return;

        setPaySummary(data.employee || null);
      } catch (error) {
        console.error(
          "Employee payroll error:",
          error.response?.data || error.message,
        );

        if (!active) return;

        setPaySummary(null);

        setPayError(
          error.response?.data?.error ||
            "Unable to load your monthly pay summary.",
        );
      } finally {
        if (active) {
          setPayLoading(false);
        }
      }
    };

    fetchPaySummary();

    return () => {
      active = false;
    };
  }, [user?.id]);

  // ======================================================
  // DATE FORMATTER
  // ======================================================

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";

    const parsed = DateTime.fromISO(String(dateString), {
      zone: ZONE,
    });

    if (!parsed.isValid) {
      return String(dateString);
    }

    return parsed.toFormat("dd LLL yyyy");
  };

  // ======================================================
  // TIME FORMATTER
  // ======================================================

  const formatTime12h = (time24) => {
    if (!time24) return "N/A";

    const value = String(time24).substring(0, 8);

    const parsed = DateTime.fromFormat(value, "HH:mm:ss", {
      zone: ZONE,
    });

    if (!parsed.isValid) {
      return String(time24);
    }

    return parsed.toFormat("h:mm a");
  };

  // ======================================================
  // CUSTOMER NAME
  // ======================================================

  const getCustomerName = (service) => {
    if (service.customer_name) {
      return service.customer_name;
    }

    if (!service.customer_id) {
      return "Walk-in customer";
    }

    const customer = users.find(
      (currentUser) => Number(currentUser.id) === Number(service.customer_id),
    );

    if (!customer) {
      return "Registered customer";
    }

    return `${customer.first_name || ""} ${customer.last_name || ""}`.trim();
  };

  // ======================================================
  // EMPLOYEE ASSIGNMENT
  // ======================================================

  const getMyAssignment = (service) => {
    return (service.performers || []).find(
      (performer) => Number(performer.employee_id) === Number(user?.id),
    );
  };

  // ======================================================
  // MATERIALS
  // ======================================================

  const getMaterialsList = (service) => {
    if (!service.materials || service.materials.length === 0) {
      return "None";
    }

    const names = service.materials
      .map((material) => material.material_name || material.name || null)
      .filter(Boolean);

    return names.length ? names.join(", ") : "None";
  };

  // ======================================================
  // DISPLAY DATE
  // ======================================================

  const getDisplayDate = (service) => {
    const isAppointment =
      service.status !== null &&
      service.status !== undefined &&
      service.status !== "";

    if (isAppointment && service.appointment_date) {
      return service.appointment_date;
    }

    return service.service_date || service.appointment_date;
  };

  // ======================================================
  // DISPLAY TIME
  // ======================================================

  const getDisplayTime = (service) => {
    const isAppointment =
      service.status !== null &&
      service.status !== undefined &&
      service.status !== "";

    if (isAppointment && service.appointment_time) {
      return service.appointment_time;
    }

    return service.service_time || service.appointment_time;
  };

  // ======================================================
  // STATUS LABEL
  // ======================================================

  const getStatusLabel = (service) => {
    if (
      service.status === null ||
      service.status === undefined ||
      service.status === ""
    ) {
      return "Service";
    }

    const status = String(service.status);

    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // ======================================================
  // STATUS STYLING
  // ======================================================

  const getStatusClasses = (service) => {
    const status = String(service.status || "").toLowerCase();

    if (!status) {
      return "bg-slate-100 text-slate-700";
    }

    switch (status) {
      case "pending":
        return "bg-amber-100 text-amber-800";

      case "confirmed":
        return "bg-blue-100 text-blue-800";

      case "completed":
        return "bg-emerald-100 text-emerald-800";

      case "cancelled":
        return "bg-red-100 text-red-700";

      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  // ======================================================
  // CHANGE PAGE
  // ======================================================

  const goToPage = (page) => {
    if (page < 1 || page > totalPages) {
      return;
    }

    setCurrentPage(page);
  };

  // ======================================================
  // PAGE NUMBER BUTTONS
  // ======================================================

  const pageNumbers = useMemo(() => {
    const pages = [];

    const maxVisible = 5;

    let start = Math.max(1, safeCurrentPage - 2);

    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    return pages;
  }, [safeCurrentPage, totalPages]);

  // ======================================================
  // LOADING USER
  // ======================================================

  if (!user?.id) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
        Loading your dashboard...
      </div>
    );
  }

  // ======================================================
  // MONTH LABEL
  // ======================================================

  const currentMonth = DateTime.now().setZone(ZONE).toFormat("LLLL yyyy");

  const selectedTab = TABS.find((tab) => tab.key === activeTab);

  return (
    <div className="dashboard-page mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      {/* ==================================================
          HERO
      ================================================== */}

      <header className="dashboard-hero">
        <p className="salon-eyebrow text-[var(--salon-copper)]">
          Employee workspace
        </p>

        <div className="relative z-10 mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <img src={user?.image_url ? (String(user.image_url).startsWith("http") ? user.image_url : `${import.meta.env.VITE_STATIC_URL || "http://localhost:5500"}${user.image_url}`) : "/default-avatar.png"} alt="" className="h-20 w-20 rounded-3xl border-4 border-white object-cover shadow-lg" />
          <div>
            <h1 className="font-serif text-3xl font-semibold text-slate-900">
              Welcome, {user.first_name}
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              Your services, appointments and pay overview.
            </p>
          </div>
          </div>

          <div className="text-sm text-slate-500">
            {DateTime.now().setZone(ZONE).toFormat("cccc, dd LLLL yyyy")}
          </div>
        </div>
      </header>

      {/* ==================================================
          WORK OVERVIEW
      ================================================== */}

      <section>
        <div className="mb-3">
          <h2 className="font-serif text-xl font-semibold text-slate-900">
            My work overview
          </h2>

          <p className="text-sm text-slate-500">
            Your assigned services and appointments.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* PERFORMED */}

          <button
            type="button"
            onClick={() => setActiveTab("services")}
            className="dashboard-card text-left transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm text-slate-500">Performed Work</p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {performedServicesCount}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Normal services + completed appointments
            </p>
          </button>

          {/* PENDING */}

          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className="dashboard-card text-left transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm text-amber-700">Pending Appointments</p>

            <p className="mt-2 text-3xl font-bold text-amber-800">
              {servicesByStatus.pending.length}
            </p>

            <p className="mt-2 text-xs text-slate-500">Awaiting confirmation</p>
          </button>

          {/* CONFIRMED */}

          <button
            type="button"
            onClick={() => setActiveTab("confirmed")}
            className="dashboard-card text-left transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm text-blue-700">Confirmed</p>

            <p className="mt-2 text-3xl font-bold text-blue-800">
              {servicesByStatus.confirmed.length}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Confirmed appointments
            </p>
          </button>

          {/* COMPLETED */}

          <button
            type="button"
            onClick={() => setActiveTab("completed")}
            className="dashboard-card text-left transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm text-emerald-700">Completed Appointments</p>

            <p className="mt-2 text-3xl font-bold text-emerald-800">
              {servicesByStatus.completed.length}
            </p>

            <p className="mt-2 text-xs text-slate-500">Finished appointments</p>
          </button>
        </div>
      </section>

      {/* ==================================================
          PAY SUMMARY
      ================================================== */}

      <section className="dashboard-panel">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="salon-eyebrow text-[var(--salon-copper)]">
              {currentMonth}
            </p>

            <h2 className="mt-1 font-serif text-2xl font-semibold text-slate-900">
              My pay summary
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Your service earnings and advances for the current month.
            </p>
          </div>

          {paySummary && (
            <span
              className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                paySummary.isClockedIn
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {paySummary.isClockedIn
                ? "Currently clocked in"
                : "Currently clocked out"}
            </span>
          )}
        </div>

        {payLoading ? (
          <div className="py-8 text-center text-sm text-slate-500">
            Loading pay summary...
          </div>
        ) : payError ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {payError}
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* GROSS */}

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Gross earnings
              </p>

              <p className="mt-2 text-xl font-bold text-slate-900">
                {formatMoney(paySummary?.grossSalary)}
              </p>
            </div>

            {/* ADVANCES */}

            <div className="rounded-2xl bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Advances
              </p>

              <p className="mt-2 text-xl font-bold text-amber-800">
                {formatMoney(paySummary?.advances)}
              </p>
            </div>

            {/* NET */}

            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Net earnings
              </p>

              <p className="mt-2 text-xl font-bold text-emerald-800">
                {formatMoney(paySummary?.netSalary)}
              </p>
            </div>

            {/* LOADED WORK EARNINGS */}

            <div className="rounded-2xl bg-stone-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Loaded work earnings
              </p>

              <p className="mt-2 text-xl font-bold text-[var(--salon-copper)]">
                {formatMoney(loadedServiceEarnings)}
              </p>

              <p className="mt-1 text-xs text-stone-400">
                Based on currently loaded services
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ==================================================
          SERVICES AND APPOINTMENTS
      ================================================== */}

      <section className="dashboard-panel">
        <div className="mb-5">
          <h2 className="font-serif text-2xl font-semibold text-slate-900">
            My Services & Appointments
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Select a category to review your assigned work.
          </p>
        </div>

        {/* ==================================================
            TABS
        ================================================== */}

        <div className="mb-5 overflow-x-auto">
          <div className="flex min-w-max gap-2">
            {TABS.map((tab) => {
              const count = servicesByStatus[tab.key]?.length || 0;

              const selected = activeTab === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                    selected
                      ? "border-[var(--salon-copper)] bg-[var(--salon-copper)] text-white"
                      : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50"
                  }`}
                >
                  <span>{tab.label}</span>

                  <span
                    className={`flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-xs ${
                      selected
                        ? "bg-white/20 text-white"
                        : "bg-stone-100 text-stone-700"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ==================================================
            TAB HEADING
        ================================================== */}

        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">
              {selectedTab?.label}
            </h3>

            <p className="text-sm text-slate-500">{selectedTab?.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-semibold text-stone-700">
              {currentTabServices.length}{" "}
              {currentTabServices.length === 1 ? "record" : "records"}
            </span>

            {currentTabServices.length > 0 && (
              <span className="text-xs text-stone-500">
                Showing {displayStart}–{displayEnd} of{" "}
                {currentTabServices.length}
              </span>
            )}
          </div>
        </div>

        {/* ==================================================
            EMPTY STATE
        ================================================== */}

        {currentTabServices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 py-12 text-center">
            <p className="font-medium text-stone-700">
              Nothing here at the moment
            </p>

            <p className="mt-1 text-sm text-stone-500">
              You currently have no {selectedTab?.label.toLowerCase()}.
            </p>
          </div>
        ) : (
          <>
            {/* ==================================================
                TABLE
            ================================================== */}

            <div className="dashboard-table-wrap overflow-x-auto">
              <table className="dashboard-table min-w-[1050px]">
                <thead>
                  <tr>
                    <th>#</th>

                    <th>Service</th>

                    <th>Customer</th>

                    <th>Date</th>

                    <th>Time</th>

                    <th>Your Role</th>

                    <th>Your Amount</th>

                    <th>Materials</th>

                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedServices.map((service, index) => {
                    const assignment = getMyAssignment(service);

                    const role = assignment?.role_name || "N/A";

                    const earning = Number(
                      assignment?.role_amount ?? assignment?.earned_amount ?? 0,
                    );

                    return (
                      <tr key={service.transaction_id || service.id}>
                        {/* NUMBER */}

                        <td>{startIndex + index + 1}</td>

                        {/* SERVICE */}

                        <td>
                          <div className="font-semibold text-stone-800">
                            {service.service_name || "N/A"}
                          </div>

                          {service.customer_note && (
                            <p className="mt-1 max-w-xs text-xs text-stone-400">
                              {service.customer_note}
                            </p>
                          )}
                        </td>

                        {/* CUSTOMER */}

                        <td>
                          <div className="font-medium">
                            {getCustomerName(service)}
                          </div>

                          <div className="mt-1 text-xs text-stone-400">
                            {service.customer_id
                              ? "Registered customer"
                              : "Walk-in"}
                          </div>
                        </td>

                        {/* DATE */}

                        <td className="whitespace-nowrap">
                          {formatDate(getDisplayDate(service))}
                        </td>

                        {/* TIME */}

                        <td className="whitespace-nowrap">
                          {formatTime12h(getDisplayTime(service))}
                        </td>

                        {/* ROLE */}

                        <td>
                          <span className="font-medium text-stone-800">
                            {role}
                          </span>
                        </td>

                        {/* AMOUNT */}

                        <td className="whitespace-nowrap font-semibold text-[var(--salon-copper)]">
                          {formatMoney(earning)}
                        </td>

                        {/* MATERIALS */}

                        <td>
                          <span className="text-sm text-stone-600">
                            {getMaterialsList(service)}
                          </span>
                        </td>

                        {/* STATUS */}

                        <td>
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                              service,
                            )}`}
                          >
                            {getStatusLabel(service)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ==================================================
                PAGINATION
            ================================================== */}

            <div className="mt-5 flex flex-col gap-3 border-t border-stone-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-stone-500">
                Showing{" "}
                <span className="font-semibold text-stone-700">
                  {displayStart}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-stone-700">
                  {displayEnd}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-stone-700">
                  {currentTabServices.length}
                </span>{" "}
                records
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* PREVIOUS */}

                <button
                  type="button"
                  onClick={() => goToPage(safeCurrentPage - 1)}
                  disabled={safeCurrentPage === 1}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    safeCurrentPage === 1
                      ? "cursor-not-allowed border-stone-100 bg-stone-50 text-stone-300"
                      : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  Previous
                </button>

                {/* FIRST PAGE */}

                {pageNumbers[0] > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => goToPage(1)}
                      className="min-w-10 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
                    >
                      1
                    </button>

                    {pageNumbers[0] > 2 && (
                      <span className="px-1 text-stone-400">...</span>
                    )}
                  </>
                )}

                {/* PAGE NUMBERS */}

                {pageNumbers.map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => goToPage(page)}
                    className={`min-w-10 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      safeCurrentPage === page
                        ? "border-[var(--salon-copper)] bg-[var(--salon-copper)] text-white"
                        : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    {page}
                  </button>
                ))}

                {/* LAST PAGE */}

                {pageNumbers[pageNumbers.length - 1] < totalPages && (
                  <>
                    {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                      <span className="px-1 text-stone-400">...</span>
                    )}

                    <button
                      type="button"
                      onClick={() => goToPage(totalPages)}
                      className="min-w-10 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
                    >
                      {totalPages}
                    </button>
                  </>
                )}

                {/* NEXT */}

                <button
                  type="button"
                  onClick={() => goToPage(safeCurrentPage + 1)}
                  disabled={safeCurrentPage === totalPages}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    safeCurrentPage === totalPages
                      ? "cursor-not-allowed border-stone-100 bg-stone-50 text-stone-300"
                      : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
