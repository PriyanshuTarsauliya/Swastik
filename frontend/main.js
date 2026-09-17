// Dr. Gunja Gupta — Hyper-Futuristic AI Voice Receptionist Engine
// Enhanced Edition: Shockwaves, Lightning, Particles, Chimes & Thinking

const $ = (id) => document.getElementById(id);
const canvas = $("orbCanvas");

const stageBadgeText = $("stageBadgeText");
const calendarCard = $("calendarCard");
const waCard = $("waCard");
const waText = $("waText");
const slotsContainer = $("slotsContainer");
const speakerTag = $("speakerTag");
const subMain = $("subMain");
const subTrans = $("subTrans");
const callBtn = $("callBtn");
const callBtnText = $("callBtnText");
const callBtnIcon = $("callBtnIcon");
const connLabel = $("connLabel");
const statusDot = $("statusDot");
const waveBars = document.querySelectorAll(".wave-bar");
const liveClock = $("liveClock");
const callTimer = $("callTimer");

// Audio & WebSocket state
let ws = null;
let audioCtx = null;
let workletNode = null;
let micStream = null;
let nextStart = 0;
let activeSources = [];
let speaking = false;
let userRMS = 0;
let isCallActive = false;

// Anti-Glitch Audio Gain & Sinks
let voiceGain = null;
let silentSink = null;
let speechFrameCount = 0;
const BARGE_THRESHOLD = 0.06;

// Call timer state
let callStartTime = 0;
let callTimerInterval = null;

// Thinking state (between user speech end and agent speech start)
let thinkingMode = false;
let lastUserSpeechTime = 0;

function setStage(stageName) {
  stageBadgeText.textContent = stageName.toUpperCase();
}

function setSubtitles(role, text) {
  if (role === "swastik") {
    speakerTag.className = "speaker-tag swastik";
    speakerTag.textContent = "SWASTIK AI";
    thinkingMode = false; // Agent is responding, no longer thinking
  } else {
    speakerTag.className = "speaker-tag patient";
    speakerTag.textContent = "PATIENT";
    lastUserSpeechTime = performance.now();
  }

  // Trigger subtitle fade-in animation
  subMain.classList.remove("fade-in");
  void subMain.offsetWidth; // force reflow
  subMain.classList.add("fade-in");

  subMain.textContent = text;

  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  if (hasDevanagari) {
    subTrans.textContent = "(English translation) " + text;
    subTrans.style.display = "block";
  } else {
    subTrans.style.display = "none";
  }
}

// ------------------------------------------------------------------
// Live Clock & Call Timer
// ------------------------------------------------------------------
function updateClock() {
  if (liveClock) {
    const now = new Date();
    liveClock.textContent = now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }
}
setInterval(updateClock, 1000);
updateClock();

function startCallTimer() {
  callStartTime = Date.now();
  if (callTimer) callTimer.style.display = "inline";
  callTimerInterval = setInterval(() => {
    if (!callTimer) return;
    const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
    const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const ss = String(elapsed % 60).padStart(2, "0");
    callTimer.textContent = `${mm}:${ss}`;
  }, 1000);
}

function stopCallTimer() {
  clearInterval(callTimerInterval);
  callTimerInterval = null;
  if (callTimer) {
    callTimer.textContent = "00:00";
    callTimer.style.display = "none";
  }
}

// ------------------------------------------------------------------
// High-Tech 3D WebGL Engine: Radiant Light Core Spheres, Gyroscopic
// Concentric Rings, Neural Synapses & Quantum Parallax (Three.js)
// ------------------------------------------------------------------
let width = window.innerWidth;
let height = window.innerHeight;
let isMobile = false;
let isTablet = false;

// Backward-compatible coordinate state for UI tracking
let leftOrb = { x: 0, y: 0, baseRadius: 80, radius: 80, shockwaves: [] };
let rightOrb = { x: 0, y: 0, baseRadius: 84, radius: 84, shockwaves: [] };

// 3D Scene, Camera & WebGL Renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
camera.position.set(0, 0, 85);

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(width, height);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;

// Procedural Dot and Glow Sprite Textures (Generated via Offscreen 2D Canvas)
function createDotTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const cctx = c.getContext("2d");
  const g = cctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255, 255, 255, 1.0)");
  g.addColorStop(0.3, "rgba(255, 255, 255, 0.9)");
  g.addColorStop(0.65, "rgba(255, 255, 255, 0.25)");
  g.addColorStop(1, "rgba(255, 255, 255, 0.0)");
  cctx.fillStyle = g;
  cctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function createGlowTexture(isPatient) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const cctx = c.getContext("2d");
  const g = cctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  if (isPatient) {
    g.addColorStop(0, "rgba(255, 245, 210, 0.95)");
    g.addColorStop(0.22, "rgba(245, 166, 35, 0.6)");
    g.addColorStop(0.55, "rgba(217, 119, 6, 0.15)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
  } else {
    g.addColorStop(0, "rgba(220, 255, 255, 0.95)");
    g.addColorStop(0.22, "rgba(20, 200, 178, 0.6)");
    g.addColorStop(0.55, "rgba(13, 148, 136, 0.15)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
  }
  cctx.fillStyle = g;
  cctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

const dotTexture = createDotTexture();
const glowTexturePatient = createGlowTexture(true);
const glowTextureSwastik = createGlowTexture(false);

// Helper: Generate circle points
function createCirclePoints(radius, segments) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(theta) * radius, Math.sin(theta) * radius, 0));
  }
  return pts;
}

// ------------------------------------------------------------------
// GLSL Shaders: Radiant Light Core (Exact Match to voice agent.mp4)
// Pure #FFFFFF Light Core radiating into Amber / Cyan with Fresnel rim
// ------------------------------------------------------------------
const sphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const patientFragmentShader = `
  uniform float uTime;
  uniform float uPulse;
  uniform vec2 uMouse;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    // Dynamic Moving Key Light: Gentle orbital dance + interactive cursor responsiveness
    vec3 lightDir = normalize(vec3(
      -0.42 + sin(uTime * 1.35) * 0.16 + uMouse.x * 0.28,
       0.46 + cos(uTime * 1.10) * 0.14 - uMouse.y * 0.28,
       0.82 + sin(uTime * 0.85) * 0.10
    ));

    // Smooth wrapped diffuse lighting (Key light with orbital drift)
    float nDotL = dot(normal, lightDir);
    float diff = clamp((nDotL + 0.50) / 1.50, 0.0, 1.0);

    // Dynamic Multi-Octave Fluid Light Waves (Living Liquid Motion on Surface)
    float wave1 = sin(normal.x * 4.0 + normal.y * 3.2 + uTime * 1.6);
    float wave2 = cos(normal.y * 4.5 - normal.z * 3.0 + uTime * 1.2);
    float wave3 = sin((normal.x + normal.z) * 5.5 - uTime * 2.0);
    float fluidLight = (wave1 * 0.5 + wave2 * 0.35 + wave3 * 0.15) * 0.038;
    diff = clamp(diff + fluidLight, 0.0, 1.0);

    // Rich Velvet Champagne / Golden Sand Palette (Matching voice agent.mp4)
    vec3 cHighlight = vec3(1.0, 0.98, 0.92); // Pure luminous warm white
    vec3 cSun       = vec3(0.97, 0.86, 0.62); // Radiant champagne gold
    vec3 cAmber     = vec3(0.88, 0.72, 0.42); // Warm rich amber-sand midtone
    vec3 cDark      = vec3(0.66, 0.48, 0.24); // Warm ochre shadow
    vec3 cShadow    = vec3(0.42, 0.28, 0.12); // Deep velvety warm ambient shadow

    vec3 col;
    if (diff > 0.70) {
      float t = (diff - 0.70) / 0.30;
      col = mix(cSun, cHighlight, t);
    } else if (diff > 0.40) {
      float t = (diff - 0.40) / 0.30;
      col = mix(cAmber, cSun, t);
    } else if (diff > 0.15) {
      float t = (diff - 0.15) / 0.25;
      col = mix(cDark, cAmber, t);
    } else {
      float t = diff / 0.15;
      col = mix(cShadow, cDark, t);
    }

    // Secondary subtle fill light from bottom-right for spherical 3D depth
    vec3 fillDir = normalize(vec3(0.50, -0.40, 0.60));
    float fillDiff = clamp((dot(normal, fillDir) + 0.3) / 1.3, 0.0, 1.0) * 0.18;
    col += cAmber * fillDiff;

    // Moving Luminous Inner Core (Focused glowing nucleus from voice agent.mp4)
    vec3 corePos = normalize(vec3(
      -0.16 + sin(uTime * 1.1) * 0.10 + uMouse.x * 0.18,
       0.16 + cos(uTime * 0.9) * 0.08 - uMouse.y * 0.18,
       0.96
    ));
    float coreDist = length(normal - corePos);
    // Tighter, focused radial nucleus falloff (peaks in center, fades smoothly)
    float coreGlow = smoothstep(0.85, 0.0, coreDist);
    // Subtle breathing light caustics inside the core
    float coreRipple = sin(coreDist * 18.0 - uTime * 3.8) * 0.5 + 0.5;
    float coreIntensity = pow(coreGlow, 2.2) * (0.52 + coreRipple * 0.18 + uPulse * 0.45);
    col = mix(col, cHighlight, clamp(coreIntensity, 0.0, 0.92));

    // Silky specular highlight with moving light
    vec3 halfDir = normalize(lightDir + viewDir);
    float nDotH = clamp(dot(normal, halfDir), 0.0, 1.0);
    float spec = pow(nDotH, 18.0 + (1.0 - uPulse) * 8.0);
    col += cHighlight * spec * (0.45 + uPulse * 0.40);

    // Fresnel rim sheen (delicate edge glow)
    float ndv = clamp(dot(normal, viewDir), 0.0, 1.0);
    float rim = pow(1.0 - ndv, 3.0);
    col += vec3(0.98, 0.88, 0.65) * rim * (0.20 + uPulse * 0.20);

    gl_FragColor = vec4(col, 1.0);
  }
`;

const swastikFragmentShader = `
  uniform float uTime;
  uniform float uPulse;
  uniform vec2 uMouse;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    // Dynamic Moving Key Light: Gentle orbital dance + interactive cursor responsiveness
    vec3 lightDir = normalize(vec3(
      -0.42 + sin(uTime * 1.35 + 1.57) * 0.16 + uMouse.x * 0.28,
       0.46 + cos(uTime * 1.10 + 1.57) * 0.14 - uMouse.y * 0.28,
       0.82 + cos(uTime * 0.85) * 0.10
    ));

    // Smooth wrapped diffuse lighting (Key light with orbital drift)
    float nDotL = dot(normal, lightDir);
    float diff = clamp((nDotL + 0.50) / 1.50, 0.0, 1.0);

    // Dynamic Multi-Octave Fluid Light Waves
    float wave1 = sin(normal.x * 4.0 + normal.y * 3.2 + uTime * 1.6 + 2.0);
    float wave2 = cos(normal.y * 4.5 - normal.z * 3.0 + uTime * 1.2 + 1.0);
    float wave3 = sin((normal.x + normal.z) * 5.5 - uTime * 2.0 + 0.5);
    float fluidLight = (wave1 * 0.5 + wave2 * 0.35 + wave3 * 0.15) * 0.038;
    diff = clamp(diff + fluidLight, 0.0, 1.0);

    // Glowing Mint & Oceanic Teal Palette (Matching voice agent.mp4)
    vec3 cHighlight = vec3(0.96, 1.0, 1.0);   // Pure luminous cyan-white
    vec3 cAqua      = vec3(0.68, 0.96, 0.93); // Radiant pastel cyan
    vec3 cTeal      = vec3(0.32, 0.82, 0.76); // Glowing turquoise midtone
    vec3 cDark      = vec3(0.14, 0.58, 0.54); // Deep seafoam teal
    vec3 cShadow    = vec3(0.06, 0.34, 0.32); // Deep oceanic ambient shadow

    vec3 col;
    if (diff > 0.70) {
      float t = (diff - 0.70) / 0.30;
      col = mix(cAqua, cHighlight, t);
    } else if (diff > 0.40) {
      float t = (diff - 0.40) / 0.30;
      col = mix(cTeal, cAqua, t);
    } else if (diff > 0.15) {
      float t = (diff - 0.15) / 0.25;
      col = mix(cDark, cTeal, t);
    } else {
      float t = diff / 0.15;
      col = mix(cShadow, cDark, t);
    }

    // Secondary fill light from bottom-right
    vec3 fillDir = normalize(vec3(0.50, -0.40, 0.60));
    float fillDiff = clamp((dot(normal, fillDir) + 0.3) / 1.3, 0.0, 1.0) * 0.18;
    col += cTeal * fillDiff;

    // Moving Luminous Inner Core (Focused glowing nucleus)
    vec3 corePos = normalize(vec3(
      -0.16 + sin(uTime * 1.1 + 2.0) * 0.10 + uMouse.x * 0.18,
       0.16 + cos(uTime * 0.9 + 2.0) * 0.08 - uMouse.y * 0.18,
       0.96
    ));
    float coreDist = length(normal - corePos);
    float coreGlow = smoothstep(0.85, 0.0, coreDist);
    float coreRipple = sin(coreDist * 18.0 - uTime * 3.8) * 0.5 + 0.5;
    float coreIntensity = pow(coreGlow, 2.2) * (0.52 + coreRipple * 0.18 + uPulse * 0.45);
    col = mix(col, cHighlight, clamp(coreIntensity, 0.0, 0.92));

    // Specular highlight with moving light
    vec3 halfDir = normalize(lightDir + viewDir);
    float nDotH = clamp(dot(normal, halfDir), 0.0, 1.0);
    float spec = pow(nDotH, 18.0 + (1.0 - uPulse) * 8.0);
    col += cHighlight * spec * (0.45 + uPulse * 0.40);

    // Fresnel rim sheen
    float ndv = clamp(dot(normal, viewDir), 0.0, 1.0);
    float rim = pow(1.0 - ndv, 3.0);
    col += vec3(0.65, 0.98, 0.94) * rim * (0.20 + uPulse * 0.20);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ------------------------------------------------------------------
// Smooth 3D Sphere & Acoustic Ripple System (Exact Match to User Reference)
// ------------------------------------------------------------------
function createOrbSystem(isPatient) {
  const group = new THREE.Group();
  const radius = isPatient ? 6.5 : 6.8;
  const rippleColor = isPatient ? 0xF5A623 : 0x14C8B2;
  const dir = isPatient ? 1 : -1;

  // 1. Silky Smooth 3D Illuminated Sphere with Dynamic Light Motion
  const sphereGeo = new THREE.SphereGeometry(radius, 64, 64);
  const shaderMat = new THREE.ShaderMaterial({
    vertexShader: sphereVertexShader,
    fragmentShader: isPatient ? patientFragmentShader : swastikFragmentShader,
    uniforms: {
      uTime: { value: 0.0 },
      uPulse: { value: 0.0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
    },
  });
  const sphereMesh = new THREE.Mesh(sphereGeo, shaderMat);
  group.add(sphereMesh);

  // 2. Luminous Atmospheric Halo Glow Behind Sphere (voice agent.mp4)
  const haloMat = new THREE.SpriteMaterial({
    map: isPatient ? glowTexturePatient : glowTextureSwastik,
    transparent: true,
    blending: THREE.AdditiveBlending,
    opacity: 0.45,
    depthWrite: false,
  });
  const halo = new THREE.Sprite(haloMat);
  halo.position.set(0, 0, -1.2);
  halo.scale.set(radius * 3.6, radius * 3.6, 1);
  group.add(halo);

  // 3. Continuous Propagating Acoustic Ripple Wave Rings (voice agent.mp4)
  const ripples = [];
  const RIPPLE_COUNT = 5;
  const minRippleRadius = radius * 1.15;
  const maxRippleRadius = radius * 2.85;

  for (let i = 0; i < RIPPLE_COUNT; i++) {
    const pts = createCirclePoints(1.0, 64);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: rippleColor,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.LineLoop(geo, mat);
    group.add(line);
    ripples.push({
      line,
      mat,
      phase: i / RIPPLE_COUNT,
      minRadius: minRippleRadius,
      maxRadius: maxRippleRadius,
      baseRadius: radius,
    });
  }

  // 4. Subtle Tilted Gyroscopic Orbit Ring with 1 Floating Telemetry Blip
  const orbitGroup = new THREE.Group();
  orbitGroup.rotation.set(0.35 * dir, 0.22, 0);
  const orbitRadius = radius * 1.55;
  const orbitPts = createCirclePoints(orbitRadius, 64);
  const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPts);
  const orbitMat = new THREE.LineBasicMaterial({
    color: rippleColor,
    transparent: true,
    opacity: 0.15,
    blending: THREE.AdditiveBlending,
  });
  const orbitLine = new THREE.LineLoop(orbitGeo, orbitMat);
  orbitGroup.add(orbitLine);

  // Single micro blip node
  const blipGeo = new THREE.SphereGeometry(0.24, 12, 12);
  const blipMat = new THREE.MeshBasicMaterial({
    color: isPatient ? 0xFFF0A0 : 0x90FFF5,
    transparent: true,
    opacity: 0.85,
  });
  const blipMesh = new THREE.Mesh(blipGeo, blipMat);
  blipMesh.position.set(orbitRadius, 0, 0);
  orbitGroup.add(blipMesh);
  group.add(orbitGroup);

  return {
    group,
    sphereMesh,
    shaderMat,
    halo,
    haloMat,
    ripples,
    orbitGroup,
    blipMesh,
    orbitRadius,
    dir,
    baseRadius: radius,
  };
}

const patientSystem = createOrbSystem(true);
const swastikSystem = createOrbSystem(false);
scene.add(patientSystem.group);
scene.add(swastikSystem.group);

// ------------------------------------------------------------------
// Swastik AI Thinking Mode Orbit Ring
// ------------------------------------------------------------------
const thinkingGroup = new THREE.Group();
thinkingGroup.rotation.set(-0.25, 0.35, 0);
const thinkingNodesCount = 6;
const thinkingNodes = [];
for (let i = 0; i < thinkingNodesCount; i++) {
  const tMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 12, 12),
    new THREE.MeshBasicMaterial({
      color: 0x00FFFF,
      transparent: true,
      opacity: 0.9,
    })
  );
  thinkingGroup.add(tMesh);
  thinkingNodes.push(tMesh);
}
thinkingGroup.visible = false;
swastikSystem.group.add(thinkingGroup);

// ------------------------------------------------------------------
// 3D Neural Synaptic Particle Stream (Helical Bridge between Spheres)
// ------------------------------------------------------------------
const STREAM_PARTICLE_COUNT = 130;
const streamPositions = new Float32Array(STREAM_PARTICLE_COUNT * 3);
const streamColors = new Float32Array(STREAM_PARTICLE_COUNT * 3);
const streamData = [];

for (let i = 0; i < STREAM_PARTICLE_COUNT; i++) {
  streamData.push({
    progress: Math.random(),
    speed: 0.002 + Math.random() * 0.0035,
    strand: Math.floor(Math.random() * 3),
    phase: Math.random() * Math.PI * 2,
  });
}

const streamGeo = new THREE.BufferGeometry();
streamGeo.setAttribute("position", new THREE.BufferAttribute(streamPositions, 3));
streamGeo.setAttribute("color", new THREE.BufferAttribute(streamColors, 3));

const streamMat = new THREE.PointsMaterial({
  size: 2.2,
  map: dotTexture,
  vertexColors: true,
  transparent: true,
  blending: THREE.AdditiveBlending,
  opacity: 0.85,
  depthWrite: false,
});
const streamPoints = new THREE.Points(streamGeo, streamMat);
scene.add(streamPoints);

// ------------------------------------------------------------------
// 3D Connecting Quantum Filament (Axis Line)
// ------------------------------------------------------------------
const axisLineGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0, 0),
]);
const axisLineMat = new THREE.LineDashedMaterial({
  color: 0x64748B,
  dashSize: 1.5,
  gapSize: 2.5,
  transparent: true,
  opacity: 0.25,
});
const axisLine = new THREE.Line(axisLineGeo, axisLineMat);
scene.add(axisLine);

// ------------------------------------------------------------------
// 3D Interactive Lightning Arcs
// ------------------------------------------------------------------
const LIGHTNING_SEGMENTS = 16;
const lightningPoints = [];
for (let i = 0; i <= LIGHTNING_SEGMENTS; i++) {
  lightningPoints.push(new THREE.Vector3(0, 0, 0));
}
const lightningGeo = new THREE.BufferGeometry().setFromPoints(lightningPoints);
const lightningMat = new THREE.LineBasicMaterial({
  color: 0x64F0FF,
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  linewidth: 1.5,
});
const lightningLine = new THREE.Line(lightningGeo, lightningMat);
scene.add(lightningLine);

let lastLightningTime = 0;

function spawnLightning() {
  const p1 = patientSystem.group.position;
  const p2 = swastikSystem.group.position;
  const posArray = lightningGeo.attributes.position.array;

  for (let i = 0; i <= LIGHTNING_SEGMENTS; i++) {
    const t = i / LIGHTNING_SEGMENTS;
    const envelope = Math.sin(t * Math.PI);
    const jitter = envelope * 4.5;
    const idx = i * 3;
    posArray[idx] = p1.x + (p2.x - p1.x) * t + (Math.random() - 0.5) * jitter;
    posArray[idx + 1] = p1.y + (p2.y - p1.y) * t + (Math.random() - 0.5) * jitter;
    posArray[idx + 2] = p1.z + (p2.z - p1.z) * t + (Math.random() - 0.5) * jitter;
  }
  lightningGeo.attributes.position.needsUpdate = true;
  lightningMat.opacity = 0.95;
}

// ------------------------------------------------------------------
// 3D Expanding Shockwaves
// ------------------------------------------------------------------
let activeShockwaves = [];

function triggerShockwave(targetOrb) {
  const isPatient = targetOrb === leftOrb;
  const targetGroup = isPatient ? patientSystem.group : swastikSystem.group;
  const color = isPatient ? 0xF5A623 : 0x14C8B2;

  const ringGeo = new THREE.RingGeometry(targetGroup.scale.x * 6.5, targetGroup.scale.x * 6.7, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.position.copy(targetGroup.position);
  scene.add(ringMesh);

  activeShockwaves.push({
    mesh: ringMesh,
    scale: 1.0,
    opacity: 0.85,
    speed: 0.045,
  });
}

// ------------------------------------------------------------------
// 3D Booking Celebration Particle Burst
// ------------------------------------------------------------------
let burstMesh = null;
let burstData = [];

function triggerBookingBurst() {
  const burstCount = 65;
  const origin = swastikSystem.group.position;
  burstData = [];

  const bPositions = new Float32Array(burstCount * 3);
  const bColors = new Float32Array(burstCount * 3);

  for (let i = 0; i < burstCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const speed = 0.35 + Math.random() * 0.95;

    burstData.push({
      x: origin.x,
      y: origin.y,
      z: origin.z,
      vx: Math.sin(phi) * Math.cos(theta) * speed,
      vy: Math.sin(phi) * Math.sin(theta) * speed,
      vz: Math.cos(phi) * speed,
      life: 1.0,
      decay: 0.012 + Math.random() * 0.008,
    });

    const isCyan = Math.random() > 0.4;
    bColors[i * 3] = isCyan ? 0.2 : 0.45;
    bColors[i * 3 + 1] = isCyan ? 0.95 : 0.92;
    bColors[i * 3 + 2] = isCyan ? 0.9 : 0.72;
  }

  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute("position", new THREE.BufferAttribute(bPositions, 3));
  bGeo.setAttribute("color", new THREE.BufferAttribute(bColors, 3));

  const bMat = new THREE.PointsMaterial({
    size: 2.8,
    map: dotTexture,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    opacity: 1.0,
    depthWrite: false,
  });

  if (burstMesh) scene.remove(burstMesh);
  burstMesh = new THREE.Points(bGeo, bMat);
  scene.add(burstMesh);

  triggerShockwave(rightOrb);
  triggerShockwave(leftOrb);
}

// ------------------------------------------------------------------
// 3D Ambient Cosmic Starfield
// ------------------------------------------------------------------
const STAR_COUNT = 180;
const starPositions = new Float32Array(STAR_COUNT * 3);
for (let i = 0; i < STAR_COUNT; i++) {
  starPositions[i * 3] = (Math.random() - 0.5) * 140;
  starPositions[i * 3 + 1] = (Math.random() - 0.5) * 90;
  starPositions[i * 3 + 2] = (Math.random() - 0.5) * 120 - 20;
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
const starMat = new THREE.PointsMaterial({
  size: 1.3,
  map: dotTexture,
  color: 0x94A3B8,
  transparent: true,
  blending: THREE.AdditiveBlending,
  opacity: 0.4,
  depthWrite: false,
});
const starPoints = new THREE.Points(starGeo, starMat);
scene.add(starPoints);

// ------------------------------------------------------------------
// Interactive 3D Orbit Drag & Lenis-Inspired Momentum Physics
// ------------------------------------------------------------------
let targetMouseX = 0;
let targetMouseY = 0;
let currentMouseX = 0;
let currentMouseY = 0;

let isDragging = false;
let prevPointerX = 0;
let prevPointerY = 0;
let rotTargetX = 0;
let rotTargetY = 0;
let rotCurrentX = 0;
let rotCurrentY = 0;
let dragVelX = 0;
let dragVelY = 0;

window.addEventListener("pointerdown", (e) => {
  // Allow interactive 3D rotation when dragging background / canvas
  const isCard = e.target.closest(".hud-card, .subtitles-container, .hud-header, button, a");
  if (!isCard) {
    isDragging = true;
    prevPointerX = e.clientX;
    prevPointerY = e.clientY;
    dragVelX = 0;
    dragVelY = 0;
    const dragHint = $("dragHint");
    if (dragHint) dragHint.style.opacity = "0.3";
  }
});

window.addEventListener("pointermove", (e) => {
  targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
  targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2;

  if (isDragging) {
    const dx = e.clientX - prevPointerX;
    const dy = e.clientY - prevPointerY;
    prevPointerX = e.clientX;
    prevPointerY = e.clientY;

    dragVelY = dx * 0.0035;
    dragVelX = dy * 0.0035;
    rotTargetY += dragVelY;
    rotTargetX += dragVelX;
  }
});

window.addEventListener("pointerup", () => {
  isDragging = false;
  const dragHint = $("dragHint");
  if (dragHint) dragHint.style.opacity = "1";
});
window.addEventListener("pointercancel", () => { isDragging = false; });

// ------------------------------------------------------------------
// Responsive 3D Layout & Projection
// ------------------------------------------------------------------
let leftTargetPos = new THREE.Vector3();
let rightTargetPos = new THREE.Vector3();

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;

  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  isMobile = width <= 768 || (width <= 900 && height > width);
  isTablet = !isMobile && width <= 1024;

  const vFOV = (camera.fov * Math.PI) / 180;
  const visibleHeight = 2 * Math.tan(vFOV / 2) * camera.position.z;
  const visibleWidth = visibleHeight * camera.aspect;

  if (isMobile) {
    // Stacked vertically on mobile / portrait view
    leftTargetPos.set(0, visibleHeight * 0.18, 0);
    rightTargetPos.set(0, -visibleHeight * 0.14, 0);
    patientSystem.group.scale.setScalar(0.68);
    swastikSystem.group.scale.setScalar(0.70);
  } else if (isTablet) {
    leftTargetPos.set(-visibleWidth * 0.22, 0, 0);
    rightTargetPos.set(visibleWidth * 0.22, 0, 0);
    patientSystem.group.scale.setScalar(0.9);
    swastikSystem.group.scale.setScalar(0.92);
  } else {
    leftTargetPos.set(-visibleWidth * 0.23, 0, 0);
    rightTargetPos.set(visibleWidth * 0.23, 0, 0);
    patientSystem.group.scale.setScalar(1.0);
    swastikSystem.group.scale.setScalar(1.02);
  }
}
window.addEventListener("resize", resize);

// ------------------------------------------------------------------
// Inspira UI 3D Card Tilt Engine (CardContainer + CardItem)
// ------------------------------------------------------------------
function init3DCardTilt() {
  const cards = document.querySelectorAll(".hud-card, .subtitles-container, .hud-header");
  cards.forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty("--mouse-x", `${(e.clientX - rect.left).toFixed(1)}px`);
      card.style.setProperty("--mouse-y", `${(e.clientY - rect.top).toFixed(1)}px`);
      const rotY = (x * 12).toFixed(2);
      const rotX = (-y * 12).toFixed(2);
      const isVis = card.classList.contains("visible") || !card.classList.contains("hud-card");
      if (isVis) {
        card.style.transform = `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(8px)`;
      }
    });

    card.addEventListener("pointerleave", () => {
      const isVis = card.classList.contains("visible") || !card.classList.contains("hud-card");
      if (isVis) {
        card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)";
      }
    });
  });
}
init3DCardTilt();

// ------------------------------------------------------------------
// Main 3D WebGL Animation Loop
// ------------------------------------------------------------------
let lastTime = 0;
const projVector = new THREE.Vector3();

function animate(time) {
  const delta = (time - lastTime) * 0.001;
  lastTime = time;

  // Update Inspira UI Border Beam Dynamic Rotation Angle
  const beamAngle = (time * 0.08) % 360;
  document.documentElement.style.setProperty("--beam-angle", `${beamAngle.toFixed(1)}deg`);

  // Check thinking mode transition
  if (lastUserSpeechTime > 0 && !speaking && isCallActive) {
    const elapsed = performance.now() - lastUserSpeechTime;
    if (elapsed > 800 && elapsed < 15000) {
      thinkingMode = true;
    }
  }

  // Audio Pulses
  const userPulse = Math.min(1.2, userRMS * 8);
  const agentPulse = speaking ? 0.35 + Math.sin(time * 0.007) * 0.2 : 0;
  const isCommunicating = userPulse > 0.02 || speaking;

  // Update Shader Uniforms: Dynamic Light Motion & Speech Intensity
  patientSystem.shaderMat.uniforms.uTime.value = time * 0.001;
  patientSystem.shaderMat.uniforms.uPulse.value = userPulse;
  patientSystem.shaderMat.uniforms.uMouse.value.lerp(new THREE.Vector2(currentMouseX, currentMouseY), 0.06);

  swastikSystem.shaderMat.uniforms.uTime.value = time * 0.001;
  swastikSystem.shaderMat.uniforms.uPulse.value = agentPulse;
  swastikSystem.shaderMat.uniforms.uMouse.value.lerp(new THREE.Vector2(currentMouseX, currentMouseY), 0.06);

  // Organic Sphere Scale Breathing on Voice
  patientSystem.sphereMesh.scale.setScalar(1.0 + userPulse * 0.07);
  swastikSystem.sphereMesh.scale.setScalar(1.0 + agentPulse * 0.07);

  // Halo Glow Breathing with Light Motion (voice agent.mp4)
  patientSystem.halo.scale.setScalar(patientSystem.baseRadius * (3.4 + Math.sin(time * 0.0016) * 0.25 + userPulse * 0.75));
  patientSystem.haloMat.opacity = 0.35 + Math.sin(time * 0.002) * 0.08 + userPulse * 0.35;

  swastikSystem.halo.scale.setScalar(swastikSystem.baseRadius * (3.4 + Math.sin(time * 0.0016 + 1.5) * 0.25 + agentPulse * 0.75));
  swastikSystem.haloMat.opacity = 0.35 + Math.sin(time * 0.002 + 1.5) * 0.08 + agentPulse * 0.35;

  // Continuous Acoustic Ripple Wave Propagation (Direct match to voice agent.mp4)
  const patientSpeed = 0.0026 + userPulse * 0.0065;
  patientSystem.ripples.forEach((rip) => {
    rip.phase = (rip.phase + patientSpeed) % 1.0;
    const currentR = rip.minRadius + rip.phase * (rip.maxRadius - rip.minRadius);
    rip.line.scale.set(currentR, currentR, 1);
    const envelope = Math.sin(rip.phase * Math.PI);
    rip.mat.opacity = envelope * (0.12 + userPulse * 0.38);
  });

  const swastikSpeed = 0.0026 + agentPulse * 0.0065;
  swastikSystem.ripples.forEach((rip) => {
    rip.phase = (rip.phase + swastikSpeed) % 1.0;
    const currentR = rip.minRadius + rip.phase * (rip.maxRadius - rip.minRadius);
    rip.line.scale.set(currentR, currentR, 1);
    const envelope = Math.sin(rip.phase * Math.PI);
    rip.mat.opacity = envelope * (0.12 + agentPulse * 0.38);
  });

  // Subtle 3D Sphere Rotation (Smooth orbital spin)
  patientSystem.sphereMesh.rotation.y += 0.0022;
  patientSystem.sphereMesh.rotation.x = Math.sin(time * 0.0006) * 0.10;
  swastikSystem.sphereMesh.rotation.y -= 0.0022;
  swastikSystem.sphereMesh.rotation.x = Math.cos(time * 0.0007) * 0.10;

  // Dynamic Gyroscopic Orbit Rings Precession
  patientSystem.orbitGroup.rotation.z += 0.0045;
  patientSystem.orbitGroup.rotation.x = 0.35 + Math.sin(time * 0.0007) * 0.12;
  swastikSystem.orbitGroup.rotation.z -= 0.0045;
  swastikSystem.orbitGroup.rotation.x = -0.35 + Math.cos(time * 0.0007) * 0.12;

  // Thinking Mode Indicator Animation
  if (thinkingMode) {
    thinkingGroup.visible = true;
    thinkingGroup.rotation.z += 0.035;
    for (let i = 0; i < thinkingNodesCount; i++) {
      const angle = (i / thinkingNodesCount) * Math.PI * 2;
      const r = swastikSystem.baseRadius * (1.45 + Math.sin(time * 0.006 + i) * 0.1);
      thinkingNodes[i].position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0);
    }
  } else {
    thinkingGroup.visible = false;
  }

  // Harmonic Floating Motion (Levitation & Natural Breathing)
  const floatPatientX = Math.sin(time * 0.0009) * 0.5 + Math.cos(time * 0.0018) * 0.2;
  const floatPatientY = Math.cos(time * 0.0012) * 0.65 + Math.sin(time * 0.0023) * 0.25;
  const floatPatientZ = Math.sin(time * 0.0015) * 0.35;

  const floatSwastikX = -Math.cos(time * 0.0010) * 0.5 + Math.sin(time * 0.0019) * 0.2;
  const floatSwastikY = Math.sin(time * 0.0013) * 0.65 - Math.cos(time * 0.0025) * 0.25;
  const floatSwastikZ = Math.cos(time * 0.0014) * 0.35;

  // Audio Micro-Vibration & Physical Resonance
  const vibP = userPulse > 0.05 ? (Math.random() - 0.5) * userPulse * 0.12 : 0;
  const vibS = agentPulse > 0.05 ? (Math.random() - 0.5) * agentPulse * 0.12 : 0;

  patientSystem.group.position.set(
    leftTargetPos.x + floatPatientX,
    leftTargetPos.y + floatPatientY + vibP,
    leftTargetPos.z + floatPatientZ
  );
  swastikSystem.group.position.set(
    rightTargetPos.x + floatSwastikX,
    rightTargetPos.y + floatSwastikY + vibS,
    rightTargetPos.z + floatSwastikZ
  );

  // Update 3D Connecting Axis Filament
  const axisPositions = axisLine.geometry.attributes.position.array;
  axisPositions[0] = patientSystem.group.position.x;
  axisPositions[1] = patientSystem.group.position.y;
  axisPositions[2] = patientSystem.group.position.z;
  axisPositions[3] = swastikSystem.group.position.x;
  axisPositions[4] = swastikSystem.group.position.y;
  axisPositions[5] = swastikSystem.group.position.z;
  axisLine.geometry.attributes.position.needsUpdate = true;
  axisLine.computeLineDistances();

  // Update 3D Helical Neural Synaptic Particle Stream (Directional Flow)
  const sPos = streamGeo.attributes.position.array;
  const sCol = streamGeo.attributes.color.array;
  const p1 = patientSystem.group.position;
  const p2 = swastikSystem.group.position;

  // Stream flows according to speaker activity
  let flowDir = 1.0;
  if (speaking && userPulse < 0.05) {
    flowDir = -1.0; // flow from Swastik to Patient
  }
  const streamSpeedBoost = isCommunicating ? 2.6 : 1.0;

  for (let i = 0; i < STREAM_PARTICLE_COUNT; i++) {
    const pt = streamData[i];
    pt.progress += pt.speed * streamSpeedBoost * flowDir;
    if (pt.progress > 1.0) pt.progress -= 1.0;
    if (pt.progress < 0.0) pt.progress += 1.0;

    const t = pt.progress;
    const strandAngle = t * Math.PI * 4 + time * 0.003 + pt.strand * 2.094;
    const helixRadius = (1.2 + Math.sin(t * Math.PI) * 1.5) * (isMobile ? 0.6 : 1.0);

    const baseX = p1.x + (p2.x - p1.x) * t;
    const baseY = p1.y + (p2.y - p1.y) * t;
    const baseZ = p1.z + (p2.z - p1.z) * t;

    // Cross vector offsets for 3D helix
    const idx = i * 3;
    if (isMobile) {
      sPos[idx] = baseX + Math.cos(strandAngle) * helixRadius;
      sPos[idx + 1] = baseY;
      sPos[idx + 2] = baseZ + Math.sin(strandAngle) * helixRadius;
    } else {
      sPos[idx] = baseX;
      sPos[idx + 1] = baseY + Math.sin(strandAngle) * helixRadius;
      sPos[idx + 2] = baseZ + Math.cos(strandAngle) * helixRadius;
    }

    // Color gradient: Gold near Patient -> Cyan near Swastik
    sCol[idx] = THREE.MathUtils.lerp(0.96, 0.2, t);
    sCol[idx + 1] = THREE.MathUtils.lerp(0.65, 0.95, t);
    sCol[idx + 2] = THREE.MathUtils.lerp(0.15, 0.9, t);
  }
  streamGeo.attributes.position.needsUpdate = true;
  streamGeo.attributes.color.needsUpdate = true;

  // 3D Lightning Arc during Voice Communication
  if (isCommunicating && time - lastLightningTime > 320 + Math.random() * 650) {
    spawnLightning();
    lastLightningTime = time;
  }
  if (lightningMat.opacity > 0) {
    lightningMat.opacity -= 0.045;
  }

  // Update 3D Shockwaves
  for (let i = activeShockwaves.length - 1; i >= 0; i--) {
    const sw = activeShockwaves[i];
    sw.scale += sw.speed;
    sw.opacity -= 0.018;
    sw.mesh.scale.set(sw.scale, sw.scale, sw.scale);
    sw.mesh.material.opacity = Math.max(0, sw.opacity);

    if (sw.opacity <= 0) {
      scene.remove(sw.mesh);
      sw.mesh.geometry.dispose();
      sw.mesh.material.dispose();
      activeShockwaves.splice(i, 1);
    }
  }

  // Update 3D Booking Celebration Particles
  if (burstMesh) {
    let anyAlive = false;
    const bPos = burstMesh.geometry.attributes.position.array;
    for (let i = 0; i < burstData.length; i++) {
      const b = burstData[i];
      if (b.life <= 0) continue;
      anyAlive = true;
      b.x += b.vx;
      b.y += b.vy;
      b.z += b.vz;
      b.vx *= 0.96;
      b.vy *= 0.96;
      b.vz *= 0.96;
      b.life -= b.decay;

      const idx = i * 3;
      bPos[idx] = b.x;
      bPos[idx + 1] = b.y;
      bPos[idx + 2] = b.z;
    }
    burstMesh.geometry.attributes.position.needsUpdate = true;
    burstMesh.material.opacity = Math.max(0, burstData[0]?.life || 0);

    if (!anyAlive) {
      scene.remove(burstMesh);
      burstMesh.geometry.dispose();
      burstMesh.material.dispose();
      burstMesh = null;
      burstData = [];
    }
  }

  // Twinkle Ambient Starfield
  starMat.opacity = 0.35 + Math.sin(time * 0.001) * 0.1;

  // 3D Parallax Camera Motion & Lenis Momentum Damping
  currentMouseX += (targetMouseX - currentMouseX) * 0.05;
  currentMouseY += (targetMouseY - currentMouseY) * 0.05;
  camera.position.x = currentMouseX * 5.5;
  camera.position.y = -currentMouseY * 3.8;
  camera.lookAt(0, 0, 0);

  // Apply Lenis Momentum Drag to 3D Scene Rotation
  if (!isDragging) {
    rotTargetX += dragVelX;
    rotTargetY += dragVelY;
    dragVelX *= 0.92; // Inertia damping
    dragVelY *= 0.92;
    rotTargetX *= 0.985; // Spring return to neutral
    rotTargetY *= 0.985;
  }
  rotCurrentX += (rotTargetX - rotCurrentX) * 0.08;
  rotCurrentY += (rotTargetY - rotCurrentY) * 0.08;
  scene.rotation.x = rotCurrentX;
  scene.rotation.y = rotCurrentY;

  // Render 3D Scene
  renderer.render(scene, camera);

  // Screen Space Projections for HUD overlays & Stage Status Badge
  patientSystem.group.getWorldPosition(projVector);
  projVector.project(camera);
  const leftScreenX = (projVector.x * 0.5 + 0.5) * width;
  const leftScreenY = (-(projVector.y * 0.5) + 0.5) * height;

  swastikSystem.group.getWorldPosition(projVector);
  projVector.project(camera);
  const rightScreenX = (projVector.x * 0.5 + 0.5) * width;
  const rightScreenY = (-(projVector.y * 0.5) + 0.5) * height;

  leftOrb.x = leftScreenX;
  leftOrb.y = leftScreenY;
  rightOrb.x = rightScreenX;
  rightOrb.y = rightScreenY;

  const badgeContainer = $("stageBadgeContainer");
  if (badgeContainer) {
    badgeContainer.style.left = `${leftScreenX}px`;
    badgeContainer.style.top = `${leftScreenY - (isMobile ? 78 : 94)}px`;
  }

  // Dynamically position orb labels on desktop/tablet
  const orbLabels = document.querySelector(".orb-labels-container");
  if (orbLabels && !isMobile) {
    const pBlock = orbLabels.querySelector(".patient");
    const sBlock = orbLabels.querySelector(".swastik");
    if (pBlock) {
      pBlock.style.position = "absolute";
      pBlock.style.left = `${leftScreenX}px`;
      pBlock.style.top = `${leftScreenY + 75}px`;
      pBlock.style.transform = "translateX(-50%)";
      pBlock.style.margin = "0";
    }
    if (sBlock) {
      sBlock.style.position = "absolute";
      sBlock.style.left = `${rightScreenX}px`;
      sBlock.style.top = `${rightScreenY + 75}px`;
      sBlock.style.transform = "translateX(-50%)";
      sBlock.style.margin = "0";
    }
  }

  // Update Mini Equalizer Bars
  if (waveBars && waveBars.length) {
    const activeLevel = speaking ? agentPulse : userPulse;
    waveBars.forEach((bar, idx) => {
      const h = Math.max(
        3,
        Math.min(14, 3 + activeLevel * 10 * Math.sin(time * 0.01 + idx))
      );
      bar.style.height = `${h}px`;
      bar.style.background = speaking ? "#14C8B2" : "#F5A623";
    });
  }

  requestAnimationFrame(animate);
}

// ----------------------------------------------------
// Tool Action Handlers & HUD Card Animations
// ----------------------------------------------------
function handleToolAction(cmd) {
  if (cmd.action === "show_calendar") {
    setStage("READING REAL SLOTS");
    calendarCard.classList.add("visible");

    if (cmd.slots && slotsContainer) {
      updateSlotsUI(cmd.slots);
    }
  } else if (cmd.action === "booking_confirmed") {
    setStage("WRITTEN TO THE CALENDAR");
    calendarCard.classList.add("visible");

    const mode = (cmd.data && cmd.data.consultation_mode) ? cmd.data.consultation_mode.toUpperCase() : "ONLINE";

    if (cmd.slots && slotsContainer) {
      updateSlotsUI(cmd.slots);
    }

    const slot1100 = $("slot-1100");
    if (slot1100) {
      slot1100.className = "slot-row booked";
      slot1100.innerHTML = `<span>11:00 · ${mode}</span><span class="badge-booked">BOOKED</span>`;
    }

    // Trigger celebration effects
    triggerBookingBurst();
  } else if (cmd.action === "whatsapp_send" && cmd.data) {
    setStage("CONFIRMATION ON WHATSAPP");
    waCard.classList.add("visible");
    const name = cmd.data.patient_name || "Patient";
    const slot = cmd.data.slot_time || "11:00 AM";
    const cat = cmd.data.category || "Consultation";
    const mode = cmd.data.consultation_mode || "Online";
    waText.textContent = `${name} — your ${mode} appointment for ${cat} with Dr. Gunja Gupta is confirmed for tomorrow at ${slot}. Consultation fee ₹499.`;

    const waFormLink = $("waFormLink");
    if (waFormLink && cmd.data.form_url) waFormLink.href = cmd.data.form_url;
    
    const waSendBtn = $("waSendBtn");
    if (waSendBtn && cmd.data.wa_url) {
      waSendBtn.href = cmd.data.wa_url;
      waSendBtn.style.display = "flex";
    }

    triggerShockwave(rightOrb);
  } else if (cmd.action === "show_upi_payment" && cmd.data) {
    setStage("UPI PAYMENT");
    const upiCard = $("upiCard");
    if (upiCard) upiCard.classList.add("visible");

    const upiQrImg = $("upiQrImg");
    const upiPayBtn = $("upiPayBtn");
    const upiPayeeName = $("upiPayeeName");
    const upiIdEl = $("upiId");
    const upiAmountEl = $("upiAmount");

    if (upiQrImg && cmd.data.qr_url) upiQrImg.src = cmd.data.qr_url;
    if (upiPayBtn && cmd.data.upi_link) upiPayBtn.href = cmd.data.upi_link;
    if (upiPayeeName && cmd.data.payee_name) upiPayeeName.textContent = cmd.data.payee_name;
    if (upiIdEl && cmd.data.upi_id) upiIdEl.textContent = `UPI: ${cmd.data.upi_id}`;
    if (upiAmountEl && cmd.data.amount) upiAmountEl.textContent = `₹${cmd.data.amount}`;

    // Wire up the receipt upload handler
    const receiptInput = $("receiptUpload");
    if (receiptInput && !receiptInput._wired) {
      receiptInput._wired = true;
      receiptInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const uploadFileName = $("uploadFileName");
        if (uploadFileName) uploadFileName.textContent = file.name;

        // Show pending status
        const verifyStatus = $("upiVerifyStatus");
        const verifyIcon = $("upiVerifyIcon");
        const verifyText = $("upiVerifyText");
        const verifyDetails = $("upiVerifyDetails");

        if (verifyStatus) {
          verifyStatus.style.display = "flex";
          verifyStatus.className = "upi-verify-status pending";
        }
        if (verifyIcon) verifyIcon.textContent = "⏳";
        if (verifyText) verifyText.textContent = "Verifying payment with AI...";
        if (verifyDetails) verifyDetails.style.display = "none";

        setStage("VERIFYING RECEIPT");

        try {
          const formData = new FormData();
          formData.append("file", file);
          const resp = await fetch("/upload-receipt", { method: "POST", body: formData });
          const result = await resp.json();

          if (result.verified) {
            if (verifyStatus) verifyStatus.className = "upi-verify-status verified";
            if (verifyIcon) verifyIcon.textContent = "✅";
            if (verifyText) verifyText.textContent = "PAYMENT VERIFIED";
            setStage("PAYMENT CONFIRMED");
            triggerBookingBurst();
          } else {
            if (verifyStatus) verifyStatus.className = "upi-verify-status failed";
            if (verifyIcon) verifyIcon.textContent = "❌";
            if (verifyText) verifyText.textContent = "VERIFICATION FAILED";
            setStage("PAYMENT ISSUE");
          }

          // Show details
          if (verifyDetails) {
            let detailsHTML = "";
            if (result.status) detailsHTML += `Status: ${result.status}<br>`;
            if (result.amount) detailsHTML += `Amount: ${result.amount}<br>`;
            if (result.payee) detailsHTML += `Payee: ${result.payee}<br>`;
            if (result.utr) detailsHTML += `UTR: ${result.utr}<br>`;
            if (result.reason) detailsHTML += `${result.reason}`;
            verifyDetails.innerHTML = detailsHTML;
            verifyDetails.style.display = "block";
          }
        } catch (err) {
          if (verifyStatus) verifyStatus.className = "upi-verify-status failed";
          if (verifyIcon) verifyIcon.textContent = "❌";
          if (verifyText) verifyText.textContent = "Upload failed — try again";
          setStage("UPLOAD ERROR");
        }
      });
    }

    triggerShockwave(rightOrb);
  } else if (cmd.action === "slot_update" && cmd.slots) {
    updateSlotsUI(cmd.slots);
  }
}

// Dynamic slot UI update
function updateSlotsUI(slots) {
  if (!slotsContainer) return;
  const slotIds = ["slot-1100", "slot-1130", "slot-1200", "slot-1230", "slot-1300"];
  slots.forEach((slot, idx) => {
    if (idx >= slotIds.length) return;
    const el = $(slotIds[idx]);
    if (!el) return;
    if (slot.status === "BOOKED") {
      el.className = "slot-row booked";
      el.innerHTML = `<span>${slot.time} ${slot.type}</span><span class="badge-booked">BOOKED</span>`;
    } else {
      el.className = "slot-row";
      el.innerHTML = `<span>${slot.time} ${slot.type}</span><span class="badge-free">FREE</span>`;
    }
  });
}

// ----------------------------------------------------
// Connection Chime (synthesized via Web Audio oscillator)
// ----------------------------------------------------
function playConnectionChime() {
  if (!audioCtx) return;
  try {
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc1.type = "sine";
    osc2.type = "sine";

    osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
    osc1.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.12); // E5
    osc2.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.24); // G5

    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.1);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.6);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);

    osc1.start(audioCtx.currentTime);
    osc2.start(audioCtx.currentTime + 0.24);
    osc1.stop(audioCtx.currentTime + 0.36);
    osc2.stop(audioCtx.currentTime + 0.6);
  } catch (e) {
    // Silently fail — chime is decorative
  }
}

// ----------------------------------------------------
// Voice Playback (24kHz PCM from Gemini Live) with Anti-Glitch Gain
// ----------------------------------------------------
function playVoice(buf) {
  if (!audioCtx) return;
  if (!voiceGain) {
    voiceGain = audioCtx.createGain();
    voiceGain.gain.setValueAtTime(1, audioCtx.currentTime);
    voiceGain.connect(audioCtx.destination);
  }

  const int16 = new Int16Array(buf);
  const f32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 0x8000;
  const ab = audioCtx.createBuffer(1, f32.length, 24000);
  ab.getChannelData(0).set(f32);

  const src = audioCtx.createBufferSource();
  src.buffer = ab;
  src.connect(voiceGain);

  const now = audioCtx.currentTime;
  if (nextStart < now) {
    // Increase buffer delay to 0.15s to reduce stuttering/buffering
    nextStart = now + 0.15;
  }
  src.start(nextStart);
  nextStart += ab.duration;

  activeSources.push(src);
  src.onended = () => {
    activeSources = activeSources.filter((s) => s !== src);
    if (!activeSources.length) {
      speaking = false;
    }
  };
  speaking = true;
  thinkingMode = false;
}

function stopVoice() {
  if (!speaking && !activeSources.length) return;

  if (voiceGain && audioCtx) {
    const now = audioCtx.currentTime;
    voiceGain.gain.cancelScheduledValues(now);
    voiceGain.gain.setValueAtTime(voiceGain.gain.value, now);
    voiceGain.gain.linearRampToValueAtTime(0.001, now + 0.035);
    setTimeout(() => {
      activeSources.forEach((s) => { try { s.stop(); } catch {} });
      activeSources = [];
      nextStart = 0;
      speaking = false;
      if (voiceGain && audioCtx) {
        voiceGain.gain.cancelScheduledValues(audioCtx.currentTime);
        voiceGain.gain.setValueAtTime(1, audioCtx.currentTime);
      }
    }, 40);
  } else {
    activeSources.forEach((s) => { try { s.stop(); } catch {} });
    activeSources = [];
    nextStart = 0;
    speaking = false;
  }
}

// ----------------------------------------------------
// WebSocket Live Connection & Mic AudioWorklet
// ----------------------------------------------------
function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.binaryType = "arraybuffer";

  ws.onopen = () => {
    connLabel.textContent = "CONNECTED";
    statusDot.style.background = "#10B981";
    setStage("WHY THEY CALLED");
    playConnectionChime();
  };

  ws.onclose = () => {
    connLabel.textContent = "DISCONNECTED";
    statusDot.style.background = "#EF4444";
    stopVoice();
  };

  ws.onmessage = (evt) => {
    if (typeof evt.data !== "string") {
      playVoice(evt.data);
      return;
    }
    const msg = JSON.parse(evt.data);
    if (msg.type === "transcript") {
      setSubtitles(msg.role, msg.text);
      if (msg.role === "user") {
        setStage("CALLER ASKS FOR ADVICE");
        triggerShockwave(leftOrb);
      }
    } else if (msg.type === "tool_action") {
      handleToolAction(msg);
    } else if (msg.type === "interrupted") {
      stopVoice();
    }
  };
}

async function startMic() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  await audioCtx.audioWorklet.addModule("/pcm-processor.js");

  voiceGain = audioCtx.createGain();
  voiceGain.gain.setValueAtTime(1, audioCtx.currentTime);
  voiceGain.connect(audioCtx.destination);

  micStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  const source = audioCtx.createMediaStreamSource(micStream);
  workletNode = new AudioWorkletNode(audioCtx, "pcm-processor");

  workletNode.port.onmessage = (e) => {
    userRMS = e.data.rms || 0;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(e.data.pcm);
    }

    if (userRMS >= BARGE_THRESHOLD) {
      speechFrameCount++;
      if (speechFrameCount >= 3 && speaking) {
        stopVoice();
        speechFrameCount = 0;
      }
    } else {
      speechFrameCount = Math.max(0, speechFrameCount - 1);
    }
  };

  source.connect(workletNode);

  silentSink = audioCtx.createGain();
  silentSink.gain.value = 0;
  silentSink.connect(audioCtx.destination);
  workletNode.connect(silentSink);
}

function stopCall() {
  isCallActive = false;
  thinkingMode = false;
  lastUserSpeechTime = 0;
  callBtn.classList.remove("in-call");
  callBtnIcon.textContent = "🎙";
  callBtnText.textContent = "Start Call";
  stopCallTimer();
  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  stopVoice();
}

async function startCall() {
  isCallActive = true;
  callBtn.classList.add("in-call");
  callBtnIcon.textContent = "⏹";
  callBtnText.textContent = "End Call";
  await startMic();
  connect();
  startCallTimer();
}

callBtn.addEventListener("click", () => {
  if (isCallActive) {
    stopCall();
  } else {
    startCall();
  }
});

// Initialize canvas and launch motion render loop
resize();
requestAnimationFrame(animate);
