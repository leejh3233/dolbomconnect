import { NextRequest, NextResponse } from 'next/server';
import { getSpreadsheet } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';



const normalizeStr = (s: any) => String(s || '').trim().normalize('NFC').toLowerCase();

const isTrue = (val: any) => {
    if (val === true || val === 1 || val === '1') return true;
    const s = normalizeStr(val).toUpperCase();
    // 한국어 환경에서 흔히 쓰이는 체크 표시들 (V, O, X, 1, TRUE 등)
    return ['TRUE', '1', 'V', 'CHECKED', 'O', 'YES', 'Y', 'X'].includes(s);
};

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const recommender = normalizeStr(searchParams.get('recommender'));

        const doc = await getSpreadsheet();
        const sheet = doc.sheetsById['0'] || doc.sheetsByIndex[0];

        await sheet.loadHeaderRow();
        const rows = await sheet.getRows();
        const lh = sheet.headerValues;

        // 헤더 인덱스 찾기 함수
        const getColIdx = (names: string[]) => {
            const idx = lh.findIndex(h => names.some(n => normalizeStr(h).includes(normalizeStr(n))));
            return idx;
        };

        const rIdx = getColIdx(['추천인']);
        const aIdx = getColIdx(['아파트명', '아파트']);
        const bIdx = getColIdx(['예약완료', '예약']);
        const cIdx = getColIdx(['시공완료', '시공']);

        if (type === 'partners') {
            const targetIdx = rIdx !== -1 ? rIdx : 3;
            const partnerNames = Array.from(new Set(
                rows
                    .map(row => String(row.get(lh[targetIdx]) || '').trim())
                    .filter(name => name !== '')
            )).sort();
            return NextResponse.json({ partners: partnerNames });
        }

        if (type === 'apartments' && recommender) {
            console.log(`[Leads API] Fetching for: "${recommender}"`);

            if (rIdx === -1 || aIdx === -1 || bIdx === -1) {
                console.error(`[Leads API] Header missing. Headers:`, lh);
                return NextResponse.json({ apartments: [], error: 'Sheet header structure mismatch' });
            }

            const apartments = rows
                .filter(r => {
                    const rowRecommender = normalizeStr(r.get(lh[rIdx]));
                    const isBooked = isTrue(r.get(lh[bIdx]));
                    const isCompleted = cIdx !== -1 ? isTrue(r.get(lh[cIdx])) : false;

                    // 추천인 일치 AND 예약완료 AND !시공완료
                    const match = rowRecommender === recommender && isBooked && !isCompleted;

                    if (rowRecommender === recommender) {
                        console.log(`[Leads API] Row: ${r.get(lh[aIdx])}, Booked=${isBooked}, Comp=${isCompleted}, Result=${match}`);
                    }

                    return match;
                })
                .map(r => ({
                    aptName: String(r.get(lh[aIdx]) || '').trim()
                }))
                .filter((item, index, self) =>
                    item.aptName !== '' &&
                    self.findIndex(t => t.aptName === item.aptName) === index
                );

            console.log(`[Leads API] Found ${apartments.length} matching apartments for ${recommender}`);
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
        const recommender = normalizeStr(data.recommender);
        const aptName = normalizeStr(data.aptName);

        const doc = await getSpreadsheet();
        const sheet = doc.sheetsById['0'] || doc.sheetsByIndex[0];
        await sheet.loadHeaderRow();
        const h = sheet.headerValues;
        const rows = await sheet.getRows();

        const getColIdx = (names: string[]) => h.findIndex(name => names.some(n => normalizeStr(name).includes(normalizeStr(n))));

        const rIdx = getColIdx(['추천인']);
        const aIdx = getColIdx(['아파트명', '아파트']);
        const bIdx = getColIdx(['예약완료', '예약']);
        const cIdx = getColIdx(['시공완료', '시공']);
        const salesIdx = getColIdx(['매출액', '판매금액']);
        const incentiveIdx = getColIdx(['인센티브']);
        const settleIdx = getColIdx(['정산']);

        console.log(`[Leads POST] Searching update target: ${recommender} - ${aptName}`);

        const targetRow = [...rows].reverse().find(r => {
            const rowRecommender = normalizeStr(r.get(h[rIdx]));
            const rowApt = normalizeStr(r.get(h[aIdx]));
            const isBooked = isTrue(r.get(h[bIdx]));
            const isCompleted = cIdx !== -1 ? isTrue(r.get(h[cIdx])) : false;

            return rowRecommender === recommender && rowApt === aptName && isBooked && !isCompleted;
        });

        if (targetRow) {
            if (cIdx !== -1) targetRow.set(h[cIdx], true);
            if (salesIdx !== -1) targetRow.set(h[salesIdx], data.saleAmount || 0);
            if (incentiveIdx !== -1) targetRow.set(h[incentiveIdx], 20000);
            if (settleIdx !== -1) targetRow.set(h[settleIdx], '미정산');

            await targetRow.save();
            return NextResponse.json({ success: true, mode: 'updated' });
        } else {
            console.warn(`[Leads POST] Match not found for update`);
            return NextResponse.json({
                success: false,
                error: '일치하는 예약 내역이 없습니다. 시트에서 해당 아파트가 [예약완료]에 체크되어 있고, [시공완료]는 비어 있는지 확인해 주세요.'
            }, { status: 400 });
        }
    } catch (error: any) {
        console.error('Leads POST error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
