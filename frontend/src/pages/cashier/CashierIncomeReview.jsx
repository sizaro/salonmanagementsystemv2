import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { DateTime } from "luxon";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const ZONE = "Africa/Kampala";

const buildParams = (period, value) => {
  if (period === "daily") return { period, date: value };
  if (period === "weekly") {
    const start = DateTime.fromFormat(value, "kkkk-'W'WW", { zone: ZONE }).startOf("week");
    return { period, startDate: start.toISODate(), endDate: start.endOf("week").toISODate() };
  }
  if (period === "monthly") {
    const month = DateTime.fromFormat(value, "yyyy-MM", { zone: ZONE });
    return { period, year: month.year, month: month.month };
  }
  return { period, year: Number(value) };
};

export default function CashierIncomeReview() {
  const today = DateTime.now().setZone(ZONE);
  const [period, setPeriod] = useState("daily");
  const [periodValue, setPeriodValue] = useState(today.toISODate());
  const [report, setReport] = useState({ summary: {}, services: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (period === "daily") setPeriodValue(today.toISODate());
    if (period === "weekly") setPeriodValue(today.toFormat("kkkk-'W'WW"));
    if (period === "monthly") setPeriodValue(today.toFormat("yyyy-MM"));
    if (period === "yearly") setPeriodValue(String(today.year));
  }, [period]);

  useEffect(() => {
    let current = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await axios.get(`${API_URL}/reports/cashier-income`, {
          params: buildParams(period, periodValue),
          withCredentials: true,
        });
        if (current) setReport(data);
      } catch (requestError) {
        if (current) setError(requestError.response?.data?.error || "Unable to load the income review.");
      } finally {
        if (current) setLoading(false);
      }
    };
    load();
    return () => { current = false; };
  }, [period, periodValue]);

  const inputType = useMemo(() => ({ daily: "date", weekly: "week", monthly: "month", yearly: "number" })[period], [period]);
  const money = (value) => new Intl.NumberFormat("en-UG").format(Number(value || 0));

  return (
    <div className="dashboard-page space-y-6">
      <header className="dashboard-hero">
        <p className="salon-eyebrow text-[var(--salon-copper)]">Cashier workspace</p>
        <h1 className="relative z-10 mt-2 font-serif text-3xl font-semibold">Income review</h1>
        <p className="relative z-10 mt-2 text-stone-600">A read-only view of completed services and collected service income.</p>
      </header>

      <section className="dashboard-panel flex flex-wrap items-end gap-4">
        <label className="text-sm font-semibold text-stone-700">Period<select className="dashboard-field mt-1" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label>
        <label className="text-sm font-semibold text-stone-700">Selected {period}<input className="dashboard-field mt-1" type={inputType} min={period === "yearly" ? "2020" : undefined} value={periodValue} onChange={(event) => setPeriodValue(event.target.value)} /></label>
      </section>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}
      {loading ? <div className="dashboard-panel text-center"><div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-4 border-stone-200 border-t-[var(--salon-copper)]" />Loading service income…</div> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="dashboard-card"><p className="text-sm text-stone-500">Completed services</p><p className="mt-2 text-3xl font-bold">{report.summary?.totalServices || 0}</p></article>
            <article className="dashboard-card"><p className="text-sm text-stone-500">Service income</p><p className="mt-2 text-3xl font-bold text-[var(--salon-copper)]">UGX {money(report.summary?.totalCollected)}</p></article>
          </div>
          <section className="dashboard-panel"><h2 className="mb-4 font-serif text-2xl font-semibold">Service details</h2><div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>Date and time</th><th>Service</th><th>Section</th><th>Customer</th><th>Professionals</th><th>Amount</th></tr></thead><tbody>{report.services?.length ? report.services.map((service) => <tr key={service.id}><td>{service.serviceDate}<br /><span className="text-xs text-stone-500">{service.serviceTime}</span></td><td>{service.serviceName}</td><td>{service.sectionName || "—"}</td><td>{service.customerName}</td><td>{service.performers?.map((performer) => `${performer.role}: ${performer.name}`).join(", ") || "—"}</td><td className="font-semibold">UGX {money(service.amount)}</td></tr>) : <tr><td colSpan="6" className="py-10 text-center text-stone-500">No completed services for this period.</td></tr>}</tbody></table></div></section>
        </>
      )}
    </div>
  );
}
