import React, { useState, useEffect } from "react";
import { useData } from "../context/DataContext.jsx";
import AdvanceForm from "../components/AdvanceForm.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import Modal from "../components/Modal.jsx";

const Advances = () => {
  const { advances, fetchAdvances, fetchAdvanceById, createAdvance, updateAdvance, deleteAdvance } =
    useData();

  const [showModal, setShowModal] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [advanceToDelete, setAdvanceToDelete] = useState(null);

  useEffect(() => {
    fetchAdvances();
  }, []);

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
      await fetchAdvances();
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
    await fetchAdvances();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">Advances</h1>
        <button
          onClick={handleAdd}
          className="rounded-md bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700"
        >
          Add Advance
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Employee</th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Amount</th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Date</th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Reason</th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {advances.map((adv) => (
              <tr key={adv.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">{adv.employee_name || "—"}</td>
                <td className="px-4 py-2">{adv.amount}</td>
                <td className="px-4 py-2">{new Date(adv.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-2">{adv.description}</td>
                <td className="flex gap-2 px-4 py-2">
                  <button
                    onClick={() => handleEdit(adv.id)}
                    className="rounded-md bg-yellow-400 px-3 py-1 text-sm text-white hover:bg-yellow-500"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(adv.id)}
                    className="rounded-md bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
        onConfirm={confirmDelete}
        onClose={() => setConfirmModalOpen(false)}
      />
    </div>
  );
};

export default Advances;
