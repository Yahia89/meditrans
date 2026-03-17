import { useState } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  FilePdf,
  User,
  Shield,
  DownloadSimple,
  CircleNotch,
  MagnifyingGlass,
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
  } = useSummaryData({
    orgId: currentOrganization?.id,
    filters,
    timezone,
  });

  const handleGeneratePDF = async () => {
    if (!trips || trips.length === 0) {
      toast.error("No trips found for the selected criteria");
      return;
    }

    setIsGeneratingPDF(true);
    try {
      generateSummaryPDF({
        trips,
        filters,
        timezone,
        orgName: currentOrganization?.name || "MediTrans",
        generatedBy: profile?.full_name || user?.email || "Unknown",
        userRole: userRole || "Admin",
      });
      toast.success("Summary generated successfully");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF summary");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

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

          {/* Action Buttons */}
          <div className="space-y-3">
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
                    Download PDF ({trips.length} trips)
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
