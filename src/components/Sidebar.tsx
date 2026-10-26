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
  | "settings"
  | "users";

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onLogout: () => void;
  userRole?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  onLogout,
  userRole,
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
    { id: "settings", label: "Integration Settings", icon: Settings },
    { id: "users", label: "User Management", icon: Users },
  ];

  return (
    <aside
      className={`bg-[#2c2018] text-stone-200 transition-all duration-300 flex flex-col border-r border-[#3d2d23] ${
        collapsed ? "w-16" : "w-64"
      } no-print select-none h-screen sticky top-0`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#3d2d23]">
        {!collapsed ? (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded bg-[#a27b5c] text-white flex items-center justify-center font-serif font-bold text-lg">
              K
            </div>
            <div>
              <span className="font-semibold text-stone-100 tracking-wide text-sm block">KOA LIVING</span>
              <span className="text-[10px] text-stone-400 block tracking-wider uppercase">Order Management</span>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 mx-auto rounded bg-[#a27b5c] text-white flex items-center justify-center font-serif font-bold text-lg">
            K
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded hover:bg-[#3d2d23] text-stone-400 hover:text-white transition"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
                isActive
                  ? "bg-[#a27b5c] text-white shadow-sm"
                  : "text-stone-300 hover:bg-[#3d2d23] hover:text-white"
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer / User Role */}
      <div className="p-3 border-t border-[#3d2d23] flex items-center justify-between text-xs">
        {!collapsed && (
          <div className="truncate">
            <span className="text-[10px] text-stone-400 uppercase tracking-wider block">Access Role</span>
            <span className="font-semibold text-stone-200 block truncate">{userRole || "User"}</span>
          </div>
        )}
        <button
          onClick={onLogout}
          className="p-1.5 rounded hover:bg-[#3d2d23] text-stone-400 hover:text-red-400 transition ml-auto"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
