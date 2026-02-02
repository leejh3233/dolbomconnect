import { NextResponse } from 'next/server';
import { getSpreadsheet } from '@/lib/google-sheets';

export async function GET() {
    try {
        const doc = await getSpreadsheet();

        // 1. Leads Sheet
        const leadsSheet = doc.sheetsByIndex[0];
        await leadsSheet.loadHeaderRow();
        const lh = leadsSheet.headerValues;
        const rows = await leadsSheet.getRows();

        console.log(`[Admin GET] Leads Sheet: ${leadsSheet.title}, Rows: ${rows.length}, Headers:`, lh);

        // 2. Partners Sheet
        const partnersSheet = doc.sheetsByTitle['Partners'];
        await partnersSheet.loadHeaderRow();
        const ph = partnersSheet.headerValues;
        const partnerRows = await partnersSheet.getRows();

        // Helper to find column header by name
        const getColName = (possibleNames: string[], defaultIdx: number) => {
            const found = ph.find(header =>
                possibleNames.some(name => header.toLowerCase().includes(name.toLowerCase()))
            );
            return found || ph[defaultIdx];
        };

        const pNameH = getColName(['이름', 'PartnerName', '성함'], 0);
        const pTypeH = getColName(['유형', 'Type', '영업구분'], 4);
        const pStatusH = getColName(['상태', 'Status'], 7);
        const pBankH = getColName(['은행', 'BankName', '은행명'], 2);
        const pAccH = getColName(['계좌번호', 'Account', '계좌'], 3);

        const partners = partnerRows.map(r => ({
            name: r.get(pNameH) || '',
            type: r.get(pTypeH) || '외부파트너',
            status: r.get(pStatusH) || 'Active',
            bank: r.get(pBankH) || '',
            account: r.get(pAccH) || '',
            pendingMap: {},
            settledMap: {}
        }));

        let globalTotalSettled = 0;
        let globalTotalPending = 0;

        const leadData = rows
            .filter(r => {
                const dateVal = r.get(lh[0]);
                return dateVal && String(dateVal).trim().length > 0;
            })
            .map((r, i) => {
                const isComp = r.get(lh[9]) === 'TRUE' || r.get(lh[9]) === true;
                const amount = isComp ? 20000 : 0;
                const isSettled = r.get(lh[12]) === '정산완료';

                const dateStr = String(r.get(lh[0]) || "").trim();
                let dateObj = new Date(dateStr);

                // Enhanced Date Parsing for Korean formats (YYYY. MM. DD or YYYY.MM.DD)
                if (isNaN(dateObj.getTime())) {
                    // Try removing spaces and replacing dots with hyphens
                    const cleaned = dateStr.replace(/\s/g, '').replace(/\./g, '-');
                    // Check if it ends with hyphen (e.g. 2024-01-01-)
                    const validFormat = cleaned.replace(/-$/, '');
                    dateObj = new Date(validFormat);
                }

                // If still invalid, try manual split
                if (isNaN(dateObj.getTime())) {
                    const parts = dateStr.split('.').map(s => s.trim()).filter(Boolean);
                    if (parts.length >= 3) {
                        // Asumme YYYY, MM, DD
                        const y = parseInt(parts[0]);
                        const m = parseInt(parts[1]) - 1;
                        const d = parseInt(parts[2]);
                        dateObj = new Date(y, m, d);
                    }
                }

                const isValidDate = !isNaN(dateObj.getTime());
                const monthKey = isValidDate
                    ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}` // YYYY-MM
                    : 'Unknown';

                const shortDateStr = isValidDate
                    ? `${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`
                    : dateStr;

                if (isComp) {
                    const partnerName = String(r.get(lh[3])).trim();
                    const p = partners.find(ptr => String(ptr.name).trim() === partnerName);
                    if (p) {
                        if (isSettled) {
                            // @ts-ignore
                            p.settledMap[monthKey] = (p.settledMap[monthKey] || 0) + amount;
                            globalTotalSettled += amount;
                        } else {
                            // @ts-ignore
                            p.pendingMap[monthKey] = (p.pendingMap[monthKey] || 0) + amount;
                            globalTotalPending += amount;
                        }
                    }
                }

                return {
                    rowId: r.rowNumber,
                    date: dateStr,
                    shortDate: shortDateStr,
                    fullMonth: monthKey,
                    source: r.get(lh[1]),
                    partner: r.get(lh[3]),
                    apt: r.get(lh[4]),
                    isBooking: r.get(lh[8]) === 'TRUE' || r.get(lh[8]) === true,
                    isCompleted: isComp,
                    saleAmount: parseFloat(String(r.get(lh[10]) || '0').replace(/,/g, '')) || 0,
                    incentive: amount,
                    settlement: r.get(lh[12]) || '미정산'
                };
            });


        return NextResponse.json({
            leads: leadData.reverse(),
            partners: partners,
            totalSettled: globalTotalSettled,
            totalPending: globalTotalPending
        });
    } catch (error: any) {
        console.error('API Admin error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const { rowId, col, value } = await request.json();
        const doc = await getSpreadsheet();
        const sheet = doc.sheetsByIndex[0];
        await sheet.loadHeaderRow();
        const headers = sheet.headerValues;
        const rows = await sheet.getRows();

        const targetRow = rows.find((_, i) => i + 2 === rowId); // Approximate rowId matching needs better logic if rows are deleted/filtered.
        // Better:
        // const targetRow = rows.find(r => r.rowNumber === rowId);
        // But r.rowNumber is not available directly on row iteration unless we access it or trust getRows order.
        // GoogleSpreadsheetRow has rowNumber.

        const realTargetRow = rows.find(r => r.rowNumber === rowId);

        if (realTargetRow) {
            const headerName = headers[col - 1];

            if (headerName) {
                // Logical side effects from Code.gs
                // Index 9 (1-based col 10) is 시공완료
                if (col === 10) {
                    const incHeader = headers[11]; // Index 11 is 인센티브
                    if (incHeader) {
                        realTargetRow.set(incHeader, (value === true || value === 'TRUE') ? 20000 : 0);
                    }
                }

                // If updating sales amount (col 11), also ensure it's treated as number
                if (col === 11) {
                    realTargetRow.set(headerName, parseFloat(String(value).replace(/,/g, '')) || 0);
                } else {
                    realTargetRow.set(headerName, value);
                }

                await realTargetRow.save();
                return NextResponse.json({ success: true });
            }
        }
        return NextResponse.json({ error: 'Row not found' }, { status: 404 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, name, type } = body;
        const doc = await getSpreadsheet();

        if (action === 'register') {
            const sheet = doc.sheetsByTitle['Partners'];
            await sheet.loadHeaderRow();
            const h = sheet.headerValues;

            const now = new Date();
            const kstOffset = 9 * 60 * 60 * 1000;
            const kstDate = new Date(now.getTime() + kstOffset);
            const y = kstDate.getUTCFullYear();
            const m = kstDate.getUTCMonth() + 1;
            const d = kstDate.getUTCDate();
            let hours = kstDate.getUTCHours();
            const ampm = hours >= 12 ? '오후' : '오전';
            hours = hours % 12 || 12;
            const mm = String(kstDate.getUTCMinutes()).padStart(2, '0');
            const ss = String(kstDate.getUTCSeconds()).padStart(2, '0');
            const dateStr = `${y}. ${m}. ${d} ${ampm} ${hours}:${mm}:${ss}`;

            const newRow: Record<string, any> = {};
            // Updated helper to be case-insensitive and partial match for better robustness
            const getColNamePost = (possibleNames: string[], defaultIdx: number) => {
                const found = h.find(header =>
                    possibleNames.some(name => header.toLowerCase().includes(name.toLowerCase()))
                );
                return found || h[defaultIdx];
            };

            const nameHeader = getColNamePost(['이름', 'PartnerName', '성함'], 0);
            const pwdHeader = getColNamePost(['비밀번호', 'Password'], 1);
            const bankHeader = getColNamePost(['은행', 'BankName', '은행명'], 2);
            const accHeader = getColNamePost(['계좌번호', 'Account', '계좌'], 3);
            const typeHeader = getColNamePost(['유형', 'Type', '영업구분'], 4);
            const dateHeader = getColNamePost(['등록일', 'CreatedDate', '생성일'], 6);
            const statusHeader = getColNamePost(['상태', 'Status'], 7);

            if (nameHeader) newRow[nameHeader] = name;
            if (pwdHeader) newRow[pwdHeader] = '';
            if (bankHeader) newRow[bankHeader] = '';
            if (accHeader) newRow[accHeader] = '';
            if (typeHeader) newRow[typeHeader] = type || '외부파트너';
            if (dateHeader) newRow[dateHeader] = dateStr;
            if (statusHeader) newRow[statusHeader] = 'Active';

            await sheet.addRow(newRow);
            return NextResponse.json({ success: true });
        }

        if (action === 'updatePartnerStatus') {
            const { partnerName, status } = body;
            const sheet = doc.sheetsByTitle['Partners'];
            await sheet.loadHeaderRow();
            const h = sheet.headerValues;
            const rows = await sheet.getRows();

            // Find partner by name (Index 0)
            const pRow = rows.find(r => r.get(h[0]) === partnerName);

            if (pRow) {
                // Status is usually Index 7 based on our previous logic
                // "Active" or "Expired" / "제외"
                const statusHeader = h[7] || '상태';
                pRow.set(statusHeader, status);
                await pRow.save();
                return NextResponse.json({ success: true });
            }
            return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
        }

        if (action === 'deletePartner') {
            const { partnerName } = body;
            const sheet = doc.sheetsByTitle['Partners'];
            await sheet.loadHeaderRow();
            const h = sheet.headerValues;
            const rows = await sheet.getRows();

            const pRow = rows.find(r => r.get(h[0]) === partnerName);
            if (pRow) {
                await pRow.delete();
                return NextResponse.json({ success: true });
            }
            return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}


