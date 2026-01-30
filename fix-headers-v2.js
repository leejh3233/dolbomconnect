
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

const keyFilePath = path.join(process.cwd(), 'google-sheets-key.json');
const spreadsheetId = '1iqU45531_w_cXlLtgLJolecLTdgVPdbLMFsLwVAWogo';

async function fixDuplicateHeaders() {
    try {
        console.log('Starting header fix...');
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
            console.log(`Processing Sheet: ${sheet.title} (Index ${sIdx})`);

            // Load only the first row (header row)
            await sheet.loadCells('1:1');

            const seen = new Map(); // value -> count
            let hasChanges = false;

            // Check columns up to sheet.columnCount
            // We'll iterate and rename duplicates
            for (let i = 0; i < sheet.columnCount; i++) {
                const cell = sheet.getCell(0, i);
                let val = String(cell.value || '').trim();

                // If distinct value, track it.
                // If it's empty, google-spreadsheet usually ignores it or names it empty? 
                // Actually google-spreadsheet ignores empty header cells usually, but let's be safe.

                if (val === '') continue; // Skip empty cells

                if (seen.has(val)) {
                    // It's a duplicate!
                    const count = seen.get(val);
                    const newVal = `${val}_${count + 1}`;
                    console.log(`  [FIX] Found duplicate header "${val}" at col ${i}. Renaming to "${newVal}"`);

                    cell.value = newVal;
                    seen.set(val, count + 1);
                    hasChanges = true;
                } else {
                    seen.set(val, 0);
                }
            }

            if (hasChanges) {
                await sheet.saveUpdatedCells();
                console.log(`  => Saved changes for sheet ${sheet.title}`);
            } else {
                console.log(`  => No duplicates found in ${sheet.title}`);
            }
        }
        console.log('All sheets processed.');

    } catch (error) {
        console.error('Error fixing headers:', error);
    }
}

fixDuplicateHeaders();
