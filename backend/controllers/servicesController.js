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
  fetchAppointmentSettingsModel,
  saveAppointmentSettingsModel,
  recordAppointmentEventModel,
} from "../models/servicesModel.js";
import { appendAuditEvent } from "../models/auditModel.js";

const APPOINTMENT_TRANSITIONS = {
  pending: new Set(["confirmed", "cancelled"]),
  confirmed: new Set(["completed", "cancelled"]),
  completed: new Set(),
  cancelled: new Set(),
};

const VALID_SERVICE_SOURCES = new Set(["walk_in", "online_booking"]);
const VALID_COLLECTION_METHODS = new Set([
  "CASH",
  "MTN_MOMO",
  "AIRTEL_MONEY",
  "BANK_TRANSFER",
  "OTHER",
]);

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

const normalizeCollectionMethod = (value, fallback = "CASH") => {
  const method = String(value || fallback)
    .trim()
    .toUpperCase();

  if (!VALID_COLLECTION_METHODS.has(method)) {
    throw requestError(
      "Invalid collection method. Use cash, MTN MoMo, Airtel Money, bank transfer, or other.",
    );
  }

  return method;
};

const normalizeCollectionReference = (value) => {
  const reference = String(value || "").trim();

  if (reference.length > 120) {
    throw requestError("Collection reference cannot exceed 120 characters.");
  }

  return reference || null;
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

const appointmentSettingsPayload = (body = {}) => {
  const opening_time = String(body.opening_time || "").trim();
  const closing_time = String(body.closing_time || "").trim();
  const slot_interval_minutes = Number(body.slot_interval_minutes);
  const minimum_notice_minutes = Number(body.minimum_notice_minutes);
  const maximum_booking_days = Number(body.maximum_booking_days);
  const customer_cancellation_notice_minutes = Number(body.customer_cancellation_notice_minutes);
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(opening_time) || !/^\d{2}:\d{2}(:\d{2})?$/.test(closing_time)) {
    throw requestError("Opening and closing times must be valid times.");
  }
  if (![15, 30, 60].includes(slot_interval_minutes)
    || !Number.isInteger(minimum_notice_minutes) || minimum_notice_minutes < 0
    || !Number.isInteger(maximum_booking_days) || maximum_booking_days < 1
    || !Number.isInteger(customer_cancellation_notice_minutes) || customer_cancellation_notice_minutes < 0) {
    throw requestError("Appointment settings contain an invalid interval, notice period, or booking horizon.");
  }
  return {
    opening_time,
    closing_time,
    slot_interval_minutes,
    minimum_notice_minutes,
    maximum_booking_days,
    customer_cancellation_notice_minutes,
    allow_unassigned_confirmation: Boolean(body.allow_unassigned_confirmation),
  };
};

export const getAppointmentSettings = async (req, res) => {
  try {
    const data = await fetchAppointmentSettingsModel(Number(req.salon_id || req.user?.salon_id));
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to load appointment settings." });
  }
};

export const updateAppointmentSettings = async (req, res) => {
  try {
    const data = await saveAppointmentSettingsModel(Number(req.salon_id || req.user?.salon_id), appointmentSettingsPayload(req.body));
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message || "Unable to update appointment settings." });
  }
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
    const appointmentSettings = await fetchAppointmentSettingsModel(salon_id);

    const isCustomer = req.user?.role === "customer";

    let {
      entry_type,
      service_date,
      service_time,
      service_source,
      backdate_reason,
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
      const now = DateTime.now().setZone(appointmentSettings.timezone);

      finalServiceDate = now.toISODate();

      finalServiceTime = now.toFormat("HH:mm:ss");
    } else if (entry_type === "past") {
      if (String(req.user?.role || "").toLowerCase() !== "owner") {
        return res.status(403).json({ success: false, message: "Only the salon owner can add past service records" });
      }
      if (!service_date || !service_time) {
        throw requestError(
          "Past service requires service date and service time",
        );
      }

      if (!String(backdate_reason || "").trim()) {
        throw requestError("A backdate reason is required for a past service record");
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

      backdate_reason: entry_type === "past" ? String(backdate_reason).trim() : null,
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

      const settings = appointmentSettings;
      const requestedAt = DateTime.fromISO(
        `${data.appointment_date}T${data.appointment_time}`,
        {
          zone: settings.timezone,
        },
      );

      if (!requestedAt.isValid) {
        throw requestError("Enter a valid appointment date and time");
      }

      // ===================================================
      // TWO-HOUR RULE
      // ===================================================

      const minimumBookingTime = DateTime.now().setZone(settings.timezone).plus({ minutes: settings.minimum_notice_minutes });

      if (requestedAt < minimumBookingTime) {
        throw requestError(`Appointments must be booked at least ${settings.minimum_notice_minutes} minutes in advance`);
      }

      if (requestedAt > DateTime.now().setZone(settings.timezone).endOf("day").plus({ days: settings.maximum_booking_days })) {
        throw requestError(`Appointments can only be booked ${settings.maximum_booking_days} days in advance.`);
      }

      const openingAt = DateTime.fromISO(`${data.appointment_date}T${settings.opening_time}`, { zone: settings.timezone });
      const closingAt = DateTime.fromISO(`${data.appointment_date}T${settings.closing_time}`, { zone: settings.timezone });
      const slotOffset = Math.round(requestedAt.diff(openingAt, "minutes").minutes);
      if (requestedAt < openingAt || requestedAt > closingAt || slotOffset % settings.slot_interval_minutes !== 0) {
        throw requestError(`Choose an appointment time within salon hours using ${settings.slot_interval_minutes}-minute slots.`);
      }

      // ===================================================
      // CUSTOMER PREFERENCE
      // ===================================================

      data.performers = normalizeCustomerBookingPerformers(performers);
      data.appointment_idempotency_key = String(req.body.appointment_idempotency_key || "").trim().slice(0, 120) || null;

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

    // Customer appointments are not collections yet. They remain CASH by
    // default until an authorised staff member completes the service and
    // records the actual collection method.
    data.collection_method = isCustomer
      ? "CASH"
      : normalizeCollectionMethod(req.body.collection_method);
    data.collection_reference = isCustomer
      ? null
      : normalizeCollectionReference(req.body.collection_reference);

    if (!isCustomer && ["MTN_MOMO", "AIRTEL_MONEY", "BANK_TRANSFER"].includes(data.collection_method)) {
      throw requestError(
        "External collections must be initiated through the centralized payment flow.",
        409,
      );
    }

    // =====================================================
    // SAVE
    // =====================================================

    const transaction = await saveServiceTransaction(data);

    // =====================================================
    // SOCKET EVENT
    // =====================================================

    if (data.status === "pending" && !transaction.appointment_already_exists) {
      await recordAppointmentEventModel({
        salonId: salon_id,
        transactionId: transaction.id,
        actorUserId: req.user?.id || null,
        eventType: "created",
        toStatus: "pending",
        details: { source: "online_booking" },
      });
      emitAppointmentChange(req, "created", transaction);
    }

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

    if (existing.entry_type === "past" && req.user?.role !== "owner") {
      throw requestError("Only the salon owner can edit a past service record", 403);
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
      collection_method,
      collection_reference,
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

    // Customer money is only recognised when the service is completed. A
    // pending or confirmed appointment may retain its default, but cannot be
    // classified as a mobile or bank collection ahead of completion.
    const canRecordCollection = finalStatus === "completed";

    const finalCollectionMethod = canRecordCollection
      ? collection_method !== undefined
        ? normalizeCollectionMethod(collection_method)
        : normalizeCollectionMethod(existing.collection_method)
      : "CASH";

    const finalCollectionReference = canRecordCollection
      ? collection_reference !== undefined
        ? normalizeCollectionReference(collection_reference)
        : existing.collection_reference || null
      : null;

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

      collection_method: finalCollectionMethod,

      collection_reference: finalCollectionReference,

      performers,

      salon_id,
    };

    if (
      status === "completed" &&
      ["MTN_MOMO", "AIRTEL_MONEY", "BANK_TRANSFER"].includes(updates.collection_method)
    ) {
      throw requestError(
        "External collections must be initiated through the centralized payment flow.",
        409,
      );
    }

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

      const settings = await fetchAppointmentSettingsModel(salon_id);
      if (Number(settings.customer_cancellation_notice_minutes || 0) > 0) {
        const appointmentAt = DateTime.fromISO(
          `${appointment.appointment_date}T${appointment.appointment_time}`,
          { zone: settings.timezone },
        );
        const cancellationCutoff = DateTime.now().setZone(settings.timezone).plus({
          minutes: Number(settings.customer_cancellation_notice_minutes),
        });
        if (!appointmentAt.isValid || appointmentAt < cancellationCutoff) {
          throw requestError(
            `Appointments must be cancelled at least ${settings.customer_cancellation_notice_minutes} minutes before the scheduled time.`,
            409,
          );
        }
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
      const settings = await fetchAppointmentSettingsModel(salon_id);
      await validateAppointmentRequestModel({
        salon_id,

        service_definition_id: Number(appointment.service_definition_id),

        appointment_date: appointment.appointment_date,

        appointment_time: appointment.appointment_time,

        performers,

        exclude_transaction_id: Number(id),

        // The normal production setting preserves the salon workflow: a
        // booking can be confirmed with no named employee, and the actual
        // team is recorded only at completion.
        require_actual_employees: !settings.allow_unassigned_confirmation,

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

    const completionSettings = status === "completed"
      ? await fetchAppointmentSettingsModel(salon_id)
      : null;
    const completedAt = status === "completed"
      ? DateTime.now().setZone(completionSettings.timezone)
      : null;

    const updates = {
      status,

      cancel_reason,

      performers,

      service_date: completedAt?.toISODate() || null,

      service_time: completedAt?.toFormat("HH:mm:ss") || null,

      collection_method:
        status === "completed" && req.user?.role !== "customer"
          ? normalizeCollectionMethod(req.body.collection_method, appointment.collection_method || "CASH")
          : appointment.collection_method || "CASH",

      collection_reference:
        status === "completed" && req.user?.role !== "customer"
          ? normalizeCollectionReference(req.body.collection_reference)
          : appointment.collection_reference || null,
    };

    if (
      status === "completed" &&
      ["MTN_MOMO", "AIRTEL_MONEY", "BANK_TRANSFER"].includes(updates.collection_method)
    ) {
      throw requestError(
        "External collections must be initiated through the centralized payment flow.",
        409,
      );
    }

    const updated = await updateServiceTransactionAppointmentModel(
      id,
      updates,
      salon_id,
    );

    const refreshed = await fetchServiceTransactionById(updated.id, salon_id);

    await recordAppointmentEventModel({
      salonId: salon_id,
      transactionId: updated.id,
      actorUserId: req.user?.id || null,
      eventType: status === "cancelled" ? "cancelled" : status,
      fromStatus: currentStatus || null,
      toStatus: status,
      reason: status === "cancelled" ? cancel_reason : null,
    });

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

    const settings = await fetchAppointmentSettingsModel(salon_id);
    const requestedAt = DateTime.fromISO(
      `${appointment_date}T${appointment_time}`,
      {
        zone: settings.timezone,
      },
    );

    if (!requestedAt.isValid) {
      throw requestError("Enter a valid appointment date and time");
    }

    const openingAt = DateTime.fromISO(`${appointment_date}T${settings.opening_time}`, { zone: settings.timezone });
    const closingAt = DateTime.fromISO(`${appointment_date}T${settings.closing_time}`, { zone: settings.timezone });
    const slotOffset = Math.round(requestedAt.diff(openingAt, "minutes").minutes);
    if (requestedAt < openingAt || requestedAt > closingAt || slotOffset % settings.slot_interval_minutes !== 0) {
      throw requestError("Choose an appointment time within the salon's configured booking hours.");
    }

    const busyEmployeeIds = await fetchAppointmentBusyEmployeeIdsModel(
      salon_id,
      appointment_date,
      appointment_time,
      req.query.service_definition_id ? Number(req.query.service_definition_id) : null,
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

    const existing = await fetchServiceTransactionById(id, salon_id);
    if (!existing) throw requestError("Transaction not found", 404);
    if (existing.entry_type === "past" && req.user?.role !== "owner") {
      throw requestError("Only the salon owner can edit a past service record", 403);
    }

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
    const existing = await fetchServiceTransactionById(id, salon_id);

    if (!existing) {
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }

    const isFinancialRecord = String(existing.status || "").toLowerCase() === "completed"
      || Boolean(existing.external_payment_intent_id);
    if (isFinancialRecord) {
      await appendAuditEvent({
        salonId: salon_id,
        actorUserId: req.user?.id,
        actorRole: req.user?.role,
        action: "PERMANENT_DELETE_BLOCKED",
        module: "SERVICES",
        recordType: "SERVICE_TRANSACTION",
        recordId: id,
        previousValues: {
          status: existing.status,
          collection_method: existing.collection_method,
          external_payment_intent_id: existing.external_payment_intent_id,
        },
        reason: "Completed or externally paid service transactions must be preserved.",
        requestId: req.requestId,
        outcome: "BLOCKED",
      });
      return res.status(409).json({
        success: false,
        code: "FINANCIAL_RECORD_PRESERVED",
        message: "Completed or paid services cannot be permanently deleted. Record an authorized correction instead.",
      });
    }

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
