import React, { useState, useEffect, useMemo } from "react";
import { useData } from "../../context/DataContext";

export default function OwnerStaffWeeklyReport() {
  const { services, employees, advances, fetchWeeklyData } = useData();

  const [weekRange, setWeekRange] = useState({ start: null, end: null });
  const [reportLabel, setReportLabel] = useState("");

  // ---- Week Picker Handler ----
  const handleWeekChange = (e) => {
    const weekString = e.target.value; // e.g. "2025-W39"
    if (!weekString) return;

    const [year, week] = weekString.split("-W").map(Number);

    // First Monday of the year
    const firstDayOfYear = new Date(year, 0, 1);
    const day = firstDayOfYear.getDay(); // 0=Sun, 1=Mon...
    const firstMonday = new Date(firstDayOfYear);
    const diff = day <= 4 ? day - 1 : day - 8;
    firstMonday.setDate(firstDayOfYear.getDate() - diff);

    // Monday of picked week
    const monday = new Date(firstMonday);
    monday.setDate(firstMonday.getDate() + (week - 1) * 7);

    // Sunday = Monday + 6
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    setWeekRange({ start: monday, end: sunday });
    setReportLabel(`${monday.toLocaleDateString("en-US")} → ${sunday.toLocaleDateString("en-US")}`);

    fetchWeeklyData(monday, sunday);
  };

  // ---- On Page Load: Current Week ----
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

  // ---- Employee Totals ----
  const employeeTotals = useMemo(() => {
    if (!services.length) return [];

    return employees.map((emp) => {
      const fullName = `${emp.first_name} ${emp.last_name}`;

      const totalSalary = services.reduce((sum, s) => {
        if (s.barber === fullName) sum += parseInt(s.barber_amount) || 0;
        if (s.barber_assistant === fullName) sum += parseInt(s.barber_assistant_amount) || 0;
        if (s.scrubber_assistant === fullName) sum += parseInt(s.scrubber_assistant_amount) || 0;
        if (s.black_shampoo_assistant === fullName)
          sum += parseInt(s.black_shampoo_assistant_amount) || 0;
        if (s.super_black_assistant === fullName)
          sum += parseInt(s.super_black_assistant_amount) || 0;
        if (s.black_mask_assistant === fullName)
          sum += parseInt(s.black_mask_assistant_amount) || 0;
        return sum;
      }, 0);

      const totalAdvances = advances
        .filter((a) => a.employee_name === fullName)
        .reduce((sum, a) => sum + (parseInt(a.amount) || 0), 0);

      return {
        name: fullName,
        totalSalary,
        totalAdvances,
        netSalary: totalSalary - totalAdvances,
      };
    });
  }, [services, advances, employees]);

  if (!services.length) {
    return (
      <section className="p-6">
        <h2 className="text-center text-xl font-bold text-gray-700">No Recorded Work Yet</h2>
      </section>
    );
  }

  // ---- Format UTC to EAT ----
  const formatEAT = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("en-UG", {
      timeZone: "Africa/Kampala",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ---- Render ----
  return (
    <section className="mx-auto max-w-6xl p-6">
      <h2 className="mb-4 text-2xl font-bold text-gray-800">Workers Weekly Report</h2>

      {/* Week Picker */}
      <div className="mb-4">
        <label className="mb-2 block font-medium">Pick a week:</label>
        <input type="week" onChange={handleWeekChange} className="rounded border p-2" />
        <p className="mt-2 text-gray-600">{reportLabel}</p>
      </div>

      {/* Employee Table */}
      <div className="max-h-[60vh] overflow-x-auto overflow-y-auto rounded border">
        <table className="min-w-full border-collapse">
          <thead className="sticky top-0 bg-gray-200">
            <tr>
              <th className="border px-4 py-2 text-left">#</th>
              <th className="border px-4 py-2 text-left">Employee</th>
              <th className="border px-4 py-2 text-right">Total Salary</th>
              <th className="border px-4 py-2 text-right">Advances</th>
              <th className="border px-4 py-2 text-right">Net Salary</th>
            </tr>
          </thead>
          <tbody>
            {employeeTotals.map((emp, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="border px-4 py-2">{idx + 1}</td>
                <td className="border px-4 py-2">{emp.name}</td>
                <td className="border px-4 py-2 text-right">
                  {emp.totalSalary.toLocaleString()} UGX
                </td>
                <td className="border px-4 py-2 text-right">
                  {emp.totalAdvances.toLocaleString()} UGX
                </td>
                <td className="border px-4 py-2 text-right font-semibold">
                  {emp.netSalary.toLocaleString()} UGX
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
