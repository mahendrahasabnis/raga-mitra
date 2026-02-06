import React, { useState, useEffect, useRef } from "react";
import { Salad, Plus, Edit, FileText, Search, Download, Upload, Users } from "lucide-react";
import { dietApi } from "../../services/api";
import MealTemplateForm from "./MealTemplateForm";
import SelectDropdown from "../UI/SelectDropdown";

interface MealLibraryProps {
  selectedClient?: string | null;
  onSelect?: (template: any) => void;
  onSelectMultiple?: (templates: any[]) => void;
}

type LibraryType = "all" | "own" | "dietitian";

const MealLibrary: React.FC<MealLibraryProps> = ({
  selectedClient,
  onSelect,
  onSelectMultiple,
}) => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [dietitians, setDietitians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [libraryType, setLibraryType] = useState<LibraryType>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectionEnabled = !!onSelectMultiple;

  useEffect(() => {
    fetchTemplates();
  }, [categoryFilter, libraryType, selectedClient]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [templates]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const libraryTypeParam = libraryType === "all" ? undefined : libraryType;
      const res = await dietApi.getMealTemplates(
        categoryFilter || undefined,
        libraryTypeParam,
        selectedClient || undefined
      );
      setTemplates(res.templates || []);
      setDietitians(res.dietitians || []);
    } catch (error) {
      console.error("Failed to fetch meal templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template: any) => {
    setEditingTemplate(template);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingTemplate(null);
  };

  const handleFormSuccess = () => {
    handleFormClose();
    fetchTemplates();
  };

  const toggleSelect = (templateId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  };

  const handleAddSelected = () => {
    if (!onSelectMultiple) return;
    const selectedTemplates = templates.filter((t) => selectedIds.has(t.id));
    if (selectedTemplates.length === 0) return;
    onSelectMultiple(selectedTemplates);
    setSelectedIds(new Set());
  };

  const handleExport = async () => {
    try {
      const blob = await dietApi.exportMealTemplates();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meal-library-${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Failed to export meals:", error);
      alert("Failed to export meals. Please try again.");
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await dietApi.importMealTemplates(file);
      alert(
        result.message ||
          `Successfully imported ${result.imported} meal(s).${result.errors > 0 ? ` ${result.errors} error(s).` : ""}`
      );
      if (result.errors_list && result.errors_list.length > 0) {
        console.warn("Import errors:", result.errors_list);
      }
      fetchTemplates();
    } catch (error: any) {
      console.error("Failed to import meals:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to import meals. Please check the file format.";
      alert(errorMessage);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const categories = Array.from(new Set(templates.map((t) => t.category).filter(Boolean)));

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      !searchTerm ||
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.dietitian_name && t.dietitian_name.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="card p-4">
        <p className="text-sm text-gray-400">Loading meal library...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 overflow-x-hidden">
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            {!selectedClient && (
              <button
                onClick={() => setShowForm(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Meal Template
              </button>
            )}
            {!selectedClient && (
              <>
                <button
                  onClick={handleExport}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Import
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={handleImport}
                  className="hidden"
                />
              </>
            )}
            {selectionEnabled && (
              <>
                <button
                  onClick={handleAddSelected}
                  className="btn-primary flex items-center gap-2"
                  disabled={selectedIds.size === 0}
                  title={selectedIds.size === 0 ? "Select meals to add" : "Add selected meals"}
                >
                  <Plus className="h-4 w-4" />
                  Add Selected {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
                </button>
                {selectedIds.size > 0 && (
                  <button onClick={() => setSelectedIds(new Set())} className="btn-secondary">
                    Clear
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {!selectedClient && (
          <div className="card p-2">
            <div className="flex gap-2">
              <button
                onClick={() => setLibraryType("all")}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  libraryType === "all"
                    ? "bg-emerald-500 text-white"
                    : "bg-white/5 text-gray-300 hover:bg-white/10"
                }`}
              >
                All Libraries
              </button>
              <button
                onClick={() => setLibraryType("own")}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  libraryType === "own"
                    ? "bg-emerald-500 text-white"
                    : "bg-white/5 text-gray-300 hover:bg-white/10"
                }`}
              >
                My Library
              </button>
              <button
                onClick={() => setLibraryType("dietitian")}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  libraryType === "dietitian"
                    ? "bg-emerald-500 text-white"
                    : "bg-white/5 text-gray-300 hover:bg-white/10"
                }`}
                disabled={dietitians.length === 0}
              >
                Dietitian Libraries {dietitians.length > 0 && `(${dietitians.length})`}
              </button>
            </div>
          </div>
        )}

        <div className="card p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search meals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field w-full pl-10"
              />
            </div>
            <div className="md:w-48">
              <SelectDropdown
                value={categoryFilter}
                options={[
                  { value: "", label: "All Categories" },
                  ...categories.map((category) => ({ value: category, label: category })),
                ]}
                onChange={(value) => setCategoryFilter(value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className={`card p-4 ${selectionEnabled ? "cursor-pointer" : ""}`}
              onClick={() => selectionEnabled && toggleSelect(template.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {selectionEnabled && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(template.id)}
                      onChange={() => toggleSelect(template.id)}
                      className="mt-1"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Salad className="h-4 w-4 text-emerald-300" />
                      <h3 className="font-semibold">{template.name}</h3>
                      {template.library_source === "dietitian" && (
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300 flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {template.dietitian_name || "Dietitian"}
                        </span>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-gray-400 mt-1">{template.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-400">
                      {template.category && <span>{template.category}</span>}
                      {template.meal_type && <span>{template.meal_type}</span>}
                      {template.serving_size && <span>{template.serving_size}</span>}
                    </div>
                  </div>
                </div>
                {!selectedClient && (
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(template);
                      }}
                      className="btn-secondary p-2"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    {onSelect && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(template);
                        }}
                        className="btn-primary px-3 text-sm"
                      >
                        Select
                      </button>
                    )}
                  </div>
                )}
              </div>
              {(template.calories || template.protein || template.carbs || template.fats) && (
                <div className="flex gap-4 mt-3 text-xs text-gray-400">
                  {template.calories && <span>{template.calories} cal</span>}
                  {template.protein && <span>{template.protein}g protein</span>}
                  {template.carbs && <span>{template.carbs}g carbs</span>}
                  {template.fats && <span>{template.fats}g fats</span>}
                </div>
              )}
              {(template.ingredients || template.instructions || template.document_url) && (
                <div className="flex gap-3 mt-3 text-xs text-gray-400">
                  {template.ingredients && <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> Ingredients</span>}
                  {template.instructions && <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> Instructions</span>}
                </div>
              )}
            </div>
          ))}
          {filteredTemplates.length === 0 && (
            <div className="card p-6 text-center text-gray-400">No meal templates found.</div>
          )}
        </div>
      </div>

      {showForm && (
        <MealTemplateForm
          isOpen={showForm}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
          template={editingTemplate}
        />
      )}
    </>
  );
};

export default MealLibrary;
