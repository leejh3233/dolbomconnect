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
                    .filter(row => bIdx !== -1 ? isTrue(row.get(lh[bIdx])) : true)
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
        const source = data.source || '';
        const recommender = normalizeStr(data.recommender || data.empId);
        const aptName = normalizeStr(data.aptName);

        const doc = await getSpreadsheet();
        const sheet = doc.sheetsById['0'] || doc.sheetsByIndex[0];
        await sheet.loadHeaderRow();
        const h = sheet.headerValues;

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

        // 1. 현장시공 보고서인 경우: 기존 행 업데이트
        if (source === '현장시공') {
            const rows = await sheet.getRows();
            console.log(`[Leads POST] Processing update: ${recommender} / ${aptName}`);

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
                return NextResponse.json({
                    success: false,
                    error: '일치하는 ' + (data.recommender || data.empId) + ' 님의 예약 내역을 찾을 수 없습니다.'
                }, { status: 400 });
            }
        }

        // 2. 일반 고객 신청인 경우: 신규 행 추가
        else {
            console.log(`[Leads POST] Creating new lead row for: ${recommender}`);

            // KST 시간대 보정 (UTC + 9) 및 기존 시트 형식 (2026. 1. 22 오전 1:57:54) 구현
            const now = new Date();
            const kstOffset = 9 * 60 * 60 * 1000;
            const kstDate = new Date(now.getTime() + kstOffset);

            const y = kstDate.getUTCFullYear();
            const m = kstDate.getUTCMonth() + 1;
            const d = kstDate.getUTCDate();
            let hours = kstDate.getUTCHours();
            const ampm = hours >= 12 ? '오후' : '오전';
            hours = hours % 12 || 12; // 1~12시 형식
            const mm = String(kstDate.getUTCMinutes()).padStart(2, '0');
            const ss = String(kstDate.getUTCSeconds()).padStart(2, '0');

            const dateStr = `${y}. ${m}. ${d} ${ampm} ${hours}:${mm}:${ss}`;

            let finalRecommender = recommender;
            let finalSource = data.source || '직접유입';

            // Real-time verification for validity
            if (recommender && recommender !== '본사') {
                try {
                    const partnersSheet = doc.sheetsByTitle['Partners'];
                    await partnersSheet.loadHeaderRow();
                    const ph = partnersSheet.headerValues;
                    const pRows = await partnersSheet.getRows();
                    const p = pRows.find(pr => normalizeStr(pr.get(ph[0])) === recommender);
                    const status = p ? String(p.get(ph[7]) || '').trim() : '';

                    if (!p || status === '제외' || status === 'Expired') {
                        console.log(`[Leads POST] Recommender ${recommender} is invalid/deleted. Overwriting to 본사.`);
                        finalRecommender = '본사';
                        finalSource = `${finalSource} (비활성:${recommender})`;
                    }
                } catch (err) {
                    console.error('[Leads POST] Partner verify error:', err);
                }
            }

            const newRow: any = {};
            h.forEach(header => {
                const nh = normalizeStr(header);
                if (nh.includes('추천인')) newRow[header] = finalRecommender === '본사' ? '본사' : (data.recommender || data.empId || '본사');
                else if (nh.includes('아파트')) newRow[header] = data.aptName || '';
                else if (nh.includes('지역')) newRow[header] = data.area || '';
                else if (nh.includes('평수')) newRow[header] = data.pyeong || '';
                else if (nh.includes('시공범위')) newRow[header] = data.scope || '';
                else if (nh.includes('유입경로')) newRow[header] = finalSource;
                else if (nh.includes('날짜') || nh.includes('일자')) newRow[header] = dateStr;
                else if (nh.includes('진행') || nh.includes('상태')) newRow[header] = '상담대기';
                else if (nh === normalizeStr('매출액') || nh === normalizeStr('판매금액')) newRow[header] = '0';
                else if (nh.includes('인센티브')) newRow[header] = '0';
                else if (nh.includes('정산')) newRow[header] = '미정산';
            });

            // Double check recommender value for the specific row
            const rIdx = h.findIndex(header => normalizeStr(header).includes('추천인'));
            if (rIdx !== -1) newRow[h[rIdx]] = finalRecommender;

            await sheet.addRow(newRow);
            return NextResponse.json({ success: true, mode: 'inserted' });
        }
    } catch (error: any) {
        console.error('Leads POST error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
