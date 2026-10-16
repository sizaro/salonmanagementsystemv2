import React, { useState, useEffect, useMemo } from "react";
import { useData } from "../../context/DataContext.jsx";
import Modal from "../../components/Modal.jsx";
import TagFeeForm from "../../components/TagFeeForm.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";

const OwnerTagFeesReport = () => {
  const {
    tagFees,
    fetchDailyData,
    fetchTagFeeById,
    updateTagFee,
    deleteTagFee,
    users = [],
    fetchUsers,
    fetchWeeklyData,
    fetchMonthlyData,
    fetchYearlyData,
  } = useData();

  const [tagFeeToDelete, setTagFeeToDelete] = useState(null);

  const toYMD = (date) => date.toISOString().split("T")[0];
    const today = new Date();
    const [selectedDate, setSelectedDate] = useState(toYMD(today));
    const [week, setWeek] = useState({ start: null, end: null });
    const [monthYear, setMonthYear] = useState("");
    const [year, setYear] = useState("");
    const [reportLabel, setReportLabel] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editingTagFee, setEditingTagFee] = useState(null);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  
    // FILTER EMPLOYEES
    const employees = (users || []).filter(
      (user) =>
        user &&
        `${user.first_name || ""} ${user.last_name || ""}`.toLowerCase() !== "ntege saleh" &&
        user.role !== "customer"
    );
  
    // MAP EMPLOYEE NAME TO EACH LATE FEE
    const tagFeesWithNames = useMemo(() => {
      return tagFees.map((fee) => {
        const emp = employees.find((u) => u.id === fee.employee_id);
        return {
          ...fee,
          first_name: emp ? `${emp.first_name}` : "—",
          last_name: emp ? `${emp.last_name}` : "—",
        };
      });
    }, [tagFees, employees]);

  // Fetch tag fees on page load
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
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  // ===================================
  // HANDLERS
  // ===================================

  const handleDayChange = (e) => {
    const date = e.target.value;
    setSelectedDate(date);
    fetchDailyData(date);
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

    setReportLabel(`${monday.toLocaleDateString()} → ${sunday.toLocaleDateString()}`);

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
      fetchUsers();
    }
  };

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= currentYear - 10; y--) years.push(y);
    return years;
  };


  // Handle Edit
  const handleEdit = async (tagFeeId) => {
    const tagFee = await fetchTagFeeById(tagFeeId);
    setEditingTagFee(tagFee);
    setShowModal(true);
  };

  // Submit Edit
  const handleModalSubmit = async (updatedTagFee) => {
    await updateTagFee(updatedTagFee.id, updatedTagFee);
    await fetchDailyData(selectedDate);
    setShowModal(false);
    setEditingTagFee(null);
  };

  // Handle Delete
  const handleDelete = (tagFeeId) => {
    setTagFeeToDelete(tagFeeId);
    setConfirmModalOpen(true);
  };

  // Confirm Delete
  const confirmDelete = async () => {
    if (tagFeeToDelete) {
      await deleteTagFee(tagFeeToDelete);
      await fetchDailyData(selectedDate);
      setConfirmModalOpen(false);
      setTagFeeToDelete(null);
    }
  };

  const reportDate = new Date(selectedDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const totalTagFees = tagFees.reduce(
    (sum, fee) => sum + (parseInt(fee.amount, 10) || 0),
    0
  );

   useEffect(() => {
      fetchUsers();
    }, [tagFees]);

  return (
    <div className="max-w-4xl mx-auto p-4">
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
          <input type="week" onChange={handleWeekChange} className="border rounded p-2" />
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
            <option value="">Select</option>
            {generateYearOptions().map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>
      </div>


      {/* Summary Section */}
      <section className="bg-white shadow-md rounded-lg p-4 mb-6 w-full">
        <h2 className="text-xl font-semibold text-blue-700 mb-2">Summary</h2>
        <p>
          <span className="font-medium">Total Tag Fees: </span>
          {totalTagFees.toLocaleString()} UGX
        </p>
      </section>

      {/* Tag Fees Table */}
      <section className="bg-white shadow-md rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold text-blue-700 mb-4">Tag Fees List</h2>

        {tagFees.length === 0 ? (
          <p className="text-center text-gray-600">No tag fees recorded yet</p>
        ) : (
          <div className="overflow-x-auto bg-white shadow rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-semibold">Employee</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">Amount</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">Reason</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">Time</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {tagFeesWithNames.map((fee) => (
              <tr key={fee.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">{fee.last_name}</td>
                <td className="px-4 py-2">{fee.amount}</td>
                <td className="px-4 py-2">{fee.reason}</td>
                <td className="px-4 py-2">
                  {new Date(fee.created_at).toLocaleString("en-UG", {
                    timeZone: "Africa/Kampala",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>

                <td className="px-4 py-2 flex gap-2">
                  <button
                    onClick={() => handleEdit(fee.id)}
                    className="bg-yellow-400 hover:bg-yellow-500 text-white px-3 py-1 rounded"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => handleDelete(fee.id)}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
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
          setEditingTagFee(null);
        }}
      >
        {editingTagFee && (
          <TagFeeForm
          employees={employees}
            onSubmit={handleModalSubmit}
            onClose={() => {
              setShowModal(false);
              setEditingTagFee(null);
            }}
            feeData={editingTagFee  }
          />
        )}
      </Modal>

      {/* Confirm Delete */}
      <ConfirmModal
        isOpen={confirmModalOpen}
        message="Are you sure you want to delete this tag fee?"
        confirmMessage="yes"
        onConfirm={confirmDelete}
        onClose={() => setConfirmModalOpen(false)}
      />
    </div>
  );
};

export default OwnerTagFeesReport;
