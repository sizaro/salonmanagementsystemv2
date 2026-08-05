import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

export default function CountUp({ value, suffix = "", label }) {
  const rootRef = useRef(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return undefined;
    let animation;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      const counter = { value: 0 };
      animation = gsap.to(counter, { value, duration: 1.7, ease: "power3.out", onUpdate: () => setDisplay(Math.round(counter.value)) });
      observer.disconnect();
    }, { threshold: 0.45 });
    observer.observe(node);
    return () => { observer.disconnect(); animation?.kill(); };
  }, [value]);

  return <div ref={rootRef}><p className="font-serif text-4xl font-semibold text-white sm:text-5xl">{display}{suffix}</p><p className="mt-2 text-sm font-medium text-white/65">{label}</p></div>;
}
