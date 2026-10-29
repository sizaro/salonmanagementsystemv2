import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { CheckCircle2, CircleAlert, Copy, LoaderCircle, Smartphone, University } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "/api";

const providerLabel = {
  MTN_MOMO: "MTN Mobile Money",
  AIRTEL_MONEY: "Airtel Money",
  BANK_TRANSFER: "Bank transfer",
};

const money = (amount, currency = "UGX") => `${currency} ${Number(amount || 0).toLocaleString("en-UG")}`;

export default function PaymentSheet({ paymentRequest, onClose, onCompleted }) {
  const [payerName, setPayerName] = useState("");
  const [payerPhone, setPayerPhone] = useState("");
  const [recipientAccount, setRecipientAccount] = useState("");
  const [intent, setIntent] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bankInquiry, setBankInquiry] = useState(false);
  const [bankInquiryMessage, setBankInquiryMessage] = useState("");
  const completedRef = useRef(false);
  const idempotencyKeyRef = useRef("");
  const automaticBankIntentRef = useRef(false);

  const method = paymentRequest?.payload?.collection_method || paymentRequest?.payload?.payment_method;
  const isBank = method === "BANK_TRANSFER";
  const isDisbursement = paymentRequest?.direction === "DISBURSEMENT";

  const initiatePayment = useCallback(async () => {
    setError("");
    const identifier = isBank ? recipientAccount.trim() : payerPhone.trim();
    if ((!isBank || isDisbursement) && !identifier) {
      setError(isBank ? "Enter the recipient bank account." : isDisbursement ? "Enter the recipient mobile-money number." : "Enter the payer's mobile-money number.");
      return;
    }
    try {
      setSubmitting(true);
      const response = await axios.post(
        `${API_URL}${paymentRequest.endpoint || "/payments/service-intents"}`,
        {
          ...paymentRequest.payload,
          payment_idempotency_key: idempotencyKeyRef.current,
          payer_name: payerName.trim() || paymentRequest.payload?.payer_name || null,
          payer_phone: !isBank ? identifier : null,
          recipient_phone: !isBank && isDisbursement ? identifier : null,
          recipient_account: isBank ? identifier || null : null,
          recipient_name: isDisbursement ? payerName.trim() || null : null,
        },
        { withCredentials: true },
      );
      setIntent(response.data?.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to initiate payment.");
    } finally {
      setSubmitting(false);
    }
  }, [isBank, isDisbursement, payerName, payerPhone, paymentRequest, recipientAccount]);

  useEffect(() => {
    if (!intent?.intent_reference || completedRef.current) return undefined;
    const poll = async () => {
      try {
        const response = await axios.get(`${API_URL}/payments/intents/${intent.intent_reference}`, {
          withCredentials: true,
        });
        const current = response.data?.data;
        setIntent(current);
        if (["FAILED", "CANCELLED"].includes(current?.payment_status)) {
          setError(current.failure_message || "The payment was not completed. The original transaction has not been recorded.");
        }
        if (current?.payment_status === "CONFIRMED" && current?.posting_status === "POSTED") {
          completedRef.current = true;
          window.setTimeout(() => onCompleted?.(current), 900);
        }
        if (current?.posting_status === "FAILED") {
          setError("Payment was confirmed, but Salehish is retrying the business record. The payment evidence is preserved in Payments & Banking.");
        }
      } catch (requestError) {
        setError(requestError.response?.data?.message || "Unable to check the payment status.");
      }
    };
    void poll();
    const interval = window.setInterval(poll, 2500);
    return () => window.clearInterval(interval);
  }, [intent?.intent_reference, onCompleted]);

  useEffect(() => {
    setIntent(null);
    setError("");
    setSubmitting(false);
    setBankInquiry(false);
    setBankInquiryMessage("");
    completedRef.current = false;
    idempotencyKeyRef.current = crypto.randomUUID();
    automaticBankIntentRef.current = false;
  }, [paymentRequest]);

  useEffect(() => {
    if (!isBank || isDisbursement || intent || automaticBankIntentRef.current) return;
    automaticBankIntentRef.current = true;
    void initiatePayment();
  }, [initiatePayment, intent, isBank, isDisbursement]);

  if (!paymentRequest) return null;

  const startPayment = async (event) => {
    event.preventDefault();
    await initiatePayment();
  };

  const pending = intent?.payment_status === "PENDING";
  const confirmed = intent?.payment_status === "CONFIRMED" && intent?.posting_status === "POSTED";
  const paymentFailed = ["FAILED", "CANCELLED", "EXPIRED"].includes(intent?.payment_status);
  const manualBankPayout = isBank && isDisbursement && ["AWAITING_EXECUTION", "SUBMITTED"].includes(intent?.manual_execution_status);

  const inquireBank = async () => {
    if (!intent?.intent_reference) return;
    setError("");
    setBankInquiry(true);
    try {
      const response = await axios.post(`${API_URL}/payments/bank/intents/${intent.intent_reference}/inquire`, {}, { withCredentials: true });
      setIntent(response.data?.data);
      setBankInquiryMessage(response.data?.message || "Payment not yet found. Automatic verification will continue.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to check the bank transfer status.");
    } finally {
      setBankInquiry(false);
    }
  };

  const bankStatus = (() => {
    if (!isBank || isDisbursement) return null;
    if (intent?.posting_status === "POSTED") return "Payment completed and transaction recorded.";
    if (intent?.posting_status === "FINALIZING") return "Payment received and verified. Recording the transaction…";
    if (intent?.posting_status === "FAILED") return "Payment requires investigation. The verified credit is preserved.";
    if (intent?.verification_status === "INVESTIGATION") return "Payment requires investigation.";
    if (intent?.payment_status === "CONFIRMED") return "Payment received and verified.";
    if (bankInquiry) return "Checking for incoming bank credit…";
    if (intent?.created_at && Date.now() - new Date(intent.created_at).getTime() > 60000) return "Verification delayed. Salehish will keep checking automatically.";
    if (bankInquiryMessage) return bankInquiryMessage;
    return "Awaiting customer transfer.";
  })();

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(intent?.bank_payment_reference || "");
    } catch {
      setError("Copy the reference manually if your browser blocks clipboard access.");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-slate-950/45 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="payment-sheet-title">
      <section className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/60 bg-white p-5 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:rounded-3xl sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-[var(--salon-copper)] uppercase">Secure payment step</p>
            <h2 id="payment-sheet-title" className="mt-1 text-xl font-bold text-slate-900">{providerLabel[method] || "External payment"}</h2>
            <p className="mt-1 text-sm text-slate-600">{intent?.operation_description || paymentRequest.label || "Confirm this transaction through the selected provider."}</p>
          </div>
          {isBank ? <University className="h-8 w-8 text-[var(--salon-copper)]" aria-hidden="true" /> : <Smartphone className="h-8 w-8 text-[var(--salon-copper)]" aria-hidden="true" />}
        </div>

        <div className="mb-5 rounded-2xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm font-medium text-slate-600">Amount to collect</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{money(intent?.amount || paymentRequest.amount, intent?.currency || paymentRequest.currency || "UGX")}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {isBank && !isDisbursement
              ? "Salehish verifies the incoming bank credit before recording this transaction."
              : manualBankPayout
                ? "This payout awaits authorised manual bank execution and verification before the transaction is recorded."
              : isDisbursement
                ? "Salehish never asks for or stores a recipient's banking or mobile-money PIN. The provider handles the authorised payout."
                : "Salehish never asks for or stores a customer mobile-money PIN. The provider handles PIN entry."}
          </p>
        </div>

        {!intent && isBank && !isDisbursement && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />
            Preparing your official bank-transfer instructions…
            {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {error && <button type="button" onClick={onClose} className="mt-3 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Back</button>}
          </div>
        )}

        {!intent && (!isBank || isDisbursement) && (
          <form onSubmit={startPayment} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Payer name <span className="font-normal text-slate-400">(optional)</span></span>
              <input value={payerName} onChange={(event) => setPayerName(event.target.value)} className="w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--salon-copper)] focus:ring-2 focus:ring-[var(--salon-copper)]/15" placeholder="Customer name" />
            </label>
            {(isDisbursement || !isBank) && <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">{isBank ? "Recipient bank account" : isDisbursement ? "Recipient mobile-money number" : "Mobile-money number"}</span>
              {isBank ? <input required value={recipientAccount} onChange={(event) => setRecipientAccount(event.target.value)} className="w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--salon-copper)] focus:ring-2 focus:ring-[var(--salon-copper)]/15" placeholder="Recipient account number" /> :
              <input required value={payerPhone} onChange={(event) => setPayerPhone(event.target.value)} className="w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--salon-copper)] focus:ring-2 focus:ring-[var(--salon-copper)]/15" placeholder="07XXXXXXXX" />
              }
            </label>}
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Back</button>
              <button type="submit" disabled={submitting} className="rounded-xl bg-[var(--salon-copper)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{submitting ? "Starting payment…" : isBank && !isDisbursement ? "Show bank transfer instructions" : isDisbursement ? `Send ${providerLabel[method]}` : `Request ${providerLabel[method]}`}</button>
            </div>
          </form>
        )}

        {intent && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {pending && (!isBank || (isDisbursement && !manualBankPayout)) && <><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />Waiting for the provider confirmation…</>}
              {pending && manualBankPayout && <>Awaiting authorised manual bank execution and verification.</>}
              {pending && isBank && !isDisbursement && <>{bankInquiry && <LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />}{bankStatus}</>}
              {confirmed && <><CheckCircle2 className="mr-2 inline h-4 w-4 text-emerald-600" />{isBank && !isDisbursement ? bankStatus : "Payment completed and transaction recorded."}</>}
              {intent.posting_status === "FINALIZING" && (isBank && !isDisbursement ? bankStatus : "Payment confirmed. Recording the transaction…")}
              {intent.posting_status === "FAILED" && <><CircleAlert className="mr-2 inline h-4 w-4 text-red-600" />{error}</>}
              {paymentFailed && <><CircleAlert className="mr-2 inline h-4 w-4 text-red-600" />{error || "The provider did not confirm this payment."}</>}
            </div>
            {isBank && !isDisbursement ? <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div><p className="font-semibold text-slate-900">Payment information</p><p className="mt-1">{intent.operation_description || paymentRequest.label}</p><p className="font-semibold">{money(intent.amount, intent.currency)}</p></div>
              <div><p className="font-semibold text-slate-900">Official salon receiving account</p><p className="mt-1">{intent.bank_account?.bank_name}</p><p>{intent.bank_account?.account_name}</p><p className="font-mono font-semibold">{intent.bank_account?.account_number}</p><p>{intent.bank_account?.currency}{intent.bank_account?.branch_name ? ` · ${intent.bank_account.branch_name}` : ""}</p></div>
              <div><p className="font-semibold text-slate-900">Unique Salehish payment reference</p><div className="mt-1 flex items-center gap-2"><code className="rounded bg-white px-2 py-1 font-semibold">{intent.bank_payment_reference}</code><button type="button" onClick={copyReference} className="rounded p-1 text-slate-700" aria-label="Copy payment reference"><Copy className="h-4 w-4" /></button></div></div>
              <ol className="list-decimal space-y-1 pl-5 text-xs leading-5"><li>Open your mobile banking, internet banking, or another supported banking channel.</li><li>Transfer the exact amount to the official salon account above.</li><li>Include the Salehish reference in the transfer description where your bank supports it.</li><li>Wait for Salehish to verify the incoming credit automatically.</li></ol>
              {pending && <button type="button" onClick={inquireBank} disabled={bankInquiry} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{bankInquiry ? "Checking…" : "I've Made the Transfer"}</button>}
            </div> : <p className="text-xs text-slate-500">Payment reference: {intent.provider_reference || intent.intent_reference}</p>}
            {!confirmed && intent.posting_status !== "FAILED" && <button type="button" onClick={onClose} className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Close while payment is processing</button>}
          </div>
        )}
      </section>
    </div>
  );
}
