import db from "./database.js";

// =========================================================
// SERVICE DEFINITIONS CRUD
// =========================================================

// FETCH ALL SERVICE DEFINITIONS
export const fetchServiceDefinitionsModel = async (salon_id) => {
  const { rows } = await db.query(`
    SELECT 
      sd.id,
      sd.service_name,
      sd.service_amount,
      sd.salon_amount,
      sd.section_id,
      sd.description,
      sd.image_url,
      -- roles array
      json_agg(
        DISTINCT jsonb_build_object(
          'role_name', sr.role_name,
          'role_amount', sr.earned_amount
        )
      ) FILTER (WHERE sr.id IS NOT NULL) AS roles,
      -- materials array
      json_agg(
        DISTINCT jsonb_build_object(
          'material_name', sm.material_name,
          'material_cost', sm.material_cost
        )
      ) FILTER (WHERE sm.id IS NOT NULL) AS materials
    FROM service_definitions sd
    LEFT JOIN service_roles sr ON sr.service_definition_id = sd.id
    LEFT JOIN service_materials sm ON sm.service_definition_id = sd.id
    WHERE sd.salon_id = $1
    GROUP BY sd.id
    ORDER BY sd.id DESC;
  `, [salon_id]);

  return rows;
};

// FETCH SINGLE SERVICE DEFINITION
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
      (SELECT json_agg(jsonb_build_object('role_name', sr.role_name, 'role_amount', sr.earned_amount))
       FROM service_roles sr
       WHERE sr.service_definition_id = sd.id) AS roles,
      (SELECT json_agg(jsonb_build_object('material_name', sm.material_name, 'material_cost', sm.material_cost))
       FROM service_materials sm
       WHERE sm.service_definition_id = sd.id) AS materials
    FROM service_definitions sd
    WHERE sd.id = $1 AND sd.salon_id = $2;
  `;
  const result = await db.query(query, [id, salon_id]);
  return result.rows[0] || null;
};

// CREATE SERVICE DEFINITION

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
    salon_id
  } = data;

  try {
    await db.query("BEGIN");

    const insertDef = `
      INSERT INTO service_definitions
      (service_name, service_amount, salon_amount, section_id, description, image_url, salon_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *;
    `;
    const { rows } = await db.query(insertDef, [
      service_name,
      service_amount || 0,
      salon_amount || 0,
      section_id,
      description || null,
      service_image || null,
      salon_id
    ]);
    const serviceDef = rows[0];

    // Insert roles with salon_id
    for (const r of roles) {
      await db.query(
        `INSERT INTO service_roles (service_definition_id, role_name, earned_amount, salon_id) VALUES ($1,$2,$3,$4)`,
        [serviceDef.id, r.role_name, r.role_amount || 0, salon_id]
      );
    }

    // Insert materials with salon_id
    for (const m of materials) {
      await db.query(
        `INSERT INTO service_materials (service_definition_id, material_name, material_cost, salon_id) VALUES ($1,$2,$3,$4)`,
        [serviceDef.id, m.material_name, m.material_cost || 0, salon_id]
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


// UPDATE SERVICE DEFINITION
export const updateServiceDefinitionModel = async (id, data, salon_id) => {
  const {
    service_name,
    service_amount,
    salon_amount,
    section_id,
    description,
    service_image,
    roles = [],
    materials = []
  } = data;

  try {
    await db.query("BEGIN");

    const updateDef = `
      UPDATE service_definitions
      SET service_name=$1, service_amount=$2, salon_amount=$3, section_id=$4,
          description=$5, image_url=$6
      WHERE id=$7 AND salon_id=$8 RETURNING *;
    `;
    const { rows } = await db.query(updateDef, [
      service_name,
      service_amount || 0,
      salon_amount || 0,
      section_id,
      description || null,
      service_image || null,
      id,
      salon_id
    ]);
    const updatedDef = rows[0];
    if (!updatedDef) throw new Error("Service definition not found");

    // DELETE old roles but only for this salon
    await db.query(
      `DELETE FROM service_roles WHERE service_definition_id=$1 AND salon_id=$2`,
      [id, salon_id]
    );
    for (const r of roles) {
      await db.query(
        `INSERT INTO service_roles (service_definition_id, role_name, earned_amount, salon_id) VALUES ($1,$2,$3,$4)`,
        [id, r.role_name, r.role_amount || 0, salon_id]
      );
    }

    // DELETE old materials but only for this salon
    await db.query(
      `DELETE FROM service_materials WHERE service_definition_id=$1 AND salon_id=$2`,
      [id, salon_id]
    );
    for (const m of materials) {
      await db.query(
        `INSERT INTO service_materials (service_definition_id, material_name, material_cost, salon_id) VALUES ($1,$2,$3,$4)`,
        [id, m.material_name, m.material_cost || 0, salon_id]
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


// DELETE SERVICE DEFINITION

export const deleteServiceDefinitionModel = async (id, salon_id) => {
  try {
    await db.query("BEGIN");

    // Delete roles only for this service and salon
    await db.query(
      `DELETE FROM service_roles 
       USING service_definitions
       WHERE service_roles.service_definition_id = service_definitions.id
         AND service_definitions.id = $1
         AND service_definitions.salon_id = $2`,
      [id, salon_id]
    );

    // Delete materials only for this service and salon
    await db.query(
      `DELETE FROM service_materials 
       USING service_definitions
       WHERE service_materials.service_definition_id = service_definitions.id
         AND service_definitions.id = $1
         AND service_definitions.salon_id = $2`,
      [id, salon_id]
    );

    // Delete service definition
    const { rowCount } = await db.query(
      `DELETE FROM service_definitions WHERE id=$1 AND salon_id=$2`,
      [id, salon_id]
    );

    await db.query("COMMIT");
    return rowCount > 0;
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("Error deleting service definition:", err);
    throw err;
  }
};


// FETCH SERVICE ROLES

export const fetchServiceRolesModel = async (salon_id) => {
  const { rows } = await db.query(
    `SELECT sr.*
     FROM service_roles sr
     JOIN service_definitions sd
       ON sr.service_definition_id = sd.id
     WHERE sd.salon_id = $1
     ORDER BY sr.service_definition_id ASC`,
    [salon_id]
  );
  return rows;
};


// FETCH SERVICE MATERIALS
export const fetchServiceMaterialsModel = async (salon_id) => {
  const { rows } = await db.query(`
    SELECT sm.id, sm.service_definition_id, sm.material_name, sm.material_cost, sd.service_name
    FROM service_materials sm
    LEFT JOIN service_definitions sd ON sd.id = sm.service_definition_id
    WHERE sd.salon_id = $1
    ORDER BY sm.service_definition_id ASC, sm.id ASC;
  `, [salon_id]);
  return rows;
};

// =========================================================
// SERVICE TRANSACTIONS
// =========================================================

// SAVE SERVICE TRANSACTION
export const saveServiceTransaction = async (data) => {
  const {
    service_definition_id,
    created_by,
    appointment_date,
    appointment_time,
    customer_id,
    customer_note,
    status,
    performers = [],
    salon_id
  } = data;

  if (!salon_id) throw new Error("salon_id is required");

  try {
    await db.query("BEGIN");

    const insertTrans = `
      INSERT INTO service_transactions
      (salon_id, service_definition_id, created_by, appointment_date, appointment_time, customer_id, customer_note, status, service_timestamp)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
      RETURNING *;
    `;
    const { rows } = await db.query(insertTrans, [
      salon_id,
      service_definition_id,
      created_by,
      appointment_date || null,
      appointment_time || null,
      customer_id || null,
      customer_note || null,
      status || null,
    ]);

    const transaction = rows[0];

    for (const p of performers) {
      await db.query(
        `INSERT INTO service_performers (salon_id, service_transaction_id, service_role_id, employee_id) VALUES ($1,$2,$3,$4)`,
        [salon_id, transaction.id, p.role_id, p.employee_id || null]
      );
    }

    await db.query("COMMIT");
    return transaction;
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("Error saving service transaction:", err);
    throw err;
  }
};

// FETCH ALL SERVICE TRANSACTIONS

export const fetchAllServiceTransactions = async (salon_id) => {
  const query = `
    SELECT 
      st.*,
      st.id AS transaction_id,

      -- force DATE to stay DATE
      st.appointment_date::TEXT AS appointment_date,

      -- Uganda-local service time (for display only)
      st.service_timestamp AT TIME ZONE 'Africa/Kampala' AS service_time,

      sd.service_name,
      sd.description,
      sd.service_amount AS full_amount,
      sd.salon_amount,
      sd.section_id AS definition_section_id,
      sec.section_name,

      COALESCE(perf.performers, '[]'::json) AS performers,
      COALESCE(mat.materials, '[]'::json) AS materials

    FROM service_transactions st

    JOIN service_definitions sd 
      ON sd.id = st.service_definition_id

    JOIN service_sections sec
      ON sec.id = sd.section_id

    -- performers
    LEFT JOIN LATERAL (
      SELECT json_agg(
        jsonb_build_object(
          'role_name', sr.role_name,
          'role_amount', sr.earned_amount,
          'employee_id', u.id,
          'first_name', u.first_name,
          'last_name', u.last_name
        )
      ) AS performers
      FROM service_performers sp
      LEFT JOIN service_roles sr ON sr.id = sp.service_role_id
      LEFT JOIN users u ON u.id = sp.employee_id
      WHERE sp.service_transaction_id = st.id
    ) perf ON TRUE

    -- materials
    LEFT JOIN LATERAL (
      SELECT json_agg(
        jsonb_build_object(
          'material_name', sm.material_name,
          'material_cost', sm.material_cost
        )
      ) AS materials
      FROM service_materials sm
      WHERE sm.service_definition_id = sd.id
    ) mat ON TRUE

    WHERE st.salon_id = $1

    ORDER BY st.service_timestamp DESC;
  `;

  const { rows } = await db.query(query, [salon_id]);

  return rows.map(row => {
    row.materials = Array.isArray(row.materials)
      ? Array.from(new Map(row.materials.map(m => [m.material_name, m])).values())
      : [];
    return row;
  });
};


// FETCH SINGLE SERVICE TRANSACTION
export const fetchServiceTransactionById = async (id, salon_id) => {
  console.log("id and salon_id in the models", id, "salon_id", salon_id)
  const query = `
    SELECT st.*, sd.service_name, sd.description, sd.service_amount AS full_amount, sd.salon_amount
    FROM service_transactions st
    JOIN service_definitions sd ON sd.id = st.service_definition_id
    WHERE st.id=$1 AND st.salon_id=$2;
  `;
  const { rows } = await db.query(query, [id, salon_id]);
  return rows[0] || null;
};

// UPDATE SERVICE TRANSACTION

export const updateServiceTransactionModel = async (id, updates, salon_id) => {
  const {
    service_definition_id,
    appointment_date,
    appointment_time,
    customer_id,
    customer_note,
    status,
    cancel_reason,
    performers = []
  } = updates;

  try {
    await db.query("BEGIN");

    // Update transaction safely by salon_id
    const updateTrans = `
      UPDATE service_transactions
      SET service_definition_id=$1, appointment_date=$2, appointment_time=$3, 
          customer_id=$4, customer_note=$5, status=$6, cancel_reason=$7
      WHERE id=$8 AND salon_id=$9
      RETURNING *;
    `;
    const { rows } = await db.query(updateTrans, [
      service_definition_id,
      appointment_date || null,
      appointment_time || null,
      customer_id || null,
      customer_note || null,
      status || null,
      cancel_reason || null,
      id,
      salon_id
    ]);

    const updated = rows[0];
    if (!updated) throw new Error("Transaction not found or does not belong to this salon");

    // Delete performers only if the transaction belongs to this salon
    await db.query(`
      DELETE FROM service_performers
      USING service_transactions st
      WHERE service_performers.service_transaction_id = st.id
        AND st.id = $1
        AND st.salon_id = $2
    `, [id, salon_id]);

    // Insert new performers safely
    for (const p of performers) {
      await db.query(`
        INSERT INTO service_performers (service_transaction_id, service_role_id, employee_id)
        SELECT st.id, $1, $2
        FROM service_transactions st
        WHERE st.id = $3 AND st.salon_id = $4
      `, [p.role_id, p.employee_id || null, id, salon_id]);
    }

    await db.query("COMMIT");
    return updated;
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("Error updating service transaction:", err);
    throw err;
  }
};


// UPDATE APPOINTMENT (STATUS / CANCEL REASON)
export const updateServiceTransactionAppointmentModel = async (id, updates, salon_id) => {
  const { status, cancel_reason } = updates;

  if (!status && !cancel_reason) throw new Error("No valid fields to update");

  try {
    await db.query("BEGIN");

    const query = `
      UPDATE service_transactions
      SET status = COALESCE($1, status), cancel_reason = COALESCE($2, cancel_reason)
      WHERE id = $3 AND salon_id = $4
      RETURNING *;
    `;
    const { rows } = await db.query(query, [status || null, cancel_reason || null, id, salon_id]);

    if (rows.length === 0) throw new Error("Transaction not found");

    await db.query("COMMIT");
    return rows[0];
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("Error updating appointment:", err);
    throw err;
  }
};

// UPDATE TRANSACTION TIME ONLY
export const updateServiceTransactionModelt = async (id, newTime, salon_id) => {
  const query = `
    UPDATE service_transactions
    SET service_timestamp=$1
    WHERE id=$2 AND salon_id=$3
    RETURNING *;
  `;
  const { rows } = await db.query(query, [newTime, id, salon_id]);
  return rows[0] || null;
};

// DELETE SERVICE TRANSACTION
export const DeleteServiceTransaction = async (id, salon_id) => {
  try {
    await db.query("BEGIN");

    await db.query(`DELETE FROM service_performers WHERE service_transaction_id=$1`, [id]);
    const { rowCount } = await db.query(`DELETE FROM service_transactions WHERE id=$1 AND salon_id=$2`, [id, salon_id]);

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
  updateServiceTransactionAppointmentModel
};
