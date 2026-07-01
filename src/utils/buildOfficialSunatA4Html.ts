/**
 * HTML A4 estilo comprobante electrónico SUNAT (formato tuf4ctur4 / CPE).
 */

import QRCode from "qrcode";
import { amountToWordsPe } from "./amountToWordsPe";
import { getFullImageUrl, isLikelyImagePath } from "./getFullImageUrl";
import type { CompanyData } from "../context/AuthContext";
import type { IssuedDocumentReportSource } from "./buildIssuedDocumentReportJson";
import {
    issuedItemLineTotal,
    unitValueFromInclusivePrice,
} from "./taxAmounts";

const round2 = (n: number): number =>
    Math.round((Number(n) || 0) * 100) / 100;

const fmtMoney = (n: number): string => round2(n).toFixed(2);

function esc(value: string | number | null | undefined): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function documentTypeTitle(
    code: string,
    description?: string | null,
): string {
    const c = String(code || "").trim();
    if (c === "01") return "FACTURA ELECTRÓNICA";
    if (c === "03") return "BOLETA ELECTRÓNICA";
    const d = String(description || "").trim();
    return d ? d.toUpperCase() : "NOTA DE VENTA";
}

function formatDocSerialNumber(
    serial: string,
    number: string | number,
): string {
    const s = String(serial || "").trim();
    const n = String(number ?? "").trim().padStart(6, "0");
    return `${s}-${n}`;
}

function formatDatePe(date: string): string {
    const d = String(date || "").trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return d;
}

function customerDocLabel(
    documentType?: string | null,
    documentNumber?: string | null,
): string {
    const t = String(documentType || "").trim().toUpperCase();
    const num = String(documentNumber || "").trim();
    if (t === "6" || t === "RUC") return "RUC";
    if (t === "1" || t === "DNI") return "DNI";
    if (num.length === 11) return "RUC";
    if (num.length === 8) return "DNI";
    return "DOC.";
}

function paymentLabel(method: string): string {
    const m = String(method || "").trim().toUpperCase();
    if (m === "CASH" || m === "EFECTIVO") return "EFECTIVO [CONTADO]";
    if (m === "CARD" || m === "TARJETA") return "TARJETA";
    if (m === "YAPE") return "YAPE";
    if (m === "PLIN") return "PLIN";
    if (m === "TRANSFER") return "TRANSFERENCIA";
    return m || "PAGO";
}

function resolveLogoSrc(companyData?: CompanyData | null): string | null {
    const raw =
        companyData?.branch?.logo?.trim() ||
        companyData?.company?.logo?.trim() ||
        companyData?.branchLogo?.trim() ||
        companyData?.companyLogo?.trim() ||
        "";
    if (!raw) return null;
    if (raw.startsWith("data:")) return raw;
    if (isLikelyImagePath(raw)) return getFullImageUrl(raw);
    if (/^[A-Za-z0-9+/=]+$/.test(raw.slice(0, 80))) {
        return `data:image/png;base64,${raw}`;
    }
    return raw;
}

async function buildQrBoxHtml(hashCode?: string | null): Promise<string> {
    const hash = String(hashCode || "").trim();
    if (!hash) {
        return `<div class="qr-box"><span class="qr-fallback">QR SUNAT<br/>(consulte en tuf4ct.com/cpe)</span></div>`;
    }
    try {
        const dataUrl = await QRCode.toDataURL(hash, {
            errorCorrectionLevel: "M",
            margin: 1,
            width: 108,
        });
        return `<div class="qr-box"><img class="qr-img" src="${dataUrl}" alt="QR SUNAT"/></div>`;
    } catch {
        return `<div class="qr-box"><span class="qr-fallback">QR SUNAT<br/>(consulte en tuf4ct.com/cpe)</span></div>`;
    }
}

export type OfficialSunatA4DocSource = IssuedDocumentReportSource & {
    hashCode?: string | null;
    user?: { fullName?: string | null } | null;
    items: Array<{
        quantity: number;
        unitValue?: number;
        unitPrice: number;
        total: number;
        discount?: number;
        operationDetail?: {
            product?: { code?: string; name?: string };
        };
    }>;
};

export async function buildOfficialSunatA4Html(
    doc: OfficialSunatA4DocSource,
    companyData?: CompanyData | null,
): Promise<string> {
    const igvPercent =
        Number(doc.branch?.igvPercentage ?? companyData?.branch?.igvPercentage) ||
        18;
    const gravada = round2(doc.totalAmount - doc.igvAmount);
    const discount = round2(doc.totalDiscount ?? 0);
    const companyName =
        companyData?.company?.denomination ||
        companyData?.company?.commercialName ||
        companyData?.branch?.name ||
        "";
    const address =
        companyData?.branch?.address ??
        companyData?.company?.address ??
        "";
    const ruc = String(companyData?.company?.ruc ?? "").trim();
    const docTitle = documentTypeTitle(
        doc.document.code,
        doc.document.description,
    );
    const docNumber = formatDocSerialNumber(doc.serial, doc.number);
    const emissionDate = formatDatePe(doc.emissionDate);
    const logo = resolveLogoSrc(companyData);

    const customerName = doc.person?.name?.trim() || "CLIENTE VARIOS";
    const customerDoc = doc.person?.documentNumber?.trim() || "00000000";
    const customerDocType = customerDocLabel(
        doc.person?.documentType,
        doc.person?.documentNumber,
    );

    const userName =
        doc.operation?.user?.fullName?.trim() ||
        doc.user?.fullName?.trim() ||
        "";

    const activePayments = (doc.payments ?? []).filter(
        (p) => String(p.status || "COMPLETED").toUpperCase() !== "CANCELLED",
    );
    const primaryPayment = activePayments[0];
    const paymentText = primaryPayment
        ? `${paymentLabel(primaryPayment.paymentMethod)}: S/ ${fmtMoney(primaryPayment.paidAmount)}`
        : `EFECTIVO [CONTADO]: S/ ${fmtMoney(doc.totalAmount)}`;

    const amountInWords = amountToWordsPe(doc.totalAmount);

    const itemRows = doc.items
        .map((item) => {
            const qty = round2(item.quantity);
            const unitPrice = round2(item.unitPrice);
            const unitValue = round2(
                item.unitValue ??
                    unitValueFromInclusivePrice(unitPrice, igvPercent),
            );
            const importe = issuedItemLineTotal(item);
            const code = item.operationDetail?.product?.code ?? "";
            const name = item.operationDetail?.product?.name ?? "";
            return `<tr>
        <td class="c">${esc(qty)}</td>
        <td class="c">NIU</td>
        <td class="c">${esc(code)}</td>
        <td class="desc">${esc(name)}</td>
        <td class="n">${fmtMoney(unitValue)}</td>
        <td class="n">${fmtMoney(unitPrice)}</td>
        <td class="n">${fmtMoney(importe)}</td>
      </tr>`;
        })
        .join("");

    const emptyRows = Math.max(0, 8 - doc.items.length);
    const filler = Array(emptyRows)
        .fill(
            `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`,
        )
        .join("");

    const legalType =
        doc.document.code === "01"
            ? "FACTURA ELECTRONICA"
            : doc.document.code === "03"
              ? "BOLETA ELECTRONICA"
              : "COMPROBANTE";

    const qrBoxHtml = await buildQrBoxHtml(doc.hashCode);

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>${esc(docTitle)} ${esc(docNumber)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    color: #222;
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 10px;
  }
  .company { flex: 1; min-width: 0; }
  .company .logo { max-height: 72px; max-width: 200px; object-fit: contain; margin-bottom: 6px; display: block; }
  .company .name { font-weight: 700; font-size: 13px; line-height: 1.25; text-transform: uppercase; }
  .company .addr { margin-top: 4px; line-height: 1.35; text-transform: uppercase; font-size: 10.5px; }
  .doc-box {
    width: 240px;
    border: 1px solid #999;
    background: #ececec;
    text-align: center;
    padding: 10px 8px;
  }
  .doc-box .ruc { font-size: 12px; margin-bottom: 6px; }
  .doc-box .type { font-weight: 700; font-size: 13px; margin-bottom: 6px; }
  .doc-box .num { font-weight: 700; font-size: 14px; }
  .info-row {
    display: flex;
    gap: 0;
    margin-bottom: 10px;
    border: 1px solid #999;
  }
  .info-box {
    flex: 1;
    padding: 8px 10px;
    line-height: 1.55;
    font-size: 10.5px;
  }
  .info-box + .info-box { border-left: 1px solid #999; }
  .info-box b { display: inline-block; min-width: 110px; }
  table.items {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 0;
    font-size: 10.5px;
  }
  table.items th, table.items td {
    border: 1px solid #999;
    padding: 4px 5px;
    vertical-align: top;
  }
  table.items th {
    background: #ececec;
    font-weight: 700;
    text-align: center;
  }
  table.items td.c, table.items th.c { text-align: center; }
  table.items td.n, table.items th.n { text-align: right; white-space: nowrap; }
  table.items td.desc { text-align: left; }
  .totals-wrap {
    display: flex;
    justify-content: flex-end;
    margin-top: 0;
  }
  .totals {
    width: 280px;
    border: 1px solid #999;
    border-top: none;
    font-size: 11px;
  }
  .totals div {
    display: flex;
    justify-content: space-between;
    padding: 4px 8px;
    border-top: 1px solid #ccc;
  }
  .totals .total-row { font-weight: 700; font-size: 12px; }
  .letters, .payment {
    border: 1px solid #999;
    border-top: none;
    padding: 7px 10px;
    font-size: 10.5px;
    line-height: 1.45;
  }
  .footer {
    display: flex;
    gap: 12px;
    margin-top: 12px;
    align-items: flex-start;
  }
  .legal {
    flex: 1;
    border: 1px solid #999;
    padding: 10px;
    font-size: 10px;
    line-height: 1.45;
  }
  .qr-box {
    width: 120px;
    height: 120px;
    border: 1px solid #999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    flex-shrink: 0;
  }
  .qr-img { width: 100%; height: 100%; object-fit: contain; }
  .qr-fallback { font-size: 9px; color: #666; text-align: center; line-height: 1.35; }
</style>
</head>
<body>
  <div class="header">
    <div class="company">
      ${logo ? `<img class="logo" src="${esc(logo)}" alt="Logo"/>` : ""}
      <div class="name">${esc(companyName)}</div>
      ${address ? `<div class="addr">${esc(address)}</div>` : ""}
    </div>
    <div class="doc-box">
      <div class="ruc">RUC ${esc(ruc)}</div>
      <div class="type">${esc(docTitle)}</div>
      <div class="num">${esc(docNumber)}</div>
    </div>
  </div>

  <div class="info-row">
    <div class="info-box">
      <div><b>CLIENTE</b></div>
      <div><b>${esc(customerDocType)}</b> ${esc(customerDoc)}</div>
      <div><b>DENOMINACIÓN</b> ${esc(customerName)}</div>
      <div><b>DIRECCIÓN</b> -</div>
      ${userName ? `<div><b>USUARIO</b> ${esc(userName)}</div>` : ""}
    </div>
    <div class="info-box">
      <div><b>FECHA EMISIÓN</b> ${esc(emissionDate)}</div>
      <div><b>FECHA DE VENC.</b> ${esc(emissionDate)}</div>
      <div><b>MONEDA</b> SOLES</div>
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th class="c">CANT.</th>
        <th class="c">UM</th>
        <th class="c">CÓD.</th>
        <th>DESCRIPCIÓN</th>
        <th class="n">V/U</th>
        <th class="n">P/U</th>
        <th class="n">IMPORTE</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      ${filler}
    </tbody>
  </table>

  <div class="totals-wrap">
    <div class="totals">
      <div><span>GRAVADA</span><span>S/ ${fmtMoney(gravada)}</span></div>
      ${discount > 0 ? `<div><span>DESCUENTO</span><span>S/ ${fmtMoney(discount)}</span></div>` : ""}
      <div><span>IGV ${fmtMoney(igvPercent)} %</span><span>S/ ${fmtMoney(doc.igvAmount)}</span></div>
      <div class="total-row"><span>TOTAL</span><span>S/ ${fmtMoney(doc.totalAmount)}</span></div>
    </div>
  </div>

  <div class="letters"><b>IMPORTE EN LETRAS:</b> ${esc(amountInWords)}</div>
  <div class="payment"><b>FORMA DE PAGO:</b> ${esc(paymentText)}</div>

  <div class="footer">
    <div class="legal">
      Representación impresa de la ${esc(legalType)}, para ver el documento visita
      https://www.tuf4ct.com/cpe
    </div>
    ${qrBoxHtml}
  </div>
</body>
</html>`;
}
