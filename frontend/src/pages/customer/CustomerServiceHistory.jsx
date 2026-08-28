import { useMemo, useState } from "react";
import { CalendarDays, Scissors, WalletCards } from "lucide-react";
import { useData } from "../../context/DataContext.jsx";

const PAGE_SIZE = 10;
const money = (value) => `${Number(value || 0).toLocaleString("en-UG")} UGX`;

export default function CustomerServiceHistory() {
  const { transactions = [] } = useData();
  const [page, setPage] = useState(1);
  const history = useMemo(() => transactions.filter((service) => {
    const status = String(service.status || "").toLowerCase();
    return status === "completed" || status === "";
  }).sort((left, right) => String(right.service_date || right.appointment_date || "").localeCompare(String(left.service_date || left.appointment_date || ""))), [transactions]);
  const pageCount = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
  const items = history.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalSpent = history.reduce((sum, service) => sum + Number(service.full_amount ?? service.charged_service_amount ?? 0), 0);
  const professionalNames = (service) => (service.performers || []).map((performer) => [performer.first_name, performer.last_name].filter(Boolean).join(" ")).filter(Boolean).join(", ") || "Not recorded";

  return <div className="dashboard-page space-y-6">
    <header className="dashboard-hero"><p className="salon-eyebrow text-[var(--salon-copper)]">Your salon journey</p><h1 className="relative z-10 mt-2 font-serif text-3xl font-semibold sm:text-4xl">Service history</h1><p className="relative z-10 mt-2 text-stone-600">A private record of services completed for your account.</p></header>
    <div className="grid gap-4 sm:grid-cols-2"><article className="dashboard-card flex items-center gap-4"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-[var(--salon-copper)]"><Scissors size={21} /></span><div><p className="text-sm text-stone-500">Completed services</p><strong className="text-2xl">{history.length}</strong></div></article><article className="dashboard-card flex items-center gap-4"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><WalletCards size={21} /></span><div><p className="text-sm text-stone-500">Recorded total</p><strong className="text-2xl">{money(totalSpent)}</strong></div></article></div>
    {items.length === 0 ? <section className="dashboard-panel py-14 text-center"><Scissors className="mx-auto text-stone-300" size={38} /><h2 className="mt-4 font-serif text-2xl font-semibold">No completed services yet</h2><p className="mt-2 text-sm text-stone-500">Completed appointments and registered walk-in services will appear here.</p></section> : <section className="grid gap-4 md:grid-cols-2">{items.map((service) => <article key={service.transaction_id || service.id} className="dashboard-card transition hover:-translate-y-1 hover:shadow-lg"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[var(--salon-copper)]">{service.service_source === "online_booking" ? "Online appointment" : "Salon visit"}</p><h2 className="mt-2 font-serif text-2xl font-semibold">{service.service_name || "Salon service"}</h2></div><strong className="shrink-0 text-sm">{money(service.full_amount ?? service.charged_service_amount)}</strong></div><p className="mt-3 text-sm leading-6 text-stone-600">{service.description || "Professional salon service."}</p><dl className="mt-5 grid gap-3 border-t border-stone-200 pt-4 text-sm sm:grid-cols-2"><div><dt className="text-stone-500">Date</dt><dd className="mt-1 flex items-center gap-2 font-semibold"><CalendarDays size={15} /> {service.service_date || service.appointment_date || "Not recorded"}</dd></div><div><dt className="text-stone-500">Professional</dt><dd className="mt-1 font-semibold">{professionalNames(service)}</dd></div>{Number(service.discount_amount || 0) > 0 && <div><dt className="text-stone-500">Online discount</dt><dd className="mt-1 font-semibold text-emerald-700">-{money(service.discount_amount)}</dd></div>}</dl></article>)}</section>}
    {pageCount > 1 && <div className="flex items-center justify-center gap-3"><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded-xl border border-stone-300 px-4 py-2 disabled:opacity-40">Previous</button><span className="text-sm font-semibold">Page {page} of {pageCount}</span><button type="button" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)} className="rounded-xl border border-stone-300 px-4 py-2 disabled:opacity-40">Next</button></div>}
  </div>;
}
