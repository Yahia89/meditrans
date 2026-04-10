export interface TripsSchedulerProps {
  onCreateClick?: () => void;
  onDischargeClick?: () => void;
  onBulkImportClick?: () => void;
  onTripClick: (id: string) => void;
  patientId?: string;
  driverId?: string;
}

export type ViewMode = "timeline" | "list" | "cards";

export interface QuickAddData {
  patientId: string;
  patientName: string;
  date: Date;
}
