import React, { useState, useEffect, useMemo } from "react";
import { useData } from "../../context/DataContext.jsx";
import "../../styles/IncomeDailyReport.css";
import Modal from "../../components/Modal";
import ServiceForm from "../../components/ServiceForm.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";

const EmployeeIncomeReport = ({ employee }) => {
  const {
    services,
    serviceRoles,
    serviceMaterials,
    serviceDefinitions,
    lateFees,
    tagFees,
    users,
    advances,
    expenses,
    fetchDailyData,
    fetchWeeklyData,
    fetchMonthlyData,
    fetchYearlyData,
    fetchServiceMaterials,
    fetchServiceDefinitions,
  } = useData();

  const [selectedPeriod, setSelectedPeriod] = useState("day"); // day | week | month | year
  const [periodValue, setPeriodValue] = useState(null); // date, week range, month, year
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null);

  // Filter services by employee
  const employeeServices = useMemo(() => {
    if (!services) return [];
    return services.filter((s) => s.performers?.some((p) => p.employee_id === employee.id));
  }, [services, employee.id]);

  // Filter all totals (expenses, advances, tagFees, lateFees) if needed
  const employeeExpenses = useMemo(() => expenses || [], [expenses]);
  const employeeAdvances = useMemo(() => advances || [], [advances]);
  const employeeTagFees = useMemo(() => tagFees || [], [tagFees]);
  const employeeLateFees = useMemo(() => lateFees || [], [lateFees]);

  // Same helper functions as in OwnerIncomeDailyReport
  const serviceEmployeeSalary = (s) =>
    s.performers.reduce(
      (sum, p) => sum + (parseFloat(p.role_amount || p.earned_amount || 0) || 0),
      0,
    );
  const serviceMaterialsTotal = (s) =>
    s.materials?.reduce((sum, m) => sum + (parseFloat(m.material_cost || 0) || 0), 0) || 0;

  const calculateTotals = () => {
    const grossIncome = employeeServices.reduce(
      (sum, s) => sum + (parseFloat(s.full_amount || 0) || 0),
      0,
    );
    const employeesSalary = employeeServices.reduce((sum, s) => sum + serviceEmployeeSalary(s), 0);
    const materialsTotal = employeeServices.reduce((sum, s) => sum + serviceMaterialsTotal(s), 0);
    const totalExpenses = employeeExpenses.reduce(
      (sum, e) => sum + (parseFloat(e.amount || 0) || 0),
      0,
    );
    const totalAdvances = employeeAdvances.reduce(
      (sum, a) => sum + (parseFloat(a.amount || 0) || 0),
      0,
    );
    const totalLateFees = employeeLateFees.reduce(
      (sum, l) => sum + (parseFloat(l.amount || 0) || 0),
      0,
    );
    const totalTagFees = employeeTagFees.reduce(
      (sum, t) => sum + (parseFloat(t.amount || 0) || 0),
      0,
    );
    const netEmployeeSalary = Math.max(
      0,
      employeesSalary - (totalAdvances + totalLateFees + totalTagFees),
    );
    const netIncome = grossIncome - (totalExpenses + materialsTotal + netEmployeeSalary);
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

  const totals = calculateTotals();

  // ----- Handle period changes -----
  const handlePeriodChange = async (type, value) => {
    setSelectedPeriod(type);
    setPeriodValue(value);

    try {
      if (type === "day") await fetchDailyData(value);
      else if (type === "week") await fetchWeeklyData(value.start, value.end);
      else if (type === "month") await fetchMonthlyData(value.year, value.month);
      else if (type === "year") await fetchYearlyData(value.year);
      // No need to set services again — context is updated
    } catch (err) {
      console.error("Failed to fetch employee period data:", err);
    }
  };

  useEffect(() => {
    fetchServiceMaterials();
    fetchServiceDefinitions();
  }, []);

  // ---------- Render ----------
  return (
    <div className="income-page mx-auto max-w-6xl p-6">
      <h1 className="mb-6 text-center text-3xl font-extrabold text-gray-800">
        {employee.first_name} {employee.last_name} - Income Report
      </h1>

      {/* PERIOD PICKERS */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block font-medium">Day:</label>
          <input
            type="date"
            onChange={(e) => handlePeriodChange("day", e.target.value)}
            className="rounded border p-2"
          />
        </div>
        <div>
          <label className="mb-1 block font-medium">Week:</label>
          <input
            type="week"
            onChange={(e) => {
              const [year, week] = e.target.value.split("-W");
              handlePeriodChange("week", {
                start: getStartOfWeek(year, week),
                end: getEndOfWeek(year, week),
              });
            }}
            className="rounded border p-2"
          />
        </div>
        <div>
          <label className="mb-1 block font-medium">Month:</label>
          <input
            type="month"
            onChange={(e) => {
              const [year, month] = e.target.value.split("-");
              handlePeriodChange("month", { year: parseInt(year), month: parseInt(month) });
            }}
            className="rounded border p-2"
          />
        </div>
        <div>
          <label className="mb-1 block font-medium">Year:</label>
          <input
            type="number"
            placeholder="2025"
            onChange={(e) => handlePeriodChange("year", { year: parseInt(e.target.value) })}
            className="w-24 rounded border p-2"
          />
        </div>
      </div>

      {/* SUMMARY BOXES */}
      <section className="mb-6 grid grid-cols-1 gap-4 rounded-lg bg-white p-4 shadow sm:grid-cols-3 lg:grid-cols-4">
        {[
          { label: "Gross Income", value: totals.grossIncome },
          { label: "Employees Salary", value: totals.employeesSalary },
          { label: "Materials Cost", value: totals.materialsTotal },
          { label: "Expenses", value: totals.totalExpenses },
          { label: "Advances", value: totals.totalAdvances },
          { label: "Tag Fees", value: totals.totalTagFees },
          { label: "Late Fees", value: totals.totalLateFees },
          { label: "Net Employee Salary", value: totals.netEmployeeSalary },
          { label: "Net Income", value: totals.netIncome },
          { label: "Cash at Hand", value: totals.cashAtHand },
        ].map((item, idx) => (
          <div
            key={idx}
            className={`summary-box rounded border p-3 ${item.label.includes("Net") ? "bg-green-50" : ""} ${item.label === "Cash at Hand" ? "bg-green-100" : ""}`}
          >
            <div className="text-sm text-gray-600">{item.label}</div>
            <div className="text-lg font-bold">{(item.value || 0).toLocaleString()} UGX</div>
          </div>
        ))}
      </section>

      {/* SERVICE DETAILS TABLE */}
      <section className="mb-6 rounded-lg bg-white p-4 shadow">
        <h2 className="mb-3 text-lg font-semibold text-gray-700">Service Details</h2>
        <table className="w-full border-collapse border">
          <thead>
            <tr className="bg-blue-50">
              <th className="border px-2 py-1 text-left">#</th>
              <th className="border px-2 py-1 text-left">Service Name</th>
              <th className="border px-2 py-1 text-left">Section</th>
              <th className="border px-2 py-1 text-left">Amount</th>
              <th className="border px-2 py-1 text-left">Salon</th>
              <th className="border px-2 py-1 text-left">Performers & Materials</th>
            </tr>
          </thead>
          <tbody>
            {employeeServices.map((s, i) => (
              <tr key={s.transaction_id || i}>
                <td className="border px-2 py-1">{i + 1}</td>
                <td className="border px-2 py-1">{s.service_name}</td>
                <td className="border px-2 py-1">{s.section_name || s.section?.section_name}</td>
                <td className="border px-2 py-1">{(s.full_amount || 0).toLocaleString()}</td>
                <td className="border px-2 py-1">{(s.salon_amount || 0).toLocaleString()}</td>
                <td className="border px-2 py-1">
                  {(s.performers || [])
                    .map(
                      (p) =>
                        `${p.first_name} ${p.last_name} (${p.role_name} - ${p.role_amount?.toLocaleString()})`,
                    )
                    .join(", ")}
                  {(s.materials || [])
                    .map((m) => `${m.material_name} (${m.material_cost?.toLocaleString()})`)
                    .join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default EmployeeIncomeReport;

// -------- Helper functions for week picker ----------
function getStartOfWeek(year, week) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  return ISOweekStart;
}
function getEndOfWeek(year, week) {
  const start = getStartOfWeek(year, week);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}
