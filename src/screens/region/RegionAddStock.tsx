import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase";
import { updateInventoryStock } from "../../api";
import { AuditModule, getAuditLogger } from "../../components/Audit/auditLogger";
import { getCurrentUserForAudit } from "../../components/Audit/getCurrentUserForAudit";
import RegionSidebar from "../../components/layout/RegionSidebar";
import {
  Package,
  ChevronLeft,
  Plus,
  X,
  CheckCircle2,
  Search,
  SlidersHorizontal,
  Sprout,
  Leaf,
  ChevronDown,
} from "lucide-react";
import "../../assets/css/admin css/index.css";
import "../../assets/css/jo css/JoCreateAllocationStyle.css";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductItem {
  id: string;
  name: string;
  unit: string;
  category: "Seed" | "Fertilizer";
  subCategory?: string;
}

type FilterType = "all" | "seeds" | "fertilizers";

// ─── Per-row Product Picker ───────────────────────────────────────────────────

interface ProductPickerProps {
  allProducts: ProductItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

const ProductPicker: React.FC<ProductPickerProps> = ({
  allProducts,
  selectedId,
  onSelect,
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = allProducts.find((p) => p.id === selectedId);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus search input when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const filtered = allProducts.filter((p) => {
    if (filter === "seeds" && p.category !== "Seed") return false;
    if (filter === "fertilizers" && p.category !== "Fertilizer") return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.subCategory || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const seeds = filtered.filter((p) => p.category === "Seed");
  const ferts = filtered.filter((p) => p.category === "Fertilizer");

  const handleSelect = (id: string) => {
    onSelect(id);
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} style={{ position: "relative", flex: 2 }}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "#fff",
          border: "1px solid #d1d5db",
          borderRadius: 8,
          padding: "9px 12px",
          cursor: disabled ? "not-allowed" : "pointer",
          fontSize: 14,
          color: selected ? "#111827" : "#9ca3af",
          textAlign: "left",
          transition: "border-color 0.15s",
          outline: "none",
        }}
        onFocus={(e) =>
          (e.currentTarget.style.borderColor = "#16a34a")
        }
        onBlur={(e) =>
          (e.currentTarget.style.borderColor = "#d1d5db")
        }
      >
        {selected ? (
          <>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 22,
                height: 22,
                borderRadius: 4,
                background: selected.category === "Seed" ? "#dcfce7" : "#d1fae5",
                flexShrink: 0,
              }}
            >
              {selected.category === "Seed" ? (
                <Sprout size={13} color="#16a34a" />
              ) : (
                <Leaf size={13} color="#059669" />
              )}
            </span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selected.name}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#64748b",
                background: "#f1f5f9",
                borderRadius: 4,
                padding: "2px 6px",
                flexShrink: 0,
              }}
            >
              {selected.unit}
            </span>
          </>
        ) : (
          <>
            <SlidersHorizontal size={14} style={{ color: "#9ca3af", flexShrink: 0 }} />
            <span style={{ flex: 1 }}>Choose product...</span>
          </>
        )}
        <ChevronDown
          size={14}
          style={{
            color: "#9ca3af",
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
            zIndex: 999,
            overflow: "hidden",
            minWidth: 300,
          }}
        >
          {/* Search row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 12px",
              borderBottom: "1px solid #f1f5f9",
              background: "#f8fafc",
            }}
          >
            <Search size={14} style={{ color: "#9ca3af", flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product..."
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: 13,
                color: "#111827",
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#9ca3af",
                  display: "flex",
                  padding: 0,
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div
            style={{
              display: "flex",
              gap: 0,
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            {(
              [
                { key: "all", label: "All" },
                { key: "seeds", label: "🌾 Seeds" },
                { key: "fertilizers", label: "🌿 Fertilizers" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                style={{
                  flex: 1,
                  padding: "7px 4px",
                  border: "none",
                  borderBottom:
                    filter === tab.key
                      ? "2px solid #16a34a"
                      : "2px solid transparent",
                  background: "transparent",
                  color: filter === tab.key ? "#16a34a" : "#64748b",
                  fontWeight: filter === tab.key ? 700 : 500,
                  fontSize: 12,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Results */}
          <div
            style={{
              maxHeight: 260,
              overflowY: "auto",
            }}
          >
            {filtered.length === 0 ? (
              <div
                style={{
                  padding: "20px 16px",
                  textAlign: "center",
                  color: "#94a3b8",
                  fontSize: 13,
                }}
              >
                No products found
              </div>
            ) : (
              <>
                {/* Seeds section */}
                {seeds.length > 0 && (filter === "all" || filter === "seeds") && (
                  <>
                    <div
                      style={{
                        padding: "6px 12px 4px",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#16a34a",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        background: "#f0fdf4",
                        borderTop: seeds === filtered ? undefined : "1px solid #f1f5f9",
                      }}
                    >
                      🌾 Seeds ({seeds.length})
                    </div>
                    {seeds.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelect(p.id)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "9px 14px",
                          border: "none",
                          background:
                            p.id === selectedId ? "#f0fdf4" : "transparent",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={(e) => {
                          if (p.id !== selectedId)
                            (e.currentTarget as HTMLElement).style.background = "#f8fafc";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background =
                            p.id === selectedId ? "#f0fdf4" : "transparent";
                        }}
                      >
                        <span
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 4,
                            background: "#dcfce7",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Sprout size={12} color="#16a34a" />
                        </span>
                        <span style={{ flex: 1, fontSize: 13, color: "#111827", fontWeight: p.id === selectedId ? 600 : 400 }}>
                          {p.name}
                        </span>
                        {p.subCategory && (
                          <span style={{ fontSize: 10, color: "#94a3b8", background: "#f1f5f9", borderRadius: 3, padding: "1px 5px" }}>
                            {p.subCategory}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600, flexShrink: 0 }}>
                          {p.unit}
                        </span>
                      </button>
                    ))}
                  </>
                )}

                {/* Fertilizers section */}
                {ferts.length > 0 && (filter === "all" || filter === "fertilizers") && (
                  <>
                    <div
                      style={{
                        padding: "6px 12px 4px",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#059669",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        background: "#ecfdf5",
                        borderTop: "1px solid #f1f5f9",
                      }}
                    >
                      🌿 Fertilizers ({ferts.length})
                    </div>
                    {ferts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelect(p.id)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "9px 14px",
                          border: "none",
                          background:
                            p.id === selectedId ? "#f0fdf4" : "transparent",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={(e) => {
                          if (p.id !== selectedId)
                            (e.currentTarget as HTMLElement).style.background = "#f8fafc";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background =
                            p.id === selectedId ? "#f0fdf4" : "transparent";
                        }}
                      >
                        <span
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 4,
                            background: "#d1fae5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Leaf size={12} color="#059669" />
                        </span>
                        <span style={{ flex: 1, fontSize: 13, color: "#111827", fontWeight: p.id === selectedId ? 600 : 400 }}>
                          {p.name}
                        </span>
                        {p.subCategory && (
                          <span style={{ fontSize: 10, color: "#94a3b8", background: "#f1f5f9", borderRadius: 3, padding: "1px 5px" }}>
                            {p.subCategory}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600, flexShrink: 0 }}>
                          {p.unit}
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const RegionAddStock: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [allProducts, setAllProducts] = useState<ProductItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [rows, setRows] = useState<
    { id: string; productId: string; quantity: number | "" }[]
  >([{ id: Date.now().toString(), productId: "", quantity: "" }]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load products directly from inventory table, join names/units from variety tables
  useEffect(() => {
    const fetch = async () => {
      setLoadingProducts(true);
      try {
        const [invRes, seedsRes, fertsRes] = await Promise.all([
          supabase.from("inventory").select("product_id, product_type, category").order("product_type").order("product_id"),
          supabase.from("shortages_seeds").select("id, name, unit, category").eq("is_active", true),
          supabase.from("shortages_fertilizers").select("id, name, unit, category").eq("is_active", true),
        ]);

        const inventoryRows: any[] = invRes.data || [];
        const seedsMap = new Map((seedsRes.data || []).map((s: any) => [s.id, s]));
        const fertsMap = new Map((fertsRes.data || []).map((f: any) => [f.id, f]));

        const products: ProductItem[] = inventoryRows.map((row: any) => {
          if (row.product_type === "seed") {
            const variety = seedsMap.get(row.product_id);
            return {
              id: row.product_id,
              name: variety?.name || row.product_id,
              unit: variety?.unit || "kg",
              category: "Seed" as const,
              subCategory: variety?.category || row.category || "",
            };
          } else {
            const variety = fertsMap.get(row.product_id);
            return {
              id: row.product_id,
              name: variety?.name || row.product_id,
              unit: variety?.unit || "bags",
              category: "Fertilizer" as const,
              subCategory: variety?.category || row.category || "",
            };
          }
        });

        setAllProducts(products);
      } catch (err) {
        console.error("Failed to load products:", err);
      } finally {
        setLoadingProducts(false);
      }
    };
    fetch();
  }, []);

  // Row helpers
  const addRow = () =>
    setRows((p) => [...p, { id: Date.now().toString(), productId: "", quantity: "" }]);

  const removeRow = (id: string) =>
    setRows((p) => p.filter((r) => r.id !== id));

  const setProductId = useCallback((rowId: string, productId: string) =>
    setRows((p) => p.map((r) => (r.id === rowId ? { ...r, productId } : r))), []);

  const setQuantity = (rowId: string, quantity: number | "") =>
    setRows((p) => p.map((r) => (r.id === rowId ? { ...r, quantity } : r)));

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = rows.filter((r) => r.productId && r.quantity);
    if (validRows.length === 0) {
      setError("Please add at least one item with a valid quantity.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const payloadItems = validRows.map(row => ({
        productId: row.productId,
        quantity: Number(row.quantity),
      }));

      const updateRes = await updateInventoryStock(payloadItems);
      if (updateRes.error) throw new Error(updateRes.error);

      try {
        const auditUser = await getCurrentUserForAudit();
        const auditLogger = getAuditLogger();
        const names = validRows.map(r => {
           const p = allProducts.find(prod => prod.id === r.productId);
           return `${r.quantity} ${p?.unit || ""} ${p?.name || r.productId}`;
        });
        await auditLogger.logCRUD(
          auditUser,
          "UPDATE",
          AuditModule.ALLOCATIONS,
          "inventory",
          "multiple",
          `Added stock to master inventory: ${names.join(", ")}`,
          undefined,
          payloadItems
        );
      } catch (_) { }

      setSuccess("Successfully added stock to inventory!");
      setRows([{ id: Date.now().toString(), productId: "", quantity: "" }]);
    } catch (err: any) {
      setError(err.message || "Failed to add stock.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="jo-allocation-page-container">
      <div className="jo-allocation-page has-mobile-sidebar">
        <RegionSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <div className="jo-allocation-main-content">
          {/* Mobile header */}
          <div className="tech-incent-mobile-header">
            <button className="tech-incent-hamburger" onClick={() => setSidebarOpen((p) => !p)}>
              <Package size={24} />
            </button>
            <div className="tech-incent-mobile-title">Add Stock</div>
          </div>

          {/* Page header */}
          <div className="jo-allocation-header">
            <button
              onClick={() => navigate("/region-inventory")}
              style={{
                border: "none", background: "transparent", padding: 0,
                marginBottom: 15, display: "flex", alignItems: "center",
                gap: 5, color: "#64748b", cursor: "pointer", fontSize: 14,
              }}
            >
              <ChevronLeft size={18} /> Back to Inventory
            </button>
            <h2 className="jo-allocation-title">Add Stock to Inventory</h2>
            <p className="jo-allocation-subtitle">
              Add quantities of seeds or fertilizers directly to the active inventory
            </p>
          </div>

          <div
            className="jo-allocation-content-card"
            style={{ maxWidth: "100%", minHeight: "70vh", display: "flex", flexDirection: "column" }}
          >
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", height: "100%" }}>

              <div className="jo-allocation-section" style={{ flex: 1 }}>
                <label className="jo-allocation-label">
                  Items to Add <span className="jo-allocation-required">*</span>
                </label>
                <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20, marginTop: 4 }}>
                  Each row has its own product search. Type to filter by name or category.
                </p>

                {loadingProducts ? (
                  <div style={{ textAlign: "center", padding: "30px 0", color: "#94a3b8", fontSize: 14 }}>
                    Loading products...
                  </div>
                ) : (
                  <>
                    {/* Column headers */}
                    <div style={{
                      display: "flex", gap: 12, alignItems: "center",
                      padding: "0 14px", marginBottom: 6,
                    }}>
                      <span style={{ minWidth: 22 }} />
                      <span style={{ flex: 2, fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Product
                      </span>
                      <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Unit
                      </span>
                      <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Quantity
                      </span>
                      <span style={{ width: 28 }} />
                    </div>

                    {rows.map((row, idx) => {
                      const selected = allProducts.find((p) => p.id === row.productId);
                      return (
                        <div
                          key={row.id}
                          style={{
                            display: "flex",
                            gap: 12,
                            marginBottom: 10,
                            alignItems: "center",
                            background: "#fff",
                            borderRadius: 8,
                            padding: "12px 14px",
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
                          }}
                        >
                          {/* Index */}
                          <span style={{
                            fontSize: 12, color: "#94a3b8", minWidth: 22,
                            fontWeight: 700,
                          }}>
                            #{idx + 1}
                          </span>

                          {/* Searchable product picker */}
                          <div style={{ flex: 2 }}>
                            <ProductPicker
                              allProducts={allProducts}
                              selectedId={row.productId}
                              onSelect={(id) => setProductId(row.id, id)}
                              disabled={loadingProducts}
                            />
                          </div>

                          {/* Unit of Measurement */}
                          <div style={{ flex: 1 }}>
                            {selected ? (
                              <span style={{
                                fontSize: 13, fontWeight: 600, color: "#475569",
                                background: "#f1f5f9", padding: "8px 12px",
                                borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 5,
                                border: "1px solid #e2e8f0"
                              }}>
                                {selected.category === "Seed" ? <Sprout size={14} color="#10b981" /> : <Leaf size={14} color="#059669" />}
                                {selected.unit}
                              </span>
                            ) : (
                              <span style={{ fontSize: 13, color: "#cbd5e1" }}>--</span>
                            )}
                          </div>

                          {/* Quantity */}
                          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
                            <input
                              type="number"
                              value={row.quantity}
                              onChange={(e) =>
                                setQuantity(row.id, e.target.value ? Number(e.target.value) : "")
                              }
                              className="jo-allocation-input"
                              placeholder="Qty"
                              style={{ flex: 1, marginBottom: 0 }}
                              min="1"
                              required
                            />
                          </div>

                          {/* Remove */}
                          {rows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeRow(row.id)}
                              style={{
                                background: "transparent", border: "none",
                                color: "#ef4444", cursor: "pointer",
                                padding: "6px 4px", display: "flex",
                                alignItems: "center", flexShrink: 0, marginTop: 2,
                              }}
                              title="Remove row"
                            >
                              <X size={17} />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={addRow}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        background: "transparent", border: "1px dashed #10b981",
                        color: "#10b981", padding: "10px 15px", borderRadius: 6,
                        cursor: "pointer", marginTop: 10, fontSize: 14,
                        fontWeight: 500, width: "max-content",
                      }}
                    >
                      <Plus size={16} /> Add Another Item
                    </button>
                  </>
                )}
              </div>

              {/* Feedback */}
              {error && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "#fef2f2", border: "1px solid #fecaca",
                  borderRadius: 8, padding: "12px 16px", color: "#b91c1c",
                  fontSize: 14, marginTop: 16,
                }}>
                  <AlertCircle size={16} />{error}
                </div>
              )}
              {success && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "#f0fdf4", border: "1px solid #bbf7d0",
                  borderRadius: 8, padding: "12px 16px", color: "#166534",
                  fontSize: 14, marginTop: 16,
                }}>
                  <CheckCircle2 size={16} />{success}
                </div>
              )}

              {/* Actions */}
              <div className="jo-allocation-actions" style={{ marginTop: "auto", paddingTop: 30 }}>
                <button
                  type="button"
                  onClick={() => navigate("/region-inventory")}
                  className="jo-allocation-btn-cancel"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="jo-allocation-btn-submit"
                  disabled={
                    isSubmitting ||
                    rows.filter((r) => r.productId && r.quantity).length === 0
                  }
                >
                  {isSubmitting ? "Adding Stock..." : "Add to Inventory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegionAddStock;
