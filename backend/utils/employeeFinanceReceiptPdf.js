import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { readStoredArtifact, sha256 } from "./financeReceiptStorage.js";

const ugx = (value) => `UGX ${Number(value || 0).toLocaleString("en-UG")}`;
const stamp = (value) => value ? new Intl.DateTimeFormat("en-UG", {
  day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
}).format(new Date(value)) : "—";
const draw = (page, text, x, y, size, font, color = rgb(0.08, 0.12, 0.18)) => page.drawText(String(text || "—"), { x, y, size, font, color });

async function embedSignature(pdf, url) {
  const bytes = await readStoredArtifact(url);
  return pdf.embedPng(bytes);
}

async function embedSalonLogo(pdf) {
  try {
    const configuredPath = process.env.SALON_RECEIPT_LOGO_PATH;
    const logoPath = configuredPath || path.resolve(process.cwd(), "..", "frontend", "public", "salehishicon.webp");
    const logo = await sharp(await fs.readFile(logoPath)).png().toBuffer();
    return await pdf.embedPng(logo);
  } catch {
    // Branding should never prevent a legally relevant financial receipt from
    // being finalised when an optional image asset is unavailable.
    return null;
  }
}

export async function createEmployeeFinanceReceiptPdf(detail) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const muted = rgb(0.33, 0.39, 0.47);
  const green = rgb(0.05, 0.36, 0.25);
  const { receipt, transaction, salon, signatures } = detail;
  const managerSignature = signatures.find((item) => item.signature_type === "APPROVAL");
  const employeeSignature = signatures.find((item) => item.signature_type === "ACKNOWLEDGEMENT");
  const brandName = process.env.SALON_RECEIPT_NAME || "Salehish Beauty Parlour & Spa";
  const logo = await embedSalonLogo(pdf);

  page.drawRectangle({ x: 0, y: 754, width: 595.28, height: 87.89, color: rgb(0.035, 0.1, 0.09) });
  page.drawRectangle({ x: 0, y: 754, width: 595.28, height: 5, color: rgb(0.81, 0.62, 0.22) });
  draw(page, brandName, 42, 801, 20, bold, rgb(1, 1, 1));
  draw(page, "BEAUTY PARLOUR & SPA · EMPLOYEE FINANCE", 42, 780, 8.5, bold, rgb(0.84, 0.92, 0.89));
  draw(page, salon.phone || salon.email || "Official employee finance record", 42, 764, 9, regular, rgb(0.75, 0.84, 0.81));
  if (logo) {
    page.drawRectangle({ x: 493, y: 773, width: 60, height: 50, color: rgb(1, 1, 1), borderColor: rgb(0.81, 0.62, 0.22), borderWidth: 1 });
    const scaled = logo.scaleToFit(44, 38);
    page.drawImage(logo, { x: 501 + (44 - scaled.width) / 2, y: 779 + (38 - scaled.height) / 2, width: scaled.width, height: scaled.height });
  }

  draw(page, `${receipt.receipt_type === "PAYMENT" ? "EMPLOYEE PAYMENT" : "EMPLOYEE ADVANCE"} RECEIPT`, 42, 724, 15, bold, green);
  draw(page, `Receipt No: ${receipt.receipt_number}`, 42, 704, 10.5, bold);
  draw(page, `Issued: ${stamp(receipt.issued_at)}`, 351, 704, 9, regular, muted);
  page.drawRectangle({ x: 42, y: 641, width: 511, height: 46, color: rgb(0.94, 0.98, 0.96), borderColor: rgb(0.73, 0.85, 0.79), borderWidth: 0.7 });
  draw(page, "AMOUNT RECEIVED", 56, 669, 8.5, bold, muted);
  draw(page, ugx(receipt.amount), 56, 650, 18, bold, green);
  draw(page, "Official transaction value", 395, 658, 9, regular, muted);

  const rows = [
    ["Employee", transaction.employee_name],
    ["Transaction", receipt.receipt_type === "PAYMENT" ? "Employee payment" : "Employee advance"],
    ["Amount received", ugx(receipt.amount)],
    ["Payment method", transaction.payment_method || "Cash"],
    ["Payment date", stamp(transaction.disbursed_at || receipt.issued_at)],
    ["Approved by", managerSignature?.signer_name || transaction.approved_by_name || "—"],
    ["Disbursed by", transaction.disbursed_by_name || receipt.issued_by_name || "—"],
    ["Reference / reason", transaction.payment_reference || transaction.reason || "—"],
  ];
  let y = 617;
  rows.forEach(([label, value]) => {
    draw(page, label, 42, y, 10, bold, muted);
    draw(page, value, 205, y, 11, regular);
    page.drawLine({ start: { x: 42, y: y - 8 }, end: { x: 553, y: y - 8 }, thickness: 0.4, color: rgb(0.86, 0.88, 0.9) });
    y -= 34;
  });

  draw(page, "Receipt declaration", 42, 354, 12, bold);
  draw(page, `I acknowledge receiving ${ugx(receipt.amount)} as an employee ${receipt.receipt_type === "PAYMENT" ? "payment" : "advance"} under the terms recorded for this transaction.`, 42, 336, 9.5, regular, muted);

  page.drawRectangle({ x: 42, y: 137, width: 242, height: 177, borderColor: rgb(0.65, 0.7, 0.73), borderWidth: 1 });
  page.drawRectangle({ x: 311, y: 137, width: 242, height: 177, borderColor: rgb(0.65, 0.7, 0.73), borderWidth: 1 });
  page.drawRectangle({ x: 42, y: 286, width: 242, height: 28, color: rgb(0.95, 0.97, 0.96) });
  page.drawRectangle({ x: 311, y: 286, width: 242, height: 28, color: rgb(0.95, 0.97, 0.96) });
  draw(page, "Management approval", 56, 297, 10.5, bold);
  draw(page, `Signed by: ${managerSignature?.signer_name || "—"}`, 56, 160, 9, regular, muted);
  draw(page, stamp(managerSignature?.signed_at), 56, 146, 8, regular, muted);
  draw(page, "Employee acknowledgement", 325, 297, 10.5, bold);
  draw(page, `Signed by: ${employeeSignature?.signer_name || "—"}`, 325, 160, 9, regular, muted);
  draw(page, stamp(employeeSignature?.signed_at), 325, 146, 8, regular, muted);

  if (managerSignature?.signature_url) {
    const image = await embedSignature(pdf, managerSignature.signature_url);
    const scaled = image.scaleToFit(205, 90);
    page.drawImage(image, { x: 60, y: 181, width: scaled.width, height: scaled.height });
  }
  if (employeeSignature?.signature_url) {
    const image = await embedSignature(pdf, employeeSignature.signature_url);
    const scaled = image.scaleToFit(205, 90);
    page.drawImage(image, { x: 329, y: 181, width: scaled.width, height: scaled.height });
  }

  draw(page, "This electronically signed receipt is bound to the recorded transaction and retained for audit.", 42, 96, 8.5, regular, muted);
  draw(page, `Receipt evidence SHA-256: ${receipt.document_hash || "Generated on finalisation"}`, 42, 79, 7.5, regular, muted);
  return Buffer.from(await pdf.save());
}

export const receiptDocumentHash = (pdfBuffer) => sha256(pdfBuffer);
