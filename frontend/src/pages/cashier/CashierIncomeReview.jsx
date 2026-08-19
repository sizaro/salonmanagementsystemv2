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

        console.log(
          "Cashier customer check:",
          data.services?.map((service) => ({
            id: service.id,
            customerId: service.customerId,
            customerName: service.customerName,
            performers: service.performers,
          })),
        );

        if (!active) return;

        setReport({
          summary: data.summary || {
            totalServices: 0,
          },
          services: data.services || [],
        });
      } catch (requestError) {
        console.error("Failed to fetch cashier daily services:", requestError);

        if (!active) return;

        setError(
          requestError.response?.data?.error ||
            "Unable to load today's services.",
        );
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

    const cleanTime = String(time).substring(0, 8);

    const parsed = DateTime.fromFormat(cleanTime, "HH:mm:ss", {
      zone: ZONE,
    });

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

    const parsed = DateTime.fromISO(date, {
      zone: ZONE,
    });

    if (!parsed.isValid) {
      return date;
    }

    return parsed.toFormat("dd LLL yyyy");
  };

  // =====================================
  // FORMAT MONEY
  // =====================================

  const formatMoney = (value) => {
    return Number(value || 0).toLocaleString("en-UG");
  };

  // =====================================
  // CUSTOMER DISPLAY
  // =====================================

  const getCustomerName = (service) => {
    if (service.customerName) {
      return service.customerName;
    }

    if (service.customerId) {
      return "Registered customer";
    }

    return "Walk-in customer";
  };

  const getCustomerType = (service) => {
    return service.customerId ? "Registered customer" : "Walk-in";
  };

  return (
    <div className="dashboard-page space-y-6">
      {/* =====================================
          HEADER
      ===================================== */}

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

      {/* =====================================
          DATE SELECTOR
      ===================================== */}

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

      {/* =====================================
          ERROR
      ===================================== */}

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
        >
          {error}
        </p>
      )}

      {/* =====================================
          LOADING
      ===================================== */}

      {loading ? (
        <div className="dashboard-panel text-center">
          <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-4 border-stone-200 border-t-[var(--salon-copper)]" />
          Loading daily services...
        </div>
      ) : (
        <>
          {/* =====================================
              TOTAL SERVICES CARD
          ===================================== */}

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

          {/* =====================================
              SERVICE DETAILS
          ===================================== */}

          <section className="dashboard-panel">
            <div className="mb-5">
              <h2 className="font-serif text-2xl font-semibold">
                Services Performed
              </h2>

              <p className="mt-1 text-sm text-stone-500">
                Customer, service and professional information for the selected
                day.
              </p>
            </div>

            {report.services?.length ? (
              <div className="dashboard-table-wrap overflow-x-auto">
                <table className="dashboard-table min-w-[1000px]">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Time</th>
                      <th>Service</th>
                      <th>Section</th>
                      <th>Customer</th>
                      <th>Professional</th>
                      <th>Amount</th>
                    </tr>
                  </thead>

                  <tbody>
                    {report.services.map((service, index) => (
                      <tr key={service.id}>
                        {/* NUMBER */}

                        <td>{index + 1}</td>

                        {/* TIME */}

                        <td>
                          <span className="font-medium whitespace-nowrap">
                            {formatTime(service.serviceTime)}
                          </span>
                        </td>

                        {/* SERVICE */}

                        <td>
                          <div className="font-semibold text-stone-800">
                            {service.serviceName}
                          </div>
                        </td>

                        {/* SECTION */}

                        <td>{service.sectionName || "—"}</td>

                        {/* CUSTOMER */}

                        <td>
                          <div className="font-medium text-stone-800">
                            {getCustomerName(service)}
                          </div>

                          <div className="mt-1 text-xs text-stone-400">
                            {getCustomerType(service)}
                          </div>
                        </td>

                        {/* PROFESSIONALS */}

                        <td>
                          {service.performers?.length ? (
                            <div className="space-y-3">
                              {service.performers.map(
                                (performer, performerIndex) => (
                                  <div
                                    key={`${service.id}-performer-${performerIndex}`}
                                    className="min-h-[38px]"
                                  >
                                    <div className="font-medium text-stone-800">
                                      {performer.name || "—"}
                                    </div>

                                    {performer.role && (
                                      <div className="text-xs text-stone-500">
                                        {performer.role}
                                      </div>
                                    )}
                                  </div>
                                ),
                              )}
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>

                        {/* PERFORMER AMOUNTS */}

                        <td>
                          {service.performers?.length ? (
                            <div className="space-y-3">
                              {service.performers.map(
                                (performer, performerIndex) => (
                                  <div
                                    key={`${service.id}-amount-${performerIndex}`}
                                    className="flex min-h-[38px] items-center font-semibold text-[var(--salon-copper)] whitespace-nowrap"
                                  >
                                    UGX {formatMoney(performer.amount)}
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
