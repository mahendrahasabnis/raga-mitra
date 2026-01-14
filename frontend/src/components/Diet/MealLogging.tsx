import React, { useState, useEffect } from "react";
import { Plus, Camera, X, Clock } from "lucide-react";
import { dietApi } from "../../services/api";

interface MealLoggingProps {
  selectedClient?: string | null;
  onSuccess?: () => void;
}

const MEAL_TYPES = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snacks", label: "Snacks" },
];

const MealLogging: React.FC<MealLoggingProps> = ({
  selectedClient,
  onSuccess,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [adHocEntries, setAdHocEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdHocEntries();
  }, [selectedClient]);

  const fetchAdHocEntries = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await dietApi.getAdHocEntries(
        selectedClient || undefined,
        today,
        today
      );
      setAdHocEntries(res.entries || []);
    } catch (error) {
      console.error("Failed to fetch ad-hoc entries:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    setShowForm(false);
    fetchAdHocEntries();
    onSuccess && onSuccess();
  };

  if (loading) {
    return (
      <div className="card p-4">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 overflow-x-hidden">
        <div className="flex items-center justify-between">
          {!selectedClient && (
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Log Meal
            </button>
          )}
        </div>

        {adHocEntries.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-gray-400">No meals logged today</p>
            {!selectedClient && (
              <button
                onClick={() => setShowForm(true)}
                className="btn-primary mt-4"
              >
                Log your first meal
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {adHocEntries.map((entry) => (
              <div key={entry.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">{entry.food_name}</h4>
                      {entry.meal_type && (
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300">
                          {MEAL_TYPES.find((mt) => mt.value === entry.meal_type)?.label || entry.meal_type}
                        </span>
                      )}
                    </div>
                    {entry.quantity && (
                      <p className="text-sm text-gray-400 mb-1">Quantity: {entry.quantity}</p>
                    )}
                    {entry.entry_time && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {entry.entry_time}
                      </p>
                    )}
                    {(entry.calories || entry.protein || entry.carbs || entry.fats) && (
                      <div className="flex gap-3 mt-2 text-xs text-gray-400">
                        {entry.calories && <span>{entry.calories} cal</span>}
                        {entry.protein && <span>{entry.protein}g protein</span>}
                        {entry.carbs && <span>{entry.carbs}g carbs</span>}
                        {entry.fats && <span>{entry.fats}g fats</span>}
                      </div>
                    )}
                    {entry.notes && (
                      <p className="text-sm text-gray-300 mt-2">{entry.notes}</p>
                    )}
                  </div>
                </div>
                {entry.pictures && entry.pictures.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {entry.pictures.map((url: string, idx: number) => (
                      <img
                        key={idx}
                        src={url}
                        alt={`Meal ${idx + 1}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <MealLoggingForm
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          onSuccess={handleSuccess}
          selectedClient={selectedClient}
        />
      )}
    </>
  );
};

const MealLoggingForm: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedClient?: string | null;
}> = ({ isOpen, onClose, onSuccess, selectedClient }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    entry_date: new Date().toISOString().split("T")[0],
    entry_time: new Date().toTimeString().slice(0, 5),
    meal_type: "",
    food_name: "",
    quantity: "",
    calories: "",
    protein: "",
    carbs: "",
    fats: "",
    notes: "",
    pictures: [] as string[],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        entry_date: formData.entry_date,
        entry_time: formData.entry_time,
        meal_type: formData.meal_type || null,
        food_name: formData.food_name,
        quantity: formData.quantity || null,
        calories: formData.calories ? parseFloat(formData.calories) : null,
        protein: formData.protein ? parseFloat(formData.protein) : null,
        carbs: formData.carbs ? parseFloat(formData.carbs) : null,
        fats: formData.fats ? parseFloat(formData.fats) : null,
        notes: formData.notes || null,
        pictures: formData.pictures.length > 0 ? formData.pictures : null,
        client_id: selectedClient || undefined,
      };

      await dietApi.createAdHocEntry(payload);
      onSuccess();
    } catch (error: any) {
      console.error("Failed to log meal:", error);
      alert(error.response?.data?.message || "Failed to log meal");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPicture = () => {
    const url = prompt("Picture URL:");
    if (url) {
      setFormData({ ...formData, pictures: [...formData.pictures, url] });
    }
  };

  const handleRemovePicture = (index: number) => {
    setFormData({
      ...formData,
      pictures: formData.pictures.filter((_, i) => i !== index),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[var(--panel)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Log Meal</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Date</label>
              <input
                type="date"
                value={formData.entry_date}
                onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                className="input-field w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Time</label>
              <input
                type="time"
                value={formData.entry_time}
                onChange={(e) => setFormData({ ...formData, entry_time: e.target.value })}
                className="input-field w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Meal Type</label>
            <select
              value={formData.meal_type}
              onChange={(e) => setFormData({ ...formData, meal_type: e.target.value })}
              className="input-field w-full"
            >
              <option value="">Select...</option>
              {MEAL_TYPES.map((mt) => (
                <option key={mt.value} value={mt.value}>
                  {mt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Food Name *</label>
            <input
              type="text"
              value={formData.food_name}
              onChange={(e) => setFormData({ ...formData, food_name: e.target.value })}
              className="input-field w-full"
              required
              placeholder="e.g., Grilled Chicken"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Quantity</label>
            <input
              type="text"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              className="input-field w-full"
              placeholder="e.g., 200g, 1 cup"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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

          <div>
            <label className="block text-sm font-medium mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input-field w-full"
              rows={3}
              placeholder="Any notes about this meal..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Pictures</label>
              <button
                type="button"
                onClick={handleAddPicture}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <Camera className="h-4 w-4" />
                Add Picture
              </button>
            </div>
            {formData.pictures.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {formData.pictures.map((url, index) => (
                  <div key={index} className="relative">
                    <img
                      src={url}
                      alt={`Meal picture ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePicture(index)}
                      className="absolute top-2 right-2 p-1 bg-red-500/80 rounded-full"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No pictures added</p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? "Logging..." : "Log Meal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MealLogging;
