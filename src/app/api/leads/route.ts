// Final deployment trigger for D-column and CORS fix
import { NextResponse } from 'next/server';
import { getSpreadsheet } from '@/lib/google-sheets';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const recommender = searchParams.get('recommender');

        const doc = await getSpreadsheet();
        const sheet = doc.sheetsById['0'] || doc.sheetsByIndex[0];

        await sheet.loadHeaderRow();
        const rows = await sheet.getRows();
        const lh = sheet.headerValues;

        if (type === 'partners') {
            // D열(index 3)에서 추천인 목록 추출
            const partnerNames = Array.from(new Set(
                rows
                    .map(row => row.get(lh[3]))
                    .filter(name => name && String(name).trim() !== '')
                    .map(name => String(name).trim())
            )).sort();
            return NextResponse.json({ partners: partnerNames }, { headers: CORS_HEADERS });
        }

        if (type === 'apartments' && recommender) {
            const apartments = rows
                .filter(r => {
                    const rName = String(r.get(lh[3]) || '').trim().toLowerCase();
                    const isBooked = String(r.get(lh[8])).toUpperCase() === 'TRUE';
                    const isCompleted = String(r.get(lh[9])).toUpperCase() === 'TRUE';
                    return rName === recommender.trim().toLowerCase() && isBooked && !isCompleted;
                })
                .map(r => ({
                    aptName: String(r.get(lh[4]) || '').trim(),
                    dong: String(r.get(lh[5]) || '').trim(),
                    contact: String(r.get(lh[6]) || '').trim(),
                    pyeong: String(r.get(lh[7]) || '').trim(),
                    saleAmount: String(r.get(lh[10]) || '').trim(),
                }))
                .filter((item, index, self) =>
                    item.aptName !== '' &&
                    self.findIndex(t => t.aptName === item.aptName) === index
                );
            return NextResponse.json({ apartments }, { headers: CORS_HEADERS });
        }

        return NextResponse.json({
            status: "ok",
            message: "Leads API active",
            timestamp: new Date().toISOString()
        }, { headers: CORS_HEADERS });
    } catch (error: any) {
        console.error('Leads GET error:', error);
        return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
    }
}

export async function POST(request: Request) {
    try {
        const data = await request.json();
        const doc = await getSpreadsheet();
        const sheet = doc.sheetsById['0'] || doc.sheetsByIndex[0];
        await sheet.loadHeaderRow();
        const h = sheet.headerValues;

        const rowData: Record<string, any> = {};
        if (h[0]) rowData[h[0]] = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }).replace(/\. /g, '.').replace(/\.$/, '');
        if (h[1]) rowData[h[1]] = data.source || '현장시공';
        if (h[2]) rowData[h[2]] = data.area || '';
        if (h[3]) rowData[h[3]] = data.recommender || '본사';
        if (h[4]) rowData[h[4]] = data.aptName || '';
        if (h[5]) rowData[h[5]] = data.pyeong || '';
        if (h[6]) rowData[h[6]] = data.scope || '';
        if (h[7]) rowData[h[7]] = '시공완료';
        if (h[8]) rowData[h[8]] = true;
        if (h[9]) rowData[h[9]] = true;
        if (h[10]) rowData[h[10]] = data.saleAmount || 0;
        if (h[11]) rowData[h[11]] = 0;
        if (h[12]) rowData[h[12]] = '미정산';

        const newRow = await sheet.addRow(rowData);
        const rowIndex = newRow.rowNumber - 1;

        try {
            // @ts-ignore
            await sheet._makeSingleUpdateRequest('setDataValidation', {
                range: {
                    sheetId: sheet.sheetId,
                    startRowIndex: rowIndex,
                    endRowIndex: rowIndex + 1,
                    startColumnIndex: 8,
                    endColumnIndex: 10
                },
                rule: { condition: { type: 'BOOLEAN' }, showCustomUi: true }
            });
        } catch (e) {
            console.error('Failed to set checkbox validation:', e);
        }

        return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
    } catch (error: any) {
        console.error('Leads POST error:', error);
        return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
    }
}
