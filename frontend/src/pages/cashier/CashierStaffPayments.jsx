import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { DateTime } from "luxon";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const TIMEZONE = "Africa/Kampala";

const formatMoney = (amount) => `${Number(amount || 0).toLocaleString()} UGX`;
const formatHours = (minutes) => `${Math.floor(Number(minutes || 0) / 60)}h ${Number(minutes || 0) % 60}m`;
const formatClockTime = (value) => value
  ? DateTime.fromISO(String(value)).setZone(TIMEZONE).toFormat("dd LLL, h:mm a")
  : "—";

export default function CashierStaffPayments() {
  const today = DateTime.now().setZone(TIMEZONE);
  const [period, setPeriod] = useState("daily");
  const [date, setDate] = useState(today.toISODate());
  const [week, setWeek] = useState(today.toFormat("kkkk-'W'WW"));
  const [month, setMonth] = useState(today.toFormat("yyyy-MM"));
  const [year, setYear] = useState(String(today.year));
  const [payroll, setPayroll] = useState({ employees: [], period: null });
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

  const loadPayroll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get(`${API_URL}/reports/payroll`, { params, withCredentials: true });
      setPayroll(data);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Unable to load staff payments.");
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { void loadPayroll(); }, [loadPayroll]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Staff Payments</h1>
        <p className="mt-1 text-sm text-slate-600">Confirm each staff member’s earnings, advances, final amount, and attendance before payment.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-sm font-medium text-slate-700">Period
          <select value={period} onChange={(event) => setPeriod(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2">
            <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option>
          </select>
        </label>
        {period === "daily" && <label className="text-sm font-medium text-slate-700">Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2" /></label>}
        {period === "weekly" && <label className="text-sm font-medium text-slate-700">Week<input type="week" value={week} onChange={(event) => setWeek(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2" /></label>}
        {period === "monthly" && <label className="text-sm font-medium text-slate-700">Month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2" /></label>}
        {period === "yearly" && <label className="text-sm font-medium text-slate-700">Year<input type="number" min="2020" value={year} onChange={(event) => setYear(event.target.value)} className="mt-1 block w-28 rounded-lg border border-slate-300 px-3 py-2" /></label>}
      </div>

      {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[920px] w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-700"><tr>
            <th className="px-4 py-3">Staff member</th><th className="px-4 py-3">Clock in</th><th className="px-4 py-3">Clock out</th><th className="px-4 py-3">Hours</th><th className="px-4 py-3 text-right">Gross salary</th><th className="px-4 py-3 text-right">Advances</th><th className="px-4 py-3 text-right">Net salary</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="7" className="px-4 py-8 text-center text-slate-500">Loading staff payments…</td></tr> : payroll.employees.length ? payroll.employees.map((employee) => <tr key={employee.id} className="border-t border-slate-100">
              <td className="px-4 py-3 font-medium text-slate-800">{employee.name}<span className={`ml-2 rounded-full px-2 py-1 text-xs ${employee.isClockedIn ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{employee.isClockedIn ? "Clocked in" : "Clocked out"}</span></td>
              <td className="px-4 py-3 text-slate-600">{formatClockTime(employee.clockIn)}</td><td className="px-4 py-3 text-slate-600">{formatClockTime(employee.clockOut)}</td><td className="px-4 py-3 text-slate-600">{formatHours(employee.totalMinutes)}</td><td className="px-4 py-3 text-right">{formatMoney(employee.grossSalary)}</td><td className="px-4 py-3 text-right text-amber-700">{formatMoney(employee.advances)}</td><td className="px-4 py-3 text-right font-semibold text-emerald-700">{formatMoney(employee.netSalary)}</td>
            </tr>) : <tr><td colSpan="7" className="px-4 py-8 text-center text-slate-500">No staff payment records for this period.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
