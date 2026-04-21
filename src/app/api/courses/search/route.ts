import { NextRequest, NextResponse } from 'next/server';
import type { CourseRecord } from '@/types/course';

type NominatimItem = {
  osm_type?: string;
  osm_id?: number;
  place_id?: number;
  display_name?: string;
  lat?: string;
  lon?: string;
  type?: string;
  class?: string;
  name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    county?: string;
    state?: string;
    country_code?: string;
  };
};

function normalizeName(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function buildViewbox(lat: number, lon: number) {
  const delta = 1.25;
  const left = lon - delta;
  const right = lon + delta;
  const top = lat + delta;
  const bottom = lat - delta;
  return `${left},${top},${right},${bottom}`;
}

function itemToCourse(item: NominatimItem): CourseRecord | null {
  const displayName = item.display_name ?? '';
  const primaryName = normalizeName(displayName.split(',')[0] ?? item.name ?? 'Golf Course');
  const lowerDisplay = displayName.toLowerCase();
  const isGolf =
    lowerDisplay.includes('golf') ||
    item.type === 'golf_course' ||
    item.class === 'leisure';

  if (!isGolf) return null;

  return {
    id: `osm-${item.osm_type ?? 'node'}-${item.osm_id ?? item.place_id ?? primaryName}`,
    name: primaryName,
    city:
      item.address?.city ??
      item.address?.town ??
      item.address?.village ??
      item.address?.hamlet ??
      item.address?.county ??
      '',
    state: item.address?.state ?? '',
    latitude: item.lat ? Number(item.lat) : undefined,
    longitude: item.lon ? Number(item.lon) : undefined,
    holes: [],
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim() ?? '';
  const lat = Number(searchParams.get('lat') ?? '');
  const lon = Number(searchParams.get('lon') ?? '');
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lon);
  const limit = Math.min(20, Math.max(1, Number(searchParams.get('limit') ?? '12') || 12));

  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    limit: String(limit),
    countrycodes: 'us',
  });

  if (query) {
    params.set('q', `${query} golf course`);
  } else {
    params.set('q', 'golf course');
  }

  if (hasLocation) {
    params.set('viewbox', buildViewbox(lat, lon));
  }

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'TripleDownApp/1.0',
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return NextResponse.json({ courses: [] }, { status: 200 });
    }

    const items = (await response.json()) as NominatimItem[];
    const seen = new Set<string>();
    const courses = items
      .map(itemToCourse)
      .filter((item): item is CourseRecord => Boolean(item))
      .filter((course) => {
        const key = `${course.name}|${course.city}|${course.state}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, limit);

    return NextResponse.json({ courses });
  } catch {
    return NextResponse.json({ courses: [] }, { status: 200 });
  }
}
