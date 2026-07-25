import React from "react";
import StaffPerformanceMatrix from "./StaffPerformanceMatrix.jsx";

const StaffGenderPerformanceSection = ({
  gender,
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
  const genderLabel = title || `${gender === "male" ? "Male" : "Female"} Staff Performance`;

  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{genderLabel}</h2>
          <p className="text-sm text-slate-600">
            {employees.length
              ? `${employees.length} staff member${employees.length === 1 ? "" : "s"} included`
              : `No ${gender} staff assigned yet.`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white px-3 py-2 text-slate-700 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Employees</p>
            <p className="mt-1 text-lg font-semibold">{employees.length}</p>
          </div>
          <div className="rounded-2xl bg-white px-3 py-2 text-slate-700 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Period</p>
            <p className="mt-1 text-sm font-medium text-slate-800">{periodLabel || "Current"}</p>
          </div>
        </div>
      </div>

      <StaffPerformanceMatrix
        title={genderLabel}
        employees={employees}
        services={services}
        serviceDefinitions={serviceDefinitions}
        advances={advances}
        tagFees={tagFees}
        lateFees={lateFees}
        clockings={clockings}
        periodLabel={periodLabel}
      />
    </section>
  );
};

export default StaffGenderPerformanceSection;
