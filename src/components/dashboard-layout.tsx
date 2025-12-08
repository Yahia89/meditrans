import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
    Users,
    Car,
    Upload,
    Menu,
    X,
    ChevronRight,
    Activity,
    TrendingUp,
    LayoutDashboard
} from 'lucide-react'

interface DashboardLayoutProps {
    children?: React.ReactNode
    currentPage: string
    onNavigate: (page: string) => void
}

interface NavItem {
    name: string
    icon: React.ElementType
    path: string
    badge?: string
}

const navigation: NavItem[] = [
    { name: 'Dashboard', icon: LayoutDashboard, path: 'dashboard' },
    { name: 'Patients', icon: Users, path: 'patients' },
    { name: 'Drivers', icon: Car, path: 'drivers' },
    { name: 'Upload', icon: Upload, path: 'upload' },
]

export function DashboardLayout({ children, currentPage, onNavigate }: DashboardLayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(true)

    return (
        <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            {/* Sidebar */}
            <aside
                className={cn(
                    "relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-800/50 transition-all duration-300 ease-in-out shadow-xl",
                    sidebarOpen ? "w-64" : "w-20"
                )}
            >
                {/* Logo & Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200/50 dark:border-slate-800/50">
                    <div className={cn(
                        "flex items-center gap-3 transition-opacity duration-200",
                        !sidebarOpen && "opacity-0"
                    )}>
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/30">
                            <Activity className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900 dark:text-white"></h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400">CRM System</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 hover:scale-105"
                        aria-label="Toggle sidebar"
                    >
                        {sidebarOpen ? (
                            <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        ) : (
                            <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        )}
                    </button>
                </div>

                {/* Navigation */}
                <nav className="p-4 space-y-2">
                    {navigation.map((item) => {
                        const Icon = item.icon
                        const isActive = currentPage === item.path

                        return (
                            <button
                                key={item.name}
                                onClick={() => onNavigate(item.path)}
                                className={cn(
                                    "w-full group relative flex items-center gap-3 px-4 py-3 rounded-xl",
                                    "transition-all duration-300 ease-out",
                                    isActive
                                        ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25 scale-[1.02]"
                                        : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-700"
                                )}
                            >
                                <Icon className={cn(
                                    "w-5 h-5 transition-all duration-300 ease-out",
                                    isActive && "scale-110",
                                    !isActive && "group-hover:scale-105 group-hover:text-slate-600"
                                )} />
                                <span className={cn(
                                    "font-medium transition-all duration-300 ease-out",
                                    !sidebarOpen && "opacity-0 absolute"
                                )}>
                                    {item.name}
                                </span>
                                {isActive && sidebarOpen && (
                                    <ChevronRight className="w-4 h-4 ml-auto animate-pulse" />
                                )}
                                {item.badge && sidebarOpen && (
                                    <span className="ml-auto px-2 py-1 text-xs font-semibold rounded-full bg-red-500 text-white">
                                        {item.badge}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </nav>

                {/* Footer Stats */}
                <div className={cn(
                    "absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200/50 dark:border-slate-800/50 bg-gradient-to-t from-slate-100/50 dark:from-slate-900/50 backdrop-blur-sm transition-opacity duration-200",
                    !sidebarOpen && "opacity-0"
                )}>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Active Trips</span>
                            </div>
                            <span className="text-sm font-bold text-slate-900 dark:text-white">24</span>
                        </div>
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20">
                            <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                            <span className="text-xs font-medium text-green-700 dark:text-green-300">+12% this week</span>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <div className="min-h-full">
                    {children}
                </div>
            </main>
        </div>
    )
}
