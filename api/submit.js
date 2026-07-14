const { google } = require('googleapis');
const discQuestions = require('../disc_questions.json');
const discNorms = require('../disc_scoring_norms.json');
const discProfiles = require('../disc_profiles.json');

// Helper to format private key for Google APIs
function getPrivateKey() {
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!rawKey) return null;
  return rawKey.replace(/\\n/g, '\n');
}

/**
 * Determine the profile index (1-40) based on DISC Norm scores
 * This replicates the complex IF-logic from the Excel sheet.
 */
function getMatchIndex(D, I, S, C) {
  if (D <= 0 && I <= 0 && S <= 0 && C > 0) return 1;
  if (D > 0 && I <= 0 && S <= 0 && C <= 0) return 2;
  if (D > 0 && I <= 0 && S <= 0 && C > 0 && C >= D) return 3;
  if (D > 0 && I > 0 && S <= 0 && C <= 0 && I >= D) return 4;
  if (D > 0 && I > 0 && S <= 0 && C > 0 && I >= D && D >= C) return 5;
  if (D > 0 && I > 0 && S > 0 && C <= 0 && I >= D && D >= S) return 6;
  if (D > 0 && I > 0 && S > 0 && C <= 0 && I >= S && S >= D) return 7;
  if (D > 0 && I <= 0 && S > 0 && C > 0 && S >= D && D >= C) return 8;
  if (D > 0 && I > 0 && S <= 0 && C <= 0 && D >= I) return 9;
  if (D > 0 && I > 0 && S > 0 && C <= 0 && D >= I && I >= S) return 10;
  if (D > 0 && I <= 0 && S > 0 && C <= 0 && D >= S) return 11;
  if (D <= 0 && I > 0 && S > 0 && C > 0 && C >= I && I >= S) return 12;
  if (D <= 0 && I > 0 && S > 0 && C > 0 && C >= S && S >= I) return 13;
  if (D <= 0 && I > 0 && S > 0 && C > 0 && I >= S && I >= C) return 14;
  if (D <= 0 && I <= 0 && S > 0 && C <= 0) return 15;
  if (D <= 0 && I <= 0 && S > 0 && C > 0 && C >= S) return 16;
  if (D <= 0 && I <= 0 && S > 0 && C > 0 && S >= C) return 17;
  if (D > 0 && I <= 0 && S <= 0 && C > 0 && D >= C) return 18;
  if (D > 0 && I > 0 && S <= 0 && C > 0 && D >= I && I >= C) return 19;
  if (D > 0 && I > 0 && S > 0 && C <= 0 && D >= S && S >= I) return 20;
  if (D > 0 && I <= 0 && S > 0 && C > 0 && D >= S && S >= C) return 21;
  if (D > 0 && I > 0 && S <= 0 && C > 0 && D >= C && C >= I) return 22;
  if (D > 0 && I <= 0 && S > 0 && C > 0 && D >= C && C >= S) return 23;
  if (D <= 0 && I > 0 && S <= 0 && C <= 0) return 24;
  if (D <= 0 && I > 0 && S > 0 && C <= 0 && I >= S) return 25;
  if (D <= 0 && I > 0 && S <= 0 && C > 0 && I >= C) return 26;
  if (D > 0 && I > 0 && S <= 0 && C > 0 && I >= C && C >= D) return 27;
  if (D <= 0 && I > 0 && S > 0 && C > 0 && I >= C && C >= S) return 28;
  if (D > 0 && I <= 0 && S > 0 && C <= 0 && S >= D) return 29;
  if (D <= 0 && I > 0 && S > 0 && C <= 0 && S >= I) return 30;
  if (D > 0 && I > 0 && S > 0 && C <= 0 && S >= D && D >= I) return 31;
  if (D > 0 && I > 0 && S > 0 && C <= 0 && S >= I && I >= D) return 32;
  if (D <= 0 && I > 0 && S > 0 && C > 0 && S >= I && I >= C) return 33;
  if (D > 0 && I <= 0 && S > 0 && C > 0 && S >= C && C >= D) return 34;
  if (D <= 0 && I > 0 && S > 0 && C > 0 && S >= C && C >= I) return 35;
  if (D <= 0 && I > 0 && S <= 0 && C > 0 && C >= I) return 36;
  if (D > 0 && I > 0 && S <= 0 && C > 0 && C >= D && D >= I) return 37;
  if (D > 0 && I <= 0 && S > 0 && C > 0 && C >= D && D >= S) return 38;
  if (D > 0 && I > 0 && S <= 0 && C > 0 && C >= I && I >= D) return 39;
  if (D > 0 && I <= 0 && S > 0 && C > 0 && C >= S && S >= D) return 40;
  return 0;
}

function getProfileName(idx) {
  if (idx <= 0) return 'UNKNOWN';
  const profile = discProfiles.find(p => p.id === idx);
  return profile ? profile.name : 'UNKNOWN';
}

/**
 * Perform DISC test scoring and mapping
 */
function scoreDISC(mostAnswers, leastAnswers) {
  const rawMost = { D: 0, I: 0, S: 0, C: 0, Star: 0 };
  const rawLeast = { D: 0, I: 0, S: 0, C: 0, Star: 0 };

  // Loop through 24 questions
  for (let i = 0; i < 24; i++) {
    const qNum = i + 1;
    // Pilihan user: 1 (A), 2 (B), 3 (C), 4 (D)
    const userMost = mostAnswers[i];
    const userLeast = leastAnswers[i];

    const qConfig = discQuestions.find(q => q.no_soal === qNum);
    if (!qConfig) continue;

    // Map answer index to statement key
    const statementMost = qConfig.statements[userMost - 1];
    const statementLeast = qConfig.statements[userLeast - 1];

    if (statementMost) {
      const key = statementMost.most;
      if (key === 'D') rawMost.D++;
      else if (key === 'I') rawMost.I++;
      else if (key === 'S') rawMost.S++;
      else if (key === 'C') rawMost.C++;
      else rawMost.Star++;
    }

    if (statementLeast) {
      const key = statementLeast.least;
      if (key === 'D') rawLeast.D++;
      else if (key === 'I') rawLeast.I++;
      else if (key === 'S') rawLeast.S++;
      else if (key === 'C') rawLeast.C++;
      else rawLeast.Star++;
    }
  }

  // Set Star value (always 24 - sum of D,I,S,C)
  rawMost.Star = 24 - (rawMost.D + rawMost.I + rawMost.S + rawMost.C);
  rawLeast.Star = 24 - (rawLeast.D + rawLeast.I + rawLeast.S + rawLeast.C);

  // Compute Change
  const change = {
    D: rawMost.D - rawLeast.D,
    I: rawMost.I - rawLeast.I,
    S: rawMost.S - rawLeast.S,
    C: rawMost.C - rawLeast.C
  };

  // Convert to Norms
  const normMost = {
    D: Number(discNorms.graph1_most.D[rawMost.D] ?? 0),
    I: Number(discNorms.graph1_most.I[rawMost.I] ?? 0),
    S: Number(discNorms.graph1_most.S[rawMost.S] ?? 0),
    C: Number(discNorms.graph1_most.C[rawMost.C] ?? 0)
  };

  const normLeast = {
    D: Number(discNorms.graph2_least.D[rawLeast.D] ?? 0),
    I: Number(discNorms.graph2_least.I[rawLeast.I] ?? 0),
    S: Number(discNorms.graph2_least.S[rawLeast.S] ?? 0),
    C: Number(discNorms.graph2_least.C[rawLeast.C] ?? 0)
  };

  const normChange = {
    D: Number(discNorms.graph3_change.D[change.D] ?? 0),
    I: Number(discNorms.graph3_change.I[change.I] ?? 0),
    S: Number(discNorms.graph3_change.S[change.S] ?? 0),
    C: Number(discNorms.graph3_change.C[change.C] ?? 0)
  };

  // Match Profiles
  const idx1 = getMatchIndex(normMost.D, normMost.I, normMost.S, normMost.C);
  const idx2 = getMatchIndex(normLeast.D, normLeast.I, normLeast.S, normLeast.C);
  const idx3 = getMatchIndex(normChange.D, normChange.I, normChange.S, normChange.C);

  const profile1 = getProfileName(idx1);
  const profile2 = getProfileName(idx2);
  const profile3 = getProfileName(idx3);

  return {
    raw: { most: rawMost, least: rawLeast },
    change: change,
    norm: { most: normMost, least: normLeast, change: normChange },
    profiles: { graph1: profile1, graph2: profile2, graph3: profile3 }
  };
}

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
    return;
  }

  try {
    const {
      name,
      email,
      position,
      cv_link = '',
      portfolio_link = '',
      cognitive_score = 0,
      cognitive_duration_seconds = 0,
      disc_most,
      disc_least
    } = req.body;

    if (!name || !email || !position || !disc_most || !disc_least) {
      res.status(400).json({ status: 'error', message: 'Missing required fields' });
      return;
    }

    if (disc_most.length !== 24 || disc_least.length !== 24) {
      res.status(400).json({ status: 'error', message: 'DISC choices must have exactly 24 elements' });
      return;
    }

    // 1. Compute scores
    const scoring = scoreDISC(disc_most, disc_least);

    // 2. Format database row
    const candidateId = `CAND-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const timestamp = new Date().toISOString();

    const rowData = [
      candidateId,
      timestamp,
      name,
      email,
      position,
      cv_link,
      portfolio_link,
      cognitive_score,
      cognitive_duration_seconds,
      disc_most.join(','),
      disc_least.join(','),
      
      // Raw MOST
      scoring.raw.most.D,
      scoring.raw.most.I,
      scoring.raw.most.S,
      scoring.raw.most.C,
      scoring.raw.most.Star,

      // Raw LEAST
      scoring.raw.least.D,
      scoring.raw.least.I,
      scoring.raw.least.S,
      scoring.raw.least.C,
      scoring.raw.least.Star,

      // Change
      scoring.change.D,
      scoring.change.I,
      scoring.change.S,
      scoring.change.C,

      // Norm MOST
      scoring.norm.most.D,
      scoring.norm.most.I,
      scoring.norm.most.S,
      scoring.norm.most.C,

      // Norm LEAST
      scoring.norm.least.D,
      scoring.norm.least.I,
      scoring.norm.least.S,
      scoring.norm.least.C,

      // Norm CHANGE
      scoring.norm.change.D,
      scoring.norm.change.I,
      scoring.norm.change.S,
      scoring.norm.change.C,

      // Profiles
      scoring.profiles.graph1,
      scoring.profiles.graph2,
      scoring.profiles.graph3,

      // Status
      'Pending'
    ];

    // 3. Connect to Google Sheets API
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

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Candidates!A:AO',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowData],
      },
    });

    res.status(200).json({
      status: 'success',
      candidate_id: candidateId,
      cognitive_score,
      disc_profile: {
        public_self: scoring.profiles.graph1,
        private_self: scoring.profiles.graph2,
        core_self: scoring.profiles.graph3
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
  }
};
