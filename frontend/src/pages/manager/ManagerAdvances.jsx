import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../../context/DataContext.jsx";

const ManagerAdvances = () => {
  const navigate = useNavigate();
  const {
    users = [],
    fetchUsers,
    advances = [],
    fetchDailyData,
    fetchWeeklyData,
    fetchMonthlyData,
    fetchYearlyData,
  } = useData();

  const toYMD = (date) => date.toISOString().split("T")[0];
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(toYMD(today));
  const [monthYear, setMonthYear] = useState("");
  const [year, setYear] = useState("");

  const employees = (users || []).filter(
    (user) =>
      user &&
      `${user.first_name || ""} ${user.last_name || ""}`.toLowerCase() !== "ntege saleh" &&
      user.role !== "customer",
  );

  const employeeAdvances = useMemo(() => {
    if (!employees.length) return [];
    return advances.filter((a) => employees.some((emp) => emp.id === a.employee_id));
  }, [advances, employees]);

  // ========================
  // HANDLERS
  // ========================

  const handleDayChange = (e) => {
    setSelectedDate(e.target.value);
    fetchDailyData(e.target.value);
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

    fetchWeeklyData(monday, sunday);
    fetchUsers();
  };

  const handleMonthChange = (e) => {
    const value = e.target.value;
    if (!value) return;

    const [year, month] = value.split("-").map(Number);
    setMonthYear(value);
    fetchMonthlyData(year, month);
    fetchUsers();
  };

  const handleYearChange = (e) => {
    const selectedYear = e.target.value;
    setYear(selectedYear);
    if (selectedYear) {
      fetchYearlyData(parseInt(selectedYear, 10));
    }
  };

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= currentYear - 10; y--) {
      years.push(y);
    }
    return years;
  };

  const handleAdd = () => {
    navigate("/manager/finance?action=advance&tab=advances");
  };

  // Initial load
  useEffect(() => {
    fetchDailyData(selectedDate);
  }, []);

  // Initial load
  useEffect(() => {
    fetchUsers();
  }, [advances]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* FILTER BAR */}
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block font-medium">Day:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={handleDayChange}
            className="rounded border p-2"
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">Week:</label>
          <input type="week" onChange={handleWeekChange} className="rounded border p-2" />
        </div>

        <div>
          <label className="mb-1 block font-medium">Month:</label>
          <input
            type="month"
            value={monthYear}
            onChange={handleMonthChange}
            className="rounded border p-2"
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">Year:</label>
          <select value={year} onChange={handleYearChange} className="rounded border p-2">
            <option value="" disabled>
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

      {/* HEADER */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">Advances</h1>
        <button
          onClick={handleAdd}
          className="rounded-md bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700"
        >
          Add Advance
        </button>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Employee</th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Amount</th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Date</th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Reason</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {employeeAdvances.map((adv) => (
              <tr key={adv.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">{adv.last_name || "—"}</td>
                <td className="px-4 py-2">{adv.amount}</td>
                <td className="px-4 py-2">{new Date(adv.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-2">{adv.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ManagerAdvances;
