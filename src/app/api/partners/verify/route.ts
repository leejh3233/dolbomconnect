import { NextResponse } from 'next/server';
import { getSpreadsheet } from '@/lib/google-sheets';

export async function POST(request: Request) {
    try {
        const { name, password, bank, account } = await request.json();
        const doc = await getSpreadsheet();
        const partnersSheet = doc.sheetsByTitle['Partners'];
        await partnersSheet.loadHeaderRow();
        const ph = partnersSheet.headerValues;
        const rows = await partnersSheet.getRows();


        const inputName = String(name || "").trim();
        const inputPwd = String(password || "").trim();


        for (const r of rows) {
            // Map by index for robustness
            // 0:이름, 1:비밀번호, 2:은행, 3:계좌번호, 4:유형, 7:상태
            const sheetName = String(r.get(ph[0]) || "").trim();
            const sheetPwd = String(r.get(ph[1]) || "").trim();
            const sheetBank = ph[2] ? r.get(ph[2]) : null;
            const sheetAccount = ph[3] ? r.get(ph[3]) : null;
            const sheetType = ph[4] ? r.get(ph[4]) : null;
            const sheetStatus = ph[7] ? r.get(ph[7]) : null;


            if (sheetName === inputName) {
                if (sheetStatus === 'Expired') {
                    return NextResponse.json({ error: '계약이 만료된 계정입니다.' }, { status: 403 });
                }

                const isEmployee = sheetType === '직원';

                if (sheetPwd === "") {
                    if (!inputPwd || inputPwd.length !== 4) {
                        return NextResponse.json({
                            error: '비밀번호 4자리 설정이 필요합니다.',
                            isEmployee,
                            type: sheetType || '외부파트너'
                        }, { status: 400 });
                    }
                    if (!isEmployee && (!bank || !account)) {
                        return NextResponse.json({
                            error: '외부파트너는 정산용 계좌 정보가 필요합니다.',
                            isEmployee,
                            type: sheetType || '외부파트너'
                        }, { status: 400 });
                    }

                    r.set(ph[1], inputPwd);
                    if (ph[2]) r.set(ph[2], bank || '');
                    if (ph[3]) r.set(ph[3], account || '');
                    await r.save();
                    return NextResponse.json({
                        success: true,
                        message: 'SUCCESS',
                        isEmployee,
                        type: sheetType || '외부파트너'
                    });

                } else {
                    if (sheetPwd === inputPwd) {
                        return NextResponse.json({
                            success: true,
                            message: 'LOGGED_IN',
                            isEmployee,
                            type: sheetType || '외부파트너'
                        });
                    }
                    return NextResponse.json({
                        error: '비밀번호가 틀렸습니다.',
                        isEmployee,
                        type: sheetType || '외부파트너'
                    }, { status: 401 });
                }
            }
        }


        return NextResponse.json({ error: '등록되지 않은 사용자입니다. 관리자에게 문의하세요.' }, { status: 404 });
    } catch (error: any) {
        console.error('API Partner Verify error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
