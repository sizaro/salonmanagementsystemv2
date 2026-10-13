import React, { useState, useEffect } from "react";
import { useData } from "../../context/DataContext.jsx";
import UserForm from "../../components/UserForm.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import Modal from "../../components/Modal.jsx";
import { useNavigate } from "react-router-dom";
import EmployeeDirectoryTable from "../../components/workspace/EmployeeDirectoryTable.jsx";

const OwnerEmployees = () => {
  const {
    users = [],
    fetchUsers,
    fetchUserById,
    createUser,
    updateUser,
    deleteUser,
  } = useData();
  const navigate = useNavigate();

  // Filter out 'Saleh Ntege' and customers
  const employees = users.filter(
    (user) =>user.role !== "customer"
  );

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [addingUser, setAddingUser] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  useEffect(() => {
    fetchUsers();
    // DataContext recreates this function when shared data changes.
    // Load the directory when this page mounts rather than on every refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = () => {
     setAddingUser("employee")
     setShowModal(true);
    
  };

  const handleEdit = async (userId) => {
    const user = await fetchUserById(userId);
    setEditingUser(user);
    setShowModal(true);
  };

  const handleDelete = (userId) => {
    console.log("Trying to delete user:", userId);
    setUserToDelete(userId);
    setConfirmModalOpen(true);
  };

  const confirmDelete = async () => {
    if (userToDelete) {
      await deleteUser(userToDelete);
      await fetchUsers();
      setConfirmModalOpen(false);
      setUserToDelete(null);
    }
  };

  const handleModalSubmit = async (userData) => {
    await createUser(userData);
    setShowModal(false);
    setAddingUser(null);
    await fetchUsers();
  };


  const handleModalEdit = async ( id, userData) => {
    await updateUser(id, userData);
    setShowModal(false);
    setEditingUser(null);
    await fetchUsers();
  };

  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div>
          <p className="workspace-section-kicker">Team management</p>
          <h1>Employees</h1>
          <p>View employee details, update permitted records, and keep the salon team organised.</p>
        </div>
        <button
          onClick={handleAdd}
          className="workspace-primary-action"
        >
          Add Employee
        </button>
      </header>
      <EmployeeDirectoryTable employees={employees} onView={(id) => navigate(`/owner/employees/${id}`)} onEdit={handleEdit} onDelete={handleDelete} allowManage />

      {/* Add / Edit Modal */}

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingUser(null);
        }}
      >
        {(editingUser) && (
          <UserForm
            role="employee"
            user={editingUser}
            onSubmit={handleModalEdit}
            onClose={() => {
              setShowModal(false);
              setEditingUser(null);
            }}
          />
        )}

        {(addingUser) && (
          <UserForm
            role="employee"
            user={null}
            onSubmit={handleModalSubmit}
            onClose={() => {
              setShowModal(false);
              setAddingUser(null);
            }}
          />
        )}


      </Modal>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={confirmModalOpen}
        confirmMessage="yes"
        message="Are you sure you want to delete this employee?"
        onConfirm={confirmDelete}
        onClose={() => setConfirmModalOpen(false)}
      />
    </div>
  );
};

export default OwnerEmployees;
