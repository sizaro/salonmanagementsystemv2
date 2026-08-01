import React, { useState, useEffect, useMemo } from "react";
import { useData } from "../../context/DataContext.jsx";
import useOwnerReport from "../../hooks/useOwnerReport.js";
import StaffGenderPerformanceSection from "../../components/StaffGenderPerformanceSection.jsx";

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

  return { monday, sunday };
};

export default function OwnerStaffReport() {
  const {
    serviceDefinitions = [],
    fetchUsers,
    fetchServiceDefinitions,
  } = useData();
  const { report, fetchDailyData, fetchWeeklyData, fetchMonthlyData, fetchYearlyData } = useOwnerReport();
  const { employees: users = [], services = [], advances = [], tagFees = [], lateFees = [], clockings = [] } = report || {};

  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(formatDateInput(today));
  const [monthYear, setMonthYear] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [reportLabel, setReportLabel] = useState(`Daily performance for ${formatDateLabel(today)}`);

  const filteredUsers = useMemo(
    () => users.filter((user) => user.role === "employee" || user.role === "manager"),
    [users]
  );

  const maleStaff = useMemo(
    () => filteredUsers.filter((user) => String(user.gender || "").toLowerCase() === "male"),
    [filteredUsers]
  );

  const femaleStaff = useMemo(
    () => filteredUsers.filter((user) => String(user.gender || "").toLowerCase() === "female"),
    [filteredUsers]
  );

  const unassignedGenderStaff = useMemo(
    () => filteredUsers.filter((user) => !user.gender),
    [filteredUsers]
  );

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
    setReportLabel(`Week: ${monday.toLocaleDateString("en-US")} → ${sunday.toLocaleDateString("en-US")}`);
    fetchWeeklyData(monday, sunday);
    fetchUsers();
  };

  const handleMonthChange = (event) => {
    const value = event.target.value;
    if (!value) return;

    setMonthYear(value);
    const [selectedYear, selectedMonth] = value.split("-").map(Number);
    const monthName = new Date(selectedYear, selectedMonth - 1, 1).toLocaleDateString("en-US", {
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
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Staff Performance</h1>
          <p className="text-sm text-gray-600">{reportLabel}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label className="block font-medium mb-1">Day</label>
            <input
              type="date"
              value={selectedDate}
              onChange={handleDayChange}
              className="border rounded p-2 w-full"
            />
          </div>

          <div>
            <label className="block font-medium mb-1">Week</label>
            <input type="week" onChange={handleWeekChange} className="border rounded p-2 w-full" />
          </div>

          <div>
            <label className="block font-medium mb-1">Month</label>
            <input
              type="month"
              value={monthYear}
              onChange={handleMonthChange}
              className="border rounded p-2 w-full"
            />
          </div>

          <div>
            <label className="block font-medium mb-1">Year</label>
            <select onChange={handleYearChange} className="border rounded p-2 w-full" value={year}>
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

      <div className="space-y-8">
        <StaffGenderPerformanceSection
          gender="male"
          title="Male Staff Performance"
          employees={maleStaff}
          services={services}
          serviceDefinitions={serviceDefinitions}
          advances={advances}
          tagFees={tagFees}
          lateFees={lateFees}
          clockings={clockings}
          periodLabel={reportLabel}
        />

        <StaffGenderPerformanceSection
          gender="female"
          title="Female Staff Performance"
          employees={femaleStaff}
          services={services}
          serviceDefinitions={serviceDefinitions}
          advances={advances}
          tagFees={tagFees}
          lateFees={lateFees}
          clockings={clockings}
          periodLabel={reportLabel}
        />

        {unassignedGenderStaff.length > 0 && (
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
            {unassignedGenderStaff.length} staff member{unassignedGenderStaff.length === 1 ? "" : "s"} do not have gender assigned.
            Update the employee profile form so they appear in the male/female sections.
          </div>
        )}
      </div>
    </div>
  );
}
