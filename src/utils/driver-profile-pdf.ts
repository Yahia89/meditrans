import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { formatInUserTimezone } from "../lib/timezone.ts";
import type { StsInspection } from "../features/sts-inspections/types.ts";
import {
  buildDriverBasicPrintRows,
  buildDriverInspectionPrintRows,
  hasDriverPrintSections,
  type DriverPrintSections,
  type DriverProfilePrintData,
} from "./driver-profile-print-model.ts";
import { buildDriverTripPrintData, type DriverPrintTrip, type DriverTripDateRange } from "./driver-trip-print.ts";

interface DriverProfilePDFInput {
  driver: DriverProfilePrintData;
  orgName: string;
  timezone: string;
  sections: DriverPrintSections;
  trips?: readonly DriverPrintTrip[];
  tripDateRange?: DriverTripDateRange;
  inspections?: readonly StsInspection[];
}

export function createDriverProfilePDFDocument(input: DriverProfilePDFInput) {
  if (!hasDriverPrintSections(input.sections)) throw new Error("Select at least one report section.");
  const { driver, orgName, timezone, sections } = input;
  const formatDate = (value: string | null | undefined) => value
    ? formatInUserTimezone(value, /^\d{4}-\d{2}-\d{2}$/.test(value) ? "UTC" : timezone, "MMM d, yyyy")
    : "Not recorded";

  // Validate all selected data before producing a partial document.
  const content: { title: string; rows: string[][]; compact?: boolean; tripDetails?: boolean }[] = [];
  if (sections.basicInfo) content.push({ title: "Basic information", rows: buildDriverBasicPrintRows(driver, formatDate), compact: true });
  if (sections.tripCount) {
    const trips = buildDriverTripPrintData({ driver, trips: input.trips, range: input.tripDateRange, timezone });
    content.push({ title: "Trips and count", rows: trips.summaryRows });
    if (trips.detailRows.length) content.push({ title: "Trip details", rows: trips.detailRows, tripDetails: true });
  }
  if (sections.stsHistory) content.push(...buildDriverInspectionPrintRows(driver, input.inspections, formatDate, timezone));

  const doc = new jsPDF({ compress: true, format: "a4" });
  const margin = 15;
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const contentWidth = width - margin * 2;
  const accent: [number, number, number] = [61, 90, 61];
  let cursor = 17;
  doc.setFillColor(...accent);
  doc.rect(0, 0, width, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...accent);
  const orgLines: string[] = doc.splitTextToSize(orgName || "Organization", contentWidth);
  doc.text(orgLines, margin, cursor);
  cursor += orgLines.length * 5 + 7;
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text("Driver profile", margin, cursor);
  cursor += 9;
  doc.setFontSize(13);
  const nameLines: string[] = doc.splitTextToSize(driver.full_name || "Unnamed driver", contentWidth);
  doc.text(nameLines, margin, cursor);
  cursor += nameLines.length * 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Driver ID: ${driver.id}`, margin, cursor);
  cursor += 5;
  doc.text(`Generated: ${formatInUserTimezone(new Date(), timezone, "MMM d, yyyy h:mm a")}`, margin, cursor);
  cursor += 10;

  for (const section of content) {
    let body: RowInput[] = section.rows;
    if (section.compact) {
      const details = section.rows.filter(([label]) => label !== "Notes");
      body = [];
      for (let index = 0; index < details.length; index += 2) {
        body.push([...details[index], ...(details[index + 1] || ["", ""])]);
      }
      const notes = section.rows.find(([label]) => label === "Notes");
      if (notes) body.push([notes[0], { content: notes[1], colSpan: 3 }]);
    }
    autoTable(doc, {
      startY: cursor,
      head: [
        [{ content: section.title, colSpan: section.compact ? 4 : section.tripDetails ? 3 : 2 }],
        ...(section.tripDetails ? [["Scheduled pickup / reference", "Passenger / route", "Status / mileage"]] : []),
      ],
      body,
      theme: "grid",
      pageBreak: section.compact || section.tripDetails ? "auto" : "avoid",
      rowPageBreak: "avoid",
      showHead: "everyPage",
      margin: { top: 18, right: margin, bottom: 20, left: margin },
      styles: {
        font: "helvetica", fontSize: section.tripDetails ? 8 : 9, cellPadding: 3,
        textColor: [51, 65, 85], lineColor: [226, 232, 240], lineWidth: 0.1,
        overflow: "linebreak", valign: "top",
      },
      headStyles: { fillColor: accent, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 10 },
      columnStyles: section.compact ? {
        0: { cellWidth: 35, fontStyle: "bold", textColor: [100, 116, 139] },
        1: { cellWidth: contentWidth / 2 - 35 },
        2: { cellWidth: 35, fontStyle: "bold", textColor: [100, 116, 139] },
        3: { cellWidth: contentWidth / 2 - 35 },
      } : section.tripDetails ? {
        0: { cellWidth: 55 },
        1: { cellWidth: contentWidth - 90 },
        2: { cellWidth: 35 },
      } : {
        0: { cellWidth: 48, fontStyle: "bold", textColor: [100, 116, 139] },
        1: { cellWidth: contentWidth - 48 },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    cursor = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    if (cursor > height - 35 && section !== content[content.length - 1]) {
      doc.addPage();
      cursor = 18;
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, height - 15, width - margin, height - 15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const footerName = doc.splitTextToSize(driver.full_name || "Unnamed driver", contentWidth - 40)[0] as string;
    doc.text(footerName, margin, height - 10);
    doc.text(`Page ${page} of ${pageCount}`, width - margin, height - 10, { align: "right" });
  }
  return doc;
}

export function generateDriverProfilePDF(input: DriverProfilePDFInput) {
  const doc = createDriverProfilePDFDocument(input);
  const name = (input.driver.full_name || "driver").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
  doc.save(`driver_profile_${name}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
