import db from "./database.js";

const expenseSelect = `
  e.id, e.name, e.amount, e.description, e.salon_id,
  e.expense_date::text AS expense_date,
  e.expense_time::text AS expense_time,
  e.entry_type, e.backdate_reason, e.created_at
`;

export const saveExpense = async ({ name, amount, description, salon_id, expense_date, expense_time, entry_type, backdate_reason }) => {
  const { rows } = await db.query(
    `INSERT INTO expenses (name, amount, description, salon_id, expense_date, expense_time, entry_type, backdate_reason, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
     RETURNING id, name, amount, description, salon_id, expense_date::text AS expense_date,
       expense_time::text AS expense_time, entry_type, backdate_reason, created_at`,
    [name, amount, description || null, salon_id, expense_date, expense_time, entry_type, backdate_reason || null],
  );
  return rows[0];
};

export const fetchAllExpenses = async (salon_id) => {
  const { rows } = await db.query(
    `SELECT ${expenseSelect} FROM expenses e
     WHERE e.salon_id = $1 AND e.expense_date = (NOW() AT TIME ZONE 'Africa/Kampala')::date
     ORDER BY e.expense_date DESC, e.expense_time DESC, e.id DESC`, [salon_id]);
  return rows;
};

export const fetchExpenseById = async (id, salon_id) => {
  const { rows } = await db.query(`SELECT ${expenseSelect} FROM expenses e WHERE e.id = $1 AND e.salon_id = $2`, [id, salon_id]);
  return rows[0];
};

export const UpdateExpenseById = async ({ id, name, amount, description, expense_date, expense_time, entry_type, backdate_reason, salon_id }) => {
  const { rows } = await db.query(
    `UPDATE expenses
     SET name = $1, amount = $2, description = $3, expense_date = $4,
         expense_time = $5, entry_type = $6, backdate_reason = $7
     WHERE id = $8 AND salon_id = $9
     RETURNING id, name, amount, description, salon_id, expense_date::text AS expense_date,
       expense_time::text AS expense_time, entry_type, backdate_reason, created_at`,
    [name, amount, description || null, expense_date, expense_time, entry_type, backdate_reason || null, id, salon_id]);
  return rows[0];
};

export const DeleteExpenseById = async (id, salon_id) => {
  const result = await db.query("DELETE FROM expenses WHERE id = $1 AND salon_id = $2 RETURNING id;", [id, salon_id]);
  return result.rowCount > 0;
};

export default { saveExpense, fetchAllExpenses, fetchExpenseById, UpdateExpenseById, DeleteExpenseById };
