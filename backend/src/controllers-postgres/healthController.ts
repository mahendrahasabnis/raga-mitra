import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { QueryTypes } from 'sequelize';
import { Storage } from '@google-cloud/storage';
import { SpeechClient } from '@google-cloud/speech';
import { summarizeAppointmentAudioFromBase64, summarizeAppointmentText } from '../services/geminiAIService';
import {
  extractTestResultData,
  extractTestResultDataFromBase64,
  ExtractedTestResultData,
  extractMonitoringDataFromCsvText
} from '../services/geminiAIService';

// Fallback in-memory stores
const inMemoryAppointments: any[] = [];
const inMemoryVitals: any[] = [];
const inMemoryMedicines: any[] = [];
const inMemoryDiagnostics: any[] = [];
const inMemoryReports: any[] = [];

// When STRICT_DB=true, do NOT use in-memory fallbacks (online DB only).
const STRICT_DB = process.env.STRICT_DB === 'true';
const dbUnavailable = (res: Response, err: any, context?: string) =>
  res.status(503).json({
    code: 'DB_UNAVAILABLE',
    message: context || 'Database unavailable. This environment requires an online PostgreSQL connection (no local fallback).',
    error: err?.message || String(err || ''),
  });

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

/** Upload buffer to GCS and return public file URL. Used to save report files before processing. */
const uploadBufferToGcs = async (buffer: Buffer, objectPath: string, contentType?: string): Promise<string> => {
  const bucketName = getGcsBucketName();
  if (!bucketName) throw new Error('GCS_BUCKET not configured');
  const storage = getStorageClient();
  const file = storage.bucket(bucketName).file(objectPath);
  await file.save(buffer, {
    contentType: contentType || 'application/octet-stream',
    metadata: { cacheControl: 'private, max-age=31536000' },
  });
  return `https://storage.googleapis.com/${bucketName}/${objectPath}`;
};

export const getSignedUploadUrl = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const { appointment_id, category, file_name, content_type } = req.body || {};
    if (!appointment_id || !category || !file_name || !content_type) {
      return res.status(400).json({ message: 'appointment_id, category, file_name, content_type are required' });
    }
    const bucketName = getGcsBucketName();
    if (!bucketName) {
      console.warn('⚠️ [HEALTH] getSignedUploadUrl: GCS_BUCKET not configured');
      return res.status(503).json({
        code: 'GCS_NOT_CONFIGURED',
        message: 'File upload is not configured (GCS_BUCKET). Set GCS_BUCKET and GCP credentials to enable uploads.',
      });
    }
    const safeName = String(file_name).replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectPath = `appointments/${appointment_id}/${category}/${Date.now()}-${safeName}`;
    const signed = await createSignedUploadUrl(objectPath, content_type);
    return res.json(signed);
  } catch (err: any) {
    const message = err?.message || String(err) || 'Internal server error';
    console.error('❌ [HEALTH] getSignedUploadUrl error:', message);
    // Return 503 so frontend can save data without file (same as GCS_NOT_CONFIGURED)
    return res.status(503).json({
      code: 'GCS_UNAVAILABLE',
      message: `File upload unavailable: ${message}`,
    });
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
    doctorNameCol: pick('doctor_name'),
    doctorPhoneCol: pick('doctor_phone'),
    datetimeCol: pick('datetime', 'scheduled_at', 'start_time', 'appointment_time'),
    statusCol: pick('status'),
    titleCol: pick('title', 'purpose'),
    notesCol: pick('notes', 'description'),
    locationCol: pick('location', 'clinic', 'place'),
  };
};

export type DoctorInfo = { name: string; phone: string | null };

/**
 * Fetch doctor name and phone from the users table (shared DB) where user id
 * matches the appointment's doctor id (appointment.doctor_user_id / doctor_id).
 */
const getDoctorInfoById = async (doctorIds: string[]): Promise<Record<string, DoctorInfo>> => {
  const unique = Array.from(new Set(doctorIds.filter(Boolean).map((id) => String(id))));
  if (!unique.length) return {};
  try {
    const sharedDb = await getSharedSequelize();
    const placeholders = unique.map((_, i) => `:id${i}`).join(', ');
    const replacements: Record<string, string> = {};
    unique.forEach((id, i) => {
      replacements[`id${i}`] = id;
    });
    let rows: any[] = [];
    try {
      const [r]: any = await sharedDb.query(
        `SELECT id, name, phone FROM users WHERE id IN (${placeholders})`,
        { replacements, type: QueryTypes.SELECT }
      );
      rows = r || [];
    } catch (colErr: any) {
      if (/column "phone" does not exist/i.test(colErr?.message || '')) {
        const [r]: any = await sharedDb.query(
          `SELECT id, name FROM users WHERE id IN (${placeholders})`,
          { replacements, type: QueryTypes.SELECT }
        );
        rows = (r || []).map((row: any) => ({ ...row, phone: null }));
      } else {
        throw colErr;
      }
    }
    const map: Record<string, DoctorInfo> = {};
    rows.forEach((row: any) => {
      if (row?.id) map[row.id] = { name: row.name || '', phone: row.phone ?? null };
    });
    return map;
  } catch (err: any) {
    console.error('⚠️ [HEALTH] getDoctorInfoById error:', err.message || err);
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
  if (datetimeCol && !appointment.datetime) {
    appointment.datetime = appointment[datetimeCol];
  }
  return appointment;
};

function parseReferenceRange(ref: string): { min: number | null; max: number | null } {
  if (!ref || typeof ref !== 'string') return { min: null, max: null };
  const parts = ref.trim().split(/[-–—]/).map((s) => parseFloat(s.trim()));
  if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
    return { min: parts[0], max: parts[1] };
  }
  const single = parseFloat(ref.trim());
  if (!Number.isNaN(single)) return { min: single, max: single };
  return { min: null, max: null };
}

const resolveVitalColumns = (cols: Record<string, any> | null) => {
  const columnNames = cols ? Object.keys(cols) : [];
  const pick = (...names: string[]) => names.find((n) => columnNames.includes(n)) || null;
  return {
    patientCol: pick('patient_user_id', 'patient_id', 'user_id'),
    parameterCol: pick('parameter_name', 'parameter', 'name'),
    valueCol: pick('value'),
    unitCol: pick('unit'),
    measuredAtCol: pick('recorded_date', 'measured_at', 'recorded_at', 'date'),
    referenceRangeCol: pick('reference_range'),
    normalRangeMinCol: pick('normal_range_min'),
    normalRangeMaxCol: pick('normal_range_max'),
    sourceReportCol: pick('test_result_id', 'source_report_id', 'report_id'),
    sourceCol: pick('source', 'source_type'),
    recordedByCol: pick('recorded_by', 'created_by'),
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
    await ensureHealthTablesReady();
    const sequelize = await getAppSequelize();
    const cols = await describeTableSafe('appointments');
    const { patientCol, doctorCol, doctorNameCol, doctorPhoneCol, datetimeCol, titleCol, statusCol, locationCol, notesCol } = resolveAppointmentColumns(cols);

    if (!cols || !patientCol) {
      if (STRICT_DB) return dbUnavailable(res, new Error('appointments schema missing/unknown'), 'Appointments table/schema not available (STRICT_DB=true).');
      const items = inMemoryAppointments.filter((a) => a.patient_user_id === targetUserId);
      return res.json({ appointments: items });
    }

    // Only select columns that exist (old schema may lack title, doctor_name, doctor_phone)
    const selectColumns = ['id', patientCol, doctorCol, doctorNameCol, doctorPhoneCol, datetimeCol, titleCol, statusCol, locationCol, notesCol]
      .filter(Boolean)
      .map((c) => `"${c}"`)
      .join(', ');

    // Doctor name/phone stored on appointment; no users table lookup
    const raw: any = await sequelize.query(
      `SELECT ${selectColumns} FROM appointments WHERE "${patientCol}" = :userId ORDER BY ${datetimeCol ? `"${datetimeCol}"` : '"created_at"'} DESC`,
      { replacements: { userId: targetUserId }, type: QueryTypes.SELECT }
    );
    const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.[0]) ? raw[0] : [];

    for (const row of rows) {
      try {
        const attRaw: any = await sequelize.query(
          `SELECT id, attachment_type, file_name FROM appointment_attachments WHERE appointment_id = :appointmentId`,
          { replacements: { appointmentId: row.id }, type: QueryTypes.SELECT }
        );
        const attachments = Array.isArray(attRaw) ? attRaw : Array.isArray(attRaw?.[0]) ? attRaw[0] : [];
        row.attachments = attachments;
        row.attachment_count = attachments.length;
      } catch (e) {
        row.attachments = [];
        row.attachment_count = 0;
      }
      if (datetimeCol && !row.datetime) {
        row.datetime = row[datetimeCol];
      }
    }

    return res.json({ appointments: rows || [] });
  } catch (err: any) {
    console.error('❌ [HEALTH] getAppointments error:', err.message || err);
    if (STRICT_DB) return dbUnavailable(res, err, 'Failed to fetch appointments (STRICT_DB=true).');
    const items = inMemoryAppointments.filter((a) => a.patient_user_id === targetUserId);
    return res.json({ appointments: items, warning: 'DB unavailable, using in-memory data' });
  }
};

export const getAppointment = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    await ensureHealthTablesReady();
    const sequelize = await getAppSequelize();
    const cols = await describeTableSafe('appointments');
    const { patientCol, doctorCol } = resolveAppointmentColumns(cols);

    if (!cols || !patientCol) {
      if (STRICT_DB) return dbUnavailable(res, new Error('appointments schema missing/unknown'), 'Appointments table/schema not available (STRICT_DB=true).');
      const item = inMemoryAppointments.find((a) => a.id === id);
      return item ? res.json({ appointment: item }) : res.status(404).json({ message: 'Not found' });
    }

    const [rows]: any = await sequelize.query(
      `SELECT * FROM appointments WHERE id = :id AND "${patientCol}" = :userId`,
      { replacements: { id, userId }, type: QueryTypes.SELECT }
    );

    if (rows.length === 0) return res.status(404).json({ message: 'Not found' });

    const appointment = rows[0];

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
    let appointment = await getAppointmentById(req.params.id, targetUserId);
    if (!appointment) {
      const inMem = inMemoryAppointments.find(
        (a) => a.id === req.params.id && (a.patient_user_id === targetUserId || a.patient_id === targetUserId)
      );
      if (inMem) appointment = inMem;
      else return res.status(404).json({ message: 'Appointment not found' });
    }

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
  const { title, datetime, location, notes, status = 'planned', doctor_user_id = null, doctor_name = null, doctor_phone = null, attachments = [] } = req.body || {};

  try {
    await ensureHealthTablesReady();
    const sequelize = await getAppSequelize();
    const cols = await describeTableSafe('appointments');
    const { patientCol, doctorCol, doctorNameCol, doctorPhoneCol, datetimeCol, statusCol, titleCol, notesCol, locationCol } = resolveAppointmentColumns(cols);

    if (!cols || !patientCol) {
      if (STRICT_DB) return dbUnavailable(res, new Error('appointments schema missing/unknown'), 'Cannot create appointment (STRICT_DB=true).');
      const payload = {
        id: uuidv4(),
        patient_user_id: targetUserId,
        title,
        datetime,
        location,
        notes,
        status,
        doctor_user_id,
        doctor_name: doctor_name || null,
        doctor_phone: doctor_phone || null,
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
    pushCol(doctorNameCol, 'doctorName', doctor_name || null);
    pushCol(doctorPhoneCol, 'doctorPhone', doctor_phone || null);
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
    if (STRICT_DB) return dbUnavailable(res, err, 'Cannot create appointment (STRICT_DB=true).');
    const payload = {
      id: uuidv4(),
      patient_user_id: targetUserId,
      title,
      datetime,
      location,
      notes,
      status,
      doctor_user_id,
      doctor_name: doctor_name || null,
      doctor_phone: doctor_phone || null,
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
  
  const { title, datetime, location, notes, status, doctor_user_id, doctor_name, doctor_phone } = req.body || {};

  try {
    const sequelize = await getAppSequelize();
    const cols = await describeTableSafe('appointments');
    const { patientCol, doctorCol, doctorNameCol, doctorPhoneCol, datetimeCol, statusCol, titleCol, notesCol, locationCol } = resolveAppointmentColumns(cols);

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
    if (doctor_user_id !== undefined && doctorCol) {
      updates.push(`"${doctorCol}" = :doctor`);
      params.doctor = doctor_user_id;
    }
    if (doctor_name !== undefined && doctorNameCol) {
      updates.push(`"${doctorNameCol}" = :doctorName`);
      params.doctorName = doctor_name;
    }
    if (doctor_phone !== undefined && doctorPhoneCol) {
      updates.push(`"${doctorPhoneCol}" = :doctorPhone`);
      params.doctorPhone = doctor_phone;
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
      if (STRICT_DB) return dbUnavailable(res, new Error('medicine_schedules schema missing/unknown'), 'Medicines table/schema not available (STRICT_DB=true).');
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
    if (STRICT_DB) return dbUnavailable(res, err, 'Failed to fetch medicines (STRICT_DB=true).');
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
      if (STRICT_DB) return dbUnavailable(res, new Error('medicine_schedules schema missing/unknown'), 'Cannot add medicine (STRICT_DB=true).');
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
    if (STRICT_DB) return dbUnavailable(res, err, 'Cannot add medicine (STRICT_DB=true).');
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
      if (STRICT_DB) return dbUnavailable(res, new Error('past_test_results schema missing/unknown'), 'Diagnostics table/schema not available (STRICT_DB=true).');
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
    if (STRICT_DB) return dbUnavailable(res, err, 'Failed to fetch diagnostics (STRICT_DB=true).');
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
      if (STRICT_DB) return dbUnavailable(res, new Error('past_test_results schema missing/unknown'), 'Cannot add diagnostic (STRICT_DB=true).');
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

// Upload + extraction endpoints — save file to GCS first, then store metadata (so we always have file before processing).
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

  const reportId = uuidv4();
  const fileName = file_name || 'report.pdf';
  const fileType = file_type || 'application/pdf';
  let finalFileUrl: string | null = file_url || null;
  let finalFileBase64: string | null = file_base64 || null;

  // Save file to GCP bucket first when base64 is provided and GCS is configured.
  if (file_base64 && getGcsBucketName()) {
    try {
      const buffer = Buffer.from(file_base64, 'base64');
      const ext = (fileName.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf';
      const objectPath = `health-reports/${targetUserId}/${reportId}.${ext}`;
      finalFileUrl = await uploadBufferToGcs(buffer, objectPath, fileType);
      finalFileBase64 = null; // Do not store large base64 in DB when file is in GCS.
    } catch (gcsErr: any) {
      console.warn('⚠️ [HEALTH] uploadReport GCS upload failed, storing base64:', gcsErr?.message || gcsErr);
      // Keep file_base64 so file is still stored and process can continue.
    }
  }

  const reportPayload = {
    id: reportId,
    owner_user_id: targetUserId,
    uploaded_by: userId,
    file_url: finalFileUrl,
    file_base64: finalFileBase64,
    file_name: fileName,
    file_type: fileType,
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
    if (STRICT_DB) return dbUnavailable(res, error, 'Cannot upload report (STRICT_DB=true).');
    inMemoryReports.unshift(reportPayload);
    return res.json({ report: reportPayload, warning: 'DB unavailable, stored in-memory' });
  }
};

export const listReports = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.query.client_id;
  const targetUserId = clientId || userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    await ensureHealthReportsTable();
    const sequelize = await getAppSequelize();
    const [rows]: any = await sequelize.query(
      `SELECT id, file_name, file_url, uploaded_at, status FROM health_reports WHERE owner_user_id = :targetUserId ORDER BY uploaded_at DESC`,
      { replacements: { targetUserId }, type: QueryTypes.SELECT }
    );
    return res.json({ reports: rows || [] });
  } catch (err: any) {
    console.error('❌ [HEALTH] listReports error:', err.message || err);
    if (STRICT_DB) return dbUnavailable(res, err, 'Failed to list reports (STRICT_DB=true).');
    const items = inMemoryReports
      .filter((r: any) => r.owner_user_id === targetUserId)
      .map((r: any) => ({ id: r.id, file_name: r.file_name, file_url: r.file_url, uploaded_at: r.uploaded_at, status: r.status }));
    return res.json({ reports: items });
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
    if (STRICT_DB) return dbUnavailable(res, error, 'Failed to fetch report (STRICT_DB=true).');
    const report = inMemoryReports.find((r) => r.id === reportId && r.owner_user_id === targetUserId);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    return res.json({ report, warning: 'DB unavailable, using in-memory data' });
  }
};

export const getReportFile = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.query.client_id;
  const targetUserId = clientId || userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const { reportId } = req.params;
  try {
    await ensureHealthReportsTable();
    const report = await readHealthReport(reportId, targetUserId);
    if (!report) {
      if (STRICT_DB) return res.status(404).json({ message: 'Report not found' });
      const mem = inMemoryReports.find((r: any) => r.id === reportId && r.owner_user_id === targetUserId);
      if (!mem) return res.status(404).json({ message: 'Report not found' });
      if (mem.file_url) return res.redirect(mem.file_url);
      if (mem.file_base64) {
        const buf = Buffer.from(mem.file_base64, 'base64');
        res.setHeader('Content-Type', mem.file_type || 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${(mem.file_name || 'report').replace(/"/g, '%22')}"`);
        return res.send(buf);
      }
      return res.status(404).json({ message: 'Report file not available' });
    }
    if (report.file_url) {
      // If file is in GCS, use signed URL so private buckets work.
      const gcsMatch = report.file_url.match(/^https:\/\/storage\.googleapis\.com\/([^/]+)\/(.+)$/);
      if (gcsMatch && getGcsBucketName()) {
        try {
          const [, , objectPath] = gcsMatch;
          const signedUrl = await getSignedReadUrl(decodeURIComponent(objectPath));
          return res.redirect(signedUrl);
        } catch (e) {
          // Fall through to redirect to raw URL (e.g. if bucket is public).
        }
      }
      return res.redirect(report.file_url);
    }
    if (report.file_base64) {
      const buf = Buffer.from(report.file_base64, 'base64');
      res.setHeader('Content-Type', report.file_type || 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${(report.file_name || 'report').replace(/"/g, '%22')}"`);
      return res.send(buf);
    }
    return res.status(404).json({ message: 'Report file not available' });
  } catch (err: any) {
    console.error('❌ [HEALTH] getReportFile error:', err.message || err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
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
    await ensureHealthTablesReady();
    const sequelize = await getAppSequelize();
    const cols = await describeTableSafe('vital_parameters');
    const { patientCol, parameterCol, valueCol, unitCol, measuredAtCol, referenceRangeCol, sourceReportCol } = resolveVitalColumns(cols);

    if (!cols || !patientCol || !parameterCol) {
      if (STRICT_DB) return dbUnavailable(res, new Error('vital_parameters schema missing/unknown'), 'Vitals table/schema not available (STRICT_DB=true).');
      console.log(`⚠️ [HEALTH] getVitals: table missing/unknown cols, using in-memory (${inMemoryVitals.length} total)`);
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

    const rows: any = await sequelize.query(sql, { replacements: params, type: QueryTypes.SELECT });
    const rawList = Array.isArray(rows) ? rows : [];
    console.log(`📊 [HEALTH] getVitals: targetUserId=${targetUserId}, from DB=${rawList.length}`);
    const combined = [...rawList];
    if (!STRICT_DB) {
      // Merge in-memory vitals for this user (e.g. when INSERT failed but we stored in-memory)
      let inMem = inMemoryVitals.filter((v) => v.patient_user_id === targetUserId);
      if (parameter) inMem = inMem.filter((v) => (v.parameter_name ?? v.parameter) === parameter);
      const dbIds = new Set((rawList as any[]).map((r) => r.id));
      inMem.forEach((v) => {
        if (!v.id || !dbIds.has(v.id)) combined.push(v);
      });
      if (inMem.length > 0) console.log(`📊 [HEALTH] getVitals: merged ${inMem.length} in-memory vitals, total=${combined.length}`);
    }
    // Normalize so frontend always gets parameter_name, parameter, recorded_date, measured_at
    const list = combined.map((r: any) => ({
      ...r,
      parameter_name: r.parameter_name ?? r.parameter ?? r.name ?? '',
      parameter: r.parameter ?? r.parameter_name ?? r.name ?? '',
      recorded_date: r.recorded_date ?? r.measured_at ?? r.recorded_at,
      measured_at: r.measured_at ?? r.recorded_date ?? r.recorded_at,
    }));
    // Sort by date descending
    list.sort((a, b) => {
      const ta = new Date(a.measured_at ?? a.recorded_date ?? 0).getTime();
      const tb = new Date(b.measured_at ?? b.recorded_date ?? 0).getTime();
      return tb - ta;
    });

    return res.json({ vitals: list });
  } catch (err: any) {
    console.error('❌ [HEALTH] getVitals error:', err.message || err);
    if (STRICT_DB) return dbUnavailable(res, err, 'Failed to fetch vitals (STRICT_DB=true).');
    let items = inMemoryVitals.filter((v) => v.patient_user_id === targetUserId);
    if (parameter) items = items.filter((v) => (v.parameter_name ?? v.parameter) === parameter);
    const list = items.map((r: any) => ({
      ...r,
      parameter_name: r.parameter_name ?? r.parameter ?? r.name ?? '',
      parameter: r.parameter ?? r.parameter_name ?? r.name ?? '',
      recorded_date: r.recorded_date ?? r.measured_at ?? r.recorded_at,
      measured_at: r.measured_at ?? r.recorded_date ?? r.recorded_at,
    }));
    return res.json({ vitals: list, warning: 'DB unavailable, using in-memory data' });
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
  console.log('🔵 [HEALTH] addVital called', { body: req.body, user: req.user?.id });
  const userId = req.user?.id;
  const clientId = req.body.client_id;
  const targetUserId = clientId || userId;

  if (!userId) {
    console.log('❌ [HEALTH] addVital: no userId (unauthorized)');
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const { parameter, value, unit, measured_at, reference_range, source_report_id, source } = req.body || {};

  if (!parameter || value === undefined) {
    console.log('❌ [HEALTH] addVital: missing parameter or value', { parameter, value });
    return res.status(400).json({ message: 'parameter and value are required' });
  }

  const recordedDate = measured_at ? new Date(measured_at) : new Date();
  const vitalId = uuidv4();
  const numValue = parseFloat(String(value));

  try {
    await ensureHealthTablesReady();
    const sequelize = await getAppSequelize();

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS vital_parameters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_user_id UUID NOT NULL,
        parameter_name VARCHAR(255) NOT NULL,
        value DECIMAL(12, 4) NOT NULL,
        unit VARCHAR(50),
        recorded_date TIMESTAMPTZ DEFAULT NOW(),
        reference_range VARCHAR(255),
        source_report_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    const cols = await describeTableSafe('vital_parameters');
    const { patientCol, parameterCol, valueCol, unitCol, measuredAtCol, referenceRangeCol, normalRangeMinCol, normalRangeMaxCol, sourceReportCol, recordedByCol } = resolveVitalColumns(cols);
    if (!patientCol || !parameterCol || !valueCol) {
      if (STRICT_DB) return dbUnavailable(res, new Error('vital_parameters schema missing/unknown'), 'Cannot insert vitals (STRICT_DB=true).');
      const payload = {
        id: vitalId,
        patient_user_id: targetUserId,
        parameter,
        value: numValue,
        unit: unit || null,
        measured_at: recordedDate.toISOString(),
        reference_range,
        source_report_id,
        created_at: new Date().toISOString(),
      };
      inMemoryVitals.unshift(payload);
      return res.json({ vital: payload, warning: 'DB unavailable, stored in-memory' });
    }

    const insertCols: string[] = ['id', patientCol, parameterCol, valueCol];
    const replacements: Record<string, any> = {
      id: vitalId,
      [patientCol]: targetUserId,
      [parameterCol]: parameter,
      value: numValue,
    };
    if (unitCol) {
      insertCols.push(unitCol);
      replacements[unitCol] = unit || null;
    }
    if (measuredAtCol) {
      insertCols.push(measuredAtCol);
      replacements[measuredAtCol] = recordedDate;
    }
    if (referenceRangeCol && reference_range != null && reference_range !== '') {
      insertCols.push(referenceRangeCol);
      replacements[referenceRangeCol] = reference_range;
    } else if ((normalRangeMinCol || normalRangeMaxCol) && reference_range != null && reference_range !== '') {
      const parsed = parseReferenceRange(reference_range);
      if (normalRangeMinCol && parsed.min != null) {
        insertCols.push(normalRangeMinCol);
        replacements[normalRangeMinCol] = parsed.min;
      }
      if (normalRangeMaxCol && parsed.max != null) {
        insertCols.push(normalRangeMaxCol);
        replacements[normalRangeMaxCol] = parsed.max;
      }
    }
    if (sourceReportCol) {
      insertCols.push(sourceReportCol);
      replacements[sourceReportCol] = source_report_id || null;
    }
    if (recordedByCol) {
      insertCols.push(recordedByCol);
      replacements[recordedByCol] = userId;
    }
    const colList = insertCols.map((c) => `"${c}"`).join(', ');
    const placeholdersList = insertCols.map((c) => `:${c}`).join(', ');
    const result: any = await sequelize.query(
      `INSERT INTO vital_parameters (${colList}) VALUES (${placeholdersList}) RETURNING *`,
      { replacements, type: QueryTypes.INSERT }
    );
    const rows = Array.isArray(result) && result[0] ? result[0] : result;
    const inserted = Array.isArray(rows) ? rows[0] : rows;
    console.log(`✅ [HEALTH] addVital saved to DB: ${parameter}=${value} for user ${targetUserId}`);
    return res.json({
      vital: inserted || {
        id: vitalId,
        parameter_name: parameter,
        parameter,
        value: numValue,
        unit: unit || null,
        recorded_date: recordedDate,
        measured_at: recordedDate,
      },
    });
  } catch (err: any) {
    const errMsg = err?.message != null ? String(err.message) : (err != null ? String(err) : 'unknown');
    const errCode = err?.code != null ? String(err.code) : null;
    console.error('❌ [HEALTH] addVital error:', errMsg);
    console.error('❌ [HEALTH] addVital full err:', err);
    if (err?.code) console.error('❌ [HEALTH] addVital code:', err.code);
    if (err?.detail) console.error('❌ [HEALTH] addVital detail:', err.detail);
    console.error('❌ [HEALTH] addVital stack:', (err as Error)?.stack);
    if (STRICT_DB) return dbUnavailable(res, err, 'Cannot insert vitals (STRICT_DB=true).');
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
    console.log(`⚠️ [HEALTH] addVital: INSERT failed, stored in-memory (${parameter}=${value})`);
    return res.json({
      vital: payload,
      warning: 'DB unavailable, stored in-memory',
      error_detail: errMsg,
      error_code: errCode,
    });
  }
};

// ========== LIVE MONITORING (Institution Admissions) ==========

export const getAdmissions = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.query.client_id;
  const targetUserId = clientId || userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    await ensureHealthTablesReady();
    const sequelize = await getAppSequelize();
    const rows: any = await sequelize.query(
      `SELECT * FROM institution_admissions WHERE patient_user_id = :targetUserId ORDER BY admission_date DESC, created_at DESC`,
      { replacements: { targetUserId }, type: QueryTypes.SELECT }
    );
    const list = Array.isArray(rows) ? rows : [];
    return res.json({ admissions: list });
  } catch (err: any) {
    console.error('❌ [HEALTH] getAdmissions error:', err.message || err);
    return res.status(503).json({ message: 'Database unavailable. Ensure PostgreSQL is running and DB connection is configured.', error: err.message });
  }
};

export const getAdmission = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.query.client_id;
  const targetUserId = clientId || userId;
  const { id } = req.params;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    await ensureHealthTablesReady();
    const sequelize = await getAppSequelize();
    const [rows]: any = await sequelize.query(
      `SELECT * FROM institution_admissions WHERE id = :id AND patient_user_id = :targetUserId LIMIT 1`,
      { replacements: { id, targetUserId }, type: QueryTypes.SELECT }
    );
    const admission = Array.isArray(rows) ? rows[0] : rows;
    if (!admission) return res.status(404).json({ message: 'Admission not found' });
    return res.json({ admission });
  } catch (err: any) {
    console.error('❌ [HEALTH] getAdmission error:', err.message || err);
    return res.status(503).json({ message: 'Database unavailable. Ensure PostgreSQL is running and DB connection is configured.', error: err.message });
  }
};

export const createAdmission = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.body?.client_id;
  const targetUserId = clientId || userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  console.log('[HEALTH] createAdmission: userId=', userId, 'targetUserId=', targetUserId, 'body=', JSON.stringify(req.body || {}).slice(0, 200));

  const {
    institution_name,
    mrn_number,
    bed_number,
    admission_date,
    condition,
    consulting_doctor,
    high_limits,
    low_limits,
  } = req.body || {};

  if (!institution_name || !admission_date) {
    return res.status(400).json({ message: 'institution_name and admission_date are required' });
  }

  try {
    await ensureHealthTablesReady();
    const sequelize = await getAppSequelize();
    const raw: any = await sequelize.query(
      `INSERT INTO institution_admissions
        (id, patient_user_id, institution_name, mrn_number, bed_number, admission_date, condition, consulting_doctor, high_limits, low_limits)
       VALUES
        (:id, :patient_user_id, :institution_name, :mrn_number, :bed_number, :admission_date, :condition, :consulting_doctor, :high_limits::jsonb, :low_limits::jsonb)
       RETURNING *`,
      {
        replacements: {
          id: uuidv4(),
          patient_user_id: targetUserId,
          institution_name: institution_name || '',
          mrn_number: mrn_number || null,
          bed_number: bed_number || null,
          admission_date: admission_date,
          condition: condition || null,
          consulting_doctor: consulting_doctor || null,
          high_limits: high_limits ? JSON.stringify(high_limits) : null,
          low_limits: low_limits ? JSON.stringify(low_limits) : null,
        },
      }
    );
    const rows = Array.isArray(raw) && raw.length > 0 ? raw[0] : [];
    const admission = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    console.log('[HEALTH] createAdmission: inserted id=', admission?.id);
    return res.status(201).json({ admission });
  } catch (err: any) {
    console.error('❌ [HEALTH] createAdmission error:', err.message || err);
    return res.status(503).json({ message: 'Database unavailable. Ensure PostgreSQL is running and DB connection is configured.', error: err.message });
  }
};

export const updateAdmission = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.body?.client_id || req.query.client_id;
  const targetUserId = clientId || userId;
  const { id } = req.params;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const {
    institution_name,
    mrn_number,
    bed_number,
    admission_date,
    condition,
    consulting_doctor,
    high_limits,
    low_limits,
  } = req.body || {};

  try {
    await ensureHealthTablesReady();
    const sequelize = await getAppSequelize();
    const updates: string[] = [];
    const params: Record<string, any> = { id, targetUserId };

    if (institution_name !== undefined) { updates.push('institution_name = :institution_name'); params.institution_name = institution_name; }
    if (mrn_number !== undefined) { updates.push('mrn_number = :mrn_number'); params.mrn_number = mrn_number; }
    if (bed_number !== undefined) { updates.push('bed_number = :bed_number'); params.bed_number = bed_number; }
    if (admission_date !== undefined) { updates.push('admission_date = :admission_date'); params.admission_date = admission_date; }
    if (condition !== undefined) { updates.push('condition = :condition'); params.condition = condition; }
    if (consulting_doctor !== undefined) { updates.push('consulting_doctor = :consulting_doctor'); params.consulting_doctor = consulting_doctor; }
    if (high_limits !== undefined) { updates.push('high_limits = :high_limits::jsonb'); params.high_limits = JSON.stringify(high_limits); }
    if (low_limits !== undefined) { updates.push('low_limits = :low_limits::jsonb'); params.low_limits = JSON.stringify(low_limits); }

    if (updates.length === 0) {
      const [existing]: any = await sequelize.query(
        `SELECT * FROM institution_admissions WHERE id = :id AND patient_user_id = :targetUserId LIMIT 1`,
        { replacements: { id, targetUserId }, type: QueryTypes.SELECT }
      );
      const admission = Array.isArray(existing) ? existing[0] : existing;
      if (!admission) return res.status(404).json({ message: 'Admission not found' });
      return res.json({ admission });
    }

    updates.push('updated_at = NOW()');
    const [rows]: any = await sequelize.query(
      `UPDATE institution_admissions SET ${updates.join(', ')} WHERE id = :id AND patient_user_id = :targetUserId RETURNING *`,
      { replacements: params, type: QueryTypes.UPDATE }
    );
    const admission = Array.isArray(rows) ? rows[0] : rows;
    if (!admission) return res.status(404).json({ message: 'Admission not found' });
    return res.json({ admission });
  } catch (err: any) {
    console.error('❌ [HEALTH] updateAdmission error:', err.message || err);
    return res.status(503).json({ message: 'Database unavailable. Ensure PostgreSQL is running and DB connection is configured.', error: err.message });
  }
};

export const deleteAdmission = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.query.client_id;
  const targetUserId = clientId || userId;
  const { id } = req.params;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    await ensureHealthTablesReady();
    const sequelize = await getAppSequelize();
    const [result]: any = await sequelize.query(
      `DELETE FROM institution_admissions WHERE id = :id AND patient_user_id = :targetUserId RETURNING id`,
      { replacements: { id, targetUserId }, type: QueryTypes.DELETE }
    );
    if (!result || (Array.isArray(result) && result.length === 0)) {
      return res.status(404).json({ message: 'Admission not found' });
    }
    return res.json({ success: true });
  } catch (err: any) {
    console.error('❌ [HEALTH] deleteAdmission error:', err.message || err);
    return res.status(503).json({ message: 'Database unavailable. Ensure PostgreSQL is running and DB connection is configured.', error: err.message });
  }
};

export const addMonitoringReadings = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.body?.client_id || req.query.client_id;
  const targetUserId = clientId || userId;
  const { admissionId } = req.params;
  const { readings } = req.body || {};
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  if (!Array.isArray(readings) || readings.length === 0) {
    return res.status(400).json({ message: 'readings array is required' });
  }

  try {
    await ensureHealthTablesReady();
    const sequelize = await getAppSequelize();
    const admResult: any = await sequelize.query(
      `SELECT id FROM institution_admissions WHERE id = :admissionId AND patient_user_id = :targetUserId LIMIT 1`,
      { replacements: { admissionId, targetUserId }, type: QueryTypes.SELECT }
    );
    const admList = Array.isArray(admResult) ? admResult : [];
    const admission = admList.length > 0 ? admList[0] : null;
    if (!admission) return res.status(404).json({ message: 'Admission not found' });

    const inserted: any[] = [];
    for (const r of readings) {
      const recordedAt = r.recorded_at || r.recordedAt || new Date().toISOString();
      const raw: any = await sequelize.query(
        `INSERT INTO monitoring_readings
          (id, admission_id, recorded_at, heart_rate, breath_rate, spo2, temperature, systolic_bp, diastolic_bp, movement)
         VALUES (:id, :admission_id, :recorded_at, :heart_rate, :breath_rate, :spo2, :temperature, :systolic_bp, :diastolic_bp, :movement)
         RETURNING *`,
        {
          replacements: {
            id: uuidv4(),
            admission_id: admissionId,
            recorded_at: recordedAt,
            heart_rate: r.heart_rate ?? r.heartRate ?? null,
            breath_rate: r.breath_rate ?? r.breathRate ?? null,
            spo2: r.spo2 ?? null,
            temperature: r.temperature ?? null,
            systolic_bp: r.systolic_bp ?? r.systolicBp ?? null,
            diastolic_bp: r.diastolic_bp ?? r.diastolicBp ?? null,
            movement: r.movement != null ? (r.movement === 1 || r.movement === '1' ? 1 : 0) : null,
          },
          type: QueryTypes.INSERT,
        }
      );
      const rowsArr = Array.isArray(raw) && raw.length > 0
        ? (Array.isArray(raw[0]) ? raw[0] : raw)
        : [];
      const row = rowsArr.length > 0 && typeof rowsArr[0] === 'object' ? rowsArr[0] : null;
      if (row) inserted.push(row);
    }
    return res.json({ readings: inserted });
  } catch (err: any) {
    console.error('❌ [HEALTH] addMonitoringReadings error:', err.message || err);
    return res.status(503).json({ message: 'Database unavailable. Ensure PostgreSQL is running and DB connection is configured.', error: err.message });
  }
};

export const getMonitoringReadings = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.query.client_id;
  const targetUserId = clientId || userId;
  const { admissionId } = req.params;
  const startDate = req.query.start_date as string;
  const endDate = req.query.end_date as string;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    await ensureHealthTablesReady();
    const sequelize = await getAppSequelize();
    const admResult: any = await sequelize.query(
      `SELECT * FROM institution_admissions WHERE id = :admissionId AND patient_user_id = :targetUserId LIMIT 1`,
      { replacements: { admissionId, targetUserId }, type: QueryTypes.SELECT }
    );
    const admList = Array.isArray(admResult) ? admResult : [];
    const admission = admList.length > 0 ? admList[0] : null;
    if (!admission) return res.status(404).json({ message: 'Admission not found' });

    let sql = `SELECT * FROM monitoring_readings WHERE admission_id = :admissionId`;
    const params: Record<string, any> = { admissionId };
    if (startDate) { sql += ` AND recorded_at >= :startDate`; params.startDate = startDate; }
    if (endDate) { sql += ` AND recorded_at <= :endDate`; params.endDate = endDate; }
    sql += ` ORDER BY recorded_at ASC`;

    const rows: any = await sequelize.query(sql, { replacements: params, type: QueryTypes.SELECT });
    const readingsList = Array.isArray(rows) ? rows : [];
    return res.json({ admission, readings: readingsList });
  } catch (err: any) {
    console.error('❌ [HEALTH] getMonitoringReadings error:', err.message || err);
    return res.status(503).json({ message: 'Database unavailable. Ensure PostgreSQL is running and DB connection is configured.', error: err.message });
  }
};

const parseMonitoringExcelBuffer = async (buffer: Buffer) => {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    const raw = cell.value != null ? String(cell.value).trim() : '';
    headers[colNumber - 1] = raw;
  });
  const rows: any[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, any> = {};
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (!header) return;
      const val = cell.value;
      if (val !== null && val !== undefined && `${val}`.trim() !== '') {
        obj[header] = val;
      }
    });
    if (Object.keys(obj).length > 0) rows.push(obj);
  });
  return rows;
};

const parseMonitoringCsvBuffer = (buffer: Buffer): any[] => {
  const text = buffer.toString('utf-8');
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const parseLine = (line: string, delim: string): string[] => {
    if (delim === ',') {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') inQuotes = !inQuotes;
        else if (c === ',' && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else current += c;
      }
      result.push(current.trim().replace(/^"|"$/g, ''));
      return result;
    }
    return line.split(delim).map((s) => s.trim().replace(/^"|"$/g, ''));
  };
  const delim = lines[0].includes('\t') ? '\t' : ',';
  const headers = parseLine(lines[0], delim).map((h) => h.trim());
  const rows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i], delim);
    const obj: Record<string, any> = {};
    headers.forEach((h, j) => {
      const v = values[j];
      if (v != null && v !== '' && v !== '--') obj[h] = v;
    });
    if (Object.keys(obj).length > 0) rows.push(obj);
  }
  return rows;
};

const parseMonitoringFileBuffer = async (buffer: Buffer, filename?: string): Promise<any[]> => {
  const lower = (filename || '').toLowerCase();
  if (lower.endsWith('.csv')) return parseMonitoringCsvBuffer(buffer);
  return parseMonitoringExcelBuffer(buffer);
};

/** Convert file buffer to plain text for Gemini (CSV or Excel converted to CSV-like text). */
const fileBufferToTextForGemini = async (buffer: Buffer, filename?: string): Promise<string> => {
  const lower = (filename || '').toLowerCase();
  if (lower.endsWith('.csv')) {
    return buffer.toString('utf-8');
  }
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return '';
  const rows: (string | undefined)[][] = [];
  let maxCol = 0;
  worksheet.eachRow((row) => {
    const cells: (string | undefined)[] = [];
    row.eachCell((cell, colNumber) => {
      const val = cell.value;
      const s = val != null ? String(val).trim() : '';
      cells[colNumber - 1] = s.includes(',') || s.includes('\t') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      maxCol = Math.max(maxCol, colNumber);
    });
    rows.push(cells);
  });
  return rows.map((cells) => Array.from({ length: maxCol }, (_, i) => cells[i] ?? '').join(',')).join('\n');
};

/** Filter out null/empty readings - skip records with no useful data. */
const filterNullReadings = (readings: any[]): any[] =>
  readings.filter((r) => {
    const hasRec = r.recorded_at && String(r.recorded_at).length > 10;
    const hasNum = [r.heart_rate, r.breath_rate, r.spo2, r.temperature, r.systolic_bp, r.diastolic_bp].some((v) => v != null);
    const hasMov = r.movement != null;
    return hasRec || hasNum || hasMov;
  });

/** Extract monitoring readings using Gemini LLM; fallback to rule-based parser if Gemini fails. */
const extractMonitoringReadingsWithGemini = async (buffer: Buffer, filename?: string): Promise<any[]> => {
  try {
    const text = await fileBufferToTextForGemini(buffer, filename);
    if (!text || text.trim().length < 10) {
      throw new Error('File content too short or empty');
    }
    const { readings } = await extractMonitoringDataFromCsvText(text);
    if (!Array.isArray(readings) || readings.length === 0) {
      throw new Error('Gemini returned no readings');
    }
    const toNum = (v: any) => (v == null || v === '') ? null : (typeof v === 'number' ? v : Number.isNaN(parseFloat(String(v))) ? null : parseFloat(String(v)));

    const mapped = readings.map((r: any) => ({
      recorded_at: r.recorded_at || new Date().toISOString(),
      heart_rate: toNum(r.heart_rate),
      breath_rate: toNum(r.breath_rate),
      spo2: toNum(r.spo2),
      temperature: toNum(r.temperature),
      systolic_bp: toNum(r.systolic_bp),
      diastolic_bp: toNum(r.diastolic_bp),
      movement: r.movement != null ? (r.movement === 1 || r.movement === '1' ? 1 : 0) : null,
    }));
    return filterNullReadings(mapped);
  } catch (geminiErr: any) {
    console.warn('⚠️ [HEALTH] Gemini extraction failed, using rule-based parser:', geminiErr?.message || geminiErr);
    const rawRows = await parseMonitoringFileBuffer(buffer, filename);
    return filterNullReadings(rawRowsToReadings(rawRows));
  }
};

const excelSerialToDate = (serial: number): Date => {
  const days = Math.floor(serial) - 25569;
  const frac = (serial - Math.floor(serial)) * 86400 * 1000;
  return new Date(days * 86400 * 1000 + frac);
};

const rawRowsToReadings = (rawRows: any[]): any[] => {
  const getVal = (row: any, ...keys: string[]) => {
    for (const k of keys) {
      const v = row[k] ?? row[k.replace(/_/g, ' ')] ?? row[k.replace(/\s+/g, '_')];
      if (v != null && v !== '' && String(v).trim() !== '--') return v;
    }
    return null;
  };
  const parseNum = (v: any) => {
    if (v == null || v === '' || String(v).trim() === '--') return null;
    if (typeof v === 'number') return v;
    const n = parseFloat(String(v));
    return Number.isNaN(n) ? null : n;
  };
  const parseTimestamp = (v: any): Date => {
    if (!v) return new Date();
    if (v instanceof Date) return v;
    if (typeof v === 'number' && v > 10000) return excelSerialToDate(v);
    const s = String(v).trim();
    if (!s || s === '--') return new Date();
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  };
  const readings: any[] = [];
  for (const row of rawRows) {
    const recordedAt = getVal(row, 'Timestamp (Device UTC timestamp)', 'Timestamp', 'recorded_at', 'recordedAt', 'datetime', 'date', 'time');
    const hr = parseNum(getVal(row, 'HeartRate (BPM)', 'HeartRate', 'heart_rate', 'heartRate'));
    const br = parseNum(getVal(row, 'BreathRate (RR)', 'BreathRate', 'breath_rate', 'breathRate'));
    const spo2 = parseNum(getVal(row, 'Spo2 (%)', 'Spo2', 'spo2'));
    const temp = parseNum(getVal(row, 'Temperature (°F)', 'Temperature', 'temperature'));
    const sys = parseNum(getVal(row, 'Systolic BP (mmHg)', 'Systolic BP', 'systolic_bp', 'systolicBp'));
    const dia = parseNum(getVal(row, 'Diastolic BP (mmHg)', 'Diastolic BP', 'diastolic_bp', 'diastolicBp'));
    const mov = (() => {
      const m = getVal(row, 'Movement', 'movement');
      if (m == null || m === '' || String(m).trim() === '--') return null;
      return m === 1 || m === '1' || String(m).toLowerCase() === 'yes' || String(m).toLowerCase() === 'movement' ? 1 : 0;
    })();
    if (!recordedAt && hr == null && br == null && spo2 == null && temp == null && sys == null && dia == null && mov == null) continue;
    const dt = parseTimestamp(recordedAt);
    readings.push({
      recorded_at: dt.toISOString(),
      heart_rate: hr,
      breath_rate: br,
      spo2,
      temperature: temp,
      systolic_bp: sys,
      diastolic_bp: dia,
      movement: mov,
    });
  }
  return readings;
};

/** Template headers - when file has these, use rule-based parsing only (no AI) to preserve dates. */
const TEMPLATE_HEADERS = ['recorded_at', 'heart_rate', 'breath_rate', 'spo2', 'temperature', 'systolic_bp', 'diastolic_bp', 'movement'];

const fileHasTemplateFormat = async (buffer: Buffer, filename?: string): Promise<boolean> => {
  const rawRows = await parseMonitoringFileBuffer(buffer, filename);
  if (rawRows.length === 0) return false;
  const first = rawRows[0];
  const keys = Object.keys(first || {});
  const matchCount = TEMPLATE_HEADERS.filter((h) => keys.some((k) => k.trim().toLowerCase() === h.toLowerCase())).length;
  return matchCount >= 5; // at least 5 template columns present
};

/** Parse file once; returns { useTemplate, readings } to avoid double parsing. */
const parseMonitoringFile = async (buffer: Buffer, filename?: string): Promise<{ useTemplate: boolean; readings: any[] }> => {
  const rawRows = await parseMonitoringFileBuffer(buffer, filename);
  const useTemplate = rawRows.length > 0 && (() => {
    const first = rawRows[0];
    const keys = Object.keys(first || {});
    return TEMPLATE_HEADERS.filter((h) => keys.some((k) => k.trim().toLowerCase() === h.toLowerCase())).length >= 5;
  })();
  const readings = useTemplate
    ? filterNullReadings(rawRowsToReadings(rawRows))
    : filterNullReadings(await extractMonitoringReadingsWithGemini(buffer, filename));
  return { useTemplate, readings };
};

export const getMonitoringTemplate = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.query?.client_id;
  const targetUserId = clientId || userId;
  const { admissionId } = req.params;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    await ensureHealthTablesReady();
    const sequelize = await getAppSequelize();
    const [adm]: any = await sequelize.query(
      `SELECT id FROM institution_admissions WHERE id = :admissionId AND patient_user_id = :targetUserId LIMIT 1`,
      { replacements: { admissionId, targetUserId }, type: QueryTypes.SELECT }
    );
    const admission = Array.isArray(adm) ? adm[0] : adm;
    if (!admission) return res.status(404).json({ message: 'Admission not found' });

    const csv = [
      'recorded_at,heart_rate,breath_rate,spo2,temperature,systolic_bp,diastolic_bp,movement',
      '2026-01-15T08:00:00.000Z,72,16,98,98.6,120,80,0',
      '2026-01-15T08:15:00.000Z,75,15,97,98.4,118,78,0',
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="monitoring_template.csv"');
    return res.send(csv);
  } catch (err: any) {
    console.error('❌ [HEALTH] getMonitoringTemplate error:', err.message || err);
    return res.status(503).json({ message: 'Database unavailable', error: err.message });
  }
};

export const previewMonitoringImport = async (req: any, res: Response) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ message: 'Excel or CSV file is required' });
  }
  try {
    const { useTemplate, readings } = await parseMonitoringFile(req.file.buffer, req.file.originalname);
    return res.json({ rows: readings, usedTemplate: useTemplate });
  } catch (err: any) {
    console.error('❌ [HEALTH] previewMonitoringImport error:', err.message || err);
    return res.status(400).json({ message: 'Invalid file: ' + (err?.message || 'Unable to parse') });
  }
};

export const importMonitoringReadings = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.body?.client_id || req.query?.client_id;
  const targetUserId = clientId || userId;
  const { admissionId } = req.params;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ message: 'Excel or CSV file is required' });
  }

  try {
    await ensureHealthTablesReady();
    const sequelize = await getAppSequelize();
    const [adm]: any = await sequelize.query(
      `SELECT id FROM institution_admissions WHERE id = :admissionId AND patient_user_id = :targetUserId LIMIT 1`,
      { replacements: { admissionId, targetUserId }, type: QueryTypes.SELECT }
    );
    const admission = Array.isArray(adm) ? adm[0] : adm;
    if (!admission) return res.status(404).json({ message: 'Admission not found' });

    const { useTemplate, readings } = await parseMonitoringFile(req.file.buffer, req.file.originalname);

    const BATCH_SIZE = 100;
    const inserted: any[] = [];
    for (let i = 0; i < readings.length; i += BATCH_SIZE) {
      const batch = readings.slice(i, i + BATCH_SIZE);
      const values = batch.map((_, idx) => {
        const o = idx * 10;
        return `(:id${o}, :admission_id, :recorded_at${o}, :heart_rate${o}, :breath_rate${o}, :spo2${o}, :temperature${o}, :systolic_bp${o}, :diastolic_bp${o}, :movement${o})`;
      }).join(', ');
      const replacements: Record<string, any> = { admission_id: admissionId };
      batch.forEach((r, idx) => {
        const o = idx * 10;
        replacements[`id${o}`] = uuidv4();
        replacements[`recorded_at${o}`] = r.recorded_at;
        replacements[`heart_rate${o}`] = r.heart_rate;
        replacements[`breath_rate${o}`] = r.breath_rate;
        replacements[`spo2${o}`] = r.spo2;
        replacements[`temperature${o}`] = r.temperature;
        replacements[`systolic_bp${o}`] = r.systolic_bp;
        replacements[`diastolic_bp${o}`] = r.diastolic_bp;
        replacements[`movement${o}`] = r.movement;
      });
      const [raw]: any = await sequelize.query(
        `INSERT INTO monitoring_readings
          (id, admission_id, recorded_at, heart_rate, breath_rate, spo2, temperature, systolic_bp, diastolic_bp, movement)
         VALUES ${values}
         RETURNING *`,
        { replacements }
      );
      const arr = Array.isArray(raw) ? raw : (raw?.rows && Array.isArray(raw.rows) ? raw.rows : []);
      inserted.push(...arr);
    }
    return res.json({ imported: inserted.length, readings: inserted });
  } catch (err: any) {
    console.error('❌ [HEALTH] importMonitoringReadings error:', err.message || err);
    const isDbError = err?.code === 'ECONNREFUSED' || err?.code === 'ECONNRESET' || err?.message?.includes('ECONNREFUSED') || err?.message?.includes('connect');
    if (isDbError) {
      return res.status(503).json({ message: 'Database unavailable. Ensure PostgreSQL is running and DB connection is configured.', error: err.message });
    }
    return res.status(500).json({ message: 'Import failed: ' + (err?.message || 'Unknown error') });
  }
};

// ========== ADMISSION TREATMENTS ==========

export const getAdmissionTreatments = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const clientId = req.query.client_id;
  const targetUserId = clientId || userId;
  const { admissionId } = req.params;
  const startDate = req.query.start_date as string;
  const endDate = req.query.end_date as string;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    await ensureHealthTablesReady();
    const sequelize = await getAppSequelize();
    const admResult: any = await sequelize.query(
      `SELECT * FROM institution_admissions WHERE id = :admissionId AND patient_user_id = :targetUserId LIMIT 1`,
      { replacements: { admissionId, targetUserId }, type: QueryTypes.SELECT }
    );
    const admList = Array.isArray(admResult) ? admResult : [];
    const admission = admList.length > 0 ? admList[0] : null;
    if (!admission) return res.status(404).json({ message: 'Admission not found' });

    let sql = `SELECT * FROM admission_treatments WHERE admission_id = :admissionId`;
    const params: Record<string, any> = { admissionId };
    if (startDate) { sql += ` AND recorded_at >= :startDate`; params.startDate = startDate; }
    if (endDate) { sql += ` AND recorded_at <= :endDate`; params.endDate = endDate; }
    sql += ` ORDER BY recorded_at ASC`;

    const rows: any = await sequelize.query(sql, { replacements: params, type: QueryTypes.SELECT });
    const treatments = Array.isArray(rows) ? rows : [];
    return res.json({ treatments });
  } catch (err: any) {
    console.error('❌ [HEALTH] getAdmissionTreatments error:', err.message || err);
    return res.status(503).json({ message: 'Database unavailable.', error: err.message });
  }
};

export const addAdmissionTreatment = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const userName = req.user?.name || req.user?.email || 'Unknown';
  const clientId = req.body?.client_id || req.query.client_id;
  const targetUserId = clientId || userId;
  const { admissionId } = req.params;
  const { recorded_at, treatment_name, quantity, notes, doctor_name } = req.body || {};
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  if (!treatment_name || typeof treatment_name !== 'string' || !treatment_name.trim()) {
    return res.status(400).json({ message: 'treatment_name is required' });
  }
  const recordedAt = recorded_at || new Date().toISOString();

  try {
    await ensureHealthTablesReady();
    const sequelize = await getAppSequelize();
    const admResult: any = await sequelize.query(
      `SELECT id FROM institution_admissions WHERE id = :admissionId AND patient_user_id = :targetUserId LIMIT 1`,
      { replacements: { admissionId, targetUserId }, type: QueryTypes.SELECT }
    );
    const admList = Array.isArray(admResult) ? admResult : [];
    const admission = admList.length > 0 ? admList[0] : null;
    if (!admission) return res.status(404).json({ message: 'Admission not found' });

    const [rows]: any = await sequelize.query(
      `INSERT INTO admission_treatments
        (id, admission_id, recorded_at, treatment_name, quantity, notes, doctor_name, entered_by_name)
       VALUES (:id, :admission_id, :recorded_at, :treatment_name, :quantity, :notes, :doctor_name, :entered_by_name)
       RETURNING *`,
      {
        replacements: {
          id: uuidv4(),
          admission_id: admissionId,
          recorded_at: recordedAt,
          treatment_name: treatment_name.trim(),
          quantity: quantity != null ? String(quantity).trim() : null,
          notes: notes != null ? String(notes).trim() : null,
          doctor_name: doctor_name != null ? String(doctor_name).trim() : null,
          entered_by_name: userName,
        },
      }
    );
    const treatment = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    return res.status(201).json({ treatment });
  } catch (err: any) {
    console.error('❌ [HEALTH] addAdmissionTreatment error:', err.message || err);
    return res.status(503).json({ message: 'Database unavailable.', error: err.message });
  }
};
