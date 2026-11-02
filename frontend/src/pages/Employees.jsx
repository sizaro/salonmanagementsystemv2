import React, { useState, useEffect } from "react";
import { useData } from "../context/DataContext.jsx";
import EmployeeForm from "../components/EmployeeForm.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import Modal from "../components/Modal.jsx";

const Employees = () => {
  const {
    employees,
    fetchEmployees,
    fetchEmployeeById,
    createEmployee,
    updateEmployee,
    deleteEmployee,
  } = useData();

  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleAdd = () => {
    setEditingEmployee(null);
    setShowModal(true);
  };

  const handleEdit = async (employeeId) => {
    const employee = await fetchEmployeeById(employeeId);
    setEditingEmployee(employee);
    setShowModal(true);
  };

  const handleDelete = (employeeId) => {
    setEmployeeToDelete(employeeId);
    setConfirmModalOpen(true);
  };

  const confirmDelete = async () => {
    if (employeeToDelete) {
      await deleteEmployee(employeeToDelete);
      await fetchEmployees();
      setConfirmModalOpen(false);
      setEmployeeToDelete(null);
    }
  };

  const handleModalSubmit = async (employeeData) => {
    if (editingEmployee) {
      await updateEmployee(editingEmployee.id, employeeData);
    } else {
      await createEmployee(employeeData);
    }
    setShowModal(false);
    setEditingEmployee(null);
    await fetchEmployees();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">Employees</h1>
        <button
          onClick={handleAdd}
          className="rounded-md bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700"
        >
          Add Employee
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                First Name
              </th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                Middle Name
              </th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Last Name</th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Email</th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Role</th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Phone</th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                Next of Kin
              </th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                Next of Kin Phone
              </th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {employees.map((emp) => (
              <tr key={emp.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">{emp.first_name}</td>
                <td className="px-4 py-2">{emp.middle_name}</td>
                <td className="px-4 py-2">{emp.last_name}</td>
                <td className="px-4 py-2">{emp.email}</td>
                <td className="px-4 py-2">{emp.role}</td>
                <td className="px-4 py-2">{emp.phone}</td>
                <td className="px-4 py-2">{emp.next_of_kin}</td>
                <td className="px-4 py-2">{emp.next_of_kin_phone}</td>
                <td className="flex gap-2 px-4 py-2">
                  <button
                    onClick={() => handleEdit(emp.id)}
                    className="rounded-md bg-yellow-400 px-3 py-1 text-sm text-white hover:bg-yellow-500"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(emp.id)}
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
          setEditingEmployee(null);
        }}
      >
        {editingEmployee && (
          <EmployeeForm
            employee={editingEmployee}
            onSubmit={handleModalSubmit}
            onClose={() => {
              setShowModal(false);
              setEditingEmployee(null);
            }}
          />
        )}
      </Modal>

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModalOpen}
        message="Are you sure you want to delete this employee?"
        onConfirm={confirmDelete}
        onClose={() => setConfirmModalOpen(false)}
      />
    </div>
  );
};

export default Employees;
