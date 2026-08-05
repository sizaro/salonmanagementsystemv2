import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import { salonQuotes } from "../../content/publicContent.js";

export default function QuoteInterlude() {
  return <section className="overflow-hidden bg-[var(--salon-copper)] py-16 text-white sm:py-20"><div className="salon-container"><motion.div initial={{ opacity: 0, scale: .97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: .5 }} className="mx-auto max-w-4xl text-center"><Quote className="mx-auto text-amber-200" size={36} /><blockquote className="mt-5 font-serif text-3xl font-semibold leading-tight sm:text-5xl">{salonQuotes[0]}</blockquote><p className="mt-6 text-xs font-bold uppercase tracking-[.25em] text-white/65">The Salehish philosophy</p></motion.div></div></section>;
}
