import React, { useState, useEffect } from "react";
import { useData } from "../../context/DataContext.jsx";
import Modal from "../../components/Modal.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import LateFeeForm from "../../components/LateFeeForm.jsx"; // you’ll create this next

const OwnerLateFeesWeeklyReport = () => {
  const { lateFees, fetchLateFees, fetchLateFeeById, updateLateFee, deleteLateFee } = useData();

  const [weekRange, setWeekRange] = useState({ start: null, end: null });
  const [reportLabel, setReportLabel] = useState("");
  const [loading, setLoading] = useState(true);

  // ---- Modals for Edit/Delete ----
  const [showModal, setShowModal] = useState(false);
  const [editingLateFee, setEditingLateFee] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [feeToDelete, setFeeToDelete] = useState(null);

  // ---- Format Date ----
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

    setWeekRange({ start: monday, end: sunday });
    setReportLabel(`${monday.toLocaleDateString()} → ${sunday.toLocaleDateString()}`);

    setLoading(true);
    await fetchLateFees(); // You can add weekly filtering later in backend
    setLoading(false);
  };

  useEffect(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    setWeekRange({ start: monday, end: sunday });
    setReportLabel(`${monday.toLocaleDateString()} → ${sunday.toLocaleDateString()}`);

    const fetchData = async () => {
      setLoading(true);
      await fetchLateFees();
      setLoading(false);
    };
    fetchData();
  }, []);

  // ---- Edit/Delete Handlers ----
  const handleEditClick = async (id) => {
    const fee = await fetchLateFeeById(id);
    setEditingLateFee(fee);
    setShowModal(true);
  };

  const handleModalSubmit = async (updatedLateFee) => {
    await updateLateFee(updatedLateFee.id, updatedLateFee);
    await fetchLateFees();
    setShowModal(false);
    setEditingLateFee(null);
  };

  const handleDelete = (id) => {
    setFeeToDelete(id);
    setConfirmModalOpen(true);
  };

  const confirmDelete = async () => {
    if (feeToDelete) {
      await deleteLateFee(feeToDelete);
      await fetchLateFees();
      setConfirmModalOpen(false);
      setFeeToDelete(null);
    }
  };

  // ---- Calculate Total ----
  const totalLateFees = lateFees.reduce((sum, f) => sum + (parseInt(f.amount, 10) || 0), 0);

  return (
    <div className="income-page mx-auto max-w-6xl overflow-y-hidden p-4">
      <h1 className="mb-6 text-center text-3xl font-bold text-gray-800">Weekly Late Fees Report</h1>

      <div className="mb-4">
        <label className="mb-2 block font-medium">Pick a week:</label>
        <input type="week" onChange={handleWeekChange} className="rounded border p-2" />
        <p className="mt-2 text-gray-600">{reportLabel}</p>
      </div>

      {loading ? (
        <p className="text-gray-700">Loading late fees...</p>
      ) : !lateFees.length ? (
        <p className="text-gray-700">No late fees recorded this week.</p>
      ) : (
        <>
          <section className="mb-6 rounded-lg bg-white p-4 shadow-md">
            <h2 className="mb-2 text-xl font-semibold text-blue-700">Summary</h2>
            <p>
              <span className="font-medium">Total Late Fees:</span> {totalLateFees.toLocaleString()}{" "}
              UGX
            </p>
          </section>

          <section className="rounded-lg bg-white p-4 shadow-md">
            <h2 className="mb-4 text-xl font-semibold text-blue-700">Late Fees List</h2>
            <div className="max-h-[60vh] w-full overflow-x-auto overflow-y-auto rounded border border-gray-300">
              <table className="min-w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-blue-700 text-white">
                  <tr>
                    <th className="px-3 py-2 text-left">No.</th>
                    <th className="px-3 py-2 text-left">Student</th>
                    <th className="px-3 py-2 text-left">Amount (UGX)</th>
                    <th className="px-3 py-2 text-left">Time</th>
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
                      <td className="px-3 py-2">{fee.student_name || "N/A"}</td>
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

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingLateFee(null);
        }}
      >
        {editingLateFee && (
          <LateFeeForm
            lateFeeData={editingLateFee}
            onSubmit={handleModalSubmit}
            onClose={() => {
              setShowModal(false);
              setEditingLateFee(null);
            }}
          />
        )}
      </Modal>

      <ConfirmModal
        isOpen={confirmModalOpen}
        message="Are you sure you want to delete this late fee?"
        onConfirm={confirmDelete}
        onClose={() => setConfirmModalOpen(false)}
      />
    </div>
  );
};

export default OwnerLateFeesWeeklyReport;
