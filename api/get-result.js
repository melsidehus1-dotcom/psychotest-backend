const { google } = require('googleapis');
const discProfiles = require('../disc_profiles.json');

// Helper to format private key for Google APIs
function getPrivateKey() {
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!rawKey) return null;
  return rawKey.replace(/\\n/g, '\n');
}

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
    return;
  }

  try {
    const { id } = req.query;
    if (!id) {
      res.status(400).json({ status: 'error', message: 'Missing User ID' });
      return;
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: getPrivateKey(),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!sheetId) {
      throw new Error('GOOGLE_SHEET_ID environment variable is missing');
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Candidates!A:AO',
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      res.status(404).json({ status: 'error', message: 'No records found' });
      return;
    }

    // Find user by ID (Column A, index 0)
    const matchRow = rows.find(row => row[0] && row[0].trim().toUpperCase() === id.trim().toUpperCase());

    if (!matchRow) {
      res.status(404).json({ status: 'error', message: 'User ID not found' });
      return;
    }

    // Reconstruct scoring response
    // Columns mapping:
    // row[0]: Candidate ID
    // row[2]: Name
    // row[4]: Position
    // row[11]: Raw MOST D
    // row[12]: Raw MOST I
    // row[13]: Raw MOST S
    // row[14]: Raw MOST C
    // row[37]: Public Profile (graph1)
    // row[38]: Private Profile (graph2)
    // row[39]: Core Profile (graph3)

    const candidateId = matchRow[0];
    const name = matchRow[2];
    const position = matchRow[4];
    const durationSeconds = Number(matchRow[8] || 0);
    const dVal = Number(matchRow[11] || 0);
    const iVal = Number(matchRow[12] || 0);
    const sVal = Number(matchRow[13] || 0);
    const cVal = Number(matchRow[14] || 0);
    const publicSelf = matchRow[37] || '—';
    const privateSelf = matchRow[38] || '—';
    const coreSelf = matchRow[39] || '—';

    function findProfileByName(profName) {
      if (!profName || profName === '—') return { name: '—', code: '—', description: '', characteristics: [], about_you: '', strengths: [], watch_outs: [], what_this_means: '', at_a_glance: '', job_suitability: '', decision_making: '', communication: '', relationships: '', preferred_environment: '' };
      let cleanName = profName.trim().toUpperCase();
      if (cleanName === 'PENGAMBIL KEPUTUSAN') cleanName = 'DECISION MAKER';
      const found = discProfiles.find(p => p.name.trim().toUpperCase() === cleanName || (p.profile_name && p.profile_name.trim().toUpperCase() === cleanName) || p.code.trim().toUpperCase() === cleanName);
      return found ? {
        name: found.name,
        code: found.code,
        description: found.description || '',
        characteristics: found.characteristics || [],
        about_you: found.about_you || '',
        strengths: found.strengths || [],
        watch_outs: found.watch_outs || [],
        what_this_means: found.what_this_means || '',
        at_a_glance: found.at_a_glance || '',
        job_suitability: found.job_suitability || '',
        decision_making: found.decision_making || '',
        communication: found.communication || '',
        relationships: found.relationships || '',
        preferred_environment: found.preferred_environment || ''
      } : { name: profName, code: '—', description: '', characteristics: [], about_you: '', strengths: [], watch_outs: [], what_this_means: '', at_a_glance: '', job_suitability: '', decision_making: '', communication: '', relationships: '', preferred_environment: '' };
    }

    const pubInfo = findProfileByName(publicSelf);
    const privInfo = findProfileByName(privateSelf);
    const coreInfo = findProfileByName(coreSelf);

    res.status(200).json({
      status: 'success',
      candidate_id: candidateId,
      name,
      position,
      duration_seconds: durationSeconds,
      disc_profile: {
        public_self: pubInfo.name || publicSelf,
        private_self: privInfo.name || privateSelf,
        core_self: coreInfo.name || coreSelf,
        public_self_code: pubInfo.code,
        private_self_code: privInfo.code,
        core_self_code: coreInfo.code,
        public_self_desc: pubInfo.description,
        private_self_desc: privInfo.description,
        core_self_desc: coreInfo.description,
        public_self_chars: pubInfo.characteristics,
        private_self_chars: privInfo.characteristics,
        core_self_chars: coreInfo.characteristics,
        core_self_about: coreInfo.about_you || '',
        core_self_strengths: coreInfo.strengths || [],
        core_self_watch_outs: coreInfo.watch_outs || [],
        core_self_what_this_means: coreInfo.what_this_means || '',
        core_self_at_a_glance: coreInfo.at_a_glance || '',
        core_self_job_suitability: coreInfo.job_suitability || '',
        core_self_decision_making: coreInfo.decision_making || '',
        core_self_communication: coreInfo.communication || '',
        core_self_relationships: coreInfo.relationships || '',
        core_self_preferred_environment: coreInfo.preferred_environment || '',
        decision_making: coreInfo.decision_making || '',
        communication: coreInfo.communication || '',
        relationships: coreInfo.relationships || '',
        preferred_environment: coreInfo.preferred_environment || '',
        job_suitability: coreInfo.job_suitability || ''
      },
      disc_scores: {
        D: dVal,
        I: iVal,
        S: sVal,
        C: cVal
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
  }
};
