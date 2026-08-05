import { CalendarCheck, CheckCircle2, LogIn, UserPlus } from "lucide-react";
import SectionHeading from "../public/SectionHeading.jsx";

const steps = [
  { icon: UserPlus, title: "Create a customer account", copy: "Open Portal in the navigation and choose Create customer account." },
  { icon: LogIn, title: "Sign in", copy: "Use your account details to open your private customer dashboard." },
  { icon: CalendarCheck, title: "Request an appointment", copy: "Choose a service and preferred schedule from the appointment area." },
  { icon: CheckCircle2, title: "Track confirmation", copy: "Return to the portal to see whether the salon has confirmed your request." },
];

export default function BookingPortalGuide() {
  return <section className="salon-section bg-[var(--salon-ink)] text-white"><div className="salon-container"><SectionHeading eyebrow="Appointments" title="Bookings live inside the customer portal." description="There is no separate contact-page booking form. Your account protects your booking history and keeps each request organised." light align="center" /><div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{steps.map(({ icon: Icon, title, copy }, index) => <article key={title} data-aos="fade-up" data-aos-delay={index * 80} className="rounded-3xl border border-white/10 bg-white/[.06] p-6"><div className="flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-300 text-slate-950"><Icon size={19} /></span><span className="font-serif text-3xl text-white/20">0{index + 1}</span></div><h3 className="mt-6 font-serif text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-7 text-white/60">{copy}</p></article>)}</div></div></section>;
}
