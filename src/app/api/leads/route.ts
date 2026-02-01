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
            const recommenderIdx = lh.findIndex(h => h.includes('추천인'));
            const targetIdx = recommenderIdx !== -1 ? recommenderIdx : 3;
            const partnerNames = Array.from(new Set(
                rows
                    .map(row => row.get(lh[targetIdx]))
                    .filter(name => name && String(name).trim() !== '')
                    .map(name => String(name).trim())
            )).sort();
            return NextResponse.json({ partners: partnerNames });
        }

        if (type === 'apartments' && recommender) {
            console.log(`[Leads API] Fetching apartments for recommender: "${recommender}"`);

            const recommenderIdx = lh.findIndex(h => h.includes('추천인'));
            const aptNameIdx = lh.findIndex(h => h.includes('아파트명'));
            const reservedIdx = lh.findIndex(h => h.includes('예약완료'));
            const completedIdx = lh.findIndex(h => h.includes('시공완료'));

            if (recommenderIdx === -1 || aptNameIdx === -1 || reservedIdx === -1) {
                return NextResponse.json({ apartments: [], error: 'Sheet structure error' });
            }

            const apartments = rows
                .filter(r => {
                    const rName = String(r.get(lh[recommenderIdx]) || '').trim().toLowerCase();
                    const bookVal = r.get(lh[reservedIdx]);
                    const compVal = completedIdx !== -1 ? r.get(lh[completedIdx]) : false;

                    const isBooked = bookVal === true || String(bookVal).toUpperCase() === 'TRUE' || String(bookVal) === '1';
                    const isCompleted = compVal === true || String(compVal).toUpperCase() === 'TRUE' || String(compVal) === '1';

                    // 예약완료(I)는 TRUE이고 시공완료(J)는 FALSE인 것만
                    const match = rName === recommender.trim().toLowerCase() && isBooked && !isCompleted;

                    if (rName === recommender.trim().toLowerCase()) {
                        console.log(`[Leads API] Row Check: Apt="${r.get(lh[aptNameIdx])}", Booked=${isBooked}, Comp=${isCompleted}, Result=${match}`);
                    }

                    return match;
                })
                .map(r => ({
                    aptName: String(r.get(lh[aptNameIdx]) || '').trim()
                }))
                .filter((item, index, self) =>
                    item.aptName !== '' &&
                    self.findIndex(t => t.aptName === item.aptName) === index
                );

            console.log(`[Leads API] Found ${apartments.length} available apartments`);
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

        // 헤더 인덱스 찾기
        const recommenderIdx = h.findIndex(name => name.includes('추천인'));
        const aptNameIdx = h.findIndex(name => name.includes('아파트명'));
        const reservedIdx = h.findIndex(name => name.includes('예약완료'));
        const completedIdx = h.findIndex(name => name.includes('시공완료'));
        const salesIdx = h.findIndex(name => name.includes('매출액'));
        const incentiveIdx = h.findIndex(name => name.includes('인센티브'));
        const settleIdx = h.findIndex(name => name.includes('정산'));

        console.log(`[Leads POST] Processing update for: ${recommender} - ${aptName}`);

        // 1. 기존 '예약완료' && '시공 미완료' 행 찾기
        const targetRow = [...rows].reverse().find(r => {
            const rName = String(r.get(h[recommenderIdx]) || '').trim().toLowerCase();
            const rApt = String(r.get(h[aptNameIdx]) || '').trim().toLowerCase();

            const bookVal = r.get(h[reservedIdx]);
            const compVal = completedIdx !== -1 ? r.get(h[completedIdx]) : false;

            const isBooked = bookVal === true || String(bookVal).toUpperCase() === 'TRUE' || String(bookVal) === '1';
            const isCompleted = compVal === true || String(compVal).toUpperCase() === 'TRUE' || String(compVal) === '1';

            return rName === recommender && rApt === aptName && isBooked && !isCompleted;
        });

        if (targetRow) {
            // 기존 행 업데이트 (덮어쓰기)
            if (completedIdx !== -1) targetRow.set(h[completedIdx], true);
            if (salesIdx !== -1) targetRow.set(h[salesIdx], data.saleAmount || 0);
            if (incentiveIdx !== -1) targetRow.set(h[incentiveIdx], 20000);
            if (settleIdx !== -1) targetRow.set(h[settleIdx], '미정산');

            await targetRow.save();
            console.log(`[Leads POST] Row successfully updated`);
            return NextResponse.json({ success: true, mode: 'updated' });
        } else {
            console.warn(`[Leads POST] No matching reservation row found. Re-inserting logic skipped for data integrity.`);
            return NextResponse.json({
                success: false,
                error: '일치하는 예약 내역이 없습니다. 예약이 완료된 아파트만 시공 보고서 작성이 가능합니다.'
            }, { status: 400 });
        }
    } catch (error: any) {
        console.error('Leads POST error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
