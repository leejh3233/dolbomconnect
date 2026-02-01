import { NextRequest, NextResponse } from 'next/server';
import { getSpreadsheet } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';



export async function GET(request: NextRequest) {
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
            const partnerNames = Array.from(new Set(
                rows
                    .map(row => row.get(lh[3]))
                    .filter(name => name && String(name).trim() !== '')
                    .map(name => String(name).trim())
            )).sort();
            return NextResponse.json({ partners: partnerNames });
        }

        if (type === 'apartments' && recommender) {
            console.log(`[Leads API] Fetching apartments for recommender: "${recommender}"`);
            console.log(`[Leads API] Headers found:`, lh);

            const apartments = rows
                .filter(r => {
                    const rName = String(r.get(lh[3]) || '').trim().toLowerCase();
                    const bookVal = r.get(lh[8]);
                    const compVal = r.get(lh[9]);

                    const isBooked = bookVal === true || String(bookVal).toUpperCase() === 'TRUE';
                    const isCompleted = compVal === true || String(compVal).toUpperCase() === 'TRUE';

                    // 예약완료(I열)가 TRUE인 데이터만 필터링
                    const match = rName === recommender.trim().toLowerCase() && isBooked;

                    if (rName === recommender.trim().toLowerCase()) {
                        console.log(`[Leads API] Row match attempt: Apt="${r.get(lh[4])}", Booked=${isBooked}, Comp=${isCompleted}, Result=${match}`);
                    }

                    return match;
                })
                .map(r => ({
                    aptName: String(r.get(lh[4]) || '').trim()
                }))
                .filter((item, index, self) =>
                    item.aptName !== '' &&
                    self.findIndex(t => t.aptName === item.aptName) === index
                );

            console.log(`[Leads API] Found ${apartments.length} matching apartments`);
            return NextResponse.json({ apartments });
        }

        return NextResponse.json({ status: "ok" });
    } catch (error: any) {
        console.error('Leads GET error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const data = await request.json();
        const doc = await getSpreadsheet();
        const sheet = doc.sheetsById['0'] || doc.sheetsByIndex[0];
        await sheet.loadHeaderRow();
        const h = sheet.headerValues;
        const rows = await sheet.getRows();

        const recommender = String(data.recommender || '').trim().toLowerCase();
        const aptName = String(data.aptName || '').trim().toLowerCase();

        console.log(`[Leads POST] Searching for row to update: Recommender="${recommender}", Apt="${aptName}"`);

        // 1. 기존 '예약완료' 행 찾기
        const targetRow = [...rows].reverse().find(r => {
            const rName = String(r.get(h[3]) || '').trim().toLowerCase();
            const rApt = String(r.get(h[4]) || '').trim().toLowerCase();

            const bookVal = r.get(h[8]);
            const compVal = r.get(h[9]);

            const isBooked = bookVal === true || String(bookVal).toUpperCase() === 'TRUE';
            const isCompleted = compVal === true || String(compVal).toUpperCase() === 'TRUE';

            return rName === recommender && rApt === aptName && isBooked && !isCompleted;
        });

        if (targetRow) {
            // 기존 행 업데이트
            if (h[9]) targetRow.set(h[9], true); // 시공완료 체크박스
            if (h[10]) targetRow.set(h[10], data.saleAmount || 0); // 판매비용
            if (h[11]) targetRow.set(h[11], 20000); // 인센티브
            if (h[12]) targetRow.set(h[12], '미정산'); // 정산상태

            await targetRow.save();
            return NextResponse.json({ success: true, mode: 'updated' });
        } else {
            // 일치하는 행이 없으면 새로 추가 (Fallback)
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
            if (h[11]) rowData[h[11]] = 20000;
            if (h[12]) rowData[h[12]] = '미정산';

            const newRow = await sheet.addRow(rowData);

            // 체크박스 속성 부여
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (sheet as any)._makeSingleUpdateRequest('setDataValidation', {
                    range: {
                        sheetId: sheet.sheetId,
                        startRowIndex: newRow.rowNumber - 1,
                        endRowIndex: newRow.rowNumber,
                        startColumnIndex: 8,
                        endColumnIndex: 10
                    },
                    rule: { condition: { type: 'BOOLEAN' }, showCustomUi: true }
                });
            } catch (e) {
                console.error('DataValidation error:', e);
            }

            return NextResponse.json({ success: true, mode: 'inserted' });
        }
    } catch (error: any) {
        console.error('Leads POST error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
