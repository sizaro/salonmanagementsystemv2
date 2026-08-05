import { Clock3, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { business } from "../../content/publicContent.js";
import SectionHeading from "../public/SectionHeading.jsx";

const contacts = [
  { icon: MessageCircle, label: "WhatsApp", value: business.whatsapp, response: "Usually the fastest response", href: business.whatsappHref },
  { icon: Phone, label: "Call us", value: business.phone, response: "Answered during opening hours", href: business.phoneHref },
  { icon: Mail, label: "Email", value: business.email, response: "Allow up to one business day", href: business.emailHref },
  { icon: MapPin, label: "Visit", value: "Cathedral Road, Bugembe", response: "Use Google directions before travelling", href: business.directionsUrl },
];

export default function ContactDetails() {
  return <section className="salon-section"><div className="salon-container"><SectionHeading eyebrow="Contact the salon" title="Choose the channel that works for you." description="WhatsApp is the quickest option for questions. Appointment requests themselves are made after creating and signing into a customer account." /><div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{contacts.map(({ icon: Icon, label, value, response, href }, index) => <a key={label} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" data-aos="fade-up" data-aos-delay={index * 70} className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-[var(--salon-copper)]"><Icon className="text-[var(--salon-copper)]" /><p className="mt-6 text-xs font-bold uppercase tracking-[.16em] text-slate-500">{label}</p><p className="mt-2 font-serif text-xl font-semibold">{value}</p><p className="mt-4 border-t border-stone-200 pt-4 text-xs font-medium text-slate-500"><Clock3 size={14} className="mr-1.5 inline" />{response}</p></a>)}</div></div></section>;
}
