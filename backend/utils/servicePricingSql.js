export const ONLINE_BOOKING_DISCOUNT_PERCENT = 5;

// Customer-created appointments keep the normal service definition and employee
// earnings. The promotional reduction is taken only from the salon share.
export const servicePricingSelect = `
  sd.service_amount AS original_amount,
  CASE
    WHEN st.customer_id IS NOT NULL AND st.appointment_date IS NOT NULL
      THEN ROUND(sd.service_amount * 0.95)
    ELSE sd.service_amount
  END AS full_amount,
  CASE
    WHEN st.customer_id IS NOT NULL AND st.appointment_date IS NOT NULL
      THEN ROUND(sd.service_amount * 0.05)
    ELSE 0
  END AS discount_amount,
  CASE
    WHEN st.customer_id IS NOT NULL AND st.appointment_date IS NOT NULL
      THEN 5
    ELSE 0
  END AS discount_percentage,
  sd.salon_amount AS original_salon_amount,
  CASE
    WHEN st.customer_id IS NOT NULL AND st.appointment_date IS NOT NULL
      THEN GREATEST(sd.salon_amount - ROUND(sd.service_amount * 0.05), 0)
    ELSE sd.salon_amount
  END AS salon_amount
`;
