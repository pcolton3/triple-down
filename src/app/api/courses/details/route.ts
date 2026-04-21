import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') ?? '';

  // Remote search results do not yet have detailed hole-by-hole data here.
  // Returning null lets the client keep the selected search result values
  // instead of replacing them with a placeholder object.
  if (id.startsWith('osm-')) {
    return NextResponse.json({ course: null }, { status: 200 });
  }

  return NextResponse.json({ course: null }, { status: 200 });
}
