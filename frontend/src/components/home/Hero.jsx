import { useEffect, useRef } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  CalendarCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";

export default function Hero() {
  const rootRef = useRef(null);
  useEffect(() => {
    const context = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
      timeline
        .from("[data-hero-image]", { scale: 1.12, duration: 1.5 })
        .from(
          "[data-hero-eyebrow]",
          { y: 22, opacity: 0, duration: 0.6 },
          "-=1",
        )
        .from(
          "[data-hero-title]",
          { y: 55, opacity: 0, duration: 0.9 },
          "-=0.35",
        )
        .from(
          "[data-hero-copy]",
          { y: 28, opacity: 0, duration: 0.7 },
          "-=0.45",
        )
        .from(
          "[data-hero-actions]",
          { y: 22, opacity: 0, duration: 0.6 },
          "-=0.35",
        );
    }, rootRef);
    return () => context.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      className="relative min-h-[calc(100svh-5rem)] overflow-hidden bg-[var(--salon-ink)] text-white"
    >
      <img
        data-hero-image
        src="/images/salehishhero.webp"
        alt="A professional stylist shaping a client's look"
        className="absolute inset-0 h-full w-full object-contain md:object-cover object-[center_35%] sm:object-[center_30%] md:object-center"
      />

      <div className="salon-container relative flex min-h-[calc(100svh-5rem)] flex-col py-8 sm:py-10">
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          <span className="inline-flex items-center gap-2 rounded-full bg-black/45 px-3 py-2 text-white shadow-sm backdrop-blur-[2px]">
            <ShieldCheck size={16} className="text-amber-300" />
            Hygiene-led care
          </span>

          <span className="inline-flex items-center gap-2 rounded-full bg-black/45 px-3 py-2 text-white shadow-sm backdrop-blur-[2px]">
            <Sparkles size={16} className="text-amber-300" />
            Skilled professionals
          </span>
        </div>

        <div className="mt-auto pb-2 sm:pb-3 md:-mb-10 -mb-1">
          <div data-hero-actions className="flex flex-wrap gap-3">
            <Link
              to="/contact"
              className="salon-button-gold drop-shadow-[0_3px_8px_rgba(0,0,0,0.45)]"
            >
              <CalendarCheck size={18} />
              Book an appointment
            </Link>

            <Link
              to="/services"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--salon-ink)] px-5 py-3 font-semibold text-white transition hover:bg-black drop-shadow-[0_3px_8px_rgba(0,0,0,0.45)]"
            >
              Explore services
              <ArrowUpRight size={17} />
            </Link>
          </div>
        </div>
      </div>

      <a
        href="#salon-introduction"
        aria-label="Explore the salon"
        className="absolute bottom-7 right-6 hidden h-14 w-14 place-items-center rounded-full border border-white/25 text-white transition hover:bg-white hover:text-slate-950 md:grid lg:right-12"
      >
        <ArrowDown size={19} />
      </a>
    </section>
  );
}
