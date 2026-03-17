import { useState } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Calendar,
  DownloadSimple,
  CircleNotch,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useTimezone } from "@/hooks/useTimezone";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

import { SummaryPreview } from "./SummaryPreview";
import { useSummaryData } from "./useSummaryData";
import { generateSummaryPDF } from "./pdf-generator";
import type { FilterState } from "./types";

interface DriverSummaryTabProps {
  driverId: string;
  driverName: string;
}

export function DriverSummaryTab({
  driverId,
  driverName,
}: DriverSummaryTabProps) {
  const { currentOrganization, userRole } = useOrganization();
  const { user, profile } = useAuth();
  const timezone = useTimezone();

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Simplified filter state for driver level
  const [filters, setFilters] = useState<FilterState>({
    startDate: format(new Date(), "yyyy-MM-01"),
    endDate: format(new Date(), "yyyy-MM-dd"),
    selectedVehicleTypes: [],
    selectedWaiverTypes: [],
    selectedReferredBy: [],
    selectedSalStatuses: [],
    selectedTripPurposes: [],
  });

  const handleDateChange = (key: "startDate" | "endDate", value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    resetGenerated();
  };

  const {
    trips,
    isFetching,
    hasGenerated,
    fetchData,
    resetGenerated,
  } = useSummaryData({
    orgId: currentOrganization?.id,
    filters,
    driverId,
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Date Filters */}
        <div className="lg:col-span-1 space-y-5">
          <Card className="border-slate-200 shadow-sm rounded-2xl overflow-visible">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar size={18} weight="bold" className="text-slate-400" />
                Period Selection
              </CardTitle>
              <CardDescription className="text-xs">
                Select the date range for {driverName}'s Trips summary
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="driver-start-date"
                  className="text-xs font-semibold text-slate-600 uppercase tracking-wider"
                >
                  From Date
                </Label>
                <Input
                  id="driver-start-date"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleDateChange("startDate", e.target.value)}
                  className="rounded-xl border-slate-200 focus:ring-[#3D5A3D] focus:border-[#3D5A3D] h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="driver-end-date"
                  className="text-xs font-semibold text-slate-600 uppercase tracking-wider"
                >
                  To Date
                </Label>
                <Input
                  id="driver-end-date"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleDateChange("endDate", e.target.value)}
                  className="rounded-xl border-slate-200 focus:ring-[#3D5A3D] focus:border-[#3D5A3D] h-10"
                />
              </div>

              <div className="pt-2 space-y-3">
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
                      Fetching...
                    </>
                  ) : (
                    <>
                      <MagnifyingGlass size={18} weight="bold" />
                      {hasGenerated ? "Regenerate" : "Generate Results"}
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
                        Download PDF report
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Preview */}
        <div className="lg:col-span-2">
          <SummaryPreview
            trips={trips}
            hasGenerated={hasGenerated}
            isFetching={isFetching}
            hasFilters={false}
            matchedPatientCount={0}
            timezone={timezone}
          />
        </div>
      </div>
    </div>
  );
}
