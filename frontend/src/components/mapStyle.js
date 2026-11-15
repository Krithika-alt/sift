// Basemap: OpenFreeMap vector tiles (free, no key, no limits) in a Voyager-like paper style.
// Blue water, green parks, cream streets, no labels: our paper scraps are the only labels.
// (CARTO's Voyager raster tiles now answer "API KEY REQUIRED", so they can't be used without a key.)

export const TILE_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'

const C = {
  land: '#F6F1E7',
  park: '#D2E4B0',
  wood: '#C7DDA2',
  water: '#A8CBEA',
  building: '#ECE4D5',
  minor: '#FFFDF7',
  minorCase: '#E3D7C3',
  major: '#FFF4D6',
  majorCase: '#E2CFA6',
  highway: '#FBE2A4',
  highwayCase: '#DDBD7E',
  rail: '#D9CDB9',
  path: '#E6DBC7',
}

// Line widths grow with zoom (12 to 17).
const w = (z12, z14, z17) => ['interpolate', ['exponential', 1.6], ['zoom'], 12, z12, 14, z14, 17, z17]
const cls = (...c) => ['match', ['get', 'class'], c, true, false]

const road = (id, classes, color, casing, widths) => [
  {
    id: `${id}-case`,
    type: 'line',
    source: 'ofm',
    'source-layer': 'transportation',
    filter: ['all', cls(...classes), ['!=', ['get', 'brunnel'], 'tunnel']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': casing, 'line-width': w(...widths.map((x) => x + 1.2)) },
  },
  {
    id,
    type: 'line',
    source: 'ofm',
    'source-layer': 'transportation',
    filter: ['all', cls(...classes), ['!=', ['get', 'brunnel'], 'tunnel']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': color, 'line-width': w(...widths) },
  },
]

export const MAP_STYLE = {
  version: 8,
  sources: {
    ofm: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
  },
  layers: [
    { id: 'land', type: 'background', paint: { 'background-color': C.land } },
    {
      id: 'wood',
      type: 'fill',
      source: 'ofm',
      'source-layer': 'landcover',
      filter: cls('wood', 'forest', 'grass', 'wetland'),
      paint: { 'fill-color': C.wood, 'fill-opacity': 0.8 },
    },
    {
      id: 'green-landuse',
      type: 'fill',
      source: 'ofm',
      'source-layer': 'landuse',
      filter: cls('cemetery', 'pitch', 'stadium', 'playground', 'garden'),
      paint: { 'fill-color': C.park, 'fill-opacity': 0.8 },
    },
    { id: 'park', type: 'fill', source: 'ofm', 'source-layer': 'park', paint: { 'fill-color': C.park } },
    { id: 'water', type: 'fill', source: 'ofm', 'source-layer': 'water', paint: { 'fill-color': C.water } },
    {
      id: 'waterway',
      type: 'line',
      source: 'ofm',
      'source-layer': 'waterway',
      paint: { 'line-color': C.water, 'line-width': w(0.6, 1.2, 3) },
    },
    {
      id: 'building',
      type: 'fill',
      source: 'ofm',
      'source-layer': 'building',
      minzoom: 14,
      paint: { 'fill-color': C.building, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, 1] },
    },
    {
      id: 'path',
      type: 'line',
      source: 'ofm',
      'source-layer': 'transportation',
      minzoom: 14,
      filter: cls('path', 'track'),
      paint: { 'line-color': C.path, 'line-width': w(0.4, 0.8, 2), 'line-dasharray': [2, 1.5] },
    },
    {
      id: 'rail',
      type: 'line',
      source: 'ofm',
      'source-layer': 'transportation',
      filter: cls('rail', 'transit'),
      paint: { 'line-color': C.rail, 'line-width': w(0.6, 1, 2) },
    },
    ...road('minor', ['minor', 'service'], C.minor, C.minorCase, [0.4, 1.6, 9]),
    ...road('major', ['primary', 'secondary', 'tertiary'], C.major, C.majorCase, [0.9, 2.6, 13]),
    ...road('highway', ['motorway', 'trunk'], C.highway, C.highwayCase, [1.2, 3.2, 15]),
  ],
}
