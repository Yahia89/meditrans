/**
 * ConnectAbility Invoice PDF Generator
 *
 * Produces invoices that exactly match the ConnectAbility billing format:
 *
 * PAGE 1 (per patient) — Info sheet (portrait):
 *   Title:  "Customer: ConnectAbility of MN"  (centered, bold, underlined)
 *   A two-column bordered table:
 *     Vendor              | [orgName]
 *     Address             | [orgAddress]
 *     Phone #             | [orgPhone]
 *     Invoice Date        | [endDate]
 *     Client Name         | [PATIENT NAME]  (bold)
 *     Invoice #           | #XXXXPQ  (sequential + patient initials)
 *     Service Date        | From [start] To [end]
 *     Description ...     | Non-Emergency Medical Transportation (NEMT)...
 *     Cost of Service     | $[perMile] Per mile $[baseFee] Pickup
 *     Total Amount Charged| $[total]  (bold)
 *     Sales Tax           | Not Applicable
 *
 * PAGE 2+ (per patient) — Trip table (portrait):
 *   Green header: CLIENT NAME | PICK UP | DROP OFF | TOTAL | DATE
 *   One row per trip, sorted by date ascending.
 *
 * When multiple patients are included, each patient starts a fresh page 1+2 pair.
 * Cost is calculated via calculateTripCost() (same as PatientCreditTab).
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { formatInUserTimezone } from "@/lib/timezone";
import { calculateTripCost, DEFAULT_FEES, type OrganizationFees } from "@/lib/credit-utils";
import { CONNECTABILITY_CANONICAL } from "./connectability-utils";
import type { SummaryTrip, FilterState } from "./types";

export interface ConnectAbilityPDFParams {
  trips: SummaryTrip[];
  filters: FilterState;
  timezone: string;
  orgName: string;
  orgAddress?: string;
  orgPhone?: string;
  generatedBy: string;
  userRole: string;
  orgFees?: OrganizationFees | null;
  /**
   * Starting invoice sequence number. Defaults to 1.
   * Each patient increments by 1.
   */
  invoiceStartNumber?: number;
}

// ─── Permanent vendor info ───────────────────────────────────────────────────
const DEFAULT_ORG_ADDRESS = "151 Silver Lake Rd NW Unit #5, St Paul, MN 55112";
const DEFAULT_ORG_PHONE   = "(763)587-5299 - (612) 888-9966 (Work).";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Get the initials from a full name (e.g. "ANNA ROLFES" → "AR") */
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Zero-pad a number to 4 digits */
function padNum(n: number): string {
  return n.toString().padStart(4, "0");
}

// ─── Palette ────────────────────────────────────────────────────────────────
const GREEN:     [number, number, number] = [76, 114, 76];
const GREEN_BG:  [number, number, number] = [198, 219, 198];
const BLACK:     [number, number, number] = [0, 0, 0];
const WHITE:     [number, number, number] = [255, 255, 255];
const ALT_ROW:   [number, number, number] = [245, 250, 245];
const BORDER:    [number, number, number] = [180, 200, 180];

// ─── Main export ────────────────────────────────────────────────────────────

export function generateConnectAbilityPDF({
  trips,
  filters,
  timezone,
  orgName,
  orgAddress,
  orgPhone,
  orgFees,
  invoiceStartNumber = 1,
}: ConnectAbilityPDFParams): void {

  // ── Only bill completed trips ──────────────────────────────────────────
  const completedTrips = trips.filter((t) => t.status === "completed");
  if (completedTrips.length === 0) {
    // Nothing to invoice — caller should guard against this, but be safe
    return;
  }

  const activeFees = orgFees || DEFAULT_FEES;
  const baseFee    = activeFees.base_fee ?? DEFAULT_FEES.base_fee;
  const perMile    = activeFees.per_mile_fee ?? DEFAULT_FEES.per_mile_fee;

  // Use permanent vendor info; fall back to params if explicitly overridden
  const vendorAddress = orgAddress || DEFAULT_ORG_ADDRESS;
  const vendorPhone   = orgPhone   || DEFAULT_ORG_PHONE;

  const startDateStr = format(new Date(`${filters.startDate}T00:00:00`), "MM/dd/yyyy");
  const endDateStr   = format(new Date(`${filters.endDate}T00:00:00`), "MM/dd/yyyy");
  const invoiceDate  = endDateStr; // matches the sample (08/31/2026 = period end)

  // ── Group trips by patient, sorted alphabetically ──────────────────────
  const grouped = new Map<string, SummaryTrip[]>();
  for (const trip of completedTrips) {
    const name = trip.patient?.full_name?.toUpperCase() || "UNKNOWN";
    if (!grouped.has(name)) grouped.set(name, []);
    grouped.get(name)!.push(trip);
  }
  const sortedPatients = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));
  sortedPatients.forEach((name) =>
    grouped.set(
      name,
      grouped.get(name)!.sort(
        (a, b) => new Date(a.pickup_time).getTime() - new Date(b.pickup_time).getTime()
      )
    )
  );

  // ── Create document (portrait letter: 216×279mm) ────────────────────────
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });

  let invoiceSeq = invoiceStartNumber;
  let firstPatient = true;

  for (const patientName of sortedPatients) {
    const patientTrips = grouped.get(patientName)!;
    // All trips here are already completed (filtered above)
    const totalCharged = patientTrips.reduce(
      (sum, t) => sum + calculateTripCost(t, activeFees),
      0
    );

    const invNum = `#${padNum(invoiceSeq)}${initials(patientName)}`;
    invoiceSeq++;

    if (!firstPatient) {
      doc.addPage();
    }
    firstPatient = false;

    const PW = 216; // page width mm (letter portrait)
    const PH = 279; // page height mm
    const ML = 20;  // margin left
    const MR = 20;  // margin right
    const CW = PW - ML - MR; // content width

    // ── Page 1: Info sheet ────────────────────────────────────────────────

    // Title — centered, bold, underlined
    doc.setFont("times", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...BLACK);
    const title = `Customer: ${CONNECTABILITY_CANONICAL}`;
    const titleW = doc.getTextWidth(title);
    const titleX = ML + (CW - titleW) / 2;
    const titleY = 22;
    doc.text(title, titleX, titleY);
    // Underline
    doc.setDrawColor(...BLACK);
    doc.setLineWidth(0.4);
    doc.line(titleX, titleY + 1, titleX + titleW, titleY + 1);

    // Info table rows
    const infoRows: [string, string, boolean][] = [
      ["Vendor:",                    orgName,                                    false],
      ["Address:",                   vendorAddress,                              false],
      ["Phone #:",                   vendorPhone,                                false],
      ["Invoice Date:",              invoiceDate,                                 false],
      ["Client Name:",               patientName,                                 true ],
      ["Invoice #",                  invNum,                                      false],
      ["Service Date:",              `From ${startDateStr} To ${endDateStr}`,     false],
      ["Description of\nServices\nProvided:", "Non-Emergency Medical Transportation (NEMT) service for client", false],
      ["Cost of Service:",           `$ ${perMile} Per mile $${baseFee} Pickup`, false],
      ["Total Amount\nCharged:",     `$${totalCharged.toFixed(2)}`,               true ],
      ["Sales Tax:",                 "Not Applicable",                            false],
    ];

    const labelColW = 45;  // mm
    const valueColW = CW - labelColW;
    let y = titleY + 8;
    const ROW_PAD = 2.5; // vertical padding inside cell
    const LINE_H  = 5;   // per text line height

    for (const [label, value, bold] of infoRows) {
      const labelLines = label.split("\n");
      const valueLines = value.split("\n");
      // Also word-wrap long value text
      const wrappedValue = doc.splitTextToSize(value, valueColW - 4);
      const rowLines = Math.max(labelLines.length, wrappedValue.length);
      const rowH = rowLines * LINE_H + ROW_PAD * 2;

      // Cell borders
      doc.setDrawColor(...BLACK);
      doc.setLineWidth(0.3);
      doc.rect(ML, y, labelColW, rowH);
      doc.rect(ML + labelColW, y, valueColW, rowH);

      // Label text (always bold)
      doc.setFont("times", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...BLACK);
      doc.text(labelLines, ML + 2, y + ROW_PAD + LINE_H - 1.5);

      // Value text
      doc.setFont("times", bold ? "bold" : "normal");
      doc.setFontSize(10);
      doc.text(wrappedValue, ML + labelColW + 2, y + ROW_PAD + LINE_H - 1.5);

      y += rowH;
    }

    // ── Page 2: Trip table ────────────────────────────────────────────────
    doc.addPage();

    // Re-declare page constants (same values, but needed after addPage)
    const tableStartY = 20;

    const tableBody = patientTrips.map((trip) => {
      // All trips are completed here (pre-filtered above)
      const cost = calculateTripCost(trip, activeFees);
      const dateStr = formatInUserTimezone(trip.pickup_time, timezone, "M/d/yyyy");

      return [
        { content: patientName },
        { content: trip.pickup_location  || "" },
        { content: trip.dropoff_location || "" },
        {
          content: `$${cost.toFixed(2)}`,
          styles: { halign: "right" as const },
        },
        { content: dateStr, styles: { halign: "center" as const } },
      ];
    });

    autoTable(doc, {
      startY: tableStartY,
      head: [
        [
          { content: "CLIENT NAME", styles: { halign: "center" } },
          { content: "PICK UP",     styles: { halign: "center" } },
          { content: "DROP OFF",    styles: { halign: "center" } },
          { content: "TOTAL",       styles: { halign: "center" } },
          { content: "DATE",        styles: { halign: "center" } },
        ],
      ],
      body: tableBody as any,
      theme: "grid",
      headStyles: {
        fillColor: GREEN_BG,
        textColor: [30, 60, 30] as [number,number,number],
        fontSize: 9,
        fontStyle: "bold",
        halign: "center",
        valign: "middle",
        lineColor: BORDER,
        lineWidth: 0.35,
      },
      bodyStyles: {
        fontSize: 8.5,
        cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
        textColor: BLACK,
        lineColor: BORDER,
        lineWidth: 0.2,
      },
      alternateRowStyles: {
        fillColor: ALT_ROW,
      },
      columnStyles: {
        0: { cellWidth: 38 },                        // CLIENT NAME
        1: { cellWidth: 55 },                        // PICK UP
        2: { cellWidth: 55 },                        // DROP OFF
        3: { cellWidth: 22, halign: "right"  },      // TOTAL
        4: { cellWidth: 26, halign: "center" },      // DATE
      },
    });
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const safePeriod = `${filters.startDate}_to_${filters.endDate}`;
  const patientSlug =
    sortedPatients.length === 1
      ? `_${sortedPatients[0].replace(/\s+/g, "_")}`
      : sortedPatients.length > 1
        ? `_${sortedPatients.length}_patients`
        : "";
  doc.save(`connectability_invoice${patientSlug}_${safePeriod}.pdf`);
}
