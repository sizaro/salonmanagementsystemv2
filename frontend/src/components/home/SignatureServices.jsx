import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import SectionHeading from "../public/SectionHeading.jsx";
import { formatUgx, resolvePublicMedia } from "../../lib/publicMedia.js";

const fallbacks = [
  { id: "cut", service_name: "Signature grooming", description: "Precision cutting, shaping and finishing tailored to your features.", service_amount: null, image_url: "/images/professional cuts.jpg" },
  { id: "braids", service_name: "Braids & protective styling", description: "Beautiful, considered styling created with patience and care.", service_amount: null, image_url: "/images/women plaiting2.jpg" },
  { id: "skin", service_name: "Restorative skin care", description: "A calm ritual that cleanses, refreshes and restores your natural glow.", service_amount: null, image_url: "/images/skin treatment.webp" },
];

export default function SignatureServices({ services = [] }) {
  const items = services.length ? services.slice(0, 3) : fallbacks;
  return <section className="salon-section bg-white"><div className="salon-container"><div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><SectionHeading eyebrow="Signature services" title="Expert care for every expression of you." description="Start with our most requested experiences or explore the complete service menu for more." /><Link to="/services" className="inline-flex items-center gap-2 font-semibold text-[var(--salon-copper)]">View all services <ArrowRight size={17} /></Link></div><div className="mt-12 grid gap-6 lg:grid-cols-3">{items.map((service, index) => <motion.article key={service.id || service.service_name} initial={{ opacity: 0, y: 35 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .25 }} transition={{ duration: .55, delay: index * .12 }} whileHover={{ y: -8 }} className="group overflow-hidden rounded-[2rem] border border-stone-200 bg-[var(--salon-cream)] shadow-sm"><div className="relative h-72 overflow-hidden"><img src={resolvePublicMedia(service.image_url, fallbacks[index]?.image_url)} alt={service.service_name} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" /><span className="absolute left-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-white/90 text-[var(--salon-copper)] shadow"><Sparkles size={18} /></span></div><div className="p-6"><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--salon-copper)]">Experience 0{index + 1}</p><h3 className="mt-3 font-serif text-2xl font-semibold">{service.service_name}</h3><p className="mt-3 min-h-14 text-sm leading-7 text-slate-600">{service.description || "Professional care delivered with precision and attention."}</p><p className="mt-5 font-semibold">{formatUgx(service.service_amount)}</p></div></motion.article>)}</div></div></section>;
}
