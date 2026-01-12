import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { QueryTypes } from 'sequelize';

// Fallback in-memory stores to keep UI usable if DB schema differs or is unavailable
const inMemoryAppointments: any[] = [];
const inMemoryVitals: any[] = [];

const getAppSequelize = async () => {
  const db = await import('../config/database-integrated');
  return db.appSequelize;
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

// Determine column names dynamically to avoid hard-coding schema
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

const resolveVitalColumns = (cols: Record<string, any> | null) => {
  const columnNames = cols ? Object.keys(cols) : [];
  const pick = (...names: string[]) => names.find((n) => columnNames.includes(n)) || null;
  return {
    patientCol: pick('patient_user_id', 'user_id'),
    parameterCol: pick('parameter', 'name'),
    valueCol: pick('value', 'reading'),
    unitCol: pick('unit'),
    measuredAtCol: pick('measured_at', 'recorded_at', 'date'),
    referenceRangeCol: pick('reference_range'),
    sourceReportCol: pick('source_report_id', 'report_id'),
  };
};

export const getAppointments = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const sequelize = await getAppSequelize();
    const cols = await describeTableSafe('appointments');
    const { patientCol, doctorCol, datetimeCol } = resolveAppointmentColumns(cols);

    if (!cols || !patientCol) {
      // Fallback to in-memory
      const items = inMemoryAppointments.filter((a) => a.patient_user_id === userId);
      return res.json({ appointments: items });
    }

    const selectColumns = ['id', patientCol, doctorCol, datetimeCol, 'title', 'status', 'location', 'notes']
      .filter(Boolean)
      .map((c) => `"${c}"`)
      .join(', ');

    const [rows]: any = await sequelize.query(
      `SELECT ${selectColumns} FROM appointments WHERE "${patientCol}" = :userId ORDER BY ${datetimeCol ? `"${datetimeCol}"` : '"created_at"'} DESC`,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );

    return res.json({ appointments: rows || [] });
  } catch (err: any) {
    console.error('❌ [HEALTH] getAppointments error:', err.message || err);
    const items = inMemoryAppointments.filter((a) => a.patient_user_id === userId);
    return res.json({ appointments: items, warning: 'DB unavailable, using in-memory data' });
  }
};

export const createAppointment = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const { title, datetime, location, notes, status = 'planned', doctor_user_id = null } = req.body || {};

  try {
    const sequelize = await getAppSequelize();
    const cols = await describeTableSafe('appointments');
    const { patientCol, doctorCol, datetimeCol, statusCol, titleCol, notesCol, locationCol } = resolveAppointmentColumns(cols);

    if (!cols || !patientCol) {
      const payload = {
        id: uuidv4(),
        patient_user_id: userId,
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

    pushCol('id', 'id', uuidv4());
    pushCol(patientCol, 'patient', userId);
    pushCol(doctorCol, 'doctor', doctor_user_id);
    pushCol(titleCol || 'title', 'title', title);
    pushCol(datetimeCol || 'datetime', 'datetime', datetime);
    pushCol(locationCol || 'location', 'location', location);
    pushCol(notesCol || 'notes', 'notes', notes);
    pushCol(statusCol || 'status', 'status', status);

    const sql = `INSERT INTO appointments (${insertCols.join(', ')}) VALUES (${values.join(', ')}) RETURNING *`;
    const [rows]: any = await sequelize.query(sql, { replacements: params, type: QueryTypes.INSERT });
    const created = Array.isArray(rows) ? rows[0] : rows;
    return res.json({ appointment: created });
  } catch (err: any) {
    console.error('❌ [HEALTH] createAppointment error:', err.message || err);
    const payload = {
      id: uuidv4(),
      patient_user_id: userId,
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

export const getVitals = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const sequelize = await getAppSequelize();
    const cols = await describeTableSafe('vital_parameters');
    const { patientCol, parameterCol, valueCol, unitCol, measuredAtCol, referenceRangeCol, sourceReportCol } = resolveVitalColumns(cols);

    if (!cols || !patientCol || !parameterCol) {
      const items = inMemoryVitals.filter((v) => v.patient_user_id === userId);
      return res.json({ vitals: items });
    }

    const selectColumns = [
      '"id"',
      patientCol && `"${patientCol}"`,
      parameterCol && `"${parameterCol}" AS parameter`,
      valueCol && `"${valueCol}" AS value`,
      unitCol && `"${unitCol}" AS unit`,
      measuredAtCol && `"${measuredAtCol}" AS measured_at`,
      referenceRangeCol && `"${referenceRangeCol}" AS reference_range`,
      sourceReportCol && `"${sourceReportCol}" AS source_report_id`,
    ]
      .filter(Boolean)
      .join(', ');

    const [rows]: any = await sequelize.query(
      `SELECT ${selectColumns} FROM vital_parameters WHERE "${patientCol}" = :userId ORDER BY ${measuredAtCol ? `"${measuredAtCol}"` : '"created_at"'} DESC`,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );

    return res.json({ vitals: rows || [] });
  } catch (err: any) {
    console.error('❌ [HEALTH] getVitals error:', err.message || err);
    const items = inMemoryVitals.filter((v) => v.patient_user_id === userId);
    return res.json({ vitals: items, warning: 'DB unavailable, using in-memory data' });
  }
};

export const addVital = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const { parameter, value, unit, measured_at, reference_range, source_report_id } = req.body || {};

  try {
    const sequelize = await getAppSequelize();
    const cols = await describeTableSafe('vital_parameters');
    const { patientCol, parameterCol, valueCol, unitCol, measuredAtCol, referenceRangeCol, sourceReportCol } = resolveVitalColumns(cols);

    if (!cols || !patientCol || !parameterCol || !valueCol) {
      const payload = {
        id: uuidv4(),
        patient_user_id: userId,
        parameter,
        value,
        unit,
        measured_at,
        reference_range,
        source_report_id,
        created_at: new Date().toISOString(),
      };
      inMemoryVitals.unshift(payload);
      return res.json({ vital: payload, warning: 'DB unavailable, stored in-memory' });
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

    pushCol('id', 'id', uuidv4());
    pushCol(patientCol, 'patient', userId);
    pushCol(parameterCol, 'parameter', parameter);
    pushCol(valueCol, 'value', value);
    pushCol(unitCol || 'unit', 'unit', unit);
    pushCol(measuredAtCol || 'measured_at', 'measured_at', measured_at);
    pushCol(referenceRangeCol || 'reference_range', 'reference_range', reference_range);
    pushCol(sourceReportCol || 'source_report_id', 'source_report_id', source_report_id);

    const sql = `INSERT INTO vital_parameters (${insertCols.join(', ')}) VALUES (${values.join(', ')}) RETURNING *`;
    const [rows]: any = await sequelize.query(sql, { replacements: params, type: QueryTypes.INSERT });
    const created = Array.isArray(rows) ? rows[0] : rows;
    return res.json({ vital: created });
  } catch (err: any) {
    console.error('❌ [HEALTH] addVital error:', err.message || err);
    const payload = {
      id: uuidv4(),
      patient_user_id: userId,
      parameter,
      value,
      unit,
      measured_at,
      reference_range,
      source_report_id,
      created_at: new Date().toISOString(),
    };
    inMemoryVitals.unshift(payload);
    return res.json({ vital: payload, warning: 'DB unavailable, stored in-memory' });
  }
};

// Upload + extraction stubs
export const uploadReport = async (req: any, res: Response) => {
  // Stub: accept metadata and return an id
  const id = uuidv4();
  return res.json({
    report: {
      id,
      file_url: req.body?.file_url || 'https://example.com/report.pdf',
      status: 'pending_extraction',
      uploaded_at: new Date().toISOString(),
    }
  });
};

export const extractReport = async (req: any, res: Response) => {
  // Stub extraction: return sample vitals to review
  const sampleVitals = [
    { parameter: 'HbA1c', value: 6.1, unit: '%', reference_range: '4.0-5.6', confidence: 0.61 },
    { parameter: 'Fasting Glucose', value: 108, unit: 'mg/dL', reference_range: '70-99', confidence: 0.55 },
    { parameter: 'Systolic BP', value: 122, unit: 'mmHg', reference_range: '90-120', confidence: 0.7 },
  ];
  return res.json({ extraction: { status: 'review', vitals: sampleVitals } });
};

export const confirmVitals = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const vitals = Array.isArray(req.body?.vitals) ? req.body.vitals : [];
  const created: any[] = [];
  for (const v of vitals) {
    const fakeReq: any = { user: { id: userId }, body: v };
    const collector: any = { json: (data: any) => created.push(data.vital || data) };
    await addVital(fakeReq, collector as any);
  }
  return res.json({ vitals: created });
};
