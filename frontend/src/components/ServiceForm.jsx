import React, { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";

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
  // LOCAL STATE
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
  // PREFILL FORM WHEN EDITING
  // ======================================================

  useEffect(() => {
    if (!serviceData) return;

    const sectionId =
      serviceData.definition_section_id ?? serviceData.section_id;

    setForm({
      id: serviceData.transaction_id ?? serviceData.id,

      section_id: sectionId,

      service_definition_id: serviceData.service_definition_id,

      appointment_date: serviceData.appointment_date || "",

      appointment_time: serviceData.appointment_time || "",

      customerNote: serviceData.customer_note || "",

      status: serviceData.status || serviceStatus || null,

      performers: (serviceData.performers || []).map((performer) => ({
        ...performer,

        role_id: performer.role_id ?? performer.service_role_id,

        earned_amount: performer.earned_amount ?? performer.role_amount,
      })),
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
  }, [serviceData, Services, Roles, serviceStatus]);

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

    const performers = matchingRoles.map((role) => {
      const isSalon =
        String(role.role_name || "")
          .trim()
          .toLowerCase() === "salon";

      return {
        role_id: role.id,

        employee_id: isSalon ? null : "",

        earned_amount: role.earned_amount,
      };
    });

    setForm((current) => ({
      ...current,

      service_definition_id: id,

      performers,
    }));

    setServiceAmount(
      Number(serviceObj?.service_amount || serviceObj?.full_amount || 0),
    );

    setRoles(matchingRoles);
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
  // UPDATE PERFORMER
  // ======================================================

  const updatePerformer = (roleId, employeeId) => {
    setForm((current) => ({
      ...current,

      performers: current.performers.map((performer) =>
        Number(performer.role_id) === Number(roleId)
          ? {
              ...performer,

              employee_id: employeeId === "" ? null : employeeId,
            }
          : performer,
      ),
    }));
  };

  // ======================================================
  // BUSY EMPLOYEES
  // ======================================================

  const busyEmployeeIds = useMemo(() => {
    if (!isCustomer || !form.appointment_date || !form.appointment_time) {
      return new Set();
    }

    const requestedTime = form.appointment_time.slice(0, 5);

    const currentId = Number(form.id);

    return new Set([
      ...remoteBusyEmployeeIds,

      ...(Appointments || [])
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
        .map((performer) => Number(performer.employee_id))
        .filter(Number.isInteger),
    ]);
  }, [
    Appointments,
    form.appointment_date,
    form.appointment_time,
    form.id,
    isCustomer,
    remoteBusyEmployeeIds,
  ]);

  // ======================================================
  // REMOVE BUSY EMPLOYEE FROM CURRENT SELECTION
  // ======================================================

  useEffect(() => {
    if (!isCustomer || busyEmployeeIds.size === 0) {
      return;
    }

    setForm((current) => {
      let changed = false;

      const performers = current.performers.map((performer) => {
        if (!busyEmployeeIds.has(Number(performer.employee_id))) {
          return performer;
        }

        changed = true;

        return {
          ...performer,
          employee_id: "",
        };
      });

      return changed
        ? {
            ...current,
            performers,
          }
        : current;
    });
  }, [busyEmployeeIds, isCustomer]);

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
          if (!active) return;

          setRemoteBusyEmployeeIds(Array.isArray(ids) ? ids : []);
        })
        .catch(() => {
          if (!active) return;

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

    if (!form.section_id || !form.service_definition_id) {
      setSubmitError("Select a section and service.");

      return;
    }

    if (isCustomer && (!form.appointment_date || !form.appointment_time)) {
      setSubmitError("Select an appointment date and time.");

      return;
    }

    const missingRole = roles.find((role) => {
      if (role.role_name?.trim().toLowerCase() === "salon") {
        return false;
      }

      return !form.performers.find(
        (performer) =>
          Number(performer.role_id) === Number(role.id) &&
          performer.employee_id,
      );
    });

    if (missingRole) {
      setSubmitError(`Select an employee for ${missingRole.role_name}.`);

      return;
    }

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

      status: form.status || serviceStatus || null,

      performers: form.performers.map((performer) => ({
        role_id: performer.role_id,

        employee_id:
          performer.employee_id === "" ? null : performer.employee_id,

        earned_amount: performer.earned_amount,
      })),
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
                ? "Choose the service you need, select your preferred appointment time and assign available professionals."
                : "Select the service performed and assign each required professional."}
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
          CUSTOMER APPOINTMENT NOTICE
      ================================================== */}

      {isCustomer && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-700">
              !
            </div>

            <div>
              <p className="text-sm font-semibold text-amber-900">
                Appointment timing
              </p>

              <p className="mt-1 text-sm leading-6 text-amber-800">
                Your appointment remains reserved for 10 minutes after the
                scheduled time. After that, the employee may attend to another
                client and you may need to wait.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {/* ==================================================
            SERVICE DETAILS
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
              Select the salon section and the required service.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* SECTION */}

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

            {/* SERVICE */}

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

          {/* SELECTED SERVICE SUMMARY */}

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
            PROFESSIONAL ASSIGNMENTS
        ================================================== */}

        {roles.length > 0 && (
          <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
                  Step 2
                </p>

                <h3 className="mt-1 text-base font-semibold text-stone-900">
                  Assign Professionals
                </h3>

                <p className="mt-1 text-sm text-stone-500">
                  Choose the employee responsible for every required service
                  role.
                </p>
              </div>

              {checkingAvailability && (
                <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  Checking availability…
                </span>
              )}
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

                      {Number(role.earned_amount || 0) > 0 && (
                        <span className="text-xs font-semibold text-[var(--salon-copper)]">
                          UGX {formatMoney(role.earned_amount)}
                        </span>
                      )}
                    </div>

                    <select
                      value={performer?.employee_id || ""}
                      onChange={(event) =>
                        updatePerformer(role.id, event.target.value)
                      }
                      required
                      className={fieldClass}
                    >
                      <option value="">Select employee</option>

                      {employees.map((employee) => {
                        const busy = busyEmployeeIds.has(Number(employee.id));

                        return (
                          <option
                            key={employee.id}
                            value={employee.id}
                            disabled={busy}
                          >
                            {employee.first_name} {employee.last_name}
                            {busy ? " — booked" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ==================================================
            APPOINTMENT DETAILS
        ================================================== */}

        {isCustomer && (
          <section className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4 sm:p-5">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
                Step 3
              </p>

              <h3 className="mt-1 text-base font-semibold text-stone-900">
                Appointment Details
              </h3>

              <p className="mt-1 text-sm text-stone-500">
                Choose the date and preferred appointment time.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* DATE */}

              <div>
                <label className={labelClass}>Appointment Date</label>

                <input
                  type="date"
                  min={DateTime.now().setZone("Africa/Kampala").toISODate()}
                  value={form.appointment_date}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,

                      appointment_date: event.target.value,
                    }))
                  }
                  required
                  className={fieldClass}
                />
              </div>

              {/* TIME */}

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
                  required
                  className={fieldClass}
                >
                  <option value="">Select time</option>

                  {APPOINTMENT_TIME_SLOTS.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>

                <p className="mt-1.5 text-xs text-stone-400">
                  Available in 30-minute intervals.
                </p>
              </div>
            </div>

            {/* NOTE */}

            <div className="mt-4">
              <label className={labelClass}>Additional Information</label>

              <textarea
                name="customerNote"
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
            PRICE SUMMARY
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
            FORM FOOTER
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
              disabled={submitting}
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
