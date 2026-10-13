// Import factories share their fulfilled module with the route renderer.
import { preloadable } from '@/lib/preloaded-component';
export const loadDashboard = preloadable(async () => ({ default: (await import("@/components/dashboard")).Dashboard }));
export const loadPatientsPage = preloadable(async () => ({ default: (await import("@/components/patients-page")).PatientsPage }));
export const loadDriversPage = preloadable(async () => ({ default: (await import("@/components/drivers-page")).DriversPage }));
export const loadEmployeesPage = preloadable(async () => ({ default: (await import("@/components/employees-page")).EmployeesPage }));
export const loadEmployeeDetailsPage = preloadable(async () => ({ default: (await import("@/components/employee-details-page")).EmployeeDetailsPage }));
export const loadUploadPage = preloadable(async () => ({ default: (await import("@/components/upload-page")).UploadPage }));
export const loadAccountPage = preloadable(async () => ({ default: (await import("@/components/account-page")).AccountPage }));
export const loadBillingPage = preloadable(async () => ({ default: (await import("@/components/billing-page")).BillingPage }));
export const loadNotificationsPage = preloadable(async () => ({ default: (await import("@/components/notifications-page")).NotificationsPage }));
export const loadFounderInviteForm = preloadable(async () => ({ default: (await import("@/components/founder-invite-form")).FounderInviteForm }));
export const loadAcceptInvitePage = preloadable(async () => ({ default: (await import("@/components/accept-invite")).AcceptInvitePage }));
export const loadUploadReviewPage = preloadable(async () => ({ default: (await import("@/components/upload-review-page")).UploadReviewPage }));
export const loadPatientDetailsPage = preloadable(async () => ({ default: (await import("@/components/patient-details-page")).PatientDetailsPage }));
export const loadDriverDetailsPage = preloadable(async () => ({ default: (await import("@/components/driver-details-page")).DriverDetailsPage }));
export const loadTripDetails = preloadable(async () => ({ default: (await import("@/components/trips/TripDetails")).TripDetails }));
export const loadTripDialog = preloadable(async () => ({ default: (await import("@/components/trips/TripDialog")).TripDialog }));
export const loadTripsScheduler = preloadable(async () => ({ default: (await import("@/components/trips/TripsScheduler")).TripsScheduler }));
export const loadBulkImportDialog = preloadable(async () => ({ default: (await import("@/components/trips/BulkImportDialog")).BulkImportDialog }));
export const loadCreateDischargeDialog = preloadable(async () => ({ default: (await import("@/components/trips/CreateDischargeDialog")).CreateDischargeDialog }));
export const loadClientCreditsPage = preloadable(async () => ({ default: (await import("@/components/client-credits-page")).ClientCreditsPage }));
export const loadBrokerIntegrationsPage = preloadable(async () => ({ default: (await import("@/components/brokers/BrokerIntegrationsPage")).BrokerIntegrationsPage }));
export const loadDriverHistoryPage = preloadable(async () => ({ default: (await import("@/components/driver-history-page")).DriverHistoryPage }));
export const loadMedicaidBillingPage = preloadable(async () => ({ default: (await import("@/components/MedicaidBillingPage")).MedicaidBillingPage }));
export const loadLiveTrackingPage = preloadable(async () => ({ default: (await import("@/components/live/LiveTrackingPage")).LiveTrackingPage }));
export const loadCompaniesPage = preloadable(async () => ({ default: (await import("@/components/admin/companies-page")).CompaniesPage }));
export const loadResetPasswordPage = preloadable(async () => ({ default: (await import("@/components/reset-password-page")).ResetPasswordPage }));
export const loadFeeSettingsPage = preloadable(async () => ({ default: (await import("@/components/admin/FeeSettingsPage")).FeeSettingsPage }));
export const loadSummaryPage = preloadable(async () => ({ default: (await import("@/components/summary-page")).SummaryPage }));
export const loadSTSInspectionPage = preloadable(async () => ({ default: (await import("@/components/sts-inspection-page")).STSInspectionPage }));
export const loadCompanyDocumentsPage = preloadable(async () => ({ default: (await import("@/components/company/CompanyDocumentsPage")).CompanyDocumentsPage }));

import type { Page } from '@/lib/pages';
const pageLoaders: Record<Page, () => Promise<unknown>> = {
  dashboard: loadDashboard, patients: loadPatientsPage, 'patient-details': loadPatientDetailsPage,
  drivers: loadDriversPage, 'driver-details': loadDriverDetailsPage, employees: loadEmployeesPage,
  'employee-details': loadEmployeeDetailsPage, 'sts-inspection': loadSTSInspectionPage,
  company: loadCompanyDocumentsPage, upload: loadUploadPage, review_import: loadUploadReviewPage,
  account: loadAccountPage, billing: loadBillingPage, notifications: loadNotificationsPage,
  founder: loadFounderInviteForm, 'accept-invite': loadAcceptInvitePage, trips: loadTripsScheduler,
  'trip-details': loadTripDetails, 'client-credits': loadClientCreditsPage,
  'broker-integrations': loadBrokerIntegrationsPage, 'driver-history': loadDriverHistoryPage,
  'medicaid-billing': loadMedicaidBillingPage, 'live-tracking': loadLiveTrackingPage,
  companies: loadCompaniesPage, 'reset-password': loadResetPasswordPage, fees: loadFeeSettingsPage,
  summary: loadSummaryPage,
};
export const preloadPage = (page: Page) => pageLoaders[page]();
