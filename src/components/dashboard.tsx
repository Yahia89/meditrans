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
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

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

interface RecentActivityItem {
    id: string;
    patient: string;
    driver: string;
    time: string;
    status: "completed" | "in-progress" | "scheduled";
    destination: string;
}

const recentActivities: RecentActivityItem[] = [
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

const scheduleItems: ScheduleItem[] = [
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

export function Dashboard() {
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <h1 className="text-2xl font-semibold text-slate-900">
                        Dashboard
                    </h1>
                    <p className="text-sm text-slate-500">
                        Welcome, Let&apos;s dive into your personalized setup guide.
                    </p>
                </div>

                <button className="inline-flex items-center gap-2 rounded-lg bg-[#3D5A3D] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#2E4A2E]">
                    <UsersThree size={18} weight="duotone" />
                    + Create trip
                </button>
            </div>

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

                {/* Stats Grid - Horizontal inline like reference */}
                <div className="grid grid-cols-2 gap-8 md:grid-cols-4 divide-x divide-slate-100">
                    <div className="pl-0">
                        <InlineStat
                            label="Total Patients"
                            value="1,248"
                            change="+0.02%"
                            changeType="positive"
                        />
                    </div>
                    <div className="pl-8">
                        <InlineStat
                            label="Active Drivers"
                            value="38"
                            change="+0.02%"
                            changeType="positive"
                        />
                    </div>
                    <div className="pl-8">
                        <InlineStat
                            label="Today's Trips"
                            value="156"
                            change="+0.02%"
                            changeType="positive"
                        />
                    </div>
                    <div className="pl-8">
                        <InlineStat
                            label="Scheduled"
                            value="42"
                            change="+0.02%"
                            changeType="positive"
                        />
                    </div>
                </div>
            </div>

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
                </div>

                {/* Alerts */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-5 text-lg font-semibold text-slate-900">
                        Alerts
                    </h2>

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
                </div>
            </div>
        </div>
    );
}
