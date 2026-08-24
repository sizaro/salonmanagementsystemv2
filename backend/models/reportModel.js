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

    st.service_source,

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

    active_customer.id AS active_customer_id,

    CASE
      WHEN active_customer.id IS NOT NULL
      THEN TRIM(
        CONCAT(
          COALESCE(active_customer.first_name, ''),
          ' ',
          COALESCE(active_customer.last_name, '')
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
              sr.earned_amount,

              'earned_amount',
              sr.earned_amount,

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

  -- =======================================================
  -- LEGACY CUSTOMER -> ACTIVE USER
  -- =======================================================
  -- service_transactions.customer_id can contain the
  -- legacy usermain ID.
  --
  -- Resolve the current users record using the email
  -- attached to the legacy record.
  -- =======================================================

  LEFT JOIN usermain legacy_customer
    ON legacy_customer.id = st.customer_id

  LEFT JOIN users active_customer
    ON active_customer.salon_id = st.salon_id
   AND LOWER(active_customer.email) =
       LOWER(legacy_customer.email)

  -- =======================================================
  -- LEGACY CREATOR -> ACTIVE USER
  -- =======================================================

  LEFT JOIN usermain legacy_creator
    ON legacy_creator.id = st.created_by

  LEFT JOIN users creator
    ON creator.salon_id = st.salon_id
   AND LOWER(creator.email) =
       LOWER(legacy_creator.email)

  -- =======================================================
  -- REPORT PERIOD
  -- =======================================================

  WHERE st.salon_id = $3

    AND st.service_date
        BETWEEN $1::date AND $2::date

    -- =====================================================
    -- INCOME RULE
    -- =====================================================
    -- For now historical transactions with NULL status are
    -- still included together with completed transactions.
    --
    -- Pending, confirmed and cancelled appointments are
    -- excluded from income.
    --
    -- After historical NULL records are migrated to
    -- completed, this condition can become:
    --
    -- AND LOWER(TRIM(st.status)) = 'completed'
    -- =====================================================

    AND (
      st.status IS NULL
      OR LOWER(TRIM(st.status)) = 'completed'
    )

  ORDER BY
    st.service_date DESC,
    st.service_time DESC,
    st.id DESC
`;

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
      SELECT *

      FROM expenses

      WHERE salon_id = $3

        AND (
          created_at AT TIME ZONE $4
        )::date BETWEEN $1::date AND $2::date

      ORDER BY created_at DESC
      `,
      [startDate, endDate, salonId, timezone],
    ),

    // =====================================================
    // ADVANCES
    // =====================================================

    db.query(
      `
      SELECT
        a.*,

        u.first_name,

        u.last_name

      FROM advances a

      LEFT JOIN users u
        ON u.id = a.employee_id
       AND u.salon_id = $3

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
        tf.*,

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

        AND (
          tf.created_at AT TIME ZONE $4
        )::date BETWEEN $1::date AND $2::date

      ORDER BY tf.created_at DESC
      `,
      [startDate, endDate, salonId, timezone],
    ),

    // =====================================================
    // LATE FEES
    // =====================================================

    db.query(
      `
      SELECT
        lf.*,

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

        AND (
          lf.created_at AT TIME ZONE $4
        )::date BETWEEN $1::date AND $2::date

      ORDER BY lf.created_at DESC
      `,
      [startDate, endDate, salonId, timezone],
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
  };
}
