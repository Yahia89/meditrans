import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Trip, TripStatusHistory } from "@/components/trips/types";

/**
 * Optional map image data for trip route visualization.
 * Should be a base64 data URL (e.g., from getStaticMapImage utility)
 */
export interface TripMapImage {
  /** Base64 data URL of the map image */
  dataUrl: string;
  /** Width of the image */
  width: number;
  /** Height of the image */
  height: number;
}

export const generateTripSummaryPDF = (
  trip: Trip,
  journeyTrips: Trip[] = [],
  history: TripStatusHistory[] = [],
  orgName?: string,
  /** Optional map image showing the route visualization */
  mapImage?: TripMapImage,
) => {
  // Initialize with compression enabled for smaller file sizes
  const doc = new jsPDF({
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.width;
  const margin = 14;

  // --- Header ---
  if (orgName) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85); // Slate 700
    doc.text(orgName.toUpperCase(), margin, 18);
    doc.setFontSize(22);
    doc.text("Journal Summary Report", margin, 28);
  } else {
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.text("Journal Summary Report", margin, 20);
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139); // Slate 500
  const headerY = orgName ? 34 : 26;
  doc.text(`Generated on: ${new Date().toLocaleString()}`, margin, headerY);
  doc.text(`Trip ID: ${trip.id}`, margin, headerY + 5);

  if (trip.eta_sms_sent_at) {
    doc.setTextColor(30, 64, 175); // Blue 800
    doc.setFont("helvetica", "bold");
    doc.text(
      `ETA SMS Sent at: ${new Date(trip.eta_sms_sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      margin,
      headerY + 10,
    );
  }

  // --- Patient Info Block ---
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  const patientBlockY = orgName ? 48 : 38;
  doc.roundedRect(
    margin,
    patientBlockY,
    pageWidth - margin * 2,
    24,
    2,
    2,
    "FD",
  );

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.setFont("helvetica", "normal");
  doc.text("PATIENT", margin + 5, patientBlockY + 7);
  doc.text("SCHEDULED DATE", margin + 80, patientBlockY + 7);
  doc.text("TOTAL LEGS", margin + 140, patientBlockY + 7);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text(trip.patient?.full_name || "N/A", margin + 5, patientBlockY + 14);
  doc.text(
    new Date(trip.pickup_time).toLocaleDateString(),
    margin + 80,
    patientBlockY + 14,
  );
  doc.text(
    (journeyTrips.length || 1).toString(),
    margin + 140,
    patientBlockY + 14,
  );

  let currentY = patientBlockY + 35;

  // --- Trip Route Map (if provided) ---
  if (mapImage && mapImage.dataUrl) {
    try {
      // Calculate dimensions to fit within page margins while maintaining aspect ratio
      const maxMapWidth = pageWidth - margin * 2;
      const maxMapHeight = 60; // Keep it compact for fast PDF generation

      let mapDisplayWidth = mapImage.width;
      let mapDisplayHeight = mapImage.height;

      // Scale down to fit if needed
      if (mapDisplayWidth > maxMapWidth) {
        const scale = maxMapWidth / mapDisplayWidth;
        mapDisplayWidth = maxMapWidth;
        mapDisplayHeight = mapImage.height * scale;
      }
      if (mapDisplayHeight > maxMapHeight) {
        const scale = maxMapHeight / mapDisplayHeight;
        mapDisplayHeight = maxMapHeight;
        mapDisplayWidth = mapDisplayWidth * scale;
      }

      // Center the map horizontally
      const mapX = margin + (maxMapWidth - mapDisplayWidth) / 2;

      doc.addImage(
        mapImage.dataUrl,
        "PNG",
        mapX,
        currentY,
        mapDisplayWidth,
        mapDisplayHeight,
        undefined,
        "FAST", // Compression for smaller file size
      );

      // Add map legend below the image
      currentY += mapDisplayHeight + 4;
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(
        "● Blue: Planned Route  ● Orange: Deviation  ● A: Pickup  ● B: Dropoff",
        pageWidth / 2,
        currentY,
        { align: "center" },
      );
      currentY += 10;
    } catch (e) {
      console.error("[PDF] Error adding map image:", e);
      // Continue without map if there's an error
    }
  }

  // --- Journey Timeline Section ---
  if (journeyTrips && journeyTrips.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text("Journey Timeline", margin, currentY);
    currentY += 5;

    const timelineData = journeyTrips.map((leg, index) => {
      const time = new Date(leg.pickup_time).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      const cleanLocation = (loc: string) =>
        loc.replace(/[!“"']+$|^\s*|\s*$/g, "").trim();
      const pickup = cleanLocation(leg.pickup_location);
      const dropoff = cleanLocation(leg.dropoff_location);
      const route = `From: ${pickup}\nTo: ${dropoff}`;

      const distance = leg.actual_distance_miles
        ? `${Math.ceil(Number(leg.actual_distance_miles))} mi`
        : leg.distance_miles
          ? `${Math.ceil(Number(leg.distance_miles))} mi`
          : "-";

      return [
        index + 1,
        time,
        route,
        leg.status.replace("_", " ").toUpperCase(),
        distance,
      ];
    });

    // @ts-ignore
    autoTable(doc, {
      startY: currentY,
      head: [["#", "Time", "Route", "Status", "Dist."]],
      body: timelineData,
      theme: "plain",
      styles: {
        fontSize: 9,
        cellPadding: 4,
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
        halign: "center", // Center things by default
        valign: "middle", // Vertical centering
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [71, 85, 105],
        fontStyle: "bold",
        lineWidth: 0,
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 28, halign: "center" }, // Increased width for time
        2: { cellWidth: "auto", halign: "left" }, // Route left-aligned but padded
        3: { cellWidth: 35, fontSize: 8, halign: "center" },
        4: { cellWidth: 15, halign: "center" },
      },
      didParseCell: (data) => {
        // Styling status cells based on value
        if (data.section === "body" && data.column.index === 3) {
          const status = data.cell.raw as string;
          if (status === "COMPLETED") {
            data.cell.styles.textColor = [16, 185, 129];
          } else if (status === "CANCELLED" || status === "NO SHOW") {
            data.cell.styles.textColor = [239, 68, 68];
          } else {
            data.cell.styles.textColor = [59, 130, 246];
          }
        }
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // --- Activity History Section ---
  if (history && history.length > 0) {
    // Check if we need a new page
    if (currentY > doc.internal.pageSize.height - 40) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text("Activity History", margin, currentY);
    currentY += 8;

    const historyData = history.map((item) => {
      const date = new Date(item.created_at);
      const timeStr = date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const dateStr = date.toLocaleDateString();

      let statusText = item.status.replace(/_/g, " ").toUpperCase();
      if (statusText.startsWith("UPDATED:")) {
        statusText = statusText.replace("UPDATED:", "UPDATED").trim();
      }

      return [`${dateStr}\n${timeStr}`, statusText, item.actor_name];
    });

    // @ts-ignore
    autoTable(doc, {
      startY: currentY,
      head: [["Date/Time", "Activity", "Performed By"]],
      body: historyData,
      theme: "plain",
      styles: {
        fontSize: 8,
        cellPadding: 4,
        lineColor: [241, 245, 249],
        lineWidth: 0.1,
        valign: "middle", // Vertical centering
      },
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [100, 116, 139],
        fontStyle: "bold",
        fontSize: 7,
      },
      columnStyles: {
        0: { cellWidth: 25, halign: "center" },
        1: { cellWidth: "auto", fontStyle: "bold" },
        2: { cellWidth: 40, halign: "center" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 1) {
          const text = data.cell.raw as string;
          if (text.includes("COMPLETED"))
            data.cell.styles.textColor = [16, 185, 129];
          else if (text.includes("CANCEL") || text.includes("NO SHOW"))
            data.cell.styles.textColor = [239, 68, 68];
          else if (text.includes("EN ROUTE"))
            data.cell.styles.textColor = [147, 51, 234];
          else if (text.includes("ASSIGNED"))
            data.cell.styles.textColor = [59, 130, 246];
        }
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // --- Specific Trip Details & Signature ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text("Selected Trip Verification", margin, currentY);
  currentY += 8;

  // Status Indicator for the selected trip
  let statusColor = [100, 116, 139]; // Default Slate
  if (trip.status === "completed") statusColor = [16, 185, 129];
  else if (trip.status === "cancelled") statusColor = [239, 68, 68];
  else if (trip.status === "in_progress") statusColor = [59, 130, 246];

  doc.setDrawColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.rect(margin, currentY, 2, 10, "F"); // Vertical colored strip

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.text(
    trip.status.toUpperCase().replace("_", " "),
    margin + 5,
    currentY + 7,
  );

  currentY += 15;

  const detailsData = [
    ["Driver", trip.driver?.full_name || "Unassigned"],
    ["Vehicle", trip.driver?.vehicle_info || "N/A"],
    ["Trip Type", trip.trip_type],
    [
      "Recorded Distance",
      trip.actual_distance_miles
        ? `${Math.ceil(Number(trip.actual_distance_miles))} miles`
        : trip.distance_miles
          ? `${Math.ceil(Number(trip.distance_miles))} (est) miles`
          : "N/A",
    ],
    [
      "Actual Duration of current leg",
      trip.actual_duration_minutes
        ? `${trip.actual_duration_minutes} minutes`
        : trip.duration_minutes
          ? `${trip.duration_minutes} (est) minutes`
          : "N/A",
    ],
    [
      "Total Legs Duration",
      journeyTrips.length > 0
        ? `${journeyTrips.reduce((acc, leg) => acc + (Number(leg.actual_duration_minutes) || Number(leg.duration_minutes) || 0), 0)} minutes`
        : trip.actual_duration_minutes
          ? `${trip.actual_duration_minutes} minutes`
          : trip.duration_minutes
            ? `${trip.duration_minutes} (est) minutes`
            : "N/A",
    ],
  ];

  if (trip.total_waiting_minutes && Number(trip.total_waiting_minutes) > 0) {
    detailsData.push(["Wait Time", `${trip.total_waiting_minutes} minutes`]);
  }

  if (trip.notes) {
    detailsData.push(["Notes", trip.notes]);
  }

  // @ts-ignore
  autoTable(doc, {
    startY: currentY,
    body: detailsData,
    theme: "plain",
    styles: {
      fontSize: 10,
      cellPadding: 3,
      textColor: [51, 65, 85],
      valign: "middle",
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 40, textColor: [100, 116, 139] },
      1: { cellWidth: "auto" },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;

  // --- Signature Section ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text("Signature", margin, currentY);
  currentY += 8;

  const signatureBoxHeight = 40;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.rect(margin, currentY, pageWidth - margin * 2, signatureBoxHeight);

  if (trip.signature_declined) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(180, 83, 9); // Amber 700
    doc.text("Signature was declined by the rider.", margin + 5, currentY + 10);
    if (trip.signature_declined_reason) {
      doc.text(
        `Reason: ${trip.signature_declined_reason}`,
        margin + 5,
        currentY + 20,
      );
    }
  } else if (trip.signature_data) {
    // Add Signature Image
    try {
      const imgProps = doc.getImageProperties(trip.signature_data);
      // Center visually and make slightly larger
      const maxWidth = 100;
      const maxHeight = signatureBoxHeight - 14;

      let finalWidth = maxWidth;
      let finalHeight = (imgProps.height * maxWidth) / imgProps.width;

      if (finalHeight > maxHeight) {
        finalHeight = maxHeight;
        finalWidth = (imgProps.width * maxHeight) / imgProps.height;
      }

      // Center the signature visually in the box
      doc.addImage(
        trip.signature_data,
        "PNG",
        (pageWidth - finalWidth) / 2, // Center visually
        currentY + (signatureBoxHeight - finalHeight) / 2 - 2, // Center vertically
        finalWidth,
        finalHeight,
        undefined,
        "FAST", // Compression
      );

      // Show Signer Info - Centered at the bottom of the box
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139); // Slate 500
      let signerInfo = "";
      if (trip.signed_by_name)
        signerInfo += `Signed by: ${trip.signed_by_name}  |  `;
      if (trip.signature_captured_at)
        signerInfo += `Captured: ${new Date(trip.signature_captured_at).toLocaleString()}`;

      if (signerInfo) {
        doc.text(signerInfo, pageWidth / 2, currentY + signatureBoxHeight - 4, {
          align: "center",
        });
      }
    } catch (e) {
      console.error("Error adding signature image to PDF", e);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184);
      doc.text("Error loading signature.", pageWidth / 2, currentY + 20, {
        align: "center",
      });
    }
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text("No signature recorded.", pageWidth / 2, currentY + 20, {
      align: "center",
    });
  }

  // --- Footer ---
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `${orgName || "Future NEMT Transportation"} - Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.height - 10,
      { align: "center" },
    );
  }

  doc.save(`journey_summary_${new Date().toISOString().split("T")[0]}.pdf`);
};
