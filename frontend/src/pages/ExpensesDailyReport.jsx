import React, { useState, useEffect } from "react";
import { useData } from "../context/DataContext.jsx";
import Modal from "../components/Modal.jsx";
import ExpenseForm from "../components/ExpenseForm.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";

const ExpensesDailyReport = () => {
  const {
    expenses,
    fetchExpenses,
    fetchDailyData,
    fetchExpenseById,
    updateExpense,
    deleteExpense,
  } = useData();

  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
  const [selectedDate, setSelectedDate] = useState(today);
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);

  // Fetch expenses on page load
  useEffect(() => {
    fetchDailyData(selectedDate);
  }, []);

  // Handle day change
  const handleDayChange = (e) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    fetchDailyData(newDate);
  };

  // Handle edit button click
  const handleEditClick = async (expenseId) => {
    const expense = await fetchExpenseById(expenseId);
    setEditingExpense(expense);
    setShowModal(true);
  };

  // Handle modal form submission
  const handleModalSubmit = async (updatedExpense) => {
    await updateExpense(updatedExpense.id, updatedExpense);
    await fetchDailyData(selectedDate); // refresh list
    setShowModal(false);
    setEditingExpense(null);
  };

  // Handle delete button click
  const handleDelete = (expenseId) => {
    setExpenseToDelete(expenseId);
    setConfirmModalOpen(true);
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (expenseToDelete) {
      await deleteExpense(expenseToDelete);
      await fetchDailyData(selectedDate);
      setConfirmModalOpen(false);
      setExpenseToDelete(null);
    }
  };

  const reportDate = new Date(selectedDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const totalExpenses = expenses.reduce((sum, exp) => sum + (parseInt(exp.amount, 10) || 0), 0);

  return (
    <div className="mx-auto max-w-4xl p-4">
      <h1 className="mb-6 text-center text-3xl font-bold text-gray-800">
        {reportDate} Expenses Report
      </h1>

      {/* Date Picker */}
      <div className="mb-4 text-center">
        <label className="mr-2 font-medium">Select Date:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={handleDayChange}
          className="rounded border px-2 py-1"
        />
      </div>

      {/* Summary */}
      <section className="mb-6 w-full max-w-4xl rounded-lg bg-white p-4 shadow-md">
        <h2 className="mb-2 text-xl font-semibold text-blue-700">Summary</h2>
        <p>
          <span className="font-medium">Total Expenses:</span> {totalExpenses.toLocaleString()} UGX
        </p>
      </section>

      {/* Expenses Table */}
      <section className="mb-6 rounded-lg bg-white p-4 shadow-md">
        <h2 className="mb-4 text-xl font-semibold text-blue-700">Expenses List</h2>
        {expenses.length === 0 ? (
          <p className="text-center text-gray-600">No expenses recorded yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-300 text-sm">
              <thead className="bg-blue-700 text-white">
                <tr>
                  <th className="p-2 text-left">No.</th>
                  <th className="p-2 text-left">Expense Name</th>
                  <th className="p-2 text-left">Amount (UGX)</th>
                  <th className="p-2 text-left">Description</th>
                  <th className="p-2 text-left">Time of Expense</th>
                  <th className="p-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp, index) => (
                  <tr key={exp.id} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                    <td className="p-2">{index + 1}</td>
                    <td className="p-2">{exp.name}</td>
                    <td className="p-2">{parseInt(exp.amount, 10).toLocaleString()}</td>
                    <td className="p-2">{exp.description}</td>
                    <td className="p-2">
                      {new Date(exp.created_at).toLocaleString("en-UG", {
                        timeZone: "Africa/Kampala",
                      })}
                    </td>
                    <td className="space-x-1 p-2">
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
        )}
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
            onSubmit={handleModalSubmit}
            onClose={() => {
              setShowModal(false);
              setEditingExpense(null);
            }}
            expenseData={editingExpense} // pass data to prefill
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

export default ExpensesDailyReport;
