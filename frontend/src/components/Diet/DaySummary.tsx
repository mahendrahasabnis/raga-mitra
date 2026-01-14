import React, { useState, useEffect } from "react";
import { CheckCircle2, Circle, FileText, Camera, X } from "lucide-react";
import { dietApi } from "../../services/api";

interface DaySummaryProps {
  date: string;
  selectedClient?: string | null;
  onComplete?: () => void;
}

const MEAL_TYPES = [
  { value: "breakfast", label: "Breakfast", order: 0 },
  { value: "lunch", label: "Lunch", order: 1 },
  { value: "dinner", label: "Dinner", order: 2 },
  { value: "snacks", label: "Snacks", order: 3 },
];

const DaySummary: React.FC<DaySummaryProps> = ({
  date,
  selectedClient,
  onComplete,
}) => {
  const [calendarEntry, setCalendarEntry] = useState<any>(null);
  const [tracking, setTracking] = useState<any[]>([]);
  const [notes, setNotes] = useState("");
  const [pictures, setPictures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDayData();
  }, [date, selectedClient]);

  const fetchDayData = async () => {
    setLoading(true);
    try {
      const [entryRes, trackingRes] = await Promise.allSettled([
        dietApi.getCalendarEntry(date),
        dietApi.getTracking(selectedClient || undefined, date, date),
      ]);

      if (entryRes.status === "fulfilled") {
        setCalendarEntry(entryRes.value.entry);
      }

      if (trackingRes.status === "fulfilled") {
        const trackingData = trackingRes.value.tracking || [];
        setTracking(trackingData);
        // Get notes/pictures from first tracking entry (simplified)
        if (trackingData.length > 0) {
          setNotes(trackingData[0].notes || "");
          setPictures(trackingData[0].pictures || []);
        }
      }
    } catch (error) {
      console.error("Failed to fetch day data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMeal = async (mealId: string, completed: boolean) => {
    if (!calendarEntry) return;

    setLoading(true);
    try {
      const trackingData = {
        calendar_entry_id: calendarEntry.id,
        calendar_meal_id: mealId,
        tracked_date: date,
        completion_status: completed ? "completed" : "pending",
        notes,
        pictures: pictures.length > 0 ? pictures : null,
        client_id: selectedClient || undefined,
      };

      const existingTracking = tracking.find((t) => t.calendar_meal_id === mealId);
      if (existingTracking) {
        await dietApi.updateTracking(existingTracking.id, trackingData);
      } else {
        await dietApi.createTracking(trackingData);
      }

      await fetchDayData();
      onComplete && onComplete();
    } catch (error) {
      console.error("Failed to update tracking:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!calendarEntry || tracking.length === 0) return;

    setLoading(true);
    try {
      const trackingData = {
        calendar_entry_id: calendarEntry.id,
        tracked_date: date,
        notes,
        pictures: pictures.length > 0 ? pictures : null,
        client_id: selectedClient || undefined,
      };

      await dietApi.updateTracking(tracking[0].id, trackingData);
      await fetchDayData();
    } catch (error) {
      console.error("Failed to save notes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPicture = () => {
    const url = prompt("Picture URL:");
    if (url) {
      setPictures([...pictures, url]);
    }
  };

  const handleRemovePicture = (index: number) => {
    setPictures(pictures.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="card p-4">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!calendarEntry) {
    return (
      <div className="card p-4">
        <p className="text-sm text-gray-400">No meal plan for this date</p>
      </div>
    );
  }

  const sortedMeals = (calendarEntry.meals || []).sort((a: any, b: any) => {
    const aOrder = MEAL_TYPES.find((mt) => mt.value === a.meal_type)?.order || 999;
    const bOrder = MEAL_TYPES.find((mt) => mt.value === b.meal_type)?.order || 999;
    return aOrder - bOrder;
  });

  return (
    <div className="space-y-4 overflow-x-hidden">
      {/* Day Header */}
      <div className="card p-4">
        <h2 className="text-xl font-semibold mb-2">
          {new Date(date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </h2>
      </div>

      {/* Meals */}
      {sortedMeals.length === 0 ? (
        <div className="card p-4">
          <p className="text-sm text-gray-400">No meals planned for this day</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedMeals.map((meal: any) => {
            const mealTracking = tracking.find((t) => t.calendar_meal_id === meal.id);
            const isCompleted = mealTracking?.completion_status === "completed";

            return (
              <div key={meal.id} className="card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {!selectedClient && (
                      <button
                        onClick={() => handleToggleMeal(meal.id, !isCompleted)}
                        className="mt-1"
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        ) : (
                          <Circle className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                    )}
                    <div>
                      <h3 className="font-semibold">
                        {MEAL_TYPES.find((mt) => mt.value === meal.meal_type)?.label || meal.meal_type}
                      </h3>
                    </div>
                  </div>
                </div>

                {meal.items && meal.items.length > 0 && (
                  <div className="space-y-2 ml-8">
                    {meal.items.map((item: any, idx: number) => (
                      <div key={item.id || idx} className="p-2 bg-white/5 rounded text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{item.food_name}</span>
                          {item.quantity && (
                            <span className="text-gray-400 text-xs">{item.quantity}</span>
                          )}
                        </div>
                        {(item.calories || item.protein || item.carbs || item.fats) && (
                          <div className="flex gap-3 mt-1 text-xs text-gray-400">
                            {item.calories && <span>{item.calories} cal</span>}
                            {item.protein && <span>{item.protein}g protein</span>}
                            {item.carbs && <span>{item.carbs}g carbs</span>}
                            {item.fats && <span>{item.fats}g fats</span>}
                          </div>
                        )}
                        {item.notes && (
                          <p className="text-xs text-gray-300 mt-1">{item.notes}</p>
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

      {/* Notes */}
      {!selectedClient && (
        <div className="card p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Daily Notes
          </h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input-field w-full"
            rows={4}
            placeholder="Add notes about your meals for this day..."
          />
        </div>
      )}

      {/* Pictures */}
      {!selectedClient && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Pictures
            </h3>
            <button onClick={handleAddPicture} className="btn-secondary text-sm">
              Add Picture
            </button>
          </div>
          {pictures.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {pictures.map((url, index) => (
                <div key={index} className="relative">
                  <img
                    src={url}
                    alt={`Day picture ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <button
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
      )}

      {/* Save Button */}
      {!selectedClient && (
        <button
          onClick={handleSaveNotes}
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? "Saving..." : "Save Notes & Pictures"}
        </button>
      )}
    </div>
  );
};

export default DaySummary;
