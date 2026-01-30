
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

const keyFilePath = path.join(process.cwd(), 'google-sheets-key.json');
const spreadsheetId = '1iqU45531_w_cXlLtgLJolecLTdgVPdbLMFsLwVAWogo';

async function forceFixHeaders() {
    try {
        console.log('--- Force Fixing Headers ---');
        const keyFile = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
        const jwt = new JWT({
            email: keyFile.client_email,
            key: keyFile.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(spreadsheetId, jwt);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];

        console.log(`Target Sheet: ${sheet.title}`);

        // Correct Header Array
        const correctHeaders = [
            "날짜",
            "유입경로",
            "지역",
            "추천인",
            "아파트명",
            "평수",
            "시공범위",
            "상태",
            "예약완료", // Index 8
            "시공완료", // Index 9
            "매출액",
            "인센티브",
            "정산"
        ];

        console.log('Loading cells A1:Z1...');
        await sheet.loadCells({
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: correctHeaders.length + 5 // Load a bit more to clear extras
        });

        let changed = false;

        for (let i = 0; i < correctHeaders.length; i++) {
            const cell = sheet.getCell(0, i);
            if (cell.value !== correctHeaders[i]) {
                console.log(`Fixing Col ${i}: '${cell.value}' -> '${correctHeaders[i]}'`);
                cell.value = correctHeaders[i];
                cell.dataValidation = null; // Remove any validation on header
                changed = true;
            }
        }

        // Clear extra columns if they have garbage
        // (optional, but good for safety)

        if (changed) {
            await sheet.saveUpdatedCells();
            console.log('[SUCCESS] Headers overwritten with correct values.');
        } else {
            console.log('[INFO] Headers were already correct.');
        }

    } catch (error) {
        console.error('CRITICAL ERROR:', error);
    }
}

forceFixHeaders();
