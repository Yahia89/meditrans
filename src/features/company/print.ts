import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatInUserTimezone } from "@/lib/timezone";
import type { CompanyDocument } from "./types";

export function buildCompanyRegisterPdf(documents: CompanyDocument[], companyName: string, timezone: string) {
  const pdf = new jsPDF({ format: "a4", orientation: "landscape" });
  pdf.setProperties({ title: `${companyName} — Company document register` });
  pdf.setFontSize(17);
  pdf.text("Company document register", 14, 18);
  pdf.setFontSize(10);
  const companyLines = pdf.splitTextToSize(companyName, 260);
  pdf.text(companyLines, 14, 26);
  const generatedY = 30 + companyLines.length * 4;
  pdf.setFontSize(8);
  pdf.text(`Generated ${formatInUserTimezone(new Date().toISOString(), timezone, "MMM d, yyyy h:mm a")} (${timezone}) · ${documents.length} document${documents.length === 1 ? "" : "s"}`, 14, generatedY);
  autoTable(pdf, {
    startY: generatedY + 6,
    head: [["Title / original file", "Label / audit year", "Uploaded by", "Uploaded at", "Notes"]],
    body: documents.map((doc) => [
      `${doc.title}\n${doc.original_filename}`, `${doc.label}\n${doc.audit_year ?? "No audit year"}`,
      doc.uploaded_by_name || doc.uploaded_by,
      formatInUserTimezone(doc.created_at, timezone, "MMM d, yyyy h:mm a"), doc.notes || "—",
    ]),
    styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: [30, 41, 59] },
    columnStyles: { 0: { cellWidth: 66 }, 1: { cellWidth: 42 }, 2: { cellWidth: 42 }, 3: { cellWidth: 43 }, 4: { cellWidth: 76 } },
    margin: { top: 16, bottom: 18, left: 14, right: 14 },
  });
  for (let i = 1; i <= pdf.getNumberOfPages(); i++) {
    pdf.setPage(i); pdf.setFontSize(8);
    pdf.text(`Company document register · Page ${i} of ${pdf.getNumberOfPages()}`, 14, 202);
  }
  return pdf;
}
