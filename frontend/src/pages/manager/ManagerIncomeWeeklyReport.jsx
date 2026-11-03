import React, { useState, useEffect } from "react";
import { useData } from "../../context/DataContext.jsx";

const ManagerIncomeWeeklyReport = () => {
  const { services, employees, advances, expenses, sessions, fetchWeeklyData } = useData();

  const [weekRange, setWeekRange] = useState({ start: null, end: null });
  const [reportLabel, setReportLabel] = useState("");

  // ---- Utility Functions ----
  const calculateTotals = (services, expenses, advances) => {
    const grossIncome = services.reduce((sum, s) => sum + (parseInt(s.service_amount, 10) || 0), 0);

    const employeesSalary = services.reduce((sum, s) => {
      return (
        sum +
        (parseInt(s.barber_amount, 10) || 0) +
        (parseInt(s.barber_assistant_amount, 10) || 0) +
        (parseInt(s.scrubber_assistant_amount, 10) || 0) +
        (parseInt(s.black_shampoo_assistant_amount, 10) || 0) +
        (parseInt(s.super_black_assistant_amount, 10) || 0) +
        (parseInt(s.black_mask_assistant_amount, 10) || 0)
      );
    }, 0);

    const totalExpenses = expenses.reduce((sum, e) => sum + (parseInt(e.amount, 10) || 0), 0);

    const totalAdvances = advances.reduce((sum, a) => sum + (parseInt(a.amount, 10) || 0), 0);

    const netEmployeeSalary = employeesSalary - totalAdvances;
    const netIncome = grossIncome - (totalExpenses + netEmployeeSalary);
    const cashAtHand = netIncome + netEmployeeSalary;

    return {
      grossIncome,
      employeesSalary,
      totalExpenses,
      totalAdvances,
      netEmployeeSalary,
      netIncome,
      cashAtHand,
    };
  };

  const {
    grossIncome,
    employeesSalary,
    totalExpenses,
    totalAdvances,
    netEmployeeSalary,
    netIncome,
    cashAtHand,
  } = calculateTotals(services, expenses, advances);

  const formatEAT = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("en-UG", {
      timeZone: "Africa/Kampala",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ---- Handle Week Selection ----
  const handleWeekChange = (e) => {
    const weekString = e.target.value; // e.g. "2025-W39"
    if (!weekString) return;

    const [year, week] = weekString.split("-W").map(Number);

    const firstDayOfYear = new Date(year, 0, 1);
    const day = firstDayOfYear.getDay(); // 0=Sun, 1=Mon...
    const firstMonday = new Date(firstDayOfYear);
    const diff = day <= 4 ? day - 1 : day - 8;
    firstMonday.setDate(firstDayOfYear.getDate() - diff);

    const monday = new Date(firstMonday);
    monday.setDate(firstMonday.getDate() + (week - 1) * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    setWeekRange({ start: monday, end: sunday });
    setReportLabel(`${monday.toLocaleDateString("en-US")} → ${sunday.toLocaleDateString("en-US")}`);

    fetchWeeklyData(monday, sunday);
  };

  useEffect(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    setWeekRange({ start: monday, end: sunday });
    setReportLabel(`${monday.toLocaleDateString("en-US")} → ${sunday.toLocaleDateString("en-US")}`);

    fetchWeeklyData(monday, sunday);
  }, []);

  return (
    <div className="income-page mx-auto max-w-6xl overflow-y-hidden p-4">
      <h1 className="mb-6 text-center text-3xl font-bold text-gray-800">Weekly Income Report</h1>

      {/* Week Picker */}
      <div className="mb-4">
        <label className="mb-2 block font-medium">Pick a week:</label>
        <input type="week" onChange={handleWeekChange} className="rounded border p-2" />
        <p className="mt-2 text-gray-600">{reportLabel}</p>
      </div>

      {/* Summary Section */}
      <section className="mb-6 rounded-lg bg-white p-4 shadow-md">
        <h2 className="mb-2 text-xl font-semibold text-blue-700">Summary</h2>
        <p>
          <span className="font-medium">Gross Income:</span> {grossIncome.toLocaleString()} UGX
        </p>
        <p>
          <span className="font-medium">Employees Salary:</span> {employeesSalary.toLocaleString()}{" "}
          UGX
        </p>
        <p>
          <span className="font-medium">Expenses:</span> {totalExpenses.toLocaleString()} UGX
        </p>
        <p>
          <span className="font-medium">Advances:</span> {totalAdvances.toLocaleString()} UGX
        </p>
        <p>
          <span className="font-medium">Net Employees Salary:</span>{" "}
          {netEmployeeSalary.toLocaleString()} UGX
        </p>
        <p>
          <span className="font-medium">Salon Net Income:</span> {netIncome.toLocaleString()} UGX
        </p>
        <p>
          <span className="font-medium">Total Cash Available:</span> {cashAtHand.toLocaleString()}{" "}
          UGX
        </p>
      </section>

      {/* Services Table */}
      <section className="rounded-lg bg-white p-4 shadow-md">
        <h2 className="mb-4 text-xl font-semibold text-blue-700">Services Rendered</h2>
        <div className="max-h-[60vh] w-full overflow-x-auto overflow-y-auto rounded border border-gray-300">
          <table className="min-w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-blue-700 text-white">
              <tr>
                <th className="px-3 py-2 text-left">No.</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Service Amount</th>
                <th className="px-3 py-2 text-left">Salon Amount</th>
                <th className="px-3 py-2 text-left">Barber</th>
                <th className="px-3 py-2 text-left">Barber Amount</th>
                <th className="px-3 py-2 text-left">Aesthetician</th>
                <th className="px-3 py-2 text-left">Aesthetician Amount</th>
                <th className="px-3 py-2 text-left">Scrub Aesthetician</th>
                <th className="px-3 py-2 text-left">Scrubber Amount</th>
                <th className="px-3 py-2 text-left">Black Shampoo Aesthetician</th>
                <th className="px-3 py-2 text-left">Black Shampoo Aesthetician Amount</th>
                <th className="px-3 py-2 text-left">Black Shampoo Amount</th>
                <th className="px-3 py-2 text-left">Super Black Aesthetician</th>
                <th className="px-3 py-2 text-left">Super Black Aesthetician Amount</th>
                <th className="px-3 py-2 text-left">Super Black Amount</th>
                <th className="px-3 py-2 text-left">Black Mask Aesthetician</th>
                <th className="px-3 py-2 text-left">Black Mask Aesthetician Amount</th>
                <th className="px-3 py-2 text-left">Black Mask Amount</th>
                <th className="px-3 py-2 text-left">Time of Service</th>
              </tr>
            </thead>
            <tbody>
              {services.map((service, index) => (
                <tr key={service.id} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                  <td className="px-3 py-2">{index + 1}</td>
                  <td className="px-3 py-2">{service.name}</td>
                  <td className="px-3 py-2">{service.service_amount}</td>
                  <td className="px-3 py-2">{service.salon_amount}</td>
                  <td className="px-3 py-2">{service.barber}</td>
                  <td className="px-3 py-2">{service.barber_amount}</td>
                  <td className="px-3 py-2">{service.barber_assistant || "-"}</td>
                  <td className="px-3 py-2">{service.barber_assistant_amount}</td>
                  <td className="px-3 py-2">{service.scrubber_assistant || "-"}</td>
                  <td className="px-3 py-2">{service.scrubber_assistant_amount}</td>
                  <td className="px-3 py-2">{service.black_shampoo_assistant || "-"}</td>
                  <td className="px-3 py-2">{service.black_shampoo_assistant_amount || "-"}</td>
                  <td className="px-3 py-2">{service.black_shampoo_amount}</td>
                  <td className="px-3 py-2">{service.super_black_assistant || "-"}</td>
                  <td className="px-3 py-2">{service.super_black_assistant_amount || "-"}</td>
                  <td className="px-3 py-2">{service.super_black_amount}</td>
                  <td className="px-3 py-2">{service.black_mask_assistant || "-"}</td>
                  <td className="px-3 py-2">{service.black_mask_assistant_amount || "-"}</td>
                  <td className="px-3 py-2">{service.black_mask_amount}</td>
                  <td className="px-3 py-2">{formatEAT(service.service_timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default ManagerIncomeWeeklyReport;
