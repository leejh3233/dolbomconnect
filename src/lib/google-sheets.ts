import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
];

export async function getSpreadsheet() {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // 1. Try to find the JSON key file first (Most robust)
    const keyFilePath = path.join(process.cwd(), 'google-sheets-key.json');

    if (fs.existsSync(keyFilePath)) {
        const keyFile = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));


        const jwt = new JWT({
            email: keyFile.client_email,
            key: keyFile.private_key,
            scopes: SCOPES,
        });

        const doc = new GoogleSpreadsheet(spreadsheetId as string, jwt);
        await doc.loadInfo();
        return doc;
    }

    // 2. Fallback to Env variables (Legacy/Cloud)
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawKey = process.env.GOOGLE_PRIVATE_KEY || '';

    if (!serviceAccountEmail || !rawKey || !spreadsheetId) {
        throw new Error('Google Sheets credentials are missing (No JSON file or Env variables).');
    }

    const privateKey = rawKey.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '');

    const jwt = new JWT({
        email: serviceAccountEmail,
        key: privateKey,
        scopes: SCOPES,
    });

    const doc = new GoogleSpreadsheet(spreadsheetId, jwt);
    await doc.loadInfo();
    return doc;
}
