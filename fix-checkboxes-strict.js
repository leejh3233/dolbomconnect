
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

const keyFilePath = path.join(process.cwd(), 'google-sheets-key.json');
const spreadsheetId = '1iqU45531_w_cXlLtgLJolecLTdgVPdbLMFsLwVAWogo';

async function fixCheckboxesStrict() {
    try {
        console.log('Starting Strict Checkbox Fix...');
        const keyFile = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
        const jwt = new JWT({
            email: keyFile.client_email,
            key: keyFile.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(spreadsheetId, jwt);
        await doc.loadInfo();

        const sheet = doc.sheetsByIndex[0]; // Leads Sheet
        console.log(`Target Sheet: ${sheet.title}`);

        await sheet.loadCells();

        let changed = 0;

        // Skip header
        for (let i = 1; i < sheet.rowCount; i++) {
            // Check if date exists
            const cellDate = sheet.getCell(i, 0);
            if (!cellDate.value) continue;

            // Columns 8 (I) and 9 (J)
            const cols = [8, 9];

            for (const c of cols) {
                const cell = sheet.getCell(i, c);

                // Explicit Checkbox Validation Rule
                const checkboxRule = {
                    condition: {
                        type: 'BOOLEAN',
                    },
                    showCustomUi: true,
                    strict: true // Force strict boolean validation
                };

                cell.dataValidation = checkboxRule;

                // Clean up value. If it's string "FALSE" or "TRUE", convert to boolean.
                if (typeof cell.value === 'string') {
                    if (cell.value.toUpperCase() === 'FALSE') cell.value = false;
                    else if (cell.value.toUpperCase() === 'TRUE') cell.value = true;
                }

                // Default to false if empty
                if (cell.value === null || cell.value === undefined || cell.value === '') {
                    cell.value = false;
                }
            }
            changed++;
        }

        if (changed > 0) {
            await sheet.saveUpdatedCells();
            console.log(`[SUCCESS] Strict checkbox fix applied to ${changed} rows.`);
        } else {
            console.log('[INFO] No rows needed fixing.');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

fixCheckboxesStrict();
