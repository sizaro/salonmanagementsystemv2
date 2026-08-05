const apiUrl = import.meta.env.VITE_API_URL || "";
const apiOrigin = apiUrl.replace(/\/api\/?$/, "").replace(/\/$/, "");

export function resolvePublicMedia(source, fallback = "/images/hero_image.jpg") {
  if (!source || source === "-") return fallback;
  if (/^https?:\/\//i.test(source)) return source;
  const normalized = source.startsWith("/") ? source : `/${source}`;
  if (normalized.startsWith("/images/")) return normalized;
  return apiOrigin ? `${apiOrigin}${normalized}` : normalized;
}

export function formatUgx(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `UGX ${amount.toLocaleString()}` : "Price on consultation";
}
