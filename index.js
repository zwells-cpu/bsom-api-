require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`BSOM API running on http://localhost:${PORT}`);
});
