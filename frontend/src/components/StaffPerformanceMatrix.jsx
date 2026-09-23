import React, { useMemo, useState } from "react";
import { DateTime } from "luxon";

const TIMEZONE = "Africa/Kampala";

const toClockDateTime = (clock, type) => {
  const timestamp = clock[type];

  if (timestamp) {
    const parsed = DateTime.fromISO(String(timestamp), {
      zone: TIMEZONE,
    });

    if (parsed.isValid) return parsed;
  }

  const date = clock[`${type}_date`];
  const time = clock[`${type}_time`];

  if (!date || !time) return null;

  const parsed = DateTime.fromISO(
    `${String(date).slice(0, 10)}T${String(time)}`,
    {
      zone: TIMEZONE,
    },
  );

  return parsed.isValid ? parsed : null;
};

const formatTime = (value) => {
  if (!value) return "-";

  return value.setZone(TIMEZONE).toFormat("h:mm a");
};

const formatHours = (minutes) => {
  if (!minutes) return "0h 0m";

  return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
};

const formatMoney = (value) => Number(value || 0).toLocaleString();

const getEmployeeName = (employee) =>
  `${employee.first_name || ""} ${employee.last_name || ""}`.trim() ||
  "Unnamed staff";

const getGender = (employee) =>
  String(employee.gender || "")
    .trim()
    .toLowerCase();

const getServiceDefinitionId = (service) =>
  String(
    service.service_definition_id ??
      service.definition_id ??
      service.service_name ??
      "unknown",
  );

const getServiceLabel = (service) =>
  service.service_name || service.service_definition_name || "Service";

const StaffPerformanceMatrix = ({
  title = "Staff Performance",
  employees = [],
  services = [],
  serviceDefinitions = [],
  advances = [],
  tagFees = [],
  lateFees = [],
  clockings = [],
  periodLabel = "",
}) => {
  const [genderFilter, setGenderFilter] = useState("all");

  /*
   * This is the only place where Male/Female filtering happens.
   *
   * The report itself remains one report.
   */
  const visibleEmployees = useMemo(() => {
    if (genderFilter === "all") {
      return employees;
    }

    return employees.filter((employee) => getGender(employee) === genderFilter);
  }, [employees, genderFilter]);

  /*
   * Calculate each employee independently.
   *
   * If Spartan and Shamina both worked on the same service
   * transaction, BOTH get one service count.
   *
   * The service's overall total is calculated separately from
   * the transactions themselves, so one transaction remains one
   * service even when multiple employees performed it.
   */
  const employeeStats = useMemo(() => {
    return visibleEmployees.map((employee) => {
      const employeeId = Number(employee.id);

      const empServices = (services || []).filter((service) =>
        service.performers?.some(
          (performer) => Number(performer.employee_id) === employeeId,
        ),
      );

      const serviceCounts = empServices.reduce((acc, service) => {
        const key = getServiceDefinitionId(service);

        acc[key] = (acc[key] || 0) + 1;

        return acc;
      }, {});

      const totalSalary = empServices.reduce((sum, service) => {
        const employeeRoleAmount = (service.performers || []).reduce(
          (roleSum, performer) => {
            if (Number(performer.employee_id) === employeeId) {
              return roleSum + Number(performer.role_amount || 0);
            }

            return roleSum;
          },
          0,
        );

        return sum + employeeRoleAmount;
      }, 0);

      const totalAdvances = (advances || [])
        .filter((advance) => Number(advance.employee_id) === employeeId)
        .reduce((sum, advance) => sum + Number(advance.amount || 0), 0);

      const totalTagFees = (tagFees || [])
        .filter((fee) => Number(fee.employee_id) === employeeId)
        .reduce((sum, fee) => sum + Number(fee.amount || 0), 0);

      const totalLateFees = (lateFees || [])
        .filter((fee) => Number(fee.employee_id) === employeeId)
        .reduce((sum, fee) => sum + Number(fee.amount || 0), 0);

      const employeeClockings = (clockings || [])
        .filter((clock) => Number(clock.employee_id) === employeeId)
        .map((clock) => ({
          clockIn: toClockDateTime(clock, "clock_in"),
          clockOut: toClockDateTime(clock, "clock_out"),
        }))
        .filter((clock) => clock.clockIn)
        .sort((a, b) => a.clockIn.toMillis() - b.clockIn.toMillis());

      const completedClockings = employeeClockings.filter(
        (clock) => clock.clockOut,
      );

      const totalMinutes = completedClockings.reduce(
        (sum, clock) =>
          sum +
          Math.max(0, clock.clockOut.diff(clock.clockIn, "minutes").minutes),
        0,
      );

      const clockIn = employeeClockings[0]?.clockIn || null;

      const clockOut = completedClockings.at(-1)?.clockOut || null;

      const totalHours = formatHours(totalMinutes);

      const netSalary =
        totalSalary - totalAdvances - totalTagFees - totalLateFees;

      /*
       * Prefer a unique customer count when the data contains
       * customer IDs.
       *
       * For walk-in transactions without a customer ID,
       * fall back to the number of service transactions.
       */
      const customerIds = empServices
        .map((service) => service.customer_id ?? service.customerId ?? null)
        .filter(
          (customerId) =>
            customerId !== null &&
            customerId !== undefined &&
            customerId !== "",
        )
        .map(Number)
        .filter(Number.isFinite);

      const uniqueCustomerCount = new Set(customerIds).size;

      const hasCustomerIds = customerIds.length > 0;

      const totalClients = hasCustomerIds
        ? uniqueCustomerCount +
          empServices.filter(
            (service) =>
              service.customer_id == null && service.customerId == null,
          ).length
        : empServices.length;

      return {
        id: employee.id,
        name: getEmployeeName(employee),
        totalClients,
        totalServices: empServices.length,
        totalSalary,
        totalAdvances,
        totalTagFees,
        totalLateFees,
        netSalary,
        totalHours,
        totalMinutes,
        clockIn,
        clockOut,
        serviceCounts,
        gender: getGender(employee),
      };
    });
  }, [visibleEmployees, services, advances, tagFees, lateFees, clockings]);

  /*
   * The service list represents actual service types.
   */
  const metricDefinitions = useMemo(() => {
    if (serviceDefinitions?.length) {
      return serviceDefinitions.map((definition) => ({
        id: String(definition.id),
        label: definition.service_name || definition.name || "Service",
      }));
    }

    return Array.from(
      new Map(
        (services || []).map((service) => {
          const key = getServiceDefinitionId(service);

          return [
            key,
            {
              id: key,
              label: getServiceLabel(service),
            },
          ];
        }),
      ).values(),
    );
  }, [serviceDefinitions, services]);

  /*
   * IMPORTANT:
   *
   * Service totals are calculated from the actual service
   * transactions, NOT by adding employee counts.
   *
   * Therefore:
   *
   * Spartan = 1
   * Shamina = 1
   * Same transaction
   * Service Total = 1
   */
  const serviceTotals = useMemo(() => {
    return metricDefinitions.reduce((acc, definition) => {
      acc[definition.id] = (services || []).filter(
        (service) =>
          getServiceDefinitionId(service) === definition.id &&
          (service.performers || []).some((performer) =>
            visibleEmployees.some(
              (employee) =>
                Number(employee.id) === Number(performer.employee_id),
            ),
          ),
      ).length;

      return acc;
    }, {});
  }, [metricDefinitions, services, visibleEmployees]);

  const totals = useMemo(() => {
    const totalClients = employeeStats.reduce(
      (sum, employee) => sum + employee.totalClients,
      0,
    );

    const totalSalary = employeeStats.reduce(
      (sum, employee) => sum + employee.totalSalary,
      0,
    );

    const totalAdvances = employeeStats.reduce(
      (sum, employee) => sum + employee.totalAdvances,
      0,
    );

    const totalNetSalary = employeeStats.reduce(
      (sum, employee) => sum + employee.netSalary,
      0,
    );

    const totalServices = metricDefinitions.reduce(
      (sum, definition) => sum + Number(serviceTotals[definition.id] || 0),
      0,
    );

    return {
      totalClients,
      totalSalary,
      totalAdvances,
      totalNetSalary,
      totalServices,
    };
  }, [employeeStats, metricDefinitions, serviceTotals]);

  if (!employees.length) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
          👥
        </div>

        <h3 className="mt-4 text-lg font-bold text-slate-800">
          No staff available
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          No staff are available for this report yet.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {/* =========================================================
          HEADER
      ========================================================== */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 px-5 py-6 text-white sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-100">
              Performance overview
            </div>

            <h2 className="text-2xl font-bold tracking-tight">{title}</h2>

            <p className="mt-1 text-sm text-slate-300">
              {periodLabel || "Current period"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-center backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Staff
            </p>

            <p className="mt-1 text-3xl font-bold">{visibleEmployees.length}</p>
          </div>
        </div>

        {/* =========================================================
          GENDER FILTER
      ========================================================== */}
        <section className="bg-slate-900 px-5 py-6">
          <div className="mx-auto flex max-w-xl flex-col items-center text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              View staff by gender
            </p>

            <select
              value={genderFilter}
              onChange={(event) => setGenderFilter(event.target.value)}
              className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
            >
              <option value="all">All Staff</option>

              <option value="male">Male</option>

              <option value="female">Female</option>
            </select>

            <p className="mt-3 text-xs text-slate-400">
              Selecting a gender filters the service, salary and client views
              above. Clocking and attendance remain represented once in the
              report.
            </p>
          </div>
        </section>
      </div>

      {/* =========================================================
          SERVICE PERFORMANCE
      ========================================================== */}
      <section className="border-b border-slate-200">
        <div className="flex flex-col gap-3 border-b border-indigo-100 bg-indigo-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-indigo-950">
              Service Performance
            </h3>

            <p className="mt-0.5 text-sm text-indigo-700/80">
              Services performed by each staff member
            </p>
          </div>

          <div className="rounded-xl bg-white px-4 py-2 text-right shadow-sm ring-1 ring-indigo-100">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-500">
              Total services
            </p>

            <p className="text-2xl font-black text-indigo-700">
              {totals.totalServices}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="sticky left-0 z-20 border-b border-r border-slate-200 bg-slate-100 px-4 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">
                  Service
                </th>

                {employeeStats.map((employee, index) => (
                  <th
                    key={employee.id}
                    className={`border-b border-slate-200 px-4 py-4 text-center ${
                      index % 2 === 0 ? "bg-white" : "bg-slate-50"
                    }`}
                  >
                    <div className="mx-auto max-w-[130px]">
                      <div className="truncate text-sm font-bold text-slate-800">
                        {employee.name}
                      </div>

                      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Staff
                      </div>
                    </div>
                  </th>
                ))}

                <th className="border-b border-slate-200 bg-indigo-100 px-4 py-4 text-center">
                  <div className="text-xs font-black uppercase tracking-wider text-indigo-700">
                    Total
                  </div>
                </th>
              </tr>
            </thead>

            <tbody>
              {metricDefinitions.map((definition, rowIndex) => {
                const serviceTotal = serviceTotals[definition.id] || 0;

                return (
                  <tr
                    key={definition.id}
                    className={
                      rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/70"
                    }
                  >
                    <td className="sticky left-0 z-10 border-b border-r border-slate-100 bg-inherit px-4 py-4 font-semibold text-slate-800">
                      {definition.label}
                    </td>

                    {employeeStats.map((employee) => {
                      const count = employee.serviceCounts[definition.id] || 0;

                      return (
                        <td
                          key={`${employee.id}-${definition.id}`}
                          className="border-b border-slate-100 px-4 py-4 text-center"
                        >
                          <span
                            className={`inline-flex min-w-10 items-center justify-center rounded-xl px-2.5 py-1.5 text-base font-black ${
                              count > 0
                                ? "bg-indigo-100 text-indigo-700"
                                : "text-slate-300"
                            }`}
                          >
                            {count}
                          </span>
                        </td>
                      );
                    })}

                    <td className="border-b border-indigo-100 bg-indigo-50 px-4 py-4 text-center">
                      <span className="inline-flex min-w-12 items-center justify-center rounded-xl bg-indigo-600 px-3 py-1.5 text-base font-black text-white shadow-sm">
                        {serviceTotal}
                      </span>
                    </td>
                  </tr>
                );
              })}

              <tr className="bg-slate-900">
                <td className="sticky left-0 z-10 border-r border-slate-700 bg-slate-900 px-4 py-4 text-xs font-black uppercase tracking-wider text-white">
                  Total Services
                </td>

                {employeeStats.map((employee) => (
                  <td
                    key={`${employee.id}-services-total`}
                    className="px-4 py-4 text-center"
                  >
                    <span className="text-xl font-black text-white">
                      {employee.totalServices}
                    </span>
                  </td>
                ))}

                <td className="bg-indigo-600 px-4 py-4 text-center">
                  <span className="text-xl font-black text-white">
                    {totals.totalServices}
                  </span>
                </td>
              </tr>

              <tr className="bg-emerald-50">
                <td className="sticky left-0 z-10 border-r border-emerald-100 bg-emerald-50 px-4 py-4 text-sm font-bold text-emerald-900">
                  Monthly Salary
                </td>

                {employeeStats.map((employee) => (
                  <td
                    key={`${employee.id}-salary`}
                    className="px-4 py-4 text-center font-semibold text-emerald-800"
                  >
                    {formatMoney(employee.totalSalary)} UGX
                  </td>
                ))}

                <td className="bg-emerald-100 px-4 py-4 text-center font-black text-emerald-900">
                  {formatMoney(totals.totalSalary)} UGX
                </td>
              </tr>

              <tr className="bg-amber-50">
                <td className="sticky left-0 z-10 border-r border-amber-100 bg-amber-50 px-4 py-4 text-sm font-bold text-amber-900">
                  Monthly Advance
                </td>

                {employeeStats.map((employee) => (
                  <td
                    key={`${employee.id}-advance`}
                    className="px-4 py-4 text-center font-semibold text-amber-800"
                  >
                    {formatMoney(employee.totalAdvances)} UGX
                  </td>
                ))}

                <td className="bg-amber-100 px-4 py-4 text-center font-black text-amber-900">
                  {formatMoney(totals.totalAdvances)} UGX
                </td>
              </tr>

              <tr className="bg-emerald-100">
                <td className="sticky left-0 z-10 border-r border-emerald-200 bg-emerald-100 px-4 py-4 text-sm font-black text-emerald-950">
                  Net Monthly Salary
                </td>

                {employeeStats.map((employee) => (
                  <td
                    key={`${employee.id}-net`}
                    className="px-4 py-4 text-center"
                  >
                    <span className="text-base font-black text-emerald-800">
                      {formatMoney(employee.netSalary)} UGX
                    </span>
                  </td>
                ))}

                <td className="bg-emerald-200 px-4 py-4 text-center">
                  <span className="text-base font-black text-emerald-900">
                    {formatMoney(totals.totalNetSalary)} UGX
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* =========================================================
          QUICK FINANCIAL CARDS
      ========================================================== */}
      <section className="grid gap-4 border-b border-slate-200 bg-slate-50 p-5 sm:grid-cols-3">
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-500">
            Total services
          </p>

          <p className="mt-2 text-3xl font-black text-indigo-800">
            {totals.totalServices}
          </p>

          <p className="mt-1 text-xs text-indigo-600">Across selected staff</p>
        </div>

        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-sky-500">
            Staff clients
          </p>

          <p className="mt-2 text-3xl font-black text-sky-800">
            {totals.totalClients}
          </p>

          <p className="mt-1 text-xs text-sky-600">
            Client/service records attributed to staff
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-500">
            Net salary
          </p>

          <p className="mt-2 text-3xl font-black text-emerald-800">
            {formatMoney(totals.totalNetSalary)} UGX
          </p>

          <p className="mt-1 text-xs text-emerald-600">
            After advances and applicable fees
          </p>
        </div>
      </section>

      {/* =========================================================
          CLOCKING
      ========================================================== */}
      <section className="border-b border-slate-200">
        <div className="border-b border-blue-100 bg-blue-50 px-5 py-4">
          <h3 className="text-lg font-bold text-blue-950">
            Clock In / Clock Out
          </h3>

          <p className="mt-0.5 text-sm text-blue-700/80">
            Attendance times for the selected period
          </p>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {employeeStats.map((employee) => (
            <div
              key={employee.id}
              className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-800">
                    {employee.name}
                  </p>

                  <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Attendance
                  </p>
                </div>

                <div className="rounded-xl bg-blue-50 px-3 py-2 text-center">
                  <p className="text-[10px] font-bold uppercase text-blue-500">
                    Hours
                  </p>

                  <p className="text-sm font-black text-blue-800">
                    {employee.totalHours}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                    Clock in
                  </p>

                  <p className="mt-1 text-sm font-bold text-emerald-800">
                    {formatTime(employee.clockIn)}
                  </p>
                </div>

                <div className="rounded-xl bg-rose-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500">
                    Clock out
                  </p>

                  <p className="mt-1 text-sm font-bold text-rose-800">
                    {formatTime(employee.clockOut)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================
          ATTENDANCE SUMMARY
      ========================================================== */}
      <section className="border-b border-slate-200">
        <div className="border-b border-violet-100 bg-violet-50 px-5 py-4">
          <h3 className="text-lg font-bold text-violet-950">
            Attendance Summary
          </h3>

          <p className="mt-0.5 text-sm text-violet-700/80">
            Total recorded working time
          </p>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {employeeStats.map((employee) => (
            <div
              key={employee.id}
              className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="truncate font-semibold text-slate-700">
                  {employee.name}
                </p>

                <span className="rounded-lg bg-violet-100 px-2 py-1 text-xs font-bold text-violet-700">
                  Hours
                </span>
              </div>

              <p className="mt-3 text-3xl font-black text-violet-800">
                {employee.totalHours}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================
          CLIENTS SERVED
      ========================================================== */}
      <section className="border-b border-slate-200">
        <div className="border-b border-fuchsia-100 bg-fuchsia-50 px-5 py-4">
          <h3 className="text-lg font-bold text-fuchsia-950">Clients Served</h3>

          <p className="mt-0.5 text-sm text-fuchsia-700/80">
            Individual staff contribution during this period
          </p>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {employeeStats.map((employee, index) => {
            const cardColors = [
              "border-indigo-100 bg-indigo-50 text-indigo-800",
              "border-emerald-100 bg-emerald-50 text-emerald-800",
              "border-amber-100 bg-amber-50 text-amber-800",
              "border-fuchsia-100 bg-fuchsia-50 text-fuchsia-800",
              "border-sky-100 bg-sky-50 text-sky-800",
              "border-violet-100 bg-violet-50 text-violet-800",
            ];

            const color = cardColors[index % cardColors.length];

            return (
              <div
                key={employee.id}
                className={`rounded-3xl border p-5 shadow-sm ${color}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-black">
                      {employee.name}
                    </p>

                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] opacity-60">
                      Clients served
                    </p>
                  </div>

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80 text-lg shadow-sm">
                    👤
                  </div>
                </div>

                <p className="mt-5 text-5xl font-black tracking-tight">
                  {employee.totalClients}
                </p>

                <p className="mt-2 text-xs font-semibold opacity-70">
                  {employee.totalServices} service
                  {employee.totalServices === 1 ? "" : "s"} performed
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default StaffPerformanceMatrix;
