import { getSpreadsheet } from './src/lib/google-sheets.js';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Force load env
dotenv.config();

async function debugData() {
    try {
        const doc = await getSpreadsheet();
        const sheet = doc.sheetsByIndex[0];
        await sheet.loadHeaderRow();
        const rows = await sheet.getRows();
        const lh = sheet.headerValues;

        console.log('Headers:', lh);
        console.log('Target Recommender: 이민우');

        const matching = rows.filter(r => String(r.get(lh[3]) || '').trim() === '이민우');
        console.log(`Found ${matching.length} rows for 이민우`);

        matching.forEach((r, i) => {
            console.log(`Row ${i}: Apt=${r.get(lh[4])}, Reserved=${r.get(lh[8])}, Completed=${r.get(lh[9])}`);
        });

    } catch (e) {
        console.error(e);
    }
}
debugData();
