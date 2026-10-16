import React, { useMemo, useState, useEffect } from "react";
import { useData } from "../context/DataContext.jsx";

export default function WorkDailyReport() {
  const { services, employees, advances, clockings, fetchDailyData } = useData();

  // Initialize date state to today (YYYY-MM-DD)
 const today = new Date().toLocaleDateString("en-CA");
const [selectedDate, setSelectedDate] = useState(today);

  // Fetch data on page load for today
  useEffect(() => {
    fetchDailyData(selectedDate);
  }, []); // run once on mount

  // Fetch data whenever the selected date changes
  const handleDayChange = (e) => {
    const newDate = e.target.value; // format: YYYY-MM-DD
    setSelectedDate(newDate);
    fetchDailyData(newDate);
  };


  const employeeTotals = useMemo(() => {
    if (!employees.length) return [];

    return employees.map((emp) => {
      const fullName = `${emp.first_name} ${emp.last_name}`;

      // Salaries
      const totalSalary = services.reduce((sum, s) => {
        if (s.barber === fullName) sum += parseInt(s.barber_amount) || 0;
        if (s.barber_assistant === fullName)
          sum += parseInt(s.barber_assistant_amount) || 0;
        if (s.scrubber_assistant === fullName)
          sum += parseInt(s.scrubber_assistant_amount) || 0;
        if (s.black_shampoo_assistant === fullName)
          sum += parseInt(s.black_shampoo_assistant_amount) || 0;
        if (s.super_black_assistant === fullName)
          sum += parseInt(s.super_black_assistant_amount) || 0;
        if (s.black_mask_assistant === fullName)
          sum += parseInt(s.black_mask_assistant_amount) || 0;
        return sum;
      }, 0);

      // Advances
      const totalAdvances = advances
        .filter((a) => a.employee_name === fullName)
        .reduce((sum, a) => sum + (parseInt(a.amount) || 0), 0);

      // Clocking
const todayClock = clockings.find((c) => c.employee_names === fullName);
const clockIn = todayClock ? new Date(todayClock.clock_in) : null;
const clockOut = todayClock?.clock_out ? new Date(todayClock.clock_out) : null;

// Calculate total hours in hours + minutes format
      let totalHours = null;
      if (clockIn && clockOut) {
        const diffMs = clockOut - clockIn; // difference in milliseconds
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60)); // hours
        const diffMins = Math.round((diffMs % (1000 * 60 * 60)) / (1000 * 60)); // remaining minutes
        totalHours = `${diffHrs} hrs ${diffMins} minutes`;
      }


      return {
        name: fullName,
        totalSalary,
        totalAdvances,
        netSalary: totalSalary - totalAdvances,
        clockIn,
        clockOut,
        totalHours,
      };
    });
  }, [services, advances, employees, clockings]);

  if (!services.length && !clockings.length) {
    return (
      <section className="p-6">
        <h2 className="text-xl font-bold text-center text-gray-700">
          No Recorded Work Yet
        </h2>
        {/* Date Picker */}
        <div className="mt-4 text-center">
          <label className="font-medium mr-2">Select Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={handleDayChange}
            className="border rounded px-2 py-1"
          />
        </div>
      </section>
    );
  }

  return (
    <section className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        Workers Daily Report
      </h2>

      {/* Date Picker */}
      <div className="mb-4">
        <label className="font-medium mr-2">Select Date:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={handleDayChange}
          className="border rounded px-2 py-1"
        />
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[60vh] border rounded">
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-200 sticky top-0">
            <tr>
              <th className="border px-4 py-2">#</th>
              <th className="border px-4 py-2">Employee</th>
              <th className="border px-4 py-2">Clock In</th>
              <th className="border px-4 py-2">Clock Out</th>
              <th className="border px-4 py-2">Hours Worked</th>
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
                <td className="border px-4 py-2">
                  {emp.clockIn ? emp.clockIn.toLocaleTimeString() : "-"}
                </td>
                <td className="border px-4 py-2">
                  {emp.clockOut ? emp.clockOut.toLocaleTimeString() : "-"}
                </td>
                <td className="border px-4 py-2">
                  {emp.totalHours ? `${emp.totalHours} hrs` : "-"}
                </td>
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
