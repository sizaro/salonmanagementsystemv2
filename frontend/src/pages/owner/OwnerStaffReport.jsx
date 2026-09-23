import React, { useEffect, useMemo, useState } from "react";
import { useData } from "../../context/DataContext.jsx";
import useOwnerReport from "../../hooks/useOwnerReport.js";
import StaffPerformanceMatrix from "../../components/StaffPerformanceMatrix.jsx";

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDateLabel = (value) =>
  new Date(value).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

const getWeekRange = (weekString) => {
  const [year, weekNumber] = weekString.split("-W").map(Number);

  const firstDayOfYear = new Date(year, 0, 1);
  const dayOfWeek = firstDayOfYear.getDay();

  const diff = dayOfWeek <= 4 ? dayOfWeek - 1 : dayOfWeek - 8;

  const firstMonday = new Date(firstDayOfYear);
  firstMonday.setDate(firstDayOfYear.getDate() - diff);

  const monday = new Date(firstMonday);
  monday.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    monday,
    sunday,
  };
};

export default function OwnerStaffReport() {
  const {
    serviceDefinitions = [],
    fetchUsers,
    fetchServiceDefinitions,
  } = useData();

  const {
    report,
    fetchDailyData,
    fetchWeeklyData,
    fetchMonthlyData,
    fetchYearlyData,
  } = useOwnerReport();

  const {
    employees: users = [],
    services = [],
    advances = [],
    tagFees = [],
    lateFees = [],
    clockings = [],
  } = report || {};

  const today = new Date();

  const [selectedDate, setSelectedDate] = useState(formatDateInput(today));

  const [monthYear, setMonthYear] = useState("");

  const [year, setYear] = useState(new Date().getFullYear());

  const [reportLabel, setReportLabel] = useState(
    `Daily performance for ${formatDateLabel(today)}`,
  );

  /*
   * The performance report is for people who can actually perform
   * salon services.
   *
   * Cashiers are included because a cashier can also be a worker.
   *
   * Customers and other non-worker roles remain excluded.
   */
  const staff = useMemo(() => {
    return (users || []).filter((user) => {
      const role = String(user.role || "")
        .trim()
        .toLowerCase();

      const status = String(user.status || "active")
        .trim()
        .toLowerCase();

      return (
        ["employee", "manager", "cashier"].includes(role) &&
        status !== "inactive"
      );
    });
  }, [users]);

  const unassignedGenderStaff = useMemo(() => {
    return staff.filter((user) => !String(user.gender || "").trim());
  }, [staff]);

  useEffect(() => {
    fetchUsers();
    fetchDailyData(selectedDate);
    fetchServiceDefinitions?.();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [services]);

  const handleDayChange = (event) => {
    const value = event.target.value;

    setSelectedDate(value);

    setReportLabel(`Daily performance for ${formatDateLabel(value)}`);

    fetchDailyData(value);
    fetchUsers();
  };

  const handleWeekChange = (event) => {
    const value = event.target.value;

    if (!value) return;

    const { monday, sunday } = getWeekRange(value);

    setReportLabel(
      `Week: ${monday.toLocaleDateString(
        "en-US",
      )} → ${sunday.toLocaleDateString("en-US")}`,
    );

    fetchWeeklyData(monday, sunday);
    fetchUsers();
  };

  const handleMonthChange = (event) => {
    const value = event.target.value;

    if (!value) return;

    setMonthYear(value);

    const [selectedYear, selectedMonth] = value.split("-").map(Number);

    const monthName = new Date(
      selectedYear,
      selectedMonth - 1,
      1,
    ).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    setReportLabel(`Monthly performance for ${monthName}`);

    fetchMonthlyData(selectedYear, selectedMonth);
    fetchUsers();
  };

  const handleYearChange = (event) => {
    const selectedYear = Number(event.target.value);

    setYear(selectedYear);

    setReportLabel(`Yearly performance for ${selectedYear}`);

    fetchYearlyData(selectedYear);
  };

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();

    return Array.from({ length: 11 }, (_, index) => currentYear - index);
  };

  return (
    <div className="min-h-full bg-slate-50 p-4 sm:p-6">
      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">
              Staff report
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Staff Performance
            </h1>

            <p className="mt-1 text-sm text-slate-500">{reportLabel}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Day
              </label>

              <input
                type="date"
                value={selectedDate}
                onChange={handleDayChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Week
              </label>

              <input
                type="week"
                onChange={handleWeekChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Month
              </label>

              <input
                type="month"
                value={monthYear}
                onChange={handleMonthChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Year
              </label>

              <select
                onChange={handleYearChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                value={year}
              >
                <option value="" disabled>
                  Select Year
                </option>

                {generateYearOptions().map((optionYear) => (
                  <option key={optionYear} value={optionYear}>
                    {optionYear}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <StaffPerformanceMatrix
        title="Staff Performance"
        employees={staff}
        services={services}
        serviceDefinitions={serviceDefinitions}
        advances={advances}
        tagFees={tagFees}
        lateFees={lateFees}
        clockings={clockings}
        periodLabel={reportLabel}
      />

      {unassignedGenderStaff.length > 0 && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
          <p className="font-semibold">Gender information needs attention</p>

          <p className="mt-1">
            {unassignedGenderStaff.length} staff member
            {unassignedGenderStaff.length === 1 ? "" : "s"} do not have gender
            assigned. They remain visible under
            <span className="font-semibold"> All Staff</span>, but will not
            appear in the Male or Female filtered views until their gender is
            assigned.
          </p>
        </div>
      )}
    </div>
  );
}
