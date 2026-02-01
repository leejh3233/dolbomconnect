import { getSpreadsheet } from './src/lib/google-sheets';
import * as dotenv from 'dotenv';
dotenv.config();

async function verify() {
    try {
        const doc = await getSpreadsheet();
        const sheet = doc.sheetsByIndex[0];
        await sheet.loadHeaderRow();
        console.log('Headers:', sheet.headerValues);

        const rows = await sheet.getRows();
        if (rows.length > 0) {
            console.log('Sample Row (Index 0):', rows[0]._rawData);
            console.log('Sample Row (Index 0) Values:', sheet.headerValues.map(h => `${h}: ${rows[0].get(h)}`));
        }
    } catch (e) {
        console.error(e);
    }
}
verify();
