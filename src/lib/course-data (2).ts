
import type { CourseRecord } from '@/types/course';

function buildHoles(pars: Array<3 | 4 | 5>, handicapIndexes: number[]): CourseRecord['holes'] {
  return pars.map((par, index) => ({
    holeNumber: index + 1,
    par,
    handicapIndex: handicapIndexes[index],
  }));
}

const standardIndexes = [11, 7, 17, 1, 13, 5, 15, 9, 3, 10, 18, 2, 14, 6, 16, 8, 4, 12];
const desertIndexes = [9, 3, 17, 5, 1, 13, 15, 7, 11, 10, 18, 2, 6, 12, 16, 4, 8, 14];
const championshipIndexes = [13, 7, 17, 3, 1, 9, 15, 11, 5, 12, 18, 2, 6, 10, 16, 4, 8, 14];

const papagoHoles = buildHoles(
  [4,4,3,4,4,5,3,4,4,4,3,5,4,4,3,4,4,5],
  [11, 7, 17, 1, 13, 5, 15, 9, 3, 10, 18, 2, 14, 6, 16, 8, 4, 12]
);

const quinteroHoles = buildHoles(
  [4,4,3,5,4,4,3,4,5,4,3,4,5,4,3,4,4,5],
  [9, 3, 17, 5, 1, 13, 15, 7, 11, 10, 18, 2, 6, 12, 16, 4, 8, 14]
);

const troonPinnacleHoles = buildHoles(
  [4,5,3,4,4,5,3,4,4,4,3,5,4,4,3,4,4,5],
  [13, 7, 17, 3, 1, 9, 15, 11, 5, 12, 18, 2, 6, 10, 16, 4, 8, 14]
);

const troonMonumentHoles = buildHoles(
  [4,4,3,5,4,4,3,4,5,4,3,5,4,4,3,4,4,5],
  desertIndexes
);

const tpcScottsdaleStadiumHoles = buildHoles(
  [4,4,3,4,4,5,3,4,4,4,4,3,5,4,3,5,4,4],
  championshipIndexes
);

const tpcScottsdaleChampionsHoles = buildHoles(
  [4,5,3,4,4,5,3,4,4,4,3,5,4,4,3,4,4,5],
  standardIndexes
);

const grayhawkRaptorHoles = buildHoles(
  [4,5,3,4,4,5,3,4,4,4,3,5,4,4,3,4,4,5],
  championshipIndexes
);

const grayhawkTalonHoles = buildHoles(
  [4,4,3,5,4,4,3,5,4,4,3,5,4,4,3,4,4,5],
  desertIndexes
);

const wekopaChollaHoles = buildHoles(
  [4,4,3,5,4,4,3,4,5,4,3,5,4,4,3,4,4,5],
  standardIndexes
);

const wekopaSaguaroHoles = buildHoles(
  [4,5,3,4,4,5,3,4,4,4,3,5,4,4,3,4,4,5],
  desertIndexes
);

const dinosaurMountainHoles = buildHoles(
  [4,5,3,4,4,5,3,4,4,4,3,5,4,4,3,4,4,5],
  championshipIndexes
);

const superstitionLostGoldHoles = buildHoles(
  [4,4,3,5,4,4,3,5,4,4,3,5,4,4,3,4,4,5],
  standardIndexes
);

const superstitionProspectorHoles = buildHoles(
  [4,5,3,4,4,5,3,4,4,4,3,5,4,4,3,4,4,5],
  desertIndexes
);

const akChinSouthernDunesHoles = buildHoles(
  [4,5,3,4,4,5,3,4,4,4,3,5,4,4,3,4,4,5],
  championshipIndexes
);

const whirlwindCattailHoles = buildHoles(
  [4,5,3,4,4,5,3,4,4,4,3,5,4,4,3,4,4,5],
  standardIndexes
);

const whirlwindDevilsClawHoles = buildHoles(
  [4,4,3,5,4,4,3,4,5,4,3,5,4,4,3,4,4,5],
  desertIndexes
);

const lasSendasHoles = buildHoles(
  [4,4,3,4,4,5,3,4,5,4,3,5,4,4,3,4,4,5],
  standardIndexes
);

const ravenPhoenixHoles = buildHoles(
  [4,5,3,4,4,5,3,4,4,4,3,5,4,4,3,4,4,5],
  desertIndexes
);

const legacyGolfClubHoles = buildHoles(
  [4,4,3,5,4,4,3,4,5,4,3,5,4,4,3,4,4,5],
  championshipIndexes
);

const mountainShadowsHoles = buildHoles(
  [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
  [11, 7, 17, 1, 13, 5, 15, 9, 3, 10, 18, 2, 14, 6, 16, 8, 4, 12]
);

export const courseCatalog: CourseRecord[] = [
  { id: 'papago-golf-club', name: 'Papago Golf Club', city: 'Phoenix', state: 'AZ', latitude: 33.5055, longitude: -111.9938, holes: papagoHoles },
  { id: 'quintero-golf-club', name: 'Quintero Golf Club', city: 'Peoria', state: 'AZ', latitude: 33.8436, longitude: -112.5004, holes: quinteroHoles },
  { id: 'troon-north-pinnacle', name: 'Troon North Golf Club - Pinnacle', city: 'Scottsdale', state: 'AZ', latitude: 33.7568, longitude: -111.8676, holes: troonPinnacleHoles },
  { id: 'troon-north-monument', name: 'Troon North Golf Club - Monument', city: 'Scottsdale', state: 'AZ', latitude: 33.7568, longitude: -111.8676, holes: troonMonumentHoles },
  { id: 'tpc-scottsdale-stadium', name: 'TPC Scottsdale - Stadium Course', city: 'Scottsdale', state: 'AZ', latitude: 33.6415, longitude: -111.9106, holes: tpcScottsdaleStadiumHoles },
  { id: 'tpc-scottsdale-champions', name: 'TPC Scottsdale - Champions Course', city: 'Scottsdale', state: 'AZ', latitude: 33.6415, longitude: -111.9106, holes: tpcScottsdaleChampionsHoles },
  { id: 'grayhawk-raptor', name: 'Grayhawk Golf Club - Raptor', city: 'Scottsdale', state: 'AZ', latitude: 33.6964, longitude: -111.8918, holes: grayhawkRaptorHoles },
  { id: 'grayhawk-talon', name: 'Grayhawk Golf Club - Talon', city: 'Scottsdale', state: 'AZ', latitude: 33.6964, longitude: -111.8918, holes: grayhawkTalonHoles },
  { id: 'wekopa-cholla', name: 'We-Ko-Pa Golf Club - Cholla', city: 'Fort McDowell', state: 'AZ', latitude: 33.6589, longitude: -111.6708, holes: wekopaChollaHoles },
  { id: 'wekopa-saguaro', name: 'We-Ko-Pa Golf Club - Saguaro', city: 'Fort McDowell', state: 'AZ', latitude: 33.6589, longitude: -111.6708, holes: wekopaSaguaroHoles },
  { id: 'dinosaur-mountain', name: 'Gold Canyon Golf Resort - Dinosaur Mountain', city: 'Gold Canyon', state: 'AZ', latitude: 33.3632, longitude: -111.4479, holes: dinosaurMountainHoles },
  { id: 'superstition-lost-gold', name: 'Superstition Mountain - Lost Gold', city: 'Gold Canyon', state: 'AZ', latitude: 33.3820, longitude: -111.4328, holes: superstitionLostGoldHoles },
  { id: 'superstition-prospector', name: 'Superstition Mountain - Prospector', city: 'Gold Canyon', state: 'AZ', latitude: 33.3820, longitude: -111.4328, holes: superstitionProspectorHoles },
  { id: 'ak-chin-southern-dunes', name: 'Ak-Chin Southern Dunes Golf Club', city: 'Maricopa', state: 'AZ', latitude: 33.0397, longitude: -112.0147, holes: akChinSouthernDunesHoles },
  { id: 'whirlwind-cattail', name: 'Whirlwind Golf Club - Cattail', city: 'Chandler', state: 'AZ', latitude: 33.2656, longitude: -111.9698, holes: whirlwindCattailHoles },
  { id: 'whirlwind-devils-claw', name: "Whirlwind Golf Club - Devil's Claw", city: 'Chandler', state: 'AZ', latitude: 33.2656, longitude: -111.9698, holes: whirlwindDevilsClawHoles },
  { id: 'las-sendas', name: 'Las Sendas Golf Club', city: 'Mesa', state: 'AZ', latitude: 33.4718, longitude: -111.6395, holes: lasSendasHoles },
  { id: 'raven-phoenix', name: 'Raven Golf Club Phoenix', city: 'Phoenix', state: 'AZ', latitude: 33.3721, longitude: -112.0260, holes: ravenPhoenixHoles },
  { id: 'legacy-golf-club', name: 'Legacy Golf Club', city: 'Phoenix', state: 'AZ', latitude: 33.3611, longitude: -112.0262, holes: legacyGolfClubHoles },
  { id: 'mountain-shadows', name: 'Mountain Shadows Golf Club', city: 'Paradise Valley', state: 'AZ', latitude: 33.5299, longitude: -111.9584, holes: mountainShadowsHoles },
];
