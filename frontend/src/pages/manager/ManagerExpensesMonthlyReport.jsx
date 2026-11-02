import React, { useState, useEffect } from "react";
import { useData } from "../../context/DataContext";
import Modal from "../../components/Modal.jsx";
import ExpenseForm from "../../components/ExpenseForm.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";

const OwnerExpensesMonthlyReport = () => {
  const { expenses, fetchMonthlyData } = useData();

  const [monthYear, setMonthYear] = useState(""); // e.g. "2025-09"
  const [reportLabel, setReportLabel] = useState("");
  const [loading, setLoading] = useState(true);

  // ---- Calculate total expenses ----
  const totalExpenses = expenses.reduce((sum, e) => sum + (parseInt(e.amount, 10) || 0), 0);

  // ---- Format UTC date strings to EAT ----
  const formatEAT = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("en-UG", {
      timeZone: "Africa/Kampala",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ---- Handle month selection ----
  const handleMonthChange = async (e) => {
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

    setLoading(true);
    await fetchMonthlyData(year, month);
    setLoading(false);
  };

  // ---- On page load: current month ----
  useEffect(() => {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    const value = `${year}-${month.toString().padStart(2, "0")}`;

    setMonthYear(value);
    setReportLabel(`${today.toLocaleString("en-US", { month: "long", year: "numeric" })}`);

    const fetchData = async () => {
      setLoading(true);
      await fetchMonthlyData(year, month);
      setLoading(false);
    };

    fetchData();
  }, []);

  // ---- Render ----
  return (
    <div className="income-page mx-auto max-w-6xl overflow-y-hidden p-4">
      <h1 className="mb-6 text-center text-3xl font-bold text-gray-800">Monthly Expenses Report</h1>

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

      {loading ? (
        <p className="text-gray-700">Loading monthly expenses...</p>
      ) : !expenses.length ? (
        <p className="text-gray-700">No expenses recorded for this month yet.</p>
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

export default OwnerExpensesMonthlyReport;
