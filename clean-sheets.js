
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

const keyFilePath = path.join(process.cwd(), 'google-sheets-key.json');
const spreadsheetId = '1iqU45531_w_cXlLtgLJolecLTdgVPdbLMFsLwVAWogo';

async function listAllHeaders() {
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
        console.log(`Sheet: ${sheet.title} (Index ${sIdx})`);
        await sheet.loadCells('1:1');
        let headerLine = '';
        const limit = Math.min(sheet.columnCount, 30);
        for (let i = 0; i < limit; i++) {
            const val = sheet.getCell(0, i).value;
            headerLine += `[${i}: ${val}] `;
        }
        console.log(headerLine);
        console.log('---');
    }
}

listAllHeaders().catch(console.error);
