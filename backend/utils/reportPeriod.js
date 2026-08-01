import { DateTime } from "luxon";

export const BUSINESS_TIMEZONE = "Africa/Kampala";

const fromISODate = (value, name) => {
  const date = DateTime.fromISO(String(value || ""), { zone: BUSINESS_TIMEZONE }).startOf("day");
  if (!date.isValid) throw new Error(`${name} must be a valid YYYY-MM-DD date`);
  return date;
};

export const dailyPeriod = (date) => {
  const start = fromISODate(date, "date");
  return { startDate: start.toISODate(), endDate: start.toISODate() };
};

export const weeklyPeriod = (startDate, endDate) => {
  const start = fromISODate(startDate, "startDate");
  const end = fromISODate(endDate, "endDate");
  if (end < start) throw new Error("endDate must not be before startDate");
  return { startDate: start.toISODate(), endDate: end.toISODate() };
};

export const monthlyPeriod = (year, month) => {
  const start = DateTime.fromObject({ year: Number(year), month: Number(month), day: 1 }, { zone: BUSINESS_TIMEZONE });
  if (!start.isValid) throw new Error("year and month must be valid");
  return { startDate: start.toISODate(), endDate: start.endOf("month").toISODate() };
};

export const yearlyPeriod = (year) => {
  const start = DateTime.fromObject({ year: Number(year), month: 1, day: 1 }, { zone: BUSINESS_TIMEZONE });
  if (!start.isValid) throw new Error("year must be valid");
  return { startDate: start.toISODate(), endDate: start.endOf("year").toISODate() };
};

export const resolveReportPeriod = (query) => {
  switch (query.period) {
    case "daily": return dailyPeriod(query.date);
    case "weekly": return weeklyPeriod(query.startDate, query.endDate);
    case "monthly": return monthlyPeriod(query.year, query.month);
    case "yearly": return yearlyPeriod(query.year);
    default: throw new Error("period must be daily, weekly, monthly, or yearly");
  }
};
