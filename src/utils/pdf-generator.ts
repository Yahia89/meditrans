import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Trip } from "@/components/trips/types";

export const generateTripSummaryPDF = (trip: Trip) => {
  const doc = new jsPDF();

  // --- Header ---
  doc.setFontSize(22);
  doc.setTextColor(30, 41, 59); // Slate 800
  doc.text("Trip Summary Report", 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 26);
  doc.text(`Trip ID: ${trip.id}`, 14, 31);

  // --- Status Badge-like Indicator ---
  let statusColor = [100, 116, 139]; // Default Slate
  if (trip.status === "completed") statusColor = [16, 185, 129]; // Emerald
  else if (trip.status === "cancelled") statusColor = [239, 68, 68]; // Red
  else if (trip.status === "in_progress") statusColor = [59, 130, 246]; // Blue

  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.roundedRect(150, 12, 45, 10, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(trip.status.toUpperCase().replace("_", " "), 172.5, 18.5, {
    align: "center",
  });

  // --- Main Details Table ---
  // We use autoTable for clean layout of key-value pairs
  const detailsData = [
    ["Patient", trip.patient?.full_name || "N/A"],
    [
      "Pickup",
      `${new Date(trip.pickup_time).toLocaleString()} \n ${
        trip.pickup_location
      }`,
    ],
    ["Dropoff", trip.dropoff_location],
    ["Trip Type", trip.trip_type],
    ["Driver", trip.driver?.full_name || "Unassigned"],
    [
      "Distance",
      trip.actual_distance_miles
        ? `${Math.ceil(Number(trip.actual_distance_miles))} miles (actual)`
        : trip.distance_miles
        ? `${Math.ceil(Number(trip.distance_miles))} miles`
        : "N/A",
    ],
  ];

  // Need to cast to any because the type definition for autoTable might be tricky to import perfectly in this context,
  // but it's attached to jsPDF prototype or imported as function.
  // @ts-ignore
  autoTable(doc, {
    startY: 40,
    head: [["Field", "Value"]],
    body: detailsData,
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42] }, // Slate 900
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 40 },
      1: { cellWidth: "auto" },
    },
    styles: { fontSize: 10, cellPadding: 3 },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 15;

  // --- Signature Section ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text("Signature & Confirmation", 14, currentY);
  currentY += 8;

  if (trip.signature_declined) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(180, 83, 9); // Amber 700
    doc.text("Signature was declined by the rider.", 14, currentY);
    currentY += 5;
    if (trip.signature_declined_reason) {
      doc.text(`Reason: ${trip.signature_declined_reason}`, 14, currentY);
      currentY += 10;
    }
  } else if (trip.signature_data) {
    // Show Signer Info
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);

    if (trip.signed_by_name) {
      doc.text(`Signed by: ${trip.signed_by_name}`, 14, currentY);
      currentY += 5;
    }

    if (trip.signature_captured_at) {
      doc.text(
        `Signed at: ${new Date(trip.signature_captured_at).toLocaleString()}`,
        14,
        currentY
      );
      currentY += 10;
    }

    // Add Signature Image
    try {
      // signature_data is a base64 string like "data:image/png;base64,..."
      // addImage supports this format directly
      const imgProps = doc.getImageProperties(trip.signature_data);
      const pdfWidth = 80;
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      doc.addImage(
        trip.signature_data,
        "PNG",
        14, // x
        currentY, // y
        pdfWidth, // width
        pdfHeight // height
      );

      // Draw a line under signature
      doc.setDrawColor(203, 213, 225); // Slate 300
      doc.line(
        14,
        currentY + pdfHeight + 5,
        14 + pdfWidth,
        currentY + pdfHeight + 5
      );
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("Electronic Signature", 14, currentY + pdfHeight + 9);
    } catch (e) {
      console.error("Error adding signature image to PDF", e);
      doc.setTextColor(239, 68, 68);
      doc.text("Error rendering signature image.", 14, currentY + 10);
    }
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text("No signature recorded for this trip.", 14, currentY);
  }

  // --- Footer ---
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${pageCount} - Future Transportation CRM`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: "center" }
    );
  }

  doc.save(`trip_summary_${trip.id}.pdf`);
};
