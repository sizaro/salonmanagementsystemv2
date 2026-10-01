import { useState, useEffect } from "react";
import { useData } from "../context/DataContext";

export default function AdvanceForm({
  onSubmit,
  onClose,
  advanceData,
  entryType = "current",
}) {
  const isPast = entryType === "past";

  const [form, setForm] = useState({
    id: "",
    employee_id: "",
    amount: "",
    description: "",
    advance_date: "",
    advance_time: "",
    created_at: "",
  });

  const { users = [], fetchUsers } = useData();

  const Employees = users.filter(
    (user) =>
      `${user.first_name} ${user.last_name}`.toLowerCase() !== "saleh ntege" &&
      user.role !== "customer",
  );

  useEffect(() => {
    if (advanceData) {
      setForm({
        id: advanceData.id || "",
        employee_id: advanceData.employee_id || "",
        amount: advanceData.amount || "",
        description: advanceData.description || "",
        advance_date: advanceData.advance_date || "",
        advance_time: advanceData.advance_time
          ? String(advanceData.advance_time).slice(0, 5)
          : "",
        created_at: advanceData.created_at || "",
      });
    }
  }, [advanceData]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleChange = (e) => {
    setForm((previous) => ({
      ...previous,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      id: form.id || undefined,
      employee_id: form.employee_id,
      amount: Number(form.amount),
      description: form.description.trim(),
      entry_type: isPast ? "past" : "current",
    };

    if (isPast) {
      payload.advance_date = form.advance_date;
      payload.advance_time = form.advance_time;
    }

    await onSubmit(payload);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 p-4 bg-white rounded shadow-md max-w-md mx-auto"
    >
      <div>
        <h2 className="text-2xl font-bold text-gray-800">
          {form.id
            ? "Edit Advance"
            : isPast
              ? "Add Past Advance"
              : "Give Advance"}
        </h2>

        {isPast && (
          <p className="mt-1 text-sm text-amber-600">
            This advance will be recorded as a historical advance.
          </p>
        )}
      </div>

      {/* Employee */}
      <div className="flex flex-col">
        <label className="mb-1 font-medium text-gray-700">Employee</label>

        <select
          name="employee_id"
          value={form.employee_id}
          onChange={handleChange}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          required
        >
          <option value="">Select Employee</option>

          {Employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.first_name} {emp.last_name}
            </option>
          ))}
        </select>
      </div>

      {/* Amount */}
      <div className="flex flex-col">
        <label className="mb-1 font-medium text-gray-700">Amount</label>

        <input
          type="number"
          name="amount"
          value={form.amount}
          onChange={handleChange}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Enter amount"
          required
        />
      </div>

      {/* Description */}
      <div className="flex flex-col">
        <label className="mb-1 font-medium text-gray-700">Description</label>

        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Optional description"
        />
      </div>

      {/* HISTORICAL DATE */}
      {isPast && (
        <>
          <div className="flex flex-col">
            <label className="mb-1 font-medium text-gray-700">
              Advance Date
            </label>

            <input
              type="date"
              name="advance_date"
              value={form.advance_date}
              onChange={handleChange}
              className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>

          <div className="flex flex-col">
            <label className="mb-1 font-medium text-gray-700">
              Advance Time
            </label>

            <input
              type="time"
              name="advance_time"
              value={form.advance_time}
              onChange={handleChange}
              className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>
        </>
      )}

      <button
        className="mt-4 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded w-full"
        type="submit"
      >
        {form.id
          ? "Update Advance"
          : isPast
            ? "Save Past Advance"
            : "Add Advance"}
      </button>
    </form>
  );
}
