import { NextResponse } from 'next/server';
import { getSpreadsheet } from '@/lib/google-sheets';

export async function GET() {
    try {
        const doc = await getSpreadsheet();
        const sheet = doc.sheetsByTitle['Partners'];
        if (!sheet) {
            return NextResponse.json({ error: 'Partners sheet not found' }, { status: 404 });
        }

        await sheet.loadHeaderRow();
        const rows = await sheet.getRows();

        // PartnerName is in Column A (Index 0)
        const partnerNames = rows
            .map(row => row.get(sheet.headerValues[0]))
            .filter(name => name && String(name).trim() !== '');

        return NextResponse.json({ partners: partnerNames });
    } catch (error: any) {
        console.error('API Partners List error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
