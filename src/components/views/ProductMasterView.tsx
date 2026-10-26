"use client";

import React, { useEffect, useState } from "react";
import { Download, Printer, Plus, Edit2, Search, CheckCircle2, AlertCircle, X, Shield, RefreshCw } from "lucide-react";
import { formatCurrency, formatShortDate } from "@/lib/utils";

export const ProductMasterView: React.FC<{ searchFilter?: string }> = ({ searchFilter }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [localSearch, setLocalSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Furniture");
  const [description, setDescription] = useState("");
  const [unitOfManufacture, setUnitOfManufacture] = useState("PCS");
  const [defaultLeadTimeDays, setDefaultLeadTimeDays] = useState("7");
  const [unitPrice, setUnitPrice] = useState("0");
  const [domesticPackingType, setDomesticPackingType] = useState("Standard Box");
  const [exportPackingType, setExportPackingType] = useState("Export Palletized Wooden Crate");
  const [requiresSpecialHandling, setRequiresSpecialHandling] = useState(false);
  const [productionNotes, setProductionNotes] = useState("");
  const [qualityRequirements, setQualityRequirements] = useState("");
  const [isActive, setIsActive] = useState(true);

  const fetchProducts = () => {
    setLoading(true);
    let url = "/api/products?";
    if (categoryFilter) url += `category=${encodeURIComponent(categoryFilter)}&`;
    if (activeOnly) url += `activeOnly=true&`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setProducts(data.products || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchProducts();
  }, [categoryFilter, activeOnly]);

  const openAddModal = () => {
    setEditingProduct(null);
    setCode("");
    setName("");
    setCategory("Furniture");
    setDescription("");
    setUnitOfManufacture("PCS");
    setDefaultLeadTimeDays("7");
    setUnitPrice("0");
    setDomesticPackingType("Standard Box");
    setExportPackingType("Export Palletized Wooden Crate");
    setRequiresSpecialHandling(false);
    setProductionNotes("");
    setQualityRequirements("");
    setIsActive(true);
    setErrorMsg(null);
    setShowModal(true);
  };

  const openEditModal = (p: any) => {
    setEditingProduct(p);
    setCode(p.code);
    setName(p.name);
    setCategory(p.category || "Furniture");
    setDescription(p.description || "");
    setUnitOfManufacture(p.unitOfManufacture || "PCS");
    setDefaultLeadTimeDays(String(p.defaultLeadTimeDays || 7));
    setUnitPrice(String(p.unitPrice || 0));
    setDomesticPackingType(p.domesticPackingType || "Standard Box");
    setExportPackingType(p.exportPackingType || "Export Palletized Wooden Crate");
    setRequiresSpecialHandling(!!p.requiresSpecialHandling);
    setProductionNotes(p.productionNotes || "");
    setQualityRequirements(p.qualityRequirements || "");
    setIsActive(p.isActive !== false);
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    const payload = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      category: category.trim(),
      description: description.trim() || undefined,
      unitOfManufacture: unitOfManufacture.trim(),
      defaultLeadTimeDays: parseInt(defaultLeadTimeDays, 10) || 7,
      unitPrice: parseFloat(unitPrice) || 0,
      domesticPackingType: domesticPackingType.trim(),
      exportPackingType: exportPackingType.trim(),
      requiresSpecialHandling,
      productionNotes: productionNotes.trim() || undefined,
      qualityRequirements: qualityRequirements.trim() || undefined,
      isActive,
    };

    try {
      let res;
      if (editingProduct) {
        res = await fetch(`/api/products/${editingProduct.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (data.success) {
        setFeedback(editingProduct ? `Product ${payload.code} updated successfully` : `Product ${payload.code} created successfully`);
        setShowModal(false);
        fetchProducts();
      } else {
        setErrorMsg(data.error || "Failed to save product");
      }
    } catch {
      setErrorMsg("Request failed");
    } finally {
      setSubmitting(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const handleDeactivate = async (id: string, productCode: string) => {
    if (!confirm(`Are you sure you want to deactivate SKU ${productCode}? Existing orders will be preserved.`)) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setFeedback(`Product ${productCode} deactivated`);
        fetchProducts();
      } else {
        setFeedback(data.error || "Failed to deactivate");
      }
    } catch {
      setFeedback("Request failed");
    } finally {
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const query = (searchFilter || localSearch).toLowerCase();
  const filtered = products.filter((p) => {
    if (!query) return true;
    return (
      p.code?.toLowerCase().includes(query) ||
      p.name?.toLowerCase().includes(query) ||
      p.category?.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query)
    );
  });

  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));

  return (
    <div className="space-y-4">
      {/* Top Banner & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-lg border border-stone-200 shadow-sm no-print">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">Product Master & Packaging Profiles</h3>
          <p className="text-xs text-stone-500">
            Manage SKU specifications, manufacturing lead times, and domestic vs export packaging configurations. No BOM required.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-md transition"
          >
            <Printer className="w-3.5 h-3.5 text-stone-500" />
            <span>Print</span>
          </button>
          <a
            href="/api/reports/export?type=products"
            download
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-md transition"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span>Export Excel</span>
          </a>
          <button
            onClick={openAddModal}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#a27b5c] hover:bg-[#8a6549] rounded-md transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-lg text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-stone-200 shadow-sm text-xs no-print">
        <div className="flex items-center space-x-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search SKU code, name, category..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
            />
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-md text-xs text-stone-700 focus:outline-none"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <label className="flex items-center space-x-1.5 text-xs text-stone-600 cursor-pointer">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="rounded text-[#a27b5c] focus:ring-[#a27b5c]"
            />
            <span>Active SKUs Only</span>
          </label>

          <button
            onClick={fetchProducts}
            className="p-1.5 text-stone-500 hover:text-stone-900 border border-stone-200 rounded hover:bg-stone-50 transition"
            title="Refresh Catalog"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
              <tr>
                <th className="py-2.5 px-4">SKU Code</th>
                <th className="py-2.5 px-4">Product Name</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">UOM</th>
                <th className="py-2.5 px-4">Lead Time</th>
                <th className="py-2.5 px-4">Domestic Packaging</th>
                <th className="py-2.5 px-4">Export Packaging</th>
                <th className="py-2.5 px-4">FG Stock (P / U)</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-stone-400">Loading product catalog...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-stone-400">No products found matching filters.</td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const packedStock = p.finishedStock?.find((s: any) => s.bucket === "PACKED")?.quantityOnHand || 0;
                  const unpackedStock = p.finishedStock?.find((s: any) => s.bucket === "UNPACKED")?.quantityOnHand || 0;

                  return (
                    <tr key={p.id} className="hover:bg-stone-50/70 transition align-top">
                      <td className="py-2.5 px-4 font-mono font-bold text-stone-900">{p.code}</td>
                      <td className="py-2.5 px-4">
                        <span className="font-semibold text-stone-800 block">{p.name}</span>
                        {p.description && <span className="text-[10px] text-stone-500 block truncate max-w-xs">{p.description}</span>}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-700 border border-stone-200">
                          {p.category || "General"}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-medium text-stone-700">{p.unitOfManufacture || "PCS"}</td>
                      <td className="py-2.5 px-4 text-stone-700">{p.defaultLeadTimeDays || 7} days</td>
                      <td className="py-2.5 px-4 text-stone-700 text-[11px] max-w-xs truncate">
                        {p.domesticPackingType || "Standard Box"}
                      </td>
                      <td className="py-2.5 px-4 text-purple-800 text-[11px] font-medium max-w-xs truncate">
                        {p.exportPackingType || "Export Wooden Crate"}
                      </td>
                      <td className="py-2.5 px-4 font-mono">
                        <span className="text-emerald-700 font-bold" title="Packed on hand">{packedStock}</span>
                        <span className="text-stone-400 mx-1">/</span>
                        <span className="text-blue-700 font-bold" title="Unpacked on hand">{unpackedStock}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            p.isActive
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-stone-100 text-stone-500 border-stone-200"
                          }`}
                        >
                          {p.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right no-print">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1 rounded text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition"
                            title="Edit Product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {p.isActive && (
                            <button
                              onClick={() => handleDeactivate(p.id, p.code)}
                              className="px-2 py-0.5 text-[10px] text-red-600 hover:bg-red-50 border border-red-200 rounded transition"
                              title="Deactivate Product"
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <h3 className="text-sm font-bold text-stone-900">
                {editingProduct ? `Edit Product: ${editingProduct.code}` : "Add New Product SKU"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">
                    SKU Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingProduct}
                    placeholder="e.g. KLT2025-005"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-1.5 border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-[#a27b5c] font-mono disabled:bg-stone-100"
                  />
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">
                    Product Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alabaster Fluted Coffee Table"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-1.5 border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Unit of Manufacture</label>
                  <select
                    value={unitOfManufacture}
                    onChange={(e) => setUnitOfManufacture(e.target.value)}
                    className="w-full px-3 py-1.5 border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
                  >
                    <option value="PCS">PCS (Pieces)</option>
                    <option value="SET">SET (Set of Pieces)</option>
                    <option value="PAIR">PAIR (Pairs)</option>
                    <option value="BOX">BOX (Boxed Unit)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Lead Time (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={defaultLeadTimeDays}
                    onChange={(e) => setDefaultLeadTimeDays(e.target.value)}
                    className="w-full px-3 py-1.5 border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Product Description</label>
                <textarea
                  rows={2}
                  placeholder="Detailed material finish, dimensions, weight..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-1.5 border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
                />
              </div>

              {/* Packaging Profiles */}
              <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 space-y-3">
                <div className="font-bold text-stone-800 flex items-center space-x-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#a27b5c]" />
                  <span>Packaging Configurations</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold text-stone-700 block mb-1">Domestic Packaging Profile</label>
                    <input
                      type="text"
                      value={domesticPackingType}
                      onChange={(e) => setDomesticPackingType(e.target.value)}
                      placeholder="e.g. Standard 5-ply Corrugated Box"
                      className="w-full px-3 py-1.5 border border-stone-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-stone-700 block mb-1">Export Packaging Profile</label>
                    <input
                      type="text"
                      value={exportPackingType}
                      onChange={(e) => setExportPackingType(e.target.value)}
                      placeholder="e.g. ISPM-15 Certified Fumigated Wooden Crate"
                      className="w-full px-3 py-1.5 border border-stone-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
                    />
                  </div>
                </div>
              </div>

              {/* Production Notes & Quality */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Production Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Factory routing, CNC fluting requirements..."
                    value={productionNotes}
                    onChange={(e) => setProductionNotes(e.target.value)}
                    className="w-full px-3 py-1.5 border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Quality Requirements</label>
                  <textarea
                    rows={2}
                    placeholder="Surface polish inspection, edge tolerance..."
                    value={qualityRequirements}
                    onChange={(e) => setQualityRequirements(e.target.value)}
                    className="w-full px-3 py-1.5 border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-4 pt-2">
                <label className="flex items-center space-x-1.5 cursor-pointer font-medium text-stone-700">
                  <input
                    type="checkbox"
                    checked={requiresSpecialHandling}
                    onChange={(e) => setRequiresSpecialHandling(e.target.checked)}
                    className="rounded text-[#a27b5c] focus:ring-[#a27b5c]"
                  />
                  <span>Requires Special Fragile Handling</span>
                </label>

                <label className="flex items-center space-x-1.5 cursor-pointer font-medium text-stone-700">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded text-[#a27b5c] focus:ring-[#a27b5c]"
                  />
                  <span>Active Catalog Status</span>
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-stone-300 rounded text-stone-700 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#a27b5c] hover:bg-[#8a6549] text-white font-semibold rounded shadow-sm disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingProduct ? "Update Product" : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
