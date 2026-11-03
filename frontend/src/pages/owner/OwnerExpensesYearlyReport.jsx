import React, { useState, useEffect } from "react";
import { useData } from "../../context/DataContext.jsx";
import Modal from "../../components/Modal.jsx";
import ExpenseForm from "../../components/ExpenseForm.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";

const OwnerExpensesYearlyReport = () => {
  const { expenses, fetchYearlyData, fetchExpenseById, updateExpense, deleteExpense } = useData();

  const [year, setYear] = useState(new Date().getFullYear());
  const [reportLabel, setReportLabel] = useState("");

  // ---- Modals for Edit/Delete ----
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);

  // ---- Calculate total expenses ----
  const totalExpenses = expenses.reduce((sum, e) => sum + (parseInt(e.amount, 10) || 0), 0);

  // ---- Format UTC date strings to EAT ----
  const formatEAT = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-UG", {
      timeZone: "Africa/Kampala",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // ---- Handle year change ----
  const handleYearChange = async (e) => {
    const selectedYear = parseInt(e.target.value, 10);
    setYear(selectedYear);
    setReportLabel(`Year ${selectedYear}`);
    await fetchYearlyData(selectedYear);
  };

  // ---- Handle Edit/Delete ----
  const handleEditClick = async (expenseId) => {
    const expense = await fetchExpenseById(expenseId);
    setEditingExpense(expense);
    setShowModal(true);
  };

  const handleModalSubmit = async (updatedExpense) => {
    await updateExpense(updatedExpense.id, updatedExpense);
    await fetchYearlyData(year);
    setShowModal(false);
    setEditingExpense(null);
  };

  const handleDelete = (expenseId) => {
    setExpenseToDelete(expenseId);
    setConfirmModalOpen(true);
  };

  const confirmDelete = async () => {
    if (expenseToDelete) {
      await deleteExpense(expenseToDelete);
      await fetchYearlyData(year);
      setConfirmModalOpen(false);
      setExpenseToDelete(null);
    }
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

  return (
    <div className="income-page mx-auto max-w-6xl overflow-y-hidden p-4">
      <h1 className="mb-6 text-center text-3xl font-bold text-gray-800">Yearly Expenses Report</h1>

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

      {/* Summary Section */}
      <section className="mb-6 rounded-lg bg-white p-4 shadow-md">
        <h2 className="mb-2 text-xl font-semibold text-blue-700">Summary</h2>
        <p>
          <span className="font-medium">Total Expenses:</span> {totalExpenses.toLocaleString()} UGX
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
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp, index) => (
                <tr key={exp.id || index} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                  <td className="px-3 py-2">{index + 1}</td>
                  <td className="px-3 py-2">{exp.name}</td>
                  <td className="px-3 py-2">{parseInt(exp.amount, 10).toLocaleString()}</td>
                  <td className="px-3 py-2">{formatEAT(exp.created_at)}</td>
                  <td className="space-x-1 px-3 py-2">
                    <button
                      className="rounded bg-blue-500 px-2 py-1 text-white hover:bg-blue-600"
                      onClick={() => handleEditClick(exp.id)}
                    >
                      Edit
                    </button>
                    <button
                      className="rounded bg-red-500 px-2 py-1 text-white hover:bg-red-600"
                      onClick={() => handleDelete(exp.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingExpense(null);
        }}
      >
        {editingExpense && (
          <ExpenseForm
            expenseData={editingExpense}
            onSubmit={handleModalSubmit}
            onClose={() => {
              setShowModal(false);
              setEditingExpense(null);
            }}
          />
        )}
      </Modal>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={confirmModalOpen}
        message="Are you sure you want to delete this expense?"
        onConfirm={confirmDelete}
        onClose={() => setConfirmModalOpen(false)}
      />
    </div>
  );
};

export default OwnerExpensesYearlyReport;
