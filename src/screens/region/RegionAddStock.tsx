import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminDashboardStats } from "../../hooks/useAdminDashboardStats";
import { getAllocationById, updateAllocation } from "../../api";
import { AuditModule, getAuditLogger } from "../../components/Audit/auditLogger";
import { getCurrentUserForAudit } from "../../components/Audit/getCurrentUserForAudit";
import RegionSidebar from "../../components/layout/RegionSidebar";
import { Package, ChevronLeft, Plus, X } from "lucide-react";
import "../../assets/css/admin css/index.css";
import "../../assets/css/jo css/JoCreateAllocationStyle.css";

const RegionAddStock: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const dashData = useAdminDashboardStats();
  
  const [stockProgram, setStockProgram] = useState<number | "">("");
  const [rows, setRows] = useState<{ id: string; stockItem: string; stockQuantity: number | "" }[]>([
    { id: Date.now().toString(), stockItem: "", stockQuantity: "" }
  ]);
  const [isAddingStock, setIsAddingStock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleAddStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = rows.filter(r => r.stockItem && r.stockQuantity);
    if (validRows.length === 0 || !stockProgram) {
      setError("Please add at least one product with a valid quantity.");
      return;
    }
    
    setIsAddingStock(true);
    setError(null);
    setSuccess(null);
    
    try {
      const currentRes = await getAllocationById(stockProgram.toString());
      if (currentRes.error) throw new Error(currentRes.error);
      
      const payload: Record<string, number> = {};
      const productNames: string[] = [];

      validRows.forEach(row => {
        const currentAmount = Number(currentRes.data[row.stockItem]) || 0;
        const newAmount = currentAmount + Number(row.stockQuantity);
        payload[row.stockItem] = newAmount;
        
        const itemName = dashData.subsidyBreakdown.find(s => s.id === row.stockItem)?.name || row.stockItem;
        productNames.push(`${row.stockQuantity} ${itemName}`);
      });
      
      const updateRes = await updateAllocation(stockProgram.toString(), payload);
      if (updateRes.error) throw new Error(updateRes.error);

      try {
        const auditUser = await getCurrentUserForAudit();
        const auditLogger = getAuditLogger();
        await auditLogger.logCRUD(
          auditUser,
          "UPDATE",
          AuditModule.ALLOCATIONS,
          "regional_allocations",
          stockProgram.toString(),
          `Added stock to inventory: ${productNames.join(", ")}`,
          undefined,
          payload
        );
      } catch (err) {}

      setSuccess(`Successfully added inventory!`);
      setRows([{ id: Date.now().toString(), stockItem: "", stockQuantity: "" }]);
      setStockProgram("");
    } catch (err: any) {
      setError(err.message || "Failed to add stock.");
    } finally {
      setIsAddingStock(false);
    }
  };

  const addRow = () => {
    setRows([...rows, { id: Date.now().toString(), stockItem: "", stockQuantity: "" }]);
  };

  const removeRow = (id: string) => {
    setRows(rows.filter(r => r.id !== id));
  };

  const updateRow = (id: string, field: 'stockItem' | 'stockQuantity', value: any) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  return (
    <div className="jo-allocation-page-container">
      <div className="jo-allocation-page has-mobile-sidebar">
        <RegionSidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        <div className="jo-allocation-main-content">
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              <Package size={24} />
            </button>
            <div className="tech-incent-mobile-title">Add Stock to Inventory</div>
          </div>

          <div className="jo-allocation-header">
            <button className="jo-allocation-btn-cancel" onClick={() => navigate("/region-inventory")} style={{ border: 'none', background: 'transparent', padding: 0, marginBottom: 15, display: 'flex', alignItems: 'center', gap: 5 }}>
              <ChevronLeft size={18} /> Back to Inventory
            </button>
            <h2 className="jo-allocation-title">Add Stock</h2>
            <p className="jo-allocation-subtitle">
              Add quantities to existing products in the inventory
            </p>
          </div>

          <div className="jo-allocation-content-card" style={{ maxWidth: '100%', minHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <form onSubmit={handleAddStockSubmit}>
              <div className="jo-allocation-section">
                <div className="jo-allocation-field">
                  <label className="jo-allocation-label">
                    Select Program <span className="jo-allocation-required">*</span>
                  </label>
                  <select
                    value={stockProgram}
                    onChange={(e) => setStockProgram(Number(e.target.value))}
                    className="jo-allocation-input"
                    required
                  >
                    <option value="" disabled>-- Choose Program --</option>
                    {dashData.seasonComparison.map(p => (
                      <option key={p.allocationId} value={p.allocationId}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div className="jo-allocation-field" style={{ marginTop: 20 }}>
                  <label className="jo-allocation-label">
                    Items to Add <span className="jo-allocation-required">*</span>
                  </label>
                  
                  {rows.map((row) => (
                    <div key={row.id} style={{ display: 'flex', gap: '15px', marginBottom: '15px', alignItems: 'center' }}>
                      <select
                        value={row.stockItem}
                        onChange={(e) => updateRow(row.id, 'stockItem', e.target.value)}
                        className="jo-allocation-input"
                        style={{ flex: 2, marginBottom: 0 }}
                        required
                      >
                        <option value="" disabled>-- Choose Product --</option>
                        {dashData.subsidyBreakdown.map(item => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>

                      <input
                        type="number"
                        value={row.stockQuantity}
                        onChange={(e) => updateRow(row.id, 'stockQuantity', e.target.value ? Number(e.target.value) : "")}
                        className="jo-allocation-input"
                        placeholder="Quantity"
                        style={{ flex: 1, marginBottom: 0 }}
                        min="1"
                        required
                      />

                      {rows.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => removeRow(row.id)}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Remove item"
                        >
                          <X size={20} />
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addRow}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: 'transparent',
                      border: '1px dashed #10b981',
                      color: '#10b981',
                      padding: '10px 15px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      marginTop: '10px',
                      fontSize: '14px',
                      fontWeight: 500,
                      width: 'max-content'
                    }}
                  >
                    <Plus size={16} /> Add Another Product
                  </button>
                </div>
              </div>

              {error && <div className="jo-allocation-error">{error}</div>}
              {success && <div className="jo-allocation-error" style={{ background: '#dcfce3', color: '#166534', border: '1px solid #bbf7d0' }}>{success}</div>}

              <div className="jo-allocation-actions" style={{ marginTop: 'auto', paddingTop: 30 }}>
                <button
                  type="button"
                  onClick={() => navigate("/region-inventory")}
                  className="jo-allocation-btn-cancel"
                  disabled={isAddingStock}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="jo-allocation-btn-submit"
                  disabled={isAddingStock || !stockProgram || rows.filter(r => r.stockItem && r.stockQuantity).length === 0}
                >
                  {isAddingStock ? "Adding Stock..." : "Add Stock"}
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
