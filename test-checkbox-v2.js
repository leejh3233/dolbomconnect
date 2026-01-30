
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

const keyFilePath = path.join(process.cwd(), 'google-sheets-key.json');
const spreadsheetId = '1iqU45531_w_cXlLtgLJolecLTdgVPdbLMFsLwVAWogo';

async function testCheckboxImplementationV2() {
    try {
        console.log('--- Starting Checkbox Verification Test V2 ---');
        const keyFile = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
        const jwt = new JWT({
            email: keyFile.client_email,
            key: keyFile.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(spreadsheetId, jwt);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];

        console.log(`Testing on Sheet: ${sheet.title}`);

        // Add test row
        const row = await sheet.addRow(['TEST_ROW_V2', 'Test', 'Test', 'Test', 'Test']);
        console.log(`Added Test Row V2: ${row.rowNumber}`);

        const rowNum = row.rowNumber;
        await sheet.loadCells(`I${rowNum}:J${rowNum}`);

        const cell = sheet.getCell(row.rowIndex, 8); // Column I

        // Simpler rule
        const rule = {
            condition: {
                type: 'BOOLEAN',
            },
            showCustomUi: true
        };

        console.log('Setting data validation:', rule);
        cell.dataValidation = rule;
        cell.value = false;

        console.log('Saving...');
        await sheet.saveUpdatedCells();
        console.log('Save complete.');

        // Reload
        await sheet.loadCells(`I${rowNum}:J${rowNum}`);
        const newCell = sheet.getCell(row.rowIndex, 8);
        console.log('Reloaded Validation:', JSON.stringify(newCell.dataValidation, null, 2));

        if (newCell.dataValidation && newCell.dataValidation.condition && newCell.dataValidation.condition.type === 'BOOLEAN') {
            console.log('[PASS] Checkbox persisted.');
        } else {
            console.log('[FAIL] Checkbox NOT persisted.');
        }

        // Clean
        await row.delete();
        console.log('Row deleted.');

    } catch (error) {
        console.error('CRITICAL ERROR:', error);
        // Print detailed axio error if available
        if (error.response) {
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testCheckboxImplementationV2();
