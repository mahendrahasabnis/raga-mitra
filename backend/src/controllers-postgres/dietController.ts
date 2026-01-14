import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { QueryTypes } from 'sequelize';

const getAppSequelize = async () => {
  const db = await import('../config/database-integrated');
  return db.appSequelize;
};

// ========== WEEKLY TEMPLATES ==========

export const getWeekTemplates = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.query.client_id;
  const targetUserId = clientId || userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    const sequelize = await getAppSequelize();
    const [rows]: any = await sequelize.query(
      `SELECT * FROM diet_week_templates WHERE patient_user_id = :userId ORDER BY created_at DESC`,
      { replacements: { userId: targetUserId }, type: QueryTypes.SELECT }
    );
    return res.json({ templates: rows || [] });
  } catch (err: any) {
    console.error('❌ [DIET] getWeekTemplates error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const getWeekTemplate = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    const sequelize = await getAppSequelize();
    const { id } = req.params;
    
    // Get template
    const [templateRows]: any = await sequelize.query(
      `SELECT * FROM diet_week_templates WHERE id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    
    if (templateRows.length === 0) {
      return res.status(404).json({ message: 'Not found' });
    }
    
    const template = templateRows[0];
    
    // Get days with meals and items
    const [days]: any = await sequelize.query(
      `SELECT * FROM diet_template_days WHERE week_template_id = :id ORDER BY day_of_week ASC`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    
    for (const day of days) {
      const [meals]: any = await sequelize.query(
        `SELECT * FROM diet_meal_sessions WHERE template_day_id = :dayId ORDER BY meal_order ASC`,
        { replacements: { dayId: day.id }, type: QueryTypes.SELECT }
      );
      
      for (const meal of meals) {
        const [items]: any = await sequelize.query(
          `SELECT * FROM diet_meal_items WHERE meal_session_id = :mealId ORDER BY item_order ASC`,
          { replacements: { mealId: meal.id }, type: QueryTypes.SELECT }
        );
        meal.items = items || [];
      }
      
      day.meals = meals || [];
    }
    
    template.days = days || [];
    
    return res.json({ template });
  } catch (err: any) {
    console.error('❌ [DIET] getWeekTemplate error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const createWeekTemplate = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.body.client_id;
  const targetUserId = clientId || userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    const sequelize = await getAppSequelize();
    const { name, description, days = [] } = req.body || {};
    
    if (!name) {
      return res.status(400).json({ message: 'name is required' });
    }
    
    const templateId = uuidv4();
    
    // Create template
    await sequelize.query(
      `INSERT INTO diet_week_templates (id, patient_user_id, name, description, is_active)
       VALUES (:id, :userId, :name, :description, TRUE)`,
      {
        replacements: {
          id: templateId,
          userId: targetUserId,
          name,
          description: description || null,
        },
        type: QueryTypes.INSERT,
      }
    );
    
    // Create days with meals and items
    for (const dayData of days) {
      const dayId = uuidv4();
      await sequelize.query(
        `INSERT INTO diet_template_days (id, week_template_id, day_of_week, notes)
         VALUES (:id, :templateId, :dayOfWeek, :notes)`,
        {
          replacements: {
            id: dayId,
            templateId,
            dayOfWeek: dayData.day_of_week,
            notes: dayData.notes || null,
          },
          type: QueryTypes.INSERT,
        }
      );
      
      if (dayData.meals && Array.isArray(dayData.meals)) {
        for (const mealData of dayData.meals) {
          const mealId = uuidv4();
          await sequelize.query(
            `INSERT INTO diet_meal_sessions (id, template_day_id, meal_type, meal_order, notes)
             VALUES (:id, :dayId, :mealType, :mealOrder, :notes)`,
            {
              replacements: {
                id: mealId,
                dayId,
                mealType: mealData.meal_type,
                mealOrder: mealData.meal_order || 0,
                notes: mealData.notes || null,
              },
              type: QueryTypes.INSERT,
            }
          );
          
          if (mealData.items && Array.isArray(mealData.items)) {
            for (const itemData of mealData.items) {
              await sequelize.query(
                `INSERT INTO diet_meal_items (id, meal_session_id, food_name, quantity, calories, protein, carbs, fats, fiber, item_order, notes)
                 VALUES (:id, :mealId, :foodName, :quantity, :calories, :protein, :carbs, :fats, :fiber, :itemOrder, :notes)`,
                {
                  replacements: {
                    id: uuidv4(),
                    mealId,
                    foodName: itemData.food_name,
                    quantity: itemData.quantity || null,
                    calories: itemData.calories || null,
                    protein: itemData.protein || null,
                    carbs: itemData.carbs || null,
                    fats: itemData.fats || null,
                    fiber: itemData.fiber || null,
                    itemOrder: itemData.item_order || 0,
                    notes: itemData.notes || null,
                  },
                  type: QueryTypes.INSERT,
                }
              );
            }
          }
        }
      }
    }
    
    // Return full template
    const fakeReq: any = { user: { id: userId }, params: { id: templateId } };
    const collector: any = { json: (data: any) => res.json(data) };
    return await getWeekTemplate(fakeReq, collector);
  } catch (err: any) {
    console.error('❌ [DIET] createWeekTemplate error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const updateWeekTemplate = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    const sequelize = await getAppSequelize();
    const { id } = req.params;
    const { name, description, is_active } = req.body || {};
    
    const updates: string[] = [];
    const params: any = { id };
    
    if (name !== undefined) {
      updates.push('name = :name');
      params.name = name;
    }
    if (description !== undefined) {
      updates.push('description = :description');
      params.description = description;
    }
    if (is_active !== undefined) {
      updates.push('is_active = :isActive');
      params.isActive = is_active;
    }
    
    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      const sql = `UPDATE diet_week_templates SET ${updates.join(', ')} WHERE id = :id RETURNING *`;
      const [rows]: any = await sequelize.query(sql, { replacements: params, type: QueryTypes.UPDATE });
      
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Not found' });
      }
    }
    
    // Return full template
    const fakeReq: any = { user: { id: userId }, params: { id } };
    const collector: any = { json: (data: any) => res.json(data) };
    return await getWeekTemplate(fakeReq, collector);
  } catch (err: any) {
    console.error('❌ [DIET] updateWeekTemplate error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

// ========== CALENDAR ENTRIES ==========

export const getCalendarEntries = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.query.client_id;
  const targetUserId = clientId || userId;
  const startDate = req.query.start_date;
  const endDate = req.query.end_date;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    const sequelize = await getAppSequelize();
    let sql = `SELECT * FROM diet_calendar_entries WHERE patient_user_id = :userId`;
    const params: any = { userId: targetUserId };
    
    if (startDate) {
      sql += ` AND date >= :startDate`;
      params.startDate = startDate;
    }
    if (endDate) {
      sql += ` AND date <= :endDate`;
      params.endDate = endDate;
    }
    
    sql += ` ORDER BY date ASC`;
    
    const [rows]: any = await sequelize.query(sql, { replacements: params, type: QueryTypes.SELECT });
    
    // Get meals for each entry
    for (const entry of rows) {
      const [meals]: any = await sequelize.query(
        `SELECT * FROM diet_calendar_meals WHERE calendar_entry_id = :entryId ORDER BY meal_order ASC`,
        { replacements: { entryId: entry.id }, type: QueryTypes.SELECT }
      );
      
      for (const meal of meals) {
        const [items]: any = await sequelize.query(
          `SELECT * FROM diet_calendar_meal_items WHERE calendar_meal_id = :mealId ORDER BY item_order ASC`,
          { replacements: { mealId: meal.id }, type: QueryTypes.SELECT }
        );
        meal.items = items || [];
      }
      
      entry.meals = meals || [];
    }
    
    return res.json({ entries: rows || [] });
  } catch (err: any) {
    console.error('❌ [DIET] getCalendarEntries error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const getCalendarEntry = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    const sequelize = await getAppSequelize();
    const { date } = req.params;
    
    const [rows]: any = await sequelize.query(
      `SELECT * FROM diet_calendar_entries WHERE patient_user_id = :userId AND date = :date`,
      { replacements: { userId, date }, type: QueryTypes.SELECT }
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Not found' });
    }
    
    const entry = rows[0];
    
    // Get meals
    const [meals]: any = await sequelize.query(
      `SELECT * FROM diet_calendar_meals WHERE calendar_entry_id = :entryId ORDER BY meal_order ASC`,
      { replacements: { entryId: entry.id }, type: QueryTypes.SELECT }
    );
    
    for (const meal of meals) {
      const [items]: any = await sequelize.query(
        `SELECT * FROM diet_calendar_meal_items WHERE calendar_meal_id = :mealId ORDER BY item_order ASC`,
        { replacements: { mealId: meal.id }, type: QueryTypes.SELECT }
      );
      meal.items = items || [];
    }
    
    entry.meals = meals || [];
    
    return res.json({ entry });
  } catch (err: any) {
    console.error('❌ [DIET] getCalendarEntry error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const createCalendarEntry = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.body.client_id;
  const targetUserId = clientId || userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    const sequelize = await getAppSequelize();
    const { date, week_template_id, template_day_id, is_override, notes, meals = [] } = req.body || {};
    
    if (!date) {
      return res.status(400).json({ message: 'date is required' });
    }
    
    const entryId = uuidv4();
    
    // Create or update entry
    await sequelize.query(
      `INSERT INTO diet_calendar_entries (id, patient_user_id, date, week_template_id, template_day_id, is_override, notes)
       VALUES (:id, :userId, :date, :weekTemplateId, :templateDayId, :isOverride, :notes)
       ON CONFLICT (patient_user_id, date) DO UPDATE SET
         week_template_id = EXCLUDED.week_template_id,
         template_day_id = EXCLUDED.template_day_id,
         is_override = EXCLUDED.is_override,
         notes = EXCLUDED.notes,
         updated_at = NOW()
       RETURNING *`,
      {
        replacements: {
          id: entryId,
          userId: targetUserId,
          date,
          weekTemplateId: week_template_id || null,
          templateDayId: template_day_id || null,
          isOverride: is_override || false,
          notes: notes || null,
        },
        type: QueryTypes.INSERT,
      }
    );
    
    // Delete existing meals if override
    if (is_override && meals.length > 0) {
      await sequelize.query(
        `DELETE FROM diet_calendar_meals WHERE calendar_entry_id = :entryId`,
        { replacements: { entryId }, type: QueryTypes.DELETE }
      );
    }
    
    // Create meals
    for (const mealData of meals) {
      const mealId = uuidv4();
      await sequelize.query(
        `INSERT INTO diet_calendar_meals (id, calendar_entry_id, meal_type, meal_order, notes)
         VALUES (:id, :entryId, :mealType, :mealOrder, :notes)`,
        {
          replacements: {
            id: mealId,
            entryId,
            mealType: mealData.meal_type,
            mealOrder: mealData.meal_order || 0,
            notes: mealData.notes || null,
          },
          type: QueryTypes.INSERT,
        }
      );
      
      if (mealData.items && Array.isArray(mealData.items)) {
        for (const itemData of mealData.items) {
          await sequelize.query(
            `INSERT INTO diet_calendar_meal_items (id, calendar_meal_id, food_name, quantity, calories, protein, carbs, fats, fiber, item_order, notes)
             VALUES (:id, :mealId, :foodName, :quantity, :calories, :protein, :carbs, :fats, :fiber, :itemOrder, :notes)`,
            {
              replacements: {
                id: uuidv4(),
                mealId,
                foodName: itemData.food_name,
                quantity: itemData.quantity || null,
                calories: itemData.calories || null,
                protein: itemData.protein || null,
                carbs: itemData.carbs || null,
                fats: itemData.fats || null,
                fiber: itemData.fiber || null,
                itemOrder: itemData.item_order || 0,
                notes: itemData.notes || null,
              },
              type: QueryTypes.INSERT,
            }
          );
        }
      }
    }
    
    // Return full entry
    const fakeReq: any = { user: { id: userId }, params: { date } };
    const collector: any = { json: (data: any) => res.json(data) };
    return await getCalendarEntry(fakeReq, collector);
  } catch (err: any) {
    console.error('❌ [DIET] createCalendarEntry error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

// ========== TRACKING ==========

export const getTracking = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.query.client_id;
  const targetUserId = clientId || userId;
  const startDate = req.query.start_date;
  const endDate = req.query.end_date;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    const sequelize = await getAppSequelize();
    let sql = `SELECT * FROM diet_tracking WHERE patient_user_id = :userId`;
    const params: any = { userId: targetUserId };
    
    if (startDate) {
      sql += ` AND tracked_date >= :startDate`;
      params.startDate = startDate;
    }
    if (endDate) {
      sql += ` AND tracked_date <= :endDate`;
      params.endDate = endDate;
    }
    
    sql += ` ORDER BY tracked_date DESC, tracked_at DESC`;
    
    const [rows]: any = await sequelize.query(sql, { replacements: params, type: QueryTypes.SELECT });
    return res.json({ tracking: rows || [] });
  } catch (err: any) {
    console.error('❌ [DIET] getTracking error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const createTracking = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.body.client_id;
  const targetUserId = clientId || userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    const sequelize = await getAppSequelize();
    const {
      calendar_entry_id, calendar_meal_id, calendar_meal_item_id,
      tracked_date, completion_status, actual_quantity, notes, pictures, rating
    } = req.body || {};
    
    if (!tracked_date) {
      return res.status(400).json({ message: 'tracked_date is required' });
    }
    
    const [rows]: any = await sequelize.query(
      `INSERT INTO diet_tracking (id, patient_user_id, calendar_entry_id, calendar_meal_id, calendar_meal_item_id, tracked_date, completion_status, actual_quantity, notes, pictures, rating)
       VALUES (:id, :userId, :entryId, :mealId, :itemId, :trackedDate, :status, :actualQuantity, :notes, :pictures::text[], :rating)
       RETURNING *`,
      {
        replacements: {
          id: uuidv4(),
          userId: targetUserId,
          entryId: calendar_entry_id || null,
          mealId: calendar_meal_id || null,
          itemId: calendar_meal_item_id || null,
          trackedDate: tracked_date,
          status: completion_status || 'pending',
          actualQuantity: actual_quantity || null,
          notes: notes || null,
          pictures: pictures ? JSON.stringify(pictures) : null,
          rating: rating || null,
        },
        type: QueryTypes.INSERT,
      }
    );
    
    return res.json({ tracking: Array.isArray(rows) ? rows[0] : rows });
  } catch (err: any) {
    console.error('❌ [DIET] createTracking error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const updateTracking = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    const sequelize = await getAppSequelize();
    const { id } = req.params;
    const updates = req.body || {};
    
    const updateFields: string[] = [];
    const params: any = { id, userId };
    
    Object.keys(updates).forEach((key) => {
      if (key !== 'id' && updates[key] !== undefined) {
        const dbKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        if (key === 'pictures') {
          updateFields.push(`${dbKey} = :${key}::text[]`);
          params[key] = JSON.stringify(updates[key]);
        } else {
          updateFields.push(`${dbKey} = :${key}`);
          params[key] = updates[key];
        }
      }
    });
    
    if (updateFields.length === 0) {
      return res.json({ message: 'No updates provided' });
    }
    
    updateFields.push('updated_at = NOW()');
    
    const sql = `UPDATE diet_tracking SET ${updateFields.join(', ')} WHERE id = :id AND patient_user_id = :userId RETURNING *`;
    const [rows]: any = await sequelize.query(sql, { replacements: params, type: QueryTypes.UPDATE });
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Not found' });
    }
    
    return res.json({ tracking: rows[0] });
  } catch (err: any) {
    console.error('❌ [DIET] updateTracking error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

// ========== AD-HOC ENTRIES ==========

export const getAdHocEntries = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.query.client_id;
  const targetUserId = clientId || userId;
  const startDate = req.query.start_date;
  const endDate = req.query.end_date;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    const sequelize = await getAppSequelize();
    let sql = `SELECT * FROM diet_ad_hoc_entries WHERE patient_user_id = :userId`;
    const params: any = { userId: targetUserId };
    
    if (startDate) {
      sql += ` AND entry_date >= :startDate`;
      params.startDate = startDate;
    }
    if (endDate) {
      sql += ` AND entry_date <= :endDate`;
      params.endDate = endDate;
    }
    
    sql += ` ORDER BY entry_date DESC, entry_time DESC`;
    
    const [rows]: any = await sequelize.query(sql, { replacements: params, type: QueryTypes.SELECT });
    return res.json({ entries: rows || [] });
  } catch (err: any) {
    console.error('❌ [DIET] getAdHocEntries error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const createAdHocEntry = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.body.client_id;
  const targetUserId = clientId || userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    const sequelize = await getAppSequelize();
    const {
      entry_date, entry_time, meal_type, food_name, quantity,
      calories, protein, carbs, fats, fiber, notes, pictures
    } = req.body || {};
    
    if (!entry_date || !food_name) {
      return res.status(400).json({ message: 'entry_date and food_name are required' });
    }
    
    const [rows]: any = await sequelize.query(
      `INSERT INTO diet_ad_hoc_entries (id, patient_user_id, entry_date, entry_time, meal_type, food_name, quantity, calories, protein, carbs, fats, fiber, notes, pictures)
       VALUES (:id, :userId, :entryDate, :entryTime, :mealType, :foodName, :quantity, :calories, :protein, :carbs, :fats, :fiber, :notes, :pictures::text[])
       RETURNING *`,
      {
        replacements: {
          id: uuidv4(),
          userId: targetUserId,
          entryDate: entry_date,
          entryTime: entry_time || null,
          mealType: meal_type || null,
          foodName: food_name,
          quantity: quantity || null,
          calories: calories || null,
          protein: protein || null,
          carbs: carbs || null,
          fats: fats || null,
          fiber: fiber || null,
          notes: notes || null,
          pictures: pictures ? JSON.stringify(pictures) : null,
        },
        type: QueryTypes.INSERT,
      }
    );
    
    return res.json({ entry: Array.isArray(rows) ? rows[0] : rows });
  } catch (err: any) {
    console.error('❌ [DIET] createAdHocEntry error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const updateAdHocEntry = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    const sequelize = await getAppSequelize();
    const { id } = req.params;
    const updates = req.body || {};
    
    const updateFields: string[] = [];
    const params: any = { id, userId };
    
    Object.keys(updates).forEach((key) => {
      if (key !== 'id' && updates[key] !== undefined) {
        const dbKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        if (key === 'pictures') {
          updateFields.push(`${dbKey} = :${key}::text[]`);
          params[key] = JSON.stringify(updates[key]);
        } else {
          updateFields.push(`${dbKey} = :${key}`);
          params[key] = updates[key];
        }
      }
    });
    
    if (updateFields.length === 0) {
      return res.json({ message: 'No updates provided' });
    }
    
    updateFields.push('updated_at = NOW()');
    
    const sql = `UPDATE diet_ad_hoc_entries SET ${updateFields.join(', ')} WHERE id = :id AND patient_user_id = :userId RETURNING *`;
    const [rows]: any = await sequelize.query(sql, { replacements: params, type: QueryTypes.UPDATE });
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Not found' });
    }
    
    return res.json({ entry: rows[0] });
  } catch (err: any) {
    console.error('❌ [DIET] updateAdHocEntry error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const deleteAdHocEntry = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    const sequelize = await getAppSequelize();
    const { id } = req.params;
    
    const [rows]: any = await sequelize.query(
      `DELETE FROM diet_ad_hoc_entries WHERE id = :id AND patient_user_id = :userId RETURNING *`,
      { replacements: { id, userId }, type: QueryTypes.DELETE }
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Not found' });
    }
    
    return res.json({ message: 'Deleted successfully' });
  } catch (err: any) {
    console.error('❌ [DIET] deleteAdHocEntry error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

// ========== PROGRESS & STATS ==========

export const getProgress = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.query.client_id;
  const targetUserId = clientId || userId;
  const startDate = req.query.start_date || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = req.query.end_date || new Date().toISOString().split('T')[0];
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    const sequelize = await getAppSequelize();
    
    // Get completion stats
    const [stats]: any = await sequelize.query(
      `SELECT 
        COUNT(*) FILTER (WHERE completion_status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE completion_status = 'skipped') as skipped_count,
        COUNT(*) FILTER (WHERE completion_status = 'partial') as partial_count,
        COUNT(*) as total_count
       FROM diet_tracking
       WHERE patient_user_id = :userId AND tracked_date >= :startDate AND tracked_date <= :endDate`,
      {
        replacements: { userId: targetUserId, startDate, endDate },
        type: QueryTypes.SELECT,
      }
    );
    
    // Get macros summary (stub - aggregate from tracking/entries)
    const [macros]: any = await sequelize.query(
      `SELECT 
        COALESCE(SUM(calories), 0) as total_calories,
        COALESCE(SUM(protein), 0) as total_protein,
        COALESCE(SUM(carbs), 0) as total_carbs,
        COALESCE(SUM(fats), 0) as total_fats
       FROM diet_ad_hoc_entries
       WHERE patient_user_id = :userId AND entry_date >= :startDate AND entry_date <= :endDate`,
      {
        replacements: { userId: targetUserId, startDate, endDate },
        type: QueryTypes.SELECT,
      }
    );
    
    return res.json({
      stats: stats || { completed_count: 0, skipped_count: 0, partial_count: 0, total_count: 0 },
      macros: macros || { total_calories: 0, total_protein: 0, total_carbs: 0, total_fats: 0 },
      period: { start_date: startDate, end_date: endDate },
    });
  } catch (err: any) {
    console.error('❌ [DIET] getProgress error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};
