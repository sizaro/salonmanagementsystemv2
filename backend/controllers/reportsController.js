import { getEmployeeReportData, getEmployeeReportEmployees as getEmployeeReportEmployeesData, getReportData } from "../models/reportModel.js";

import {
  BUSINESS_TIMEZONE,
  resolveReportPeriod,
} from "../utils/reportPeriod.js";

import { DateTime } from "luxon";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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

const employeeReportOptions = (query) => {
  const employeeId = Number(query.employeeId);
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    const error = new Error("A valid employee id is required");
    error.statusCode = 400;
    throw error;
  }

  const page = Math.max(Number.parseInt(query.page || "1", 10) || 1, 1);
  const requestedSize = Number.parseInt(query.pageSize || "25", 10);
  const pageSize = [10, 25, 50, 100].includes(requestedSize) ? requestedSize : 25;
  const sectionId = query.sectionId ? Number(query.sectionId) : null;
  const serviceDefinitionId = query.serviceDefinitionId ? Number(query.serviceDefinitionId) : null;

  if (sectionId !== null && (!Number.isInteger(sectionId) || sectionId <= 0)) {
    const error = new Error("sectionId must be a positive integer");
    error.statusCode = 400;
    throw error;
  }
  if (serviceDefinitionId !== null && (!Number.isInteger(serviceDefinitionId) || serviceDefinitionId <= 0)) {
    const error = new Error("serviceDefinitionId must be a positive integer");
    error.statusCode = 400;
    throw error;
  }

  return {
    employeeId,
    page,
    pageSize,
    search: String(query.search || "").trim().slice(0, 120),
    sectionId,
    serviceDefinitionId,
    sortBy: String(query.sortBy || "serviceDate"),
    sortDirection: String(query.sortDirection || "desc"),
  };
};

const csvValue = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

const employeeReportCsv = (report) => {
  const headings = [
    "Transaction ID", "Date", "Time", "Service", "Section", "Source",
    "Full service value", "Selected employee earned amount", "Salon share",
    "Configured material estimate", "Shared service",
  ];
  const rows = report.services.map((service) => [
    service.transaction_id,
    service.service_date,
    service.service_time,
    service.service_name,
    service.section_name,
    service.service_source,
    service.full_amount,
    service.selected_earned_amount,
    service.salon_amount,
    service.configured_material_estimate,
    service.is_shared ? "Yes" : "No",
  ]);
  return [headings, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
};

const employeeReportPdf = async (report) => {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const pageSize = [595.28, 841.89];
  const margin = 40;
  const period = `${report.period.startDate} to ${report.period.endDate}`;
  const employeeName = [report.employee.first_name, report.employee.middle_name, report.employee.last_name]
    .filter(Boolean)
    .join(" ") || "Employee";
  let page;
  let y;

  const addPage = (continued = false) => {
    page = document.addPage(pageSize);
    y = pageSize[1] - margin;
    page.drawText("Salehish Beauty Parlour & Spa", { x: margin, y, size: 10, font: bold, color: rgb(0.38, 0.10, 0.24) });
    y -= 23;
    page.drawText(continued ? "Employee Report — continued" : "Employee Report", { x: margin, y, size: 18, font: bold, color: rgb(0.13, 0.10, 0.11) });
    y -= 18;
    page.drawText(`${employeeName}  |  ${period}`, { x: margin, y, size: 9, font: regular, color: rgb(0.35, 0.30, 0.29) });
    y -= 27;
  };
  const ensureSpace = (height = 15) => {
    if (y - height < margin) addPage(true);
  };
  const text = (value, options = {}) => {
    const size = options.size || 9;
    const font = options.bold ? bold : regular;
    const maxWidth = options.maxWidth || pageSize[0] - (margin * 2);
    const words = String(value ?? "").split(/\s+/);
    const lines = [];
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = candidate;
    });
    if (line) lines.push(line);
    lines.forEach((entry) => {
      ensureSpace(size + 6);
      page.drawText(entry, { x: options.x || margin, y, size, font, color: options.color || rgb(0.16, 0.13, 0.14) });
      y -= size + 6;
    });
  };
  const money = (value) => `UGX ${Number(value || 0).toLocaleString()}`;
  const finance = report.summary?.finance || {};

  addPage();
  text("Financial summary", { bold: true, size: 12 });
  text(`Period earnings: ${money(finance.earned_in_period)}   •   Payments disbursed: ${money(finance.paid_in_period)}   •   Closing payable: ${money(finance.closing_payable)}`);
  text(`Outstanding advances: ${money(finance.closing_advance_balance)}   •   Consented deductions: ${money(finance.deductions_in_period)}`);
  y -= 6;
  text(`Completed service details (${report.pagination.total_records} total)`, { bold: true, size: 12 });
  report.services.forEach((service, index) => {
    ensureSpace(56);
    text(`${index + 1}. ${service.service_date || ""} ${service.service_time || ""} — ${service.service_name || "Service"}`, { bold: true });
    text(`${service.section_name || "Unsectioned"} | Transaction value ${money(service.full_amount)} | Employee earned ${money(service.selected_earned_amount)} | Salon share ${money(service.salon_amount)}`);
    text(`${service.is_shared ? "Shared service" : "Individual service"}. Configured material estimate: ${money(service.configured_material_estimate)}.`, { size: 8 });
    y -= 3;
  });

  document.getPages().forEach((documentPage, index) => {
    documentPage.drawText(`Page ${index + 1} of ${document.getPageCount()}`, { x: pageSize[0] - margin - 65, y: 24, size: 8, font: regular, color: rgb(0.38, 0.34, 0.33) });
  });
  return Buffer.from(await document.save());
};

// =========================================================
// BUILD PAYROLL
// =========================================================
//
// getReportData already returns only income-producing
// transactions:
//
// completed services only.
//
// Historical transactions without a completion status remain in operational
// history, but are never treated as income by this report.
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

        // An advance is a separate cash record. It must never silently turn
        // earned income into a lower "net salary" before an explicit finance
        // settlement exists. Keep netSalary as a compatibility alias for old
        // screens, but make it equal the earned amount.
        netSalary: grossSalary,
        paymentEligibleEarnings: grossSalary,
        advancesDoNotReduceEarnings: true,

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

// Owner and manager employee reports are deliberately resolved on the server.
// This keeps other employees' service records out of the response and gives
// pagination, filters, and exports one authoritative financial calculation.
export async function getEmployeeReport(req, res) {
  try {
    const period = resolveReportPeriod(req.query);
    const options = employeeReportOptions({ ...req.query, employeeId: req.params.employeeId });
    const report = await getEmployeeReportData({
      salonId: Number(req.user.salon_id),
      ...period,
      ...options,
    });
    if (!report) return res.status(404).json({ error: "Employee was not found in this salon" });
    return res.json(report);
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      error: error.message || "Unable to load the employee report",
    });
  }
}

export async function getEmployeeReportEmployees(req, res) {
  try {
    const employees = await getEmployeeReportEmployeesData(Number(req.user.salon_id));
    return res.json(employees);
  } catch (error) {
    return res.status(400).json({
      error: error.message || "Unable to load employees for reporting",
    });
  }
}

export async function getMyEmployeeReport(req, res) {
  try {
    const period = resolveReportPeriod(req.query);
    const options = employeeReportOptions({ ...req.query, employeeId: req.user.id });
    const report = await getEmployeeReportData({
      salonId: Number(req.user.salon_id),
      ...period,
      ...options,
    });
    if (!report) return res.status(404).json({ error: "Your employee report is unavailable" });
    return res.json(report);
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      error: error.message || "Unable to load your employee report",
    });
  }
}

export async function exportEmployeeReportCsv(req, res) {
  try {
    const period = resolveReportPeriod(req.query);
    const options = employeeReportOptions({
      ...req.query,
      employeeId: req.params.employeeId || req.user.id,
      page: 1,
      pageSize: 100,
    });
    // The report query uses standard page sizes. Iterate until every matching
    // row is included, so an export never silently contains only page one.
    const firstPage = await getEmployeeReportData({
      salonId: Number(req.user.salon_id),
      ...period,
      ...options,
    });
    if (!firstPage) return res.status(404).json({ error: "Employee was not found in this salon" });

    const pages = [firstPage];
    for (let currentPage = 2; currentPage <= firstPage.pagination.total_pages; currentPage += 1) {
      pages.push(await getEmployeeReportData({
        salonId: Number(req.user.salon_id),
        ...period,
        ...options,
        page: currentPage,
      }));
    }
    const completeReport = {
      ...firstPage,
      services: pages.flatMap((item) => item.services),
    };
    const filePart = `${firstPage.employee.first_name || "employee"}-${firstPage.employee.last_name || firstPage.employee.id}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (String(req.query.format || "csv").toLowerCase() === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filePart}-report-${period.startDate}-to-${period.endDate}.pdf"`);
      return res.send(await employeeReportPdf(completeReport));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filePart}-report-${period.startDate}-to-${period.endDate}.csv"`);
    return res.send(employeeReportCsv(completeReport));
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      error: error.message || "Unable to export the employee report",
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

      collectionMethod: service.collection_method || "CASH",

      collectionReference: service.collection_reference || null,

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

        // Kept for older clients; advances are disclosed separately and do
        // not reduce this earning total automatically.
        netEarnings: grossEarnings,
        paymentEligibleEarnings: grossEarnings,
        advancesDoNotReduceEarnings: true,

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
