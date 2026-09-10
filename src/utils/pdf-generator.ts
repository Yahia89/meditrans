import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  Trip,
  TripCancellationAudit,
  TripStatusHistory,
} from "../components/trips/types.ts";
import { formatInUserTimezone } from "../lib/timezone.ts";
import {
  buildFixedPdfMilestoneRows,
  formatPdfCoordinate,
  SAMPLE_DRIVER_ATTESTATION,
} from "./pdf-trip-summary-model.ts";
import { getStaticMapImage, type TripMapData } from "./static-map-generator.ts";

type Color = [number, number, number];

interface MapRenderResult {
  image: string | null;
  caption: string;
  unavailableReason: string | null;
}

interface TripSummaryRenderAssets {
  logoImage?: string | null;
  mapResult?: MapRenderResult;
}

interface AutoTableDocument extends jsPDF {
  lastAutoTable: {
    finalY: number;
  };
}

const COLORS = {
  ink: [48, 48, 48] as Color,
  muted: [94, 94, 94] as Color,
  rule: [224, 224, 224] as Color,
  shade: [239, 239, 239] as Color,
  alternate: [249, 249, 249] as Color,
  brand: [52, 64, 101] as Color,
  warning: [155, 81, 0] as Color,
};

const cleanText = (value: string | null | undefined) =>
  (value || "")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2192/g, " to ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const normalizeCoordinatePair = (
  latitude: unknown,
  longitude: unknown,
): { latitude: number | null; longitude: number | null } => {
  const validLatitude =
    isFiniteNumber(latitude) && latitude >= -90 && latitude <= 90;
  const validLongitude =
    isFiniteNumber(longitude) && longitude >= -180 && longitude <= 180;

  if (latitude === 0 && longitude === 0) {
    return { latitude: null, longitude: null };
  }

  return {
    latitude: validLatitude ? latitude : null,
    longitude: validLongitude ? longitude : null,
  };
};

const setTextColor = (doc: jsPDF, color: Color) => {
  doc.setTextColor(color[0], color[1], color[2]);
};

const setFillColor = (doc: jsPDF, color: Color) => {
  doc.setFillColor(color[0], color[1], color[2]);
};

const setDrawColor = (doc: jsPDF, color: Color) => {
  doc.setDrawColor(color[0], color[1], color[2]);
};

const fitLines = (
  doc: jsPDF,
  value: string,
  maxWidth: number,
  maxLines: number,
) => {
  const normalized = cleanText(value) || "Not recorded";
  const lines = doc.splitTextToSize(normalized, maxWidth) as string[];
  if (lines.length <= maxLines) return lines;

  const visible = lines.slice(0, maxLines);
  visible[maxLines - 1] = `${visible[maxLines - 1].replace(/[.\s]+$/, "")}...`;
  return visible;
};

const safeFormat = (
  value: string | Date | null | undefined,
  timezone: string,
  pattern: string,
) => {
  if (!value || !Number.isFinite(new Date(value).getTime())) {
    return "Not recorded";
  }
  return formatInUserTimezone(value, timezone, pattern);
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const loadBrandLogo = async (): Promise<string | null> => {
  if (typeof window === "undefined") return null;

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}logo.png`);
    if (!response.ok) return null;
    return await blobToDataUrl(await response.blob());
  } catch (error) {
    console.warn("[TripSummaryPDF] Company logo unavailable", error);
    return null;
  }
};

const loadTripMap = async (
  trip: Trip,
  cancellationAudit?: TripCancellationAudit | null,
): Promise<MapRenderResult> => {
  const pickup = normalizeCoordinatePair(trip.pickup_lat, trip.pickup_lng);
  const dropoff = normalizeCoordinatePair(trip.dropoff_lat, trip.dropoff_lng);

  if (
    pickup.latitude === null ||
    pickup.longitude === null ||
    dropoff.latitude === null ||
    dropoff.longitude === null
  ) {
    return {
      image: null,
      caption: "Pickup (A) and drop-off (B)",
      unavailableReason: "Pickup or drop-off coordinates were not recorded.",
    };
  }

  const isCancelled = ["cancelled", "no_show"].includes(trip.status);
  const cancellation = normalizeCoordinatePair(
    cancellationAudit?.location_lat,
    cancellationAudit?.location_lng,
  );
  const useCancellationCoordinates =
    isCancelled &&
    cancellation.latitude !== null &&
    cancellation.longitude !== null;

  const mapData: TripMapData = {
    pickupLat: useCancellationCoordinates
      ? cancellation.latitude!
      : pickup.latitude,
    pickupLng: useCancellationCoordinates
      ? cancellation.longitude!
      : pickup.longitude,
    dropoffLat: dropoff.latitude,
    dropoffLng: dropoff.longitude,
  };
  const image = await getStaticMapImage(mapData, 600, 600);

  return {
    image,
    caption: useCancellationCoordinates
      ? "Cancellation location (A) and drop-off (B)"
      : "Pickup (A) and drop-off (B)",
    unavailableReason: image
      ? null
      : "Static route map could not be loaded at generation time.",
  };
};

const drawShadedRow = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  alternate = false,
) => {
  setFillColor(doc, alternate ? COLORS.alternate : COLORS.shade);
  doc.roundedRect(x, y, width, height, 0.8, 0.8, "F");
  doc.setFont("times", "normal");
  doc.setFontSize(7.5);
  setTextColor(doc, COLORS.ink);
  doc.text(fitLines(doc, text, width - 5, 1), x + 2.5, y + height / 2 + 1);
};

const drawContainedImage = (
  doc: jsPDF,
  image: string,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const properties = doc.getImageProperties(image);
  const imageRatio = properties.width / properties.height;
  const boxRatio = width / height;
  const renderedWidth = boxRatio > imageRatio ? height * imageRatio : width;
  const renderedHeight = boxRatio > imageRatio ? height : width / imageRatio;

  doc.addImage(
    image,
    "PNG",
    x + (width - renderedWidth) / 2,
    y + (height - renderedHeight) / 2,
    renderedWidth,
    renderedHeight,
    undefined,
    "FAST",
  );
};

const drawClientSignature = (
  doc: jsPDF,
  trip: Trip,
  x: number,
  y: number,
  width: number,
  height: number,
  timezone: string,
) => {
  setDrawColor(doc, COLORS.rule);
  doc.rect(x, y, width, height);

  if (trip.signature_declined) {
    doc.setFont("times", "bold");
    doc.setFontSize(8);
    setTextColor(doc, COLORS.warning);
    doc.text("Signature declined", x + width / 2, y + 13, { align: "center" });
    if (trip.signature_declined_reason) {
      doc.setFont("times", "normal");
      doc.setFontSize(6.5);
      const reason = fitLines(
        doc,
        `Reason: ${trip.signature_declined_reason}`,
        width - 10,
        2,
      );
      doc.text(reason, x + width / 2, y + 18, { align: "center" });
    }
    return;
  }

  if (!trip.signature_data) {
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    setTextColor(doc, COLORS.muted);
    doc.text("Not recorded", x + width / 2, y + height / 2, {
      align: "center",
    });
    return;
  }

  try {
    drawContainedImage(doc, trip.signature_data, x + 5, y + 2, width - 10, height - 10);
    const signedBy = cleanText(trip.signed_by_name);
    const capturedAt = safeFormat(
      trip.signature_captured_at,
      timezone,
      "MM/dd/yyyy HH:mm",
    );
    const details = [signedBy ? `Signed by: ${signedBy}` : "", `Captured: ${capturedAt}`]
      .filter(Boolean)
      .join(" | ");
    doc.setFont("times", "normal");
    doc.setFontSize(5.8);
    setTextColor(doc, COLORS.muted);
    doc.text(fitLines(doc, details, width - 5, 1), x + width / 2, y + height - 2, {
      align: "center",
    });
  } catch (error) {
    console.error("[TripSummaryPDF] Failed to render client signature", error);
    doc.setFont("times", "normal");
    doc.setFontSize(7.5);
    setTextColor(doc, COLORS.warning);
    doc.text("Signature image unavailable", x + width / 2, y + height / 2, {
      align: "center",
    });
  }
};

/**
 * Creates the document without saving it so the fixed A4 layout can be tested.
 * The report is deliberately one selected service leg and one physical page.
 */
export const createTripSummaryPDFDocument = (
  trip: Trip,
  history: TripStatusHistory[],
  orgName?: string,
  timezone: string = "America/Chicago",
  assets: TripSummaryRenderAssets = {},
) => {
  const doc = new jsPDF({
    compress: true,
    format: "a4",
    orientation: "portrait",
    unit: "mm",
  });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 9;
  const contentWidth = pageWidth - margin * 2;
  const organizationName = cleanText(orgName) || "Future Transportation";
  const milestoneRows = buildFixedPdfMilestoneRows(history);
  const provenance = milestoneRows
    .filter((row) => row.createdAt)
    .map((row) => `${row.label}: ${row.origin}`)
    .join("; ");

  doc.setProperties({
    title: `${organizationName} Trip Summary`,
    subject: `Internal trip ${trip.id} service summary`,
    author: organizationName,
    keywords: `medical transportation, trip summary, GPS milestones${
      provenance ? `, ${provenance}` : ""
    }`,
  });

  // Company header and truthful internal identifier.
  if (assets.logoImage) {
    try {
      drawContainedImage(doc, assets.logoImage, margin, 8, 17, 17);
    } catch (error) {
      console.warn("[TripSummaryPDF] Failed to render company logo", error);
      setFillColor(doc, COLORS.brand);
      doc.roundedRect(margin, 8, 17, 17, 2, 2, "F");
    }
  } else {
    setFillColor(doc, COLORS.brand);
    doc.roundedRect(margin, 8, 17, 17, 2, 2, "F");
    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("FT", margin + 8.5, 18.5, { align: "center" });
  }

  doc.setFont("times", "bold");
  doc.setFontSize(13);
  setTextColor(doc, COLORS.ink);
  doc.text(fitLines(doc, organizationName, 103, 1), margin + 22, 14);
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.text("Medical Transportation", margin + 22, 21);

  const headerRightX = pageWidth - margin;
  doc.setFont("times", "normal");
  doc.setFontSize(8);
  const orderLines = fitLines(doc, `Internal Order ID: ${trip.id}`, 70, 2);
  doc.text(orderLines, headerRightX, 13, { align: "right" });
  doc.text(
    `Date: ${safeFormat(trip.pickup_time, timezone, "MM/dd/yyyy")}`,
    headerRightX,
    23,
    { align: "right" },
  );

  // Pickup and drop-off bars mirror the sample and remain fixed-height.
  const routeY = 31;
  const routeWidth = 134;
  const scheduledWidth = contentWidth - routeWidth;
  setFillColor(doc, COLORS.shade);
  doc.roundedRect(margin, routeY, contentWidth, 12, 0.8, 0.8, "F");
  setDrawColor(doc, COLORS.rule);
  doc.line(margin + routeWidth, routeY, margin + routeWidth, routeY + 12);
  doc.setFont("times", "normal");
  doc.setFontSize(8);
  setTextColor(doc, COLORS.ink);
  doc.text(
    fitLines(doc, `PU Address: ${trip.pickup_location}`, routeWidth - 5, 2),
    margin + 2.5,
    routeY + 5,
  );
  doc.text(
    fitLines(
      doc,
      `Scheduled PU: ${safeFormat(trip.pickup_time, timezone, "HH:mm")}`,
      scheduledWidth - 5,
      1,
    ),
    margin + routeWidth + 2.5,
    routeY + 7,
  );

  setFillColor(doc, COLORS.alternate);
  doc.roundedRect(margin, routeY + 13, contentWidth, 12, 0.8, 0.8, "F");
  doc.text(
    fitLines(doc, `DO Address: ${trip.dropoff_location}`, contentWidth - 5, 2),
    margin + 2.5,
    routeY + 18,
  );

  const mainTop = 63;
  const mainBottom = 215;
  const columnGap = 8;
  const leftWidth = 92;
  const rightX = margin + leftWidth + columnGap;
  const rightWidth = contentWidth - leftWidth - columnGap;

  // Left: static route map only. Provider attribution inside the map image is
  // left intact; the report itself adds no third-party logo or endorsement.
  doc.setFont("times", "bold");
  doc.setFontSize(8);
  setTextColor(doc, COLORS.ink);
  doc.text("Trip Map", margin, mainTop);
  setDrawColor(doc, COLORS.rule);
  doc.rect(margin, mainTop + 4, leftWidth, mainBottom - mainTop - 4);

  if (assets.mapResult?.image) {
    try {
      drawContainedImage(
        doc,
        assets.mapResult.image,
        margin + 1,
        mainTop + 5,
        leftWidth - 2,
        mainBottom - mainTop - 12,
      );
    } catch (error) {
      console.warn("[TripSummaryPDF] Failed to render static route map", error);
    }
  }

  if (!assets.mapResult?.image) {
    setFillColor(doc, COLORS.alternate);
    doc.rect(
      margin + 0.2,
      mainTop + 4.2,
      leftWidth - 0.4,
      mainBottom - mainTop - 4.4,
      "F",
    );
    doc.setFont("times", "bold");
    doc.setFontSize(9);
    setTextColor(doc, COLORS.ink);
    doc.text("Map unavailable", margin + leftWidth / 2, 133, {
      align: "center",
    });
    doc.setFont("times", "normal");
    doc.setFontSize(6.5);
    setTextColor(doc, COLORS.muted);
    const unavailableReason = fitLines(
      doc,
      assets.mapResult?.unavailableReason || "Static route map was not recorded.",
      leftWidth - 14,
      3,
    );
    doc.text(unavailableReason, margin + leftWidth / 2, 139, {
      align: "center",
    });
  }

  doc.setFont("times", "normal");
  doc.setFontSize(6);
  setTextColor(doc, COLORS.muted);
  doc.text(
    assets.mapResult?.caption || "Pickup (A) and drop-off (B)",
    margin + leftWidth / 2,
    mainBottom - 2,
    { align: "center" },
  );

  // Right: client signature, then the separate driver evidence block.
  doc.setFont("times", "bold");
  doc.setFontSize(8.5);
  setTextColor(doc, COLORS.ink);
  doc.text(
    fitLines(
      doc,
      `Client - ${trip.patient?.full_name || "Not recorded"}`,
      rightWidth,
      1,
    ),
    rightX,
    mainTop,
  );
  doc.setFont("times", "normal");
  doc.setFontSize(8);
  doc.text("DO Sign.:", rightX, mainTop + 7);
  drawClientSignature(doc, trip, rightX, mainTop + 10, rightWidth, 37, timezone);

  const driver = trip.driver;
  const driverName = cleanText(driver?.full_name) || "Not recorded";
  const driverLicense = cleanText(driver?.license_number) || "Not recorded";
  const vehicleType = cleanText(driver?.vehicle_type) || "Not recorded";
  const vehicleModel =
    cleanText([driver?.vehicle_make, driver?.vehicle_model].filter(Boolean).join(" ")) ||
    cleanText(driver?.vehicle_info) ||
    "Not recorded";
  const licensePlate = cleanText(driver?.license_plate) || "Not recorded";

  const driverTop = 115;
  doc.setFont("times", "bold");
  doc.setFontSize(8.5);
  setTextColor(doc, COLORS.ink);
  doc.text(fitLines(doc, `Driver - ${driverName}`, rightWidth, 1), rightX, driverTop);
  drawShadedRow(
    doc,
    rightX,
    driverTop + 3,
    rightWidth,
    8,
    `Driver License: ${driverLicense}`,
  );

  setFillColor(doc, COLORS.shade);
  doc.roundedRect(rightX, driverTop + 12, rightWidth, 35, 0.8, 0.8, "F");
  doc.setFont("times", "normal");
  doc.setFontSize(6.4);
  setTextColor(doc, COLORS.ink);
  doc.text(
    fitLines(doc, SAMPLE_DRIVER_ATTESTATION, rightWidth - 5, 8),
    rightX + 2.5,
    driverTop + 17,
  );
  doc.setFont("times", "bold");
  doc.setFontSize(6.6);
  doc.text("Attestation acceptance: Not recorded", rightX + 2.5, driverTop + 44);

  doc.setFont("times", "normal");
  doc.setFontSize(8);
  doc.text("Driver Sign.: Not recorded", rightX, driverTop + 54);

  const vehicleTop = 177;
  doc.setFont("times", "bold");
  doc.setFontSize(8.5);
  doc.text("Vehicle", rightX, vehicleTop);
  drawShadedRow(
    doc,
    rightX,
    vehicleTop + 3,
    rightWidth,
    8,
    "Internal Vehicle ID: Not recorded",
  );
  drawShadedRow(
    doc,
    rightX,
    vehicleTop + 12,
    rightWidth,
    8,
    `Vehicle Type: ${vehicleType}    Model: ${vehicleModel}`,
    true,
  );
  drawShadedRow(
    doc,
    rightX,
    vehicleTop + 21,
    rightWidth,
    8,
    `Plate: ${licensePlate}    VIN: Not recorded`,
  );

  // The visible table intentionally matches the sample's fixed four columns.
  const tableRows = milestoneRows.map((row) => [
    row.label,
    safeFormat(row.createdAt, timezone, "MM/dd/yyyy HH:mm"),
    formatPdfCoordinate(row.latitude),
    formatPdfCoordinate(row.longitude),
  ]);
  autoTable(doc, {
    startY: 225,
    head: [["Status", "Time", "Latitude", "Longitude"]],
    body: tableRows,
    theme: "plain",
    pageBreak: "avoid",
    rowPageBreak: "avoid",
    margin: { left: margin, right: margin, bottom: 20 },
    styles: {
      font: "times",
      fontSize: 7.4,
      cellPadding: { top: 1.7, right: 1.2, bottom: 1.7, left: 1.2 },
      textColor: COLORS.ink,
      valign: "middle",
      overflow: "ellipsize",
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: COLORS.ink,
      fontStyle: "bold",
      lineWidth: 0,
    },
    alternateRowStyles: { fillColor: COLORS.alternate },
    bodyStyles: { fillColor: COLORS.shade },
    columnStyles: {
      0: { cellWidth: 35, fontStyle: "bold" },
      1: { cellWidth: 47 },
      2: { cellWidth: 55 },
      3: { cellWidth: 55 },
    },
    didParseCell: (cell) => {
      if (cell.section === "body" && cell.cell.raw === "Not recorded") {
        cell.cell.styles.textColor = COLORS.warning;
      }
    },
  });

  if (doc.getNumberOfPages() !== 1) {
    throw new Error("Trip summary exceeded its required one-page A4 layout.");
  }

  const tableEndY = (doc as AutoTableDocument).lastAutoTable.finalY;
  doc.setFont("times", "normal");
  doc.setFontSize(5.8);
  setTextColor(doc, COLORS.muted);
  doc.text(
    "Not recorded means no qualifying stored event or coordinate evidence was available; values were not inferred.",
    margin,
    Math.min(tableEndY + 4, 279),
  );

  setDrawColor(doc, COLORS.rule);
  doc.setLineWidth(0.25);
  doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
  doc.setFont("times", "normal");
  doc.setFontSize(6.2);
  setTextColor(doc, COLORS.muted);
  doc.text(organizationName, margin, pageHeight - 8);
  doc.text("Page 1 of 1", pageWidth / 2, pageHeight - 8, { align: "center" });
  doc.text(
    `Generation date ${safeFormat(new Date(), timezone, "MM/dd/yyyy HH:mm")}`,
    pageWidth - margin,
    pageHeight - 8,
    { align: "right" },
  );

  return doc;
};

export async function generateTripSummaryPDF(
  trip: Trip,
  _journeyTrips: Trip[],
  history: TripStatusHistory[],
  orgName?: string,
  timezone: string = "America/Chicago",
  cancellationAudit?: TripCancellationAudit | null,
) {
  // The UI still uses journeyTrips for navigation. A compliance report is one
  // selected service leg, matching the attached sample rather than combining legs.
  void _journeyTrips;

  const [logoImage, mapResult] = await Promise.all([
    loadBrandLogo(),
    loadTripMap(trip, cancellationAudit),
  ]);
  const doc = createTripSummaryPDFDocument(trip, history, orgName, timezone, {
    logoImage,
    mapResult,
  });
  const localDate = formatInUserTimezone(new Date(), timezone, "yyyy-MM-dd");
  doc.save(`journey_summary_${localDate}.pdf`);
}
