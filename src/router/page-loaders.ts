// Import factories are shared by the lazy renderer and code-only intent preloading.
export const loadDashboard = () => import("@/components/dashboard").then(module => ({ default: module.Dashboard }));
export const loadPatientsPage = () => import("@/components/patients-page").then(module => ({ default: module.PatientsPage }));
export const loadDriversPage = () => import("@/components/drivers-page").then(module => ({ default: module.DriversPage }));
export const loadEmployeesPage = () => import("@/components/employees-page").then(module => ({ default: module.EmployeesPage }));
export const loadEmployeeDetailsPage = () => import("@/components/employee-details-page").then(module => ({ default: module.EmployeeDetailsPage }));
export const loadUploadPage = () => import("@/components/upload-page").then(module => ({ default: module.UploadPage }));
export const loadAccountPage = () => import("@/components/account-page").then(module => ({ default: module.AccountPage }));
export const loadBillingPage = () => import("@/components/billing-page").then(module => ({ default: module.BillingPage }));
export const loadNotificationsPage = () => import("@/components/notifications-page").then(module => ({ default: module.NotificationsPage }));
export const loadFounderInviteForm = () => import("@/components/founder-invite-form").then(module => ({ default: module.FounderInviteForm }));
export const loadAcceptInvitePage = () => import("@/components/accept-invite").then(module => ({ default: module.AcceptInvitePage }));
export const loadUploadReviewPage = () => import("@/components/upload-review-page").then(module => ({ default: module.UploadReviewPage }));
export const loadPatientDetailsPage = () => import("@/components/patient-details-page").then(module => ({ default: module.PatientDetailsPage }));
export const loadDriverDetailsPage = () => import("@/components/driver-details-page").then(module => ({ default: module.DriverDetailsPage }));
export const loadTripDetails = () => import("@/components/trips/TripDetails").then(module => ({ default: module.TripDetails }));
export const loadTripDialog = () => import("@/components/trips/TripDialog").then(module => ({ default: module.TripDialog }));
export const loadTripsScheduler = () => import("@/components/trips/TripsScheduler").then(module => ({ default: module.TripsScheduler }));
export const loadBulkImportDialog = () => import("@/components/trips/BulkImportDialog").then(module => ({ default: module.BulkImportDialog }));
export const loadCreateDischargeDialog = () => import("@/components/trips/CreateDischargeDialog").then(module => ({ default: module.CreateDischargeDialog }));
export const loadClientCreditsPage = () => import("@/components/client-credits-page").then(module => ({ default: module.ClientCreditsPage }));
export const loadBrokerIntegrationsPage = () => import("@/components/brokers/BrokerIntegrationsPage").then(module => ({ default: module.BrokerIntegrationsPage }));
export const loadDriverHistoryPage = () => import("@/components/driver-history-page").then(module => ({ default: module.DriverHistoryPage }));
export const loadMedicaidBillingPage = () => import("@/components/MedicaidBillingPage").then(module => ({ default: module.MedicaidBillingPage }));
export const loadLiveTrackingPage = () => import("@/components/live/LiveTrackingPage").then(module => ({ default: module.LiveTrackingPage }));
export const loadCompaniesPage = () => import("@/components/admin/companies-page").then(module => ({ default: module.CompaniesPage }));
export const loadResetPasswordPage = () => import("@/components/reset-password-page").then(module => ({ default: module.ResetPasswordPage }));
export const loadFeeSettingsPage = () => import("@/components/admin/FeeSettingsPage").then(module => ({ default: module.FeeSettingsPage }));
export const loadSummaryPage = () => import("@/components/summary-page").then(module => ({ default: module.SummaryPage }));
export const loadSTSInspectionPage = () => import("@/components/sts-inspection-page").then(module => ({ default: module.STSInspectionPage }));
export const loadCompanyDocumentsPage = () => import("@/components/company/CompanyDocumentsPage").then(module => ({ default: module.CompanyDocumentsPage }));

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
