/**
 * 837P Generator
 *
 * Generates ANSI X12 5010 837P (Professional) claim files for Medicaid billing.
 * Implements Minnesota-specific requirements for NEMT claims.
 *
 * Reference: https://www.dhs.state.mn.us (MN NEMT billing guide)
 */

export interface Claim837PData {
  organization: {
    name: string;
    npi: string;
    tax_id: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    billing_state: "MN" | "CA";
  };
  claim: {
    controlNumber: string;
    billingPeriodStart: string;
    billingPeriodEnd: string;
  };
  lines: Array<{
    patientName: string;
    patientDOB: string;
    medicaidId: string;
    serviceDate: string;
    hcpcsCode: string;
    modifier?: string;
    units: number;
    chargeAmount: number;
    diagnosisCode: string;
    pickupAddress: string;
    dropoffAddress: string;
    driverName: string;
    driverUMPI?: string;
    driverNPI?: string;
    authorizationNumber?: string; // Important for CA
  }>;
}

/**
 * Generate 837P file content
 */
export function generate837P(data: Claim837PData): string {
  const segments: string[] = [];
  const segmentTerminator = "~";
  const elementSeparator = "*";
  const subElementSeparator = ":";
  const isCA = data.organization.billing_state === "CA";

  // State specific receiver info
  const receiverInfo = isCA
    ? {
        id: "61044", // Example Medi-Cal ID
        name: "STATE OF CALIFORNIA - MEDI-CAL",
      }
    : {
        id: "MNMEDICAID",
        name: "MINNESOTA HEALTH CARE PROGRAMS",
      };

  // ISA - Interchange Control Header
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 12);
  const interchangeControlNumber = String(Date.now())
    .slice(-9)
    .padStart(9, "0");

  segments.push(
    `ISA${elementSeparator}00${elementSeparator}          ${elementSeparator}00${elementSeparator}          ${elementSeparator}ZZ${elementSeparator}${data.organization.tax_id
      .replace("-", "")
      .padEnd(
        15,
      )}${elementSeparator}ZZ${elementSeparator}${receiverInfo.id.padEnd(
      15,
    )}${elementSeparator}${timestamp.slice(
      2,
      8,
    )}${elementSeparator}${timestamp.slice(
      8,
      12,
    )}${elementSeparator}^${elementSeparator}00501${elementSeparator}${interchangeControlNumber}${elementSeparator}0${elementSeparator}T${elementSeparator}${subElementSeparator}${segmentTerminator}`,
  );

  // GS - Functional Group Header
  const groupControlNumber = "1";
  segments.push(
    `GS${elementSeparator}HC${elementSeparator}${data.organization.tax_id.replace(
      "-",
      "",
    )}${elementSeparator}${receiverInfo.id}${elementSeparator}${timestamp.slice(
      2,
      10,
    )}${elementSeparator}${timestamp.slice(
      8,
      12,
    )}${elementSeparator}${groupControlNumber}${elementSeparator}X${elementSeparator}005010X222A1${segmentTerminator}`,
  );

  // ST - Transaction Set Header
  const transactionSetControlNumber = "0001";
  segments.push(
    `ST${elementSeparator}837${elementSeparator}${transactionSetControlNumber}${elementSeparator}005010X222A1${segmentTerminator}`,
  );

  // BHT - Beginning of Hierarchical Transaction
  segments.push(
    `BHT${elementSeparator}0019${elementSeparator}00${elementSeparator}${
      data.claim.controlNumber
    }${elementSeparator}${timestamp.slice(
      2,
      10,
    )}${elementSeparator}${timestamp.slice(
      8,
      12,
    )}${elementSeparator}CH${segmentTerminator}`,
  );

  // NM1 - Submitter Name (Organization)
  segments.push(
    `NM1${elementSeparator}41${elementSeparator}2${elementSeparator}${
      data.organization.name
    }${elementSeparator}${elementSeparator}${elementSeparator}${elementSeparator}${elementSeparator}46${elementSeparator}${data.organization.tax_id.replace(
      "-",
      "",
    )}${segmentTerminator}`,
  );

  // PER - Submitter Contact
  segments.push(
    `PER${elementSeparator}IC${elementSeparator}${data.organization.name}${elementSeparator}TE${elementSeparator}0000000000${segmentTerminator}`,
  );

  // NM1 - Receiver Name (State Medicaid)
  segments.push(
    `NM1${elementSeparator}40${elementSeparator}2${elementSeparator}${receiverInfo.name}${elementSeparator}${elementSeparator}${elementSeparator}${elementSeparator}${elementSeparator}46${elementSeparator}${receiverInfo.id}${segmentTerminator}`,
  );

  // HL - Billing Provider Hierarchical Level
  segments.push(
    `HL${elementSeparator}1${elementSeparator}${elementSeparator}20${elementSeparator}1${segmentTerminator}`,
  );

  // NM1 - Billing Provider Name
  segments.push(
    `NM1${elementSeparator}85${elementSeparator}2${elementSeparator}${data.organization.name}${elementSeparator}${elementSeparator}${elementSeparator}${elementSeparator}${elementSeparator}XX${elementSeparator}${data.organization.npi}${segmentTerminator}`,
  );

  // N3 - Billing Provider Address
  segments.push(
    `N3${elementSeparator}${data.organization.address}${segmentTerminator}`,
  );

  // N4 - Billing Provider City/State/ZIP
  segments.push(
    `N4${elementSeparator}${data.organization.city}${elementSeparator}${data.organization.state}${elementSeparator}${data.organization.zip}${segmentTerminator}`,
  );

  // REF - Billing Provider Tax ID
  segments.push(
    `REF${elementSeparator}EI${elementSeparator}${data.organization.tax_id}${segmentTerminator}`,
  );

  // Group lines by patient
  const patientGroups = new Map<string, typeof data.lines>();
  data.lines.forEach((line) => {
    const key = line.medicaidId;
    if (!patientGroups.has(key)) {
      patientGroups.set(key, []);
    }
    patientGroups.get(key)!.push(line);
  });

  let subscriberCount = 0;

  // For each patient (subscriber)
  patientGroups.forEach((lines, medicaidId) => {
    subscriberCount++;
    const firstLine = lines[0];

    // HL - Subscriber Hierarchical Level
    segments.push(
      `HL${elementSeparator}${
        subscriberCount + 1
      }${elementSeparator}1${elementSeparator}22${elementSeparator}0${segmentTerminator}`,
    );

    // SBR - Subscriber Information
    segments.push(
      `SBR${elementSeparator}P${elementSeparator}${elementSeparator}${elementSeparator}${elementSeparator}${elementSeparator}${elementSeparator}${elementSeparator}${elementSeparator}11${segmentTerminator}`,
    );

    // NM1 - Subscriber Name
    const [lastName, ...firstNameParts] = firstLine.patientName.split(" ");
    const firstName = firstNameParts.join(" ") || lastName;
    segments.push(
      `NM1${elementSeparator}IL${elementSeparator}1${elementSeparator}${lastName}${elementSeparator}${firstName}${elementSeparator}${elementSeparator}${elementSeparator}${elementSeparator}MI${elementSeparator}${medicaidId}${segmentTerminator}`,
    );

    // DMG - Subscriber Demographics
    const dob = firstLine.patientDOB.replace(/[-/]/g, "");
    segments.push(
      `DMG${elementSeparator}D8${elementSeparator}${dob}${segmentTerminator}`,
    );

    // NM1 - Payer Name
    segments.push(
      `NM1${elementSeparator}PR${elementSeparator}2${elementSeparator}${receiverInfo.name}${elementSeparator}${elementSeparator}${elementSeparator}${elementSeparator}${elementSeparator}PI${elementSeparator}${receiverInfo.id}${segmentTerminator}`,
    );

    // CLM - Claim Information
    const totalCharge = lines
      .reduce((sum, line) => sum + line.chargeAmount, 0)
      .toFixed(2);
    segments.push(
      `CLM${elementSeparator}${data.claim.controlNumber}-${subscriberCount}${elementSeparator}${totalCharge}${elementSeparator}${elementSeparator}${elementSeparator}11${subElementSeparator}B${subElementSeparator}1${elementSeparator}Y${elementSeparator}A${elementSeparator}Y${elementSeparator}Y${segmentTerminator}`,
    );

    // REF - Authorization Number (SA number for MN, Auth number for CA)
    if (firstLine.authorizationNumber) {
      segments.push(
        `REF${elementSeparator}G1${elementSeparator}${firstLine.authorizationNumber}${segmentTerminator}`,
      );
    }

    // HI - Health Care Diagnosis Code
    segments.push(
      `HI${elementSeparator}ABK${subElementSeparator}${firstLine.diagnosisCode}${segmentTerminator}`,
    );

    // For each service line
    lines.forEach((line, index) => {
      // LX - Service Line Number
      segments.push(`LX${elementSeparator}${index + 1}${segmentTerminator}`);

      // SV1 - Professional Service
      const modifierPart = line.modifier
        ? `${subElementSeparator}${line.modifier}`
        : "";
      segments.push(
        `SV1${elementSeparator}HC${subElementSeparator}${
          line.hcpcsCode
        }${modifierPart}${elementSeparator}${line.chargeAmount.toFixed(
          2,
        )}${elementSeparator}UN${elementSeparator}${
          line.units
        }${elementSeparator}${elementSeparator}${elementSeparator}1${segmentTerminator}`,
      );

      // DTP - Service Date
      const serviceDate = line.serviceDate.replace(/[-/]/g, "");
      segments.push(
        `DTP${elementSeparator}472${elementSeparator}D8${elementSeparator}${serviceDate}${segmentTerminator}`,
      );

      // NM1 - Rendering Provider (Driver)
      // For MN we use UMPI, for CA we use NPI
      const renderingId = isCA
        ? line.driverNPI || data.organization.npi
        : line.driverUMPI || line.driverNPI || data.organization.npi;
      const idType = "XX"; // Always XX (NPI) in 5010 Professional

      segments.push(
        `NM1${elementSeparator}82${elementSeparator}1${elementSeparator}${
          line.driverName.split(" ")[0]
        }${elementSeparator}${line.driverName
          .split(" ")
          .slice(1)
          .join(
            " ",
          )}${elementSeparator}${elementSeparator}${elementSeparator}${elementSeparator}${idType}${elementSeparator}${renderingId}${segmentTerminator}`,
      );

      // NTE - Additional Information (Pickup/Dropoff)
      segments.push(
        `NTE${elementSeparator}ADD${elementSeparator}PICKUP: ${line.pickupAddress} DROPOFF: ${line.dropoffAddress}${segmentTerminator}`,
      );
    });
  });

  // SE - Transaction Set Trailer
  segments.push(
    `SE${elementSeparator}${
      segments.length - 3 + 1
    }${elementSeparator}${transactionSetControlNumber}${segmentTerminator}`,
  );

  // GE - Functional Group Trailer
  segments.push(
    `GE${elementSeparator}1${elementSeparator}${groupControlNumber}${segmentTerminator}`,
  );

  // IEA - Interchange Control Trailer
  segments.push(
    `IEA${elementSeparator}1${elementSeparator}${interchangeControlNumber}${segmentTerminator}`,
  );

  return segments.join("");
}

/**
 * Generate downloadable 837P file
 */
export function generateDownloadable837P(data: Claim837PData): {
  content: string;
  filename: string;
} {
  const content = generate837P(data);
  const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const prefix =
    data.organization.billing_state === "CA" ? "CA_837P" : "MN_837P";
  const filename = `${prefix}_${data.organization.tax_id.replace(
    "-",
    "",
  )}_${timestamp}.txt`;

  return { content, filename };
}

/**
 * Download 837P file to user's computer
 */
export function download837PFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
