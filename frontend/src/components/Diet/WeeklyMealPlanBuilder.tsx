import React, { useState, useEffect } from "react";
import { Calendar, Plus, GripVertical, Salad } from "lucide-react";
import { dietApi } from "../../services/api";

interface WeeklyMealPlanBuilderProps {
  selectedClient?: string | null;
  onRefresh?: () => void;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEAL_TYPES = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snacks", label: "Snacks" },
];

const WeeklyMealPlanBuilder: React.FC<WeeklyMealPlanBuilderProps> = ({
  selectedClient,
  onRefresh,
}) => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showItemForm, setShowItemForm] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);

  const fetchTemplateDetails = async (id: string) => {
    try {
      const res = await dietApi.getWeekTemplate(id);
      setSelectedTemplate(res.template);
    } catch (error) {
      console.error("Failed to fetch template details:", error);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await dietApi.getWeekTemplates(selectedClient || undefined);
      setTemplates(res.templates || []);
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    const name = prompt("Template name:");
    if (!name) return;

    try {
      const templateData = {
        name,
        description: "",
        days: DAYS.map((_, index) => ({
          day_of_week: index,
          meals: [],
        })),
        client_id: selectedClient || undefined,
      };

      const res = await dietApi.createWeekTemplate(templateData);
      await fetchTemplates();
      if (res.template) {
        setSelectedTemplate(res.template);
      }
    } catch (error) {
      console.error("Failed to create template:", error);
      alert("Failed to create template");
    }
  };

  const handleAddMeal = async (dayIndex: number) => {
    if (!selectedTemplate) return;

    const mealType = prompt("Meal type (breakfast/lunch/dinner/snacks):");
    if (!mealType) return;

    try {
      const day = selectedTemplate.days[dayIndex];
      if (!day) return;

      const updatedDays = [...selectedTemplate.days];
      if (!updatedDays[dayIndex].meals) {
        updatedDays[dayIndex].meals = [];
      }
      updatedDays[dayIndex].meals.push({
        meal_type: mealType,
        meal_order: updatedDays[dayIndex].meals.length,
        items: [],
      });

      const templateData = {
        name: selectedTemplate.name,
        description: selectedTemplate.description,
        days: updatedDays,
        client_id: selectedClient || undefined,
      };

      const res = await dietApi.updateWeekTemplate(selectedTemplate.id, templateData);
      if (res.template) {
        setSelectedTemplate(res.template);
      }
      onRefresh && onRefresh();
    } catch (error) {
      console.error("Failed to add meal:", error);
      alert("Failed to add meal");
    }
  };

  const handleAddItem = (dayIndex: number, mealId: string) => {
    setSelectedDayIndex(dayIndex);
    setSelectedMealId(mealId);
    setShowItemForm(true);
  };

  const handleItemFormClose = () => {
    setShowItemForm(false);
    setSelectedDayIndex(null);
    setSelectedMealId(null);
  };

  const handleItemSubmit = async (itemData: any) => {
    if (!selectedTemplate || selectedDayIndex === null || !selectedMealId) return;

    const updatedDays = [...selectedTemplate.days];
    const day = updatedDays[selectedDayIndex];
    const meal = day.meals.find((m: any) => m.id === selectedMealId);

    if (meal) {
      if (!meal.items) {
        meal.items = [];
      }
      meal.items.push({
        ...itemData,
        item_order: meal.items.length,
      });

      const templateData = {
        name: selectedTemplate.name,
        description: selectedTemplate.description,
        days: updatedDays,
        client_id: selectedClient || undefined,
      };

      try {
        const res = await dietApi.updateWeekTemplate(selectedTemplate.id, templateData);
        if (res.template) {
          setSelectedTemplate(res.template);
        }
        onRefresh && onRefresh();
        handleItemFormClose();
      } catch (error) {
        console.error("Failed to add item:", error);
        alert("Failed to add item");
      }
    }
  };

  if (loading) {
    return (
      <div className="card p-4">
        <p className="text-sm text-gray-400">Loading templates...</p>
      </div>
    );
  }

  if (showItemForm && selectedDayIndex !== null && selectedMealId) {
    return (
      <MealItemForm
        onClose={handleItemFormClose}
        onSubmit={handleItemSubmit}
      />
    );
  }

  return (
    <div className="space-y-4 overflow-x-hidden">
      {/* Template Selection */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Weekly Meal Templates</h3>
          {!selectedClient && (
            <button onClick={handleCreateTemplate} className="btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Template
            </button>
          )}
        </div>

        {templates.length === 0 ? (
          <p className="text-sm text-gray-400">No templates yet. Create one to get started.</p>
        ) : (
          <select
            value={selectedTemplate?.id || ""}
            onChange={(e) => {
              const template = templates.find((t) => t.id === e.target.value);
              if (template) {
                fetchTemplateDetails(template.id);
              }
            }}
            className="input-field w-full"
          >
            <option value="">Select a template...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Template Builder */}
      {selectedTemplate && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="font-semibold mb-4">{selectedTemplate.name}</h3>

            <div className="space-y-4">
              {DAYS.map((dayName, dayIndex) => {
                const day = selectedTemplate.days?.find((d: any) => d.day_of_week === dayIndex);

                return (
                  <div key={dayIndex} className="border border-white/10 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">{dayName}</h4>
                    </div>

                    <div className="space-y-3">
                      {day?.meals?.map((meal: any) => (
                        <div key={meal.id} className="bg-white/5 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium text-sm">
                              {MEAL_TYPES.find((mt) => mt.value === meal.meal_type)?.label || meal.meal_type}
                            </h5>
                            {!selectedClient && (
                              <button
                                onClick={() => handleAddItem(dayIndex, meal.id)}
                                className="text-xs btn-secondary"
                              >
                                Add Item
                              </button>
                            )}
                          </div>

                          {meal.items?.length > 0 ? (
                            <div className="space-y-2">
                              {meal.items.map((item: any, idx: number) => (
                                <div
                                  key={item.id || idx}
                                  className="flex items-center justify-between p-2 bg-white/5 rounded text-sm"
                                >
                                  <div className="flex items-center gap-2">
                                    <GripVertical className="h-4 w-4 text-gray-400" />
                                    <span>{item.food_name}</span>
                                    {item.quantity && <span className="text-gray-400">({item.quantity})</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">No items yet</p>
                          )}
                        </div>
                      ))}

                      {!selectedClient && (
                        <button
                          onClick={() => handleAddMeal(dayIndex)}
                          className="text-xs btn-secondary w-full"
                        >
                          + Add Meal
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Simple inline form for adding meal items
const MealItemForm: React.FC<{ onClose: () => void; onSubmit: (data: any) => void }> = ({
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState({
    food_name: "",
    quantity: "",
    calories: "",
    protein: "",
    carbs: "",
    fats: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      food_name: formData.food_name,
      quantity: formData.quantity || null,
      calories: formData.calories ? parseFloat(formData.calories) : null,
      protein: formData.protein ? parseFloat(formData.protein) : null,
      carbs: formData.carbs ? parseFloat(formData.carbs) : null,
      fats: formData.fats ? parseFloat(formData.fats) : null,
    });
  };

  return (
    <div className="space-y-4 overflow-x-hidden">
      <button onClick={onClose} className="btn-secondary">
        ← Back to Builder
      </button>
      <div className="card p-4">
        <h3 className="font-semibold mb-4">Add Food Item</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Food Name *</label>
            <input
              type="text"
              value={formData.food_name}
              onChange={(e) => setFormData({ ...formData, food_name: e.target.value })}
              className="input-field w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Quantity</label>
            <input
              type="text"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              className="input-field w-full"
              placeholder="e.g., 1 cup, 200g"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            <div>
              <label className="block text-sm font-medium mb-2">Fats (g)</label>
              <input
                type="number"
                value={formData.fats}
                onChange={(e) => setFormData({ ...formData, fats: e.target.value })}
                className="input-field w-full"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1">
              Add Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WeeklyMealPlanBuilder;
