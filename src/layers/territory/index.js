import * as Cesium from 'cesium';

/**
 * Territory — Thomas' sales territory and the team's, as a quick-glance layer.
 *
 * Reads one private JSON file served from `public/territory/territory.json`
 * (git-ignored; produced on the Pi by Pi5-Home-Node/tools/territory-export.py).
 * With no file the layer simply reports "no data" and draws nothing, so the
 * public repository ships the feature without the data.
 *
 * Draws: hubs (named stops with a drive-time label), towns as small discs
 * coloured by owner and sized by score, and the territory outlines. On first
 * enable the camera flies to the whole territory so radar + traffic can be
 * read over it in one look.
 */
const DATA_URL = '/territory/territory.json';
const OWNER_COLORS = Object.freeze({
  personal: Cesium.Color.fromCssColorString('#f2c14e'),
  team: Cesium.Color.fromCssColorString('#4fd1c5'),
  other: Cesium.Color.fromCssColorString('#9aa5b5'),
});

export function territoryBounds(data) {
  const pts = [];
  for (const h of data?.hubs || []) pts.push([h.lon, h.lat]);
  for (const t of data?.towns || []) pts.push([t.lon, t.lat]);
  if (!pts.length) return null;
  let west = Infinity,
    south = Infinity,
    east = -Infinity,
    north = -Infinity;
  for (const [lon, lat] of pts) {
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return { west, south, east, north };
}

function ringsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates.map((r) => r);
  if (geometry.type === 'MultiPolygon')
    return geometry.coordinates.flatMap((p) => p);
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString') return geometry.coordinates;
  return [];
}

export function createTerritoryLayer({ dataUrl = DATA_URL, fetchImpl } = {}) {
  let _viewer = null;
  let _dataSource = null;
  let _enabled = false;
  let _loaded = false;
  let _flown = false;
  let _count = 0;
  let _lastUpdate = null;
  let _lastError = null;
  let _request = null;
  const doFetch = fetchImpl || ((...args) => globalThis.fetch(...args));

  const flyToTerritory = (data) => {
    const b = territoryBounds(data);
    if (!b || !_viewer || _flown) return;
    _flown = true;
    const pad = 0.35;
    _viewer.camera.flyTo({
      destination: Cesium.Rectangle.fromDegrees(
        b.west - pad,
        b.south - pad,
        b.east + pad,
        b.north + pad,
      ),
      duration: 2.2,
    });
  };

  const layer = {
    id: 'territory',
    name: 'Territory',
    icon: '🗺️',
    source: 'Thomas (private file)',
    updateInterval: 6 * 3600 * 1000,

    init(viewer) {
      if (_viewer) throw new Error('Territory layer is already initialized');
      _viewer = viewer;
      _dataSource = new Cesium.CustomDataSource('territory');
      _dataSource.show = false;
      viewer.dataSources.add(_dataSource);
    },

    enable() {
      _enabled = true;
      if (_dataSource) _dataSource.show = true;
      if (!_loaded) this.update(_viewer);
    },

    disable() {
      _request?.abort();
      _request = null;
      _enabled = false;
      if (_dataSource) _dataSource.show = false;
    },

    async update() {
      if (!_enabled || !_dataSource) return false;
      _request?.abort();
      const request = new AbortController();
      _request = request;
      try {
        const res = await doFetch(dataUrl, {
          signal: request.signal,
          cache: 'no-cache',
        });
        if (!res.ok)
          throw new Error(
            res.status === 404
              ? 'No territory file on this box'
              : `HTTP ${res.status}`,
          );
        const data = await res.json();
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;

        const entities = [];
        for (const [owner, geometries] of Object.entries(data.outlines || {})) {
          const color = OWNER_COLORS[owner] || OWNER_COLORS.other;
          for (const geometry of geometries) {
            for (const ring of ringsOf(geometry)) {
              entities.push(
                new Cesium.Entity({
                  polyline: {
                    positions: Cesium.Cartesian3.fromDegreesArray(ring.flat()),
                    width: 3,
                    material: color.withAlpha(0.85),
                    clampToGround: true,
                  },
                }),
              );
            }
          }
        }
        for (const t of data.towns || []) {
          const color = OWNER_COLORS[t.owner] || OWNER_COLORS.other;
          const score = Number(t.score) || 0;
          entities.push(
            new Cesium.Entity({
              id: `territory:town:${t.id}`,
              position: Cesium.Cartesian3.fromDegrees(t.lon, t.lat),
              point: {
                pixelSize: 4 + Math.round(score / 12),
                color: color.withAlpha(0.75),
                outlineColor: Cesium.Color.BLACK.withAlpha(0.5),
                outlineWidth: 1,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                scaleByDistance: new Cesium.NearFarScalar(2e4, 1.4, 6e5, 0.5),
              },
              description: `<b>${t.name}, ${t.state}</b><br>${t.owner} · score ${score}${t.top ? `<br>${t.top}` : ''}`,
              properties: { owner: t.owner, score, name: t.name },
            }),
          );
        }
        for (const h of data.hubs || []) {
          const color = OWNER_COLORS[h.owner] || OWNER_COLORS.other;
          const drive = h.drive_min ? ` · ${Math.round(h.drive_min)} min` : '';
          entities.push(
            new Cesium.Entity({
              id: `territory:hub:${h.id}`,
              position: Cesium.Cartesian3.fromDegrees(h.lon, h.lat),
              point: {
                pixelSize: 10,
                color,
                outlineColor: Cesium.Color.BLACK.withAlpha(0.7),
                outlineWidth: 2,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
              },
              label: {
                text: `${h.name}${drive}`,
                font: '13px sans-serif',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 3,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                pixelOffset: new Cesium.Cartesian2(0, -16),
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                translucencyByDistance: new Cesium.NearFarScalar(
                  1e5,
                  1,
                  9e5,
                  0.15,
                ),
              },
              description: `<b>${h.name}</b><br>${h.corridor || ''}${drive}<br>${h.notes || ''}`,
              properties: {
                owner: h.owner,
                drive_min: h.drive_min,
                name: h.name,
              },
            }),
          );
        }
        _dataSource.entities.suspendEvents();
        _dataSource.entities.removeAll();
        for (const e of entities) _dataSource.entities.add(e);
        _dataSource.entities.resumeEvents();
        _count = (data.hubs || []).length + (data.towns || []).length;
        _lastUpdate = Date.now();
        _lastError = null;
        _loaded = true;
        flyToTerritory(data);
        _viewer?.scene?.requestRender?.();
        return true;
      } catch (e) {
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;
        _lastError = e?.message || 'Territory file unavailable';
        return false;
      } finally {
        if (_request === request) _request = null;
      }
    },

    destroy(viewer = _viewer) {
      _request?.abort();
      _request = null;
      _enabled = false;
      if (_dataSource && viewer) viewer.dataSources.remove(_dataSource, true);
      _dataSource = null;
      _viewer = null;
      _loaded = false;
      _flown = false;
      _count = 0;
      _lastUpdate = null;
      _lastError = null;
    },

    getStats() {
      return { count: _count, lastUpdate: _lastUpdate, error: _lastError };
    },
  };
  return layer;
}
