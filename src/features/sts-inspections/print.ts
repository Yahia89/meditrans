import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { formatInUserTimezone } from "@/lib/timezone";
import { formatInspectionDate, inspectionResultLabel, type StsInspection } from "./types";
import { buildMobileInspectionPrintRows } from "./mobilePayload";

export function createStsInspectionPDF({
  records, driverNames, organizationName, title, timezone,
}: {
  records: StsInspection[];
  driverNames: ReadonlyMap<string, string>;
  organizationName: string;
  title: string;
  timezone: string;
}) {
  if (!records.length) throw new Error("Select at least one inspection to print.");
  const doc = new jsPDF({ compress: true });
  doc.setProperties({ title, subject: "STS inspection records" });
  doc.setFillColor(61, 90, 61);
  doc.rect(0, 0, 210, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const organizationLines = doc.splitTextToSize(organizationName, 180);
  doc.text(organizationLines, 15, 16);
  const titleY = 16 + organizationLines.length * 6;
  doc.setFontSize(18);
  const titleLines = doc.splitTextToSize(title, 180);
  doc.text(titleLines, 15, titleY);
  let y = titleY + titleLines.length * 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${records.length} inspection record(s) | Generated ${formatInUserTimezone(new Date(), timezone, "MMM d, yyyy h:mm a")}`, 15, y);
  y += 8;

  records.forEach((record, index) => {
    if (y > 230) { doc.addPage(); y = 18; }
    autoTable(doc, {
      startY: y, margin: { left: 15, right: 15, top: 18, bottom: 18 },
      head: [[{ content: `${index + 1}. ${record.title}`, colSpan: 2 }]],
      body: [
        ["Driver", driverNames.get(record.driver_id) || record.driver_id],
        ["Inspection date", formatInspectionDate(record.inspection_date)],
        ["Inspector", record.inspector_name],
        ["Result", inspectionResultLabel(record)],
        ["Reference", record.reference || "Not set"],
        ["Next due date", formatInspectionDate(record.next_due_date)],
        ["Notes", record.notes || "None recorded"],
        ["Attached report", record.report_filename || "No report attached"],
        ["Record ID", record.id],
        ["Last updated", formatInUserTimezone(record.updated_at, timezone, "MMM d, yyyy h:mm a")],
        ...buildMobileInspectionPrintRows(record, timezone),
      ],
      theme: "grid", styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak" },
      headStyles: { fillColor: [61, 90, 61], fontSize: 11 },
      columnStyles: { 0: { cellWidth: 40, fontStyle: "bold" }, 1: { cellWidth: 140 } },
      // Start the first record below the report heading even when its checklist
      // spans several pages; avoid a heading-only opening page.
      pageBreak: index === 0 ? "auto" : "avoid", rowPageBreak: "avoid",
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`STS inspection records - Page ${page} of ${pages}`, 15, 288);
  }
  // The native PDF viewer provides printing; opening a preview must not dispatch
  // an automatic Print action before that viewer has initialized.
  return doc;
}
