import React, { useEffect, useMemo, useState } from "react";

import { useData } from "../../context/DataContext.jsx";
import useOwnerReport from "../../hooks/useOwnerReport.js";

import "../../styles/IncomeDailyReport.css";

import Modal from "../../components/Modal.jsx";
import ServiceForm from "../../components/ServiceForm.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import ReportLoadingState from "../../components/common/ReportLoadingState.jsx";

import { Eye, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

// =========================================================
// HELPERS
// =========================================================

const toYMD = (date) => {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatMoney = (value) => {
  return Number(value || 0).toLocaleString("en-UG");
};

const normalizeStatus = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase();
};

const normalizeSource = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase();
};

// =========================================================
// COMPONENT
// =========================================================

const OwnerIncomeReport = () => {
  // =======================================================
  // DATA CONTEXT
  // =======================================================

  const {
    serviceRoles = [],

    serviceMaterials = [],

    serviceDefinitions = [],

    sections = [],

    fetchUsers,

    fetchServiceTransactionById,

    updateServiceTransactionById,

    deleteServiceTransaction,

    fetchServiceMaterials,

    fetchServiceDefinitions,

    fetchSections,

    fetchServiceRoles,
  } = useData();

  // =======================================================
  // OWNER REPORT
  // =======================================================

  const {
    report,

    loading: reportLoading,

    error: reportError,

    loadReport,

    fetchDailyData,

    fetchWeeklyData,

    fetchMonthlyData,

    fetchYearlyData,
  } = useOwnerReport();

  const {
    services = [],

    lateFees = [],

    tagFees = [],

    employees: users = [],

    advances = [],

    expenses = [],

    sessions = [],
  } = report || {};

  // =======================================================
  // CURRENT DATE
  // =======================================================

  const today = new Date();

  const todayYMD = toYMD(today);

  // =======================================================
  // LOCAL STATE
  // =======================================================

  const [liveDuration, setLiveDuration] = useState("");

  const [selectedDate, setSelectedDate] = useState(todayYMD);

  const [selectedWeek, setSelectedWeek] = useState("");

  const [monthYear, setMonthYear] = useState("");

  const [year, setYear] = useState("");

  const [reportLabel, setReportLabel] = useState(
    today.toLocaleDateString("en-UG", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Africa/Kampala",
    }),
  );

  const [activeReportQuery, setActiveReportQuery] = useState({
    period: "daily",

    date: todayYMD,
  });

  const [showModal, setShowModal] = useState(false);

  const [editingService, setEditingService] = useState(null);

  const [editOptions, setEditOptions] = useState(null);

  const [viewingService, setViewingService] = useState(null);

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const [serviceToDelete, setServiceToDelete] = useState(null);

  const [servicePage, setServicePage] = useState(1);

  const servicePageSize = 10;

  // =======================================================
  // REPORT SERVICE ARRAY
  // =======================================================

  const rawServices = useMemo(() => {
    if (Array.isArray(services)) {
      return services;
    }

    if (Array.isArray(services?.data)) {
      return services.data;
    }

    return [];
  }, [services]);

  // =======================================================
  // COMPLETED SERVICES ONLY
  // =======================================================
  //
  // Income is recognized ONLY after the service has
  // actually been completed.
  //
  // Therefore:
  //
  // pending   -> excluded
  // confirmed -> excluded
  // cancelled -> excluded
  // completed -> included
  //
  // This applies to BOTH:
  //
  // walk_in
  // online_booking
  // =======================================================

  const completedServices = useMemo(() => {
    return rawServices.filter((service) => {
      return normalizeStatus(service.status) === "completed";
    });
  }, [rawServices]);

  // =======================================================
  // COMPLETED SERVICES + MATERIALS
  // =======================================================

  const servicesWithMaterials = useMemo(() => {
    return completedServices.map((service) => {
      const existingMaterials = Array.isArray(service.materials)
        ? service.materials
        : [];

      const matchedMaterials = (serviceMaterials || []).filter(
        (material) =>
          Number(material.service_definition_id) ===
          Number(service.service_definition_id),
      );

      return {
        ...service,

        materials:
          existingMaterials.length > 0 ? existingMaterials : matchedMaterials,
      };
    });
  }, [completedServices, serviceMaterials]);

  // =======================================================
  // EMPLOYEES
  // =======================================================

  const Employees = useMemo(() => {
    return (users || []).filter((user) => {
      if (!user) {
        return false;
      }

      const role = String(user.role || "")
        .trim()
        .toLowerCase();

      const status = String(user.status || "active")
        .trim()
        .toLowerCase();

      return role !== "customer" && status !== "inactive";
    });
  }, [users]);

  // =======================================================
  // SESSION
  // =======================================================

  const session =
    Array.isArray(sessions) && sessions.length > 0 ? sessions[0] : null;

  // =======================================================
  // SERVICE MERGE
  // =======================================================

  const mergeServiceRecord = (summary, detail) => {
    return {
      ...(summary || {}),

      ...(detail || {}),

      section_name: detail?.section_name || summary?.section_name || "",

      definition_section_id:
        detail?.definition_section_id ??
        summary?.definition_section_id ??
        summary?.section_id,

      performers:
        Array.isArray(detail?.performers) && detail.performers.length > 0
          ? detail.performers
          : Array.isArray(summary?.performers)
            ? summary.performers
            : [],

      materials:
        Array.isArray(detail?.materials) && detail.materials.length > 0
          ? detail.materials
          : Array.isArray(summary?.materials)
            ? summary.materials
            : [],
    };
  };

  // =======================================================
  // REFRESH CURRENT REPORT
  // =======================================================

  const refreshActiveReport = async () => {
    await loadReport(activeReportQuery);
  };

  // =======================================================
  // VIEW SERVICE
  // =======================================================

  const handleViewClick = async (id) => {
    if (!id) {
      return;
    }

    try {
      const summary = servicesWithMaterials.find(
        (service) =>
          Number(service.transaction_id ?? service.id) === Number(id),
      );

      const detail = await fetchServiceTransactionById(id);

      setViewingService(mergeServiceRecord(summary, detail));
    } catch (error) {
      console.error(
        "Failed to load service details:",
        error?.response?.data || error.message,
      );
    }
  };

  // =======================================================
  // EDIT SERVICE
  // =======================================================

  const handleEditClick = async (id) => {
    if (!id) {
      console.error("No transaction ID provided for edit");

      return;
    }

    try {
      const summary = servicesWithMaterials.find(
        (service) =>
          Number(service.transaction_id ?? service.id) === Number(id),
      );

      const [
        detail,
        loadedSections,
        loadedDefinitions,
        loadedRoles,
        loadedUsers,
      ] = await Promise.all([
        fetchServiceTransactionById(id),

        fetchSections(),

        fetchServiceDefinitions(),

        fetchServiceRoles(),

        fetchUsers(),
      ]);

      const employeeOptions = (
        Array.isArray(loadedUsers) ? loadedUsers : Employees
      ).filter((user) => {
        if (!user) {
          return false;
        }

        const role = String(user.role || "")
          .trim()
          .toLowerCase();

        const status = String(user.status || "active")
          .trim()
          .toLowerCase();

        return role !== "customer" && status !== "inactive";
      });

      setEditOptions({
        sections: Array.isArray(loadedSections) ? loadedSections : sections,

        services: Array.isArray(loadedDefinitions)
          ? loadedDefinitions
          : serviceDefinitions,

        roles: Array.isArray(loadedRoles) ? loadedRoles : serviceRoles,

        employees: employeeOptions,
      });

      setEditingService(mergeServiceRecord(summary, detail));

      setShowModal(true);
    } catch (error) {
      console.error(
        "Failed to open service editor:",
        error?.response?.data || error.message,
      );
    }
  };

  // =======================================================
  // SAVE SERVICE EDIT
  // =======================================================

  const handleEditServiceSubmit = async (id, updatedService) => {
    try {
      console.log("OWNER REPORT SERVICE UPDATE:", updatedService);

      await updateServiceTransactionById(id, updatedService);

      await refreshActiveReport();

      setShowModal(false);

      setEditingService(null);

      setEditOptions(null);
    } catch (error) {
      console.error(
        "Failed to update service:",
        error?.response?.data || error.message,
      );

      throw error;
    }
  };

  // =======================================================
  // DELETE SERVICE
  // =======================================================

  const handleDelete = (id) => {
    setServiceToDelete(id);

    setConfirmModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!serviceToDelete) {
      return;
    }

    try {
      await deleteServiceTransaction(serviceToDelete);

      await refreshActiveReport();
    } catch (error) {
      console.error(
        "Failed to delete service:",
        error?.response?.data || error.message,
      );
    } finally {
      setConfirmModalOpen(false);

      setServiceToDelete(null);
    }
  };

  // =======================================================
  // SECTION LIST
  // =======================================================

  const sectionList = useMemo(() => {
    if (Array.isArray(sections) && sections.length > 0) {
      return sections.map((section) => ({
        id: section.id,

        name: section.section_name ?? section.name ?? `Section ${section.id}`,
      }));
    }

    const sectionMap = new Map();

    servicesWithMaterials.forEach((service) => {
      const id = service.definition_section_id ?? service.section_id ?? null;

      const name =
        service.section_name ||
        service.section?.section_name ||
        service.section?.name ||
        (id ? `Section ${id}` : "Unknown Section");

      const key = id ?? name;

      if (!sectionMap.has(key)) {
        sectionMap.set(key, {
          id: id ?? name,

          name,
        });
      }
    });

    return Array.from(sectionMap.values());
  }, [sections, servicesWithMaterials]);

  // =======================================================
  // SERVICES FOR ONE SECTION
  // =======================================================
  //
  // IMPORTANT FIX:
  //
  // sectionList contains:
  //
  // {
  //   id,
  //   name
  // }
  //
  // The previous version incorrectly looked for:
  //
  // section.section_name
  //
  // That meant secName became an empty string and caused
  // incorrect section grouping.
  // =======================================================

  const servicesForSection = (section) => {
    if (!section) {
      return [];
    }

    const sectionId = String(section.id ?? "")
      .trim()
      .toLowerCase();

    const sectionName = String(section.name ?? "")
      .trim()
      .toLowerCase();

    return servicesWithMaterials.filter((service) => {
      const serviceSectionId = String(
        service.definition_section_id ?? service.section_id ?? "",
      )
        .trim()
        .toLowerCase();

      const serviceSectionName = String(
        service.section_name ||
          service.section?.section_name ||
          service.section?.name ||
          "",
      )
        .trim()
        .toLowerCase();

      // Prefer ID comparison whenever both IDs exist.
      if (sectionId && serviceSectionId && sectionId === serviceSectionId) {
        return true;
      }

      // Fall back to exact name comparison.
      if (
        sectionName &&
        serviceSectionName &&
        sectionName === serviceSectionName
      ) {
        return true;
      }

      return false;
    });
  };

  // =======================================================
  // ACTUAL EMPLOYEE PAY
  // =======================================================
  //
  // Only actual performers are included.
  //
  // preferred_employee_id is only a customer preference
  // and must never be treated as employee earnings.
  // =======================================================

  const serviceEmployeeSalary = (service) => {
    if (!Array.isArray(service?.performers)) {
      return 0;
    }

    return service.performers.reduce((sum, performer) => {
      if (!performer?.employee_id) {
        return sum;
      }

      const amount =
        parseFloat(
          performer.role_amount ??
            performer.earned_amount ??
            performer.amount ??
            0,
        ) || 0;

      return sum + amount;
    }, 0);
  };

  // =======================================================
  // MATERIAL COST
  // =======================================================

  const serviceMaterialsTotal = (service) => {
    if (!Array.isArray(service?.materials)) {
      return 0;
    }

    return service.materials.reduce((sum, material) => {
      const cost =
        parseFloat(material.material_cost ?? material.cost ?? 0) || 0;

      return sum + cost;
    }, 0);
  };

  // =======================================================
  // SECTION TOTALS
  // =======================================================

  const calculateSectionTotals = (sectionServices) => {
    const gross = sectionServices.reduce(
      (sum, service) =>
        sum +
        (parseFloat(service.full_amount ?? service.service_amount ?? 0) || 0),
      0,
    );

    const employeeSalary = sectionServices.reduce(
      (sum, service) => sum + serviceEmployeeSalary(service),
      0,
    );

    const materialsTotal = sectionServices.reduce(
      (sum, service) => sum + serviceMaterialsTotal(service),
      0,
    );

    const salonIncome = sectionServices.reduce(
      (sum, service) => sum + (parseFloat(service.salon_amount || 0) || 0),
      0,
    );

    return {
      gross,

      employeeSalary,

      materialsTotal,

      salonIncome,
    };
  };

  // =======================================================
  // SECTION SUMMARIES
  // =======================================================

  const dynamicSectionSummaries = useMemo(() => {
    return sectionList.map((section) => {
      const sectionServices = servicesForSection(section);

      return {
        id: section.id,

        name: section.name,

        services: sectionServices,

        totals: calculateSectionTotals(sectionServices),
      };
    });
  }, [sectionList, servicesWithMaterials]);

  // =======================================================
  // GLOBAL TOTALS
  // =======================================================

  const calculateTotals = (
    servicesList = [],
    expensesList = [],
    advancesList = [],
    tagFeesList = [],
    lateFeesList = [],
  ) => {
    const grossIncome = servicesList.reduce(
      (sum, service) =>
        sum +
        (parseFloat(service.full_amount ?? service.service_amount ?? 0) || 0),
      0,
    );

    const employeesSalary = servicesList.reduce(
      (sum, service) => sum + serviceEmployeeSalary(service),
      0,
    );

    const materialsTotal = servicesList.reduce(
      (sum, service) => sum + serviceMaterialsTotal(service),
      0,
    );

    const totalExpenses = (expensesList || []).reduce(
      (sum, expense) => sum + (parseFloat(expense.amount || 0) || 0),
      0,
    );

    const totalAdvances = (advancesList || []).reduce(
      (sum, advance) => sum + (parseFloat(advance.amount || 0) || 0),
      0,
    );

    const totalLateFees = (lateFeesList || []).reduce(
      (sum, fee) => sum + (parseFloat(fee.amount || 0) || 0),
      0,
    );

    const totalTagFees = (tagFeesList || []).reduce(
      (sum, fee) => sum + (parseFloat(fee.amount || 0) || 0),
      0,
    );

    const deductions = totalAdvances + totalLateFees + totalTagFees;

    const netEmployeeSalary = Math.max(0, employeesSalary - deductions);

    const netIncome =
      grossIncome - totalExpenses - materialsTotal - netEmployeeSalary;

    // Cash still physically held by salon before paying
    // remaining employee salaries.
    const cashAtHand = netIncome + netEmployeeSalary;

    return {
      grossIncome,

      employeesSalary,

      materialsTotal,

      totalExpenses,

      totalAdvances,

      totalLateFees,

      totalTagFees,

      netEmployeeSalary,

      netIncome,

      cashAtHand,
    };
  };

  const {
    grossIncome,

    employeesSalary,

    materialsTotal,

    totalExpenses,

    totalAdvances,

    totalLateFees,

    totalTagFees,

    netEmployeeSalary,

    netIncome,

    cashAtHand,
  } = calculateTotals(
    servicesWithMaterials,

    expenses,

    advances,

    tagFees,

    lateFees,
  );

  // =======================================================
  // FORMAT SESSION TIME
  // =======================================================

  const formatEAT = (dateString) => {
    if (!dateString) {
      return "N/A";
    }

    try {
      return new Date(dateString).toLocaleString("en-UG", {
        timeZone: "Africa/Kampala",

        hour: "2-digit",

        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  // =======================================================
  // SESSION DURATION
  // =======================================================

  const calculateDuration = (openTime, closeTime) => {
    if (!openTime || !closeTime) {
      return "N/A";
    }

    const diffMs = new Date(closeTime).getTime() - new Date(openTime).getTime();

    if (Number.isNaN(diffMs) || diffMs < 0) {
      return "N/A";
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));

    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  };

  // =======================================================
  // LIVE SESSION TIMER
  // =======================================================

  useEffect(() => {
    if (!session?.open_time) {
      setLiveDuration("");

      return;
    }

    const updateDuration = () => {
      const closeTime = session.close_time || new Date().toISOString();

      setLiveDuration(calculateDuration(session.open_time, closeTime));
    };

    updateDuration();

    if (session.close_time) {
      return;
    }

    const interval = setInterval(updateDuration, 60 * 1000);

    return () => clearInterval(interval);
  }, [session]);

  // =======================================================
  // DAILY REPORT
  // =======================================================

  const handleDayChange = async (event) => {
    const value = event.target.value;

    if (!value) {
      return;
    }

    setSelectedDate(value);

    setSelectedWeek("");

    setMonthYear("");

    setYear("");

    const date = new Date(`${value}T12:00:00`);

    setReportLabel(
      date.toLocaleDateString("en-UG", {
        weekday: "long",

        year: "numeric",

        month: "long",

        day: "numeric",

        timeZone: "Africa/Kampala",
      }),
    );

    const query = {
      period: "daily",

      date: value,
    };

    setActiveReportQuery(query);

    setServicePage(1);

    await fetchDailyData(value);

    await fetchUsers();
  };

  // =======================================================
  // WEEKLY REPORT
  // =======================================================

  const handleWeekChange = async (event) => {
    const weekString = event.target.value;

    if (!weekString) {
      return;
    }

    setSelectedWeek(weekString);

    setMonthYear("");

    setYear("");

    const [selectedYear, selectedWeekNumber] = weekString
      .split("-W")
      .map(Number);

    const januaryFourth = new Date(Date.UTC(selectedYear, 0, 4));

    const januaryFourthDay = januaryFourth.getUTCDay() || 7;

    const firstWeekMonday = new Date(januaryFourth);

    firstWeekMonday.setUTCDate(
      januaryFourth.getUTCDate() - januaryFourthDay + 1,
    );

    const monday = new Date(firstWeekMonday);

    monday.setUTCDate(
      firstWeekMonday.getUTCDate() + (selectedWeekNumber - 1) * 7,
    );

    const sunday = new Date(monday);

    sunday.setUTCDate(monday.getUTCDate() + 6);

    const startDate = monday.toISOString().slice(0, 10);

    const endDate = sunday.toISOString().slice(0, 10);

    const query = {
      period: "weekly",

      startDate,

      endDate,
    };

    setActiveReportQuery(query);

    setServicePage(1);

    setReportLabel(
      `${monday.toLocaleDateString("en-UG", {
        timeZone: "Africa/Kampala",
      })} → ${sunday.toLocaleDateString("en-UG", {
        timeZone: "Africa/Kampala",
      })}`,
    );

    await fetchWeeklyData(monday, sunday);

    await fetchUsers();
  };

  // =======================================================
  // MONTHLY REPORT
  // =======================================================

  const handleMonthChange = async (event) => {
    const value = event.target.value;

    if (!value) {
      return;
    }

    const [selectedYear, selectedMonth] = value.split("-").map(Number);

    setMonthYear(value);

    setSelectedWeek("");

    setYear("");

    const query = {
      period: "monthly",

      year: selectedYear,

      month: selectedMonth,
    };

    setActiveReportQuery(query);

    setServicePage(1);

    setReportLabel(
      new Date(selectedYear, selectedMonth - 1, 1).toLocaleDateString("en-UG", {
        month: "long",

        year: "numeric",
      }),
    );

    await fetchMonthlyData(selectedYear, selectedMonth);

    await fetchUsers();
  };

  // =======================================================
  // YEARLY REPORT
  // =======================================================

  const handleYearChange = async (event) => {
    const selectedYear = Number(event.target.value);

    if (!selectedYear) {
      return;
    }

    setYear(selectedYear);

    setSelectedWeek("");

    setMonthYear("");

    const query = {
      period: "yearly",

      year: selectedYear,
    };

    setActiveReportQuery(query);

    setServicePage(1);

    setReportLabel(`Year ${selectedYear}`);

    await fetchYearlyData(selectedYear);

    await fetchUsers();
  };

  // =======================================================
  // YEAR OPTIONS
  // =======================================================

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();

    return Array.from({ length: 11 }, (_, index) => currentYear - index);
  }, []);

  // =======================================================
  // INITIAL DATA
  // =======================================================

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await Promise.all([
          fetchDailyData(selectedDate),

          fetchUsers(),

          fetchSections(),

          fetchServiceDefinitions(),

          fetchServiceRoles(),

          fetchServiceMaterials(),
        ]);
      } catch (error) {
        console.error(
          "Failed to load income report data:",
          error?.response?.data || error.message,
        );
      }
    };

    loadInitialData();
  }, []);

  // =======================================================
  // TOTAL COMPLETED SERVICES
  // =======================================================

  const totalServicesCount = servicesWithMaterials.length;

  // =======================================================
  // COMPLETED SERVICE COUNTS
  // =======================================================

  const serviceNameCounts = useMemo(() => {
    const countMap = new Map();

    servicesWithMaterials.forEach((service) => {
      const name = service.service_name || "Unknown Service";

      countMap.set(name, (countMap.get(name) || 0) + 1);
    });

    return Array.from(countMap.entries()).sort((a, b) => b[1] - a[1]);
  }, [servicesWithMaterials]);

  // =======================================================
  // PAGINATION
  // =======================================================

  const totalServicePages = Math.max(
    1,
    Math.ceil(servicesWithMaterials.length / servicePageSize),
  );

  const currentServicePage = Math.min(servicePage, totalServicePages);

  const paginatedServices = servicesWithMaterials.slice(
    (currentServicePage - 1) * servicePageSize,

    currentServicePage * servicePageSize,
  );

  // =======================================================
  // SERVICE SOURCE LABEL
  // =======================================================

  const getServiceSourceLabel = (service) => {
    const source = normalizeSource(service.service_source);

    if (source === "online_booking") {
      return "Online booking";
    }

    if (source === "walk_in") {
      return "Walk-in";
    }

    // Legacy completed appointment fallback.
    if (service.appointment_date) {
      return "Online booking";
    }

    return "Walk-in";
  };

  // =======================================================
  // ACTUAL PERFORMERS
  // =======================================================

  const getActualPerformers = (service) => {
    if (!Array.isArray(service?.performers)) {
      return [];
    }

    return service.performers.filter(
      (performer) =>
        performer?.employee_id && (performer.first_name || performer.last_name),
    );
  };

  // =======================================================
  // LOADING
  // =======================================================

  if (reportLoading && !report) {
    return (
      <div className="income-page mx-auto max-w-6xl p-6">
        <ReportLoadingState message="Loading the salon income report and completed service details..." />
      </div>
    );
  }

  // =======================================================
  // RENDER
  // =======================================================

  return (
    <div className="income-page mx-auto max-w-6xl p-6">
      {/* ===================================================
          PAGE HEADER
      =================================================== */}

      <div className="mb-7 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
          Salon Income Report
        </p>

        <h1 className="mt-1 text-3xl font-extrabold text-gray-800">
          {reportLabel}
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          Income is calculated from completed services only.
        </p>
      </div>

      {/* ===================================================
          ERRORS / LOADING
      =================================================== */}

      {reportError && (
        <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {reportError}
        </p>
      )}

      {reportLoading && report && (
        <div className="mb-5">
          <ReportLoadingState
            compact
            message="Updating the report for the selected period..."
          />
        </div>
      )}

      {/* ===================================================
          PERIOD FILTERS
      =================================================== */}

      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="font-semibold text-gray-800">Reporting Period</h2>

          <p className="mt-1 text-sm text-gray-500">
            Select a day, week, month or year.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Day
            </label>

            <input
              type="date"
              value={selectedDate}
              onChange={handleDayChange}
              className="rounded-lg border border-gray-300 bg-white p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Week
            </label>

            <input
              type="week"
              value={selectedWeek}
              onChange={handleWeekChange}
              className="rounded-lg border border-gray-300 bg-white p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Month
            </label>

            <input
              type="month"
              value={monthYear}
              onChange={handleMonthChange}
              className="rounded-lg border border-gray-300 bg-white p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Year
            </label>

            <select
              value={year}
              onChange={handleYearChange}
              className="rounded-lg border border-gray-300 bg-white p-2"
            >
              <option value="">Select Year</option>

              {yearOptions.map((optionYear) => (
                <option key={optionYear} value={optionYear}>
                  {optionYear}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* ===================================================
          SESSION
      =================================================== */}

      {session ? (
        <section className="mb-6 rounded-lg bg-white p-4 shadow">
          <h2 className="mb-3 text-xl font-semibold text-blue-700">
            Salon Session
          </h2>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <p className="text-sm text-gray-600">Opened</p>

              <p className="font-medium">{formatEAT(session.open_time)}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Closed</p>

              <p className="font-medium">
                {session.close_time
                  ? formatEAT(session.close_time)
                  : "Still open"}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Duration</p>

              <p className="font-medium">
                {liveDuration || "N/A"}

                {!session.close_time && " (Counting...)"}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="mb-6 rounded-lg border bg-gray-50 p-4 text-gray-500">
          No salon session was recorded for this period.
        </section>
      )}

      {/* ===================================================
          SECTION SUMMARIES
      =================================================== */}

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold text-gray-700">
          Section Summaries
        </h2>

        {dynamicSectionSummaries.length === 0 ? (
          <p className="text-gray-500">No section summary data available.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dynamicSectionSummaries.map((section) => (
              <div key={section.id} className="rounded-lg bg-white p-4 shadow">
                <h3 className="mb-3 text-md font-semibold text-blue-700">
                  {section.name} Section Summary
                </h3>

                <div className="grid grid-cols-1 gap-2">
                  <div className="rounded border bg-blue-50 p-3">
                    <div className="text-sm text-gray-700">Gross Income</div>

                    <div className="text-xl font-bold">
                      {formatMoney(section.totals.gross)} UGX
                    </div>
                  </div>

                  <div className="rounded border bg-blue-50 p-3">
                    <div className="text-sm text-gray-700">
                      Employees Salary
                    </div>

                    <div className="text-xl font-bold">
                      {formatMoney(section.totals.employeeSalary)} UGX
                    </div>
                  </div>

                  <div className="rounded border bg-blue-50 p-3">
                    <div className="text-sm text-gray-700">Materials Cost</div>

                    <div className="text-xl font-bold">
                      {formatMoney(section.totals.materialsTotal)} UGX
                    </div>
                  </div>

                  <div className="rounded border bg-blue-100 p-3">
                    <div className="text-sm text-gray-700">Salon Amount</div>

                    <div className="text-xl font-bold text-green-700">
                      {formatMoney(section.totals.salonIncome)} UGX
                    </div>
                  </div>

                  <div className="pt-1 text-sm font-semibold text-purple-700">
                    Completed Services: {section.services.length}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ===================================================
          SUMMARY
      =================================================== */}

      <section className="mb-6 rounded-lg bg-white p-4 shadow">
        <h2 className="mb-4 text-xl font-semibold text-blue-700">Summary</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[
            {
              label: "Gross Income",

              value: grossIncome,
            },

            {
              label: "Employees Salary",

              value: employeesSalary,
            },

            {
              label: "Materials Cost",

              value: materialsTotal,
            },

            {
              label: "Expenses",

              value: totalExpenses,
            },

            {
              label: "Advances",

              value: totalAdvances,
            },

            {
              label: "Tag Fees",

              value: totalTagFees,
            },

            {
              label: "Late Fees",

              value: totalLateFees,
            },

            {
              label: "Net Employee Salary",

              value: netEmployeeSalary,
            },

            {
              label: "Net Income",

              value: netIncome,
            },

            {
              label: "Cash at Hand",

              value: cashAtHand,
            },
          ].map((item) => (
            <div
              key={item.label}
              className={`rounded border p-3 ${
                item.label.includes("Net") ? "bg-green-50" : ""
              } ${item.label === "Cash at Hand" ? "bg-green-100" : ""}`}
            >
              <div className="text-sm text-gray-600">{item.label}</div>

              <div className="text-lg font-bold">
                {formatMoney(item.value)} UGX
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-md font-bold text-gray-700">
          Total Completed Services: {totalServicesCount}
        </p>

        <p className="mt-1 text-sm text-gray-500">
          Pending, confirmed and cancelled appointments are excluded from income
          calculations.
        </p>
      </section>

      {/* ===================================================
          COMPLETED SERVICE COUNTS
      =================================================== */}

      <section className="mb-6 rounded-lg bg-white p-4 shadow">
        <h2 className="mb-3 text-lg font-semibold text-gray-700">
          Completed Service Counts
        </h2>

        {serviceNameCounts.length === 0 ? (
          <p className="text-gray-500">No completed services recorded.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {serviceNameCounts.map(([name, count]) => (
              <div
                key={name}
                className="rounded border bg-purple-50 p-3 shadow-sm"
              >
                <div className="font-bold text-gray-800">{name}</div>

                <div className="mt-1 text-lg font-semibold text-blue-700">
                  {count}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ===================================================
          COMPLETED SERVICE DETAILS
      =================================================== */}

      <section className="mb-6 rounded-lg bg-white p-4 shadow">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-700">
            Completed Service Details
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Only completed walk-in and online-booking services appear in the
            income report.
          </p>
        </div>

        {servicesWithMaterials.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 py-10 text-center">
            <p className="font-medium text-gray-700">No completed services</p>

            <p className="mt-1 text-sm text-gray-500">
              Completed services for the selected period will appear here.
            </p>
          </div>
        ) : (
          <>
            {/* ===============================================
                PAGINATION INFO
            =============================================== */}

            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
              <span>
                Showing {(currentServicePage - 1) * servicePageSize + 1}–
                {Math.min(
                  currentServicePage * servicePageSize,

                  servicesWithMaterials.length,
                )}{" "}
                of {servicesWithMaterials.length} completed services
              </span>

              <span>
                Page {currentServicePage} of {totalServicePages}
              </span>
            </div>

            {/* ===============================================
                SERVICE TABLE
            =============================================== */}

            <div className="max-h-[520px] overflow-auto rounded-lg border border-gray-200">
              <table className="min-w-[1120px] w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-gray-100 text-left text-xs uppercase tracking-wide text-gray-600">
                  <tr>
                    <th className="px-4 py-3">Date & Time</th>

                    <th className="px-4 py-3">Service</th>

                    <th className="px-4 py-3">Source</th>

                    <th className="px-4 py-3">Section</th>

                    <th className="px-4 py-3">Performed By</th>

                    <th className="px-4 py-3 text-right">Service Amount</th>

                    <th className="px-4 py-3 text-right">Salon Amount</th>

                    <th className="sticky right-0 bg-gray-100 px-4 py-3 text-center">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 bg-white">
                  {paginatedServices.map((service) => {
                    const transactionId = service.transaction_id ?? service.id;

                    const actualPerformers = getActualPerformers(service);

                    const sourceLabel = getServiceSourceLabel(service);

                    return (
                      <tr key={transactionId} className="hover:bg-blue-50/50">
                        {/* DATE / TIME */}

                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                          <div className="font-medium text-gray-800">
                            {service.service_date || "—"}
                          </div>

                          <div className="text-xs">
                            {String(service.service_time || "").slice(0, 8) ||
                              "—"}
                          </div>
                        </td>

                        {/* SERVICE */}

                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">
                            {service.service_name || "Unnamed service"}
                          </div>

                          <div className="mt-1">
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                              Completed
                            </span>
                          </div>
                        </td>

                        {/* SOURCE */}

                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              sourceLabel === "Online booking"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-stone-100 text-stone-700"
                            }`}
                          >
                            {sourceLabel}
                          </span>
                        </td>

                        {/* SECTION */}

                        <td className="px-4 py-3 text-gray-700">
                          {service.section_name || "—"}
                        </td>

                        {/* ACTUAL PERFORMERS */}

                        <td className="px-4 py-3 text-gray-700">
                          {actualPerformers.length > 0 ? (
                            <div className="space-y-1">
                              {actualPerformers.map((performer, index) => (
                                <div
                                  key={`${transactionId}-${performer.role_id ?? index}-${performer.employee_id}`}
                                >
                                  <span className="font-medium text-gray-800">
                                    {[performer.first_name, performer.last_name]
                                      .filter(Boolean)
                                      .join(" ")}
                                  </span>

                                  {performer.role_name && (
                                    <span className="text-xs text-gray-500">
                                      {" "}
                                      · {performer.role_name}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400">
                              No employee recorded
                            </span>
                          )}
                        </td>

                        {/* FULL AMOUNT */}

                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-gray-900">
                          {formatMoney(
                            service.full_amount ?? service.service_amount ?? 0,
                          )}{" "}
                          UGX
                        </td>

                        {/* SALON AMOUNT */}

                        <td className="whitespace-nowrap px-4 py-3 text-right text-gray-700">
                          {formatMoney(service.salon_amount || 0)} UGX
                        </td>

                        {/* ACTIONS */}

                        <td className="sticky right-0 bg-white px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleViewClick(transactionId)}
                              className="rounded-lg p-2 text-blue-700 transition hover:bg-blue-100"
                              title="View service details"
                              aria-label="View service details"
                            >
                              <Eye size={17} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleEditClick(transactionId)}
                              className="rounded-lg p-2 text-amber-700 transition hover:bg-amber-100"
                              title="Edit service"
                              aria-label="Edit service"
                            >
                              <Pencil size={17} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(transactionId)}
                              className="rounded-lg p-2 text-red-700 transition hover:bg-red-100"
                              title="Delete service"
                              aria-label="Delete service"
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ===============================================
                PAGINATION
            =============================================== */}

            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={currentServicePage <= 1}
                onClick={() => setServicePage((page) => Math.max(1, page - 1))}
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={16} />
                Previous
              </button>

              <button
                type="button"
                disabled={currentServicePage >= totalServicePages}
                onClick={() =>
                  setServicePage((page) =>
                    Math.min(totalServicePages, page + 1),
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </>
        )}
      </section>

      {/* ===================================================
          EDIT SERVICE MODAL
      =================================================== */}

      <Modal
        isOpen={showModal && Boolean(editingService)}
        onClose={() => {
          setShowModal(false);

          setEditingService(null);

          setEditOptions(null);
        }}
        sizeClass="max-w-3xl"
      >
        {editingService && (
          <ServiceForm
            isCustomer={false}
            serviceData={editingService}
            onSubmit={handleEditServiceSubmit}
            onClose={() => {
              setShowModal(false);

              setEditingService(null);

              setEditOptions(null);
            }}
            Sections={editOptions?.sections || sections}
            Services={editOptions?.services || serviceDefinitions}
            Roles={editOptions?.roles || serviceRoles}
            Employees={editOptions?.employees || Employees}
            serviceStatus={editingService?.status || "completed"}
            /*
             * OWNER REPORT:
             *
             * Owner is allowed to correct:
             *
             * section
             * service
             * employees
             * note
             *
             * Therefore service details remain editable.
             */
            canEditServiceDetails={true}
          />
        )}
      </Modal>

      {/* ===================================================
          VIEW SERVICE MODAL
      =================================================== */}

      <Modal
        isOpen={Boolean(viewingService)}
        onClose={() => setViewingService(null)}
        sizeClass="max-w-3xl"
      >
        {viewingService && (
          <div className="max-h-[75vh] overflow-y-auto p-1">
            {/* HEADER */}

            <div className="mb-5 border-b pb-4">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                Service transaction
              </p>

              <h2 className="mt-1 text-2xl font-bold text-gray-900">
                {viewingService.service_name || "Service details"}
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Transaction #
                {viewingService.transaction_id ?? viewingService.id}
              </p>
            </div>

            {/* DETAILS */}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Section", viewingService.section_name],

                ["Date", viewingService.service_date],

                ["Time", String(viewingService.service_time || "").slice(0, 8)],

                ["Status", viewingService.status || "Completed"],

                ["Source", getServiceSourceLabel(viewingService)],

                [
                  "Service Amount",

                  `${formatMoney(
                    viewingService.full_amount ??
                      viewingService.service_amount ??
                      0,
                  )} UGX`,
                ],

                [
                  "Salon Amount",

                  `${formatMoney(viewingService.salon_amount || 0)} UGX`,
                ],

                ["Entry Type", viewingService.entry_type],

                [
                  "Recorded By",

                  viewingService.recorded_by_name || viewingService.created_by,
                ],

                [
                  "Customer",

                  viewingService.customer_name || viewingService.customer_id,
                ],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-gray-50 p-3">
                  <div className="text-xs font-semibold uppercase text-gray-500">
                    {label}
                  </div>

                  <div className="mt-1 font-medium text-gray-900">
                    {value || "—"}
                  </div>
                </div>
              ))}
            </div>

            {/* EMPLOYEES / MATERIALS */}

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              {/* EMPLOYEES */}

              <div>
                <h3 className="font-bold text-gray-900">
                  Actual Employees and Roles
                </h3>

                <div className="mt-2 space-y-2">
                  {getActualPerformers(viewingService).length > 0 ? (
                    getActualPerformers(viewingService).map(
                      (performer, index) => (
                        <div
                          key={performer.role_id || index}
                          className="rounded-lg border p-3 text-sm"
                        >
                          <div className="font-semibold">
                            {[performer.first_name, performer.last_name]
                              .filter(Boolean)
                              .join(" ") || "Employee"}
                          </div>

                          <div className="mt-1 text-gray-500">
                            {performer.role_name || "Role not specified"} ·{" "}
                            {formatMoney(
                              performer.role_amount ??
                                performer.earned_amount ??
                                0,
                            )}{" "}
                            UGX
                          </div>
                        </div>
                      ),
                    )
                  ) : (
                    <p className="text-sm text-gray-500">
                      No actual employee performers were recorded.
                    </p>
                  )}
                </div>
              </div>

              {/* MATERIALS */}

              <div>
                <h3 className="font-bold text-gray-900">Materials</h3>

                <div className="mt-2 space-y-2">
                  {Array.isArray(viewingService.materials) &&
                  viewingService.materials.length > 0 ? (
                    viewingService.materials.map((material, index) => (
                      <div
                        key={`${material.material_name}-${index}`}
                        className="flex justify-between gap-4 rounded-lg border p-3 text-sm"
                      >
                        <span className="font-semibold">
                          {material.material_name || "Material"}
                        </span>

                        <span>
                          {formatMoney(
                            material.material_cost ?? material.cost ?? 0,
                          )}{" "}
                          UGX
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">
                      No materials recorded for this service.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* CUSTOMER PREFERENCE */}

            {Array.isArray(viewingService.performers) &&
              viewingService.performers.some(
                (performer) => performer.preferred_employee_id,
              ) && (
                <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <h3 className="font-bold text-gray-900">
                    Original Customer Preference
                  </h3>

                  <div className="mt-2 space-y-1">
                    {viewingService.performers
                      .filter((performer) => performer.preferred_employee_id)
                      .map((performer, index) => {
                        const name = [
                          performer.preferred_first_name,

                          performer.preferred_last_name,
                        ]
                          .filter(Boolean)
                          .join(" ");

                        return (
                          <p
                            key={`preferred-${performer.role_id ?? index}`}
                            className="text-sm text-amber-900"
                          >
                            <span className="font-semibold">
                              {performer.role_name || "Professional"}:
                            </span>{" "}
                            {name || "Preferred employee"}
                          </p>
                        );
                      })}
                  </div>
                </div>
              )}

            {/* NOTE */}

            {viewingService.customer_note && (
              <div className="mt-5 rounded-lg bg-yellow-50 p-4">
                <h3 className="font-bold text-gray-900">Service Note</h3>

                <p className="mt-1 text-sm text-gray-700">
                  {viewingService.customer_note}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ===================================================
          DELETE CONFIRMATION
      =================================================== */}

      {confirmModalOpen && (
        <ConfirmModal
          isOpen={confirmModalOpen}
          confirmMessage="Yes"
          onConfirm={confirmDelete}
          onClose={() => {
            setConfirmModalOpen(false);

            setServiceToDelete(null);
          }}
          message="Are you sure you want to delete this service?"
        />
      )}
    </div>
  );
};

export default OwnerIncomeReport;
