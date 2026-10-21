import React, { useState, useEffect, useMemo } from "react";
import { useData } from "../../context/DataContext.jsx";
import { Bar } from "react-chartjs-2";
import Chart from "chart.js/auto";

const CashierEmployeeReport = () => {
  const {
    services = [],
    serviceMaterials = [],
    serviceDefinitions = [],
    users =[],
    sections = [],
    advances = [],
    tagFees = [],
    lateFees = [],
    clockings = [],
    financialSummary = null,
    fetchUsers,
    fetchDailyData,
    fetchWeeklyData,
    fetchMonthlyData,
    fetchYearlyData,
    fetchServiceTransactions,
    fetchServiceMaterials,
    fetchServiceDefinitions,
    fetchTagFees,
    fetchAdvances,
    fetchLateFees,
    fetchSections
  } = useData();


const usersLoading = !users.length;


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

// ------------------- HANDLERS -------------------
const handleEmployeeChange = (e) => {
  const id = Number(e.target.value);

  const emp = users.find((u) => u.id === id);
  setSelectedEmployee(emp || null);
};

const handleDayChange = (e) => {
  setSelectedDate(e.target.value);
  fetchDailyData(e.target.value);
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
  fetchWeeklyData(monday, sunday);
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
};

const handleYearChange = (e) => {
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

// ------------------- MEMOS -------------------

// Map services with materials
const servicesWithMaterials = useMemo(() => {
  return (services || []).map((service) => {
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


// Filter services by selected employee using the period data already loaded by the report fetchers.
const employeeServices = useMemo(() => {
  if (!selectedEmployee) return [];

  return servicesWithMaterials.filter((s) =>
    s.performers?.some((p) => Number(p.employee_id) === Number(selectedEmployee.id))
  );
}, [servicesWithMaterials, selectedEmployee]);


// Section summaries
const dynamicSectionSummaries = useMemo(() => {
  return sections.map((sec) => {
    const secServices = employeeServices.filter((s) => s.definition_section_id === sec.id);
    const gross = secServices.reduce((acc, s) => acc + parseInt(s.full_amount || 0), 0);
    const salonIncome = secServices.reduce((acc, s) => acc + parseInt(s.salon_amount || 0), 0);
    const materialsTotal = secServices.reduce(
      (acc, s) =>
        acc + (s.materials?.reduce((mAcc, mat) => mAcc + Number(mat.material_cost ?? mat.amount ?? 0), 0) || 0),
      0
    );
    const employeeSalary = secServices.reduce((sum, service) => sum + (service.performers || [])
      .filter((performer) => Number(performer.employee_id) === Number(selectedEmployee?.id))
      .reduce((performerSum, performer) => performerSum + Number(performer.role_amount || 0), 0), 0);
    return {
      id: sec.id,
      name: sec.section_name,
      totals: { gross, salonIncome, materialsTotal, employeeSalary },
      services: secServices,
    };
  });
}, [sections, employeeServices, selectedEmployee]);


// General summaries
const grossIncome = employeeServices.reduce((acc, s) => acc + parseInt(s.full_amount || 0), 0);
const materialsTotal = employeeServices.reduce(
  (acc, s) => acc + (s.materials?.reduce((mAcc, mat) => mAcc + Number(mat.material_cost ?? mat.amount ?? 0), 0) || 0),
  0
);
const salonIncome = employeeServices.reduce((acc, s) => acc + parseInt(s.salon_amount || 0), 0);
const totalServicesCount = employeeServices.length;


// Service counts by name
const serviceNameCounts = Object.entries(
  employeeServices.reduce((acc, s) => {
    acc[s.service_name] = (acc[s.service_name] || 0) + 1;
    return acc;
  }, {})
);


// Format performers and materials
const formatPerformersAndMaterials = (s) => {
  const performers = s.performers?.map((p) => `${p.first_name} ${p.last_name}`).join(", ") || "-";
  const performerAmount = s.performers?.map((p)=> p.role_amount || 0)
  const mats = s.materials?.map((m) => `${m.name || m.material_name} (${m.material_cost || 0})`).join(", ") || "-";

  return [`Performers: ${performers} - ${performerAmount}`, `Materials: ${mats}`];
};

const selectedEmployeeFinance = useMemo(
  () => (financialSummary?.employees || []).find((employee) => Number(employee.employee_id) === Number(selectedEmployee?.id)) || null,
  [financialSummary, selectedEmployee],
);

// Employee totals use the finance ledger. Advances, tag fees and late fees do
// not automatically reduce salary; only an effective payroll deduction does.
const employeeTotals = useMemo(() => {

  if (!selectedEmployee?.id) return [];

  const employeeId = Number(selectedEmployee.id);

  const userServices = servicesWithMaterials.filter((service) =>
    service.performers?.some((p) => Number(p.employee_id) === employeeId)
  );


  const totalSalary = userServices.reduce((acc, service) => {
    const employeeRoles = service.performers?.filter((p) => Number(p.employee_id) === employeeId) || [];
    const roleSum = employeeRoles.reduce((sum, role) => sum + Number(role.role_amount || 0), 0);
    return acc + roleSum;
  }, 0);

  const todayClock = clockings.find((c) => Number(c.employee_id) === employeeId);
  const clockIn = todayClock ? new Date(todayClock.clock_in) : null;
  const clockOut = todayClock?.clock_out ? new Date(todayClock.clock_out) : null;

  let totalHours = "-";
  if (clockIn && clockOut) {
    const diffMs = clockOut - clockIn;
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.round((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    totalHours = `${diffHrs} hrs ${diffMins} mins`;
  }

  const user = users.find((u) => u.id === employeeId);

  return [
    {
      name: `${user?.first_name || "-"} ${user?.last_name || "-"}`,
      totalSalary: selectedEmployeeFinance?.earned_in_period ?? totalSalary,
      paymentsDisbursed: selectedEmployeeFinance?.payments_in_period ?? 0,
      totalAdvances: selectedEmployeeFinance?.advances_in_period ?? 0,
      effectivePayrollDeductions: selectedEmployeeFinance?.payroll_deductions_in_period ?? 0,
      totalTagFees: selectedEmployeeFinance?.tag_fees_in_period ?? 0,
      totalLateFees: selectedEmployeeFinance?.late_fees_in_period ?? 0,
      netSalary: selectedEmployeeFinance?.earnings_payable_at_period_end ?? totalSalary,
      advancesOutstanding: selectedEmployeeFinance?.advances_outstanding_at_period_end ?? 0,
      clockIn,
      clockOut,
      totalHours,
    },
  ];
}, [servicesWithMaterials, clockings, selectedEmployee, selectedEmployeeFinance, users]);

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
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Section Summaries</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dynamicSectionSummaries.map((sec) => (
                <div key={sec.id} className="bg-white rounded-lg shadow p-4">
                  <h3 className="text-md font-semibold text-blue-700 mb-2">{sec.name} Section Summary</h3>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="p-3 rounded border bg-blue-50">
                      <div className="text-sm text-gray-700">Service value associated</div>
                      <div className="text-xl font-bold">{sec.totals.gross.toLocaleString()} UGX</div>
                    </div>
                    <div className="p-3 rounded border bg-blue-50">
                      <div className="text-sm text-gray-700">This employee's earnings</div>
                      <div className="text-xl font-bold">{sec.totals.employeeSalary.toLocaleString()} UGX</div>
                    </div>
                    <div className="p-3 rounded border bg-blue-50">
                      <div className="text-sm text-gray-700">Configured material estimate</div>
                      <div className="text-xl font-bold">{sec.totals.materialsTotal.toLocaleString()} UGX</div>
                    </div>
                    <div className="p-3 rounded border bg-blue-100">
                      <div className="text-sm text-gray-700">Service salon share</div>
                      <div className="text-xl font-bold text-green-700">{sec.totals.salonIncome.toLocaleString()} UGX</div>
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
            <h2 className="text-xl font-semibold text-blue-700 mb-1">Employee finance summary</h2>
            <p className="mb-4 text-sm text-gray-500">Advances remain separate from earned pay unless an employee has consented to an effective payroll deduction.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[
                { label: "Service value associated", value: grossIncome },
                { label: "Configured material estimate", value: materialsTotal },
                { label: "Service salon share", value: salonIncome },
                { label: "Completed services", value: totalServicesCount, count: true },
              ].map((item, idx) => (
                <div key={idx} className="summary-box p-3 border rounded">
                  <div className="text-sm text-gray-600">{item.label}</div>
                  <div className="font-bold text-lg">{Number(item.value || 0).toLocaleString()}{item.count ? "" : " UGX"}</div>
                </div>
              ))}
            </div>
             <div>
              {employeeTotals.map((emp, idx) => (
                <div key={idx} className="employee-summary grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-2">
                  <div className="border px-4 py-2 text-center">
                    <p className="font-bold text-l center text-gray-600">Earnings created</p><br />
                    {emp.totalSalary.toLocaleString()} UGX</div>
                  <div className="border px-4 py-2 text-center">
                    <p className="font-bold text-l text-gray-600">Payments disbursed</p><br />
                  {emp.paymentsDisbursed.toLocaleString()} UGX</div>
                  <div className="border px-4 py-2 text-center">
                    <p className="font-bold text-l text-gray-600">Advances disbursed</p><br />
                  {emp.totalAdvances.toLocaleString()} UGX</div>
                  <div className="border px-4 py-2 text-center">
                  <p className="font-bold text-l text-gray-600">Effective payroll deductions</p><br />
                  {emp.effectivePayrollDeductions.toLocaleString()} UGX</div>
                  <div className="border px-4 py-2 text-center">
                  <p className="font-bold text-l text-gray-600">Outstanding advances at period end</p><br />
                  {emp.advancesOutstanding.toLocaleString()} UGX</div>
                  <div className="border px-4 py-2 text-center font-semibold">
                  <p className="font-bold text-l text-gray-600">Earnings payable at period end</p><br />
                  {emp.netSalary.toLocaleString()} UGX</div>
                </div>
              ))}
            </div>
          </section>

          {/* Service Counts */}
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

          {/* Services Chart */}
        {serviceChartData && (
        <section className="bg-white shadow rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Services Chart</h2>
            <div className="max-w-4xl mx-auto">
            <Bar data={serviceChartData} options={chartOptions} />
            </div>
        </section>
        )}


          {/* Service Details Table */}
          <section className="bg-white shadow rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Service Details</h2>
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
                  <tr key={i}>
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
                    <th className="border px-4 py-2 text-right">Earnings created</th>
                    <th className="border px-4 py-2 text-right">Payments disbursed</th>
                    <th className="border px-4 py-2 text-right">Advances disbursed</th>
                    <th className="border px-4 py-2 text-right">Effective payroll deductions</th>
                    <th className="border px-4 py-2 text-right">Earnings payable at period end</th>
                    <th className="border px-4 py-2 text-right">Outstanding advances at period end</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeTotals.map((emp, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="border px-4 py-2">{idx + 1}</td>
                      <td className="border px-4 py-2">{selectedEmployee.last_name}</td>
                      <td className="border px-4 py-2">{emp.clockIn ? emp.clockIn.toLocaleTimeString() : "-"}</td>
                      <td className="border px-4 py-2">{emp.clockOut ? emp.clockOut.toLocaleTimeString() : "-"}</td>
                      <td className="border px-4 py-2">{emp.totalHours}</td>
                      <td className="border px-4 py-2 text-right">{emp.totalSalary.toLocaleString()} UGX</td>
                      <td className="border px-4 py-2 text-right">{emp.paymentsDisbursed.toLocaleString()} UGX</td>
                      <td className="border px-4 py-2 text-right">{emp.totalAdvances.toLocaleString()} UGX</td>
                      <td className="border px-4 py-2 text-right">{emp.effectivePayrollDeductions.toLocaleString()} UGX</td>
                      <td className="border px-4 py-2 text-right font-semibold">{emp.netSalary.toLocaleString()} UGX</td>
                      <td className="border px-4 py-2 text-right font-semibold">{emp.advancesOutstanding.toLocaleString()} UGX</td>
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

export default CashierEmployeeReport;
