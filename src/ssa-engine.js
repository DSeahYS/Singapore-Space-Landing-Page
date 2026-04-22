/**
 * SSA Engine
 * Simulated conjunction screening
 */

import { getPropagatedState } from './orbit-propagator';
import { SATS } from './celestrak-client';

let debrisObjects = [];

export function initSSAEngine() {
  // Generate mock debris clustered near NEqO orbits
  for (let i = 0; i < 50; i++) {
    debrisObjects.push({
      id: `DEB-${1000 + i}`,
      latOffset: (Math.random() - 0.5) * 20, // Distributed near equator
      lonOffset: Math.random() * 360,
      altOffset: (Math.random() - 0.5) * 100, // Near ~550km
      speed: (Math.random() - 0.5) * 0.1 // relative drift
    });
  }
}

export function computeConjunctions() {
  const alerts = [];
  const now = new Date();
  
  // Very simplistic proximity check against our real simulated NEqO sats
  const teleos2State = getPropagatedState('teleos2', now);
  const neusarState = getPropagatedState('neusar', now);
  
  if (teleos2State) {
    alerts.push({
      sat: 'TeLEOS-2',
      obj: 'COSMOS 2251 DEB',
      tca: '14:32 UTC',
      missDistance: (Math.random() * 500 + 400).toFixed(0) + ' m',
      pc: (Math.random() * 2).toFixed(1) + '×10⁻⁴',
      critical: true
    });
  }
  
  if (neusarState) {
    alerts.push({
      sat: 'NeuSAR',
      obj: 'SL-8 R/B',
      tca: '19:15 UTC',
      missDistance: (Math.random() * 2 + 1).toFixed(1) + ' km',
      pc: (Math.random() * 5).toFixed(1) + '×10⁻⁶',
      critical: false
    });
  }
  
  return alerts;
}

export function updateRadarDots(container) {
  if (!container) return;
  const dots = container.querySelectorAll('.radar-dot');
  
  // Simulate rotation
  const time = Date.now() / 10000;
  
  dots.forEach((dot, index) => {
    // Base radius and angle
    let radius = parseInt(dot.dataset.r);
    let angle = parseFloat(dot.dataset.a);
    
    if (isNaN(radius)) {
      radius = 10 + Math.random() * 38;
      angle = Math.random() * Math.PI * 2;
      dot.dataset.r = radius;
      dot.dataset.a = angle;
    }
    
    // Debris rotate slowly
    angle += (index > 5 ? 0.05 : 0.1);
    dot.dataset.a = angle;
    
    const x = 50 + Math.cos(angle) * radius;
    const y = 50 + Math.sin(angle) * radius;
    
    dot.style.left = `${x}%`;
    dot.style.top = `${y}%`;
  });
}
