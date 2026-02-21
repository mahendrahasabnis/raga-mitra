import React, { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Salad, GripVertical } from "lucide-react";
import { dietApi } from "../../services/api";
import MealLibrary from "./MealLibrary";

interface WeeklyMealPlanBuilderProps {
  selectedClient?: string | null;
  onRefresh?: () => void;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const WeeklyMealPlanBuilder: React.FC<WeeklyMealPlanBuilderProps> = ({
  selectedClient,
  onRefresh,
}) => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showMealLibrary, setShowMealLibrary] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [itemEditor, setItemEditor] = useState<{
    dayIndex: number;
    sessionId: string;
    itemIndex: number;
  } | null>(null);
  const [itemForm, setItemForm] = useState({
    quantity: "",
    calories: "",
    protein: "",
    carbs: "",
    fats: "",
    fiber: "",
    sugar: "",
    sodium: "",
  });

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
      const activeTemplates = (res.templates || []).filter((t: any) => t.is_active !== false);
      setTemplates(activeTemplates);
      if (!selectedTemplate && activeTemplates.length > 0) {
        fetchTemplateDetails(activeTemplates[0].id);
      }
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
          is_rest_day: false,
          sessions: [],
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

  const handleAddSession = async (dayIndex: number) => {
    if (!selectedTemplate) return;
    const sessionName = prompt("Session name (e.g., Breakfast, Lunch):");
    if (!sessionName) return;

    try {
      const updatedDays = [...selectedTemplate.days];
      if (!updatedDays[dayIndex].sessions) {
        updatedDays[dayIndex].sessions = [];
      }
      updatedDays[dayIndex].sessions.push({
        session_name: sessionName,
        session_order: updatedDays[dayIndex].sessions.length,
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
      console.error("Failed to add session:", error);
      alert("Failed to add session");
    }
  };

  const handleAddItems = (
    dayIndex: number | null,
    sessionId: string | null,
    mealTemplates: any[]
  ) => {
    setShowMealLibrary(false);
    setSelectedDayIndex(null);
    setSelectedSessionId(null);

    if (!selectedTemplate || dayIndex === null || !sessionId) return;

    const updatedDays = [...selectedTemplate.days];
    const day = updatedDays[dayIndex];
    const session = day.sessions.find((s: any) => s.id === sessionId);

    if (session) {
      if (!session.items) {
        session.items = [];
      }
      mealTemplates.forEach((mealTemplate) => {
        session.items.push({
          meal_template_id: mealTemplate.id,
          food_name: mealTemplate.name,
          item_order: session.items.length,
          quantity: mealTemplate.serving_size || null,
          calories: mealTemplate.calories || null,
          protein: mealTemplate.protein || null,
          carbs: mealTemplate.carbs || null,
          fats: mealTemplate.fats || null,
          fiber: mealTemplate.fiber || null,
          sugar: mealTemplate.sugar || null,
          sodium: mealTemplate.sodium || null,
        });
      });

      const templateData = {
        name: selectedTemplate.name,
        description: selectedTemplate.description,
        days: updatedDays,
        client_id: selectedClient || undefined,
      };

      dietApi.updateWeekTemplate(selectedTemplate.id, templateData).then((res) => {
        if (res.template) {
          setSelectedTemplate(res.template);
        }
        onRefresh && onRefresh();
      });
    }
  };

  const handleMealLibraryOpen = (dayIndex: number, sessionId: string) => {
    setSelectedDayIndex(dayIndex);
    setSelectedSessionId(sessionId);
    setShowMealLibrary(true);
  };

  const openItemEditor = (dayIndex: number, sessionId: string, itemIndex: number) => {
    if (!selectedTemplate) return;
    const day = selectedTemplate.days?.find((d: any) => d.day_of_week === dayIndex);
    const session = day?.sessions?.find((s: any) => s.id === sessionId);
    const item = session?.items?.[itemIndex];
    if (!item) return;
    setItemForm({
      quantity: item.quantity ?? "",
      calories: item.calories ?? "",
      protein: item.protein ?? "",
      carbs: item.carbs ?? "",
      fats: item.fats ?? "",
      fiber: item.fiber ?? "",
      sugar: item.sugar ?? "",
      sodium: item.sodium ?? "",
    });
    setItemEditor({ dayIndex, sessionId, itemIndex });
  };

  const handleSaveItemSettings = async () => {
    if (!selectedTemplate || !itemEditor) return;
    const { dayIndex, sessionId, itemIndex } = itemEditor;
    const updatedDays = [...selectedTemplate.days];
    const day = updatedDays[dayIndex];
    const session = day.sessions.find((s: any) => s.id === sessionId);
    if (!session) return;
    const item = session.items?.[itemIndex];
    if (!item) return;

    session.items[itemIndex] = {
      ...item,
      quantity: itemForm.quantity || null,
      calories: itemForm.calories ? Number(itemForm.calories) : null,
      protein: itemForm.protein ? Number(itemForm.protein) : null,
      carbs: itemForm.carbs ? Number(itemForm.carbs) : null,
      fats: itemForm.fats ? Number(itemForm.fats) : null,
      fiber: itemForm.fiber ? Number(itemForm.fiber) : null,
      sugar: itemForm.sugar ? Number(itemForm.sugar) : null,
      sodium: itemForm.sodium ? Number(itemForm.sodium) : null,
    };

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
      setItemEditor(null);
      onRefresh && onRefresh();
    } catch (error) {
      console.error("Failed to update item:", error);
      alert("Failed to update item");
    }
  };

  const handleDeleteItem = async (dayIndex: number, sessionId: string, itemIndex: number) => {
    if (!selectedTemplate) return;
    if (!confirm("Delete this item?")) return;
    const updatedDays = [...selectedTemplate.days];
    const day = updatedDays[dayIndex];
    const session = day.sessions.find((s: any) => s.id === sessionId);
    if (!session) return;
    session.items.splice(itemIndex, 1);
    session.items = session.items.map((item: any, idx: number) => ({
      ...item,
      item_order: idx,
    }));
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
    } catch (error) {
      console.error("Failed to delete item:", error);
    }
  };

  if (loading) {
    return (
      <div className="card p-4">
        <p className="text-sm text-gray-400">Loading templates...</p>
      </div>
    );
  }

  if (showMealLibrary && selectedDayIndex !== null && selectedSessionId) {
    return (
      <MealLibrary
        selectedClient={selectedClient}
        onSelectMultiple={(templates) => handleAddItems(selectedDayIndex, selectedSessionId, templates)}
      />
    );
  }

  return (
    <div className="space-y-4 overflow-x-hidden">
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
          <div className="space-y-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className={`p-3 rounded-lg cursor-pointer transition ${
                  selectedTemplate?.id === template.id
                    ? "bg-blue-500/20 border border-blue-400/30"
                    : "bg-white/5 hover:bg-white/10"
                }`}
                onClick={() => fetchTemplateDetails(template.id)}
              >
                <div className="flex items-center gap-2">
                  <Salad className="h-4 w-4 text-emerald-300" />
                  <div>
                    <p className="font-medium">{template.name}</p>
                    {template.description && (
                      <p className="text-xs text-gray-400">{template.description}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedTemplate && (
        <div className="space-y-4">
          {DAYS.map((day, dayIndex) => {
            const dayData = selectedTemplate.days?.find((d: any) => d.day_of_week === dayIndex);
            const sessions = dayData?.sessions || [];

            return (
              <div key={dayIndex} className="card p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold">{day}</h4>
                  {!selectedClient && (
                    <button
                      onClick={() => handleAddSession(dayIndex)}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Session
                    </button>
                  )}
                </div>

                {sessions.length === 0 ? (
                  <p className="text-sm text-gray-400">No sessions planned</p>
                ) : (
                  <div className="space-y-3">
                    {sessions.map((session: any, sessionIndex: number) => (
                      <div key={session.id || sessionIndex} className="p-3 bg-white/5 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 text-gray-400" />
                            <span className="font-medium">{session.session_name}</span>
                          </div>
                          {!selectedClient && (
                            <button
                              onClick={() => handleMealLibraryOpen(dayIndex, session.id)}
                              className="btn-secondary text-xs"
                            >
                              Add Items
                            </button>
                          )}
                        </div>

                        {session.items && session.items.length > 0 && (
                          <div className="space-y-2 pl-6">
                            {session.items.map((item: any, idx: number) => (
                              <div key={item.id || idx} className="p-2 bg-white/5 rounded text-sm">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{item.food_name}</span>
                                  {item.quantity && (
                                    <span className="text-gray-400 text-xs">{item.quantity}</span>
                                  )}
                                </div>
                                <div className="flex gap-3 text-xs text-gray-400 mt-1">
                                  {item.calories && <span>{item.calories} cal</span>}
                                  {item.protein && <span>{item.protein}g protein</span>}
                                  {item.carbs && <span>{item.carbs}g carbs</span>}
                                  {item.fats && <span>{item.fats}g fats</span>}
                                </div>
                                {!selectedClient && (
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      onClick={() => openItemEditor(dayIndex, session.id, idx)}
                                      className="btn-secondary p-1"
                                    >
                                      <Edit className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteItem(dayIndex, session.id, idx)}
                                      className="btn-secondary p-1"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {itemEditor && (
        <div className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold">Edit Meal Item</h3>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={itemForm.quantity}
                onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })}
                className="input-field"
                placeholder="Quantity"
              />
              <input
                type="number"
                value={itemForm.calories}
                onChange={(e) => setItemForm({ ...itemForm, calories: e.target.value })}
                className="input-field"
                placeholder="Calories"
              />
              <input
                type="number"
                value={itemForm.protein}
                onChange={(e) => setItemForm({ ...itemForm, protein: e.target.value })}
                className="input-field"
                placeholder="Protein (g)"
              />
              <input
                type="number"
                value={itemForm.carbs}
                onChange={(e) => setItemForm({ ...itemForm, carbs: e.target.value })}
                className="input-field"
                placeholder="Carbs (g)"
              />
              <input
                type="number"
                value={itemForm.fats}
                onChange={(e) => setItemForm({ ...itemForm, fats: e.target.value })}
                className="input-field"
                placeholder="Fats (g)"
              />
              <input
                type="number"
                value={itemForm.fiber}
                onChange={(e) => setItemForm({ ...itemForm, fiber: e.target.value })}
                className="input-field"
                placeholder="Fiber (g)"
              />
              <input
                type="number"
                value={itemForm.sugar}
                onChange={(e) => setItemForm({ ...itemForm, sugar: e.target.value })}
                className="input-field"
                placeholder="Sugar (g)"
              />
              <input
                type="number"
                value={itemForm.sodium}
                onChange={(e) => setItemForm({ ...itemForm, sodium: e.target.value })}
                className="input-field"
                placeholder="Sodium (mg)"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setItemEditor(null)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleSaveItemSettings} className="btn-primary">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyMealPlanBuilder;
