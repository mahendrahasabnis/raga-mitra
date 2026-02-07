import React, { useState } from "react";
import { X, Dumbbell } from "lucide-react";
import { fitnessApi } from "../../services/api";
import SelectDropdown from "../UI/SelectDropdown";

interface ExerciseTemplateFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  template?: any;
}

const ExerciseTemplateForm: React.FC<ExerciseTemplateFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  template,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: template?.name || "",
    description: template?.description || "",
    category: template?.category || "",
    muscle_groups: template?.muscle_groups || "",
    video_url: template?.video_url || "",
    image_url: template?.image_url || "",
    document_url: template?.document_url || "",
    instructions: template?.instructions || "",
    sets_default: template?.sets_default || "",
    reps_default: template?.reps_default || "",
    duration_default: template?.duration_default_text ?? template?.duration_default ?? "",
    difficulty: template?.difficulty || "",
    set_01_rep: template?.set_01_rep || "",
    weight_01: template?.weight_01 || "",
    set_02_rep: template?.set_02_rep || "",
    weight_02: template?.weight_02 || "",
    set_03_rep: template?.set_03_rep || "",
    weight_03: template?.weight_03 || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const durStr = String(formData.duration_default || "").trim();
      const durNum = durStr ? parseInt(durStr, 10) : null;
      const isNumericDuration = durStr !== "" && !Number.isNaN(durNum);
      const payload = {
        ...formData,
        sets_default: formData.sets_default ? parseInt(formData.sets_default) : null,
        duration_default: isNumericDuration ? durNum : null,
        duration_default_text: isNumericDuration ? null : (durStr || null),
        weight_01: formData.weight_01 ? parseFloat(formData.weight_01) : null,
        weight_02: formData.weight_02 ? parseFloat(formData.weight_02) : null,
        weight_03: formData.weight_03 ? parseFloat(formData.weight_03) : null,
      };

      if (template) {
        await fitnessApi.updateExerciseTemplate(template.id, payload);
      } else {
        await fitnessApi.createExerciseTemplate(payload);
      }

      onSuccess();
    } catch (error: any) {
      console.error("Failed to save exercise template:", error);
      alert(error.response?.data?.message || "Failed to save exercise template");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[var(--panel)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {template ? "Edit Exercise Template" : "New Exercise Template"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Exercise Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-field w-full"
              required
              placeholder="e.g., Push-ups, Squats"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input-field w-full"
              rows={3}
              placeholder="Exercise description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="input-field w-full"
                placeholder="e.g., Cardio, Strength"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Difficulty</label>
              <SelectDropdown
                value={formData.difficulty}
                options={[
                  { value: "", label: "Select..." },
                  { value: "Beginner", label: "Beginner" },
                  { value: "Intermediate", label: "Intermediate" },
                  { value: "Advanced", label: "Advanced" },
                ]}
                onChange={(value) => setFormData({ ...formData, difficulty: value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Muscle Groups</label>
            <input
              type="text"
              value={formData.muscle_groups}
              onChange={(e) => setFormData({ ...formData, muscle_groups: e.target.value })}
              className="input-field w-full"
              placeholder="e.g., Chest, Shoulders, Legs"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Sets (default)</label>
              <input
                type="number"
                value={formData.sets_default}
                onChange={(e) => setFormData({ ...formData, sets_default: e.target.value })}
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Reps (default)</label>
              <input
                type="text"
                value={formData.reps_default}
                onChange={(e) => setFormData({ ...formData, reps_default: e.target.value })}
                className="input-field w-full"
                placeholder="10, 10-12, AMRAP"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Duration or Distance</label>
              <input
                type="text"
                value={formData.duration_default}
                onChange={(e) => setFormData({ ...formData, duration_default: e.target.value })}
                className="input-field w-full"
                placeholder="e.g. 30, 5Hr 20min, 5km, 10 mile"
              />
            </div>
          </div>

          {/* Set-specific Reps and Weights */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-semibold mb-3">Set Details</h3>
            <div className="space-y-3">
              {/* Set 01 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Set-01-Rep</label>
                  <input
                    type="text"
                    value={formData.set_01_rep}
                    onChange={(e) => setFormData({ ...formData, set_01_rep: e.target.value })}
                    className="input-field w-full"
                    placeholder="e.g., 10, 10-12"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Weight-01 (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.weight_01}
                    onChange={(e) => setFormData({ ...formData, weight_01: e.target.value })}
                    className="input-field w-full"
                    placeholder="e.g., 20.5"
                  />
                </div>
              </div>

              {/* Set 02 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Set-02-Rep</label>
                  <input
                    type="text"
                    value={formData.set_02_rep}
                    onChange={(e) => setFormData({ ...formData, set_02_rep: e.target.value })}
                    className="input-field w-full"
                    placeholder="e.g., 12, 12-15"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Weight-02 (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.weight_02}
                    onChange={(e) => setFormData({ ...formData, weight_02: e.target.value })}
                    className="input-field w-full"
                    placeholder="e.g., 22.5"
                  />
                </div>
              </div>

              {/* Set 03 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Set-03-Rep</label>
                  <input
                    type="text"
                    value={formData.set_03_rep}
                    onChange={(e) => setFormData({ ...formData, set_03_rep: e.target.value })}
                    className="input-field w-full"
                    placeholder="e.g., 15, 15-20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Weight-03 (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.weight_03}
                    onChange={(e) => setFormData({ ...formData, weight_03: e.target.value })}
                    className="input-field w-full"
                    placeholder="e.g., 25.0"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Video URL</label>
            <input
              type="url"
              value={formData.video_url}
              onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
              className="input-field w-full"
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Image URL</label>
              <input
                type="url"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                className="input-field w-full"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Document URL</label>
              <input
                type="url"
                value={formData.document_url}
                onChange={(e) => setFormData({ ...formData, document_url: e.target.value })}
                className="input-field w-full"
                placeholder="https://..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Instructions</label>
            <textarea
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              className="input-field w-full"
              rows={4}
              placeholder="Detailed exercise instructions..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={loading}
            >
              {loading ? "Saving..." : template ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExerciseTemplateForm;
