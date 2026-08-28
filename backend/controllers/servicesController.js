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
  updateServiceTransactionAppointmentModel,
  validateAppointmentRequestModel,
  fetchAppointmentBusyEmployeeIdsModel,
} from "../models/servicesModel.js";

const KAMPALA_ZONE = "Africa/Kampala";

const APPOINTMENT_TRANSITIONS = {
  pending: new Set(["confirmed", "cancelled"]),
  confirmed: new Set(["completed", "cancelled"]),
  completed: new Set(),
  cancelled: new Set(),
};

const VALID_SERVICE_SOURCES = new Set(["walk_in", "online_booking"]);

const requestError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const emitAppointmentChange = (req, action, transaction) => {
  const io = req.app.get("io") || global.io;
  const salonId = transaction?.salon_id || req.user?.salon_id;
  if (!io || !salonId || !transaction?.id) return;

  io.to(`salon:${salonId}`).emit("appointment:changed", {
    id: transaction.id,
    status: transaction.status,
    action,
    updatedAt: new Date().toISOString(),
  });
};

// =========================================================
// HELPERS
// =========================================================

const normalizeServiceSource = (value, fallback = "walk_in") => {
  const source = String(value || "")
    .trim()
    .toLowerCase();

  if (!source) {
    return fallback;
  }

  if (!VALID_SERVICE_SOURCES.has(source)) {
    throw requestError(
      "Invalid service source. Use walk_in or online_booking.",
    );
  }

  return source;
};

const normalizeInternalPerformers = (performers = []) => {
  if (!Array.isArray(performers)) {
    return [];
  }

  return performers.map((performer) => ({
    role_id: performer.role_id ?? performer.service_role_id,

    employee_id: performer.employee_id || null,

    preferred_employee_id: performer.preferred_employee_id || null,

    earned_amount: performer.earned_amount ?? performer.role_amount ?? null,
  }));
};

const normalizeCustomerBookingPerformers = (performers = []) => {
  if (!Array.isArray(performers)) {
    return [];
  }

  return performers.map((performer) => ({
    role_id: performer.role_id ?? performer.service_role_id,

    // Customer never assigns the actual worker.
    employee_id: null,

    // Customer selection is only a preference.
    preferred_employee_id:
      performer.preferred_employee_id || performer.employee_id || null,
  }));
};

// =========================================================
// SERVICE DEFINITIONS CONTROLLER
// =========================================================

// =========================================================
// GET ALL SERVICE DEFINITIONS
// =========================================================

export const getServiceDefinitions = async (req, res) => {
  try {
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const services = await fetchServiceDefinitionsModel(salon_id);

    return res.json({
      success: true,
      data: services,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch services",
    });
  }
};

// =========================================================
// GET SINGLE SERVICE DEFINITION
// =========================================================

export const getServiceDefinitionById = async (req, res) => {
  try {
    const { id } = req.params;

    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const service = await fetchServiceDefinitionByIdModel(id, salon_id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    return res.json({
      success: true,
      data: service,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch service",
    });
  }
};

// =========================================================
// CREATE SERVICE DEFINITION
// =========================================================

export const createServiceDefinition = async (req, res) => {
  try {
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const {
      service_name,
      service_amount,
      salon_amount,
      section_id,
      description,
    } = req.body;

    const parseMaybeJSON = (value) => {
      if (!value) {
        return [];
      }

      if (typeof value === "string") {
        return JSON.parse(value);
      }

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
      salon_id,
    };

    const newService = await createServiceDefinitionModel(data);

    return res.status(201).json({
      success: true,
      data: newService,
    });
  } catch (err) {
    console.error("Error creating service definition:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to create service",
    });
  }
};

// =========================================================
// UPDATE SERVICE DEFINITION
// =========================================================

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
      materials = [],
    } = req.body;

    const existingService = await fetchServiceDefinitionByIdModel(id, salon_id);

    if (!existingService) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    let service_image = existingService.image_url;

    if (req.file?.filename) {
      if (existingService.image_url) {
        const oldPath = path.join(process.cwd(), existingService.image_url);

        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
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
      salon_id,
    };

    const updatedService = await updateServiceDefinitionModel(
      id,
      data,
      salon_id,
    );

    return res.json({
      success: true,
      data: updatedService,
    });
  } catch (err) {
    console.error("Error updating service definition:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to update service",
    });
  }
};

// =========================================================
// DELETE SERVICE DEFINITION
// =========================================================

export const deleteServiceDefinition = async (req, res) => {
  try {
    const { id } = req.params;

    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const deleted = await deleteServiceDefinitionModel(id, salon_id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    return res.json({
      success: true,
      message: "Service deleted successfully",
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Failed to delete service",
    });
  }
};

// =========================================================
// CREATE SERVICE TRANSACTION
// =========================================================

export const createServiceTransaction = async (req, res) => {
  try {
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const isCustomer = req.user?.role === "customer";

    let {
      entry_type,
      service_date,
      service_time,
      service_source,
      performers = [],
    } = req.body;

    // =====================================================
    // SOURCE / ENTRY TYPE
    // =====================================================

    if (isCustomer) {
      entry_type = "current";

      service_source = "online_booking";
    } else {
      service_source = normalizeServiceSource(service_source, "walk_in");
    }

    // =====================================================
    // SERVICE DATE / TIME
    // =====================================================

    let finalServiceDate = null;

    let finalServiceTime = null;

    if (entry_type === "current") {
      const now = DateTime.now().setZone(KAMPALA_ZONE);

      finalServiceDate = now.toISODate();

      finalServiceTime = now.toFormat("HH:mm:ss");
    } else if (entry_type === "past") {
      if (!service_date || !service_time) {
        throw requestError(
          "Past service requires service date and service time",
        );
      }

      finalServiceDate = service_date;

      finalServiceTime = service_time;
    } else {
      throw requestError("Invalid service entry type");
    }

    // =====================================================
    // BUILD DATA
    // =====================================================

    const data = {
      ...req.body,

      salon_id,

      entry_type,

      service_source,

      service_date: finalServiceDate,

      service_time: finalServiceTime,
    };

    // =====================================================
    // CREATED BY
    // =====================================================

    data.created_by = Number(req.user.id);

    // =====================================================
    // INTERNAL CUSTOMER
    // =====================================================

    if (!isCustomer && data.customer_id) data.customer_id = Number(data.customer_id);

    // =====================================================
    // CUSTOMER ONLINE BOOKING
    // =====================================================

    if (isCustomer) {
      data.customer_id = data.created_by;

      data.status = "pending";

      data.service_source = "online_booking";

      if (!data.service_definition_id) {
        throw requestError("Select a service before requesting an appointment");
      }

      if (!data.appointment_date || !data.appointment_time) {
        throw requestError("Appointment date and time are required");
      }

      const requestedAt = DateTime.fromISO(
        `${data.appointment_date}T${data.appointment_time}`,
        {
          zone: KAMPALA_ZONE,
        },
      );

      if (!requestedAt.isValid) {
        throw requestError("Enter a valid appointment date and time");
      }

      // ===================================================
      // TWO-HOUR RULE
      // ===================================================

      const minimumBookingTime = DateTime.now().setZone(KAMPALA_ZONE).plus({
        hours: 1,
      });

      if (requestedAt < minimumBookingTime) {
        throw requestError(
          "Appointments must be booked at least 1 hour in advance",
        );
      }

      // ===================================================
      // 30-MINUTE SLOT RULE
      // ===================================================

      if (![0, 30].includes(requestedAt.minute) || requestedAt.second !== 0) {
        throw requestError("Appointments must start on a 30-minute time slot");
      }

      if (requestedAt.hour < 8 || requestedAt.hour > 23) {
        throw requestError(
          "Choose an appointment time between 08:00 and 23:30",
        );
      }

      // ===================================================
      // CUSTOMER PREFERENCE
      // ===================================================

      data.performers = normalizeCustomerBookingPerformers(performers);

      // Booking MUST check slot conflicts.
      await validateAppointmentRequestModel({
        salon_id,

        service_definition_id: Number(data.service_definition_id),

        appointment_date: data.appointment_date,

        appointment_time: data.appointment_time,

        performers: data.performers,

        require_actual_employees: false,

        check_appointment_conflicts: true,
      });
    }

    // =====================================================
    // INTERNAL COMPLETED SERVICE
    // =====================================================
    else {
      data.status = "completed";

      data.performers = normalizeInternalPerformers(performers);

      if (!data.service_definition_id) {
        throw requestError("Select a service");
      }

      // Walk-in / manually entered completed work only needs
      // actual performers.
      //
      // It is NOT a booking availability operation.
      await validateAppointmentRequestModel({
        salon_id,

        service_definition_id: Number(data.service_definition_id),

        appointment_date: data.appointment_date || null,

        appointment_time: data.appointment_time || null,

        performers: data.performers,

        require_actual_employees: true,

        check_appointment_conflicts: false,
      });
    }

    // =====================================================
    // DEBUG
    // =====================================================

    console.log("SERVICE DATA BEFORE MODEL:", {
      entry_type: data.entry_type,

      service_source: data.service_source,

      status: data.status,

      service_date: data.service_date,

      service_time: data.service_time,

      appointment_date: data.appointment_date,

      appointment_time: data.appointment_time,

      salon_id: data.salon_id,

      performers: data.performers,
    });

    // =====================================================
    // SAVE
    // =====================================================

    const transaction = await saveServiceTransaction(data);

    // =====================================================
    // SOCKET EVENT
    // =====================================================

    if (data.status === "pending") emitAppointmentChange(req, "created", transaction);

    return res.json({
      success: true,
      data: transaction,
    });
  } catch (err) {
    console.error("CREATE SERVICE TRANSACTION ERROR:", err);

    return res.status(err.statusCode || 500).json({
      success: false,

      message: err.statusCode
        ? err.message
        : "Failed to create service transaction",
    });
  }
};

// =========================================================
// GET ALL SERVICE TRANSACTIONS
// =========================================================

export const getAllServiceTransactions = async (req, res) => {
  try {
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const transactions = await fetchAllServiceTransactions(salon_id);

    const role = req.user?.role;

    const userId = Number(req.user?.id);

    const visibleTransactions =
      role === "customer"
        ? transactions.filter(
            (transaction) =>
              Number(transaction.customer_id) === userId,
          )
        : role === "employee"
          ? transactions.filter((transaction) =>
              transaction.performers?.some(
                (performer) => Number(performer.employee_id) === userId,
              ),
            )
          : transactions;

    return res.json({
      success: true,
      data: visibleTransactions,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch service transactions",
    });
  }
};

// =========================================================
// GET SINGLE SERVICE TRANSACTION
// =========================================================

export const getServiceTransactionById = async (req, res) => {
  try {
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const transaction = await fetchServiceTransactionById(
      req.params.id,
      salon_id,
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    const role = req.user?.role;

    const userId = Number(req.user?.id);

    const canView =
      role !== "customer" && role !== "employee"
        ? true
        : role === "customer"
          ? Number(transaction.customer_id) === userId
          : transaction.performers?.some(
              (performer) => Number(performer.employee_id) === userId,
            );

    if (!canView) {
      return res.status(403).json({
        success: false,
        message: "You cannot view this transaction",
      });
    }

    return res.json({
      success: true,
      data: transaction,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch transaction",
    });
  }
};

// =========================================================
// GET SERVICE ROLES
// =========================================================

export const getServiceRoles = async (req, res) => {
  try {
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const roles = await fetchServiceRolesModel(salon_id);

    return res.json({
      success: true,
      data: roles,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch service roles",
    });
  }
};

// =========================================================
// GET SERVICE MATERIALS
// =========================================================

export const getServiceMaterials = async (req, res) => {
  try {
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const materials = await fetchServiceMaterialsModel(salon_id);

    return res.json({
      success: true,
      data: materials,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch service materials",
    });
  }
};

// =========================================================
// UPDATE SERVICE TRANSACTION
// =========================================================

export const updateServiceTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const existing = await fetchServiceTransactionById(id, salon_id);

    if (!existing) {
      throw requestError("Transaction not found", 404);
    }

    const {
      service_definition_id,
      created_by,
      appointment_date,
      appointment_time,
      customer_id,
      customer_note,
      status,
      service_source,
    } = req.body;

    const performers = Array.isArray(req.body.performers)
      ? normalizeInternalPerformers(req.body.performers)
      : normalizeInternalPerformers(existing.performers || []);

    const finalStatus = String(status ?? existing.status ?? "")
      .trim()
      .toLowerCase();

    const finalServiceSource =
      service_source !== undefined
        ? normalizeServiceSource(
            service_source,
            existing.service_source || "walk_in",
          )
        : existing.service_source || null;

    const finalServiceDefinitionId = Number(
      service_definition_id || existing.service_definition_id,
    );

    const finalAppointmentDate =
      appointment_date ?? existing.appointment_date ?? null;

    const finalAppointmentTime =
      appointment_time ?? existing.appointment_time ?? null;

    // =====================================================
    // COMPLETED SERVICE
    // =====================================================
    //
    // We DO require real workers.
    //
    // We DO NOT check booking conflicts because the work
    // has already happened.
    // =====================================================

    if (finalStatus === "completed") {
      await validateAppointmentRequestModel({
        salon_id,

        service_definition_id: finalServiceDefinitionId,

        appointment_date: finalAppointmentDate,

        appointment_time: finalAppointmentTime,

        performers,

        exclude_transaction_id: Number(id),

        require_actual_employees: true,

        check_appointment_conflicts: false,
      });
    }

    // =====================================================
    // PENDING / CONFIRMED SERVICE
    // =====================================================
    //
    // These still reserve appointment availability.
    // =====================================================

    if (["pending", "confirmed"].includes(finalStatus)) {
      await validateAppointmentRequestModel({
        salon_id,

        service_definition_id: finalServiceDefinitionId,

        appointment_date: finalAppointmentDate,

        appointment_time: finalAppointmentTime,

        performers,

        exclude_transaction_id: Number(id),

        require_actual_employees: false,

        check_appointment_conflicts: true,
      });
    }

    const updates = {
      service_definition_id: finalServiceDefinitionId,

      created_by,

      appointment_date: finalAppointmentDate,

      appointment_time: finalAppointmentTime,

      customer_id: customer_id ?? existing.customer_id,

      customer_note: customer_note ?? existing.customer_note,

      status: status ?? existing.status,

      service_source: finalServiceSource,

      performers,

      salon_id,
    };

    const updated = await updateServiceTransactionModel(id, updates, salon_id);

    if (updated?.appointment_date || updated?.service_source === "online_booking") {
      emitAppointmentChange(req, "updated", updated);
    }

    return res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    console.error("UPDATE SERVICE TRANSACTION ERROR:", err);

    return res.status(err.statusCode || 500).json({
      success: false,

      message: err.statusCode ? err.message : "Failed to update transaction",
    });
  }
};

// =========================================================
// UPDATE APPOINTMENT STATUS
// =========================================================

export const updateServiceTransactionAppointment = async (req, res) => {
  try {
    const { id } = req.params;

    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const status = req.body.status?.trim().toLowerCase();

    const cancel_reason = req.body.cancel_reason?.trim() || null;

    if (!status) {
      throw requestError("Appointment status is required");
    }

    const appointment = await fetchServiceTransactionById(id, salon_id);

    if (!appointment) {
      throw requestError("Appointment not found", 404);
    }

    // ===================================================
    // CUSTOMER PERMISSIONS
    // ===================================================

    if (req.user?.role === "customer") {
      if (Number(appointment.customer_id) !== Number(req.user.id)) {
        throw requestError(
          "You cannot change another customer's appointment",
          403,
        );
      }

      if (status !== "cancelled") {
        throw requestError(
          "Customers may only cancel their own appointment",
          403,
        );
      }
    }

    // ===================================================
    // STATUS TRANSITION
    // ===================================================

    const currentStatus = appointment.status?.trim().toLowerCase();

    if (!APPOINTMENT_TRANSITIONS[currentStatus]?.has(status)) {
      throw requestError(
        `Appointment cannot move from ${
          currentStatus || "unknown"
        } to ${status}`,
        409,
      );
    }

    // ===================================================
    // CANCELLATION
    // ===================================================

    if (status === "cancelled" && !cancel_reason) {
      throw requestError("A cancellation reason is required");
    }

    // ===================================================
    // PERFORMERS
    // ===================================================

    const performers = Array.isArray(req.body.performers)
      ? normalizeInternalPerformers(req.body.performers)
      : normalizeInternalPerformers(appointment.performers || []);

    // ===================================================
    // CONFIRM APPOINTMENT
    // ===================================================
    //
    // Confirmation still reserves the booking slot.
    //
    // Actual employee IDs are optional.
    // Preferred employee IDs may exist.
    // ===================================================

    if (status === "confirmed") {
      await validateAppointmentRequestModel({
        salon_id,

        service_definition_id: Number(appointment.service_definition_id),

        appointment_date: appointment.appointment_date,

        appointment_time: appointment.appointment_time,

        performers,

        exclude_transaction_id: Number(id),

        require_actual_employees: false,

        check_appointment_conflicts: true,
      });
    }

    // ===================================================
    // COMPLETE APPOINTMENT
    // ===================================================
    //
    // This is the critical fix.
    //
    // At completion we are NOT asking:
    //
    // "Can these people be booked?"
    //
    // We are recording:
    //
    // "These are the people who actually performed it."
    //
    // Therefore:
    //
    // actual employee IDs REQUIRED
    //
    // booking conflict check OFF
    // ===================================================

    if (status === "completed") {
      await validateAppointmentRequestModel({
        salon_id,

        service_definition_id: Number(appointment.service_definition_id),

        appointment_date: appointment.appointment_date,

        appointment_time: appointment.appointment_time,

        performers,

        exclude_transaction_id: Number(id),

        require_actual_employees: true,

        check_appointment_conflicts: false,
      });
    }

    // ===================================================
    // COMPLETION DATE / TIME
    // ===================================================

    const completedAt =
      status === "completed" ? DateTime.now().setZone(KAMPALA_ZONE) : null;

    const updates = {
      status,

      cancel_reason,

      performers,

      service_date: completedAt?.toISODate() || null,

      service_time: completedAt?.toFormat("HH:mm:ss") || null,
    };

    const updated = await updateServiceTransactionAppointmentModel(
      id,
      updates,
      salon_id,
    );

    const refreshed = await fetchServiceTransactionById(updated.id, salon_id);

    emitAppointmentChange(req, status, refreshed || updated);

    return res.json({
      success: true,
      data: refreshed,
    });
  } catch (err) {
    console.error("UPDATE APPOINTMENT ERROR:", err);

    return res.status(err.statusCode || 500).json({
      success: false,

      message: err.statusCode ? err.message : "Failed to update transaction",
    });
  }
};

// =========================================================
// GET APPOINTMENT AVAILABILITY
// =========================================================

export const getAppointmentAvailability = async (req, res) => {
  try {
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const appointment_date = req.query.date?.trim();

    const appointment_time = req.query.time?.trim();

    if (!appointment_date || !appointment_time) {
      throw requestError("Appointment date and time are required");
    }

    const requestedAt = DateTime.fromISO(
      `${appointment_date}T${appointment_time}`,
      {
        zone: KAMPALA_ZONE,
      },
    );

    if (!requestedAt.isValid) {
      throw requestError("Enter a valid appointment date and time");
    }

    const busyEmployeeIds = await fetchAppointmentBusyEmployeeIdsModel(
      salon_id,
      appointment_date,
      appointment_time,
    );

    return res.json({
      success: true,

      data: {
        busyEmployeeIds,
      },
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,

      message: err.statusCode
        ? err.message
        : "Unable to check appointment availability",
    });
  }
};

// =========================================================
// UPDATE TRANSACTION TIME
// =========================================================

export const updateServiceTransactiont = async (req, res) => {
  try {
    const { id } = req.params;

    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const { newTime } = req.body;

    const updated = await updateServiceTransactionModelt(id, newTime, salon_id);

    return res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Failed to update transaction time",
    });
  }
};

// =========================================================
// DELETE SERVICE TRANSACTION
// =========================================================

export const deleteServiceTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const deleted = await DeleteServiceTransaction(id, salon_id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    return res.json({
      success: true,

      message: "Transaction deleted successfully",
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,

      message: "Failed to delete transaction",
    });
  }
};
