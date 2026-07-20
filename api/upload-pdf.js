const { google } = require('googleapis');
const stream = require('stream');

// Increase Vercel Serverless Function body payload limit to 4.5MB (Max limit)
module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

function getPrivateKey() {
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!rawKey) return null;
  return rawKey.replace(/\\n/g, '\n');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type'
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
    const { candidateId, pdfData } = req.body;

    if (!candidateId || !pdfData) {
      res.status(400).json({ status: 'error', message: 'Missing required fields' });
      return;
    }

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
      throw new Error('GOOGLE_DRIVE_FOLDER_ID environment variable is missing');
    }

    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) {
      throw new Error('GOOGLE_SHEET_ID environment variable is missing');
    }

    // 2. Auth for Sheets
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: getPrivateKey(),
      },
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets'
      ],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 3. Upload to Google Drive via Apps Script Web App
    const appsScriptUrl = 'https://script.google.com/macros/s/AKfycbxfnckPi_QRF1sNikiTYbCPYCQQkPpMuB5bBUvTOYttGlbr7VhuEYZPiM51OwJ8bT5WLA/exec';
    
    const appsScriptRes = await fetch(appsScriptUrl, {
      method: 'POST',
      body: JSON.stringify({
        filename: `DISC_Result_${candidateId}.pdf`,
        pdfData: pdfData
      })
    });
    
    const appsScriptData = await appsScriptRes.json();
    if (appsScriptData.status !== 'success') {
      throw new Error('Apps Script Error: ' + appsScriptData.message);
    }
    
    const fileLink = appsScriptData.fileLink;

    // 4. Update Google Sheets
    // Find the row with the candidateId
    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Candidates!A:A',
    });

    const rows = getRes.data.values;
    let rowIndex = -1;
    if (rows && rows.length) {
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === candidateId) {
          rowIndex = i;
          break;
        }
      }
    }

    if (rowIndex !== -1) {
      const rowNum = rowIndex + 1;
      
      // Get the full row data to append the link at the end
      const rowDataRes = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `Candidates!A${rowNum}:ZZ${rowNum}`,
      });
      
      const rowData = rowDataRes.data.values ? rowDataRes.data.values[0] : [];
      
      // We know index 40 is 'Pending' from submit.js, so we can place it at index 41. 
      // If the row has fewer elements, we pad it.
      while(rowData.length <= 40) {
        rowData.push('');
      }
      rowData[41] = fileLink; // Add the link at column AP (index 41)

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `Candidates!A${rowNum}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowData],
        },
      });
    } else {
      console.warn(`Candidate ${candidateId} not found in Sheets. Could not save PDF link.`);
    }

    res.status(200).json({
      status: 'success',
      message: 'PDF uploaded successfully',
      fileLink: fileLink
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
  }
};
