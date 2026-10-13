"use client";

import * as React from "react";
import {
  Users,
  Car,
  Upload,
  ChartNoAxesCombined,
  Contact,
  Shield,
  Map,
  Coins,
  Clock,
  FileText,
  Radio,
  Building2,
  FileChartColumn,
  Plug,
  ClipboardList,
} from "lucide-react";

import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import { type Page } from "@/lib/pages";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "dashboard" as Page,
      icon: ChartNoAxesCombined,
    },
    {
      title: "Trips",
      url: "trips" as Page,
      icon: Map,
    },
    {
      title: "Brokers",
      url: "broker-integrations" as Page,
      icon: Plug,
    },
    {
      title: "Live",
      url: "live-tracking" as Page,
      icon: Radio,
    },
    {
      title: "Patients",
      url: "patients" as Page,
      icon: Users,
    },
    {
      title: "Drivers",
      url: "drivers" as Page,
      icon: Car,
    },
    {
      title: "STS Inspection",
      url: "sts-inspection" as Page,
      icon: ClipboardList,
    },
    {
      title: "Employees",
      url: "employees" as Page,
      icon: Contact,
    },
    {
      title: "Upload",
      url: "upload" as Page,
      icon: Upload,
    },
    {
      title: "Summary",
      url: "summary" as Page,
      icon: FileChartColumn,
    },
  ],
};

import { usePermissions } from "@/hooks/usePermissions";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuditAccess } from "@/hooks/useAuditAccess";

export function AppSidebar({
  currentPage,
  onNavigate,
  ...props
}: AppSidebarProps) {
  const { currentOrganization } = useOrganization();
  const { canManageAudit } = useAuditAccess();
  const {
    isSuperAdmin,
    isDriver,
    isDispatch,
    isAdmin,
    canViewEmployees,
    canUploadFiles,
    canViewMedicaid,
  } = usePermissions();

  let navItems = [...data.navMain];

  // Filter nav items based on permissions
  navItems = navItems.filter((item) => {
    if (item.url === "sts-inspection" && !canManageAudit) return false;
    // Employees: only visible to admin+
    if (item.url === "employees" && !canViewEmployees) return false;
    // Upload: only visible to admin+
    if (item.url === "upload" && !canUploadFiles) return false;

    // Live: only visible to dispatch+ (owner, admin, dispatch)
    if (item.url === "live-tracking" && !isDispatch) return false;

    // Summary: only visible to dispatch+ (owner, admin, dispatch)
    if (item.url === "summary" && !isDispatch) return false;

    // Brokers: credential management is admin+ AND enabled for the organization
    if (item.url === "broker-integrations" && (!isAdmin || !currentOrganization?.brokers_enabled)) return false;

    return true;
  });

  if (isDriver) {
    navItems = navItems.filter((item) => item.title === "Trips");
    navItems.push({
      title: "History",
      url: "driver-history" as Page,
      icon: Clock,
    });
  }

  // Add Medicaid Billing and Client Credits to owners and admins only
  if (canViewMedicaid) {
    navItems.push({
      title: "Billing & Payments",
      url: "medicaid-billing" as Page,
      icon: FileText,
    });
    navItems.push({
      title: "Client Credits",
      url: "client-credits" as Page,
      icon: Coins,
    });
  }

  if (isSuperAdmin) {
    // For Super Admin (Founder), clear everything else and show only specific tools
    navItems = [
      {
        title: "Companies",
        url: "companies" as Page,
        icon: Building2,
      },
      {
        title: "Founder Tool",
        url: "founder" as Page,
        icon: Shield,
      },
    ];
    // Founder access alone is insufficient; a company membership is required.
    if (canManageAudit) navItems.push({ title: "STS Inspection", url: "sts-inspection", icon: ClipboardList });
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {/* <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
                <Heartbeat className="size-5" />
              </div> */}
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {currentOrganization?.name ||
                    (isSuperAdmin ? "Future Transportation" : "Loading...")}
                </span>
                <span className="truncate text-xs">CRM System</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu className="flex flex-col gap-2 p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentPage === item.url ||
              (item.url === "patients" && currentPage === "patient-details") ||
              (item.url === "drivers" && currentPage === "driver-details") ||
              (item.url === "employees" &&
                currentPage === "employee-details") ||
              (item.url === "trips" && currentPage === "trip-details") ||
              (item.url === "broker-integrations" &&
                currentPage === "broker-integrations") ||
              (item.url === "client-credits" &&
                currentPage === "client-credits") ||
              (item.url === "client-credits" &&
                currentPage === "client-credits") ||
              (item.url === "medicaid-billing" &&
                currentPage === "medicaid-billing") ||
              (item.url === "live-tracking" && currentPage === "live-tracking");
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  isActive={isActive}
                  onClick={() => onNavigate(item.url)}
                  tooltip={item.title}
                  size="lg"
                >
                  <Icon className="!size-7" />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        {canManageAudit && <SidebarMenu><SidebarMenuItem><SidebarMenuButton
          isActive={currentPage === "company"}
          onClick={() => onNavigate("company")}
          tooltip="Company"
          size="lg"
        ><Building2 className="!size-7" /><span>Company</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu>}
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
