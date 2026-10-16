import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ArrowRight, BellRing, Landmark, ShieldCheck, Signature } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useData } from "../../context/DataContext.jsx";

const API_URL = import.meta.env.VITE_API_URL || "/api";

const financePathForRole = (role) => {
  switch (role) {
    case "owner": return "/owner/finance";
    case "manager": return "/manager/finance";
    case "cashier": return "/cashier/staff-payments";
    case "employee": return "/employee/finance";
    default: return null;
  }
};

const isStatus = (row, status) => String(row?.workflow_status || "").toUpperCase() === status;

/**
 * A compact, role-aware finance inbox for dashboard pages. It deliberately
 * requests the existing role-protected finance lists rather than exposing a
 * second endpoint or finance details to an unauthorised role.
 */
export default function FinanceRequestNotice() {
  const navigate = useNavigate();
  const { user, financeUpdateVersion } = useData();
  const [records, setRecords] = useState({ advances: [], payments: [] });

  const role = String(user?.role || "").trim().toLowerCase();
  const financePath = financePathForRole(role);

  const load = useCallback(async () => {
    if (!user?.id || !financePath) return;
    try {
      const [advanceResponse, paymentResponse] = await Promise.all([
        axios.get(`${API_URL}/employee-finance/advance-requests`, { withCredentials: true }),
        axios.get(`${API_URL}/employee-finance/payments`, { withCredentials: true }),
      ]);
      setRecords({
        advances: advanceResponse.data?.requests || [],
        payments: paymentResponse.data?.payments || [],
      });
    } catch {
      // Dashboard access must remain usable if a finance refresh is briefly unavailable.
      setRecords({ advances: [], payments: [] });
    }
  }, [financePath, user?.id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (financeUpdateVersion) void load();
  }, [financeUpdateVersion, load]);

  const notice = useMemo(() => {
    const own = (row) => Number(row?.employee_id) === Number(user?.id);
    const reviews = role === "owner" || role === "manager"
      ? [...records.advances, ...records.payments].filter((row) => {
        if (!isStatus(row, "REQUESTED") || own(row)) return false;
        return role === "owner" || String(row.employee_role || "").toLowerCase() !== "manager";
      })
      : [];
    const disbursements = role === "cashier"
      ? [...records.advances, ...records.payments].filter((row) => isStatus(row, "APPROVED"))
      : [];
    const acknowledgements = ["employee", "manager", "cashier"].includes(role)
      ? [...records.advances, ...records.payments].filter((row) => own(row) && isStatus(row, "DISBURSED"))
      : [];
    const consents = ["employee", "manager", "cashier"].includes(role)
      ? records.advances.reduce(
        (total, row) => total + (own(row) ? (row.pending_payroll_deductions || []).length : 0),
        0,
      )
      : 0;

    const count = reviews.length + disbursements.length + acknowledgements.length + consents;
    if (!count) return null;

    if (reviews.length) {
      return {
        count,
        tab: "advances",
        icon: ShieldCheck,
        title: `${reviews.length} request${reviews.length === 1 ? "" : "s"} need${reviews.length === 1 ? "s" : ""} review`,
        detail: "Advance and payment requests are waiting for a management decision.",
        tone: "border-amber-200 bg-amber-50/80 text-amber-950",
      };
    }
    if (disbursements.length) {
      return {
        count,
        tab: "advances",
        icon: Landmark,
        title: `${disbursements.length} approved request${disbursements.length === 1 ? "" : "s"} await${disbursements.length === 1 ? "s" : ""} disbursement`,
        detail: "Record the authorised payment or advance disbursement.",
        tone: "border-sky-200 bg-sky-50/80 text-sky-950",
      };
    }
    return {
      count,
      tab: "advances",
      icon: Signature,
      title: `${count} finance action${count === 1 ? "" : "s"} need${count === 1 ? "s" : ""} your acknowledgement`,
      detail: consents
        ? "Review issued funds and any proposed payroll deduction before signing."
        : "Review issued funds and sign your receipt acknowledgement.",
      tone: "border-violet-200 bg-violet-50/80 text-violet-950",
    };
  }, [records, role, user?.id]);

  if (!notice || !financePath) return null;

  const Icon = notice.icon;
  return (
    <button
      type="button"
      onClick={() => navigate(`${financePath}?tab=${notice.tab}`)}
      className={`group flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--salon-copper)] focus:ring-offset-2 ${notice.tone}`}
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/75 shadow-sm">
        <Icon size={19} strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-bold">
          <BellRing size={15} aria-hidden="true" />
          {notice.title}
        </span>
        <span className="mt-0.5 block text-xs font-medium opacity-75">{notice.detail}</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold">
        Open finance <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </button>
  );
}
