/* ================================================================
   SINGAPORE SPACE — MAIN JAVASCRIPT
   Scroll-driven satellite animation, interactions, and effects
   ================================================================ */

import { initPropagator } from './src/orbit-propagator';
import { initCesiumGlobe, toggleActiveSatellite, updateSatellitePositions } from './src/cesium-globe';
import { initSarViewer, toggleSarMode, activateAIFusion } from './src/sar-viewer';
import { initSSAEngine, updateRadarDots } from './src/ssa-engine';
import { executeSandboxQuery } from './src/celestrak-client';

// ===== CONFIGURATION =====
const FRAME_COUNT = 240;
const FRAME_PATH = '/frames/ezgif-frame-';
const FRAME_EXT = '.jpg';

// Satellite telemetry data for toggle switching
const SATELLITE_DATA = {
  teleos2: { name: 'TeLEOS-2', type: 'PolSAR', alt: '570', vel: '7.6', inc: '10', passes: '14' },
  teleos1: { name: 'TeLEOS-1', type: 'Optical EO', alt: '580', vel: '7.6', inc: '10', passes: '12' },
  dseo:    { name: 'DS-EO', type: 'Multispectral', alt: '570', vel: '7.6', inc: '10', passes: '6' },
  neusar:  { name: 'NeuSAR', type: 'SAR Micro', alt: '550', vel: '7.6', inc: '10', passes: '12' },
  dssar:   { name: 'DS-SAR', type: 'SAR', alt: '530', vel: '7.6', inc: '5', passes: '14' },
};

// ===== STAR PARTICLES =====
function createStars() {
  const container = document.getElementById('stars');
  if (!container) return;
  const count = Math.min(200, Math.floor(window.innerWidth * 0.12));

  for (let i = 0; i < count; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;
    star.style.setProperty('--duration', `${3 + Math.random() * 6}s`);
    star.style.setProperty('--delay', `${Math.random() * 5}s`);
    star.style.setProperty('--min-opacity', `${0.05 + Math.random() * 0.15}`);
    star.style.setProperty('--max-opacity', `${0.3 + Math.random() * 0.5}`);
    if (Math.random() > 0.85) {
      star.style.width = '2px';
      star.style.height = '2px';
      star.style.boxShadow = '0 0 4px rgba(247, 231, 206, 0.3)';
    }
    container.appendChild(star);
  }
}

// ===== SCROLL-DRIVEN SATELLITE ANIMATION =====
class SatelliteAnimator {
  constructor() {
    this.canvas = document.getElementById('satellite-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.images = new Array(FRAME_COUNT);
    this.loaded = 0;
    this.currentFrame = 0;
    this.heroContent = document.getElementById('hero-content');
    this.scrollIndicator = document.getElementById('scroll-indicator');
    this.heroStats = document.getElementById('hero-stats');
    this.componentLabels = document.getElementById('component-labels');

    if (this.canvas) {
      this.preloadFrames();
      this.setupScrollListener();
    }
  }

  getFramePath(index) {
    const num = String(index + 1).padStart(3, '0');
    return `${FRAME_PATH}${num}${FRAME_EXT}`;
  }

  preloadFrames() {
    // Load first frame immediately
    const firstImg = new Image();
    firstImg.onload = () => {
      this.images[0] = firstImg;
      this.loaded++;
      this.drawFrame(0);
    };
    firstImg.src = this.getFramePath(0);

    // Load rest in batches
    const batchSize = 10;
    let batchIndex = 1;

    const loadBatch = () => {
      const start = batchIndex;
      const end = Math.min(start + batchSize, FRAME_COUNT);

      for (let i = start; i < end; i++) {
        const img = new Image();
        const idx = i;
        img.onload = () => {
          this.images[idx] = img;
          this.loaded++;
        };
        img.src = this.getFramePath(i);
      }

      batchIndex = end;
      if (batchIndex < FRAME_COUNT) {
        requestAnimationFrame(loadBatch);
      }
    };

    requestAnimationFrame(loadBatch);
  }

  drawFrame(index) {
    if (!this.ctx || !this.images[index]) return;
    const img = this.images[index];
    const canvas = this.canvas;

    // Clear canvas
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate fit dimensions
    const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;

    // Draw with white-removal via compositing
    // First draw image
    this.ctx.drawImage(img, x, y, w, h);

    // Create a subtle vignette overlay to blend white edges into dark background
    const gradient = this.ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, Math.min(w, h) * 0.25,
      canvas.width / 2, canvas.height / 2, Math.max(w, h) * 0.55
    );
    gradient.addColorStop(0, 'rgba(18, 19, 19, 0)');
    gradient.addColorStop(0.7, 'rgba(18, 19, 19, 0.6)');
    gradient.addColorStop(1, 'rgba(18, 19, 19, 1)');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.currentFrame = index;
  }

  setupScrollListener() {
    const heroSection = document.querySelector('.hero-scroll-container');
    if (!heroSection) return;

    let ticking = false;

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          this.handleScroll(heroSection);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
  }

  handleScroll(heroSection) {
    const rect = heroSection.getBoundingClientRect();
    const scrollHeight = heroSection.offsetHeight - window.innerHeight;
    const scrolled = -rect.top;
    const progress = Math.max(0, Math.min(1, scrolled / scrollHeight));

    // Map progress to frame index
    const frameIndex = Math.min(FRAME_COUNT - 1, Math.floor(progress * FRAME_COUNT));

    // Draw frame if available
    if (frameIndex !== this.currentFrame && this.images[frameIndex]) {
      this.drawFrame(frameIndex);
    }

    // Fade hero text after 5% scroll
    if (this.heroContent) {
      if (progress > 0.05) {
        this.heroContent.classList.add('faded');
      } else {
        this.heroContent.classList.remove('faded');
      }
    }

    // Hide scroll indicator
    if (this.scrollIndicator) {
      this.scrollIndicator.style.opacity = progress > 0.02 ? '0' : '1';
    }

    // Show stats bar at the end
    if (this.heroStats) {
      if (progress > 0.85) {
        this.heroStats.style.opacity = '1';
        this.heroStats.style.transform = 'translateY(0)';
      } else {
        this.heroStats.style.opacity = '0';
        this.heroStats.style.transform = 'translateY(20px)';
      }
    }

    // Show component labels during middle of animation
    if (this.componentLabels) {
      if (progress > 0.3 && progress < 0.9) {
        this.componentLabels.classList.add('visible');
        const labels = this.componentLabels.querySelectorAll('.comp-label');
        labels.forEach((label, i) => {
          const labelThreshold = 0.35 + (i * 0.07);
          if (progress > labelThreshold) {
            label.classList.add('show');
          } else {
            label.classList.remove('show');
          }
        });
      } else {
        this.componentLabels.classList.remove('visible');
      }
    }
  }
}

// ===== NAVIGATION SCROLL EFFECT =====
function setupNav() {
  const nav = document.getElementById('main-nav');
  if (!nav) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        if (window.scrollY > 50) {
          nav.classList.add('scrolled');
        } else {
          nav.classList.remove('scrolled');
        }
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

// ===== REVEAL ON SCROLL =====
function setupRevealAnimations() {
  const reveals = document.querySelectorAll('.reveal');
  if (!reveals.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
  );

  reveals.forEach((el) => observer.observe(el));
}

// ===== SATELLITE TOGGLES =====
function setupSatelliteToggles() {
  const toggles = document.querySelectorAll('.sat-toggle');
  const telemetryItems = document.querySelectorAll('.telemetry-item');

  toggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      toggles.forEach((t) => t.classList.remove('active'));
      toggle.classList.add('active');

      const satKey = toggle.dataset.sat;
      const data = SATELLITE_DATA[satKey];
      if (!data) return;

      // Toggle globe camera
      toggleActiveSatellite(satKey);

      // Update telemetry panel title
      const panelTitle = document.querySelector('.info-panel:nth-child(2) h4');
      if (panelTitle) {
        panelTitle.textContent = `Live Telemetry — ${data.name}`;
      }

      // Update values with animation
      const values = ['alt', 'vel', 'inc', 'passes'];
      telemetryItems.forEach((item, i) => {
        const valEl = item.querySelector('.value');
        if (valEl && values[i]) {
          item.style.transform = 'scale(0.95)';
          item.style.opacity = '0.5';
          setTimeout(() => {
            const unitEl = valEl.querySelector('.unit');
            const unitText = unitEl ? unitEl.outerHTML : '';
            valEl.innerHTML = data[values[i]] + unitText;
            item.style.transform = 'scale(1)';
            item.style.opacity = '1';
          }, 150);
          item.style.transition = 'transform 0.15s ease, opacity 0.15s ease';
        }
      });
    });
  });
}

// ===== SAR MODE SWITCH =====
function setupSarModes() {
  const opticalBtn = document.getElementById('mode-optical');
  const sarBtn = document.getElementById('mode-sar');
  const viewerInner = document.querySelector('.sar-viewer-inner');

  if (!opticalBtn || !sarBtn || !viewerInner) return;

  opticalBtn.addEventListener('click', () => {
    opticalBtn.classList.add('active');
    sarBtn.classList.remove('active');
    const info = viewerInner.querySelector('p');
    if (info) info.textContent = 'STRAITS OF MALACCA — Optical Feed';
    const subInfo = viewerInner.querySelectorAll('p')[1];
    if (subInfo) subInfo.textContent = '1.0m GSD · TeLEOS-1 · Pass 0742 UTC';
    
    toggleSarMode('optical');
  });

  sarBtn.addEventListener('click', () => {
    sarBtn.classList.add('active');
    opticalBtn.classList.remove('active');
    const info = viewerInner.querySelector('p');
    if (info) info.textContent = 'STRAITS OF MALACCA — SAR Feed';
    const subInfo = viewerInner.querySelectorAll('p')[1];
    if (subInfo) subInfo.textContent = '1.0m SAR · TeLEOS-2 PolSAR · All-Weather';
    
    toggleSarMode('sar');
  });
}

// ===== AI FUSION BUTTON =====
function setupAiFusion() {
  const btn = document.getElementById('ai-fusion-btn');
  if (!btn) return;

  let active = false;
  btn.addEventListener('click', () => {
    active = !active;
    activateAIFusion(active);
    
    if (active) {
      btn.textContent = '✓ AI Fusion Active';
      btn.style.background = 'linear-gradient(135deg, #4ADE80, #16A34A)';
      btn.style.boxShadow = '0 0 30px rgba(74, 222, 128, 0.2)';

      // Animate detection items
      document.querySelectorAll('.detection-item').forEach((item, i) => {
        setTimeout(() => {
          item.style.transform = 'translateX(0)';
          item.style.opacity = '1';
          item.style.borderLeftColor = 'var(--neon-coral)';
          item.style.boxShadow = '0 0 12px rgba(255, 107, 107, 0.1)';
        }, i * 200);
      });
    } else {
      btn.textContent = '⚡ Activate AI Fusion';
      btn.style.background = '';
      btn.style.boxShadow = '';

      document.querySelectorAll('.detection-item').forEach((item) => {
        item.style.boxShadow = '';
      });
    }
  });
}

// ===== RADAR DOTS =====
function createRadarDots() {
  const radar = document.getElementById('radar-display');
  if (!radar) return;

  // Random debris/satellite dots
  for (let i = 0; i < 80; i++) {
    const dot = document.createElement('div');
    dot.className = 'radar-dot';

    // Random position within circular area
    const angle = Math.random() * Math.PI * 2;
    const radius = 10 + Math.random() * 38; // percentage from center
    const x = 50 + Math.cos(angle) * radius;
    const y = 50 + Math.sin(angle) * radius;

    dot.style.left = `${x}%`;
    dot.style.top = `${y}%`;
    dot.style.animationDelay = `${Math.random() * 4}s`;

    // Some are Singapore satellites
    if (i < 5) {
      dot.classList.add('sg-sat');
      const sgAngle = (i / 5) * Math.PI * 2 + Math.random() * 0.3;
      const sgRadius = 15 + Math.random() * 15;
      dot.style.left = `${50 + Math.cos(sgAngle) * sgRadius}%`;
      dot.style.top = `${50 + Math.sin(sgAngle) * sgRadius}%`;
    }

    // Some are debris
    if (i > 60) {
      dot.classList.add('debris');
    }

    radar.appendChild(dot);
  }
}

// ===== API SANDBOX EXECUTE =====
function setupApiSandbox() {
  const executeBtn = document.getElementById('execute-btn');
  const responseBody = document.getElementById('response-body');
  const responseStatus = document.getElementById('response-status');

  if (!executeBtn || !responseBody || !responseStatus) return;

  executeBtn.addEventListener('click', async () => {
    // Animate button press
    executeBtn.style.transform = 'translateY(2px)';
    setTimeout(() => { executeBtn.style.transform = ''; }, 150);

    // Show loading state
    responseStatus.textContent = 'Processing...';
    responseStatus.className = 'response-status pending';
    responseBody.innerHTML = '<pre style="opacity:0.6;">⏳ Querying CelesTrak API...</pre>';

    try {
      // Execute the real query
      const data = await executeSandboxQuery({ GROUP: 'weather', FORMAT: 'JSON' });
      
      responseStatus.textContent = '200 OK';
      responseStatus.className = 'response-status success';
      
      // Formatting JSON for display
      const displayData = data.slice(0, 3); // Just show first 3 for brevity
      
      responseBody.innerHTML = `<pre>${JSON.stringify(displayData, null, 2)}
      
// ... truncated for sandbox view
// Total Results: ${data.length}
</pre>`;
    } catch (e) {
      responseStatus.textContent = 'Error';
      responseStatus.className = 'response-status error';
      responseBody.innerHTML = `<pre style="color:var(--neon-coral);">❌ Failed to fetch: ${e.message}</pre>`;
    }
  });
}

// ===== TIMELINE ANIMATION =====
function setupTimeline() {
  const items = document.querySelectorAll('.timeline-item');
  const progressBar = document.getElementById('timeline-progress');
  if (!items.length || !progressBar) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Activate all items up to this one
          const index = Array.from(items).indexOf(entry.target);
          for (let i = 0; i <= index; i++) {
            setTimeout(() => {
              items[i].classList.add('active');
            }, i * 200);
          }
          // Update progress bar
          const progress = ((index + 1) / items.length) * 100;
          progressBar.style.width = `${progress}%`;
        }
      });
    },
    { threshold: 0.3 }
  );

  items.forEach((item) => observer.observe(item));
}

// ===== SOURCE LIST INTERACTIONS =====
function setupSourceList() {
  const sources = document.querySelectorAll('.source-list li');
  sources.forEach((source) => {
    source.addEventListener('click', () => {
      sources.forEach((s) => s.classList.remove('active'));
      source.classList.add('active');
    });
  });
}

// ===== SMOOTH SCROLL FOR NAV LINKS =====
function setupSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        const navHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height'));
        const top = target.offsetTop - navHeight;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
}

// ===== TABS LOGIC =====
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      
      // Update buttons
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update panes
      tabPanes.forEach(pane => {
        pane.classList.remove('active');
        if (pane.id === targetId) {
          pane.classList.add('active');
          // Dispatch a resize event so Cesium/maps can redraw properly
          setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
        }
      });
    });
  });
}

// ===== INITIALISE EVERYTHING =====
function init() {
  createStars();
  setupNav();
  new SatelliteAnimator();
  setupRevealAnimations();
  setupTabs();
  setupSatelliteToggles();
  setupSarModes();
  setupAiFusion();
  createRadarDots();
  setupApiSandbox();
  setupTimeline();
  setupSourceList();
  setupSmoothScroll();
  
  // Phase 2 Live Integrations
  initPropagator().then((success) => {
    if (success) {
      initCesiumGlobe('cesiumContainer');
      
      setInterval(() => {
        updateSatellitePositions();
        
        // Update radar dots for SSA based loosely on clock
        updateRadarDots(document.getElementById('radar-display'));
      }, 1000);
      
      // Auto select TeLEOS-2
      setTimeout(() => toggleActiveSatellite('teleos2'), 2000);
    }
  });

  initSarViewer();
  initSSAEngine();
}

// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
