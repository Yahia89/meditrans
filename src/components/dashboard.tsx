import {
    UsersThree,
    CalendarBlank,
    MapPin,
    TrendUp,
    WarningCircle,
    CaretUp,
    CaretDown,
    Funnel,
    ArrowsDownUp,
    DotsThreeVertical,
    CloudArrowUp,
    Users,
    Car,
    ListChecks,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { SetupChecklist } from "./setup-checklist";
import { DemoModeBanner } from "./demo-mode-banner";
import { Button } from "@/components/ui/button";

// Inline stat item (matching the reference design)
interface InlineStatProps {
    label: string;
    value: string;
    change: string;
    changeType: "positive" | "negative" | "neutral";
}

function InlineStat({ label, value, change, changeType }: InlineStatProps) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-sm text-slate-500">{label}</span>
            <div className="flex items-center gap-2">
                <span className="text-2xl font-semibold text-slate-900 tracking-tight">
                    {value}
                </span>
                <span
                    className={cn(
                        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium",
                        changeType === "positive" && "bg-[#E8F5E9] text-[#2E7D32]",
                        changeType === "negative" && "bg-red-50 text-red-600",
                        changeType === "neutral" && "bg-slate-100 text-slate-500"
                    )}
                >
                    {changeType === "positive" && <CaretUp size={12} weight="fill" />}
                    {changeType === "negative" && <CaretDown size={12} weight="fill" />}
                    {change}
                </span>
            </div>
        </div>
    );
}

// Zero stat for empty state
function ZeroStat({ label }: { label: string }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-sm text-slate-500">{label}</span>
            <div className="flex items-center gap-2">
                <span className="text-2xl font-semibold text-slate-300 tracking-tight">
                    0
                </span>
                <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-400">
                    --
                </span>
            </div>
        </div>
    );
}

interface RecentActivityItem {
    id: string;
    patient: string;
    driver: string;
    time: string;
    status: "completed" | "in-progress" | "scheduled";
    destination: string;
}

const demoActivities: RecentActivityItem[] = [
    {
        id: "1",
        patient: "John Smith",
        driver: "Michael Chen",
        time: "10:30 AM",
        status: "completed",
        destination: "St. Mary Hospital",
    },
    {
        id: "2",
        patient: "Sarah Johnson",
        driver: "David Wilson",
        time: "11:45 AM",
        status: "in-progress",
        destination: "City Medical Center",
    },
    {
        id: "3",
        patient: "Robert Brown",
        driver: "James Davis",
        time: "1:15 PM",
        status: "scheduled",
        destination: "Central Clinic",
    },
    {
        id: "4",
        patient: "Emily Davis",
        driver: "Michael Chen",
        time: "2:30 PM",
        status: "scheduled",
        destination: "Memorial Hospital",
    },
];

// Schedule item data
interface ScheduleItem {
    id: string;
    title: string;
    time: string;
    date: string;
    color: "coral" | "mint" | "lavender";
}

const demoScheduleItems: ScheduleItem[] = [
    {
        id: "1",
        title: "Patient Pickup - John Smith",
        time: "10:00 - 11:00 AM",
        date: "Today",
        color: "coral",
    },
    {
        id: "2",
        title: "Driver Training Session",
        time: "10:00 - 11:00 AM",
        date: "Sat, Dec 20",
        color: "mint",
    },
];

// Empty state for dashboard sections
function DashboardEmptySection({
    title,
    description,
    icon: Icon,
    ctaLabel,
    onAction
}: {
    title: string;
    description: string;
    icon: React.ElementType;
    ctaLabel: string;
    onAction: () => void;
}) {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center text-slate-400 mb-4 shadow-sm">
                <Icon size={24} weight="duotone" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-1">{title}</h3>
            <p className="text-sm text-slate-500 max-w-xs mb-4">{description}</p>
            <Button
                onClick={onAction}
                variant="outline"
                size="sm"
                className="rounded-lg border-slate-200 hover:bg-slate-50"
            >
                {ctaLabel}
            </Button>
        </div>
    );
}

export function Dashboard() {
    const { dataState, dataCounts, isDemoMode, navigateTo } = useOnboarding();

    const today = new Date();
    const monthYear = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    // Generate week days for mini calendar
    const getWeekDays = () => {
        const days = [];
        const curr = new Date();
        const first = curr.getDate() - curr.getDay() + 1;

        for (let i = 0; i < 7; i++) {
            const day = new Date(curr.setDate(first + i));
            days.push({
                day: day.toLocaleDateString("en-US", { weekday: "short" }),
                date: day.getDate(),
                isToday: day.toDateString() === new Date().toDateString(),
            });
        }
        return days;
    };

    const weekDays = getWeekDays();

    // Show data based on demo mode or real data
    const showRealData = dataState === 'live' || isDemoMode;
    const recentActivities = showRealData ? demoActivities : [];
    const scheduleItems = showRealData ? demoScheduleItems : [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <h1 className="text-2xl font-semibold text-slate-900">
                        Dashboard
                    </h1>
                    <p className="text-sm text-slate-500">
                        {dataState === 'empty'
                            ? "Let's get started with setting up your workspace"
                            : dataState === 'onboarding'
                                ? "You're making progress! Complete the setup to unlock full analytics"
                                : "Welcome back! Here's your personalized overview."}
                    </p>
                </div>

                <button
                    className="inline-flex items-center gap-2 rounded-lg bg-[#3D5A3D] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#2E4A2E]"
                    onClick={() => navigateTo('create-trip')}
                >
                    <UsersThree size={18} weight="duotone" />
                    + Create trip
                </button>
            </div>

            {/* Demo Mode Banner - show when in empty/onboarding state */}
            {(dataState === 'empty' || dataState === 'onboarding') && (
                <DemoModeBanner />
            )}

            {/* Setup Checklist - show when not live */}
            {(dataState === 'empty' || dataState === 'onboarding') && !isDemoMode && (
                <SetupChecklist />
            )}

            {/* Performance Over Time - Stats Row */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">
                            Performance Over Time
                        </h2>
                        <p className="text-sm text-slate-500">
                            {new Date().toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50">
                            <ArrowsDownUp size={14} />
                            Short
                        </button>
                        <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50">
                            <Funnel size={14} />
                            Filter
                        </button>
                        <button className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                            <DotsThreeVertical size={18} weight="bold" />
                        </button>
                    </div>
                </div>

                {/* Stats Grid - Show zeros or real data */}
                <div className="grid grid-cols-2 gap-8 md:grid-cols-4 divide-x divide-slate-100">
                    <div className="pl-0">
                        {showRealData ? (
                            <InlineStat
                                label="Total Patients"
                                value={isDemoMode ? "1,248" : dataCounts.patients.toLocaleString()}
                                change="+0.02%"
                                changeType="positive"
                            />
                        ) : (
                            <ZeroStat label="Total Patients" />
                        )}
                    </div>
                    <div className="pl-8">
                        {showRealData ? (
                            <InlineStat
                                label="Active Drivers"
                                value={isDemoMode ? "38" : dataCounts.drivers.toString()}
                                change="+0.02%"
                                changeType="positive"
                            />
                        ) : (
                            <ZeroStat label="Active Drivers" />
                        )}
                    </div>
                    <div className="pl-8">
                        {showRealData ? (
                            <InlineStat
                                label="Today's Trips"
                                value={isDemoMode ? "156" : dataCounts.trips.toString()}
                                change="+0.02%"
                                changeType="positive"
                            />
                        ) : (
                            <ZeroStat label="Today's Trips" />
                        )}
                    </div>
                    <div className="pl-8">
                        {showRealData ? (
                            <InlineStat
                                label="Scheduled"
                                value={isDemoMode ? "42" : "0"}
                                change="+0.02%"
                                changeType="positive"
                            />
                        ) : (
                            <ZeroStat label="Scheduled" />
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Actions - Show when empty or onboarding and not in demo mode */}
            {(dataState === 'empty' || dataState === 'onboarding') && !isDemoMode && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                        onClick={() => navigateTo('patients')}
                        className="group flex items-center gap-4 p-5 rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md hover:border-[#3D5A3D]/30 hover:-translate-y-0.5"
                    >
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                            <Users size={24} weight="duotone" />
                        </div>
                        <div className="text-left">
                            <h3 className="font-semibold text-slate-900">Add Patients</h3>
                            <p className="text-sm text-slate-500">Import or add patient records</p>
                        </div>
                    </button>
                    <button
                        onClick={() => navigateTo('drivers')}
                        className="group flex items-center gap-4 p-5 rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md hover:border-[#3D5A3D]/30 hover:-translate-y-0.5"
                    >
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                            <Car size={24} weight="duotone" />
                        </div>
                        <div className="text-left">
                            <h3 className="font-semibold text-slate-900">Add Drivers</h3>
                            <p className="text-sm text-slate-500">Register your driver fleet</p>
                        </div>
                    </button>
                    <button
                        onClick={() => navigateTo('upload')}
                        className="group flex items-center gap-4 p-5 rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md hover:border-[#3D5A3D]/30 hover:-translate-y-0.5"
                    >
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-100 transition-colors">
                            <CloudArrowUp size={24} weight="duotone" />
                        </div>
                        <div className="text-left">
                            <h3 className="font-semibold text-slate-900">Bulk Upload</h3>
                            <p className="text-sm text-slate-500">Import data from spreadsheets</p>
                        </div>
                    </button>
                </div>
            )}

            {/* Content Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                {/* Trip Performance - Left column (3/5) */}
                <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">
                                Trip Performance
                            </h2>
                            <p className="text-sm text-slate-500">
                                {new Date().toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                        </div>
                        <button className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                            <DotsThreeVertical size={18} weight="bold" />
                        </button>
                    </div>

                    {showRealData ? (
                        <>
                            <div className="flex items-baseline gap-3 mb-6">
                                <span className="text-3xl font-semibold text-slate-900">$24,747.01</span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F5E9] px-2 py-0.5 text-xs font-medium text-[#2E7D32]">
                                    <TrendUp size={12} weight="bold" />
                                    12%
                                </span>
                                <span className="text-sm text-slate-500">vs last month</span>
                            </div>

                            {/* Simple bar chart visualization */}
                            <div className="flex items-end justify-between gap-4 h-48 px-4">
                                {[
                                    { month: "Jan", value: 78, highlight: false },
                                    { month: "Feb", value: 34, highlight: true },
                                    { month: "Mar", value: 67, highlight: false },
                                    { month: "Apr", value: 28, highlight: false },
                                    { month: "May", value: 39, highlight: false },
                                    { month: "Jun", value: 80, highlight: false },
                                ].map((item) => (
                                    <div key={item.month} className="flex flex-col items-center gap-2 flex-1">
                                        <span className="text-xs text-slate-500">{item.value}%</span>
                                        <div
                                            className={cn(
                                                "w-full rounded-t-lg transition-all",
                                                item.highlight
                                                    ? "bg-gradient-to-t from-[#FF7043] to-[#FFAB91]"
                                                    : "bg-slate-200"
                                            )}
                                            style={{ height: `${item.value * 1.5}px` }}
                                        />
                                        <span className={cn(
                                            "text-xs font-medium",
                                            item.highlight ? "text-slate-900" : "text-slate-500"
                                        )}>
                                            {item.month}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <DashboardEmptySection
                            title="No trip data yet"
                            description="Start scheduling trips to see performance analytics and revenue insights"
                            icon={TrendUp}
                            ctaLabel="Create your first trip"
                            onAction={() => navigateTo('dashboard')}
                        />
                    )}
                </div>

                {/* Schedule - Right column (2/5) */}
                <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">
                            Schedule Trip
                        </h2>
                        <div className="flex items-center gap-2">
                            <button className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                                <CaretUp size={16} weight="bold" className="-rotate-90" />
                            </button>
                            <button className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                                <CaretUp size={16} weight="bold" className="rotate-90" />
                            </button>
                        </div>
                    </div>

                    {/* Month header */}
                    <p className="text-sm font-medium text-slate-900 mb-3">{monthYear}</p>

                    {/* Mini calendar week */}
                    <div className="grid grid-cols-7 gap-1 mb-6">
                        {weekDays.map((day) => (
                            <div
                                key={day.day}
                                className={cn(
                                    "flex flex-col items-center gap-1 rounded-lg py-2 text-center transition",
                                    day.isToday
                                        ? "bg-[#3D5A3D] text-white"
                                        : "text-slate-600 hover:bg-slate-100"
                                )}
                            >
                                <span className="text-[10px] font-medium uppercase">
                                    {day.day}
                                </span>
                                <span className="text-sm font-semibold">{day.date}</span>
                            </div>
                        ))}
                    </div>

                    {/* Schedule items */}
                    {showRealData ? (
                        <div className="space-y-3">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Today
                            </p>
                            {scheduleItems.map((item) => (
                                <div
                                    key={item.id}
                                    className={cn(
                                        "flex items-start gap-3 rounded-xl p-3 border-l-4",
                                        item.color === "coral" && "bg-[#FFF3E0] border-l-[#FF7043]",
                                        item.color === "mint" && "bg-[#E8F5E9] border-l-[#66BB6A]",
                                        item.color === "lavender" && "bg-[#F3E5F5] border-l-[#AB47BC]"
                                    )}
                                >
                                    <div className={cn(
                                        "flex h-8 w-8 items-center justify-center rounded-lg",
                                        item.color === "coral" && "bg-white/80 text-[#FF7043]",
                                        item.color === "mint" && "bg-white/80 text-[#66BB6A]",
                                        item.color === "lavender" && "bg-white/80 text-[#AB47BC]"
                                    )}>
                                        <CalendarBlank size={16} weight="duotone" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-900 truncate">
                                            {item.title}
                                        </p>
                                        <p className="text-xs text-slate-500">{item.time}</p>
                                    </div>
                                    <button className="rounded p-1 text-slate-400 hover:bg-white/50 hover:text-slate-600">
                                        <DotsThreeVertical size={16} weight="bold" />
                                    </button>
                                </div>
                            ))}

                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider pt-2">
                                Sat, Dec 20
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                                <CalendarBlank size={24} weight="duotone" />
                            </div>
                            <p className="text-sm font-medium text-slate-700 mb-1">No scheduled trips</p>
                            <p className="text-xs text-slate-500">Add patients and drivers first</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Grid - Recent Activity and Alerts */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Recent Activity */}
                <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">
                                Recent Activity
                            </h2>
                            <p className="text-xs text-slate-500">
                                Live view of today&apos;s trips and handoffs.
                            </p>
                        </div>
                        <button className="text-sm font-medium text-[#3D5A3D] hover:underline">
                            View all
                        </button>
                    </div>

                    {showRealData ? (
                        <div className="space-y-3">
                            {recentActivities.map((activity) => (
                                <div
                                    key={activity.id}
                                    className="flex cursor-pointer items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 text-sm transition hover:border-[#3D5A3D]/20 hover:bg-[#3D5A3D]/5"
                                >
                                    <div
                                        className={cn(
                                            "h-2 w-2 rounded-full",
                                            activity.status === "completed" && "bg-[#66BB6A]",
                                            activity.status === "in-progress" &&
                                            "bg-[#FFA726] animate-pulse",
                                            activity.status === "scheduled" && "bg-slate-400"
                                        )}
                                    />

                                    <div className="min-w-0 flex-1 space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <p className="truncate text-sm font-medium text-slate-900">
                                                {activity.patient}
                                            </p>
                                            <span className="text-xs text-slate-400">→</span>
                                            <p className="truncate text-xs text-slate-500">
                                                {activity.driver}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <MapPin size={12} weight="duotone" />
                                            <span className="truncate">{activity.destination}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-1 text-xs">
                                        <span className="font-medium text-slate-700">
                                            {activity.time}
                                        </span>
                                        <span
                                            className={cn(
                                                "rounded-full px-2 py-1 text-[11px] font-semibold",
                                                activity.status === "completed" &&
                                                "bg-[#E8F5E9] text-[#2E7D32]",
                                                activity.status === "in-progress" &&
                                                "bg-[#FFF3E0] text-[#E65100]",
                                                activity.status === "scheduled" &&
                                                "bg-slate-100 text-slate-600"
                                            )}
                                        >
                                            {activity.status === "in-progress"
                                                ? "In progress"
                                                : activity.status.charAt(0).toUpperCase() +
                                                activity.status.slice(1)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <DashboardEmptySection
                            title="No recent activity"
                            description="Once you start scheduling trips, you'll see real-time activity here"
                            icon={ListChecks}
                            ctaLabel="Get started"
                            onAction={() => navigateTo('patients')}
                        />
                    )}
                </div>

                {/* Alerts */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-5 text-lg font-semibold text-slate-900">
                        Alerts
                    </h2>

                    {showRealData ? (
                        <div className="space-y-3">
                            <div className="rounded-xl border border-[#FFCC80] bg-[#FFF3E0] p-4">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#FF7043] shadow-sm">
                                        <WarningCircle size={18} weight="duotone" />
                                    </div>
                                    <div>
                                        <h3 className="mb-1 text-sm font-semibold text-slate-900">
                                            Vehicle maintenance
                                        </h3>
                                        <p className="text-xs text-slate-600">
                                            3 vehicles due for maintenance this week.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-[#90CAF9] bg-[#E3F2FD] p-4">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#42A5F5] shadow-sm">
                                        <CalendarBlank size={18} weight="duotone" />
                                    </div>
                                    <div>
                                        <h3 className="mb-1 text-sm font-semibold text-slate-900">
                                            Upcoming appointments
                                        </h3>
                                        <p className="text-xs text-slate-600">
                                            42 medical trips scheduled for tomorrow.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-[#A5D6A7] bg-[#E8F5E9] p-4">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#66BB6A] shadow-sm">
                                        <TrendUp size={18} weight="duotone" />
                                    </div>
                                    <div>
                                        <h3 className="mb-1 text-sm font-semibold text-slate-900">
                                            Performance up
                                        </h3>
                                        <p className="text-xs text-slate-600">
                                            On-time arrival rate improved to 96.5%.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                                <WarningCircle size={24} weight="duotone" />
                            </div>
                            <p className="text-sm font-medium text-slate-700 mb-1">No alerts</p>
                            <p className="text-xs text-slate-500 max-w-[180px]">
                                Important updates will appear here once you have data
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
