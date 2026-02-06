import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { QueryTypes } from 'sequelize';
import { Storage } from '@google-cloud/storage';
import { SpeechClient } from '@google-cloud/speech';
import { summarizeAppointmentAudioFromBase64, summarizeAppointmentText } from '../services/geminiAIService';
import {
  extractTestResultData,
  extractTestResultDataFromBase64,
  ExtractedTestResultData
} from '../services/geminiAIService';

// Fallback in-memory stores
const inMemoryAppointments: any[] = [];
const inMemoryVitals: any[] = [];
const inMemoryMedicines: any[] = [];
const inMemoryDiagnostics: any[] = [];
const inMemoryReports: any[] = [];

const getAppSequelize = async () => {
  const db = await import('../config/database-integrated');
  return db.appSequelize;
};

const getSharedSequelize = async () => {
  const db = await import('../config/database-integrated');
  return db.sharedSequelize;
};

const ensureHealthTablesReady = async () => {
  const { ensureHealthTables } = await import('../utils/ensureHealthTables');
  await ensureHealthTables();
};

const getGoogleAuthOptions = () => {
  if (process.env.GCP_SERVICE_ACCOUNT_JSON) {
    return { credentials: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON) };
  }
  return undefined;
};

const getStorageClient = () => {
  const options = getGoogleAuthOptions();
  return new Storage(options);
};

const getSpeechClient = () => {
  const options = getGoogleAuthOptions();
  return new SpeechClient(options);
};

const getGcsBucketName = () => process.env.GCS_BUCKET || '';

const createSignedUploadUrl = async (objectPath: string, contentType: string) => {
  const bucketName = getGcsBucketName();
  if (!bucketName) throw new Error('GCS_BUCKET not configured');
  const storage = getStorageClient();
  const file = storage.bucket(bucketName).file(objectPath);
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 15 * 60 * 1000,
    contentType,
  });
  const fileUrl = `https://storage.googleapis.com/${bucketName}/${objectPath}`;
  const gcsPath = `gs://${bucketName}/${objectPath}`;
  return { uploadUrl: url, fileUrl, gcsPath };
};

const getSignedReadUrl = async (objectPath: string) => {
  const bucketName = getGcsBucketName();
  if (!bucketName) throw new Error('GCS_BUCKET not configured');
  const storage = getStorageClient();
  const file = storage.bucket(bucketName).file(objectPath);
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000,
  });
  return url;
};

const downloadGcsObjectAsBase64 = async (gcsPath: string) => {
  const match = gcsPath.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) throw new Error('Invalid GCS path');
  const [, bucketName, objectPath] = match;
  const storage = getStorageClient();
  const [buffer] = await storage.bucket(bucketName).file(objectPath).download();
  return buffer.toString('base64');
};

export const getSignedUploadUrl = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const { appointment_id, category, file_name, content_type } = req.body || {};
    if (!appointment_id || !category || !file_name || !content_type) {
      return res.status(400).json({ message: 'appointment_id, category, file_name, content_type are required' });
    }
    const safeName = String(file_name).replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectPath = `appointments/${appointment_id}/${category}/${Date.now()}-${safeName}`;
    const signed = await createSignedUploadUrl(objectPath, content_type);
    return res.json(signed);
  } catch (err: any) {
    console.error('❌ [HEALTH] getSignedUploadUrl error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const testSignedUploadFlow = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const { file_name, content_type } = req.body || {};
    if (!file_name || !content_type) {
      return res.status(400).json({ message: 'file_name and content_type are required' });
    }
    const safeName = String(file_name).replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectPath = `tests/${Date.now()}-${safeName}`;
    const signed = await createSignedUploadUrl(objectPath, content_type);
    const readUrl = await getSignedReadUrl(objectPath);
    return res.json({ ...signed, readUrl });
  } catch (err: any) {
    console.error('❌ [HEALTH] testSignedUploadFlow error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

const describeTableSafe = async (table: string) => {
  try {
    const sequelize = await getAppSequelize();
    const qi = sequelize.getQueryInterface();
    return await qi.describeTable(table);
  } catch (err) {
    console.error(`⚠️ [HEALTH] describeTable failed for ${table}:`, (err as any)?.message || err);
    return null;
  }
};

// Column resolvers
const resolveAppointmentColumns = (cols: Record<string, any> | null) => {
  const columnNames = cols ? Object.keys(cols) : [];
  const pick = (...names: string[]) => names.find((n) => columnNames.includes(n)) || null;
  return {
    patientCol: pick('patient_user_id', 'patient_id', 'user_id'),
    doctorCol: pick('doctor_user_id', 'doctor_id'),
    datetimeCol: pick('datetime', 'scheduled_at', 'start_time', 'appointment_time'),
    statusCol: pick('status'),
    titleCol: pick('title', 'purpose'),
    notesCol: pick('notes', 'description'),
    locationCol: pick('location', 'clinic', 'place'),
  };
};

const getDoctorNamesById = async (doctorIds: string[]) => {
  if (!doctorIds.length) return {};
  try {
    const sharedDb = await getSharedSequelize();
    const [rows]: any = await sharedDb.query(
      `SELECT id, name FROM users WHERE id IN (:ids)`,
      { replacements: { ids: doctorIds }, type: QueryTypes.SELECT }
    );
    const map: Record<string, string> = {};
    (rows || []).forEach((row: any) => {
      if (row?.id) map[row.id] = row.name || '';
    });
    return map;
  } catch (err: any) {
    console.error('⚠️ [HEALTH] getDoctorNamesById error:', err.message || err);
    return {};
  }
};

const getAppointmentById = async (appointmentId: string, targetUserId: string) => {
  const sequelize = await getAppSequelize();
  const cols = await describeTableSafe('appointments');
  const { patientCol, doctorCol, datetimeCol } = resolveAppointmentColumns(cols);
  if (!cols || !patientCol) return null;

  const [rows]: any = await sequelize.query(
    `SELECT * FROM appointments WHERE id = :id AND "${patientCol}" = :userId`,
    { replacements: { id: appointmentId, userId: targetUserId }, type: QueryTypes.SELECT }
  );
  if (!rows || rows.length === 0) return null;
  const appointment = rows[0];
  if (doctorCol && appointment[doctorCol]) {
    const doctorMap = await getDoctorNamesById([appointment[doctorCol]]);
    appointment.doctor_name = doctorMap[appointment[doctorCol]] || null;
  }
  if (datetimeCol && !appointment.datetime) {
    appointment.datetime = appointment[datetimeCol];
  }
  return appointment;
};

const resolveVitalColumns = (cols: Record<string, any> | null) => {
  const columnNames = cols ? Object.keys(cols) : [];
  const pick = (...names: string[]) => names.find((n) => columnNames.includes(n)) || null;
  return {
    patientCol: pick('patient_user_id', 'patient_id', 'user_id'),
    parameterCol: pick('parameter_name', 'parameter', 'name'),
    valueCol: pick('value'),
    unitCol: pick('unit'),
    measuredAtCol: pick('recorded_date', 'measured_at', 'recorded_at', 'date'),
    referenceRangeCol: pick('normal_range_min', 'normal_range_max', 'reference_range'),
    sourceReportCol: pick('test_result_id', 'source_report_id', 'report_id'),
    sourceCol: pick('source', 'source_type'),
  };
};

const ensureHealthReportsTable = async () => {
  const sequelize = await getAppSequelize();
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS health_reports (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      file_url TEXT,
      file_base64 TEXT,
      file_name TEXT,
      file_type TEXT,
      status TEXT,
      uploaded_at TIMESTAMPTZ DEFAULT NOW(),
      extracted_at TIMESTAMPTZ,
      extraction JSONB
    )
  `);
};

const readHealthReport = async (reportId: string, ownerUserId: string) => {
  const sequelize = await getAppSequelize();
  const [rows]: any = await sequelize.query(
    `SELECT * FROM health_reports WHERE id = :reportId AND owner_user_id = :ownerUserId LIMIT 1`,
    { replacements: { reportId, ownerUserId }, type: QueryTypes.SELECT }
  );
  return Array.isArray(rows) ? rows[0] : rows;
};

const insertHealthReport = async (payload: any) => {
  const sequelize = await getAppSequelize();
  const [rows]: any = await sequelize.query(
    `INSERT INTO health_reports
      (id, owner_user_id, uploaded_by, file_url, file_base64, file_name, file_type, status, uploaded_at, extracted_at, extraction)
     VALUES
      (:id, :owner_user_id, :uploaded_by, :file_url, :file_base64, :file_name, :file_type, :status, :uploaded_at, :extracted_at, :extraction::jsonb)
     RETURNING *`,
    {
      replacements: {
        ...payload,
        extraction: payload.extraction ? JSON.stringify(payload.extraction) : null,
      },
      type: QueryTypes.INSERT,
    }
  );
  return Array.isArray(rows) ? rows[0] : rows;
};

const updateHealthReportExtraction = async (reportId: string, ownerUserId: string, update: any) => {
  const sequelize = await getAppSequelize();
  const [rows]: any = await sequelize.query(
    `UPDATE health_reports
     SET status = :status,
         extracted_at = :extracted_at,
         extraction = :extraction::jsonb
     WHERE id = :reportId AND owner_user_id = :ownerUserId
     RETURNING *`,
    {
      replacements: {
        reportId,
        ownerUserId,
        status: update.status,
        extracted_at: update.extracted_at,
        extraction: update.extraction ? JSON.stringify(update.extraction) : null,
      },
      type: QueryTypes.UPDATE,
    }
  );
  return Array.isArray(rows) ? rows[0] : rows;
};

const insertAppointmentFile = async (payload: any) => {
  const sequelize = await getAppSequelize();
  const [rows]: any = await sequelize.query(
    `INSERT INTO appointment_files
      (id, appointment_id, patient_user_id, category, sub_type, file_url, storage_path, file_name, file_type, file_size, created_by)
     VALUES
      (:id, :appointment_id, :patient_user_id, :category, :sub_type, :file_url, :storage_path, :file_name, :file_type, :file_size, :created_by)
     RETURNING *`,
    { replacements: payload, type: QueryTypes.INSERT }
  );
  return Array.isArray(rows) ? rows[0] : rows;
};

const fetchAppointmentFileRecord = async (fileId: string, patientUserId: string) => {
  const sequelize = await getAppSequelize();
  const [rows]: any = await sequelize.query(
    `SELECT * FROM appointment_files WHERE id = :id AND patient_user_id = :userId LIMIT 1`,
    { replacements: { id: fileId, userId: patientUserId }, type: QueryTypes.SELECT }
  );
  return Array.isArray(rows) ? rows[0] : rows;
};

const updateAppointmentDetailsAudio = async (appointmentId: string, patientUserId: string, audioClips: any[]) => {
  const sequelize = await getAppSequelize();
  const [rows]: any = await sequelize.query(
    `UPDATE appointment_details
     SET audio_clips = :audioClips::jsonb, updated_at = NOW()
     WHERE appointment_id = :appointmentId AND patient_user_id = :userId
     RETURNING *`,
    {
      replacements: {
        appointmentId,
        userId: patientUserId,
        audioClips: JSON.stringify(audioClips || []),
      },
      type: QueryTypes.UPDATE,
    }
  );
  return Array.isArray(rows) ? rows[0] : rows;
};

// ========== APPOINTMENTS ==========

export const getAppointments = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.query.client_id; // For doctors viewing patient data
  const targetUserId = clientId || userId;
  
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    const sequelize = await getAppSequelize();
    const cols = await describeTableSafe('appointments');
    const { patientCol, doctorCol, datetimeCol } = resolveAppointmentColumns(cols);

    if (!cols || !patientCol) {
      const items = inMemoryAppointments.filter((a) => a.patient_user_id === targetUserId);
      return res.json({ appointments: items });
    }

    const selectColumns = ['id', patientCol, doctorCol, datetimeCol, 'title', 'status', 'location', 'notes']
      .filter(Boolean)
      .map((c) => `"${c}"`)
      .join(', ');

    // Get attachments count for each appointment
    const [rows]: any = await sequelize.query(
      `SELECT ${selectColumns} FROM appointments WHERE "${patientCol}" = :userId ORDER BY ${datetimeCol ? `"${datetimeCol}"` : '"created_at"'} DESC`,
      { replacements: { userId: targetUserId }, type: QueryTypes.SELECT }
    );

    const doctorIds: string[] = doctorCol
      ? Array.from(new Set(rows.map((row: any) => row[doctorCol]).filter(Boolean).map((id: any) => String(id))))
      : [];
    const doctorMap = await getDoctorNamesById(doctorIds);

    // Fetch attachments for each appointment
    for (const row of rows) {
      try {
        const [attachments]: any = await sequelize.query(
          `SELECT id, attachment_type, file_name FROM appointment_attachments WHERE appointment_id = :appointmentId`,
          { replacements: { appointmentId: row.id }, type: QueryTypes.SELECT }
        );
        row.attachments = attachments || [];
        row.attachment_count = attachments?.length || 0;
      } catch (e) {
        row.attachments = [];
        row.attachment_count = 0;
      }
      if (doctorCol && row[doctorCol]) {
        row.doctor_name = doctorMap[row[doctorCol]] || null;
      }
      if (datetimeCol && !row.datetime) {
        row.datetime = row[datetimeCol];
      }
    }

    return res.json({ appointments: rows || [] });
  } catch (err: any) {
    console.error('❌ [HEALTH] getAppointments error:', err.message || err);
    const items = inMemoryAppointments.filter((a) => a.patient_user_id === targetUserId);
    return res.json({ appointments: items, warning: 'DB unavailable, using in-memory data' });
  }
};

export const getAppointment = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    const sequelize = await getAppSequelize();
    const cols = await describeTableSafe('appointments');
    const { patientCol, doctorCol } = resolveAppointmentColumns(cols);

    if (!cols || !patientCol) {
      const item = inMemoryAppointments.find((a) => a.id === id);
      return item ? res.json({ appointment: item }) : res.status(404).json({ message: 'Not found' });
    }

    const [rows]: any = await sequelize.query(
      `SELECT * FROM appointments WHERE id = :id AND "${patientCol}" = :userId`,
      { replacements: { id, userId }, type: QueryTypes.SELECT }
    );

    if (rows.length === 0) return res.status(404).json({ message: 'Not found' });

    const appointment = rows[0];

    if (doctorCol && appointment[doctorCol]) {
      const doctorMap = await getDoctorNamesById([appointment[doctorCol]]);
      appointment.doctor_name = doctorMap[appointment[doctorCol]] || null;
    }

    // Get attachments
    try {
      const [attachments]: any = await sequelize.query(
        `SELECT * FROM appointment_attachments WHERE appointment_id = :appointmentId ORDER BY created_at DESC`,
        { replacements: { appointmentId: id }, type: QueryTypes.SELECT }
      );
      appointment.attachments = attachments || [];
    } catch (e) {
      appointment.attachments = [];
    }

    return res.json({ appointment });
  } catch (err: any) {
    console.error('❌ [HEALTH] getAppointment error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const getAppointmentDetails = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.query.client_id;
  const targetUserId = clientId || userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    await ensureHealthTablesReady();
    const appointment = await getAppointmentById(req.params.id, targetUserId);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

    const sequelize = await getAppSequelize();
    const [rows]: any = await sequelize.query(
      `SELECT * FROM appointment_details WHERE appointment_id = :appointmentId AND patient_user_id = :userId`,
      { replacements: { appointmentId: req.params.id, userId: targetUserId }, type: QueryTypes.SELECT }
    );
    if (!rows || rows.length === 0) {
      return res.json({
        details: {
          appointment_id: req.params.id,
          history: null,
          prescription: null,
          bills: null,
          audio_clips: [],
        },
      });
    }
    return res.json({ details: rows[0] });
  } catch (err: any) {
    console.error('❌ [HEALTH] getAppointmentDetails error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const updateAppointmentDetails = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.body?.client_id || req.query?.client_id;
  const targetUserId = clientId || userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    await ensureHealthTablesReady();
    const appointment = await getAppointmentById(req.params.id, targetUserId);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

    const sequelize = await getAppSequelize();
    const payload = {
      appointment_id: req.params.id,
      patient_user_id: targetUserId,
      history: req.body?.history || null,
      prescription: req.body?.prescription || null,
      bills: req.body?.bills || null,
      audio_clips: req.body?.audio_clips || [],
      created_by: userId,
    };

    const [rows]: any = await sequelize.query(
      `INSERT INTO appointment_details (appointment_id, patient_user_id, history, prescription, bills, audio_clips, created_by)
       VALUES (:appointment_id, :patient_user_id, :history::jsonb, :prescription::jsonb, :bills::jsonb, :audio_clips::jsonb, :created_by)
       ON CONFLICT (appointment_id)
       DO UPDATE SET
         history = EXCLUDED.history,
         prescription = EXCLUDED.prescription,
         bills = EXCLUDED.bills,
         audio_clips = EXCLUDED.audio_clips,
         updated_at = NOW()
       RETURNING *`,
      {
        replacements: {
          ...payload,
          history: payload.history ? JSON.stringify(payload.history) : null,
          prescription: payload.prescription ? JSON.stringify(payload.prescription) : null,
          bills: payload.bills ? JSON.stringify(payload.bills) : null,
          audio_clips: payload.audio_clips ? JSON.stringify(payload.audio_clips) : JSON.stringify([]),
        },
        type: QueryTypes.INSERT,
      }
    );

    return res.json({ details: Array.isArray(rows) ? rows[0] : rows });
  } catch (err: any) {
    console.error('❌ [HEALTH] updateAppointmentDetails error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const uploadAppointmentFile = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.body?.client_id || req.query?.client_id;
  const targetUserId = clientId || userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    await ensureHealthTablesReady();
    const appointment = await getAppointmentById(req.params.id, targetUserId);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

    const {
      category,
      sub_type,
      file_url,
      storage_path,
      file_name,
      file_type,
      file_size,
    } = req.body || {};

    if (!category || !file_url || !storage_path) {
      return res.status(400).json({ message: 'category, file_url, and storage_path are required' });
    }

    const fileId = uuidv4();
    const file = await insertAppointmentFile({
      id: fileId,
      appointment_id: req.params.id,
      patient_user_id: targetUserId,
      category,
      sub_type: sub_type || null,
      file_url,
      storage_path,
      file_name: file_name || 'file',
      file_type: file_type || 'application/octet-stream',
      file_size: file_size || null,
      created_by: userId,
    });

    return res.json({ file });
  } catch (err: any) {
    console.error('❌ [HEALTH] uploadAppointmentFile error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const getAppointmentFile = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.query?.client_id;
  const targetUserId = clientId || userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    await ensureHealthTablesReady();
    const file = await fetchAppointmentFileRecord(req.params.fileId, targetUserId);
    if (!file) return res.status(404).json({ message: 'File not found' });
    if (!file.storage_path) {
      return res.status(404).json({ message: 'Storage path not available' });
    }
    const objectPath = file.storage_path.replace(/^gs:\/\/[^/]+\//, '');
    const signedUrl = await getSignedReadUrl(objectPath);
    return res.json({ url: signedUrl });
  } catch (err: any) {
    console.error('❌ [HEALTH] getAppointmentFile error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const summarizeAppointmentAudio = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.body?.client_id || req.query?.client_id;
  const targetUserId = clientId || userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    await ensureHealthTablesReady();
    const appointment = await getAppointmentById(req.params.id, targetUserId);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

    const { file_id } = req.body || {};
    if (!file_id) return res.status(400).json({ message: 'file_id is required' });

    const file = await fetchAppointmentFileRecord(file_id, targetUserId);
    if (!file || !file.storage_path) {
      return res.status(404).json({ message: 'Audio file not found' });
    }

    let summary = await (async () => {
      try {
        const base64 = await downloadGcsObjectAsBase64(file.storage_path);
        return await summarizeAppointmentAudioFromBase64(base64, file.file_type || 'audio/webm');
      } catch (error: any) {
        console.error('⚠️ [HEALTH] Gemini audio failed, falling back to STT:', error.message || error);
        return null;
      }
    })();

    if (!summary || (summary.confidence ?? 0) < 0.3) {
      try {
        const speechClient = getSpeechClient();
        const [response] = await speechClient.recognize({
          config: {
            encoding: 'WEBM_OPUS',
            languageCode: 'en-US',
          },
          audio: {
            uri: file.storage_path,
          },
        });
        const transcript = (response.results || [])
          .map((r: any) => r.alternatives?.[0]?.transcript || '')
          .join(' ')
          .trim();
        if (transcript) {
          summary = await summarizeAppointmentText(transcript);
        }
      } catch (error: any) {
        console.error('❌ [HEALTH] STT fallback failed:', error.message || error);
      }
    }
    if (!summary) {
      summary = { summary: '', categories: [], confidence: 0 };
    }

    const sequelize = await getAppSequelize();
    const [rows]: any = await sequelize.query(
      `SELECT audio_clips FROM appointment_details WHERE appointment_id = :appointmentId AND patient_user_id = :userId`,
      { replacements: { appointmentId: req.params.id, userId: targetUserId }, type: QueryTypes.SELECT }
    );
    const clips = rows && rows.length > 0 ? rows[0].audio_clips || [] : [];
    const updatedClips = (clips || []).map((clip: any) => {
      if (clip.file_id === file_id) {
        return {
          ...clip,
          ai_summary: summary.summary || '',
          ai_categories: summary.categories || [],
          ai_key_points: summary.key_points || [],
          ai_confidence: summary.confidence || null,
        };
      }
      return clip;
    });
    await updateAppointmentDetailsAudio(req.params.id, targetUserId, updatedClips);

    return res.json({ summary });
  } catch (err: any) {
    console.error('❌ [HEALTH] summarizeAppointmentAudio error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const createAppointment = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.body.client_id; // For doctors creating appointments for patients
  const targetUserId = clientId || userId;
  
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const { title, datetime, location, notes, status = 'planned', doctor_user_id = null, attachments = [] } = req.body || {};

  try {
    const sequelize = await getAppSequelize();
    const cols = await describeTableSafe('appointments');
    const { patientCol, doctorCol, datetimeCol, statusCol, titleCol, notesCol, locationCol } = resolveAppointmentColumns(cols);

    if (!cols || !patientCol) {
      const payload = {
        id: uuidv4(),
        patient_user_id: targetUserId,
        title,
        datetime,
        location,
        notes,
        status,
        doctor_user_id,
        created_at: new Date().toISOString(),
      };
      inMemoryAppointments.unshift(payload);
      return res.json({ appointment: payload, warning: 'DB unavailable, stored in-memory' });
    }

    const insertCols: string[] = [];
    const values: string[] = [];
    const params: Record<string, any> = {};

    const pushCol = (colName: string | null, paramName: string, value: any) => {
      if (!colName) return;
      insertCols.push(`"${colName}"`);
      values.push(`:${paramName}`);
      params[paramName] = value;
    };

    const appointmentId = uuidv4();
    pushCol('id', 'id', appointmentId);
    pushCol(patientCol, 'patient', targetUserId);
    pushCol(doctorCol, 'doctor', doctor_user_id);
    pushCol(titleCol || 'title', 'title', title);
    pushCol(datetimeCol || 'datetime', 'datetime', datetime);
    pushCol(locationCol || 'location', 'location', location);
    pushCol(notesCol || 'notes', 'notes', notes);
    pushCol(statusCol || 'status', 'status', status);

    const sql = `INSERT INTO appointments (${insertCols.join(', ')}) VALUES (${values.join(', ')}) RETURNING *`;
    const [rows]: any = await sequelize.query(sql, { replacements: params, type: QueryTypes.INSERT });
    const created = Array.isArray(rows) ? rows[0] : rows;

    // Add attachments if provided
    if (Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        try {
          await sequelize.query(
            `INSERT INTO appointment_attachments (id, appointment_id, attachment_type, attachment_id, file_url, file_name, file_type, file_size, notes)
             VALUES (:id, :appointmentId, :type, :attachmentId, :url, :fileName, :fileType, :fileSize, :notes)`,
            {
              replacements: {
                id: uuidv4(),
                appointmentId: appointmentId,
                type: att.type || 'other',
                attachmentId: att.attachment_id || null,
                url: att.file_url || null,
                fileName: att.file_name || null,
                fileType: att.file_type || null,
                fileSize: att.file_size || null,
                notes: att.notes || null,
              },
              type: QueryTypes.INSERT,
            }
          );
        } catch (e: any) {
          console.warn('⚠️ [HEALTH] Failed to add attachment:', e?.message || e);
        }
      }
    }

    return res.json({ appointment: created });
  } catch (err: any) {
    console.error('❌ [HEALTH] createAppointment error:', err.message || err);
    const payload = {
      id: uuidv4(),
      patient_user_id: targetUserId,
      title,
      datetime,
      location,
      notes,
      status,
      doctor_user_id,
      created_at: new Date().toISOString(),
    };
    inMemoryAppointments.unshift(payload);
    return res.json({ appointment: payload, warning: 'DB unavailable, stored in-memory' });
  }
};

export const updateAppointment = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  const { title, datetime, location, notes, status } = req.body || {};

  try {
    const sequelize = await getAppSequelize();
    const cols = await describeTableSafe('appointments');
    const { patientCol, datetimeCol, statusCol, titleCol, notesCol, locationCol } = resolveAppointmentColumns(cols);

    if (!cols || !patientCol) {
      return res.status(503).json({ message: 'DB unavailable' });
    }

    const updates: string[] = [];
    const params: Record<string, any> = { id, userId };

    if (title !== undefined && titleCol) {
      updates.push(`"${titleCol}" = :title`);
      params.title = title;
    }
    if (datetime !== undefined && datetimeCol) {
      updates.push(`"${datetimeCol}" = :datetime`);
      params.datetime = datetime;
    }
    if (location !== undefined && locationCol) {
      updates.push(`"${locationCol}" = :location`);
      params.location = location;
    }
    if (notes !== undefined && notesCol) {
      updates.push(`"${notesCol}" = :notes`);
      params.notes = notes;
    }
    if (status !== undefined && statusCol) {
      updates.push(`"${statusCol}" = :status`);
      params.status = status;
    }

    if (updates.length === 0) {
      return res.json({ message: 'No updates provided' });
    }

    updates.push('updated_at = NOW()');

    const sql = `UPDATE appointments SET ${updates.join(', ')} WHERE id = :id AND "${patientCol}" = :userId RETURNING *`;
    const [rows]: any = await sequelize.query(sql, { replacements: params, type: QueryTypes.UPDATE });

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Not found' });
    }

    return res.json({ appointment: rows[0] });
  } catch (err: any) {
    console.error('❌ [HEALTH] updateAppointment error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const addAppointmentAttachment = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const { appointmentId } = req.params;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  const { type, attachment_id, file_url, file_name, file_type, file_size, notes } = req.body || {};

  try {
    const sequelize = await getAppSequelize();
    
    // Verify appointment belongs to user
    const cols = await describeTableSafe('appointments');
    const { patientCol } = resolveAppointmentColumns(cols);
    if (patientCol) {
      const [check]: any = await sequelize.query(
        `SELECT id FROM appointments WHERE id = :appointmentId AND "${patientCol}" = :userId`,
        { replacements: { appointmentId, userId }, type: QueryTypes.SELECT }
      );
      if (!check || check.length === 0) {
        return res.status(404).json({ message: 'Appointment not found' });
      }
    }

    const [rows]: any = await sequelize.query(
      `INSERT INTO appointment_attachments (id, appointment_id, attachment_type, attachment_id, file_url, file_name, file_type, file_size, notes)
       VALUES (:id, :appointmentId, :type, :attachmentId, :url, :fileName, :fileType, :fileSize, :notes)
       RETURNING *`,
      {
        replacements: {
          id: uuidv4(),
          appointmentId,
          type: type || 'other',
          attachmentId: attachment_id || null,
          url: file_url || null,
          fileName: file_name || null,
          fileType: file_type || null,
          fileSize: file_size || null,
          notes: notes || null,
        },
        type: QueryTypes.INSERT,
      }
    );

    return res.json({ attachment: Array.isArray(rows) ? rows[0] : rows });
  } catch (err: any) {
    console.error('❌ [HEALTH] addAppointmentAttachment error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

// ========== MEDICINES ==========

export const getMedicines = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.query.client_id;
  const targetUserId = clientId || userId;
  const activeOnly = req.query.active_only === 'true';
  
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    const sequelize = await getAppSequelize();
    const cols = await describeTableSafe('medicine_schedules');

    if (!cols) {
      const items = inMemoryMedicines.filter((m) => 
        m.patient_user_id === targetUserId && (!activeOnly || m.is_active)
      );
      return res.json({ medicines: items });
    }

    let sql = `SELECT * FROM medicine_schedules WHERE patient_user_id = :userId`;
    const params: any = { userId: targetUserId };

    if (activeOnly) {
      sql += ` AND is_active = TRUE`;
    }

    sql += ` ORDER BY start_date DESC, created_at DESC`;

    const [rows]: any = await sequelize.query(sql, { replacements: params, type: QueryTypes.SELECT });

    return res.json({ medicines: rows || [] });
  } catch (err: any) {
    console.error('❌ [HEALTH] getMedicines error:', err.message || err);
    const items = inMemoryMedicines.filter((m) => 
      m.patient_user_id === targetUserId && (!activeOnly || m.is_active)
    );
    return res.json({ medicines: items, warning: 'DB unavailable, using in-memory data' });
  }
};

export const addMedicine = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.body.client_id;
  const targetUserId = clientId || userId;
  
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const { medicine_name, dosage, frequency, start_date, end_date, timing, instructions, appointment_id, prescription_id } = req.body || {};

  if (!medicine_name || !frequency || !start_date) {
    return res.status(400).json({ message: 'medicine_name, frequency, and start_date are required' });
  }

  try {
    const sequelize = await getAppSequelize();
    const cols = await describeTableSafe('medicine_schedules');

    if (!cols) {
      const payload = {
        id: uuidv4(),
        patient_user_id: targetUserId,
        medicine_name,
        dosage,
        frequency,
        start_date,
        end_date,
        timing,
        instructions,
        appointment_id,
        prescription_id,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      inMemoryMedicines.unshift(payload);
      return res.json({ medicine: payload, warning: 'DB unavailable, stored in-memory' });
    }

    const [rows]: any = await sequelize.query(
      `INSERT INTO medicine_schedules (id, patient_user_id, medicine_name, dosage, frequency, start_date, end_date, timing, instructions, appointment_id, prescription_id, is_active)
       VALUES (:id, :userId, :medicineName, :dosage, :frequency, :startDate, :endDate, :timing, :instructions, :appointmentId, :prescriptionId, TRUE)
       RETURNING *`,
      {
        replacements: {
          id: uuidv4(),
          userId: targetUserId,
          medicineName: medicine_name,
          dosage: dosage || null,
          frequency,
          startDate: start_date,
          endDate: end_date || null,
          timing: timing || null,
          instructions: instructions || null,
          appointmentId: appointment_id || null,
          prescriptionId: prescription_id || null,
        },
        type: QueryTypes.INSERT,
      }
    );

    return res.json({ medicine: Array.isArray(rows) ? rows[0] : rows });
  } catch (err: any) {
    console.error('❌ [HEALTH] addMedicine error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const updateMedicine = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  const { medicine_name, dosage, frequency, start_date, end_date, timing, instructions, is_active } = req.body || {};

  try {
    const sequelize = await getAppSequelize();
    const cols = await describeTableSafe('medicine_schedules');

    if (!cols) {
      return res.status(503).json({ message: 'DB unavailable' });
    }

    const updates: string[] = [];
    const params: any = { id, userId };

    if (medicine_name !== undefined) {
      updates.push('medicine_name = :medicineName');
      params.medicineName = medicine_name;
    }
    if (dosage !== undefined) {
      updates.push('dosage = :dosage');
      params.dosage = dosage;
    }
    if (frequency !== undefined) {
      updates.push('frequency = :frequency');
      params.frequency = frequency;
    }
    if (start_date !== undefined) {
      updates.push('start_date = :startDate');
      params.startDate = start_date;
    }
    if (end_date !== undefined) {
      updates.push('end_date = :endDate');
      params.endDate = end_date;
    }
    if (timing !== undefined) {
      updates.push('timing = :timing');
      params.timing = timing;
    }
    if (instructions !== undefined) {
      updates.push('instructions = :instructions');
      params.instructions = instructions;
    }
    if (is_active !== undefined) {
      updates.push('is_active = :isActive');
      params.isActive = is_active;
    }

    if (updates.length === 0) {
      return res.json({ message: 'No updates provided' });
    }

    updates.push('updated_at = NOW()');

    const sql = `UPDATE medicine_schedules SET ${updates.join(', ')} WHERE id = :id AND patient_user_id = :userId RETURNING *`;
    const [rows]: any = await sequelize.query(sql, { replacements: params, type: QueryTypes.UPDATE });

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Not found' });
    }

    return res.json({ medicine: rows[0] });
  } catch (err: any) {
    console.error('❌ [HEALTH] updateMedicine error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const deleteMedicine = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const sequelize = await getAppSequelize();
    const cols = await describeTableSafe('medicine_schedules');

    if (!cols) {
      return res.status(503).json({ message: 'DB unavailable' });
    }

    const [rows]: any = await sequelize.query(
      `DELETE FROM medicine_schedules WHERE id = :id AND patient_user_id = :userId RETURNING id`,
      { replacements: { id, userId }, type: QueryTypes.DELETE }
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Not found' });
    }

    return res.json({ message: 'Deleted successfully' });
  } catch (err: any) {
    console.error('❌ [HEALTH] deleteMedicine error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

// ========== DIAGNOSTICS ==========

export const getDiagnostics = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.query.client_id;
  const targetUserId = clientId || userId;
  
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    const sequelize = await getAppSequelize();
    const cols = await describeTableSafe('past_test_results');

    if (!cols) {
      const items = inMemoryDiagnostics.filter((d) => d.patient_id === targetUserId);
      return res.json({ diagnostics: items });
    }

    const [rows]: any = await sequelize.query(
      `SELECT * FROM past_test_results WHERE patient_id = :userId ORDER BY test_date DESC, created_at DESC`,
      { replacements: { userId: targetUserId }, type: QueryTypes.SELECT }
    );

    return res.json({ diagnostics: rows || [] });
  } catch (err: any) {
    console.error('❌ [HEALTH] getDiagnostics error:', err.message || err);
    const items = inMemoryDiagnostics.filter((d) => d.patient_id === targetUserId);
    return res.json({ diagnostics: items, warning: 'DB unavailable, using in-memory data' });
  }
};

export const addDiagnostic = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.body.client_id;
  const targetUserId = clientId || userId;
  
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const { test_name, test_category, test_date, diagnostics_center_name, file_url, file_name, file_type, file_size, notes, parameters } = req.body || {};

  if (!test_name || !test_date) {
    return res.status(400).json({ message: 'test_name and test_date are required' });
  }

  try {
    const sequelize = await getAppSequelize();
    const cols = await describeTableSafe('past_test_results');

    if (!cols) {
      const payload = {
        id: uuidv4(),
        test_result_id: uuidv4().substring(0, 20),
        appointment_id: uuidv4().substring(0, 20),
        patient_id: targetUserId,
        patient_name: 'Patient',
        test_name,
        test_category,
        test_date,
        diagnostics_center_name,
        file_url,
        file_name,
        file_type,
        file_size,
        notes,
        parameters: parameters || [],
        is_ai_extracted: false,
        created_by: userId,
        created_at: new Date().toISOString(),
      };
      inMemoryDiagnostics.unshift(payload);
      return res.json({ diagnostic: payload, warning: 'DB unavailable, stored in-memory' });
    }

    // Get patient name from users table (platforms_99)
    let patientName = 'Patient';
    try {
      const sharedDb = await import('../config/database-integrated');
      const [users]: any = await sharedDb.sharedSequelize.query(
        `SELECT name FROM users WHERE id = :userId`,
        { replacements: { userId: targetUserId }, type: QueryTypes.SELECT }
      );
      if (users && users.length > 0) {
        patientName = users[0].name || 'Patient';
      }
    } catch (e) {
      // Ignore
    }

    const [rows]: any = await sequelize.query(
      `INSERT INTO past_test_results (id, test_result_id, appointment_id, patient_id, patient_name, test_name, test_category, test_date, diagnostics_center_name, file_url, file_name, file_type, file_size, notes, parameters, is_ai_extracted, created_by)
       VALUES (:id, :testResultId, :appointmentId, :patientId, :patientName, :testName, :testCategory, :testDate, :diagnosticsCenterName, :fileUrl, :fileName, :fileType, :fileSize, :notes, :parameters::jsonb, FALSE, :createdBy)
       RETURNING *`,
      {
        replacements: {
          id: uuidv4(),
          testResultId: uuidv4().substring(0, 20),
          appointmentId: uuidv4().substring(0, 20),
          patientId: targetUserId,
          patientName,
          testName: test_name,
          testCategory: test_category || null,
          testDate: test_date,
          diagnosticsCenterName: diagnostics_center_name || null,
          fileUrl: file_url || null,
          fileName: file_name || null,
          fileType: file_type || null,
          fileSize: file_size || null,
          notes: notes || null,
          parameters: JSON.stringify(parameters || []),
          createdBy: userId,
        },
        type: QueryTypes.INSERT,
      }
    );

    return res.json({ diagnostic: Array.isArray(rows) ? rows[0] : rows });
  } catch (err: any) {
    console.error('❌ [HEALTH] addDiagnostic error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

// Upload + extraction endpoints
export const uploadReport = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.body?.client_id;
  const targetUserId = clientId || userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const {
    file_url,
    file_base64,
    file_name,
    file_type
  } = req.body || {};

  if (!file_url && !file_base64) {
    return res.status(400).json({ message: 'file_url or file_base64 is required' });
  }

  const reportPayload = {
    id: uuidv4(),
    owner_user_id: targetUserId,
    uploaded_by: userId,
    file_url: file_url || null,
    file_base64: file_base64 || null,
    file_name: file_name || 'report.pdf',
    file_type: file_type || null,
    status: 'pending_extraction',
    uploaded_at: new Date().toISOString(),
    extracted_at: null,
    extraction: null,
  };

  try {
    await ensureHealthReportsTable();
    const report = await insertHealthReport(reportPayload);
    return res.json({ report });
  } catch (error: any) {
    console.error('❌ [HEALTH] uploadReport DB error:', error.message || error);
    inMemoryReports.unshift(reportPayload);
    return res.json({ report: reportPayload, warning: 'DB unavailable, stored in-memory' });
  }
};

export const getReport = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.query.client_id;
  const targetUserId = clientId || userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const { reportId } = req.params;
  try {
    await ensureHealthReportsTable();
    const report = await readHealthReport(reportId, targetUserId);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    return res.json({ report });
  } catch (error: any) {
    console.error('❌ [HEALTH] getReport DB error:', error.message || error);
    const report = inMemoryReports.find((r) => r.id === reportId && r.owner_user_id === targetUserId);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    return res.json({ report, warning: 'DB unavailable, using in-memory data' });
  }
};

export const extractReport = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.body?.client_id || req.query?.client_id;
  const targetUserId = clientId || userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const { reportId } = req.params;
  let report: any = null;
  let reportSource: 'db' | 'memory' = 'memory';
  try {
    await ensureHealthReportsTable();
    report = await readHealthReport(reportId, targetUserId);
    if (report) {
      reportSource = 'db';
    }
  } catch (error: any) {
    console.error('❌ [HEALTH] extractReport DB read error:', error.message || error);
  }
  if (!report) {
    report = inMemoryReports.find((r) => r.id === reportId && r.owner_user_id === targetUserId);
  }
  if (!report) {
    return res.status(404).json({ message: 'Report not found' });
  }

  try {
    const fileUrl = report.file_url || req.body?.file_url;
    const fileBase64 = report.file_base64 || req.body?.file_base64;
    const fileType = report.file_type || req.body?.file_type || 'application/pdf';

    if (!fileUrl && !fileBase64) {
      return res.status(400).json({ message: 'file_url or file_base64 is required for extraction' });
    }

    let extractedData: ExtractedTestResultData | null = null;
    if (fileBase64) {
      extractedData = await extractTestResultDataFromBase64(fileBase64, fileType);
    } else if (fileUrl) {
      extractedData = await extractTestResultData(fileUrl, fileType);
    }

    if (!extractedData) {
      return res.status(400).json({ message: 'No data extracted from report' });
    }

    const vitals = (extractedData.parameters || [])
      .map((param) => {
        const numericValue =
          typeof param.value === 'number' ? param.value : parseFloat(String(param.value));
        if (Number.isNaN(numericValue)) return null;
        const referenceRange =
          param.normal_range_min !== undefined || param.normal_range_max !== undefined
            ? `${param.normal_range_min ?? ''}${param.normal_range_min !== undefined || param.normal_range_max !== undefined ? '-' : ''}${param.normal_range_max ?? ''}`.trim()
            : null;
        return {
          parameter: param.parameter_name,
          value: numericValue,
          unit: param.unit || '',
          reference_range: referenceRange || undefined,
          measured_at: extractedData.test_date || new Date().toISOString(),
          source_report_id: report.id,
          source: 'report',
          confidence: extractedData.confidence || null,
        };
      })
      .filter(Boolean);

    const extraction = {
      status: 'review',
      vitals,
      raw: extractedData,
    };
    const extractedAt = new Date().toISOString();

    if (reportSource === 'db') {
      report = await updateHealthReportExtraction(report.id, targetUserId, {
        status: 'extracted',
        extracted_at: extractedAt,
        extraction,
      });
    } else {
      report.status = 'extracted';
      report.extracted_at = extractedAt;
      report.extraction = extraction;
    }

    return res.json({ extraction: extraction });
  } catch (error: any) {
    console.error('❌ [HEALTH] extractReport error:', error.message || error);
    return res.status(500).json({ message: 'Failed to extract report', error: error.message });
  }
};

export const confirmVitals = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const vitals = Array.isArray(req.body?.vitals) ? req.body.vitals : [];
  const created: any[] = [];
  for (const v of vitals) {
    const nextVital = {
      ...v,
      source: v.source || (v.source_report_id ? 'report' : v.source),
    };
    const fakeReq: any = { user: { id: userId }, body: nextVital };
    const collector: any = { json: (data: any) => created.push(data.vital || data) };
    await addVital(fakeReq, collector as any);
  }
  return res.json({ vitals: created });
};

// ========== VITALS ==========

export const getVitals = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.query.client_id;
  const targetUserId = clientId || userId;
  const parameter = req.query.parameter;
  const startDate = req.query.start_date;
  const endDate = req.query.end_date;
  
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    const sequelize = await getAppSequelize();
    const cols = await describeTableSafe('vital_parameters');
    const { patientCol, parameterCol, valueCol, unitCol, measuredAtCol, referenceRangeCol, sourceReportCol } = resolveVitalColumns(cols);

    if (!cols || !patientCol || !parameterCol) {
      let items = inMemoryVitals.filter((v) => v.patient_user_id === targetUserId);
      if (parameter) items = items.filter((v) => v.parameter === parameter);
      return res.json({ vitals: items });
    }

    let sql = `SELECT * FROM vital_parameters WHERE "${patientCol}" = :userId`;
    const params: any = { userId: targetUserId };

    if (parameter) {
      sql += ` AND "${parameterCol}" = :parameter`;
      params.parameter = parameter;
    }
    if (startDate) {
      sql += ` AND "${measuredAtCol || 'recorded_date'}" >= :startDate`;
      params.startDate = startDate;
    }
    if (endDate) {
      sql += ` AND "${measuredAtCol || 'recorded_date'}" <= :endDate`;
      params.endDate = endDate;
    }

    sql += ` ORDER BY "${measuredAtCol || 'recorded_date'}" DESC`;

    const [rows]: any = await sequelize.query(sql, { replacements: params, type: QueryTypes.SELECT });

    return res.json({ vitals: rows || [] });
  } catch (err: any) {
    console.error('❌ [HEALTH] getVitals error:', err.message || err);
    let items = inMemoryVitals.filter((v) => v.patient_user_id === targetUserId);
    if (parameter) items = items.filter((v) => v.parameter === parameter);
    return res.json({ vitals: items, warning: 'DB unavailable, using in-memory data' });
  }
};

export const getVitalsGraph = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.query.client_id;
  const targetUserId = clientId || userId;
  const parameter = req.query.parameter;
  const startDate = req.query.start_date;
  const endDate = req.query.end_date;
  
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  if (!parameter) return res.status(400).json({ message: 'parameter is required' });
  
  try {
    const sequelize = await getAppSequelize();
    const cols = await describeTableSafe('vital_parameters');
    const { patientCol, parameterCol, valueCol, unitCol, measuredAtCol } = resolveVitalColumns(cols);

    if (!cols || !patientCol || !parameterCol || !valueCol) {
      return res.json({ data: [], unit: null });
    }

    let sql = `SELECT "${valueCol}" as value, "${measuredAtCol || 'recorded_date'}" as date, "${unitCol || 'unit'}" as unit
               FROM vital_parameters
               WHERE "${patientCol}" = :userId AND "${parameterCol}" = :parameter`;
    const params: any = { userId: targetUserId, parameter };

    if (startDate) {
      sql += ` AND "${measuredAtCol || 'recorded_date'}" >= :startDate`;
      params.startDate = startDate;
    }
    if (endDate) {
      sql += ` AND "${measuredAtCol || 'recorded_date'}" <= :endDate`;
      params.endDate = endDate;
    }

    sql += ` ORDER BY "${measuredAtCol || 'recorded_date'}" ASC`;

    const [rows]: any = await sequelize.query(sql, { replacements: params, type: QueryTypes.SELECT });

    const unit = rows.length > 0 ? rows[0].unit : null;

    return res.json({ data: rows || [], unit });
  } catch (err: any) {
    console.error('❌ [HEALTH] getVitalsGraph error:', err.message || err);
    return res.json({ data: [], unit: null });
  }
};

export const getVitalsTrends = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.query.client_id;
  const targetUserId = clientId || userId;
  const parameter = req.query.parameter;
  
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  if (!parameter) return res.status(400).json({ message: 'parameter is required' });
  
  try {
    const sequelize = await getAppSequelize();
    const cols = await describeTableSafe('vital_parameters');
    const { patientCol, parameterCol, valueCol, measuredAtCol } = resolveVitalColumns(cols);

    if (!cols || !patientCol || !parameterCol || !valueCol) {
      return res.json({ trend: 'neutral', change: null, percentage: null });
    }

    const [rows]: any = await sequelize.query(
      `SELECT "${valueCol}" as value, "${measuredAtCol || 'recorded_date'}" as date
       FROM vital_parameters
       WHERE "${patientCol}" = :userId AND "${parameterCol}" = :parameter
       ORDER BY "${measuredAtCol || 'recorded_date'}" DESC
       LIMIT 2`,
      { replacements: { userId: targetUserId, parameter }, type: QueryTypes.SELECT }
    );

    if (rows.length < 2) {
      return res.json({ trend: 'neutral', change: null, percentage: null });
    }

    const latest = parseFloat(rows[0].value);
    const previous = parseFloat(rows[1].value);
    const change = latest - previous;
    const percentage = previous !== 0 ? ((change / previous) * 100).toFixed(2) : null;
    const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';

    return res.json({ trend, change, percentage, latest, previous });
  } catch (err: any) {
    console.error('❌ [HEALTH] getVitalsTrends error:', err.message || err);
    return res.json({ trend: 'neutral', change: null, percentage: null });
  }
};

export const addVital = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.body.client_id;
  const targetUserId = clientId || userId;
  
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const { parameter, value, unit, measured_at, reference_range, source_report_id, source } = req.body || {};

  if (!parameter || value === undefined) {
    return res.status(400).json({ message: 'parameter and value are required' });
  }

  try {
    const sequelize = await getAppSequelize();
    const cols = await describeTableSafe('vital_parameters');
    const { patientCol, parameterCol, valueCol, unitCol, measuredAtCol, sourceReportCol, sourceCol } = resolveVitalColumns(cols);

    if (!cols || !patientCol || !parameterCol || !valueCol) {
      const payload = {
        id: uuidv4(),
        patient_user_id: targetUserId,
        parameter,
        value,
        unit,
        measured_at: measured_at || new Date().toISOString(),
        reference_range,
        source_report_id,
        source,
        created_at: new Date().toISOString(),
      };
      inMemoryVitals.unshift(payload);
      return res.json({ vital: payload, warning: 'DB unavailable, stored in-memory' });
    }

    const recordedDate = measured_at ? new Date(measured_at) : new Date();
    const measuredAtColumn = measuredAtCol || 'recorded_date';
    const unitColumn = unitCol || 'unit';
    const sourceReportColumn = sourceReportCol || 'test_result_id';

    const columns = [
      'id',
      patientCol,
      parameterCol,
      valueCol,
      unitColumn,
      measuredAtColumn,
      sourceReportColumn,
    ];
    if (sourceCol) columns.push(sourceCol);

    const columnSql = columns.map((c) => `"${c}"`).join(', ');
    const valuesSql = columns.map((c) => `:${c}`).join(', ');
    const replacements: any = {
      id: uuidv4(),
      [patientCol]: targetUserId,
      [parameterCol]: parameter,
      [valueCol]: parseFloat(value),
      [unitColumn]: unit || null,
      [measuredAtColumn]: recordedDate,
      [sourceReportColumn]: source_report_id || null,
    };
    if (sourceCol) {
      replacements[sourceCol] = source || null;
    }

    const [rows]: any = await sequelize.query(
      `INSERT INTO vital_parameters (${columnSql})
       VALUES (${valuesSql})
       RETURNING *`,
      { replacements, type: QueryTypes.INSERT }
    );

    return res.json({ vital: Array.isArray(rows) ? rows[0] : rows });
  } catch (err: any) {
    console.error('❌ [HEALTH] addVital error:', err.message || err);
    const payload = {
      id: uuidv4(),
      patient_user_id: targetUserId,
      parameter,
      value,
      unit,
      measured_at: measured_at || new Date().toISOString(),
      reference_range,
      source_report_id,
      created_at: new Date().toISOString(),
    };
    inMemoryVitals.unshift(payload);
    return res.json({ vital: payload, warning: 'DB unavailable, stored in-memory' });
  }
};
