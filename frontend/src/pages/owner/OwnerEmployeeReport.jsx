import React, { useState, useEffect, useMemo } from "react";
import { useData } from "../../context/DataContext.jsx";
import useOwnerReport from "../../hooks/useOwnerReport.js";
import { Bar } from "react-chartjs-2";
import Chart from "chart.js/auto";

const OwnerEmployeeReport = () => {
  const {
    serviceMaterials = [],
    serviceDefinitions = [],
    sections = [],
    fetchUsers,
    fetchServiceTransactions,
    fetchServiceMaterials,
    fetchServiceDefinitions,
    fetchTagFees,
    fetchAdvances,
    fetchLateFees,
    fetchSections,
  } = useData();
  const { report, fetchDailyData, fetchWeeklyData, fetchMonthlyData, fetchYearlyData } = useOwnerReport();
  const { services = [], employees: users = [], advances = [], tagFees = [], lateFees = [], clockings = [] } = report || {};

  const usersLoading = !users.length;
  console.log("📝 users in the report for employee page", users);
  console.log("📝 services in the report for employee page", services);
  console.log("📝 clockings in the report for employee page", clockings);
  console.log("📝 sections in the report for employee page", sections);
  console.log("📝 late fees in the report for employee page", lateFees);
  console.log("📝 tag fees in the report for employee page", tagFees);
  console.log("📝 advances in the report for employee page", advances);

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
  };

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedDate, setSelectedDate] = useState(toYMD(today));
  const [reportLabel, setReportLabel] = useState("");
  const [week, setWeek] = useState({ start: null, end: null });
  const [monthYear, setMonthYear] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());

  // ------------------- HANDLERS -------------------
  const handleEmployeeChange = (e) => {
    const id = Number(e.target.value);
    console.log("handleEmployeeChange called with id:", id);

    const emp = users.find((u) => u.id === id);
    setSelectedEmployee(emp || null);
  };

  const handleDayChange = (e) => {
    console.log("handleDayChange called with value:", e.target.value);
    setSelectedDate(e.target.value);
    fetchDailyData(e.target.value);
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
      `${monday.toLocaleDateString("en-US")} → ${sunday.toLocaleDateString("en-US")}`,
    );
    fetchWeeklyData(monday, sunday);
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
      })}`,
    );
    fetchMonthlyData(year, month);
  };

  const handleYearChange = (e) => {
    console.log("handleYearChange called with value:", e.target.value);
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

  // ------------------- MEMOS -------------------

  // Map services with materials
  const servicesWithMaterials = useMemo(() => {
    console.log("useMemo: mapping services with materials...");
    return (services || []).map((service) => {
      const matchedMaterials = (serviceMaterials || []).filter(
        (m) => m.service_definition_id === service.service_definition_id,
      );
      return {
        ...service,
        materials: matchedMaterials.length > 0 ? matchedMaterials : [],
      };
    });
  }, [services, serviceMaterials]);

  console.log("servicesWithMaterials", servicesWithMaterials);

  // Filter services by selected employee using the period data already loaded by the report fetchers.
  const employeeServices = useMemo(() => {
    if (!selectedEmployee) return [];

    return servicesWithMaterials.filter((s) =>
      s.performers?.some(
        (p) => Number(p.employee_id) === Number(selectedEmployee.id),
      ),
    );
  }, [servicesWithMaterials, selectedEmployee]);

  console.log("employeeServices", employeeServices);

  // Section summaries
  const dynamicSectionSummaries = useMemo(() => {
    console.log("useMemo: calculating dynamicSectionSummaries...");
    return sections.map((sec) => {
      const secServices = employeeServices.filter(
        (s) => s.definition_section_id === sec.id,
      );
      const gross = secServices.reduce(
        (acc, s) => acc + parseInt(s.full_amount || 0),
        0,
      );
      const salonIncome = secServices.reduce(
        (acc, s) => acc + parseInt(s.salon_amount || 0),
        0,
      );
      const materialsTotal = secServices.reduce(
        (acc, s) =>
          acc +
          (s.materials?.reduce(
            (mAcc, mat) => mAcc + (parseInt(mat.amount) || 0),
            0,
          ) || 0),
        0,
      );
      const employeeSalary = gross - salonIncome - materialsTotal;
      return {
        id: sec.id,
        name: sec.section_name,
        totals: { gross, salonIncome, materialsTotal, employeeSalary },
        services: secServices,
      };
    });
  }, [sections, employeeServices]);

  console.log("dynamicSectionSummaries", dynamicSectionSummaries);

  // General summaries
  const grossIncome = employeeServices.reduce(
    (acc, s) => acc + parseInt(s.full_amount || 0),
    0,
  );
  const materialsTotal = employeeServices.reduce(
    (acc, s) =>
      acc +
      (s.materials?.reduce(
        (mAcc, mat) => mAcc + (parseInt(mat.amount) || 0),
        0,
      ) || 0),
    0,
  );
  const salonIncome = employeeServices.reduce(
    (acc, s) => acc + parseInt(s.salon_amount || 0),
    0,
  );
  const netEmployeeSalary = grossIncome - salonIncome - materialsTotal;
  const totalServicesCount = employeeServices.length;

  console.log(
    "grossIncome:",
    grossIncome,
    "materialsTotal:",
    materialsTotal,
    "salonIncome:",
    salonIncome,
    "netEmployeeSalary:",
    netEmployeeSalary,
    "totalServicesCount:",
    totalServicesCount,
  );

  // Service counts by name
  const serviceNameCounts = Object.entries(
    employeeServices.reduce((acc, s) => {
      acc[s.service_name] = (acc[s.service_name] || 0) + 1;
      return acc;
    }, {}),
  );

  console.log("serviceNameCounts:", serviceNameCounts);

  // Format performers and materials
  const formatPerformersAndMaterials = (s) => {
    const performers =
      s.performers?.map((p) => `${p.first_name} ${p.last_name}`).join(", ") ||
      "-";
    const performerAmount = s.performers?.map((p) => p.role_amount || 0);
    const mats =
      s.materials
        ?.map((m) => `${m.name || m.material_name} (${m.material_cost || 0})`)
        .join(", ") || "-";

    return [
      `Performers: ${performers} - ${performerAmount}`,
      `Materials: ${mats}`,
    ];
  };

  // Employee totals including salary, advances, fees, clocking
  const employeeTotals = useMemo(() => {
    console.log("🔍 Calculating employeeTotals for", selectedEmployee);

    if (!selectedEmployee?.id) return [];

    const employeeId = Number(selectedEmployee.id);

    const userServices = servicesWithMaterials.filter((service) =>
      service.performers?.some((p) => Number(p.employee_id) === employeeId),
    );

    console.log("userServices for employee:", userServices);

    const totalSalary = userServices.reduce((acc, service) => {
      const employeeRoles =
        service.performers?.filter(
          (p) => Number(p.employee_id) === employeeId,
        ) || [];
      const roleSum = employeeRoles.reduce(
        (sum, role) => sum + Number(role.role_amount || 0),
        0,
      );
      return acc + roleSum;
    }, 0);

    const totalAdvances = advances
      .filter((a) => Number(a.employee_id) === employeeId)
      .reduce((sum, a) => sum + Number(a.amount || 0), 0);

    const totalTagFees = tagFees
      .filter((t) => Number(t.employee_id) === employeeId)
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const totalLateFees = lateFees
      .filter((l) => Number(l.employee_id) === employeeId)
      .reduce((sum, l) => sum + Number(l.amount || 0), 0);

    const todayClock = clockings.find(
      (c) => Number(c.employee_id) === employeeId,
    );
    const clockIn = todayClock ? new Date(todayClock.clock_in) : null;
    const clockOut = todayClock?.clock_out
      ? new Date(todayClock.clock_out)
      : null;

    let totalHours = "-";
    if (clockIn && clockOut) {
      const diffMs = clockOut - clockIn;
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.round((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      totalHours = `${diffHrs} hrs ${diffMins} mins`;
    }

    const netSalary =
      totalSalary - (totalAdvances + totalTagFees + totalLateFees);

    const user = users.find((u) => u.id === employeeId);

    return [
      {
        name: `${user?.first_name || "-"} ${user?.last_name || "-"}`,
        totalSalary,
        totalAdvances,
        totalTagFees,
        totalLateFees,
        netSalary,
        clockIn,
        clockOut,
        totalHours,
      },
    ];
  }, [
    servicesWithMaterials,
    advances,
    tagFees,
    lateFees,
    clockings,
    selectedEmployee,
    users,
  ]);

  // Chart data
  const serviceChartData = useMemo(() => {
    if (!selectedEmployee) return null;

    const counts = employeeServices.reduce((acc, s) => {
      acc[s.service_name] = (acc[s.service_name] || 0) + 1;
      return acc;
    }, {});

    return {
      labels: Object.keys(counts),
      datasets: [
        {
          label: "Services Count",
          data: Object.values(counts),
          backgroundColor: "rgba(59, 130, 246, 0.7)",
        },
      ],
    };
  }, [employeeServices]);

  // Chart options
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: "Services Performed" },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1 },
      },
    },
  };

  // Initial data fetch
  useEffect(() => {
    console.log("useEffect: fetching report data for the current day...");
    fetchDailyData(selectedDate);
    fetchUsers();
  }, []);

  return (
    <div className="income-page max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-extrabold text-center mb-6 text-gray-800">
        {selectedEmployee
          ? `${selectedEmployee.last_name} Report`
          : "Select Employee"}
      </h1>

      {/* Employee Picker */}
      <div className="mb-4">
        <label className="font-medium mr-2">Select Employee:</label>
        <select
          value={selectedEmployee?.id || ""}
          onChange={handleEmployeeChange}
          className="border rounded px-2 py-1"
        >
          <option value="">-- Select Employee --</option>
          {users.map((e) => (
            <option key={e.id} value={e.id}>
              {e.last_name}
            </option>
          ))}
        </select>
      </div>

      {selectedEmployee && (
        <>
          {/* Period Pickers */}
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
              <input
                type="week"
                onChange={handleWeekChange}
                className="border rounded p-2"
              />
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

          {/* Section Summaries */}
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">
              Section Summaries
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dynamicSectionSummaries.map((sec) => (
                <div key={sec.id} className="bg-white rounded-lg shadow p-4">
                  <h3 className="text-md font-semibold text-blue-700 mb-2">
                    {sec.name} Section Summary
                  </h3>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="p-3 rounded border bg-blue-50">
                      <div className="text-sm text-gray-700">Gross Income</div>
                      <div className="text-xl font-bold">
                        {sec.totals.gross.toLocaleString()} UGX
                      </div>
                    </div>
                    <div className="p-3 rounded border bg-blue-50">
                      <div className="text-sm text-gray-700">
                        Employee Salary
                      </div>
                      <div className="text-xl font-bold">
                        {sec.totals.employeeSalary.toLocaleString()} UGX
                      </div>
                    </div>
                    <div className="p-3 rounded border bg-blue-50">
                      <div className="text-sm text-gray-700">
                        Materials Cost
                      </div>
                      <div className="text-xl font-bold">
                        {sec.totals.materialsTotal.toLocaleString()} UGX
                      </div>
                    </div>
                    <div className="p-3 rounded border bg-blue-100">
                      <div className="text-sm text-gray-700">Salon Amount</div>
                      <div className="text-xl font-bold text-green-700">
                        {sec.totals.salonIncome.toLocaleString()} UGX
                      </div>
                    </div>
                    <div className="mb-2 text-sm font-medium text-purple-700">
                      Services Count: {sec.services.length}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* General Summary Boxes */}
          <section className="bg-white shadow rounded-lg p-4 mb-6">
            <h2 className="text-xl font-semibold text-blue-700 mb-4">
              Summary
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[
                { label: "Gross Income", value: grossIncome },
                { label: "Materials Cost", value: materialsTotal },
                { label: "Salon Amount", value: salonIncome },
                { label: "Net Employee Salary", value: netEmployeeSalary },
                { label: "Total Services", value: totalServicesCount },
              ].map((item, idx) => (
                <div key={idx} className="summary-box p-3 border rounded">
                  <div className="text-sm text-gray-600">{item.label}</div>
                  <div className="font-bold text-lg">
                    {item.value.toLocaleString()} UGX
                  </div>
                </div>
              ))}
            </div>
            <div>
              {employeeTotals.map((emp, idx) => (
                <div
                  key={idx}
                  className="employee-summary grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-2"
                >
                  <div className="border px-4 py-2 text-center">
                    <p className="font-bold text-l center text-gray-600">
                      Total Salary
                    </p>
                    <br />
                    {emp.totalSalary.toLocaleString()} UGX
                  </div>
                  <div className="border px-4 py-2 text-center">
                    <p className="font-bold text-l text-gray-600">
                      Total Advances
                    </p>
                    <br />
                    {emp.totalAdvances.toLocaleString()} UGX
                  </div>
                  <div className="border px-4 py-2 text-center">
                    <p className="font-bold text-l text-gray-600">
                      Total Tag Fees
                    </p>
                    <br />
                    {emp.totalTagFees.toLocaleString()} UGX
                  </div>
                  <div className="border px-4 py-2 text-center">
                    <p className="font-bold text-l text-gray-600">
                      Total Late Fees
                    </p>
                    <br />
                    {emp.totalLateFees.toLocaleString()} UGX
                  </div>
                  <div className="border px-4 py-2 text-center font-semibold">
                    <p className="font-bold text-l text-gray-600">Net Salary</p>
                    <br />
                    {emp.netSalary.toLocaleString()} UGX
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Service Counts */}
          <section className="bg-white shadow rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">
              Service Counts
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {serviceNameCounts.map(([name, count], i) => (
                <div key={i} className="p-3 rounded border bg-purple-50 shadow">
                  <div className="font-bold text-gray-800">{name}</div>
                  <div className="text-lg text-blue-700">{count}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Services Chart */}
          {serviceChartData && (
            <section className="bg-white shadow rounded-lg p-4 mb-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-3">
                Services Chart
              </h2>
              <div className="max-w-4xl mx-auto">
                <Bar data={serviceChartData} options={chartOptions} />
              </div>
            </section>
          )}

          {/* Service Details Table */}
          <section className="bg-white shadow rounded-lg p-4 mb-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-700">
                Service Details
              </h2>
              <p className="text-sm text-gray-500">
                Showing {employeeServices.length} service
                {employeeServices.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border">
                <thead>
                  <tr className="bg-blue-50">
                    <th className="border px-2 py-1 text-left">#</th>
                    <th className="border px-2 py-1 text-left">Date</th>
                    <th className="border px-2 py-1 text-left">Time</th>
                    <th className="border px-2 py-1 text-left">Service Name</th>
                    <th className="border px-2 py-1 text-left">Section</th>
                    <th className="border px-2 py-1 text-left">Amount</th>
                    <th className="border px-2 py-1 text-left">Salon</th>
                    <th className="border px-2 py-1 text-left">
                      Performers & Materials
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {employeeServices.length === 0 ? (
                    <tr>
                      <td
                        colSpan="8"
                        className="border px-3 py-4 text-center text-sm text-gray-500"
                      >
                        No services found for the selected employee in this
                        report period.
                      </td>
                    </tr>
                  ) : (
                    employeeServices.map((s, i) => (
                      <tr key={s.transaction_id || `${s.service_name}-${i}`}>
                        <td className="border px-2 py-1">{i + 1}</td>
                        <td className="border px-2 py-1">
                          {s.service_date || "-"}
                        </td>
                        <td className="border px-2 py-1">
                          {s.service_time || "-"}
                        </td>
                        <td className="border px-2 py-1">
                          {s.service_name || "-"}
                        </td>
                        <td className="border px-2 py-1">
                          {s.section_name || s.section?.section_name || "-"}
                        </td>
                        <td className="border px-2 py-1">
                          {Number(s.full_amount || 0).toLocaleString()}
                        </td>
                        <td className="border px-2 py-1">
                          {Number(s.salon_amount || 0).toLocaleString()}
                        </td>
                        <td className="border px-2 py-1">
                          {formatPerformersAndMaterials(s).map((line, idx) => (
                            <div key={idx}>{line}</div>
                          ))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Employee Daily Salary Table */}
          <section className="p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
              Worker Performance
            </h2>
            <div className="overflow-x-auto overflow-y-auto max-h-[60vh] border rounded">
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-200 sticky top-0">
                  <tr>
                    <th className="border px-4 py-2">#</th>
                    <th className="border px-4 py-2">Employee</th>
                    <th className="border px-4 py-2">Clock In</th>
                    <th className="border px-4 py-2">Clock Out</th>
                    <th className="border px-4 py-2">Hours</th>
                    <th className="border px-4 py-2 text-right">
                      Total Salary
                    </th>
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
                      <td className="border px-4 py-2">
                        {selectedEmployee.last_name}
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
          </section>
        </>
      )}
    </div>
  );
};

export default OwnerEmployeeReport;
