import CountUp from "../public/CountUp.jsx";
import SectionHeading from "../public/SectionHeading.jsx";
import { salonMilestones } from "../../content/publicContent.js";

export default function SalonReport() {
  return <section className="salon-section bg-white"><div className="salon-container"><SectionHeading eyebrow="Our progress" title="A simple report from the journey so far." description="These public milestones summarise our growth. Update them as the salon's verified figures change." align="center" /><div className="mt-12 grid gap-px overflow-hidden rounded-[2rem] bg-stone-200 sm:grid-cols-2 lg:grid-cols-4">{salonMilestones.map((item) => <article key={item.label} className="bg-[var(--salon-cream)] p-8 text-center"><p className="font-serif text-4xl font-semibold text-[var(--salon-copper)]"><CountUp value={item.value} suffix={item.suffix} /></p><p className="mt-3 text-sm font-semibold text-slate-600">{item.label}</p></article>)}</div></div></section>;
}
