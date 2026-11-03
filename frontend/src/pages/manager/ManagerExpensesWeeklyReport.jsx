import React, { useState, useEffect } from "react";
import { useData } from "../../context/DataContext.jsx";

const ManagerExpensesWeeklyReport = () => {
  const { expenses, fetchWeeklyData } = useData();

  const [weekRange, setWeekRange] = useState({ start: null, end: null });
  const [reportLabel, setReportLabel] = useState("");
  const [loading, setLoading] = useState(true);

  // ---- Format UTC date string to EAT ----
  const formatEAT = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("en-UG", {
      timeZone: "Africa/Kampala",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ---- Handle Week Selection ----
  const handleWeekChange = async (e) => {
    const weekString = e.target.value; // e.g. "2025-W39"
    if (!weekString) return;

    const [year, week] = weekString.split("-W").map(Number);

    const firstDayOfYear = new Date(year, 0, 1);
    const day = firstDayOfYear.getDay(); // 0=Sun, 1=Mon
    const firstMonday = new Date(firstDayOfYear);
    const diff = day <= 4 ? day - 1 : day - 8;
    firstMonday.setDate(firstDayOfYear.getDate() - diff);

    const monday = new Date(firstMonday);
    monday.setDate(firstMonday.getDate() + (week - 1) * 7);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    setWeekRange({ start: monday, end: sunday });
    setReportLabel(`${monday.toLocaleDateString("en-US")} → ${sunday.toLocaleDateString("en-US")}`);

    setLoading(true);
    await fetchWeeklyData(monday, sunday);
    setLoading(false);
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

    const fetchData = async () => {
      setLoading(true);
      await fetchWeeklyData(monday, sunday);
      setLoading(false);
    };
    fetchData();
  }, []);

  // ---- Calculate Total Expenses ----
  const totalExpenses = expenses.reduce((sum, e) => sum + (parseInt(e.amount, 10) || 0), 0);

  return (
    <div className="income-page mx-auto max-w-6xl overflow-y-hidden p-4">
      <h1 className="mb-6 text-center text-3xl font-bold text-gray-800">Weekly Expenses Report</h1>

      {/* Week Picker */}
      <div className="mb-4">
        <label className="mb-2 block font-medium">Pick a week:</label>
        <input type="week" onChange={handleWeekChange} className="rounded border p-2" />
        <p className="mt-2 text-gray-600">{reportLabel}</p>
      </div>

      {loading ? (
        <p className="text-gray-700">Loading weekly expenses...</p>
      ) : !expenses.length ? (
        <p className="text-gray-700">No expenses recorded for this week yet.</p>
      ) : (
        <>
          {/* Summary Section */}
          <section className="mb-6 rounded-lg bg-white p-4 shadow-md">
            <h2 className="mb-2 text-xl font-semibold text-blue-700">Summary</h2>
            <p>
              <span className="font-medium">Total Expenses:</span> {totalExpenses.toLocaleString()}{" "}
              UGX
            </p>
          </section>

          {/* Expenses Table */}
          <section className="rounded-lg bg-white p-4 shadow-md">
            <h2 className="mb-4 text-xl font-semibold text-blue-700">Expenses List</h2>
            <div className="max-h-[60vh] w-full overflow-x-auto overflow-y-auto rounded border border-gray-300">
              <table className="min-w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-blue-700 text-white">
                  <tr>
                    <th className="px-3 py-2 text-left">No.</th>
                    <th className="px-3 py-2 text-left">Expense Name</th>
                    <th className="px-3 py-2 text-left">Amount (UGX)</th>
                    <th className="px-3 py-2 text-left">Time of Expense</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp, index) => (
                    <tr
                      key={exp.id || index}
                      className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}
                    >
                      <td className="px-3 py-2">{index + 1}</td>
                      <td className="px-3 py-2">{exp.name}</td>
                      <td className="px-3 py-2">{parseInt(exp.amount, 10).toLocaleString()}</td>
                      <td className="px-3 py-2">{formatEAT(exp.created_at)}</td>
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

export default ManagerExpensesWeeklyReport;
