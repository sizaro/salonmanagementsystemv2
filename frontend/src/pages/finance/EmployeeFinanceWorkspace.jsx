import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useSearchParams } from "react-router-dom";
import Modal from "../../components/Modal.jsx";
import { useData } from "../../context/DataContext.jsx";
import SignatureDialog from "../../components/finance/SignatureDialog.jsx";
import FinanceReceiptDialog from "../../components/finance/FinanceReceiptDialog.jsx";

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
  const { user, users, financeUpdateVersion } = useData();
  const [searchParams, setSearchParams] = useSearchParams();
  const isStaff = STAFF_ROLES.has(String(user?.role || "").toLowerCase());
  const canReviewRequests = ["owner", "manager"].includes(String(user?.role || "").toLowerCase());
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
  const [financeEmployees, setFinanceEmployees] = useState([]);
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
  const [signatureTarget, setSignatureTarget] = useState(null);
  const [signatureEmployeeOverview, setSignatureEmployeeOverview] = useState(null);
  const [signatureEmployeeLoading, setSignatureEmployeeLoading] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState(null);

  const employees = useMemo(
    () => isStaff
      ? financeEmployees
      : (users || []).filter((person) => ["employee", "manager", "cashier"].includes(String(person.role || "").toLowerCase())),
    [financeEmployees, isStaff, users],
  );

  const load = useCallback(async () => {
    if (!user?.id) return;
    if (!hasLoaded) setLoading(true);
    else setRefreshing(true);
    setError("");
    try {
      const [overviewResponse, requestsResponse, paymentsResponse, receiptsResponse, employeesResponse] = await Promise.all([
        axios.get(
          isStaff
            ? `${API_URL}/employee-finance/summary`
            : `${API_URL}/employee-finance/me/overview`,
          { withCredentials: true },
        ),
        axios.get(`${API_URL}/employee-finance/advance-requests`, { withCredentials: true }),
        axios.get(`${API_URL}/employee-finance/payments`, { withCredentials: true }),
        axios.get(`${API_URL}/employee-finance/receipts`, { withCredentials: true }),
        isStaff
          ? axios.get(`${API_URL}/employee-finance/employees`, { withCredentials: true })
          : Promise.resolve({ data: { employees: [] } }),
      ]);
      setOverview(overviewResponse.data.summary || overviewResponse.data.overview || null);
      setRequests(requestsResponse.data.requests || []);
      setPayments(paymentsResponse.data.payments || []);
      setReceipts(receiptsResponse.data.receipts || []);
      setFinanceEmployees(employeesResponse.data.employees || []);
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
    if (!financeUpdateVersion) return;
    void load();
  }, [financeUpdateVersion, load]);

  useEffect(() => {
    const action = searchParams.get("action");
    const tab = searchParams.get("tab");
    if (["advances", "payments", "receipts"].includes(tab)) {
      setActiveTab(tab);
    }
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

  useEffect(() => {
    const employeeId = Number(signatureTarget?.row?.employee_id);
    if (signatureTarget?.action !== "APPROVAL" || !canReviewRequests || !employeeId) {
      setSignatureEmployeeOverview(null);
      return undefined;
    }

    let active = true;
    setSignatureEmployeeLoading(true);
    axios.get(`${API_URL}/employee-finance/employees/${employeeId}/overview`, {
      withCredentials: true,
    })
      .then(({ data }) => {
        if (active) setSignatureEmployeeOverview(data.overview || null);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.error || "Unable to load the employee finance snapshot for review.");
      })
      .finally(() => {
        if (active) setSignatureEmployeeLoading(false);
      });

    return () => { active = false; };
  }, [canReviewRequests, signatureTarget?.action, signatureTarget?.row?.employee_id]);

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
    }, settlementForm.settlement_method === "PAYROLL_DEDUCTION"
      ? "Payroll deduction sent to the employee for consent. Earnings are unchanged until they sign."
      : "Advance settlement recorded.");
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

  const requestApprovalSignature = (kind, row) => setSignatureTarget({ kind, row, action: "APPROVAL" });
  const requestAcknowledgementSignature = (kind, row) => setSignatureTarget({ kind, row, action: "ACKNOWLEDGEMENT" });
  const requestPayrollDeductionConsent = (row, settlement) => setSignatureTarget({
    kind: "advance-requests",
    row,
    settlement,
    action: "PAYROLL_DEDUCTION_CONSENT",
  });
  const signReceipt = async (signatureDataUrl) => {
    if (!signatureTarget) return;
    const { kind, row, settlement, action } = signatureTarget;
    const endpoint = action === "PAYROLL_DEDUCTION_CONSENT"
      ? `${API_URL}/employee-finance/advance-requests/${row.id}/settlements/${settlement.id}/acknowledge`
      : action === "APPROVAL"
        ? `${API_URL}/employee-finance/${kind}/${row.id}/decision`
        : `${API_URL}/employee-finance/${kind}/${row.id}/acknowledge`;
    const payload = action === "APPROVAL"
      ? { approved: true, signature_data_url: signatureDataUrl }
      : { signature_data_url: signatureDataUrl };
    await run(
      () => axios.post(endpoint, payload, { withCredentials: true }),
      action === "PAYROLL_DEDUCTION_CONSENT"
        ? "Payroll deduction approved. Your available earnings and advance balance have been updated."
        : action === "APPROVAL" ? "Request approved and management signature saved." : "Receipt acknowledgement and signature saved.",
    );
    setSignatureTarget(null);
  };

  return (
    <div className="finance-workspace mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="rounded-3xl bg-gradient-to-br from-[var(--salehish-plum)] to-[var(--salehish-magenta)] p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-200">Employee finance</p>
            <h1 className="mt-1 text-2xl font-semibold">{isStaff ? "Earnings, payments and advance control" : "My earnings and finance records"}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Completed-service earnings, staff payments and advances are recorded separately. An advance does not silently reduce an employee’s earned balance.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setActiveForm("advance")} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-[var(--salehish-ink)] hover:bg-emerald-300">{isStaff ? "Create advance request" : "Request an advance"}</button>
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
            {paymentForm.employee_id && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:col-span-2"><p className="text-sm font-medium text-emerald-800">Available to pay now</p><p className="mt-1 text-2xl font-bold text-emerald-950">{selectedEmployeeLoading ? "Loading…" : money(selectedEmployeeOverview?.unpaid_amount)}</p><p className="mt-1 text-xs text-emerald-800">Recorded earnings: {money(selectedEmployeeOverview?.earned_amount)} · Already paid: {money(selectedEmployeeOverview?.paid_amount)} · Advance deductions: {money(selectedEmployeeOverview?.payroll_deductions)}</p>{Number(selectedEmployeeOverview?.advances_outstanding || 0) > 0 && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p className="font-semibold">Outstanding employee advances: {money(selectedEmployeeOverview.advances_outstanding)}</p><p className="mt-1 text-xs">Advances are not deducted silently. Record a payroll deduction, cash repayment, or owner waiver before paying the remaining earnings.</p><button type="button" onClick={() => { closeForm(); setActiveTab("advances"); }} className="mt-2 text-xs font-bold text-amber-900 underline">Review outstanding advances</button></div>}</div>}
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

        {activeTab === "advances" && <WorkflowTable title="Advance requests" empty="No advance requests yet." rows={requests} employees={employees} loading={loading} columns={["Employee", "Amount", "Reason", "Status", "Requested", "Actions"]} render={(request) => <tr key={request.id} className="border-t border-slate-100">
          <td className="px-4 py-3 font-medium text-slate-800">{employeeProfilePath(request.employee_id) ? <Link className="hover:text-blue-700 hover:underline" to={employeeProfilePath(request.employee_id)}>{request.employee_name || "You"}</Link> : (request.employee_name || "You")}</td><td className="px-4 py-3"><p>{money(request.requested_amount)}</p>{["DISBURSED", "ACKNOWLEDGED"].includes(String(request.workflow_status || "").toUpperCase()) && <p className="mt-1 text-xs text-slate-500">Outstanding: {money(request.outstanding_amount)}</p>}</td><td className="px-4 py-3 text-slate-600">{request.reason || "—"}</td><td className="px-4 py-3"><Status value={request.workflow_status} /></td><td className="px-4 py-3 text-xs text-slate-600">{formatRecordDate(request.created_at)}</td><td className="px-4 py-3"><Actions row={request} kind="advance-requests" isStaff={isStaff} canReview={canReviewRequests && Number(request.employee_id) !== Number(user?.id) && !(String(request.employee_role || "").toLowerCase() === "manager" && !isOwner)} canSettleAdvances={canSettleAdvances} canEmployeeAcknowledge={Number(request.employee_id) === Number(user?.id)} canEmployeeConsent={Number(request.employee_id) === Number(user?.id)} busy={busy} decide={decide} disburse={disburse} acknowledge={acknowledge} requestApprovalSignature={requestApprovalSignature} requestAcknowledgementSignature={requestAcknowledgementSignature} requestPayrollDeductionConsent={requestPayrollDeductionConsent} openSettlement={openSettlement} /></td>
        </tr>} />}

        {activeTab === "payments" && <WorkflowTable title="Employee payments" empty="No payments prepared yet." rows={payments} employees={employees} loading={loading} columns={["Employee", "Amount", "Method", "Status", "Prepared", "Actions"]} render={(payment) => <tr key={payment.id} className="border-t border-slate-100">
          <td className="px-4 py-3 font-medium text-slate-800">{employeeProfilePath(payment.employee_id) ? <Link className="hover:text-blue-700 hover:underline" to={employeeProfilePath(payment.employee_id)}>{payment.employee_name || "You"}</Link> : (payment.employee_name || "You")}</td><td className="px-4 py-3">{money(payment.requested_amount)}</td><td className="px-4 py-3">{displayStatus(payment.payment_method)}</td><td className="px-4 py-3"><Status value={payment.workflow_status} /></td><td className="px-4 py-3 text-xs text-slate-600">{formatRecordDate(payment.created_at)}</td><td className="px-4 py-3"><Actions row={payment} kind="payments" isStaff={isStaff} canReview={canReviewRequests && Number(payment.employee_id) !== Number(user?.id)} canEmployeeAcknowledge={Number(payment.employee_id) === Number(user?.id)} busy={busy} decide={decide} disburse={disburse} acknowledge={acknowledge} requestApprovalSignature={requestApprovalSignature} requestAcknowledgementSignature={requestAcknowledgementSignature} /></td>
        </tr>} />}

        {activeTab === "receipts" && <ReceiptList receipts={receipts} employees={employees} loading={loading} onView={setSelectedReceiptId} />}
      </section>
      <SignatureDialog
        open={Boolean(signatureTarget)}
        busy={busy}
        signerName={`${user?.first_name || ""} ${user?.last_name || ""}`.trim()}
        title={signatureTarget?.action === "APPROVAL" ? "Sign management approval" : signatureTarget?.action === "PAYROLL_DEDUCTION_CONSENT" ? "Approve payroll deduction" : "Sign receipt acknowledgement"}
        declaration={signatureTarget?.action === "APPROVAL" ? `By signing, you approve this ${signatureTarget?.kind === "payments" ? "employee payment" : "employee advance"} for ${money(signatureTarget?.row?.requested_amount)}.` : signatureTarget?.action === "PAYROLL_DEDUCTION_CONSENT" ? `By signing, you agree that ${money(signatureTarget?.settlement?.amount)} will be deducted from your earned salary to settle advance ${signatureTarget?.settlement?.receipt_number}.` : `By signing, you confirm that you received ${money(signatureTarget?.row?.requested_amount)} under this ${signatureTarget?.kind === "payments" ? "employee payment" : "employee advance"}.`}
        reviewSummary={signatureTarget?.action === "APPROVAL" ? signatureEmployeeOverview : null}
        reviewSummaryLoading={signatureTarget?.action === "APPROVAL" && signatureEmployeeLoading}
        reviewSummaryRequired={signatureTarget?.action === "APPROVAL"}
        onClose={() => setSignatureTarget(null)}
        onConfirm={signReceipt}
      />
      <FinanceReceiptDialog receiptId={selectedReceiptId} onClose={() => setSelectedReceiptId(null)} />
    </div>
  );
}

function Status({ value }) { return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(value)}`}>{displayStatus(value)}</span>; }

function Actions({ row, kind, isStaff, canReview, canSettleAdvances, canEmployeeAcknowledge, canEmployeeConsent, busy, decide, disburse, requestApprovalSignature, requestAcknowledgementSignature, requestPayrollDeductionConsent, openSettlement }) {
  const status = String(row.workflow_status || "").toUpperCase();
  return <div className="flex flex-wrap gap-2">
    {canReview && status === "REQUESTED" && <><button disabled={busy} onClick={() => requestApprovalSignature(kind, row)} className="rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white">Approve & sign</button><button disabled={busy} onClick={() => decide(kind, row.id, false)} className="rounded-lg bg-rose-700 px-2.5 py-1.5 text-xs font-semibold text-white">Reject</button></>}
    {isStaff && status === "APPROVED" && <button disabled={busy} onClick={() => disburse(kind, row.id)} className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white">Disburse</button>}
    {kind === "advance-requests" && canSettleAdvances && ["DISBURSED", "ACKNOWLEDGED"].includes(status) && Number(row.outstanding_amount || 0) > 0 && <button disabled={busy} onClick={() => openSettlement(row)} className="rounded-lg bg-[var(--salehish-burgundy)] px-2.5 py-1.5 text-xs font-semibold text-white">Settle</button>}
    {canEmployeeAcknowledge && status === "DISBURSED" && <button disabled={busy} onClick={() => requestAcknowledgementSignature(kind, row)} className="rounded-lg bg-[var(--salehish-burgundy)] px-2.5 py-1.5 text-xs font-semibold text-white">Acknowledge & sign</button>}
    {canEmployeeConsent && (row.pending_payroll_deductions || []).map((settlement) => <button key={settlement.id} disabled={busy} onClick={() => requestPayrollDeductionConsent(row, settlement)} className="rounded-lg bg-amber-700 px-2.5 py-1.5 text-xs font-semibold text-white">Approve salary deduction {money(settlement.amount)}</button>)}
    {isStaff && status === "DISBURSED" && <span className="text-xs text-slate-500">Awaiting employee acknowledgement</span>}
    {row.receipt_number && <span className="self-center font-mono text-[11px] text-slate-500">{row.receipt_number}</span>}
  </div>;
}

function formatRecordDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-UG", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function WorkflowTable({ title, empty, rows, employees, columns, loading, render }) {
  const [status, setStatus] = useState("ALL");
  const [employeeId, setEmployeeId] = useState("ALL");
  const [period, setPeriod] = useState("ALL");
  const statuses = useMemo(() => Array.from(new Set(rows.map((row) => String(row.workflow_status || "").toUpperCase()).filter(Boolean))).sort(), [rows]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    if (status !== "ALL" && String(row.workflow_status || "").toUpperCase() !== status) return false;
    if (employeeId !== "ALL" && Number(row.employee_id) !== Number(employeeId)) return false;
    if (period === "ALL") return true;
    const date = new Date(row.created_at);
    const now = new Date();
    if (Number.isNaN(date.getTime())) return false;
    if (period === "TODAY") return date.toDateString() === now.toDateString();
    if (period === "MONTH") return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    return period !== "YEAR" || date.getFullYear() === now.getFullYear();
  }), [employeeId, period, rows, status]);

  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><div className="flex flex-wrap items-end justify-between gap-3"><h2 className="font-semibold text-slate-900">{title}</h2><p className="text-sm text-slate-500">Showing {filteredRows.length} of {rows.length}</p></div><div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-sm font-medium text-slate-700">Status<select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="ALL">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{displayStatus(item)}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Employee<select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="ALL">All employees</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name}</option>)}</select></label><label className="text-sm font-medium text-slate-700">When<select value={period} onChange={(event) => setPeriod(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="ALL">All time</option><option value="TODAY">Today</option><option value="MONTH">This month</option><option value="YEAR">This year</option></select></label></div></div><div className="overflow-x-auto"><table className="min-w-[860px] w-full text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr>{columns.map((column) => <th key={column} className="px-4 py-3 font-semibold">{column}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">Loading…</td></tr> : filteredRows.length ? filteredRows.map(render) : <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">{rows.length ? "No records match these filters." : empty}</td></tr>}</tbody></table></div></section>;
}

function ReceiptList({ receipts, employees, loading, onView }) {
  const [type, setType] = useState("ALL");
  const [signature, setSignature] = useState("ALL");
  const [employeeId, setEmployeeId] = useState("ALL");
  const [period, setPeriod] = useState("ALL");
  const filteredReceipts = useMemo(() => receipts.filter((receipt) => {
    if (type !== "ALL" && String(receipt.receipt_type || "").toUpperCase() !== type) return false;
    if (employeeId !== "ALL" && Number(receipt.employee_id) !== Number(employeeId)) return false;
    if (signature === "SIGNED" && !(receipt.has_management_signature && receipt.has_employee_signature)) return false;
    if (signature === "AWAITING_EMPLOYEE" && !(receipt.has_management_signature && !receipt.has_employee_signature)) return false;
    if (signature === "UNSIGNED" && (receipt.has_management_signature || receipt.has_employee_signature)) return false;
    if (period !== "ALL") {
      const issued = new Date(receipt.issued_at);
      const now = new Date();
      if (Number.isNaN(issued.getTime())) return false;
      if (period === "TODAY" && issued.toDateString() !== now.toDateString()) return false;
      if (period === "MONTH" && (issued.getMonth() !== now.getMonth() || issued.getFullYear() !== now.getFullYear())) return false;
      if (period === "YEAR" && issued.getFullYear() !== now.getFullYear()) return false;
    }
    return true;
  }), [employeeId, period, receipts, signature, type]);
  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading receipts…</div>;
  if (!receipts.length) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Receipts appear after a payment or advance is disbursed.</div>;
  return <section className="space-y-4"><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-end gap-3"><label className="text-sm font-medium text-slate-700">Type<select value={type} onChange={(event) => setType(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="ALL">All receipt types</option><option value="ADVANCE">Advances</option><option value="PAYMENT">Payments</option><option value="ADVANCE_SETTLEMENT">Advance settlements</option></select></label><label className="text-sm font-medium text-slate-700">Signature status<select value={signature} onChange={(event) => setSignature(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="ALL">All records</option><option value="SIGNED">Both signed</option><option value="AWAITING_EMPLOYEE">Awaiting employee</option><option value="UNSIGNED">No signatures</option></select></label><label className="text-sm font-medium text-slate-700">Employee<select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="ALL">All employees</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Period<select value={period} onChange={(event) => setPeriod(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="ALL">All time</option><option value="TODAY">Today</option><option value="MONTH">This month</option><option value="YEAR">This year</option></select></label><p className="pb-2 text-sm text-slate-500">Showing {filteredReceipts.length} of {receipts.length}</p></div></div>{filteredReceipts.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredReceipts.map((receipt) => {
    const typeName = String(receipt.receipt_type || "").toUpperCase();
    const supported = ["ADVANCE", "PAYMENT"].includes(typeName);
    const settlement = typeName === "ADVANCE_SETTLEMENT";
    const receiptState = settlement ? "Settlement ledger entry" : receipt.finalized_at ? "Signed receipt ready" : receipt.acknowledged_at ? "Legacy acknowledgement — no signature PDF" : "Awaiting employee signature";
    return <article key={`${receipt.receipt_type}-${receipt.id}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs text-slate-500">{receipt.receipt_number}</p><h2 className="mt-1 font-semibold text-[var(--salehish-ink)]">{displayStatus(receipt.receipt_type)}</h2></div><p className="text-lg font-bold text-slate-900">{money(receipt.amount)}</p></div><p className="mt-4 text-sm font-medium text-slate-800">{receipt.employee_name || "You"}</p><p className="mt-1 text-xs text-slate-500">{receiptState}</p><div className="mt-4 flex items-center justify-between gap-3"><div className="flex gap-1.5 text-[11px] font-semibold">{settlement ? <span className="rounded-full bg-indigo-100 px-2 py-1 text-[var(--salehish-burgundy)]">Settlement recorded</span> : <><span className={`rounded-full px-2 py-1 ${receipt.has_management_signature ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>Management {receipt.has_management_signature ? "signed" : "unsigned"}</span><span className={`rounded-full px-2 py-1 ${receipt.has_employee_signature ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>Employee {receipt.has_employee_signature ? "signed" : "unsigned"}</span></>}</div>{supported && <button type="button" onClick={() => onView(receipt.id)} className="text-sm font-semibold text-blue-700 hover:underline">View receipt</button>}</div></article>;
  })}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No receipts match these filters.</div>}</section>;
}
