import { motion } from "framer-motion";
import { salonGoals } from "../../content/publicContent.js";
import SectionHeading from "../public/SectionHeading.jsx";

export default function SalonDirection() {
  return <section className="salon-section bg-[var(--salon-ink)] text-white"><div className="salon-container"><SectionHeading eyebrow="Where we are going" title="A clear vision, practical goals and a people-first focus." description="Our direction guides the decisions we make for guests, professionals and the community around us." light align="center" /><div className="mt-12 grid gap-5 lg:grid-cols-3">{salonGoals.map((item, index) => <motion.article key={item.title} initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .09 }} className="rounded-[2rem] border border-white/10 bg-white/[.06] p-7"><span className="font-serif text-4xl text-amber-300">0{index + 1}</span><h3 className="mt-5 font-serif text-2xl font-semibold">{item.title}</h3><p className="mt-3 leading-7 text-white/60">{item.copy}</p></motion.article>)}</div></div></section>;
}
