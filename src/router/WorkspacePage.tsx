import { useEffect, useState, Suspense } from "react";
import { useRouteQueryState as useQueryState } from "@/router/navigation";
import { getPageAccess } from "@/router/access";
import "../App.css";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardPage } from "@/components/dashboard-page";
import { LoginForm } from "@/components/login-form";

import { useAuth } from "@/contexts/auth-context";
import {
  useOrganization,
} from "@/contexts/OrganizationContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import loginbgimg from "@/assets/loginbgimg.png";
import logo from "@/assets/logo.png";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuditAccess } from "@/hooks/useAuditAccess";
import { usePresence } from "@/hooks/usePresence";
import { Loader2 } from "lucide-react";
import { Toaster } from "sonner";
import { useDriverIdentity, useDriverLocation } from "@/hooks/useDriverLocation";
import { markStartup } from "@/lib/startup-performance";
import { ErrorBoundary } from "@/components/error-boundary";
import { type Page } from "@/lib/pages";

import { loadDashboard, loadPatientsPage, loadDriversPage, loadEmployeesPage, loadEmployeeDetailsPage, loadUploadPage, loadAccountPage, loadBillingPage, loadNotificationsPage, loadFounderInviteForm, loadAcceptInvitePage, loadUploadReviewPage, loadPatientDetailsPage, loadDriverDetailsPage, loadTripDetails, loadTripDialog, loadTripsScheduler, loadBulkImportDialog, loadCreateDischargeDialog, loadClientCreditsPage, loadBrokerIntegrationsPage, loadDriverHistoryPage, loadMedicaidBillingPage, loadLiveTrackingPage, loadCompaniesPage, loadResetPasswordPage, loadFeeSettingsPage, loadSummaryPage, loadSTSInspectionPage, loadCompanyDocumentsPage } from "./page-loaders";

const Dashboard = loadDashboard.Component;
const PatientsPage = loadPatientsPage.Component;
const DriversPage = loadDriversPage.Component;
const EmployeesPage = loadEmployeesPage.Component;
const EmployeeDetailsPage = loadEmployeeDetailsPage.Component;
const UploadPage = loadUploadPage.Component;
const AccountPage = loadAccountPage.Component;
const BillingPage = loadBillingPage.Component;
const NotificationsPage = loadNotificationsPage.Component;
const FounderInviteForm = loadFounderInviteForm.Component;
const AcceptInvitePage = loadAcceptInvitePage.Component;
const UploadReviewPage = loadUploadReviewPage.Component;
const PatientDetailsPage = loadPatientDetailsPage.Component;
const DriverDetailsPage = loadDriverDetailsPage.Component;
const TripDetails = loadTripDetails.Component;
const TripDialog = loadTripDialog.Component;
const TripsScheduler = loadTripsScheduler.Component;
const BulkImportDialog = loadBulkImportDialog.Component;
const CreateDischargeDialog = loadCreateDischargeDialog.Component;
const ClientCreditsPage = loadClientCreditsPage.Component;
const BrokerIntegrationsPage = loadBrokerIntegrationsPage.Component;
const DriverHistoryPage = loadDriverHistoryPage.Component;
const MedicaidBillingPage = loadMedicaidBillingPage.Component;
const LiveTrackingPage = loadLiveTrackingPage.Component;
const CompaniesPage = loadCompaniesPage.Component;
const ResetPasswordPage = loadResetPasswordPage.Component;
const FeeSettingsPage = loadFeeSettingsPage.Component;
const SummaryPage = loadSummaryPage.Component;
const STSInspectionPage = loadSTSInspectionPage.Component;
const CompanyDocumentsPage = loadCompanyDocumentsPage.Component;

// Suspense fallback for lazy-loaded pages
function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
    </div>
  );
}

function DialogLoader() {
  return (
    <div role="status" aria-label="Loading dialog" className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <Loader2 className="h-8 w-8 animate-spin text-slate-700" />
    </div>
  );
}

export function WorkspacePage() {
  const { user, loading: authLoading, error: authError, refresh } = useAuth();
  const { driverId: currentDriverId } = useDriverIdentity();
  const { loading: orgLoading, userRole, currentOrganization } = useOrganization();
  const { isDriver, isSuperAdmin } = usePermissions();
  const auditAccess = useAuditAccess();

  // Initialize presence tracking for logged-in users
  usePresence();

  const loading = authLoading || (user && orgLoading);

  const [currentPage, setCurrentPage] = useQueryState("page", { defaultValue: "dashboard" as Page, parse: (value) => value as Page });

  const [patientId, setPatientId] = useQueryState("id");
  const [driverId, setDriverId] = useQueryState("driverId");
  const [employeeId, setEmployeeId] = useQueryState("employeeId");
  const [tripId, setTripId] = useQueryState("tripId");
  const [modalType, setModalType] = useQueryState("modal");
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [fromPage, setFromPage] = useQueryState("from");
  const [, setSection] = useQueryState("section");
  const [, setDate] = useQueryState("date");

  useDriverLocation({ enabled: !loading && !authError && (currentPage === "trips" || currentPage === "trip-details") });
  useEffect(() => {
    if (!loading && !authError && user && currentOrganization) markStartup("usable-shell");
  }, [loading, authError, user, currentOrganization]);

  // The same pure policy runs before route loading and synchronously before rendering.
  // This guard also closes the window while login/tenant/role changes invalidate routes.
  const access = getPageAccess(currentPage, {
    userId: user?.id ?? null,
    organizationId: currentOrganization?.id ?? null,
    role: userRole,
    isSuperAdmin,
    canManageAudit: auditAccess.canManageAudit,
  });

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Unable to load your workspace</h1>
      <p className="text-muted-foreground">Your session or company access could not be verified. Please try again.</p>
      <button className="rounded-md bg-slate-900 px-4 py-2 text-white" onClick={() => void refresh()}>Try again</button>
    </div>;
  }

  // Handle invitation acceptance regardless of auth status (will show login prompt inside if needed)
  if (currentPage === "accept-invite") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <AcceptInvitePage />
      </div>
    );
  }

  // Handle password reset
  if (currentPage === "reset-password") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <ResetPasswordPage onBack={() => setCurrentPage("dashboard")} />
      </div>
    );
  }

  // Show login page if not authenticated
  if (!user) {
    return (
      <div className="flex min-h-svh w-full">
        {/* Left Side - Login Form */}
        <div className="flex w-full lg:w-1/2 items-center justify-center p-6 md:p-10 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative overflow-hidden">
          {/* Decorative background elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 rounded-full blur-3xl" />
          </div>

          {/* Glass card container */}
          <div className="relative w-full max-w-md z-10">
            <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 rounded-3xl shadow-2xl shadow-slate-900/10 dark:shadow-black/30 p-8 md:p-10 border border-white/20 dark:border-slate-700/50">
              {/* Logo/Brand */}
              <div className="mb-8 flex justify-center rounded-full">
                <img
                  src={logo}
                  alt="MediTrans Logo"
                  className="h-24 w-auto object-contain rounded-3xl"
                />
              </div>

              {/* Title & Description */}
              <div className="mb-8 text-center">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                  Welcome Back
                </h1>
                <p className="text-slate-500 dark:text-slate-400">
                  Sign in to manage your transportation fleet
                </p>
              </div>

              <LoginForm />

              {/* Footer text */}
              <div className="mt-8 text-center">
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  © {new Date().getFullYear()} Future NEMT. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Visual / Image */}
        <div className="hidden lg:flex lg:w-1/2 bg-slate-100 dark:bg-slate-800 items-center justify-center relative overflow-hidden">
          {/* Main Visual */}
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={loginbgimg}
              alt="Medical Transportation Dashboard"
              className="w-full h-full object-cover opacity-90 dark:opacity-70 scale-105"
            />
            {/* Soft Overlay */}
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-slate-50/50 dark:to-slate-950/50" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/20 to-transparent" />
          </div>
        </div>
      </div>
    );
  }

  if (access.allowed === false) {
    return <div role="status" className="flex min-h-screen items-center justify-center p-6 text-center">
      <p>This page is unavailable for your workspace access.</p>
    </div>;
  }

  const renderPage = () => {
    if ((currentPage === "sts-inspection" || currentPage === "company") && !auditAccess.canManageAudit) {
      return <DashboardPage title="Company access">{auditAccess.loading || !auditAccess.orgId ? <PageLoader /> : <p className="p-6 text-sm text-slate-500">This page is available to company owners and admins.</p>}</DashboardPage>;
    }
    switch (currentPage) {
      case "sts-inspection":
        return <DashboardPage title="STS Inspection"><STSInspectionPage onDriverClick={(id) => {
          setDriverId(id);
          setFromPage("sts-inspection");
          setCurrentPage("driver-details");
        }} /></DashboardPage>;
      case "company":
        return <DashboardPage title="Company"><CompanyDocumentsPage /></DashboardPage>;
      case "dashboard":
        return (
          <DashboardPage title="Dashboard">
            <Dashboard
              onNavigateToCredits={() => setCurrentPage("client-credits")}
              onNavigateToDriver={(id) => {
                setDriverId(id);
                setFromPage("dashboard");
                setCurrentPage("driver-details");
              }}
              onNavigateToPatient={(id) => {
                setPatientId(id);
                setFromPage("dashboard");
                setCurrentPage("patient-details");
              }}
            />
          </DashboardPage>
        );
      case "patients":
        return (
          <DashboardPage title="Patients">
            <PatientsPage
              onPatientClick={(id) => {
                setPatientId(id);
                setFromPage("patients");
                setCurrentPage("patient-details");
              }}
            />
          </DashboardPage>
        );
      case "patient-details":
        return (
          <DashboardPage title="Patient Details">
            <PatientDetailsPage
              id={patientId || ""}
              onBack={() => {
                const target = (fromPage as Page) || "patients";
                setCurrentPage(target);
                setPatientId(null);
                setFromPage(null);
                setSection(null);
                setDate(null);
              }}
              onTripClick={(id) => {
                setFromPage("patient-details");
                setTripId(id);
                setCurrentPage("trip-details");
              }}
            />
          </DashboardPage>
        );
      case "drivers":
        return (
          <DashboardPage title="Drivers">
            <DriversPage
              onDriverClick={(id) => {
                setDriverId(id);
                setFromPage("drivers");
                setCurrentPage("driver-details");
              }}
            />
          </DashboardPage>
        );
      case "driver-details":
        return (
          <DashboardPage title="Driver Details">
            <DriverDetailsPage
              id={driverId || ""}
              onBack={() => {
                const target = (fromPage as Page) || "drivers";
                setCurrentPage(target);
                setDriverId(null);
                setFromPage(null);
                setSection(null);
                setDate(null);
              }}
              onTripClick={(id) => {
                setFromPage("driver-details");
                setTripId(id);
                setCurrentPage("trip-details");
              }}
            />
          </DashboardPage>
        );
      case "employees":
        return (
          <DashboardPage title="Employees">
            <EmployeesPage
              onEmployeeClick={(id) => {
                setEmployeeId(id);
                setFromPage("employees");
                setCurrentPage("employee-details");
              }}
            />
          </DashboardPage>
        );
      case "employee-details":
        return (
          <DashboardPage title="Employee Details">
            <EmployeeDetailsPage
              id={employeeId || ""}
              onBack={() => {
                const target = (fromPage as Page) || "employees";
                setCurrentPage(target);
                setEmployeeId(null);
                setFromPage(null);
                setSection(null);
                setDate(null);
              }}
            />
          </DashboardPage>
        );
      case "upload":
        return (
          <DashboardPage title="Upload">
            <UploadPage />
          </DashboardPage>
        );
      case "review_import":
        return (
          <DashboardPage title="Review Import">
            <UploadReviewPage onBack={() => setCurrentPage("upload")} />
          </DashboardPage>
        );
      case "account":
        return (
          <DashboardPage title="Account Settings">
            <AccountPage />
          </DashboardPage>
        );
      case "billing":
        return (
          <DashboardPage title="Billing & Plans">
            <BillingPage />
          </DashboardPage>
        );
      case "notifications":
        return (
          <DashboardPage title="Notifications">
            <NotificationsPage />
          </DashboardPage>
        );
      case "founder":
        // Only accessible by super admins (founder email)
        if (!isSuperAdmin) {
          return (
            <DashboardPage title="Access Denied">
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <p className="text-slate-500">
                  You don't have permission to access this page.
                </p>
              </div>
            </DashboardPage>
          );
        }
        return (
          <DashboardPage title="Founder Admin">
            <FounderInviteForm />
          </DashboardPage>
        );
      case "trips":
        if (isDriver && !currentDriverId) {
          return (
            <DashboardPage title="Trips Management">
              <p role="status" className="p-6 text-slate-600">Your account is not linked to a driver in this company. Contact your administrator to restore access.</p>
            </DashboardPage>
          );
        }
        return (
          <DashboardPage title="Trips Management">
            <TripsScheduler
              onCreateClick={
                !isDriver ? () => setModalType("create") : undefined
              }
              onDischargeClick={
                !isDriver ? () => setModalType("discharge") : undefined
              }
              onBulkImportClick={
                !isDriver ? () => setShowBulkImport(true) : undefined
              }
              driverId={isDriver ? currentDriverId || undefined : undefined}
              onTripClick={(id) => {
                setTripId(id);
                setCurrentPage("trip-details");
              }}
            />
          </DashboardPage>
        );
      case "trip-details":
        return (
          <DashboardPage title="Trip Details">
            <TripDetails
              tripId={tripId || ""}
              onEdit={() => setModalType("edit")}
              onDeleteSuccess={() => setCurrentPage("trips")}
              onBack={() => {
                const target = fromPage || "trips";
                setCurrentPage(target as Page);
                setTripId(null);
                setFromPage(null);
                // section stays for the dashboard to pick up
              }}
              onNavigate={(id) => setTripId(id)}
            />
          </DashboardPage>
        );
      case "client-credits":
        return (
          <DashboardPage title="Client Credits">
            <ClientCreditsPage />
          </DashboardPage>
        );
      case "broker-integrations":
        return (
          <DashboardPage title="Broker Integrations">
            <BrokerIntegrationsPage />
          </DashboardPage>
        );
      case "driver-history":
        if (isDriver && !currentDriverId) {
          return (
            <DashboardPage title="Driving History">
              <p role="status" className="p-6 text-slate-600">Your account is not linked to a driver in this company. Contact your administrator to restore access.</p>
            </DashboardPage>
          );
        }
        return (
          <DashboardPage title="Driving History">
            <DriverHistoryPage driverId={currentDriverId || ""} />
          </DashboardPage>
        );
      case "medicaid-billing":
        return (
          <DashboardPage title="Billing & Payments">
            <MedicaidBillingPage />
          </DashboardPage>
        );
      case "live-tracking":
        return (
          <DashboardPage title="Live Operations">
            <LiveTrackingPage />
          </DashboardPage>
        );
      case "companies":
        if (!isSuperAdmin) return null;
        return (
          <DashboardPage title="Companies">
            <CompaniesPage onCreateClick={() => setCurrentPage("founder")} />
          </DashboardPage>
        );
      case "fees":
        return (
          <DashboardPage title="Fee Schedule">
            <FeeSettingsPage />
          </DashboardPage>
        );
      case "summary":
        return (
          <DashboardPage title="Trips Summary">
            <SummaryPage />
          </DashboardPage>
        );
      default:
        return (
          <DashboardPage title="Dashboard">
            <Dashboard
              onNavigateToCredits={() => setCurrentPage("client-credits")}
              onNavigateToDriver={(id) => {
                setDriverId(id);
                setFromPage("dashboard");
                setCurrentPage("driver-details");
              }}
              onNavigateToPatient={(id) => {
                setPatientId(id);
                setFromPage("dashboard");
                setCurrentPage("patient-details");
              }}
            />
          </DashboardPage>
        );
    }
  };

  return (
    <OnboardingProvider key={`${user.id}:${currentOrganization?.id ?? "no-organization"}`} onNavigate={(page) => setCurrentPage?.(page as Page)}>
      <SidebarProvider>
        <AppSidebar
          currentPage={currentPage}
          onNavigate={(page) => {
            setCurrentPage(page as Page);
            // Keep clear state when navigating between main modules
            if (page !== "patient-details") setPatientId(null);
            if (page !== "driver-details") setDriverId(null);
            if (page !== "employee-details") setEmployeeId(null);
            setFromPage(null);
            setSection(null);
            if (page !== "trip-details") {
              setTripId(null);
              setModalType(null);
            }
            if (page !== "trips") {
              // Clear create modal when leaving trips page
              if (modalType === "create") setModalType(null);
            }
          }}
        />
        <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900">
          <ErrorBoundary fallbackTitle="Page Error">
            <Suspense fallback={<PageLoader />}>
              {renderPage()}
            </Suspense>
          </ErrorBoundary>
        </main>

        {/* Trip Dialogs rendered at App level to ensure they appear as proper overlays */}
        {(currentPage === "dashboard" ||
          currentPage === "trips" ||
          currentPage === "trip-details") && (
          <Suspense fallback={<DialogLoader />}>
            {modalType === "create" && (
              <TripDialog
                key="create-dialog"
                open
                onOpenChange={(open) => setModalType(open ? "create" : null)}
                onSuccess={() => setModalType(null)}
              />
            )}
            {modalType === "edit" && (
              <TripDialog
                key={`edit-dialog-${tripId || "none"}`}
                open
                tripId={tripId || undefined}
                onOpenChange={(open) => setModalType(open ? "edit" : null)}
                onSuccess={() => setModalType(null)}
              />
            )}
            {modalType === "discharge" && (
              <CreateDischargeDialog
                key="discharge-dialog"
                open
                onOpenChange={(open) => setModalType(open ? "discharge" : null)}
                onSuccess={() => setModalType(null)}
              />
            )}
          </Suspense>
        )}

        {showBulkImport && (
          <Suspense fallback={<DialogLoader />}>
            <BulkImportDialog
              open
              onOpenChange={setShowBulkImport}
              onSuccess={() => setShowBulkImport(false)}
            />
          </Suspense>
        )}
        <Toaster position="top-right" richColors />
      </SidebarProvider>
    </OnboardingProvider>
  );
}

