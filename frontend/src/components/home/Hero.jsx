import { useEffect, useRef } from "react";
import { ArrowDown, ArrowUpRight, CalendarCheck, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";

export default function Hero() {
  const rootRef = useRef(null);
  useEffect(() => {
    const context = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
      timeline.from("[data-hero-image]", { scale: 1.12, duration: 1.5 })
        .from("[data-hero-eyebrow]", { y: 22, opacity: 0, duration: 0.6 }, "-=1")
        .from("[data-hero-title]", { y: 55, opacity: 0, duration: 0.9 }, "-=0.35")
        .from("[data-hero-copy]", { y: 28, opacity: 0, duration: 0.7 }, "-=0.45")
        .from("[data-hero-actions]", { y: 22, opacity: 0, duration: 0.6 }, "-=0.35");
    }, rootRef);
    return () => context.revert();
  }, []);

  return (
    <section ref={rootRef} className="relative min-h-[calc(100svh-5rem)] bg-[var(--salon-ink)] text-white">
      <img data-hero-image src="/images/hero_image.jpg" alt="A professional stylist shaping a client's look" className="absolute inset-0 h-full w-full object-cover object-center" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(18,17,16,.94)_0%,rgba(18,17,16,.78)_42%,rgba(18,17,16,.25)_75%,rgba(18,17,16,.12)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_30%,rgba(207,151,90,.18),transparent_28%)]" />
      <div className="salon-container relative flex min-h-[calc(100svh-5rem)] items-center py-16">
        <div className="max-w-3xl">
          <p data-hero-eyebrow className="salon-eyebrow text-amber-300"><Sparkles size={15} /> Beauty · Grooming · Wellness</p>
          <h1 data-hero-title className="mt-5 max-w-3xl font-serif text-5xl font-semibold leading-[.98] tracking-tight sm:text-6xl lg:text-7xl xl:text-8xl">Leave feeling more like <span className="text-amber-300">yourself.</span></h1>
          <p data-hero-copy className="mt-7 max-w-2xl text-base leading-8 text-white/72 sm:text-lg">Salehish brings professional artistry, genuine care and restorative wellness into one welcoming beauty experience for women, men and families.</p>
          <div data-hero-actions className="mt-9 flex flex-wrap gap-3"><Link to="/contact" className="salon-button-gold"><CalendarCheck size={18} /> Book an appointment</Link><Link to="/services" className="salon-button-ghost">Explore services <ArrowUpRight size={17} /></Link></div>
          <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-white/60"><span className="flex items-center gap-2"><ShieldCheck size={16} className="text-amber-300" /> Hygiene-led care</span><span className="flex items-center gap-2"><Sparkles size={16} className="text-amber-300" /> Skilled professionals</span></div>
        </div>
      </div>
      <a href="#salon-introduction" aria-label="Explore the salon" className="absolute bottom-7 right-6 hidden h-14 w-14 place-items-center rounded-full border border-white/25 text-white transition hover:bg-white hover:text-slate-950 md:grid lg:right-12"><ArrowDown size={19} /></a>
    </section>
  );
}
