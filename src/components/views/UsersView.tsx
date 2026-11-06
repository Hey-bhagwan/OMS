"use client";

import React, { useEffect, useState } from "react";
import { Users, UserPlus, CheckCircle2, FilterX } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { ColumnFilter } from "@/components/ui/ColumnFilter";
import { DataTablePagination } from "@/components/ui/DataTablePagination";
import { useTableFiltersAndPagination } from "@/components/ui/useTableFiltersAndPagination";
import { DateSortHeader } from "@/components/ui/DateSortHeader";

export const UsersView: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("OPERATIONS_MANAGER");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const {
    currentPage,
    pageSize,
    totalPages,
    totalRecords,
    columnFilters,
    filteredData,
    paginatedData,
    hasActiveFilters,
    sortColumn,
    sortDirection,
    toggleDateSort,
    setCurrentPage,
    setPageSize,
    setColumnFilter,
    clearColumnFilter,
    clearAllFilters,
    getDistinctValues,
  } = useTableFiltersAndPagination<any>(users, {
    dateSortExtractors: {
      createdAt: (u) => u.createdAt,
    },
    customFilterFn: (u, filters) => {
      if (filters.createdAt && filters.createdAt.length > 0) {
        const d = formatDate(u.createdAt);
        if (!filters.createdAt.includes(d)) return false;
      }
      return true;
    },
  });

  const fetchUsers = () => {
    setLoading(true);
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        setUsers(data.users || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, password }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg(`User ${name} created successfully.`);
        setShowModal(false);
        setName("");
        setEmail("");
        setPassword("");
        fetchUsers();
      } else {
        setMsg(data.error || "Failed to create user.");
      }
    } catch {
      setMsg("Request failed.");
    } finally {
      setTimeout(() => setMsg(null), 4000);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="bg-white p-4 rounded-lg border border-stone-200 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">User Access & Role Management</h3>
          <p className="text-xs text-stone-500">
            Granular role-based permissions across Admins, Operations, Inventory, Production, Packing, Dispatch, and Auditors
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition"
            >
              <FilterX className="w-3.5 h-3.5" />
              <span>Clear Filters</span>
            </button>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#a27b5c] hover:bg-[#8a6549] text-white rounded text-xs font-semibold transition"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      {msg && (
        <div className="p-3 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
              <tr>
                <th className="py-2.5 px-4">
                  <div className="flex items-center justify-between">
                    <span>Staff Name</span>
                    <ColumnFilter
                      columnId="name"
                      columnTitle="Staff Name"
                      options={getDistinctValues("name", (u) => u.name)}
                      selectedValues={columnFilters["name"] || []}
                      onApply={(vals) => setColumnFilter("name", vals)}
                      onClear={() => clearColumnFilter("name")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4">
                  <div className="flex items-center justify-between">
                    <span>Email Address</span>
                    <ColumnFilter
                      columnId="email"
                      columnTitle="Email Address"
                      options={getDistinctValues("email", (u) => u.email)}
                      selectedValues={columnFilters["email"] || []}
                      onApply={(vals) => setColumnFilter("email", vals)}
                      onClear={() => clearColumnFilter("email")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4">
                  <div className="flex items-center justify-between">
                    <span>Assigned Role</span>
                    <ColumnFilter
                      columnId="role"
                      columnTitle="Assigned Role"
                      options={getDistinctValues("role", (u) => u.role)}
                      selectedValues={columnFilters["role"] || []}
                      onApply={(vals) => setColumnFilter("role", vals)}
                      onClear={() => clearColumnFilter("role")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">
                  <DateSortHeader
                    title="Created Date"
                    columnId="createdAt"
                    currentSortColumn={sortColumn}
                    currentSortDirection={sortDirection}
                    onSortChange={toggleDateSort}
                  >
                    <ColumnFilter
                      columnId="createdAt"
                      columnTitle="Created Date"
                      options={getDistinctValues("createdAt", (u) => formatDate(u.createdAt))}
                      selectedValues={columnFilters["createdAt"] || []}
                      onApply={(vals) => setColumnFilter("createdAt", vals)}
                      onClear={() => clearColumnFilter("createdAt")}
                    />
                  </DateSortHeader>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-stone-400">Loading users...</td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-stone-400">No users found matching your filters.</td>
                </tr>
              ) : (
                paginatedData.map((u) => (
                  <tr key={u.id} className="hover:bg-stone-50/70 transition">
                    <td className="py-2.5 px-4 font-semibold text-stone-800">{u.name}</td>
                    <td className="py-2.5 px-4 font-mono text-stone-600">{u.email}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="text-emerald-700 font-semibold">Active</span>
                    </td>
                    <td className="py-2.5 px-4 text-stone-500">{formatDate(u.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalRecords={totalRecords}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-md bg-white p-6 rounded-lg shadow-xl border border-stone-200 space-y-4 text-xs"
          >
            <h3 className="text-sm font-bold text-stone-900">Add Staff User Account</h3>

            <div>
              <label className="font-semibold text-stone-700 block mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Devendra Saini"
                className="w-full px-3 py-1.5 border border-stone-300 rounded focus:ring-1 focus:ring-[#a27b5c]"
              />
            </div>

            <div>
              <label className="font-semibold text-stone-700 block mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="devendra@koaliving.com"
                className="w-full px-3 py-1.5 border border-stone-300 rounded focus:ring-1 focus:ring-[#a27b5c]"
              />
            </div>

            <div>
              <label className="font-semibold text-stone-700 block mb-1">Operational Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-1.5 border border-stone-300 rounded focus:ring-1 focus:ring-[#a27b5c] bg-white"
              >
                <option value="ADMIN">ADMIN</option>
                <option value="OPERATIONS_MANAGER">OPERATIONS_MANAGER</option>
                <option value="INVENTORY_MANAGER">INVENTORY_MANAGER</option>
                <option value="PRODUCTION_STAFF">PRODUCTION_STAFF</option>
                <option value="PACKING_STAFF">PACKING_STAFF</option>
                <option value="DISPATCH_STAFF">DISPATCH_STAFF</option>
                <option value="AUDITOR">AUDITOR</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-stone-700 block mb-1">Initial Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-1.5 border border-stone-300 rounded focus:ring-1 focus:ring-[#a27b5c]"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 text-stone-600 hover:bg-stone-100 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 font-semibold bg-[#a27b5c] text-white hover:bg-[#8a6549] rounded transition"
              >
                Create Account
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
