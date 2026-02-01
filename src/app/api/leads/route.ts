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

        // 헬퍼: 다양한 형태의 TRUE 값을 판별
        const isTrue = (val: any) => {
            if (val === true || val === 1) return true;
            const s = String(val || '').trim().toUpperCase();
            return s === 'TRUE' || s === '1' || s === 'V' || s === 'CHECKED' || s === 'O' || s === 'TRUE';
        };

        if (type === 'partners') {
            const rIdx = lh.findIndex(h => h.trim() === '추천인');
            const targetIdx = rIdx !== -1 ? rIdx : lh.findIndex(h => h.includes('추천인'));
            const finalIdx = targetIdx !== -1 ? targetIdx : 3;

            const partnerNames = Array.from(new Set(
                rows
                    .map(row => row.get(lh[finalIdx]))
                    .filter(name => name && String(name).trim() !== '')
                    .map(name => String(name).trim())
            )).sort();
            return NextResponse.json({ partners: partnerNames });
        }

        if (type === 'apartments' && recommender) {
            console.log(`[Leads API] Fetching apartments for recommender: "${recommender}"`);

            const rIdx = lh.findIndex(h => h.trim() === '추천인');
            const aIdx = lh.findIndex(h => h.trim() === '아파트명');
            const bIdx = lh.findIndex(h => h.trim() === '예약완료');
            const cIdx = lh.findIndex(h => h.trim() === '시공완료');

            // 정확한 매칭 안될 시 유사 검색 시도
            const findIdx = (names: string[]) => lh.findIndex(h => names.some(n => h.includes(n)));
            const finalRIdx = rIdx !== -1 ? rIdx : findIdx(['추천인']);
            const finalAIdx = aIdx !== -1 ? aIdx : findIdx(['아파트명']);
            const finalBIdx = bIdx !== -1 ? bIdx : findIdx(['예약완료', '예약']);
            const finalCIdx = cIdx !== -1 ? cIdx : findIdx(['시공완료', '시공']);

            if (finalRIdx === -1 || finalAIdx === -1 || finalBIdx === -1) {
                console.error(`[Leads API] Header mismatch. Headers:`, lh);
                return NextResponse.json({ apartments: [], error: 'Sheet header error' });
            }

            const apartments = rows
                .filter(r => {
                    const rowRecommender = String(r.get(lh[finalRIdx]) || '').trim().toLowerCase();
                    const bookVal = r.get(lh[finalBIdx]);
                    const compVal = finalCIdx !== -1 ? r.get(lh[finalCIdx]) : false;

                    const isBooked = isTrue(bookVal);
                    const isCompleted = isTrue(compVal);

                    // 추천인은 일치하고, 예약은 되었으며, 아직 시공은 안 된 내역만 매칭
                    const isMatch = rowRecommender === recommender.trim().toLowerCase() && isBooked && !isCompleted;

                    if (rowRecommender === recommender.trim().toLowerCase()) {
                        console.log(`[Leads API] Debug Row: Apt="${r.get(lh[finalAIdx])}", Booked=${isBooked}, Comp=${isCompleted}, Match=${isMatch}`);
                    }

                    return isMatch;
                })
                .map(r => ({
                    aptName: String(r.get(lh[finalAIdx]) || '').trim()
                }))
                .filter((item, index, self) =>
                    item.aptName !== '' &&
                    self.findIndex(t => t.aptName === item.aptName) === index
                );

            console.log(`[Leads API] Returning ${apartments.length} available apartments`);
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

        // 헬퍼: 다양한 형태의 TRUE 값을 판별
        const isTrue = (val: any) => {
            if (val === true || val === 1) return true;
            const s = String(val || '').trim().toUpperCase();
            return s === 'TRUE' || s === '1' || s === 'V' || s === 'CHECKED' || s === 'O';
        };

        // 헤더 인덱스 검색 (유연하게)
        const findIdx = (names: string[]) => h.findIndex(name => names.some(n => name.includes(n)));
        const rIdx = findIdx(['추천인']);
        const aIdx = findIdx(['아파트명']);
        const bIdx = findIdx(['예약완료']);
        const cIdx = findIdx(['시공완료']);
        const salesIdx = findIdx(['매출액']);
        const incentiveIdx = findIdx(['인센티브']);
        const settleIdx = findIdx(['정산']);

        console.log(`[Leads POST] Searching for match: ${recommender} / ${aptName}`);

        // 1. 기존 '예약완료' && '시공 미완료' 행 찾기
        const targetRow = [...rows].reverse().find(r => {
            const rowRecommender = String(r.get(h[rIdx]) || '').trim().toLowerCase();
            const rowApt = String(r.get(h[aIdx]) || '').trim().toLowerCase();

            const isBooked = isTrue(r.get(h[bIdx]));
            const isCompleted = cIdx !== -1 ? isTrue(r.get(h[cIdx])) : false;

            return rowRecommender === recommender && rowApt === aptName && isBooked && !isCompleted;
        });

        if (targetRow) {
            // 기존 행 업데이트
            if (cIdx !== -1) targetRow.set(h[cIdx], true);
            if (salesIdx !== -1) targetRow.set(h[salesIdx], data.saleAmount || 0);
            if (incentiveIdx !== -1) targetRow.set(h[incentiveIdx], 20000);
            if (settleIdx !== -1) targetRow.set(h[settleIdx], '미정산');

            await targetRow.save();
            console.log(`[Leads POST] Successfully updated row`);
            return NextResponse.json({ success: true, mode: 'updated' });
        } else {
            console.warn(`[Leads POST] No match found for update logic`);
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
