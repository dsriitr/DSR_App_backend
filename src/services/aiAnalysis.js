const fetch = require('node-fetch');

async function analyzeMeeting({ transcript, leadName, projectName, meetingType, managerName }) {
  console.log(`[Claude] Analyzing meeting for: ${leadName}`);
  const prompt = `You are an expert real estate sales coach analyzing a meeting transcript.

MEETING DETAILS:
- Lead: ${leadName || 'Unknown'}
- Project: ${projectName || 'Unknown'}
- Type: ${meetingType || 'Unknown'} (New=first meeting, Repeat=follow-up)
- Manager: ${managerName || 'Unknown'}

TRANSCRIPT:
${transcript}

Respond with ONLY valid JSON, no explanation, no markdown, no backticks:

{
  "meeting_summary": "2-4 sentence summary",
  "meeting_sentiment": "Super or Progressive or Time Waste",
  "meeting_score": 7.5,
  "deal_probability_percent": 65.0,
  "lead_intent": "1-2 sentences on buying intent",
  "lead_status_suggested": "Open or Cold Interested or Hot Interested or SV Scheduled or SV Done or Positive or Pipeline or Booking or Not Interested",
  "expected_next_status": "same options as above",
  "site_visit_status": "Done or Scheduled or Not Discussed or null",
  "dm_present": true,
  "decision_maker_identified": "Husband or Wife or null",
  "talk_ratio_manager_percent": 42,
  "talk_ratio_client_percent": 58,
  "questions_asked_count": 8,
  "needs_analysis_done": true,
  "budget_qualification_done": true,
  "objection_handling_score": 7.5,
  "close_attempt_detected": true,
  "next_step_defined": true,
  "confidence_level": "High or Medium or Low",
  "manager_strengths": "2-3 sentences on strengths",
  "manager_improvement": "2-3 sentences on improvements",
  "lead_score": 7.0,
  "lead_profile": {
    "unit_type": "Plot or 2BHK Flat or 3BHK Flat or Duplex or Shop or null",
    "unit_size_sqft": 1200,
    "budget_min": 4500000,
    "budget_max": 6000000,
    "budget_clarity": "Clear or Vague or Not Discussed",
    "buying_timeline": "1-3 Months or 3-6 Months or 6-12 Months or null",
    "urgency_level": "High or Medium or Low or null",
    "funding_type": "Self-funded or Home Loan or Partial Loan or null",
    "financing_mode": "Loan or Self-funded or Mixed or null",
    "loan_amount": 3000000,
    "hometown": "city or null",
    "profession": "job title or null",
    "employment_type": "Salaried or Self-employed or Business or null",
    "purpose": "Self-use or Investment or Both or null",
    "decision_maker_name": "name of the decision maker if mentioned or null",
    "project_preference": "specific project name client mentioned interest in or null"
  },
  "objections": [
    {
      "objection_type": "Budget or Location or Loan / Finance or Timeline or Project Quality or Competition or Family Approval or Other",
      "objection_detail": "what lead said",
      "resolution_status": "Resolved or Partial or Open",
      "resolution_method": "how manager addressed it or null",
      "raised_at_minute": 23
    }
  ],
  "followup_tasks": [
    {
      "task_type": "Follow-up Call or WhatsApp Follow-up or Send Brochure or Site Visit or Meet with Decision Maker or Send Price Sheet or Negotiation Meeting or Other",
      "description": "specific task",
      "due_days_from_now": 2,
      "priority": "High or Medium or Low"
    }
  ]
}

RULES:
- meeting_score 8+=Super, 6-7.9=Progressive, <6=Time Waste. Be realistic not every meeting is 9/10.
- lead_score: overall lead quality 1-10 based on budget readiness, urgency, intent signals, DM involvement.
- Extract every piece of info the client reveals: budget, hometown, profession, family details, loan status, unit size preference, timeline.
- budget_clarity: "Clear" if client gave specific numbers, "Vague" if approximate/unsure, "Not Discussed" if not mentioned.
- financing_mode: "Loan" if taking home loan, "Self-funded" if paying cash, "Mixed" if combination.
- loan_amount: numeric value if loan amount was discussed, null otherwise.
- unit_size_sqft: approximate sqft if mentioned, null otherwise.
- decision_maker_name: actual name of the person who makes the buying decision (e.g. "Sharma ji", "wife Priya"), null if not mentioned.
- project_preference: if client expressed interest in a specific project by name, capture it.
- Set null for any field not discussed in the conversation. Do not guess.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
  });

  if (!res.ok) throw new Error(`Claude API error: ${await res.text()}`);
  const data = await res.json();
  const text = data.content[0].text.trim().replace(/```json|```/g, '').trim();
  const analysis = JSON.parse(text);
  console.log(`[Claude] Done. Score: ${analysis.meeting_score}, Sentiment: ${analysis.meeting_sentiment}`);
  return analysis;
}

module.exports = { analyzeMeeting };
