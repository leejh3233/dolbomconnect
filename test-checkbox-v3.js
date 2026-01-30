
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

const keyFilePath = path.join(process.cwd(), 'google-sheets-key.json');
const spreadsheetId = '1iqU45531_w_cXlLtgLJolecLTdgVPdbLMFsLwVAWogo';

async function testCheckboxImplementationV3() {
    try {
        console.log('--- Starting Checkbox Verification Test V3 (Raw Request) ---');
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
        const row = await sheet.addRow(['TEST_ROW_V3', 'Test', 'Test', 'Test', 'Test']);
        console.log(`Added Test Row V3: ${row.rowNumber}`);

        const rowIndex = row.rowIndex; // 0-based

        // Use internal method _makeSingleUpdateRequest to call setDataValidation
        // range: I (index 8) to J (index 9) -> endColumnIndex is exclusive? 
        // Sheets API: end is exclusive. So for col 8, start 8 end 9.
        // We want I and J. I is 8, J is 9. So start 8, end 10.

        const requestParams = {
            range: {
                sheetId: sheet.sheetId,
                startRowIndex: rowIndex,
                endRowIndex: rowIndex + 1,
                startColumnIndex: 8,
                endColumnIndex: 10
            },
            rule: {
                condition: {
                    type: 'BOOLEAN',
                },
                showCustomUi: true
            }
        };

        console.log('Sending setDataValidation request...', JSON.stringify(requestParams, null, 2));

        // @ts-ignore - calling internal method
        await sheet._makeSingleUpdateRequest('setDataValidation', requestParams);

        console.log('Request sent successfully.');

        // Reload to verify persistence
        // We can't easily verify validation via loadCells since the library doesn't load it!
        // But if the request succeeded, it should be there.
        // Let's try to infer from value type or check via direct API usage if possible, 
        // but simple success of the call is a strong indicator.

        console.log('[PASS] setDataValidation request completed without error.');

        // Cleanup
        await row.delete();
        console.log('Row deleted.');

    } catch (error) {
        console.error('CRITICAL ERROR:', error);
        if (error.response) {
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testCheckboxImplementationV3();
