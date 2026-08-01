import fs from "fs";
import path from "path";
import { redisClient } from "../config/redis.js";
import { DateTime } from "luxon";
import dotenv from "dotenv";
dotenv.config();

import {
  fetchServiceDefinitionsModel,
  fetchServiceDefinitionByIdModel,
  createServiceDefinitionModel,
  updateServiceDefinitionModel,
  deleteServiceDefinitionModel,
  fetchServiceRolesModel,
  saveServiceTransaction,
  fetchAllServiceTransactions,
  fetchServiceTransactionById,
  updateServiceTransactionModel,
  updateServiceTransactionModelt,
  DeleteServiceTransaction,
  fetchServiceMaterialsModel,
  updateServiceTransactionAppointmentModel
} from "../models/servicesModel.js";

// =========================================================
// SERVICE DEFINITIONS CONTROLLER
// =========================================================

// GET ALL SERVICE DEFINITIONS
export const getServiceDefinitions = async (req, res) => {
  try {
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;
    const services = await fetchServiceDefinitionsModel(salon_id);
    res.json({ success: true, data: services });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch services" });
  }
};

// GET SINGLE SERVICE DEFINITION
export const getServiceDefinitionById = async (req, res) => {
  try {
    const { id } = req.params;
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const service = await fetchServiceDefinitionByIdModel(id, salon_id);
    if (!service) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }

    res.json({ success: true, data: service });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch service" });
  }
};

// CREATE SERVICE DEFINITION
export const createServiceDefinition = async (req, res) => {
  try {
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const {
      service_name,
      service_amount,
      salon_amount,
      section_id,
      description
    } = req.body;

    const parseMaybeJSON = (value) => {
      if (!value) return [];
      if (typeof value === "string") return JSON.parse(value);
      return value;
    };

    const roles = parseMaybeJSON(req.body.roles);
    const materials = parseMaybeJSON(req.body.materials);

    const service_image = req.file
      ? `/uploads/images/${req.file.filename}`
      : null;

    const data = {
      service_name,
      service_amount,
      salon_amount,
      section_id,
      description,
      service_image,
      roles,
      materials,
      salon_id
    };

    const newService = await createServiceDefinitionModel(data);

    res.status(201).json({ success: true, data: newService });
  } catch (err) {
    console.error("Error creating service definition:", err);
    res.status(500).json({ success: false, message: "Failed to create service" });
  }
};

// UPDATE SERVICE DEFINITION
export const updateServiceDefinition = async (req, res) => {
  try {
    const { id } = req.params;
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const {
      service_name,
      service_amount,
      salon_amount,
      section_id,
      description,
      roles = [],
      materials = []
    } = req.body;

    const existingService = await fetchServiceDefinitionByIdModel(id, salon_id);
    if (!existingService) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }

    let service_image = existingService.image_url;

    if (req.file?.filename) {
      if (existingService.image_url) {
        const oldPath = path.join(process.cwd(), existingService.image_url);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      service_image = `/uploads/images/${req.file.filename}`;
    }

    const data = {
      service_name,
      service_amount,
      salon_amount,
      section_id,
      description,
      service_image,
      roles,
      materials,
      salon_id
    };

    const updatedService = await updateServiceDefinitionModel(id, data, salon_id);
    res.json({ success: true, data: updatedService });
  } catch (err) {
    console.error("Error updating service definition:", err);
    res.status(500).json({ success: false, message: "Failed to update service" });
  }
};

// DELETE SERVICE DEFINITION
export const deleteServiceDefinition = async (req, res) => {
  try {
    const { id } = req.params;
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const deleted = await deleteServiceDefinitionModel(id, salon_id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }

    res.json({ success: true, message: "Service deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to delete service" });
  }
};

// =========================================================
// SERVICE TRANSACTIONS
// =========================================================

export const createServiceTransaction = async (req, res) => {
  try {
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const {
      entry_type,
      service_date,
      service_time
    } = req.body;


    let finalServiceDate = null;
    let finalServiceTime = null;


    // CURRENT WALK-IN SERVICE
    if (entry_type === "current") {

      const now = DateTime
        .now()
        .setZone("Africa/Kampala");


      finalServiceDate = now.toISODate();

      finalServiceTime = now.toFormat("HH:mm:ss");

    }


    // DIRECTOR ADDING PAST SERVICE
    else if (entry_type === "past") {

      if (!service_date || !service_time) {
        return res.status(400).json({
          success: false,
          message: "Past service requires service date and service time"
        });
      }


      finalServiceDate = service_date;
      finalServiceTime = service_time;

    }


    else {
      return res.status(400).json({
        success: false,
        message: "Invalid service entry type"
      });
    }



    const data = {
      ...req.body,

      salon_id,

      // These values are controlled by backend
      service_date: finalServiceDate,
      service_time: finalServiceTime
    };

    // A customer may only create an appointment for their own account. Never
    // trust a customer_id or created_by value submitted by the browser.
    if (req.user?.role === "customer") {
      data.customer_id = req.user.id;
      data.created_by = req.user.id;
      data.status = "pending";
    }


    console.log("SERVICE DATA BEFORE MODEL:");
    console.log({
      entry_type: data.entry_type,
      service_date: data.service_date,
      service_time: data.service_time,
      salon_id: data.salon_id
    });



    const transaction = await saveServiceTransaction(data);



    const io = req.app.get("io") || global.io;

    if (io && data.status === "pending") {
      io.emit("appointment_created", {
        id: transaction.id,
        data: transaction
      });
    }



    return res.json({
      success: true,
      data: transaction
    });


  } catch (err) {

    console.error(
      "CREATE SERVICE TRANSACTION ERROR:",
      err
    );


    return res.status(500).json({
      success: false,
      message: "Failed to create service transaction"
    });

  }
};


export const getAllServiceTransactions = async (req, res) => {
  try {
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;
    const transactions = await fetchAllServiceTransactions(salon_id);
    const role = req.user?.role;
    const userId = Number(req.user?.id);
    const visibleTransactions = role === "customer"
      ? transactions.filter((transaction) => Number(transaction.customer_id) === userId)
      : role === "employee"
        ? transactions.filter((transaction) =>
            transaction.performers?.some((performer) => Number(performer.employee_id) === userId),
          )
        : transactions;
    res.json({ success: true, data: visibleTransactions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch service transactions" });
  }
};

export const getServiceTransactionById = async (req, res) => {
  try {
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;
    console.log("id and salon_id in the models", req.params.id, "salon_id", salon_id)
    const transaction = await fetchServiceTransactionById(req.params.id, salon_id);

    if (!transaction) {
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }

    const role = req.user?.role;
    const userId = Number(req.user?.id);
    const canView = role !== "customer" && role !== "employee"
      ? true
      : role === "customer"
        ? Number(transaction.customer_id) === userId
        : transaction.performers?.some((performer) => Number(performer.employee_id) === userId);
    if (!canView) return res.status(403).json({ success: false, message: "You cannot view this transaction" });

    res.json({ success: true, data: transaction });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch transaction" });
  }
};

// =========================================================
// ROLES & MATERIALS
// =========================================================

export const getServiceRoles = async (req, res) => {
  try {
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;
    const roles = await fetchServiceRolesModel(salon_id);
    res.json({ success: true, data: roles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch service roles" });
  }
};

export const getServiceMaterials = async (req, res) => {
  try {
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;
    const materials = await fetchServiceMaterialsModel(salon_id);
    res.json({ success: true, data: materials });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch service materials" });
  }
};


export const updateServiceTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const {
      service_definition_id,
      created_by,
      appointment_date,
      appointment_time,
      customer_id,
      customer_note,
      status,
      performers = []
    } = req.body;

    const updates = {
      service_definition_id,
      created_by,
      appointment_date,
      appointment_time,
      customer_id,
      customer_note,
      status,
      performers,
      salon_id
    };

    const updated = await updateServiceTransactionModel(id, updates, salon_id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to update transaction"
    });
  }
};


export const updateServiceTransactionAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const { status, cancel_reason } = req.body;

    const updates = {
      status,
      cancel_reason,
      id,
      salon_id
    };

    const updated = await updateServiceTransactionAppointmentModel(
      id,
      updates,
      salon_id
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to update transaction"
    });
  }
};

export const updateServiceTransactiont = async (req, res) => {
  try {
    const { id } = req.params;
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const { newTime } = req.body;

    const updated = await updateServiceTransactionModelt(
      id,
      newTime,
      salon_id
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to update transaction time"
    });
  }
};

export const deleteServiceTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const deleted = await DeleteServiceTransaction(id, salon_id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found"
      });
    }

    res.json({
      success: true,
      message: "Transaction deleted successfully"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to delete transaction"
    });
  }
};
