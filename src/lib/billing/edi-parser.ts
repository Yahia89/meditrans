/**
 * EDI Parser Utility for Medicaid Billing
 * Handles 999 (Acknowledgment) and 835 (Remittance) files.
 */

export interface EDIResponse {
  type: "999" | "835" | "277CA";
  status: "accepted" | "rejected" | "partial" | "paid";
  controlNumber?: string;
  metadata: Record<string, any>;
  claims: Array<{
    claimId: string;
    status: string;
    paidAmount?: number;
    patientName?: string;
    denialReason?: string;
  }>;
}

/**
 * Basic EDI parser for X12 segments
 */
export function parseX12(content: string) {
  const segments = content
    .split("~")
    .map((s) => s.trim())
    .filter(Boolean);
  return segments.map((seg) => seg.split("*"));
}

/**
 * Parses a 999 Implementation Acknowledgment
 */
export function parse999(content: string): EDIResponse {
  const segments = parseX12(content);
  let status: "accepted" | "rejected" = "rejected";
  let controlNumber = "";

  segments.forEach((seg) => {
    // AK1 - Group Response Header
    if (seg[0] === "AK1") {
      controlNumber = seg[2];
    }
    // AK9 - Functional Group Response Trailer
    if (seg[0] === "AK9") {
      // AK901: A = Accepted, E = Accepted with Errors, R = Rejected
      status = seg[1] === "A" || seg[1] === "E" ? "accepted" : "rejected";
    }
  });

  return {
    type: "999",
    status,
    controlNumber,
    metadata: { segments: segments.length },
    claims: [],
  };
}

/**
 * Parses an 835 Electronic Remittance Advice
 */
export function parse835(content: string): EDIResponse {
  const segments = parseX12(content);
  const claims: any[] = [];
  let currentClaim: any = null;

  segments.forEach((seg) => {
    // CLP - Claim Payment Information
    if (seg[0] === "CLP") {
      if (currentClaim) claims.push(currentClaim);
      currentClaim = {
        claimId: seg[1],
        status: seg[2], // 1=Processed, 2=Denied, 3=Pending, 4=Reversal
        paidAmount: parseFloat(seg[4]),
        totalCharge: parseFloat(seg[3]),
      };
    }
    // SVC - Service Line Information (if needed)
    // NM1 - Patient Name
    if (seg[0] === "NM1" && seg[1] === "QC") {
      if (currentClaim) currentClaim.patientName = `${seg[4]} ${seg[3]}`;
    }
    // CAS - Claim Adjustment (Denial Reasons)
    if (seg[0] === "CAS" && currentClaim) {
      currentClaim.denialReason = `${seg[2]}: ${seg[3]}`; // Group code + Reason code
    }
  });

  if (currentClaim) claims.push(currentClaim);

  const allPaid = claims.every((c) => c.status === "1");
  const allDenied = claims.every((c) => c.status === "2");

  return {
    type: "835",
    status: allPaid ? "paid" : allDenied ? "rejected" : "partial",
    metadata: { totalClaims: claims.length },
    claims,
  };
}

/**
 * Generic response parser
 */
export function parseEDIContent(content: string): EDIResponse {
  if (content.includes("AK1*")) return parse999(content);
  if (content.includes("CLP*")) return parse835(content);
  // Default/Fallback
  return {
    type: "999",
    status: "rejected",
    metadata: { error: "Unknown EDI type" },
    claims: [],
  };
}
