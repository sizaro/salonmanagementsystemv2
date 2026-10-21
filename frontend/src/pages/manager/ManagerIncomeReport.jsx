import React, { useState, useEffect, useMemo } from "react";
import { useData } from "../../context/DataContext.jsx";
import "../../styles/IncomeDailyReport.css";
import Modal from "../../components/Modal.jsx";
import ServiceForm from "../../components/ServiceForm.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import ReportLoadingState from "../../components/common/ReportLoadingState.jsx";

const ManagerIncomeReport = () => {
  const {
    services = [],
    serviceRoles = [],
    serviceMaterials = [],
    serviceDefinitions =[],
    lateFees = [],
    tagFees = [],
    users = [],
    advances = [],
    expenses = [],
    sessions = [],
    financialSummary = null,
    sections = [],
    fetchUsers,
    fetchDailyData,
    fetchWeeklyData,
    fetchMonthlyData,
    fetchYearlyData,
    fetchServiceTransactions,
    fetchServiceTransactionById,
    updateServiceTransactionById,
    deleteServiceTransaction,
    fetchServiceMaterials,
    fetchServiceDefinitions
  } = useData();

  const servicesWithMaterials = useMemo(() => {
    return (services.data || services || []).map((service) => {
      const matchedMaterials = (serviceMaterials || []).filter(
        (m) => m.service_definition_id === service.service_definition_id
      );
      return {
        ...service,
        materials:
          Array.isArray(service.materials) && service.materials.length > 0
            ? service.materials
            : matchedMaterials,
      };
    });
  }, [services, serviceMaterials]);


  const Employees = (users || []).filter(
    (user) =>
      user &&
      `${user.first_name || ""} ${user.last_name || ""}`.toLowerCase() !== "ntege saleh" &&
      user.role !== "customer"
  );


  const toYMD = (date) => date.toISOString().split("T")[0];

  const today = new Date();
  const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  const reportDate = today.toLocaleDateString("en-US", options);

  const session = sessions && sessions.length > 0 ? sessions[0] : null;

  const [liveDuration, setLiveDuration] = useState("");
  const [selectedDate, setSelectedDate] = useState(toYMD(today));
  const [showModal, setShowModal] = useState(null);
  const [editingService, setEditingService] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null)
  const [reportLabel, setReportLabel] = useState("");
  const [week, setWeek] = useState({ start: null, end: null });
  const [monthYear, setMonthYear] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [reportLoading, setReportLoading] = useState(true);
  const [reportReady, setReportReady] = useState(false);
  const [reportError, setReportError] = useState("");

  const loadIncomeReport = async (request) => {
    setReportLoading(true);
    setReportError("");
    try {
      await request();
      setReportReady(true);
    } catch (error) {
      setReportError(error.response?.data?.error || "Unable to load the income report.");
    } finally {
      setReportLoading(false);
    }
  };

  const handleEditClick = async (id) => {

  if (!id) return console.error("No id provided for edit");
  if (!Employees || Employees.length === 0) {
    await fetchUsers();
  }
  const service = await fetchServiceTransactionById(id);
  setEditingService(service);
  setShowModal(true);
};


  const handleEditServiceSubmit = async (id, updatedService) => {
    await updateServiceTransactionById(id, updatedService);
    await fetchDailyData(selectedDate);
    setShowModal(false);
    setEditingService(null);
  };

  const handleDelete = async (id) => {
    setServiceToDelete(id);
    setConfirmModalOpen(true);
  };

  const confirmDelete = async () => {
    if (serviceToDelete) {
      try {
        await deleteServiceTransaction(serviceToDelete); 
        await fetchDailyData(selectedDate);
      } catch (err) {
        console.error("Failed to delete service:", err);
      } finally {
        setConfirmModalOpen(false);
        setServiceToDelete(null);
      }
    }
  };

  // ---- Sections ----
  const sectionList = useMemo(() => {
    if (Array.isArray(sections) && sections.length > 0) {
      return sections.map((sec) => ({
        id: sec.id,
        name: sec.section_name ?? sec.name ?? String(sec.id),
      }));
    }
    const map = new Map();
    (servicesWithMaterials || []).forEach((s) => {
      const id = s.section_id ?? s.sectionId ?? s.definition_section_id ?? (s.section_name ? s.section_name : null);
      const name = s.section_name ?? s.section?.section_name ?? s.section?.name ?? (typeof id === "string" ? id : `Section ${id}`);
      const key = id ?? name;
      if (!map.has(key)) map.set(key, { id: id ?? name, name });
    });
    if (map.size === 0) {
      return [{ id: "default", name: "Default" }];
    }
    return Array.from(map.values());
  }, [sections, servicesWithMaterials]);

  const servicesForSection = (section) => {
    if (!section) return [];
    return (servicesWithMaterials || []).filter((s) => {
      const secId = String(section.id ?? "").trim().toLowerCase();
      const secName = String(section.section_name ?? "").trim().toLowerCase();
      const sId = String(s.section_id ?? s.definition_section_id ?? "").trim().toLowerCase();
      const sName = String(s.section_name ?? (s.section && s.section.section_name) ?? "").trim().toLowerCase();
      if (secId && sId && secId === sId) return true;
      if (secName && sName && sName === secName) return true;
      if (secName && sName && (sName.includes(secName) || secName.includes(sName))) return true;
      return false;
    });
  };

  const serviceEmployeeSalary = (s) => {
    if (!s || !Array.isArray(s.performers)) return 0;
    return s.performers.reduce((sum, p) => sum + (parseFloat(p.role_amount || p.earned_amount || p.amount || 0) || 0), 0);
  };

  const serviceMaterialsTotal = (s) => {
    if (!s || !Array.isArray(s.materials)) return 0;
    return s.materials.reduce((sum, m) => sum + (parseFloat(m.material_cost || m.cost || 0) || 0), 0);
  };

  const calculateSectionTotals = (sectionServices) => {
    const gross = sectionServices.reduce((sum, s) => sum + (parseFloat(s.service_amount || s.full_amount || 0) || 0), 0);
    const employeeSalary = sectionServices.reduce((sum, s) => sum + serviceEmployeeSalary(s), 0);
    const materialsTotal = sectionServices.reduce((sum, s) => sum + serviceMaterialsTotal(s), 0);
    const salonIncome = sectionServices.reduce((sum, s) => sum + (parseFloat(s.salon_amount || 0) || 0), 0);
    return { gross, employeeSalary, materialsTotal, salonIncome };
  };

  const dynamicSectionSummaries = useMemo(() => {
    return sectionList.map((sec) => {
      const secServices = servicesForSection(sec);
      const totals = calculateSectionTotals(secServices);
      return { id: sec.id, name: sec.name, services: secServices, totals };
    });
  }, [sectionList, servicesWithMaterials]);

  const calculateTotals = (servicesList = [], expensesList = [], advancesList = [], tagFeesList = [], lateFeesList = []) => {
    const grossIncome = (servicesList || []).reduce((sum, s) => sum + (parseFloat(s.service_amount || s.full_amount || 0) || 0), 0);
    const employeesSalary = (servicesList || []).reduce((sum, s) => sum + serviceEmployeeSalary(s), 0);
    const materialsTotal = (servicesList || []).reduce((sum, s) => sum + serviceMaterialsTotal(s), 0);
    const totalExpenses = (expensesList || []).reduce((sum, e) => sum + (parseFloat(e.amount || 0) || 0), 0);
    const totalAdvances = (advancesList || []).reduce((sum, a) => sum + (parseFloat(a.amount || 0) || 0), 0);
    const totalLateFees = (lateFeesList || []).reduce((sum, l) => sum + (parseFloat(l.amount || 0) || 0), 0);
    const totaltagFees = (tagFeesList || []).reduce((sum, t) => sum + (parseFloat(t.amount || 0) || 0), 0);
    return {
      totalLateFees,
      totaltagFees,
      grossIncome,
      employeesSalary,
      materialsTotal,
      totalExpenses,
      totalAdvances,
      operatingMargin: grossIncome - employeesSalary - materialsTotal - totalExpenses,
    };
  };

  const fallbackFinance = calculateTotals(servicesWithMaterials, expenses, advances, tagFees, lateFees);
  const activity = financialSummary?.activity || {
    service_revenue: fallbackFinance.grossIncome,
    employee_earnings: fallbackFinance.employeesSalary,
    configured_material_cost_estimate: fallbackFinance.materialsTotal,
    business_expenses: fallbackFinance.totalExpenses,
    operating_margin: fallbackFinance.operatingMargin,
  };
  const financeMovements = financialSummary?.finance_movements || {
    employee_payments_disbursed: 0,
    advances_disbursed: fallbackFinance.totalAdvances,
    effective_payroll_deductions: 0,
    cash_advance_repayments: 0,
    advance_waivers: 0,
    tag_fees_recorded: fallbackFinance.totaltagFees,
    late_fees_recorded: fallbackFinance.totalLateFees,
  };
  const closingBalances = financialSummary?.closing_balances || {
    employee_earnings_payable: 0,
    advances_outstanding: 0,
  };
  const customerCollections = financialSummary?.customer_collections || {
    cash: activity.service_revenue,
    mtn_mobile_money: 0,
    airtel_money: 0,
    bank_transfer: 0,
    other: 0,
  };
  const cashPosition = financialSummary?.cash_position || {
    net_cash_movement: Number(activity.service_revenue || 0) - Number(financeMovements.advances_disbursed || 0) - Number(activity.business_expenses || 0),
  };

  const sessionMoment = (date, time) => {
    if (!date || !time) return null;
    const moment = new Date(`${date}T${time}+03:00`);
    return Number.isNaN(moment.getTime()) ? null : moment;
  };

  const formatEAT = (date, time) => {
    const moment = sessionMoment(date, time);
    return moment
      ? moment.toLocaleString("en-UG", { timeZone: "Africa/Kampala", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })
      : "N/A";
  };

  const calculateDuration = (openDate, openTime, closeDate, closeTime) => {
    const openedAt = sessionMoment(openDate, openTime);
    const closedAt = closeDate && closeTime ? sessionMoment(closeDate, closeTime) : new Date();
    if (!openedAt || !closedAt) return "N/A";
    const diffMs = closedAt - openedAt;
    if (diffMs < 0) return "N/A";
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  useEffect(() => {
    if (!session?.open_date || !session?.open_time) return;
    const updateDuration = () => setLiveDuration(calculateDuration(session.open_date, session.open_time, session.close_date, session.close_time));
    updateDuration();
    if (!(session.close_date && session.close_time)) {
      const interval = setInterval(() => {
        updateDuration();
      }, 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [session]);

  const handleDayChange = (e) => {
  setSelectedDate(e.target.value);
  void loadIncomeReport(() => fetchDailyData(e.target.value));
  fetchUsers();
};

const handleWeekChange = (e) => {
  const weekString = e.target.value;

  if (!weekString) return;

  const [year, week] = weekString.split("-W").map(Number);

  const firstDayOfYear = new Date(year, 0, 1);
  const day = firstDayOfYear.getDay();
  const firstMonday = new Date(firstDayOfYear);
  const diff = day <= 4 ? day - 1 : day - 8;
  firstMonday.setDate(firstDayOfYear.getDate() - diff);

  const monday = new Date(firstMonday);
  monday.setDate(firstMonday.getDate() + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  setWeek({ start: monday, end: sunday });
  setReportLabel(
    `${monday.toLocaleDateString("en-US")} → ${sunday.toLocaleDateString("en-US")}`
  );
  void loadIncomeReport(() => fetchWeeklyData(monday, sunday));
  fetchUsers();
};

const handleMonthChange = (e) => {
  const value = e.target.value;
    if (!value) return;

    const [year, month] = value.split("-").map(Number);
    setMonthYear(value);
    setReportLabel(
      `${new Date(year, month - 1, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })}`
    );
    void loadIncomeReport(() => fetchMonthlyData(year, month));
    fetchUsers()
};

const handleYearChange = (e) => {
  const selectedYear = parseInt(e.target.value, 10);
    setYear(selectedYear);
    setReportLabel(`Year ${selectedYear}`);
    void loadIncomeReport(() => fetchYearlyData(selectedYear));
};

// ---- Generate year options ----
  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= currentYear - 10; y--) {
      years.push(y);
    }
    return years;
  };

  useEffect(() => {
    let isMounted = true;

    const loadInitialReport = async () => {
      try {
        await loadIncomeReport(() => Promise.all([
          fetchDailyData(selectedDate),
          fetchUsers(),
          fetchServiceMaterials(),
        ]));
      } catch (err) {
        console.error("Failed to load initial income report data:", err);
      }
    };

    if (isMounted) {
      loadInitialReport();
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const formatPerformersAndMaterials = (s) => {
    const lines = [];
    if (Array.isArray(s.performers) && s.performers.length > 0) {
      lines.push("Performers:");
      s.performers.forEach((p) => {
        const amount = Number(p.role_amount ?? p.earned_amount ?? p.amount ?? 0);
        lines.push(`- ${p.last_name ?? "N/A"} (${p.role_name ?? "N/A"} - ${amount.toLocaleString()} )`);
      });
    }
    if (Array.isArray(s.materials) && s.materials.length > 0) {
      lines.push("Materials:");
      s.materials.forEach((m) => {
        const cost = Number(m.material_cost ?? m.cost ?? 0);
        lines.push(`- ${m.material_name ?? "Material"} (${cost.toLocaleString()})`);
      });
    }
    if (lines.length === 0) return ["N/A"];
    return lines;
  };

  // Count total services
const totalServicesCount = (servicesWithMaterials || []).length;

// Count how many services per section
const sectionServiceCount = (sectionId) => {
  return (servicesWithMaterials || []).filter(
    (s) =>
      String(s.section_id || s.definition_section_id || "").trim().toLowerCase() ===
      String(sectionId).trim().toLowerCase()
  ).length;
};

// Count each service type (e.g., Scrub - 2)
const serviceNameCounts = useMemo(() => {
  const map = new Map();
  (servicesWithMaterials || []).forEach((s) => {
    const name = s.service_name || "Unknown";
    map.set(name, (map.get(name) || 0) + 1);
  });
  return Array.from(map.entries()); // [["Scrub", 2], ["Hair Cut", 1]]
}, [servicesWithMaterials]);


  // ---------- Render ----------
  if (reportLoading && !reportReady) {
    return <div className="income-page mx-auto max-w-6xl p-6"><ReportLoadingState message="Loading the income report and service details..." /></div>;
  }
  return (
    <div className="income-page max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-extrabold text-center mb-6 text-gray-800">
        {reportDate} Report
      </h1>
      {reportError && <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{reportError}</p>}
      {reportLoading && <div className="mb-5"><ReportLoadingState compact message="Updating the report for the selected period..." /></div>}

      {/* Period Pickers */}
<div className="mb-6 flex flex-wrap gap-4 items-end">
  {/* Day Picker */}
  <div>
    <label className="block font-medium mb-1">Day:</label>
    <input
      type="date"
      value={selectedDate}
      onChange={handleDayChange}
      className="border rounded p-2"
    />
  </div>

  {/* Week Picker */}
  <div>
    <label className="block font-medium mb-1">Week:</label>
    <input
      type="week"
      onChange={handleWeekChange}
      className="border rounded p-2"
    />
  </div>

  {/* Month Picker */}
  <div>
    <label className="block font-medium mb-1">Month:</label>
    <input
      type="month"
      value={monthYear}
      onChange={handleMonthChange}
      className="border rounded p-2"
    />
  </div>

  {/* Year Picker */}
  <div>
    <label className="block font-medium mb-1">Year:</label>
    <select
      
      onChange={handleYearChange}
      className="border rounded p-2"
    >

      <option value="" disabled selected>
      Select Year
    </option>
      {generateYearOptions().map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  </div>
</div>


      {session ? (
        <>
          {/* SESSION INFO */}
          <section className="bg-white shadow rounded-lg p-4 mb-6">
            <h2 className="text-xl font-semibold text-blue-700 mb-2">{reportDate}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-sm text-gray-600">Opened</p>
                <p className="font-medium">{formatEAT(session.open_date, session.open_time)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Closed</p>
                <p className="font-medium">{session.close_date && session.close_time ? formatEAT(session.close_date, session.close_time) : "Still open"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Duration</p>
                <p className="font-medium">{liveDuration} {!(session.close_date && session.close_time) && "(Counting...)"}</p>
              </div>
            </div>
          </section>

          {/* DYNAMIC SECTION SUMMARIES */}
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Section Summaries</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dynamicSectionSummaries.map((sec) => (
                <div key={sec.id} className="bg-white rounded-lg shadow p-4">
                  <h3 className="text-md font-semibold text-blue-700 mb-2">{sec.name} Section Summary</h3>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="p-3 rounded border bg-blue-50">
                      <div className="text-sm text-gray-700">Completed-service revenue</div>
                      <div className="text-xl font-bold">{(sec.totals.gross || 0).toLocaleString()} UGX</div>
                    </div>
                    <div className="p-3 rounded border bg-blue-50">
                      <div className="text-sm text-gray-700">Employee earnings</div>
                      <div className="text-xl font-bold">{(sec.totals.employeeSalary || 0).toLocaleString()} UGX</div>
                    </div>
                    <div className="p-3 rounded border bg-blue-50">
                      <div className="text-sm text-gray-700">Configured material estimate</div>
                      <div className="text-xl font-bold">{(sec.totals.materialsTotal || 0).toLocaleString()} UGX</div>
                    </div>
                    <div className="p-3 rounded border bg-blue-100">
                      <div className="text-sm text-gray-700">Salon service share</div>
                      <div className="text-xl font-bold text-green-700">{(sec.totals.salonIncome || 0).toLocaleString()} UGX</div>
                    </div>
                    <div className="mb-2 text-sm font-medium text-purple-700">
                          Services Count: {sec.services.length}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* SUMMARY BOXES */}
          <section className="bg-white shadow rounded-lg p-4 mb-6">
            <h2 className="text-xl font-semibold text-blue-700 mb-1">Financial summary</h2>
            <p className="mb-4 text-sm text-gray-500">Completed services create revenue and employee earnings. Advances, payments and deductions are tracked separately.</p>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Operating activity</h3>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { label: "Completed-service revenue", value: activity.service_revenue },
                { label: "Employee earnings created", value: activity.employee_earnings },
                { label: "Configured material estimate", value: activity.configured_material_cost_estimate },
                { label: "Business expenses", value: activity.business_expenses },
                { label: "Operating margin", value: activity.operating_margin },
              ].map((item) => <div key={item.label} className="summary-box p-3 border rounded bg-slate-50"><div className="text-sm text-gray-600">{item.label}</div><div className="font-bold text-lg">{Number(item.value || 0).toLocaleString()} UGX</div></div>)}
            </div>
            <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-gray-600">Finance movements during this period</h3>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[
                { label: "Employee payments disbursed", value: financeMovements.employee_payments_disbursed },
                { label: "Advances disbursed", value: financeMovements.advances_disbursed },
                { label: "Effective payroll deductions", value: financeMovements.effective_payroll_deductions },
                { label: "Cash advance repayments", value: financeMovements.cash_advance_repayments },
                { label: "Advance waivers", value: financeMovements.advance_waivers },
                { label: "Tag fees recorded", value: financeMovements.tag_fees_recorded },
                { label: "Late fees recorded", value: financeMovements.late_fees_recorded },
              ].map((item) => <div key={item.label} className="summary-box p-3 border rounded bg-slate-50"><div className="text-sm text-gray-600">{item.label}</div><div className="font-bold text-lg">{Number(item.value || 0).toLocaleString()} UGX</div></div>)}
            </div>
            <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-gray-600">Balances at the end of this period</h3>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="summary-box p-3 border rounded bg-amber-50"><div className="text-sm text-gray-600">Employee earnings payable</div><div className="font-bold text-lg">{Number(closingBalances.employee_earnings_payable || 0).toLocaleString()} UGX</div></div>
              <div className="summary-box p-3 border rounded bg-amber-50"><div className="text-sm text-gray-600">Outstanding employee advances</div><div className="font-bold text-lg">{Number(closingBalances.advances_outstanding || 0).toLocaleString()} UGX</div></div>
              <div className="summary-box p-3 border rounded bg-emerald-50"><div className="text-sm text-gray-600">Cash service receipts</div><div className="font-bold text-lg">{Number(customerCollections.cash || 0).toLocaleString()} UGX</div><p className="mt-1 text-xs text-gray-500">Net cash movement: {Number(cashPosition.net_cash_movement || 0).toLocaleString()} UGX</p></div>
            </div>
            <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-gray-600">Customer collections by channel</h3>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Cash", value: customerCollections.cash },
                { label: "MTN MoMo", value: customerCollections.mtn_mobile_money },
                { label: "Airtel Money", value: customerCollections.airtel_money },
                { label: "Bank and other", value: Number(customerCollections.bank_transfer || 0) + Number(customerCollections.other || 0) },
              ].map((item) => <div key={item.label} className="summary-box p-3 border rounded bg-emerald-50"><div className="text-sm text-gray-600">{item.label}</div><div className="font-bold text-lg">{Number(item.value || 0).toLocaleString()} UGX</div></div>)}
            </div>
            <p className="text-md font-bold text-gray-700 mt-4 mb-3">Total completed services: {totalServicesCount}</p>
          </section>

          <section className="bg-white shadow rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Service Counts</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {serviceNameCounts.map(([name, count], i) => (
                <div key={i} className="p-3 rounded border bg-purple-50 shadow">
                  <div className="font-bold text-gray-800">{name}</div>
                  <div className="text-lg text-blue-700">{count}</div>
                </div>
              ))}
            </div>
          </section>


          {/* SERVICE DETAILS TABLE */}
          <section className="bg-white shadow rounded-lg p-4 mb-6">
  <h2 className="text-lg font-semibold text-gray-700 mb-3">Service Details</h2>

  {/* Horizontal scroll wrapper */}
  <div className="overflow-x-auto">
    {/* Vertical scroll wrapper */}
    <div className="max-h-[300px] overflow-y-auto">
      <table className="min-w-full border-collapse table-auto">
        <thead className="bg-blue-50 sticky top-0 z-10">
          <tr>
            <th className="border px-2 py-1 text-left">#</th>
            <th className="border px-2 py-1 text-left">Service Name</th>
            <th className="border px-2 py-1 text-left">Section</th>
            <th className="border px-2 py-1 text-left">Amount</th>
            <th className="border px-2 py-1 text-left">Salon</th>
            <th className="border px-2 py-1 text-left">Performers & Materials</th>

          </tr>
        </thead>
        <tbody>
          {(servicesWithMaterials || []).map((s, i) => (
            <tr key={s.id || i} className="hover:bg-gray-50">
              <td className="border px-2 py-1">{i + 1}</td>
              <td className="border px-2 py-1">{s.service_name}</td>
              <td className="border px-2 py-1">{s.section_name || s.section?.section_name}</td>
              <td className="border px-2 py-1">{(s.full_amount || 0).toLocaleString()}</td>
              <td className="border px-2 py-1">{(s.salon_amount || 0).toLocaleString()}</td>
              <td className="border px-2 py-1">
                {formatPerformersAndMaterials(s).map((line, idx) => (
                  <div key={idx}>{line}</div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
</section>


          {/* EDIT SERVICE MODAL */}
            <Modal isOpen={showModal} onClose={() => setShowModal(null)}>
              <ServiceForm serviceData={editingService} onSubmit={handleEditServiceSubmit} Sections={sections} Services={serviceDefinitions} Roles={serviceRoles} Employees={Employees} />
            </Modal>

          {/* CONFIRM DELETE MODAL */}
          {confirmModalOpen && (
            <ConfirmModal
            isOpen={confirmModalOpen}
            confirmMessage="Yes"
              onConfirm={confirmDelete}
              onClose={() => setConfirmModalOpen(null)}
              message="Are you sure you want to delete this service?"
            />
          )}
        </>
      ) : (
        <p>No session data available.</p>
      )}
    </div>
  );
};

export default ManagerIncomeReport;
