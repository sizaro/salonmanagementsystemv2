import React, { useState, useEffect } from "react";
import { useData } from "../../context/DataContext.jsx";
import UserForm from "../../components/UserForm.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import Modal from "../../components/Modal.jsx";
import { useNavigate } from "react-router-dom";

const displayValue = (value) => {
  const normalized = String(value ?? "").trim();
  return !normalized || normalized.toLowerCase() === "null" ? "—" : value;
};

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
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="md:text-3xl text-3xsm font-bold text-gray-800">
          Employees
        </h1>
        <button
          onClick={handleAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-md shadow md:text-sm md:px-4 md:py-2"
        >
          Add Employee
        </button>
      </div>

      <div className="overflow-x-auto bg-white shadow rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                First Name
              </th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                Middle Name
              </th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                Last Name
              </th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                Email
              </th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                Role
              </th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                Phone
              </th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                Next of Kin
              </th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                Next of Kin Phone
              </th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {employees.map((emp) => (
              <tr key={emp.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">{displayValue(emp.first_name)}</td>
                <td className="px-4 py-2">{displayValue(emp.middle_name)}</td>
                <td className="px-4 py-2">{displayValue(emp.last_name)}</td>
                <td className="px-4 py-2">{displayValue(emp.email)}</td>
                <td className="px-4 py-2">{displayValue(emp.role)}</td>
                <td className="px-4 py-2">{displayValue(emp.contact)}</td>
                <td className="px-4 py-2">{displayValue(emp.next_of_kin)}</td>
                <td className="px-4 py-2">{displayValue(emp.next_of_kin_contact)}</td>
                <td className="px-4 py-2 flex gap-2">
                  <button
                    onClick={() => navigate(`/owner/employees/${emp.id}`)}
                    className="bg-slate-700 hover:bg-slate-800 text-white px-3 py-1 rounded-md text-sm"
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleEdit(emp.id)}
                    className="bg-yellow-400 hover:bg-yellow-500 text-white px-3 py-1 rounded-md text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(emp.id)}
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
