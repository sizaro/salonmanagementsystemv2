import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { CalendarDays, HandCoins, WalletCards } from "lucide-react";
import { DateTime } from "luxon";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const ZONE = "Africa/Kampala";
const PAGE_SIZE = 10;
const money = (value) => `UGX ${Number(value || 0).toLocaleString("en-UG")}`;

export default function StaffFinanceSnapshot() {
  const [date, setDate] = useState(DateTime.now().setZone(ZONE).toISODate());
  const [snapshot, setSnapshot] = useState({ employees: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get(`${API_URL}/employee-finance/staff-snapshot`, {
        params: { date },
        withCredentials: true,
      });
      setSnapshot({ date: data.date, employees: data.employees || [] });
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Unable to load the staff finance overview.");
      setSnapshot({ employees: [] });
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [date]);

  const totals = useMemo(() => snapshot.employees.reduce((total, employee) => ({
    earnedToday: total.earnedToday + Number(employee.earned_today || 0),
    unpaid: total.unpaid + Number(employee.unpaid_amount || 0),
    advances: total.advances + Number(employee.advances_outstanding || 0),
  }), { earnedToday: 0, unpaid: 0, advances: 0 }), [snapshot.employees]);
  const totalPages = Math.max(1, Math.ceil(snapshot.employees.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const employees = snapshot.employees.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <div className="dashboard-page space-y-6">
      <header className="dashboard-hero">
        <p className="salon-eyebrow text-[var(--salon-copper)]">Staff finance</p>
        <h1 className="relative z-10 mt-2 font-serif text-3xl font-semibold">Team balance snapshot</h1>
        <p className="relative z-10 mt-2 text-stone-600">See what each active worker earned today, what remains payable, and any uncleared advances.</p>
      </header>

      <section className="dashboard-panel flex flex-wrap items-end justify-between gap-4">
        <label className="text-sm font-semibold text-stone-700">Snapshot date
          <span className="dashboard-field mt-1 flex items-center gap-2"><CalendarDays size={16} /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="min-w-0 bg-transparent outline-none" /></span>
        </label>
        <button type="button" onClick={() => void load()} className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-[var(--salon-copper)]">Refresh</button>
      </section>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</p>}

      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryCard icon={WalletCards} label="Earned today" value={money(totals.earnedToday)} detail="Completed-service earnings for the selected day" />
        <SummaryCard icon={HandCoins} label="Still with the salon" value={money(totals.unpaid)} detail="Earned less disbursed payments and effective deductions" />
        <SummaryCard icon={HandCoins} label="Outstanding advances" value={money(totals.advances)} detail="Disbursed advances not yet effectively settled" accent="text-amber-700" />
      </section>

      <section className="dashboard-panel">
        <div className="mb-5"><h2 className="font-serif text-2xl font-semibold text-[var(--salon-ink)]">Active staff balances</h2><p className="mt-1 text-sm text-stone-500">This is an operational overview. Open Staff Payments to request, review, disburse, or acknowledge finance actions.</p></div>
        {loading ? <div className="py-12 text-center text-stone-500">Loading staff finance…</div> : employees.length ? <><div className="dashboard-table-wrap overflow-x-auto"><table className="dashboard-table min-w-[860px]"><thead><tr><th>Staff member</th><th>Role</th><th>Earned today</th><th>Still with salon</th><th>Outstanding advances</th></tr></thead><tbody>{employees.map((employee) => <tr key={employee.employee_id}><td className="font-semibold text-stone-800">{`${employee.first_name || ""} ${employee.last_name || ""}`.trim() || "Unnamed staff member"}</td><td className="capitalize text-stone-600">{employee.role || "—"}</td><td className="font-semibold text-emerald-700">{money(employee.earned_today)}</td><td className="font-semibold text-[var(--salon-copper)]">{money(employee.unpaid_amount)}</td><td className="font-semibold text-amber-700">{money(employee.advances_outstanding)}</td></tr>)}</tbody></table></div><footer className="mt-4 flex flex-col gap-3 border-t border-stone-100 pt-4 text-sm text-stone-500 sm:flex-row sm:items-center sm:justify-between"><p>Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, snapshot.employees.length)} of {snapshot.employees.length} active staff</p><div className="flex items-center gap-3"><button type="button" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-stone-200 px-3 py-1.5 font-semibold text-stone-700 disabled:cursor-not-allowed disabled:opacity-40">Previous</button><span className="font-medium">Page {safePage} of {totalPages}</span><button type="button" disabled={safePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-lg border border-stone-200 px-3 py-1.5 font-semibold text-stone-700 disabled:cursor-not-allowed disabled:opacity-40">Next</button></div></footer></> : <div className="rounded-xl border border-dashed border-stone-200 py-12 text-center"><p className="font-medium text-stone-700">No active staff found</p><p className="mt-1 text-sm text-stone-500">Active employees, managers, and cashiers will appear here.</p></div>}
      </section>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, detail, accent = "text-[var(--salon-ink)]" }) {
  return <article className="dashboard-card"><span className="inline-flex rounded-xl bg-stone-100 p-2 text-[var(--salon-copper)]"><Icon size={18} /></span><p className="mt-4 text-sm text-stone-500">{label}</p><p className={`mt-1 text-2xl font-bold ${accent}`}>{value}</p><p className="mt-2 text-xs text-stone-500">{detail}</p></article>;
}
