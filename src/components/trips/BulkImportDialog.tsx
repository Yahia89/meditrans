/**
 * BulkImportDialog - Main dialog for bulk importing trips from broker templates
 */

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDropzone } from "react-dropzone";
import {
  UploadSimple,
  FileArrowUp,
  X,
  CheckCircle,
  ArrowLeft,
  CloudArrowUp,
  FileText,
  Sparkle,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TripImportRow } from "./broker-templates";
import { BROKER_TEMPLATES } from "./broker-templates";
import {
  parseFile,
  mapDataToTemplate,
  validateImportData,
} from "./file-parser";
import { BulkImportDataGrid } from "./BulkImportDataGrid";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type Step = "template-selection" | "file-upload" | "data-review" | "importing";

export function BulkImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: BulkImportDialogProps) {
  const { currentOrganization } = useOrganization();
  const [step, setStep] = useState<Step>("template-selection");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<TripImportRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");

  // File dropzone
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      setUploadedFile(file);
      setIsProcessing(true);

      try {
        // Parse the file
        const parseResult = await parseFile(file);

        if (parseResult.errors.length > 0) {
          toast.error("File contains parsing errors", {
            description: parseResult.errors.slice(0, 3).join(", "),
          });
        }

        // Map data to template
        const mappedData = mapDataToTemplate(
          parseResult.data,
          selectedTemplate,
        );

        // Validate data
        const { valid, invalid } = validateImportData(mappedData);

        setImportData([...valid, ...invalid]);
        setStep("data-review");

        toast.success("File uploaded successfully", {
          description: `Loaded ${mappedData.length} rows. ${valid.length} valid, ${invalid.length} need attention.`,
        });
      } catch (error) {
        toast.error("Failed to parse file", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
        setUploadedFile(null);
      } finally {
        setIsProcessing(false);
      }
    },
    [selectedTemplate],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
    },
    multiple: false,
    disabled: !selectedTemplate || isProcessing,
  });

  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    setStep("file-upload");
  };

  // Handle data change from grid
  const handleDataChange = (updatedData: TripImportRow[]) => {
    setImportData(updatedData);
  };

  // Submit trips to database
  const handleSubmit = async () => {
    if (!currentOrganization) {
      toast.error("No organization selected");
      return;
    }

    // Only submit valid rows
    const validRows = importData.filter(
      (row) => !row._validation_errors || row._validation_errors.length === 0,
    );

    if (validRows.length === 0) {
      toast.error("No valid rows to import", {
        description: "Please fix validation errors before submitting.",
      });
      return;
    }

    setStep("importing");
    setIsProcessing(true);

    try {
      // First, we need to match or create patients
      const tripsToInsert = [];

      for (const row of validRows) {
        // Try to find existing patient by name or create new one
        let patientId: string | null = null;

        if (
          row.patient_full_name ||
          (row.patient_first_name && row.patient_last_name)
        ) {
          const firstName =
            row.patient_first_name ||
            row.patient_full_name?.split(" ")[0] ||
            "";
          const lastName =
            row.patient_last_name ||
            row.patient_full_name?.split(" ").slice(1).join(" ") ||
            "";

          // Check if patient exists
          const { data: existingPatients } = await supabase
            .from("patients")
            .select("id")
            .eq("org_id", currentOrganization.id)
            .ilike("first_name", firstName)
            .ilike("last_name", lastName)
            .limit(1);

          if (existingPatients && existingPatients.length > 0) {
            patientId = existingPatients[0].id;
          } else {
            // Create new patient
            const { data: newPatient, error: patientError } = await supabase
              .from("patients")
              .insert({
                org_id: currentOrganization.id,
                first_name: firstName,
                last_name: lastName,
                phone: row.patient_phone || null,
                date_of_birth: row.patient_dob || null,
              })
              .select("id")
              .single();

            if (patientError) {
              console.error("Error creating patient:", patientError);
              continue;
            }

            patientId = newPatient.id;
          }
        }

        // Prepare trip data
        const tripData = {
          org_id: currentOrganization.id,
          patient_id: patientId,
          pickup_location: row.pickup_address || "",
          dropoff_location: row.dropoff_address || "",
          scheduled_time:
            row.trip_date && row.pickup_time
              ? new Date(`${row.trip_date}T${row.pickup_time}`).toISOString()
              : row.trip_date
                ? new Date(row.trip_date).toISOString()
                : new Date().toISOString(),
          pickup_time:
            row.trip_date && row.pickup_time
              ? new Date(`${row.trip_date}T${row.pickup_time}`).toISOString()
              : null,
          trip_type: row.trip_type || "one_way",
          notes: row.notes || null,
          distance_miles: row.distance_miles
            ? parseFloat(row.distance_miles)
            : null,
          duration_minutes: row.duration_minutes
            ? parseFloat(row.duration_minutes)
            : null,
          status: "pending",
        };

        tripsToInsert.push(tripData);
      }

      // Batch insert trips
      const { data: insertedTrips, error: insertError } = await supabase
        .from("trips")
        .insert(tripsToInsert)
        .select();

      if (insertError) {
        throw insertError;
      }

      toast.success("Trips imported successfully!", {
        description: `Successfully imported ${insertedTrips?.length || 0} trips.`,
      });

      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Error importing trips:", error);
      toast.error("Failed to import trips", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      setStep("data-review");
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset and close
  const handleClose = () => {
    setStep("template-selection");
    setSelectedTemplate("");
    setUploadedFile(null);
    setImportData([]);
    setIsProcessing(false);
    onOpenChange(false);
  };

  // Go back to previous step
  const handleBack = () => {
    if (step === "file-upload") {
      setStep("template-selection");
      setSelectedTemplate("");
    } else if (step === "data-review") {
      setStep("file-upload");
      setUploadedFile(null);
      setImportData([]);
    }
  };

  const validCount = importData.filter(
    (row) => !row._validation_errors?.length,
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] flex flex-col p-0 border-none shadow-2xl rounded-2xl bg-white overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-8 pt-8 pb-8 border-b border-slate-100 bg-white">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#3D5A3D]/10 flex items-center justify-center text-[#3D5A3D] mb-4">
              <CloudArrowUp size={36} weight="bold" />
            </div>
            <DialogTitle className="text-3xl font-bold text-slate-900 tracking-tight">
              Bulk Trip Import
            </DialogTitle>
            <p className="text-slate-500 mt-2 max-w-xl text-base">
              {step === "template-selection" &&
                "Select your broker's template to begin your import process."}
              {step === "file-upload" &&
                "Upload your file and we'll automatically map the fields for you."}
              {step === "data-review" &&
                "Review and verify the data before finalizing the import."}
              {step === "importing" &&
                "We're processing your trips and adding them to your organization."}
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center justify-center gap-4 mt-8 max-w-3xl mx-auto w-full px-4">
            {["template-selection", "file-upload", "data-review"].map(
              (s, idx) => {
                const stepIndex = [
                  "template-selection",
                  "file-upload",
                  "data-review",
                  "importing",
                ].indexOf(step);
                const isCompleted = idx < stepIndex;
                const isActive = step === s;

                return (
                  <div
                    key={s}
                    className="flex items-center flex-1 last:flex-none"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div
                        className={cn(
                          "flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold transition-all border-2",
                          isActive
                            ? "bg-[#3D5A3D] text-white border-[#3D5A3D] shadow-sm"
                            : isCompleted
                              ? "bg-white text-[#65a30d] border-[#65a30d]"
                              : "bg-white text-slate-400 border-slate-200",
                        )}
                      >
                        {isCompleted ? (
                          <CheckCircle size={24} weight="fill" />
                        ) : (
                          <span>{idx + 1}</span>
                        )}
                      </div>
                      <span
                        className={cn(
                          "text-[10px] uppercase font-bold tracking-wider",
                          isActive ? "text-[#3D5A3D]" : "text-slate-400",
                        )}
                      >
                        {s.replace("-", " ")}
                      </span>
                    </div>
                    {idx < 2 && (
                      <div
                        className={cn(
                          "flex-1 h-0.5 mx-4 -mt-6 rounded-full transition-all",
                          isCompleted ? "bg-[#65a30d]" : "bg-slate-200",
                        )}
                      />
                    )}
                  </div>
                );
              },
            )}
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {step === "template-selection" && (
            <div className="p-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-1">
                    Select Broker Template
                  </h3>
                  <p className="text-sm text-slate-600">
                    Choose the template that matches your broker's file format.
                  </p>
                </div>
                <div className="relative w-full md:w-72">
                  <MagnifyingGlass
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <Input
                    placeholder="Search templates..."
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    className="pl-10 bg-white border-slate-200 focus:ring-indigo-500 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-8">
                {BROKER_TEMPLATES.filter(
                  (t) =>
                    t.displayName
                      .toLowerCase()
                      .includes(templateSearch.toLowerCase()) ||
                    t.id.toLowerCase().includes(templateSearch.toLowerCase()),
                ).map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template.id)}
                    className={cn(
                      "group relative p-5 bg-white border border-slate-200 rounded-2xl transition-all text-left flex flex-col h-full",
                      selectedTemplate === template.id
                        ? "border-[#3D5A3D] bg-[#3D5A3D]/5 ring-1 ring-[#3D5A3D]/20 shadow-sm"
                        : "hover:border-slate-300 hover:shadow-sm",
                    )}
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div
                        className={cn(
                          "p-3 rounded-xl transition-colors",
                          selectedTemplate === template.id
                            ? "bg-[#3D5A3D] text-white"
                            : "bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600",
                        )}
                      >
                        <FileText size={24} weight="bold" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 group-hover:text-[#3D5A3D] transition-colors truncate text-sm">
                          {template.displayName}
                        </h4>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mt-0.5">
                          {template.id.includes("template")
                            ? "BROKER"
                            : "CUSTOM"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-auto flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#65a30d]" />
                        <span className="font-medium">
                          {template.fields.length} fields
                        </span>
                      </div>
                      <div className="px-2.5 py-1 bg-slate-50 rounded-lg text-slate-600 font-bold border border-slate-100">
                        {template.fields.filter((f) => f.required).length}{" "}
                        Required
                      </div>
                    </div>
                  </button>
                ))}
                {BROKER_TEMPLATES.filter(
                  (t) =>
                    t.displayName
                      .toLowerCase()
                      .includes(templateSearch.toLowerCase()) ||
                    t.id.toLowerCase().includes(templateSearch.toLowerCase()),
                ).length === 0 && (
                  <div className="col-span-full py-20 text-center">
                    <div className="bg-slate-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                      <MagnifyingGlass size={32} className="text-slate-300" />
                    </div>
                    <h3 className="text-slate-900 font-medium">
                      No templates found
                    </h3>
                    <p className="text-slate-500 text-sm mt-1">
                      Try a different search term
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "file-upload" && (
            <div className="p-8 flex items-center justify-center h-full">
              <div className="w-full max-w-2xl">
                <div
                  {...getRootProps()}
                  className={cn(
                    "relative border border-slate-200 rounded-3xl p-16 transition-all cursor-pointer bg-slate-50/50",
                    isDragActive
                      ? "border-[#3D5A3D] bg-[#3D5A3D]/5"
                      : "hover:border-slate-300 hover:bg-slate-100/50",
                  )}
                >
                  <input {...getInputProps()} />

                  <div className="flex flex-col items-center gap-6 text-center">
                    <div className="w-20 h-20 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-[#3D5A3D]">
                      {isProcessing ? (
                        <Loader2 size={40} className="animate-spin" />
                      ) : isDragActive ? (
                        <FileArrowUp size={40} weight="bold" />
                      ) : (
                        <UploadSimple size={40} weight="bold" />
                      )}
                    </div>

                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 mb-2">
                        {isProcessing
                          ? "Processing your file..."
                          : isDragActive
                            ? "Drop your file here"
                            : "Upload Trip Data File"}
                      </h3>
                      <p className="text-slate-600 mb-6 max-w-sm mx-auto">
                        {isProcessing
                          ? "Please wait while we parse and validate your data."
                          : "Drag and drop your CSV, XLS, or XLSX file here, or click to browse."}
                      </p>

                      {selectedTemplate && (
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#3D5A3D]/20 text-[#3D5A3D] rounded-xl text-sm font-bold shadow-sm">
                          <Sparkle size={18} weight="bold" />
                          <span>Template:</span>
                          <span className="opacity-80">
                            {
                              BROKER_TEMPLATES.find(
                                (t) => t.id === selectedTemplate,
                              )?.displayName
                            }
                          </span>
                        </div>
                      )}
                    </div>

                    {!isProcessing && (
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>CSV</span>
                        <span>•</span>
                        <span>XLS</span>
                        <span>•</span>
                        <span>XLSX</span>
                      </div>
                    )}
                  </div>
                </div>

                {uploadedFile && (
                  <div className="mt-4 flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText
                        size={24}
                        weight="duotone"
                        className="text-emerald-600"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {uploadedFile.name}
                        </p>
                        <p className="text-xs text-slate-600">
                          {(uploadedFile.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUploadedFile(null)}
                      className="hover:bg-emerald-100"
                    >
                      <X size={18} />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "data-review" && (
            <div className="h-full p-6">
              <BulkImportDataGrid
                data={importData}
                onDataChange={handleDataChange}
              />
            </div>
          )}

          {step === "importing" && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2
                  size={56}
                  className="text-indigo-600 animate-spin mx-auto mb-6"
                />
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Importing Trips...
                </h3>
                <p className="text-sm text-slate-600">
                  Creating {validCount} trips in your organization
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-8 py-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step !== "template-selection" && step !== "importing" && (
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isProcessing}
                className="gap-2"
              >
                <ArrowLeft size={16} />
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isProcessing}
            >
              Cancel
            </Button>

            {step === "data-review" && (
              <Button
                onClick={handleSubmit}
                disabled={validCount === 0 || isProcessing}
                className="bg-[#3D5A3D] hover:bg-[#2E4A2E] text-white gap-2 px-8 h-11 rounded-xl font-bold transition-all shadow-sm"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <CheckCircle size={20} weight="bold" />
                    Import {validCount} {validCount === 1 ? "Trip" : "Trips"}
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
