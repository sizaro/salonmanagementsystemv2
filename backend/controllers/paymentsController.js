import crypto from "crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { DateTime } from "luxon";
import {
  createAdvanceRepaymentIntent,
  createServiceCollectionIntent,
  createExternalDisbursementIntent,
  getPaymentIntentForActor,
  receiveBankCredit,
  receiveMockBankCredit,
  recordBankTransferInquiry,
  resolveMockPayment,
  verifyManualBankDisbursement,
} from "../payments/paymentEngine.js";
import { isProduction } from "../config/environment.js";
import db from "../models/database.js";
import { createBankAdapter } from "../payments/bankProvider.js";
import { appendAuditEvent } from "../models/auditModel.js";

const actor = (req) => ({ id: Number(req.user.id), role: req.user.role });

export const createServicePaymentIntent = async (req, res) => {
  try {
    const intent = await createServiceCollectionIntent({
      actor: actor(req),
      salonId: Number(req.salon_id),
      payload: req.body,
      app: req.app,
    });
    return res.status(201).json({ success: true, data: intent });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Unable to initiate payment.",
    });
  }
};

export const createAdvanceRepaymentPaymentIntent = async (req, res) => {
  try {
    const intent = await createAdvanceRepaymentIntent({
      actor: actor(req), salonId: Number(req.salon_id), payload: req.body, app: req.app,
    });
    return res.status(201).json({ success: true, data: intent });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : "Unable to initiate advance repayment." });
  }
};

export const createExternalDisbursement = async (req, res) => {
  try {
    const intent = await createExternalDisbursementIntent({
      actor: actor(req), salonId: Number(req.salon_id), payload: req.body, app: req.app,
    });
    return res.status(201).json({ success: true, data: intent });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : "Unable to initiate disbursement." });
  }
};

export const getPaymentIntentStatus = async (req, res) => {
  try {
    const intent = await getPaymentIntentForActor({
      salonId: Number(req.salon_id),
      actorId: Number(req.user.id),
      actorRole: req.user.role,
      reference: req.params.reference,
    });
    return res.json({ success: true, data: intent });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Unable to retrieve payment status.",
    });
  }
};

export const resolveDevelopmentMockIntent = async (req, res) => {
  try {
    if (isProduction() || String(process.env.PAYMENTS_MODE || "mock").toLowerCase() !== "mock") {
      return res.status(404).json({ success: false, message: "Not found." });
    }
    const intent = await getPaymentIntentForActor({
      salonId: Number(req.salon_id),
      actorId: Number(req.user.id),
      reference: req.params.reference,
    });
    const outcome = String(req.params.outcome || "").toUpperCase();
    if (!["CONFIRMED", "FAILED", "REJECTED", "TIMED_OUT"].includes(outcome)) {
      return res.status(400).json({ success: false, message: "Invalid mock outcome." });
    }
    const updated = await resolveMockPayment({ app: req.app, intentId: intent.id, outcome });
    return res.json({ success: true, data: updated });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Unable to resolve development payment.",
    });
  }
};

export const inquireBankTransfer = async (req, res) => {
  try {
    const intent = await recordBankTransferInquiry({
      app: req.app,
      salonId: Number(req.salon_id),
      actorId: Number(req.user.id),
      actorRole: req.user.role,
      reference: req.params.reference,
    });
    const completed = intent.payment_status === "CONFIRMED" && intent.posting_status === "POSTED";
    const investigation = intent.verification_status === "INVESTIGATION" || intent.posting_status === "FAILED";
    return res.json({
      success: true,
      data: intent,
      message: completed
        ? "Payment received, verified, and recorded."
        : investigation
          ? "Payment requires investigation."
          : String(process.env.PAYMENTS_MODE || "mock").toLowerCase() === "mock" && !isProduction()
            ? "Development mock bank credit submitted for verification."
          : "Payment not yet found. Automatic verification will continue.",
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || "Unable to check the bank transfer." });
  }
};

export const verifyManualBankPayout = async (req, res) => {
  try {
    const intent = await verifyManualBankDisbursement({
      app: req.app,
      salonId: Number(req.salon_id),
      actor: actor(req),
      reference: req.params.reference,
      bankTransactionId: req.body?.bank_transaction_id,
      verificationNote: req.body?.verification_note,
    });
    return res.json({ success: true, data: intent });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Unable to verify the manual bank payout.' });
  }
};

export const listBankAccounts = async (req, res) => {
  try {
    const canManage = String(req.user.role || "").toLowerCase() === "owner";
    const { rows } = await db.query(
      `SELECT id, bank_name, account_name, account_number, currency, branch_name, verification_mode, is_active
       FROM salon_bank_accounts WHERE salon_id = $1 AND ($2::boolean OR is_active = TRUE)
       ORDER BY is_active DESC, id DESC`,
      [Number(req.salon_id), canManage],
    );
    return res.json({ accounts: rows });
  } catch (error) {
    return res.status(500).json({ error: "Unable to load official bank accounts." });
  }
};

export const saveBankAccount = async (req, res) => {
  try {
    const bankName = String(req.body?.bank_name || "").trim();
    const accountName = String(req.body?.account_name || "").trim();
    const accountNumber = String(req.body?.account_number || "").trim();
    const currency = String(req.body?.currency || "UGX").trim().toUpperCase();
    const verificationMode = String(req.body?.verification_mode || "REFERENCE_MATCHING").trim().toUpperCase();
    if (!bankName || !accountName || !accountNumber || !/^[A-Z]{3}$/.test(currency)) {
      return res.status(400).json({ error: "Bank name, account name, account number, and currency are required." });
    }
    const created = await db.transaction(async (client) => {
      const deactivated = await client.query(
        `UPDATE salon_bank_accounts SET is_active = FALSE, updated_at = NOW(), updated_by = $2
         WHERE salon_id = $1 AND currency = $3 AND is_active = TRUE
         RETURNING id, bank_name, account_name, account_number, currency, branch_name, verification_mode`,
        [Number(req.salon_id), Number(req.user.id), currency],
      );
      const { rows } = await client.query(
        `INSERT INTO salon_bank_accounts (
          salon_id, bank_name, account_name, account_number, currency, branch_name, verification_mode, is_active, created_by, updated_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$8) RETURNING *`,
        [Number(req.salon_id), bankName, accountName, accountNumber, currency, String(req.body?.branch_name || "").trim() || null, verificationMode, Number(req.user.id)],
      );
      await appendAuditEvent({
        client,
        salonId: req.salon_id,
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: "BANK_ACCOUNT_CONFIGURED",
        module: "PAYMENTS",
        recordType: "SALON_BANK_ACCOUNT",
        recordId: rows[0].id,
        previousValues: deactivated.rows[0] || null,
        newValues: {
          id: rows[0].id,
          bank_name: rows[0].bank_name,
          account_name: rows[0].account_name,
          account_number: rows[0].account_number,
          currency: rows[0].currency,
          branch_name: rows[0].branch_name,
          verification_mode: rows[0].verification_mode,
          is_active: rows[0].is_active,
        },
        requestId: req.requestId,
      });
      return rows[0];
    });
    return res.status(201).json({ account: created });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Unable to save the official bank account." });
  }
};

export const postMockBankCredit = async (req, res) => {
  try {
    if (isProduction() || String(process.env.PAYMENTS_MODE || "mock").toLowerCase() !== "mock") {
      return res.status(404).json({ error: "Not found." });
    }
    const bankTransactionId = String(req.body?.bank_transaction_id || "").trim()
      || `MOCK-BANK-${crypto.randomBytes(7).toString("hex").toUpperCase()}`;
    const deliveryMode = String(req.body?.delivery_mode || "IMMEDIATE").trim().toUpperCase();
    if (!["IMMEDIATE", "MISSED_NOTIFICATION", "DELAYED"].includes(deliveryMode)) {
      return res.status(400).json({ error: "Choose immediate, missed-notification, or delayed delivery." });
    }
    const input = {
      app: req.app,
      salonId: Number(req.salon_id),
      bankAccountId: Number(req.body?.bank_account_id),
      amount: req.body?.amount,
      currency: req.body?.currency || "UGX",
      transferReference: req.body?.transfer_reference,
      bankTransactionId,
      notificationDelivered: deliveryMode === "IMMEDIATE",
      providerFee: req.body?.provider_fee,
    };
    if (deliveryMode === "DELAYED") {
      const delayMs = Math.max(1000, Math.min(Number(req.body?.delay_ms) || 5000, 60000));
      setTimeout(() => receiveMockBankCredit({ ...input, notificationDelivered: true })
        .catch((error) => console.error("Delayed mock bank credit failed", { bankTransactionId, message: error.message })), delayMs);
      return res.status(202).json({ success: true, scheduled: true, bank_transaction_id: bankTransactionId, delay_ms: delayMs });
    }
    const result = await receiveMockBankCredit(input);
    return res.status(201).json({ success: true, ...result });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Unable to simulate bank credit." });
  }
};

const safeEqual = (left, right) => {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const receiveBankNotification = async (req, res) => {
  try {
    if (String(process.env.BANK_NOTIFICATIONS_ENABLED || "false").toLowerCase() !== "true") {
      return res.status(404).json({ error: "Not found." });
    }
    const secret = String(process.env.BANK_WEBHOOK_SECRET || "");
    if (!secret) return res.status(503).json({ error: "Bank notification authentication is not configured." });
    const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    const supplied = String(req.get("x-salehish-bank-signature") || "").replace(/^sha256=/i, "");
    if (!safeEqual(expected, supplied)) return res.status(401).json({ error: "Invalid bank notification signature." });

    const bankAccountId = Number(req.params.accountId);
    const account = (await db.query(
      `SELECT id, salon_id, account_number, currency FROM salon_bank_accounts WHERE id = $1 AND is_active = TRUE`,
      [bankAccountId],
    )).rows[0];
    if (!account) return res.status(404).json({ error: "Receiving account not found." });
    const credit = createBankAdapter().normalizeIncomingCredit(req.body);
    if (credit.destinationAccount && credit.destinationAccount !== String(account.account_number)) {
      return res.status(400).json({ error: "Destination account does not match the configured receiving account." });
    }
    if (credit.status !== "CONFIRMED") {
      return res.status(202).json({ accepted: true, matched: false, reason: "Credit is not final." });
    }
    const result = await receiveBankCredit({
      app: req.app,
      salonId: Number(account.salon_id),
      bankAccountId,
      amount: credit.amount,
      currency: credit.currency || account.currency,
      transferReference: credit.transferReference,
      bankTransactionId: credit.bankTransactionId,
      providerFee: credit.providerFee,
      source: "authenticated-bank-notification",
      notificationDelivered: true,
    });
    return res.status(result.duplicate ? 200 : 201).json({ accepted: true, duplicate: result.duplicate, matched: Boolean(result.intent) });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Unable to process bank notification." });
  }
};

const ledgerCte = `WITH ledger AS (
  SELECT pi.id::text AS id, 'PAYMENT_INTENT'::text AS record_kind, pi.salon_id, pi.initiated_by,
    pi.intent_reference, pi.bank_payment_reference, pi.provider, pi.direction, pi.origin_type, pi.origin_action,
    pi.operation_description, pi.amount, pi.currency, pi.payment_status, pi.posting_status,
    pi.verification_status, pi.provider_reference, pi.provider_transaction_id, pi.provider_fee,
    pi.reconciliation_status, pi.manual_execution_status, pi.manual_execution_reference, pi.manual_execution_note,
    pi.created_at, pi.confirmed_at, pi.posted_at,
    pi.counterparty_name, pi.counterparty_identifier, pa.source_type, pa.source_id,
    TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) AS initiated_by_name
  FROM payment_intents pi
  LEFT JOIN payment_allocations pa ON pa.payment_intent_id = pi.id
  LEFT JOIN users u ON u.id = pi.initiated_by AND u.salon_id = pi.salon_id
  UNION ALL
  SELECT bic.id::text, 'UNMATCHED_BANK_CREDIT', bic.salon_id, NULL::integer,
    NULL::varchar, bic.transfer_reference, 'BANK_TRANSFER'::varchar, 'COLLECTION'::varchar,
    'UNMATCHED_BANK_CREDIT'::varchar, 'INCOMING_CREDIT'::varchar,
    'Incoming bank credit awaiting reconciliation'::varchar, bic.amount, bic.currency,
    'UNMATCHED'::varchar, 'NOT_APPLICABLE'::varchar,
    'INVESTIGATION'::varchar, bic.transfer_reference, bic.bank_transaction_id, bic.provider_fee,
    bic.match_status, 'NOT_REQUIRED'::varchar, NULL::varchar, NULL::text,
    bic.created_at, bic.credited_at, NULL::timestamptz,
    NULL::varchar, NULL::varchar, NULL::varchar, NULL::bigint, NULL::text
  FROM bank_incoming_credits bic
  WHERE bic.matched_payment_intent_id IS NULL
)`;

const queryExternalLedger = async ({ req, paginate = true, exportLimit = 10000 }) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = paginate ? Math.min(100, Math.max(10, Number(req.query.pageSize) || 25)) : exportLimit;
  const salonId = Number(req.salon_id);
  const timezone = (await db.query(`SELECT COALESCE(NULLIF(timezone,''), 'Africa/Kampala') AS timezone FROM salons WHERE id = $1`, [salonId])).rows[0]?.timezone || "Africa/Kampala";
  const values = [salonId];
  const clauses = ["l.salon_id = $1"];
  const role = String(req.user.role || "").toLowerCase();
  if (role === "cashier") { values.push(Number(req.user.id)); clauses.push(`l.initiated_by = $${values.length}`); }
  for (const [column, query] of [["l.provider", req.query.provider], ["l.direction", req.query.direction], ["l.origin_type", req.query.origin_type]]) {
    if (query && query !== "ALL") { values.push(String(query).toUpperCase()); clauses.push(`${column} = $${values.length}`); }
  }
  if (req.query.status && req.query.status !== "ALL") {
    const status = String(req.query.status).toUpperCase();
    values.push(status);
    if (status === "FAILED") {
      clauses.push(`(l.payment_status = $${values.length} OR l.posting_status = $${values.length})`);
    } else {
      clauses.push(`l.payment_status = $${values.length}`);
    }
  }
  values.push(timezone);
  const timezoneParam = `$${values.length}`;
  let from = req.query.from;
  let to = req.query.to;
  const period = String(req.query.period || "").toUpperCase();
  if (period) {
    const today = DateTime.now().setZone(timezone);
    if (period === "TODAY") from = to = today.toISODate();
    if (period === "YESTERDAY") from = to = today.minus({ days: 1 }).toISODate();
    if (period === "THIS_WEEK") { from = today.startOf("week").toISODate(); to = today.toISODate(); }
    if (period === "THIS_MONTH") { from = today.startOf("month").toISODate(); to = today.toISODate(); }
    if (period === "LAST_MONTH") { const month = today.minus({ months: 1 }); from = month.startOf("month").toISODate(); to = month.endOf("month").toISODate(); }
    if (period === "THIS_YEAR") { from = today.startOf("year").toISODate(); to = today.toISODate(); }
  }
  if (from) { values.push(from); clauses.push(`(l.created_at AT TIME ZONE ${timezoneParam})::date >= $${values.length}::date`); }
  if (to) { values.push(to); clauses.push(`(l.created_at AT TIME ZONE ${timezoneParam})::date <= $${values.length}::date`); }
  if (req.query.search) {
    values.push(`%${String(req.query.search).trim()}%`);
    clauses.push(`(l.intent_reference ILIKE $${values.length} OR l.bank_payment_reference ILIKE $${values.length}
      OR l.provider_reference ILIKE $${values.length} OR l.provider_transaction_id ILIKE $${values.length}
      OR l.source_id::text ILIKE $${values.length})`);
  }
  const where = clauses.join(" AND ");
  const filterValues = [...values];
  values.push(pageSize, paginate ? (page - 1) * pageSize : 0);
  const result = await db.query(
    `${ledgerCte}
     SELECT l.*, COUNT(*) OVER() AS total_count FROM ledger l
      WHERE ${where}
      ORDER BY l.created_at DESC, l.id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  const totals = await db.query(
    `${ledgerCte}
     SELECT
       COALESCE(SUM(amount) FILTER (WHERE payment_status = 'CONFIRMED' AND posting_status = 'POSTED' AND direction = 'COLLECTION'),0) AS confirmed_collections,
       COALESCE(SUM(amount) FILTER (WHERE payment_status = 'CONFIRMED' AND posting_status = 'POSTED' AND direction = 'DISBURSEMENT'),0) AS confirmed_disbursements,
       COALESCE(SUM(provider_fee) FILTER (WHERE payment_status = 'CONFIRMED' AND posting_status = 'POSTED'),0) AS provider_fees,
       COUNT(*) FILTER (WHERE payment_status = 'PENDING') AS pending_count,
       COUNT(*) FILTER (WHERE payment_status = 'FAILED' OR posting_status = 'FAILED') AS failed_count,
       COUNT(*) FILTER (WHERE payment_status = 'UNMATCHED') AS unmatched_count
      FROM ledger l WHERE ${where}`,
    filterValues,
  );
  return { rows: result.rows, page, pageSize, total: Number(result.rows[0]?.total_count || 0), totals: totals.rows[0], timezone };
};

export const listExternalPayments = async (req, res) => {
  try {
    return res.json(await queryExternalLedger({ req }));
  } catch (error) {
    console.error("External Payments Ledger query failed", error);
    return res.status(500).json({ error: "Unable to load the External Payments Ledger." });
  }
};

const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export const exportExternalPayments = async (req, res) => {
  try {
    const data = await queryExternalLedger({ req, paginate: false });
    const format = String(req.params.format || "csv").toLowerCase();
    if (format === "csv") {
      const columns = ["Reference", "Provider reference", "Provider transaction ID", "Provider", "Direction", "Transaction type", "Description", "Amount", "Currency", "Payment status", "Posting status", "Verification", "Reconciliation", "Provider fee", "Date/time", "Initiated by", "Counterparty", "Linked record"];
      const lines = data.rows.map((row) => [row.bank_payment_reference || row.intent_reference, row.provider_reference, row.provider_transaction_id, row.provider, row.direction, row.origin_type, row.operation_description, row.amount, row.currency, row.payment_status, row.posting_status, row.verification_status, row.reconciliation_status, row.provider_fee, row.created_at, row.initiated_by_name, row.counterparty_name, row.source_type ? `${row.source_type} #${row.source_id}` : ""].map(csvCell).join(","));
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=salehish-external-payments.csv");
      return res.send([columns.map(csvCell).join(","), ...lines].join("\n"));
    }
    if (format !== "pdf") return res.status(400).json({ error: "Choose CSV or PDF export." });
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const addPage = () => {
      const page = pdf.addPage([842, 595]);
      page.drawText("Salehish External Payments Ledger", { x: 34, y: 558, size: 16, font: bold, color: rgb(0.15, 0.12, 0.18) });
      page.drawText(`Timezone: ${data.timezone} · Exported ${new Date().toISOString()}`, { x: 34, y: 540, size: 8, font });
      return page;
    };
    let page = addPage(); let y = 516;
    for (const row of data.rows) {
      if (y < 38) { page = addPage(); y = 516; }
      const ref = row.bank_payment_reference || row.intent_reference || row.provider_transaction_id || "Unmatched credit";
      const text = `${ref} | ${row.provider} | ${row.direction} | ${row.origin_type} | ${row.currency} ${Number(row.amount).toLocaleString("en-UG")} | ${row.payment_status}/${row.posting_status}`;
      page.drawText(text.slice(0, 145), { x: 34, y, size: 8, font });
      y -= 14;
    }
    const bytes = await pdf.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=salehish-external-payments.pdf");
    return res.send(Buffer.from(bytes));
  } catch (error) {
    console.error("External Payments Ledger export failed", error);
    return res.status(500).json({ error: "Unable to export the External Payments Ledger." });
  }
};
