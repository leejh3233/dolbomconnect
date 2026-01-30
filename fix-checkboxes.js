
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

const keyFilePath = path.join(process.cwd(), 'google-sheets-key.json');
const spreadsheetId = '1iqU45531_w_cXlLtgLJolecLTdgVPdbLMFsLwVAWogo';

async function fixCheckboxes() {
    try {
        console.log('Starting Checkbox Fix...');
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

        await sheet.loadCells(); // Load ALL cells (might be heavy, but necessary for batch update)

        let changed = 0;

        // Skip header (row 0)
        for (let i = 1; i < sheet.rowCount; i++) {
            // Columns 8 (I) and 9 (J)
            const cellBooking = sheet.getCell(i, 8);
            const cellCompleted = sheet.getCell(i, 9);

            // Check if date exists (ignore empty rows)
            const cellDate = sheet.getCell(i, 0);
            if (!cellDate.value) continue;

            const checkboxRule = {
                condition: {
                    type: 'BOOLEAN',
                },
                showCustomUi: true
            };

            // Apply rule if missing? Or just force it.
            // Let's force it to ensure consistency.
            cellBooking.dataValidation = checkboxRule;
            cellCompleted.dataValidation = checkboxRule;

            // If value is null, set to false
            if (cellBooking.value === null) cellBooking.value = false;
            if (cellCompleted.value === null) cellCompleted.value = false;

            changed++;
        }

        if (changed > 0) {
            await sheet.saveUpdatedCells();
            console.log(`[SUCCESS] Fixed checkboxes for ${changed} rows.`);
        } else {
            console.log('[INFO] No rows needed fixing.');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

fixCheckboxes();
