import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatInUserTimezone } from "@/lib/timezone";

/**
 * Profile types supported for PDF generation.
 */
type ProfileType = "employee" | "driver" | "patient";

/**
 * Generates a one-page profile PDF for an employee, driver, or patient.
 * PDF is generated on the spot (not stored) and triggers a download.
 */
export function generateProfilePDF(
  type: ProfileType,
  data: Record<string, any>,
  orgName: string,
  timezone: string,
) {
  const doc = new jsPDF({ compress: true });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const accentColor: [number, number, number] = [61, 90, 61]; // #3D5A3D

  const typeLabel =
    type === "employee" ? "Employee" : type === "driver" ? "Driver" : "Patient";

  // Helper to format dates for the PDF
  const fmtDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "Not specified";
    // Handle YYYY-MM-DD dates (birthdays, etc.) without timezone shift
    if (
      dateStr.length === 10 &&
      dateStr.includes("-") &&
      !dateStr.includes("T")
    ) {
      return formatInUserTimezone(dateStr, "UTC", "MMMM d, yyyy");
    }
    return formatInUserTimezone(dateStr, timezone, "MMMM d, yyyy");
  };

  // ─── Header ───────────────────────────────────────────────────────────
  // Accent bar at the very top
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(0, 0, pageWidth, 4, "F");

  let currentY = 16;

  // Org name
  if (orgName) {
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text(orgName.toUpperCase(), margin, currentY);
    currentY += 8;
  }

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text(`${typeLabel} Profile`, margin, currentY);

  // Generated date (right-aligned)
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text(
    `Generated: ${formatInUserTimezone(new Date(), timezone, "MMM d, yyyy h:mm a")}`,
    pageWidth - margin,
    currentY,
    { align: "right" },
  );

  currentY += 10;

  // ─── Profile Block ────────────────────────────────────────────────────
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, "FD");

  // Name
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("FULL NAME", margin + 5, currentY + 7);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(data.full_name || "N/A", margin + 5, currentY + 15);

  // Status
  const statusX = margin + 100;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("STATUS", statusX, currentY + 7);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  const status = (data.status || "Active").toString().replace(/_/g, " ");
  const isActive =
    status.toUpperCase() === "ACTIVE" ||
    status.toUpperCase() === "AVAILABLE";
  doc.setTextColor(
    isActive ? 16 : 100,
    isActive ? 185 : 116,
    isActive ? 129 : 139,
  );
  doc.text(status.toUpperCase(), statusX, currentY + 15);

  // ID
  const idX = margin + 155;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("ID", idX, currentY + 7);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text((data.id || "").substring(0, 8), idX, currentY + 15);

  currentY += 30;

  // ─── Details Table ────────────────────────────────────────────────────
  const rows = buildDetailsRows(type, data, fmtDate);

  // Split into two-column layout for density
  const leftRows: string[][] = [];
  const rightRows: string[][] = [];
  rows.forEach((row, i) => {
    if (i % 2 === 0) leftRows.push(row);
    else rightRows.push(row);
  });

  // Pad the shorter column
  while (leftRows.length < rightRows.length) leftRows.push(["", ""]);
  while (rightRows.length < leftRows.length) rightRows.push(["", ""]);

  const mergedRows = leftRows.map((left, i) => [
    left[0],
    left[1],
    rightRows[i][0],
    rightRows[i][1],
  ]);

  // @ts-ignore
  autoTable(doc, {
    startY: currentY,
    body: mergedRows,
    theme: "plain",
    styles: {
      fontSize: 9,
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
      textColor: [51, 65, 85],
      lineColor: [241, 245, 249],
      lineWidth: 0.1,
      valign: "middle",
    },
    columnStyles: {
      0: {
        fontStyle: "bold",
        cellWidth: 38,
        textColor: [100, 116, 139],
        fontSize: 8,
      },
      1: { cellWidth: 52 },
      2: {
        fontStyle: "bold",
        cellWidth: 38,
        textColor: [100, 116, 139],
        fontSize: 8,
      },
      3: { cellWidth: 52 },
    },
    didParseCell: (hookData: any) => {
      // Alternate row shading
      if (hookData.section === "body" && hookData.row.index % 2 === 0) {
        hookData.cell.styles.fillColor = [248, 250, 252];
      }
    },
    margin: { left: margin, right: margin },
  });

  const tableFinalY = (doc as any).lastAutoTable.finalY;

  // ─── Notes Section ────────────────────────────────────────────────────
  if (data.notes) {
    let notesY = tableFinalY + 10;

    // Check we have room
    if (notesY > pageHeight - 40) {
      doc.addPage();
      notesY = 20;
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Notes", margin, notesY);
    notesY += 6;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    const noteLines = doc.splitTextToSize(data.notes, contentWidth - 10);
    const noteBoxHeight = Math.min(noteLines.length * 5 + 8, 50);
    doc.roundedRect(margin, notesY, contentWidth, noteBoxHeight, 2, 2, "FD");

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(noteLines.slice(0, 8), margin + 5, notesY + 6);
  }

  // ─── Footer ───────────────────────────────────────────────────────────
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Bottom accent bar
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.rect(0, pageHeight - 3, pageWidth, 3, "F");

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `${orgName || "Organization"} — ${typeLabel} Profile — Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: "center" },
    );
  }

  // ─── Save ─────────────────────────────────────────────────────────────
  const safeName = (data.full_name || typeLabel)
    .replace(/[^a-zA-Z0-9]/g, "_")
    .substring(0, 30);
  doc.save(
    `${typeLabel.toLowerCase()}_profile_${safeName}_${new Date().toISOString().split("T")[0]}.pdf`,
  );
}

// ─── Field Builders ───────────────────────────────────────────────────────
function buildDetailsRows(
  type: ProfileType,
  data: Record<string, any>,
  fmtDate: (d: string | null | undefined) => string,
): string[][] {
  switch (type) {
    case "employee":
      return buildEmployeeRows(data, fmtDate);
    case "driver":
      return buildDriverRows(data, fmtDate);
    case "patient":
      return buildPatientRows(data, fmtDate);
  }
}

function buildEmployeeRows(
  d: Record<string, any>,
  fmtDate: (s: string | null | undefined) => string,
): string[][] {
  const formatRole = (role: string | null): string => {
    if (!role) return "No Access";
    const map: Record<string, string> = {
      owner: "Owner",
      admin: "Administrator",
      dispatch: "Dispatcher",
      employee: "Employee",
      driver: "Driver",
    };
    return map[role.toLowerCase()] || role;
  };

  return [
    ["Phone", d.phone || "Not specified"],
    ["Email", d.email || "Not specified"],
    ["Department", d.department || "Unassigned"],
    ["Role", d.role || "Not specified"],
    ["System Role", formatRole(d.system_role)],
    ["Hire Date", fmtDate(d.hire_date)],
    ["Added On", fmtDate(d.created_at)],
    ["Member ID", (d.id || "").substring(0, 8)],
  ];
}

function buildDriverRows(
  d: Record<string, any>,
  fmtDate: (s: string | null | undefined) => string,
): string[][] {
  const formatVehicleType = (type: string | null) => {
    if (!type) return "Standard";
    return type
      .split("_")
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  };

  const rows: string[][] = [
    ["Phone", d.phone || "Not specified"],
    ["Email", d.email || "Not specified"],
    ["Address", d.address || "Not specified"],
    ["County", d.county ? `${d.county} County` : "Not specified"],
    [
      "License #",
      d.id_number || d.license_number || "Not specified",
    ],
    [
      "Vehicle",
      [d.vehicle_make, d.vehicle_model].filter(Boolean).join(" ") ||
        "Not specified",
    ],
    ["Vehicle Color", d.vehicle_color || "Not specified"],
    ["Vehicle Type", formatVehicleType(d.vehicle_type)],
    ["License Plate", d.license_plate || "Not specified"],
    ["DOT Medical #", d.dot_medical_number || "N/A"],
    ["DOT Med. Exp.", fmtDate(d.dot_medical_expiration)],
    ["Insurance Co.", d.insurance_company || "N/A"],
    ["Policy #", d.insurance_policy_number || "N/A"],
    ["Ins. Start", fmtDate(d.insurance_start_date)],
    ["Ins. Expiration", fmtDate(d.insurance_expiration_date)],
    ["Inspection Date", fmtDate(d.inspection_date)],
    ["Record Issued", fmtDate(d.driver_record_issue_date)],
    ["Record Exp.", fmtDate(d.driver_record_expiration)],
  ];

  if (d.npi) rows.push(["NPI", d.npi]);
  if (d.umpi) rows.push(["UMPI", d.umpi]);

  rows.push(["Member Since", fmtDate(d.created_at)]);

  return rows;
}

function buildPatientRows(
  d: Record<string, any>,
  fmtDate: (s: string | null | undefined) => string,
): string[][] {
  const rows: string[][] = [
    ["Date of Birth", fmtDate(d.date_of_birth || d.dob)],
    ["Phone", d.phone || "Not specified"],
    ["Email", d.email || "Not specified"],
    ["Address", d.primary_address || "Not specified"],
    ["County", d.county || "Not specified"],
    ["Medicaid ID", d.medicaid_id || "N/A"],
    ["Waiver Type", d.waiver_type || "Not specified"],
    ["Vehicle Need", d.vehicle_type_need || "Not specified"],
    ["Service Type", d.service_type || "Not specified"],
    ["Referred By", d.referral_by || "Not specified"],
    ["Referral Start", fmtDate(d.referral_date)],
    ["Referral Exp.", fmtDate(d.referral_expiration_date)],
    ["Case Manager", d.case_manager || "None assigned"],
    ["CM Phone", d.case_manager_phone || "N/A"],
    ["CM Email", d.case_manager_email || "N/A"],
    [
      "Monthly Credit",
      d.monthly_credit ? `$${Number(d.monthly_credit).toFixed(2)}` : "$0.00",
    ],
    ["Credit Used For", d.credit_used_for || "General use"],
    [
      "SAL Status",
      d.sal_status
        ? d.sal_status.charAt(0).toUpperCase() + d.sal_status.slice(1)
        : "Not set",
    ],
    ["Added On", fmtDate(d.created_at)],
  ];

  return rows;
}
