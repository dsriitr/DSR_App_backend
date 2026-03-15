const fetch = require('node-fetch');
const fs = require('fs');

const BASE = 'https://api.sarvam.ai';
const headers = () => ({ 'api-subscription-key': process.env.SARVAM_API_KEY, 'Content-Type': 'application/json' });

async function transcribeAudio(filePath) {
  console.log(`[Sarvam] Starting: ${filePath}`);
  const jobRes = await fetch(`${BASE}/speech-to-text-bulk/job`, { method: 'POST', headers: headers(), body: JSON.stringify({ model: 'saaras:v3', mode: 'transcribe', language_code: 'hi-IN', with_diarization: true, num_speakers: 2 }) });
  if (!jobRes.ok) throw new Error(`Sarvam create job failed: ${await jobRes.text()}`);
  const job = await jobRes.json();
  const jobId = job.job_id;
  console.log(`[Sarvam] Job created: ${jobId}`);

  const fileName = filePath.split('/').pop();
  const uploadUrlRes = await fetch(`${BASE}/speech-to-text-bulk/job/${jobId}/url`, { method: 'POST', headers: headers(), body: JSON.stringify({ file_names: [fileName] }) });
  if (!uploadUrlRes.ok) throw new Error(`Sarvam URL failed: ${await uploadUrlRes.text()}`);
  const uploadData = await uploadUrlRes.json();
  const presignedUrl = uploadData.urls?.[0]?.url || uploadData.upload_urls?.[0];
  if (!presignedUrl) throw new Error('No presigned URL from Sarvam');

  const ext = fileName.split('.').pop().toLowerCase();
  const mimeType = ext === 'm4a' ? 'audio/mp4' : ext === 'mp3' ? 'audio/mpeg' : ext === 'wav' ? 'audio/wav' : 'audio/mpeg';
  const uploadRes = await fetch(presignedUrl, { method: 'PUT', headers: { 'Content-Type': mimeType }, body: fs.readFileSync(filePath) });
  if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
  console.log(`[Sarvam] File uploaded`);

  const startRes = await fetch(`${BASE}/speech-to-text-bulk/job/${jobId}`, { method: 'POST', headers: headers() });
  if (!startRes.ok) throw new Error(`Start job failed: ${await startRes.text()}`);
  console.log(`[Sarvam] Job started, polling...`);

  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const s = await fetch(`${BASE}/speech-to-text-bulk/job/${jobId}`, { headers: { 'api-subscription-key': process.env.SARVAM_API_KEY } });
    const status = await s.json();
    console.log(`[Sarvam] Status: ${status.job_state} (${i+1})`);
    if (status.job_state === 'COMPLETED') {
      const results = status.results || status.transcripts || [];
      let text = '';
      if (results[0]?.diarized_transcript?.entries?.length > 0) {
        text = results[0].diarized_transcript.entries.map(e => `${e.speaker_id === '0' ? 'MGR' : 'CLIENT'}: ${e.transcript}`).join('\n');
      } else { text = results[0]?.transcript || ''; }
      return { transcript: text, language: results[0]?.language_code || 'hi-IN', word_count: text.split(/\s+/).filter(Boolean).length, confidence_score: 88.00 };
    }
    if (status.job_state === 'FAILED') throw new Error(`Sarvam failed: ${status.error_message}`);
  }
  throw new Error('Sarvam timed out');
}

module.exports = { transcribeAudio };
