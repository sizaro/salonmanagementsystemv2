import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, RotateCcw, X } from "lucide-react";

export default function ProfilePhotoInput({ value, currentUrl = "", onChange }) {
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const resolveCurrentUrl = (url) => {
    if (!url || String(url).startsWith("http") || String(url).startsWith("blob:")) return url || "";
    const staticBase = import.meta.env.VITE_STATIC_URL || (import.meta.env.MODE === "development" ? "http://localhost:5500" : "https://salonmanagementsystemv2-ru0i.onrender.com");
    return `${staticBase}${url}`;
  };
  const [previewUrl, setPreviewUrl] = useState(resolveCurrentUrl(currentUrl));

  useEffect(() => {
    if (!(value instanceof File)) {
      setPreviewUrl(resolveCurrentUrl(currentUrl));
      return undefined;
    }
    const objectUrl = URL.createObjectURL(value);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [value, currentUrl]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  useEffect(() => () => stopCamera(), []);

  const openCamera = async () => {
    setCameraError("");
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 0);
    } catch {
      setCameraError("Camera access was not available. Allow camera permission or choose a saved image.");
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      onChange(new File([blob], `profile-${Date.now()}.jpg`, { type: "image/jpeg" }));
      stopCamera();
    }, "image/jpeg", 0.88);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <img src={previewUrl || "/default-avatar.png"} alt="Profile preview" className="h-28 w-28 rounded-3xl border-4 border-white object-cover shadow-lg" />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold hover:border-[var(--salon-copper)]"><ImagePlus size={17} /> Choose image</button>
          <button type="button" onClick={openCamera} className="inline-flex items-center gap-2 rounded-xl bg-[var(--salon-ink)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"><Camera size={17} /> Take photo</button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => onChange(event.target.files?.[0] || null)} />
        </div>
      </div>

      {cameraError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{cameraError}</p>}

      {cameraOpen && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/85 p-4">
          <section className="w-full max-w-2xl rounded-3xl bg-white p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between"><div><h3 className="font-serif text-2xl font-semibold">Take profile photo</h3><p className="text-sm text-stone-500">Position your face clearly, then capture and review it.</p></div><button type="button" onClick={stopCamera} className="grid h-10 w-10 place-items-center rounded-full bg-stone-100" aria-label="Close camera"><X size={19} /></button></div>
            <video ref={videoRef} autoPlay playsInline muted className="aspect-[4/3] w-full rounded-2xl bg-black object-cover" />
            <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={openCamera} className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-4 py-2.5 font-semibold"><RotateCcw size={17} /> Restart</button><button type="button" onClick={capturePhoto} className="inline-flex items-center gap-2 rounded-xl bg-[var(--salon-copper)] px-5 py-2.5 font-semibold text-white"><Camera size={17} /> Use this photo</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
