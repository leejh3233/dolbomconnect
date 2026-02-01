import { NextResponse } from 'next/server';
import { getSpreadsheet } from '@/lib/google-sheets';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const empId = searchParams.get('empId');
        const password = searchParams.get('password');

        if (!empId || !password) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const doc = await getSpreadsheet();
        const leadsSheet = doc.sheetsByIndex[0];
        await leadsSheet.loadHeaderRow();
        const lh = leadsSheet.headerValues;
        const leads = await leadsSheet.getRows();

        console.log(`[PartnerData GET] empId: ${empId}, Leads Sheet: [${leadsSheet.index}] ${leadsSheet.title}, Rows: ${leads.length}, Headers:`, lh);


        const stats: any = { monthly: {}, allLeads: [], totalSettled: 0, totalPending: 0 };

        // Process leads for this specific partner (empId)
        for (let i = leads.length - 1; i >= 0; i--) {
            const r = leads[i];
            const partnerId = String(r.get(lh[3])).trim(); // Index 3: 추천인

            if (partnerId === String(empId).trim()) {
                const dateStr = r.get(lh[0]); // Index 0: 날짜
                if (!dateStr || String(dateStr).trim() === '') continue; // Skip empty rows

                // Robust Date Parsing
                let dateObj = new Date(dateStr);
                if (isNaN(dateObj.getTime())) {
                    // Try parsing "YYYY. MM. DD" format common in Korea
                    const parts = dateStr.split('.').map((p: string) => p.trim());
                    if (parts.length >= 3) {
                        dateObj = new Date(
                            parseInt(parts[0]),
                            parseInt(parts[1]) - 1,
                            parseInt(parts[2])
                        );
                    }
                }

                // If still invalid, default to today or skip
                if (isNaN(dateObj.getTime())) {
                    console.error(`Invalid date found: ${dateStr}`);
                    continue;
                }

                const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;


                if (!stats.monthly[monthKey]) {
                    stats.monthly[monthKey] = { leads: 0, bookings: 0, completed: 0, saleAmount: 0, incentive: 0, settled: 0, pending: 0 };
                }

                const isCompleted = r.get(lh[9]) === 'TRUE' || r.get(lh[9]) === true; // Index 9: 시공완료
                const incV = isCompleted ? 20000 : 0;
                const isSettled = r.get(lh[12]) === '정산완료'; // Index 12: 정산

                stats.monthly[monthKey].leads++;
                if (r.get(lh[8]) === 'TRUE' || r.get(lh[8]) === true) stats.monthly[monthKey].bookings++; // Index 8: 예약완료

                if (isCompleted) {
                    stats.monthly[monthKey].completed++;
                    stats.monthly[monthKey].saleAmount += (parseFloat(r.get(lh[10])) || 0); // Index 10: 매출액
                    stats.monthly[monthKey].incentive += incV;

                    if (isSettled) {
                        stats.monthly[monthKey].settled += incV;
                        stats.totalSettled += incV;
                    } else {
                        stats.monthly[monthKey].pending += incV;
                        stats.totalPending += incV;
                    }
                }

                stats.allLeads.push({
                    month: monthKey,
                    date: dateStr,
                    source: r.get(lh[1]), // Index 1: 유입경로
                    region: r.get(lh[2]), // Index 2: 지역
                    apt: r.get(lh[4]), // Index 4: 아파트명
                    isBooking: r.get(lh[8]) === 'TRUE' || r.get(lh[8]) === true,
                    isCompleted: isCompleted,
                    saleAmount: parseFloat(r.get(lh[10])) || 0,
                    incentive: incV,
                    settlement: r.get(lh[12]) || '미정산'
                });
            }
        }

        const partnersSheet = doc.sheetsByTitle['Partners'];
        await partnersSheet.loadHeaderRow();
        const ph = partnersSheet.headerValues;
        const partnerRows = await partnersSheet.getRows();

        const partner = partnerRows.find(r => String(r.get(ph[0])).trim() === String(empId).trim());

        if (!partner || String(partner.get(ph[1])).trim() !== String(password).trim()) {
            return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
        }

        return NextResponse.json({
            stats: stats,
            type: partner.get(ph[ph.length > 4 ? 4 : 4]), // Index 4: 유형
            bank: ph[2] ? partner.get(ph[2]) : '', // Index 2: 은행
            account: ph[3] ? partner.get(ph[3]) : '' // Index 3: 계좌번호
        });


    } catch (error: any) {
        console.error('API Partner Data error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
