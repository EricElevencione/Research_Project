import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getShortagesSeeds,
  getShortagesFertilizers,
  addShortageSeed,
  addShortageFertilizer,
  updateShortageSeed,
  updateShortageFertilizer,
  deleteShortageSeed,
  deleteShortageFertilizer,
} from "../../api";
import RegionSidebar from "../../components/layout/RegionSidebar";
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  Save,
  X,
  ChevronLeft,
  Sprout,
  Leaf,
} from "lucide-react";
import "../../assets/css/admin css/InventoryPageStyle.css"; // Reuse some styles
import "./ManageVarieties.css";

const RegionManageVarieties: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<"seeds" | "ferts">("seeds");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [seeds, setSeeds] = useState<any[]>([]);
  const [ferts, setFerts] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    id: "",
    name: "",
    category: "",
    description: "",
    sort_order: 1000,
    is_active: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [seedsRes, fertsRes] = await Promise.all([
        getShortagesSeeds(),
        getShortagesFertilizers(),
      ]);
      setSeeds(seedsRes.data || []);
      setFerts(fertsRes.data || []);
    } catch (err) {
      console.error("Failed to fetch varieties:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      id: "",
      name: "",
      category: "",
      description: "",
      sort_order: 1000,
      is_active: true,
    });
    setEditingId(null);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (activeType === "seeds") {
        await addShortageSeed(formData);
      } else {
        await addShortageFertilizer(formData);
      }
      setShowAddModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      alert("Failed to add variety");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      if (activeType === "seeds") {
        await updateShortageSeed(editingId, formData);
      } else {
        await updateShortageFertilizer(editingId, formData);
      }
      setEditingId(null);
      resetForm();
      fetchData();
    } catch (err) {
      alert("Failed to update variety");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this variety?"))
      return;
    try {
      if (activeType === "seeds") {
        await deleteShortageSeed(id);
      } else {
        await deleteShortageFertilizer(id);
      }
      fetchData();
    } catch (err) {
      alert("Failed to delete variety");
    }
  };

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({
      id: item.id,
      name: item.name,
      category: item.category || "",
      description: item.description || "",
      sort_order: item.sort_order || 1000,
      is_active: item.is_active ?? true,
    });
    setShowAddModal(true);
  };

  const filteredItems = (activeType === "seeds" ? seeds : ferts).filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="admin-viewalloc-page-container">
      <div className="admin-viewalloc-page has-mobile-sidebar">
        <RegionSidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        <div className="admin-viewalloc-main-content manage-varieties-content">
          <div className="manage-header-nav">
            <button className="btn-back" onClick={() => navigate("/region-inventory")}>
              <ChevronLeft size={20} />
              Back to Inventory
            </button>
          </div>

          <div className="inventory-header">
            <div className="inventory-header-left">
              <h2 className="admin-viewalloc-title">Manage Varieties</h2>
              <p className="admin-viewalloc-subtitle">
                Register and organize fertilizers and seeds catalog
              </p>
            </div>
            <div className="inventory-header-right">
              <div className="inventory-search-box">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Search variety catalog..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button
                className="inventory-btn-register"
                onClick={() => {
                  resetForm();
                  setShowAddModal(true);
                }}
              >
                <Plus size={18} />
                Add New Variety
              </button>
            </div>
          </div>

          <div className="manage-tabs">
            <button
              className={`manage-tab ${activeType === "seeds" ? "active" : ""}`}
              onClick={() => setActiveType("seeds")}
            >
              <Sprout size={18} />
              Seeds Catalog
            </button>
            <button
              className={`manage-tab ${activeType === "ferts" ? "active" : ""}`}
              onClick={() => setActiveType("ferts")}
            >
              <Leaf size={18} />
              Fertilizers Catalog
            </button>
          </div>

          <div className="manage-content-card">
            {loading ? (
              <div className="loading-spinner-container">
                <div className="spinner"></div>
                <p>Fetching catalog data...</p>
              </div>
            ) : (
              <div className="varieties-table-wrapper">
                <table className="varieties-table">
                  <thead>
                    <tr>
                      <th>ID / Code</th>
                      <th>Variety Name</th>
                      <th>Category</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="empty-state">
                          No varieties found in the catalog.
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item) => (
                        <tr
                          key={item.id}
                          className={!item.is_active ? "inactive-row" : ""}
                        >
                          <td className="id-cell">
                            <code>{item.id}</code>
                          </td>
                          <td className="name-cell">{item.name}</td>
                          <td>
                            <span
                              className={`cat-badge ${item.category?.toLowerCase()}`}
                            >
                              {item.category || "N/A"}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`status-dot ${item.is_active ? "active" : "inactive"}`}
                            ></span>
                            {item.is_active ? "Active" : "Hidden"}
                          </td>
                          <td className="actions-cell">
                            <button
                              className="btn-icon-edit"
                              title="Edit"
                              onClick={() => startEdit(item)}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              className="btn-icon-delete"
                              title="Delete"
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>
                {editingId
                  ? "Edit Variety"
                  : `Add New ${activeType === "seeds" ? "Seed" : "Fertilizer"}`}
              </h3>
              <button
                className="btn-close"
                onClick={() => setShowAddModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={editingId ? handleUpdate : handleAdd}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Unique ID / Code</label>
                  <input
                    type="text"
                    name="id"
                    value={formData.id}
                    onChange={handleInputChange}
                    disabled={!!editingId}
                    placeholder="e.g. urea_46_0_0"
                    required
                  />
                  {!editingId && (
                    <small>
                      This should match the column name in allocations if
                      tracking stock.
                    </small>
                  )}
                </div>
                <div className="form-group">
                  <label>Display Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. Urea (46-0-0)"
                    required
                  />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Category</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="">Select Category...</option>
                      {activeType === "seeds" ? (
                        <>
                          <option value="Hybrid">Hybrid</option>
                          <option value="Inbred">Inbred</option>
                        </>
                      ) : (
                        <>
                          <option value="Solid">Solid</option>
                          <option value="Liquid">Liquid</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Sort Order</label>
                    <input
                      type="number"
                      name="sort_order"
                      value={formData.sort_order}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Description (Optional)</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                  />
                </div>
                <div className="form-checkbox">
                  <label>
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          is_active: e.target.checked,
                        }))
                      }
                    />
                    Visible in catalog
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-save">
                  <Save size={18} />
                  {editingId ? "Update Variety" : "Save Variety"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegionManageVarieties;
