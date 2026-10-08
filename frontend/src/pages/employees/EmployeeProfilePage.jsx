import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useData } from "../../context/DataContext.jsx";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const money = (value) => `UGX ${Number(value || 0).toLocaleString()}`;
const show = (value, fallback = "Not provided") => {
  const text = String(value ?? "").trim();
  return !text || text.toLowerCase() === "null" ? fallback : value;
};
const formatDate = (value, includeTime = false) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-UG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
};
const initials = (employee) => [employee?.first_name, employee?.last_name]
  .filter(Boolean)
  .map((part) => String(part).trim().charAt(0))
  .join("")
  .toUpperCase()
  .slice(0, 2) || "EM";
const staticUrl = (value) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const configuredBase = import.meta.env.VITE_STATIC_URL
    || (API_URL.startsWith("http") ? API_URL.replace(/\/api\/?$/, "") : "");
  return `${configuredBase}${value}`;
};
const statusClass = (value) => {
  const status = String(value || "").toUpperCase();
  if (["ACTIVE", "ACKNOWLEDGED", "DISBURSED", "APPROVED"].includes(status)) return "bg-emerald-100 text-emerald-800";
  if (["REJECTED", "CANCELLED", "VOIDED", "INACTIVE"].includes(status)) return "bg-rose-100 text-rose-800";
  return "bg-amber-100 text-amber-800";
};

const tabs = [
  ["overview", "Overview"],
  ["employment", "Employment"],
  ["work", "Work & Performance"],
  ["finance", "Finance"],
  ["advances", "Advances"],
  ["documents", "Documents"],
  ["activity", "Activity & Audit"],
];

const Field = ({ label, value }) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
    <dd className="mt-1 break-words text-sm font-medium text-slate-900">{show(value)}</dd>
  </div>
);

const Empty = ({ children }) => <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">{children}</p>;

export default function EmployeeProfilePage({ self = false }) {
  const { id: routeId } = useParams();
  const { user, fetchEmployeeProfile } = useData();
  const employeeId = self ? Number(user?.id) : Number(routeId);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      setError("This employee profile is unavailable.");
      setLoading(false);
      return undefined;
    }
    let current = true;
    setLoading(true);
    setError("");
    fetchEmployeeProfile(employeeId)
      .then((data) => { if (current) setResult(data); })
      .catch((requestError) => {
        if (current) setError(requestError.response?.data?.error || "Unable to load this employee profile.");
      })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [employeeId, fetchEmployeeProfile]);

  const profile = result?.profile;
  const employee = profile?.employee;
  const permissions = result?.permissions || {};
  const image = useMemo(() => staticUrl(employee?.image_url), [employee?.image_url]);
  const role = String(user?.role || "").toLowerCase();
  const backTo = self ? "/employee/dashboard" : role === "manager" ? "/manager/employees-management" : role === "cashier" ? "/cashier/staff-payments" : "/owner/employees-management";

  if (loading) return <div className="p-6 text-sm text-slate-500">Loading employee profile…</div>;
  if (error || !employee) return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800">{error || "Employee profile was not found."}</div>
      <Link to={backTo} className="mt-4 inline-flex text-sm font-semibold text-blue-700 hover:underline">Back to employees</Link>
    </div>
  );

  const documents = profile.documents;
  const documentLink = (kind) => `${API_URL}/employee-profiles/${employee.id}/documents/${kind}`;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <Link to={backTo} className="inline-flex text-sm font-semibold text-slate-600 hover:text-slate-950">← Back to employees</Link>

      <section className="overflow-hidden rounded-3xl bg-slate-900 text-white shadow-xl">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
          {image ? (
            <img src={image} alt={`${employee.first_name} ${employee.last_name}`} className="h-24 w-24 rounded-2xl border-2 border-white/30 object-cover" />
          ) : (
            <div aria-label="Employee initials avatar" className="flex h-24 w-24 items-center justify-center rounded-2xl bg-emerald-400 text-3xl font-bold text-slate-950">{initials(employee)}</div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-emerald-200">Employee profile</p>
            <h1 className="mt-1 truncate text-3xl font-semibold">{[employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(" ")}</h1>
            <p className="mt-2 text-sm text-slate-300">{show(employee.role, "Employee")} · {show(employee.specialty, "No specialty recorded")}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white/10 px-3 py-1">{show(employee.contact)}</span>
              <span className="rounded-full bg-white/10 px-3 py-1">{show(employee.email)}</span>
              <span className={`rounded-full px-3 py-1 font-semibold ${statusClass(employee.status)}`}>{show(employee.status, "Unknown")}</span>
            </div>
          </div>
        </div>
      </section>

      <nav aria-label="Employee profile sections" className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setActiveTab(key)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${activeTab === key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{label}</button>
        ))}
      </nav>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        {activeTab === "overview" && <div className="space-y-6">
          <div><h2 className="text-lg font-semibold text-slate-900">Personal and contact information</h2><p className="mt-1 text-sm text-slate-500">Information saved on the employee account.</p></div>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="First name" value={employee.first_name} /><Field label="Middle name" value={employee.middle_name} /><Field label="Last name" value={employee.last_name} />
            <Field label="Email" value={employee.email} /><Field label="Phone" value={employee.contact} /><Field label="Birthdate" value={employee.birthdate} />
            <Field label="Gender" value={employee.gender} /><Field label="Next of kin" value={employee.next_of_kin} /><Field label="Next of kin phone" value={employee.next_of_kin_contact} />
          </dl>
          <div><h3 className="text-sm font-semibold text-slate-900">Biography</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{show(employee.bio, "No biography recorded.")}</p></div>
        </div>}

        {activeTab === "employment" && <div className="space-y-5">
          <div><h2 className="text-lg font-semibold text-slate-900">Employment</h2><p className="mt-1 text-sm text-slate-500">Only information that is currently stored is shown here.</p></div>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Role" value={profile.employment.role} /><Field label="Status" value={profile.employment.status} /><Field label="Specialty" value={profile.employment.specialty} />
            <Field label="Employee record created" value={formatDate(profile.employment.started_at, true)} />
            <Field label="Compensation arrangement" value={profile.employment.compensation_configured ? "Configured" : "Not separately configured"} />
          </dl>
          <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800">{profile.employment.compensation_note}</p>
        </div>}

        {activeTab === "work" && <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Completed-service earnings" value={money(profile.work.summary.earned_amount)} />
            <Field label="Completed service snapshots" value={profile.work.summary.completed_service_count} />
            <Field label="Latest earning" value={profile.work.summary.last_earning_date} />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Service earning history</h2>
          {profile.work.history.length === 0 ? <Empty>No completed-service earnings have been recorded for this employee yet.</Empty> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="border-b text-left text-slate-500"><tr><th className="p-2">Business date</th><th className="p-2">Service</th><th className="p-2">Status</th><th className="p-2 text-right">Earning</th></tr></thead><tbody>{profile.work.history.map((item) => <tr key={item.id} className="border-b border-slate-100"><td className="p-2">{show(item.earning_date, "—")} {show(item.earning_time, "")}</td><td className="p-2">{show(item.service_name, "Service transaction")}</td><td className="p-2">{show(item.service_status)}</td><td className="p-2 text-right font-semibold">{money(item.amount)}</td></tr>)}</tbody></table></div>}
        </div>}

        {activeTab === "finance" && <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Recorded earnings" value={money(profile.finance.overview.earned_amount)} /><Field label="Paid" value={money(profile.finance.overview.paid_amount)} />
            <Field label="Advance deductions" value={money(profile.finance.overview.payroll_deductions)} /><Field label="Available for payment" value={money(profile.finance.overview.unpaid_amount)} />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Employee payments</h2>
          {profile.finance.payments.length === 0 ? <Empty>No employee payments have been prepared.</Empty> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="border-b text-left text-slate-500"><tr><th className="p-2">Received</th><th className="p-2">Method</th><th className="p-2">Reference</th><th className="p-2">Status</th><th className="p-2 text-right">Amount</th></tr></thead><tbody>{profile.finance.payments.map((payment) => <tr key={payment.id} className="border-b border-slate-100"><td className="p-2">{formatDate(payment.created_at, true)}</td><td className="p-2">{show(payment.payment_method)}</td><td className="p-2">{show(payment.payment_reference)}</td><td className="p-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(payment.workflow_status)}`}>{show(payment.workflow_status)}</span></td><td className="p-2 text-right font-semibold">{money(payment.requested_amount)}</td></tr>)}</tbody></table></div>}
          <h2 className="text-lg font-semibold text-slate-900">Receipts and acknowledgements</h2>
          {profile.finance.receipts.length === 0 ? <Empty>No finance receipts have been issued.</Empty> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="border-b text-left text-slate-500"><tr><th className="p-2">Receipt</th><th className="p-2">Type</th><th className="p-2">Issued</th><th className="p-2">Acknowledged</th><th className="p-2 text-right">Amount</th></tr></thead><tbody>{profile.finance.receipts.map((receipt) => <tr key={`${receipt.receipt_type}-${receipt.id}`} className="border-b border-slate-100"><td className="p-2">{show(receipt.receipt_number)}</td><td className="p-2">{show(receipt.receipt_type)}</td><td className="p-2">{formatDate(receipt.issued_at, true)}</td><td className="p-2">{formatDate(receipt.acknowledged_at, true)}</td><td className="p-2 text-right font-semibold">{money(receipt.amount)}</td></tr>)}</tbody></table></div>}
        </div>}

        {activeTab === "advances" && <div className="space-y-5">
          <div><h2 className="text-lg font-semibold text-slate-900">Advance history</h2><p className="mt-1 text-sm text-slate-500">Settlements remain traceable; they do not erase the original advance.</p></div>
          {profile.finance.advances.length === 0 ? <Empty>No advance requests have been recorded.</Empty> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="border-b text-left text-slate-500"><tr><th className="p-2">Requested</th><th className="p-2">Reason</th><th className="p-2">Status</th><th className="p-2 text-right">Advance</th><th className="p-2 text-right">Settled</th><th className="p-2 text-right">Outstanding</th></tr></thead><tbody>{profile.finance.advances.map((advance) => <tr key={advance.id} className="border-b border-slate-100"><td className="p-2">{formatDate(advance.created_at, true)}</td><td className="p-2">{show(advance.reason)}</td><td className="p-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(advance.workflow_status)}`}>{show(advance.workflow_status)}</span></td><td className="p-2 text-right">{money(advance.requested_amount)}</td><td className="p-2 text-right">{money(advance.settled_amount)}</td><td className="p-2 text-right font-semibold">{money(advance.outstanding_amount)}</td></tr>)}</tbody></table></div>}
        </div>}

        {activeTab === "documents" && <div className="space-y-5">
          <div><h2 className="text-lg font-semibold text-slate-900">Authorized documents</h2><p className="mt-1 text-sm text-slate-500">Identity evidence is shown only to authorized users.</p></div>
          {!permissions.can_view_documents ? <Empty>You are not authorized to view this employee’s identity documents.</Empty> : <div className="space-y-4"><dl className="grid gap-3 sm:grid-cols-2"><Field label="National ID number" value={documents?.national_id_number} /><Field label="Identity evidence" value={documents?.has_identity_evidence ? "Evidence added" : "Not added"} /></dl><div className="flex flex-wrap gap-3">{documents?.id_document_front_url && <a className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white" href={documentLink("id-front")} target="_blank" rel="noreferrer">Open ID front</a>}{documents?.id_document_back_url && <a className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white" href={documentLink("id-back")} target="_blank" rel="noreferrer">Open ID back</a>}{documents?.id_document_pdf_url && <a className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white" href={documentLink("id-pdf")} target="_blank" rel="noreferrer">Open ID PDF</a>}{!documents?.has_identity_evidence && <Empty>No identity documents are attached to this employee.</Empty>}</div></div>}
        </div>}

        {activeTab === "activity" && <div className="space-y-5">
          <div><h2 className="text-lg font-semibold text-slate-900">Activity & audit</h2><p className="mt-1 text-sm text-slate-500">Employee updates and finance workflow events appear here without rewriting historical records.</p></div>
          {profile.activity.length === 0 ? <Empty>No activity has been recorded for this employee yet.</Empty> : <ol className="space-y-3">{profile.activity.map((event) => <li key={`${event.category}-${event.id}-${event.occurred_at}`} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-slate-900">{String(event.action || "Activity").replaceAll("_", " ")}</strong><span className="text-xs text-slate-500">{formatDate(event.occurred_at, true)}</span></div><p className="mt-1 text-sm text-slate-600">{event.actor_name ? `By ${event.actor_name}` : event.category} {event.metadata?.amount ? `· ${money(event.metadata.amount)}` : ""}</p></li>)}</ol>}
        </div>}
      </section>
    </div>
  );
}
