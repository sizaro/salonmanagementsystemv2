import { useEffect, useRef, useState } from "react";
import { CirclePlay, Volume2, X } from "lucide-react";

export default function BackgroundVideoStory({ item, className = "", videoClassName = "aspect-[4/3]", showDate = true }) {
  const videoRef = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void video.play().catch(() => undefined);
      else video.pause();
    }, { threshold: 0.25 });
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setOpen(false); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!item) return null;

  return <>
    <button type="button" onClick={() => setOpen(true)} className={`group relative block w-full overflow-hidden rounded-[2rem] text-left ${className}`} aria-label={`Play ${item.title}`}>
      <video ref={videoRef} src={item.backgroundSrc} poster={item.poster} muted loop playsInline preload="metadata" className={`${videoClassName} h-full w-full object-cover transition duration-700 group-hover:scale-105`} />
      <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/10" />
      <span className="absolute inset-0 grid place-items-center"><span className="grid h-14 w-14 place-items-center rounded-full border border-white/40 bg-white/90 text-slate-950 shadow-xl transition group-hover:scale-110"><CirclePlay size={25} /></span></span>
      <span className="absolute bottom-5 left-5 right-5 z-10"><span className="block text-xs font-bold uppercase tracking-[.16em] text-amber-300">{item.category}{showDate && item.publishedAt ? ` · ${item.publishedAt}` : ""}</span><span className="mt-1 block font-serif text-2xl font-semibold text-white">{item.title}</span><span className="mt-2 flex items-center gap-1.5 text-xs font-medium text-white/65"><Volume2 size={14} /> Open to watch with sound</span></span>
    </button>
    {open && <div className="fixed inset-0 z-[120] grid place-items-center bg-black/92 p-4" role="dialog" aria-modal="true" aria-label={item.title} onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><button type="button" onClick={() => setOpen(false)} className="absolute right-5 top-5 z-10 grid h-11 w-11 place-items-center rounded-full bg-white text-slate-950 shadow-xl" aria-label="Close video"><X size={20} /></button><div className="w-full max-w-6xl"><div className="aspect-video overflow-hidden rounded-3xl bg-black shadow-2xl"><iframe src={item.src} title={item.title} className="h-full w-full" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowFullScreen /></div><p className="mt-4 text-center font-serif text-2xl text-white">{item.title}</p></div></div>}
  </>;
}
