import { createCampaign, createGoal, getOwnerInsights, listPublicCampaigns, updateCampaign } from "../models/ownerIntelligenceModel.js";
const respond = (res, error) => {
  if (error?.code === "42P01") {
    return res.status(503).json({ error: "Goals and campaign tools need their database setup before they can be saved." });
  }
  return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : "Unable to process business intelligence data" });
};
export const getInsights = async (req,res) => { try { res.json(await getOwnerInsights({ salonId:req.salon_id,startDate:req.query.start_date,endDate:req.query.end_date })); } catch (e) { respond(res,e); } };
export const postGoal = async (req,res) => { try { res.status(201).json({ goal:await createGoal({ salonId:req.salon_id,actorId:req.user.id,body:req.body }) }); } catch (e) { respond(res,e); } };
export const postCampaign = async (req,res) => { try { res.status(201).json({ campaign:await createCampaign({ salonId:req.salon_id,actorId:req.user.id,body:req.body }) }); } catch (e) { respond(res,e); } };
export const patchCampaign = async (req,res) => { try { res.json({ campaign:await updateCampaign({ salonId:req.salon_id,id:req.params.id,body:req.body }) }); } catch (e) { respond(res,e); } };
export const getPublicCampaigns = async (req,res) => { try { res.json({ campaigns:await listPublicCampaigns({ salonId:Number(process.env.DEFAULT_SALON_ID) }) }); } catch (e) { respond(res,e); } };
