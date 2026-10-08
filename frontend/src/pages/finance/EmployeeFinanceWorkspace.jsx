import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useSearchParams } from "react-router-dom";
import Modal from "../../components/Modal.jsx";
import { useData } from "../../context/DataContext.jsx";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const STAFF_ROLES = new Set(["owner", "manager", "cashier"]);
const money = (value) => `UGX ${Number(value || 0).toLocaleString()}`;
const displayStatus = (value) => String(value || "").replaceAll("_", " ");
const statusClass = (value) => {
  const normalized = String(value || "").toUpperCase();
  if (["ACKNOWLEDGED", "DISBURSED", "APPROVED"].includes(normalized)) return "bg-emerald-100 text-emerald-800";
  if (["REJECTED", "CANCELLED", "VOIDED"].includes(normalized)) return "bg-rose-100 text-rose-800";
  return "bg-amber-100 text-amber-800";
};

export default function EmployeeFinanceWorkspace() {
  const { user, users } = useData();
  const [searchParams, setSearchParams] = useSearchParams();
  const isStaff = STAFF_ROLES.has(String(user?.role || "").toLowerCase());
  const canSettleAdvances = ["owner", "manager"].includes(String(user?.role || "").toLowerCase());
  const isOwner = String(user?.role || "").toLowerCase() === "owner";
  const employeeProfilePath = (employeeId) => {
    const currentRole = String(user?.role || "").toLowerCase();
    if (currentRole === "employee") return "/employee/profile";
    if (!employeeId) return null;
    if (currentRole === "manager") return `/manager/employees/${employeeId}`;
    if (currentRole === "cashier") return `/cashier/employees/${employeeId}`;
    return `/owner/employees/${employeeId}`;
  };
  const [overview, setOverview] = useState(null);
  const [requests, setRequests] = useState([]);
  const [payments, setPayments] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [advanceForm, setAdvanceForm] = useState({ employee_id: "", amount: "", reason: "" });
  const [paymentForm, setPaymentForm] = useState({ employee_id: "", amount: "", payment_method: "CASH", payment_reference: "", notes: "" });
  const [activeForm, setActiveForm] = useState(null);
  const [activeTab, setActiveTab] = useState("advances");
  const [selectedEmployeeOverview, setSelectedEmployeeOverview] = useState(null);
  const [selectedEmployeeLoading, setSelectedEmployeeLoading] = useState(false);
  const [settlementTarget, setSettlementTarget] = useState(null);
  const [settlementForm, setSettlementForm] = useState({ amount: "", settlement_method: "PAYROLL_DEDUCTION", notes: "" });

  const employees = useMemo(
    () => (users || []).filter((person) => ["employee", "manager", "cashier"].includes(String(person.role || "").toLowerCase())),
    [users],
  );

  const load = useCallback(async () => {
    if (!user?.id) return;
    if (!hasLoaded) setLoading(true);
    else setRefreshing(true);
    setError("");
    try {
      const [overviewResponse, requestsResponse, paymentsResponse, receiptsResponse, periodsResponse] = await Promise.all([
        axios.get(
          isStaff
            ? `${API_URL}/employee-finance/summary`
            : `${API_URL}/employee-finance/me/overview`,
          { withCredentials: true },
        ),
        axios.get(`${API_URL}/employee-finance/advance-requests`, { withCredentials: true }),
        axios.get(`${API_URL}/employee-finance/payments`, { withCredentials: true }),
        axios.get(`${API_URL}/employee-finance/receipts`, { withCredentials: true }),
      ]);
      setOverview(overviewResponse.data.summary || overviewResponse.data.overview || null);
      setRequests(requestsResponse.data.requests || []);
      setPayments(paymentsResponse.data.payments || []);
      setReceipts(receiptsResponse.data.receipts || []);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Unable to load employee finance information.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setHasLoaded(true);
    }
  }, [hasLoaded, isStaff, user?.id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const action = searchParams.get("action");
    if (["advance", "payment"].includes(action)) {
      setActiveForm(action);
    }
  }, [searchParams]);

  useEffect(() => {
    const employeeId = Number(paymentForm.employee_id);
    if (!isStaff || !employeeId) {
      setSelectedEmployeeOverview(null);
      return undefined;
    }
    let active = true;
    setSelectedEmployeeLoading(true);
    axios.get(`${API_URL}/employee-finance/employees/${employeeId}/overview`, {
      withCredentials: true,
    })
      .then(({ data }) => { if (active) setSelectedEmployeeOverview(data.overview || null); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.error || "Unable to load this employee's available earnings."); })
      .finally(() => { if (active) setSelectedEmployeeLoading(false); });
    return () => { active = false; };
  }, [isStaff, paymentForm.employee_id]);

  const closeForm = () => {
    setActiveForm(null);
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    setSearchParams(next, { replace: true });
  };

  const run = async (work, success) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      setNotice(success);
      closeForm();
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.error || "That finance action could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  const submitAdvance = (event) => {
    event.preventDefault();
    run(async () => {
      await axios.post(`${API_URL}/employee-finance/advance-requests`, {
        ...advanceForm,
        employee_id: isStaff ? Number(advanceForm.employee_id) : undefined,
        amount: Number(advanceForm.amount),
      }, { withCredentials: true });
      setAdvanceForm({ employee_id: "", amount: "", reason: "" });
    }, "Advance request submitted.");
  };

  const submitPayment = (event) => {
    event.preventDefault();
    run(async () => {
      await axios.post(`${API_URL}/employee-finance/payments`, {
        ...paymentForm,
        employee_id: Number(paymentForm.employee_id),
        amount: Number(paymentForm.amount),
      }, { withCredentials: true });
      setPaymentForm({ employee_id: "", amount: "", payment_method: "CASH", payment_reference: "", notes: "" });
    }, "Payment prepared for review.");
  };

  const openSettlement = (request) => {
    setSettlementTarget(request);
    setSettlementForm({
      amount: String(request.outstanding_amount || ""),
      settlement_method: "PAYROLL_DEDUCTION",
      notes: "",
    });
  };

  const submitSettlement = (event) => {
    event.preventDefault();
    if (!settlementTarget) return;
    run(async () => {
      await axios.post(`${API_URL}/employee-finance/advance-requests/${settlementTarget.id}/settlements`, {
        amount: Number(settlementForm.amount),
        settlement_method: settlementForm.settlement_method,
        notes: settlementForm.notes,
      }, { withCredentials: true });
      setSettlementTarget(null);
      setSettlementForm({ amount: "", settlement_method: "PAYROLL_DEDUCTION", notes: "" });
    }, "Advance settlement recorded.");
  };

  const decide = (kind, id, approved) => {
    const rejection_reason = approved ? undefined : window.prompt("State the reason for rejecting this request:");
    if (!approved && !rejection_reason?.trim()) return;
    run(
      () => axios.post(`${API_URL}/employee-finance/${kind}/${id}/decision`, { approved, rejection_reason }, { withCredentials: true }),
      approved ? "Request approved." : "Request rejected.",
    );
  };

  const disburse = (kind, id) => run(
    () => axios.post(`${API_URL}/employee-finance/${kind}/${id}/disburse`, {}, { withCredentials: true }),
    "Disbursement recorded and receipt issued.",
  );

  const acknowledge = (kind, id) => run(
    () => axios.post(`${API_URL}/employee-finance/${kind}/${id}/acknowledge`, {}, { withCredentials: true }),
    "Receipt acknowledged.",
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="rounded-3xl bg-slate-900 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-200">Employee finance</p>
            <h1 className="mt-1 text-2xl font-semibold">{isStaff ? "Earnings, payments and advance control" : "My earnings and finance records"}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Completed-service earnings, staff payments and advances are recorded separately. An advance does not silently reduce an employee’s earned balance.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setActiveForm("advance")} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-300">{isStaff ? "Create advance request" : "Request an advance"}</button>
            {isStaff && <button type="button" onClick={() => setActiveForm("payment")} className="rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20">Prepare employee payment</button>}
          </div>
        </div>
      </header>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
      {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Recorded earnings", money(overview?.earned_amount), "from completed services"],
          ["Paid through this workflow", money(overview?.paid_amount), "disbursed or acknowledged"],
          ["Advance deductions", money(overview?.payroll_deductions), "recovered from earnings"],
          ["Available for payment", money(overview?.unpaid_amount), "before a payment is prepared"],
          ["Earning records", overview?.earning_entries ?? 0, "immutable service snapshots"],
        ].map(([label, value, detail]) => (
          <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{loading ? "…" : value}</p>
            <p className="mt-2 text-xs text-slate-500">{detail}</p>
          </article>
        ))}
      </section>

      {refreshing && <p className="text-right text-xs text-slate-500">Refreshing finance records…</p>}

      {activeForm === "advance" && <Modal isOpen onClose={closeForm} sizeClass="max-w-xl">
        <form onSubmit={submitAdvance} className="space-y-4 p-2">
          <h2 className="text-lg font-semibold text-slate-900">{isStaff ? "Create an advance request" : "Request an advance"}</h2>
          <p className="mt-1 text-sm text-slate-600">A manager or owner must approve the request before it can be disbursed.</p>
          <div className="mt-4 grid gap-3">
            {isStaff && <label className="text-sm font-medium text-slate-700">Employee
              <select required value={advanceForm.employee_id} onChange={(event) => setAdvanceForm((current) => ({ ...current, employee_id: event.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2">
                <option value="">Choose employee</option>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name} · {employee.role}</option>)}
              </select>
            </label>}
            <label className="text-sm font-medium text-slate-700">Amount (UGX)
              <input required min="1" type="number" value={advanceForm.amount} onChange={(event) => setAdvanceForm((current) => ({ ...current, amount: event.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2" />
            </label>
            <label className="text-sm font-medium text-slate-700">Reason
              <textarea value={advanceForm.reason} onChange={(event) => setAdvanceForm((current) => ({ ...current, reason: event.target.value }))} className="mt-1 block min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Optional reason for the request" />
            </label>
            <button disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : "Submit advance request"}</button>
          </div>
        </form>
      </Modal>}

      {activeForm === "payment" && isStaff && <Modal isOpen onClose={closeForm} sizeClass="max-w-xl">
        <form onSubmit={submitPayment} className="space-y-4 p-2">
          <h2 className="text-lg font-semibold text-slate-900">Prepare employee payment</h2>
          <p className="mt-1 text-sm text-slate-600">The amount is checked against recorded earnings. It still requires approval before disbursement.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">Employee
              <select required value={paymentForm.employee_id} onChange={(event) => setPaymentForm((current) => ({ ...current, employee_id: event.target.value, amount: "" }))} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2">
                <option value="">Choose employee</option>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name} · {employee.role}</option>)}
              </select>
            </label>
            {paymentForm.employee_id && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:col-span-2"><p className="text-sm font-medium text-emerald-800">Available to pay now</p><p className="mt-1 text-2xl font-bold text-emerald-950">{selectedEmployeeLoading ? "Loading…" : money(selectedEmployeeOverview?.unpaid_amount)}</p><p className="mt-1 text-xs text-emerald-800">Recorded earnings: {money(selectedEmployeeOverview?.earned_amount)} · Already paid: {money(selectedEmployeeOverview?.paid_amount)} · Advance deductions: {money(selectedEmployeeOverview?.payroll_deductions)}</p></div>}
            <label className="text-sm font-medium text-slate-700">Amount (UGX)
              <input required min="1" max={selectedEmployeeOverview?.unpaid_amount || undefined} type="number" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2" />
              {selectedEmployeeOverview && <span className="mt-1 block text-xs text-slate-500">Maximum available: {money(selectedEmployeeOverview.unpaid_amount)}</span>}
            </label>
            <label className="text-sm font-medium text-slate-700">Payment method
              <select value={paymentForm.payment_method} onChange={(event) => setPaymentForm((current) => ({ ...current, payment_method: event.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2">
                <option value="CASH">Cash</option><option value="MOBILE_MONEY">Mobile money</option><option value="BANK_TRANSFER">Bank transfer</option><option value="OTHER">Other</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">External reference
              <input value={paymentForm.payment_reference} onChange={(event) => setPaymentForm((current) => ({ ...current, payment_reference: event.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Optional" />
            </label>
            <label className="text-sm font-medium text-slate-700">Notes
              <input value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Optional" />
            </label>
            <button disabled={busy} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2">{busy ? "Saving…" : "Prepare payment"}</button>
          </div>
        </form>
      </Modal>}

      {settlementTarget && <Modal isOpen onClose={() => setSettlementTarget(null)} sizeClass="max-w-xl">
        <form onSubmit={submitSettlement} className="space-y-4 p-2">
          <h2 className="text-lg font-semibold text-slate-900">Settle employee advance</h2>
          <p className="text-sm text-slate-600">{settlementTarget.employee_name || "Employee"} still has <strong>{money(settlementTarget.outstanding_amount)}</strong> outstanding from this advance. The original advance remains recorded for audit.</p>
          <div className="grid gap-3">
            <label className="text-sm font-medium text-slate-700">Settlement method
              <select value={settlementForm.settlement_method} onChange={(event) => setSettlementForm((current) => ({ ...current, settlement_method: event.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2">
                <option value="PAYROLL_DEDUCTION">Deduct from available earnings</option>
                <option value="CASH_REPAYMENT">Cash repayment received</option>
                {isOwner && <option value="WAIVED">Waive advance (owner only)</option>}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">Amount (UGX)
              <input required min="1" max={settlementTarget.outstanding_amount} type="number" value={settlementForm.amount} onChange={(event) => setSettlementForm((current) => ({ ...current, amount: event.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2" />
              <span className="mt-1 block text-xs text-slate-500">Maximum outstanding: {money(settlementTarget.outstanding_amount)}</span>
            </label>
            <label className="text-sm font-medium text-slate-700">Notes
              <textarea value={settlementForm.notes} onChange={(event) => setSettlementForm((current) => ({ ...current, notes: event.target.value }))} className="mt-1 block min-h-20 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Optional repayment, deduction, or waiver note" />
            </label>
            <button disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Recording…" : "Record settlement"}</button>
          </div>
        </form>
      </Modal>}

      <section className="space-y-4">
        <div role="tablist" aria-label="Employee finance records" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {[
            ["advances", "Advance requests", requests.length],
            ["payments", "Employee payments", payments.length],
            ["receipts", "Issued receipts", receipts.length],
          ].map(([tab, label, count]) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === tab ? "bg-slate-900 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
            >
              {label} <span className={`ml-1 rounded-full px-1.5 py-0.5 text-xs ${activeTab === tab ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"}`}>{count}</span>
            </button>
          ))}
        </div>

        {activeTab === "advances" && <FinanceTable title="Advance requests" empty="No advance requests yet." rows={requests} loading={loading} columns={["Employee", "Amount", "Reason", "Status", "Actions"]} render={(request) => <tr key={request.id} className="border-t border-slate-100">
          <td className="px-4 py-3 font-medium text-slate-800">{employeeProfilePath(request.employee_id) ? <Link className="hover:text-blue-700 hover:underline" to={employeeProfilePath(request.employee_id)}>{request.employee_name || "You"}</Link> : (request.employee_name || "You")}</td><td className="px-4 py-3"><p>{money(request.requested_amount)}</p>{["DISBURSED", "ACKNOWLEDGED"].includes(String(request.workflow_status || "").toUpperCase()) && <p className="mt-1 text-xs text-slate-500">Outstanding: {money(request.outstanding_amount)}</p>}</td><td className="px-4 py-3 text-slate-600">{request.reason || "—"}</td><td className="px-4 py-3"><Status value={request.workflow_status} /></td><td className="px-4 py-3"><Actions row={request} kind="advance-requests" isStaff={isStaff} canSettleAdvances={canSettleAdvances} busy={busy} decide={decide} disburse={disburse} acknowledge={acknowledge} openSettlement={openSettlement} /></td>
        </tr>} />}

        {activeTab === "payments" && <FinanceTable title="Employee payments" empty="No payments prepared yet." rows={payments} loading={loading} columns={["Employee", "Amount", "Method", "Status", "Actions"]} render={(payment) => <tr key={payment.id} className="border-t border-slate-100">
          <td className="px-4 py-3 font-medium text-slate-800">{employeeProfilePath(payment.employee_id) ? <Link className="hover:text-blue-700 hover:underline" to={employeeProfilePath(payment.employee_id)}>{payment.employee_name || "You"}</Link> : (payment.employee_name || "You")}</td><td className="px-4 py-3">{money(payment.requested_amount)}</td><td className="px-4 py-3">{displayStatus(payment.payment_method)}</td><td className="px-4 py-3"><Status value={payment.workflow_status} /></td><td className="px-4 py-3"><Actions row={payment} kind="payments" isStaff={isStaff} busy={busy} decide={decide} disburse={disburse} acknowledge={acknowledge} /></td>
        </tr>} />}

        {activeTab === "receipts" && <FinanceTable title="Issued receipts" empty="Receipts appear after a payment or advance is disbursed." rows={receipts} loading={loading} columns={["Receipt", "Employee", "Type", "Amount", "Acknowledgement"]} render={(receipt) => <tr key={receipt.id} className="border-t border-slate-100">
          <td className="px-4 py-3 font-mono text-xs text-slate-700">{receipt.receipt_number}</td><td className="px-4 py-3">{receipt.employee_name || "You"}</td><td className="px-4 py-3">{displayStatus(receipt.receipt_type)}</td><td className="px-4 py-3">{money(receipt.amount)}</td><td className="px-4 py-3">{receipt.receipt_type === "ADVANCE_SETTLEMENT" ? "Settlement recorded" : receipt.acknowledged_at ? "Acknowledged" : "Waiting for employee acknowledgement"}</td>
        </tr>} />}
      </section>
    </div>
  );
}

function Status({ value }) { return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(value)}`}>{displayStatus(value)}</span>; }

function Actions({ row, kind, isStaff, canSettleAdvances, busy, decide, disburse, acknowledge, openSettlement }) {
  const status = String(row.workflow_status || "").toUpperCase();
  return <div className="flex flex-wrap gap-2">
    {isStaff && status === "REQUESTED" && <><button disabled={busy} onClick={() => decide(kind, row.id, true)} className="rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white">Approve</button><button disabled={busy} onClick={() => decide(kind, row.id, false)} className="rounded-lg bg-rose-700 px-2.5 py-1.5 text-xs font-semibold text-white">Reject</button></>}
    {isStaff && status === "APPROVED" && <button disabled={busy} onClick={() => disburse(kind, row.id)} className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white">Disburse</button>}
    {kind === "advance-requests" && canSettleAdvances && ["DISBURSED", "ACKNOWLEDGED"].includes(status) && Number(row.outstanding_amount || 0) > 0 && <button disabled={busy} onClick={() => openSettlement(row)} className="rounded-lg bg-indigo-700 px-2.5 py-1.5 text-xs font-semibold text-white">Settle</button>}
    {!isStaff && status === "DISBURSED" && <button disabled={busy} onClick={() => acknowledge(kind, row.id)} className="rounded-lg bg-indigo-700 px-2.5 py-1.5 text-xs font-semibold text-white">Acknowledge</button>}
    {isStaff && status === "DISBURSED" && <span className="text-xs text-slate-500">Awaiting employee acknowledgement</span>}
    {row.receipt_number && <span className="self-center font-mono text-[11px] text-slate-500">{row.receipt_number}</span>}
  </div>;
}

function FinanceTable({ title, empty, rows, columns, loading, render }) {
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">{title}</h2></div><div className="overflow-x-auto"><table className="min-w-[760px] w-full text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr>{columns.map((column) => <th key={column} className="px-4 py-3 font-semibold">{column}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">Loading…</td></tr> : rows.length ? rows.map(render) : <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">{empty}</td></tr>}</tbody></table></div></section>;
}
