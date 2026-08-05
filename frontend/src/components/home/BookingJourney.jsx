import { CalendarCheck, CheckCircle2, LogIn, UserPlus } from "lucide-react";
import SectionHeading from "../public/SectionHeading.jsx";

const steps = [
  { icon: UserPlus, title: "Create your account", copy: "Choose Create account in the Portal menu and register as a customer." },
  { icon: LogIn, title: "Sign in to the portal", copy: "Use your registered email and password to open your private customer dashboard." },
  { icon: CalendarCheck, title: "Choose and request", copy: "Select the service, preferred date and time, then submit your booking request." },
  { icon: CheckCircle2, title: "Receive confirmation", copy: "Follow the booking status in your portal and arrive after the salon confirms it." },
];

export default function BookingJourney() { return <section className="salon-section"><div className="salon-container"><SectionHeading eyebrow="Book through your portal" title="Your appointment starts with a customer account." description="The customer portal keeps your requests, confirmations and service history together." align="center" /><div className="relative mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">{steps.map(({ icon: Icon, title, copy }, index) => <article key={title} data-aos="fade-up" data-aos-delay={index * 90} className="relative rounded-3xl border border-stone-200 bg-white p-6 shadow-sm"><span className="absolute right-5 top-5 font-serif text-4xl text-stone-200">0{index + 1}</span><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--salon-ink)] text-amber-300"><Icon size={20} /></span><h3 className="mt-6 font-serif text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{copy}</p></article>)}</div></div></section>; }
