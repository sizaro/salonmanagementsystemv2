import React, { useMemo } from "react";

const formatTime = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleTimeString("en-UG", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
};

const StaffPerformanceMatrix = ({
  title,
  employees = [],
  services = [],
  serviceDefinitions = [],
  advances = [],
  tagFees = [],
  lateFees = [],
  clockings = [],
  periodLabel = "",
}) => {
  const employeeStats = useMemo(() => {
    return employees.map((employee) => {
      const employeeId = Number(employee.id);
      const empServices = (services || []).filter((service) =>
        service.performers?.some((p) => Number(p.employee_id) === employeeId)
      );

      const serviceCounts = empServices.reduce((acc, service) => {
        const definitionId = service.service_definition_id ?? service.definition_id ?? service.service_name;
        const key = String(definitionId ?? "unknown");
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const totalSalary = empServices.reduce((sum, service) => {
        const employeeRoleAmount = (service.performers || []).reduce((roleSum, performer) => {
          if (Number(performer.employee_id) === employeeId) {
            return roleSum + Number(performer.role_amount || 0);
          }
          return roleSum;
        }, 0);
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

      const clockEntry = (clockings || []).find((clock) => Number(clock.employee_id) === employeeId);
      const clockIn = clockEntry?.clock_in ? new Date(clockEntry.clock_in) : null;
      const clockOut = clockEntry?.clock_out ? new Date(clockEntry.clock_out) : null;

      const totalHours = clockIn && clockOut
        ? ((clockOut - clockIn) / 36e5).toFixed(2)
        : "-";

      const netSalary = totalSalary - totalAdvances - totalTagFees - totalLateFees;

      return {
        id: employee.id,
        name: `${employee.first_name || ""} ${employee.last_name || ""}`.trim(),
        totalClients: empServices.length,
        totalSalary,
        totalAdvances,
        totalTagFees,
        totalLateFees,
        netSalary,
        totalHours,
        clockIn,
        clockOut,
        serviceCounts,
      };
    });
  }, [employees, services, advances, tagFees, lateFees, clockings]);

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
          const key = String(service.service_definition_id ?? service.definition_id ?? service.service_name ?? "unknown");
          return [key, { id: key, label: service.service_name || "Service" }];
        })
      ).values()
    );
  }, [serviceDefinitions, services]);

  const totals = useMemo(() => {
    const totalClients = employeeStats.reduce((sum, employee) => sum + employee.totalClients, 0);
    const totalSalary = employeeStats.reduce((sum, employee) => sum + employee.totalSalary, 0);
    const totalAdvances = employeeStats.reduce((sum, employee) => sum + employee.totalAdvances, 0);
    const totalNetSalary = employeeStats.reduce((sum, employee) => sum + employee.netSalary, 0);

    return {
      totalClients,
      totalSalary,
      totalAdvances,
      totalNetSalary,
    };
  }, [employeeStats]);

  if (!employees.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        No staff available for this section yet.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <p className="text-sm text-slate-500">{periodLabel || "Current period"}</p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
          {employees.length} staff
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-700">
              <th className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-3 font-semibold">Metric</th>
              {employeeStats.map((employee) => (
                <th key={employee.id} className="border-b border-slate-200 px-3 py-3 font-semibold text-slate-700">
                  {employee.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metricDefinitions.map((definition) => (
              <tr key={definition.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                <td className="sticky left-0 z-10 border-r border-slate-100 bg-white px-3 py-3 font-medium text-slate-700">
                  {definition.label}
                </td>
                {employeeStats.map((employee) => (
                  <td key={`${employee.id}-${definition.id}`} className="px-3 py-3 text-center text-slate-700">
                    {employee.serviceCounts[definition.id] || 0}
                  </td>
                ))}
              </tr>
            ))}

            <tr className="border-b border-slate-100 bg-slate-50/80">
              <td className="sticky left-0 z-10 border-r border-slate-100 bg-slate-50/80 px-3 py-3 font-semibold text-slate-700">
                Total Clients
              </td>
              {employeeStats.map((employee) => (
                <td key={`${employee.id}-clients`} className="px-3 py-3 text-center font-semibold text-slate-800">
                  {employee.totalClients}
                </td>
              ))}
            </tr>

            <tr className="border-b border-slate-100">
              <td className="sticky left-0 z-10 border-r border-slate-100 bg-white px-3 py-3 font-medium text-slate-700">
                Monthly Salary
              </td>
              {employeeStats.map((employee) => (
                <td key={`${employee.id}-salary`} className="px-3 py-3 text-center text-slate-700">
                  {employee.totalSalary.toLocaleString()} UGX
                </td>
              ))}
            </tr>

            <tr className="border-b border-slate-100">
              <td className="sticky left-0 z-10 border-r border-slate-100 bg-white px-3 py-3 font-medium text-slate-700">
                Monthly Advance
              </td>
              {employeeStats.map((employee) => (
                <td key={`${employee.id}-advance`} className="px-3 py-3 text-center text-slate-700">
                  {employee.totalAdvances.toLocaleString()} UGX
                </td>
              ))}
            </tr>

            <tr className="border-b border-slate-100 bg-emerald-50/70">
              <td className="sticky left-0 z-10 border-r border-slate-100 bg-emerald-50/70 px-3 py-3 font-semibold text-slate-700">
                Net Monthly Salary
              </td>
              {employeeStats.map((employee) => (
                <td key={`${employee.id}-net`} className="px-3 py-3 text-center font-semibold text-emerald-700">
                  {employee.netSalary.toLocaleString()} UGX
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 border-t border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total clients</p>
          <p className="mt-1 text-xl font-semibold text-slate-800">{totals.totalClients}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total salary</p>
          <p className="mt-1 text-xl font-semibold text-slate-800">{totals.totalSalary.toLocaleString()} UGX</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Net salary</p>
          <p className="mt-1 text-xl font-semibold text-emerald-700">{totals.totalNetSalary.toLocaleString()} UGX</p>
        </div>
      </div>

      <div className="border-t border-slate-200 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-slate-700">Clock In / Clock Out</h4>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              {employeeStats.map((employee) => (
                <div key={employee.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-medium text-slate-700">{employee.name}</span>
                  <span>
                    {formatTime(employee.clockIn)} / {formatTime(employee.clockOut)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-slate-700">Attendance Summary</h4>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              {employeeStats.map((employee) => (
                <div key={employee.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-medium text-slate-700">{employee.name}</span>
                  <span>{employee.totalHours} hrs</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffPerformanceMatrix;
