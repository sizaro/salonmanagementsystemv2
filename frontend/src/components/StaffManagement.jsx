import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../context/DataContext.jsx";
import Modal from "./Modal.jsx";
import ConfirmModal from "./ConfirmModal.jsx";
import UserForm from "./UserForm.jsx";

export default function StaffManagement({ managerView = false }) {
  const { users = [], fetchUsers, fetchUserById, createUser, updateUser, deleteUser } = useData();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false); const [editingUser, setEditingUser] = useState(null); const [deletingUser, setDeletingUser] = useState(null); const [error, setError] = useState("");
  useEffect(() => { fetchUsers().catch((requestError) => setError(requestError?.response?.data?.error || "Employees could not be loaded.")); }, []);
  const staff = useMemo(() => users.filter((user) => ["manager", "cashier", "employee"].includes(String(user.role || "").toLowerCase())), [users]);
  const closeForm = () => { setShowForm(false); setEditingUser(null); };
  const edit = async (id) => { try { setError(""); setEditingUser(await fetchUserById(id)); setShowForm(true); } catch (requestError) { setError(requestError?.response?.data?.error || "Employee details could not be opened."); } };
  const save = async (idOrData, maybeData) => { try { setError(""); if (editingUser) await updateUser(idOrData, maybeData); else await createUser(idOrData); closeForm(); } catch (requestError) { setError(requestError?.response?.data?.error || "Employee could not be saved."); throw requestError; } };
  const remove = async () => { try { setError(""); await deleteUser(deletingUser.id); setDeletingUser(null); } catch (requestError) { setError(requestError?.response?.data?.error || "Employee could not be deleted."); } };
  return <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold text-gray-800">Employee management</h1><p className="mt-1 text-sm text-gray-500">Create, update, and maintain staff records and identification evidence.</p></div><button type="button" onClick={() => { setEditingUser(null); setShowForm(true); }} className="rounded-md bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700">Add employee</button></div>
    {error && <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="overflow-x-auto rounded-lg bg-white shadow"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-100"><tr>{["Employee","Role","Contact","Specialty","ID evidence","Actions"].map((title)=><th key={title} className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{title}</th>)}</tr></thead><tbody className="divide-y divide-gray-200">{staff.length===0?<tr><td colSpan="6" className="px-4 py-10 text-center text-gray-500">No employee records yet.</td></tr>:staff.map((employee)=><tr key={employee.id} className="hover:bg-gray-50"><td className="px-4 py-3"><p className="font-medium text-gray-900">{[employee.first_name,employee.middle_name,employee.last_name].filter(Boolean).join(" ")}</p><p className="text-sm text-gray-500">{employee.email}</p></td><td className="px-4 py-3 capitalize">{employee.role}</td><td className="px-4 py-3">{employee.contact || "—"}</td><td className="px-4 py-3">{employee.specialty || "—"}</td><td className="px-4 py-3">{employee.has_identity_evidence ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Attached</span> : <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">Missing</span>}</td><td className="px-4 py-3"><div className="flex gap-2"><button type="button" onClick={() => navigate(`${managerView ? "/manager" : "/owner"}/employees/${employee.id}`)} className="rounded bg-slate-700 px-3 py-1 text-sm text-white hover:bg-slate-800">View</button><button type="button" onClick={() => edit(employee.id)} className="rounded bg-yellow-400 px-3 py-1 text-sm text-white hover:bg-yellow-500">Edit</button><button type="button" onClick={() => setDeletingUser(employee)} className="rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600">Delete</button></div></td></tr>)}</tbody></table></div>
    <Modal isOpen={showForm} onClose={closeForm} sizeClass="max-w-3xl"><UserForm user={editingUser} role="employee" onSubmit={save} onClose={closeForm} /></Modal>
    <ConfirmModal isOpen={Boolean(deletingUser)} message={`Delete ${deletingUser ? `${deletingUser.first_name || ""} ${deletingUser.last_name || ""}`.trim() : "this employee"}? This cannot be undone.`} confirmMessage="Delete" onConfirm={remove} onClose={() => setDeletingUser(null)} />
    {managerView && <p className="mt-4 text-xs text-gray-500">Managers can manage staff but cannot access or change the owner account.</p>}
  </div>;
}
