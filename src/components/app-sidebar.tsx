"use client";

import * as React from "react";
import {
  UsersThree,
  CarProfile,
  UploadSimple,
  ChartLine,
  UserList,
  Shield,
  MapTrifold,
  Coins,
  Clock,
  FileText,
  Broadcast,
} from "@phosphor-icons/react";

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

// Page type must match the pages defined in App.tsx
import { type Page } from "@/App";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "dashboard" as Page,
      icon: ChartLine,
    },
    {
      title: "Trips",
      url: "trips" as Page,
      icon: MapTrifold,
    },
    {
      title: "Live",
      url: "live-tracking" as Page,
      icon: Broadcast,
    },
    {
      title: "Patients",
      url: "patients" as Page,
      icon: UsersThree,
    },
    {
      title: "Drivers",
      url: "drivers" as Page,
      icon: CarProfile,
    },
    {
      title: "Employees",
      url: "employees" as Page,
      icon: UserList,
    },
    {
      title: "Upload",
      url: "upload" as Page,
      icon: UploadSimple,
    },
  ],
};

import { usePermissions } from "@/hooks/usePermissions";

export function AppSidebar({
  currentPage,
  onNavigate,
  ...props
}: AppSidebarProps) {
  const {
    isSuperAdmin,
    isDriver,
    isDispatch,
    canViewEmployees,
    canUploadFiles,
    canViewMedicaid,
  } = usePermissions();

  let navItems = [...data.navMain];

  // Filter nav items based on permissions
  navItems = navItems.filter((item) => {
    // Employees: only visible to admin+
    if (item.url === "employees" && !canViewEmployees) return false;
    // Upload: only visible to admin+
    if (item.url === "upload" && !canUploadFiles) return false;

    // Live: only visible to dispatch+ (owner, admin, dispatch)
    if (item.url === "live-tracking" && !isDispatch) return false;

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
      title: "Medicaid Billing",
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
    navItems.push({
      title: "Founder Tool",
      url: "founder" as Page,
      icon: Shield,
    });
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
                <Heartbeat weight="duotone" className="size-5" />
              </div> */}
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  Future Transportation
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
                  <Icon weight="duotone" className="!size-7" />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
