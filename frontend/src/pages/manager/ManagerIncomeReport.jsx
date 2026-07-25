import React, { useState, useEffect, useMemo } from "react";
import { useData } from "../../context/DataContext.jsx";
import "../../styles/IncomeDailyReport.css";
import Modal from "../../components/Modal.jsx";
import ServiceForm from "../../components/ServiceForm.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";

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
      return { ...service, materials: matchedMaterials.length > 0 ? matchedMaterials : null };
    });
  }, [services, serviceMaterials]);

  console.log("services with materials", servicesWithMaterials)

  const Employees = (users || []).filter(
    (user) =>
      user &&
      `${user.first_name || ""} ${user.last_name || ""}`.toLowerCase() !== "ntege saleh" &&
      user.role !== "customer"
  );

  console.log("users in the daily page", users)

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

  const handleEditClick = async (id) => {

  if (!id) return console.error("No id provided for edit");
  if (!Employees || Employees.length === 0) {
    await fetchUsers();
  }
  const service = await fetchServiceTransactionById(id);
  console.log("service transaction to be edited", service)
  setEditingService(service);
  setShowModal(true);
};


  const handleEditServiceSubmit = async (id, updatedService) => {
    console.log("received service to be edited in parent", updatedService)
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
    const netEmployeeSalary = Math.max(0, employeesSalary - (totalAdvances + totalLateFees + totaltagFees));
    const netIncome = grossIncome - (totalExpenses + materialsTotal + netEmployeeSalary);
    const cashAtHand = netIncome + netEmployeeSalary;
    return { totalLateFees, totaltagFees, grossIncome, employeesSalary, materialsTotal, totalExpenses, totalAdvances, netEmployeeSalary, netIncome, cashAtHand };
  };

  const {
    totalLateFees,
    totaltagFees,
    grossIncome,
    employeesSalary,
    materialsTotal,
    totalExpenses,
    totalAdvances,
    netEmployeeSalary,
    netIncome,
    cashAtHand,
  } = calculateTotals(servicesWithMaterials, expenses, advances, tagFees, lateFees);

  const formatEAT = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleString("en-UG", { timeZone: "Africa/Kampala", hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return dateString;
    }
  };

  const calculateDuration = (openUTC, closeUTC) => {
    if (!openUTC || !closeUTC) return "N/A";
    const diffMs = new Date(closeUTC) - new Date(openUTC);
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  useEffect(() => {
    if (!session) return;
    const openUTC = session.open_time;
    const closeUTC = session.close_time || session.server_now;
    setLiveDuration(calculateDuration(openUTC, closeUTC));
    if (!session.close_time) {
      const interval = setInterval(() => {
        setLiveDuration(calculateDuration(openUTC, session.server_now));
      }, 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [session]);

  const handleDayChange = (e) => {
  console.log("handleDayChange called with value:", e.target.value);
  setSelectedDate(e.target.value);
  fetchDailyData(e.target.value);
  fetchUsers();
};

const handleWeekChange = (e) => {
  const weekString = e.target.value;
  console.log("handleWeekChange called with weekString:", weekString);

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
  fetchWeeklyData(monday, sunday);
  fetchUsers();
};

const handleMonthChange = (e) => {
  console.log("handleMonthChange called with value:", e.target.value);
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
    fetchMonthlyData(year, month);
    fetchUsers()
};

const handleYearChange = (e) => {
  console.log("handleYearChange called with value:", e.target.value);
  const selectedYear = parseInt(e.target.value, 10);
    setYear(selectedYear);
    setReportLabel(`Year ${selectedYear}`);
    fetchYearlyData(selectedYear)
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
        await Promise.all([
          fetchDailyData(selectedDate),
          fetchUsers(),
          fetchServiceMaterials(),
        ]);
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
  }, [selectedDate]);

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


console.log("Employees in te income daily report", Employees)
  // ---------- Render ----------
  return (
    <div className="income-page max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-extrabold text-center mb-6 text-gray-800">
        {reportDate} Report
      </h1>

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
                <p className="font-medium">{formatEAT(session.open_time)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Closed</p>
                <p className="font-medium">{session.close_time ? formatEAT(session.close_time) : "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Duration</p>
                <p className="font-medium">{liveDuration} {!session.close_time && "(Counting...)"}</p>
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
                      <div className="text-sm text-gray-700">Gross Income</div>
                      <div className="text-xl font-bold">{(sec.totals.gross || 0).toLocaleString()} UGX</div>
                    </div>
                    <div className="p-3 rounded border bg-blue-50">
                      <div className="text-sm text-gray-700">Employees Salary</div>
                      <div className="text-xl font-bold">{(sec.totals.employeeSalary || 0).toLocaleString()} UGX</div>
                    </div>
                    <div className="p-3 rounded border bg-blue-50">
                      <div className="text-sm text-gray-700">Materials Cost</div>
                      <div className="text-xl font-bold">{(sec.totals.materialsTotal || 0).toLocaleString()} UGX</div>
                    </div>
                    <div className="p-3 rounded border bg-blue-100">
                      <div className="text-sm text-gray-700">Salon Amount</div>
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
            <h2 className="text-xl font-semibold text-blue-700 mb-4">Summary</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[
                { label: "Gross Income", value: grossIncome },
                { label: "Employees Salary", value: employeesSalary },
                { label: "Materials Cost", value: materialsTotal },
                { label: "Expenses", value: totalExpenses },
                { label: "Advances", value: totalAdvances },
                { label: "Tag Fees", value: totaltagFees },
                { label: "Late Fees", value: totalLateFees },
                { label: "Net Employee Salary", value: netEmployeeSalary },
                { label: "Net Income", value: netIncome },
                { label: "Cash at Hand", value: cashAtHand },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className={`summary-box p-3 border rounded ${item.label.includes("Net") ? "bg-green-50" : ""} ${item.label === "Cash at Hand" ? "bg-green-100" : ""}`}
                >
                  <div className="text-sm text-gray-600">{item.label}</div>
                  <div className="font-bold text-lg">{(item.value || 0).toLocaleString()} UGX</div>
                </div>
              ))}
            </div>
            <p className="text-md font-bold text-gray-700 mb-3">
              Total Services: {totalServicesCount}
            </p>

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
