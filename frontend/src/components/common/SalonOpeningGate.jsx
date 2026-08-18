import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Store } from "lucide-react";
import { useData } from "../../context/DataContext";

export default function SalonOpeningGate({ children }) {
  const { sessions, fetchSessions, openSalonSession } = useData();
  const [checking, setChecking] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");

  const activeSession = useMemo(() => {
    if (Array.isArray(sessions)) {
      return sessions.find((session) => session?.status === "open") || null;
    }
    return sessions?.status === "open" ? sessions : null;
  }, [sessions]);

  useEffect(() => {
    let mounted = true;
    const checkSalon = async () => {
      try {
        const session = await fetchSessions();
        if (!session && mounted) setError("Unable to confirm the salon status. Please try again.");
      } catch {
        if (mounted) setError("Unable to confirm the salon status. Please try again.");
      } finally {
        if (mounted) setChecking(false);
      }
    };
    void checkSalon();
    return () => { mounted = false; };
  }, []);

  const openSalon = async () => {
    if (opening) return;
    setOpening(true);
    setError("");
    try {
      await openSalonSession();
    } catch (requestError) {
      setError(requestError.response?.data?.error || requestError.response?.data?.message || "The salon could not be opened.");
      await fetchSessions().catch(() => undefined);
    } finally {
      setOpening(false);
    }
  };

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6" aria-live="polite">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-5 text-slate-700 shadow-sm">
          <LoaderCircle className="animate-spin" size={22} />
          Checking today&apos;s salon session...
        </div>
      </main>
    );
  }

  if (!activeSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <Store size={30} />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-slate-900">Salon is closed</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Open today&apos;s salon session to unlock the permitted dashboard tools.</p>
          {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button
            type="button"
            disabled={opening}
            onClick={openSalon}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {opening ? <><LoaderCircle className="animate-spin" size={19} /> Opening salon...</> : "Open Salon"}
          </button>
          {opening && <p className="mt-3 text-xs font-medium text-emerald-700" aria-live="polite">Please wait while the salon session is created.</p>}
        </section>
      </main>
    );
  }

  return children;
}
