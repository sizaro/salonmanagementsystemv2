import crypto from "crypto";
import { DateTime } from "luxon";

export const makeIntentReference = () =>
  `PAY-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

export const makeBankPaymentReference = (zone = "Africa/Kampala") => {
  const date = DateTime.now().setZone(zone).toFormat("yyLLdd");
  return `SLH-${date}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
};
