import React, { useState, useEffect, useMemo } from "react";
import { useData } from "../context/DataContext.jsx";

export default function WorkMonthlyReport() {
  const { services, employees, advances, fetchMonthlyData } = useData();

  const [monthYear, setMonthYear] = useState(""); // "YYYY-MM"
  const [reportLabel, setReportLabel] = useState("");

  // ---- Handle month selection ----
  const handleMonthChange = (e) => {
    const value = e.target.value; // "YYYY-MM"
    if (!value) return;

    const [year, month] = value.split("-").map(Number);

    setMonthYear(value);
    setReportLabel(
      `${new Date(year, month - 1, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })}`,
    );

    fetchMonthlyData(year, month);
  };

  // ---- On page load: current month ----
  useEffect(() => {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    const value = `${year}-${month.toString().padStart(2, "0")}`;

    setMonthYear(value);
    setReportLabel(`${today.toLocaleString("en-US", { month: "long", year: "numeric" })}`);

    fetchMonthlyData(year, month);
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
      <h2 className="mb-4 text-2xl font-bold text-gray-800">Workers Monthly Report</h2>

      {/* Month Picker */}
      <div className="mb-4">
        <label className="mb-2 block font-medium">Pick a month:</label>
        <input
          type="month"
          value={monthYear}
          onChange={handleMonthChange}
          className="rounded border p-2"
        />
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
