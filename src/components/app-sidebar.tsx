"use client"

import * as React from "react"
import {
  Heartbeat,
  UsersThree,
  CarProfile,
  UploadSimple,
  ChartLine,
} from "@phosphor-icons/react"

import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

// Page type must match the pages defined in App.tsx
type Page = 'dashboard' | 'patients' | 'drivers' | 'upload'

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  currentPage: Page
  onNavigate: (page: Page) => void
}

const data = {
  user: {
    name: "Admin User",
    email: "admin@meditrans.com",
    avatar: "/avatars/user.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "dashboard" as Page,
      icon: ChartLine,
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
      title: "Upload",
      url: "upload" as Page,
      icon: UploadSimple,
    },
  ],
}

export function AppSidebar({ currentPage, onNavigate, ...props }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
                <Heartbeat weight="duotone" className="size-5" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Future Transportation</span>
                <span className="truncate text-xs">CRM System</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu className="flex flex-col gap-2 p-2">
          {data.navMain.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.url
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
            )
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
