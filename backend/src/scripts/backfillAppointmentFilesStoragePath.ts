import { QueryTypes } from 'sequelize';

const run = async () => {
  const db = await import('../config/database-integrated');
  const appSequelize = db.appSequelize;
  const bucket = process.env.GCS_BUCKET || '';

  if (!bucket) {
    console.error('GCS_BUCKET is not set');
    process.exit(1);
  }

  const [rows]: any = await appSequelize.query(
    `SELECT id, file_url, storage_path FROM appointment_files WHERE storage_path IS NULL`,
    { type: QueryTypes.SELECT }
  );

  let updated = 0;
  for (const row of rows || []) {
    if (!row.file_url) continue;
    let gcsPath: string | null = null;
    if (row.file_url.startsWith('gs://')) {
      gcsPath = row.file_url;
    } else {
      const prefix = `https://storage.googleapis.com/${bucket}/`;
      if (row.file_url.startsWith(prefix)) {
        const objectPath = row.file_url.replace(prefix, '');
        gcsPath = `gs://${bucket}/${objectPath}`;
      }
    }
    if (!gcsPath) continue;

    await appSequelize.query(
      `UPDATE appointment_files SET storage_path = :storagePath WHERE id = :id`,
      { replacements: { storagePath: gcsPath, id: row.id }, type: QueryTypes.UPDATE }
    );
    updated += 1;
  }

  console.log(`Backfill complete. Updated ${updated} record(s).`);
  process.exit(0);
};

run().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
