import { useState } from "react";
import { Landmark, ShieldCheck } from "lucide-react";

const emptyBankForm = () => ({
  bank_name: "",
  account_name: "",
  account_number: "",
  branch_name: "",
  currency: "UGX",
  verification_mode: "REFERENCE_MATCHING",
});

const emptyMockForm = () => ({
  bank_account_id: "",
  amount: "",
  transfer_reference: "",
  bank_transaction_id: "",
  delivery_mode: "IMMEDIATE",
  delay_ms: "5000",
});

export default function OwnerPaymentTools({ accounts, onSaveAccount, onSimulateCredit }) {
  const [panel, setPanel] = useState(null);
  const [bankForm, setBankForm] = useState(emptyBankForm);
  const [mockForm, setMockForm] = useState(emptyMockForm);
  const activeAccount = accounts.find((account) => account.is_active);
  const toggle = (next) => setPanel((current) => current === next ? null : next);

  const save = async (event) => {
    event.preventDefault();
    try {
      await onSaveAccount(bankForm);
      setBankForm(emptyBankForm());
      setPanel(null);
    } catch {
      // The parent surfaces the request error in the ledger; keep this form open for correction.
    }
  };

  const simulate = async (event) => {
    event.preventDefault();
    try {
      await onSimulateCredit(mockForm);
      setMockForm(emptyMockForm());
      setPanel(null);
    } catch {
      // The parent surfaces the request error in the ledger; keep this form open for correction.
    }
  };

  return <section className="owner-payment-tools rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner tools</p>
        <h2 className="mt-1 font-semibold text-slate-900">Bank configuration and development testing</h2>
        <p className="mt-1 text-sm text-slate-500">Choose an action to open its form.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => toggle("account")} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800">
          <Landmark className="mr-1 inline h-4 w-4" />{panel === "account" ? "Close account form" : "Manage bank account"}
        </button>
        {import.meta.env.DEV && <button type="button" onClick={() => toggle("mock")} className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">
          <ShieldCheck className="mr-1 inline h-4 w-4" />{panel === "mock" ? "Close mock bank" : "Open mock bank"}
        </button>}
      </div>
    </div>

    {activeAccount && <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Active receiving account: {activeAccount.bank_name} · {activeAccount.account_number}</p>}

    {panel === "account" && <form onSubmit={save} className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="font-semibold">Official salon bank account</h3>
      <p className="mt-1 text-sm text-slate-600">Only the active account is shown to customers for bank collections.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[["bank_name", "Bank name"], ["account_name", "Account name"], ["account_number", "Account number"], ["branch_name", "Branch (optional)"]].map(([key, label]) => <label key={key} className="text-sm">{label}<input required={key !== "branch_name"} value={bankForm[key]} onChange={(event) => setBankForm((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 block w-full rounded-xl border p-2" /></label>)}
        <label className="text-sm">Currency<input readOnly value={bankForm.currency} className="mt-1 block w-full rounded-xl border bg-slate-100 p-2" /></label>
        <label className="text-sm">Verification mode<select value={bankForm.verification_mode} onChange={(event) => setBankForm((current) => ({ ...current, verification_mode: event.target.value }))} className="mt-1 block w-full rounded-xl border p-2"><option value="REFERENCE_MATCHING">Reference matching</option><option value="API_INQUIRY">Bank API inquiry</option><option value="VIRTUAL_ACCOUNT">Virtual account</option><option value="MANUAL_RECONCILIATION">Controlled manual reconciliation</option></select></label>
      </div>
      <button className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Save official account</button>
    </form>}

    {panel === "mock" && import.meta.env.DEV && <form onSubmit={simulate} className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <h3 className="font-semibold text-amber-950">Development-only mock bank</h3>
      <p className="mt-1 text-sm text-amber-900">Simulates a customer-initiated credit. It cannot mark a cashier payment as successful by itself.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Receiving account<select required value={mockForm.bank_account_id} onChange={(event) => setMockForm((current) => ({ ...current, bank_account_id: event.target.value }))} className="mt-1 block w-full rounded-xl border p-2"><option value="">Choose account</option>{accounts.filter((account) => account.is_active).map((account) => <option key={account.id} value={account.id}>{account.bank_name} · {account.account_number}</option>)}</select></label>
        <label className="text-sm">Amount<input required min="1" type="number" value={mockForm.amount} onChange={(event) => setMockForm((current) => ({ ...current, amount: event.target.value }))} className="mt-1 block w-full rounded-xl border p-2" /></label>
        <label className="text-sm">Transfer reference<input value={mockForm.transfer_reference} onChange={(event) => setMockForm((current) => ({ ...current, transfer_reference: event.target.value }))} className="mt-1 block w-full rounded-xl border p-2" placeholder="Blank simulates a missing reference" /></label>
        <label className="text-sm">Mock bank transaction ID <span className="font-normal text-slate-500">(optional)</span><input value={mockForm.bank_transaction_id} onChange={(event) => setMockForm((current) => ({ ...current, bank_transaction_id: event.target.value }))} className="mt-1 block w-full rounded-xl border p-2" placeholder="Generated when blank" /></label>
        <label className="text-sm">Notification scenario<select value={mockForm.delivery_mode} onChange={(event) => setMockForm((current) => ({ ...current, delivery_mode: event.target.value }))} className="mt-1 block w-full rounded-xl border p-2"><option value="IMMEDIATE">Deliver notification now</option><option value="DELAYED">Deliver after a delay</option><option value="MISSED_NOTIFICATION">Store credit; recover by inquiry</option></select></label>
        {mockForm.delivery_mode === "DELAYED" && <label className="text-sm">Delay (milliseconds)<input min="1000" max="60000" type="number" value={mockForm.delay_ms} onChange={(event) => setMockForm((current) => ({ ...current, delay_ms: event.target.value }))} className="mt-1 block w-full rounded-xl border p-2" /></label>}
      </div>
      <button className="mt-4 rounded-xl bg-amber-800 px-4 py-2.5 text-sm font-semibold text-white">Simulate incoming bank credit</button>
    </form>}
  </section>;
}
