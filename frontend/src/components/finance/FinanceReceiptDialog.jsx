import { useEffect, useState } from "react";
import axios from "axios";
import Modal from "../Modal.jsx";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const money = (value) => `UGX ${Number(value || 0).toLocaleString("en-UG")}`;
const time = (value) => value ? new Intl.DateTimeFormat("en-UG", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—";
const staticUrl = (value) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/api/")) {
    return API_URL.startsWith("http") ? `${API_URL.replace(/\/api\/?$/, "")}${value}` : value;
  }
  const base = import.meta.env.VITE_STATIC_URL || (API_URL.startsWith("http") ? API_URL.replace(/\/api\/?$/, "") : "");
  return `${base}${value}`;
};

export default function FinanceReceiptDialog({ receiptId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(receiptId));
  useEffect(() => {
    if (!receiptId) {
      setDetail(null);
      setError("");
      setLoading(false);
      return undefined;
    }
    let active = true;
    setDetail(null);
    setLoading(true);
    setError("");
    axios.get(`${API_URL}/employee-finance/receipts/${receiptId}`, { withCredentials: true })
      .then(({ data }) => { if (active) setDetail(data); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.error || "Unable to load this receipt."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [receiptId]);
  if (!receiptId) return null;
  const receipt = detail?.receipt;
  const signatures = detail?.signatures || [];
  const pdfUrl = receipt?.pdf_available ? `${API_URL}/employee-finance/receipts/${receipt.id}/pdf` : null;
  const ready = Boolean(receipt && detail?.salon && detail?.transaction);

  if (ready) {
    return <BrandedReceiptDialog detail={detail} onClose={onClose} pdfUrl={pdfUrl} />;
  }

  return <Modal isOpen onClose={onClose} sizeClass="max-w-3xl"><div className="space-y-5 p-2">{loading ? <p className="p-8 text-center text-sm text-slate-500">Loading receipt…</p> : error ? <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p> : !ready ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">This receipt detail is unavailable. Refresh the finance register and try again.</p> : <><header className="rounded-2xl bg-slate-900 p-5 text-white"><p className="text-xs font-semibold tracking-widest text-emerald-200">{receipt.receipt_type} RECEIPT</p><h2 className="mt-1 text-xl font-semibold">{receipt.receipt_number}</h2><p className="mt-2 text-sm text-slate-300">{detail.salon.name} · {time(receipt.issued_at)}</p></header><div className="grid gap-3 sm:grid-cols-2"><Info label="Employee" value={detail.transaction.employee_name} /><Info label="Amount received" value={money(receipt.amount)} /><Info label="Payment method" value={detail.transaction.payment_method || "Cash"} /><Info label="Disbursed by" value={detail.transaction.disbursed_by_name || detail.transaction.issued_by_name} /><Info label="Reference / reason" value={detail.transaction.payment_reference || detail.transaction.reason || detail.transaction.notes} /><Info label="Final receipt" value={receipt.finalized_at ? `Finalised ${time(receipt.finalized_at)}` : "Awaiting both signatures"} /></div><section><h3 className="font-semibold text-slate-900">Signature evidence</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{signatures.length ? signatures.map((signature) => <article key={signature.id} className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-bold tracking-wide text-slate-500">{signature.signature_type}</p><img src={staticUrl(signature.signature_asset_url)} alt={`${signature.signature_type} signature`} className="mt-3 h-20 w-full rounded border bg-white object-contain" /><p className="mt-3 text-sm font-semibold text-slate-900">{signature.signer_name}</p><p className="text-xs text-slate-500">{signature.signer_role} · {time(signature.signed_at)}</p><p className="mt-2 text-xs leading-5 text-slate-600">{signature.declaration}</p></article>) : <p className="rounded-xl border border-dashed p-4 text-sm text-slate-500">This is a legacy receipt without signature evidence.</p>}</div></section><div className="flex flex-wrap justify-end gap-3 border-t pt-4"><button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Close</button>{pdfUrl && <><a href={pdfUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Download PDF</a><button type="button" onClick={() => window.open(pdfUrl, "_blank", "noopener,noreferrer")} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Print receipt</button></>}</div></>}</div></Modal>;
}

function Info({ label, value }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-medium text-slate-900">{value || "—"}</p></div>; }

function BrandedReceiptDialog({ detail, onClose, pdfUrl }) {
  const { receipt, transaction, signatures } = detail;
  const managerSignature = signatures.find((item) => item.signature_type === "APPROVAL");
  const employeeSignature = signatures.find((item) => item.signature_type === "ACKNOWLEDGEMENT");
  const receiptLabel = receipt.receipt_type === "PAYMENT" ? "Employee payment" : "Employee advance";

  return <Modal isOpen onClose={onClose} sizeClass="max-w-4xl"><div className="space-y-5 p-1"><header className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-lg"><div className="h-1.5 bg-amber-400" /><div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-4"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white p-2"><img src="/salehishicon.webp" alt="Salehish logo" className="h-full w-full object-contain" /></div><div><h2 className="text-xl font-bold">Salehish Beauty Parlour & Spa</h2><p className="mt-1 text-xs font-semibold uppercase tracking-[0.17em] text-emerald-200">Official employee finance receipt</p></div></div><div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left sm:text-right"><p className="font-mono text-xs text-slate-100">{receipt.receipt_number}</p><p className="mt-1 text-xs text-slate-300">Issued {time(receipt.issued_at)}</p></div></div></header><section className="grid gap-4 md:grid-cols-[1.05fr_.95fr]"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Amount received</p><p className="mt-2 text-3xl font-bold text-emerald-950">{money(receipt.amount)}</p><p className="mt-2 text-sm text-emerald-800">{receiptLabel} · {transaction.payment_method || "Cash"}</p></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Receipt status</p><p className="mt-2 text-lg font-bold text-slate-900">{receipt.finalized_at ? "Final signed receipt" : "Awaiting signatures"}</p><p className="mt-2 text-sm text-slate-600">{receipt.finalized_at ? `Finalised ${time(receipt.finalized_at)}` : "The printable PDF becomes available after both signatures."}</p></div></section><section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-bold text-slate-950">Transaction details</h3><div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2"><ReceiptInfo label="Employee" value={transaction.employee_name} /><ReceiptInfo label="Payment date" value={time(transaction.disbursed_at || receipt.issued_at)} /><ReceiptInfo label="Approved by" value={managerSignature?.signer_name || "Awaiting approval signature"} /><ReceiptInfo label="Disbursed by" value={transaction.disbursed_by_name || transaction.issued_by_name} /><ReceiptInfo label="Reference / reason" value={transaction.payment_reference || transaction.reason || transaction.notes} /><ReceiptInfo label="Receipt type" value={receiptLabel} /></div></section><section className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Receipt declaration</p><p className="mt-2 leading-6 text-slate-700">I acknowledge receiving <strong>{money(receipt.amount)}</strong> as an employee {receipt.receipt_type === "PAYMENT" ? "payment" : "advance"} under the terms recorded for this transaction.</p></section><section><h3 className="font-bold text-slate-950">Signature evidence</h3><p className="mt-1 text-sm text-slate-500">Each signature is stored against this transaction for audit and printing.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><ReceiptSignature title="Management approval" signature={managerSignature} empty="Management signature has not yet been recorded." /><ReceiptSignature title="Employee acknowledgement" signature={employeeSignature} empty="Employee acknowledgement has not yet been recorded." /></div></section><footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5"><p className="max-w-xl text-xs leading-5 text-slate-500">This electronically signed receipt is bound to the recorded transaction and retained for audit.</p><div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Close</button>{pdfUrl && <><a href={pdfUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Download PDF</a><button type="button" onClick={() => window.open(pdfUrl, "_blank", "noopener,noreferrer")} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Print receipt</button></>}</div></footer></div></Modal>;
}

function ReceiptInfo({ label, value }) { return <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-medium text-slate-900">{value || "—"}</p></div>; }

function ReceiptSignature({ title, signature, empty }) { return <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 bg-slate-50 px-4 py-3"><p className="text-sm font-bold text-slate-900">{title}</p></div>{signature ? <div className="p-4"><img src={staticUrl(signature.signature_asset_url)} alt={`${title} signature`} className="h-24 w-full rounded-xl border border-slate-200 bg-white object-contain" /><p className="mt-3 text-sm font-semibold text-slate-900">{signature.signer_name}</p><p className="mt-1 text-xs text-slate-500">{signature.signer_role} · {time(signature.signed_at)}</p></div> : <div className="p-4 text-sm leading-6 text-slate-500">{empty}</div>}</article>; }
