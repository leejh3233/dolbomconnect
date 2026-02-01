import { NextResponse, NextRequest } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export const dynamic = 'force-dynamic';

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function getSpreadsheet() {
    if (!SPREADSHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
        throw new Error('Missing Google Sheet credentials');
    }

    const serviceAccountAuth = new JWT({
        email: CLIENT_EMAIL,
        key: PRIVATE_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    return doc;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const recommender = searchParams.get('recommender');

        const doc = await getSpreadsheet();
        const sheet = doc.sheetsById['0'] || doc.sheetsByIndex[0];

        await sheet.loadHeaderRow();
        const rows = await sheet.getRows();
        const lh = sheet.headerValues;

        if (type === 'partners') {
            // D열(index 3)에서 추천인 목록 추출
            const partnerNames = Array.from(new Set(
                rows
                    .map(row => row.get(lh[3]))
                    .filter(name => name && String(name).trim() !== '')
                    .map(name => String(name).trim())
            )).sort();
            return NextResponse.json({ partners: partnerNames }, { headers: CORS_HEADERS });
        }

        if (type === 'apartments' && recommender) {
            const apartments = rows
                .filter(r => {
                    const rName = String(r.get(lh[3]) || '').trim().toLowerCase();
                    const isBooked = String(r.get(lh[8])).toUpperCase() === 'TRUE';
                    const isCompleted = String(r.get(lh[9])).toUpperCase() === 'TRUE';
                    return rName === recommender.trim().toLowerCase() && isBooked && !isCompleted;
                })
                .map(r => ({
                    aptName: String(r.get(lh[4]) || '').trim(),
                    dong: String(r.get(lh[5]) || '').trim(),
                    contact: String(r.get(lh[6]) || '').trim(),
                    pyeong: String(r.get(lh[7]) || '').trim(),
                    saleAmount: String(r.get(lh[10]) || '').trim(),
                }))
                .filter((item, index, self) =>
                    item.aptName !== '' &&
                    self.findIndex(t => t.aptName === item.aptName) === index
                );
            return NextResponse.json({ apartments }, { headers: CORS_HEADERS });
        }

        return NextResponse.json({
            status: "ok",
            message: "Leads API active",
            timestamp: new Date().toISOString()
        }, { headers: CORS_HEADERS });
    } catch (error: any) {
        console.error('Leads GET error:', error);
        return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
    }
}

export async function POST() {
    return NextResponse.json({ message: "Test POST success" }, {
        headers: {
            'Access-Control-Allow-Origin': '*',
        }
    });
}

export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
    });
}
