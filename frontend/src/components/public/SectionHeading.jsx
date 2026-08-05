export default function SectionHeading({ eyebrow, title, description, align = "left", light = false }) {
  const centered = align === "center";
  return (
    <div className={`${centered ? "mx-auto text-center" : ""} max-w-3xl`}>
      {eyebrow && <p className={`salon-eyebrow ${light ? "text-amber-300" : "text-[var(--salon-copper)]"}`}>{eyebrow}</p>}
      <h2 className={`mt-3 font-serif text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl ${light ? "text-white" : "text-[var(--salon-ink)]"}`}>{title}</h2>
      {description && <p className={`mt-5 text-base leading-8 sm:text-lg ${light ? "text-white/70" : "text-slate-600"}`}>{description}</p>}
    </div>
  );
}
