import { useEffect, useState } from "react";
import axios from "axios";
import Modal from "../Modal.jsx";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const money = (value) => `UGX ${Number(value || 0).toLocaleString("en-UG")}`;
const time = (value) => value
  ? new Intl.DateTimeFormat("en-UG", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
  : "—";
const staticUrl = (value) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/api/")) return API_URL.startsWith("http") ? `${API_URL.replace(/\/api\/?$/, "")}${value}` : value;
  const base = import.meta.env.VITE_STATIC_URL || (API_URL.startsWith("http") ? API_URL.replace(/\/api\/?$/, "") : "");
  return `${base}${value}`;
};

const methodLabel = (method) => ({
  PAYROLL_DEDUCTION: "Salary deduction",
  CASH_REPAYMENT: "Cash repayment",
  WAIVED: "Owner-authorised waiver",
}[method] || String(method || "Settlement").replaceAll("_", " "));

export default function AdvanceSettlementReceiptDialog({ target, onClose }) {
  const [settlement, setSettlement] = useState(null);
  const [loading, setLoading] = useState(Boolean(target));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!target?.advanceRequestId || !target?.settlementId) {
      setSettlement(null);
      setLoading(false);
      setError("");
      return undefined;
    }
    let active = true;
    setSettlement(null);
    setLoading(true);
    setError("");
    axios.get(`${API_URL}/employee-finance/advance-requests/${target.advanceRequestId}/settlements/${target.settlementId}`, { withCredentials: true })
      .then(({ data }) => { if (active) setSettlement(data.settlement || null); })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.error || "Unable to load this settlement record.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [target]);

  if (!target) return null;
  if (!settlement) {
    return <Modal isOpen onClose={onClose} sizeClass="max-w-3xl"><div className="p-6">{loading
      ? <p className="py-8 text-center text-sm text-slate-500">Loading settlement record…</p>
      : <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error || "This settlement record is unavailable."}</p>}</div></Modal>;
  }

  const employeeConsent = settlement.evidence_kind === "EMPLOYEE_CONSENT";
  const title = employeeConsent ? "Employee salary-deduction consent" : settlement.settlement_method === "WAIVED" ? "Owner waiver attestation" : "Management cash-repayment attestation";
  const signerName = employeeConsent ? (settlement.consented_by_name || settlement.employee_name) : settlement.settled_by_name;
  const signerRole = employeeConsent ? (settlement.consented_by_role || settlement.employee_role) : settlement.settled_by_role;
  const effective = settlement.workflow_status === "EFFECTIVE";

  return <Modal isOpen onClose={onClose} sizeClass="max-w-4xl"><div className="space-y-5 p-1">
    <header className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-lg">
      <div className="h-1.5 bg-amber-400" />
      <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white p-2"><img src="/salehishicon.webp" alt="Salehish logo" className="h-full w-full object-contain" /></div><div><h2 className="text-xl font-bold">Salehish Beauty Parlour &amp; Spa</h2><p className="mt-1 text-xs font-semibold uppercase tracking-[0.17em] text-emerald-200">Official advance settlement record</p></div></div>
        <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left sm:text-right"><p className="font-mono text-xs text-slate-100">{settlement.receipt_number}</p><p className="mt-1 text-xs text-slate-300">Recorded {time(settlement.settled_at)}</p></div>
      </div>
    </header>
    <section className="grid gap-4 md:grid-cols-[1.05fr_.95fr]">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Settlement amount</p><p className="mt-2 text-3xl font-bold text-emerald-950">{money(settlement.amount)}</p><p className="mt-2 text-sm text-emerald-800">{methodLabel(settlement.settlement_method)}</p></div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Settlement status</p><p className="mt-2 text-lg font-bold text-slate-900">{effective ? "Effective settlement" : "Awaiting employee consent"}</p><p className="mt-2 text-sm text-slate-600">{effective ? "This settlement is included in the linked advance balance." : "It does not reduce the advance balance until the employee signs consent."}</p></div>
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-bold text-slate-950">Settlement details</h3><div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2"><Detail label="Employee" value={settlement.employee_name} /><Detail label="Settlement date" value={time(settlement.settled_at)} /><Detail label="Linked advance" value={settlement.advance_receipt_number || "Recorded employee advance"} /><Detail label="Settlement method" value={methodLabel(settlement.settlement_method)} /><Detail label="Advance reason" value={settlement.advance_reason} /><Detail label="Recorded by" value={settlement.settled_by_name ? `${settlement.settled_by_name}${settlement.settled_by_role ? ` · ${settlement.settled_by_role}` : ""}` : "—"} /><Detail label="Notes" value={settlement.notes} /><Detail label="Record state" value={String(settlement.workflow_status || "").replaceAll("_", " ")} /></div></section>
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Settlement declaration</p><p className="mt-2 leading-6 text-slate-700">{settlement.declaration || "No signed declaration is retained for this legacy settlement."}</p></section>
    <section><h3 className="font-bold text-slate-950">Signature evidence</h3><p className="mt-1 text-sm text-slate-500">The signed evidence is attached to this exact settlement for review and audit.</p><article className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 bg-slate-50 px-4 py-3"><p className="text-sm font-bold text-slate-900">{title}</p></div>{settlement.evidence_available ? <div className="p-4"><img src={staticUrl(settlement.evidence_asset_url)} alt={`${title} signature`} className="h-28 w-full rounded-xl border border-slate-200 bg-white object-contain" /><p className="mt-3 text-sm font-semibold text-slate-900">{signerName || "Recorded signer"}</p><p className="mt-1 text-xs text-slate-500">{signerRole || "—"} · {time(settlement.evidence_signed_at)}</p>{settlement.evidence_asset_url && <a href={staticUrl(settlement.evidence_asset_url)} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-semibold text-blue-700 hover:underline">Open signed evidence</a>}</div> : <div className="p-4 text-sm leading-6 text-amber-800">No signed evidence is attached to this historical settlement. Its financial record is preserved, but it is not represented as a newly signed document.</div>}</article></section>
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5"><p className="max-w-xl text-xs leading-5 text-slate-500">This settlement record is bound to the linked employee advance and retained for audit. It is not an employee payment or advance-disbursement receipt.</p><div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Close</button><button type="button" onClick={() => window.print()} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Print record</button></div></footer>
  </div></Modal>;
}

function Detail({ label, value }) {
  return <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-medium text-slate-900">{value || "—"}</p></div>;
}
