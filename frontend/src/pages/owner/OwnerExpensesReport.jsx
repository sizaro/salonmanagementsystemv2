import React, { useState, useEffect } from "react";
import { useData } from "../../context/DataContext.jsx";
import useOwnerReport from "../../hooks/useOwnerReport.js";
import Modal from "../../components/Modal.jsx";
import ExpenseForm from "../../components/ExpenseForm.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";

const OwnerExpensesReport = () => {
  const {
    fetchExpenseById,
    updateExpense,
    deleteExpense
  } = useData();
  const { report, fetchDailyData, fetchWeeklyData, fetchMonthlyData, fetchYearlyData } = useOwnerReport();
  const expenses = report?.expenses ?? [];

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
  
    const [liveDuration, setLiveDuration] = useState("");
    const [selectedDate, setSelectedDate] = useState(toYMD(today));
    const [reportLabel, setReportLabel] = useState("");
    const [week, setWeek] = useState({ start: null, end: null });
    const [monthYear, setMonthYear] = useState("");
    const [year, setYear] = useState(new Date().getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);

  // Fetch expenses on page load
  useEffect(() => {
    fetchDailyData(selectedDate);
  }, []);

  // ---- Format UTC Date to EAT ----
  const formatEAT = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("en-UG", {
      timeZone: "Africa/Kampala",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  // Handle day change

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

  const totalExpenses = expenses.reduce(
    (sum, exp) => sum + (parseInt(exp.amount, 10) || 0),
    0
  );

  
    const handleDayChange = (e) => {
    console.log("handleDayChange called with value:", e.target.value);
    setSelectedDate(e.target.value);
    fetchDailyData(e.target.value);
    fetchUsers();
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
      `${monday.toLocaleDateString("en-US")} → ${sunday.toLocaleDateString("en-US")}`
    );
    fetchWeeklyData(monday, sunday);
    fetchUsers();
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
        })}`
      );
      fetchMonthlyData(year, month);
      fetchUsers()
  };
  
  const handleYearChange = (e) => {
    console.log("handleYearChange called with value:", e.target.value);
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
  
    useEffect(() => {
      fetchDailyData(selectedDate);
    }, []);
  

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
        {reportDate} Expenses Report
      </h1>

      {/* Date Picker */}
      <div className="mb-6 flex flex-wrap gap-4 items-end">
  {/* Day Picker */}
  <div>
    <label className="block font-medium mb-1">Day:</label>
    <input
      type="date"
      value={selectedDate}
      onChange={handleDayChange}
      className="border rounded p-2"
    />
  </div>

  {/* Week Picker */}
  <div>
    <label className="block font-medium mb-1">Week:</label>
    <input
      type="week"
      onChange={handleWeekChange}
      className="border rounded p-2"
    />
  </div>

  {/* Month Picker */}
  <div>
    <label className="block font-medium mb-1">Month:</label>
    <input
      type="month"
      value={monthYear}
      onChange={handleMonthChange}
      className="border rounded p-2"
    />
  </div>

  {/* Year Picker */}
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

      {/* Summary */}
      <section className="bg-white shadow-md rounded-lg p-4 mb-6 w-full max-w-4xl">
        <h2 className="text-xl font-semibold text-blue-700 mb-2">Summary</h2>
        <p>
          <span className="font-medium">Total Expenses:</span>{" "}
          {totalExpenses.toLocaleString()} UGX
        </p>
      </section>

      {/* Expenses Table */}
      <section className="bg-white shadow-md rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold text-blue-700 mb-4">Expenses List</h2>
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
                      {formatEAT(exp.created_at)}
                    </td>
                    <td className="p-2 space-x-1">
                      <button
                        className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded"
                        onClick={() => handleEditClick(exp.id)}
                      >
                        Edit
                      </button>
                      <button
                        className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded"
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
            expenseData={editingExpense}
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

export default OwnerExpensesReport;
