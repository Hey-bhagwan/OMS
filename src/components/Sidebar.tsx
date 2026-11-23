"use client";

import React from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Factory,
  PackageCheck,
  Send,
  Truck,
  Archive,
  Layers,
  SlidersHorizontal,
  History,
  FileSpreadsheet,
  Settings,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  PackagePlus,
  Webhook,
} from "lucide-react";

export type NavTab =
  | "dashboard"
  | "orders"
  | "raw_material"
  | "production"
  | "packing"
  | "dispatch"
  | "delivery"
  | "packed_inventory"
  | "unpacked_inventory"
  | "stock_adjustments"
  | "stock_history"
  | "products"
  | "reports"
  | "webhooks"
  | "settings"
  | "users";

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onLogout: () => void;
  userRole?: string;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  onLogout,
  userRole,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const menuItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "orders", label: "All Orders", icon: ShoppingCart },
    { id: "raw_material", label: "Raw Material", icon: Boxes },
    { id: "production", label: "Production", icon: Factory },
    { id: "packing", label: "Packing", icon: PackageCheck },
    { id: "dispatch", label: "Dispatch", icon: Send },
    { id: "delivery", label: "Delivery", icon: Truck },
    { id: "packed_inventory", label: "Packed Inventory", icon: Archive },
    { id: "unpacked_inventory", label: "Unpacked Inventory", icon: Layers },
    { id: "stock_adjustments", label: "Stock Adjustments", icon: SlidersHorizontal },
    { id: "stock_history", label: "Stock History", icon: History },
    { id: "products", label: "Product Master", icon: PackagePlus },
    { id: "reports", label: "Reports", icon: FileSpreadsheet },
    { id: "webhooks", label: "Webhook Logs", icon: Webhook },
    { id: "settings", label: "Integration Settings", icon: Settings },
    { id: "users", label: "User Management", icon: Users },
  ];

  return (
    <>
      {/* Mobile Backdrop overlay */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs transition-opacity"
          aria-hidden="true"
        />
      )}

      <aside
        className={`bg-[#2c2018] text-stone-200 transition-all duration-300 flex flex-col border-r border-[#3d2d23] no-print select-none h-screen 
          fixed inset-y-0 left-0 z-50 md:sticky md:top-0
          ${mobileOpen ? "translate-x-0 w-64 shadow-2xl" : "-translate-x-full md:translate-x-0"}
          ${collapsed ? "md:w-16" : "md:w-64"}
        `}
      >
        {/* Brand Header */}
        <div className={`h-16 flex items-center border-b border-[#3d2d23] ${collapsed ? "justify-center px-1 gap-1" : "justify-between px-4"}`}>
          {!collapsed ? (
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 shrink-0 rounded bg-[#a27b5c] text-white flex items-center justify-center font-serif font-bold text-lg select-none">
                K
              </div>
              <div className="min-w-0 overflow-hidden">
                <span className="font-semibold text-stone-100 tracking-wide text-sm block truncate">KOA LIVING</span>
                <span className="text-[10px] text-stone-400 block tracking-wider uppercase truncate">Order Management</span>
              </div>
            </div>
          ) : (
            <div className="w-7 h-7 shrink-0 rounded bg-[#a27b5c] text-white flex items-center justify-center font-serif font-bold text-sm select-none">
              K
            </div>
          )}
          {/* Collapse button on desktop, close button on mobile */}
          <div className="flex items-center shrink-0">
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded hover:bg-[#3d2d23] text-stone-400 hover:text-white transition md:hidden"
              title="Close navigation"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={onToggleCollapse}
              className={`hidden md:flex items-center justify-center rounded hover:bg-[#3d2d23] text-stone-400 hover:text-white transition ${collapsed ? "p-1" : "p-1.5"}`}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? "bg-[#a27b5c] text-white shadow-sm"
                    : "text-stone-300 hover:bg-[#3d2d23] hover:text-white"
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className={`${collapsed ? "md:hidden" : ""} truncate`}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer / User Role */}
        <div className="p-3 border-t border-[#3d2d23] flex items-center justify-between text-xs">
          <div className={`${collapsed ? "md:hidden" : ""} truncate`}>
            <span className="text-[10px] text-stone-400 uppercase tracking-wider block">Access Role</span>
            <span className="font-semibold text-stone-200 block truncate">{userRole || "User"}</span>
          </div>
          <button
            onClick={onLogout}
            className="p-1.5 rounded hover:bg-[#3d2d23] text-stone-400 hover:text-red-400 transition ml-auto"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  );
};
