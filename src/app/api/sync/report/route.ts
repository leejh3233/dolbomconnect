import { NextResponse } from 'next/server';
import { getSpreadsheet } from '@/lib/google-sheets';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { recommender, saleAmount } = body;

        if (!recommender) {
            return NextResponse.json({ error: 'Recommender name is required' }, { status: 400 });
        }

        const doc = await getSpreadsheet();
        const leadsSheet = doc.sheetsByIndex[0]; // Assuming first sheet is the leads/incentive sheet
        await leadsSheet.loadHeaderRow();
        const lh = leadsSheet.headerValues;
        const rows = await leadsSheet.getRows();

        // 3. 인센티브 시트(dolbomconnect) 업데이트
        // D열(추천인)에서 일치하는 이름을 찾아 업데이트
        // D열 index는 3 (0-based)
        const recommenderHeader = lh[3];
        const targetRow = rows.find(r => String(r.get(recommenderHeader)).trim() === String(recommender).trim());

        if (targetRow) {
            // J열: '완료' 체크 (index 9)
            if (lh[9]) targetRow.set(lh[9], 'TRUE');

            // K열: 시공보고서 M열(판매비용)의 금액 입력 (index 10)
            if (lh[10]) targetRow.set(lh[10], saleAmount);

            // L열: 20,000 (고정 인센티브 금액) 입력 (index 11)
            if (lh[11]) targetRow.set(lh[11], '20000');

            // M열: '미정산' 텍스트 입력 (index 12)
            if (lh[12]) targetRow.set(lh[12], '미정산');

            await targetRow.save();
            return NextResponse.json({ success: true, message: 'Incentive sheet updated' });
        }

        return NextResponse.json({ error: 'Recommender not found in leads sheet' }, { status: 404 });
    } catch (error: any) {
        console.error('API Sync Report error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
