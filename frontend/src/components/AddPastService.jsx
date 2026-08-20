import React, { useEffect, useMemo, useState } from "react";

const formatMoney = (value) => Number(value || 0).toLocaleString("en-UG");

export default function AddPastService({
  onSubmit,
  onClose,
  Sections,
  Services,
  Roles,
  Employees,
  createdBy,
  customerId = null,
  serviceStatus = "completed",
  entryType = "current",
}) {
  // ======================================================
  // STATE
  // ======================================================

  const [sections, setSections] = useState(Sections || []);
  const [services, setServices] = useState([]);
  const [roles, setRoles] = useState([]);
  const [employees, setEmployees] = useState(Employees || []);
  const [serviceAmount, setServiceAmount] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [form, setForm] = useState({
    section_id: "",
    service_definition_id: "",
    service_date: "",
    service_time: "",
    customerNote: "",
    performers: [],
  });

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
  // SELECT SECTION
  // ======================================================

  const handleSectionSelect = (id) => {
    setForm((current) => ({
      ...current,
      section_id: id,
      service_definition_id: "",
      performers: [],
    }));

    setServices(
      (Services || []).filter(
        (service) => Number(service.section_id) === Number(id),
      ),
    );

    setRoles([]);
    setServiceAmount("");
    setSubmitError("");
  };

  // ======================================================
  // SELECT SERVICE
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

    setRoles(matchingRoles);

    setServiceAmount(
      Number(serviceObj?.service_amount || serviceObj?.full_amount || 0),
    );

    setSubmitError("");
  };

  // ======================================================
  // ASSIGN EMPLOYEE
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
  // NOTE
  // ======================================================

  const handleCustomerNote = (event) => {
    setForm((current) => ({
      ...current,
      customerNote: event.target.value,
    }));
  };

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

    if (!form.service_date || !form.service_time) {
      setSubmitError(
        "Select the date and time when the service was performed.",
      );
      return;
    }

    const missingRole = roles.find((role) => {
      const isSalon =
        String(role.role_name || "")
          .trim()
          .toLowerCase() === "salon";

      if (isSalon) return false;

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
      entry_type: entryType,

      section_id: form.section_id,

      service_definition_id: form.service_definition_id,

      service_date: form.service_date,

      service_time: form.service_time,

      appointment_date: null,

      appointment_time: null,

      customer_id: customerId,

      created_by: createdBy,

      customer_note: form.customerNote,

      status: serviceStatus,

      performers: form.performers.map((performer) => ({
        role_id: performer.role_id,

        employee_id:
          performer.employee_id === "" ? null : performer.employee_id,

        earned_amount: performer.earned_amount,
      })),
    };

    console.log("PAST SERVICE PAYLOAD", JSON.stringify(payload, null, 2));

    try {
      setSubmitting(true);

      await onSubmit(payload);

      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error("Past service error:", error);

      setSubmitError(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          "The past service could not be saved. Please try again.",
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
              Historical service
            </p>

            <h2 className="mt-1 font-serif text-2xl font-semibold text-stone-900">
              Add Past Service
            </h2>

            <p className="mt-1 max-w-xl text-sm leading-6 text-stone-500">
              Record a service that was performed earlier, assign the
              professionals who handled it, and enter the original service date
              and time.
            </p>
          </div>

          <span className="w-fit rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
            Past Record
          </span>
        </div>
      </div>

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
              Choose the salon section and the service that was performed.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* SECTION */}

            <div>
              <label className={labelClass}>Section</label>

              <select
                required
                value={form.section_id}
                onChange={(event) =>
                  handleSectionSelect(Number(event.target.value))
                }
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
                required
                value={form.service_definition_id}
                onChange={handleServiceSelect}
                disabled={!form.section_id}
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

                <div className="text-left sm:text-right">
                  <p className="text-xs text-stone-400">Service amount</p>

                  <p className="mt-1 text-lg font-semibold text-[var(--salon-copper)]">
                    UGX {formatMoney(serviceAmount)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ==================================================
            PROFESSIONALS
        ================================================== */}

        {roles.length > 0 && (
          <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
                Step 2
              </p>

              <h3 className="mt-1 text-base font-semibold text-stone-900">
                Assign Professionals
              </h3>

              <p className="mt-1 text-sm text-stone-500">
                Select the employee who performed each role for this service.
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

                      {Number(role.earned_amount || 0) > 0 && (
                        <span className="text-xs font-semibold text-[var(--salon-copper)]">
                          UGX {formatMoney(role.earned_amount)}
                        </span>
                      )}
                    </div>

                    <select
                      required
                      value={performer?.employee_id || ""}
                      onChange={(event) =>
                        updatePerformer(role.id, event.target.value)
                      }
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
            DATE AND TIME
        ================================================== */}

        <section className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4 sm:p-5">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
              Step 3
            </p>

            <h3 className="mt-1 text-base font-semibold text-stone-900">
              When Was It Performed?
            </h3>

            <p className="mt-1 text-sm text-stone-500">
              Enter the original date and time for this service.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* DATE */}

            <div>
              <label className={labelClass}>Service Date</label>

              <input
                type="date"
                required
                value={form.service_date}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    service_date: event.target.value,
                  }))
                }
                className={fieldClass}
              />
            </div>

            {/* TIME */}

            <div>
              <label className={labelClass}>Service Time</label>

              <input
                type="time"
                required
                value={form.service_time}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    service_time: event.target.value,
                  }))
                }
                className={fieldClass}
              />

              <p className="mt-1.5 text-xs text-stone-400">
                Enter the approximate time if the exact time is not known.
              </p>
            </div>
          </div>
        </section>

        {/* ==================================================
            NOTES
        ================================================== */}

        <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
              Additional details
            </p>

            <h3 className="mt-1 text-base font-semibold text-stone-900">
              Service Notes
            </h3>
          </div>

          <label className={labelClass}>Additional Information</label>

          <textarea
            value={form.customerNote}
            onChange={handleCustomerNote}
            rows={4}
            placeholder="Add notes about the client, service, adjustments, or anything important..."
            className={`${fieldClass} resize-none`}
          />
        </section>

        {/* ==================================================
            SUMMARY
        ================================================== */}

        {form.service_definition_id && (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Record Summary
            </p>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-emerald-700">Service</p>

                <p className="mt-1 font-semibold text-emerald-950">
                  {selectedService?.service_name || "Selected service"}
                </p>
              </div>

              <div className="sm:text-right">
                <p className="text-xs text-emerald-700">Service Amount</p>

                <p className="mt-1 text-xl font-bold text-emerald-800">
                  UGX {formatMoney(serviceAmount)}
                </p>
              </div>
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
              Unable to save service
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
              disabled={submitting}
              className="
                inline-flex
                min-w-44
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
              {submitting ? "Saving..." : "Save Past Service"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
