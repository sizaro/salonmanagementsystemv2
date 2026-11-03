import { useState } from "react";
import axios from "axios";
import { Landmark } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "/api";

export default function ManualBankPayoutVerification({ payment, onVerified }) {
  const [bankTransactionId, setBankTransactionId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isManualBankPayout = payment?.record_kind === "PAYMENT_INTENT"
    && payment?.provider === "BANK_TRANSFER"
    && payment?.direction === "DISBURSEMENT"
    && ["AWAITING_EXECUTION", "SUBMITTED"].includes(payment?.manual_execution_status);

  if (!isManualBankPayout) return null;

  const verify = async (event) => {
    event.preventDefault();
    setError("");
    try {
      setBusy(true);
      await axios.post(
        `${API_URL}/payments/bank/disbursements/${encodeURIComponent(payment.intent_reference)}/verify-manual`,
        { bank_transaction_id: bankTransactionId, verification_note: note },
        { withCredentials: true },
      );
      await onVerified?.();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to verify the manual bank payout.");
    } finally {
      setBusy(false);
    }
  };

  return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
    <div className="flex items-start gap-3">
      <Landmark className="mt-0.5 h-5 w-5 text-amber-800" />
      <div>
        <h2 className="font-semibold text-amber-950">Controlled manual bank payout</h2>
        <p className="mt-1 text-sm text-amber-900">Confirm this only after an authorised staff member has executed and verified the transfer in the bank channel. This action records verified evidence; it does not initiate a debit.</p>
      </div>
    </div>
    <form onSubmit={verify} className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-sm text-amber-950">Verified bank transaction ID
        <input required value={bankTransactionId} onChange={(event) => setBankTransactionId(event.target.value)} className="mt-1 block w-full rounded-xl border border-amber-300 bg-white p-2" />
      </label>
      <label className="text-sm text-amber-950">Verification note <span className="font-normal">(optional)</span>
        <input value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 block w-full rounded-xl border border-amber-300 bg-white p-2" placeholder="Statement or approver reference" />
      </label>
      {error && <p role="alert" className="sm:col-span-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      <button disabled={busy} className="w-fit rounded-xl bg-amber-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Verifying…" : "Verify completed bank payout"}</button>
    </form>
  </section>;
}
