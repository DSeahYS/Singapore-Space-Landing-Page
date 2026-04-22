import { Viewer, Cartesian3, Color, Ion, Entity, PolylineGlowMaterialProperty, Math as CesiumMath, Cartesian2, ScreenSpaceEventHandler, ScreenSpaceEventType, defined } from 'cesium';
import { getPropagatedState, getFullOrbitPath } from './orbit-propagator';
import { SATS } from './celestrak-client';

let viewer;
let satelliteEntities = {};
let orbitPaths = {};

export async function initCesiumGlobe(containerId) {
  // Set Ion Token from Vite env
  Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN;

  viewer = new Viewer(containerId, {
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,
    navigationInstructionsInitiallyVisible: false,
    scene3DOnly: true,
    creditContainer: document.createElement('div'), // Hide credits temporarily to reposition
  });

  // Apply Tactile Glass styling
  viewer.scene.backgroundColor = Color.fromCssColorString('#121313'); // Space Black
  viewer.scene.globe.baseColor = Color.fromCssColorString('#191970'); // Midnight Blue
  
  // Customise globe material/imagery to look minimal and dark if no imagery is loaded,
  // or set the atmosphere subtly
  viewer.scene.skyAtmosphere.hueShift = -0.1;
  viewer.scene.skyAtmosphere.saturationShift = -0.5;
  viewer.scene.skyAtmosphere.brightnessShift = -0.1;
  
  viewer.scene.globe.enableLighting = true; // Enables day/night shading

  // Disable default double-click action
  viewer.screenSpaceEventHandler.removeInputAction(
    CesiumMath.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
  );

  // Focus initially on Singapore
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(103.8198, 1.3521, 15000000), // ~15,000km altitude
    duration: 0
  });

  // Create entities for all satellites
  Object.keys(SATS).forEach(key => {
    initSatelliteEntity(key);
  });

  // Setup click handler
  setupClickHandler();

  return viewer;
}

function initSatelliteEntity(key) {
  // 1. Plot the orbit path
  const pathNodes = getFullOrbitPath(key, 180);
  if (pathNodes.length > 0) {
    const positions = pathNodes.map(pos => 
      Cartesian3.fromDegrees(pos.longitude, pos.latitude, pos.altitude)
    );

    orbitPaths[key] = viewer.entities.add({
      name: `${key}-path`,
      polyline: {
        positions: positions,
        width: 1, // thin by default
        material: new PolylineGlowMaterialProperty({
          glowPower: 0.1,
          taperPower: 0.1,
          color: Color.fromCssColorString('#F7E7CE').withAlpha(0.2), // Champagne dim
        }),
        show: true // Always on now
      }
    });
  }

  // 2. Create the satellite position entity
  const initialState = getPropagatedState(key);
  if (initialState) {
    satelliteEntities[key] = viewer.entities.add({
      name: key,
      position: Cartesian3.fromDegrees(
        initialState.longitude,
        initialState.latitude,
        initialState.altitude * 1000
      ),
      point: {
        pixelSize: 8,
        color: Color.fromCssColorString('#4ADE80'), // Neon green for active, others grey later
        outlineColor: Color.fromCssColorString('#ffffff'),
        outlineWidth: 2,
        show: true
      },
      label: {
        text: key.toUpperCase(),
        font: '12px Inter, sans-serif',
        fillColor: Color.fromCssColorString('#ECEFF1'), // Mist Gray
        style: 0, // FILL
        pixelOffset: new Cartesian2(0, -20),
        showBackground: true,
        backgroundColor: Color.fromCssColorString('#121313').withAlpha(0.7),
        show: false
      }
    });
  }
}

export function updateSatellitePositions(bgKeys = []) {
  if (!viewer) return;

  const now = new Date();
  
  // Update main sats
  Object.keys(SATS).forEach(key => {
    const state = getPropagatedState(key, now);
    const entity = satelliteEntities[key];
    
    if (state && entity) {
      entity.position = Cartesian3.fromDegrees(
        state.longitude,
        state.latitude,
        state.altitude * 1000
      );
    }
  });

  // Update background sats
  bgKeys.forEach(key => {
    const state = getPropagatedState(key, now);
    const entity = satelliteEntities[key];
    if (state && entity) {
      entity.position = Cartesian3.fromDegrees(
        state.longitude,
        state.latitude,
        state.altitude * 1000
      );
    }
  });
}

export function toggleActiveSatellite(key) {
  if (!viewer) return;

  // Dim/Hide others, Highlight active
  Object.keys(SATS).forEach(k => {
    const ent = satelliteEntities[k];
    const path = orbitPaths[k];
    const isActive = (k === key);

    if (ent) {
      ent.point.color = isActive 
        ? Color.fromCssColorString('#4ADE80') // green
        : Color.fromCssColorString('#ECEFF1').withAlpha(0.4); // dimmed gray
      
      ent.point.pixelSize = isActive ? 10 : 5;
      ent.label.show = isActive;
    }
    
    if (path) {
      // Highlight path
      path.polyline.width = isActive ? 3 : 1;
      path.polyline.material.color = isActive 
        ? Color.fromCssColorString('#F7E7CE').withAlpha(0.8)
        : Color.fromCssColorString('#F7E7CE').withAlpha(0.2);
      path.polyline.material.glowPower = isActive ? 0.3 : 0.05;
    }
  });

  // Smooth fly to the active satellite's current position (zoomed out slightly)
  const ent = satelliteEntities[key];
  if (ent && ent.position) {
    // Current position
    const pos = ent.position.getValue(viewer.clock.currentTime);
    if (pos) {
      // Calculate a position shifted out to maintain a ~7,000 km viewing distance
      const cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(pos);
      cartographic.height += 7000000;
      
      viewer.camera.flyTo({
        destination: viewer.scene.globe.ellipsoid.cartographicToCartesian(cartographic),
        duration: 2.0
      });
    }
  }
}

export function initBackgroundSatellites(keys) {
  if (!viewer) return;
  keys.forEach(key => {
    const initialState = getPropagatedState(key);
    if (initialState) {
      satelliteEntities[key] = viewer.entities.add({
        name: key,
        position: Cartesian3.fromDegrees(
          initialState.longitude,
          initialState.latitude,
          initialState.altitude * 1000
        ),
        point: {
          pixelSize: 3,
          color: Color.fromCssColorString('#ffffff').withAlpha(0.4),
          show: true
        }
      });
    }
  });
}

function setupClickHandler() {
  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((click) => {
    const pickedObject = viewer.scene.pick(click.position);
    if (defined(pickedObject) && pickedObject.id) {
      const entityName = pickedObject.id.name;
      // If it's one of our main satellites, dispatch event
      if (Object.keys(SATS).includes(entityName)) {
        window.dispatchEvent(new CustomEvent('satelliteClicked', { detail: entityName }));
      }
    }
  }, ScreenSpaceEventType.LEFT_CLICK);
}

// Collision alert visuals
let collisionLine = null;
let debrisEntity = null;

export function drawCollisionAlert(satKey, debrisCoord) {
  if (!viewer) return;
  clearCollisionAlert();

  const satEnt = satelliteEntities[satKey];
  if (!satEnt) return;

  // Add flashing debris object
  debrisEntity = viewer.entities.add({
    position: Cartesian3.fromDegrees(debrisCoord.lon, debrisCoord.lat, debrisCoord.alt),
    point: {
      pixelSize: 12,
      color: Color.fromCssColorString('#FF6B6B'), // Neon Coral
      outlineColor: Color.WHITE,
      outlineWidth: 2
    }
  });

  // Draw connecting line
  collisionLine = viewer.entities.add({
    polyline: {
      positions: [satEnt.position.getValue(viewer.clock.currentTime), debrisEntity.position.getValue(viewer.clock.currentTime)],
      width: 2,
      material: new PolylineGlowMaterialProperty({
        glowPower: 0.5,
        color: Color.fromCssColorString('#FF6B6B')
      })
    }
  });
}

export function clearCollisionAlert() {
  if (collisionLine) { viewer.entities.remove(collisionLine); collisionLine = null; }
  if (debrisEntity) { viewer.entities.remove(debrisEntity); debrisEntity = null; }
}
