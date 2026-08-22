import React, { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";

const ZONE = "Africa/Kampala";

const APPOINTMENT_TIME_SLOTS = Array.from({ length: 32 }, (_, index) => {
  const totalMinutes = 8 * 60 + index * 30;

  const hour = String(Math.floor(totalMinutes / 60)).padStart(2, "0");

  const minute = String(totalMinutes % 60).padStart(2, "0");

  return `${hour}:${minute}`;
});

const formatMoney = (value) => Number(value || 0).toLocaleString("en-UG");

// ======================================================
// OPTIONAL ID HELPER
// ======================================================

const normalizeOptionalId = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

export default function ServiceForm({
  isCustomer = false,

  // ======================================================
  // SERVICE EDITING PERMISSION
  // ======================================================
  //
  // true:
  // owner / manager may edit section/service.
  //
  // false:
  // cashier may see section/service while completing
  // an existing transaction, but cannot change them.
  //
  // IMPORTANT:
  // This only locks EXISTING transactions.
  // A cashier creating a new walk-in service can still
  // choose the section and service normally.
  // ======================================================

  canEditServiceDetails = true,

  onSubmit,
  onClose,
  Sections = [],
  Services = [],
  Roles = [],
  Employees = [],
  Appointments = [],
  getAppointmentAvailability,
  createdBy,
  customerId = null,
  serviceStatus,
  serviceData = null,
  entryType = "current",
}) {
  // ======================================================
  // LOCAL DATA
  // ======================================================

  const [sections, setSections] = useState(Sections || []);

  const [services, setServices] = useState([]);

  const [roles, setRoles] = useState([]);

  const [employees, setEmployees] = useState(Employees || []);

  const [serviceAmount, setServiceAmount] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const [submitError, setSubmitError] = useState("");

  const [remoteBusyEmployeeIds, setRemoteBusyEmployeeIds] = useState([]);

  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // ======================================================
  // CUSTOMER PROFESSIONAL PREFERENCE
  // ======================================================

  const [professionalPreference, setProfessionalPreference] = useState("any");

  // ======================================================
  // FORM
  // ======================================================

  const [form, setForm] = useState({
    id: null,

    section_id: "",

    service_definition_id: "",

    appointment_date: "",

    appointment_time: "",

    customerNote: "",

    status: serviceStatus || null,

    performers: [],
  });

  // ======================================================
  // DERIVED STATE
  // ======================================================

  const isEditing = Boolean(serviceData);

  const serviceDetailsLocked =
    isEditing && !isCustomer && !canEditServiceDetails;

  // ======================================================
  // CURRENT TIME / BOOKING LIMIT
  // ======================================================

  const now = DateTime.now().setZone(ZONE);

  const minimumAppointmentTime = now.plus({
    hours: 2,
  });

  const minimumAppointmentDate = now.toISODate();

  // ======================================================
  // SYNC PROPS
  // ======================================================

  useEffect(() => {
    setSections(Sections || []);
  }, [Sections]);

  useEffect(() => {
    setEmployees(Employees || []);
  }, [Employees]);

  // ======================================================
  // CREATE PERFORMER ROWS FROM SERVICE ROLES
  // ======================================================
  //
  // THIS IS IMPORTANT.
  //
  // A booking using "Anyone available" may have:
  //
  // employee_id = null
  // preferred_employee_id = null
  //
  // It may even come back with missing performer rows from
  // older data.
  //
  // When an administrator later completes the service,
  // every configured professional role must exist inside
  // form.performers so the select inputs can actually
  // update those rows.
  // ======================================================

  const buildPerformersFromRoles = (matchingRoles, existingPerformers = []) => {
    return (matchingRoles || []).map((role) => {
      const existing = (existingPerformers || []).find(
        (performer) =>
          Number(performer.role_id ?? performer.service_role_id) ===
          Number(role.id),
      );

      return {
        role_id: Number(role.id),

        employee_id: normalizeOptionalId(existing?.employee_id),

        preferred_employee_id: normalizeOptionalId(
          existing?.preferred_employee_id,
        ),

        earned_amount:
          existing?.earned_amount ??
          existing?.role_amount ??
          role.earned_amount ??
          null,

        role_name: existing?.role_name ?? role.role_name ?? null,

        first_name: existing?.first_name ?? null,

        last_name: existing?.last_name ?? null,

        preferred_first_name: existing?.preferred_first_name ?? null,

        preferred_last_name: existing?.preferred_last_name ?? null,
      };
    });
  };

  // ======================================================
  // PREFILL WHEN EDITING
  // ======================================================

  useEffect(() => {
    if (!serviceData) {
      return;
    }

    const sectionId =
      serviceData.definition_section_id ?? serviceData.section_id;

    const serviceDefinitionId = serviceData.service_definition_id;

    const matchingRoles = (Roles || []).filter(
      (role) =>
        Number(role.service_definition_id) === Number(serviceDefinitionId),
    );

    // ====================================================
    // MERGE CONFIGURED ROLES WITH EXISTING PERFORMERS
    // ====================================================
    //
    // This fixes appointments created with "Anyone available"
    // where no employee/preference had previously been saved.
    // ====================================================

    const mergedPerformers = buildPerformersFromRoles(
      matchingRoles,
      serviceData.performers || [],
    );

    setForm({
      id: serviceData.transaction_id ?? serviceData.id ?? null,

      section_id: sectionId || "",

      service_definition_id: serviceDefinitionId || "",

      appointment_date: serviceData.appointment_date || "",

      appointment_time: serviceData.appointment_time || "",

      customerNote: serviceData.customer_note || "",

      status: serviceData.status || serviceStatus || null,

      performers: mergedPerformers,
    });

    setServices(
      (Services || []).filter(
        (service) => Number(service.section_id) === Number(sectionId),
      ),
    );

    setRoles(matchingRoles);

    setServiceAmount(
      Number(
        serviceData.full_amount ||
          serviceData.service_amount ||
          (Services || []).find(
            (service) => Number(service.id) === Number(serviceDefinitionId),
          )?.service_amount ||
          0,
      ),
    );

    // ====================================================
    // CUSTOMER EXISTING PREFERENCE
    // ====================================================

    if (isCustomer) {
      const hasPreference = mergedPerformers.some(
        (performer) => performer.preferred_employee_id,
      );

      setProfessionalPreference(hasPreference ? "specific" : "any");
    }
  }, [serviceData, Services, Roles, serviceStatus, isCustomer]);

  // ======================================================
  // SECTION SELECTION
  // ======================================================

  const handleSectionSelect = (id) => {
    if (serviceDetailsLocked) {
      return;
    }

    setForm((current) => ({
      ...current,

      section_id: id,

      service_definition_id: "",

      performers: [],
    }));

    setRoles([]);

    setServiceAmount("");

    setServices(
      (Services || []).filter(
        (service) => Number(service.section_id) === Number(id),
      ),
    );

    if (isCustomer) {
      setProfessionalPreference("any");
    }
  };

  // ======================================================
  // SERVICE SELECTION
  // ======================================================

  const handleServiceSelect = (event) => {
    if (serviceDetailsLocked) {
      return;
    }

    const id = Number(event.target.value);

    if (!id) {
      setForm((current) => ({
        ...current,

        service_definition_id: "",

        performers: [],
      }));

      setRoles([]);

      setServiceAmount("");

      return;
    }

    const selectedOption = event.target.selectedOptions?.[0];

    const serviceObj = selectedOption?.dataset?.service
      ? JSON.parse(selectedOption.dataset.service)
      : null;

    const matchingRoles = (Roles || []).filter(
      (role) => Number(role.service_definition_id) === Number(id),
    );

    // ====================================================
    // CREATE ROLE ROWS IMMEDIATELY
    // ====================================================

    const performers = buildPerformersFromRoles(matchingRoles, []);

    setForm((current) => ({
      ...current,

      service_definition_id: id,

      performers,
    }));

    setRoles(matchingRoles);

    setServiceAmount(
      Number(serviceObj?.service_amount || serviceObj?.full_amount || 0),
    );

    if (isCustomer) {
      setProfessionalPreference("any");
    }
  };

  // ======================================================
  // CUSTOMER NOTE
  // ======================================================

  const handleCustomerNote = (event) => {
    setForm((current) => ({
      ...current,

      customerNote: event.target.value,
    }));
  };

  // ======================================================
  // UPSERT ACTUAL PERFORMER
  // ======================================================
  //
  // Do NOT rely on the performer row already existing.
  //
  // This protects old appointment records that were created
  // before the current performer structure existed.
  // ======================================================

  const updateActualPerformer = (roleId, employeeId) => {
    const normalizedRoleId = Number(roleId);

    const normalizedEmployeeId = normalizeOptionalId(employeeId);

    setForm((current) => {
      const exists = current.performers.some(
        (performer) => Number(performer.role_id) === normalizedRoleId,
      );

      if (exists) {
        return {
          ...current,

          performers: current.performers.map((performer) =>
            Number(performer.role_id) === normalizedRoleId
              ? {
                  ...performer,

                  employee_id: normalizedEmployeeId,
                }
              : performer,
          ),
        };
      }

      const role = roles.find((item) => Number(item.id) === normalizedRoleId);

      return {
        ...current,

        performers: [
          ...current.performers,

          {
            role_id: normalizedRoleId,

            employee_id: normalizedEmployeeId,

            preferred_employee_id: null,

            earned_amount: role?.earned_amount ?? null,
          },
        ],
      };
    });
  };

  // ======================================================
  // UPSERT CUSTOMER PREFERENCE
  // ======================================================

  const updatePreferredPerformer = (roleId, employeeId) => {
    const normalizedRoleId = Number(roleId);

    const normalizedEmployeeId = normalizeOptionalId(employeeId);

    setForm((current) => {
      const exists = current.performers.some(
        (performer) => Number(performer.role_id) === normalizedRoleId,
      );

      if (exists) {
        return {
          ...current,

          performers: current.performers.map((performer) =>
            Number(performer.role_id) === normalizedRoleId
              ? {
                  ...performer,

                  // Customer NEVER assigns
                  // actual employee.
                  employee_id: null,

                  preferred_employee_id: normalizedEmployeeId,
                }
              : performer,
          ),
        };
      }

      const role = roles.find((item) => Number(item.id) === normalizedRoleId);

      return {
        ...current,

        performers: [
          ...current.performers,

          {
            role_id: normalizedRoleId,

            employee_id: null,

            preferred_employee_id: normalizedEmployeeId,

            earned_amount: role?.earned_amount ?? null,
          },
        ],
      };
    });
  };

  // ======================================================
  // PROFESSIONAL PREFERENCE MODE
  // ======================================================

  const handlePreferenceMode = (mode) => {
    setProfessionalPreference(mode);

    if (mode === "any") {
      setForm((current) => ({
        ...current,

        performers: current.performers.map((performer) => ({
          ...performer,

          employee_id: isCustomer ? null : performer.employee_id,

          preferred_employee_id: null,
        })),
      }));
    }
  };

  // ======================================================
  // TIME SLOT VALIDITY
  // ======================================================

  const isTimeSlotTooSoon = (time) => {
    if (!isCustomer || !form.appointment_date) {
      return false;
    }

    const requestedAt = DateTime.fromISO(
      `${form.appointment_date}T${time}:00`,
      {
        zone: ZONE,
      },
    );

    if (!requestedAt.isValid) {
      return true;
    }

    return requestedAt < minimumAppointmentTime;
  };

  // ======================================================
  // BUSY EMPLOYEES
  // ======================================================

  const busyEmployeeIds = useMemo(() => {
    if (!isCustomer || !form.appointment_date || !form.appointment_time) {
      return new Set();
    }

    const requestedTime = form.appointment_time.slice(0, 5);

    const currentId = normalizeOptionalId(form.id);

    const localBusy = (Appointments || [])
      .filter((appointment) => {
        const appointmentId = normalizeOptionalId(
          appointment.transaction_id ?? appointment.id,
        );

        return (
          appointmentId !== currentId &&
          ["pending", "confirmed"].includes(
            String(appointment.status || "")
              .trim()
              .toLowerCase(),
          ) &&
          appointment.appointment_date?.slice(0, 10) ===
            form.appointment_date &&
          appointment.appointment_time?.slice(0, 5) === requestedTime
        );
      })
      .flatMap((appointment) => appointment.performers || [])
      .flatMap((performer) => {
        const ids = [];

        const actualId = normalizeOptionalId(performer.employee_id);

        const preferredId = normalizeOptionalId(
          performer.preferred_employee_id,
        );

        if (actualId) {
          ids.push(actualId);
        }

        if (preferredId) {
          ids.push(preferredId);
        }

        return ids;
      });

    const remoteBusy = (remoteBusyEmployeeIds || [])
      .map(normalizeOptionalId)
      .filter(Boolean);

    return new Set([...remoteBusy, ...localBusy]);
  }, [
    Appointments,
    form.appointment_date,
    form.appointment_time,
    form.id,
    isCustomer,
    remoteBusyEmployeeIds,
  ]);

  // ======================================================
  // REMOVE CUSTOMER PREFERENCE THAT BECAME BUSY
  // ======================================================

  useEffect(() => {
    if (
      !isCustomer ||
      professionalPreference !== "specific" ||
      busyEmployeeIds.size === 0
    ) {
      return;
    }

    setForm((current) => {
      let changed = false;

      const performers = current.performers.map((performer) => {
        const preferredId = normalizeOptionalId(
          performer.preferred_employee_id,
        );

        if (!preferredId || !busyEmployeeIds.has(preferredId)) {
          return performer;
        }

        changed = true;

        return {
          ...performer,

          preferred_employee_id: null,

          employee_id: null,
        };
      });

      if (!changed) {
        return current;
      }

      return {
        ...current,

        performers,
      };
    });
  }, [busyEmployeeIds, isCustomer, professionalPreference]);

  // ======================================================
  // REMOTE AVAILABILITY
  // ======================================================

  useEffect(() => {
    if (
      !isCustomer ||
      !form.appointment_date ||
      !form.appointment_time ||
      !getAppointmentAvailability
    ) {
      setRemoteBusyEmployeeIds([]);

      return;
    }

    let active = true;

    setCheckingAvailability(true);

    const timer = setTimeout(() => {
      getAppointmentAvailability(form.appointment_date, form.appointment_time)
        .then((ids) => {
          if (!active) {
            return;
          }

          setRemoteBusyEmployeeIds(Array.isArray(ids) ? ids : []);

          // Remove an old availability
          // error if a new check succeeds.
          setSubmitError((current) =>
            current.includes("Availability could not be checked")
              ? ""
              : current,
          );
        })
        .catch(() => {
          if (!active) {
            return;
          }

          setSubmitError(
            "Availability could not be checked. Try again before submitting.",
          );
        })
        .finally(() => {
          if (active) {
            setCheckingAvailability(false);
          }
        });
    }, 250);

    return () => {
      active = false;

      clearTimeout(timer);
    };
  }, [
    form.appointment_date,
    form.appointment_time,
    getAppointmentAvailability,
    isCustomer,
  ]);

  // ======================================================
  // SELECTED SECTION
  // ======================================================

  const selectedSection = useMemo(() => {
    return (
      (Sections || []).find(
        (section) => Number(section.id) === Number(form.section_id),
      ) || null
    );
  }, [Sections, form.section_id]);

  // ======================================================
  // SELECTED SERVICE
  // ======================================================

  const selectedService = useMemo(() => {
    return (
      (Services || []).find(
        (service) => Number(service.id) === Number(form.service_definition_id),
      ) || null
    );
  }, [Services, form.service_definition_id]);

  // ======================================================
  // PROFESSIONAL ROLES ONLY
  // ======================================================

  const professionalRoles = useMemo(
    () =>
      (roles || []).filter(
        (role) =>
          String(role.role_name || "")
            .trim()
            .toLowerCase() !== "salon",
      ),
    [roles],
  );

  // ======================================================
  // ONLINE PRICE
  // ======================================================

  const onlinePrice = Math.max(
    0,
    Math.round(Number(serviceAmount || 0) * 0.95),
  );

  // ======================================================
  // SUBMIT
  // ======================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    setSubmitError("");

    // ====================================================
    // SERVICE VALIDATION
    // ====================================================

    if (!form.section_id || !form.service_definition_id) {
      setSubmitError("Select a section and service.");

      return;
    }

    // ====================================================
    // CUSTOMER BOOKING
    // ====================================================

    if (isCustomer) {
      if (!form.appointment_date || !form.appointment_time) {
        setSubmitError("Select an appointment date and time.");

        return;
      }

      const requestedAt = DateTime.fromISO(
        `${form.appointment_date}T${form.appointment_time}`,
        {
          zone: ZONE,
        },
      );

      if (!requestedAt.isValid) {
        setSubmitError("Select a valid appointment date and time.");

        return;
      }

      const minimumTime = DateTime.now().setZone(ZONE).plus({
        hours: 2,
      });

      if (requestedAt < minimumTime) {
        setSubmitError(
          "Appointments must be booked at least 2 hours in advance.",
        );

        return;
      }

      if (professionalPreference === "specific") {
        const selectedPreference = form.performers.some((performer) =>
          normalizeOptionalId(performer.preferred_employee_id),
        );

        if (!selectedPreference) {
          setSubmitError(
            "Choose at least one preferred professional, or select Anyone available.",
          );

          return;
        }
      }
    }

    // ====================================================
    // INTERNAL SERVICE
    // ====================================================
    //
    // Walk-in service:
    // MUST have actual employees.
    //
    // Completing appointment:
    // MUST have actual employees.
    //
    // Editing completed service:
    // MUST keep actual employees.
    // ====================================================

    if (!isCustomer) {
      const missingRole = professionalRoles.find((role) => {
        const performer = form.performers.find(
          (item) => Number(item.role_id) === Number(role.id),
        );

        return !normalizeOptionalId(performer?.employee_id);
      });

      if (missingRole) {
        setSubmitError(`Select an employee for ${missingRole.role_name}.`);

        return;
      }
    }

    // ====================================================
    // PERFORMER PAYLOAD
    // ====================================================

    const performers = form.performers.map((performer) => ({
      role_id: Number(performer.role_id),

      // Customer can never set
      // actual employee.
      employee_id: isCustomer
        ? null
        : normalizeOptionalId(performer.employee_id),

      preferred_employee_id: isCustomer
        ? professionalPreference === "specific"
          ? normalizeOptionalId(performer.preferred_employee_id)
          : null
        : normalizeOptionalId(performer.preferred_employee_id),

      earned_amount: performer.earned_amount ?? null,
    }));

    // ====================================================
    // SERVICE SOURCE
    // ====================================================
    //
    // New customer booking:
    // online_booking
    //
    // New administrative service:
    // walk_in
    //
    // Existing transaction:
    // preserve its source.
    // ====================================================

    const serviceSource = isCustomer
      ? "online_booking"
      : serviceData?.service_source || "walk_in";

    // ====================================================
    // STATUS
    // ====================================================

    const finalStatus = isCustomer
      ? "pending"
      : serviceStatus || form.status || "completed";

    // ====================================================
    // PAYLOAD
    // ====================================================

    const payload = {
      id: form.id || null,

      section_id: Number(form.section_id),

      service_definition_id: Number(form.service_definition_id),

      entry_type: serviceData?.entry_type || entryType || "current",

      service_source: serviceSource,

      // Customer controls booking
      // date/time.
      //
      // Internal completion preserves
      // existing appointment information.
      appointment_date: isCustomer
        ? form.appointment_date
        : serviceData?.appointment_date || null,

      appointment_time: isCustomer
        ? form.appointment_time
        : serviceData?.appointment_time || null,

      created_by: createdBy,

      customer_id:
        customerId ??
        serviceData?.active_customer_id ??
        serviceData?.customer_id ??
        null,

      customer_note: form.customerNote,

      status: finalStatus,

      performers,
    };

    console.log("FINAL SERVICE PAYLOAD:", payload);

    const transactionId = serviceData?.transaction_id ?? serviceData?.id;

    try {
      setSubmitting(true);

      if (serviceData && transactionId) {
        await onSubmit(transactionId, payload);
      } else {
        await onSubmit(payload);
      }

      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error("Service submission error:", error);

      setSubmitError(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "The service could not be submitted. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ======================================================
  // STYLES
  // ======================================================

  const labelClass = "mb-1.5 block text-sm font-semibold text-stone-700";

  const fieldClass = `
    w-full
    rounded-xl
    border
    border-stone-200
    bg-white
    px-3.5
    py-2.5
    text-sm
    text-stone-800
    outline-none
    transition
    placeholder:text-stone-400
    focus:border-[var(--salon-copper)]
    focus:ring-2
    focus:ring-[var(--salon-copper)]/15
  `;

  // ======================================================
  // UI
  // ======================================================

  return (
    <form onSubmit={handleSubmit} className="w-full">
      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="border-b border-stone-100 px-1 pb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--salon-copper)]">
              {isCustomer
                ? "Appointment booking"
                : serviceData
                  ? "Service completion"
                  : entryType === "past"
                    ? "Historical service"
                    : "Salon operation"}
            </p>

            <h2 className="mt-1 font-serif text-2xl font-semibold text-stone-900">
              {serviceData
                ? "Complete / Update Service"
                : isCustomer
                  ? "Book an Appointment"
                  : entryType === "past"
                    ? "Add Past Service"
                    : "Add Service"}
            </h2>

            <p className="mt-1 max-w-xl text-sm leading-6 text-stone-500">
              {isCustomer
                ? "Choose your service and appointment time. You may request a preferred professional or allow the salon to assign anyone available."
                : serviceDetailsLocked
                  ? "Review the booked service and record the employees who actually performed the work."
                  : "Select the service performed and assign the employees who actually performed each required role."}
            </p>
          </div>

          {serviceData && (
            <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              Existing transaction
            </span>
          )}
        </div>
      </div>

      {/* ==================================================
          CUSTOMER BOOKING INFORMATION
      ================================================== */}

      {isCustomer && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-700">
              !
            </div>

            <div>
              <p className="text-sm font-semibold text-amber-900">
                Before booking
              </p>

              <div className="mt-1 space-y-1 text-sm leading-6 text-amber-800">
                <p>
                  Appointments must be booked at least{" "}
                  <strong>2 hours in advance</strong>.
                </p>

                <p>
                  Please arrive about{" "}
                  <strong>10 minutes before your appointment</strong>.
                </p>

                <p>
                  Your appointment is protected for{" "}
                  <strong>10 minutes after the scheduled time</strong>. After
                  that, your preferred professional may become unavailable.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {/* ==================================================
            STEP 1 — SERVICE DETAILS
        ================================================== */}

        <section className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4 sm:p-5">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
              Step 1
            </p>

            <h3 className="mt-1 text-base font-semibold text-stone-900">
              Service Details
            </h3>

            <p className="mt-1 text-sm text-stone-500">
              {serviceDetailsLocked
                ? "The booked section and service are read-only for this transaction."
                : "Select the salon section and the service required."}
            </p>
          </div>

          {/* ================================================
              LOCKED EXISTING SERVICE
          ================================================ */}

          {serviceDetailsLocked ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className={labelClass}>Section</p>

                <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
                  <p className="font-semibold text-stone-800">
                    {selectedSection?.section_name ||
                      serviceData?.section_name ||
                      "N/A"}
                  </p>

                  <p className="mt-1 text-xs text-stone-400">Read only</p>
                </div>
              </div>

              <div>
                <p className={labelClass}>Service</p>

                <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
                  <p className="font-semibold text-stone-800">
                    {selectedService?.service_name ||
                      serviceData?.service_name ||
                      "N/A"}
                  </p>

                  <p className="mt-1 text-xs text-stone-400">Read only</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Section</label>

                <select
                  value={form.section_id}
                  onChange={(event) =>
                    handleSectionSelect(Number(event.target.value))
                  }
                  required
                  className={fieldClass}
                >
                  <option value="">Select section</option>

                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.section_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Service</label>

                <select
                  value={form.service_definition_id}
                  onChange={handleServiceSelect}
                  disabled={!form.section_id}
                  required
                  className={`${fieldClass} disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400`}
                >
                  <option value="">
                    {form.section_id
                      ? "Select service"
                      : "Select section first"}
                  </option>

                  {services.map((service) => (
                    <option
                      key={service.id}
                      value={service.id}
                      data-service={JSON.stringify(service)}
                    >
                      {service.service_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* ================================================
              SERVICE SUMMARY
          ================================================ */}

          {(selectedService || serviceData?.service_name) && (
            <div className="mt-4 rounded-xl border border-stone-200 bg-white p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-stone-400">
                    Service
                  </p>

                  <p className="mt-1 font-semibold text-stone-900">
                    {selectedService?.service_name || serviceData?.service_name}
                  </p>
                </div>

                {!isCustomer && Number(serviceAmount) > 0 && (
                  <div className="text-left sm:text-right">
                    <p className="text-xs text-stone-400">Service price</p>

                    <p className="font-semibold text-[var(--salon-copper)]">
                      UGX {formatMoney(serviceAmount)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ==================================================
            CUSTOMER APPOINTMENT DETAILS
        ================================================== */}

        {isCustomer && form.service_definition_id && (
          <section className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4 sm:p-5">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
                Step 2
              </p>

              <h3 className="mt-1 text-base font-semibold text-stone-900">
                Appointment Details
              </h3>

              <p className="mt-1 text-sm text-stone-500">
                Select a date and time at least two hours from now.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Appointment Date</label>

                <input
                  type="date"
                  min={minimumAppointmentDate}
                  value={form.appointment_date}
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,

                      appointment_date: event.target.value,

                      appointment_time: "",
                    }));

                    setRemoteBusyEmployeeIds([]);
                  }}
                  required
                  className={fieldClass}
                />
              </div>

              <div>
                <label className={labelClass}>Appointment Time</label>

                <select
                  value={form.appointment_time}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,

                      appointment_time: event.target.value,
                    }))
                  }
                  disabled={!form.appointment_date}
                  required
                  className={`${fieldClass} disabled:cursor-not-allowed disabled:bg-stone-100`}
                >
                  <option value="">
                    {form.appointment_date
                      ? "Select time"
                      : "Select date first"}
                  </option>

                  {APPOINTMENT_TIME_SLOTS.map((time) => {
                    const tooSoon = isTimeSlotTooSoon(time);

                    return (
                      <option key={time} value={time} disabled={tooSoon}>
                        {time}
                        {tooSoon ? " — unavailable" : ""}
                      </option>
                    );
                  })}
                </select>

                <p className="mt-1.5 text-xs text-stone-400">
                  30-minute booking intervals.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label className={labelClass}>Additional Information</label>

              <textarea
                value={form.customerNote}
                onChange={handleCustomerNote}
                rows={4}
                placeholder="Add special requests, preferences, or other details..."
                className={`${fieldClass} resize-none`}
              />
            </div>
          </section>
        )}

        {/* ==================================================
            CUSTOMER PROFESSIONAL PREFERENCE
        ================================================== */}

        {isCustomer &&
          professionalRoles.length > 0 &&
          form.appointment_date &&
          form.appointment_time && (
            <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
                    Step 3
                  </p>

                  <h3 className="mt-1 text-base font-semibold text-stone-900">
                    Professional Preference
                  </h3>

                  <p className="mt-1 text-sm text-stone-500">
                    You may choose a preferred professional or let the salon
                    assign anyone available.
                  </p>
                </div>

                {checkingAvailability && (
                  <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    Checking availability…
                  </span>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handlePreferenceMode("any")}
                  className={`rounded-xl border p-4 text-left transition ${
                    professionalPreference === "any"
                      ? "border-[var(--salon-copper)] bg-orange-50/60 ring-1 ring-[var(--salon-copper)]"
                      : "border-stone-200 bg-white hover:bg-stone-50"
                  }`}
                >
                  <p className="font-semibold text-stone-900">
                    Anyone available
                  </p>

                  <p className="mt-1 text-sm text-stone-500">
                    Let the salon assign an available professional.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handlePreferenceMode("specific")}
                  className={`rounded-xl border p-4 text-left transition ${
                    professionalPreference === "specific"
                      ? "border-[var(--salon-copper)] bg-orange-50/60 ring-1 ring-[var(--salon-copper)]"
                      : "border-stone-200 bg-white hover:bg-stone-50"
                  }`}
                >
                  <p className="font-semibold text-stone-900">
                    Choose preferred professional
                  </p>

                  <p className="mt-1 text-sm text-stone-500">
                    Request someone specific where available.
                  </p>
                </button>
              </div>

              {professionalPreference === "specific" && (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {professionalRoles.map((role) => {
                    const performer = form.performers.find(
                      (item) => Number(item.role_id) === Number(role.id),
                    );

                    return (
                      <div
                        key={role.id}
                        className="rounded-xl border border-stone-200 bg-stone-50/60 p-3"
                      >
                        <label className="mb-2 block text-sm font-semibold text-stone-700">
                          {role.role_name}
                        </label>

                        {/* CUSTOMER NEVER SEES
                              EARNED AMOUNT */}

                        <select
                          value={performer?.preferred_employee_id || ""}
                          onChange={(event) =>
                            updatePreferredPerformer(
                              role.id,
                              event.target.value,
                            )
                          }
                          className={fieldClass}
                        >
                          <option value="">No preference</option>

                          {employees.map((employee) => {
                            const busy = busyEmployeeIds.has(
                              Number(employee.id),
                            );

                            return (
                              <option
                                key={employee.id}
                                value={employee.id}
                                disabled={busy}
                              >
                                {employee.first_name} {employee.last_name}
                                {busy ? " — unavailable" : ""}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 rounded-xl bg-stone-50 p-3 text-sm leading-6 text-stone-600">
                A preferred professional is a request only. The employee who
                actually performs the service will be recorded when the service
                is completed.
              </div>
            </section>
          )}

        {/* ==================================================
            INTERNAL ACTUAL PROFESSIONALS
        ==================================================
            
            IMPORTANT:
            
            This section is visible for:
            
            cashier walk-in
            cashier appointment completion
            manager service entry
            owner service entry
            past service entry
            
            It is hidden ONLY for customer mode.
        ================================================== */}

        {!isCustomer && professionalRoles.length > 0 && (
          <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
                Step 2
              </p>

              <h3 className="mt-1 text-base font-semibold text-stone-900">
                Actual Professionals
              </h3>

              <p className="mt-1 text-sm text-stone-500">
                Select the employees who actually performed each part of this
                service.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {professionalRoles.map((role) => {
                const performer = form.performers.find(
                  (item) => Number(item.role_id) === Number(role.id),
                );

                const preferredEmployee = employees.find(
                  (employee) =>
                    Number(employee.id) ===
                    Number(performer?.preferred_employee_id),
                );

                return (
                  <div
                    key={role.id}
                    className="rounded-xl border border-stone-200 bg-stone-50/60 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label className="text-sm font-semibold text-stone-700">
                        {role.role_name}
                      </label>

                      {/* INTERNAL ONLY */}

                      {Number(role.earned_amount || 0) > 0 && (
                        <span className="text-xs font-semibold text-[var(--salon-copper)]">
                          UGX {formatMoney(role.earned_amount)}
                        </span>
                      )}
                    </div>

                    {preferredEmployee && (
                      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-xs text-amber-700">
                          Customer preference
                        </p>

                        <p className="text-sm font-semibold text-amber-900">
                          {preferredEmployee.first_name}{" "}
                          {preferredEmployee.last_name}
                        </p>
                      </div>
                    )}

                    <select
                      value={performer?.employee_id || ""}
                      onChange={(event) =>
                        updateActualPerformer(role.id, event.target.value)
                      }
                      required
                      className={fieldClass}
                    >
                      <option value="">Select employee</option>

                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.first_name} {employee.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ==================================================
            CUSTOMER PRICE
        ================================================== */}

        {isCustomer && form.service_definition_id && (
          <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50">
            <div className="p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Online booking offer
              </p>

              <div className="mt-3 flex flex-wrap items-end gap-3">
                <p className="text-2xl font-bold text-emerald-800">
                  UGX {formatMoney(onlinePrice)}
                </p>

                <p className="pb-1 text-sm text-stone-400 line-through">
                  UGX {formatMoney(serviceAmount)}
                </p>
              </div>

              <p className="mt-2 text-sm text-emerald-700">
                5% online booking discount applied.
              </p>
            </div>
          </section>
        )}

        {/* ==================================================
            INTERNAL NOTE
        ================================================== */}

        {!isCustomer && (
          <section className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4 sm:p-5">
            <label className={labelClass}>Additional Information</label>

            <textarea
              value={form.customerNote}
              onChange={handleCustomerNote}
              rows={4}
              placeholder="Add information about this service..."
              className={`${fieldClass} resize-none`}
            />
          </section>
        )}

        {/* ==================================================
            ERROR
        ================================================== */}

        {submitError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4"
          >
            <p className="text-sm font-semibold text-red-800">
              Unable to continue
            </p>

            <p className="mt-1 text-sm text-red-700">{submitError}</p>
          </div>
        )}

        {/* ==================================================
            FOOTER
        ================================================== */}

        <div className="sticky bottom-0 z-10 border-t border-stone-200 bg-white/95 py-4 backdrop-blur">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={submitting || checkingAvailability}
              className="inline-flex min-w-40 items-center justify-center rounded-xl bg-[var(--salon-copper)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--salon-copper)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting
                ? "Submitting..."
                : serviceData
                  ? "Save & Complete"
                  : isCustomer
                    ? "Request Appointment"
                    : entryType === "past"
                      ? "Add Past Service"
                      : "Add Service"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
