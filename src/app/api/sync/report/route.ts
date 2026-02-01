import { NextResponse } from 'next/server';
import { getSpreadsheet } from '@/lib/google-sheets';

export async function POST(request: Request) {
    try {
        const { recommender, saleAmount, aptName } = await request.json();

        if (!recommender || !aptName) {
            return NextResponse.json({ error: 'Recommender name and Apartment name are required' }, { status: 400 });
        }

        const doc = await getSpreadsheet();
        // 사용자님께서 주신 gid=0 (마케팅 데이터가 쌓이는 곳)
        const sheet = doc.sheetsById['0'] || doc.sheetsByIndex[0];

        if (!sheet) {
            console.error('Available sheets:', Object.keys(doc.sheetsById));
            return NextResponse.json({ error: 'Partners/Recommender sheet not found' }, { status: 404 });
        }

        await sheet.loadHeaderRow();
        const rows = await sheet.getRows();
        const lh = sheet.headerValues;

        // 추천인 이름(D열, index 3) 및 아파트명(E열, index 4) 일치하는 행 찾기
        const recommenderHeader = lh[3];
        const aptHeader = lh[4];
        const bookingHeader = lh[8]; // 예약완료 여부

        if (!recommenderHeader || !aptHeader || !bookingHeader) {
            return NextResponse.json({ error: 'Required headers (Index 3, 4, 8) not found' }, { status: 500 });
        }

        // 1. 추천인 + 아파트명이 일치하면서 2. "예약완료"가 TRUE인 가장 최근 행 찾기
        const targetRow = [...rows].reverse().find(r => {
            const rName = String(r.get(recommenderHeader) || '').trim().toLowerCase();
            const rApt = String(r.get(aptHeader) || '').trim().toLowerCase();
            const isBooked = String(r.get(bookingHeader)).toUpperCase() === 'TRUE';

            return rName === String(recommender).trim().toLowerCase() &&
                rApt === String(aptName).trim().toLowerCase() &&
                isBooked;
        });

        if (targetRow) {
            // J열: 시공완료(TRUE), K열: 판매비용, L열: 인센티브(20000), M열: 정산상태(미정산)
            // 인덱스 기준: J=9, K=10, L=11, M=12
            if (lh[9]) targetRow.set(lh[9], 'TRUE');
            if (lh[10]) targetRow.set(lh[10], saleAmount);
            if (lh[11]) targetRow.set(lh[11], '20000');
            if (lh[12]) targetRow.set(lh[12], '미정산');

            await targetRow.save();
            return NextResponse.json({ success: true, message: 'Incentive updated' });
        } else {
            return NextResponse.json({ error: 'No matching recommender found in Leads sheet' }, { status: 404 });
        }
    } catch (error: any) {
        console.error('Report sync error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
