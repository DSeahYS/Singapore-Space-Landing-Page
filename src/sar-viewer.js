/**
 * SAR Viewer
 * Simulates the Earth observation mode toggle with basic Leaflet/OSM map
 */

let mode = 'optical'; // 'optical' or 'sar'

export function initSarViewer() {
  console.log("SAR Viewer logic initialized.");
  // Given we are avoiding multiple Cesium viewers for performance, 
  // we will handle the SAR viewer with CSS overrides and animated elements
  // inside index.html for a lightweight implementation.
  
  // The logic for UI toggles is already partly in main.js
}

export function toggleSarMode(newMode) {
  mode = newMode;
  const viewerInner = document.querySelector('.sar-viewer-inner');
  const scanLines = document.querySelector('.scan-lines');
  
  if (!viewerInner) return;
  
  if (mode === 'sar') {
    // Apply SAR styling
    viewerInner.style.filter = 'grayscale(100%) contrast(150%) brightness(80%)';
    if(scanLines) scanLines.style.opacity = '1';
  } else {
    // Optical styling
    viewerInner.style.filter = 'none';
    if(scanLines) scanLines.style.opacity = '0.3';
  }
}

export function activateAIFusion(active) {
  const viewerInner = document.querySelector('.sar-viewer-inner');
  if (!viewerInner) return;
  
  // Clear old targets
  viewerInner.querySelectorAll('.ai-target').forEach(el => el.remove());
  
  if (active) {
    // Add pulsing Neon Coral targets
    const target1 = createTargetBox(30, 40, 'Vessel — Cargo');
    const target2 = createTargetBox(60, 70, 'Vessel — Dark');
    const target3 = createTargetBox(75, 20, 'Oil Anomaly');
    
    viewerInner.appendChild(target1);
    viewerInner.appendChild(target2);
    viewerInner.appendChild(target3);
  }
}

function createTargetBox(topPercent, leftPercent, label) {
  const box = document.createElement('div');
  box.className = 'ai-target';
  box.style.position = 'absolute';
  box.style.top = `${topPercent}%`;
  box.style.left = `${leftPercent}%`;
  box.style.width = '40px';
  box.style.height = '40px';
  box.style.border = '2px solid var(--neon-coral)';
  box.style.boxShadow = '0 0 10px rgba(255,107,107,0.5), inset 0 0 10px rgba(255,107,107,0.3)';
  box.style.transform = 'translate(-50%, -50%)';
  box.style.transition = 'all 0.3s ease';
  box.style.animation = 'pulseTarget 2s infinite';
  
  const lbl = document.createElement('div');
  lbl.textContent = label;
  lbl.style.position = 'absolute';
  lbl.style.top = '-20px';
  lbl.style.left = '0';
  lbl.style.color = 'var(--neon-coral)';
  lbl.style.fontSize = '10px';
  lbl.style.whiteSpace = 'nowrap';
  lbl.style.textShadow = '0 0 4px #000';
  
  box.appendChild(lbl);
  return box;
}
