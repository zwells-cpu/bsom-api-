require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const crypto = require('crypto');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());
app.use(cors());

const db = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

app.get('/', (req, res) => {
  res.send('Root route works');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'BSOM API is running' });
});

app.get('/referrals', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM public.referrals ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/assessments', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM public.assessments ORDER BY assessment_started_date DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/assessments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT * FROM public.assessments WHERE assessment_id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/activity-logs', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM public.activity_logs ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/activity-logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT * FROM public.activity_logs WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Activity log not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/referrals/:id/activity', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT * FROM public.activity_logs WHERE entity_id = $1 ORDER BY created_at DESC',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/referrals/:id/profile', async (req, res) => {
  try {
    const { id } = req.params;

    const [referralResult, assessmentResult] = await Promise.all([
      db.query('SELECT * FROM public.referrals WHERE id = $1', [id]),
      db.query('SELECT * FROM public.assessments WHERE referral_id = $1', [id]),
    ]);

    if (referralResult.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const referral = referralResult.rows[0];
    const assessment = assessmentResult.rows[0] || null;

    const pipeline = [
      {
        stage: 'Parent Interview',
        status: assessment?.parent_interview_status || 'Pending',
        scheduled_date: assessment?.parent_interview_scheduled_date || null,
        completed_date: assessment?.parent_interview_completed_date || null,
      },
      {
        stage: 'Assessment',
        status: assessment?.assessment_status || 'Pending',
        started_date: assessment?.assessment_started_date || null,
        completed_date: assessment?.assessment_completed_date || null,
      },
      {
        stage: 'Treatment Plan',
        status: assessment?.treatment_plan_status || 'Pending',
        started_date: assessment?.treatment_plan_started_date || null,
        completed_date: assessment?.treatment_plan_completed_date || null,
      },
      {
        stage: 'Authorization',
        status: assessment?.authorization_status || 'Pending',
        submitted_date: assessment?.authorization_submitted_date || null,
        approved_date: assessment?.authorization_approved_date || null,
      },
      {
        stage: 'Active Client',
        status: assessment?.ready_for_services ? 'Ready' : 'Pending',
        active_client_date: assessment?.active_client_date || null,
      },
    ];

    res.json({ referral, assessment, pipeline });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/referrals/:id/assessments', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT *
       FROM public.assessments
       WHERE referral_id = $1
       ORDER BY assessment_started_date DESC NULLS LAST, assessment_id DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/referrals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT * FROM referrals WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.post('/referrals', async (req, res) => {
  try {
    const data = req.body;

    const result = await db.query(
      `INSERT INTO public.referrals (
        first_name, last_name, caregiver, caregiver_phone, caregiver_email
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        data.first_name,
        data.last_name,
        data.caregiver,
        data.caregiver_phone,
        data.caregiver_email
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create referral error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/referrals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const allowed = ['first_name', 'last_name', 'caregiver', 'caregiver_phone', 'caregiver_email'];
    const fields = Object.keys(data).filter(k => allowed.includes(k));

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided' });
    }

    const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values = fields.map(f => data[f]);
    values.push(id);

    const result = await db.query(
      `UPDATE public.referrals SET ${setClauses} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Referral not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update referral error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/assessments', async (req, res) => {
  try {
    const data = req.body;

    const result = await db.query(
      `INSERT INTO public.assessments (
        referral_id,
        parent_interview_status, parent_interview_scheduled_date, parent_interview_completed_date,
        assessment_status, assessment_started_date, assessment_completed_date,
        treatment_plan_status, treatment_plan_started_date, treatment_plan_completed_date,
        authorization_status, authorization_submitted_date, authorization_approved_date,
        ready_for_services, active_client_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        data.referral_id,
        data.parent_interview_status ?? null,
        data.parent_interview_scheduled_date ?? null,
        data.parent_interview_completed_date ?? null,
        data.assessment_status ?? null,
        data.assessment_started_date ?? null,
        data.assessment_completed_date ?? null,
        data.treatment_plan_status ?? null,
        data.treatment_plan_started_date ?? null,
        data.treatment_plan_completed_date ?? null,
        data.authorization_status ?? null,
        data.authorization_submitted_date ?? null,
        data.authorization_approved_date ?? null,
        data.ready_for_services ?? false,
        data.active_client_date ?? null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create assessment error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/assessments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const allowed = [
      'parent_interview_status', 'parent_interview_scheduled_date', 'parent_interview_completed_date',
      'assessment_status', 'assessment_started_date', 'assessment_completed_date',
      'treatment_plan_status', 'treatment_plan_started_date', 'treatment_plan_completed_date',
      'authorization_status', 'authorization_submitted_date', 'authorization_approved_date',
      'ready_for_services', 'active_client_date',
    ];
    const fields = Object.keys(data).filter(k => allowed.includes(k));

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided' });
    }

    const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values = fields.map(f => data[f]);
    values.push(id);

    const result = await db.query(
      `UPDATE public.assessments SET ${setClauses} WHERE assessment_id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update assessment error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/assessments/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM public.assessments WHERE assessment_id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    res.json({ message: 'Assessment deleted', data: result.rows[0] });
  } catch (error) {
    console.error('Delete assessment error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/activity-logs', async (req, res) => {
  try {
    const data = req.body;

    const result = await db.query(
      `INSERT INTO public.activity_logs (
        user_id, user_name, user_role,
        action_type, entity_type, entity_id, entity_name,
        details, action, client_name, description, office, actor, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        data.user_id ?? null,
        data.user_name ?? null,
        data.user_role ?? null,
        data.action_type ?? null,
        data.entity_type ?? null,
        data.entity_id ?? null,
        data.entity_name ?? null,
        data.details ?? null,
        data.action ?? null,
        data.client_name ?? null,
        data.description ?? null,
        data.office ?? null,
        data.actor ?? null,
        data.metadata ?? null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create activity log error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/referrals/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM public.referrals WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Referral not found' });
    }

    res.json({ message: 'Referral deleted', data: result.rows[0] });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── Supabase storage client (service role – bypasses RLS) ─────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Multer: memory storage, 10 MB hard cap ────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Wraps upload.single so multer errors become clean JSON responses instead of
// Express's default HTML error page or an unhandled-exception crash.
function uploadSingle(fieldName) {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'File is too large. Maximum size is 10 MB.' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      // Non-multer error from the stream (e.g. malformed multipart)
      return res.status(400).json({ error: 'Malformed multipart request.' });
    });
  };
}

// ── Magic-byte file type detection ────────────────────────────────────────────
// Inspects the raw buffer so a renamed or spoofed MIME type is still rejected.
const ALLOWED_SIGNATURES = [
  { mime: 'application/pdf', check: (b) => b[0]===0x25&&b[1]===0x50&&b[2]===0x44&&b[3]===0x46 }, // %PDF
  { mime: 'image/jpeg',      check: (b) => b[0]===0xFF&&b[1]===0xD8&&b[2]===0xFF },
  { mime: 'image/png',       check: (b) => b[0]===0x89&&b[1]===0x50&&b[2]===0x4E&&b[3]===0x47&&b[4]===0x0D&&b[5]===0x0A&&b[6]===0x1A&&b[7]===0x0A },
  { mime: 'image/webp',      check: (b) => b[0]===0x52&&b[1]===0x49&&b[2]===0x46&&b[3]===0x46&&b[8]===0x57&&b[9]===0x45&&b[10]===0x42&&b[11]===0x50 }, // RIFF....WEBP
];

function detectMagicType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  for (const sig of ALLOWED_SIGNATURES) {
    if (sig.check(buffer)) return sig.mime;
  }
  return null;
}

function sanitizeFileName(name) {
  return (name || 'document').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
}

// ── GET /referrals/:id/documents ──────────────────────────────────────────────
app.get('/referrals/:id/documents', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'SELECT * FROM public.client_documents WHERE referral_id = $1 ORDER BY created_at DESC',
      [id]
    );
    const rows = result.rows;

    // Attach a short-lived signed URL so the frontend can view/download each
    // file without making the bucket public.
    if (rows.length > 0) {
      const paths = rows.map((r) => r.file_path);
      const { data: signed } = await supabase.storage
        .from('client-documents')
        .createSignedUrls(paths, 3600); // 1-hour TTL

      const urlMap = {};
      if (Array.isArray(signed)) {
        for (const entry of signed) {
          if (entry.signedUrl) urlMap[entry.path] = entry.signedUrl;
        }
      }

      const enriched = rows.map((r) => ({ ...r, signed_url: urlMap[r.file_path] ?? null }));
      return res.json(enriched);
    }

    res.json(rows);
  } catch (err) {
    console.error('GET /referrals/:id/documents error:', err);
    res.status(500).json({ error: 'Could not retrieve documents.' });
  }
});

// ── POST /referrals/:id/documents ─────────────────────────────────────────────
app.post('/referrals/:id/documents', uploadSingle('file'), async (req, res) => {
  try {
    const { id: referralId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided.' });
    }

    // 1. Magic-byte validation – rejects spoofed files regardless of MIME header
    const detectedMime = detectMagicType(req.file.buffer);
    if (!detectedMime) {
      return res.status(400).json({ error: 'File type not allowed. Upload a real PDF, JPEG, PNG, or WebP.' });
    }

    const { document_type, uploaded_by, uploaded_by_name, client_name } = req.body;

    // 2. Build a collision-safe storage path
    const safeName = sanitizeFileName(req.file.originalname);
    const filePath = `${referralId}/${crypto.randomUUID()}-${safeName}`;

    // 3. Upload to Supabase storage
    const { error: storageError } = await supabase.storage
      .from('client-documents')
      .upload(filePath, req.file.buffer, {
        contentType: detectedMime, // use the verified type, not the client-supplied one
        upsert: false,
      });

    if (storageError) {
      console.error('Storage upload error:', storageError);
      return res.status(500).json({ error: 'Storage upload failed.' });
    }

    // 4. Persist metadata to the database
    let row;
    try {
      const insert = await db.query(
        `INSERT INTO public.client_documents
           (referral_id, document_type, file_name, file_path, file_size, mime_type, uploaded_by, uploaded_by_name, client_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          referralId,
          document_type || 'Other',
          req.file.originalname,
          filePath,
          req.file.size,
          detectedMime,
          uploaded_by || null,
          uploaded_by_name || null,
          client_name || null,
        ]
      );
      row = insert.rows[0];
    } catch (dbErr) {
      // Rollback: remove the file that was already stored
      await supabase.storage.from('client-documents').remove([filePath]);
      console.error('DB insert error (storage rolled back):', dbErr);
      return res.status(500).json({ error: 'Database insert failed.' });
    }

    // 5. Activity log (best-effort – a failure here does not fail the upload)
    try {
      await db.query(
        `INSERT INTO public.activity_logs
           (action, action_type, entity_type, entity_id, entity_name, client_name, description, actor, details, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          'document_uploaded',
          'document_uploaded',
          'referral',
          referralId,
          client_name || null,
          client_name || null,
          `${client_name || 'Client'} had a ${document_type || 'document'} uploaded.`,
          uploaded_by_name || null,
          JSON.stringify({ document_type, file_name: req.file.originalname, mime_type: detectedMime, file_size: req.file.size }),
          JSON.stringify({ document_type, file_name: req.file.originalname, mime_type: detectedMime, file_size: req.file.size }),
        ]
      );
    } catch (logErr) {
      console.error('Activity log insert failed (non-fatal):', logErr);
    }

    res.status(201).json(row);
  } catch (err) {
    console.error('POST /referrals/:id/documents error:', err);
    res.status(500).json({ error: 'Document upload failed.' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`BSOM API running on http://localhost:${PORT}`);
});
