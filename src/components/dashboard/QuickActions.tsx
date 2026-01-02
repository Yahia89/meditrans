import { Users, Car, CloudArrowUp, CaretRight } from "@phosphor-icons/react";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { usePermissions } from "@/hooks/usePermissions";

export function QuickActions() {
  const { navigateTo } = useOnboarding();
  const { isAdmin, isEmployee } = usePermissions();

  if (!isAdmin && !isEmployee) return null;

  const actions = [
    {
      title: "Add Patients",
      desc: "Register new patient records in your system.",
      icon: Users,
      iconColor: "text-blue-600",
      bgColor: "bg-blue-50/50",
      action: () => navigateTo("patients"),
    },
    {
      title: "Add Drivers",
      desc: "Enroll and manage your fleet's drivers.",
      icon: Car,
      iconColor: "text-emerald-600",
      bgColor: "bg-emerald-50/50",
      action: () => navigateTo("drivers"),
    },
    {
      title: "Bulk Upload",
      desc: "Import large datasets via CSV or Excel.",
      icon: CloudArrowUp,
      iconColor: "text-purple-600",
      bgColor: "bg-purple-50/50",
      action: () => navigateTo("upload"),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {actions.map((action) => (
        <button
          key={action.title}
          onClick={action.action}
          className="group relative flex flex-col p-6 text-left bg-white rounded-2xl border border-slate-100 shadow-sm transition-all hover:border-emerald-200 hover:shadow-md hover:-translate-y-1"
        >
          <div
            className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl ${action.bgColor} ${action.iconColor} transition-colors group-hover:bg-emerald-600 group-hover:text-white`}
          >
            <action.icon size={24} weight="duotone" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-emerald-800 transition-colors">
            {action.title}
          </h3>
          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            {action.desc}
          </p>
          <div className="mt-auto flex items-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-all transform translate-x-1 group-hover:translate-x-0">
            Get Started <CaretRight size={14} weight="bold" />
          </div>
        </button>
      ))}
    </div>
  );
}
