import crypto from "crypto";
import db from "./database.js";
import { sha256, signatureFromDataUrl, storeSignaturePng } from "../utils/financeReceiptStorage.js";

const STAFF_ROLES = new Set(["owner", "manager", "cashier"]);
const SETTLER_ROLES = new Set(["owner", "manager"]);
const SOURCE = {
  LATE_FEE: { table: "late_fees", idColumn: "source_late_fee_id" },
  TAG_FEE: { table: "tag_fee", idColumn: "source_tag_fee_id" },
};

const error = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const positive = (value, label = "Amount") => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw error(`${label} must be greater than zero`);
  return amount;
};
const receiptNumber = () => `FEE-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
const requireRole = (role, allowed, message) => {
  if (!allowed.has(String(role || "").toLowerCase())) throw error(message, 403);
};
const prepareSignature = async (dataUrl) => {
  const buffer = await signatureFromDataUrl(dataUrl);
  return { url: await storeSignaturePng(buffer), hash: sha256(buffer) };
};
const map = (row) => ({
  ...row,
  id: Number(row.id),
  employee_id: Number(row.employee_id),
  amount: Number(row.amount || 0),
  outstanding_amount: Math.max(Number(row.outstanding_amount ?? row.amount ?? 0), 0),
  pending_payroll_deductions: row.pending_payroll_deductions || [],
});

const recalculateStatus = async (client, obligationId, salonId) => {
  const { rows } = await client.query(
    `SELECT o.amount, o.workflow_status,
            COALESCE(SUM(s.amount) FILTER (WHERE s.workflow_status = 'EFFECTIVE'), 0)::numeric AS effective_amount,
            COUNT(*) FILTER (WHERE s.workflow_status = 'PENDING_EMPLOYEE_CONSENT')::integer AS pending_count,
            BOOL_OR(s.settlement_method = 'WAIVED' AND s.workflow_status = 'EFFECTIVE') AS has_waiver
       FROM employee_fee_obligations o
       LEFT JOIN employee_fee_settlements s ON s.fee_obligation_id = o.id AND s.salon_id = o.salon_id
      WHERE o.id = $1 AND o.salon_id = $2
      GROUP BY o.id`,
    [obligationId, salonId],
  );
  const item = rows[0];
  if (!item || item.workflow_status === "VOIDED") return;
  const status = Number(item.effective_amount || 0) >= Number(item.amount)
    ? (item.has_waiver ? "WAIVED" : "SETTLED")
    : Number(item.pending_count || 0) > 0 ? "SETTLEMENT_PENDING" : "OPEN";
  await client.query(
    `UPDATE employee_fee_obligations SET workflow_status = $1, updated_at = NOW() WHERE id = $2 AND salon_id = $3`,
    [status, obligationId, salonId],
  );
};

export const recordLinkedFee = async ({ feeType, salonId, actorId, employeeId, amount, reason, feeDate, feeTime, entryType, backdateReason }) => {
  const source = SOURCE[feeType];
  if (!source) throw error("Unsupported fee type");
  const numericAmount = positive(amount, "Fee amount");
  return db.transaction(async (client) => {
    const { rows: employeeRows } = await client.query(
      `SELECT id FROM users WHERE id = $1 AND salon_id = $2 AND LOWER(COALESCE(status, 'active')) = 'active' FOR KEY SHARE`,
      [employeeId, salonId],
    );
    if (!employeeRows[0]) throw error("Choose an active employee in this salon", 404);
    const { rows: sourceRows } = await client.query(
      `INSERT INTO ${source.table} (employee_id, amount, reason, salon_id, fee_date, fee_time, entry_type, backdate_reason, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       RETURNING id, employee_id, amount, reason, salon_id, fee_date::text AS fee_date, fee_time::text AS fee_time, entry_type, backdate_reason, created_at`,
      [employeeId, numericAmount, String(reason || "").trim() || feeType.replaceAll("_", " "), salonId, feeDate, feeTime, entryType, backdateReason || null],
    );
    const sourceRow = sourceRows[0];
    await client.query(
      `INSERT INTO employee_fee_obligations (
         salon_id, employee_id, fee_type, ${source.idColumn}, amount, reason, fee_date, fee_time, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [salonId, employeeId, feeType, sourceRow.id, numericAmount, sourceRow.reason, feeDate, feeTime, actorId],
    );
    return sourceRow;
  });
};

export const updateLinkedFee = async ({ feeType, salonId, id, employeeId, amount, reason, feeDate, feeTime, entryType, backdateReason }) => {
  const source = SOURCE[feeType];
  if (!source) throw error("Unsupported fee type");
  const numericAmount = positive(amount, "Fee amount");
  return db.transaction(async (client) => {
    const { rows: obligationRows } = await client.query(
      `SELECT o.*, EXISTS(SELECT 1 FROM employee_fee_settlements s WHERE s.fee_obligation_id = o.id) AS has_settlements
       FROM employee_fee_obligations o WHERE o.${source.idColumn} = $1 AND o.salon_id = $2 FOR UPDATE`, [id, salonId],
    );
    const obligation = obligationRows[0];
    if (obligation && (obligation.has_settlements || obligation.workflow_status !== "OPEN")) {
      throw error("This fee already has a settlement record and cannot be edited. Record a correction instead.", 409);
    }
    const { rows } = await client.query(
      `UPDATE ${source.table}
          SET employee_id=$1, amount=$2, reason=$3, fee_date=$4, fee_time=$5, entry_type=$6, backdate_reason=$7
        WHERE id=$8 AND salon_id=$9
        RETURNING id, employee_id, amount, reason, salon_id, fee_date::text AS fee_date, fee_time::text AS fee_time, entry_type, backdate_reason, created_at`,
      [employeeId, numericAmount, String(reason || "").trim(), feeDate, feeTime, entryType, backdateReason || null, id, salonId],
    );
    if (!rows[0]) return null;
    if (obligation) await client.query(
      `UPDATE employee_fee_obligations
          SET employee_id=$1, amount=$2, reason=$3, fee_date=$4, fee_time=$5, updated_at=NOW()
        WHERE id=$6 AND salon_id=$7`,
      [employeeId, numericAmount, rows[0].reason, feeDate, feeTime, obligation.id, salonId],
    );
    return rows[0];
  });
};

export const deleteLinkedFee = async ({ feeType, salonId, id }) => {
  const source = SOURCE[feeType];
  if (!source) throw error("Unsupported fee type");
  const { rows } = await db.query(
    `SELECT workflow_status FROM employee_fee_obligations WHERE ${source.idColumn} = $1 AND salon_id = $2`, [id, salonId],
  );
  if (rows[0]) throw error("This fee has a settlement obligation. Settle it or record an owner waiver instead of deleting it.", 409);
  const result = await db.query(`DELETE FROM ${source.table} WHERE id=$1 AND salon_id=$2 RETURNING id`, [id, salonId]);
  return result.rowCount > 0;
};

export const createCleanerFeeObligations = async ({ salonId, actorId, actorRole, employeeIds, amount, feePeriod, reason }) => {
  requireRole(actorRole, new Set(["owner"]), "Only the owner may assign monthly cleaner fees");
  const numericAmount = positive(amount, "Cleaner fee amount");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(feePeriod || ""))) throw error("fee_period must use YYYY-MM-DD");
  const monthStart = `${String(feePeriod).slice(0, 7)}-01`;
  return db.transaction(async (client) => {
    const ids = Array.isArray(employeeIds) && employeeIds.length ? employeeIds.map(Number).filter(Number.isInteger) : null;
    const { rows: employees } = await client.query(
      `SELECT id FROM users WHERE salon_id = $1
        AND LOWER(COALESCE(role, '')) = ANY(ARRAY['employee','manager','cashier'])
        AND LOWER(COALESCE(status, 'active')) = 'active'
        AND ($2::int[] IS NULL OR id = ANY($2::int[]))`, [salonId, ids],
    );
    if (!employees.length) throw error("No active employees were selected", 404);
    const created = [];
    for (const employee of employees) {
      const { rows } = await client.query(
        `INSERT INTO employee_fee_obligations (
           salon_id, employee_id, fee_type, amount, reason, fee_date, fee_time, fee_period, created_by
         ) VALUES ($1,$2,'CLEANER_FEE',$3,$4,$5,(NOW() AT TIME ZONE 'Africa/Kampala')::time,$5,$6)
         ON CONFLICT (salon_id, employee_id, fee_type, fee_period) WHERE fee_type = 'CLEANER_FEE'
         DO NOTHING RETURNING id`,
        [salonId, employee.id, numericAmount, String(reason || "Monthly cleaner fee").trim() || "Monthly cleaner fee", monthStart, actorId],
      );
      if (rows[0]) created.push(Number(rows[0].id));
    }
    return { fee_period: monthStart, created_count: created.length, skipped_count: employees.length - created.length, obligation_ids: created };
  });
};

export const listFeeObligations = async ({ salonId, actorId, actorRole }) => {
  const staff = STAFF_ROLES.has(String(actorRole || "").toLowerCase());
  const { rows } = await db.query(
    `SELECT o.*, TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) AS employee_name,
            COALESCE(SUM(s.amount) FILTER (WHERE s.workflow_status = 'EFFECTIVE'), 0)::numeric AS settled_amount,
            COUNT(s.id)::integer AS settlement_count,
            COALESCE(BOOL_OR(s.workflow_status = 'EFFECTIVE' AND s.notes LIKE 'FINANCE_CLOSEOUT:%'), FALSE) AS is_finance_closeout,
            COALESCE(json_agg(json_build_object('id', s.id, 'amount', s.amount, 'receipt_number', s.receipt_number)
              ORDER BY s.created_at) FILTER (WHERE s.workflow_status = 'PENDING_EMPLOYEE_CONSENT'), '[]'::json) AS pending_payroll_deductions
       FROM employee_fee_obligations o
       JOIN users u ON u.id = o.employee_id AND u.salon_id = o.salon_id
       LEFT JOIN employee_fee_settlements s ON s.fee_obligation_id = o.id AND s.salon_id = o.salon_id
      WHERE o.salon_id = $1 AND ($2::boolean OR o.employee_id = $3)
      GROUP BY o.id, u.first_name, u.last_name
      ORDER BY o.fee_date DESC, o.id DESC`, [salonId, staff, actorId],
  );
  return rows.map((row) => map({ ...row, outstanding_amount: Number(row.amount || 0) - Number(row.settled_amount || 0) }));
};

export const updateCleanerFeeObligation = async ({ salonId, actorId, actorRole, obligationId, amount, reason }) => {
  requireRole(actorRole, new Set(["owner"]), "Only the owner may edit a cleaner fee");
  const numericAmount = positive(amount, "Cleaner fee amount");
  const cleanReason = String(reason || "").trim();
  if (!cleanReason) throw error("A cleaner-fee reason is required");
  return db.transaction(async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM employee_fee_obligations WHERE id = $1 AND salon_id = $2 FOR UPDATE`,
      [obligationId, salonId],
    );
    const obligation = rows[0];
    if (!obligation || obligation.fee_type !== "CLEANER_FEE") throw error("Cleaner fee was not found", 404);
    const { rows: settlementRows } = await client.query(
      `SELECT COUNT(*)::integer AS settlement_count FROM employee_fee_settlements WHERE fee_obligation_id = $1 AND salon_id = $2`,
      [obligationId, salonId],
    );
    if (obligation.workflow_status !== "OPEN" || Number(settlementRows[0].settlement_count || 0) > 0) {
      throw error("A cleaner fee can only be edited before a settlement is started", 409);
    }
    const { rows: updated } = await client.query(
      `UPDATE employee_fee_obligations
       SET amount = $1, reason = $2, updated_at = NOW()
       WHERE id = $3 AND salon_id = $4
       RETURNING *`,
      [numericAmount, cleanReason, obligationId, salonId],
    );
    return map(updated[0]);
  });
};

export const voidCleanerFeeObligation = async ({ salonId, actorId, actorRole, obligationId, reason }) => {
  requireRole(actorRole, new Set(["owner"]), "Only the owner may void a cleaner fee");
  const voidReason = String(reason || "").trim();
  if (!voidReason) throw error("A reason is required to void a cleaner fee");
  return db.transaction(async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM employee_fee_obligations WHERE id = $1 AND salon_id = $2 FOR UPDATE`,
      [obligationId, salonId],
    );
    const obligation = rows[0];
    if (!obligation || obligation.fee_type !== "CLEANER_FEE") throw error("Cleaner fee was not found", 404);
    const { rows: settlementRows } = await client.query(
      `SELECT COUNT(*)::integer AS settlement_count FROM employee_fee_settlements WHERE fee_obligation_id = $1 AND salon_id = $2`,
      [obligationId, salonId],
    );
    if (obligation.workflow_status !== "OPEN" || Number(settlementRows[0].settlement_count || 0) > 0) {
      throw error("A cleaner fee can only be voided before a settlement is started", 409);
    }
    const { rows: updated } = await client.query(
      `UPDATE employee_fee_obligations
       SET workflow_status='VOIDED', voided_by=$1, voided_at=NOW(), void_reason=$2, updated_at=NOW()
       WHERE id=$3 AND salon_id=$4 AND workflow_status='OPEN'
       RETURNING *`, [actorId, voidReason, obligationId, salonId],
    );
    if (!updated[0]) throw error("Cleaner fee is no longer available to void", 409);
    return map(updated[0]);
  });
};

export const settleFeeObligation = async ({ salonId, actorId, actorRole, obligationId, amount, settlementMethod, notes, signatureDataUrl }) => {
  requireRole(actorRole, SETTLER_ROLES, "Only an owner or manager may settle an employee fee");
  const method = String(settlementMethod || "").trim().toUpperCase();
  if (!new Set(["PAYROLL_DEDUCTION", "CASH_REPAYMENT", "WAIVED"]).has(method)) throw error("Choose payroll deduction, cash repayment, or owner waiver");
  if (method === "WAIVED" && String(actorRole || "").toLowerCase() !== "owner") throw error("Only the owner may waive an employee fee", 403);
  if (method === "WAIVED" && !String(notes || "").trim()) throw error("A reason is required when waiving a fee");
  const numericAmount = positive(amount, "Settlement amount");
  const managementSignature = method === "PAYROLL_DEDUCTION" ? null : await prepareSignature(signatureDataUrl);
  return db.transaction(async (client) => {
    const { rows: obligations } = await client.query(
      `SELECT * FROM employee_fee_obligations WHERE id=$1 AND salon_id=$2 FOR UPDATE`, [obligationId, salonId],
    );
    const obligation = obligations[0];
    if (!obligation || !["OPEN", "SETTLEMENT_PENDING"].includes(obligation.workflow_status)) throw error("This fee is not available for settlement", 409);
    const { rows: totalRows } = await client.query(
      `SELECT COALESCE(SUM(amount) FILTER (WHERE workflow_status = 'EFFECTIVE'),0)::numeric AS effective_amount,
              COALESCE(SUM(amount) FILTER (WHERE workflow_status = 'PENDING_EMPLOYEE_CONSENT'),0)::numeric AS pending_amount
         FROM employee_fee_settlements WHERE fee_obligation_id=$1 AND salon_id=$2`, [obligationId, salonId],
    );
    const outstanding = Number(obligation.amount) - Number(totalRows[0].effective_amount || 0) - Number(totalRows[0].pending_amount || 0);
    if (numericAmount > outstanding) throw error(`Settlement exceeds the outstanding fee of ${outstanding.toLocaleString()} UGX`);
    const { rows } = await client.query(
      `INSERT INTO employee_fee_settlements (
         salon_id, fee_obligation_id, employee_id, amount, settlement_method, workflow_status, notes, receipt_number,
         settled_by, settled_by_signature_url, settled_by_signature_hash, settled_by_declaration
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [salonId, obligationId, obligation.employee_id, numericAmount, method,
        method === "PAYROLL_DEDUCTION" ? "PENDING_EMPLOYEE_CONSENT" : "EFFECTIVE", String(notes || "").trim() || null,
        receiptNumber(), actorId, managementSignature?.url || null, managementSignature?.hash || null,
        managementSignature ? `${String(actorRole).replace(/^./, (letter) => letter.toUpperCase())} confirms this ${method === "WAIVED" ? "fee waiver" : "cash repayment"} of UGX ${numericAmount.toLocaleString("en-UG")}.` : null],
    );
    await recalculateStatus(client, obligationId, salonId);
    return { ...rows[0], amount: Number(rows[0].amount || 0), requires_employee_consent: method === "PAYROLL_DEDUCTION" };
  });
};

export const acknowledgeFeePayrollDeduction = async ({ salonId, actorId, obligationId, settlementId, signatureDataUrl }) => {
  const signature = await prepareSignature(signatureDataUrl);
  return db.transaction(async (client) => {
    const { rows } = await client.query(
      `SELECT s.*, o.amount AS obligation_amount
         FROM employee_fee_settlements s JOIN employee_fee_obligations o ON o.id=s.fee_obligation_id AND o.salon_id=s.salon_id
        WHERE s.id=$1 AND s.fee_obligation_id=$2 AND s.salon_id=$3 FOR UPDATE`, [settlementId, obligationId, salonId],
    );
    const settlement = rows[0];
    if (!settlement || Number(settlement.employee_id) !== Number(actorId)) throw error("Only the employee may consent to this salary deduction", 403);
    if (settlement.settlement_method !== "PAYROLL_DEDUCTION" || settlement.workflow_status !== "PENDING_EMPLOYEE_CONSENT") throw error("This deduction is no longer awaiting consent", 409);
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`employee-fee-deduction:${salonId}:${actorId}`]);
    const { rows: availableRows } = await client.query(
      `SELECT GREATEST(
        COALESCE((SELECT SUM(ee.amount) FROM employee_earnings ee WHERE ee.salon_id=$1 AND ee.employee_id=$2
          AND NOT EXISTS (SELECT 1 FROM employee_finance_cutovers c WHERE c.salon_id=ee.salon_id AND ee.earning_date <= c.legacy_ends_on)),0)
        - COALESCE((SELECT SUM(ep.requested_amount) FROM employee_payments ep WHERE ep.salon_id=$1 AND ep.employee_id=$2 AND ep.workflow_status IN ('DISBURSED','ACKNOWLEDGED')
          AND NOT EXISTS (SELECT 1 FROM employee_finance_cutovers c WHERE c.salon_id=ep.salon_id AND COALESCE(ep.business_occurred_at,ep.disbursed_at,ep.created_at)::date <= c.legacy_ends_on)),0)
        - COALESCE((SELECT SUM(s.amount) FROM employee_advance_settlements s WHERE s.salon_id=$1 AND s.employee_id=$2 AND s.settlement_method='PAYROLL_DEDUCTION' AND s.workflow_status='EFFECTIVE'
          AND NOT EXISTS (SELECT 1 FROM employee_finance_cutovers c WHERE c.salon_id=s.salon_id AND s.settled_at::date <= c.legacy_ends_on)),0)
        - COALESCE((SELECT SUM(s.amount) FROM employee_fee_settlements s WHERE s.salon_id=$1 AND s.employee_id=$2 AND s.settlement_method='PAYROLL_DEDUCTION' AND s.workflow_status='EFFECTIVE'
          AND NOT EXISTS (SELECT 1 FROM employee_finance_cutovers c WHERE c.salon_id=s.salon_id AND s.settled_at::date <= c.legacy_ends_on)),0), 0)::numeric AS available`,
      [salonId, actorId],
    );
    if (Number(settlement.amount) > Number(availableRows[0].available || 0)) throw error("This deduction exceeds available earnings", 409);
    const declaration = `I agree that UGX ${Number(settlement.amount).toLocaleString("en-UG")} will be deducted from my earned salary to settle fee ${settlement.receipt_number}.`;
    const { rows: updated } = await client.query(
      `UPDATE employee_fee_settlements SET workflow_status='EFFECTIVE', employee_consented_by=$1, employee_consented_at=NOW(),
        employee_consent_signature_url=$2, employee_consent_signature_hash=$3, employee_consent_declaration=$4
       WHERE id=$5 AND salon_id=$6 AND workflow_status='PENDING_EMPLOYEE_CONSENT' RETURNING *`,
      [actorId, signature.url, signature.hash, declaration, settlementId, salonId],
    );
    if (!updated[0]) throw error("This salary deduction was already processed", 409);
    await recalculateStatus(client, obligationId, salonId);
    return { ...updated[0], amount: Number(updated[0].amount || 0) };
  });
};

export const outstandingFeeSummary = async (client, { salonId, employeeId }) => {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(o.amount - COALESCE(s.settled_amount,0)),0)::numeric AS outstanding_amount
       FROM employee_fee_obligations o
       LEFT JOIN LATERAL (SELECT SUM(amount)::numeric AS settled_amount FROM employee_fee_settlements s
          WHERE s.fee_obligation_id=o.id AND s.salon_id=o.salon_id AND s.workflow_status='EFFECTIVE') s ON TRUE
      WHERE o.salon_id=$1 AND o.employee_id=$2 AND o.workflow_status IN ('OPEN','SETTLEMENT_PENDING')`, [salonId, employeeId],
  );
  return Number(rows[0].outstanding_amount || 0);
};
