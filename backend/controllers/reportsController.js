import { getReportData } from "../models/reportModel.js";

import {
  BUSINESS_TIMEZONE,
  resolveReportPeriod,
} from "../utils/reportPeriod.js";

import { DateTime } from "luxon";

// =========================================================
// HELPERS
// =========================================================

const toMillis = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
};

// =========================================================
// BUILD PAYROLL
// =========================================================
//
// getReportData already returns only income-producing
// transactions:
//
// completed services
// +
// temporary historical NULL-status services until migration.
//
// Therefore payroll calculations operate against exactly the
// same services used by the income report.
// =========================================================

const buildPayroll = (report) =>
  (report.employees || [])
    .filter((employee) =>
      ["employee", "manager", "cashier"].includes(
        String(employee.role || "")
          .trim()
          .toLowerCase(),
      ),
    )
    .map((employee) => {
      const employeeId = Number(employee.id);

      // ===================================================
      // GROSS SALARY FROM SERVICES
      // ===================================================

      const grossSalary = (report.services || []).reduce(
        (total, service) =>
          total +
          (service.performers || []).reduce(
            (serviceTotal, performer) =>
              Number(performer.employee_id) === employeeId
                ? serviceTotal +
                  Number(performer.role_amount ?? performer.earned_amount ?? 0)
                : serviceTotal,
            0,
          ),
        0,
      );

      // ===================================================
      // ADVANCES
      // ===================================================

      const advances = (report.advances || [])
        .filter((advance) => Number(advance.employee_id) === employeeId)
        .reduce((total, advance) => total + Number(advance.amount || 0), 0);

      // ===================================================
      // CLOCKINGS
      // ===================================================

      const shifts = (report.clockings || [])
        .filter((clocking) => Number(clocking.employee_id) === employeeId)
        .sort(
          (a, b) => (toMillis(a.clock_in) || 0) - (toMillis(b.clock_in) || 0),
        );

      const completedShifts = shifts.filter((shift) =>
        toMillis(shift.clock_out),
      );

      const totalMinutes = completedShifts.reduce(
        (total, shift) =>
          total +
          Math.max(
            0,
            ((toMillis(shift.clock_out) || 0) -
              (toMillis(shift.clock_in) || 0)) /
              60000,
          ),
        0,
      );

      // ===================================================
      // EMPLOYEE PAYROLL RESULT
      // ===================================================

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

// =========================================================
// OWNER / MANAGER REPORT
// =========================================================
//
// Used by OwnerIncomeReport.
//
// It returns the COMPLETE report from reportModel:
//
// services
// expenses
// advances
// clockings
// tagFees
// lateFees
// sessions
// employees
//
// Each service preserves:
//
// status
// service_source
// entry_type
// appointment_date
// appointment_time
// performers
// materials
// pricing fields
// =========================================================

export async function getReport(req, res) {
  try {
    const period = resolveReportPeriod(req.query);

    const report = await getReportData({
      salonId: Number(req.user.salon_id),

      ...period,

      timezone: BUSINESS_TIMEZONE,
    });

    return res.status(200).json(report);
  } catch (error) {
    console.error("REPORT ERROR:", error);

    return res.status(400).json({
      error: error.message || "Unable to create report",
    });
  }
}

// =========================================================
// CASHIER PAYROLL
// =========================================================

export async function getCashierPayroll(req, res) {
  try {
    const period = resolveReportPeriod(req.query);

    const report = await getReportData({
      salonId: Number(req.user.salon_id),

      ...period,

      timezone: BUSINESS_TIMEZONE,
    });

    return res.status(200).json({
      period: {
        ...period,

        timezone: BUSINESS_TIMEZONE,
      },

      employees: buildPayroll(report),
    });
  } catch (error) {
    console.error("CASHIER PAYROLL ERROR:", error);

    return res.status(400).json({
      error: error.message || "Unable to create payroll summary",
    });
  }
}

// =========================================================
// CASHIER DAILY INCOME REVIEW
// =========================================================
//
// IMPORTANT:
//
// Preserve service_source.
//
// Completed appointment:
//
// serviceSource = "online_booking"
//
// Completed walk-in:
//
// serviceSource = "walk_in"
//
// We do NOT infer the source from the status.
// We trust the persisted service_source field.
// =========================================================

export async function getCashierIncomeReview(req, res) {
  try {
    const salonId = Number(req.user.salon_id);

    const date =
      req.query.date || DateTime.now().setZone(BUSINESS_TIMEZONE).toISODate();

    const report = await getReportData({
      salonId,

      startDate: date,

      endDate: date,

      timezone: BUSINESS_TIMEZONE,
    });

    const services = (report.services || []).map((service) => ({
      // =================================================
      // TRANSACTION
      // =================================================

      id: service.transaction_id ?? service.id,

      transactionId: service.transaction_id ?? service.id,

      status: service.status,

      entryType: service.entry_type,

      serviceSource: service.service_source,

      // =================================================
      // SERVICE
      // =================================================

      serviceDefinitionId: service.service_definition_id,

      serviceName: service.service_name,

      sectionId: service.definition_section_id ?? service.section_id,

      sectionName: service.section_name,

      // =================================================
      // ACTUAL SERVICE DATE / TIME
      // =================================================

      serviceDate: service.service_date,

      serviceTime: service.service_time,

      // =================================================
      // ORIGINAL APPOINTMENT INFORMATION
      // =================================================
      //
      // These remain populated for an online booking after
      // it becomes completed.
      //
      // That lets us distinguish:
      //
      // appointment scheduled time
      //
      // from
      //
      // actual service completion time.
      // =================================================

      appointmentDate: service.appointment_date,

      appointmentTime: service.appointment_time,

      // =================================================
      // CUSTOMER
      // =================================================

      customerId: service.customer_id,

      activeCustomerId: service.active_customer_id,

      customerName:
        service.customer_name ||
        (service.customer_id ? null : "Walk-in customer"),

      customerNote: service.customer_note,

      // =================================================
      // PRICING
      // =================================================

      originalAmount: Number(
        service.original_amount ?? service.service_amount ?? 0,
      ),

      discountPercentage: Number(service.original_amount || 0) > 0
        ? (Number(service.discount_amount || 0) / Number(service.original_amount)) * 100
        : 0,

      discountAmount: Number(service.discount_amount ?? 0),

      serviceAmount: Number(service.full_amount ?? service.service_amount ?? 0),

      salonAmount: Number(service.salon_amount || 0),

      // =================================================
      // ACTUAL PERFORMERS
      // =================================================

      performers: (service.performers || []).map((performer) => ({
        roleId: performer.role_id,

        employeeId: performer.employee_id,

        name: `${performer.first_name || ""} ${
          performer.last_name || ""
        }`.trim(),

        role: performer.role_name,

        amount: Number(performer.role_amount ?? performer.earned_amount ?? 0),

        preferredEmployeeId: performer.preferred_employee_id,

        preferredName: `${performer.preferred_first_name || ""} ${
          performer.preferred_last_name || ""
        }`.trim(),
      })),

      // =================================================
      // MATERIALS
      // =================================================

      materials: service.materials || [],
    }));

    console.log("CASHIER DAILY COMPLETED SERVICES:", services);

    return res.status(200).json({
      period: {
        date,

        timezone: BUSINESS_TIMEZONE,
      },

      summary: {
        totalServices: services.length,

        walkInServices: services.filter(
          (service) =>
            String(service.serviceSource || "")
              .trim()
              .toLowerCase() === "walk_in",
        ).length,

        onlineBookingServices: services.filter(
          (service) =>
            String(service.serviceSource || "")
              .trim()
              .toLowerCase() === "online_booking",
        ).length,
      },

      services,
    });
  } catch (error) {
    console.error("CASHIER DAILY SERVICE REVIEW ERROR:", error);

    return res.status(400).json({
      error: error.message || "Unable to load today's services",
    });
  }
}

// =========================================================
// MY PAYROLL
// =========================================================

export async function getMyPayroll(req, res) {
  try {
    const period = resolveReportPeriod(req.query);

    const report = await getReportData({
      salonId: Number(req.user.salon_id),

      ...period,

      timezone: BUSINESS_TIMEZONE,
    });

    const employee = buildPayroll(report).find(
      (entry) => Number(entry.id) === Number(req.user.id),
    );

    return res.status(200).json({
      period: {
        ...period,

        timezone: BUSINESS_TIMEZONE,
      },

      employee: employee || null,
    });
  } catch (error) {
    console.error("MY PAYROLL ERROR:", error);

    return res.status(400).json({
      error: error.message || "Unable to load your pay summary",
    });
  }
}

// =========================================================
// MY INCOME REPORT
// =========================================================
//
// Employees only see completed/reportable services on which
// they were recorded as an ACTUAL performer.
//
// A customer preference alone does not count as work.
//
// preferred_employee_id therefore has no effect here.
// =========================================================

export async function getMyIncomeReport(req, res) {
  try {
    const period = resolveReportPeriod(req.query);

    const report = await getReportData({
      salonId: Number(req.user.salon_id),

      ...period,

      timezone: BUSINESS_TIMEZONE,
    });

    const employeeId = Number(req.user.id);

    // =====================================================
    // EMPLOYEE SERVICES
    // =====================================================

    const services = (report.services || [])
      .filter((service) =>
        service.performers?.some(
          (performer) => Number(performer.employee_id) === employeeId,
        ),
      )
      .map((service) => ({
        id: service.transaction_id ?? service.id,

        transactionId: service.transaction_id ?? service.id,

        serviceName: service.service_name,

        sectionName: service.section_name,

        serviceDate: service.service_date,

        serviceTime: service.service_time,

        status: service.status,

        // Preserve origin for employee history too.
        serviceSource: service.service_source,

        entryType: service.entry_type,

        appointmentDate: service.appointment_date,

        appointmentTime: service.appointment_time,

        earnings: (service.performers || [])
          .filter((performer) => Number(performer.employee_id) === employeeId)
          .reduce(
            (total, performer) =>
              total +
              Number(performer.role_amount ?? performer.earned_amount ?? 0),
            0,
          ),
      }));

    // =====================================================
    // ADVANCES
    // =====================================================

    const advances = (report.advances || [])
      .filter((advance) => Number(advance.employee_id) === employeeId)
      .reduce((total, advance) => total + Number(advance.amount || 0), 0);

    // =====================================================
    // CLOCKING
    // =====================================================

    const completedShifts = (report.clockings || []).filter(
      (clocking) =>
        Number(clocking.employee_id) === employeeId &&
        toMillis(clocking.clock_out),
    );

    const workedMinutes = completedShifts.reduce(
      (total, shift) =>
        total +
        Math.max(
          0,
          ((toMillis(shift.clock_out) || 0) - (toMillis(shift.clock_in) || 0)) /
            60000,
        ),
      0,
    );

    // =====================================================
    // EARNINGS
    // =====================================================

    const grossEarnings = services.reduce(
      (total, service) => total + service.earnings,
      0,
    );

    // =====================================================
    // RESPONSE
    // =====================================================

    return res.status(200).json({
      period: {
        ...period,

        timezone: BUSINESS_TIMEZONE,
      },

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
    console.error("MY INCOME REPORT ERROR:", error);

    return res.status(400).json({
      error: error.message || "Unable to load your income report",
    });
  }
}
