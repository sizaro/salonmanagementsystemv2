import React from "react";
import StaffPerformanceMatrix from "./StaffPerformanceMatrix.jsx";

const StaffGenderPerformanceSection = ({
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
  return (
    <StaffPerformanceMatrix
      title={title}
      employees={employees}
      services={services}
      serviceDefinitions={serviceDefinitions}
      advances={advances}
      tagFees={tagFees}
      lateFees={lateFees}
      clockings={clockings}
      periodLabel={periodLabel}
    />
  );
};

export default StaffGenderPerformanceSection;
