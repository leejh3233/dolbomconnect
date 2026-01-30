
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

const keyFilePath = path.join(process.cwd(), 'google-sheets-key.json');
const spreadsheetId = '1iqU45531_w_cXlLtgLJolecLTdgVPdbLMFsLwVAWogo';

async function verifyHeaders() {
    try {
        const keyFile = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
        const jwt = new JWT({
            email: keyFile.client_email,
            key: keyFile.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(spreadsheetId, jwt);
        await doc.loadInfo();

        for (let sIdx = 0; sIdx < doc.sheetCount; sIdx++) {
            const sheet = doc.sheetsByIndex[sIdx];
            await sheet.loadCells('1:1');

            const seen = new Set();
            let duplicates = [];

            for (let i = 0; i < sheet.columnCount; i++) {
                const val = String(sheet.getCell(0, i).value || '').trim();
                if (val === '') continue;
                if (seen.has(val)) {
                    duplicates.push(val);
                }
                seen.add(val);
            }

            if (duplicates.length > 0) {
                console.log(`[FAIL] Sheet "${sheet.title}" has duplicates: ${duplicates.join(', ')}`);
            } else {
                console.log(`[PASS] Sheet "${sheet.title}" is clean.`);
            }
        }
    } catch (error) {
        console.error(error);
    }
}

verifyHeaders();
