import { useEffect, useState } from "react";
import axios from "axios";
import { DateTime } from "luxon";

const API_URL = import.meta.env.VITE_API_URL || "/api";

const ZONE = "Africa/Kampala";

export default function CashierIncomeReview() {
  const today = DateTime.now().setZone(ZONE).toISODate();

  const [selectedDate, setSelectedDate] = useState(today);

  const [report, setReport] = useState({
    summary: {
      totalServices: 0,
    },
    services: [],
  });

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  // =====================================
  // FETCH DAILY SERVICES
  // =====================================

  useEffect(() => {
    let active = true;

    const fetchDailyServices = async () => {
      try {
        setLoading(true);
        setError("");

        const { data } = await axios.get(`${API_URL}/reports/cashier-income`, {
          params: {
            date: selectedDate,
          },

          withCredentials: true,
        });

        console.log("Cashier daily service review:", data);

        if (active) {
          setReport({
            summary: data.summary || {
              totalServices: 0,
            },

            services: data.services || [],
          });
        }
      } catch (requestError) {
        console.error("Failed to fetch cashier daily services:", requestError);

        if (active) {
          setError(
            requestError.response?.data?.error ||
              "Unable to load today's services.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchDailyServices();

    return () => {
      active = false;
    };
  }, [selectedDate]);

  // =====================================
  // FORMAT TIME
  // =====================================

  const formatTime = (time) => {
    if (!time) return "—";

    const parsed = DateTime.fromFormat(time.substring(0, 8), "HH:mm:ss");

    if (!parsed.isValid) {
      return time;
    }

    return parsed.toFormat("h:mm a");
  };

  // =====================================
  // FORMAT DATE
  // =====================================

  const formatDate = (date) => {
    if (!date) return "—";

    const parsed = DateTime.fromISO(date);

    if (!parsed.isValid) {
      return date;
    }

    return parsed.toFormat("dd LLL yyyy");
  };

  return (
    <div className="dashboard-page space-y-6">
      {/* ===============================
          HEADER
      =============================== */}

      <header className="dashboard-hero">
        <p className="salon-eyebrow text-[var(--salon-copper)]">
          Cashier workspace
        </p>

        <h1 className="relative z-10 mt-2 font-serif text-3xl font-semibold">
          Daily Services
        </h1>

        <p className="relative z-10 mt-2 text-stone-600">
          Review services performed during the selected day.
        </p>
      </header>

      {/* ===============================
          DATE SELECTOR
      =============================== */}

      <section className="dashboard-panel">
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm font-semibold text-stone-700">
            Service Date
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="dashboard-field mt-1"
            />
          </label>

          <div className="text-sm text-stone-500">
            Showing services for{" "}
            <span className="font-semibold text-stone-700">
              {formatDate(selectedDate)}
            </span>
          </div>
        </div>
      </section>

      {/* ===============================
          ERROR
      =============================== */}

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
        >
          {error}
        </p>
      )}

      {/* ===============================
          LOADING
      =============================== */}

      {loading ? (
        <div className="dashboard-panel text-center">
          <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-4 border-stone-200 border-t-[var(--salon-copper)]" />
          Loading daily services...
        </div>
      ) : (
        <>
          {/* ===============================
              SERVICE COUNT
          =============================== */}

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <article className="dashboard-card">
              <p className="text-sm text-stone-500">Total Services</p>

              <p className="mt-2 text-4xl font-bold text-[var(--salon-copper)]">
                {report.summary?.totalServices || 0}
              </p>

              <p className="mt-2 text-sm text-stone-500">
                Services performed on {formatDate(selectedDate)}
              </p>
            </article>
          </section>

          {/* ===============================
              SERVICE DETAILS
          =============================== */}

          <section className="dashboard-panel">
            <div className="mb-5">
              <h2 className="font-serif text-2xl font-semibold">
                Services Performed
              </h2>

              <p className="mt-1 text-sm text-stone-500">
                Staff, customer and service information for the selected day.
              </p>
            </div>

            {report.services?.length ? (
              <div className="dashboard-table-wrap">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Time</th>
                      <th>Service</th>
                      <th>Section</th>
                      <th>Customer</th>
                      <th>Professionals</th>
                    </tr>
                  </thead>

                  <tbody>
                    {report.services.map((service, index) => (
                      <tr key={service.id}>
                        <td>{index + 1}</td>

                        <td>
                          <span className="font-medium">
                            {formatTime(service.serviceTime)}
                          </span>
                        </td>

                        <td>
                          <div className="font-semibold text-stone-800">
                            {service.serviceName}
                          </div>
                        </td>

                        <td>{service.sectionName || "—"}</td>

                        <td>
                          <div className="font-medium">
                            {service.customerName || "Walk-in customer"}
                          </div>

                          {service.customerId ? (
                            <div className="mt-1 text-xs text-stone-400">
                              Registered customer
                            </div>
                          ) : (
                            <div className="mt-1 text-xs text-stone-400">
                              Walk-in
                            </div>
                          )}
                        </td>

                        <td>
                          {service.performers?.length ? (
                            <div className="space-y-1">
                              {service.performers.map(
                                (performer, performerIndex) => (
                                  <div key={performerIndex} className="text-sm">
                                    <span className="font-medium">
                                      {performer.name}
                                    </span>

                                    {performer.role && (
                                      <span className="ml-1 text-stone-500">
                                        ({performer.role})
                                      </span>
                                    )}
                                  </div>
                                ),
                              )}
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-stone-200 py-12 text-center">
                <p className="font-medium text-stone-700">
                  No services recorded
                </p>

                <p className="mt-1 text-sm text-stone-500">
                  There are no services for {formatDate(selectedDate)}.
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
