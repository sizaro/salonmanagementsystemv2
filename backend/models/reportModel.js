import db from "./database.js";
import { servicePricingSelect } from "../utils/servicePricingSql.js";

// =========================================================
// COMPLETED SERVICE REPORT QUERY
// =========================================================
//
// This query is shared by:
//
// daily
// weekly
// monthly
// yearly
//
// The controller determines:
//
// startDate
// endDate
//
// Revenue comes from completed services.
//
// service_source identifies whether the completed service
// originated as:
//
// walk_in
// online_booking
//
// appointment_date / appointment_time remain available for
// completed online bookings as historical booking information.
//
// IMPORTANT:
//
// JavaScript // comments must NOT be placed inside the SQL
// template string. Inside SQL we use -- comments.
// =========================================================

const serviceQuery = `
  SELECT

    -- =====================================================
    -- TRANSACTION
    -- =====================================================

    st.id AS transaction_id,

    st.id,

    st.salon_id,

    st.service_definition_id,

    st.customer_id,

    st.customer_note,

    st.created_by,

    st.status,

    st.entry_type,

    st.backdate_reason,

    st.service_source,

    COALESCE(NULLIF(BTRIM(st.collection_method), ''), 'CASH') AS collection_method,

    st.collection_reference,

    st.service_date::text AS service_date,

    st.service_time::text AS service_time,

    st.appointment_date::text AS appointment_date,

    st.appointment_time::text AS appointment_time,

    st.service_timestamp,

    st.created_at,

    st.updated_at,

    -- =====================================================
    -- SERVICE DEFINITION
    -- =====================================================

    sd.service_name,

    sd.description,

    ${servicePricingSelect},

    sd.section_id AS definition_section_id,

    sd.section_id AS section_id,

    sec.section_name,

    -- =====================================================
    -- CUSTOMER
    -- =====================================================

    customer.id AS active_customer_id,

    CASE
      WHEN customer.id IS NOT NULL
      THEN TRIM(
        CONCAT(
          COALESCE(customer.first_name, ''),
          ' ',
          COALESCE(customer.last_name, '')
        )
      )
      ELSE NULL
    END AS customer_name,

    -- =====================================================
    -- RECORDED BY
    -- =====================================================

    CASE
      WHEN creator.id IS NOT NULL
      THEN TRIM(
        CONCAT(
          COALESCE(creator.first_name, ''),
          ' ',
          COALESCE(creator.last_name, '')
        )
      )
      ELSE NULL
    END AS recorded_by_name,

    -- =====================================================
    -- PERFORMERS
    -- =====================================================

    COALESCE(
      (
        SELECT
          json_agg(
            jsonb_build_object(

              'role_id',
              sr.id,

              'role_name',
              sr.role_name,

              'role_amount',
              COALESCE(sp.earned_amount_snapshot, sr.earned_amount, 0),

              'earned_amount',
              COALESCE(sp.earned_amount_snapshot, sr.earned_amount, 0),

              'employee_id',
              actual_employee.id,

              'first_name',
              actual_employee.first_name,

              'last_name',
              actual_employee.last_name,

              'preferred_employee_id',
              preferred_employee.id,

              'preferred_first_name',
              preferred_employee.first_name,

              'preferred_last_name',
              preferred_employee.last_name
            )

            ORDER BY sp.id
          )

        FROM service_performers sp

        LEFT JOIN service_roles sr
          ON sr.id = sp.service_role_id

        LEFT JOIN users actual_employee
          ON actual_employee.id = sp.employee_id
         AND actual_employee.salon_id = st.salon_id

        LEFT JOIN users preferred_employee
          ON preferred_employee.id = sp.preferred_employee_id
         AND preferred_employee.salon_id = st.salon_id

        WHERE sp.service_transaction_id = st.id
          AND sp.salon_id = st.salon_id
      ),

      '[]'::json
    ) AS performers,

    -- =====================================================
    -- MATERIALS
    -- =====================================================

    COALESCE(
      (
        SELECT
          json_agg(
            jsonb_build_object(

              'material_name',
              sm.material_name,

              'material_cost',
              sm.material_cost
            )

            ORDER BY sm.id
          )

        FROM service_materials sm

        WHERE sm.service_definition_id = sd.id
          AND sm.salon_id = st.salon_id
      ),

      '[]'::json
    ) AS materials

  FROM service_transactions st

  -- =======================================================
  -- SERVICE DEFINITION
  -- =======================================================

  JOIN service_definitions sd
    ON sd.id = st.service_definition_id
   AND sd.salon_id = $3

  -- =======================================================
  -- SECTION
  -- =======================================================

  JOIN service_sections sec
    ON sec.id = sd.section_id
   AND sec.salon_id = $3

  LEFT JOIN users customer
    ON customer.id = st.customer_id
   AND customer.salon_id = st.salon_id

  LEFT JOIN users creator
    ON creator.id = st.created_by
   AND creator.salon_id = st.salon_id

  -- =======================================================
  -- REPORT PERIOD
  -- =======================================================

  WHERE st.salon_id = $3

    AND st.service_date
        BETWEEN $1::date AND $2::date

    -- =====================================================
    -- INCOME RULE
    -- =====================================================
    -- Income exists only when work is completed. Historical rows with no
    -- completion status remain available in operational history, but are not
    -- silently treated as income.
    -- =====================================================

    AND LOWER(TRIM(COALESCE(st.status, ''))) = 'completed'

  ORDER BY
    st.service_date DESC,
    st.service_time DESC,
    st.id DESC
`;

const numeric = (value) => Number(value || 0);

const materialEstimate = (service) => (service.materials || []).reduce(
  (sum, material) => sum + numeric(material.material_cost ?? material.cost),
  0,
);

const financeSummaryForPeriod = async ({ salonId, startDate, endDate, services, expenses, tagFees, lateFees }) => {
  const { rows } = await db.query(
    `WITH employee_scope AS (
       SELECT id AS employee_id
       FROM users
       WHERE salon_id = $1
         AND LOWER(COALESCE(role, '')) IN ('employee', 'manager', 'cashier')
     ),
     earnings AS (
       SELECT employee_id,
         COALESCE(SUM(amount) FILTER (WHERE earning_date BETWEEN $2::date AND $3::date), 0)::numeric AS earned_in_period,
         COALESCE(SUM(amount) FILTER (WHERE earning_date <= $3::date), 0)::numeric AS earned_to_period_end
       FROM employee_earnings
       WHERE salon_id = $1
         AND earning_date <= $3::date
         -- The old system paid these earnings automatically. They are retained
         -- as history, but cannot become a new-workflow payable balance.
         AND NOT EXISTS (
           SELECT 1 FROM employee_finance_cutovers cutover
           WHERE cutover.salon_id = employee_earnings.salon_id
             AND employee_earnings.earning_date <= cutover.legacy_ends_on
         )
       GROUP BY employee_id
     ),
     payments AS (
       SELECT employee_id,
         COALESCE(SUM(requested_amount) FILTER (WHERE payment_date BETWEEN $2::date AND $3::date), 0)::numeric AS payments_in_period,
         COALESCE(SUM(requested_amount) FILTER (WHERE payment_date BETWEEN $2::date AND $3::date AND UPPER(COALESCE(payment_method, 'CASH')) = 'CASH'), 0)::numeric AS cash_payments_in_period,
         COALESCE(SUM(requested_amount) FILTER (WHERE payment_date <= $3::date), 0)::numeric AS payments_to_period_end
       FROM (
         SELECT employee_id, requested_amount, payment_method,
           (COALESCE(disbursed_at, business_occurred_at, created_at) AT TIME ZONE 'Africa/Kampala')::date AS payment_date
         FROM employee_payments
         WHERE salon_id = $1 AND workflow_status IN ('DISBURSED', 'ACKNOWLEDGED')
       ) payment_rows
       GROUP BY employee_id
     ),
     advance_movements AS (
       SELECT ar.employee_id, ar.requested_amount AS amount,
         (COALESCE(ar.disbursed_at, ar.business_occurred_at, ar.created_at) AT TIME ZONE 'Africa/Kampala')::date AS advance_date
       FROM employee_advance_requests ar
       LEFT JOIN advances source_advance
         ON source_advance.id = ar.advance_id
        AND source_advance.salon_id = ar.salon_id
       LEFT JOIN employee_finance_cutovers cutover
         ON cutover.salon_id = ar.salon_id
       WHERE ar.salon_id = $1 AND ar.workflow_status IN ('DISBURSED', 'ACKNOWLEDGED')
         -- Only linked automatic legacy advances are closed here. A newly
         -- recorded past advance with paper evidence remains part of the
         -- controlled workflow even when its business date is historic.
         AND NOT (
           cutover.salon_id IS NOT NULL
           AND source_advance.id IS NOT NULL
           AND source_advance.advance_date <= cutover.legacy_ends_on
           AND COALESCE(ar.entry_type, 'CURRENT') <> 'PAST'
           AND ar.manual_receipt_url IS NULL
         )
     ),
     advances AS (
       SELECT employee_id,
         COALESCE(SUM(amount) FILTER (WHERE advance_date BETWEEN $2::date AND $3::date), 0)::numeric AS advances_in_period,
         COALESCE(SUM(amount) FILTER (WHERE advance_date <= $3::date), 0)::numeric AS advances_to_period_end
       FROM advance_movements
       GROUP BY employee_id
     ),
     settlements AS (
       SELECT employee_id,
         COALESCE(SUM(amount) FILTER (WHERE settlement_method = 'PAYROLL_DEDUCTION' AND settled_date BETWEEN $2::date AND $3::date), 0)::numeric AS payroll_deductions_in_period,
         COALESCE(SUM(amount) FILTER (WHERE settlement_method = 'PAYROLL_DEDUCTION' AND settled_date <= $3::date), 0)::numeric AS payroll_deductions_to_period_end,
         COALESCE(SUM(amount) FILTER (WHERE settlement_method = 'CASH_REPAYMENT' AND settled_date BETWEEN $2::date AND $3::date), 0)::numeric AS cash_repayments_in_period,
         COALESCE(SUM(amount) FILTER (WHERE settlement_method = 'WAIVED' AND settled_date BETWEEN $2::date AND $3::date), 0)::numeric AS waivers_in_period,
         COALESCE(SUM(amount) FILTER (WHERE settled_date <= $3::date), 0)::numeric AS settlements_to_period_end
       FROM (
         SELECT employee_id, amount, settlement_method,
           (settled_at AT TIME ZONE 'Africa/Kampala')::date AS settled_date
         FROM employee_advance_settlements
         WHERE salon_id = $1 AND workflow_status = 'EFFECTIVE'
       ) settlement_rows
       GROUP BY employee_id
     ),
     tag_fee_totals AS (
       SELECT employee_id, COALESCE(SUM(amount), 0)::numeric AS tag_fees_in_period
       FROM tag_fee
       WHERE salon_id = $1 AND fee_date BETWEEN $2::date AND $3::date
       GROUP BY employee_id
     ),
     late_fee_totals AS (
       SELECT employee_id, COALESCE(SUM(amount), 0)::numeric AS late_fees_in_period
       FROM late_fees
       WHERE salon_id = $1 AND fee_date BETWEEN $2::date AND $3::date
       GROUP BY employee_id
     )
     SELECT es.employee_id,
       COALESCE(e.earned_in_period, 0)::numeric AS earned_in_period,
       COALESCE(p.payments_in_period, 0)::numeric AS payments_in_period,
      COALESCE(p.cash_payments_in_period, 0)::numeric AS cash_payments_in_period,
       COALESCE(a.advances_in_period, 0)::numeric AS advances_in_period,
       COALESCE(s.payroll_deductions_in_period, 0)::numeric AS payroll_deductions_in_period,
       COALESCE(s.cash_repayments_in_period, 0)::numeric AS cash_repayments_in_period,
       COALESCE(s.waivers_in_period, 0)::numeric AS waivers_in_period,
       COALESCE(t.tag_fees_in_period, 0)::numeric AS tag_fees_in_period,
       COALESCE(l.late_fees_in_period, 0)::numeric AS late_fees_in_period,
       GREATEST(COALESCE(e.earned_to_period_end, 0) - COALESCE(p.payments_to_period_end, 0) - COALESCE(s.payroll_deductions_to_period_end, 0), 0)::numeric AS earnings_payable_at_period_end,
       GREATEST(COALESCE(a.advances_to_period_end, 0) - COALESCE(s.settlements_to_period_end, 0), 0)::numeric AS advances_outstanding_at_period_end
     FROM employee_scope es
     LEFT JOIN earnings e ON e.employee_id = es.employee_id
     LEFT JOIN payments p ON p.employee_id = es.employee_id
     LEFT JOIN advances a ON a.employee_id = es.employee_id
     LEFT JOIN settlements s ON s.employee_id = es.employee_id
     LEFT JOIN tag_fee_totals t ON t.employee_id = es.employee_id
     LEFT JOIN late_fee_totals l ON l.employee_id = es.employee_id
     ORDER BY es.employee_id`,
    [salonId, startDate, endDate],
  );

  const employees = rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, key === "employee_id" ? Number(value) : numeric(value)]),
  ));
  const total = (key) => employees.reduce((sum, employee) => sum + numeric(employee[key]), 0);
  const serviceRevenue = services.reduce((sum, service) => sum + numeric(service.full_amount ?? service.service_amount), 0);
  const configuredMaterialCostEstimate = services.reduce((sum, service) => sum + materialEstimate(service), 0);
  const businessExpenses = expenses.reduce((sum, expense) => sum + numeric(expense.amount), 0);
  const employeeEarnings = total("earned_in_period");
  const customerCollections = services.reduce(
    (totals, service) => {
      const method = String(service.collection_method || "CASH")
        .trim()
        .toUpperCase();
      const amount = numeric(service.full_amount ?? service.service_amount);
      const key = {
        CASH: "cash",
        MTN_MOMO: "mtn_mobile_money",
        AIRTEL_MONEY: "airtel_money",
        BANK_TRANSFER: "bank_transfer",
        OTHER: "other",
      }[method] || "other";

      totals[key] += amount;
      return totals;
    },
    {
      cash: 0,
      mtn_mobile_money: 0,
      airtel_money: 0,
      bank_transfer: 0,
      other: 0,
    },
  );
  const cashServiceReceipts = customerCollections.cash;
  const cashEmployeePayments = total("cash_payments_in_period");
  const cashAdvanceRepayments = total("cash_repayments_in_period");
  const cashOutflows = businessExpenses + cashEmployeePayments + total("advances_in_period");

  return {
    definition: {
      income_recognition: "COMPLETED_SERVICES_ONLY",
      material_cost: "CURRENT_SERVICE_DEFINITION_ESTIMATE",
      cash_position_available: false,
    },
    activity: {
      service_revenue: serviceRevenue,
      employee_earnings: employeeEarnings,
      configured_material_cost_estimate: configuredMaterialCostEstimate,
      business_expenses: businessExpenses,
      operating_margin: serviceRevenue - employeeEarnings - configuredMaterialCostEstimate - businessExpenses,
    },
    finance_movements: {
      employee_payments_disbursed: total("payments_in_period"),
      advances_disbursed: total("advances_in_period"),
      effective_payroll_deductions: total("payroll_deductions_in_period"),
      cash_advance_repayments: total("cash_repayments_in_period"),
      advance_waivers: total("waivers_in_period"),
      tag_fees_recorded: tagFees.reduce((sum, fee) => sum + numeric(fee.amount), 0),
      late_fees_recorded: lateFees.reduce((sum, fee) => sum + numeric(fee.amount), 0),
    },
    customer_collections: customerCollections,
    cash_position: {
      opening_balance_available: false,
      cash_received_from_services: cashServiceReceipts,
      cash_advance_repayments: cashAdvanceRepayments,
      cash_paid_to_employees: cashEmployeePayments,
      cash_advances_disbursed: total("advances_in_period"),
      cash_business_expenses: businessExpenses,
      net_cash_movement: cashServiceReceipts + cashAdvanceRepayments - cashOutflows,
    },
    closing_balances: {
      employee_earnings_payable: total("earnings_payable_at_period_end"),
      advances_outstanding: total("advances_outstanding_at_period_end"),
    },
    employees,
  };
};

// =========================================================
// GET REPORT DATA
// =========================================================
//
// Every report period eventually comes through this
// function.
//
// daily:
// startDate = selected day
// endDate   = selected day
//
// weekly:
// startDate = Monday
// endDate   = Sunday
//
// monthly:
// startDate = first day of month
// endDate   = last day of month
//
// yearly:
// startDate = January 1
// endDate   = December 31
// =========================================================

export async function getReportData({
  salonId,
  startDate,
  endDate,
  timezone = "Africa/Kampala",
}) {
  const [
    services,
    expenses,
    advances,
    clockings,
    tagFees,
    lateFees,
    sessions,
    employees,
  ] = await Promise.all([
    // =====================================================
    // SERVICES
    // =====================================================

    db.query(serviceQuery, [startDate, endDate, salonId]),

    // =====================================================
    // EXPENSES
    // =====================================================

    db.query(
      `
      SELECT
        e.id, e.name, e.amount, e.description, e.salon_id,
        e.expense_date::text AS expense_date,
        e.expense_time::text AS expense_time,
        e.entry_type, e.backdate_reason, e.created_at
      FROM expenses e
      WHERE e.salon_id = $3
        AND e.expense_date BETWEEN $1::date AND $2::date
      ORDER BY e.expense_date DESC, e.expense_time DESC, e.id DESC
      `,
      [startDate, endDate, salonId],
    ),

    // =====================================================
    // ADVANCES
    // =====================================================

    db.query(
      `
      SELECT
        a.id,
        a.employee_id,
        a.amount,
        a.description,
        a.salon_id,

        a.advance_date::text AS advance_date,

        a.advance_time::text AS advance_time,

        a.entry_type,

        a.backdate_reason,

        a.created_at,

        finance_request.id AS finance_request_id,
        finance_request.workflow_status AS finance_workflow_status,
        finance_request.requested_amount AS finance_requested_amount,
        finance_request.disbursed_at AS finance_disbursed_at,
        finance_request.acknowledged_at AS finance_acknowledged_at,
        finance_request.receipt_number AS finance_receipt_number,
        finance_receipt.id AS finance_receipt_id,
        COALESCE(settlements.settled_amount, 0)::numeric AS finance_settled_amount,
        CASE WHEN finance_request.id IS NULL THEN NULL
             ELSE GREATEST(finance_request.requested_amount - COALESCE(settlements.settled_amount, 0), 0)::numeric
        END AS finance_outstanding_amount,
        settlements.latest_settlement_at,
        settlements.settlement_receipt_numbers,

        u.first_name,

        u.last_name

      FROM advances a

      LEFT JOIN users u
        ON u.id = a.employee_id
       AND u.salon_id = $3

      LEFT JOIN employee_advance_requests finance_request
        ON finance_request.advance_id = a.id
       AND finance_request.salon_id = a.salon_id

      LEFT JOIN employee_finance_receipts finance_receipt
        ON finance_receipt.advance_request_id = finance_request.id
       AND finance_receipt.salon_id = a.salon_id

      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(asl.amount), 0)::numeric AS settled_amount,
               MAX(asl.settled_at) AS latest_settlement_at,
               STRING_AGG(asl.receipt_number, ', ' ORDER BY asl.settled_at DESC) AS settlement_receipt_numbers
        FROM employee_advance_settlements asl
        WHERE asl.advance_request_id = finance_request.id
          AND asl.salon_id = a.salon_id
      ) settlements ON TRUE

      WHERE a.salon_id = $3

        AND a.advance_date
            BETWEEN $1::date AND $2::date

      ORDER BY
        a.advance_date DESC,
        a.advance_time DESC
      `,
      [startDate, endDate, salonId],
    ),

    // =====================================================
    // EMPLOYEE CLOCKING
    // =====================================================

    db.query(
      `
      SELECT
        ec.*,

        u.first_name,

        u.last_name,

        (
          ec.clock_in_date +
          ec.clock_in_time
        ) AS clock_in,

        CASE

          WHEN ec.clock_out_date IS NOT NULL
           AND ec.clock_out_time IS NOT NULL

          THEN (
            ec.clock_out_date +
            ec.clock_out_time
          )

          ELSE NULL

        END AS clock_out

      FROM employee_clocking ec

      LEFT JOIN users u
        ON u.id = ec.employee_id
       AND u.salon_id = $3

      WHERE ec.salon_id = $3

        AND ec.clock_in_date
            BETWEEN $1::date AND $2::date

      ORDER BY
        ec.clock_in_date DESC,
        ec.clock_in_time DESC
      `,
      [startDate, endDate, salonId],
    ),

    // =====================================================
    // TAG FEES
    // =====================================================

    db.query(
      `
      SELECT
        tf.id, tf.employee_id, tf.amount, tf.reason, tf.salon_id,
        tf.fee_date::text AS fee_date,
        tf.fee_time::text AS fee_time,
        tf.entry_type, tf.backdate_reason, tf.created_at,

        CONCAT(
          u.first_name,
          ' ',
          u.last_name
        ) AS employee_name

      FROM tag_fee tf

      LEFT JOIN users u
        ON u.id = tf.employee_id
       AND u.salon_id = $3

      WHERE tf.salon_id = $3

        AND tf.fee_date BETWEEN $1::date AND $2::date

      ORDER BY tf.fee_date DESC, tf.fee_time DESC, tf.id DESC
      `,
      [startDate, endDate, salonId],
    ),

    // =====================================================
    // LATE FEES
    // =====================================================

    db.query(
      `
      SELECT
        lf.id, lf.employee_id, lf.amount, lf.reason, lf.salon_id,
        lf.fee_date::text AS fee_date,
        lf.fee_time::text AS fee_time,
        lf.entry_type, lf.backdate_reason, lf.created_at,

        CONCAT(
          u.first_name,
          ' ',
          u.last_name
        ) AS employee_name

      FROM late_fees lf

      LEFT JOIN users u
        ON u.id = lf.employee_id
       AND u.salon_id = $3

      WHERE lf.salon_id = $3

        AND lf.fee_date BETWEEN $1::date AND $2::date

      ORDER BY lf.fee_date DESC, lf.fee_time DESC, lf.id DESC
      `,
      [startDate, endDate, salonId],
    ),

    // =====================================================
    // SALON SESSIONS
    // =====================================================

    db.query(
      `
      SELECT
        id,

        salon_id,

        status,

        open_date::text AS open_date,

        open_time::text AS open_time,

        close_date::text AS close_date,

        close_time::text AS close_time,

        created_at,

        updated_at

      FROM salon_sessions

      WHERE salon_id = $3

        AND open_date
            BETWEEN $1::date AND $2::date

      ORDER BY
        open_date DESC,
        open_time DESC
      `,
      [startDate, endDate, salonId],
    ),

    // =====================================================
    // EMPLOYEES
    // =====================================================

    db.query(
      `
      SELECT
        u.*,

        (
          u.created_at AT TIME ZONE $2
        ) AS employee_time

      FROM users u

      WHERE u.salon_id = $1

        AND u.role IN (
          'employee',
          'manager',
          'owner',
          'cashier'
        )

      ORDER BY u.id ASC
      `,
      [salonId, timezone],
    ),
  ]);

  const financialSummary = await financeSummaryForPeriod({
    salonId,
    startDate,
    endDate,
    services: services.rows,
    expenses: expenses.rows,
    tagFees: tagFees.rows,
    lateFees: lateFees.rows,
  });

  // =======================================================
  // RETURN REPORT
  // =======================================================

  return {
    period: {
      startDate,
      endDate,
      timezone,
    },

    services: services.rows,

    expenses: expenses.rows,

    advances: advances.rows,

    clockings: clockings.rows,

    tagFees: tagFees.rows,

    lateFees: lateFees.rows,

    sessions: sessions.rows,

    employees: employees.rows,

    // The report pages use this server-calculated ledger view rather than
    // silently reducing wages by advance, tag-fee, or late-fee records.
    financial_summary: financialSummary,
  };
}

// =========================================================
// EMPLOYEE-SPECIFIC REPORT
// =========================================================
//
// This is intentionally separate from getReportData. The general income
// report needs the complete salon period, whereas an employee report must
// never depend on browser-side filtering of every employee's work history.
// Every service below is selected through an actual performer assignment;
// a preferred employee alone is not treated as completed work.
// =========================================================

const employeeReportSortColumns = {
  serviceDate: "st.service_date",
  serviceName: "sd.service_name",
  earnedAmount: "selected_earned_amount",
  serviceAmount: "full_amount",
};

const employeeReportNumber = (value) => Number(value || 0);

// This list belongs to the reporting module rather than the general users
// endpoint. General staff management is deliberately unavailable while the
// salon is closed, but historical reporting must remain available at any time.
export async function getEmployeeReportEmployees(salonId) {
  const result = await db.query(
    `SELECT id, salon_id, first_name, middle_name, last_name, role, specialty,
            status, image_url
     FROM users
     WHERE salon_id = $1
       AND LOWER(COALESCE(role, '')) IN ('employee', 'manager', 'cashier')
     ORDER BY LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))), id`,
    [salonId],
  );
  return result.rows;
}

export async function getEmployeeReportData({
  salonId,
  employeeId,
  startDate,
  endDate,
  page = 1,
  pageSize = 25,
  search = "",
  sectionId = null,
  serviceDefinitionId = null,
  sortBy = "serviceDate",
  sortDirection = "desc",
}) {
  const orderColumn = employeeReportSortColumns[sortBy] || employeeReportSortColumns.serviceDate;
  const direction = String(sortDirection).toLowerCase() === "asc" ? "ASC" : "DESC";
  const offset = (page - 1) * pageSize;
  const normalizedSearch = String(search || "").trim();

  const filters = `
    st.salon_id = $1
    AND st.service_date BETWEEN $3::date AND $4::date
    AND LOWER(TRIM(COALESCE(st.status, ''))) = 'completed'
    AND EXISTS (
      SELECT 1
      FROM service_performers assigned_performer
      WHERE assigned_performer.salon_id = st.salon_id
        AND assigned_performer.service_transaction_id = st.id
        AND assigned_performer.employee_id = $2
    )
    AND ($5::text = '' OR sd.service_name ILIKE '%' || $5::text || '%'
      OR sec.section_name ILIKE '%' || $5::text || '%')
    AND ($6::integer IS NULL OR sd.section_id = $6::integer)
    AND ($7::integer IS NULL OR st.service_definition_id = $7::integer)
  `;

  const params = [
    salonId,
    employeeId,
    startDate,
    endDate,
    normalizedSearch,
    sectionId,
    serviceDefinitionId,
  ];

  const [employeeResult, totalResult, servicesResult, financeResult, attendanceResult, sectionResult, serviceCountsResult, cutoverResult] = await Promise.all([
    db.query(
      `SELECT id, salon_id, first_name, middle_name, last_name, role, specialty,
              status, image_url, email
       FROM users
       WHERE id = $1 AND salon_id = $2
         AND LOWER(COALESCE(role, '')) IN ('employee', 'manager', 'cashier')`,
      [employeeId, salonId],
    ),
    db.query(
      `SELECT COUNT(*)::integer AS total
       FROM service_transactions st
       JOIN service_definitions sd ON sd.id = st.service_definition_id AND sd.salon_id = st.salon_id
       JOIN service_sections sec ON sec.id = sd.section_id AND sec.salon_id = st.salon_id
       WHERE ${filters}`,
      params,
    ),
    db.query(
      `SELECT
         st.id AS transaction_id,
         st.service_date::text AS service_date,
         st.service_time::text AS service_time,
         st.service_source,
         st.entry_type,
         sd.id AS service_definition_id,
         sd.service_name,
         sec.id AS section_id,
         sec.section_name,
         ${servicePricingSelect},
         COALESCE((
           SELECT SUM(sp.earned_amount_snapshot)
           FROM service_performers sp
           WHERE sp.salon_id = st.salon_id
             AND sp.service_transaction_id = st.id
             AND sp.employee_id = $2
         ), 0)::numeric AS selected_earned_amount,
         COALESCE((
           SELECT COUNT(*)
           FROM service_performers sp
           WHERE sp.salon_id = st.salon_id
             AND sp.service_transaction_id = st.id
             AND sp.employee_id IS NOT NULL
         ), 0)::integer AS performer_count,
         COALESCE((
           SELECT SUM(sm.material_cost)
           FROM service_materials sm
           WHERE sm.salon_id = st.salon_id
             AND sm.service_definition_id = sd.id
         ), 0)::numeric AS configured_material_estimate,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'employee_id', sp.employee_id,
             'name', TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))),
             'role_name', sr.role_name,
             'earned_amount', sp.earned_amount_snapshot,
             'is_selected_employee', sp.employee_id = $2
           ) ORDER BY sp.id)
           FROM service_performers sp
           LEFT JOIN users u ON u.id = sp.employee_id AND u.salon_id = sp.salon_id
           LEFT JOIN service_roles sr ON sr.id = sp.service_role_id
           WHERE sp.salon_id = st.salon_id
             AND sp.service_transaction_id = st.id
         ), '[]'::jsonb) AS performers,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'material_name', sm.material_name,
             'material_cost', sm.material_cost
           ) ORDER BY sm.id)
           FROM service_materials sm
           WHERE sm.salon_id = st.salon_id
             AND sm.service_definition_id = sd.id
         ), '[]'::jsonb) AS materials
       FROM service_transactions st
       JOIN service_definitions sd ON sd.id = st.service_definition_id AND sd.salon_id = st.salon_id
       JOIN service_sections sec ON sec.id = sd.section_id AND sec.salon_id = st.salon_id
       WHERE ${filters}
       ORDER BY ${orderColumn} ${direction}, st.service_time ${direction}, st.id ${direction}
       LIMIT $8::integer OFFSET $9::integer`,
      [...params, pageSize, offset],
    ),
    db.query(
      `WITH cutover AS (
         SELECT effective_from_date, legacy_ends_on
         FROM employee_finance_cutovers
         WHERE salon_id = $1
       ),
       earnings AS (
         SELECT
           COALESCE(SUM(ee.amount) FILTER (WHERE ee.earning_date < $3::date), 0)::numeric AS opening_earned,
           COALESCE(SUM(ee.amount) FILTER (WHERE ee.earning_date BETWEEN $3::date AND $4::date), 0)::numeric AS earned_in_period,
           COALESCE(SUM(ee.amount) FILTER (WHERE ee.earning_date <= $4::date), 0)::numeric AS earned_to_end
         FROM employee_earnings ee
         WHERE ee.salon_id = $1 AND ee.employee_id = $2
           AND NOT EXISTS (
             SELECT 1 FROM cutover c WHERE ee.earning_date <= c.legacy_ends_on
           )
       ),
       payments_source AS (
         SELECT ep.requested_amount,
           (COALESCE(ep.disbursed_at, ep.business_occurred_at, ep.created_at) AT TIME ZONE 'Africa/Kampala')::date AS business_date
         FROM employee_payments ep
         WHERE ep.salon_id = $1 AND ep.employee_id = $2
           AND ep.workflow_status IN ('DISBURSED', 'ACKNOWLEDGED')
       ),
       payments AS (
         SELECT
           COALESCE(SUM(requested_amount) FILTER (WHERE business_date < $3::date), 0)::numeric AS opening_paid,
           COALESCE(SUM(requested_amount) FILTER (WHERE business_date BETWEEN $3::date AND $4::date), 0)::numeric AS paid_in_period,
           COALESCE(SUM(requested_amount) FILTER (WHERE business_date <= $4::date), 0)::numeric AS paid_to_end
         FROM payments_source
       ),
       deductions_source AS (
         SELECT asl.amount, (asl.settled_at AT TIME ZONE 'Africa/Kampala')::date AS business_date
         FROM employee_advance_settlements asl
         WHERE asl.salon_id = $1 AND asl.employee_id = $2
           AND asl.workflow_status = 'EFFECTIVE'
           AND asl.settlement_method = 'PAYROLL_DEDUCTION'
       ),
       deductions AS (
         SELECT
           COALESCE(SUM(amount) FILTER (WHERE business_date < $3::date), 0)::numeric AS opening_deductions,
           COALESCE(SUM(amount) FILTER (WHERE business_date BETWEEN $3::date AND $4::date), 0)::numeric AS deductions_in_period,
           COALESCE(SUM(amount) FILTER (WHERE business_date <= $4::date), 0)::numeric AS deductions_to_end
         FROM deductions_source
       ),
       advances_source AS (
         SELECT ar.requested_amount,
           (COALESCE(ar.disbursed_at, ar.business_occurred_at, ar.created_at) AT TIME ZONE 'Africa/Kampala')::date AS business_date
         FROM employee_advance_requests ar
         LEFT JOIN advances source_advance ON source_advance.id = ar.advance_id AND source_advance.salon_id = ar.salon_id
         LEFT JOIN cutover c ON TRUE
         WHERE ar.salon_id = $1 AND ar.employee_id = $2
           AND ar.workflow_status IN ('DISBURSED', 'ACKNOWLEDGED')
           AND NOT (
             c.effective_from_date IS NOT NULL
             AND source_advance.id IS NOT NULL
             AND source_advance.advance_date <= c.legacy_ends_on
             AND COALESCE(ar.entry_type, 'CURRENT') <> 'PAST'
             AND ar.manual_receipt_url IS NULL
           )
       ),
       advances AS (
         SELECT
           COALESCE(SUM(requested_amount) FILTER (WHERE business_date < $3::date), 0)::numeric AS opening_advances,
           COALESCE(SUM(requested_amount) FILTER (WHERE business_date BETWEEN $3::date AND $4::date), 0)::numeric AS advances_in_period,
           COALESCE(SUM(requested_amount) FILTER (WHERE business_date <= $4::date), 0)::numeric AS advances_to_end
         FROM advances_source
       ),
       settlements_source AS (
         SELECT asl.amount, asl.settlement_method,
           (asl.settled_at AT TIME ZONE 'Africa/Kampala')::date AS business_date
         FROM employee_advance_settlements asl
         WHERE asl.salon_id = $1 AND asl.employee_id = $2 AND asl.workflow_status = 'EFFECTIVE'
       ),
       settlements AS (
         SELECT
           COALESCE(SUM(amount) FILTER (WHERE business_date < $3::date), 0)::numeric AS opening_settlements,
           COALESCE(SUM(amount) FILTER (WHERE business_date BETWEEN $3::date AND $4::date), 0)::numeric AS settlements_in_period,
           COALESCE(SUM(amount) FILTER (WHERE business_date <= $4::date), 0)::numeric AS settlements_to_end,
           COALESCE(SUM(amount) FILTER (WHERE settlement_method = 'CASH_REPAYMENT' AND business_date BETWEEN $3::date AND $4::date), 0)::numeric AS cash_repayments_in_period,
           COALESCE(SUM(amount) FILTER (WHERE settlement_method = 'WAIVED' AND business_date BETWEEN $3::date AND $4::date), 0)::numeric AS waivers_in_period
         FROM settlements_source
       )
       SELECT
         GREATEST(e.opening_earned - p.opening_paid - d.opening_deductions, 0)::numeric AS opening_payable,
         e.earned_in_period,
         p.paid_in_period,
         d.deductions_in_period,
         GREATEST(e.earned_to_end - p.paid_to_end - d.deductions_to_end, 0)::numeric AS closing_payable,
         GREATEST(a.opening_advances - s.opening_settlements, 0)::numeric AS opening_advance_balance,
         a.advances_in_period,
         s.cash_repayments_in_period,
         s.waivers_in_period,
         d.deductions_in_period AS payroll_deductions_in_period,
         GREATEST(a.advances_to_end - s.settlements_to_end, 0)::numeric AS closing_advance_balance
       FROM earnings e CROSS JOIN payments p CROSS JOIN deductions d CROSS JOIN advances a CROSS JOIN settlements s`,
      [salonId, employeeId, startDate, endDate],
    ),
    db.query(
      `SELECT
         COUNT(*) FILTER (WHERE ec.clock_out_date IS NOT NULL AND ec.clock_out_time IS NOT NULL)::integer AS completed_shifts,
         COUNT(*) FILTER (WHERE ec.clock_out_date IS NULL OR ec.clock_out_time IS NULL)::integer AS open_shifts,
         COALESCE(SUM(
           CASE WHEN ec.clock_out_date IS NOT NULL AND ec.clock_out_time IS NOT NULL
             THEN GREATEST(EXTRACT(EPOCH FROM ((ec.clock_out_date + ec.clock_out_time) - (ec.clock_in_date + ec.clock_in_time))) / 60, 0)
             ELSE GREATEST(EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'Africa/Kampala') - (ec.clock_in_date + ec.clock_in_time))) / 60, 0)
           END
         ), 0)::integer AS worked_minutes
       FROM employee_clocking ec
       WHERE ec.salon_id = $1 AND ec.employee_id = $2
         AND ec.clock_in_date BETWEEN $3::date AND $4::date`,
      [salonId, employeeId, startDate, endDate],
    ),
    db.query(
      `SELECT sec.id AS section_id, sec.section_name,
         COUNT(DISTINCT st.id)::integer AS service_count,
         COALESCE(SUM((
           SELECT SUM(sp.earned_amount_snapshot) FROM service_performers sp
           WHERE sp.salon_id = st.salon_id AND sp.service_transaction_id = st.id AND sp.employee_id = $2
         )), 0)::numeric AS employee_earned_amount,
         COALESCE(SUM(COALESCE(st.charged_service_amount, sd.service_amount)), 0)::numeric AS transaction_value
       FROM service_transactions st
       JOIN service_definitions sd ON sd.id = st.service_definition_id AND sd.salon_id = st.salon_id
       JOIN service_sections sec ON sec.id = sd.section_id AND sec.salon_id = st.salon_id
       WHERE ${filters}
       GROUP BY sec.id, sec.section_name
       ORDER BY employee_earned_amount DESC, sec.section_name ASC`,
      params,
    ),
    db.query(
      `SELECT sd.service_name, COUNT(DISTINCT st.id)::integer AS service_count,
         COALESCE(SUM((
           SELECT SUM(sp.earned_amount_snapshot) FROM service_performers sp
           WHERE sp.salon_id = st.salon_id AND sp.service_transaction_id = st.id AND sp.employee_id = $2
         )), 0)::numeric AS employee_earned_amount
       FROM service_transactions st
       JOIN service_definitions sd ON sd.id = st.service_definition_id AND sd.salon_id = st.salon_id
       JOIN service_sections sec ON sec.id = sd.section_id AND sec.salon_id = st.salon_id
       WHERE ${filters}
       GROUP BY sd.id, sd.service_name
       ORDER BY service_count DESC, sd.service_name ASC`,
      params,
    ),
    db.query(
      `SELECT effective_from_date::text AS effective_from_date,
              legacy_ends_on::text AS legacy_ends_on
       FROM employee_finance_cutovers WHERE salon_id = $1`,
      [salonId],
    ),
  ]);

  const employee = employeeResult.rows[0];
  if (!employee) return null;

  const finance = financeResult.rows[0] || {};
  const attendance = attendanceResult.rows[0] || {};
  const totalRecords = Number(totalResult.rows[0]?.total || 0);
  const financeSummary = Object.fromEntries(
    Object.entries(finance).map(([key, value]) => [key, employeeReportNumber(value)]),
  );
  const attendanceSummary = {
    completed_shifts: Number(attendance.completed_shifts || 0),
    open_shifts: Number(attendance.open_shifts || 0),
    worked_minutes: Number(attendance.worked_minutes || 0),
  };
  const sections = sectionResult.rows.map((row) => ({
    ...row,
    section_id: Number(row.section_id),
    service_count: Number(row.service_count || 0),
    employee_earned_amount: employeeReportNumber(row.employee_earned_amount),
    transaction_value: employeeReportNumber(row.transaction_value),
  }));
  const serviceCounts = serviceCountsResult.rows.map((row) => ({
    ...row,
    service_count: Number(row.service_count || 0),
    employee_earned_amount: employeeReportNumber(row.employee_earned_amount),
  }));

  return {
    employee,
    period: { startDate, endDate, timezone: "Africa/Kampala" },
    cutover: cutoverResult.rows[0] || null,
    summary: {
      services: {
        total_count: totalRecords,
        selected_employee_earned_amount: sections.reduce(
          (total, section) => total + section.employee_earned_amount,
          0,
        ),
      },
      finance: financeSummary,
      attendance: attendanceSummary,
    },
    sections,
    service_counts: serviceCounts,
    services: servicesResult.rows.map((service) => ({
      ...service,
      full_amount: employeeReportNumber(service.full_amount),
      salon_amount: employeeReportNumber(service.salon_amount),
      selected_earned_amount: employeeReportNumber(service.selected_earned_amount),
      configured_material_estimate: employeeReportNumber(service.configured_material_estimate),
      performer_count: Number(service.performer_count || 0),
      is_shared: Number(service.performer_count || 0) > 1,
    })),
    pagination: {
      page,
      page_size: pageSize,
      total_records: totalRecords,
      total_pages: Math.max(Math.ceil(totalRecords / pageSize), 1),
    },
  };
}
