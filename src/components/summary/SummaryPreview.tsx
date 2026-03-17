import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Info,
  FilePdf,
  CircleNotch,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { formatInUserTimezone } from "@/lib/timezone";
import type { SummaryTrip } from "./types";

interface SummaryPreviewProps {
  trips: SummaryTrip[];
  hasGenerated: boolean;
  isFetching: boolean;
  hasFilters: boolean;
  matchedPatientCount: number;
  timezone: string;
}

export function SummaryPreview({
  trips,
  hasGenerated,
  isFetching,
  hasFilters,
  matchedPatientCount,
  timezone,
}: SummaryPreviewProps) {
  return (
    <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Info size={18} weight="bold" className="text-slate-400" />
              Summary Preview
            </CardTitle>
            <CardDescription className="text-xs">
              {hasGenerated
                ? `Showing trips for selected period${hasFilters ? ` (${matchedPatientCount} matching patients)` : ""}`
                : "Select your date range and filters, then click Generate"}
            </CardDescription>
          </div>
          {hasGenerated && trips.length > 0 && (
            <span className="text-xs font-bold bg-[#3D5A3D]/10 text-[#3D5A3D] px-3 py-1 rounded-full">
              {trips.length} trip{trips.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden">
        {!hasGenerated ? (
          <EmptyState />
        ) : isFetching ? (
          <LoadingState />
        ) : trips.length > 0 ? (
          <TripsTable
            trips={trips}
            hasFilters={hasFilters}
            timezone={timezone}
          />
        ) : (
          <NoDataState hasFilters={hasFilters} />
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center p-20 text-center">
      <div className="w-20 h-20 bg-gradient-to-br from-[#3D5A3D]/5 to-[#3D5A3D]/15 rounded-2xl flex items-center justify-center mb-5 rotate-3">
        <MagnifyingGlass
          size={36}
          weight="duotone"
          className="text-[#3D5A3D]/40"
        />
      </div>
      <h3 className="text-slate-900 font-bold mb-2 text-lg">
        Ready to Generate
      </h3>
      <p className="text-slate-500 max-w-[300px] text-sm leading-relaxed">
        Set your date range and optional filters, then click{" "}
        <span className="font-semibold text-[#3D5A3D]">Generate Results</span>{" "}
        to view the trips preview.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
      <CircleNotch size={40} className="animate-spin text-[#3D5A3D]" />
      <p className="text-slate-500 font-medium">Fetching trips data...</p>
    </div>
  );
}

function NoDataState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center p-20 text-center">
      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
        <FilePdf size={32} className="text-slate-300" />
      </div>
      <h3 className="text-slate-900 font-bold mb-1">No Trips Found</h3>
      <p className="text-slate-500 max-w-[280px] text-sm">
        {hasFilters
          ? "No trips match the selected filters and date range. Try adjusting your criteria."
          : "No trips exist for the selected period. Try a different date range."}
      </p>
    </div>
  );
}

function TripsTable({
  trips,
  hasFilters,
  timezone,
}: {
  trips: SummaryTrip[];
  hasFilters: boolean;
  timezone: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
          <tr>
            <th className="px-6 py-4 w-12 text-center">#</th>
            <th className="px-6 py-4 min-w-[200px]">Patient</th>
            <th className="px-6 py-4 min-w-[140px]">Pickup Time</th>
            <th className="px-6 py-4">Purpose</th>
            <th className="px-6 py-4 text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {trips.slice(0, 15).map((trip, index) => (
            <tr
              key={trip.id}
              className="hover:bg-slate-50/50 transition-colors"
            >
              <td className="px-6 py-4 text-slate-400 font-mono text-[10px] text-center border-r border-slate-50">
                {index + 1}
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center flex-wrap gap-2">
                  <span className="font-semibold text-slate-900">
                    {trip.patient?.full_name || "Unknown"}
                  </span>
                  {hasFilters && trip.patient?.vehicle_type_need && (
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-tighter">
                      {trip.patient.vehicle_type_need}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 text-slate-600 font-medium italic">
                {formatInUserTimezone(
                  trip.pickup_time,
                  timezone,
                  "MMM dd, HH:mm",
                )}
              </td>
              <td className="px-6 py-4 text-slate-500 text-xs font-semibold uppercase">
                {trip.trip_type || "—"}
              </td>
              <td className="px-6 py-4 text-right">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                    trip.status === "completed"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                      : trip.status === "cancelled"
                        ? "bg-red-50 text-red-700 border-red-100"
                        : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  {trip.status.replace("_", " ")}
                </span>
              </td>
            </tr>
          ))}
          {trips.length > 15 && (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-3 text-center text-slate-400 italic text-xs"
              >
                + {trips.length - 15} more trips...
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
