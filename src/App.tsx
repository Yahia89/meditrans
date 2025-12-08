import { useQueryState, parseAsStringLiteral } from 'nuqs'
import './App.css'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from './components/app-sidebar'
import { DashboardPage } from './components/dashboard-page'
import { Dashboard } from './components/dashboard'
import { PatientsPage } from './components/patients-page'
import { DriversPage } from './components/drivers-page'
import { UploadPage } from './components/upload-page'

// Define valid page values for type safety
const pages = ['dashboard', 'patients', 'drivers', 'upload'] as const
type Page = typeof pages[number]

function App() {
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

export default App
