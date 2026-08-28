export const ONLINE_BOOKING_DISCOUNT_AMOUNT = 500;

// Customer-created appointments keep the normal service definition and employee
// earnings. The promotional reduction is taken only from the salon share.
export const servicePricingSelect = `
  COALESCE(st.original_service_amount, sd.service_amount) AS original_amount,
  COALESCE(
    st.charged_service_amount,
    CASE WHEN LOWER(COALESCE(st.service_source, '')) = 'online_booking'
      THEN GREATEST(sd.service_amount - 500, 0)
      ELSE sd.service_amount END
  ) AS full_amount,
  COALESCE(
    st.discount_amount,
    CASE WHEN LOWER(COALESCE(st.service_source, '')) = 'online_booking' THEN 500 ELSE 0 END
  ) AS discount_amount,
  NULL::numeric AS discount_percentage,
  COALESCE(st.original_salon_amount, sd.salon_amount) AS original_salon_amount,
  COALESCE(
    st.charged_salon_amount,
    CASE WHEN LOWER(COALESCE(st.service_source, '')) = 'online_booking'
      THEN GREATEST(sd.salon_amount - 500, 0)
      ELSE sd.salon_amount END
  ) AS salon_amount
`;
