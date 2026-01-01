import { useEffect, useState } from "react";
import { useQueryState } from "nuqs";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import {
  Loader2,
  Check,
  AlertTriangle,
  ArrowLeft,
  FileText,
  Database,
  CheckCircle,
  XCircle,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadReviewPageProps {
  onBack: () => void;
}

type StagingRow = {
  id: string;
  row_index: number;
  status: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  metadata: Record<string, any>;
  raw_data: Record<string, any> | null;
  validation_errors: any;
};

export function UploadReviewPage({ onBack }: UploadReviewPageProps) {
  const { currentOrganization } = useOrganization();
  const { refreshUploadHistory, refreshDataCounts } = useOnboarding();
  const [uploadId] = useQueryState("upload_id");
  const [uploadRec, setUploadRec] = useState<any>(null);
  const [stagingRows, setStagingRows] = useState<StagingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [commitResult, setCommitResult] = useState<{
    success: number;
    errors: number;
  } | null>(null);
  const [showRawData, setShowRawData] = useState<string | null>(null);

  useEffect(() => {
    if (uploadId && currentOrganization) {
      loadData(uploadId);
    }
  }, [uploadId, currentOrganization]);

  async function loadData(id: string) {
    setLoading(true);
    try {
      // 1. Fetch Upload Record
      const { data: upload, error: uploadError } = await supabase
        .from("org_uploads")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (uploadError) throw uploadError;
      if (!upload) {
        console.error("Upload record not found for ID:", id);
        setUploadRec(null);
        return;
      }
      setUploadRec(upload);

      // 2. Fetch Staging Data
      const { data: rows, error: rowsError } = await supabase
        .from("staging_records")
        .select("*")
        .eq("upload_id", id)
        .order("row_index", { ascending: true });

      if (rowsError) throw rowsError;
      setStagingRows((rows || []) as StagingRow[]);

      // Pre-select valid rows
      const validIds = (rows || [])
        .filter((r) => r.status === "pending" && r.full_name)
        .map((r) => r.id);
      setSelectedRows(new Set(validIds));
    } catch (err) {
      console.error("Failed to load review data", err);
    } finally {
      setLoading(false);
    }
  }

  const toggleRow = (id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    const validIds = stagingRows.filter((r) => r.full_name).map((r) => r.id);
    setSelectedRows(new Set(validIds));
  };

  const selectNone = () => {
    setSelectedRows(new Set());
  };

  async function handleCommit() {
    if (!uploadRec || selectedRows.size === 0) return;

    setCommitting(true);
    setCommitResult(null);

    // Helper to convert various date formats (Excel serial, MM/DD/YYYY) to YYYY-MM-DD
    const normalizeDate = (val: string | number | null): string | null => {
      if (!val) return null;

      // Handle valid ISO string
      if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val))
        return val;

      let dateObj: Date | null = null;

      // 1. Handle Excel Serial Date (e.g. 44562)
      // Excel base date is Dec 30, 1899 (mostly).
      // If numeric string or number
      if (!isNaN(Number(val))) {
        const serial = Number(val);
        // Roughly check if it's a reasonable Excel date (mostly > 1000)
        if (serial > 1000) {
          // (Serial - 25569) * 86400 * 1000
          dateObj = new Date(Math.round((serial - 25569) * 864e5));
        }
      }

      // 2. Handle string formats (MM/DD/YYYY, etc.)
      if (!dateObj && typeof val === "string") {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          dateObj = d;
        }
      }

      if (dateObj && !isNaN(dateObj.getTime())) {
        return dateObj.toISOString().split("T")[0];
      }

      return null; // Could not parse
    };

    try {
      const rowsToCommit = stagingRows.filter((r) => selectedRows.has(r.id));
      const targetTable = uploadRec.source as
        | "drivers"
        | "patients"
        | "employees";

      let successCount = 0;
      let errorCount = 0;

      for (const row of rowsToCommit) {
        try {
          // Build the record for the target table
          const baseData: Record<string, any> = {
            org_id: currentOrganization?.id,
            full_name: row.full_name,
            email: row.email,
            phone: row.phone,
          };

          // Type-specific fields from metadata - Expanded to match new schema
          if (targetTable === "drivers") {
            baseData.license_number = row.metadata?.license_number;
            baseData.id_number = row.metadata?.id_number;
            baseData.address = row.metadata?.address;
            baseData.county = row.metadata?.county;
            baseData.vehicle_type = row.metadata?.vehicle_type;
            baseData.vehicle_make = row.metadata?.vehicle_make;
            baseData.vehicle_model = row.metadata?.vehicle_model;
            baseData.vehicle_color = row.metadata?.vehicle_color;
            baseData.license_plate = row.metadata?.license_plate;
            baseData.dot_medical_number = row.metadata?.dot_medical_number;
            baseData.dot_medical_expiration = normalizeDate(
              row.metadata?.dot_medical_expiration
            );
            baseData.insurance_company = row.metadata?.insurance_company;
            baseData.insurance_policy_number =
              row.metadata?.insurance_policy_number;
            baseData.insurance_start_date = normalizeDate(
              row.metadata?.insurance_start_date
            );
            baseData.insurance_expiration_date = normalizeDate(
              row.metadata?.insurance_expiration_date
            );
            baseData.inspection_date = normalizeDate(
              row.metadata?.inspection_date
            );
            baseData.driver_record_issue_date = normalizeDate(
              row.metadata?.driver_record_issue_date
            );
            baseData.driver_record_expiration = normalizeDate(
              row.metadata?.driver_record_expiration
            );
            baseData.notes = row.metadata?.notes;
            baseData.vehicle_info = row.metadata?.vehicle_info;
          } else if (targetTable === "patients") {
            // Support both 'dob' and 'date_of_birth'
            baseData.date_of_birth = normalizeDate(
              row.metadata?.dob || row.metadata?.date_of_birth
            );
            baseData.dob = baseData.date_of_birth; // Keep consistent
            baseData.primary_address = row.metadata?.primary_address;
            baseData.county = row.metadata?.county;
            baseData.waiver_type = row.metadata?.waiver_type;
            baseData.referral_by = row.metadata?.referral_by;
            baseData.referral_date = normalizeDate(row.metadata?.referral_date);
            baseData.referral_expiration_date = normalizeDate(
              row.metadata?.referral_expiration_date
            );
            baseData.service_type = row.metadata?.service_type;
            baseData.case_manager = row.metadata?.case_manager;
            baseData.case_manager_phone = row.metadata?.case_manager_phone;
            baseData.monthly_credit = row.metadata?.monthly_credit
              ? parseFloat(row.metadata.monthly_credit)
              : null;
            baseData.credit_used_for = row.metadata?.credit_used_for;
            baseData.vehicle_type_need = row.metadata?.vehicle_type_need;
            baseData.notes = row.metadata?.notes;
          } else if (targetTable === "employees") {
            baseData.role = row.metadata?.role;
            baseData.department = row.metadata?.department;
            baseData.hire_date = normalizeDate(row.metadata?.hire_date);
          }

          // Preserve unmapped data in custom_fields
          const mappedKeys = new Set([
            "full_name",
            "email",
            "phone",
            "license_number",
            "vehicle_info",
            "date_of_birth",
            "dob",
            "primary_address",
            "role",
            "department",
            "notes",
            "id_number",
            "address",
            "county",
            "vehicle_type",
            "vehicle_make",
            "vehicle_model",
            "vehicle_color",
            "license_plate",
            "dot_medical_number",
            "dot_medical_expiration",
            "insurance_company",
            "insurance_policy_number",
            "insurance_start_date",
            "insurance_expiration_date",
            "inspection_date",
            "driver_record_issue_date",
            "driver_record_expiration",
            "waiver_type",
            "referral_by",
            "referral_date",
            "referral_expiration_date",
            "service_type",
            "case_manager",
            "case_manager_phone",
            "monthly_credit",
            "credit_used_for",
            "vehicle_type_need",
          ]);

          if (row.raw_data) {
            const customFields: Record<string, any> = {};
            Object.entries(row.raw_data).forEach(([key, value]) => {
              const normalizedKey = key
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "_");
              if (!mappedKeys.has(normalizedKey) && value) {
                customFields[key] = value;
              }
            });
            if (Object.keys(customFields).length > 0) {
              baseData.custom_fields = customFields;
            }
          }

          // Insert into target table
          const { error: insertError } = await supabase
            .from(targetTable)
            .insert(baseData);

          if (insertError) throw insertError;

          // Update staging row status
          await supabase
            .from("staging_records")
            .update({ status: "committed" })
            .eq("id", row.id);

          successCount++;
        } catch (err) {
          console.error("Failed to commit row:", row.id, err);
          errorCount++;
        }
      }

      // Update upload record
      const allCommitted = stagingRows.every(
        (r) =>
          selectedRows.has(r.id) ||
          r.status === "committed" ||
          r.status === "error"
      );

      await supabase
        .from("org_uploads")
        .update({
          status: allCommitted ? "committed" : "ready_for_review",
          notes: `Committed ${successCount} records. ${errorCount} errors.`,
          committed_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq("id", uploadRec.id);

      setCommitResult({ success: successCount, errors: errorCount });

      // Refresh contexts and reload data
      await Promise.all([refreshUploadHistory(), refreshDataCounts()]);
      if (uploadId) await loadData(uploadId);
    } catch (err) {
      console.error("Commit failed:", err);
    } finally {
      setCommitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!uploadRec) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold">Upload not found</h2>
        <Button onClick={onBack} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  const validCount = stagingRows.filter(
    (r) => r.full_name && r.status !== "committed"
  ).length;
  const committedCount = stagingRows.filter(
    (r) => r.status === "committed"
  ).length;
  const errorCount = stagingRows.filter(
    (r) => !r.full_name || r.status === "error"
  ).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Review & Commit
              </h1>
              <p className="text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {uploadRec.original_filename}
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase font-semibold">
                  {uploadRec.source}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onBack}>
              Cancel
            </Button>
            <Button
              onClick={handleCommit}
              disabled={committing || selectedRows.size === 0}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {committing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />{" "}
                  Committing...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" /> Commit {selectedRows.size}{" "}
                  Records
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Commit Result Banner */}
        {commitResult && (
          <div
            className={cn(
              "p-4 rounded-xl flex items-center gap-3",
              commitResult.errors > 0
                ? "bg-amber-50 border border-amber-200 text-amber-800"
                : "bg-green-50 border border-green-200 text-green-800"
            )}
          >
            <CheckCircle className="h-5 w-5" />
            <span>
              Successfully committed <strong>{commitResult.success}</strong>{" "}
              records.
              {commitResult.errors > 0 && ` ${commitResult.errors} failed.`}
            </span>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-slate-800">
                {stagingRows.length}
              </div>
              <div className="text-sm text-slate-500">Total Rows</div>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-green-700">
                {validCount}
              </div>
              <div className="text-sm text-green-600">Ready to Commit</div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-blue-700">
                {committedCount}
              </div>
              <div className="text-sm text-blue-600">Already Committed</div>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-red-700">
                {errorCount}
              </div>
              <div className="text-sm text-red-600">Missing Required Data</div>
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Staging Records</CardTitle>
              <CardDescription>
                Select records to commit to the {uploadRec.source} table
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select All Valid
              </Button>
              <Button variant="outline" size="sm" onClick={selectNone}>
                Clear Selection
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-slate-50 z-10">
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    {uploadRec.source === "drivers" && (
                      <>
                        <TableHead>License</TableHead>
                        <TableHead>Vehicle</TableHead>
                      </>
                    )}
                    {uploadRec.source === "patients" && (
                      <>
                        <TableHead>DOB</TableHead>
                        <TableHead>Address</TableHead>
                      </>
                    )}
                    {uploadRec.source === "employees" && (
                      <>
                        <TableHead>Role</TableHead>
                        <TableHead>Department</TableHead>
                      </>
                    )}
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16">Raw</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stagingRows.map((row) => {
                    const isSelected = selectedRows.has(row.id);
                    const isCommitted = row.status === "committed";
                    const hasError = !row.full_name || row.status === "error";

                    return (
                      <TableRow
                        key={row.id}
                        className={cn(
                          isCommitted && "bg-green-50/50 opacity-60",
                          hasError && "bg-red-50/30",
                          isSelected && !isCommitted && "bg-indigo-50"
                        )}
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(row.id)}
                            disabled={isCommitted || !row.full_name}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {row.row_index + 1}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "font-medium",
                            !row.full_name && "text-red-500"
                          )}
                        >
                          {row.full_name || (
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Missing
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{row.email || "—"}</TableCell>
                        <TableCell>{row.phone || "—"}</TableCell>
                        {uploadRec.source === "drivers" && (
                          <>
                            <TableCell>
                              {row.metadata?.license_number || "—"}
                            </TableCell>
                            <TableCell>
                              {row.metadata?.vehicle_info || "—"}
                            </TableCell>
                          </>
                        )}
                        {uploadRec.source === "patients" && (
                          <>
                            <TableCell>
                              {row.metadata?.date_of_birth || "—"}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {row.metadata?.primary_address || "—"}
                            </TableCell>
                          </>
                        )}
                        {uploadRec.source === "employees" && (
                          <>
                            <TableCell>{row.metadata?.role || "—"}</TableCell>
                            <TableCell>
                              {row.metadata?.department || "—"}
                            </TableCell>
                          </>
                        )}
                        <TableCell>
                          <span
                            className={cn(
                              "px-2 py-1 rounded-full text-xs font-semibold",
                              row.status === "committed" &&
                                "bg-green-100 text-green-700",
                              row.status === "pending" &&
                                row.full_name &&
                                "bg-blue-100 text-blue-700",
                              row.status === "error" ||
                                (!row.full_name && "bg-red-100 text-red-700")
                            )}
                          >
                            {row.status === "committed"
                              ? "Committed"
                              : !row.full_name
                              ? "Invalid"
                              : "Pending"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setShowRawData(
                                showRawData === row.id ? null : row.id
                              )
                            }
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Raw Data Modal */}
        {showRawData && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
              <div className="p-4 border-b flex items-center justify-between bg-slate-50">
                <h3 className="font-semibold flex items-center gap-2">
                  <Database className="h-4 w-4 text-indigo-600" />
                  Raw Import Data
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRawData(null)}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-4 overflow-auto max-h-[60vh]">
                <pre className="text-sm bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto">
                  {JSON.stringify(
                    stagingRows.find((r) => r.id === showRawData)?.raw_data,
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
