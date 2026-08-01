import { getReportData } from "../models/reportModel.js";
import { BUSINESS_TIMEZONE, resolveReportPeriod } from "../utils/reportPeriod.js";

const toMillis = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
};

const buildPayroll = (report) => report.employees
  .filter((employee) => ["employee", "manager", "cashier"].includes(employee.role))
  .map((employee) => {
    const employeeId = Number(employee.id);
    const grossSalary = report.services.reduce((total, service) => (
      total + (service.performers || []).reduce((serviceTotal, performer) => (
        Number(performer.employee_id) === employeeId
          ? serviceTotal + Number(performer.role_amount || 0)
          : serviceTotal
      ), 0)
    ), 0);
    const advances = report.advances
      .filter((advance) => Number(advance.employee_id) === employeeId)
      .reduce((total, advance) => total + Number(advance.amount || 0), 0);
    const shifts = report.clockings
      .filter((clocking) => Number(clocking.employee_id) === employeeId)
      .sort((a, b) => (toMillis(a.clock_in) || 0) - (toMillis(b.clock_in) || 0));
    const completedShifts = shifts.filter((shift) => toMillis(shift.clock_out));
    const totalMinutes = completedShifts.reduce((total, shift) => (
      total + Math.max(0, ((toMillis(shift.clock_out) || 0) - (toMillis(shift.clock_in) || 0)) / 60000)
    ), 0);

    return {
      id: employee.id,
      name: `${employee.first_name || ""} ${employee.last_name || ""}`.trim(),
      grossSalary,
      advances,
      netSalary: grossSalary - advances,
      clockIn: shifts[0]?.clock_in || null,
      clockOut: completedShifts.at(-1)?.clock_out || null,
      isClockedIn: shifts.some((shift) => !toMillis(shift.clock_out)),
      totalMinutes: Math.round(totalMinutes),
    };
  });

export async function getReport(req, res) {
  try {
    const period = resolveReportPeriod(req.query);
    const report = await getReportData({ salonId: Number(req.user.salon_id), ...period, timezone: BUSINESS_TIMEZONE });
    res.json(report);
  } catch (error) {
    res.status(400).json({ error: error.message || "Unable to create report" });
  }
}

export async function getCashierPayroll(req, res) {
  try {
    const period = resolveReportPeriod(req.query);
    const report = await getReportData({ salonId: Number(req.user.salon_id), ...period, timezone: BUSINESS_TIMEZONE });
    res.json({ period: { ...period, timezone: BUSINESS_TIMEZONE }, employees: buildPayroll(report) });
  } catch (error) {
    res.status(400).json({ error: error.message || "Unable to create payroll summary" });
  }
}

export async function getMyPayroll(req, res) {
  try {
    const period = resolveReportPeriod(req.query);
    const report = await getReportData({ salonId: Number(req.user.salon_id), ...period, timezone: BUSINESS_TIMEZONE });
    const employee = buildPayroll(report).find((entry) => Number(entry.id) === Number(req.user.id));
    res.json({ period: { ...period, timezone: BUSINESS_TIMEZONE }, employee: employee || null });
  } catch (error) {
    res.status(400).json({ error: error.message || "Unable to load your pay summary" });
  }
}

export async function getMyIncomeReport(req, res) {
  try {
    const period = resolveReportPeriod(req.query);
    const report = await getReportData({ salonId: Number(req.user.salon_id), ...period, timezone: BUSINESS_TIMEZONE });
    const employeeId = Number(req.user.id);
    const services = report.services
      .filter((service) => service.performers?.some((performer) => Number(performer.employee_id) === employeeId))
      .map((service) => ({
        id: service.transaction_id,
        serviceName: service.service_name,
        sectionName: service.section_name,
        serviceDate: service.service_date,
        serviceTime: service.service_time,
        status: service.status,
        earnings: (service.performers || [])
          .filter((performer) => Number(performer.employee_id) === employeeId)
          .reduce((total, performer) => total + Number(performer.role_amount || 0), 0),
      }));
    const advances = report.advances
      .filter((advance) => Number(advance.employee_id) === employeeId)
      .reduce((total, advance) => total + Number(advance.amount || 0), 0);
    const completedShifts = report.clockings
      .filter((clocking) => Number(clocking.employee_id) === employeeId && toMillis(clocking.clock_out));
    const workedMinutes = completedShifts.reduce((total, shift) => (
      total + Math.max(0, ((toMillis(shift.clock_out) || 0) - (toMillis(shift.clock_in) || 0)) / 60000)
    ), 0);
    const grossEarnings = services.reduce((total, service) => total + service.earnings, 0);

    res.json({
      period: { ...period, timezone: BUSINESS_TIMEZONE },
      services,
      summary: {
        totalServices: services.length,
        grossEarnings,
        advances,
        netEarnings: grossEarnings - advances,
        workedMinutes: Math.round(workedMinutes),
      },
    });
  } catch (error) {
    res.status(400).json({ error: error.message || "Unable to load your income report" });
  }
}
