import React, { useState, useEffect } from "react";
import { CheckCircle2, Circle, Camera, X, Plus, Trash2 } from "lucide-react";
import { dietApi } from "../../services/api";
import MealLibrary from "./MealLibrary";

interface SessionDetailProps {
  date: string;
  session: any;
  selectedClient?: string | null;
  onComplete?: () => void;
}

const SessionDetail: React.FC<SessionDetailProps> = ({
  date,
  session,
  selectedClient,
  onComplete,
}) => {
  const [sessionData, setSessionData] = useState<any>(session);
  const [sessionTracking, setSessionTracking] = useState<any>({});
  const [itemTracking, setItemTracking] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState("");
  const [pictures, setPictures] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showMealLibrary, setShowMealLibrary] = useState(false);
  const readOnly = !!selectedClient;

  useEffect(() => {
    fetchTracking();
  }, [date, sessionData?.id]);

  useEffect(() => {
    setSessionData((prev) => {
      if (!prev) return session;
      const prevCount = prev?.items?.length || 0;
      const nextCount = session?.items?.length || 0;
      return nextCount >= prevCount ? session : prev;
    });
  }, [session]);

  const fetchTracking = async () => {
    try {
      const res = await dietApi.getTracking(
        selectedClient || undefined,
        date,
        date
      );
      const sessionRows = res.tracking?.filter((t: any) => t.calendar_meal_id === sessionData?.id) || [];
      const sessionOnly = sessionRows.find((t: any) => !t.calendar_meal_item_id);
      if (sessionOnly) {
        setSessionTracking(sessionOnly);
        setNotes(sessionOnly.notes || "");
        setPictures(sessionOnly.pictures || []);
      }

      const itemMap: Record<string, any> = {};
      sessionRows
        .filter((t: any) => t.calendar_meal_item_id)
        .forEach((t: any) => {
          itemMap[t.calendar_meal_item_id] = t;
        });
      setItemTracking(itemMap);
    } catch (error) {
      console.error("Failed to fetch tracking:", error);
    }
  };

  const updateCalendarEntrySessions = async (sessions: any[]) => {
    const entryRes = await dietApi.getCalendarEntry(date, selectedClient || undefined);
    const entry = entryRes.entry;
    const payload = {
      date,
      week_template_id: entry?.week_template_id || null,
      template_day_id: entry?.template_day_id || null,
      is_override: true,
      sessions,
      client_id: selectedClient || undefined,
    };
    return dietApi.createCalendarEntry(payload);
  };

  const handleAddSessionAdhoc = async () => {
    const sessionName = prompt("Session name (e.g., Breakfast, Lunch):");
    if (!sessionName) return;
    setLoading(true);
    try {
      const entryRes = await dietApi.getCalendarEntry(date, selectedClient || undefined);
      const entry = entryRes.entry;
      const existingSessions = entry?.sessions || [];
      const maxOrder = existingSessions.reduce((max: number, s: any) => Math.max(max, s.session_order || 0), -1);
      const newSession = {
        session_name: sessionName,
        session_order: maxOrder + 1,
        notes: null,
        items: [],
      };
      const created = await updateCalendarEntrySessions([...existingSessions, newSession]);
      const createdSessions = created.entry?.sessions || [];
      const createdSession = createdSessions.find((s: any) =>
        s.session_name === sessionName && s.session_order === newSession.session_order
      ) || createdSessions[createdSessions.length - 1];
      if (createdSession) {
        setSessionData(createdSession);
      }
    } catch (error) {
      console.error("Failed to add session:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!sessionData) return;
    if (!confirm("Delete this session?")) return;
    setLoading(true);
    try {
      const entryRes = await dietApi.getCalendarEntry(date, selectedClient || undefined);
      const entry = entryRes.entry;
      const remainingSessions = (entry?.sessions || []).filter((s: any) => s.id !== sessionData.id);
      const created = await updateCalendarEntrySessions(remainingSessions);
      const nextSession = created.entry?.sessions?.[0];
      if (nextSession) {
        setSessionData(nextSession);
      } else {
        setSessionData(null);
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItems = async (mealTemplates: any[]) => {
    if (!sessionData) return;
    setLoading(true);
    try {
      const entryRes = await dietApi.getCalendarEntry(date, selectedClient || undefined);
      const entry = entryRes.entry;
      const updatedSessions = (entry?.sessions || []).map((s: any) => {
        if (s.id !== sessionData.id) return s;
        const existingItems = s.items || [];
        const startOrder = existingItems.length;
        const appended = mealTemplates.map((t: any, idx: number) => ({
          meal_template_id: t.id,
          food_name: t.name,
          quantity: t.serving_size || null,
          calories: t.calories || null,
          protein: t.protein || null,
          carbs: t.carbs || null,
          fats: t.fats || null,
          fiber: t.fiber || null,
          sugar: t.sugar || null,
          sodium: t.sodium || null,
          item_order: startOrder + idx,
        }));
        return {
          ...s,
          items: [...existingItems, ...appended],
        };
      });
      const created = await updateCalendarEntrySessions(updatedSessions);
      const updated = created.entry?.sessions?.find((s: any) => s.id === sessionData.id);
      if (updated) {
        setSessionData(updated);
      }
    } catch (error) {
      console.error("Failed to add items:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (item: any) => {
    if (!sessionData) return;
    if (!confirm("Delete this item?")) return;
    setLoading(true);
    try {
      const entryRes = await dietApi.getCalendarEntry(date, selectedClient || undefined);
      const entry = entryRes.entry;
      const updatedSessions = (entry?.sessions || []).map((s: any) => {
        if (s.id !== sessionData.id) return s;
        const remaining = (s.items || []).filter((i: any) => i.id !== item.id);
        return {
          ...s,
          items: remaining.map((row: any, idx: number) => ({ ...row, item_order: idx })),
        };
      });
      const created = await updateCalendarEntrySessions(updatedSessions);
      const updated = created.entry?.sessions?.find((s: any) => s.id === sessionData.id);
      if (updated) setSessionData(updated);
    } catch (error) {
      console.error("Failed to delete item:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleItem = async (item: any, completed: boolean) => {
    if (!sessionData) return;
    setLoading(true);
    try {
      const trackingData = {
        calendar_entry_id: sessionData.calendar_entry_id,
        calendar_meal_id: sessionData.id,
        calendar_meal_item_id: item.id,
        tracked_date: date,
        completion_status: completed ? "completed" : "pending",
        completed_quantity: item.quantity || null,
        completed_calories: item.calories || null,
        completed_protein: item.protein || null,
        completed_carbs: item.carbs || null,
        completed_fats: item.fats || null,
        notes,
        pictures: pictures.length > 0 ? pictures : null,
        client_id: selectedClient || undefined,
      };

      const existingTracking = itemTracking[item.id];
      if (existingTracking) {
        await dietApi.updateTracking(existingTracking.id, trackingData);
      } else {
        await dietApi.createTracking(trackingData);
      }

      await fetchTracking();
      onComplete && onComplete();
    } catch (error) {
      console.error("Failed to update item tracking:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!sessionData) return;
    setLoading(true);
    try {
      const trackingData = {
        calendar_entry_id: sessionData.calendar_entry_id,
        calendar_meal_id: sessionData.id,
        tracked_date: date,
        notes,
        pictures: pictures.length > 0 ? pictures : null,
        client_id: selectedClient || undefined,
      };

      if (sessionTracking?.id) {
        await dietApi.updateTracking(sessionTracking.id, trackingData);
      } else {
        await dietApi.createTracking(trackingData);
      }

      await fetchTracking();
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

  if (!sessionData) {
    return (
      <div className="card p-4">
        <p className="text-sm text-gray-400">No meal session selected</p>
      </div>
    );
  }

  if (showMealLibrary) {
    return (
      <MealLibrary
        selectedClient={selectedClient}
        onSelectMultiple={handleAddItems}
      />
    );
  }

  const items = sessionData.items || [];

  return (
    <div className="space-y-4 overflow-x-hidden">
      <div className="card p-4">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{sessionData.session_name}</h2>
            <p className="text-xs text-gray-400">{new Date(date).toLocaleDateString()}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!readOnly && (
              <button onClick={() => setShowMealLibrary(true)} className="btn-primary flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Items
              </button>
            )}
            {!readOnly && (
              <button onClick={handleAddSessionAdhoc} className="btn-secondary">
                + Session
              </button>
            )}
            {!readOnly && (
              <button onClick={handleDeleteSession} className="btn-secondary">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card p-4">
          <p className="text-sm text-gray-400">No items added yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item: any, idx: number) => {
            const track = itemTracking[item.id];
            const isCompleted = track?.completion_status === "completed";
            return (
              <div key={item.id || idx} className="card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {!readOnly && (
                      <button
                        onClick={() => handleToggleItem(item, !isCompleted)}
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
                      <h3 className="font-semibold">{item.food_name}</h3>
                      {item.quantity && (
                        <p className="text-xs text-gray-400">Quantity: {item.quantity}</p>
                      )}
                      <div className="flex gap-3 text-xs text-gray-400 mt-1">
                        {item.calories && <span>{item.calories} cal</span>}
                        {item.protein && <span>{item.protein}g protein</span>}
                        {item.carbs && <span>{item.carbs}g carbs</span>}
                        {item.fats && <span>{item.fats}g fats</span>}
                      </div>
                    </div>
                  </div>
                  {!readOnly && (
                    <button onClick={() => handleDeleteItem(item)} className="btn-secondary p-2">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Notes & Photos</h3>
          {!readOnly && (
            <button onClick={handleSaveNotes} className="btn-secondary">
              Save
            </button>
          )}
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="input-field w-full"
          rows={3}
          placeholder="Session notes..."
          readOnly={readOnly}
        />
        <div className="flex items-center gap-2">
          {!readOnly && (
            <button onClick={handleAddPicture} className="btn-secondary flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Add Photo
            </button>
          )}
        </div>
        {pictures.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {pictures.map((url, index) => (
              <div key={index} className="relative">
                <img src={url} alt={`Meal ${index + 1}`} className="w-full h-24 object-cover rounded-lg" />
                {!readOnly && (
                  <button
                    onClick={() => handleRemovePicture(index)}
                    className="absolute top-1 right-1 bg-black/60 rounded-full p-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionDetail;
