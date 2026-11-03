import React, { useState, useEffect } from "react";
import { useData } from "../../context/DataContext.jsx";
import Modal from "../../components/Modal.jsx";
import TagFeeForm from "../../components/TagFeeForm.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";

const OwnerTagFeesYearlyReport = () => {
  const {
    tagFees,
    fetchTagFeesByYear, // make sure this exists in DataContext
    fetchTagFeeById,
    updateTagFee,
    deleteTagFee,
  } = useData();

  const [year, setYear] = useState(new Date().getFullYear());
  const [reportLabel, setReportLabel] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingTagFee, setEditingTagFee] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [feeToDelete, setFeeToDelete] = useState(null);

  // ---- Total tag fees ----
  const totalTagFees = tagFees.reduce((sum, f) => sum + (parseInt(f.amount, 10) || 0), 0);

  // ---- Format UTC date to readable format ----
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
    await fetchTagFeesByYear(selectedYear);
  };

  // ---- Edit/Delete ----
  const handleEditClick = async (id) => {
    const fee = await fetchTagFeeById(id);
    setEditingTagFee(fee);
    setShowModal(true);
  };

  const handleModalSubmit = async (updatedTagFee) => {
    await updateTagFee(updatedTagFee.id, updatedTagFee);
    await fetchTagFeesByYear(year);
    setShowModal(false);
    setEditingTagFee(null);
  };

  const handleDelete = (id) => {
    setFeeToDelete(id);
    setConfirmModalOpen(true);
  };

  const confirmDelete = async () => {
    if (feeToDelete) {
      await deleteTagFee(feeToDelete);
      await fetchTagFeesByYear(year);
      setConfirmModalOpen(false);
      setFeeToDelete(null);
    }
  };

  // ---- Year options ----
  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= currentYear - 10; y--) {
      years.push(y);
    }
    return years;
  };

  // ---- On mount ----
  useEffect(() => {
    const currentYear = new Date().getFullYear();
    setYear(currentYear);
    setReportLabel(`Year ${currentYear}`);
    fetchTagFeesByYear(currentYear);
  }, []);

  return (
    <div className="income-page mx-auto max-w-6xl overflow-y-hidden p-4">
      <h1 className="mb-6 text-center text-3xl font-bold text-gray-800">Yearly Tag Fees Report</h1>

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
          <span className="font-medium">Total Tag Fees:</span> {totalTagFees.toLocaleString()} UGX
        </p>
      </section>

      {/* Tag Fees Table */}
      <section className="rounded-lg bg-white p-4 shadow-md">
        <h2 className="mb-4 text-xl font-semibold text-blue-700">Tag Fees List</h2>
        <div className="max-h-[60vh] w-full overflow-x-auto overflow-y-auto rounded border border-gray-300">
          <table className="min-w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-blue-700 text-white">
              <tr>
                <th className="px-3 py-2 text-left">No.</th>
                <th className="px-3 py-2 text-left">Fee Name</th>
                <th className="px-3 py-2 text-left">Amount (UGX)</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tagFees.map((fee, index) => (
                <tr key={fee.id || index} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
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
            tagFeeData={editingTagFee}
            onSubmit={handleModalSubmit}
            onClose={() => {
              setShowModal(false);
              setEditingTagFee(null);
            }}
          />
        )}
      </Modal>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={confirmModalOpen}
        message="Are you sure you want to delete this tag fee?"
        onConfirm={confirmDelete}
        onClose={() => setConfirmModalOpen(false)}
      />
    </div>
  );
};

export default OwnerTagFeesYearlyReport;
