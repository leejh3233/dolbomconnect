
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

const keyFilePath = path.join(process.cwd(), 'google-sheets-key.json');
const spreadsheetId = '1iqU45531_w_cXlLtgLJolecLTdgVPdbLMFsLwVAWogo';

async function fixCheckboxesFinal() {
    try {
        console.log('--- Starting Final Checkbox Fix (Raw API) ---');
        const keyFile = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
        const jwt = new JWT({
            email: keyFile.client_email,
            key: keyFile.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(spreadsheetId, jwt);
        await doc.loadInfo();

        const sheet = doc.sheetsByIndex[0]; // Leads Sheet
        console.log(`Target Sheet: ${sheet.title} (Rows: ${sheet.rowCount})`);

        // We need to apply validation to ALL rows (except header)
        // Range: I2:J[LastRow]
        // 0-based: Row 1 to Row (rowCount-1)

        // Be careful not to exceed grid limits.
        const rowCount = sheet.rowCount;

        if (rowCount <= 1) {
            console.log('No data rows to fix.');
            return;
        }

        const requestParams = {
            range: {
                sheetId: sheet.sheetId,
                startRowIndex: 1, // Skip header (row 0)
                endRowIndex: rowCount,
                startColumnIndex: 8, // Column I
                endColumnIndex: 10 // Column J + 1 (exclusive) -> so I and J
            },
            rule: {
                condition: {
                    type: 'BOOLEAN',
                },
                showCustomUi: true
            }
        };

        console.log('Sending massive setDataValidation request...');
        // @ts-ignore
        await sheet._makeSingleUpdateRequest('setDataValidation', requestParams);

        console.log('[SUCCESS] Applied checkbox validation to all existing rows.');

        // Now we also need to ensure values are boolean types, not string "FALSE"
        // This requires loading cells and looping
        console.log('Scanning for string "FALSE"/"TRUE" values to convert...');

        await sheet.loadCells(`I2:J${rowCount}`);

        let valueFixCount = 0;
        for (let i = 1; i < rowCount; i++) {
            // 8, 9
            const cellBooking = sheet.getCell(i, 8);
            const cellCompleted = sheet.getCell(i, 9);

            if (typeof cellBooking.value === 'string') {
                if (cellBooking.value.toUpperCase() === 'FALSE') { cellBooking.value = false; valueFixCount++; }
                if (cellBooking.value.toUpperCase() === 'TRUE') { cellBooking.value = true; valueFixCount++; }
            }
            if (typeof cellCompleted.value === 'string') {
                if (cellCompleted.value.toUpperCase() === 'FALSE') { cellCompleted.value = false; valueFixCount++; }
                if (cellCompleted.value.toUpperCase() === 'TRUE') { cellCompleted.value = true; valueFixCount++; }
            }
        }

        if (valueFixCount > 0) {
            console.log(`Saving value type fixes for ${valueFixCount} cells...`);
            await sheet.saveUpdatedCells();
            console.log('[SUCCESS] Value types corrected.');
        } else {
            console.log('No value type fixes needed.');
        }

    } catch (error) {
        console.error('CRITICAL ERROR:', error);
        if (error.response) {
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

fixCheckboxesFinal();
