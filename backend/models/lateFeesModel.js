import db from "./database.js";
const select = `l.id, l.employee_id, l.amount, l.reason, l.salon_id, l.fee_date::text AS fee_date, l.fee_time::text AS fee_time, l.entry_type, l.backdate_reason, l.created_at`;
export const saveLateFee = async ({ employee_id, amount, reason, salon_id, fee_date, fee_time, entry_type, backdate_reason }) => (await db.query(
  `INSERT INTO late_fees (employee_id,amount,reason,salon_id,fee_date,fee_time,entry_type,backdate_reason,created_at)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW())
   RETURNING id,employee_id,amount,reason,salon_id,fee_date::text AS fee_date,fee_time::text AS fee_time,entry_type,backdate_reason,created_at`,
  [employee_id,amount,reason,salon_id,fee_date,fee_time,entry_type,backdate_reason||null])).rows[0];
export const fetchAllLateFees = async (salon_id) => (await db.query(`SELECT ${select} FROM late_fees l WHERE l.salon_id=$1 AND l.fee_date=(NOW() AT TIME ZONE 'Africa/Kampala')::date ORDER BY l.fee_date DESC,l.fee_time DESC,l.id DESC`,[salon_id])).rows;
export const fetchLateFeeById = async (id,salon_id) => (await db.query(`SELECT ${select} FROM late_fees l WHERE l.id=$1 AND l.salon_id=$2`,[id,salon_id])).rows[0];
export const UpdateLateFeeById = async ({id,employee_id,amount,reason,fee_date,fee_time,entry_type,backdate_reason,salon_id}) => (await db.query(
  `UPDATE late_fees SET employee_id=$1,amount=$2,reason=$3,fee_date=$4,fee_time=$5,entry_type=$6,backdate_reason=$7 WHERE id=$8 AND salon_id=$9
   RETURNING id,employee_id,amount,reason,salon_id,fee_date::text AS fee_date,fee_time::text AS fee_time,entry_type,backdate_reason,created_at`,
  [employee_id,amount,reason,fee_date,fee_time,entry_type,backdate_reason||null,id,salon_id])).rows[0];
export const DeleteLateFeeById = async (id,salon_id) => (await db.query("DELETE FROM late_fees WHERE id=$1 AND salon_id=$2 RETURNING id",[id,salon_id])).rowCount>0;
export default {saveLateFee,fetchAllLateFees,fetchLateFeeById,UpdateLateFeeById,DeleteLateFeeById};
