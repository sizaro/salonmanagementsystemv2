import { LoaderCircle } from "lucide-react";

export default function ReportLoadingState({ message = "Loading report data...", compact = false }) {
  return (
    <div
      className={`flex items-center justify-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 text-blue-800 ${compact ? "p-3 text-sm" : "min-h-56 p-8"}`}
      role="status"
      aria-live="polite"
    >
      <LoaderCircle className="shrink-0 animate-spin" size={compact ? 19 : 25} />
      <div>
        <p className="font-semibold">{message}</p>
        {!compact && <p className="mt-1 text-sm text-blue-700">Please wait. The figures and service details will appear when the request is complete.</p>}
      </div>
    </div>
  );
}
