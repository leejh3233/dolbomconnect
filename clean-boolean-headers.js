
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

const keyFilePath = path.join(process.cwd(), 'google-sheets-key.json');
const spreadsheetId = '1iqU45531_w_cXlLtgLJolecLTdgVPdbLMFsLwVAWogo';

async function cleanBooleanHeaders() {
    try {
        console.log('Starting Boolean Header Cleanup...');
        const keyFile = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
        const jwt = new JWT({
            email: keyFile.client_email,
            key: keyFile.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(spreadsheetId, jwt);
        await doc.loadInfo();

        const sheet = doc.sheetsByIndex[0]; // Focus on the first sheet (Leads)
        console.log(`Target Sheet: ${sheet.title}`);

        await sheet.loadCells('1:1'); // Load first row

        let changed = false;

        // Iterate all columns
        for (let i = 0; i < sheet.columnCount; i++) {
            const cell = sheet.getCell(0, i);
            const val = cell.value;

            // Check for boolean types (Checkbox in header?)
            if (typeof val === 'boolean') {
                console.log(`[FOUND] Boolean ${val} at Col ${i}. Removing...`);
                cell.value = ''; // Headers should be strings
                changed = true;
                continue;
            }

            // Check for string "FALSE" or "TRUE"
            if (typeof val === 'string') {
                const upper = val.toUpperCase();
                if (upper === 'FALSE' || upper === 'TRUE') {
                    console.log(`[FOUND] String "${val}" at Col ${i}. Removing...`);
                    cell.value = '';
                    changed = true;
                }
            }
        }

        if (changed) {
            await sheet.saveUpdatedCells();
            console.log('[SUCCESS] Saved clean headers.');
        } else {
            console.log('[INFO] No boolean/false headers found.');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

cleanBooleanHeaders();
