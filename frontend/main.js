// Dr. Gunja Gupta — Hyper-Futuristic AI Voice Receptionist Engine
// Enhanced Edition: Shockwaves, Lightning, Particles, Chimes & Thinking

const $ = (id) => document.getElementById(id);
const canvas = $("orbCanvas");
const ctx = canvas.getContext("2d");

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
// High-Tech Procedural Canvas Engine: Plasma Orbs & Neural Synapses
// ------------------------------------------------------------------
let width, height;
let isMobile = false;
let isTablet = false;
let leftOrb = { x: 0, y: 0, baseRadius: 80, radius: 80, rot: 0, shockwaves: [] };
let rightOrb = { x: 0, y: 0, baseRadius: 84, radius: 84, rot: 0, shockwaves: [] };
let spaceParticles = [];
let streamPhotons = [];

// Celebration particles for booking burst
let burstParticles = [];

// Lightning arc state
let lightningArcs = [];
let lastLightningTime = 0;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  isMobile = width <= 600;
  isTablet = width > 600 && width <= 1024;

  if (isMobile) {
    leftOrb.baseRadius = Math.max(36, Math.min(48, width * 0.11));
    rightOrb.baseRadius = Math.max(40, Math.min(52, width * 0.12));
    leftOrb.x = width * 0.5;
    leftOrb.y = height * 0.22;
    rightOrb.x = width * 0.5;
    rightOrb.y = height * 0.44;
  } else if (isTablet) {
    leftOrb.baseRadius = Math.max(55, Math.min(70, width * 0.08));
    rightOrb.baseRadius = Math.max(60, Math.min(75, width * 0.085));
    leftOrb.x = width * 0.28;
    leftOrb.y = height * 0.42;
    rightOrb.x = width * 0.72;
    rightOrb.y = height * 0.42;
  } else {
    leftOrb.baseRadius = 80;
    rightOrb.baseRadius = 84;
    leftOrb.x = width * 0.28;
    leftOrb.y = height * 0.46;
    rightOrb.x = width * 0.72;
    rightOrb.y = height * 0.46;
  }

  const badgeContainer = $("stageBadgeContainer");
  if (badgeContainer) {
    badgeContainer.style.left = `${leftOrb.x}px`;
    badgeContainer.style.top = `${leftOrb.y - leftOrb.baseRadius - (isMobile ? 32 : 45)}px`;
  }
}
window.addEventListener("resize", resize);

// Ambient Floating Cosmic Dust
for (let i = 0; i < 65; i++) {
  spaceParticles.push({
    x: Math.random() * 2000,
    y: Math.random() * 1200,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    size: Math.random() * 1.8 + 0.5,
    alpha: Math.random() * 0.5 + 0.1,
  });
}

// Quantum Photons along Neural Synapse
for (let i = 0; i < 45; i++) {
  streamPhotons.push({
    progress: Math.random(),
    speed: Math.random() * 0.004 + 0.0015,
    strand: Math.floor(Math.random() * 3),
    size: Math.random() * 2.2 + 1,
    alpha: Math.random() * 0.8 + 0.2,
  });
}

// ------------------------------------------------------------------
// Shockwave Pulse System
// ------------------------------------------------------------------
function triggerShockwave(orb) {
  orb.shockwaves.push({ r: orb.baseRadius * 0.9, alpha: 0.7, speed: 2.5 });
}

function drawShockwaves(orb, isPatient) {
  const color = isPatient ? "245, 166, 35" : "20, 200, 178";
  orb.shockwaves.forEach((sw) => {
    sw.r += sw.speed;
    sw.alpha -= 0.012;
    if (sw.alpha <= 0) return;

    ctx.save();
    ctx.strokeStyle = `rgba(${color}, ${sw.alpha.toFixed(3)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, sw.r, 0, Math.PI * 2);
    ctx.stroke();

    // Inner glow ring
    ctx.strokeStyle = `rgba(${color}, ${(sw.alpha * 0.4).toFixed(3)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, sw.r - 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
  orb.shockwaves = orb.shockwaves.filter((sw) => sw.alpha > 0);
}

// ------------------------------------------------------------------
// Lightning Arc System
// ------------------------------------------------------------------
function generateLightningPath(x1, y1, x2, y2, segments) {
  const points = [{ x: x1, y: y1 }];
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const mx = x1 + (x2 - x1) * t;
    const my = y1 + (y2 - y1) * t;
    const jitter = (1 - Math.abs(t - 0.5) * 2) * 35;
    points.push({
      x: mx + (Math.random() - 0.5) * jitter,
      y: my + (Math.random() - 0.5) * jitter,
    });
  }
  points.push({ x: x2, y: y2 });
  return points;
}

function spawnLightning() {
  let sx, sy, ex, ey;
  if (isMobile) {
    sx = leftOrb.x;
    sy = leftOrb.y + leftOrb.baseRadius;
    ex = rightOrb.x;
    ey = rightOrb.y - rightOrb.baseRadius;
  } else {
    sx = leftOrb.x + leftOrb.baseRadius;
    sy = leftOrb.y;
    ex = rightOrb.x - rightOrb.baseRadius;
    ey = rightOrb.y;
  }
  const segments = 12 + Math.floor(Math.random() * 6);
  lightningArcs.push({
    points: generateLightningPath(sx, sy, ex, ey, segments),
    alpha: 0.8,
    width: Math.random() * 1.5 + 0.5,
  });
}

function drawLightning() {
  lightningArcs.forEach((arc) => {
    arc.alpha -= 0.04;
    if (arc.alpha <= 0) return;

    ctx.save();
    ctx.strokeStyle = `rgba(100, 240, 255, ${arc.alpha.toFixed(3)})`;
    ctx.lineWidth = arc.width;
    ctx.shadowColor = "rgba(100, 240, 255, 0.6)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(arc.points[0].x, arc.points[0].y);
    for (let i = 1; i < arc.points.length; i++) {
      ctx.lineTo(arc.points[i].x, arc.points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  });
  lightningArcs = lightningArcs.filter((a) => a.alpha > 0);
}

// ------------------------------------------------------------------
// Booking Celebration Particle Burst
// ------------------------------------------------------------------
function triggerBookingBurst() {
  const cx = rightOrb.x;
  const cy = rightOrb.y;
  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 1.5;
    burstParticles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1.0,
      size: Math.random() * 3 + 1,
      color: Math.random() > 0.5 ? "20, 200, 178" : "110, 231, 183",
    });
  }
  triggerShockwave(rightOrb);
  triggerShockwave(leftOrb);
}

function drawBurstParticles() {
  burstParticles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.97;
    p.vy *= 0.97;
    p.alpha -= 0.012;
    if (p.alpha <= 0) return;

    ctx.save();
    ctx.fillStyle = `rgba(${p.color}, ${p.alpha.toFixed(3)})`;
    ctx.shadowColor = `rgba(${p.color}, ${(p.alpha * 0.5).toFixed(3)})`;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  burstParticles = burstParticles.filter((p) => p.alpha > 0);
}

// ------------------------------------------------------------------
// Thinking Indicator (pulsing glow on Swastik orb)
// ------------------------------------------------------------------
function drawThinkingIndicator(time) {
  if (!thinkingMode) return;

  const pulseAlpha = 0.15 + Math.sin(time * 0.008) * 0.1;
  const pulseR = rightOrb.baseRadius * (1.4 + Math.sin(time * 0.005) * 0.15);

  ctx.save();
  const grad = ctx.createRadialGradient(
    rightOrb.x, rightOrb.y, rightOrb.baseRadius * 0.8,
    rightOrb.x, rightOrb.y, pulseR
  );
  grad.addColorStop(0, `rgba(20, 200, 178, ${pulseAlpha.toFixed(3)})`);
  grad.addColorStop(0.6, `rgba(0, 229, 255, ${(pulseAlpha * 0.4).toFixed(3)})`);
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(rightOrb.x, rightOrb.y, pulseR, 0, Math.PI * 2);
  ctx.fill();

  // Three small rotating dots orbiting the orb
  for (let i = 0; i < 3; i++) {
    const angle = time * 0.004 + (i * Math.PI * 2) / 3;
    const orbitR = rightOrb.baseRadius * 1.25;
    const dx = rightOrb.x + Math.cos(angle) * orbitR;
    const dy = rightOrb.y + Math.sin(angle) * orbitR;
    ctx.fillStyle = `rgba(20, 200, 178, ${0.6 + Math.sin(time * 0.01 + i) * 0.3})`;
    ctx.beginPath();
    ctx.arc(dx, dy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ------------------------------------------------------------------
// Cinematic Luminous 3D Spherical Orb with Concentric Ripple Rings
// ------------------------------------------------------------------
function drawCinematicOrb(orb, pulse, isPatient, time) {
  const r = orb.baseRadius + pulse * 14;

  // 1. Soft Ambient Atmospheric Scatter Glow
  const diffuseGlow = ctx.createRadialGradient(orb.x, orb.y, r * 0.5, orb.x, orb.y, r * 2.8);
  if (isPatient) {
    diffuseGlow.addColorStop(0, `rgba(245, 166, 35, ${0.25 + pulse * 0.2})`);
    diffuseGlow.addColorStop(0.4, `rgba(245, 166, 35, ${0.08 + pulse * 0.1})`);
    diffuseGlow.addColorStop(0.8, "rgba(217, 119, 6, 0.02)");
    diffuseGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  } else {
    diffuseGlow.addColorStop(0, `rgba(20, 200, 178, ${0.3 + pulse * 0.25})`);
    diffuseGlow.addColorStop(0.4, `rgba(0, 229, 255, ${0.09 + pulse * 0.1})`);
    diffuseGlow.addColorStop(0.8, "rgba(13, 148, 136, 0.02)");
    diffuseGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  }
  ctx.fillStyle = diffuseGlow;
  ctx.beginPath();
  ctx.arc(orb.x, orb.y, r * 2.8, 0, Math.PI * 2);
  ctx.fill();

  // 2. Multi-layered Concentric Ripple Aura Rings
  const ringMultipliers = [1.22, 1.52, 1.9, 2.38];
  const ringBaseAlphas = isPatient ? [0.18, 0.11, 0.06, 0.03] : [0.22, 0.13, 0.07, 0.035];
  const ringColor = isPatient ? "245, 166, 35" : "20, 200, 178";

  ringMultipliers.forEach((mult, idx) => {
    ctx.save();
    const breathingOffset = Math.sin(time * 0.002 + idx * 0.8) * 2;
    const ringR = r * mult + breathingOffset + pulse * 10 * (1 - idx * 0.2);
    const ringAlpha = Math.max(0.01, ringBaseAlphas[idx] + pulse * 0.15 * (1 - idx * 0.2));

    ctx.strokeStyle = `rgba(${ringColor}, ${ringAlpha.toFixed(3)})`;
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  // 3. Perfect Spherical Core with 3D Specular Highlight
  ctx.save();
  ctx.beginPath();
  ctx.arc(orb.x, orb.y, r, 0, Math.PI * 2);

  const highlightOffsetX = orb.x;
  const highlightOffsetY = orb.y - r * 0.1;
  const coreGrad = ctx.createRadialGradient(
    highlightOffsetX, highlightOffsetY, r * 0.02,
    orb.x, orb.y, r
  );

  if (isPatient) {
    coreGrad.addColorStop(0, "#FFFBEB");
    coreGrad.addColorStop(0.18, "#FEF3C7");
    coreGrad.addColorStop(0.45, "#F59E0B");
    coreGrad.addColorStop(0.78, "#B45309");
    coreGrad.addColorStop(0.94, "#78350F");
    coreGrad.addColorStop(1, "#3F1D06");
  } else {
    coreGrad.addColorStop(0, "#D8FFFB");
    coreGrad.addColorStop(0.18, "#6EE7B7");
    coreGrad.addColorStop(0.45, "#14B8A6");
    coreGrad.addColorStop(0.78, "#0F766E");
    coreGrad.addColorStop(0.94, "#0B4E48");
    coreGrad.addColorStop(1, "#042A27");
  }

  ctx.fillStyle = coreGrad;
  ctx.fill();

  // 4. Crisp Glowing Atmospheric Rim / Limb Stroke
  ctx.strokeStyle = isPatient ? "rgba(255, 235, 180, 0.45)" : "rgba(110, 240, 225, 0.45)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------
// Main Animation Loop
// ------------------------------------------------------------------
let lastTime = 0;

function animate(time) {
  ctx.clearRect(0, 0, width, height);
  lastTime = time;

  // Check if we should enter thinking mode
  if (lastUserSpeechTime > 0 && !speaking && isCallActive) {
    const elapsed = performance.now() - lastUserSpeechTime;
    if (elapsed > 800 && elapsed < 15000) {
      thinkingMode = true;
    }
  }

  // 1. Ambient Floating Stardust (optimized on mobile)
  const activeParticleLimit = isMobile ? 24 : spaceParticles.length;
  for (let i = 0; i < activeParticleLimit; i++) {
    const p = spaceParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0) p.x = width;
    if (p.x > width) p.x = 0;
    if (p.y < 0) p.y = height;
    if (p.y > height) p.y = 0;

    ctx.fillStyle = `rgba(148, 163, 184, ${p.alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Calculate dynamic pulses
  const userPulse = Math.min(1.2, userRMS * 8);
  const agentPulse = speaking ? 0.35 + Math.sin(time * 0.007) * 0.2 : 0;

  // Responsive Organic Floating Motion — subtle sinusoidal drift
  const driftX = Math.sin(time * 0.0008) * 4;
  const driftY = Math.cos(time * 0.0012) * 3;

  if (isMobile) {
    leftOrb.x = width * 0.5 + Math.sin(time * 0.001) * 2;
    leftOrb.y = height * 0.22 + driftY;
    rightOrb.x = width * 0.5 - Math.sin(time * 0.001) * 2;
    rightOrb.y = height * 0.44 - driftY * 0.7;
  } else if (isTablet) {
    leftOrb.x = width * 0.28 + driftX;
    leftOrb.y = height * 0.42 + driftY;
    rightOrb.x = width * 0.72 - driftX * 0.7;
    rightOrb.y = height * 0.42 - driftY * 0.6;
  } else {
    leftOrb.x = width * 0.28 + driftX;
    leftOrb.y = height * 0.46 + driftY;
    rightOrb.x = width * 0.72 - driftX * 0.7;
    rightOrb.y = height * 0.46 - driftY * 0.6;
  }

  // Dynamic tracking for Stage Status Badge
  const badgeContainer = $("stageBadgeContainer");
  if (badgeContainer) {
    badgeContainer.style.left = `${leftOrb.x}px`;
    badgeContainer.style.top = `${leftOrb.y - leftOrb.baseRadius - (isMobile ? 32 : 45)}px`;
  }

  // 2. Axis Line between Orbs (vertical on mobile, horizontal on tablet/desktop)
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 5]);
  ctx.beginPath();
  ctx.moveTo(leftOrb.x, leftOrb.y);
  ctx.lineTo(rightOrb.x, rightOrb.y);
  ctx.stroke();
  ctx.restore();

  // 3. Discrete Data Dot Chain (vertical on mobile, horizontal on tablet/desktop)
  const isCommunicating = userPulse > 0.02 || speaking;
  const activePhotonLimit = isMobile ? 20 : streamPhotons.length;
  for (let i = 0; i < activePhotonLimit; i++) {
    const pt = streamPhotons[i];
    pt.progress += pt.speed * (isCommunicating ? 2.6 : 1.0);
    if (pt.progress > 1) pt.progress = 0;

    let px, py;
    if (isMobile) {
      const startY = leftOrb.y + leftOrb.baseRadius;
      const endY = rightOrb.y - rightOrb.baseRadius;
      px = leftOrb.x;
      py = startY + (endY - startY) * pt.progress;
    } else {
      const startX = leftOrb.x + leftOrb.baseRadius;
      const endX = rightOrb.x - rightOrb.baseRadius;
      px = startX + (endX - startX) * pt.progress;
      py = leftOrb.y;
    }

    const isNearAgent = pt.progress > 0.5;
    const dotColor = isNearAgent ? `rgba(180, 255, 245, ${pt.alpha})` : `rgba(255, 230, 160, ${pt.alpha})`;

    ctx.fillStyle = dotColor;
    ctx.beginPath();
    ctx.arc(px, py, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Lightning Arcs (spawn during active communication)
  if (isCommunicating && time - lastLightningTime > 300 + Math.random() * 700) {
    spawnLightning();
    lastLightningTime = time;
  }
  drawLightning();

  // 5. Render Spherical Orbs
  drawCinematicOrb(leftOrb, userPulse, true, time);
  drawCinematicOrb(rightOrb, agentPulse, false, time);

  // 6. Draw Shockwaves
  drawShockwaves(leftOrb, true);
  drawShockwaves(rightOrb, false);

  // 7. Thinking Indicator
  drawThinkingIndicator(time);

  // 8. Burst Particles
  drawBurstParticles();

  // 9. Update Mini Waveform Equalizer Bars
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
