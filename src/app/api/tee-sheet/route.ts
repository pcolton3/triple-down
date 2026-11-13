import { NextRequest, NextResponse } from 'next/server';
import { SheetError, fetchTeeSheets } from '@/lib/tee-sheets/fetch-sheet';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** GET /api/tee-sheet?url=…&date=YYYY-MM-DD&players=8 → that day's open tee times from the course's booking system. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url') ?? '';
  const date = request.nextUrl.searchParams.get('date') ?? '';
  const players = Math.min(40, Math.max(1, Math.round(Number(request.nextUrl.searchParams.get('players')) || 4)));
  if (!url || url.length > 600) return NextResponse.json({ error: 'Missing link.' }, { status: 400 });
  try {
    const sheets = await fetchTeeSheets(url, date, players);
    // Tee sheets change minute to minute, but a short shared cache keeps repeat taps off the course's servers.
    return NextResponse.json({ sheets }, { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60' } });
  } catch (error) {
    if (error instanceof SheetError) return NextResponse.json({ error: error.message }, { status: 422 });
    console.error('tee-sheet error', error);
    return NextResponse.json({ error: "Couldn't reach the course's tee sheet. Try again, or use the booking link." }, { status: 502 });
  }
}
