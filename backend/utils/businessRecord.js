import { DateTime } from "luxon";

export const KAMPALA_ZONE = "Africa/Kampala";

/**
 * Business timestamps describe when work actually happened. They intentionally
 * stay separate from created_at, which is the immutable database audit time.
 */
export function resolveBusinessDateTime({ entryType = "current", date, time, label }) {
  if (entryType === "current") {
    const now = DateTime.now().setZone(KAMPALA_ZONE);
    return { date: now.toISODate(), time: now.toFormat("HH:mm:ss") };
  }

  if (entryType === "past") {
    if (!date || !time) {
      const error = new Error(`Past ${label} requires a business date and time`);
      error.statusCode = 400;
      throw error;
    }
    return { date, time };
  }

  const error = new Error("Invalid entry type");
  error.statusCode = 400;
  throw error;
}

export function assertHistoricalRecordAccess({ user, entryType, reason, label }) {
  if (entryType !== "past") return;

  if (String(user?.role || "").toLowerCase() !== "owner") {
    const error = new Error(`Only the salon owner can create or edit past ${label} records`);
    error.statusCode = 403;
    throw error;
  }

  if (!String(reason || "").trim()) {
    const error = new Error(`A backdate reason is required for past ${label} records`);
    error.statusCode = 400;
    throw error;
  }
}
