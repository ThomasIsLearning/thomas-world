import { createTerritoryLayer } from '../../layers/territory/index.js';
/** Thomas' territory layer; data is a private file on the host, never in git. */
export function createApplicationTerritory(options) {
  return createTerritoryLayer(options);
}
