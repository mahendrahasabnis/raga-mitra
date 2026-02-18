import React, { useState, useEffect } from "react";
import { CheckCircle2, Circle, Camera, X, Plus, Trash2, MinusCircle } from "lucide-react";
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
  const [actualQuantityByItem, setActualQuantityByItem] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [pictures, setPictures] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showMealLibrary, setShowMealLibrary] = useState(false);
  const readOnly = !!selectedClient;

  useEffect(() => {
    const items = sessionData?.items || [];
    setActualQuantityByItem((prev) => {
      const next = { ...prev };
      items.forEach((item: any) => {
        const saved = itemTracking[item.id]?.completed_quantity;
        if (saved != null && String(saved).trim() !== "") next[item.id] = String(saved);
      });
      return next;
    });
  }, [sessionData?.items, itemTracking]);

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

  const upsertSessionCompletion = async (status: "completed" | "partial" | "skipped") => {
    if (!sessionData) return;
    setLoading(true);
    try {
      const trackingData = {
        calendar_entry_id: sessionData.calendar_entry_id,
        calendar_meal_id: sessionData.id,
        tracked_date: date,
        completion_status: status,
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
      onComplete && onComplete();
    } catch (error) {
      console.error("Failed to save session status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetItemStatus = async (
    item: any,
    status: "completed" | "skipped" | "pending",
    completedQuantity?: string | null
  ) => {
    if (!sessionData) return;
    setLoading(true);
    try {
      const qty =
        completedQuantity !== undefined && completedQuantity !== null
          ? (completedQuantity.trim() || null)
          : (actualQuantityByItem[item.id]?.trim() || item.quantity || null);
      const trackingData = {
        calendar_entry_id: sessionData.calendar_entry_id,
        calendar_meal_id: sessionData.id,
        calendar_meal_item_id: item.id,
        tracked_date: date,
        completion_status: status === "pending" ? "pending" : status,
        completed_quantity: qty,
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

  const saveActualQuantity = (item: any, value: string) => {
    const status = (itemTracking[item.id]?.completion_status || "pending") as "completed" | "skipped" | "pending";
    handleSetItemStatus(item, status, value);
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
  const sessionStatus = sessionTracking?.completion_status;
  const completedItems = items.filter((i: any) => itemTracking[i.id]?.completion_status === "completed").length;
  const skippedItems = items.filter((i: any) => itemTracking[i.id]?.completion_status === "skipped").length;
  const isSessionCompleted =
    sessionStatus === "completed" ||
    (items.length > 0 && completedItems === items.length);
  const isSessionPartial =
    sessionStatus === "partial" ||
    (items.length > 0 && completedItems > 0 && completedItems + skippedItems < items.length);
  const isSessionSkipped = sessionStatus === "skipped";
  const statusLabel = isSessionCompleted
    ? "Completed"
    : isSessionSkipped
      ? "Skipped"
      : isSessionPartial
        ? "Partial"
        : "Not started";

  return (
    <div className="space-y-4 overflow-x-hidden">
      <div className="card p-4">
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold">{sessionData.session_name}</h2>
              <p className="text-sm text-gray-400">{new Date(date).toLocaleDateString()}</p>
            </div>
            <div
              className={`flex items-center gap-2 ${
                isSessionCompleted
                  ? "text-emerald-300"
                  : isSessionSkipped
                    ? "text-amber-300"
                    : isSessionPartial
                      ? "text-blue-300"
                      : "text-gray-400"
              }`}
            >
              {isSessionCompleted ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : isSessionSkipped ? (
                <MinusCircle className="h-4 w-4" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
              <span className="text-sm font-medium">{statusLabel}</span>
            </div>
          </div>
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => upsertSessionCompletion("completed")}
                className={`btn-secondary text-xs ${sessionStatus === "completed" ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/40" : ""}`}
                disabled={loading}
              >
                Mark Completed
              </button>
              <button
                onClick={() => upsertSessionCompletion("partial")}
                className={`btn-secondary text-xs ${sessionStatus === "partial" ? "bg-blue-500/20 text-blue-200 border-blue-400/40" : ""}`}
                disabled={loading}
              >
                Partial
              </button>
              <button
                onClick={() => upsertSessionCompletion("skipped")}
                className={`btn-secondary text-xs ${sessionStatus === "skipped" ? "bg-amber-500/20 text-amber-200 border-amber-400/40" : ""}`}
                disabled={loading}
              >
                Skipped
              </button>
            </div>
          )}
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
        <div className="card p-4">
          <h3 className="font-semibold mb-3">Planned vs Actual</h3>
          <div className="space-y-3">
            {items.map((item: any, idx: number) => {
              const track = itemTracking[item.id];
              const status = track?.completion_status || "pending";
              const isCompleted = status === "completed";
              const isSkipped = status === "skipped";
              const actualQty = actualQuantityByItem[item.id] ?? track?.completed_quantity ?? "";
              const cycleStatus = () => {
                const nextStatus =
                  status === "pending" ? "completed" : status === "completed" ? "skipped" : "pending";
                handleSetItemStatus(item, nextStatus, actualQty.trim() || undefined);
              };
              return (
                <div key={item.id || idx} className="p-3 bg-white/5 rounded-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={cycleStatus}
                          disabled={loading}
                          className="mt-0.5 shrink-0"
                          title="Tap: Done → Skip → Pending"
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                          ) : isSkipped ? (
                            <MinusCircle className="h-5 w-5 text-amber-400" />
                          ) : (
                            <Circle className="h-5 w-5 text-gray-400" />
                          )}
                        </button>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Planned</div>
                        <h4 className="font-medium">{item.food_name}</h4>
                        {item.quantity && (
                          <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                        )}
                        <div className="flex flex-wrap gap-3 text-xs text-gray-400 mt-1">
                          {item.calories != null && <span>{item.calories} cal</span>}
                          {item.protein != null && <span>{item.protein}g P</span>}
                          {item.carbs != null && <span>{item.carbs}g C</span>}
                          {item.fats != null && <span>{item.fats}g F</span>}
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          <span className="uppercase tracking-wide">Actual </span>
                          <span className={isCompleted ? "text-emerald-400" : isSkipped ? "text-amber-400" : "text-gray-400"}>
                            {isCompleted ? "Done" : isSkipped ? "Skipped" : "—"}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <label className="text-xs text-gray-500 whitespace-nowrap">Actual qty:</label>
                          {readOnly ? (
                            <span className="text-sm">{track?.completed_quantity || "—"}</span>
                          ) : (
                            <input
                              type="text"
                              value={actualQty}
                              onChange={(e) =>
                                setActualQuantityByItem((prev) => ({ ...prev, [item.id]: e.target.value }))
                              }
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (v !== (track?.completed_quantity ?? "")) saveActualQuantity(item, v);
                              }}
                              placeholder={item.quantity || "e.g. 1 cup"}
                              className="input-field text-sm py-1 px-2 flex-1 max-w-[140px]"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item)}
                        className="btn-secondary p-2 shrink-0"
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
