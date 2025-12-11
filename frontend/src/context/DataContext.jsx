import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";



const DataContext = createContext();


export const DataProvider = ({ children }) => {
  const [services, setServices] = useState([]);
  const [users, setUsers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [clockings, setClockings] = useState([]);
  const [lateFees, setLateFees] = useState([]);
  const [tagFees, setTagFees] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false); // Only used for fetchUsers
  const [user, setUser] = useState(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [sections, setSections] = useState([]);
  const [serviceDefinitions, setServiceDefinitions] = useState([]);
  const [serviceRoles, setServiceRoles] = useState([]);
  const [serviceMaterials, setServiceMaterials] = useState([]);
const [transactions, setTransactions] = useState([]);

const pendingAppointments = useMemo(() => {
  return transactions.filter(s => s.status === "pending");
}, [transactions]);


const pendingCount = pendingAppointments.length;


  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_API_URL || "/api";

  const socket = io(API_URL.replace("/api", ""), {
  transports: ["websocket"],
  secure: true
});

  // ---------- Fetch All ----------
  const fetchAllData = async () => {
    try {
      const [clockingsRes, servicesRes] = await Promise.all([
        axios.get(`${API_URL}/clockings`),
        axios.get(`${API_URL}/services/service_transactions`),
      ]);
      setClockings(clockingsRes.data);
      setServices(servicesRes.data);
      console.log("all services in the data context:", servicesRes.data);
    } catch (err) {
      console.error("Error fetching static data:", err);
    }
  };

  // ---------- Fetch Sessions ----------
  const fetchSessions = async () => {
    try {
      const res = await axios.get(`${API_URL}/sessions`);
      setSessions(res.data);
    } catch (err) {
      console.error("Error fetching sessions:", err);
    }
  };


  

  // ---------- Reports ----------
  const fetchDailyData = async (date) => {
    try {
      const formatDate = (d) => new Date(d).toISOString().split("T")[0];
      const res = await axios.get(`${API_URL}/reports/daily`, {
        params: { date: formatDate(date) },
      });
      const data = res.data;

      setServices(data.services);
      console.log("service transactions in daily context", data.services)
      setExpenses(data.expenses);
      setAdvances(data.advances);
      console.log("advances in daily context", data.advances)
      setClockings(data.clockings);
      console.log("clockings in daily context", data.clockings)
      setUsers(data.users);
      setTagFees(data.tagFees);
      setLateFees(data.lateFees);
      return data;
    } catch (err) {
      console.error("Error fetching daily report:", err);
      throw err;
    }
  };

  const fetchWeeklyData = async (start, end) => {
    try {
      const formatDate = (date) => date.toISOString().split("T")[0];
      const res = await axios.get(`${API_URL}/reports/weekly`, {
        params: { startDate: formatDate(start), endDate: formatDate(end) },
      });
      const data = res.data;
      setServices(data.services);
      console.log("service transactions in daily context", data.services)
      setExpenses(data.expenses);
      setAdvances(data.advances);
      console.log("clockings in daily context", data.clockings)
      setUsers(data.users);
      setTagFees(data.tagFees);
      setLateFees(data.lateFees);
      return data;
    } catch (err) {
      console.error("Error fetching weekly report:", err);
    }
  };

  const fetchMonthlyData = async (year, month) => {
    try {
      const res = await axios.get(`${API_URL}/reports/monthly`, {
        params: { year, month },
      });
      const data = res.data;
      setServices(data.services);
      setExpenses(data.expenses);
      setAdvances(data.advances);
      setUsers(data.users);
      setTagFees(data.tagFees);
      setLateFees(data.lateFees);
      return data;
    } catch (err) {
      console.error("Error fetching monthly report:", err);
      throw err;
    }
  };

  const fetchYearlyData = async (year) => {
    try {
      const res = await axios.get(`${API_URL}/reports/yearly`, { params: { year } });
      const data = res.data;
      setServices(data.services);
      setExpenses(data.expenses);
      setAdvances(data.advances);
      setUsers(data.users);
      setTagFees(data.tagFees);
      setLateFees(data.lateFees);
      return data;
    } catch (err) {
      console.error("Error fetching yearly report:", err);
    }
  };

  // ---------- Services CRUD ----------
  const fetchServiceById = async (id) => {
    try {
      const res = await axios.get(`${API_URL}/services/${id}`);
      return res.data;
    } catch (err) {
      console.error("Error fetching service by ID:", err);
      throw err;
    }
  };

  const updateService = async (id, formData) => {
    try {
      const res = await axios.put(`${API_URL}/services/${id}`, formData);
      await fetchAllData();
      return res.data;
    } catch (err) {
      console.error("Error updating service:", err);
      throw err;
    }
  };

  const updateServicet = async (id, formData) => {
    try {
      const res = await axios.put(`${API_URL}/servicet/${id}`, formData);
      await fetchAllData();
      return res.data;
    } catch (err) {
      console.error("Error updating service:", err);
      throw err;
    }
  };

  const deleteService = async (id) => {
    try {
      await axios.delete(`${API_URL}/services/${id}`);
      await fetchAllData();
    } catch (err) {
      console.error("Error deleting service:", err);
      throw err;
    }
  };


  // ---------- Employees CRUD ----------
  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/users`);
      setUsers(res.data);
      console.log("users in context:", res.data);
      return res.data;
    } catch (err) {
      console.error("Error fetching employees:", err);
      throw err;
  };}

  const fetchUserById = async (id) => {
    try {
      const res = await axios.get(`${API_URL}/users/${id}`);
      return res.data;
    } catch (err) {
      console.error("Error fetching employee by ID:", err);
      throw err;
    }
  };

  const createUser = async (userData) => {
    try {
      const res = await axios.post(`${API_URL}/users`, userData);
      await fetchUsers(); // ✅ fetchUsers handles loading
      return res.data;
    } catch (err) {
      console.error(`error creating ${userData.role}`, err);
      throw err;
    }
  };

  const updateUser = async (id, userData) => {
    try {
      const res = await axios.put(`${API_URL}/users/${id}`, userData);
      await fetchUsers();
      return res.data;
    } catch (err) {
      console.error(`error updating ${userData.role}`, err);
      throw err;
    }
  };

  const deleteUser = async (id) => {
    try {
      await axios.delete(`${API_URL}/users/${id}`);
      await fetchUsers();
    } catch (err) {
      console.error(`error deleting user`, err);
      throw err;
    }
  };

  // ---------- Advances ----------
  const fetchAdvances = async () => {
    try {
      const res = await axios.get(`${API_URL}/advances`);
      setAdvances(res.data);
      return res.data;
    } catch (err) {
      console.error("Error fetching advances:", err);
      throw err;
    }
  };

  const fetchAdvanceById = async (id) => {
    try {
      const res = await axios.get(`${API_URL}/advances/${id}`);
      return res.data;
    } catch (err) {
      console.error("Error fetching advance by ID:", err);
      throw err;
    }
  };

  const createAdvance = async (advanceData) => {
    try {
      const res = await axios.post(`${API_URL}/advances`, advanceData);
      await fetchAdvances();
      return res.data;
    } catch (err) {
      console.error("Error creating advance:", err);
      throw err;
    }
  };

  const updateAdvance = async (id, advanceData) => {
    try {
      const res = await axios.put(`${API_URL}/advances/${id}`, advanceData);
      await fetchAdvances();
      return res.data;
    } catch (err) {
      console.error("Error updating advance:", err);
      throw err;
    }
  };

  const deleteAdvance = async (id) => {
    try {
      await axios.delete(`${API_URL}/advances/${id}`);
      await fetchAdvances();
    } catch (err) {
      console.error("Error deleting advance:", err);
      throw err;
    }
  };

  // ---------- Expenses ----------
  const fetchExpenses = async () => {
    try {
      const res = await axios.get(`${API_URL}/expenses`);
      setExpenses(res.data);
      return res.data;
    } catch (err) {
      console.error("Error fetching expenses:", err);
      throw err;
    }
  };

  const fetchExpenseById = async (id) => {
    try {
      const res = await axios.get(`${API_URL}/expenses/${id}`);
      return res.data;
    } catch (err) {
      console.error("Error fetching expense by ID:", err);
      throw err;
    }
  };

  const createExpense = async (expenseData) => {
    try {
      const res = await axios.post(`${API_URL}/expenses`, expenseData);
      await fetchExpenses();
      return res.data;
    } catch (err) {
      console.error("Error creating expense:", err);
      throw err;
    }
  };

  const updateExpense = async (id, expenseData) => {
    try {
      const res = await axios.put(`${API_URL}/expenses/${id}`, expenseData);
      await fetchExpenses();
      return res.data;
    } catch (err) {
      console.error("Error updating expense:", err);
      throw err;
    }
  };

  const deleteExpense = async (id) => {
    try {
      await axios.delete(`${API_URL}/expenses/${id}`);
      await fetchExpenses();
    } catch (err) {
      console.error("Error deleting expense:", err);
      throw err;
    }
  };

  // ---------- Late Fees ----------
  const fetchLateFees = async () => {
    try {
      const res = await axios.get(`${API_URL}/fees/late_fees`);
      setLateFees(res.data);
      return res.data;
    } catch (err) {
      console.error("Error fetching late fees:", err);
      throw err;
    }
  };

  const fetchLateFeeById = async (id) => {
    try {
      const res = await axios.get(`${API_URL}/fees/late_fees/${id}`);
      return res.data;
    } catch (err) {
      console.error("Error fetching late fee by ID:", err);
      throw err;
    }
  };

  const createLateFee = async (lateFeeData) => {
    try {
      const res = await axios.post(`${API_URL}/fees/late_fees`, lateFeeData);
      await fetchLateFees();
      return res.data;
    } catch (err) {
      console.error("Error creating late fee:", err);
      throw err;
    }
  };

  const updateLateFee = async (id, lateFeeData) => {
    try {
      const res = await axios.put(`${API_URL}/fees/late_fees/${id}`, lateFeeData);
      await fetchLateFees();
      return res.data;
    } catch (err) {
      console.error("Error updating late fee:", err);
      throw err;
    }
  };

  const deleteLateFee = async (id) => {
    try {
      await axios.delete(`${API_URL}/fees/late_fees/${id}`);
      await fetchLateFees();
    } catch (err) {
      console.error("Error deleting late fee:", err);
      throw err;
    }
  };

  // ---------- Tag Fees ----------
  const fetchTagFees = async () => {
    try {
      const res = await axios.get(`${API_URL}/fees/tag`);
      setTagFees(res.data);
      return res.data;
    } catch (err) {
      console.error("Error fetching tag fees:", err);
      throw err;
    }
  };

  const fetchTagFeeById = async (id) => {
    try {
      const res = await axios.get(`${API_URL}/fees/tag/${id}`);
      return res.data;
    } catch (err) {
      console.error("Error fetching tag fee by ID:", err);
      throw err;
    }
  };

  const createTagFee = async (tagFeeData) => {
    try {
      const res = await axios.post(`${API_URL}/fees/tag_fees`, tagFeeData);
      await fetchTagFees();
      return res.data;
    } catch (err) {
      console.error("Error creating tag fee:", err);
      throw err;
    }
  };

  const updateTagFee = async (id, tagFeeData) => {
    try {
      const res = await axios.put(`${API_URL}/fees/tag/${id}`, tagFeeData);
      await fetchTagFees();
      return res.data;
    } catch (err) {
      console.error("Error updating tag fee:", err);
      throw err;
    }
  };

  const deleteTagFee = async (id) => {
    try {
      await axios.delete(`${API_URL}/fees/tag/${id}`);
      await fetchTagFees();
    } catch (err) {
      console.error("Error deleting tag fee:", err);
      throw err;
    }
  };


  // fetch sections

    const fetchSections = async () => {
    try {
      const res = await axios.get(`${API_URL}/sections`);
      setSections(res.data);
      console.log("sections:", res.data);
      return res.data;
    } catch (err) {
      console.error("Error fetching sections:", err);
      throw err;
    }
  };

  // ---------- Sections CRUD ----------

const createSection = async (sectionData) => {
  try {
    const res = await axios.post(`${API_URL}/sections/create`, sectionData);
    await fetchSections();
    return res.data;
  } catch (err) {
    console.error("Error creating section:", err);
    throw err;
  }
};

const updateSection = async (id, sectionData) => {
  try {
    const res = await axios.put(`${API_URL}/sections/${id}`, sectionData);
    await fetchSections();
    return res.data;
  } catch (err) {
    console.error("Error updating section:", err);
    throw err;
  }
};

const deleteSection = async (id) => {
  try {
    await axios.delete(`${API_URL}/sections/${id}`);
    await fetchSections();
  } catch (err) {
    console.error("Error deleting section:", err);
    throw err;
  }
};



  //fetch service definitions

    const fetchServiceDefinitions = async () => {
    try {
      const res = await axios.get(`${API_URL}/services/service_definitions`);
      setServiceDefinitions(res.data.data);
      console.log("service definitions in context:", res.data.data);
      return res.data.data;
    } catch (err) {
      console.error("Error fetching service definitions:", err);
      throw err;
    }
  };


  const fetchServiceDefinitionById = async (id) => {
  try {
    if (!id) throw new Error("Service definition ID is required");
    const res = await axios.get(`${API_URL}/services/service_definitions/${id}`);
    console.log(`Service definition ${id}:`, res.data.data);
    return res.data.data; // returns the single service definition object
  } catch (err) {
    console.error(`Error fetching service definition with ID ${id}:`, err);
    throw err;
  }
};


  // ---------- CREATE SERVICE DEFINITION ----------
const createServiceDefinition = async (serviceData) => {
  try {
    const res = await axios.post(`${API_URL}/services/service_definitions/create`, serviceData);
    await fetchServiceDefinitions();
    await fetchServiceRoles()
    return res.data;
  } catch (err) {
    console.error("Error creating service definition:", err);
    throw err;
  }
};

// ---------- UPDATE SERVICE DEFINITION ----------
const updateServiceDefinition = async (id, serviceData) => {
  try {
    const res = await axios.put(`${API_URL}/services/service_definitions/${id}`, serviceData);
    await fetchServiceDefinitions(); // refresh after update
    return res.data;
  } catch (err) {
    console.error("Error updating service definition:", err);
    throw err;
  }
};

// ---------- DELETE SERVICE DEFINITION ----------
const deleteServiceDefinition = async (id) => {
  try {
    await axios.delete(`${API_URL}/services/service_definitions/${id}`);
    await fetchServiceDefinitions(); // refresh after deletion
  } catch (err) {
    console.error("Error deleting service definition:", err);
    throw err;
  }
};


  // fetch service roles

    const fetchServiceRoles = async () => {
    try {
      const res = await axios.get(`${API_URL}/services/service_roles`);
      setServiceRoles(res.data.data);
      console.log("service roles:", res.data.data);
      return res.data.data;
    } catch (err) {
      console.error("Error fetching service roles:", err);
      throw err;
    }
  };


  // fetch service materials
const fetchServiceMaterials = async () => {
  try {
    const res = await axios.get(`${API_URL}/services/service_materials`);
    setServiceMaterials(res.data.data);
    console.log("service materials:", res.data.data);
    return res.data.data;
  } catch (err) {
    console.error("Error fetching service materials:", err);
    throw err;
  }
};



  //insert service transactions and performers
// ---------- CREATE ----------
const createServiceTransaction = async (payload) => {
  try {
    const res = await axios.post(`${API_URL}/services/service_transactions`, payload);
    await fetchServiceTransactions(); // refresh list
    return res.data;
  } catch (err) {
    console.error("Error creating service transaction:", err);
    throw err;
  }
};

// ---------- UPDATE ----------
const updateServiceTransactionById = async (id, payload) => {
  try {
    const res = await axios.put(`${API_URL}/services/service_transactions/${id}`, payload);
    await fetchServiceTransactions(); // refresh list
    return res.data;
  } catch (err) {
    console.error("Error updating service transaction:", err);
    throw err;
  }
};

// ---------- UPDATE APPOINTMENT ----------
const updateServiceTransactionAppointment = async (id, payload) => {
  try {
    const res = await axios.put(`${API_URL}/services/service_transactions_appointment/${id}`, payload);
    await fetchServiceTransactions(); // refresh list
    return res.data;
  } catch (err) {
    console.error("Error updating service transaction:", err);
    throw err;
  }
};

// ---------- FETCH ALL ----------
const fetchServiceTransactions = async () => {
  try {
    const res = await axios.get(`${API_URL}/services/service_transactions`);
    setServices(res.data.data);
    console.log("service transactions in the data context", res.data.data)
    return res.data;
  } catch (err) {
    console.error("Error fetching service transactions:", err);
    throw err;
  }
};

const fetchServiceTransactionsApp = async () => {
  try {
    const res = await axios.get(`${API_URL}/services/service_transactions`);
    setTransactions(res.data.data);
    console.log("service transactions in the data context", res.data.data)
    return res.data.data;
  } catch (err) {
    console.error("Error fetching service transactions:", err);
    throw err;
  }
};

// ---------- FETCH SINGLE ----------
const fetchServiceTransactionById = async (id) => {
  try {
    const res = await axios.get(`${API_URL}/services/service_transactions/${id}`);
    return res.data.data;
  } catch (err) {
    console.error("Error fetching transaction by ID:", err);
    throw err;
  }
};

const deleteServiceTransaction = async (id) => {
  try {
    await axios.delete(`${API_URL}/services/service_transactions/${id}`);
    await fetchServiceDefinitions(); // refresh after deletion
  } catch (err) {
    console.error("Error deleting service transaction:", err);
    throw err;
  }
};


  // ---------- Auth ----------
  const loginUser = async (credentials) => {
    try {
      const res = await axios.post(`${API_URL}/auth/login`, credentials, {
        withCredentials: true,
      });
      const { user } = res.data;
      setUser(user);

      if (!user) {
        throw new Error("Invalid login response — user missing");
      }

      return user;
    } catch (err) {
      console.error("Error during loginUser:", err);
      throw err;
    }
  };

  const checkAuth = async () => {
    try {
      const res = await axios.get(`${API_URL}/auth/check`, {
        withCredentials: true,
      });
      setUser(res.data.user);
    } catch (err) {
      setUser(null);
      console.error("Auth check failed:", err);
      navigate("/");
    }
  };

  const logoutUser = async () => {
    try {
      await axios.post(`${API_URL}/auth/logout`, {}, { withCredentials: true });
    } catch (err) {
      console.error("Error during logout:", err);
    } finally {
      setUser(null);
      navigate("/");
    }
  };


  // inside DataProvider

const forgotPassword = async (email) => {
  try {
    setLoading(true);
    const res = await axios.post(`${API_URL}/auth/forgot-password`, { email });
    setLoading(false);
    return { success: true, message: res.data.message };
  } catch (err) {
    setLoading(false);
    console.error("Error sending password reset email:", err);
    return { success: false, message: err.response?.data?.message || "Server error" };
  }
};


const resetPassword = async (payload) => {
  try {
    setLoading(true);
    const res = await axios.post(`${API_URL}/auth/reset-password`, payload);
    setLoading(false);
    return { success: true, message: res.data.message };
  } catch (err) {
    setLoading(false);
    console.error("Error resetting password:", err);
    return { success: false, message: err.response?.data?.message || "Server error" };
  }
};

  // ---------- Send Form ----------
  const sendFormData = async (formIdentifier, formData) => {
    try {
      let res;
      switch (formIdentifier) {
        case "createService":
          res = await axios.post(`${API_URL}/services`, formData);
          await fetchAllData();
          break;
        case "createAdvance":
          res = await axios.post(`${API_URL}/advances`, formData);
          await fetchAllData();
          break;
        case "createExpense":
          res = await axios.post(`${API_URL}/expenses`, formData);
          await fetchAllData();
          break;
        case "createClocking":
          res = await axios.post(`${API_URL}/clockings`, formData,);
          await fetchAllData();
          break;
        case "updateClocking":
          res = await axios.put(`${API_URL}/clockings`, formData);
          await fetchAllData();
          break;
        case "openSalon":
        case "closeSalon":
          res =
            formIdentifier === "openSalon"
              ? await axios.post(`${API_URL}/sessions`, formData,  { withCredentials: true })
              : await axios.put(`${API_URL}/sessions`, formData,  { withCredentials: true });
          await fetchSessions();
          break;
        default:
          throw new Error("Unknown form identifier: " + formIdentifier);
      }

      return res.data;
    } catch (err) {
      console.error(`Error in sendFormData for ${formIdentifier}:`, err);
      throw err;
    }
  };

  // ---------- useEffect ----------
useEffect(() => {
  const initializeApp = async () => {
    try {
      fetchSessions(); // fetch sessions in background
    } catch (err) {
      console.error("Error initializing app:", err);
    }
  };

  const transactionData = async () => {
    try {
      await Promise.all([
        fetchSections(),
        fetchServiceDefinitions(),
        fetchServiceRoles(),
        fetchUsers(),
        fetchServiceTransactions(),
        fetchServiceMaterials(),
      ]);
    } catch (err) {
      console.error("Error fetching transaction data:", err);
    }
  };

  // --- initialize all data ---
  initializeApp();
  transactionData();

  const interval = setInterval(fetchSessions, 60 * 1000); 
  return () => clearInterval(interval);

}, []);


  useEffect(()=>{
    checkAuth();
  }, [])

  useEffect(()=>{
    fetchServiceTransactionsApp();
  }, [])



  useEffect(() => {
  // Listen for new appointments
  socket.on("appointment_created", (payload) => {
    console.log("Appointment received via socket:", payload);
    fetchServiceTransactionsApp();
  });

  return () => {
    socket.off("appointment_created");
  };
}, []);

  // ---------- Export ----------
  return (
    <DataContext.Provider
      value={{
        user,
        services,
        users,
        expenses,
        advances,
        clockings,
        sessions,
        loading,
        lateFees,
        tagFees,
        isDataLoaded,
        sections,
        sections,
        serviceDefinitions,
        serviceRoles,
        serviceMaterials,
        pendingAppointments,
        pendingCount,
        fetchServiceRoles,
        fetchServiceMaterials,
        fetchSections,
        createSection,
        updateSection,
        deleteSection,
        fetchServiceDefinitions,
        fetchServiceDefinitionById,
        createServiceDefinition,
        deleteServiceDefinition,
        updateServiceDefinition,
        fetchServiceRoles,
        createServiceTransaction,
        fetchServiceTransactions,
        fetchServiceTransactionsApp,
        fetchServiceTransactionById,
        updateServiceTransactionById,
        updateServiceTransactionAppointment,
        deleteServiceTransaction,
        fetchAllData,
        sendFormData,
        fetchDailyData,
        fetchWeeklyData,
        fetchMonthlyData,
        fetchYearlyData,
        fetchServiceById,
        updateService,
        updateServicet,
        deleteService,
        fetchUsers,
        fetchUserById,
        createUser,
        updateUser,
        deleteUser,
        fetchAdvances,
        fetchAdvanceById,
        createAdvance,
        updateAdvance,
        deleteAdvance,
        fetchExpenses,
        fetchExpenseById,
        createExpense,
        updateExpense,
        deleteExpense,
        loginUser,
        checkAuth,
        logoutUser,
        fetchLateFeeById,
        fetchLateFees,
        createLateFee,
        updateLateFee,
        deleteLateFee,
        fetchTagFees,
        fetchTagFeeById,
        createTagFee,
        updateTagFee,
        deleteTagFee,
        forgotPassword,
        resetPassword
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);
