import dotenv from "dotenv";
import { saveTagFee, fetchAllTagFees, fetchTagFeeById, UpdateTagFeeById, DeleteTagFeeById } from "../models/tagFeesModel.js";
import { assertHistoricalRecordAccess, resolveBusinessDateTime } from "../utils/businessRecord.js";
dotenv.config();
const salonId = (req) => req.user?.salon_id || Number(process.env.DEFAULT_SALON_ID);
const business = ({ body, user, existing }) => {
  const entry_type = body.entry_type || existing?.entry_type || "current";
  assertHistoricalRecordAccess({ user, entryType: entry_type, reason: body.backdate_reason ?? existing?.backdate_reason, label: "tag-fee" });
  if (existing && entry_type === "current") return { entry_type, fee_date: existing.fee_date, fee_time: existing.fee_time, backdate_reason: null };
  const value = resolveBusinessDateTime({ entryType: entry_type, date: body.fee_date, time: body.fee_time, label: "tag-fee" });
  return { entry_type, fee_date: value.date, fee_time: value.time, backdate_reason: entry_type === "past" ? String(body.backdate_reason).trim() : null };
};
export const getAllTagFees = async (req,res) => { try { res.json(await fetchAllTagFees(salonId(req))); } catch (err) { console.error(err); res.status(500).json({ error:"Failed to fetch tag fees" }); } };
export const getTagFeeById = async (req,res) => { try { const data=await fetchTagFeeById(req.params.id,salonId(req)); if(!data)return res.status(404).json({error:"Tag fee not found"}); res.json(data); } catch(err){console.error(err);res.status(500).json({error:"Failed to fetch tag fee"});} };
export const createTagFee = async (req,res) => { try { const data=await saveTagFee({ employee_id:req.body.employee_id, amount:req.body.amount, reason:req.body.reason, salon_id:salonId(req), ...business({body:req.body,user:req.user}) }); res.status(201).json({message:"Tag fee created successfully",data}); } catch(err){console.error(err);res.status(err.statusCode||500).json({error:err.statusCode?err.message:"Failed to create tag fee"});} };
export const updateTagFeeById = async (req,res) => { try { const id=req.params.id; const existing=await fetchTagFeeById(id,salonId(req)); if(!existing)return res.status(404).json({error:"Tag fee not found"}); const data=await UpdateTagFeeById({id,employee_id:req.body.employee_id,amount:req.body.amount,reason:req.body.reason,salon_id:salonId(req),...business({body:req.body,user:req.user,existing})});res.json({message:"Tag fee updated successfully",data}); }catch(err){console.error(err);res.status(err.statusCode||500).json({error:err.statusCode?err.message:"Failed to update tag fee"});} };
export const deleteTagFeeById = async (req,res) => { try { const deleted=await DeleteTagFeeById(req.params.id,salonId(req));if(!deleted)return res.status(404).json({error:"Tag fee not found"});res.json({message:"Tag fee deleted successfully"}); }catch(err){console.error(err);res.status(500).json({error:"Failed to delete tag fee"});} };
export default { getAllTagFees,getTagFeeById,createTagFee,updateTagFeeById,deleteTagFeeById };
