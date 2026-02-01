import { NextRequest, NextResponse } from 'next/server';
import { getSpreadsheet } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';



const normalizeStr = (s: any) => String(s || '').trim().normalize('NFC').toLowerCase();

const isTrue = (val: any) => {
    if (val === true || val === 1 || val === '1') return true;
    const s = normalizeStr(val).toUpperCase();
    // 한국어 환경에서 흔히 쓰이는 모든 체크/표시 기호 대응
    const trueValues = ['TRUE', '1', 'V', 'CHECKED', 'O', 'YES', 'Y', 'X', '✔', '✅', '☑', '○', '◎'];
    return trueValues.includes(s);
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

        // 정밀 헤더 찾기: 1. 완전 일치 우선, 2. 포함 결과 차선
        const getColIdx = (targetNames: string[]) => {
            const normalizedTargets = targetNames.map(n => normalizeStr(n));
            // 완전 일치 시도
            let idx = lh.findIndex(header => normalizedTargets.includes(normalizeStr(header)));
            if (idx !== -1) return idx;
            // 포함 검색 시도 (유사 헤더)
            return lh.findIndex(header => normalizedTargets.some(t => normalizeStr(header).includes(t)));
        };

        const rIdx = getColIdx(['추천인']);
        const aIdx = getColIdx(['아파트명', '아파트']);
        const bIdx = getColIdx(['예약완료']); // '예약'만 하면 '예약금' 등과 섞일 수 있어 정확하게 지정
        const cIdx = getColIdx(['시공완료']);

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
            console.log(`[Leads API] Fetching for: "${recommender}" (Headers: ${lh.join(',')})`);

            if (rIdx === -1 || aIdx === -1 || bIdx === -1) {
                console.error(`[Leads API] Required headers missing. R:${rIdx}, A:${aIdx}, B:${bIdx}`);
                return NextResponse.json({ apartments: [], error: 'Sheet header mapping error' });
            }

            const apartments = rows
                .filter(r => {
                    const rowRecommender = normalizeStr(r.get(lh[rIdx]));
                    const isBooked = isTrue(r.get(lh[bIdx]));
                    const isCompleted = cIdx !== -1 ? isTrue(r.get(lh[cIdx])) : false;

                    // 사용자 요청: 추천인 일치 AND 예약완료(Checked) AND !시공완료(Empty)
                    const match = rowRecommender === recommender && isBooked && !isCompleted;

                    if (rowRecommender === recommender) {
                        console.log(`[Leads API] Filter Trace: Apt="${r.get(lh[aIdx])}", Booked=${isBooked}, Completed=${isCompleted} => Match=${match}`);
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

            console.log(`[Leads API] Result count for ${recommender}: ${apartments.length}`);
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

        const getColIdx = (targetNames: string[]) => {
            const normalizedTargets = targetNames.map(n => normalizeStr(n));
            let idx = h.findIndex(header => normalizedTargets.includes(normalizeStr(header)));
            if (idx !== -1) return idx;
            return h.findIndex(header => normalizedTargets.some(t => normalizeStr(header).includes(t)));
        };

        const rIdx = getColIdx(['추천인']);
        const aIdx = getColIdx(['아파트명', '아파트']);
        const bIdx = getColIdx(['예약완료']);
        const cIdx = getColIdx(['시공완료']);
        const salesIdx = getColIdx(['매출액', '판매금액']);
        const incentiveIdx = getColIdx(['인센티브']);
        const settleIdx = getColIdx(['정산']);

        console.log(`[Leads POST] Processing update: ${recommender} / ${aptName}`);

        // 최신 데이터부터 검색 (역순)
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
            console.warn(`[Leads POST] No matching row found for ${recommender} - ${aptName}`);
            return NextResponse.json({
                success: false,
                error: '일치하는 ' + recommender + ' 님의 예약 내역을 찾을 수 없습니다. 시트에서 해당 아파트의 [예약완료] 칸이 체크되어 있는지 확인해주세요.'
            }, { status: 400 });
        }
    } catch (error: any) {
        console.error('Leads POST error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
