import { NextResponse } from 'next/server';
import { getSpreadsheet } from '@/lib/google-sheets';

export async function POST(request: Request) {
    try {
        const data = await request.json();
        console.log('Received lead data:', data);

        const doc = await getSpreadsheet();
        const sheet = doc.sheetsByIndex[0];
        await sheet.loadHeaderRow();
        const h = sheet.headerValues;

        console.log(`[Leads POST] Saving to sheet: [${sheet.index}] ${sheet.title}. Headers:`, h);


        // Map data to headers by their position (Index based)
        // 0:날짜, 1:유입경로, 2:지역, 3:추천인, 4:아파트명, 5:평수, 6:시공범위, 7:상태, 8:예약완료, 9:시공완료...
        const rowData: Record<string, any> = {};
        if (h[0]) rowData[h[0]] = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }).replace(/\. /g, '.').replace(/\.$/, '');
        if (h[1]) rowData[h[1]] = data.source || '직접유입';
        if (h[2]) rowData[h[2]] = data.area;
        if (h[3]) rowData[h[3]] = data.empId || '본사';
        if (h[4]) rowData[h[4]] = data.aptName;
        if (h[5]) rowData[h[5]] = data.pyeong;
        if (h[6]) rowData[h[6]] = data.scope;
        if (h[7]) rowData[h[7]] = '상담대기';
        if (h[8]) rowData[h[8]] = false;
        if (h[9]) rowData[h[9]] = false;
        if (h[10]) rowData[h[10]] = 0;
        if (h[11]) rowData[h[11]] = 0;
        if (h[12]) rowData[h[12]] = '미정산';

        const newRow = await sheet.addRow(rowData);

        // Force Checkbox Validation using raw API request (Node library workaround)
        // I (index 8) and J (index 9)
        const rowIndex = newRow.rowNumber - 1; // 0-based index derived from 1-based rowNumber

        try {
            // @ts-ignore
            await sheet._makeSingleUpdateRequest('setDataValidation', {
                range: {
                    sheetId: sheet.sheetId,
                    startRowIndex: rowIndex,
                    endRowIndex: rowIndex + 1,
                    startColumnIndex: 8,
                    endColumnIndex: 10 // Exclusive end, covers 8 and 9
                },
                rule: {
                    condition: {
                        type: 'BOOLEAN',
                    },
                    showCustomUi: true
                }
            });
        } catch (e) {
            console.error('Failed to set checkbox validation:', e);
        }

        // Value is already set to false by addRow using rowData



        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}


