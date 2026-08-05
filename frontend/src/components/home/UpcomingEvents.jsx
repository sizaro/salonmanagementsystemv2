import { ArrowUpRight, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import { upcomingEvents } from "../../content/publicContent.js";
import SectionHeading from "../public/SectionHeading.jsx";

export default function UpcomingEvents() {
  return <section className="salon-section bg-white"><div className="salon-container"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><SectionHeading eyebrow="What's happening" title="Events, celebrations and news worth sharing." description="Important salon updates now have a dedicated place separate from the everyday Salon Life gallery." /><Link to="/events-news" className="salon-button-secondary shrink-0">All events & news <ArrowUpRight size={17} /></Link></div><div className="mt-12 grid gap-5 lg:grid-cols-3">{upcomingEvents.map((event, index) => <article key={event.id} data-aos="fade-up" data-aos-delay={index * 80} className="group overflow-hidden rounded-[2rem] border border-stone-200 bg-[var(--salon-cream)]"><div className="overflow-hidden"><img src={event.image} alt="" className="aspect-[16/9] w-full object-cover transition duration-700 group-hover:scale-105" /></div><div className="p-6"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[var(--salon-copper)]"><CalendarDays size={15} /> {event.date}</p><h3 className="mt-4 font-serif text-2xl font-semibold">{event.title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{event.description}</p></div></article>)}</div></div></section>;
}
