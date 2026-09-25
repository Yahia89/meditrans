import { useState } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FilePdf,
  User,
  Shield,
  DownloadSimple,
  CircleNotch,
  MagnifyingGlass,
  UsersThree,
  CheckSquare,
  Square,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useTimezone } from "@/hooks/useTimezone";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// Summary module
import { SummaryFilters } from "./summary/SummaryFilters";
import { SummaryPreview } from "./summary/SummaryPreview";
import { useSummaryData } from "./summary/useSummaryData";
import { generateSummaryPDF } from "./summary/pdf-generator";
import { generateConnectAbilityPDF } from "./summary/connectability-pdf-generator";
import { isConnectAbilityOnlyFilter } from "./summary/connectability-utils";
import type { FilterState } from "./summary/types";

export function SummaryPage() {
  const { currentOrganization, userRole } = useOrganization();
  const { user, profile } = useAuth();
  const timezone = useTimezone();

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Centralized filter state
  const [filters, setFilters] = useState<FilterState>({
    startDate: format(new Date(), "yyyy-MM-01"),
    endDate: format(new Date(), "yyyy-MM-dd"),
    selectedVehicleTypes: [],
    selectedWaiverTypes: [],
    selectedReferredBy: [],
    selectedSalStatuses: [],
    selectedTripPurposes: [],
    selectedTripStatuses: [],
    selectedConnectAbilityPatients: [],
  });

  const handleFilterChange = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    resetGenerated();
  };

  const {
    trips,
    matchedPatientCount,
    isFetching,
    hasGenerated,
    hasFilters,
    fetchData,
    resetGenerated,
    referredByOptions,
    referredByLoading,
    orgFees,
    connectAbilityPatients,
  } = useSummaryData({
    orgId: currentOrganization?.id,
    filters,
    timezone,
  });

  // Detect when the user is filtering exclusively for ConnectAbility clients
  const isConnectAbilityMode = isConnectAbilityOnlyFilter(filters.selectedReferredBy);

  // Toggle a single patient in the CA patient selection
  const toggleCaPatient = (name: string) => {
    const current = filters.selectedConnectAbilityPatients;
    const next = current.includes(name)
      ? current.filter((n) => n !== name)
      : [...current, name];
    setFilters((prev) => ({ ...prev, selectedConnectAbilityPatients: next }));
  };

  // Select all / deselect all CA patients (without resetting generated state)
  const toggleAllCaPatients = () => {
    const allSelected =
      connectAbilityPatients.length > 0 &&
      connectAbilityPatients.every((n) =>
        filters.selectedConnectAbilityPatients.includes(n)
      );
    setFilters((prev) => ({
      ...prev,
      selectedConnectAbilityPatients: allSelected ? [] : [...connectAbilityPatients],
    }));
  };

  const handleGeneratePDF = async () => {
    if (!trips || trips.length === 0) {
      toast.error("No trips found for the selected criteria");
      return;
    }

    // ConnectAbility invoices only include completed trips
    if (isConnectAbilityMode) {
      const completedCount = trips.filter((t) => t.status === "completed").length;
      if (completedCount === 0) {
        toast.error("No completed trips found — ConnectAbility invoices only bill completed trips");
        return;
      }
    }

    setIsGeneratingPDF(true);
    try {
      if (isConnectAbilityMode) {
        generateConnectAbilityPDF({
          trips,
          filters,
          timezone,
          orgName: currentOrganization?.name || "MediTrans",
          // orgAddress and orgPhone can be added when those fields exist on the org
          generatedBy: profile?.full_name || user?.email || "Unknown",
          userRole: userRole || "Admin",
          orgFees,
        });
      } else {
        generateSummaryPDF({
          trips,
          filters,
          timezone,
          orgName: currentOrganization?.name || "MediTrans",
          generatedBy: profile?.full_name || user?.email || "Unknown",
          userRole: userRole || "Admin",
        });
      }
      toast.success("Summary generated successfully");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF summary");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const caPatientCount = filters.selectedConnectAbilityPatients.length;
  const allCaSelected =
    connectAbilityPatients.length > 0 &&
    connectAbilityPatients.every((n) =>
      filters.selectedConnectAbilityPatients.includes(n)
    );

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <FilePdf size={32} weight="duotone" className="text-[#3D5A3D]" />
          Trips Summary
        </h1>
        <p className="text-slate-500">
          Generate detailed PDF reports for trips within a selected period.
          Apply filters to narrow results by patient category or trip purpose.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Filters + Generate */}
        <div className="lg:col-span-1 space-y-5">
          <SummaryFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            referredByOptions={referredByOptions}
            referredByLoading={referredByLoading}
          />

          {/* ── ConnectAbility Patient Picker ───────────────────────────── */}
          {isConnectAbilityMode && hasGenerated && connectAbilityPatients.length > 0 && (
            <Card className="border-emerald-200 shadow-sm rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
              <CardHeader className="bg-emerald-50/80 border-b border-emerald-100 py-3 px-4">
                <CardTitle className="text-sm flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-emerald-900">
                    <UsersThree size={16} weight="bold" className="text-emerald-600" />
                    Patients
                    {caPatientCount > 0 && (
                      <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                        {caPatientCount} selected
                      </span>
                    )}
                  </span>
                  <button
                    onClick={toggleAllCaPatients}
                    className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-900 underline underline-offset-2 transition-colors"
                  >
                    {allCaSelected ? "Deselect all" : "Select all"}
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-emerald-50 max-h-64 overflow-y-auto">
                  {connectAbilityPatients.map((name) => {
                    const checked = filters.selectedConnectAbilityPatients.includes(name);
                    const patientTrips = trips.filter(
                      (t) => t.patient?.full_name === name
                    ).length;
                    return (
                      <button
                        key={name}
                        onClick={() => toggleCaPatient(name)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors text-sm",
                          checked
                            ? "bg-emerald-50 text-emerald-900"
                            : "hover:bg-slate-50 text-slate-700"
                        )}
                      >
                        {checked ? (
                          <CheckSquare size={16} weight="fill" className="text-emerald-600 shrink-0" />
                        ) : (
                          <Square size={16} className="text-slate-300 shrink-0" />
                        )}
                        <span className="flex-1 font-medium truncate">{name}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {patientTrips} trip{patientTrips !== 1 ? "s" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {caPatientCount > 0 && (
                  <div className="px-4 py-2 border-t border-emerald-100 bg-emerald-50/50">
                    <p className="text-[10px] text-emerald-700 font-medium">
                      PDF will include only the selected patient{caPatientCount !== 1 ? "s" : ""}.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* ConnectAbility mode indicator */}
            {isConnectAbilityMode && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-xs font-semibold text-emerald-800">
                  ConnectAbility invoice format active
                </span>
              </div>
            )}

            <Button
              onClick={fetchData}
              disabled={isFetching}
              className={cn(
                "w-full rounded-xl h-12 gap-2 shadow-lg transition-all font-bold text-sm",
                hasGenerated && trips.length > 0
                  ? "bg-slate-700 hover:bg-slate-800 text-white shadow-slate-300/30"
                  : "bg-[#3D5A3D] hover:bg-[#2E4A2E] text-white shadow-[#3D5A3D]/20",
              )}
            >
              {isFetching ? (
                <>
                  <CircleNotch size={18} className="animate-spin" />
                  Fetching Data...
                </>
              ) : (
                <>
                  <MagnifyingGlass size={18} weight="bold" />
                  {hasGenerated ? "Regenerate Results" : "Generate Results"}
                </>
              )}
            </Button>

            {hasGenerated && trips.length > 0 && (
              <Button
                onClick={handleGeneratePDF}
                disabled={isGeneratingPDF}
                className="w-full bg-[#3D5A3D] hover:bg-[#2E4A2E] text-white rounded-xl h-12 gap-2 shadow-lg shadow-[#3D5A3D]/20 transition-all font-bold text-sm animate-in fade-in slide-in-from-top-2 duration-300"
              >
                {isGeneratingPDF ? (
                  <>
                    <CircleNotch size={18} className="animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <DownloadSimple size={18} weight="bold" />
                    {isConnectAbilityMode
                      ? `Download Invoice${caPatientCount > 0 ? ` (${caPatientCount} patient${caPatientCount !== 1 ? "s" : ""})` : ` (${trips.length} trips)`}`
                      : `Download PDF (${trips.length} trips)`}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Right Column: Preview */}
        <div className="lg:col-span-2">
          <SummaryPreview
            trips={trips}
            hasGenerated={hasGenerated}
            isFetching={isFetching}
            hasFilters={hasFilters}
            matchedPatientCount={matchedPatientCount}
            timezone={timezone}
            isConnectAbilityMode={isConnectAbilityMode}
            orgFees={orgFees}
          />
        </div>
      </div>

      {/* Footer Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-slate-200 shadow-sm rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                <Shield size={24} weight="duotone" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Authorized Access</h3>
                <p className="text-sm text-slate-500">
                  This summary tool is restricted to Owners, Admins, and
                  Dispatchers only.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                <User size={24} weight="duotone" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">
                  Personalized Report
                </h3>
                <p className="text-sm text-slate-500">
                  Reports include the generator's details, applied filters, and
                  timestamps for auditing purposes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
