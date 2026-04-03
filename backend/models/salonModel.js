
export const getSalonByEmailOrPhone = async (email, phone) => {
  const res = await pool.query(
    `SELECT * FROM salons WHERE email = $1 OR phone = $2`,
    [email, phone]
  );
  return res.rows[0];
};

export const createSalon = async (email, phone) => {
  const res = await pool.query(
    `INSERT INTO salons (email, phone) VALUES ($1, $2) RETURNING id, email, phone`,
    [email, phone]
  );
  return res.rows[0];
};
