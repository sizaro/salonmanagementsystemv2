// Format any UTC date string to EAT
const formatEAT = (dateString) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleString("en-UG", {
    timeZone: "Africa/Kampala",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export { formatEAT };
