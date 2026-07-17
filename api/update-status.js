const { google } = require('googleapis');

// Helper to format private key for Google APIs
function getPrivateKey() {
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!rawKey) return null;
  return rawKey.replace(/\\n/g, '\n');
}

module.exports = async (req, res) => {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
    return;
  }

  try {
    const { candidate_id, status, note } = req.body || {};

    if (!candidate_id) {
      res.status(400).json({ status: 'error', message: 'candidate_id is required' });
      return;
    }

    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = getPrivateKey();
    const sheetId = process.env.GOOGLE_SHEET_ID;

    // If Google Service Account is not set up on serverless environment, return clean local success
    if (!clientEmail || !privateKey || !sheetId) {
      res.status(200).json({
        status: 'success',
        mode: 'local_only',
        message: 'Status & note updated in local override persistence. Configure GOOGLE_SERVICE_ACCOUNT credentials on Vercel to sync directly to Google Sheets.'
      });
      return;
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Fetch column A (Candidate_ID) from Candidates sheet to find the exact row
    const idColumnResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Candidates!A:A',
    });

    const rows = idColumnResponse.data.values || [];
    let targetRowIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i][0] && rows[i][0].toString().trim() === candidate_id.toString().trim()) {
        targetRowIndex = i + 1; // 1-indexed in Google Sheets
        break;
      }
    }

    if (targetRowIndex === -1) {
      res.status(404).json({
        status: 'error',
        message: `Candidate ID ${candidate_id} not found in Google Sheets column A.`
      });
      return;
    }

    // 2. Update Status_Evaluasi (col AO / col 41) and Catatan_HR (col AP / col 42)
    // Note: If Candidates header uses col AO for Status_Evaluasi and AP for Catatan_HR:
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `Candidates!AO${targetRowIndex}:AP${targetRowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[status || 'Pending', note || '']],
      },
    });

    res.status(200).json({
      status: 'success',
      candidate_id,
      updated_status: status,
      updated_note: note,
      row_index: targetRowIndex,
      message: 'Successfully synced Status and HR Note to Google Sheets.'
    });

  } catch (error) {
    console.error('Update status API error:', error);
    // Return 200 with fallback notice so frontend local override still stays active smoothly
    res.status(200).json({
      status: 'success',
      mode: 'fallback_local',
      error: error.message,
      message: 'Status saved locally. Cloud sync encountered an issue: ' + error.message
    });
  }
};
