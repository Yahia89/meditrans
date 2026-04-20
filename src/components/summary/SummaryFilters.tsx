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
  FunnelSimple,
  Truck,
  FileText,
  UserCircle,
  ClipboardText,
  MapPin,
} from "@phosphor-icons/react";
import { MultiSelect } from "./MultiSelect";
import { FilterChips } from "./FilterChips";
import {
  VEHICLE_TYPE_NEEDS,
  WAIVER_TYPES,
} from "@/lib/constants";
import { TRIP_TYPES } from "@/components/trips/trip-utils";
import type { FilterState, ActiveFilter, MultiSelectOption } from "./types";

// SAL Status options
const SAL_STATUS_OPTIONS: MultiSelectOption[] = [
  {
    value: "approved",
    label: "Approved",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  {
    value: "pending",
    label: "Pending",
    color: "bg-amber-100 text-amber-700 border-amber-200",
  },
  {
    value: "expired",
    label: "Expired",
    color: "bg-red-100 text-red-700 border-red-200",
  },
];

// Vehicle Type options
const VEHICLE_TYPE_OPTIONS: MultiSelectOption[] = VEHICLE_TYPE_NEEDS.map(
  (t) => ({
    value: t.value,
    label: t.label,
  }),
);

// Waiver Type options
const WAIVER_TYPE_OPTIONS: MultiSelectOption[] = WAIVER_TYPES.map((t) => ({
  value: t,
  label: t,
}));

// Trip Purpose options (from trip_type values)
const TRIP_PURPOSE_OPTIONS: MultiSelectOption[] = TRIP_TYPES.filter(
  (t) => t.value !== "OTHER",
).map((t) => ({
  value: t.value,
  label: t.label,
}));

// Trip Status options
const TRIP_STATUS_OPTIONS: MultiSelectOption[] = [
  { value: "pending", label: "Pending" },
  { value: "assigned", label: "Assigned" },
  { value: "accepted", label: "Accepted" },
  { value: "en_route", label: "En Route" },
  { value: "arrived", label: "Arrived" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No Show" },
  { value: "waiting", label: "Waiting" },
];

interface SummaryFiltersProps {
  filters: FilterState;
  onFilterChange: <K extends keyof FilterState>(
    key: K,
    value: FilterState[K],
  ) => void;
  referredByOptions: MultiSelectOption[];
  referredByLoading: boolean;
}

export function SummaryFilters({
  filters,
  onFilterChange,
  referredByOptions,
  referredByLoading,
}: SummaryFiltersProps) {
  const hasFilters =
    filters.selectedVehicleTypes.length > 0 ||
    filters.selectedWaiverTypes.length > 0 ||
    filters.selectedReferredBy.length > 0 ||
    filters.selectedSalStatuses.length > 0 ||
    filters.selectedTripPurposes.length > 0 ||
    filters.selectedTripStatuses.length > 0;

  // Build active filter chips
  const activeFilters: ActiveFilter[] = [];

  filters.selectedVehicleTypes.forEach((v) =>
    activeFilters.push({
      key: "vehicleType",
      label: "Vehicle",
      value: VEHICLE_TYPE_NEEDS.find((t) => t.value === v)?.label || v,
    }),
  );
  filters.selectedWaiverTypes.forEach((v) =>
    activeFilters.push({ key: "waiverType", label: "Waiver", value: v }),
  );
  filters.selectedReferredBy.forEach((v) =>
    activeFilters.push({ key: "referredBy", label: "Referred", value: v }),
  );
  filters.selectedSalStatuses.forEach((v) =>
    activeFilters.push({
      key: "salStatus",
      label: "SAL",
      value: v.charAt(0).toUpperCase() + v.slice(1),
    }),
  );
  filters.selectedTripPurposes.forEach((v) =>
    activeFilters.push({
      key: "tripPurpose",
      label: "Purpose",
      value: TRIP_TYPES.find((t) => t.value === v)?.label || v,
    }),
  );
  filters.selectedTripStatuses.forEach((v) =>
    activeFilters.push({
      key: "tripStatus",
      label: "Status",
      value: v.charAt(0).toUpperCase() + v.slice(1).replace("_", " "),
    }),
  );

  const handleRemoveFilter = (key: string, value: string) => {
    switch (key) {
      case "vehicleType": {
        const original = VEHICLE_TYPE_NEEDS.find(
          (t) => t.label === value || t.value === value,
        );
        onFilterChange(
          "selectedVehicleTypes",
          filters.selectedVehicleTypes.filter(
            (v) => v !== (original?.value || value),
          ),
        );
        break;
      }
      case "waiverType":
        onFilterChange(
          "selectedWaiverTypes",
          filters.selectedWaiverTypes.filter((v) => v !== value),
        );
        break;
      case "referredBy":
        onFilterChange(
          "selectedReferredBy",
          filters.selectedReferredBy.filter((v) => v !== value),
        );
        break;
      case "salStatus":
        onFilterChange(
          "selectedSalStatuses",
          filters.selectedSalStatuses.filter(
            (v) => v !== value.toLowerCase(),
          ),
        );
        break;
      case "tripPurpose": {
        const original = TRIP_TYPES.find(
          (t) => t.label === value || t.value === value,
        );
        onFilterChange(
          "selectedTripPurposes",
          filters.selectedTripPurposes.filter(
            (v) => v !== (original?.value || value),
          ),
        );
        break;
      }
      case "tripStatus":
        onFilterChange(
          "selectedTripStatuses",
          filters.selectedTripStatuses.filter((v) => {
            const formatted = v.charAt(0).toUpperCase() + v.slice(1).replace("_", " ");
            return formatted !== value;
          }),
        );
        break;
    }
  };

  const handleClearAll = () => {
    onFilterChange("selectedVehicleTypes", []);
    onFilterChange("selectedWaiverTypes", []);
    onFilterChange("selectedReferredBy", []);
    onFilterChange("selectedSalStatuses", []);
    onFilterChange("selectedTripPurposes", []);
    onFilterChange("selectedTripStatuses", []);
  };

  return (
    <div className="space-y-5">
      {/* Date Selection */}
      <Card className="border-slate-200 shadow-sm rounded-2xl overflow-visible">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar size={18} weight="bold" className="text-slate-400" />
            Period Selection
          </CardTitle>
          <CardDescription className="text-xs">
            Select the date range for the report
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label
              htmlFor="start-date"
              className="text-xs font-semibold text-slate-600 uppercase tracking-wider"
            >
              From Date
            </Label>
            <Input
              id="start-date"
              type="date"
              value={filters.startDate}
              onChange={(e) => onFilterChange("startDate", e.target.value)}
              className="rounded-xl border-slate-200 focus:ring-[#3D5A3D] focus:border-[#3D5A3D] h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="end-date"
              className="text-xs font-semibold text-slate-600 uppercase tracking-wider"
            >
              To Date
            </Label>
            <Input
              id="end-date"
              type="date"
              value={filters.endDate}
              onChange={(e) => onFilterChange("endDate", e.target.value)}
              className="rounded-xl border-slate-200 focus:ring-[#3D5A3D] focus:border-[#3D5A3D] h-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="border-slate-200 shadow-sm rounded-2xl overflow-visible">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
          <CardTitle className="text-base flex items-center gap-2">
            <FunnelSimple
              size={18}
              weight="bold"
              className="text-slate-400"
            />
            Filters
            {hasFilters && (
              <span className="ml-auto text-[10px] font-bold uppercase bg-[#3D5A3D] text-white px-2 py-0.5 rounded-full">
                {activeFilters.length} active
              </span>
            )}
          </CardTitle>
          <CardDescription className="text-xs">
            Filter by patient categories and trip purpose
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <MultiSelect
            label="Vehicle Type"
            icon={Truck}
            options={VEHICLE_TYPE_OPTIONS}
            selected={filters.selectedVehicleTypes}
            onChange={(v) => onFilterChange("selectedVehicleTypes", v)}
            placeholder="All vehicle types"
          />

          <MultiSelect
            label="Waiver Type"
            icon={FileText}
            options={WAIVER_TYPE_OPTIONS}
            selected={filters.selectedWaiverTypes}
            onChange={(v) => onFilterChange("selectedWaiverTypes", v)}
            placeholder="All waiver types"
          />

          <MultiSelect
            label="Referred By"
            icon={UserCircle}
            options={referredByOptions}
            selected={filters.selectedReferredBy}
            onChange={(v) => onFilterChange("selectedReferredBy", v)}
            placeholder="All referral sources"
            loading={referredByLoading}
          />

          <MultiSelect
            label="SAL Status"
            icon={ClipboardText}
            options={SAL_STATUS_OPTIONS}
            selected={filters.selectedSalStatuses}
            onChange={(v) => onFilterChange("selectedSalStatuses", v)}
            placeholder="All SAL statuses"
          />

          <MultiSelect
            label="Trip Purpose"
            icon={MapPin}
            options={TRIP_PURPOSE_OPTIONS}
            selected={filters.selectedTripPurposes}
            onChange={(v) => onFilterChange("selectedTripPurposes", v)}
            placeholder="All trip purposes"
          />

          <MultiSelect
            label="Trip Status"
            icon={ClipboardText}
            options={TRIP_STATUS_OPTIONS}
            selected={filters.selectedTripStatuses}
            onChange={(v) => onFilterChange("selectedTripStatuses", v)}
            placeholder="All trip statuses"
          />

          {/* Active Filter Chips */}
          <FilterChips
            filters={activeFilters}
            onRemove={handleRemoveFilter}
            onClearAll={handleClearAll}
          />
        </CardContent>
      </Card>
    </div>
  );
}
