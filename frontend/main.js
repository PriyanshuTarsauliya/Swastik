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
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    float ndv = clamp(dot(normal, viewDir), 0.0, 1.0);

    float shimmer = sin(vWorldPosition.x * 2.5 + uTime * 2.2) * 
                    cos(vWorldPosition.y * 2.5 + uTime * 1.8) * 
                    sin(vWorldPosition.z * 2.5 + uTime * 1.4) * 0.035;

    float centerFactor = pow(ndv, 1.4 + uPulse * 0.45) + shimmer;
    centerFactor = clamp(centerFactor, 0.0, 1.0);

    vec3 cWhite = vec3(1.0, 1.0, 1.0);
    vec3 cSun   = vec3(0.996, 0.941, 0.541); // #FEF08A
    vec3 cAmber = vec3(0.961, 0.620, 0.043); // #F59E0B
    vec3 cWarm  = vec3(0.851, 0.467, 0.024); // #D97706
    vec3 cDark  = vec3(0.573, 0.251, 0.035); // #92400E

    vec3 col;
    float coreSpread = 0.54 + uPulse * 0.26;
    if (centerFactor > coreSpread) {
      float t = (centerFactor - coreSpread) / (1.0 - coreSpread + 0.001);
      col = mix(cSun, cWhite, t);
    } else if (centerFactor > 0.35) {
      float t = (centerFactor - 0.35) / (coreSpread - 0.35 + 0.001);
      col = mix(cAmber, cSun, t);
    } else if (centerFactor > 0.12) {
      float t = (centerFactor - 0.12) / (0.35 - 0.12);
      col = mix(cWarm, cAmber, t);
    } else {
      float t = centerFactor / 0.12;
      col = mix(cDark, cWarm, t);
    }

    float fresnel = pow(1.0 - ndv, 2.4);
    col += vec3(1.0, 0.95, 0.8) * fresnel * (0.85 + uPulse * 0.4);

    gl_FragColor = vec4(col, 0.98);
  }
`;

const swastikFragmentShader = `
  uniform float uTime;
  uniform float uPulse;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    float ndv = clamp(dot(normal, viewDir), 0.0, 1.0);

    float shimmer = sin(vWorldPosition.x * 2.8 + uTime * 2.5) * 
                    cos(vWorldPosition.y * 2.8 + uTime * 2.0) * 
                    sin(vWorldPosition.z * 2.8 + uTime * 1.6) * 0.035;

    float centerFactor = pow(ndv, 1.4 + uPulse * 0.45) + shimmer;
    centerFactor = clamp(centerFactor, 0.0, 1.0);

    vec3 cWhite   = vec3(1.0, 1.0, 1.0);
    vec3 cNeon    = vec3(0.404, 0.910, 0.976); // #67E8F9
    vec3 cTeal    = vec3(0.078, 0.722, 0.651); // #14B8A6
    vec3 cDeep    = vec3(0.051, 0.580, 0.533); // #0D9488
    vec3 cDark    = vec3(0.059, 0.463, 0.431); // #0F766E

    vec3 col;
    float coreSpread = 0.54 + uPulse * 0.26;
    if (centerFactor > coreSpread) {
      float t = (centerFactor - coreSpread) / (1.0 - coreSpread + 0.001);
      col = mix(cNeon, cWhite, t);
    } else if (centerFactor > 0.35) {
      float t = (centerFactor - 0.35) / (coreSpread - 0.35 + 0.001);
      col = mix(cTeal, cNeon, t);
    } else if (centerFactor > 0.12) {
      float t = (centerFactor - 0.12) / (0.35 - 0.12);
      col = mix(cDeep, cTeal, t);
    } else {
      float t = centerFactor / 0.12;
      col = mix(cDark, cDeep, t);
    }

    float fresnel = pow(1.0 - ndv, 2.4);
    col += vec3(0.85, 1.0, 1.0) * fresnel * (0.9 + uPulse * 0.4);

    gl_FragColor = vec4(col, 0.98);
  }
`;

// ------------------------------------------------------------------
// 3D Gyroscopic Orb System Builder
// ------------------------------------------------------------------
function createOrbSystem(isPatient) {
  const group = new THREE.Group();
  const radius = isPatient ? 6.4 : 6.7;
  const ringColor = isPatient ? 0xF5A623 : 0x14C8B2;
  const glowColor = isPatient ? 0xFFF0A0 : 0x90FFF5;
  const dir = isPatient ? 1 : -1;

  // 1. Radiant Light Core Sphere
  const sphereGeo = new THREE.SphereGeometry(radius, 54, 54);
  const shaderMat = new THREE.ShaderMaterial({
    vertexShader: sphereVertexShader,
    fragmentShader: isPatient ? patientFragmentShader : swastikFragmentShader,
    uniforms: {
      uTime: { value: 0.0 },
      uPulse: { value: 0.0 },
    },
    transparent: true,
  });
  const sphereMesh = new THREE.Mesh(sphereGeo, shaderMat);
  group.add(sphereMesh);

  // 2. Luminous Atmospheric Corona Sprite
  const coronaMat = new THREE.SpriteMaterial({
    map: isPatient ? glowTexturePatient : glowTextureSwastik,
    transparent: true,
    blending: THREE.AdditiveBlending,
    opacity: 0.65,
  });
  const coronaSprite = new THREE.Sprite(coronaMat);
  coronaSprite.scale.set(radius * 4.4, radius * 4.4, 1);
  group.add(coronaSprite);

  // 3. Ring 1: Inner Aura Orbit with Dotted Track
  const ring1Group = new THREE.Group();
  ring1Group.rotation.set(0.38 * dir, 0.18, 0);

  const r1Radius = radius * 1.25;
  const r1Pts = createCirclePoints(r1Radius, 64);
  const r1LineGeo = new THREE.BufferGeometry().setFromPoints(r1Pts);
  const r1LineMat = new THREE.LineBasicMaterial({
    color: ringColor,
    transparent: true,
    opacity: 0.35,
  });
  const r1Line = new THREE.LineLoop(r1LineGeo, r1LineMat);
  ring1Group.add(r1Line);

  // Micro-dots along Ring 1
  const r1DotPts = createCirclePoints(r1Radius, 32);
  const r1DotGeo = new THREE.BufferGeometry().setFromPoints(r1DotPts);
  const r1DotMat = new THREE.PointsMaterial({
    size: 1.4,
    map: dotTexture,
    color: glowColor,
    transparent: true,
    blending: THREE.AdditiveBlending,
    opacity: 0.75,
    depthWrite: false,
  });
  const r1Dots = new THREE.Points(r1DotGeo, r1DotMat);
  ring1Group.add(r1Dots);
  group.add(ring1Group);

  // 4. Ring 2: Middle Radar Orbit with 8 Glowing Data Blips
  const ring2Group = new THREE.Group();
  ring2Group.rotation.set(-0.3 * dir, 0.45, 0.12);

  const r2Radius = radius * 1.6;
  const r2Pts = createCirclePoints(r2Radius, 64);
  const r2LineGeo = new THREE.BufferGeometry().setFromPoints(r2Pts);
  const r2LineMat = new THREE.LineBasicMaterial({
    color: ringColor,
    transparent: true,
    opacity: 0.22,
  });
  const r2Line = new THREE.LineLoop(r2LineGeo, r2LineMat);
  ring2Group.add(r2Line);

  // 8 distinct glowing data blip dots
  const r2BlipPts = createCirclePoints(r2Radius, 8);
  const r2BlipGeo = new THREE.BufferGeometry().setFromPoints(r2BlipPts);
  const r2BlipMat = new THREE.PointsMaterial({
    size: 2.3,
    map: dotTexture,
    color: glowColor,
    transparent: true,
    blending: THREE.AdditiveBlending,
    opacity: 0.85,
    depthWrite: false,
  });
  const r2Blips = new THREE.Points(r2BlipGeo, r2BlipMat);
  ring2Group.add(r2Blips);
  group.add(ring2Group);

  // 5. Ring 3: Outer Horizon Orbit with Orbiting Satellite Nodes
  const ring3Group = new THREE.Group();
  ring3Group.rotation.set(0.42 * dir, -0.32, 0.22);

  const r3Radius = radius * 2.05;
  const r3Pts = createCirclePoints(r3Radius, 64);
  const r3LineGeo = new THREE.BufferGeometry().setFromPoints(r3Pts);
  const r3LineMat = new THREE.LineBasicMaterial({
    color: ringColor,
    transparent: true,
    opacity: 0.16,
  });
  const r3Line = new THREE.LineLoop(r3LineGeo, r3LineMat);
  ring3Group.add(r3Line);

  // 3 Orbiting Satellite Blips
  const satellites = [];
  for (let s = 0; s < 3; s++) {
    const satGeo = new THREE.SphereGeometry(0.32, 16, 16);
    const satMat = new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: 0.95,
    });
    const satMesh = new THREE.Mesh(satGeo, satMat);
    ring3Group.add(satMesh);
    satellites.push({ mesh: satMesh, offset: (s * Math.PI * 2) / 3, speed: 0.0006 * (1 + s * 0.2) });
  }
  group.add(ring3Group);

  // 6. Ambient Orbital Stardust
  const stardustCount = 18;
  const stardustPts = [];
  for (let i = 0; i < stardustCount; i++) {
    const angle = (i / stardustCount) * Math.PI * 2;
    const dist = radius * (1.15 + (i % 3) * 0.25);
    stardustPts.push(
      new THREE.Vector3(
        Math.cos(angle) * dist,
        Math.sin(angle) * dist,
        (Math.sin(i * 1.5) - 0.5) * 2.5
      )
    );
  }
  const stardustGeo = new THREE.BufferGeometry().setFromPoints(stardustPts);
  const stardustMat = new THREE.PointsMaterial({
    size: 1.6,
    map: dotTexture,
    color: glowColor,
    transparent: true,
    blending: THREE.AdditiveBlending,
    opacity: 0.55,
    depthWrite: false,
  });
  const stardustPoints = new THREE.Points(stardustGeo, stardustMat);
  group.add(stardustPoints);

  return {
    group,
    sphereMesh,
    shaderMat,
    coronaSprite,
    ring1Group,
    ring2Group,
    ring3Group,
    satellites,
    r3Radius,
    stardustPoints,
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
// 3D Holographic Camera Parallax & Mouse/Touch Tilt
// ------------------------------------------------------------------
let targetMouseX = 0;
let targetMouseY = 0;
let currentMouseX = 0;
let currentMouseY = 0;

window.addEventListener("pointermove", (e) => {
  targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
  targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2;
});

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
// Main 3D WebGL Animation Loop
// ------------------------------------------------------------------
let lastTime = 0;
const projVector = new THREE.Vector3();

function animate(time) {
  const delta = (time - lastTime) * 0.001;
  lastTime = time;

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

  // Update Shader Uniforms
  patientSystem.shaderMat.uniforms.uTime.value = time * 0.001;
  patientSystem.shaderMat.uniforms.uPulse.value = userPulse;
  swastikSystem.shaderMat.uniforms.uTime.value = time * 0.001;
  swastikSystem.shaderMat.uniforms.uPulse.value = agentPulse;

  // Corona Pulsing
  const pScale = patientSystem.baseRadius * 4.4 * (1.0 + userPulse * 0.35);
  patientSystem.coronaSprite.scale.set(pScale, pScale, 1);
  patientSystem.coronaSprite.material.opacity = 0.6 + userPulse * 0.3;

  const sScale = swastikSystem.baseRadius * 4.4 * (1.0 + agentPulse * 0.35);
  swastikSystem.coronaSprite.scale.set(sScale, sScale, 1);
  swastikSystem.coronaSprite.material.opacity = 0.65 + agentPulse * 0.3;

  // Gyroscopic 3D Rotations of Concentric Rings
  patientSystem.ring1Group.rotation.z += 0.005;
  patientSystem.ring2Group.rotation.z -= 0.0035;
  patientSystem.ring3Group.rotation.z += 0.002;

  swastikSystem.ring1Group.rotation.z -= 0.005;
  swastikSystem.ring2Group.rotation.z += 0.0035;
  swastikSystem.ring3Group.rotation.z -= 0.002;

  // Update Orbiting Satellite Nodes on Ring 3
  patientSystem.satellites.forEach((sat) => {
    const satAngle = time * sat.speed + sat.offset;
    sat.mesh.position.set(
      Math.cos(satAngle) * patientSystem.r3Radius,
      Math.sin(satAngle) * patientSystem.r3Radius,
      0
    );
  });

  swastikSystem.satellites.forEach((sat) => {
    const satAngle = time * sat.speed + sat.offset;
    sat.mesh.position.set(
      Math.cos(satAngle) * swastikSystem.r3Radius,
      Math.sin(satAngle) * swastikSystem.r3Radius,
      0
    );
  });

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

  // Floating Drift
  const driftX = Math.sin(time * 0.0008) * 0.45;
  const driftY = Math.cos(time * 0.0012) * 0.35;

  patientSystem.group.position.set(
    leftTargetPos.x + driftX,
    leftTargetPos.y + driftY,
    leftTargetPos.z
  );
  swastikSystem.group.position.set(
    rightTargetPos.x - driftX * 0.7,
    rightTargetPos.y - driftY * 0.6,
    rightTargetPos.z
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

  // Update 3D Helical Neural Synaptic Particle Stream
  const sPos = streamGeo.attributes.position.array;
  const sCol = streamGeo.attributes.color.array;
  const p1 = patientSystem.group.position;
  const p2 = swastikSystem.group.position;

  for (let i = 0; i < STREAM_PARTICLE_COUNT; i++) {
    const pt = streamData[i];
    pt.progress += pt.speed * (isCommunicating ? 2.5 : 1.0);
    if (pt.progress > 1.0) pt.progress = 0;

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

  // 3D Parallax Camera Motion
  currentMouseX += (targetMouseX - currentMouseX) * 0.05;
  currentMouseY += (targetMouseY - currentMouseY) * 0.05;
  camera.position.x = currentMouseX * 5.5;
  camera.position.y = -currentMouseY * 3.8;
  camera.lookAt(0, 0, 0);

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
