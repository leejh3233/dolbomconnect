
import { NextResponse } from 'next/server';
import { getSpreadsheet } from '@/lib/google-sheets';

export async function POST(request: Request) {
    try {
        const { name, oldPassword, newPassword } = await request.json();

        if (!name || !oldPassword || !newPassword) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        if (newPassword.length !== 4 || isNaN(Number(newPassword))) {
            return NextResponse.json({ error: 'New password must be 4 digits' }, { status: 400 });
        }

        const doc = await getSpreadsheet();
        const partnersSheet = doc.sheetsByTitle['Partners'];
        await partnersSheet.loadHeaderRow();
        const ph = partnersSheet.headerValues;
        const rows = await partnersSheet.getRows();

        // Find Partner
        // 0: Name, 1: Password (hidden usually, but we need to check it)
        // Adjust indices dependent on your sheet structure.
        // Based on previous reads: 
        // Index 0: 이름, Index 1: 비밀번호, Index 5: 전화번호(maybe)

        // Let's rely on finding by name column (Index 0)

        const partnerRow = rows.find(r => r.get(ph[0]) === name);

        if (!partnerRow) {
            return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
        }

        const currentPwd = partnerRow.get(ph[1]); // Index 1 is password

        // Verify Old Password
        if (String(currentPwd) !== String(oldPassword)) {
            return NextResponse.json({ error: '기존 비밀번호가 일치하지 않습니다.' }, { status: 400 });
        }

        // Update to New Password
        partnerRow.set(ph[1], String(newPassword));
        await partnerRow.save();

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Password change error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
