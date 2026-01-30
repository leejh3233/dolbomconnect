
import { NextResponse } from 'next/server';
import { getSpreadsheet } from '@/lib/google-sheets';

export async function POST(request: Request) {
    try {
        const { partnerName } = await request.json();

        if (!partnerName) {
            return NextResponse.json({ error: 'Missing partner name' }, { status: 400 });
        }

        const doc = await getSpreadsheet();
        const sheet = doc.sheetsByIndex[0]; // Leads Sheet
        await sheet.loadHeaderRow();
        const lh = sheet.headerValues;
        const rows = await sheet.getRows();

        // Filter valid rows for this partner that are Completed but NOT Settled
        // Index 3: 추천인 (Partner Name)
        // Index 9: 시공완료 (Completed) (TRUE)
        // Index 12: 정산 (Settlement) (not '정산완료')

        const targetRows = rows.filter(r => {
            const pName = r.get(lh[3]);
            const isCompleted = r.get(lh[9]) === 'TRUE' || r.get(lh[9]) === true;
            const settlementStatus = r.get(lh[12]);

            return String(pName).trim() === String(partnerName).trim() &&
                isCompleted &&
                settlementStatus !== '정산완료';
        });

        if (targetRows.length === 0) {
            return NextResponse.json({ success: true, count: 0, message: 'Nothing to settle' });
        }

        // Mark them as setteld
        for (const row of targetRows) {
            row.set(lh[12], '정산완료');
            await row.save(); // Save one by one or we can do batch update if supported, but save() on row is safer logic-wise
        }

        return NextResponse.json({ success: true, count: targetRows.length });

    } catch (error: any) {
        console.error('Settlement error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
