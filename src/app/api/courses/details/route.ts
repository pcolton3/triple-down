import { NextRequest, NextResponse } from 'next/server';
import type { CourseRecord } from '@/types/course';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') ?? '';

  if (!id.startsWith('osm-')) {
    return NextResponse.json({ course: null }, { status: 200 });
  }

  const course: CourseRecord = {
    id,
    name: 'Selected Course',
    city: '',
    state: '',
    holes: [],
  };

  return NextResponse.json({ course }, { status: 200 });
}
