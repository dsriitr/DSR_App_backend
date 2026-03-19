const { pool } = require('./index');

const migrations = [
  // 1. managers
  `CREATE TABLE IF NOT EXISTS managers (
    manager_id    SERIAL PRIMARY KEY,
    full_name     VARCHAR(100) NOT NULL,
    initials      VARCHAR(4)   NOT NULL,
    avatar_color  VARCHAR(20)  DEFAULT '#6366f1',
    phone_number  VARCHAR(20)  UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(30)  DEFAULT 'Sales Manager'
                  CHECK (role IN ('Sales Manager','Team Leader','Admin')),
    assigned_team_leader_id INT REFERENCES managers(manager_id),
    is_online     BOOLEAN      DEFAULT FALSE,
    last_checkin_site      VARCHAR(100),
    last_checkin_at        TIMESTAMPTZ,
    checkin_elapsed_minutes INT,
    status        VARCHAR(20)  DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
    created_at    TIMESTAMPTZ  DEFAULT NOW()
  )`,

  // 2. projects
  `CREATE TABLE IF NOT EXISTS projects (
    project_id   SERIAL PRIMARY KEY,
    project_name VARCHAR(100) UNIQUE NOT NULL,
    status       VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
    created_at   TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 3. leads
  `CREATE TABLE IF NOT EXISTS leads (
    lead_id          SERIAL PRIMARY KEY,
    lead_name        VARCHAR(100) NOT NULL,
    phone_number     VARCHAR(20)  NOT NULL,
    hometown         VARCHAR(100),
    profession       VARCHAR(100),
    decision_maker   VARCHAR(100),
    lead_source      VARCHAR(50)  DEFAULT 'Walk-in'
                     CHECK (lead_source IN ('Facebook','Walk-in','Field Data','Customer Reference','Broker','Newspaper Ad','Superfone','Calling')),
    lead_source_other VARCHAR(100),
    lead_status      VARCHAR(50)  DEFAULT 'Open'
                     CHECK (lead_status IN ('Open','Cold Interested','Hot Interested',
                       'SV Scheduled','SV Done','Positive','Pipeline','Booking',
                       'Booking Cancel','Not Interested','No Deal')),
    ai_suggested_status VARCHAR(50),
    status_changed_at   TIMESTAMPTZ DEFAULT NOW(),
    owner_manager_id    INT REFERENCES managers(manager_id),
    project_name        VARCHAR(100),
    unit_type           VARCHAR(50)
                        CHECK (unit_type IN ('Plot','2BHK Flat','3BHK Flat','Duplex','Shop') OR unit_type IS NULL),
    budget_min          NUMERIC(12,2),
    budget_max          NUMERIC(12,2),
    deal_value          NUMERIC(12,2),
    lead_score          NUMERIC(4,2),
    dm_met              BOOLEAN DEFAULT FALSE,
    last_meeting_or_sv_date DATE,
    last_meeting_minutes    INT,
    days_no_activity        INT DEFAULT 0,
    followup_due_date       DATE,
    net_change_this_period  INT DEFAULT 0,
    pipeline_entered_date   DATE,
    days_in_pipeline        INT DEFAULT 0,
    no_activity_7_days      BOOLEAN DEFAULT FALSE,
    no_activity_30_days     BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 4. lead_preferences
  `CREATE TABLE IF NOT EXISTS lead_preferences (
    preference_id      SERIAL PRIMARY KEY,
    lead_id            INT REFERENCES leads(lead_id) ON DELETE CASCADE,
    project_preference VARCHAR(100),
    unit_type          VARCHAR(50),
    unit_size_sqft     INT,
    budget_min         NUMERIC(12,2),
    budget_max         NUMERIC(12,2),
    budget_clarity     VARCHAR(20) CHECK (budget_clarity IN ('Clear','Vague','Not Discussed') OR budget_clarity IS NULL),
    financing_mode     VARCHAR(20) CHECK (financing_mode IN ('Loan','Self-funded','Mixed') OR financing_mode IS NULL),
    loan_amount        NUMERIC(12,2),
    reason_for_buying  VARCHAR(20) CHECK (reason_for_buying IN ('Investment','Self-use','Both') OR reason_for_buying IS NULL),
    purchase_timeline  VARCHAR(100),
    urgency_level      VARCHAR(10) CHECK (urgency_level IN ('High','Medium','Low') OR urgency_level IS NULL),
    source_meeting_id  INT,
    updated_at         TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 5. bookings
  `CREATE TABLE IF NOT EXISTS bookings (
    booking_id      SERIAL PRIMARY KEY,
    lead_id         INT REFERENCES leads(lead_id),
    manager_id      INT REFERENCES managers(manager_id),
    project_id      INT REFERENCES projects(project_id),
    unit_number     VARCHAR(50),
    booking_amount  NUMERIC(12,2),
    unit_type       VARCHAR(50),
    booking_date    DATE,
    booking_status  VARCHAR(20) DEFAULT 'Active' CHECK (booking_status IN ('Active','Cancelled')),
    cancellation_reason VARCHAR(255),
    cancellation_date   DATE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 6. meetings
  `CREATE TABLE IF NOT EXISTS meetings (
    meeting_id        SERIAL PRIMARY KEY,
    lead_id           INT REFERENCES leads(lead_id),
    manager_id        INT REFERENCES managers(manager_id),
    project_id        INT REFERENCES projects(project_id),
    meeting_date      DATE        NOT NULL,
    start_time        TIME        NOT NULL,
    end_time          TIME,
    duration_minutes  INT         NOT NULL DEFAULT 0,
    meeting_type      VARCHAR(20) DEFAULT 'New' CHECK (meeting_type IN ('New','Repeat')),
    meeting_category  VARCHAR(20) DEFAULT 'Field' CHECK (meeting_category IN ('Field','Office')),
    is_site_visit     BOOLEAN     DEFAULT FALSE,
    checkin_site_name VARCHAR(100),
    checkin_time      TIME,
    checkin_elapsed_minutes INT,
    recording_url     TEXT,
    recording_duration_seconds INT,
    transcript_status VARCHAR(20) DEFAULT 'Pending'
                      CHECK (transcript_status IN ('Pending','Processing','Completed','Failed')),
    ai_analysis_status VARCHAR(20) DEFAULT 'Pending'
                      CHECK (ai_analysis_status IN ('Pending','Processing','Completed','Failed')),
    uploaded_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 7. meeting_transcripts
  `CREATE TABLE IF NOT EXISTS meeting_transcripts (
    transcript_id   SERIAL PRIMARY KEY,
    meeting_id      INT REFERENCES meetings(meeting_id) ON DELETE CASCADE,
    transcript_text TEXT,
    language        VARCHAR(20) DEFAULT 'Hindi',
    word_count      INT,
    confidence_score NUMERIC(4,3),
    generated_at    TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 8. meeting_ai_analysis
  `CREATE TABLE IF NOT EXISTS meeting_ai_analysis (
    analysis_id             SERIAL PRIMARY KEY,
    meeting_id              INT REFERENCES meetings(meeting_id) ON DELETE CASCADE,
    meeting_summary         TEXT,
    lead_status_suggested   VARCHAR(50),
    lead_intent             TEXT,
    site_visit_status       VARCHAR(20) CHECK (site_visit_status IN ('Done','Scheduled','Not Discussed') OR site_visit_status IS NULL),
    deal_probability_percent INT,
    meeting_sentiment       VARCHAR(20) DEFAULT 'Progressive'
                            CHECK (meeting_sentiment IN ('Super','Progressive','Time Waste')),
    meeting_score           NUMERIC(4,2),
    talk_ratio_manager_percent  INT,
    talk_ratio_client_percent   INT,
    questions_asked_count       INT,
    needs_analysis_done         BOOLEAN DEFAULT FALSE,
    budget_qualification_done   BOOLEAN DEFAULT FALSE,
    objection_handling_score    NUMERIC(4,2),
    close_attempt_detected      BOOLEAN DEFAULT FALSE,
    next_step_defined           BOOLEAN DEFAULT FALSE,
    confidence_level            VARCHAR(10) CHECK (confidence_level IN ('High','Medium','Low') OR confidence_level IS NULL),
    manager_strengths           TEXT,
    manager_improvement         TEXT,
    expected_next_status        VARCHAR(50),
    dm_present                  BOOLEAN DEFAULT FALSE,
    decision_maker_identified   VARCHAR(100),
    generated_at                TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 9. lead_objections
  `CREATE TABLE IF NOT EXISTS lead_objections (
    objection_id      SERIAL PRIMARY KEY,
    meeting_id        INT REFERENCES meetings(meeting_id) ON DELETE CASCADE,
    lead_id           INT REFERENCES leads(lead_id),
    objection_type    VARCHAR(100),
    objection_detail  TEXT,
    resolution_status VARCHAR(20) DEFAULT 'Open'
                      CHECK (resolution_status IN ('Resolved','Partial','Open')),
    resolution_method TEXT,
    raised_at_minute  INT,
    created_at        TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 10. lead_interactions
  `CREATE TABLE IF NOT EXISTS lead_interactions (
    interaction_id   SERIAL PRIMARY KEY,
    lead_id          INT REFERENCES leads(lead_id),
    manager_id       INT REFERENCES managers(manager_id),
    interaction_type VARCHAR(30) CHECK (interaction_type IN ('Call','WhatsApp','Site Visit','Meeting')),
    interaction_date DATE,
    interaction_time TIME,
    duration_seconds INT,
    notes            TEXT,
    related_meeting_id INT REFERENCES meetings(meeting_id),
    created_at       TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 11. followups
  `CREATE TABLE IF NOT EXISTS followups (
    followup_id       SERIAL PRIMARY KEY,
    lead_id           INT REFERENCES leads(lead_id),
    manager_id        INT REFERENCES managers(manager_id),
    meeting_id        INT REFERENCES meetings(meeting_id),
    task_type         VARCHAR(100),
    task_type_other   VARCHAR(100),
    lead_name         VARCHAR(100),
    lead_sentiment_at_creation VARCHAR(50),
    due_date          DATE,
    priority          VARCHAR(10) DEFAULT 'Medium' CHECK (priority IN ('High','Medium','Low')),
    status            VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending','Done','Missed')),
    created_by        VARCHAR(10) DEFAULT 'AI' CHECK (created_by IN ('AI','Manager')),
    notes             TEXT,
    verification_status VARCHAR(20) CHECK (verification_status IN ('Verified','Unverified') OR verification_status IS NULL),
    verification_method VARCHAR(30),
    verified_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    completed_at      TIMESTAMPTZ
  )`,

  // 12. lead_status_history
  `CREATE TABLE IF NOT EXISTS lead_status_history (
    history_id          SERIAL PRIMARY KEY,
    lead_id             INT REFERENCES leads(lead_id),
    old_status          VARCHAR(50),
    new_status          VARCHAR(50),
    changed_by          VARCHAR(10) CHECK (changed_by IN ('AI','Manager')),
    changed_by_manager_id INT REFERENCES managers(manager_id),
    ai_suggested_status VARCHAR(50),
    source_meeting_id   INT REFERENCES meetings(meeting_id),
    changed_at          TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 13. attendance
  `CREATE TABLE IF NOT EXISTS attendance (
    attendance_id    SERIAL PRIMARY KEY,
    manager_id       INT REFERENCES managers(manager_id),
    date             DATE,
    check_in_time    TIME,
    check_in_site    VARCHAR(100),
    check_in_latitude  NUMERIC(10,7),
    check_in_longitude NUMERIC(10,7),
    check_out_time   TIME,
    total_hours      NUMERIC(4,2),
    status           VARCHAR(20) DEFAULT 'Offline' CHECK (status IN ('In Field','In Office','Offline')),
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(manager_id, date)
  )`,

  // 14. recording_processing_log
  `CREATE TABLE IF NOT EXISTS recording_processing_log (
    log_id         SERIAL PRIMARY KEY,
    meeting_id     INT REFERENCES meetings(meeting_id),
    stage          VARCHAR(50),
    status         VARCHAR(20),
    error_message  TEXT,
    duration_ms    INT,
    created_at     TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 15. processing_queue
  `CREATE TABLE IF NOT EXISTS processing_queue (
    queue_id       SERIAL PRIMARY KEY,
    meeting_id     INT REFERENCES meetings(meeting_id),
    priority       INT DEFAULT 5,
    status         VARCHAR(20) DEFAULT 'Pending',
    attempts       INT DEFAULT 0,
    last_attempt   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 16. alerts
  `CREATE TABLE IF NOT EXISTS alerts (
    alert_id       SERIAL PRIMARY KEY,
    alert_type     VARCHAR(50),
    manager_id     INT REFERENCES managers(manager_id),
    lead_id        INT REFERENCES leads(lead_id),
    meeting_id     INT REFERENCES meetings(meeting_id),
    alert_message  TEXT,
    alert_count    INT DEFAULT 1,
    deal_value_at_risk NUMERIC(14,2),
    severity       VARCHAR(20) DEFAULT 'Medium' CHECK (severity IN ('Critical','High','Medium')),
    status         VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active','Resolved')),
    triggered_at   TIMESTAMPTZ DEFAULT NOW(),
    resolved_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 17. notifications
  `CREATE TABLE IF NOT EXISTS notifications (
    notification_id SERIAL PRIMARY KEY,
    manager_id      INT REFERENCES managers(manager_id),
    title           VARCHAR(200),
    body            TEXT,
    type            VARCHAR(50),
    ref_id          INT,
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 18. ai_training_feedback
  `CREATE TABLE IF NOT EXISTS ai_training_feedback (
    feedback_id    SERIAL PRIMARY KEY,
    meeting_id     INT REFERENCES meetings(meeting_id),
    manager_id     INT REFERENCES managers(manager_id),
    feedback_type  VARCHAR(50),
    original_value TEXT,
    corrected_value TEXT,
    notes          TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 19. daily_report_snapshots
  `CREATE TABLE IF NOT EXISTS daily_report_snapshots (
    snapshot_id           SERIAL PRIMARY KEY,
    snapshot_date         DATE NOT NULL,
    manager_id            INT REFERENCES managers(manager_id),
    project_id            INT REFERENCES projects(project_id),
    total_meetings        INT DEFAULT 0,
    field_meetings        INT DEFAULT 0,
    office_meetings       INT DEFAULT 0,
    new_meetings          INT DEFAULT 0,
    repeat_meetings       INT DEFAULT 0,
    super_meetings        INT DEFAULT 0,
    progressive_meetings  INT DEFAULT 0,
    timewaste_meetings    INT DEFAULT 0,
    total_duration_minutes INT DEFAULT 0,
    avg_meeting_score     NUMERIC(4,2),
    calls_made            INT DEFAULT 0,
    whatsapp_sent         INT DEFAULT 0,
    site_visits           INT DEFAULT 0,
    followups_completed   INT DEFAULT 0,
    followups_verified    INT DEFAULT 0,
    followups_unverified  INT DEFAULT 0,
    followups_missed      INT DEFAULT 0,
    created_at            TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 20. pipeline_snapshots
  `CREATE TABLE IF NOT EXISTS pipeline_snapshots (
    pipeline_snapshot_id   SERIAL PRIMARY KEY,
    snapshot_date          DATE NOT NULL,
    project_id             INT REFERENCES projects(project_id),
    total_pipeline_leads   INT DEFAULT 0,
    total_pipeline_value   NUMERIC(14,2) DEFAULT 0,
    leads_added            INT DEFAULT 0,
    leads_removed          INT DEFAULT 0,
    net_increase           INT DEFAULT 0,
    value_added            NUMERIC(14,2) DEFAULT 0,
    value_removed          NUMERIC(14,2) DEFAULT 0,
    net_value_change       NUMERIC(14,2) DEFAULT 0,
    booking_count          INT DEFAULT 0,
    booking_ratio_percent  NUMERIC(5,2) DEFAULT 0,
    stuck_7d_count         INT DEFAULT 0,
    stuck_7d_value         NUMERIC(14,2) DEFAULT 0,
    stuck_30d_count        INT DEFAULT 0,
    stuck_30d_value        NUMERIC(14,2) DEFAULT 0,
    created_at             TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 21. lead_reassignment_history
  `CREATE TABLE IF NOT EXISTS lead_reassignment_history (
    reassignment_id   SERIAL PRIMARY KEY,
    lead_id           INT REFERENCES leads(lead_id),
    from_manager_id   INT REFERENCES managers(manager_id),
    to_manager_id     INT REFERENCES managers(manager_id),
    reason            TEXT,
    reassigned_by     INT REFERENCES managers(manager_id),
    created_at        TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(owner_manager_id)`,
  `CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(lead_status)`,
  `CREATE INDEX IF NOT EXISTS idx_meetings_manager ON meetings(manager_id)`,
  `CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(meeting_date)`,
  `CREATE INDEX IF NOT EXISTS idx_meetings_lead ON meetings(lead_id)`,
  `CREATE INDEX IF NOT EXISTS idx_followups_manager ON followups(manager_id)`,
  `CREATE INDEX IF NOT EXISTS idx_followups_due ON followups(due_date)`,
  `CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_preferences_lead ON lead_preferences(lead_id)`,

  // -- ALTER: update lead_source constraint to add new values --
  `ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_lead_source_check`,
  `ALTER TABLE leads ADD CONSTRAINT leads_lead_source_check
     CHECK (lead_source IN ('Facebook','Walk-in','Field Data','Customer Reference','Broker','Newspaper Ad','Superfone','Calling'))`,
];

async function migrate() {
  const client = await require('./index').pool.connect();
  try {
    console.log('🚀 Running migrations...');
    for (const sql of migrations) {
      await client.query(sql);
    }
    console.log(`✅ ${migrations.length} migrations completed.`);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

migrate().then(() => process.exit(0)).catch(() => process.exit(1));
