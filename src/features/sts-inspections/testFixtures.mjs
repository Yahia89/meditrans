export const mobileInspectionPayload = {
  id: "driver-1_2026-09-16", driverId: "driver-1", date: "2026-09-16", dayOfWeek: "Wednesday",
  driverInfo: {
    driverName: "QA Driver Snapshot", mndotNumber: "QA-MNDOT-100", make: "QA Make", model: "QA Van",
    year: "2024", licensePlate: "QA-PLATE", mileage: "012345",
  },
  items: [
    ["vehicle_brakes", "Vehicle Brakes"], ["parking_brake", "Parking Brake"], ["steering_mechanism", "Steering Mechanism"],
    ["lighting_devices", "Lighting Devices & Reflectors"], ["tires", "Tires"], ["horn", "Horn"],
    ["wipers", "Wipers"], ["mirrors", "Mirrors"], ["emergency_equipment", "Emergency Equipment"],
    ["wheelchair_ramps", "Wheelchair Ramps/Lifts"], ["wheelchair_securement", "Wheelchair Securement"], ["remarks", "Remarks"],
  ].map(([key, label], index) => ({ key, label, status: index === 0 ? "no_good" : "good", explanation: index === 0 ? "Left brake is noisy.\nInspect before next trip." : "" })),
  submittedAt: "2026-09-17T01:30:00Z",
};

export const mobileInspection = {
  id: "mobile-record-1", org_id: "org-1", driver_id: "driver-1", title: "Daily driver inspection",
  inspection_date: "2026-09-16", inspector_name: "QA Driver Snapshot", result: "pending", reference: null,
  notes: null, next_due_date: null, report_file_path: null, report_filename: null, report_file_type: null, report_file_size: null,
  created_by: "user-1", created_at: "2026-09-17T01:31:00Z", updated_by: "user-1", updated_at: "2026-09-17T01:31:00Z",
  source: "mobile_app", source_record_id: mobileInspectionPayload.id, inspection_payload: mobileInspectionPayload,
};
