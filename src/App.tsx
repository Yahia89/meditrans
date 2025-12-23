import { useQueryState, parseAsStringLiteral } from 'nuqs'
import './App.css'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from './components/app-sidebar'
import { DashboardPage } from './components/dashboard-page'
import { Dashboard } from './components/dashboard'
import { PatientsPage } from './components/patients-page'
import { DriversPage } from './components/drivers-page'
import { EmployeesPage } from './components/employees-page'
import { UploadPage } from './components/upload-page'
import { AccountPage } from './components/account-page'
import { BillingPage } from './components/billing-page'
import { NotificationsPage } from './components/notifications-page'
import { FounderInviteForm } from './components/founder-invite-form'
import { AcceptInvitePage } from './components/accept-invite'
import { LoginForm } from './components/login-form'



import { AuthProvider, useAuth } from '@/contexts/auth-context'
import { OrganizationProvider } from '@/contexts/OrganizationContext'
import { OnboardingProvider } from '@/contexts/OnboardingContext'
import loginbgimg from './assets/loginbgimg.png'
import logo from './assets/logo.png'
import { usePermissions } from '@/hooks/usePermissions'


// Define valid page values for type safety
const pages = ['dashboard', 'patients', 'drivers', 'employees', 'upload', 'review_import', 'account', 'billing', 'notifications', 'founder', 'accept-invite'] as const



type Page = typeof pages[number]

import { UploadReviewPage } from './components/upload-review-page'

function AppContent() {
  const { user, loading } = useAuth()
  const { isSuperAdmin } = usePermissions()


  // nuqs: sync page state with URL query string (?page=dashboard)
  // Features enabled:
  // - Refresh persistence: page state survives browser refresh
  // - Back/forward nav: browser history works correctly  
  // - Shareable URLs: copy URL to share exact app state
  // - Type-safe: only valid page values are accepted
  const [currentPage, setCurrentPage] = useQueryState<Page>(
    'page',
    parseAsStringLiteral(pages)
      .withDefault('dashboard')
      .withOptions({ history: 'push' }) // Creates history entry for back/forward nav
  )

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Handle invitation acceptance regardless of auth status (will show login prompt inside if needed)
  if (currentPage === 'accept-invite') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <AcceptInvitePage />
      </div>
    )
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

              <LoginForm />

              {/* Footer text */}
              <div className="mt-8 text-center text-xs text-slate-500 dark:text-slate-400">
                © 2025 Medical Transportation CRM. All rights reserved.
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Image Placeholder */}
        <div className="hidden lg:flex w-1/2 relative overflow-hidden">
          {/* Gradient background placeholder - replace with your image */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700"
            style={{
              backgroundImage: `url(${loginbgimg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {/* Overlay for text readability */}
            <div className="absolute inset-0 bg-black/20" />

            {/* Optional decorative pattern overlay */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }} />
            </div>
          </div>

          {/* Content overlay */}
          <div className="relative z-10 flex flex-col items-center justify-center w-full p-12 text-white">
            {/* Image placeholder indicator */}

            {/* Decorative elements */}
            <div className="absolute bottom-12 left-12 right-12">
              <div className="flex items-center gap-4 text-white/60 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span>System Online</span>
                </div>
                <div className="h-4 w-px bg-white/30" />
                <span>Secure Connection</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <DashboardPage title="Dashboard">
            <Dashboard />
          </DashboardPage>
        )
      case 'patients':
        return (
          <DashboardPage title="Patients">
            <PatientsPage />
          </DashboardPage>
        )
      case 'drivers':
        return (
          <DashboardPage title="Drivers">
            <DriversPage />
          </DashboardPage>
        )
      case 'employees':
        return (
          <DashboardPage title="Employees">
            <EmployeesPage />
          </DashboardPage>
        )
      case 'upload':
        return (
          <DashboardPage title="Upload">
            <UploadPage />
          </DashboardPage>
        )
      case 'review_import':
        return (
          <DashboardPage title="Review Import">
            <UploadReviewPage onBack={() => setCurrentPage('upload')} />
          </DashboardPage>
        )
      case 'account':
        return (
          <DashboardPage title="Account Settings">
            <AccountPage />
          </DashboardPage>
        )
      case 'billing':
        return (
          <DashboardPage title="Billing & Plans">
            <BillingPage />
          </DashboardPage>
        )
      case 'notifications':
        return (
          <DashboardPage title="Notifications">
            <NotificationsPage />
          </DashboardPage>
        )
      case 'founder':
        if (!isSuperAdmin) {
          setCurrentPage('dashboard')
          return null
        }
        return (
          <DashboardPage title="Founder Admin">
            <FounderInviteForm />
          </DashboardPage>
        )



      default:
        return (
          <DashboardPage title="Dashboard">
            <Dashboard />
          </DashboardPage>
        )
    }
  }

  return (
    <OnboardingProvider onNavigate={(page) => setCurrentPage(page as Page)}>
      <SidebarProvider>
        <AppSidebar currentPage={currentPage as Page} onNavigate={(p) => setCurrentPage(p as Page)} />
        {renderPage()}
      </SidebarProvider>
    </OnboardingProvider>
  )
}

function App() {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <AppContent />
      </OrganizationProvider>
    </AuthProvider>
  )
}

export default App
