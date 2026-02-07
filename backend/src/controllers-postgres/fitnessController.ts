import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { QueryTypes } from 'sequelize';
import ExcelJS from 'exceljs';

const getAppSequelize = async () => {
  try {
    const db = await import('../config/database-integrated');
    return db.appSequelize;
  } catch (err: any) {
    // Fallback: create direct connection if decorator issues occur
    const { Sequelize } = await import('sequelize');
    const dbSSL = process.env.DB_SSL === 'true';
    return new Sequelize(
      process.env.DB_NAME || 'aarogya_mitra',
      process.env.DB_USER || 'app_user',
      process.env.DB_PASSWORD || 'app_password_2024',
      {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        dialect: 'postgres',
        logging: false,
        dialectOptions: dbSSL ? {
          ssl: {
            require: true,
            rejectUnauthorized: false
          }
        } : undefined
      }
    );
  }
};

// Helper to ensure patient_resources table exists
const ensurePatientResourcesTable = async () => {
  const sequelize = await getAppSequelize();
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS patient_resources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_user_id UUID NOT NULL,
        resource_user_id UUID NOT NULL,
        role VARCHAR(64),
        roles JSONB DEFAULT '[]'::jsonb NOT NULL,
        access_health BOOLEAN DEFAULT TRUE,
        access_fitness BOOLEAN DEFAULT TRUE,
        access_diet BOOLEAN DEFAULT TRUE,
        resource_phone VARCHAR(32),
        resource_name VARCHAR(255),
        patient_phone VARCHAR(32),
        patient_name VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS ux_patient_resource ON patient_resources (patient_user_id, resource_user_id);
    `);
  } catch (err: any) {
    // Ignore if table exists
  }
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

// ========== EXERCISE TEMPLATES (Library) ==========

export const getExerciseTemplates = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.query.client_id;
  const targetUserId = clientId || userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const sequelize = await getAppSequelize();
    // Ensure tables exist before querying
    const { ensureFitnessTables } = await import('../utils/ensureFitnessTables');
    await ensureFitnessTables();
    await ensurePatientResourcesTable();
    const { category, library_type } = req.query; // library_type: 'own', 'trainer', or undefined (all)
    
    // Get trainer user IDs who have shared their library with this user (access_fitness = TRUE)
    const trainerResources: any = await sequelize.query(
      `SELECT resource_user_id, resource_name FROM patient_resources 
       WHERE patient_user_id = :userId AND access_fitness = TRUE`,
      { replacements: { userId: targetUserId }, type: QueryTypes.SELECT }
    );
    const trainerIds = Array.isArray(trainerResources) ? trainerResources.map((r: any) => r.resource_user_id) : [];

    let sql = '';
    const params: any = { targetUserId };

    if (library_type === 'own') {
      // Only own library
      sql = `SELECT *, 'own' as library_source, NULL as trainer_name FROM exercise_templates 
             WHERE is_active = TRUE AND created_by = :targetUserId`;
    } else if (library_type === 'trainer') {
      // Only trainer libraries
      if (trainerIds.length === 0) {
        return res.json({ templates: [], trainers: [] });
      }
      // Use subquery to avoid array parameter issues
      sql = `SELECT et.*, 'trainer' as library_source, pr.resource_name as trainer_name 
             FROM exercise_templates et
             JOIN patient_resources pr ON et.created_by = pr.resource_user_id
             WHERE et.is_active = TRUE 
             AND et.created_by IN (SELECT resource_user_id FROM patient_resources WHERE patient_user_id = :targetUserId AND access_fitness = TRUE)
             AND pr.patient_user_id = :targetUserId
             AND pr.access_fitness = TRUE`;
    } else {
      // All libraries (own + trainers)
      if (trainerIds.length === 0) {
        sql = `SELECT *, 'own' as library_source, NULL as trainer_name FROM exercise_templates 
               WHERE is_active = TRUE AND created_by = :targetUserId`;
      } else {
        // Use UNION to combine own and trainer exercises
        sql = `SELECT * FROM (
          SELECT et.*, 'own' as library_source, NULL::VARCHAR as trainer_name
          FROM exercise_templates et
          WHERE et.is_active = TRUE AND et.created_by = :targetUserId
          UNION ALL
          SELECT et.*, 'trainer' as library_source, pr.resource_name as trainer_name
          FROM exercise_templates et
          JOIN patient_resources pr ON et.created_by = pr.resource_user_id
          WHERE et.is_active = TRUE 
          AND et.created_by IN (SELECT resource_user_id FROM patient_resources WHERE patient_user_id = :targetUserId AND access_fitness = TRUE)
          AND pr.patient_user_id = :targetUserId
          AND pr.access_fitness = TRUE
        ) combined`;
      }
    }
    
    if (category) {
      if (sql.includes('UNION ALL')) {
        // For UNION queries, add category filter to each part
        sql = sql.replace(
          `WHERE et.is_active = TRUE AND et.created_by = :targetUserId`,
          `WHERE et.is_active = TRUE AND et.created_by = :targetUserId AND et.category = :category`
        );
        sql = sql.replace(
          `WHERE et.is_active = TRUE`,
          `WHERE et.is_active = TRUE AND et.category = :category`
        );
        params.category = category;
      } else {
        sql += ` AND category = :category`;
        params.category = category;
      }
    }
    
    sql += ` ORDER BY library_source, name ASC`;
    
    const rows: any = await sequelize.query(sql, { replacements: params, type: QueryTypes.SELECT });
    
    // Also return trainer list for frontend
    const trainers = Array.isArray(trainerResources) ? trainerResources.map((r: any) => ({
      id: r.resource_user_id,
      name: r.resource_name
    })) : [];
    
    return res.json({ templates: rows || [], trainers });
  } catch (err: any) {
    console.error('❌ [FITNESS] getExerciseTemplates error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const getExerciseTemplate = async (req: any, res: Response) => {
  try {
    const sequelize = await getAppSequelize();
    const { id } = req.params;
    
    const [rows]: any = await sequelize.query(
      `SELECT * FROM exercise_templates WHERE id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Not found' });
    }
    
    return res.json({ template: rows[0] });
  } catch (err: any) {
    console.error('❌ [FITNESS] getExerciseTemplate error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const createExerciseTemplate = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    const sequelize = await getAppSequelize();
    const {
      name, description, category, muscle_groups, video_url, image_url, document_url,
      instructions, sets_default, reps_default, duration_default, duration_default_text, difficulty,
      set_01_rep, weight_01, set_02_rep, weight_02, set_03_rep, weight_03
    } = req.body || {};
    
    if (!name) {
      return res.status(400).json({ message: 'name is required' });
    }
    
    const [rows]: any = await sequelize.query(
      `INSERT INTO exercise_templates (id, name, description, category, muscle_groups, video_url, image_url, document_url, instructions, sets_default, reps_default, duration_default, duration_default_text, difficulty, set_01_rep, weight_01, set_02_rep, weight_02, set_03_rep, weight_03, created_by, is_active)
       VALUES (:id, :name, :description, :category, :muscleGroups, :videoUrl, :imageUrl, :documentUrl, :instructions, :setsDefault, :repsDefault, :durationDefault, :durationDefaultText, :difficulty, :set01Rep, :weight01, :set02Rep, :weight02, :set03Rep, :weight03, :createdBy, TRUE)
       RETURNING *`,
      {
        replacements: {
          id: uuidv4(),
          name,
          description: description || null,
          category: category || null,
          muscleGroups: muscle_groups || null,
          videoUrl: video_url || null,
          imageUrl: image_url || null,
          documentUrl: document_url || null,
          instructions: instructions || null,
          setsDefault: sets_default || null,
          repsDefault: reps_default || null,
          durationDefault: duration_default ?? null,
          durationDefaultText: duration_default_text || null,
          difficulty: difficulty || null,
          set01Rep: set_01_rep || null,
          weight01: weight_01 ? parseFloat(weight_01) : null,
          set02Rep: set_02_rep || null,
          weight02: weight_02 ? parseFloat(weight_02) : null,
          set03Rep: set_03_rep || null,
          weight03: weight_03 ? parseFloat(weight_03) : null,
          createdBy: userId,
        },
        type: QueryTypes.INSERT,
      }
    );
    
    return res.json({ template: Array.isArray(rows) ? rows[0] : rows });
  } catch (err: any) {
    console.error('❌ [FITNESS] createExerciseTemplate error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const updateExerciseTemplate = async (req: any, res: Response) => {
  try {
    const sequelize = await getAppSequelize();
    const { id } = req.params;
    const updates = req.body || {};
    
    const updateFields: string[] = [];
    const params: any = { id };
    
    // Map field names to database column names
    const fieldMapping: Record<string, string> = {
      set_01_rep: 'set_01_rep',
      weight_01: 'weight_01',
      set_02_rep: 'set_02_rep',
      weight_02: 'weight_02',
      set_03_rep: 'set_03_rep',
      weight_03: 'weight_03',
      duration_default_text: 'duration_default_text',
    };
    
    Object.keys(updates).forEach((key) => {
      if (key !== 'id' && updates[key] !== undefined) {
        // Use mapping if exists; otherwise keep key as-is (frontend sends snake_case column names)
        const dbKey = fieldMapping[key] ?? key;
        updateFields.push(`${dbKey} = :${key}`);
        // Handle weight fields - convert to float
        if (key.startsWith('weight_') && updates[key]) {
          params[key] = parseFloat(updates[key]);
        } else {
          params[key] = updates[key];
        }
      }
    });
    
    if (updateFields.length === 0) {
      return res.json({ message: 'No updates provided' });
    }
    
    updateFields.push('updated_at = NOW()');
    
    const sql = `UPDATE exercise_templates SET ${updateFields.join(', ')} WHERE id = :id RETURNING *`;
    const [rows]: any = await sequelize.query(sql, { replacements: params, type: QueryTypes.UPDATE });
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Not found' });
    }
    
    return res.json({ template: rows[0] });
  } catch (err: any) {
    console.error('❌ [FITNESS] updateExerciseTemplate error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

// Export exercises as Excel file with example data
export const exportExerciseTemplates = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const sequelize = await getAppSequelize();
    console.log(`🔍 [FITNESS] exportExerciseTemplates: userId=${userId}`);
    
    const result: any = await sequelize.query(
      `SELECT name, description, category, muscle_groups, video_url, image_url, document_url, 
              instructions, sets_default, reps_default, duration_default, difficulty,
              set_01_rep, weight_01, set_02_rep, weight_02, set_03_rep, weight_03
       FROM exercise_templates 
       WHERE created_by = :userId AND is_active = TRUE
       ORDER BY name ASC`,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );

    // Handle both [rows, metadata] and direct rows return
    const rows = Array.isArray(result) && result.length === 2 ? result[0] : result;
    const exercises = Array.isArray(rows) ? rows : [];
    console.log(`✅ [FITNESS] exportExerciseTemplates: Found ${exercises.length} exercises`);

    // Example exercise data (always included as first row)
    const exampleExercise = {
      name: 'Push-ups',
      description: 'Classic upper body exercise targeting chest, shoulders, and triceps',
      category: 'Strength',
      muscle_groups: 'Chest, Shoulders, Triceps',
      video_url: 'https://example.com/videos/pushups.mp4',
      image_url: 'https://example.com/images/pushups.jpg',
      document_url: '',
      instructions: '1. Start in plank position\n2. Lower body until chest nearly touches floor\n3. Push back up to starting position\n4. Repeat for desired reps',
      sets_default: 3,
      reps_default: '10-15',
      duration_default: null,
      difficulty: 'Beginner',
      set_01_rep: '10',
      weight_01: null,
      set_02_rep: '12',
      weight_02: null,
      set_03_rep: '15',
      weight_03: null
    };

    // Combine example with user's exercises
    const allExercises = [exampleExercise, ...exercises];

    // Prepare data for Excel
    const excelData = allExercises.map((ex: any) => ({
      'Exercise Name': ex.name || '',
      'Description': ex.description || '',
      'Category': ex.category || '',
      'Muscle Groups': ex.muscle_groups || '',
      'Video URL': ex.video_url || '',
      'Image URL': ex.image_url || '',
      'Document URL': ex.document_url || '',
      'Instructions': ex.instructions || '',
      'Sets (Default)': ex.sets_default || '',
      'Reps (Default)': ex.reps_default || '',
      'Duration (seconds)': ex.duration_default || '',
      'Difficulty': ex.difficulty || '',
      'Set-01-Rep': ex.set_01_rep || '',
      'Weight-01': ex.weight_01 || '',
      'Set-02-Rep': ex.set_02_rep || '',
      'Weight-02': ex.weight_02 || '',
      'Set-03-Rep': ex.set_03_rep || '',
      'Weight-03': ex.weight_03 || ''
    }));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Exercises');
    worksheet.columns = [
      { header: 'Exercise Name', key: 'Exercise Name', width: 20 },
      { header: 'Description', key: 'Description', width: 40 },
      { header: 'Category', key: 'Category', width: 15 },
      { header: 'Muscle Groups', key: 'Muscle Groups', width: 30 },
      { header: 'Video URL', key: 'Video URL', width: 40 },
      { header: 'Image URL', key: 'Image URL', width: 40 },
      { header: 'Document URL', key: 'Document URL', width: 40 },
      { header: 'Instructions', key: 'Instructions', width: 50 },
      { header: 'Sets (Default)', key: 'Sets (Default)', width: 15 },
      { header: 'Reps (Default)', key: 'Reps (Default)', width: 15 },
      { header: 'Duration (seconds)', key: 'Duration (seconds)', width: 18 },
      { header: 'Difficulty', key: 'Difficulty', width: 12 },
      { header: 'Set-01-Rep', key: 'Set-01-Rep', width: 12 },
      { header: 'Weight-01', key: 'Weight-01', width: 12 },
      { header: 'Set-02-Rep', key: 'Set-02-Rep', width: 12 },
      { header: 'Weight-02', key: 'Weight-02', width: 12 },
      { header: 'Set-03-Rep', key: 'Set-03-Rep', width: 12 },
      { header: 'Weight-03', key: 'Weight-03', width: 12 },
    ];
    worksheet.addRows(excelData);

    const buffer = await workbook.xlsx.writeBuffer();
    const excelBuffer = Buffer.from(buffer as ArrayBuffer);

    // Set response headers for Excel file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="exercise-library-${Date.now()}.xlsx"`);
    res.setHeader('Content-Length', excelBuffer.length);

    return res.send(excelBuffer);
  } catch (err: any) {
    console.error('❌ [FITNESS] exportExerciseTemplates error:', err.message || err);
    console.error('❌ [FITNESS] exportExerciseTemplates stack:', err.stack);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

// Import exercises from Excel file
export const importExerciseTemplates = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const sequelize = await getAppSequelize();
    
    // Check if file was uploaded (multipart/form-data)
    let exercises: any[] = [];
    
    if (req.file) {
      // Handle Excel file upload
      console.log(`🔍 [FITNESS] importExerciseTemplates: Processing Excel file: ${req.file.originalname}`);
      
      try {
        // Read Excel file buffer
        const excelData = await parseExcelBuffer(req.file.buffer);
        
        // Map Excel columns to exercise fields
        exercises = excelData.map((row: any) => {
          // Handle both camelCase and space-separated column names
          const getValue = (key: string) => {
            return row[key] || row[key.replace(/\s+/g, ' ')] || '';
          };
          
          return {
            name: getValue('Exercise Name') || getValue('exerciseName') || getValue('name'),
            description: getValue('Description') || getValue('description') || '',
            category: getValue('Category') || getValue('category') || '',
            muscle_groups: getValue('Muscle Groups') || getValue('muscleGroups') || getValue('muscle_groups') || '',
            video_url: getValue('Video URL') || getValue('videoUrl') || getValue('video_url') || '',
            image_url: getValue('Image URL') || getValue('imageUrl') || getValue('image_url') || '',
            document_url: getValue('Document URL') || getValue('documentUrl') || getValue('document_url') || '',
            instructions: getValue('Instructions') || getValue('instructions') || '',
            sets_default: getValue('Sets (Default)') || getValue('setsDefault') || getValue('sets_default') || null,
            reps_default: getValue('Reps (Default)') || getValue('repsDefault') || getValue('reps_default') || '',
            duration_default: getValue('Duration (seconds)') || getValue('durationDefault') || getValue('duration_default') || null,
            difficulty: getValue('Difficulty') || getValue('difficulty') || '',
            set_01_rep: getValue('Set-01-Rep') || getValue('set01Rep') || getValue('set_01_rep') || '',
            weight_01: getValue('Weight-01') || getValue('weight01') || getValue('weight_01') || null,
            set_02_rep: getValue('Set-02-Rep') || getValue('set02Rep') || getValue('set_02_rep') || '',
            weight_02: getValue('Weight-02') || getValue('weight02') || getValue('weight_02') || null,
            set_03_rep: getValue('Set-03-Rep') || getValue('set03Rep') || getValue('set_03_rep') || '',
            weight_03: getValue('Weight-03') || getValue('weight03') || getValue('weight_03') || null
          };
        });
        
        console.log(`✅ [FITNESS] importExerciseTemplates: Parsed ${exercises.length} exercises from Excel`);
      } catch (parseErr: any) {
        console.error('❌ [FITNESS] Excel parsing error:', parseErr.message || parseErr);
        return res.status(400).json({ message: 'Invalid Excel file format: ' + (parseErr.message || 'Unable to parse file') });
      }
    } else if (req.body && req.body.exercises) {
      // Fallback: Handle JSON format (for backward compatibility)
      exercises = Array.isArray(req.body.exercises) ? req.body.exercises : [];
    } else {
      return res.status(400).json({ message: 'No file or exercises data provided. Please upload an Excel file.' });
    }

    if (!Array.isArray(exercises) || exercises.length === 0) {
      return res.status(400).json({ message: 'Invalid format: No exercises found in file' });
    }

    const imported = [];
    const errors = [];
    let skippedExample = false;

    for (const exercise of exercises) {
      try {
        // Skip the example row (Push-ups) if it exists
        if (exercise.name && exercise.name.toLowerCase() === 'push-ups' && !skippedExample) {
          skippedExample = true;
          continue;
        }
        
        if (!exercise.name || exercise.name.trim() === '') {
          errors.push({ exercise, error: 'Missing or empty exercise name' });
          continue;
        }

        // Check if exercise already exists (by name)
        const [existing]: any = await sequelize.query(
          `SELECT id FROM exercise_templates WHERE name = :name AND created_by = :userId AND is_active = TRUE`,
          { replacements: { name: exercise.name.trim(), userId }, type: QueryTypes.SELECT }
        );

        if (existing && existing.length > 0) {
          errors.push({ exercise, error: `Exercise "${exercise.name}" already exists` });
          continue;
        }

        const [rows]: any = await sequelize.query(
          `INSERT INTO exercise_templates (id, name, description, category, muscle_groups, video_url, image_url, document_url, instructions, sets_default, reps_default, duration_default, difficulty, created_by, is_active)
           VALUES (:id, :name, :description, :category, :muscleGroups, :videoUrl, :imageUrl, :documentUrl, :instructions, :setsDefault, :repsDefault, :durationDefault, :difficulty, :createdBy, TRUE)
           RETURNING id, name`,
          {
            replacements: {
              id: uuidv4(),
              name: exercise.name.trim(),
              description: exercise.description || null,
              category: exercise.category || null,
              muscleGroups: exercise.muscle_groups || null,
              videoUrl: exercise.video_url || null,
              imageUrl: exercise.image_url || null,
              documentUrl: exercise.document_url || null,
              instructions: exercise.instructions || null,
              setsDefault: exercise.sets_default ? parseInt(exercise.sets_default) : null,
              repsDefault: exercise.reps_default || null,
              durationDefault: exercise.duration_default ? parseInt(exercise.duration_default) : null,
              difficulty: exercise.difficulty || null,
              createdBy: userId,
            },
            type: QueryTypes.INSERT,
          }
        );

        imported.push(Array.isArray(rows) ? rows[0] : rows);
      } catch (err: any) {
        errors.push({ exercise: exercise.name, error: err.message || 'Import failed' });
      }
    }

    return res.json({
      message: `Imported ${imported.length} exercise(s)${errors.length > 0 ? `, ${errors.length} error(s)` : ''}`,
      imported: imported.length,
      errors: errors.length,
      imported_exercises: imported,
      errors_list: errors.length > 0 ? errors : undefined
    });
  } catch (err: any) {
    console.error('❌ [FITNESS] importExerciseTemplates error:', err.message || err);
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
    // Ensure tables exist before querying
    const { ensureFitnessTables } = await import('../utils/ensureFitnessTables');
    await ensureFitnessTables();
    
    const rows: any = await sequelize.query(
      `SELECT * FROM fitness_week_templates WHERE patient_user_id = :userId ORDER BY created_at DESC`,
      { replacements: { userId: targetUserId }, type: QueryTypes.SELECT }
    );
    const templates = Array.isArray(rows) ? rows : [];
    return res.json({ templates });
  } catch (err: any) {
    console.error('❌ [FITNESS] getWeekTemplates error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const getWeekTemplate = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    const sequelize = await getAppSequelize();
    // Ensure tables exist before querying
    const { ensureFitnessTables } = await import('../utils/ensureFitnessTables');
    await ensureFitnessTables();
    const { id } = req.params;
    
    // Get template
    const templateRows: any = await sequelize.query(
      `SELECT * FROM fitness_week_templates WHERE id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );

    const templateList = Array.isArray(templateRows) ? templateRows : [];
    if (templateList.length === 0) {
      return res.status(404).json({ message: 'Not found' });
    }

    const template = templateList[0];
    
    // Get days with sessions and exercises
    const days: any = await sequelize.query(
      `SELECT * FROM fitness_template_days WHERE week_template_id = :id ORDER BY day_of_week ASC`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );

    const dayList = Array.isArray(days) ? days : [];
    for (const day of dayList) {
      const sessions: any = await sequelize.query(
        `SELECT * FROM fitness_sessions WHERE template_day_id = :dayId ORDER BY session_order ASC`,
        { replacements: { dayId: day.id }, type: QueryTypes.SELECT }
      );

      const sessionList = Array.isArray(sessions) ? sessions : [];
      for (const session of sessionList) {
        const exercises: any = await sequelize.query(
          `SELECT * FROM fitness_session_exercises WHERE session_id = :sessionId ORDER BY exercise_order ASC`,
          { replacements: { sessionId: session.id }, type: QueryTypes.SELECT }
        );

        const exerciseList = Array.isArray(exercises) ? exercises : [];
        session.exercises = exerciseList;
      }

      day.sessions = sessionList;
    }

    template.days = dayList;
    
    return res.json({ template });
  } catch (err: any) {
    console.error('❌ [FITNESS] getWeekTemplate error:', err.message || err);
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
    // Ensure tables exist before creating
    const { ensureFitnessTables } = await import('../utils/ensureFitnessTables');
    await ensureFitnessTables();
    const { name, description, days = [] } = req.body || {};
    
    if (!name) {
      return res.status(400).json({ message: 'name is required' });
    }
    
    const templateId = uuidv4();
    
    // Create template
    await sequelize.query(
      `INSERT INTO fitness_week_templates (id, patient_user_id, name, description, is_active)
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
    
    // Create days with sessions and exercises
    for (const dayData of days) {
      const dayId = uuidv4();
      await sequelize.query(
        `INSERT INTO fitness_template_days (id, week_template_id, day_of_week, is_rest_day, notes)
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
            `INSERT INTO fitness_sessions (id, template_day_id, session_name, session_order, notes)
             VALUES (:id, :dayId, :sessionName, :sessionOrder, :notes)`,
            {
              replacements: {
                id: sessionId,
                dayId,
                sessionName: sessionData.session_name,
                sessionOrder: sessionData.session_order || 0,
                notes: sessionData.notes || null,
              },
              type: QueryTypes.INSERT,
            }
          );
          
          if (sessionData.exercises && Array.isArray(sessionData.exercises)) {
            for (const exerciseData of sessionData.exercises) {
              const dur = exerciseData.duration;
              const durationNum = typeof dur === 'number' && !Number.isNaN(dur) ? dur : (typeof dur === 'string' ? parseInt(dur, 10) : null);
              const durationText = typeof dur === 'string' && Number.isNaN(parseInt(dur, 10)) ? dur : null;
              await sequelize.query(
                `INSERT INTO fitness_session_exercises (id, session_id, exercise_template_id, exercise_name, exercise_order, sets, reps, duration, duration_text, weight, weight_unit, set_01_rep, weight_01, set_02_rep, weight_02, set_03_rep, weight_03, rest_seconds, notes)
                 VALUES (:id, :sessionId, :templateId, :exerciseName, :exerciseOrder, :sets, :reps, :duration, :durationText, :weight, :weightUnit, :set01Rep, :weight01, :set02Rep, :weight02, :set03Rep, :weight03, :restSeconds, :notes)`,
                {
                  replacements: {
                    id: uuidv4(),
                    sessionId,
                    templateId: exerciseData.exercise_template_id || null,
                    exerciseName: exerciseData.exercise_name,
                    exerciseOrder: exerciseData.exercise_order || 0,
                    sets: exerciseData.sets || null,
                    reps: exerciseData.reps || null,
                    duration: Number.isInteger(durationNum) ? durationNum : null,
                    durationText: durationText || null,
                    weight: exerciseData.weight || null,
                    weightUnit: exerciseData.weight_unit || null,
                    set01Rep: exerciseData.set_01_rep || null,
                    weight01: exerciseData.weight_01 || null,
                    set02Rep: exerciseData.set_02_rep || null,
                    weight02: exerciseData.weight_02 || null,
                    set03Rep: exerciseData.set_03_rep || null,
                    weight03: exerciseData.weight_03 || null,
                    restSeconds: exerciseData.rest_seconds || null,
                    notes: exerciseData.notes || null,
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
    return await getWeekTemplate(fakeReq, res as any);
  } catch (err: any) {
    console.error('❌ [FITNESS] createWeekTemplate error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const updateWeekTemplate = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    const sequelize = await getAppSequelize();
    // Ensure tables exist before updating
    const { ensureFitnessTables } = await import('../utils/ensureFitnessTables');
    await ensureFitnessTables();
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
        const sql = `UPDATE fitness_week_templates SET ${updates.join(', ')} WHERE id = :id RETURNING *`;
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
        // Remove existing days/sessions/exercises for this template
        await sequelize.query(
          `DELETE FROM fitness_session_exercises 
           WHERE session_id IN (
             SELECT id FROM fitness_sessions 
             WHERE template_day_id IN (
               SELECT id FROM fitness_template_days WHERE week_template_id = :templateId
             )
           )`,
          { replacements: { templateId: id }, type: QueryTypes.DELETE, transaction }
        );
        await sequelize.query(
          `DELETE FROM fitness_sessions 
           WHERE template_day_id IN (
             SELECT id FROM fitness_template_days WHERE week_template_id = :templateId
           )`,
          { replacements: { templateId: id }, type: QueryTypes.DELETE, transaction }
        );
        await sequelize.query(
          `DELETE FROM fitness_template_days WHERE week_template_id = :templateId`,
          { replacements: { templateId: id }, type: QueryTypes.DELETE, transaction }
        );
        
        // Recreate days with sessions and exercises
        for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
          const dayData = days[dayIndex];
          const dayId = uuidv4();
          const dayOfWeek = dayData?.day_of_week ?? dayIndex;
          await sequelize.query(
            `INSERT INTO fitness_template_days (id, week_template_id, day_of_week, is_rest_day, notes)
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
                `INSERT INTO fitness_sessions (id, template_day_id, session_name, session_order, notes)
                 VALUES (:id, :dayId, :sessionName, :sessionOrder, :notes)`,
                {
                  replacements: {
                    id: sessionId,
                    dayId,
                    sessionName: sessionData.session_name,
                    sessionOrder: sessionData.session_order || 0,
                    notes: sessionData.notes || null,
                  },
                  type: QueryTypes.INSERT,
                  transaction,
                }
              );
              
              if (sessionData.exercises && Array.isArray(sessionData.exercises)) {
                for (const exerciseData of sessionData.exercises) {
                  const dur = exerciseData.duration;
                  const durationNum = typeof dur === 'number' && !Number.isNaN(dur) ? dur : (typeof dur === 'string' ? parseInt(dur, 10) : null);
                  const durationText = typeof dur === 'string' && Number.isNaN(parseInt(dur, 10)) ? dur : null;
                  await sequelize.query(
                    `INSERT INTO fitness_session_exercises (id, session_id, exercise_template_id, exercise_name, exercise_order, sets, reps, duration, duration_text, weight, weight_unit, set_01_rep, weight_01, set_02_rep, weight_02, set_03_rep, weight_03, rest_seconds, notes)
                     VALUES (:id, :sessionId, :templateId, :exerciseName, :exerciseOrder, :sets, :reps, :duration, :durationText, :weight, :weightUnit, :set01Rep, :weight01, :set02Rep, :weight02, :set03Rep, :weight03, :restSeconds, :notes)`,
                    {
                      replacements: {
                        id: uuidv4(),
                        sessionId,
                        templateId: exerciseData.exercise_template_id || null,
                        exerciseName: exerciseData.exercise_name,
                        exerciseOrder: exerciseData.exercise_order || 0,
                        sets: exerciseData.sets || null,
                        reps: exerciseData.reps || null,
                        duration: Number.isInteger(durationNum) ? durationNum : null,
                        durationText: durationText || null,
                        weight: exerciseData.weight || null,
                        weightUnit: exerciseData.weight_unit || null,
                        set01Rep: exerciseData.set_01_rep || null,
                        weight01: exerciseData.weight_01 || null,
                        set02Rep: exerciseData.set_02_rep || null,
                        weight02: exerciseData.weight_02 || null,
                        set03Rep: exerciseData.set_03_rep || null,
                        weight03: exerciseData.weight_03 || null,
                        restSeconds: exerciseData.rest_seconds || null,
                        notes: exerciseData.notes || null,
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
    
    // Return full template
    const fakeReq: any = { user: { id: userId }, params: { id } };
    return await getWeekTemplate(fakeReq, res as any);
  } catch (err: any) {
    console.error('❌ [FITNESS] updateWeekTemplate error:', err.message || err);
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
    // Ensure tables exist before querying
    const { ensureFitnessTables } = await import('../utils/ensureFitnessTables');
    await ensureFitnessTables();
    let sql = `SELECT * FROM fitness_calendar_entries WHERE patient_user_id = :userId`;
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
    
    const rows: any = await sequelize.query(sql, { replacements: params, type: QueryTypes.SELECT });
    const entries = Array.isArray(rows) ? rows : [];
    
    // Get sessions for each entry
    for (const entry of entries) {
      const sessions: any = await sequelize.query(
        `SELECT * FROM fitness_calendar_sessions WHERE calendar_entry_id = :entryId ORDER BY session_order ASC`,
        { replacements: { entryId: entry.id }, type: QueryTypes.SELECT }
      );

      const sessionList = Array.isArray(sessions) ? sessions : [];
      for (const session of sessionList) {
        const exercises: any = await sequelize.query(
          `SELECT * FROM fitness_calendar_session_exercises WHERE calendar_session_id = :sessionId ORDER BY exercise_order ASC`,
          { replacements: { sessionId: session.id }, type: QueryTypes.SELECT }
        );
        const exerciseList = Array.isArray(exercises) ? exercises : [];
        session.exercises = exerciseList;
      }

      entry.sessions = sessionList;
    }
    
    return res.json({ entries });
  } catch (err: any) {
    console.error('❌ [FITNESS] getCalendarEntries error:', err.message || err);
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
    // Ensure tables exist before querying
    const { ensureFitnessTables } = await import('../utils/ensureFitnessTables');
    await ensureFitnessTables();
    const { date } = req.params;
    
    const rows: any = await sequelize.query(
      `SELECT * FROM fitness_calendar_entries WHERE patient_user_id = :userId AND date = :date`,
      { replacements: { userId: targetUserId, date }, type: QueryTypes.SELECT }
    );

    const entryRows = Array.isArray(rows) ? rows : [];
    if (entryRows.length === 0) {
      return res.json({ entry: null });
    }
    
    const entry = entryRows[0];
    
    // Get sessions
    const sessions: any = await sequelize.query(
      `SELECT * FROM fitness_calendar_sessions WHERE calendar_entry_id = :entryId ORDER BY session_order ASC`,
      { replacements: { entryId: entry.id }, type: QueryTypes.SELECT }
    );
    
    const sessionList = Array.isArray(sessions) ? sessions : [];
    for (const session of sessionList) {
      const exercises: any = await sequelize.query(
        `SELECT * FROM fitness_calendar_session_exercises WHERE calendar_session_id = :sessionId ORDER BY exercise_order ASC`,
        { replacements: { sessionId: session.id }, type: QueryTypes.SELECT }
      );
      const exerciseList = Array.isArray(exercises) ? exercises : [];
      session.exercises = exerciseList;
    }
    
    entry.sessions = sessionList;
    
    return res.json({ entry });
  } catch (err: any) {
    console.error('❌ [FITNESS] getCalendarEntry error:', err.message || err);
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
    // Ensure tables exist before creating
    const { ensureFitnessTables } = await import('../utils/ensureFitnessTables');
    await ensureFitnessTables();
    const { date, week_template_id, template_day_id, is_override, is_rest_day, notes, sessions = [] } = req.body || {};
    
    if (!date) {
      return res.status(400).json({ message: 'date is required' });
    }
    
    const entryId = uuidv4();
    
    // Create or update entry
    await sequelize.query(
      `INSERT INTO fitness_calendar_entries (id, patient_user_id, date, week_template_id, template_day_id, is_override, is_rest_day, notes)
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
      `SELECT id FROM fitness_calendar_entries WHERE patient_user_id = :userId AND date = :date`,
      { replacements: { userId: targetUserId, date }, type: QueryTypes.SELECT }
    );
    const resolvedEntryId = Array.isArray(entryRows) && entryRows.length > 0 ? entryRows[0].id : entryId;
    
    // Delete existing sessions if override
    if (is_override && sessions.length > 0) {
      await sequelize.query(
        `DELETE FROM fitness_calendar_sessions WHERE calendar_entry_id = :entryId`,
        { replacements: { entryId: resolvedEntryId }, type: QueryTypes.DELETE }
      );
    }
    
    const weekTemplateId = week_template_id || null;
    // Create sessions
    for (const sessionData of sessions) {
      const sessionId = uuidv4();
      await sequelize.query(
        `INSERT INTO fitness_calendar_sessions (id, calendar_entry_id, session_name, session_order, notes, week_template_id)
         VALUES (:id, :entryId, :sessionName, :sessionOrder, :notes, :weekTemplateId)`,
        {
          replacements: {
            id: sessionId,
            entryId: resolvedEntryId,
            sessionName: sessionData.session_name,
            sessionOrder: sessionData.session_order || 0,
            notes: sessionData.notes || null,
            weekTemplateId,
          },
          type: QueryTypes.INSERT,
        }
      );
      
      if (sessionData.exercises && Array.isArray(sessionData.exercises)) {
        for (const exerciseData of sessionData.exercises) {
          const dur = exerciseData.duration;
          const durationNum = typeof dur === 'number' && !Number.isNaN(dur) ? dur : (typeof dur === 'string' ? parseInt(dur, 10) : null);
          const durationText = typeof dur === 'string' && Number.isNaN(parseInt(dur, 10)) ? dur : null;
          await sequelize.query(
            `INSERT INTO fitness_calendar_session_exercises (id, calendar_session_id, exercise_template_id, exercise_name, exercise_order, sets, reps, duration, duration_text, weight, weight_unit, set_01_rep, weight_01, set_02_rep, weight_02, set_03_rep, weight_03, rest_seconds, notes)
             VALUES (:id, :sessionId, :templateId, :exerciseName, :exerciseOrder, :sets, :reps, :duration, :durationText, :weight, :weightUnit, :set01Rep, :weight01, :set02Rep, :weight02, :set03Rep, :weight03, :restSeconds, :notes)`,
            {
              replacements: {
                id: uuidv4(),
                sessionId,
                templateId: exerciseData.exercise_template_id || null,
                exerciseName: exerciseData.exercise_name,
                exerciseOrder: exerciseData.exercise_order || 0,
                sets: exerciseData.sets || null,
                reps: exerciseData.reps || null,
                duration: Number.isInteger(durationNum) ? durationNum : null,
                durationText: durationText || null,
                weight: exerciseData.weight || null,
                weightUnit: exerciseData.weight_unit || null,
                set01Rep: exerciseData.set_01_rep || null,
                weight01: exerciseData.weight_01 || null,
                set02Rep: exerciseData.set_02_rep || null,
                weight02: exerciseData.weight_02 || null,
                set03Rep: exerciseData.set_03_rep || null,
                weight03: exerciseData.weight_03 || null,
                restSeconds: exerciseData.rest_seconds || null,
                notes: exerciseData.notes || null,
              },
              type: QueryTypes.INSERT,
            }
          );
        }
      }
    }
    
    // Return full entry
    const fakeReq: any = { user: { id: targetUserId }, params: { date }, query: { client_id: targetUserId } };
    return await getCalendarEntry(fakeReq, res as any);
  } catch (err: any) {
    console.error('❌ [FITNESS] createCalendarEntry error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

/** Apply a weekly template to a date range (creates/updates calendar entries and sessions per day). */
export const applyCalendarWeek = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.body.client_id;
  const targetUserId = clientId || userId;
  const { start_date, end_date, week_template_id } = req.body || {};
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  if (!start_date || !end_date || !week_template_id) {
    return res.status(400).json({ message: 'start_date, end_date, and week_template_id are required' });
  }

  try {
    const sequelize = await getAppSequelize();
    const { ensureFitnessTables } = await import('../utils/ensureFitnessTables');
    await ensureFitnessTables();

    const templateRows: any = await sequelize.query(
      `SELECT * FROM fitness_week_templates WHERE id = :id`,
      { replacements: { id: week_template_id }, type: QueryTypes.SELECT }
    );
    if (!Array.isArray(templateRows) || templateRows.length === 0) {
      return res.status(404).json({ message: 'Week template not found' });
    }

    const daysRaw: any = await sequelize.query(
      `SELECT * FROM fitness_template_days WHERE week_template_id = :id ORDER BY day_of_week ASC`,
      { replacements: { id: week_template_id }, type: QueryTypes.SELECT }
    );
    const dayList = Array.isArray(daysRaw) ? daysRaw : [];
    const templateDaysByDow: Record<number, any> = {};
    for (const d of dayList) {
      templateDaysByDow[d.day_of_week] = d;
    }
    for (const day of dayList) {
      const sessionsRaw: any = await sequelize.query(
        `SELECT * FROM fitness_sessions WHERE template_day_id = :dayId ORDER BY session_order ASC`,
        { replacements: { dayId: day.id }, type: QueryTypes.SELECT }
      );
      day.sessions = Array.isArray(sessionsRaw) ? sessionsRaw : [];
      for (const session of day.sessions) {
        const exRaw: any = await sequelize.query(
          `SELECT * FROM fitness_session_exercises WHERE session_id = :sessionId ORDER BY exercise_order ASC`,
          { replacements: { sessionId: session.id }, type: QueryTypes.SELECT }
        );
        session.exercises = Array.isArray(exRaw) ? exRaw : [];
      }
    }

    // Use UTC so calendar dates (YYYY-MM-DD) map to weekdays consistently: Mon=0, Sun=6
    const start = new Date(start_date + 'T00:00:00.000Z');
    const end = new Date(end_date + 'T00:00:00.000Z');
    const applied: string[] = [];
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      const dayOfWeek = (d.getUTCDay() + 6) % 7; // 0=Monday .. 6=Sunday (matches WeeklyPlanBuilder DAYS order)
      const templateDay = templateDaysByDow[dayOfWeek];
      if (!templateDay || !templateDay.sessions?.length) continue;

      const entryRows: any = await sequelize.query(
        `SELECT id FROM fitness_calendar_entries WHERE patient_user_id = :userId AND date = :date`,
        { replacements: { userId: targetUserId, date: dateKey }, type: QueryTypes.SELECT }
      );
      let entryId: string;
      if (Array.isArray(entryRows) && entryRows.length > 0) {
        entryId = entryRows[0].id;
      } else {
        entryId = uuidv4();
        await sequelize.query(
          `INSERT INTO fitness_calendar_entries (id, patient_user_id, date, week_template_id, template_day_id, is_override, is_rest_day, notes)
           VALUES (:id, :userId, :date, :weekTemplateId, :templateDayId, FALSE, FALSE, NULL)`,
          {
            replacements: {
              id: entryId,
              userId: targetUserId,
              date: dateKey,
              weekTemplateId: week_template_id,
              templateDayId: templateDay.id,
            },
            type: QueryTypes.INSERT,
          }
        );
      }

      await sequelize.query(
        `DELETE FROM fitness_calendar_sessions WHERE calendar_entry_id = :entryId AND week_template_id = :weekTemplateId`,
        { replacements: { entryId, weekTemplateId: week_template_id }, type: QueryTypes.DELETE }
      );

      let sessionOrder = 0;
      const existingSessions: any = await sequelize.query(
        `SELECT session_order FROM fitness_calendar_sessions WHERE calendar_entry_id = :entryId ORDER BY session_order DESC LIMIT 1`,
        { replacements: { entryId }, type: QueryTypes.SELECT }
      );
      if (Array.isArray(existingSessions) && existingSessions.length > 0) {
        sessionOrder = (existingSessions[0].session_order ?? -1) + 1;
      }
      for (const session of templateDay.sessions) {
        const calSessionId = uuidv4();
        await sequelize.query(
          `INSERT INTO fitness_calendar_sessions (id, calendar_entry_id, session_name, session_order, notes, week_template_id)
           VALUES (:id, :entryId, :sessionName, :sessionOrder, :notes, :weekTemplateId)`,
          {
            replacements: {
              id: calSessionId,
              entryId,
              sessionName: session.session_name,
              sessionOrder: sessionOrder++,
              notes: session.notes || null,
              weekTemplateId: week_template_id,
            },
            type: QueryTypes.INSERT,
          }
        );
        for (const exercise of session.exercises || []) {
          const dur = exercise.duration;
          const durationNum = typeof dur === 'number' && !Number.isNaN(dur) ? dur : (typeof dur === 'string' ? parseInt(dur, 10) : null);
          const durationText =
            exercise.duration_text ||
            (typeof dur === 'string' && Number.isNaN(parseInt(dur, 10)) ? dur : null);
          await sequelize.query(
            `INSERT INTO fitness_calendar_session_exercises (id, calendar_session_id, exercise_template_id, exercise_name, exercise_order, sets, reps, duration, duration_text, weight, weight_unit, set_01_rep, weight_01, set_02_rep, weight_02, set_03_rep, weight_03, rest_seconds, notes)
             VALUES (:id, :sessionId, :templateId, :exerciseName, :exerciseOrder, :sets, :reps, :duration, :durationText, :weight, :weightUnit, :set01Rep, :weight01, :set02Rep, :weight02, :set03Rep, :weight03, :restSeconds, :notes)`,
            {
              replacements: {
                id: uuidv4(),
                sessionId: calSessionId,
                templateId: exercise.exercise_template_id || null,
                exerciseName: exercise.exercise_name,
                exerciseOrder: exercise.exercise_order ?? 0,
                sets: exercise.sets ?? null,
                reps: exercise.reps ?? null,
                duration: Number.isInteger(durationNum) ? durationNum : null,
                durationText: durationText || null,
                weight: exercise.weight ?? null,
                weightUnit: exercise.weight_unit ?? null,
                set01Rep: exercise.set_01_rep ?? null,
                weight01: exercise.weight_01 ?? null,
                set02Rep: exercise.set_02_rep ?? null,
                weight02: exercise.weight_02 ?? null,
                set03Rep: exercise.set_03_rep ?? null,
                weight03: exercise.weight_03 ?? null,
                restSeconds: exercise.rest_seconds ?? null,
                notes: exercise.notes ?? null,
              },
              type: QueryTypes.INSERT,
            }
          );
        }
      }
      applied.push(dateKey);
    }
    return res.json({ applied, message: `Template applied to ${applied.length} day(s)` });
  } catch (err: any) {
    console.error('❌ [FITNESS] applyCalendarWeek error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

/** Remove sessions from calendar in a date range that belong to the given week template. */
export const removeCalendarWeek = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.body.client_id;
  const targetUserId = clientId || userId;
  const { start_date, end_date, week_template_id } = req.body || {};
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  if (!start_date || !end_date || !week_template_id) {
    return res.status(400).json({ message: 'start_date, end_date, and week_template_id are required' });
  }

  try {
    const sequelize = await getAppSequelize();
    const { ensureFitnessTables } = await import('../utils/ensureFitnessTables');
    await ensureFitnessTables();

    const entries: any = await sequelize.query(
      `SELECT id FROM fitness_calendar_entries WHERE patient_user_id = :userId AND date >= :startDate AND date <= :endDate`,
      {
        replacements: { userId: targetUserId, startDate: start_date, endDate: end_date },
        type: QueryTypes.SELECT,
      }
    );
    const entryList = Array.isArray(entries) ? entries : [];
    if (entryList.length === 0) {
      return res.json({ removed: 0, message: 'No calendar entries in range' });
    }

    let removedCount = 0;
    for (const row of entryList) {
      const entryId = row.id;
      const sessionsToDelete: any = await sequelize.query(
        `SELECT id FROM fitness_calendar_sessions WHERE calendar_entry_id = :entryId AND week_template_id = :weekTemplateId`,
        { replacements: { entryId, weekTemplateId: week_template_id }, type: QueryTypes.SELECT }
      );
      const sessionIds = Array.isArray(sessionsToDelete) ? sessionsToDelete.map((s: any) => s.id) : [];
      for (const sessionId of sessionIds) {
        await sequelize.query(
          `DELETE FROM fitness_calendar_session_exercises WHERE calendar_session_id = :sessionId`,
          { replacements: { sessionId }, type: QueryTypes.DELETE }
        );
      }
      await sequelize.query(
        `DELETE FROM fitness_calendar_sessions WHERE calendar_entry_id = :entryId AND week_template_id = :weekTemplateId`,
        { replacements: { entryId, weekTemplateId: week_template_id }, type: QueryTypes.DELETE }
      );
      removedCount += sessionIds.length;

      const remaining: any = await sequelize.query(
        `SELECT 1 FROM fitness_calendar_sessions WHERE calendar_entry_id = :entryId LIMIT 1`,
        { replacements: { entryId }, type: QueryTypes.SELECT }
      );
      if (!Array.isArray(remaining) || remaining.length === 0) {
        await sequelize.query(
          `DELETE FROM fitness_calendar_entries WHERE id = :entryId`,
          { replacements: { entryId }, type: QueryTypes.DELETE }
        );
      }
    }
    return res.json({ removed: removedCount, message: `Template removed from week` });
  } catch (err: any) {
    console.error('❌ [FITNESS] removeCalendarWeek error:', err.message || err);
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
    // Ensure tables exist before querying
    const { ensureFitnessTables } = await import('../utils/ensureFitnessTables');
    await ensureFitnessTables();
    let sql = `SELECT * FROM fitness_tracking WHERE patient_user_id = :userId`;
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
    
    const rows: any = await sequelize.query(sql, { replacements: params, type: QueryTypes.SELECT });
    const trackingRows = Array.isArray(rows) ? rows : [];
    return res.json({ tracking: trackingRows });
  } catch (err: any) {
    console.error('❌ [FITNESS] getTracking error:', err.message || err);
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
      calendar_entry_id, calendar_session_id, calendar_exercise_id,
      tracked_date, completion_status, completed_sets, completed_reps,
      completed_duration, completed_weight, completed_sets_detail,
      notes, pictures, rating
    } = req.body || {};
    
    if (!tracked_date) {
      return res.status(400).json({ message: 'tracked_date is required' });
    }
    
    const [rows]: any = await sequelize.query(
      `INSERT INTO fitness_tracking (id, patient_user_id, calendar_entry_id, calendar_session_id, calendar_exercise_id, tracked_date, completion_status, completed_sets, completed_reps, completed_duration, completed_weight, completed_sets_detail, notes, pictures, rating)
       VALUES (:id, :userId, :entryId, :sessionId, :exerciseId, :trackedDate, :status, :sets, :reps, :duration, :weight, :setsDetail::jsonb, :notes, :pictures::text[], :rating)
       RETURNING *`,
      {
        replacements: {
          id: uuidv4(),
          userId: targetUserId,
          entryId: calendar_entry_id || null,
          sessionId: calendar_session_id || null,
          exerciseId: calendar_exercise_id || null,
          trackedDate: tracked_date,
          status: completion_status || 'pending',
          sets: completed_sets || null,
          reps: completed_reps || null,
          duration: completed_duration || null,
          weight: completed_weight || null,
          setsDetail: completed_sets_detail ? JSON.stringify(completed_sets_detail) : null,
          notes: notes || null,
          pictures: pictures ? JSON.stringify(pictures) : null,
          rating: rating || null,
        },
        type: QueryTypes.INSERT,
      }
    );
    
    return res.json({ tracking: Array.isArray(rows) ? rows[0] : rows });
  } catch (err: any) {
    console.error('❌ [FITNESS] createTracking error:', err.message || err);
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
        if (key === 'pictures') {
          updateFields.push(`${key} = :${key}::text[]`);
          params[key] = JSON.stringify(updates[key]);
        } else if (key === 'completed_sets_detail') {
          updateFields.push(`${key} = :${key}::jsonb`);
          params[key] = JSON.stringify(updates[key]);
        } else {
          updateFields.push(`${key} = :${key}`);
          params[key] = updates[key];
        }
      }
    });
    
    if (updateFields.length === 0) {
      return res.json({ message: 'No updates provided' });
    }
    
    updateFields.push('updated_at = NOW()');
    
    const sql = `UPDATE fitness_tracking SET ${updateFields.join(', ')} WHERE id = :id AND patient_user_id = :userId RETURNING *`;
    const raw: any = await sequelize.query(sql, { replacements: params });
    const rows = Array.isArray(raw) ? (Array.isArray(raw[0]) ? raw[0] : raw) : [];
    const rowsArray = Array.isArray(rows) ? rows : [];
    
    if (rowsArray.length === 0) {
      return res.status(404).json({ message: 'Not found' });
    }
    
    return res.json({ tracking: rowsArray[0] });
  } catch (err: any) {
    console.error('❌ [FITNESS] updateTracking error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

// ========== PROGRESS & STREAK ==========

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
    const statsRows: any = await sequelize.query(
      `SELECT 
        COUNT(*) FILTER (WHERE completion_status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE completion_status = 'skipped') as skipped_count,
        COUNT(*) FILTER (WHERE completion_status = 'partial') as partial_count,
        COUNT(*) as total_count
       FROM fitness_tracking
       WHERE patient_user_id = :userId AND tracked_date >= :startDate AND tracked_date <= :endDate`,
      {
        replacements: { userId: targetUserId, startDate, endDate },
        type: QueryTypes.SELECT,
      }
    );
    
    // Calculate streak
    const streakRowsRaw: any = await sequelize.query(
      `SELECT tracked_date, completion_status
       FROM fitness_tracking
       WHERE patient_user_id = :userId AND completion_status IN ('completed', 'partial')
       ORDER BY tracked_date DESC
       LIMIT 30`,
      { replacements: { userId: targetUserId }, type: QueryTypes.SELECT }
    );

    const statsList = Array.isArray(statsRows) ? statsRows : [];
    const stats = statsList[0] || { completed_count: 0, skipped_count: 0, partial_count: 0, total_count: 0 };

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
      streak,
      period: { start_date: startDate, end_date: endDate },
    });
  } catch (err: any) {
    console.error('❌ [FITNESS] getProgress error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};
