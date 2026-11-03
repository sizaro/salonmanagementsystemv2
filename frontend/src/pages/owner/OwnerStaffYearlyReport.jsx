import React, { useState, useEffect, useMemo } from "react";
import { useData } from "../../context/DataContext";

const OwnerStaffYearlyReport = () => {
  const { services, employees, advances, fetchYearlyData } = useData();

  const [year, setYear] = useState(new Date().getFullYear());
  const [reportLabel, setReportLabel] = useState("");

  // ---- Handle year change ----
  const handleYearChange = (e) => {
    const selectedYear = parseInt(e.target.value, 10);
    setYear(selectedYear);
    setReportLabel(`Year ${selectedYear}`);
    fetchYearlyData(selectedYear);
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

  // ---- On page load: current year ----
  useEffect(() => {
    const currentYear = new Date().getFullYear();
    setYear(currentYear);
    setReportLabel(`Year ${currentYear}`);
    fetchYearlyData(currentYear);
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

  // ---- Format UTC to EAT ----
  const formatEAT = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("en-UG", {
      timeZone: "Africa/Kampala",
      hour: "2-digit",
      minute: "2-digit",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (!services.length) {
    return (
      <section className="p-6">
        <h2 className="text-center text-xl font-bold text-gray-700">No Recorded Work Yet</h2>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-6 text-center text-3xl font-bold text-gray-800">Yearly Workers Report</h1>

      {/* Year Picker */}
      <div className="mb-4">
        <label className="mb-2 block font-medium">Pick a year:</label>
        <select value={year} onChange={handleYearChange} className="rounded border p-2">
          {generateYearOptions().map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
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
    </div>
  );
};

export default OwnerStaffYearlyReport;
