import { useCallback, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "/api";

/** Keeps a report result local to the page that requested it. */
export default function useOwnerReport() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadReport = useCallback(async (filters) => {
    setLoading(true); setError(null);
    try {
      const { data } = await axios.get(`${API_URL}/reports`, { params: filters, withCredentials: true });
      setReport(data);
      return data;
    } catch (requestError) {
      setReport(null);
      setError(requestError.response?.data?.error || "Unable to load report");
      throw requestError;
    } finally { setLoading(false); }
  }, []);

  const fetchDailyData = useCallback((date) => loadReport({ period: "daily", date }), [loadReport]);
  const fetchWeeklyData = useCallback((startDate, endDate) => loadReport({ period: "weekly", startDate: typeof startDate === "string" ? startDate : startDate.toISOString().slice(0, 10), endDate: typeof endDate === "string" ? endDate : endDate.toISOString().slice(0, 10) }), [loadReport]);
  const fetchMonthlyData = useCallback((year, month) => loadReport({ period: "monthly", year, month }), [loadReport]);
  const fetchYearlyData = useCallback((year) => loadReport({ period: "yearly", year }), [loadReport]);
  return { report, loading, error, loadReport, fetchDailyData, fetchWeeklyData, fetchMonthlyData, fetchYearlyData };
}
