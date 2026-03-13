const { pool } = require('./index');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding database...');
    await client.query('BEGIN');

    const pwHash = await bcrypt.hash('password123', 10);
    const adminHash = await bcrypt.hash('admin123', 10);

    const { rows: managers } = await client.query(`
      INSERT INTO managers (full_name, initials, avatar_color, phone_number, password_hash, role, is_online)
      VALUES
        ('Admin User',    'AD', '#6366f1', '+919000000000', $1, 'Admin',        true),
        ('Rahul Kumar',   'RK', '#6366f1', '+919876543210', $2, 'Sales Manager',true),
        ('Priya Sharma',  'PS', '#f59e0b', '+919876543211', $2, 'Sales Manager',true),
        ('Amit Verma',    'AV', '#10b981', '+919876543212', $2, 'Sales Manager',false),
        ('Neha Joshi',    'NJ', '#ef4444', '+919876543213', $2, 'Sales Manager',false),
        ('Dev Mehta',     'DM', '#8b5cf6', '+919876543214', $2, 'Sales Manager',false)
      ON CONFLICT (phone_number) DO NOTHING
      RETURNING manager_id, full_name
    `, [adminHash, pwHash]);

    console.log(`  ✓ ${managers.length} managers`);
    const [admin, rahul, priya, amit, neha, dev] = managers.map(m => m.manager_id);

    const { rows: projects } = await client.query(`
      INSERT INTO projects (project_name, status) VALUES
        ('Sai Elite Icon', 'Active'),
        ('Green Valley',   'Active'),
        ('Royal Heights',  'Active')
      ON CONFLICT (project_name) DO NOTHING
      RETURNING project_id, project_name
    `);
    console.log(`  ✓ ${projects.length} projects`);
    const [sai, green, royal] = projects.map(p => p.project_id);

    const leadsData = [
      { name:'Amit Sharma',    phone:'+919811111111', source:'Facebook',  status:'Hot Interested', mgr:rahul, proj:'Sai Elite Icon', unit:'2BHK Flat',  bmin:2800000, bmax:3500000, score:7.2, dm:false, days_no:7,  no7:true, no30:false },
      { name:'Neha Singh',     phone:'+919811111112', source:'Reference', status:'Pipeline',       mgr:rahul, proj:'Green Valley',   unit:'Plot',        bmin:4500000, bmax:5500000, score:8.6, dm:true,  days_no:2,  no7:false,no30:false, deal:4800000 },
      { name:'Ravi Patel',     phone:'+919811111113', source:'Reference', status:'SV Scheduled',   mgr:amit,  proj:'Sai Elite Icon', unit:'Duplex',      bmin:6000000, bmax:7500000, score:8.1, dm:false, days_no:1,  no7:false,no30:false },
      { name:'Sunita Verma',   phone:'+919811111114', source:'Field',     status:'Positive',       mgr:rahul, proj:'Green Valley',   unit:'3BHK Flat',   bmin:5200000, bmax:6000000, score:9.1, dm:true,  days_no:0,  no7:false,no30:false },
      { name:'Deepak Gupta',   phone:'+919811111115', source:'Facebook',  status:'Open',           mgr:rahul, proj:'Sai Elite Icon', unit:'2BHK Flat',   bmin:2500000, bmax:3200000, score:5.4, dm:false, days_no:12, no7:true, no30:false },
      { name:'Kiran Rao',      phone:'+919812111111', source:'Facebook',  status:'Hot Interested', mgr:priya, proj:'Royal Heights',  unit:'3BHK Flat',   bmin:7000000, bmax:9000000, score:7.8, dm:true,  days_no:1,  no7:false,no30:false },
      { name:'Manish Tiwari',  phone:'+919812111112', source:'Walk-in',   status:'SV Done',        mgr:priya, proj:'Green Valley',   unit:'Plot',        bmin:3000000, bmax:4000000, score:6.5, dm:false, days_no:4,  no7:false,no30:false },
      { name:'Pooja Mehta',    phone:'+919812111113', source:'Reference', status:'Pipeline',       mgr:priya, proj:'Sai Elite Icon', unit:'2BHK Flat',   bmin:2800000, bmax:3500000, score:8.3, dm:true,  days_no:2,  no7:false,no30:false, deal:3200000 },
      { name:'Suresh Yadav',   phone:'+919812111114', source:'Call',      status:'Cold Interested',mgr:priya, proj:'Royal Heights',  unit:'Duplex',      bmin:8000000, bmax:9500000, score:4.2, dm:false, days_no:18, no7:true, no30:false },
      { name:'Pradeep Kumar',  phone:'+919813111111', source:'Facebook',  status:'Pipeline',       mgr:amit,  proj:'Sai Elite Icon', unit:'2BHK Flat',   bmin:2900000, bmax:3800000, score:6.1, dm:false, days_no:28, no7:true, no30:true, deal:4800000 },
      { name:'Mohan Das',      phone:'+919813111112', source:'Field',     status:'Pipeline',       mgr:priya, proj:'Sai Elite Icon', unit:'Plot',        bmin:2500000, bmax:3500000, score:5.9, dm:false, days_no:9,  no7:true, no30:false, deal:3500000 },
      { name:'Ramesh Gupta',   phone:'+919813111113', source:'Reference', status:'Pipeline',       mgr:rahul, proj:'Green Valley',   unit:'3BHK Flat',   bmin:4500000, bmax:5500000, score:7.4, dm:true,  days_no:7,  no7:true, no30:false, deal:4200000 },
      { name:'Anita Patil',    phone:'+919813111114', source:'Facebook',  status:'Hot Interested', mgr:amit,  proj:'Royal Heights',  unit:'2BHK Flat',   bmin:3500000, bmax:4200000, score:7.9, dm:false, days_no:2,  no7:false,no30:false },
      { name:'Vijay Kulkarni', phone:'+919814111111', source:'Reference', status:'Positive',       mgr:neha,  proj:'Green Valley',   unit:'Plot',        bmin:5000000, bmax:6000000, score:8.8, dm:true,  days_no:1,  no7:false,no30:false },
      { name:'Sanjay Bhatt',   phone:'+919814111112', source:'Facebook',  status:'Cold Interested',mgr:neha,  proj:'Sai Elite Icon', unit:'2BHK Flat',   bmin:2200000, bmax:2800000, score:3.9, dm:false, days_no:22, no7:true, no30:false },
      { name:'Rekha Nair',     phone:'+919814111113', source:'Walk-in',   status:'SV Scheduled',   mgr:neha,  proj:'Royal Heights',  unit:'3BHK Flat',   bmin:6500000, bmax:8000000, score:7.5, dm:true,  days_no:3,  no7:false,no30:false },
      { name:'Arun Joshi',     phone:'+919814111114', source:'Call',      status:'Not Interested', mgr:neha,  proj:'Green Valley',   unit:'Plot',        bmin:3000000, bmax:4000000, score:2.1, dm:false, days_no:30, no7:true, no30:true  },
      { name:'Kavya Reddy',    phone:'+919814111115', source:'Reference', status:'Pipeline',       mgr:neha,  proj:'Royal Heights',  unit:'Duplex',      bmin:9000000, bmax:11000000,score:8.2, dm:true,  days_no:5,  no7:false,no30:false, deal:9500000 },
    ];

    const leadIds = {};
    for (const l of leadsData) {
      const res = await client.query(`
        INSERT INTO leads
          (lead_name, phone_number, lead_source, lead_status, owner_manager_id,
           project_name, unit_type, budget_min, budget_max, deal_value,
           lead_score, dm_met, days_no_activity, no_activity_7_days, no_activity_30_days,
           last_meeting_or_sv_date, followup_due_date)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
                CURRENT_DATE - (random()*10)::int,
                CURRENT_DATE + (random()*5 - 2)::int)
        ON CONFLICT DO NOTHING
        RETURNING lead_id
      `, [l.name, l.phone, l.source, l.status, l.mgr,
          l.proj, l.unit, l.bmin, l.bmax, l.deal || null,
          l.score, l.dm, l.days_no, l.no7, l.no30]);
      if (res.rows[0]) leadIds[l.name] = res.rows[0].lead_id;
    }
    console.log(`  ✓ ${Object.keys(leadIds).length} leads`);

    const meetings = [
      { lead:'Neha Singh',     mgr:rahul, proj:green, date:-1, start:'10:00', dur:42, type:'Repeat', cat:'Field',  sv:false, score:8.6, sent:'Super',       summ:'Neha showed strong interest in the Green Valley plot. Budget confirmed at ₹48L. Site visit done last week and she is discussing with family. DM (husband) was present today.' },
      { lead:'Sunita Verma',   mgr:rahul, proj:green, date:-1, start:'14:00', dur:55, type:'Repeat', cat:'Field',  sv:false, score:9.1, sent:'Super',       summ:'Sunita is very close to booking. She has confirmed the 3BHK flat at Green Valley. Loan approval is in process. Father (DM) was also present.' },
      { lead:'Amit Sharma',    mgr:rahul, proj:sai,   date:-7, start:'11:00', dur:38, type:'New',    cat:'Field',  sv:false, score:7.2, sent:'Progressive', summ:'Amit is interested in 2BHK flat at Sai Elite Icon. Budget is flexible between 28-35L. Has not brought DM yet. Needs brochure and price sheet.' },
      { lead:'Kiran Rao',      mgr:priya, proj:royal, date:-1, start:'09:30', dur:48, type:'New',    cat:'Office', sv:false, score:7.8, sent:'Progressive', summ:'Kiran wants a 3BHK in Royal Heights. Budget is 70-90L. Self-funded. Site visit needs to be scheduled. DM was present.' },
      { lead:'Manish Tiwari',  mgr:priya, proj:green, date:-1, start:'15:00', dur:35, type:'Repeat', cat:'Field',  sv:true,  score:6.5, sent:'Progressive', summ:'Manish visited the site today. He liked the layout but has concerns about parking. Will discuss with family.' },
      { lead:'Pooja Mehta',    mgr:priya, proj:sai,   date:-1, start:'12:00', dur:52, type:'Repeat', cat:'Office', sv:false, score:8.3, sent:'Super',       summ:'Pooja confirmed her interest in 2BHK at Sai Elite. Deal value at ₹32L. Loan pre-approved. Very close to booking.' },
      { lead:'Anita Patil',    mgr:amit,  proj:royal, date:-1, start:'10:30', dur:44, type:'New',    cat:'Field',  sv:false, score:7.9, sent:'Progressive', summ:'Anita is looking for a 2BHK investment property. Budget 35-42L. Works in IT. Needs DM (husband) for next meeting.' },
      { lead:'Vijay Kulkarni', mgr:neha,  proj:green, date:-1, start:'11:30', dur:60, type:'Repeat', cat:'Field',  sv:true,  score:8.8, sent:'Super',       summ:'Vijay and wife visited the site. Very satisfied with the amenities. Ready to book. Down payment ready. Will confirm in 2 days.' },
      { lead:'Rekha Nair',     mgr:neha,  proj:royal, date:-1, start:'16:00', dur:30, type:'New',    cat:'Office', sv:false, score:7.5, sent:'Progressive', summ:'Rekha is interested in 3BHK at Royal Heights. Budget 65-80L. Has visited a competing project too. Needs price comparison.' },
      { lead:'Pradeep Kumar',  mgr:amit,  proj:sai,   date:-28,start:'10:00', dur:50, type:'Repeat', cat:'Field',  sv:false, score:6.1, sent:'Progressive', summ:'Pradeep revisited the 2BHK layout. Still concerned about pricing. Loan eligibility is the main issue.' },
      { lead:'Mohan Das',      mgr:priya, proj:sai,   date:-9, start:'11:00', dur:30, type:'Repeat', cat:'Field',  sv:false, score:5.9, sent:'Progressive', summ:'Mohan revisited the site. He is comparing plots in Green Valley vs other projects.' },
      { lead:'Ramesh Gupta',   mgr:rahul, proj:green, date:-7, start:'14:00', dur:45, type:'Repeat', cat:'Field',  sv:false, score:7.4, sent:'Progressive', summ:'Ramesh likes the 3BHK in Green Valley. Wife needs to visit once.' },
      { lead:'Kavya Reddy',    mgr:neha,  proj:royal, date:-5, start:'13:00', dur:55, type:'Repeat', cat:'Office', sv:false, score:8.2, sent:'Super',       summ:'Kavya is a serious buyer for the duplex. Budget confirmed at 95L+. Husband (DM) was present.' },
      { lead:'Deepak Gupta',   mgr:rahul, proj:sai,   date:-12,start:'15:00', dur:22, type:'New',    cat:'Field',  sv:false, score:5.4, sent:'Time Waste',  summ:'Deepak was not engaged. Budget is vague. Not serious buyer at this point.' },
      { lead:'Suresh Yadav',   mgr:priya, proj:royal, date:-18,start:'11:00', dur:20, type:'New',    cat:'Office', sv:false, score:4.2, sent:'Time Waste',  summ:'Suresh visited but has very high budget expectations not matching our pricing.' },
    ];

    const meetingIds = [];
    for (const m of meetings) {
      const lid = leadIds[m.lead];
      if (!lid) continue;
      const mdate = `CURRENT_DATE + interval '${m.date} days'`;
      const res = await client.query(`
        INSERT INTO meetings
          (lead_id, manager_id, project_id, meeting_date, start_time, duration_minutes,
           meeting_type, meeting_category, is_site_visit,
           transcript_status, ai_analysis_status)
        VALUES ($1,$2,$3, ${mdate}, $4,$5,$6,$7,$8,'Completed','Completed')
        RETURNING meeting_id
      `, [lid, m.mgr, m.proj, m.start, m.dur, m.type, m.cat, m.sv]);

      const mid = res.rows[0].meeting_id;
      meetingIds.push(mid);

      const talkMgr = 45 + Math.floor(Math.random() * 20);
      await client.query(`
        INSERT INTO meeting_ai_analysis
          (meeting_id, meeting_summary, lead_status_suggested, meeting_sentiment,
           meeting_score, talk_ratio_manager_percent, talk_ratio_client_percent,
           questions_asked_count, needs_analysis_done, budget_qualification_done,
           objection_handling_score, close_attempt_detected, next_step_defined,
           deal_probability_percent, dm_present, confidence_level,
           manager_strengths, manager_improvement)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      `, [mid, m.summ, m.sent === 'Super' ? 'Positive' : 'Hot Interested',
          m.sent, m.score, talkMgr, 100 - talkMgr,
          5 + Math.floor(Math.random() * 8),
          m.score > 6, m.score > 5,
          Math.min(10, m.score + 0.5), m.score > 7, m.score > 6,
          Math.floor(m.score * 10),
          m.sent === 'Super', m.score > 7 ? 'High' : 'Medium',
          m.score > 7 ? 'Strong rapport, good discovery questions, DM present' : 'Good engagement with client',
          m.score < 6 ? 'Needs to improve objection handling and closing attempts' : 'Follow up more promptly on next steps']);
    }
    console.log(`  ✓ ${meetingIds.length} meetings + AI analyses`);

    const objections = [
      { lead:'Amit Sharma',   type:'Price Too High',        detail:'The price per sqft is higher than what I expected.', res:'Partial', method:'Explained value proposition and amenities comparison', min:12 },
      { lead:'Amit Sharma',   type:'DM Not Available',      detail:'My wife has not seen the project yet.',               res:'Open',    method:null, min:22 },
      { lead:'Pradeep Kumar', type:'Loan Eligibility',      detail:'Not sure if I will get a loan for the full amount.',  res:'Partial', method:'Connected with bank relationship manager', min:18 },
      { lead:'Pradeep Kumar', type:'Price Negotiation',     detail:'Can you give any discount or flexible payment plan?', res:'Resolved',method:'Offered flexi-payment plan with 20% down', min:25 },
      { lead:'Mohan Das',     type:'Comparison with Others',detail:'Also looking at XYZ project at lower rates.',         res:'Open',    method:null, min:15 },
      { lead:'Kiran Rao',     type:'Possession Timeline',   detail:'When will the project be ready for possession?',      res:'Resolved',method:'Showed possession certificate and RERA timeline', min:8 },
      { lead:'Suresh Yadav',  type:'Price Too High',        detail:'Your pricing is 15% higher than my budget ceiling.',  res:'Open',    method:null, min:5 },
      { lead:'Deepak Gupta',  type:'Location Concerns',     detail:'The project is a bit far from my workplace.',         res:'Open',    method:null, min:10 },
    ];

    let objCount = 0;
    for (const o of objections) {
      const lid = leadIds[o.lead];
      if (!lid) continue;
      await client.query(`
        INSERT INTO lead_objections (lead_id, objection_type, objection_detail, resolution_status, resolution_method, raised_at_minute)
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [lid, o.type, o.detail, o.res, o.method, o.min]);
      objCount++;
    }
    console.log(`  ✓ ${objCount} objections`);

    const followupData = [
      { lead:'Amit Sharma',   mgr:rahul, type:'Follow-up Call',          due:-2,  status:'Pending',  by:'AI',      sentiment:'Hot Interested' },
      { lead:'Amit Sharma',   mgr:rahul, type:'Send Brochure',           due:1,   status:'Done',     by:'AI',      sentiment:'Hot Interested', verified:'Verified' },
      { lead:'Neha Singh',    mgr:rahul, type:'Follow-up Call',          due:1,   status:'Pending',  by:'AI',      sentiment:'Pipeline' },
      { lead:'Neha Singh',    mgr:rahul, type:'Meet with Decision Maker',due:3,   status:'Pending',  by:'Manager', sentiment:'Pipeline' },
      { lead:'Sunita Verma',  mgr:rahul, type:'Send Site Visit Confirmation', due:0, status:'Done',  by:'AI',      sentiment:'Positive', verified:'Verified' },
      { lead:'Kiran Rao',     mgr:priya, type:'Site Visit',              due:2,   status:'Pending',  by:'AI',      sentiment:'Hot Interested' },
      { lead:'Manish Tiwari', mgr:priya, type:'WhatsApp Follow-up',      due:0,   status:'Done',     by:'Manager', sentiment:'SV Done', verified:'Unverified' },
      { lead:'Pooja Mehta',   mgr:priya, type:'Share Price Sheet',       due:-1,  status:'Missed',   by:'AI',      sentiment:'Pipeline' },
      { lead:'Pooja Mehta',   mgr:priya, type:'Follow-up Call',          due:1,   status:'Pending',  by:'AI',      sentiment:'Pipeline' },
      { lead:'Pradeep Kumar', mgr:amit,  type:'Follow-up Call',          due:-3,  status:'Pending',  by:'AI',      sentiment:'Pipeline' },
      { lead:'Anita Patil',   mgr:amit,  type:'Meet with Decision Maker',due:2,   status:'Pending',  by:'AI',      sentiment:'Hot Interested' },
      { lead:'Vijay Kulkarni',mgr:neha,  type:'Follow-up Call',          due:1,   status:'Pending',  by:'AI',      sentiment:'Positive' },
      { lead:'Rekha Nair',    mgr:neha,  type:'Share Price Sheet',       due:0,   status:'Pending',  by:'Manager', sentiment:'SV Scheduled' },
      { lead:'Kavya Reddy',   mgr:neha,  type:'Negotiation Meeting',     due:3,   status:'Pending',  by:'AI',      sentiment:'Pipeline' },
      { lead:'Deepak Gupta',  mgr:rahul, type:'WhatsApp Follow-up',      due:-5,  status:'Missed',   by:'AI',      sentiment:'Open' },
    ];

    for (const f of followupData) {
      const lid = leadIds[f.lead];
      if (!lid) continue;
      await client.query(`
        INSERT INTO followups
          (lead_id, manager_id, task_type, lead_name, lead_sentiment_at_creation,
           due_date, priority, status, created_by, verification_status, completed_at)
        VALUES ($1,$2,$3,$4,$5,
                CURRENT_DATE + interval '${f.due} days',
                $6, $7, $8, $9,
                ${f.status === 'Done' ? `NOW() - interval '${Math.abs(f.due)} days'` : 'NULL'})
      `, [lid, f.mgr, f.type, f.lead, f.sentiment,
          f.due <= 0 ? 'High' : 'Medium',
          f.status, f.by, f.verified || null]);
    }
    console.log(`  ✓ ${followupData.length} follow-ups`);

    await client.query(`
      INSERT INTO alerts (alert_type, manager_id, alert_message, alert_count, deal_value_at_risk, severity, status) VALUES
        ('No Activity 30d', NULL,  '2 leads have had no activity for 30+ days', 2, 8300000,  'Critical', 'Active'),
        ('Stuck >7d',       NULL,  '5 pipeline leads stuck with no meeting in 7+ days', 5, 84000000, 'High', 'Active'),
        ('Follow-up Overdue', NULL,'4 follow-up tasks are overdue', 4, NULL, 'High', 'Active'),
        ('DM Not Met',      NULL,  '6 hot leads where DM has not been met yet', 6, NULL, 'Medium', 'Active')
    `);
    console.log(`  ✓ 4 alerts`);

    await client.query(`
      INSERT INTO pipeline_snapshots
        (snapshot_date, total_pipeline_leads, total_pipeline_value,
         leads_added, leads_removed, net_increase,
         value_added, value_removed, net_value_change,
         booking_count, booking_ratio_percent,
         stuck_7d_count, stuck_7d_value, stuck_30d_count, stuck_30d_value)
      VALUES
        (CURRENT_DATE, 12, 180000000, 4, 1, 3, 50000000, 10000000, 40000000, 2, 16.7, 5, 84000000, 2, 13000000),
        (CURRENT_DATE - interval '1 month', 10, 145000000, 6, 2, 4, 70000000, 20000000, 50000000, 1, 10.0, 3, 42000000, 1, 8000000)
      ON CONFLICT DO NOTHING
    `);

    const historyData = [
      { lead:'Neha Singh',    old:'Hot Interested', next:'Pipeline',      by:'Manager' },
      { lead:'Neha Singh',    old:'SV Done',        next:'Hot Interested',by:'AI' },
      { lead:'Sunita Verma',  old:'Pipeline',       next:'Positive',      by:'AI' },
      { lead:'Pooja Mehta',   old:'Hot Interested', next:'Pipeline',      by:'Manager' },
      { lead:'Pradeep Kumar', old:'Hot Interested', next:'Pipeline',      by:'Manager' },
    ];
    for (const h of historyData) {
      const lid = leadIds[h.lead];
      if (!lid) continue;
      await client.query(`
        INSERT INTO lead_status_history (lead_id, old_status, new_status, changed_by, changed_at)
        VALUES ($1,$2,$3,$4, NOW() - interval '${Math.floor(Math.random()*20)} days')
      `, [lid, h.old, h.next, h.by]);
    }

    const sites = ['Sai Elite Icon Site Office', 'Green Valley Office', 'Head Office', 'Royal Heights Site'];
    for (const mgrId of [rahul, priya, amit, neha]) {
      for (let d = 0; d < 7; d++) {
        const inField = Math.random() > 0.3;
        await client.query(`
          INSERT INTO attendance (manager_id, date, check_in_time, check_in_site, check_out_time, total_hours, status)
          VALUES ($1, CURRENT_DATE - interval '${d} days', '09:30', $2, '18:30', 9.0, $3)
          ON CONFLICT (manager_id, date) DO NOTHING
        `, [mgrId, sites[Math.floor(Math.random() * sites.length)],
            inField ? 'In Field' : 'In Office']);
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ Seed complete!');
    console.log('\n📱 Login credentials:');
    console.log('   Admin:  +919000000000 / admin123');
    console.log('   Rahul:  +919876543210 / password123');
    console.log('   Priya:  +919876543211 / password123');
    console.log('   Amit:   +919876543212 / password123');
    console.log('   Neha:   +919876543213 / password123');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

seed().then(() => process.exit(0)).catch(() => process.exit(1));
