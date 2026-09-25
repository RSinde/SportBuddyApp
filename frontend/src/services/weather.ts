export type WarningLevel = 'yellow' | 'orange' | 'red';

export type WarningInfo = {
  level: WarningLevel;
  type: string;
  text: string;
};

export type DailyForecast = {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipitationProbability: number;
  windDirection: string;
  windSpeedClass: number;
  uvIndex: number | null;
  warning: WarningInfo | null;
};

type IpmaLocation = {
  globalIdLocal: number;
  name: string;
  latitude: number;
  longitude: number;
  areaAviso: string;
};

// Lista de locais do IPMA (capitais de distrito + ilhas), com coordenadas e o
// código de área de aviso (idAreaAviso) — vem de
// https://api.ipma.pt/open-data/distrits-islands.json. É estável, por isso
// fica fixa aqui em vez de pedida à API a cada carregamento.
const IPMA_LOCATIONS: IpmaLocation[] = [
  { globalIdLocal: 1010500, name: 'Aveiro', latitude: 40.6413, longitude: -8.6535, areaAviso: 'AVR' },
  { globalIdLocal: 1020500, name: 'Beja', latitude: 38.02, longitude: -7.87, areaAviso: 'BJA' },
  { globalIdLocal: 1030300, name: 'Braga', latitude: 41.5475, longitude: -8.4227, areaAviso: 'BRG' },
  { globalIdLocal: 1030800, name: 'Guimarães', latitude: 41.4434, longitude: -8.2938, areaAviso: 'BRG' },
  { globalIdLocal: 1040200, name: 'Bragança', latitude: 41.8076, longitude: -6.7606, areaAviso: 'BGC' },
  { globalIdLocal: 1050200, name: 'Castelo Branco', latitude: 39.8217, longitude: -7.4957, areaAviso: 'CBO' },
  { globalIdLocal: 1060300, name: 'Coimbra', latitude: 40.2081, longitude: -8.4194, areaAviso: 'CBR' },
  { globalIdLocal: 1070500, name: 'Évora', latitude: 38.5701, longitude: -7.9104, areaAviso: 'EVR' },
  { globalIdLocal: 1080500, name: 'Faro', latitude: 37.0146, longitude: -7.9331, areaAviso: 'FAR' },
  { globalIdLocal: 1081505, name: 'Sagres', latitude: 37.0168, longitude: -8.9403, areaAviso: 'FAR' },
  { globalIdLocal: 1081100, name: 'Portimão', latitude: 37.15, longitude: -8.52, areaAviso: 'FAR' },
  { globalIdLocal: 1080800, name: 'Loulé', latitude: 37.1397, longitude: -8.0202, areaAviso: 'FAR' },
  { globalIdLocal: 1090700, name: 'Guarda', latitude: 40.5379, longitude: -7.2647, areaAviso: 'GDA' },
  { globalIdLocal: 1090821, name: 'Penhas Douradas', latitude: 40.4075, longitude: -7.5665, areaAviso: 'GDA' },
  { globalIdLocal: 1100900, name: 'Leiria', latitude: 39.7473, longitude: -8.8069, areaAviso: 'LRA' },
  { globalIdLocal: 1110600, name: 'Lisboa', latitude: 38.766, longitude: -9.1286, areaAviso: 'LSB' },
  { globalIdLocal: 1121400, name: 'Portalegre', latitude: 39.29, longitude: -7.42, areaAviso: 'PTG' },
  { globalIdLocal: 1131200, name: 'Porto', latitude: 41.158, longitude: -8.6294, areaAviso: 'PTO' },
  { globalIdLocal: 1141600, name: 'Santarém', latitude: 39.2, longitude: -8.74, areaAviso: 'STM' },
  { globalIdLocal: 1151200, name: 'Setúbal', latitude: 38.5246, longitude: -8.8856, areaAviso: 'STB' },
  { globalIdLocal: 1151300, name: 'Sines', latitude: 37.956, longitude: -8.8643, areaAviso: 'STB' },
  { globalIdLocal: 1160900, name: 'Viana do Castelo', latitude: 41.6952, longitude: -8.8365, areaAviso: 'VCT' },
  { globalIdLocal: 1171400, name: 'Vila Real', latitude: 41.3053, longitude: -7.744, areaAviso: 'VRL' },
  { globalIdLocal: 1182300, name: 'Viseu', latitude: 40.6585, longitude: -7.912, areaAviso: 'VIS' },
  { globalIdLocal: 2310300, name: 'Funchal', latitude: 32.6485, longitude: -16.9084, areaAviso: 'MCS' },
  { globalIdLocal: 2320100, name: 'Porto Santo', latitude: 33.07, longitude: -16.34, areaAviso: 'MPS' },
  { globalIdLocal: 3410100, name: 'Vila do Porto', latitude: 36.9563, longitude: -25.1409, areaAviso: 'AOR' },
  { globalIdLocal: 3420300, name: 'Ponta Delgada', latitude: 37.7415, longitude: -25.6677, areaAviso: 'AOR' },
  { globalIdLocal: 3430100, name: 'Angra do Heroísmo', latitude: 38.67, longitude: -27.22, areaAviso: 'ACE' },
  { globalIdLocal: 3440100, name: 'Santa Cruz da Graciosa', latitude: 39.08, longitude: -28.0, areaAviso: 'ACE' },
  { globalIdLocal: 3450200, name: 'Velas', latitude: 38.6842, longitude: -28.2133, areaAviso: 'ACE' },
  { globalIdLocal: 3460200, name: 'Madalena', latitude: 38.5325, longitude: -28.5237, areaAviso: 'ACE' },
  { globalIdLocal: 3470100, name: 'Horta', latitude: 38.5363, longitude: -28.6315, areaAviso: 'ACE' },
  { globalIdLocal: 3480200, name: 'Santa Cruz das Flores', latitude: 39.45, longitude: -31.13, areaAviso: 'AOC' },
  { globalIdLocal: 3490100, name: 'Vila do Corvo', latitude: 39.67, longitude: -31.12, areaAviso: 'AOC' },
];

const WARNING_RANK: Record<string, number> = { green: 0, yellow: 1, orange: 2, red: 3 };

function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

export function findNearestIpmaLocation(latitude: number, longitude: number): IpmaLocation {
  return IPMA_LOCATIONS.reduce((nearest, candidate) =>
    distanceKm({ latitude, longitude }, candidate) < distanceKm({ latitude, longitude }, nearest)
      ? candidate
      : nearest
  );
}

// O endpoint de UV só publica valores para as ~28 estações de referência
// (uma por distrito/ilha), não para todas as cidades em IPMA_LOCATIONS. Se o
// local escolhido não tiver dados de UV, usa a estação de referência da
// mesma área de aviso e, na falta dessa, a estação com UV mais próxima.
function findUvReferenceLocation(location: IpmaLocation, availableIds: Set<number>): IpmaLocation {
  if (availableIds.has(location.globalIdLocal)) return location;

  const sameArea = IPMA_LOCATIONS.find(
    (l) => l.areaAviso === location.areaAviso && availableIds.has(l.globalIdLocal)
  );
  if (sameArea) return sameArea;

  const withUv = IPMA_LOCATIONS.filter((l) => availableIds.has(l.globalIdLocal));
  return withUv.reduce((nearest, candidate) =>
    distanceKm(location, candidate) < distanceKm(location, nearest) ? candidate : nearest
  );
}

async function fetchJson(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Não foi possível obter a meteorologia');
  }
  return response.json();
}

// Devolve, por data (yyyy-mm-dd), o índice UV desse local — quando há mais
// que um período nesse dia, fica o de maior valor.
function buildUvByDate(uvData: { globalIdLocal: number; data: string; iUv: string }[], globalIdLocal: number) {
  const byDate = new Map<string, number>();
  for (const entry of uvData) {
    if (entry.globalIdLocal !== globalIdLocal) continue;
    const value = Number(entry.iUv);
    const current = byDate.get(entry.data);
    if (current === undefined || value > current) byDate.set(entry.data, value);
  }
  return byDate;
}

// Devolve, por data (yyyy-mm-dd), o aviso mais grave ativo nessa área nesse
// dia — ignora "green" (sem aviso relevante).
function buildWarningByDate(
  warnings: {
    idAreaAviso: string;
    startTime: string;
    endTime: string;
    awarenessLevelID: string;
    awarenessTypeName: string;
    text: string;
  }[],
  areaAviso: string,
  dates: string[]
) {
  const byDate = new Map<string, WarningInfo>();

  for (const date of dates) {
    let best: (typeof warnings)[number] | null = null;

    for (const warning of warnings) {
      if (warning.idAreaAviso !== areaAviso) continue;
      const startDate = warning.startTime.slice(0, 10);
      const endDate = warning.endTime.slice(0, 10);
      if (date < startDate || date > endDate) continue;
      if (warning.awarenessLevelID === 'green') continue;

      if (!best || WARNING_RANK[warning.awarenessLevelID] > WARNING_RANK[best.awarenessLevelID]) {
        best = warning;
      }
    }

    if (best) {
      byDate.set(date, {
        level: best.awarenessLevelID as WarningLevel,
        type: best.awarenessTypeName,
        text: best.text,
      });
    }
  }

  return byDate;
}

export async function getWeeklyForecast(
  latitude: number,
  longitude: number
): Promise<{ location: string; forecast: DailyForecast[] }> {
  const location = findNearestIpmaLocation(latitude, longitude);

  const [daily, uvData, warnings] = await Promise.all([
    fetchJson(`https://api.ipma.pt/open-data/forecast/meteorology/cities/daily/${location.globalIdLocal}.json`),
    fetchJson('https://api.ipma.pt/open-data/forecast/meteorology/uv/uv.json').catch(() => []),
    fetchJson('https://api.ipma.pt/open-data/forecast/warnings/warnings_www.json').catch(() => []),
  ]);

  const days: {
    forecastDate: string;
    idWeatherType: number;
    tMax: string;
    tMin: string;
    precipitaProb: string;
    predWindDir: string;
    classWindSpeed: number;
  }[] = daily.data;

  const availableUvIds = new Set<number>(
    (uvData as { globalIdLocal: number }[]).map((entry) => entry.globalIdLocal)
  );
  const uvLocation = findUvReferenceLocation(location, availableUvIds);
  const uvByDate = buildUvByDate(uvData, uvLocation.globalIdLocal);
  const warningByDate = buildWarningByDate(warnings, location.areaAviso, days.map((d) => d.forecastDate));

  const forecast: DailyForecast[] = days.map((day) => ({
    date: day.forecastDate,
    weatherCode: day.idWeatherType,
    tempMax: Number(day.tMax),
    tempMin: Number(day.tMin),
    precipitationProbability: Number(day.precipitaProb),
    windDirection: day.predWindDir,
    windSpeedClass: day.classWindSpeed,
    uvIndex: uvByDate.get(day.forecastDate) ?? null,
    warning: warningByDate.get(day.forecastDate) ?? null,
  }));

  return { location: location.name, forecast };
}
