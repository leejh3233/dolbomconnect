
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

const keyFilePath = path.join(process.cwd(), 'google-sheets-key.json');
const spreadsheetId = '1iqU45531_w_cXlLtgLJolecLTdgVPdbLMFsLwVAWogo';

async function testCheckboxImplementation() {
    try {
        console.log('--- Starting Checkbox Verification Test ---');
        const keyFile = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
        const jwt = new JWT({
            email: keyFile.client_email,
            key: keyFile.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(spreadsheetId, jwt);
        await doc.loadInfo();

        const sheet = doc.sheetsByIndex[0]; // Leads Sheet
        console.log(`Testing on Sheet: ${sheet.title}`);

        // We will work on the last row to minimize disruption, or add a test row
        // Let's add a temporary test row
        const row = await sheet.addRow(['TEST_ROW', 'Test', 'Test', 'Test', 'Test', 'Test', 'Test', 'Test', false, false, 0, 0, 'Test']);
        console.log(`Added Test Row: ${row.rowNumber}`);

        const rowNum = row.rowNumber;
        await sheet.loadCells(`I${rowNum}:J${rowNum}`);

        const cell = sheet.getCell(row.rowIndex, 8); // Column I

        console.log('Initial Validation:', JSON.stringify(cell.dataValidation, null, 2));

        // Attempt 1: Standard BOOLEAN rule
        const rule = {
            condition: {
                type: 'BOOLEAN',
                values: [] // Explicitly empty values?
            },
            showCustomUi: true,
            strict: true
        };

        cell.dataValidation = rule;
        cell.value = false;

        await sheet.saveUpdatedCells();
        console.log('Saved changes. Reloading cells...');

        // Reload to verify persistence
        await sheet.loadCells(`I${rowNum}:J${rowNum}`);
        const newCell = sheet.getCell(row.rowIndex, 8);

        console.log('Persisted Validation:', JSON.stringify(newCell.dataValidation, null, 2));

        if (newCell.dataValidation && newCell.dataValidation.condition && newCell.dataValidation.condition.type === 'BOOLEAN') {
            console.log('[PASS] Checkbox validation persisted correctly in metadata.');
        } else {
            console.log('[FAIL] Checkbox validation NOT persisted.');
        }

        // Cleanup
        console.log('Deleting test row...');
        await row.delete();
        console.log('Test complete.');

    } catch (error) {
        console.error('Test Error:', error);
    }
}

testCheckboxImplementation();
