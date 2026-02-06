import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { QueryTypes } from 'sequelize';
import ExcelJS from 'exceljs';

const getAppSequelize = async () => {
  const db = await import('../config/database-integrated');
  return db.appSequelize;
};

const ensureDietTablesReady = async () => {
  const { ensureDietTables } = await import('../utils/ensureDietTables');
  await ensureDietTables();
  const { ensurePatientResources } = await import('../utils/ensurePatientResources');
  await ensurePatientResources();
};

const normalizeExcelValue = (value: any) => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('result' in value) return value.result;
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part: any) => part.text || '').join('');
    }
  }
  return value;
};

const parseExcelBuffer = async (buffer: Buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    const rawHeader = normalizeExcelValue(cell.value);
    const header = rawHeader ? String(rawHeader).trim() : '';
    headers[colNumber - 1] = header;
  });
  const rows: any[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: any = {};
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (!header) return;
      const value = normalizeExcelValue(cell.value);
      if (value !== null && value !== undefined && `${value}`.trim() !== '') {
        obj[header] = value;
      }
    });
    if (Object.keys(obj).length > 0) rows.push(obj);
  });
  return rows;
};

// ========== MEAL TEMPLATES (Library) ==========

export const getMealTemplates = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.query.client_id;
  const targetUserId = clientId || userId;
  const { category, library_type } = req.query;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const sequelize = await getAppSequelize();
    await ensureDietTablesReady();

    const trainerResources: any = await sequelize.query(
      `SELECT resource_user_id, resource_name FROM patient_resources 
       WHERE patient_user_id = :userId AND access_diet = TRUE`,
      { replacements: { userId: targetUserId }, type: QueryTypes.SELECT }
    );
    const trainerIds = Array.isArray(trainerResources) ? trainerResources.map((r: any) => r.resource_user_id) : [];

    let sql = '';
    const params: any = { targetUserId };

    if (library_type === 'own') {
      sql = `SELECT *, 'own' as library_source, NULL as dietitian_name FROM diet_meal_templates 
             WHERE is_active = TRUE AND created_by = :targetUserId`;
    } else if (library_type === 'dietitian') {
      if (trainerIds.length === 0) {
        return res.json({ templates: [], dietitians: [] });
      }
      sql = `SELECT mt.*, 'dietitian' as library_source, pr.resource_name as dietitian_name 
             FROM diet_meal_templates mt
             JOIN patient_resources pr ON mt.created_by = pr.resource_user_id
             WHERE mt.is_active = TRUE 
             AND mt.created_by IN (SELECT resource_user_id FROM patient_resources WHERE patient_user_id = :targetUserId AND access_diet = TRUE)
             AND pr.patient_user_id = :targetUserId
             AND pr.access_diet = TRUE`;
    } else {
      if (trainerIds.length === 0) {
        sql = `SELECT *, 'own' as library_source, NULL as dietitian_name FROM diet_meal_templates 
               WHERE is_active = TRUE AND created_by = :targetUserId`;
      } else {
        sql = `SELECT * FROM (
          SELECT mt.*, 'own' as library_source, NULL::VARCHAR as dietitian_name
          FROM diet_meal_templates mt
          WHERE mt.is_active = TRUE AND mt.created_by = :targetUserId
          UNION ALL
          SELECT mt.*, 'dietitian' as library_source, pr.resource_name as dietitian_name
          FROM diet_meal_templates mt
          JOIN patient_resources pr ON mt.created_by = pr.resource_user_id
          WHERE mt.is_active = TRUE 
          AND mt.created_by IN (SELECT resource_user_id FROM patient_resources WHERE patient_user_id = :targetUserId AND access_diet = TRUE)
          AND pr.patient_user_id = :targetUserId
          AND pr.access_diet = TRUE
        ) combined`;
      }
    }

    if (category) {
      if (sql.includes('UNION ALL')) {
        sql = sql.replace(
          `WHERE mt.is_active = TRUE AND mt.created_by = :targetUserId`,
          `WHERE mt.is_active = TRUE AND mt.created_by = :targetUserId AND mt.category = :category`
        );
        sql = sql.replace(
          `WHERE mt.is_active = TRUE`,
          `WHERE mt.is_active = TRUE AND mt.category = :category`
        );
        params.category = category;
      } else {
        sql += ` AND category = :category`;
        params.category = category;
      }
    }

    sql += ` ORDER BY library_source, name ASC`;
    const rows: any = await sequelize.query(sql, { replacements: params, type: QueryTypes.SELECT });

    const dietitians = Array.isArray(trainerResources) ? trainerResources.map((r: any) => ({
      id: r.resource_user_id,
      name: r.resource_name
    })) : [];

    return res.json({ templates: rows || [], dietitians });
  } catch (err: any) {
    console.error('❌ [DIET] getMealTemplates error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const getMealTemplate = async (req: any, res: Response) => {
  try {
    const sequelize = await getAppSequelize();
    await ensureDietTablesReady();
    const { id } = req.params;
    const rows: any = await sequelize.query(
      `SELECT * FROM diet_meal_templates WHERE id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: 'Not found' });
    }
    return res.json({ template: rows[0] });
  } catch (err: any) {
    console.error('❌ [DIET] getMealTemplate error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const createMealTemplate = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const sequelize = await getAppSequelize();
    const {
      name,
      description,
      category,
      meal_type,
      cuisine,
      diet_type,
      serving_size,
      calories,
      protein,
      carbs,
      fats,
      fiber,
      sugar,
      sodium,
      ingredients,
      instructions,
      image_url,
      document_url,
    } = req.body || {};

    if (!name) {
      return res.status(400).json({ message: 'name is required' });
    }

    const [rows]: any = await sequelize.query(
      `INSERT INTO diet_meal_templates (id, name, description, category, meal_type, cuisine, diet_type, serving_size, calories, protein, carbs, fats, fiber, sugar, sodium, ingredients, instructions, image_url, document_url, created_by, is_active)
       VALUES (:id, :name, :description, :category, :mealType, :cuisine, :dietType, :servingSize, :calories, :protein, :carbs, :fats, :fiber, :sugar, :sodium, :ingredients, :instructions, :imageUrl, :documentUrl, :createdBy, TRUE)
       RETURNING *`,
      {
        replacements: {
          id: uuidv4(),
          name,
          description: description || null,
          category: category || null,
          mealType: meal_type || null,
          cuisine: cuisine || null,
          dietType: diet_type || null,
          servingSize: serving_size || null,
          calories: calories || null,
          protein: protein || null,
          carbs: carbs || null,
          fats: fats || null,
          fiber: fiber || null,
          sugar: sugar || null,
          sodium: sodium || null,
          ingredients: ingredients || null,
          instructions: instructions || null,
          imageUrl: image_url || null,
          documentUrl: document_url || null,
          createdBy: userId,
        },
        type: QueryTypes.INSERT,
      }
    );

    return res.json({ template: Array.isArray(rows) ? rows[0] : rows });
  } catch (err: any) {
    console.error('❌ [DIET] createMealTemplate error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const updateMealTemplate = async (req: any, res: Response) => {
  try {
    const sequelize = await getAppSequelize();
    await ensureDietTablesReady();
    const { id } = req.params;
    const updates = req.body || {};
    const updateFields: string[] = [];
    const params: any = { id };

    Object.keys(updates).forEach((key) => {
      if (key !== 'id' && updates[key] !== undefined) {
        const dbKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        updateFields.push(`${dbKey} = :${key}`);
        params[key] = updates[key];
      }
    });

    if (updateFields.length === 0) {
      return res.json({ message: 'No updates provided' });
    }

    updateFields.push('updated_at = NOW()');
    const sql = `UPDATE diet_meal_templates SET ${updateFields.join(', ')} WHERE id = :id RETURNING *`;
    const [rows]: any = await sequelize.query(sql, { replacements: params, type: QueryTypes.UPDATE });
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Not found' });
    }
    return res.json({ template: rows[0] });
  } catch (err: any) {
    console.error('❌ [DIET] updateMealTemplate error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const exportMealTemplates = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const sequelize = await getAppSequelize();
    await ensureDietTablesReady();
    const rows: any = await sequelize.query(
      `SELECT * FROM diet_meal_templates WHERE created_by = :userId AND is_active = TRUE ORDER BY created_at DESC`,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Meals');
    const columns = rows && rows.length > 0
      ? Object.keys(rows[0]).map((key) => ({ header: key, key }))
      : [];
    worksheet.columns = columns;
    if (rows && rows.length > 0) {
      worksheet.addRows(rows);
    }
    const buffer = await workbook.xlsx.writeBuffer();
    const excelBuffer = Buffer.from(buffer as ArrayBuffer);

    res.setHeader('Content-Disposition', 'attachment; filename="meal-templates.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(excelBuffer);
  } catch (err: any) {
    console.error('❌ [DIET] exportMealTemplates error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const importMealTemplates = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const data: any[] = await parseExcelBuffer(req.file.buffer);

    if (!data || data.length === 0) {
      return res.status(400).json({ message: 'No data found in Excel file' });
    }

    const sequelize = await getAppSequelize();
    await ensureDietTablesReady();

    let imported = 0;
    const errors_list: string[] = [];

    for (const row of data) {
      const name = row.name || row.Name;
      if (!name) {
        errors_list.push('Missing name');
        continue;
      }

      const payload = {
        id: uuidv4(),
        name,
        description: row.description || row.Description || null,
        category: row.category || row.Category || null,
        mealType: row.meal_type || row.MealType || row['Meal Type'] || null,
        cuisine: row.cuisine || row.Cuisine || null,
        dietType: row.diet_type || row.DietType || row['Diet Type'] || null,
        servingSize: row.serving_size || row.ServingSize || row['Serving Size'] || null,
        calories: row.calories || row.Calories || null,
        protein: row.protein || row.Protein || null,
        carbs: row.carbs || row.Carbs || null,
        fats: row.fats || row.Fats || null,
        fiber: row.fiber || row.Fiber || null,
        sugar: row.sugar || row.Sugar || null,
        sodium: row.sodium || row.Sodium || null,
        ingredients: row.ingredients || row.Ingredients || null,
        instructions: row.instructions || row.Instructions || null,
        imageUrl: row.image_url || row.ImageUrl || row['Image Url'] || null,
        documentUrl: row.document_url || row.DocumentUrl || row['Document Url'] || null,
        createdBy: userId,
      };

      await sequelize.query(
        `INSERT INTO diet_meal_templates (id, name, description, category, meal_type, cuisine, diet_type, serving_size, calories, protein, carbs, fats, fiber, sugar, sodium, ingredients, instructions, image_url, document_url, created_by, is_active)
         VALUES (:id, :name, :description, :category, :mealType, :cuisine, :dietType, :servingSize, :calories, :protein, :carbs, :fats, :fiber, :sugar, :sodium, :ingredients, :instructions, :imageUrl, :documentUrl, :createdBy, TRUE)`,
        { replacements: payload, type: QueryTypes.INSERT }
      );
      imported += 1;
    }

    return res.json({ message: 'Import completed', imported, errors: errors_list.length, errors_list });
  } catch (err: any) {
    console.error('❌ [DIET] importMealTemplates error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

// ========== WEEKLY TEMPLATES ==========

export const getWeekTemplates = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.query.client_id;
  const targetUserId = clientId || userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    const sequelize = await getAppSequelize();
    await ensureDietTablesReady();
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
    await ensureDietTablesReady();
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
    
    // Get days with sessions and items
    const [days]: any = await sequelize.query(
      `SELECT * FROM diet_template_days WHERE week_template_id = :id ORDER BY day_of_week ASC`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    
    for (const day of days) {
      const [sessions]: any = await sequelize.query(
        `SELECT * FROM diet_meal_sessions WHERE template_day_id = :dayId ORDER BY meal_order ASC`,
        { replacements: { dayId: day.id }, type: QueryTypes.SELECT }
      );
      
      for (const session of sessions) {
        const [items]: any = await sequelize.query(
          `SELECT * FROM diet_meal_items WHERE meal_session_id = :sessionId ORDER BY item_order ASC`,
          { replacements: { sessionId: session.id }, type: QueryTypes.SELECT }
        );
        session.items = items || [];
      }
      
      day.sessions = sessions || [];
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
    await ensureDietTablesReady();
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
    
    // Create days with sessions and items
    for (const dayData of days) {
      const dayId = uuidv4();
      await sequelize.query(
        `INSERT INTO diet_template_days (id, week_template_id, day_of_week, is_rest_day, notes)
         VALUES (:id, :templateId, :dayOfWeek, :isRestDay, :notes)`,
        {
          replacements: {
            id: dayId,
            templateId,
            dayOfWeek: dayData.day_of_week,
            isRestDay: dayData.is_rest_day || false,
            notes: dayData.notes || null,
          },
          type: QueryTypes.INSERT,
        }
      );
      
      if (dayData.sessions && Array.isArray(dayData.sessions)) {
        for (const sessionData of dayData.sessions) {
          const sessionId = uuidv4();
          await sequelize.query(
            `INSERT INTO diet_meal_sessions (id, template_day_id, session_name, meal_order, notes)
             VALUES (:id, :dayId, :sessionName, :sessionOrder, :notes)`,
            {
              replacements: {
                id: sessionId,
                dayId,
                sessionName: sessionData.session_name || sessionData.meal_type,
                sessionOrder: sessionData.session_order || sessionData.meal_order || 0,
                notes: sessionData.notes || null,
              },
              type: QueryTypes.INSERT,
            }
          );
          
          if (sessionData.items && Array.isArray(sessionData.items)) {
            for (const itemData of sessionData.items) {
              await sequelize.query(
                `INSERT INTO diet_meal_items (id, meal_session_id, meal_template_id, food_name, quantity, calories, protein, carbs, fats, fiber, sugar, sodium, item_order, notes)
                 VALUES (:id, :sessionId, :templateId, :foodName, :quantity, :calories, :protein, :carbs, :fats, :fiber, :sugar, :sodium, :itemOrder, :notes)`,
                {
                  replacements: {
                    id: uuidv4(),
                    sessionId,
                    templateId: itemData.meal_template_id || null,
                    foodName: itemData.food_name,
                    quantity: itemData.quantity || null,
                    calories: itemData.calories || null,
                    protein: itemData.protein || null,
                    carbs: itemData.carbs || null,
                    fats: itemData.fats || null,
                    fiber: itemData.fiber || null,
                    sugar: itemData.sugar || null,
                    sodium: itemData.sodium || null,
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
    await ensureDietTablesReady();
    const { id } = req.params;
    const { name, description, is_active, days } = req.body || {};
    
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
    
    const transaction = await sequelize.transaction();
    try {
      if (updates.length > 0) {
        updates.push('updated_at = NOW()');
        const sql = `UPDATE diet_week_templates SET ${updates.join(', ')} WHERE id = :id RETURNING *`;
        const rows: any = await sequelize.query(sql, {
          replacements: params,
          type: QueryTypes.UPDATE,
          transaction,
        });
        const updatedRows = Array.isArray(rows) ? rows : [];
        if (updatedRows.length === 0) {
          await transaction.rollback();
          return res.status(404).json({ message: 'Not found' });
        }
      }
      
      if (Array.isArray(days)) {
        await sequelize.query(
          `DELETE FROM diet_meal_items 
           WHERE meal_session_id IN (
             SELECT id FROM diet_meal_sessions 
             WHERE template_day_id IN (
               SELECT id FROM diet_template_days WHERE week_template_id = :templateId
             )
           )`,
          { replacements: { templateId: id }, type: QueryTypes.DELETE, transaction }
        );
        await sequelize.query(
          `DELETE FROM diet_meal_sessions 
           WHERE template_day_id IN (
             SELECT id FROM diet_template_days WHERE week_template_id = :templateId
           )`,
          { replacements: { templateId: id }, type: QueryTypes.DELETE, transaction }
        );
        await sequelize.query(
          `DELETE FROM diet_template_days WHERE week_template_id = :templateId`,
          { replacements: { templateId: id }, type: QueryTypes.DELETE, transaction }
        );
        
        for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
          const dayData = days[dayIndex];
          const dayId = uuidv4();
          const dayOfWeek = dayData?.day_of_week ?? dayIndex;
          await sequelize.query(
            `INSERT INTO diet_template_days (id, week_template_id, day_of_week, is_rest_day, notes)
             VALUES (:id, :templateId, :dayOfWeek, :isRestDay, :notes)`,
            {
              replacements: {
                id: dayId,
                templateId: id,
                dayOfWeek,
                isRestDay: dayData?.is_rest_day || false,
                notes: dayData?.notes || null,
              },
              type: QueryTypes.INSERT,
              transaction,
            }
          );
          
          if (dayData?.sessions && Array.isArray(dayData.sessions)) {
            for (const sessionData of dayData.sessions) {
              const sessionId = uuidv4();
              await sequelize.query(
                `INSERT INTO diet_meal_sessions (id, template_day_id, session_name, meal_order, notes)
                 VALUES (:id, :dayId, :sessionName, :sessionOrder, :notes)`,
                {
                  replacements: {
                    id: sessionId,
                    dayId,
                    sessionName: sessionData.session_name || sessionData.meal_type,
                    sessionOrder: sessionData.session_order || sessionData.meal_order || 0,
                    notes: sessionData.notes || null,
                  },
                  type: QueryTypes.INSERT,
                  transaction,
                }
              );
              
              if (sessionData.items && Array.isArray(sessionData.items)) {
                for (const itemData of sessionData.items) {
                  await sequelize.query(
                    `INSERT INTO diet_meal_items (id, meal_session_id, meal_template_id, food_name, quantity, calories, protein, carbs, fats, fiber, sugar, sodium, item_order, notes)
                     VALUES (:id, :sessionId, :templateId, :foodName, :quantity, :calories, :protein, :carbs, :fats, :fiber, :sugar, :sodium, :itemOrder, :notes)`,
                    {
                      replacements: {
                        id: uuidv4(),
                        sessionId,
                        templateId: itemData.meal_template_id || null,
                        foodName: itemData.food_name,
                        quantity: itemData.quantity || null,
                        calories: itemData.calories || null,
                        protein: itemData.protein || null,
                        carbs: itemData.carbs || null,
                        fats: itemData.fats || null,
                        fiber: itemData.fiber || null,
                        sugar: itemData.sugar || null,
                        sodium: itemData.sodium || null,
                        itemOrder: itemData.item_order || 0,
                        notes: itemData.notes || null,
                      },
                      type: QueryTypes.INSERT,
                      transaction,
                    }
                  );
                }
              }
            }
          }
        }
      }
      
      await transaction.commit();
    } catch (err: any) {
      await transaction.rollback();
      throw err;
    }
    
    const fakeReq: any = { user: { id: userId }, params: { id } };
    return await getWeekTemplate(fakeReq, res as any);
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
    await ensureDietTablesReady();
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
    
    // Get sessions for each entry
    for (const entry of rows) {
      const [sessions]: any = await sequelize.query(
        `SELECT * FROM diet_calendar_meals WHERE calendar_entry_id = :entryId ORDER BY meal_order ASC`,
        { replacements: { entryId: entry.id }, type: QueryTypes.SELECT }
      );
      
      for (const session of sessions) {
        const [items]: any = await sequelize.query(
          `SELECT * FROM diet_calendar_meal_items WHERE calendar_meal_id = :sessionId ORDER BY item_order ASC`,
          { replacements: { sessionId: session.id }, type: QueryTypes.SELECT }
        );
        session.items = items || [];
      }
      
      entry.sessions = sessions || [];
    }
    
    return res.json({ entries: rows || [] });
  } catch (err: any) {
    console.error('❌ [DIET] getCalendarEntries error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const getCalendarEntry = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.query.client_id;
  const targetUserId = clientId || userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    const sequelize = await getAppSequelize();
    await ensureDietTablesReady();
    const { date } = req.params;
    
    const [rows]: any = await sequelize.query(
      `SELECT * FROM diet_calendar_entries WHERE patient_user_id = :userId AND date = :date`,
      { replacements: { userId: targetUserId, date }, type: QueryTypes.SELECT }
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Not found' });
    }
    
    const entry = rows[0];
    
    // Get sessions
    const [sessions]: any = await sequelize.query(
      `SELECT * FROM diet_calendar_meals WHERE calendar_entry_id = :entryId ORDER BY meal_order ASC`,
      { replacements: { entryId: entry.id }, type: QueryTypes.SELECT }
    );
    
    for (const session of sessions) {
      const [items]: any = await sequelize.query(
        `SELECT * FROM diet_calendar_meal_items WHERE calendar_meal_id = :sessionId ORDER BY item_order ASC`,
        { replacements: { sessionId: session.id }, type: QueryTypes.SELECT }
      );
      session.items = items || [];
    }
    
    entry.sessions = sessions || [];
    
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
    await ensureDietTablesReady();
    const { date, week_template_id, template_day_id, is_override, is_rest_day, notes, sessions = [] } = req.body || {};
    
    if (!date) {
      return res.status(400).json({ message: 'date is required' });
    }
    
    const entryId = uuidv4();
    
    // Create or update entry
    await sequelize.query(
      `INSERT INTO diet_calendar_entries (id, patient_user_id, date, week_template_id, template_day_id, is_override, is_rest_day, notes)
       VALUES (:id, :userId, :date, :weekTemplateId, :templateDayId, :isOverride, :isRestDay, :notes)
       ON CONFLICT (patient_user_id, date) DO UPDATE SET
         week_template_id = EXCLUDED.week_template_id,
         template_day_id = EXCLUDED.template_day_id,
         is_override = EXCLUDED.is_override,
         is_rest_day = EXCLUDED.is_rest_day,
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
          isRestDay: is_rest_day || false,
          notes: notes || null,
        },
        type: QueryTypes.INSERT,
      }
    );

    const entryRows: any = await sequelize.query(
      `SELECT id FROM diet_calendar_entries WHERE patient_user_id = :userId AND date = :date`,
      { replacements: { userId: targetUserId, date }, type: QueryTypes.SELECT }
    );
    const resolvedEntryId = Array.isArray(entryRows) && entryRows.length > 0 ? entryRows[0].id : entryId;
    
    // Delete existing meals if override
    if (is_override && sessions.length > 0) {
      await sequelize.query(
        `DELETE FROM diet_calendar_meals WHERE calendar_entry_id = :entryId`,
        { replacements: { entryId: resolvedEntryId }, type: QueryTypes.DELETE }
      );
    }
    
    // Create sessions
    for (const sessionData of sessions) {
      const sessionId = uuidv4();
      await sequelize.query(
        `INSERT INTO diet_calendar_meals (id, calendar_entry_id, session_name, meal_order, notes)
         VALUES (:id, :entryId, :sessionName, :sessionOrder, :notes)`,
        {
          replacements: {
            id: sessionId,
            entryId: resolvedEntryId,
            sessionName: sessionData.session_name || sessionData.meal_type,
            sessionOrder: sessionData.session_order || sessionData.meal_order || 0,
            notes: sessionData.notes || null,
          },
          type: QueryTypes.INSERT,
        }
      );
      
      if (sessionData.items && Array.isArray(sessionData.items)) {
        for (const itemData of sessionData.items) {
          await sequelize.query(
            `INSERT INTO diet_calendar_meal_items (id, calendar_meal_id, meal_template_id, food_name, quantity, calories, protein, carbs, fats, fiber, sugar, sodium, item_order, notes)
             VALUES (:id, :sessionId, :templateId, :foodName, :quantity, :calories, :protein, :carbs, :fats, :fiber, :sugar, :sodium, :itemOrder, :notes)`,
            {
              replacements: {
                id: uuidv4(),
                sessionId,
                templateId: itemData.meal_template_id || null,
                foodName: itemData.food_name,
                quantity: itemData.quantity || null,
                calories: itemData.calories || null,
                protein: itemData.protein || null,
                carbs: itemData.carbs || null,
                fats: itemData.fats || null,
                fiber: itemData.fiber || null,
                sugar: itemData.sugar || null,
                sodium: itemData.sodium || null,
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
    const fakeReq: any = { user: { id: userId }, params: { date }, query: { client_id: targetUserId } };
    return await getCalendarEntry(fakeReq, res as any);
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
    await ensureDietTablesReady();
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
    await ensureDietTablesReady();
    const {
      calendar_entry_id, calendar_meal_id, calendar_meal_item_id,
      tracked_date, completion_status, completed_quantity, completed_calories,
      completed_protein, completed_carbs, completed_fats, completed_items_detail,
      notes, pictures, rating
    } = req.body || {};
    
    if (!tracked_date) {
      return res.status(400).json({ message: 'tracked_date is required' });
    }
    
    const [rows]: any = await sequelize.query(
      `INSERT INTO diet_tracking (id, patient_user_id, calendar_entry_id, calendar_meal_id, calendar_meal_item_id, tracked_date, completion_status, completed_quantity, completed_calories, completed_protein, completed_carbs, completed_fats, completed_items_detail, notes, pictures, rating)
       VALUES (:id, :userId, :entryId, :mealId, :itemId, :trackedDate, :status, :completedQuantity, :completedCalories, :completedProtein, :completedCarbs, :completedFats, :completedItemsDetail::jsonb, :notes, :pictures::text[], :rating)
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
          completedQuantity: completed_quantity || null,
          completedCalories: completed_calories || null,
          completedProtein: completed_protein || null,
          completedCarbs: completed_carbs || null,
          completedFats: completed_fats || null,
          completedItemsDetail: completed_items_detail ? JSON.stringify(completed_items_detail) : null,
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
    await ensureDietTablesReady();
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
        } else if (key === 'completed_items_detail') {
          updateFields.push(`${dbKey} = :${key}::jsonb`);
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
    await ensureDietTablesReady();
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
    await ensureDietTablesReady();
    const {
      entry_date, entry_time, session_name, meal_template_id, food_name, quantity,
      calories, protein, carbs, fats, fiber, sugar, sodium, notes, pictures
    } = req.body || {};
    
    if (!entry_date || !food_name) {
      return res.status(400).json({ message: 'entry_date and food_name are required' });
    }
    
    const [rows]: any = await sequelize.query(
      `INSERT INTO diet_ad_hoc_entries (id, patient_user_id, entry_date, entry_time, session_name, meal_template_id, food_name, quantity, calories, protein, carbs, fats, fiber, sugar, sodium, notes, pictures)
       VALUES (:id, :userId, :entryDate, :entryTime, :sessionName, :templateId, :foodName, :quantity, :calories, :protein, :carbs, :fats, :fiber, :sugar, :sodium, :notes, :pictures::text[])
       RETURNING *`,
      {
        replacements: {
          id: uuidv4(),
          userId: targetUserId,
          entryDate: entry_date,
          entryTime: entry_time || null,
          sessionName: session_name || null,
          templateId: meal_template_id || null,
          foodName: food_name,
          quantity: quantity || null,
          calories: calories || null,
          protein: protein || null,
          carbs: carbs || null,
          fats: fats || null,
          fiber: fiber || null,
          sugar: sugar || null,
          sodium: sodium || null,
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
    await ensureDietTablesReady();
    
    // Get completion stats
    const statsRows: any = await sequelize.query(
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
    
    const statsList = Array.isArray(statsRows) ? statsRows : [];
    const stats = statsList[0] || { completed_count: 0, skipped_count: 0, partial_count: 0, total_count: 0 };

    const streakRowsRaw: any = await sequelize.query(
      `SELECT tracked_date, completion_status
       FROM diet_tracking
       WHERE patient_user_id = :userId AND completion_status IN ('completed', 'partial')
       ORDER BY tracked_date DESC
       LIMIT 30`,
      { replacements: { userId: targetUserId }, type: QueryTypes.SELECT }
    );
    const streakRows = Array.isArray(streakRowsRaw) ? streakRowsRaw : [];
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < streakRows.length; i++) {
      const date = new Date(streakRows[i].tracked_date);
      date.setHours(0, 0, 0, 0);
      const expectedDate = new Date(today);
      expectedDate.setDate(today.getDate() - i);
      if (date.getTime() === expectedDate.getTime()) {
        streak++;
      } else {
        break;
      }
    }

    return res.json({
      stats,
      macros: macros || { total_calories: 0, total_protein: 0, total_carbs: 0, total_fats: 0 },
      streak,
      period: { start_date: startDate, end_date: endDate },
    });
  } catch (err: any) {
    console.error('❌ [DIET] getProgress error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};
