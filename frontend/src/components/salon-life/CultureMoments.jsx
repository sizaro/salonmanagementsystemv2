import { CakeSlice, GraduationCap, HeartHandshake, UsersRound } from "lucide-react";
import SectionHeading from "../public/SectionHeading.jsx";

const moments = [
  { icon: CakeSlice, title: "People celebrations", copy: "Birthdays, personal milestones and the moments that remind us there are people behind every role." },
  { icon: GraduationCap, title: "Learning together", copy: "Team practice, service improvement and shared knowledge that strengthens the salon." },
  { icon: UsersRound, title: "Community connection", copy: "Guest conversations, local occasions and activities that keep Salehish connected to Bugembe." },
  { icon: HeartHandshake, title: "Recognition", copy: "Giving credit to reliable service, growth, creativity and the colleagues who support others." },
];

export default function CultureMoments() {
  return <section className="salon-section bg-white"><div className="salon-container"><SectionHeading eyebrow="More than appointments" title="A salon culture people can feel." description="The public story should also show the relationships, growth and everyday life that happen around the work." align="center" /><div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{moments.map(({ icon: Icon, title, copy }, index) => <article key={title} data-aos="fade-up" data-aos-delay={index * 70} className="rounded-3xl bg-[var(--salon-cream)] p-6"><Icon className="text-[var(--salon-copper)]" /><h3 className="mt-5 font-serif text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{copy}</p></article>)}</div></div></section>;
}
