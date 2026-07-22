import React, { useState, useEffect, useMemo } from "react";
import { useData } from "../../context/DataContext.jsx";
import { Bar } from "react-chartjs-2";
import Chart from "chart.js/auto";

export default function CashierStaffReport() {
  const {
    users = [],
    services = [],
    serviceMaterials = [],
    advances = [],
    tagFees = [],
    lateFees = [],
    clockings = [],
    fetchUsers,
    fetchDailyData,
    fetchWeeklyData,
    fetchMonthlyData,
    fetchYearlyData,
  } = useData();

  
    const toYMD = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};


  const today = new Date();
  const options = {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "Africa/Kampala",
};;

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedDate, setSelectedDate] = useState(toYMD(today));
  const [reportLabel, setReportLabel] = useState("");
  const [week, setWeek] = useState({ start: null, end: null });
  const [monthYear, setMonthYear] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());

  // Only employees/managers
  const filteredUsers = useMemo(
    () => users.filter((u) => u.role === "employee" || u.role === "manager"),
    [users]
  );

  // Map services with materials
  const servicesWithMaterials = useMemo(() => {
    return services.map((service) => {
      const matchedMaterials = serviceMaterials.filter(
        (m) => m.service_definition_id === service.service_definition_id
      );
      return {
        ...service,
        materials: matchedMaterials.length ? matchedMaterials : [],
      };
    });
  }, [services, serviceMaterials]);

  // -------------------------
  // EMPLOYEE TOTALS INCLUDING NUMBER OF CLIENTS
  // -------------------------
  const employeeTotals = useMemo(() => {
    return filteredUsers.map((user) => {
      const empServices = servicesWithMaterials.filter((s) =>
        s.performers?.some((p) => p.employee_id === user.id)
      );

      // SALARY
      const totalSalary = empServices.reduce((sum, s) => {
        s.performers.forEach((p) => {
          if (p.employee_id === user.id) {
            sum += Number(p.role_amount) || 0;
          }
        });
        return sum;
      }, 0);

      // ADVANCES
      const totalAdvances = advances
        .filter((a) => a.employee_id === user.id)
        .reduce((sum, a) => sum + Number(a.amount), 0);

      // TAG FEES
      const totalTagFees = tagFees
        .filter((t) => t.employee_id === user.id)
        .reduce((sum, t) => sum + Number(t.amount), 0);

      // LATE FEES
      const totalLateFees = lateFees
        .filter((l) => l.employee_id === user.id)
        .reduce((sum, l) => sum + Number(l.amount), 0);

      // CLOCKING
      const clockIn = clockings.find((c) => c.employee_id === user.id)?.clock_in || null;
      const clockOut = clockings.find((c) => c.employee_id === user.id)?.clock_out || null;

      const totalHours =
        clockIn && clockOut
          ? ((new Date(clockOut) - new Date(clockIn)) / 36e5).toFixed(2)
          : "-";

      const netSalary = totalSalary - totalAdvances - totalTagFees - totalLateFees;

      // ✅ NUMBER OF CLIENTS (COUNT SERVICES WITH THIS EMPLOYEE)
      const clientsCount = empServices.length;

      return {
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        clockIn: clockIn ? new Date(clockIn) : null,
        clockOut: clockOut ? new Date(clockOut) : null,
        totalHours,
        totalSalary,
        totalAdvances,
        totalTagFees,
        totalLateFees,
        netSalary,

        // ✅ added field
        clientsCount,
      };
    });
  }, [
    filteredUsers,
    servicesWithMaterials,
    advances,
    tagFees,
    lateFees,
    clockings,
  ]);

  // -------------------------
  // HANDLERS
  // -------------------------
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

    setWeek({ start: monday, end: sunday });
    setReportLabel(
      `${monday.toLocaleDateString("en-US")} → ${sunday.toLocaleDateString(
        "en-US"
      )}`
    );

    fetchWeeklyData(monday, sunday);
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

    fetchMonthlyData(year, month);
    fetchUsers();
  };

  const handleYearChange = (e) => {
    const selectedYear = parseInt(e.target.value, 10);
    setYear(selectedYear);
    setReportLabel(`Year ${selectedYear}`);
    fetchYearlyData(selectedYear);
  };

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= currentYear - 10; y--) {
      years.push(y);
    }
    return years;
  };

  useEffect(() => {
    fetchDailyData(selectedDate);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [services]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Employees Report</h1>

      {/* PERIOD PICKERS */}
      <div className="mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block font-medium mb-1">Day:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={handleDayChange}
            className="border rounded p-2"
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Week:</label>
          <input type="week" onChange={handleWeekChange} className="border rounded p-2" />
        </div>

        <div>
          <label className="block font-medium mb-1">Month:</label>
          <input
            type="month"
            value={monthYear}
            onChange={handleMonthChange}
            className="border rounded p-2"
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Year:</label>
          <select onChange={handleYearChange} className="border rounded p-2">
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

      {/* TABLE */}
      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-4 py-2">#</th>
            <th className="border px-4 py-2">Employee</th>
            <th className="border px-4 py-2 text-right">No of Clients</th>
            <th className="border px-4 py-2">Clock In</th>
            <th className="border px-4 py-2">Clock Out</th>
            <th className="border px-4 py-2">Total Hours</th>
            <th className="border px-4 py-2 text-right">Salary</th>
            <th className="border px-4 py-2 text-right">Advances</th>
            <th className="border px-4 py-2 text-right">Tag Fees</th>
            <th className="border px-4 py-2 text-right">Late Fees</th>
            <th className="border px-4 py-2 text-right">Net Salary</th>
          </tr>
        </thead>

        <tbody>
          {employeeTotals.map((emp, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="border px-4 py-2">{idx + 1}</td>
              <td className="border px-4 py-2">{emp.name}</td>
              <td className="border px-4 py-2 text-right font-semibold">
                {emp.clientsCount}
              </td>
              <td className="border px-4 py-2">
                {emp.clockIn ? emp.clockIn.toLocaleTimeString() : "-"}
              </td>
              <td className="border px-4 py-2">
                {emp.clockOut ? emp.clockOut.toLocaleTimeString() : "-"}
              </td>
              <td className="border px-4 py-2">{emp.totalHours}</td>
              <td className="border px-4 py-2 text-right">
                {emp.totalSalary.toLocaleString()} UGX
              </td>
              <td className="border px-4 py-2 text-right">
                {emp.totalAdvances.toLocaleString()} UGX
              </td>
              <td className="border px-4 py-2 text-right">
                {emp.totalTagFees.toLocaleString()} UGX
              </td>
              <td className="border px-4 py-2 text-right">
                {emp.totalLateFees.toLocaleString()} UGX
              </td>
              <td className="border px-4 py-2 text-right font-semibold">
                {emp.netSalary.toLocaleString()} UGX
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
