import { LoaderCircle } from "lucide-react";
import { TableSkeleton } from "../loading/DashboardSkeleton.jsx";

export default function ReportLoadingState({ message = "Loading report data...", compact = false }) {
  if (!compact) {
    return <section className="rounded-2xl border border-[rgba(137,72,111,.14)] bg-white/60 p-5 shadow-sm backdrop-blur-sm" role="status" aria-live="polite"><p className="mb-4 text-sm font-semibold text-[var(--salon-ink)]">{message}</p><TableSkeleton rows={5} /></section>;
  }

  return (
    <div
      className="flex items-center justify-center gap-3 rounded-2xl border border-[rgba(137,72,111,.16)] bg-white/70 p-3 text-sm text-[var(--salon-ink)] shadow-sm backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <LoaderCircle className="shrink-0 animate-spin" size={compact ? 19 : 25} />
      <div>
        <p className="font-semibold">{message}</p>
      </div>
    </div>
  );
}
