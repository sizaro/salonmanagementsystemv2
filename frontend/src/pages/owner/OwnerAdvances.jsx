import React, { useState, useEffect, useMemo } from "react";
import { useData } from "../../context/DataContext.jsx";
import useOwnerReport from "../../hooks/useOwnerReport.js";
import AdvanceForm from "../../components/AdvanceForm.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import Modal from "../../components/Modal.jsx";

const OwnerAdvances = () => {
  const {
    users = [],
    fetchUsers,
    fetchAdvanceById,
    createAdvance,
    updateAdvance,
    deleteAdvance,
  } = useData();
  const { report, fetchDailyData, fetchWeeklyData, fetchMonthlyData, fetchYearlyData } = useOwnerReport();
  const advances = report?.advances ?? [];

    console.log("Users:", users);
    console.log("advances:", advances);

  const toYMD = (date) => date.toISOString().split("T")[0];
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(toYMD(today));
  const [reportLabel, setReportLabel] = useState("");
  const [week, setWeek] = useState({ start: null, end: null });
  const [monthYear, setMonthYear] = useState("");
  const [year, setYear] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [advanceToDelete, setAdvanceToDelete] = useState(null);

  const employees = (users || []).filter(
    (user) =>
      user &&
      `${user.first_name || ""} ${user.last_name || ""}`.toLowerCase() !== "ntege saleh" &&
      user.role !== "customer"
  );

  console.log("users in the daily page", users)


  const employeeAdvances = useMemo(() => {
    if (!employees.length) return [];
    return advances.filter((a) =>
      employees.some((emp) => emp.id === a.employee_id)
    );
  }, [advances, employees]);

  console.log("employeeAdvances:", employeeAdvances);

  // ========================
  // HANDLERS
  // ========================

  const handleDayChange = (e) => {
    setSelectedDate(e.target.value);
    fetchDailyData(e.target.value);
    fetchUsers();
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
      `${monday.toLocaleDateString()} → ${sunday.toLocaleDateString()}`
    );

    fetchWeeklyData(monday, sunday);
    fetchUsers();
  };

  const handleMonthChange = (e) => {
    const value = e.target.value;
    if (!value) return;

    const [year, month] = value.split("-").map(Number);
    setMonthYear(value);
    setReportLabel(
      new Date(year, month - 1, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    );
    fetchMonthlyData(year, month);
    fetchUsers();
  };

  const handleYearChange = (e) => {
    const selectedYear = e.target.value;
    setYear(selectedYear);
    if (selectedYear) {
      setReportLabel(`Year ${selectedYear}`);
      fetchYearlyData(parseInt(selectedYear, 10));
    }
  };

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= currentYear - 10; y--) {
      years.push(y);
    }
    return years;
  };

  const handleAdd = () => {
    setEditingAdvance(null);
    setShowModal(true);
  };

  const handleEdit = async (advanceId) => {
    const advance = await fetchAdvanceById(advanceId);
    setEditingAdvance(advance);
    setShowModal(true);
  };

  const handleDelete = (advanceId) => {
    setAdvanceToDelete(advanceId);
    setConfirmModalOpen(true);
  };

  const confirmDelete = async () => {
    if (advanceToDelete) {
      await deleteAdvance(advanceToDelete);
      await fetchDailyData(selectedDate);
      setConfirmModalOpen(false);
      setAdvanceToDelete(null);
    }
  };

  const handleModalSubmit = async (advanceData) => {
    if (editingAdvance) {
      await updateAdvance(editingAdvance.id, advanceData);
    } else {
      await createAdvance(advanceData);
    }
    setShowModal(false);
    setEditingAdvance(null);
    await fetchDailyData(selectedDate);
  };

  // Initial load
  useEffect(() => {
    fetchDailyData(selectedDate);
  }, []);

  // Initial load
  useEffect(() => {
    fetchUsers();
  }, [advances]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* FILTER BAR */}
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
            value={year}
            onChange={handleYearChange}
            className="border rounded p-2"
          >
            <option value="" disabled>
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

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Advances</h1>
        <button
          onClick={handleAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow"
        >
          Add Advance
        </button>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto bg-white shadow rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                Employee
              </th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                Amount
              </th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                Date
              </th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                Reason
              </th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {employeeAdvances.map((adv) => (
              <tr key={adv.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">{adv.last_name || "—"}</td>
                <td className="px-4 py-2">{adv.amount}</td>
                <td className="px-4 py-2">
                  {new Date(adv.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2">{adv.description}</td>

                <td className="px-4 py-2 flex gap-2">
                  <button
                    onClick={() => handleEdit(adv.id)}
                    className="bg-yellow-400 hover:bg-yellow-500 text-white px-3 py-1 rounded-md text-sm"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => handleDelete(adv.id)}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODALS */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingAdvance(null);
        }}
      >
        <AdvanceForm
          advanceData={editingAdvance}
          onSubmit={handleModalSubmit}
          onClose={() => setShowModal(false)}
        />
      </Modal>

      <ConfirmModal
        isOpen={confirmModalOpen}
        message="Are you sure you want to delete this advance?"
        confirmMessage="yes"
        onConfirm={confirmDelete}
        onClose={() => setConfirmModalOpen(false)}
      />
    </div>
  );
};

export default OwnerAdvances;
