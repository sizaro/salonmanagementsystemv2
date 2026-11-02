import { useEffect, useState } from "react";
import PaymentSheet from "./payments/PaymentSheet.jsx";

export default function ExpenseForm({ onSubmit, onClose, expenseData, entryType = "current" }) {
  const isPast = (expenseData?.entry_type || entryType) === "past";
  const [form, setForm] = useState({
    id: "",
    name: "",
    amount: "",
    description: "",
    expense_date: "",
    expense_time: "",
    backdate_reason: "",
    payment_method: "CASH",
  });
  const [paymentRequest, setPaymentRequest] = useState(null);
  useEffect(() => {
    if (expenseData)
      setForm({
        id: expenseData.id || "",
        name: expenseData.name || "",
        amount: expenseData.amount || "",
        description: expenseData.description || "",
        expense_date: expenseData.expense_date || "",
        expense_time: String(expenseData.expense_time || "").slice(0, 5),
        backdate_reason: expenseData.backdate_reason || "",
        payment_method: expenseData.payment_method || "CASH",
      });
  }, [expenseData]);
  const change = (e) => setForm((value) => ({ ...value, [e.target.name]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      id: form.id || undefined,
      name: form.name.trim(),
      amount: Number(form.amount),
      description: form.description.trim(),
      entry_type: isPast ? "past" : "current",
      payment_method: form.payment_method,
    };
    if (isPast)
      Object.assign(payload, {
        expense_date: form.expense_date,
        expense_time: form.expense_time,
        backdate_reason: form.backdate_reason.trim(),
      });
    if (!form.id && !isPast && ["MTN_MOMO", "AIRTEL_MONEY", "BANK_TRANSFER"].includes(form.payment_method)) {
      setPaymentRequest({
        endpoint: "/payments/disbursements",
        direction: "DISBURSEMENT",
        label: "The expense will be recorded after the authorised payout is confirmed.",
        amount: payload.amount,
        payload: { payment_method: form.payment_method, origin_type: "EXPENSE", expense: payload },
      });
      return;
    }
    await onSubmit(payload);
    onClose?.();
  };
  return (
    <>
    <form onSubmit={submit} className="mx-auto max-w-md space-y-4 rounded bg-white p-4 shadow-md">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">
          {form.id ? "Edit Expense" : isPast ? "Add Past Expense" : "Add Expense"}
        </h2>
        {isPast && (
          <p className="mt-1 text-sm text-amber-600">
            This is a historical expense. Its original date/time and reason are required.
          </p>
        )}
      </div>
      <div className="flex flex-col">
        <label className="mb-1 font-medium text-gray-700">Expense Name</label>
        <input
          required
          type="text"
          name="name"
          value={form.name}
          onChange={change}
          className="rounded border border-gray-300 px-3 py-2"
        />
      </div>
      {!isPast && !form.id && (
        <div className="flex flex-col">
          <label className="mb-1 font-medium text-gray-700">Disbursement method</label>
          <select name="payment_method" value={form.payment_method} onChange={change} className="rounded border border-gray-300 px-3 py-2">
            <option value="CASH">Cash at Counter</option>
          </select>
        </div>
      )}
      <div className="flex flex-col">
        <label className="mb-1 font-medium text-gray-700">Amount</label>
        <input
          required
          min="0"
          type="number"
          name="amount"
          value={form.amount}
          onChange={change}
          className="rounded border border-gray-300 px-3 py-2"
        />
      </div>
      <div className="flex flex-col">
        <label className="mb-1 font-medium text-gray-700">Description</label>
        <textarea
          name="description"
          value={form.description}
          onChange={change}
          className="rounded border border-gray-300 px-3 py-2"
        />
      </div>
      {isPast && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <label className="mb-1 font-medium text-gray-700">Expense Date</label>
              <input
                required
                type="date"
                name="expense_date"
                value={form.expense_date}
                onChange={change}
                className="rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div className="flex flex-col">
              <label className="mb-1 font-medium text-gray-700">Expense Time</label>
              <input
                required
                type="time"
                name="expense_time"
                value={form.expense_time}
                onChange={change}
                className="rounded border border-gray-300 px-3 py-2"
              />
            </div>
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-medium text-gray-700">
              Why is this being recorded late?
            </label>
            <textarea
              required
              name="backdate_reason"
              value={form.backdate_reason}
              onChange={change}
              className="rounded border border-gray-300 px-3 py-2"
            />
          </div>
        </>
      )}
      <button
        type="submit"
        className="mt-4 w-full rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
      >
        {form.id ? "Update Expense" : isPast ? "Save Past Expense" : "Add Expense"}
      </button>
    </form>
    <PaymentSheet
      paymentRequest={paymentRequest}
      onClose={() => setPaymentRequest(null)}
      onCompleted={() => { setPaymentRequest(null); window.dispatchEvent(new Event("salehish:external-payment-posted")); onClose?.(); }}
    />
    </>
  );
}
