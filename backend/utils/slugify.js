/**
 * Convert a string into a URL-friendly slug
 * e.g., "My Salon Name" → "my-salon-name"
 */
export const generateSlug = (name) => {
  if (!name) return null;
  return name
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // remove invalid chars
    .replace(/\s+/g, "-")         // replace spaces with dashes
    .replace(/-+/g, "-");         // remove duplicate dashes
};
