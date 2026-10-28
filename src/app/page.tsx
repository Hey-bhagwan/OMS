"use client";

import React, { useState, useEffect } from "react";
import { Sidebar, NavTab } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { DashboardView } from "@/components/views/DashboardView";
import { OrdersView } from "@/components/views/OrdersView";
import { RawMaterialView } from "@/components/views/RawMaterialView";
import { ProductionView } from "@/components/views/ProductionView";
import { PackingView } from "@/components/views/PackingView";
import { DispatchView } from "@/components/views/DispatchView";
import { DeliveryView } from "@/components/views/DeliveryView";
import { InventoryView } from "@/components/views/InventoryView";
import { StockAdjustmentsView } from "@/components/views/StockAdjustmentsView";
import { StockHistoryView } from "@/components/views/StockHistoryView";
import { ReportsView } from "@/components/views/ReportsView";
import { SettingsView } from "@/components/views/SettingsView";
import { UsersView } from "@/components/views/UsersView";
import { ProductMasterView } from "@/components/views/ProductMasterView";
import { invalidateCache } from "@/lib/useCachedFetch";

export default function Home() {
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [loginEmail, setLoginEmail] = useState("admin@koaliving.com");
  const [loginPass, setLoginPass] = useState("KoaLiving2026!");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.authenticated) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setCheckingAuth(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPass }),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
      } else {
        setLoginError(data.error || "Login failed");
      }
    } catch {
      setLoginError("Login request failed");
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/me", { method: "POST" });
    setUser(null);
  };

  if (checkingAuth) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#faf9f8]">
        <div className="text-stone-500 text-xs font-medium">Initializing Koa Living OMS...</div>
      </div>
    );
  }

  // If not logged in, render the secure Sign In screen
  if (!user) {
    return (
      <div className="min-h-screen bg-[#2c2018] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8 space-y-6">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 mx-auto rounded-lg bg-[#a27b5c] text-white flex items-center justify-center font-serif font-bold text-2xl shadow-sm">
              K
            </div>
            <h1 className="text-xl font-bold text-stone-900 tracking-tight pt-2">Koa Living OMS</h1>
            <p className="text-xs text-stone-500">Sign in to access centralized operations & inventory management</p>
          </div>

          {loginError && (
            <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-lg text-xs">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Email Address</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a27b5c]"
              />
            </div>

            <div>
              <label className="font-semibold text-stone-700 block mb-1">Password</label>
              <input
                type="password"
                required
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a27b5c]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#a27b5c] hover:bg-[#8a6549] text-white font-semibold rounded-lg shadow-sm transition text-xs"
            >
              Sign In to OMS
            </button>
          </form>

          <div className="pt-2 border-t border-stone-100 text-[11px] text-stone-400 space-y-1">
            <div className="font-medium text-stone-600">Quick Test Credentials:</div>
            <div>Admin: <span className="font-mono text-stone-700">admin@koaliving.com</span> / <span className="font-mono text-stone-700">KoaLiving2026!</span></div>
            <div>Operations: <span className="font-mono text-stone-700">ops@koaliving.com</span> / <span className="font-mono text-stone-700">KoaLiving2026!</span></div>
            <div>Inventory: <span className="font-mono text-stone-700">inventory@koaliving.com</span> / <span className="font-mono text-stone-700">KoaLiving2026!</span></div>
          </div>
        </div>
      </div>
    );
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardView key={refreshKey} onNavigateToTab={(t) => setActiveTab(t)} searchFilter={searchQuery} />;
      case "orders":
        return <OrdersView key={refreshKey} searchFilter={searchQuery} />;
      case "raw_material":
        return <RawMaterialView key={refreshKey} searchFilter={searchQuery} />;
      case "production":
        return <ProductionView key={refreshKey} searchFilter={searchQuery} />;
      case "packing":
        return <PackingView key={refreshKey} searchFilter={searchQuery} />;
      case "dispatch":
        return <DispatchView key={refreshKey} searchFilter={searchQuery} />;
      case "delivery":
        return <DeliveryView key={refreshKey} searchFilter={searchQuery} />;
      case "packed_inventory":
        return <InventoryView key={refreshKey} bucket="PACKED" searchFilter={searchQuery} />;
      case "unpacked_inventory":
        return <InventoryView key={refreshKey} bucket="UNPACKED" searchFilter={searchQuery} />;
      case "stock_adjustments":
        return <StockAdjustmentsView key={refreshKey} />;
      case "stock_history":
        return <StockHistoryView key={refreshKey} searchFilter={searchQuery} />;
      case "products":
        return <ProductMasterView key={refreshKey} searchFilter={searchQuery} />;
      case "reports":
        return <ReportsView key={refreshKey} />;
      case "settings":
        return <SettingsView key={refreshKey} />;
      case "users":
        return <UsersView key={refreshKey} />;
      default:
        return <DashboardView onNavigateToTab={(t) => setActiveTab(t)} searchFilter={searchQuery} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#faf9f8]">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setSearchQuery("");
        }}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        onLogout={handleLogout}
        userRole={user.role}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRefreshData={() => {
            invalidateCache();
            setRefreshKey((k) => k + 1);
          }}
          userName={user.name}
          userRole={user.role}
        />

        <main className="flex-1 p-6 overflow-y-auto">
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
}
