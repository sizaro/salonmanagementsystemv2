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

export default function ServiceForm({
  isCustomer = false,
  onSubmit,
  onClose,
  Sections,
  Services,
  Roles,
  Employees,
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
  //
  // "any"
  // Customer does not care who performs the service.
  //
  // "specific"
  // Customer may request a preferred employee for each
  // required role.
  //
  // This NEVER sets employee_id for customers.
  // ======================================================

  const [professionalPreference, setProfessionalPreference] = useState("any");

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
  // CURRENT TIME / BOOKING LIMIT
  // ======================================================

  const now = DateTime.now().setZone(ZONE);

  const minimumAppointmentTime = now.plus({
    hours: 2,
  });

  // Date may still be today if a valid time exists
  // at least two hours from now.
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
  // PREFILL WHEN EDITING
  // ======================================================

  useEffect(() => {
    if (!serviceData) {
      return;
    }

    const sectionId =
      serviceData.definition_section_id ?? serviceData.section_id;

    const existingPerformers = (serviceData.performers || []).map(
      (performer) => ({
        ...performer,

        role_id: performer.role_id ?? performer.service_role_id,

        employee_id: performer.employee_id || null,

        preferred_employee_id: performer.preferred_employee_id || null,

        earned_amount: performer.earned_amount ?? performer.role_amount ?? null,
      }),
    );

    setForm({
      id: serviceData.transaction_id ?? serviceData.id,

      section_id: sectionId || "",

      service_definition_id: serviceData.service_definition_id || "",

      appointment_date: serviceData.appointment_date || "",

      appointment_time: serviceData.appointment_time || "",

      customerNote: serviceData.customer_note || "",

      status: serviceData.status || serviceStatus || null,

      performers: existingPerformers,
    });

    setServices(
      (Services || []).filter(
        (service) => Number(service.section_id) === Number(sectionId),
      ),
    );

    if (serviceData.service_definition_id) {
      const matchingRoles = (Roles || []).filter(
        (role) =>
          Number(role.service_definition_id) ===
          Number(serviceData.service_definition_id),
      );

      setRoles(matchingRoles);

      setServiceAmount(
        Number(serviceData.full_amount || serviceData.service_amount || 0),
      );
    }

    // If this is a customer booking and at least one
    // preference already exists, open preference mode.
    if (
      isCustomer &&
      existingPerformers.some((performer) => performer.preferred_employee_id)
    ) {
      setProfessionalPreference("specific");
    }
  }, [serviceData, Services, Roles, serviceStatus, isCustomer]);

  // ======================================================
  // SECTION SELECTION
  // ======================================================

  const handleSectionSelect = (id) => {
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
    // CREATE ONE PERFORMER RECORD PER ROLE
    // ====================================================
    //
    // Internal:
    // employee_id will later contain the actual worker.
    //
    // Customer:
    // employee_id remains NULL.
    // preferred_employee_id may contain a preference.
    // ====================================================

    const performers = matchingRoles.map((role) => {
      const isSalon =
        String(role.role_name || "")
          .trim()
          .toLowerCase() === "salon";

      return {
        role_id: role.id,

        employee_id: null,

        preferred_employee_id: null,

        earned_amount: role.earned_amount,
      };
    });

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
  // INTERNAL ACTUAL EMPLOYEE
  // ======================================================

  const updateActualPerformer = (roleId, employeeId) => {
    setForm((current) => ({
      ...current,

      performers: current.performers.map((performer) =>
        Number(performer.role_id) === Number(roleId)
          ? {
              ...performer,

              employee_id: employeeId === "" ? null : Number(employeeId),
            }
          : performer,
      ),
    }));
  };

  // ======================================================
  // CUSTOMER PREFERRED EMPLOYEE
  // ======================================================

  const updatePreferredPerformer = (roleId, employeeId) => {
    setForm((current) => ({
      ...current,

      performers: current.performers.map((performer) =>
        Number(performer.role_id) === Number(roleId)
          ? {
              ...performer,

              // Customer never assigns the actual worker.
              employee_id: null,

              preferred_employee_id:
                employeeId === "" ? null : Number(employeeId),
            }
          : performer,
      ),
    }));
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
  // LOCAL BUSY EMPLOYEES
  // ======================================================

  const busyEmployeeIds = useMemo(() => {
    if (!isCustomer || !form.appointment_date || !form.appointment_time) {
      return new Set();
    }

    const requestedTime = form.appointment_time.slice(0, 5);

    const currentId = Number(form.id);

    const localBusy = (Appointments || [])
      .filter((appointment) => {
        const appointmentId = Number(
          appointment.transaction_id ?? appointment.id,
        );

        return (
          appointmentId !== currentId &&
          ["pending", "confirmed"].includes(
            String(appointment.status).toLowerCase(),
          ) &&
          appointment.appointment_date?.slice(0, 10) ===
            form.appointment_date &&
          appointment.appointment_time?.slice(0, 5) === requestedTime
        );
      })
      .flatMap((appointment) => appointment.performers || [])
      .flatMap((performer) => [
        Number(performer.employee_id),

        Number(performer.preferred_employee_id),
      ])
      .filter(Number.isInteger);

    return new Set([...remoteBusyEmployeeIds.map(Number), ...localBusy]);
  }, [
    Appointments,
    form.appointment_date,
    form.appointment_time,
    form.id,
    isCustomer,
    remoteBusyEmployeeIds,
  ]);

  // ======================================================
  // REMOVE PREFERENCE THAT BECAME BUSY
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
        if (!busyEmployeeIds.has(Number(performer.preferred_employee_id))) {
          return performer;
        }

        changed = true;

        return {
          ...performer,

          preferred_employee_id: null,

          employee_id: null,
        };
      });

      return changed
        ? {
            ...current,
            performers,
          }
        : current;
    });
  }, [busyEmployeeIds, isCustomer, professionalPreference]);

  // ======================================================
  // REMOTE AVAILABILITY CHECK
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
    // SERVICE
    // ====================================================

    if (!form.section_id || !form.service_definition_id) {
      setSubmitError("Select a section and service.");

      return;
    }

    // ====================================================
    // CUSTOMER APPOINTMENT
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

      // ==================================================
      // CUSTOMER PREFERENCE VALIDATION
      // ==================================================
      //
      // "Anyone available":
      // nothing more is required.
      //
      // "Preferred professionals":
      // they may choose preferences for the roles they want.
      //
      // We intentionally do NOT require every role to have
      // a preference because preference itself is optional.
      // ==================================================

      if (professionalPreference === "specific") {
        const selectedPreference = form.performers.some(
          (performer) => performer.preferred_employee_id,
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
    // INTERNAL COMPLETED SERVICE
    // ====================================================

    if (!isCustomer) {
      const missingRole = roles.find((role) => {
        const isSalon =
          String(role.role_name || "")
            .trim()
            .toLowerCase() === "salon";

        if (isSalon) {
          return false;
        }

        const performer = form.performers.find(
          (item) => Number(item.role_id) === Number(role.id),
        );

        return !performer?.employee_id;
      });

      if (missingRole) {
        setSubmitError(`Select an employee for ${missingRole.role_name}.`);

        return;
      }
    }

    // ====================================================
    // BUILD PERFORMER PAYLOAD
    // ====================================================

    const performers = form.performers.map((performer) => ({
      role_id: performer.role_id,

      // Customer never sends an actual performer.
      employee_id: isCustomer ? null : performer.employee_id || null,

      // Internal form preserves preference if editing
      // an appointment.
      preferred_employee_id: isCustomer
        ? professionalPreference === "specific"
          ? performer.preferred_employee_id || null
          : null
        : performer.preferred_employee_id || null,

      earned_amount: performer.earned_amount,
    }));

    // ====================================================
    // PAYLOAD
    // ====================================================

    const payload = {
      id: form.id || null,

      section_id: form.section_id,

      service_definition_id: form.service_definition_id,

      entry_type: entryType,

      appointment_date: isCustomer ? form.appointment_date : null,

      appointment_time: isCustomer ? form.appointment_time : null,

      created_by: createdBy,

      customer_id: customerId,

      customer_note: form.customerNote,

      status: isCustomer
        ? "pending"
        : form.status || serviceStatus || "completed",

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
                  ? "Service update"
                  : entryType === "past"
                    ? "Historical service"
                    : "Salon operation"}
            </p>

            <h2 className="mt-1 font-serif text-2xl font-semibold text-stone-900">
              {serviceData
                ? "Edit Service"
                : isCustomer
                  ? "Book an Appointment"
                  : entryType === "past"
                    ? "Add Past Service"
                    : "Add Service"}
            </h2>

            <p className="mt-1 max-w-xl text-sm leading-6 text-stone-500">
              {isCustomer
                ? "Choose your service and appointment time. You may request a preferred professional or allow the salon to assign anyone available."
                : "Select the service performed and assign the employees who actually performed each required role."}
            </p>
          </div>

          {serviceData && (
            <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              Editing
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
                  <strong>10 minutes before your appointment</strong> so your
                  service can be initiated on time.
                </p>

                <p>
                  Your appointment is protected for{" "}
                  <strong>10 minutes after the scheduled time</strong>. If you
                  arrive later and your preferred professional becomes busy, you
                  may need to wait or be served by another available
                  professional.
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
              Select the salon section and the service required.
            </p>
          </div>

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
                  {form.section_id ? "Select service" : "Select section first"}
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

          {selectedService && (
            <div className="mt-4 rounded-xl border border-stone-200 bg-white p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-stone-400">
                    Selected service
                  </p>

                  <p className="mt-1 font-semibold text-stone-900">
                    {selectedService.service_name}
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
            CUSTOMER STEP 2 — APPOINTMENT DATE/TIME
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

                      // Force user to
                      // re-evaluate time
                      // when date changes.
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
                  Appointment times are available in 30-minute intervals.
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
            CUSTOMER STEP 3 — PROFESSIONAL PREFERENCE
        ================================================== */}

        {isCustomer &&
          roles.length > 0 &&
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

                  <p className="mt-1 max-w-xl text-sm text-stone-500">
                    You do not have to choose a specific employee. The salon can
                    assign an available professional for you.
                  </p>
                </div>

                {checkingAvailability && (
                  <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    Checking availability…
                  </span>
                )}
              </div>

              {/* PREFERENCE OPTIONS */}

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
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        professionalPreference === "any"
                          ? "border-[var(--salon-copper)]"
                          : "border-stone-300"
                      }`}
                    >
                      {professionalPreference === "any" && (
                        <span className="h-2.5 w-2.5 rounded-full bg-[var(--salon-copper)]" />
                      )}
                    </span>

                    <div>
                      <p className="font-semibold text-stone-900">
                        Anyone available
                      </p>

                      <p className="mt-1 text-sm leading-5 text-stone-500">
                        Let the salon assign an available professional when you
                        arrive.
                      </p>
                    </div>
                  </div>
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
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        professionalPreference === "specific"
                          ? "border-[var(--salon-copper)]"
                          : "border-stone-300"
                      }`}
                    >
                      {professionalPreference === "specific" && (
                        <span className="h-2.5 w-2.5 rounded-full bg-[var(--salon-copper)]" />
                      )}
                    </span>

                    <div>
                      <p className="font-semibold text-stone-900">
                        Choose preferred professional
                      </p>

                      <p className="mt-1 text-sm leading-5 text-stone-500">
                        Request a particular professional where available.
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {/* CUSTOMER PREFERENCE SELECTORS */}

              {professionalPreference === "specific" && (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {roles.map((role) => {
                    const isSalon =
                      String(role.role_name || "")
                        .trim()
                        .toLowerCase() === "salon";

                    if (isSalon) {
                      return null;
                    }

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

                        {/* IMPORTANT:
                              No role_amount/
                              earned_amount is
                              displayed to customer.
                          */}

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
                A preferred professional is a request, not the final employee
                assignment. The salon will confirm who is available, and the
                actual professional who performs the service will be recorded
                when the service is completed.
              </div>
            </section>
          )}

        {/* ==================================================
            INTERNAL PROFESSIONAL ASSIGNMENT
        ================================================== */}

        {!isCustomer && roles.length > 0 && (
          <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
                Step 2
              </p>

              <h3 className="mt-1 text-base font-semibold text-stone-900">
                Actual Professionals
              </h3>

              <p className="mt-1 text-sm text-stone-500">
                Assign the employees who actually performed each required role.
                Completed services cannot be saved without these employees.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {roles.map((role) => {
                const isSalon =
                  String(role.role_name || "")
                    .trim()
                    .toLowerCase() === "salon";

                if (isSalon) {
                  return null;
                }

                const performer = form.performers.find(
                  (item) => Number(item.role_id) === Number(role.id),
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

                    {performer?.preferred_employee_id && (
                      <p className="mt-2 text-xs text-stone-500">
                        Customer preference:{" "}
                        <span className="font-semibold text-stone-700">
                          {employees.find(
                            (employee) =>
                              Number(employee.id) ===
                              Number(performer.preferred_employee_id),
                          )
                            ? `${
                                employees.find(
                                  (employee) =>
                                    Number(employee.id) ===
                                    Number(performer.preferred_employee_id),
                                )?.first_name
                              } ${
                                employees.find(
                                  (employee) =>
                                    Number(employee.id) ===
                                    Number(performer.preferred_employee_id),
                                )?.last_name
                              }`
                            : "Selected professional"}
                        </span>
                      </p>
                    )}
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
                className="
                  inline-flex
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-stone-200
                  bg-white
                  px-5
                  py-2.5
                  text-sm
                  font-semibold
                  text-stone-700
                  transition
                  hover:bg-stone-50
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={submitting || checkingAvailability}
              className="
                inline-flex
                min-w-40
                items-center
                justify-center
                rounded-xl
                bg-[var(--salon-copper)]
                px-6
                py-2.5
                text-sm
                font-semibold
                text-white
                shadow-sm
                transition
                hover:opacity-90
                focus:outline-none
                focus:ring-2
                focus:ring-[var(--salon-copper)]
                focus:ring-offset-2
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              {submitting
                ? "Submitting..."
                : serviceData
                  ? "Save Changes"
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
