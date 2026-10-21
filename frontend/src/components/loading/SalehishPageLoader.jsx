import { useId, useMemo } from "react";
import "./salehish-loading.css";

export function SalehishPageLoader({
  fullscreen = true,
  message = "A BEAUTIFUL EXPERIENCE IS ON ITS WAY",
  className = "",
}) {
  const gradientId = useId().replace(/:/g, "");
  const particles = useMemo(() => Array.from({ length: 15 }, (_, i) => {
    const angle = i * 2.39996;
    const radius = 133 + (i % 4) * 10;
    return {
      left: `${150 + Math.cos(angle) * radius}px`,
      top: `${150 + Math.sin(angle) * radius}px`,
      size: `${1 + (i % 3)}px`,
      delay: `${-i * 0.3}s`,
    };
  }), []);

  return (
    <div className={`salehish-loader ${fullscreen ? "salehish-loader--fullscreen" : "salehish-loader--inline"} ${className}`.trim()} role="status" aria-live="polite" aria-label="Salehish is loading">
      <div className="salehish-loader__ambient salehish-loader__ambient--one" aria-hidden="true" />
      <div className="salehish-loader__ambient salehish-loader__ambient--two" aria-hidden="true" />
      <div className="salehish-loader__assembly" aria-hidden="true">
        <div className="salehish-loader__halo" />
        <svg className="salehish-loader__orbit" viewBox="0 0 300 300" focusable="false">
          <defs><linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#562049" /><stop offset="50%" stopColor="#b63272" /><stop offset="100%" stopColor="#70205c" /></linearGradient></defs>
          <circle className="salehish-loader__outer" cx="150" cy="150" r="133" />
          <path className="salehish-loader__ring" d="M150 29 A121 121 0 1 1 92 44" stroke={`url(#${gradientId})`} />
        </svg>
        <div className="salehish-loader__emblem">
          <svg className="salehish-loader__flame" viewBox="0 0 45 70" focusable="false"><path d="M24 2 C34 19 10 26 19 45 C5 34 12 19 24 2Z" fill="#9e235a" /><path d="M29 12 C43 31 22 39 24 59 C15 48 33 35 29 12Z" fill="#25204b" /><path d="M20 25 C29 40 12 49 20 68 C6 54 10 41 20 25Z" fill="#c02e65" /></svg>
          <div className="salehish-loader__name">SALEHISH BEAUTY</div><div className="salehish-loader__rule" /><div className="salehish-loader__subtitle">PARLOUR &amp; SPA</div>
        </div>
        {particles.map((particle, index) => <span key={index} className="salehish-loader__spark" style={{ left: particle.left, top: particle.top, width: particle.size, height: particle.size, animationDelay: particle.delay }} />)}
      </div>
      <div className="salehish-loader__caption">{message}</div>
    </div>
  );
}