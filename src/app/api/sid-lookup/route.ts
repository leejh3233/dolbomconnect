import { NextResponse } from 'next/server';
import { getSpreadsheet } from '@/lib/google-sheets';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sid = searchParams.get('sid');
        if (!sid) return NextResponse.json({ error: 'Missing sid' }, { status: 400 });

        const doc = await getSpreadsheet();
        const sheet = doc.sheetsByTitle['ShortLinks'];
        await sheet.loadHeaderRow();
        const h = sheet.headerValues;
        const rows = await sheet.getRows();

        console.log(`[SID Lookup] Looking for sid: ${sid}. Headers:`, h);

        const link = rows.find(r => String(r.get(h[0])).trim().toUpperCase() === String(sid).trim().toUpperCase());

        if (link) {
            return NextResponse.json({
                empId: link.get(h[1]), // Index 1: 이름
                source: link.get(h[2]) // Index 2: 유입경로
            });
        }


        return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
