import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, LogOut, Store } from "lucide-react";
import { useData } from "../../context/DataContext";

export default function SalonOpeningGate({ children }) {
  const { user, sessions, fetchSessions, openSalonSession, logoutUser } = useData();
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
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--salon-ink)] p-5 text-white">
        <img src="/images/salon_interior1.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--salon-ink)] via-[var(--salon-ink)]/95 to-amber-950/80" />
        <section className="relative w-full max-w-xl rounded-[2rem] border border-white/15 bg-white/10 p-6 text-center shadow-2xl backdrop-blur-xl sm:p-10">
          <img src={user?.image_url ? (String(user.image_url).startsWith("http") ? user.image_url : `${import.meta.env.VITE_STATIC_URL || "http://localhost:5500"}${user.image_url}`) : "/default-avatar.png"} alt="" className="mx-auto h-24 w-24 rounded-3xl border-4 border-white/80 object-cover shadow-xl" />
          <p className="mt-5 text-xs font-bold uppercase tracking-[.2em] text-amber-300">{user?.role || "Salon"} access</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold">Welcome, {user?.first_name || "team member"}</h1>
          <div className="mx-auto mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-300/15 text-amber-300"><Store size={27} /></div>
          <h2 className="mt-4 text-xl font-bold">Today&apos;s salon session is closed</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/65">Open the salon once to begin today&apos;s work. Your permitted dashboard tools will become available as soon as the session is ready.</p>
          {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button
            type="button"
            disabled={opening}
            onClick={openSalon}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 py-3 font-bold text-slate-950 transition hover:-translate-y-0.5 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {opening ? <><LoaderCircle className="animate-spin" size={19} /> Opening salon...</> : "Open Salon"}
          </button>
          {opening && <p className="mt-3 text-xs font-medium text-amber-200" aria-live="polite">Please wait while the salon session is created.</p>}
          <button type="button" onClick={logoutUser} disabled={opening} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white/65 transition hover:text-white disabled:opacity-50"><LogOut size={16} /> Log out</button>
        </section>
      </main>
    );
  }

  return children;
}
