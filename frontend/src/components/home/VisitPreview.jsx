import { Clock3, MapPin, MessageCircle, Navigation, Phone } from "lucide-react";
import { business } from "../../content/publicContent.js";
import SectionHeading from "../public/SectionHeading.jsx";

export default function VisitPreview() {
  const details = [
    { icon: MapPin, title: "Find us", value: "Cathedral Road, Bugembe" },
    { icon: Clock3, title: "Opening hours", value: "Monday-Saturday · 8 AM-8 PM" },
    { icon: Phone, title: "Call", value: business.phone, href: business.phoneHref },
    { icon: MessageCircle, title: "WhatsApp", value: "Fastest response", href: business.whatsappHref },
  ];
  return <section className="salon-section bg-white"><div className="salon-container grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-center"><div data-aos="fade-right"><SectionHeading eyebrow="Plan your visit" title="Easy to find from Bugembe Stage." description="We are on Cathedral Road, immediately after turning from the Jinja-Tororo Highway at Bugembe Stage." /><a href={business.directionsUrl} target="_blank" rel="noreferrer" className="salon-button-primary mt-8"><Navigation size={17} /> Open Google directions</a></div><div className="grid gap-4 sm:grid-cols-2">{details.map(({ icon: Icon, title, value, href }, index) => { const body = <><Icon className="text-[var(--salon-copper)]" /><h3 className="mt-5 text-sm font-bold uppercase tracking-[.14em] text-slate-500">{title}</h3><p className="mt-2 font-serif text-xl font-semibold">{value}</p></>; return href ? <a key={title} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" data-aos="fade-left" data-aos-delay={index * 70} className="rounded-3xl bg-[var(--salon-cream)] p-6 transition hover:-translate-y-1">{body}</a> : <article key={title} data-aos="fade-left" data-aos-delay={index * 70} className="rounded-3xl bg-[var(--salon-cream)] p-6">{body}</article>; })}</div></div></section>;
}
