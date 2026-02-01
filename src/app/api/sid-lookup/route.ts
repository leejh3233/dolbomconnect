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
            const partnerName = String(link.get(h[1])).trim();
            const source = link.get(h[2]);

            // Verify if partner still exists and is Active
            try {
                const partnersSheet = doc.sheetsByTitle['Partners'];
                await partnersSheet.loadHeaderRow();
                const ph = partnersSheet.headerValues;
                const pRows = await partnersSheet.getRows();

                const p = pRows.find(pr => String(pr.get(ph[0])).trim() === partnerName);
                const status = p ? String(p.get(ph[7]) || '').trim() : '';

                if (!p || status === '제외' || status === 'Expired') {
                    console.log(`[SID Lookup] Partner ${partnerName} is inactive/deleted. Falling back to 본사.`);
                    return NextResponse.json({
                        empId: '본사',
                        source: `${source} (비활성 파트너)`
                    });
                }
            } catch (err) {
                console.error('[SID Lookup] Partner verify error, fallback to original name:', err);
            }

            return NextResponse.json({
                empId: partnerName,
                source: source
            });
        }


        return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
