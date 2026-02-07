import React, { useState, useEffect, useRef } from "react";
import { Dumbbell, Plus, Edit, Video, Image as ImageIcon, FileText, Search, Download, Upload, Users } from "lucide-react";
import { fitnessApi } from "../../services/api";
import ExerciseTemplateForm from "./ExerciseTemplateForm";
import SelectDropdown from "../UI/SelectDropdown";

interface ExerciseLibraryProps {
  selectedClient?: string | null;
  onSelect?: (template: any) => void;
  onSelectMultiple?: (templates: any[]) => void;
}

type LibraryType = 'all' | 'own' | 'trainer';

const ExerciseLibrary: React.FC<ExerciseLibraryProps> = ({
  selectedClient,
  onSelect,
  onSelectMultiple,
}) => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [libraryType, setLibraryType] = useState<LibraryType>('all');
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
      const libraryTypeParam = libraryType === 'all' ? undefined : libraryType;
      const res = await fitnessApi.getExerciseTemplates(
        categoryFilter || undefined,
        libraryTypeParam,
        selectedClient || undefined
      );
      setTemplates(res.templates || []);
      setTrainers(res.trainers || []);
    } catch (error) {
      console.error("Failed to fetch exercise templates:", error);
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
      const blob = await fitnessApi.exportExerciseTemplates();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exercise-library-${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Failed to export exercises:", error);
      alert("Failed to export exercises. Please try again.");
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await fitnessApi.importExerciseTemplates(file);
      alert(result.message || `Successfully imported ${result.imported} exercise(s).${result.errors > 0 ? ` ${result.errors} error(s).` : ''}`);
      if (result.errors_list && result.errors_list.length > 0) {
        console.warn('Import errors:', result.errors_list);
      }
      fetchTemplates();
    } catch (error: any) {
      console.error("Failed to import exercises:", error);
      const errorMessage = error.response?.data?.message || error.message || "Failed to import exercises. Please check the file format.";
      alert(errorMessage);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const categories = Array.from(new Set(templates.map((t) => t.category).filter(Boolean)));

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      !searchTerm ||
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.trainer_name && t.trainer_name.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="card p-4">
        <p className="text-sm text-gray-400">Loading exercise library...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            {!selectedClient && (
              <button
                onClick={() => setShowForm(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Exercise Template
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
                  title={selectedIds.size === 0 ? "Select exercises to add" : "Add selected exercises"}
                >
                  <Plus className="h-4 w-4" />
                  Add Selected {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
                </button>
                {selectedIds.size > 0 && (
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="btn-secondary"
                  >
                    Clear
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Library Type Tabs */}
        {!selectedClient && (
          <div className="card p-2">
            <div className="flex gap-2">
              <button
                onClick={() => setLibraryType('all')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  libraryType === 'all'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                All Libraries
              </button>
              <button
                onClick={() => setLibraryType('own')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  libraryType === 'own'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                My Library
              </button>
              <button
                onClick={() => setLibraryType('trainer')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  libraryType === 'trainer'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
                disabled={trainers.length === 0}
              >
                Trainer Libraries {trainers.length > 0 && `(${trainers.length})`}
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="card p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search exercises..."
                className="input-field w-full pl-10"
              />
            </div>
            <div className="min-w-[180px]">
              <SelectDropdown
                value={categoryFilter}
                options={[
                  { value: "", label: "All Categories" },
                  ...categories.map((cat) => ({ value: cat, label: cat })),
                ]}
                onChange={(value) => setCategoryFilter(value)}
              />
            </div>
          </div>
        </div>

        {/* Templates Grid */}
        {filteredTemplates.length === 0 ? (
          <div className="card p-8 text-center">
            <Dumbbell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">No exercises found</p>
            {!selectedClient && (
              <button
                onClick={() => setShowForm(true)}
                className="btn-primary mt-4"
              >
                Create your first exercise template
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className={`card p-4 hover:bg-white/5 transition cursor-pointer ${
                  selectionEnabled && selectedIds.has(template.id)
                    ? "ring-2 ring-emerald-400/70"
                    : ""
                }`}
                onClick={() => {
                  if (selectionEnabled) {
                    toggleSelect(template.id);
                    return;
                  }
                  onSelect && onSelect(template);
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{template.name}</h3>
                      {template.library_source === 'trainer' && template.trainer_name && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {template.trainer_name}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {template.category && (
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300">
                          {template.category}
                        </span>
                      )}
                      {template.library_source === 'own' && (
                        <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-300">
                          My Exercise
                        </span>
                      )}
                    </div>
                  </div>
                  {!selectedClient && template.library_source === 'own' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(template);
                      }}
                      className="p-1 rounded hover:bg-white/10"
                      title="Edit Exercise"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  )}
                  {selectionEnabled && (
                    <label
                      className="ml-2 flex items-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(template.id)}
                        onChange={() => toggleSelect(template.id)}
                        className="h-4 w-4 rounded border-gray-500"
                      />
                    </label>
                  )}
                </div>

                {template.description && (
                  <p className="text-sm text-gray-400 mb-3 line-clamp-2">{template.description}</p>
                )}

                {template.muscle_groups && (
                  <p className="text-xs text-gray-500 mb-3">Muscles: {template.muscle_groups}</p>
                )}

                {template.difficulty && (
                  <p className="text-xs text-gray-500 mb-3">Level: {template.difficulty}</p>
                )}

                <div className="flex gap-2 flex-wrap">
                  {template.video_url && (
                    <span className="text-xs text-blue-400 flex items-center gap-1">
                      <Video className="h-3 w-3" />
                      Video
                    </span>
                  )}
                  {template.image_url && (
                    <span className="text-xs text-purple-400 flex items-center gap-1">
                      <ImageIcon className="h-3 w-3" />
                      Image
                    </span>
                  )}
                  {template.document_url && (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Doc
                    </span>
                  )}
                </div>

                {/* Display Sets and Reps/Weights */}
                {(template.sets_default || template.reps_default || template.duration_default_text || template.duration_default != null || 
                  template.set_01_rep || template.set_02_rep || template.set_03_rep) && (
                  <div className="mt-3 pt-3 border-t border-white/10 text-xs text-gray-400 space-y-1">
                    {(template.sets_default || template.reps_default || template.duration_default_text || template.duration_default != null) && (
                      <div className="space-x-2">
                        {template.sets_default && <span>Sets: {template.sets_default}</span>}
                        {template.reps_default && (
                          <span className="ml-2">Reps: {template.reps_default}</span>
                        )}
                        {(template.duration_default_text || template.duration_default != null) && (
                          <span className="ml-2">
                            Duration: {template.duration_default_text ?? `${template.duration_default}s`}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Display Set-specific details */}
                    {(template.set_01_rep || template.set_02_rep || template.set_03_rep) && (
                      <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
                        {template.set_01_rep && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Set 01:</span>
                            <span>Rep: {template.set_01_rep}</span>
                            {template.weight_01 && <span>| Weight: {template.weight_01} kg</span>}
                          </div>
                        )}
                        {template.set_02_rep && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Set 02:</span>
                            <span>Rep: {template.set_02_rep}</span>
                            {template.weight_02 && <span>| Weight: {template.weight_02} kg</span>}
                          </div>
                        )}
                        {template.set_03_rep && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Set 03:</span>
                            <span>Rep: {template.set_03_rep}</span>
                            {template.weight_03 && <span>| Weight: {template.weight_03} kg</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <ExerciseTemplateForm
          isOpen={showForm}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
          template={editingTemplate}
        />
      )}
    </>
  );
};

export default ExerciseLibrary;
