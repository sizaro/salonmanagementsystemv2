import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { DateTime } from "luxon";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const TIMEZONE = "Africa/Kampala";
const money = (amount) => `${Number(amount || 0).toLocaleString()} UGX`;
const hours = (minutes) => `${Math.floor(Number(minutes || 0) / 60)}h ${Number(minutes || 0) % 60}m`;

export default function EmployeeIncomeReport() {
  const now = DateTime.now().setZone(TIMEZONE);
  const [period, setPeriod] = useState("daily");
  const [date, setDate] = useState(now.toISODate());
  const [week, setWeek] = useState(now.toFormat("kkkk-'W'WW"));
  const [month, setMonth] = useState(now.toFormat("yyyy-MM"));
  const [year, setYear] = useState(String(now.year));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const params = useMemo(() => {
    if (period === "daily") return { period, date };
    if (period === "weekly") {
      const start = DateTime.fromFormat(week, "kkkk-'W'WW", { zone: TIMEZONE }).startOf("week");
      return { period, startDate: start.toISODate(), endDate: start.endOf("week").toISODate() };
    }
    if (period === "monthly") {
      const [selectedYear, selectedMonth] = month.split("-");
      return { period, year: selectedYear, month: selectedMonth };
    }
    return { period, year };
  }, [period, date, week, month, year]);

  const loadReport = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data } = await axios.get(`${API_URL}/reports/my-income`, { params, withCredentials: true });
      setReport(data);
    } catch (requestError) {
      setReport(null);
      setError(requestError.response?.data?.error || "Unable to load your income report.");
    } finally { setLoading(false); }
  }, [params]);

  useEffect(() => { void loadReport(); }, [loadReport]);
  const summary = report?.summary || {};

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-1 sm:p-4">
      <div><h1 className="text-2xl font-semibold text-slate-900">My Income Report</h1><p className="mt-1 text-sm text-slate-600">Review the services you performed and your earnings for any selected period.</p></div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-sm font-medium text-slate-700">Period
          <select value={period} onChange={(event) => setPeriod(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select>
        </label>
        {period === "daily" && <label className="text-sm font-medium text-slate-700">Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2" /></label>}
        {period === "weekly" && <label className="text-sm font-medium text-slate-700">Week<input type="week" value={week} onChange={(event) => setWeek(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2" /></label>}
        {period === "monthly" && <label className="text-sm font-medium text-slate-700">Month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2" /></label>}
        {period === "yearly" && <label className="text-sm font-medium text-slate-700">Year<input type="number" min="2020" value={year} onChange={(event) => setYear(event.target.value)} className="mt-1 block w-28 rounded-lg border border-slate-300 px-3 py-2" /></label>}
      </div>

      {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[['Services performed', summary.totalServices || 0, 'text-slate-900'], ['Gross earnings', money(summary.grossEarnings), 'text-slate-900'], ['Advances', money(summary.advances), 'text-amber-700'], ['Net earnings', money(summary.netEarnings), 'text-emerald-700']].map(([label, value, color]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className={`mt-2 text-xl font-semibold ${color}`}>{value}</p></div>)}
      </section>
      <p className="text-sm text-slate-600">Completed clocked hours in this period: <span className="font-semibold text-slate-800">{hours(summary.workedMinutes)}</span></p>

      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4"><h2 className="font-semibold text-slate-900">Services I worked on</h2></div>
        <table className="min-w-[720px] w-full text-sm"><thead className="bg-slate-50 text-left text-slate-700"><tr><th className="px-4 py-3">Service</th><th className="px-4 py-3">Section</th><th className="px-4 py-3">Date & time</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">My earnings</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-500">Loading your services…</td></tr> : report?.services?.length ? report.services.map((service) => <tr key={service.id} className="border-t border-slate-100"><td className="px-4 py-3 font-medium text-slate-800">{service.serviceName}</td><td className="px-4 py-3 text-slate-600">{service.sectionName || '—'}</td><td className="px-4 py-3 text-slate-600">{service.serviceDate} {service.serviceTime}</td><td className="px-4 py-3 capitalize text-slate-600">{service.status || 'completed'}</td><td className="px-4 py-3 text-right font-semibold text-emerald-700">{money(service.earnings)}</td></tr>) : <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-500">No services recorded for this period.</td></tr>}</tbody>
        </table>
      </section>
    </div>
  );
}
