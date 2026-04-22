import * as satellite from 'satellite.js';
import { fetchConstellationTLEs } from './celestrak-client';

/**
 * Orbit Propagator
 * Handles satellite.js propagation logic
 */

let satelliteRecs = {};

export async function initPropagator() {
  const tleData = await fetchConstellationTLEs();
  
  // Initialize satellite records
  for (const [key, tles] of Object.entries(tleData)) {
    try {
      satelliteRecs[key] = satellite.twoline2satrec(tles[0], tles[1]);
    } catch (err) {
      console.error(`Error initializing satrec for ${key}:`, err);
    }
  }
  
  return Object.keys(satelliteRecs).length > 0;
}

export function getPropagatedState(key, date = new Date()) {
  const satrec = satelliteRecs[key];
  if (!satrec) return null;

  // Propagate to current time
  const positionAndVelocity = satellite.propagate(satrec, date);
  const positionEci = positionAndVelocity.position;
  const velocityEci = positionAndVelocity.velocity;

  if (!positionEci || !velocityEci) return null;

  // Convert to geodetic coordinates
  const gmst = satellite.gstime(date);
  const positionGd = satellite.eciToGeodetic(positionEci, gmst);

  // Compute velocity magnitude (km/s)
  const velocityMagnitude = Math.sqrt(
    velocityEci.x * velocityEci.x +
    velocityEci.y * velocityEci.y +
    velocityEci.z * velocityEci.z
  );

  return {
    longitude: satellite.degreesLong(positionGd.longitude),
    latitude: satellite.degreesLat(positionGd.latitude),
    altitude: positionGd.height, // km
    velocity: velocityMagnitude, // km/s
    inclination: satellite.degreesLat(satrec.inclo), // degrees
    positionCartesian: { // ECEF approximation for Cesium
      x: positionEci.x,
      y: positionEci.y,
      z: positionEci.z
    }
  };
}

export function getFullOrbitPath(key, points = 180) {
  const satrec = satelliteRecs[key];
  if (!satrec) return [];

  // Approximate orbital period in minutes
  // N = mean motion (revs/day). Period = 1440 / N
  const numRevsPerDay = satrec.no * 1440 / (2 * Math.PI);
  const periodMinutes = 1440 / numRevsPerDay;
  
  const path = [];
  const now = new Date();
  const stepMinutes = periodMinutes / points;

  // Calculate forward for one full orbit
  for (let i = 0; i < points; i++) {
    const timeToPropagate = new Date(now.getTime() + i * stepMinutes * 60000);
    const pv = satellite.propagate(satrec, timeToPropagate);
    if (!pv.position) continue;
    
    const gmst = satellite.gstime(timeToPropagate);
    const gd = satellite.eciToGeodetic(pv.position, gmst);
    
    path.push({
      longitude: satellite.degreesLong(gd.longitude),
      latitude: satellite.degreesLat(gd.latitude),
      altitude: gd.height * 1000 // meters for Cesium
    });
  }
  
  return path;
}
