import { NextRequest, NextResponse } from 'next/server';
import type { CourseHole, CourseRecord } from '@/types/course';

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  tags?: Record<string, string>;
};

function numberFromTag(value: string | undefined) {
  if (!value) return null;
  const match = value.match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parFromTags(tags: Record<string, string>) {
  const parsed =
    numberFromTag(tags.par) ??
    numberFromTag(tags['par:men']) ??
    numberFromTag(tags['par:male']) ??
    numberFromTag(tags['par:white']) ??
    numberFromTag(tags['par:blue']);
  if (parsed === 3 || parsed === 4 || parsed === 5) return parsed;
  return null;
}

function handicapFromTags(tags: Record<string, string>, holeNumber: number) {
  const parsed =
    numberFromTag(tags.handicap) ??
    numberFromTag(tags['handicap:men']) ??
    numberFromTag(tags['handicap:male']) ??
    numberFromTag(tags['handicap:white']) ??
    numberFromTag(tags['handicap:blue']);
  if (parsed != null && parsed >= 1 && parsed <= 18) return parsed;
  return holeNumber;
}

function elementsToHoles(elements: OverpassElement[]) {
  const byHole = new Map<number, CourseHole>();

  elements.forEach((element) => {
    const tags = element.tags ?? {};
    const holeNumber = numberFromTag(tags.ref ?? tags.name ?? tags.hole);
    const par = parFromTags(tags);
    if (!holeNumber || holeNumber < 1 || holeNumber > 18 || !par) return;

    byHole.set(holeNumber, {
      holeNumber,
      par,
      handicapIndex: handicapFromTags(tags, holeNumber),
    });
  });

  return [...byHole.values()].sort((a, b) => a.holeNumber - b.holeNumber);
}

async function fetchOsmHoles(lat: number, lon: number) {
  const query = `
    [out:json][timeout:12];
    (
      way["golf"="hole"](around:2500,${lat},${lon});
      relation["golf"="hole"](around:2500,${lat},${lon});
    );
    out tags;
  `;

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'User-Agent': 'TripleTrack/1.0',
    },
    body: new URLSearchParams({ data: query }).toString(),
    next: { revalidate: 60 * 60 * 24 * 30 },
  });

  if (!response.ok) return [];
  const data = (await response.json()) as { elements?: OverpassElement[] };
  return elementsToHoles(data.elements ?? []);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') ?? '';
  const name = searchParams.get('name') ?? '';
  const city = searchParams.get('city') ?? '';
  const state = searchParams.get('state') ?? '';
  const lat = Number(searchParams.get('lat') ?? '');
  const lon = Number(searchParams.get('lon') ?? '');

  if (id.startsWith('osm-') && Number.isFinite(lat) && Number.isFinite(lon)) {
    try {
      const holes = await fetchOsmHoles(lat, lon);
      const course: CourseRecord = {
        id,
        name,
        city,
        state,
        latitude: lat,
        longitude: lon,
        holes,
      };
      return NextResponse.json({ course }, { status: 200 });
    } catch {
      return NextResponse.json({ course: null }, { status: 200 });
    }
  }

  return NextResponse.json({ course: null }, { status: 200 });
}
