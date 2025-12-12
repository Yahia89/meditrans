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
import { LoginForm } from './components/login-form'
import { AuthProvider, useAuth } from '@/contexts/auth-context'

// Define valid page values for type safety
const pages = ['dashboard', 'patients', 'drivers', 'employees', 'upload'] as const
type Page = typeof pages[number]

function AppContent() {
  const { user, loading } = useAuth()

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
              {/* Logo/Brand placeholder */}
              <div className="mb-8 flex justify-center">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>

              <LoginForm />

              {/* Footer text */}
              <div className="mt-8 text-center text-xs text-slate-500 dark:text-slate-400">
                © 2024 MediTrans. All rights reserved.
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
              // Replace this with your image: backgroundImage: 'url(/your-image.jpg)'
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
            <div className="text-center max-w-md">
              <div className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                <svg className="w-12 h-12 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold mb-4">Welcome to MediTrans</h2>
              <p className="text-white/80 text-lg leading-relaxed">
                Your trusted partner in medical transportation management. Streamline operations, track patients, and manage your fleet with ease.
              </p>
            </div>

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
      default:
        return (
          <DashboardPage title="Dashboard">
            <Dashboard />
          </DashboardPage>
        )
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      {renderPage()}
    </SidebarProvider>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
