import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, RotateCcw, X } from "lucide-react";

const resolveUrl = (url) => {
  if (!url || String(url).startsWith("http") || String(url).startsWith("blob:")) return url || "";
  const base = import.meta.env.VITE_STATIC_URL
    || (import.meta.env.MODE === "development" ? "http://localhost:5500" : "https://salonmanagementsystemv2-ru0i.onrender.com");
  return `${base}${url}`;
};

export default function ProfilePhotoInput({
  value,
  currentUrl = "",
  onChange,
  label = "Profile image",
  cameraTitle = "Take photo",
  facingMode = "user",
  documentMode = false,
}) {
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [previewUrl, setPreviewUrl] = useState(resolveUrl(currentUrl));

  useEffect(() => {
    if (!(value instanceof File)) {
      setPreviewUrl(resolveUrl(currentUrl));
      return undefined;
    }

    const objectUrl = URL.createObjectURL(value);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [value, currentUrl]);

  useEffect(() => {
    if (!cameraOpen || !cameraStream || !videoRef.current) return undefined;
    const video = videoRef.current;
    video.srcObject = cameraStream;
    video.play().catch(() => setCameraError("The camera could not begin playing. Restart it or choose an image instead."));
    return () => {
      if (video.srcObject === cameraStream) video.srcObject = null;
    };
  }, [cameraOpen, cameraStream]);

  const closeCamera = () => {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    setCameraReady(false);
    setCameraOpen(false);
  };

  useEffect(() => () => cameraStream?.getTracks().forEach((track) => track.stop()), [cameraStream]);

  const openCamera = async () => {
    setCameraError("");
    setCameraReady(false);
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode } },
        audio: false,
      });
      setCameraStream(stream);
    } catch {
      setCameraOpen(false);
      setCameraError("Camera access was not available. Allow camera permission, then try again or choose an image.");
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      onChange(new File(
        [blob],
        `${documentMode ? "national-id" : "profile"}-${Date.now()}.jpg`,
        { type: "image/jpeg" },
      ));
      closeCamera();
    }, "image/jpeg", 0.9);
  };

  const restartCamera = () => {
    closeCamera();
    window.setTimeout(openCamera, 50);
  };

  return (
    <div className="space-y-3">
      <div className={documentMode ? "space-y-3" : "flex flex-col gap-3 sm:flex-row sm:items-center"}>
        <div className={`overflow-hidden border-2 border-white bg-stone-100 shadow ${documentMode ? "h-56 w-full rounded-xl sm:h-64" : "h-28 w-28 rounded-3xl"}`}>
          {previewUrl ? <img src={previewUrl} alt={`${label} preview`} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center px-3 text-center text-xs text-stone-500">No image selected</div>}
        </div>
        <div className={documentMode ? "border-t border-stone-100 pt-3" : ""}>
          <p className="mb-2 text-sm font-medium text-gray-700">{label}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-semibold hover:border-[var(--salon-copper)]"><ImagePlus size={16} /> Choose image</button>
            <button type="button" onClick={openCamera} className="inline-flex items-center gap-2 rounded-xl bg-[var(--salon-ink)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90"><Camera size={16} /> {cameraTitle}</button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => onChange(event.target.files?.[0] || null)} />
          </div>
        </div>
      </div>

      {cameraError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{cameraError}</p>}

      {cameraOpen && (
        <div className="fixed inset-0 z-[1000000] grid place-items-center bg-black/85 p-3 sm:p-5">
          <section className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
              <div>
                <h3 className="font-serif text-xl font-semibold sm:text-2xl">{cameraTitle}</h3>
                <p className="mt-1 text-sm text-stone-500">{cameraReady ? "Position it clearly, then capture it." : "Connecting to your camera…"}</p>
              </div>
              <button type="button" onClick={closeCamera} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-100" aria-label="Close camera"><X size={18} /></button>
            </div>

            <div className="relative mx-4 overflow-hidden rounded-2xl bg-black sm:mx-5">
              <video ref={videoRef} autoPlay playsInline muted onLoadedMetadata={() => setCameraReady(true)} className="aspect-[4/3] max-h-[46vh] w-full object-cover" />
              {!cameraStream && <div className="absolute inset-0 grid place-items-center text-sm text-white">Requesting camera permission…</div>}
            </div>

            <div className="mt-4 flex shrink-0 flex-wrap justify-end gap-2 border-t border-stone-100 bg-white px-4 py-3 sm:px-5">
              <button type="button" onClick={restartCamera} className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold"><RotateCcw size={16} /> Restart</button>
              <button type="button" disabled={!cameraReady} onClick={capturePhoto} className="inline-flex items-center gap-2 rounded-xl bg-[var(--salon-copper)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Camera size={16} /> Use this photo</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
