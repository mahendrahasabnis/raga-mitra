import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, Salad } from "lucide-react";
import { dietApi } from "../../services/api";
import SelectDropdown from "../UI/SelectDropdown";

interface MealTemplateFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  template?: any;
}

const MealTemplateForm: React.FC<MealTemplateFormProps> = ({
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
    meal_type: template?.meal_type || "",
    cuisine: template?.cuisine || "",
    diet_type: template?.diet_type || "",
    serving_size: template?.serving_size || "",
    calories: template?.calories || "",
    protein: template?.protein || "",
    carbs: template?.carbs || "",
    fats: template?.fats || "",
    fiber: template?.fiber || "",
    sugar: template?.sugar || "",
    sodium: template?.sodium || "",
    ingredients: template?.ingredients || "",
    instructions: template?.instructions || "",
    image_url: template?.image_url || "",
    document_url: template?.document_url || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        calories: formData.calories ? parseFloat(formData.calories) : null,
        protein: formData.protein ? parseFloat(formData.protein) : null,
        carbs: formData.carbs ? parseFloat(formData.carbs) : null,
        fats: formData.fats ? parseFloat(formData.fats) : null,
        fiber: formData.fiber ? parseFloat(formData.fiber) : null,
        sugar: formData.sugar ? parseFloat(formData.sugar) : null,
        sodium: formData.sodium ? parseFloat(formData.sodium) : null,
      };

      if (template) {
        await dietApi.updateMealTemplate(template.id, payload);
      } else {
        await dietApi.createMealTemplate(payload);
      }

      onSuccess();
    } catch (error: any) {
      console.error("Failed to save meal template:", error);
      alert(error.response?.data?.message || "Failed to save meal template");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4">
      <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[var(--panel)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {template ? "Edit Meal Template" : "New Meal Template"}
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
            <label className="block text-sm font-medium mb-2">Meal Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-field w-full"
              required
              placeholder="e.g., Grilled Chicken Bowl"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input-field w-full"
              rows={3}
              placeholder="Meal description..."
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
                placeholder="e.g., High Protein"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Meal Type</label>
              <SelectDropdown
                value={formData.meal_type}
                options={[
                  { value: "", label: "Select..." },
                  { value: "breakfast", label: "Breakfast" },
                  { value: "lunch", label: "Lunch" },
                  { value: "dinner", label: "Dinner" },
                  { value: "snack", label: "Snack" },
                ]}
                onChange={(value) => setFormData({ ...formData, meal_type: value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Cuisine</label>
              <input
                type="text"
                value={formData.cuisine}
                onChange={(e) => setFormData({ ...formData, cuisine: e.target.value })}
                className="input-field w-full"
                placeholder="e.g., Mediterranean"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Diet Type</label>
              <SelectDropdown
                value={formData.diet_type}
                options={[
                  { value: "", label: "Select..." },
                  { value: "veg", label: "Vegetarian" },
                  { value: "non-veg", label: "Non-Vegetarian" },
                  { value: "vegan", label: "Vegan" },
                  { value: "keto", label: "Keto" },
                  { value: "gluten-free", label: "Gluten Free" },
                ]}
                onChange={(value) => setFormData({ ...formData, diet_type: value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Serving Size</label>
            <input
              type="text"
              value={formData.serving_size}
              onChange={(e) => setFormData({ ...formData, serving_size: e.target.value })}
              className="input-field w-full"
              placeholder="e.g., 1 bowl"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Calories</label>
              <input
                type="number"
                value={formData.calories}
                onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Protein (g)</label>
              <input
                type="number"
                value={formData.protein}
                onChange={(e) => setFormData({ ...formData, protein: e.target.value })}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Carbs (g)</label>
              <input
                type="number"
                value={formData.carbs}
                onChange={(e) => setFormData({ ...formData, carbs: e.target.value })}
                className="input-field w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Fats (g)</label>
              <input
                type="number"
                value={formData.fats}
                onChange={(e) => setFormData({ ...formData, fats: e.target.value })}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Fiber (g)</label>
              <input
                type="number"
                value={formData.fiber}
                onChange={(e) => setFormData({ ...formData, fiber: e.target.value })}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Sugar (g)</label>
              <input
                type="number"
                value={formData.sugar}
                onChange={(e) => setFormData({ ...formData, sugar: e.target.value })}
                className="input-field w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Sodium (mg)</label>
              <input
                type="number"
                value={formData.sodium}
                onChange={(e) => setFormData({ ...formData, sodium: e.target.value })}
                className="input-field w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Ingredients</label>
            <textarea
              value={formData.ingredients}
              onChange={(e) => setFormData({ ...formData, ingredients: e.target.value })}
              className="input-field w-full"
              rows={2}
              placeholder="Ingredients list..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Instructions</label>
            <textarea
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              className="input-field w-full"
              rows={3}
              placeholder="Preparation steps..."
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

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
              {loading ? "Saving..." : "Save Meal"}
              <Salad className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default MealTemplateForm;
