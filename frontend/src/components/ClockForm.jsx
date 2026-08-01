import { useEffect, useMemo, useState } from "react";

export default function ClockForm({
  onSubmit,
  onClose,
  employees = [],
  activeClockings = [],
}) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [clockInId, setClockInId] = useState("");
  const [clockOutId, setClockOutId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const activeIds = useMemo(
    () => new Set(activeClockings.map((item) => Number(item.employee_id))),
    [activeClockings],
  );
  const eligible = employees.filter(
    (employee) =>
      ["employee", "manager", "cashier"].includes(employee.role) &&
      employee.status !== "inactive",
  );
  const availableToClockIn = eligible.filter(
    (employee) => !activeIds.has(Number(employee.id)),
  );
  const submit = async (type, employeeId) => {
    if (!employeeId) {
      setError("Choose an employee first.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await onSubmit(type, { employee_id: employeeId });
      setMessage(result?.message || "Clocking saved successfully.");
      setClockInId("");
      setClockOutId("");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to save clocking.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-6 max-h-[80vh] overflow-y-auto p-4">
      <div className="rounded-xl bg-slate-900 p-4 text-center text-2xl font-bold text-white">
        {currentTime.toLocaleTimeString("en-UG")}
      </div>
      <div>
        <h2 className="text-xl font-bold">Employee Clocking</h2>
        <p className="mt-1 text-sm text-slate-600">
          Clock in available staff or clock out staff who are currently active.
        </p>
      </div>
      {message && (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <section className="rounded-xl border border-green-200 bg-green-50 p-4">
        <h3 className="font-semibold text-green-900">Clock in</h3>
        <select
          value={clockInId}
          onChange={(event) => setClockInId(event.target.value)}
          className="mt-3 w-full rounded-lg border bg-white px-3 py-2"
        >
          <option value="">Select staff member</option>
          {availableToClockIn.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.first_name} {employee.last_name} — {employee.role}
            </option>
          ))}
        </select>
        <button
          disabled={saving}
          onClick={() => void submit("clockin", clockInId)}
          className="mt-3 rounded-lg bg-green-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Clock In"}
        </button>
      </section>
      <section className="rounded-xl border border-red-200 bg-red-50 p-4">
        <h3 className="font-semibold text-red-900">
          Currently clocked in ({activeClockings.length})
        </h3>
        {activeClockings.length ? (
          <>
            <ul className="mt-3 space-y-2 text-sm">
              {activeClockings.map((item) => (
                <li key={item.id} className="rounded-lg bg-white p-2">
                  {item.first_name} {item.last_name} — since{" "}
                  {item.clock_in_time}
                </li>
              ))}
            </ul>
            <select
              value={clockOutId}
              onChange={(event) => setClockOutId(event.target.value)}
              className="mt-3 w-full rounded-lg border bg-white px-3 py-2"
            >
              <option value="">Select clocked-in staff member</option>
              {activeClockings.map((item) => (
                <option key={item.employee_id} value={item.employee_id}>
                  {item.first_name} {item.last_name}
                </option>
              ))}
            </select>
            <button
              disabled={saving}
              onClick={() => void submit("clockout", clockOutId)}
              className="mt-3 rounded-lg bg-red-600 px-4 py-2 font-medium text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Clock Out"}
            </button>
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            Nobody is currently clocked in.
          </p>
        )}
      </section>
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg border px-4 py-2"
      >
        Close
      </button>
    </div>
  );
}
