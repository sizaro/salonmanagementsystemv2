import CountUp from "../public/CountUp.jsx";

export default function TrustStats() {
  const stats = [{ value: 6, suffix: "+", label: "Years of dedicated service" }, { value: 20, suffix: "+", label: "Beauty and wellness services" }, { value: 7, suffix: " days", label: "Flexible appointment access" }, { value: 1000, suffix: "+", label: "Guest visits and growing" }];
  return <section className="bg-[var(--salon-ink)]"><div className="salon-container grid gap-8 border-t border-white/10 py-10 sm:grid-cols-2 lg:grid-cols-4">{stats.map((stat) => <CountUp key={stat.label} {...stat} />)}</div></section>;
}
