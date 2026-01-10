import { useEffect } from "react";
import { useQueryState, parseAsStringLiteral } from "nuqs";
import "./App.css";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/app-sidebar";
import { DashboardPage } from "./components/dashboard-page";
import { Dashboard } from "./components/dashboard";
import { PatientsPage } from "./components/patients-page";
import { DriversPage } from "./components/drivers-page";
import { EmployeesPage } from "./components/employees-page";
import { UploadPage } from "./components/upload-page";
import { AccountPage } from "./components/account-page";
import { BillingPage } from "./components/billing-page";
import { NotificationsPage } from "./components/notifications-page";
import { FounderInviteForm } from "./components/founder-invite-form";
import { AcceptInvitePage } from "./components/accept-invite";
import { LoginForm } from "./components/login-form";

import { AuthProvider, useAuth } from "@/contexts/auth-context";
import {
  OrganizationProvider,
  useOrganization,
} from "@/contexts/OrganizationContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import loginbgimg from "./assets/loginbgimg.png";
import logo from "./assets/logo.png";
import { usePermissions } from "@/hooks/usePermissions";
import { Loader2 } from "lucide-react";

// Define valid page values for type safety
export const pages = [
  "dashboard",
  "patients",
  "patient-details",
  "drivers",
  "driver-details",
  "employees",
  "upload",
  "review_import",
  "account",
  "billing",
  "notifications",
  "founder",
  "accept-invite",
  "trips",
  "trip-details",
  "driver-history",
  "client-credits",
] as const;

export type Page = (typeof pages)[number];

import { UploadReviewPage } from "./components/upload-review-page";
import { PatientDetailsPage } from "./components/patient-details-page";
import { DriverDetailsPage } from "./components/driver-details-page";
import { TripDetails } from "./components/trips/TripDetails";
import { TripDialog } from "./components/trips/TripDialog";
import { TripsScheduler } from "./components/trips/TripsScheduler";
import { ClientCreditsPage } from "./components/client-credits-page";
import { DriverHistoryPage } from "./components/driver-history-page";
import { ErrorBoundary } from "./components/error-boundary";

import { useDriverLocation } from "@/hooks/useDriverLocation";

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const { driverId: currentDriverId } = useDriverLocation(); // Enables driver tracking and SMS trigger
  const { loading: orgLoading, userRole } = useOrganization();
  const { isDriver } = usePermissions();

  const loading = authLoading || (user && orgLoading);

  // nuqs: sync page state with URL query string (?page=dashboard)
  // Features enabled:
  // - Refresh persistence: page state survives browser refresh
  // - Back/forward nav: browser history works correctly
  // - Shareable URLs: copy URL to share exact app state
  // - Type-safe: only valid page values are accepted
  const [currentPage, setCurrentPage] = useQueryState<Page>(
    "page",
    parseAsStringLiteral(pages)
      .withDefault("dashboard")
      .withOptions({ history: "push" }) // Creates history entry for back/forward nav
  );

  const [patientId, setPatientId] = useQueryState("id");
  const [driverId, setDriverId] = useQueryState("driverId");
  const [tripId, setTripId] = useQueryState("tripId");
  const [modalType, setModalType] = useQueryState("modal");
  const [fromPage, setFromPage] = useQueryState("from");
  const [_, setSection] = useQueryState("section");

  // Centralized Access Control and Redirection
  useEffect(() => {
    if (loading || !user) return;

    // Define restricted pages for each role
    const restrictions: Record<string, Page[]> = {
      driver: [
        "dashboard",
        "patients",
        "patient-details",
        "drivers",
        "driver-details",
        "employees",
        "upload",
        "review_import",
        "billing",
        "notifications",
        "founder",
        "client-credits",
      ],
      employee: ["founder", "client-credits", "billing"],
      admin: ["founder"],
      owner: ["founder"],
    };

    const userRestrictedPages = restrictions[userRole || ""] || [];

    // Check if current page is restricted for this user
    if (userRestrictedPages.includes(currentPage)) {
      const fallbackPage = isDriver ? "trips" : "dashboard";
      setCurrentPage(fallbackPage);
    }
  }, [loading, user, userRole, currentPage, isDriver, setCurrentPage]);

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

  // Handle invitation acceptance regardless of auth status (will show login prompt inside if needed)
  if (currentPage === "accept-invite") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <AcceptInvitePage />
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
                  © 2025 MediTrans Pro. All rights reserved.
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

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return (
          <DashboardPage title="Dashboard">
            <Dashboard
              onNavigateToCredits={() => setCurrentPage("client-credits")}
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
                setCurrentPage((fromPage as Page) || "patients");
                setPatientId(null);
                setFromPage(null);
              }}
              onTripClick={(id) => {
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
                setCurrentPage((fromPage as Page) || "drivers");
                setDriverId(null);
                setFromPage(null);
              }}
              onTripClick={(id) => {
                setTripId(id);
                setCurrentPage("trip-details");
              }}
            />
          </DashboardPage>
        );
      case "employees":
        return (
          <DashboardPage title="Employees">
            <EmployeesPage />
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
        return (
          <DashboardPage title="Founder Admin">
            <FounderInviteForm />
          </DashboardPage>
        );
      case "trips":
        if (isDriver && !currentDriverId) {
          return (
            <DashboardPage title="Trips Management">
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            </DashboardPage>
          );
        }
        return (
          <DashboardPage title="Trips Management">
            <TripsScheduler
              onCreateClick={
                !isDriver ? () => setModalType("create") : undefined
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
      case "driver-history":
        if (isDriver && !currentDriverId) {
          return (
            <DashboardPage title="Driving History">
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            </DashboardPage>
          );
        }
        return (
          <DashboardPage title="Driving History">
            <DriverHistoryPage driverId={currentDriverId || ""} />
          </DashboardPage>
        );
      default:
        return (
          <DashboardPage title="Dashboard">
            <Dashboard
              onNavigateToCredits={() => setCurrentPage("client-credits")}
            />
          </DashboardPage>
        );
    }
  };

  return (
    <OnboardingProvider onNavigate={(page) => setCurrentPage?.(page as Page)}>
      <SidebarProvider>
        <AppSidebar
          currentPage={currentPage}
          onNavigate={(page) => {
            setCurrentPage(page as Page);
            // Keep clear state when navigating between main modules
            if (page !== "patient-details") setPatientId(null);
            if (page !== "driver-details") setDriverId(null);
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
            {renderPage()}
          </ErrorBoundary>
        </main>

        {/* Trip Dialogs rendered at App level to ensure they appear as proper overlays */}
        {(currentPage === "dashboard" ||
          currentPage === "trips" ||
          currentPage === "trip-details") && (
          <>
            <TripDialog
              key="create-dialog"
              open={modalType === "create"}
              onOpenChange={(open) => setModalType(open ? "create" : null)}
              onSuccess={() => setModalType(null)}
            />
            <TripDialog
              key={`edit-dialog-${tripId || "none"}`}
              open={modalType === "edit"}
              tripId={tripId || undefined}
              onOpenChange={(open) => setModalType(open ? "edit" : null)}
              onSuccess={() => setModalType(null)}
            />
          </>
        )}
      </SidebarProvider>
    </OnboardingProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <AppContent />
      </OrganizationProvider>
    </AuthProvider>
  );
}

export default App;
