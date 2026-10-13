import { useEffect } from "react";
import { useData } from "../../context/DataContext.jsx";
import { useNavigate } from "react-router-dom";
import EmployeeDirectoryTable from "../../components/workspace/EmployeeDirectoryTable.jsx";

const ManagerEmployees = () => {
  const {
    users = [],
    fetchUsers,
  } = useData();
  const navigate = useNavigate();

  const employees = users.filter(
    (user) =>user.role !== "customer"
  );

  useEffect(() => {
    fetchUsers();
    // DataContext recreates this function when shared data changes.
    // Load the directory when this page mounts rather than on every refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div><p className="workspace-section-kicker">Team management</p><h1>Employees</h1><p>Browse the team and open the profile for the permitted work history and finance details.</p></div>
      </header>
      <EmployeeDirectoryTable employees={employees} onView={(id) => navigate(`/manager/employees/${id}`)} />

    </div>
  );
};

export default ManagerEmployees;
