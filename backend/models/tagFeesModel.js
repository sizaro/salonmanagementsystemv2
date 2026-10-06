import db from "./database.js";
const select = `t.id, t.employee_id, t.amount, t.reason, t.salon_id, t.fee_date::text AS fee_date, t.fee_time::text AS fee_time, t.entry_type, t.backdate_reason, t.created_at`;

export const saveTagFee = async ({ employee_id, amount, reason, salon_id, fee_date, fee_time, entry_type, backdate_reason }) => {
  const { rows } = await db.query(
    `INSERT INTO tag_fee (employee_id, amount, reason, salon_id, fee_date, fee_time, entry_type, backdate_reason, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
     RETURNING id, employee_id, amount, reason, salon_id, fee_date::text AS fee_date, fee_time::text AS fee_time, entry_type, backdate_reason, created_at`,
    [employee_id, amount, reason, salon_id, fee_date, fee_time, entry_type, backdate_reason || null]);
  return rows[0];
};
export const fetchAllTagFees = async (salon_id) => (await db.query(`SELECT ${select} FROM tag_fee t WHERE t.salon_id = $1 AND t.fee_date = (NOW() AT TIME ZONE 'Africa/Kampala')::date ORDER BY t.fee_date DESC, t.fee_time DESC, t.id DESC`, [salon_id])).rows;
export const fetchTagFeeById = async (id, salon_id) => (await db.query(`SELECT ${select} FROM tag_fee t WHERE t.id = $1 AND t.salon_id = $2`, [id, salon_id])).rows[0];
export const UpdateTagFeeById = async ({ id, employee_id, amount, reason, fee_date, fee_time, entry_type, backdate_reason, salon_id }) => (await db.query(
  `UPDATE tag_fee SET employee_id=$1, amount=$2, reason=$3, fee_date=$4, fee_time=$5, entry_type=$6, backdate_reason=$7
   WHERE id=$8 AND salon_id=$9
   RETURNING id, employee_id, amount, reason, salon_id, fee_date::text AS fee_date, fee_time::text AS fee_time, entry_type, backdate_reason, created_at`,
  [employee_id, amount, reason, fee_date, fee_time, entry_type, backdate_reason || null, id, salon_id])).rows[0];
export const DeleteTagFeeById = async (id, salon_id) => (await db.query("DELETE FROM tag_fee WHERE id=$1 AND salon_id=$2 RETURNING id", [id, salon_id])).rowCount > 0;
export default { saveTagFee, fetchAllTagFees, fetchTagFeeById, UpdateTagFeeById, DeleteTagFeeById };
