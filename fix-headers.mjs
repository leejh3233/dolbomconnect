
import { getSpreadsheet } from './src/lib/google-sheets.js'; // Note: This might need adjustment based on how you run it

async function fixHeaders() {
    const doc = await getSpreadsheet();
    const sheet = doc.sheetsByIndex[0];
    await sheet.loadCells('1:1');
    const headers = [];
    const seen = new Set();

    console.log('Current headers in first row:');
    for (let i = 0; i < sheet.columnCount; i++) {
        const cell = sheet.getCell(0, i);
        const val = String(cell.value || '').trim();
        console.log(`Col ${i}: "${val}"`);

        if (val && seen.has(val)) {
            console.log(`Found duplicate header: "${val}" at column ${i}. Clearing it.`);
            cell.value = ''; // Or rename to val + i
        }
        if (val) seen.add(val);
    }
    await sheet.saveUpdatedCells();
    console.log('Headers cleaned.');
}

fixHeaders().catch(console.error);
