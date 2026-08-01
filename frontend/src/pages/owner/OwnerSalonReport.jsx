import React, { useEffect, useMemo, useState } from "react";
import { useData } from "../../context/DataContext.jsx";
import useOwnerReport from "../../hooks/useOwnerReport.js";

// ===============================
// DATE HELPERS
// ===============================

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDateLabel = (value) => {
  if (!value) return "";

  return new Date(value).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

// ===============================
// WEEK RANGE HELPER
// ===============================

const getWeekRange = (weekString) => {
  const [year, weekNumber] = weekString.split("-W").map(Number);

  const firstDayOfYear = new Date(year, 0, 1);

  const dayOfWeek = firstDayOfYear.getDay();

  const diff = dayOfWeek <= 4 ? dayOfWeek - 1 : dayOfWeek - 8;

  const firstMonday = new Date(firstDayOfYear);

  firstMonday.setDate(firstDayOfYear.getDate() - diff);

  const monday = new Date(firstMonday);

  monday.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);

  const sunday = new Date(monday);

  sunday.setDate(monday.getDate() + 6);

  return {
    monday,
    sunday,
  };
};

// ===============================
// SESSION DURATION CALCULATOR
// ===============================

const calculateSessionDuration = (session) => {
  if (!session?.open_date || !session?.open_time) {
    return {
      hours: 0,
      minutes: 0,
      totalMinutes: 0,
    };
  }

  const openedAt = new Date(`${session.open_date}T${session.open_time}`);

  let closedAt;

  if (session.close_date && session.close_time) {
    closedAt = new Date(`${session.close_date}T${session.close_time}`);
  } else {
    // still open
    closedAt = new Date();
  }

  const difference = closedAt.getTime() - openedAt.getTime();

  const totalMinutes = Math.max(0, Math.floor(difference / (1000 * 60)));

  return {
    hours: Math.floor(totalMinutes / 60),

    minutes: totalMinutes % 60,

    totalMinutes,
  };
};

// ===============================
// TOTAL HOURS FROM SESSIONS
// ===============================

const calculateTotalMinutes = (sessions = []) => {
  return sessions.reduce((total, session) => {
    const duration = calculateSessionDuration(session);

    return total + duration.totalMinutes;
  }, 0);
};

// ===============================
// AVERAGE OPENING HOURS
// ===============================

const calculateAverageHours = (sessions = []) => {
  if (!sessions.length) {
    return {
      hours: 0,
      minutes: 0,
    };
  }

  const totalMinutes = calculateTotalMinutes(sessions);

  const averageMinutes = Math.floor(totalMinutes / sessions.length);

  return {
    hours: Math.floor(averageMinutes / 60),

    minutes: averageMinutes % 60,
  };
};

// ===============================
// FILTER SESSIONS BY RANGE
// ===============================

const filterSessionsByDate = (sessions, startDate, endDate) => {
  if (!sessions?.length) return [];

  return sessions.filter((session) => {
    if (!session.open_date) return false;

    const sessionDate = new Date(session.open_date);

    return sessionDate >= startDate && sessionDate <= endDate;
  });
};

// ===============================
// COMPONENT
// ===============================

export default function OwnerSalonReport() {
  const {
    fetchSessions,
  } = useData();
  const { report, fetchDailyData, fetchWeeklyData, fetchMonthlyData, fetchYearlyData } = useOwnerReport();
  const sessions = report?.sessions ?? [];

  // ===============================
  // STATES
  // ===============================

  const today = new Date();

  const [selectedDate, setSelectedDate] = useState(formatDateInput(today));

  const [monthYear, setMonthYear] = useState("");

  const [year, setYear] = useState(today.getFullYear());

  const [reportLabel, setReportLabel] = useState(
    `Salon report for ${formatDateLabel(today)}`,
  );

  const [reportSessions, setReportSessions] = useState(null);

  // ===============================
  // LOAD DATA
  // ===============================

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const data = await fetchDailyData(selectedDate);

        setReportSessions(Array.isArray(data?.sessions) ? data.sessions : []);
      } catch (error) {
        console.error(
          "Failed to load default daily salon report sessions:",
          error,
        );

        fetchSessions();
      }
    };

    loadInitialData();
  }, []);

  // ===============================
  // CURRENT SESSION
  // ===============================
  // ===============================
  // NORMALIZE SESSION DATA
  // ===============================

  /*
    fetchSessions may currently return either:

    1. A single current session object
       {
         id: 66,
         status: "open",
         open_date: "2026-07-27",
         open_time: "23:25:02"
       }

    2. An array of historical sessions
       [
         {...},
         {...}
       ]

    This ensures the rest of this page always works with an array.
  */

  const normalizeSessions = (sessionsValue) => {
    if (Array.isArray(sessionsValue)) {
      return sessionsValue;
    }

    if (
      sessionsValue &&
      typeof sessionsValue === "object" &&
      sessionsValue.id
    ) {
      return [sessionsValue];
    }

    return [];
  };

  const salonSessions = useMemo(() => {
    if (reportSessions !== null) {
      return normalizeSessions(reportSessions);
    }

    return normalizeSessions(sessions);
  }, [reportSessions, sessions]);

  console.log("Salon sessions normalized:", salonSessions);

  // ===============================
  // ADDITIONAL FILTER STATES
  // ===============================

  const [selectedWeek, setSelectedWeek] = useState("");

  const [selectedPeriod, setSelectedPeriod] = useState("day");

  // ===============================
  // DATE AND TIME FORMATTERS
  // ===============================

  const formatSessionDate = (dateValue) => {
    if (!dateValue) return "N/A";

    const [dateYear, dateMonth, dateDay] = dateValue.split("-").map(Number);

    const date = new Date(dateYear, dateMonth - 1, dateDay);

    return date.toLocaleDateString("en-UG", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime12Hour = (timeValue) => {
    if (!timeValue) return "N/A";

    const [hoursValue, minutesValue] = timeValue.split(":").map(Number);

    let hours = hoursValue;

    const suffix = hours >= 12 ? "PM" : "AM";

    if (hours === 0) {
      hours = 12;
    } else if (hours > 12) {
      hours -= 12;
    }

    return `${hours}:${String(minutesValue).padStart(2, "0")} ${suffix}`;
  };

  const formatDuration = (totalMinutes) => {
    const safeMinutes = Number(totalMinutes) || 0;

    const durationHours = Math.floor(safeMinutes / 60);

    const durationMinutes = safeMinutes % 60;

    return `${durationHours} hrs ${durationMinutes} mins`;
  };

  // ===============================
  // SAFE DATE CREATION
  // ===============================

  /*
    We avoid using:

    new Date("2026-07-27")

    because JavaScript may interpret that as UTC and shift the date.

    We instead build a local calendar date.
  */

  const createLocalDate = (dateValue) => {
    if (!dateValue) return null;

    const [dateYear, dateMonth, dateDay] = dateValue.split("-").map(Number);

    return new Date(dateYear, dateMonth - 1, dateDay);
  };

  // ===============================
  // PERIOD FILTER HANDLERS
  // ===============================

  const handleDayChange = async (event) => {
    const value = event.target.value;

    if (!value) return;

    setSelectedDate(value);

    setSelectedPeriod("day");

    setReportLabel(`Daily salon report for ${formatDateLabel(value)}`);

    try {
      const data = await fetchDailyData(value);

      setReportSessions(Array.isArray(data?.sessions) ? data.sessions : []);
    } catch (error) {
      console.error("Failed to load daily salon sessions:", error);
      setReportSessions([]);
    }
  };

  const handleWeekChange = async (event) => {
    const value = event.target.value;

    if (!value) return;

    setSelectedWeek(value);

    setSelectedPeriod("week");

    const { monday, sunday } = getWeekRange(value);

    setReportLabel(
      `Weekly salon report: ${monday.toLocaleDateString(
        "en-UG",
      )} → ${sunday.toLocaleDateString("en-UG")}`,
    );

    try {
      const data = await fetchWeeklyData(monday, sunday);

      setReportSessions(Array.isArray(data?.sessions) ? data.sessions : []);
    } catch (error) {
      console.error("Failed to load weekly salon sessions:", error);
      setReportSessions([]);
    }
  };

  const handleMonthChange = async (event) => {
    const value = event.target.value;

    if (!value) return;

    setMonthYear(value);

    setSelectedPeriod("month");

    const [selectedYear, selectedMonth] = value.split("-").map(Number);

    const monthName = new Date(
      selectedYear,
      selectedMonth - 1,
      1,
    ).toLocaleDateString("en-UG", {
      month: "long",
      year: "numeric",
    });

    setReportLabel(`Monthly salon report for ${monthName}`);

    try {
      const data = await fetchMonthlyData(selectedYear, selectedMonth);

      setReportSessions(Array.isArray(data?.sessions) ? data.sessions : []);
    } catch (error) {
      console.error("Failed to load monthly salon sessions:", error);
      setReportSessions([]);
    }
  };

  const handleYearChange = async (event) => {
    const selectedYear = Number(event.target.value);

    if (!selectedYear) return;

    setYear(selectedYear);

    setSelectedPeriod("year");

    setReportLabel(`Yearly salon report for ${selectedYear}`);

    try {
      const data = await fetchYearlyData(selectedYear);

      setReportSessions(Array.isArray(data?.sessions) ? data.sessions : []);
    } catch (error) {
      console.error("Failed to load yearly salon sessions:", error);
      setReportSessions([]);
    }
  };

  // ===============================
  // GENERATE YEAR OPTIONS
  // ===============================

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();

    return Array.from({ length: 11 }, (_, index) => currentYear - index);
  };

  // ===============================
  // FILTER SESSIONS BY PERIOD
  // ===============================

  const filteredSessions = useMemo(() => {
    if (!salonSessions.length) {
      return [];
    }

    // Report endpoints already return sessions scoped to the selected period.
    if (reportSessions !== null) {
      return salonSessions;
    }

    if (selectedPeriod === "day") {
      return salonSessions.filter(
        (session) => session.open_date === selectedDate,
      );
    }

    if (selectedPeriod === "week" && selectedWeek) {
      const { monday, sunday } = getWeekRange(selectedWeek);

      monday.setHours(0, 0, 0, 0);

      sunday.setHours(23, 59, 59, 999);

      return filterSessionsByDate(salonSessions, monday, sunday);
    }

    if (selectedPeriod === "month" && monthYear) {
      const [selectedYear, selectedMonth] = monthYear.split("-").map(Number);

      return salonSessions.filter((session) => {
        const sessionDate = createLocalDate(session.open_date);

        if (!sessionDate) return false;

        return (
          sessionDate.getFullYear() === selectedYear &&
          sessionDate.getMonth() + 1 === selectedMonth
        );
      });
    }

    if (selectedPeriod === "year") {
      return salonSessions.filter((session) => {
        const sessionDate = createLocalDate(session.open_date);

        if (!sessionDate) return false;

        return sessionDate.getFullYear() === year;
      });
    }

    return salonSessions;
  }, [
    salonSessions,
    reportSessions,
    selectedPeriod,
    selectedDate,
    selectedWeek,
    monthYear,
    year,
  ]);

  // ===============================
  // PROCESSED SESSION ROWS
  // ===============================

  const processedSessions = useMemo(() => {
    return filteredSessions
      .map((session) => {
        const duration = calculateSessionDuration(session);

        return {
          ...session,

          durationHours: duration.hours,

          durationMinutes: duration.minutes,

          totalMinutes: duration.totalMinutes,
        };
      })
      .sort((sessionA, sessionB) => {
        const dateA = `${sessionA.open_date || ""} ${sessionA.open_time || ""}`;

        const dateB = `${sessionB.open_date || ""} ${sessionB.open_time || ""}`;

        return dateB.localeCompare(dateA);
      });
  }, [filteredSessions]);

  // ===============================
  // SUMMARY CALCULATIONS
  // ===============================

  const summary = useMemo(() => {
    const totalSessions = processedSessions.length;

    const totalMinutes = processedSessions.reduce(
      (sum, session) => sum + Number(session.totalMinutes || 0),
      0,
    );

    const completedSessions = processedSessions.filter(
      (session) => session.close_date && session.close_time,
    );

    const openSessions = processedSessions.filter(
      (session) =>
        session.status === "open" && !session.close_date && !session.close_time,
    );

    const averageMinutes =
      totalSessions > 0 ? Math.floor(totalMinutes / totalSessions) : 0;

    const longestSession =
      processedSessions.length > 0
        ? processedSessions.reduce(
            (longest, session) =>
              session.totalMinutes > longest.totalMinutes ? session : longest,
            processedSessions[0],
          )
        : null;

    const shortestSession =
      processedSessions.length > 0
        ? processedSessions.reduce(
            (shortest, session) =>
              session.totalMinutes < shortest.totalMinutes ? session : shortest,
            processedSessions[0],
          )
        : null;

    return {
      totalSessions,

      completedSessionsCount: completedSessions.length,

      openSessionsCount: openSessions.length,

      totalMinutes,

      averageMinutes,

      longestSession,

      shortestSession,
    };
  }, [processedSessions]);

  // ===============================
  // AVERAGE OPENING TIME
  // ===============================

  const averageOpeningTime = useMemo(() => {
    const sessionsWithOpeningTimes = processedSessions.filter(
      (session) => session.open_time,
    );

    if (!sessionsWithOpeningTimes.length) {
      return "N/A";
    }

    const totalOpeningMinutes = sessionsWithOpeningTimes.reduce(
      (sum, session) => {
        const [hours, minutes] = session.open_time.split(":").map(Number);

        return sum + hours * 60 + minutes;
      },
      0,
    );

    const averageMinutes = Math.floor(
      totalOpeningMinutes / sessionsWithOpeningTimes.length,
    );

    const averageHours = Math.floor(averageMinutes / 60);

    const remainingMinutes = averageMinutes % 60;

    return formatTime12Hour(
      `${String(averageHours).padStart(2, "0")}:${String(
        remainingMinutes,
      ).padStart(2, "0")}:00`,
    );
  }, [processedSessions]);

  // ===============================
  // AVERAGE CLOSING TIME
  // ===============================

  const averageClosingTime = useMemo(() => {
    const sessionsWithClosingTimes = processedSessions.filter(
      (session) => session.close_time,
    );

    if (!sessionsWithClosingTimes.length) {
      return "N/A";
    }

    const totalClosingMinutes = sessionsWithClosingTimes.reduce(
      (sum, session) => {
        const [hours, minutes] = session.close_time.split(":").map(Number);

        return sum + hours * 60 + minutes;
      },
      0,
    );

    const averageMinutes = Math.floor(
      totalClosingMinutes / sessionsWithClosingTimes.length,
    );

    const averageHours = Math.floor(averageMinutes / 60);

    const remainingMinutes = averageMinutes % 60;

    return formatTime12Hour(
      `${String(averageHours).padStart(2, "0")}:${String(
        remainingMinutes,
      ).padStart(2, "0")}:00`,
    );
  }, [processedSessions]);

  // ===============================
  // CURRENT SESSION
  // ===============================

  const currentSession = useMemo(() => {
    return salonSessions.find(
      (session) =>
        session.status === "open" && !session.close_date && !session.close_time,
    );
  }, [salonSessions]);

  const currentSessionDuration = useMemo(() => {
    return calculateSessionDuration(currentSession);
  }, [currentSession]);

  console.log("Selected salon report sessions:", processedSessions);

  // ===============================
  // RENDER
  // ===============================

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      {/* PAGE HEADER */}

      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            Salon operations
          </p>

          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            Salon Report
          </h1>

          <p className="mt-1 text-sm text-gray-600">{reportLabel}</p>
        </div>

        {/* PERIOD FILTERS */}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Day
            </label>

            <input
              type="date"
              value={selectedDate}
              onChange={handleDayChange}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Week
            </label>

            <input
              type="week"
              value={selectedWeek}
              onChange={handleWeekChange}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Month
            </label>

            <input
              type="month"
              value={monthYear}
              onChange={handleMonthChange}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Year
            </label>

            <select
              value={year}
              onChange={handleYearChange}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
            >
              {generateYearOptions().map((optionYear) => (
                <option key={optionYear} value={optionYear}>
                  {optionYear}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ACTIVE SESSION */}

      {currentSession && (
        <section className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-green-500" />

                <h2 className="text-lg font-semibold text-green-900">
                  Salon is currently open
                </h2>
              </div>

              <p className="mt-2 text-sm text-green-800">
                Opened on {formatSessionDate(currentSession.open_date)} at{" "}
                {formatTime12Hour(currentSession.open_time)}
              </p>
            </div>

            <div className="rounded-xl bg-white px-5 py-3 text-center shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Current duration
              </p>

              <p className="mt-1 text-xl font-bold text-green-700">
                {currentSessionDuration.hours} hrs{" "}
                {currentSessionDuration.minutes} mins
              </p>
            </div>
          </div>
        </section>
      )}

      {/* SUMMARY CARDS */}

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Sessions</p>

          <p className="mt-2 text-3xl font-bold text-gray-900">
            {summary.totalSessions}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Sessions in selected period
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Operating Time</p>

          <p className="mt-2 text-2xl font-bold text-blue-700">
            {formatDuration(summary.totalMinutes)}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Combined session duration
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Average Session</p>

          <p className="mt-2 text-2xl font-bold text-purple-700">
            {formatDuration(summary.averageMinutes)}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Average hours per opening
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Completed Sessions</p>

          <p className="mt-2 text-3xl font-bold text-green-700">
            {summary.completedSessionsCount}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            {summary.openSessionsCount} still open
          </p>
        </div>
      </section>

      {/* AVERAGE TIMES */}

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Average Opening Time</p>

          <p className="mt-2 text-2xl font-bold text-gray-900">
            {averageOpeningTime}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Average Closing Time</p>

          <p className="mt-2 text-2xl font-bold text-gray-900">
            {averageClosingTime}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Longest Session</p>

          <p className="mt-2 text-2xl font-bold text-orange-700">
            {summary.longestSession
              ? formatDuration(summary.longestSession.totalMinutes)
              : "N/A"}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            {summary.longestSession
              ? formatSessionDate(summary.longestSession.open_date)
              : "No session"}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Shortest Session</p>

          <p className="mt-2 text-2xl font-bold text-cyan-700">
            {summary.shortestSession
              ? formatDuration(summary.shortestSession.totalMinutes)
              : "N/A"}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            {summary.shortestSession
              ? formatSessionDate(summary.shortestSession.open_date)
              : "No session"}
          </p>
        </div>
      </section>

      {/* SESSION HISTORY TABLE */}

      <section className="rounded-2xl border bg-white p-4 shadow-sm md:p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Session History
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Opening, closing and duration details for the selected period.
          </p>
        </div>

        {processedSessions.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-gray-500">
            No salon sessions were found for this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="max-h-[520px] overflow-y-auto">
              <table className="min-w-full border-collapse">
                <thead className="sticky top-0 bg-gray-100">
                  <tr>
                    <th className="border px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      #
                    </th>

                    <th className="border px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Open Date
                    </th>

                    <th className="border px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Open Time
                    </th>

                    <th className="border px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Close Date
                    </th>

                    <th className="border px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Close Time
                    </th>

                    <th className="border px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Duration
                    </th>

                    <th className="border px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {processedSessions.map((session, index) => (
                    <tr
                      key={
                        session.id ??
                        `${session.open_date}-${session.open_time}-${index}`
                      }
                      className="hover:bg-gray-50"
                    >
                      <td className="border px-4 py-3 text-sm">{index + 1}</td>

                      <td className="border px-4 py-3 text-sm">
                        {formatSessionDate(session.open_date)}
                      </td>

                      <td className="border px-4 py-3 text-sm">
                        {formatTime12Hour(session.open_time)}
                      </td>

                      <td className="border px-4 py-3 text-sm">
                        {session.close_date
                          ? formatSessionDate(session.close_date)
                          : "Not closed"}
                      </td>

                      <td className="border px-4 py-3 text-sm">
                        {session.close_time
                          ? formatTime12Hour(session.close_time)
                          : "Not closed"}
                      </td>

                      <td className="border px-4 py-3 text-sm font-medium">
                        {formatDuration(session.totalMinutes)}
                      </td>

                      <td className="border px-4 py-3 text-sm">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            session.status === "open"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {session.status || "unknown"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
