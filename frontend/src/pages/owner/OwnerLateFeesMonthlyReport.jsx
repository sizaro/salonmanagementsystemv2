import React, { useState, useEffect } from "react";
import { useData } from "../../context/DataContext";
import Modal from "../../components/Modal.jsx";
import LateFeeForm from "../../components/LateFeeForm.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";

const OwnerLateFeesMonthlyReport = () => {
  const { lateFees, fetchMonthlyLateFees, fetchLateFeeById, updateLateFee, deleteLateFee } =
    useData();

  const [monthYear, setMonthYear] = useState(""); // e.g. "2025-09"
  const [reportLabel, setReportLabel] = useState("");
  const [loading, setLoading] = useState(true);

  // ---- Modals for Edit/Delete ----
  const [showModal, setShowModal] = useState(false);
  const [editingLateFee, setEditingLateFee] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [lateFeeToDelete, setLateFeeToDelete] = useState(null);

  // ---- Calculate total late fees ----
  const totalLateFees = lateFees.reduce((sum, e) => sum + (parseInt(e.amount, 10) || 0), 0);

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
    await fetchMonthlyLateFees(year, month);
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
      await fetchMonthlyLateFees(year, month);
      setLoading(false);
    };

    fetchData();
  }, []);

  // ---- Handle Edit/Delete ----
  const handleEditClick = async (lateFeeId) => {
    const lateFee = await fetchLateFeeById(lateFeeId);
    setEditingLateFee(lateFee);
    setShowModal(true);
  };

  const handleModalSubmit = async (updatedLateFee) => {
    await updateLateFee(updatedLateFee.id, updatedLateFee);
    const [year, month] = monthYear.split("-").map(Number);
    await fetchMonthlyLateFees(year, month);
    setShowModal(false);
    setEditingLateFee(null);
  };

  const handleDelete = (lateFeeId) => {
    setLateFeeToDelete(lateFeeId);
    setConfirmModalOpen(true);
  };

  const confirmDelete = async () => {
    if (lateFeeToDelete) {
      await deleteLateFee(lateFeeToDelete);
      const [year, month] = monthYear.split("-").map(Number);
      await fetchMonthlyLateFees(year, month);
      setConfirmModalOpen(false);
      setLateFeeToDelete(null);
    }
  };

  // ---- Render ----
  return (
    <div className="income-page mx-auto max-w-6xl overflow-y-hidden p-4">
      <h1 className="mb-6 text-center text-3xl font-bold text-gray-800">
        Monthly Late Fees Report
      </h1>

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
        <p className="text-gray-700">Loading monthly late fees...</p>
      ) : !lateFees.length ? (
        <p className="text-gray-700">No late fees recorded for this month yet.</p>
      ) : (
        <>
          {/* Summary Section */}
          <section className="mb-6 rounded-lg bg-white p-4 shadow-md">
            <h2 className="mb-2 text-xl font-semibold text-blue-700">Summary</h2>
            <p>
              <span className="font-medium">Total Late Fees:</span> {totalLateFees.toLocaleString()}{" "}
              UGX
            </p>
          </section>

          {/* Late Fees Table */}
          <section className="rounded-lg bg-white p-4 shadow-md">
            <h2 className="mb-4 text-xl font-semibold text-blue-700">Late Fees List</h2>
            <div className="max-h-[60vh] w-full overflow-x-auto overflow-y-auto rounded border border-gray-300">
              <table className="min-w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-blue-700 text-white">
                  <tr>
                    <th className="px-3 py-2 text-left">No.</th>
                    <th className="px-3 py-2 text-left">Fee Name</th>
                    <th className="px-3 py-2 text-left">Amount (UGX)</th>
                    <th className="px-3 py-2 text-left">Time of Fee</th>
                    <th className="px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lateFees.map((fee, index) => (
                    <tr
                      key={fee.id || index}
                      className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}
                    >
                      <td className="px-3 py-2">{index + 1}</td>
                      <td className="px-3 py-2">{fee.name}</td>
                      <td className="px-3 py-2">{parseInt(fee.amount, 10).toLocaleString()}</td>
                      <td className="px-3 py-2">{formatEAT(fee.created_at)}</td>
                      <td className="space-x-1 px-3 py-2">
                        <button
                          className="rounded bg-blue-500 px-2 py-1 text-white hover:bg-blue-600"
                          onClick={() => handleEditClick(fee.id)}
                        >
                          Edit
                        </button>
                        <button
                          className="rounded bg-red-500 px-2 py-1 text-white hover:bg-red-600"
                          onClick={() => handleDelete(fee.id)}
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
        </>
      )}

      {/* Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingLateFee(null);
        }}
      >
        {editingLateFee && (
          <LateFeeForm
            onSubmit={handleModalSubmit}
            onClose={() => {
              setShowModal(false);
              setEditingLateFee(null);
            }}
            lateFeeData={editingLateFee}
          />
        )}
      </Modal>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={confirmModalOpen}
        message="Are you sure you want to delete this late fee?"
        onConfirm={confirmDelete}
        onClose={() => setConfirmModalOpen(false)}
      />
    </div>
  );
};

export default OwnerLateFeesMonthlyReport;
