
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

const keyFilePath = path.join(process.cwd(), 'google-sheets-key.json');
const spreadsheetId = '1iqU45531_w_cXlLtgLJolecLTdgVPdbLMFsLwVAWogo';

async function checkAndFixHeaders() {
    try {
        console.log('--- Checking Header Row for Duplicates ---');
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

        // Load just the first row
        await sheet.loadCells('A1:Z1');

        const headerValues = [];
        let needsFix = false;

        for (let i = 0; i < sheet.columnCount; i++) {
            const cell = sheet.getCell(0, i);
            let val = cell.value;

            // Log what we find
            if (val !== null && val !== undefined && val !== '') {
                // console.log(`Col ${i}: ${val} (Type: ${typeof val})`);
            }

            // Check for boolean false or string "FALSE"
            if (val === false || val === 'FALSE' || val === 'TRUE' || val === true) {
                console.log(`[PROBLEM] Found boolean/string boolean in header at Col ${i}: ${val}`);

                // Fix it: Rename to valid header
                // We know Col 8 (Index 8) is Booking, Col 9 (Index 9) is Completed
                if (i === 8) {
                    cell.value = "예약완료";
                    console.log(` -> Fixed to '예약완료'`);
                } else if (i === 9) {
                    cell.value = "시공완료";
                    console.log(` -> Fixed to '시공완료'`);
                } else {
                    cell.value = `Unknown_Header_${i}`;
                    console.log(` -> Fixed to 'Unknown_Header_${i}'`);
                }
                // Clear any data validation on header
                cell.dataValidation = null;
                needsFix = true;
            }
        }

        if (needsFix) {
            console.log('Saving header fixes...');
            await sheet.saveUpdatedCells();
            console.log('[SUCCESS] Headers fixed.');
        } else {
            console.log('[INFO] No problematic headers found in A1:Z1 range that match FALSE/TRUE.');

            // Double check simply loading headers
            try {
                await sheet.loadHeaderRow();
                console.log('loadHeaderRow() succeeded. Headers:', sheet.headerValues);
            } catch (e) {
                console.error('loadHeaderRow() Failed:', e.message);

                // If it failed, we might have duplicate "FALSE" strings that are NOT booleans but just strings.
                // Let's brute force valid headers based on known structure.
                console.log('Applying Brute Force Header Fix...');
                const correctHeaders = ["날짜", "유입경로", "지역", "추천인", "아파트명", "평수", "시공범위", "상태", "예약완료", "시공완료", "매출액", "인센티브", "정산"];

                for (let i = 0; i < correctHeaders.length; i++) {
                    const c = sheet.getCell(0, i);
                    if (String(c.value) !== correctHeaders[i]) {
                        console.log(`Overwriting header col ${i}: ${c.value} -> ${correctHeaders[i]}`);
                        c.value = correctHeaders[i];
                        c.dataValidation = null;
                    }
                }
                await sheet.saveUpdatedCells();
                console.log('[SUCCESS] Forced correct headers.');
            }
        }

    } catch (error) {
        console.error('CRITICAL ERROR:', error);
    }
}

checkAndFixHeaders();
