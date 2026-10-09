import { useEffect, useRef, useState } from "react";
import Modal from "../Modal.jsx";

export default function SignatureDialog({ open, title, declaration, signerName, busy, onClose, onConfirm }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;
    const resize = () => {
      const box = canvas.getBoundingClientRect();
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = Math.max(Math.floor(box.width * ratio), 1);
      canvas.height = Math.max(Math.floor(box.height * ratio), 1);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = 2.2;
      context.strokeStyle = "#111827";
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, box.width, box.height);
      hasInkRef.current = false;
      setHasInk(false);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [open]);

  const point = (event) => {
    const box = canvasRef.current.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  const begin = (event) => {
    event.preventDefault();
    drawingRef.current = true;
    canvasRef.current.setPointerCapture?.(event.pointerId);
    const context = canvasRef.current.getContext("2d");
    const { x, y } = point(event);
    context.beginPath();
    context.moveTo(x, y);
  };
  const draw = (event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const context = canvasRef.current.getContext("2d");
    const { x, y } = point(event);
    context.lineTo(x, y);
    context.stroke();
    hasInkRef.current = true;
    setHasInk(true);
  };
  const end = () => { drawingRef.current = false; };
  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const box = canvas.getBoundingClientRect();
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, box.width, box.height);
    hasInkRef.current = false;
    setHasInk(false);
  };
  const confirm = () => {
    if (!hasInkRef.current) return;
    onConfirm(canvasRef.current.toDataURL("image/png"));
  };

  if (!open) return null;
  return <Modal isOpen onClose={busy ? undefined : onClose} sizeClass="max-w-2xl">
    <div className="space-y-5 p-2">
      <div><p className="text-sm font-semibold text-emerald-700">Secure acknowledgement</p><h2 className="mt-1 text-xl font-semibold text-slate-950">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{declaration}</p></div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">You are signing as <strong>{signerName || "the authenticated user"}</strong>. Your handwritten signature, account identity, timestamp, and the transaction details will be retained as receipt evidence.</div>
      <div className="overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-white shadow-inner"><canvas ref={canvasRef} aria-label="Handwritten signature pad" onPointerDown={begin} onPointerMove={draw} onPointerUp={end} onPointerCancel={end} onPointerLeave={end} className="block h-52 w-full touch-none cursor-crosshair" /></div>
      <p className="text-xs text-slate-500">Use a finger, stylus, or mouse. Draw your usual signature inside the box.</p>
      <div className="flex flex-wrap justify-end gap-3"><button type="button" onClick={clear} disabled={busy} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Clear</button><button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button><button type="button" onClick={confirm} disabled={busy || !hasInk} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving signature…" : "Confirm signature"}</button></div>
    </div>
  </Modal>;
}
