import db from "./database.js";
import { servicePricingSelect } from "../utils/servicePricingSql.js";

// =========================================================
// SMALL ID HELPERS
// =========================================================

const normalizeOptionalId = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const normalizeRoleId = (performer) => {
  return normalizeOptionalId(performer?.role_id ?? performer?.service_role_id);
};

const getAppointmentEmployeeIds = (performers = []) => [
  ...new Set(
    performers
      .map((performer) => normalizeOptionalId(
        performer?.employee_id ?? performer?.preferred_employee_id,
      ))
      .filter(Boolean),
  ),
].sort((left, right) => left - right);

const lockAppointmentProfessionals = async (client, salonId, performers = []) => {
  for (const employeeId of getAppointmentEmployeeIds(performers)) {
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      [`appointment:${salonId}:employee:${employeeId}`],
    );
  }
};

const getPerformerSnapshots = async (client, transactionId, salonId) => {
  const { rows } = await client.query(
    `SELECT service_role_id, earned_amount_snapshot
     FROM service_performers
     WHERE service_transaction_id = $1 AND salon_id = $2`,
    [transactionId, salonId],
  );
  return new Map(rows.map((row) => [Number(row.service_role_id), Number(row.earned_amount_snapshot || 0)]));
};

const insertPerformerSnapshot = async (client, { salonId, transactionId, performer, earnedAmountSnapshot = null }) => {
  const roleId = normalizeRoleId(performer);
  if (!roleId) throw new Error("A valid service role is required");

  const { rowCount } = await client.query(
    `INSERT INTO service_performers
      (salon_id, service_transaction_id, service_role_id, employee_id,
       preferred_employee_id, earned_amount_snapshot)
     SELECT $1, $2, sr.id, $4, $5, COALESCE($6, sr.earned_amount, 0)
     FROM service_roles sr
     WHERE sr.id = $3 AND sr.salon_id = $1`,
    [
      salonId,
      transactionId,
      roleId,
      normalizeOptionalId(performer.employee_id),
      normalizeOptionalId(performer.preferred_employee_id),
      earnedAmountSnapshot,
    ],
  );
  if (!rowCount) throw new Error("The selected service role is unavailable");
};

// =========================================================
// SERVICE DEFINITIONS CRUD
// =========================================================

// =========================================================
// FETCH ALL SERVICE DEFINITIONS
// =========================================================

export const fetchServiceDefinitionsModel = async (salon_id) => {
  const { rows } = await db.query(
    `
    SELECT 
      sd.id,
      sd.service_name,
      sd.service_amount,
      sd.salon_amount,
      sd.section_id,
      sd.description,
      sd.image_url,

      json_agg(
        DISTINCT jsonb_build_object(
          'role_name', sr.role_name,
          'role_amount', sr.earned_amount
        )
      ) FILTER (WHERE sr.id IS NOT NULL) AS roles,

      json_agg(
        DISTINCT jsonb_build_object(
          'material_name', sm.material_name,
          'material_cost', sm.material_cost
        )
      ) FILTER (WHERE sm.id IS NOT NULL) AS materials

    FROM service_definitions sd

    LEFT JOIN service_roles sr
      ON sr.service_definition_id = sd.id

    LEFT JOIN service_materials sm
      ON sm.service_definition_id = sd.id

    WHERE sd.salon_id = $1

    GROUP BY sd.id

    ORDER BY sd.id DESC;
    `,
    [salon_id],
  );

  return rows;
};

// =========================================================
// FETCH SINGLE SERVICE DEFINITION
// =========================================================

export const fetchServiceDefinitionByIdModel = async (id, salon_id) => {
  const query = `
    SELECT 
      sd.id,
      sd.service_name,
      sd.service_amount,
      sd.salon_amount,
      sd.section_id,
      sd.description,
      sd.image_url,

      (
        SELECT json_agg(
          jsonb_build_object(
            'role_name', sr.role_name,
            'role_amount', sr.earned_amount
          )
        )
        FROM service_roles sr
        WHERE sr.service_definition_id = sd.id
      ) AS roles,

      (
        SELECT json_agg(
          jsonb_build_object(
            'material_name', sm.material_name,
            'material_cost', sm.material_cost
          )
        )
        FROM service_materials sm
        WHERE sm.service_definition_id = sd.id
      ) AS materials

    FROM service_definitions sd

    WHERE sd.id = $1
      AND sd.salon_id = $2;
  `;

  const result = await db.query(query, [id, salon_id]);

  return result.rows[0] || null;
};

// =========================================================
// CREATE SERVICE DEFINITION
// =========================================================

export const createServiceDefinitionModel = async (data) => {
  const {
    service_name,
    service_amount,
    salon_amount,
    section_id,
    description,
    service_image,
    roles = [],
    materials = [],
    salon_id,
  } = data;

  try {
    await db.query("BEGIN");

    const insertDef = `
      INSERT INTO service_definitions
      (
        service_name,
        service_amount,
        salon_amount,
        section_id,
        description,
        image_url,
        salon_id
      )

      VALUES ($1,$2,$3,$4,$5,$6,$7)

      RETURNING *;
    `;

    const { rows } = await db.query(insertDef, [
      service_name,
      service_amount || 0,
      salon_amount || 0,
      section_id,
      description || null,
      service_image || null,
      salon_id,
    ]);

    const serviceDef = rows[0];

    for (const role of roles) {
      await db.query(
        `
        INSERT INTO service_roles
        (
          service_definition_id,
          role_name,
          earned_amount,
          salon_id
        )

        VALUES ($1,$2,$3,$4)
        `,
        [serviceDef.id, role.role_name, role.role_amount || 0, salon_id],
      );
    }

    for (const material of materials) {
      await db.query(
        `
        INSERT INTO service_materials
        (
          service_definition_id,
          material_name,
          material_cost,
          salon_id
        )

        VALUES ($1,$2,$3,$4)
        `,
        [
          serviceDef.id,
          material.material_name,
          material.material_cost || 0,
          salon_id,
        ],
      );
    }

    await db.query("COMMIT");

    return serviceDef;
  } catch (err) {
    await db.query("ROLLBACK");

    console.error("Error creating service definition:", err);

    throw err;
  }
};

// =========================================================
// UPDATE SERVICE DEFINITION
// =========================================================

export const updateServiceDefinitionModel = async (id, data, salon_id) => {
  const {
    service_name,
    service_amount,
    salon_amount,
    section_id,
    description,
    service_image,
    roles = [],
    materials = [],
  } = data;

  try {
    await db.query("BEGIN");

    const updateDef = `
      UPDATE service_definitions

      SET
        service_name = $1,
        service_amount = $2,
        salon_amount = $3,
        section_id = $4,
        description = $5,
        image_url = $6

      WHERE id = $7
        AND salon_id = $8

      RETURNING *;
    `;

    const { rows } = await db.query(updateDef, [
      service_name,
      service_amount || 0,
      salon_amount || 0,
      section_id,
      description || null,
      service_image || null,
      id,
      salon_id,
    ]);

    const updatedDef = rows[0];

    if (!updatedDef) {
      throw new Error("Service definition not found");
    }

    await db.query(
      `
      DELETE FROM service_roles
      WHERE service_definition_id = $1
        AND salon_id = $2
      `,
      [id, salon_id],
    );

    for (const role of roles) {
      await db.query(
        `
        INSERT INTO service_roles
        (
          service_definition_id,
          role_name,
          earned_amount,
          salon_id
        )

        VALUES ($1,$2,$3,$4)
        `,
        [id, role.role_name, role.role_amount || 0, salon_id],
      );
    }

    await db.query(
      `
      DELETE FROM service_materials
      WHERE service_definition_id = $1
        AND salon_id = $2
      `,
      [id, salon_id],
    );

    for (const material of materials) {
      await db.query(
        `
        INSERT INTO service_materials
        (
          service_definition_id,
          material_name,
          material_cost,
          salon_id
        )

        VALUES ($1,$2,$3,$4)
        `,
        [id, material.material_name, material.material_cost || 0, salon_id],
      );
    }

    await db.query("COMMIT");

    return updatedDef;
  } catch (err) {
    await db.query("ROLLBACK");

    console.error("Error updating service definition:", err);

    throw err;
  }
};

// =========================================================
// DELETE SERVICE DEFINITION
// =========================================================

export const deleteServiceDefinitionModel = async (id, salon_id) => {
  try {
    await db.query("BEGIN");

    await db.query(
      `
      DELETE FROM service_roles

      USING service_definitions

      WHERE service_roles.service_definition_id =
            service_definitions.id

        AND service_definitions.id = $1

        AND service_definitions.salon_id = $2
      `,
      [id, salon_id],
    );

    await db.query(
      `
      DELETE FROM service_materials

      USING service_definitions

      WHERE service_materials.service_definition_id =
            service_definitions.id

        AND service_definitions.id = $1

        AND service_definitions.salon_id = $2
      `,
      [id, salon_id],
    );

    const { rowCount } = await db.query(
      `
      DELETE FROM service_definitions

      WHERE id = $1
        AND salon_id = $2
      `,
      [id, salon_id],
    );

    await db.query("COMMIT");

    return rowCount > 0;
  } catch (err) {
    await db.query("ROLLBACK");

    console.error("Error deleting service definition:", err);

    throw err;
  }
};

// =========================================================
// FETCH SERVICE ROLES
// =========================================================

export const fetchServiceRolesModel = async (salon_id) => {
  const { rows } = await db.query(
    `
    SELECT sr.*

    FROM service_roles sr

    JOIN service_definitions sd
      ON sr.service_definition_id = sd.id

    WHERE sd.salon_id = $1

    ORDER BY sr.service_definition_id ASC
    `,
    [salon_id],
  );

  return rows;
};

// =========================================================
// FETCH SERVICE MATERIALS
// =========================================================

export const fetchServiceMaterialsModel = async (salon_id) => {
  const { rows } = await db.query(
    `
    SELECT
      sm.id,
      sm.service_definition_id,
      sm.material_name,
      sm.material_cost,
      sd.service_name

    FROM service_materials sm

    LEFT JOIN service_definitions sd
      ON sd.id = sm.service_definition_id

    WHERE sd.salon_id = $1

    ORDER BY
      sm.service_definition_id ASC,
      sm.id ASC;
    `,
    [salon_id],
  );

  return rows;
};

// =========================================================
// VALIDATE SERVICE / APPOINTMENT PERFORMERS
// =========================================================

export const validateAppointmentRequestModel = async ({
  salon_id,
  service_definition_id,
  appointment_date = null,
  appointment_time = null,
  performers = [],
  exclude_transaction_id = null,
  require_actual_employees = false,

  // IMPORTANT:
  // booking / confirming = true
  // completing service = false
  check_appointment_conflicts = true,

  queryable = db,
}) => {
  const { rows: roleRows } = await queryable.query(
    `
    SELECT
      id,
      role_name

    FROM service_roles

    WHERE salon_id = $1
      AND service_definition_id = $2

    ORDER BY id
    `,
    [salon_id, service_definition_id],
  );

  if (roleRows.length === 0) {
    const error = new Error(
      "The selected service has no configured service roles",
    );

    error.statusCode = 400;

    throw error;
  }

  // =======================================================
  // NORMALIZE PERFORMERS
  // =======================================================

  const normalizedPerformers = (
    Array.isArray(performers) ? performers : []
  ).map((performer) => ({
    ...performer,

    role_id: normalizeRoleId(performer),

    employee_id: normalizeOptionalId(performer.employee_id),

    preferred_employee_id: normalizeOptionalId(performer.preferred_employee_id),
  }));

  // =======================================================
  // VALIDATE ROLE IDS
  // =======================================================

  const submittedRoleIds = normalizedPerformers
    .map((performer) => performer.role_id)
    .filter((roleId) => roleId !== null);

  const configuredRoleIds = new Set(roleRows.map((role) => Number(role.id)));

  if (new Set(submittedRoleIds).size !== submittedRoleIds.length) {
    const error = new Error("A service role can only be assigned once");

    error.statusCode = 400;

    throw error;
  }

  if (submittedRoleIds.some((roleId) => !configuredRoleIds.has(roleId))) {
    const error = new Error(
      "One or more selected roles do not belong to this service",
    );

    error.statusCode = 400;

    throw error;
  }

  const submittedByRole = new Map(
    normalizedPerformers
      .filter((performer) => performer.role_id !== null)
      .map((performer) => [performer.role_id, performer]),
  );

  // =======================================================
  // PROFESSIONAL ROLES
  // =======================================================

  const requiredRoles = roleRows.filter(
    (role) => role.role_name?.trim().toLowerCase() !== "salon",
  );

  for (const role of requiredRoles) {
    const performer = submittedByRole.get(Number(role.id));

    if (!performer) {
      const error = new Error(
        `Missing performer information for ${role.role_name}`,
      );

      error.statusCode = 400;

      throw error;
    }

    // Completed service MUST contain actual employee IDs.
    if (require_actual_employees && !performer.employee_id) {
      const error = new Error(
        `Assign an employee for ${role.role_name} before completing this service`,
      );

      error.statusCode = 400;

      throw error;
    }
  }

  // =======================================================
  // VALIDATE EMPLOYEES BELONG TO SALON AND ARE ACTIVE
  // =======================================================

  const selectedEmployeeIds = [
    ...new Set(
      normalizedPerformers
        .flatMap((performer) => [
          performer.employee_id,
          performer.preferred_employee_id,
        ])
        .filter((employeeId) => Number.isInteger(employeeId) && employeeId > 0),
    ),
  ];

  if (selectedEmployeeIds.length > 0) {
    const { rows: employeeRows } = await queryable.query(
      `
      SELECT id

      FROM users

      WHERE salon_id = $1

        AND id = ANY($2::int[])

        AND LOWER(COALESCE(role, '')) IN ('employee', 'manager')

        AND COALESCE(NULLIF(TRIM(specialty), ''), '-') <> '-'

        AND LOWER(
          COALESCE(
            status,
            'active'
          )
        ) = 'active'
      `,
      [salon_id, selectedEmployeeIds],
    );

    if (employeeRows.length !== selectedEmployeeIds.length) {
      const error = new Error("One or more selected employees are unavailable");

      error.statusCode = 400;

      throw error;
    }
  }

  // =======================================================
  // APPOINTMENT CONFLICT VALIDATION
  // =======================================================
  //
  // This runs ONLY while reserving / confirming appointment
  // availability.
  //
  // It does NOT run when recording who actually performed
  // a completed service.
  // =======================================================

  if (check_appointment_conflicts && appointment_date && appointment_time) {
    const appointmentEmployeeIds = [
      ...new Set(
        normalizedPerformers
          .map((performer) => {
            if (performer.employee_id) {
              return performer.employee_id;
            }

            if (performer.preferred_employee_id) {
              return performer.preferred_employee_id;
            }

            return null;
          })
          .filter(
            (employeeId) => Number.isInteger(employeeId) && employeeId > 0,
          ),
      ),
    ];

    if (appointmentEmployeeIds.length > 0) {
      const { rows: conflicts } = await queryable.query(
        `
        SELECT DISTINCT

          COALESCE(
            sp.employee_id,
            sp.preferred_employee_id
          ) AS employee_id,

          u.first_name,
          u.last_name

        FROM service_transactions st

        JOIN service_performers sp
          ON sp.service_transaction_id = st.id

        LEFT JOIN users u
          ON u.id = COALESCE(
            sp.employee_id,
            sp.preferred_employee_id
          )

        WHERE st.salon_id = $1

          AND (st.appointment_date + st.appointment_time)
              < ($2::date + $3::time + INTERVAL '1 hour')

          AND (st.appointment_date + st.appointment_time + INTERVAL '1 hour')
              > ($2::date + $3::time)

          AND LOWER(
            COALESCE(
              st.status,
              ''
            )
          ) IN (
            'pending',
            'confirmed'
          )

          AND COALESCE(
            sp.employee_id,
            sp.preferred_employee_id
          ) = ANY($4::int[])

          AND (
            $5::int IS NULL
            OR st.id <> $5::int
          )
        `,
        [
          salon_id,
          appointment_date,
          appointment_time,
          appointmentEmployeeIds,
          normalizeOptionalId(exclude_transaction_id),
        ],
      );

      if (conflicts.length > 0) {
        const names = conflicts
          .map((row) => `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim())
          .filter(Boolean)
          .join(", ");

        const error = new Error(
          names
            ? `${names} already has an appointment at that time`
            : "The selected employee is already booked at that time",
        );

        error.statusCode = 409;

        throw error;
      }
    }
  }

  return true;
};

// =========================================================
// SAVE SERVICE TRANSACTION
// =========================================================

export const saveServiceTransaction = async (data) => {
  const {
    service_definition_id,
    created_by,
    appointment_date,
    appointment_time,
    service_date,
    service_time,
    customer_id,
    customer_note,
    status,
    entry_type,
    service_source,
    performers = [],
    salon_id,
  } = data;

  if (!salon_id) {
    throw new Error("salon_id is required");
  }

  if (!service_date || !service_time) {
    throw new Error("service_date and service_time are required");
  }

  const normalizedStatus = String(status || "")
    .trim()
    .toLowerCase();

  return db.transaction(async (client) => {
    const { rows: pricingRows } = await client.query(
      `SELECT service_amount, salon_amount
       FROM service_definitions
       WHERE id = $1 AND salon_id = $2`,
      [service_definition_id, salon_id],
    );
    const pricing = pricingRows[0];
    if (!pricing) throw new Error("The selected service is unavailable");

    const originalServiceAmount = Number(pricing.service_amount || 0);
    const originalSalonAmount = Number(pricing.salon_amount || 0);
    const isOnlineBooking = String(service_source || "").toLowerCase() === "online_booking";
    if (isOnlineBooking && originalSalonAmount < 500) {
      const error = new Error("This service cannot accept the UGX 500 online discount because its salon share is too low");
      error.statusCode = 400;
      throw error;
    }
    const discountAmount = isOnlineBooking ? 500 : 0;
    const chargedServiceAmount = originalServiceAmount - discountAmount;
    const chargedSalonAmount = originalSalonAmount - discountAmount;

    // ===================================================
    // LOCK BOOKING SLOT
    // ===================================================

    if (
      ["pending", "confirmed"].includes(normalizedStatus) &&
      appointment_date &&
      appointment_time
    ) {
      await lockAppointmentProfessionals(client, salon_id, performers);
    }

    // ===================================================
    // VALIDATION
    // ===================================================

    await validateAppointmentRequestModel({
      salon_id,
      service_definition_id,
      appointment_date,
      appointment_time,
      performers,

      require_actual_employees: normalizedStatus === "completed",

      check_appointment_conflicts: ["pending", "confirmed"].includes(
        normalizedStatus,
      ),

      queryable: client,
    });

    // ===================================================
    // INSERT TRANSACTION
    // ===================================================

    const insertTrans = `
      INSERT INTO service_transactions
      (
        salon_id,
        service_definition_id,
        created_by,
        appointment_date,
        appointment_time,
        service_date,
        service_time,
        customer_id,
        customer_note,
        status,
        entry_type,
        service_source,
        original_service_amount,
        charged_service_amount,
        discount_amount,
        original_salon_amount,
        charged_salon_amount,
        service_timestamp
      )

      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16,
        $17,
        NOW()
      )

      RETURNING *;
    `;

    const { rows } = await client.query(insertTrans, [
      salon_id,
      service_definition_id,
      created_by,
      appointment_date || null,
      appointment_time || null,
      service_date,
      service_time,
      customer_id || null,
      customer_note || null,
      status || null,
      entry_type || "current",
      service_source || null,
      originalServiceAmount,
      chargedServiceAmount,
      discountAmount,
      originalSalonAmount,
      chargedSalonAmount,
    ]);

    const transaction = rows[0];

    // ===================================================
    // INSERT PERFORMER / PREFERENCE ROWS
    // ===================================================

    for (const performer of performers) {
      await insertPerformerSnapshot(client, {
        salonId: salon_id,
        transactionId: transaction.id,
        performer,
      });
    }

    return transaction;
  });
};

// =========================================================
// FETCH BUSY APPOINTMENT EMPLOYEES
// =========================================================

export const fetchAppointmentBusyEmployeeIdsModel = async (
  salon_id,
  appointment_date,
  appointment_time,
) => {
  const { rows } = await db.query(
    `
    SELECT DISTINCT

      COALESCE(
        sp.employee_id,
        sp.preferred_employee_id
      ) AS employee_id

    FROM service_transactions st

    JOIN service_performers sp
      ON sp.service_transaction_id = st.id

    WHERE st.salon_id = $1

      AND (st.appointment_date + st.appointment_time)
          < ($2::date + $3::time + INTERVAL '1 hour')

      AND (st.appointment_date + st.appointment_time + INTERVAL '1 hour')
          > ($2::date + $3::time)

      AND LOWER(
        COALESCE(
          st.status,
          ''
        )
      ) IN (
        'pending',
        'confirmed'
      )

      AND COALESCE(
        sp.employee_id,
        sp.preferred_employee_id
      ) IS NOT NULL
    `,
    [salon_id, appointment_date, appointment_time],
  );

  return rows
    .map((row) => normalizeOptionalId(row.employee_id))
    .filter((employeeId) => employeeId !== null);
};

// =========================================================
// FETCH ALL SERVICE TRANSACTIONS
// =========================================================

export const fetchAllServiceTransactions = async (salon_id) => {
  const query = `
    SELECT 

      st.*,

      st.id AS transaction_id,

      st.service_date::TEXT AS service_date,

      st.service_time::TEXT AS service_time,

      st.appointment_date::TEXT AS appointment_date,

      st.appointment_time::TEXT AS appointment_time,

      customer.id AS active_customer_id,

      CONCAT_WS(
        ' ',
        customer.first_name,
        customer.last_name
      ) AS customer_name,

      sd.service_name,

      sd.description,

      ${servicePricingSelect},

      sd.section_id AS definition_section_id,

      sec.section_name,

      COALESCE(
        perf.performers,
        '[]'::json
      ) AS performers,

      COALESCE(
        mat.materials,
        '[]'::json
      ) AS materials

    FROM service_transactions st

    JOIN service_definitions sd
      ON sd.id = st.service_definition_id

    JOIN service_sections sec
      ON sec.id = sd.section_id

    LEFT JOIN users customer
      ON customer.id = st.customer_id
     AND customer.salon_id = st.salon_id

    LEFT JOIN LATERAL (
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
        ) AS performers

      FROM service_performers sp

      LEFT JOIN service_roles sr
        ON sr.id = sp.service_role_id

      LEFT JOIN users actual_employee
        ON actual_employee.id = sp.employee_id

      LEFT JOIN users preferred_employee
        ON preferred_employee.id = sp.preferred_employee_id

      WHERE sp.service_transaction_id = st.id

    ) perf ON TRUE

    LEFT JOIN LATERAL (
      SELECT
        json_agg(
          jsonb_build_object(
            'material_name',
            sm.material_name,

            'material_cost',
            sm.material_cost
          )
        ) AS materials

      FROM service_materials sm

      WHERE sm.service_definition_id = sd.id

    ) mat ON TRUE

    WHERE st.salon_id = $1

    ORDER BY
      st.service_date DESC,
      st.service_time DESC;
  `;

  const { rows } = await db.query(query, [salon_id]);

  return rows.map((row) => {
    row.materials = Array.isArray(row.materials)
      ? Array.from(
          new Map(
            row.materials.map((material) => [material.material_name, material]),
          ).values(),
        )
      : [];

    return row;
  });
};

// =========================================================
// FETCH SINGLE SERVICE TRANSACTION
// =========================================================

export const fetchServiceTransactionById = async (id, salon_id) => {
  const query = `
    SELECT

      st.*,

      st.id AS transaction_id,

      st.service_date::TEXT AS service_date,

      st.service_time::TEXT AS service_time,

      st.appointment_date::TEXT AS appointment_date,

      st.appointment_time::TEXT AS appointment_time,

      customer.id AS active_customer_id,

      sd.service_name,

      sd.description,

      ${servicePricingSelect},

      sd.section_id AS definition_section_id,

      sec.section_name,

      CONCAT_WS(
        ' ',
        creator.first_name,
        creator.last_name
      ) AS recorded_by_name,

      CONCAT_WS(
        ' ',
        customer.first_name,
        customer.last_name
      ) AS customer_name,

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

          LEFT JOIN users preferred_employee
            ON preferred_employee.id = sp.preferred_employee_id

          WHERE sp.service_transaction_id = st.id
        ),

        '[]'::json
      ) AS performers,

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
            )

          FROM service_materials sm

          WHERE sm.service_definition_id = sd.id
        ),

        '[]'::json
      ) AS materials

    FROM service_transactions st

    JOIN service_definitions sd
      ON sd.id = st.service_definition_id
     AND sd.salon_id = $2

    JOIN service_sections sec
      ON sec.id = sd.section_id
     AND sec.salon_id = $2

    LEFT JOIN users creator
      ON creator.id = st.created_by
     AND creator.salon_id = st.salon_id

    LEFT JOIN users customer
      ON customer.id = st.customer_id
     AND customer.salon_id = st.salon_id

    WHERE st.id = $1
      AND st.salon_id = $2;
  `;

  const { rows } = await db.query(query, [id, salon_id]);

  return rows[0] || null;
};

// =========================================================
// UPDATE SERVICE TRANSACTION
// =========================================================

export const updateServiceTransactionModel = async (id, updates, salon_id) => {
  const {
    service_definition_id,
    appointment_date,
    appointment_time,
    customer_id,
    customer_note,
    status,
    cancel_reason,
    service_source,
    performers = [],
  } = updates;

  return db.transaction(async (client) => {
    if (["pending", "confirmed"].includes(String(status || "").toLowerCase())) {
      await lockAppointmentProfessionals(client, salon_id, performers);
    }

    const updateTrans = `
      UPDATE service_transactions

      SET
        service_definition_id = $1,

        appointment_date = $2,

        appointment_time = $3,

        customer_id = $4,

        customer_note = $5,

        status = COALESCE($6, status),

        cancel_reason = $7,

        service_source = COALESCE($8, service_source),

        updated_at = NOW()

      WHERE id = $9
        AND salon_id = $10

      RETURNING *;
    `;

    const { rows } = await client.query(updateTrans, [
      service_definition_id,
      appointment_date || null,
      appointment_time || null,
      customer_id || null,
      customer_note || null,
      status || null,
      cancel_reason || null,
      service_source || null,
      id,
      salon_id,
    ]);

    const updated = rows[0];

    if (!updated) {
      throw new Error("Transaction not found or does not belong to this salon");
    }

    const normalizedStatus = String(updated.status || "")
      .trim()
      .toLowerCase();

    if (normalizedStatus === "completed") {
      await validateAppointmentRequestModel({
        salon_id,

        service_definition_id: updated.service_definition_id,

        appointment_date: updated.appointment_date,

        appointment_time: updated.appointment_time,

        performers,

        exclude_transaction_id: normalizeOptionalId(id),

        require_actual_employees: true,

        // VERY IMPORTANT:
        // completion records actual workers;
        // it is no longer an availability check.
        check_appointment_conflicts: false,

        queryable: client,
      });
    } else if (["pending", "confirmed"].includes(normalizedStatus)) {
      await validateAppointmentRequestModel({
        salon_id,

        service_definition_id: updated.service_definition_id,

        appointment_date: updated.appointment_date,

        appointment_time: updated.appointment_time,

        performers,

        exclude_transaction_id: normalizeOptionalId(id),

        require_actual_employees: false,

        check_appointment_conflicts: true,

        queryable: client,
      });
    }

    const performerSnapshots = await getPerformerSnapshots(client, id, salon_id);

    await client.query(
      `
      DELETE FROM service_performers

      WHERE service_transaction_id = $1
        AND salon_id = $2
      `,
      [id, salon_id],
    );

    for (const performer of performers) {
      const roleId = normalizeRoleId(performer);
      await insertPerformerSnapshot(client, {
        salonId: salon_id,
        transactionId: id,
        performer,
        earnedAmountSnapshot: performerSnapshots.get(roleId) ?? null,
      });
    }

    return updated;
  });
};

// =========================================================
// UPDATE APPOINTMENT STATUS / PERFORMERS
// =========================================================

export const updateServiceTransactionAppointmentModel = async (
  id,
  updates,
  salon_id,
) => {
  const {
    status,
    cancel_reason,
    service_date,
    service_time,
    performers = null,
  } = updates;

  if (!status && !cancel_reason) {
    throw new Error("No valid fields to update");
  }

  return db.transaction(async (client) => {
    if (["pending", "confirmed"].includes(String(status || "").toLowerCase()) && Array.isArray(performers)) {
      await lockAppointmentProfessionals(client, salon_id, performers);
    }

    const query = `
      UPDATE service_transactions

      SET
        status = COALESCE($1, status),

        cancel_reason =
          CASE
            WHEN LOWER(
              COALESCE(
                $1,
                status
              )
            ) = 'cancelled'
            THEN $2
            ELSE NULL
          END,

        service_date =
          CASE
            WHEN LOWER(
              COALESCE(
                $1,
                status
              )
            ) = 'completed'
            THEN $5::date
            ELSE service_date
          END,

        service_time =
          CASE
            WHEN LOWER(
              COALESCE(
                $1,
                status
              )
            ) = 'completed'
            THEN $6::time
            ELSE service_time
          END,

        updated_at = NOW()

      WHERE id = $3
        AND salon_id = $4

      RETURNING *;
    `;

    const { rows } = await client.query(query, [
      status || null,
      cancel_reason || null,
      id,
      salon_id,
      service_date || null,
      service_time || null,
    ]);

    if (rows.length === 0) {
      throw new Error("Transaction not found");
    }

    const updated = rows[0];

    const normalizedStatus = String(updated.status || "")
      .trim()
      .toLowerCase();

    // ===================================================
    // COMPLETION
    // ===================================================

    if (normalizedStatus === "completed") {
      if (!Array.isArray(performers)) {
        throw new Error("Completed service requires performer information");
      }

      await validateAppointmentRequestModel({
        salon_id,

        service_definition_id: updated.service_definition_id,

        appointment_date: updated.appointment_date,

        appointment_time: updated.appointment_time,

        performers,

        exclude_transaction_id: normalizeOptionalId(id),

        require_actual_employees: true,

        // IMPORTANT:
        // We are recording the actual people who worked.
        // Do not perform booking-slot conflict checks here.
        check_appointment_conflicts: false,

        queryable: client,
      });
    }

    // ===================================================
    // CONFIRMATION
    // ===================================================

    if (normalizedStatus === "confirmed") {
      if (Array.isArray(performers)) {
        await validateAppointmentRequestModel({
          salon_id,

          service_definition_id: updated.service_definition_id,

          appointment_date: updated.appointment_date,

          appointment_time: updated.appointment_time,

          performers,

          exclude_transaction_id: normalizeOptionalId(id),

          require_actual_employees: false,

          check_appointment_conflicts: true,

          queryable: client,
        });
      }
    }

    // ===================================================
    // UPDATE PERFORMERS IF PROVIDED
    // ===================================================

    if (Array.isArray(performers)) {
      const performerSnapshots = await getPerformerSnapshots(client, id, salon_id);

      await client.query(
        `
        DELETE FROM service_performers

        WHERE service_transaction_id = $1
          AND salon_id = $2
        `,
        [id, salon_id],
      );

      for (const performer of performers) {
        const roleId = normalizeRoleId(performer);
        await insertPerformerSnapshot(client, {
          salonId: salon_id,
          transactionId: id,
          performer,
          earnedAmountSnapshot: performerSnapshots.get(roleId) ?? null,
        });
      }
    }

    return updated;
  });
};

// =========================================================
// UPDATE TRANSACTION TIME ONLY
// =========================================================

export const updateServiceTransactionModelt = async (id, newTime, salon_id) => {
  const query = `
    UPDATE service_transactions

    SET
      service_timestamp = $1,
      updated_at = NOW()

    WHERE id = $2
      AND salon_id = $3

    RETURNING *;
  `;

  const { rows } = await db.query(query, [newTime, id, salon_id]);

  return rows[0] || null;
};

// =========================================================
// DELETE SERVICE TRANSACTION
// =========================================================

export const DeleteServiceTransaction = async (id, salon_id) => {
  try {
    await db.query("BEGIN");

    await db.query(
      `
      DELETE FROM service_performers

      WHERE service_transaction_id = $1
        AND salon_id = $2
      `,
      [id, salon_id],
    );

    const { rowCount } = await db.query(
      `
      DELETE FROM service_transactions

      WHERE id = $1
        AND salon_id = $2
      `,
      [id, salon_id],
    );

    await db.query("COMMIT");

    return rowCount > 0;
  } catch (err) {
    await db.query("ROLLBACK");

    console.error("Error deleting service transaction:", err);

    throw err;
  }
};

// =========================================================
// EXPORT DEFAULT
// =========================================================

export default {
  saveServiceTransaction,

  fetchAllServiceTransactions,

  fetchServiceTransactionById,

  updateServiceTransactionModel,

  updateServiceTransactionModelt,

  DeleteServiceTransaction,

  fetchServiceDefinitionsModel,

  fetchServiceDefinitionByIdModel,

  createServiceDefinitionModel,

  updateServiceDefinitionModel,

  deleteServiceDefinitionModel,

  fetchServiceRolesModel,

  fetchServiceMaterialsModel,

  updateServiceTransactionAppointmentModel,

  validateAppointmentRequestModel,

  fetchAppointmentBusyEmployeeIdsModel,
};
