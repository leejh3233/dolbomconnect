import { NextResponse } from 'next/server';
import { getSpreadsheet } from '@/lib/google-sheets';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const name = searchParams.get('name');
        if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });

        const doc = await getSpreadsheet();
        const sheet = doc.sheetsByTitle['ShortLinks'];
        await sheet.loadHeaderRow();
        const h = sheet.headerValues;
        const rows = await sheet.getRows();

        console.log(`[Links GET] Loading links for ${name}. Sheet headers:`, h);

        // Use host header for dynamic domain
        const host = request.headers.get('host');
        const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
        const baseUrl = `${protocol}://${host}`;

        const links = rows
            .filter(r => String(r.get(h[1])).trim() === String(name).trim()) // Index 1: 이름
            .map(r => ({
                sid: r.get(h[0]), // Index 0: SID
                source: r.get(h[2]), // Index 2: 유입경로
                url: `${baseUrl}/?sid=${r.get(h[0])}`
            }));

        return NextResponse.json(links);
    } catch (error: any) {
        console.error('[Links GET] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { name, password, source } = await request.json();
        const doc = await getSpreadsheet();

        const partnersSheet = doc.sheetsByTitle['Partners'];
        await partnersSheet.loadHeaderRow();
        const ph = partnersSheet.headerValues;
        const partnerRows = await partnersSheet.getRows();

        const partner = partnerRows.find(r => String(r.get(ph[0])).trim() === String(name).trim());

        if (!partner || String(partner.get(ph[1])).trim() !== String(password).trim()) {
            return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
        }

        const sheet = doc.sheetsByTitle['ShortLinks'];
        await sheet.loadHeaderRow();
        const h = sheet.headerValues;
        const rows = await sheet.getRows();

        // Check for existing
        const existing = rows.find(r =>
            String(r.get(h[1])).trim() === String(name).trim() &&
            String(r.get(h[2])).trim() === String(source).trim()
        );

        // Use host header for dynamic domain
        const host = request.headers.get('host');
        const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
        const baseUrl = `${protocol}://${host}`;

        if (existing) {
            return NextResponse.json({ url: `${baseUrl}/?sid=${existing.get(h[0])}` });
        }

        const sid = Math.random().toString(36).substring(2, 8).toUpperCase();

        const newRow: Record<string, any> = {};
        if (h[0]) newRow[h[0]] = sid;
        if (h[1]) newRow[h[1]] = name;
        if (h[2]) newRow[h[2]] = source;

        await sheet.addRow(newRow);

        return NextResponse.json({ url: `${baseUrl}/?sid=${sid}` });
    } catch (error: any) {
        console.error('[Links POST] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sid = searchParams.get('sid');
        if (!sid) return NextResponse.json({ error: 'Missing sid' }, { status: 400 });

        const doc = await getSpreadsheet();
        const sheet = doc.sheetsByTitle['ShortLinks'];
        await sheet.loadHeaderRow();
        const h = sheet.headerValues;
        const rows = await sheet.getRows();

        const rowToDelete = rows.find(r => String(r.get(h[0])).trim().toUpperCase() === String(sid).trim().toUpperCase());
        if (rowToDelete) {
            await rowToDelete.delete();
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    } catch (error: any) {
        console.error('[Links DELETE] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

