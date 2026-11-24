import { clamp } from "./shared.js";

const stage = document.querySelector("[data-card-stage]");
if (stage) initLanyard(stage);

function initLanyard(root) {
  const canvas = root.querySelector("#lanyard");
  const card = root.querySelector("#id-card");
  const flip = root.querySelector("#id-card-flip");
  const flipButton = document.querySelector("#flip-card");
  const front = root.querySelector(".id-front");
  const back = root.querySelector(".id-back");
  if (!canvas || !card || !flip) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    cardW: 0,
    cardH: 0,
    nodes: null,
    links: [],
    dragging: false,
    pointerId: null,
    pointer: null,
    targetFlip: 0,
    flip: 0,
    visible: true,
    raf: 0,
    lastTime: 0,
    settleStart: 0
  };

  function measure() {
    const rect = root.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) return false;

    state.width = rect.width;
    state.height = rect.height;
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    state.cardW = card.offsetWidth;
    state.cardH = card.offsetHeight;
    if (!state.cardW || !state.cardH) return false;

    const anchorX = state.width * 0.5;
    const topX = clamp(state.width * 0.54, (state.cardW / 2) + 10, state.width - (state.cardW / 2) - 10);
    const firstX = anchorX + ((topX - anchorX) * 0.4);
    const secondX = anchorX + ((topX - anchorX) * 0.72);
    const firstY = Math.max(36, state.height * 0.1);
    const secondY = Math.max(86, state.height * 0.19);
    const topY = Math.max(136, state.height * 0.265);

    state.nodes = [
      { x: anchorX, y: -18, px: anchorX, py: -18, pinned: true },
      { x: firstX, y: firstY, px: firstX, py: firstY, pinned: false },
      { x: secondX, y: secondY, px: secondX, py: secondY, pinned: false },
      { x: topX, y: topY, px: topX, py: topY, pinned: false }
    ];

    state.links = [];
    for (let i = 0; i < state.nodes.length - 1; i += 1) {
      const a = state.nodes[i];
      const b = state.nodes[i + 1];
      state.links.push(Math.hypot(b.x - a.x, b.y - a.y));
    }

    state.dragging = false;
    state.pointer = null;
    card.classList.remove("grabbing");
    return true;
  }

  function simulate(dt, now) {
    const nodes = state.nodes;
    if (!nodes) return;
    const gravity = 2200;
    const damping = 0.985;

    for (let iteration = 0; iteration < 3; iteration += 1) {
      for (let i = 1; i < nodes.length; i += 1) {
        const node = nodes[i];
        const vx = (node.x - node.px) * damping;
        const vy = (node.y - node.py) * damping;
        node.px = node.x;
        node.py = node.y;
        node.x += vx;
        node.y += vy + (gravity * dt * dt);
      }

      for (let i = 0; i < nodes.length - 1; i += 1) {
        const a = nodes[i];
        const b = nodes[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy) || 0.0001;
        const difference = (distance - state.links[i]) / distance;
        const weightA = a.pinned ? 0 : 1;
        const weightB = b.pinned ? 0 : 1;
        const totalWeight = weightA + weightB;
        if (!totalWeight) continue;

        if (weightA) {
          a.x += dx * difference * (weightA / totalWeight);
          a.y += dy * difference * (weightA / totalWeight);
        }
        if (weightB) {
          b.x -= dx * difference * (weightB / totalWeight);
          b.y -= dy * difference * (weightB / totalWeight);
        }
      }

      if (state.dragging && state.pointer) {
        const last = nodes[nodes.length - 1];
        last.px = last.x;
        last.py = last.y;
        last.x = state.pointer.x;
        last.y = state.pointer.y;
      }

      const last = nodes[nodes.length - 1];
      last.x = clamp(last.x, (state.cardW / 2) + 10, state.width - (state.cardW / 2) - 10);
      last.y = clamp(last.y, 0, state.height - state.cardH - 8);

      for (let i = 1; i < nodes.length - 1; i += 1) {
        nodes[i].x = clamp(nodes[i].x, 0, state.width);
        nodes[i].y = clamp(nodes[i].y, 0, state.height);
      }
    }

    if (!state.dragging) {
      const last = nodes[nodes.length - 1];
      const progress = state.settleStart ? Math.min(1, Math.max(0, (now - state.settleStart) / 4200)) : 1;
      if (progress < 1) {
        last.x += Math.sin(now * 0.0022) * 0.045 * (1 - progress);
      }
    }
  }

  function drawRope() {
    const nodes = state.nodes;
    if (!nodes) return;
    context.clearRect(0, 0, state.width, state.height);

    context.beginPath();
    context.moveTo(nodes[0].x, nodes[0].y);
    for (let i = 1; i < nodes.length - 1; i += 1) {
      const next = nodes[i + 1];
      const midX = (nodes[i].x + next.x) / 2;
      const midY = (nodes[i].y + next.y) / 2;
      context.quadraticCurveTo(nodes[i].x, nodes[i].y, midX, midY);
    }
    const end = nodes[nodes.length - 1];
    context.quadraticCurveTo(end.x, end.y, end.x, end.y);

    context.lineCap = "round";
    context.lineJoin = "round";

    context.save();
    context.shadowColor = "rgba(0, 0, 0, 0.5)";
    context.shadowBlur = 9;
    context.shadowOffsetY = 5;
    context.strokeStyle = "rgba(8, 6, 4, 0.82)";
    context.lineWidth = 15;
    context.stroke();
    context.restore();

    context.strokeStyle = "#b8ab96";
    context.lineWidth = 9;
    context.stroke();
    context.strokeStyle = "rgba(255, 244, 225, 0.26)";
    context.lineWidth = 3;
    context.stroke();

    context.save();
    context.setLineDash([2, 6]);
    context.strokeStyle = "rgba(78, 60, 41, 0.5)";
    context.lineWidth = 1;
    context.stroke();
    context.restore();

    const slider = nodes[2];
    const previous = nodes[1];
    const sliderAngle = Math.atan2(slider.x - previous.x, slider.y - previous.y);
    context.save();
    context.translate(slider.x, slider.y);
    context.rotate(-sliderAngle);
    const metal = context.createLinearGradient(-14, -6, 14, 6);
    metal.addColorStop(0, "#747a82");
    metal.addColorStop(0.42, "#e4e7ea");
    metal.addColorStop(0.62, "#b1b6bc");
    metal.addColorStop(1, "#676d74");
    context.fillStyle = metal;
    context.fillRect(-14, -6, 28, 12);
    context.fillStyle = "rgba(26, 22, 18, 0.62)";
    context.fillRect(-4, -2, 8, 4);
    context.fillStyle = "rgba(255, 255, 255, 0.35)";
    context.fillRect(-14, -6, 28, 1);
    context.restore();

    context.beginPath();
    context.arc(end.x, end.y - 1, 6, 0, Math.PI * 2);
    context.fillStyle = "#c9c1b4";
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = "#6f746f";
    context.stroke();
  }

  function paint(now) {
    const nodes = state.nodes;
    if (!nodes) return;
    const end = nodes[nodes.length - 1];
    const upper = nodes[nodes.length - 2];
    const angle = reduceMotion
      ? 0
      : Math.atan2(end.x - upper.x, Math.max(8, end.y - upper.y)) * 0.72;

    card.style.transform = `translate3d(${end.x - (state.cardW / 2)}px, ${end.y}px, 0) rotate(${angle}rad)`;
    flip.style.transform = `rotateY(${state.flip * Math.PI}rad)`;
    const sheenProgress = reduceMotion || !state.settleStart
      ? 1
      : Math.min(1, Math.max(0, (now - state.settleStart) / 4200));
    card.style.setProperty("--sheen", reduceMotion ? "50%" : `${sheenProgress * 150}%`);
    drawRope();
  }

  function frame(now) {
    if (!state.visible) {
      state.raf = 0;
      return;
    }

    const dt = Math.min((now - state.lastTime) / 1000, 1 / 30);
    state.lastTime = now;
    simulate(dt, now);

    const easing = reduceMotion ? 1 : 0.17;
    state.flip += (state.targetFlip - state.flip) * easing;
    if (Math.abs(state.targetFlip - state.flip) < 0.001) state.flip = state.targetFlip;

    paint(now);

    const nodes = state.nodes;
    const last = nodes[nodes.length - 1];
    const upper = nodes[nodes.length - 2];
    const speed =
      Math.abs(last.x - last.px) +
      Math.abs(last.y - last.py) +
      Math.abs(upper.x - upper.px) +
      Math.abs(upper.y - upper.py);
    const settled = !state.settleStart || (now - state.settleStart) >= 4200;
    const flipSettled = Math.abs(state.targetFlip - state.flip) < 0.001;
    if (!state.dragging && settled && flipSettled && speed < 0.06) {
      state.raf = 0;
      return;
    }

    state.raf = requestAnimationFrame(frame);
  }

  function startLoop() {
    if (reduceMotion || state.raf) return;
    if (!state.settleStart) state.settleStart = performance.now();
    state.lastTime = performance.now();
    state.raf = requestAnimationFrame(frame);
  }

  function renderStatic() {
    state.flip = state.targetFlip;
    paint(performance.now());
  }

  function updateFlipButton() {
    if (!flipButton) return;
    const showingBack = state.targetFlip === 1;
    flipButton.setAttribute("aria-pressed", showingBack ? "true" : "false");
    flipButton.textContent = showingBack ? "Lihat depan kartu" : "Lihat sisi lain";
    if (front) front.setAttribute("aria-hidden", showingBack ? "true" : "false");
    if (back) back.setAttribute("aria-hidden", showingBack ? "false" : "true");
  }

  function toggleFlip() {
    state.targetFlip = state.targetFlip === 0 ? 1 : 0;
    updateFlipButton();
    if (reduceMotion) renderStatic();
    else startLoop();
  }

  if (flipButton) {
    flipButton.addEventListener("click", toggleFlip);
    updateFlipButton();
  }

  if (!reduceMotion) {
    card.addEventListener("dragstart", (event) => event.preventDefault());

    card.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (!state.nodes) return;
      event.preventDefault();
      state.dragging = true;
      state.pointerId = event.pointerId;
      const rect = root.getBoundingClientRect();
      state.pointer = {
        x: clamp(event.clientX - rect.left, (state.cardW / 2) + 10, state.width - (state.cardW / 2) - 10),
        y: clamp(event.clientY - rect.top, 0, state.height - state.cardH - 8)
      };
      card.classList.add("grabbing");
      try {
        card.setPointerCapture(event.pointerId);
      } catch {}
      startLoop();
    });

    card.addEventListener("touchmove", (event) => {
      if (state.dragging) event.preventDefault();
    }, { passive: false });

    window.addEventListener("pointermove", (event) => {
      if (!state.dragging || event.pointerId !== state.pointerId) return;
      const rect = root.getBoundingClientRect();
      state.pointer = {
        x: clamp(event.clientX - rect.left, (state.cardW / 2) + 10, state.width - (state.cardW / 2) - 10),
        y: clamp(event.clientY - rect.top, 0, state.height - state.cardH - 8)
      };
    }, { passive: true });

    const release = (event) => {
      if (!state.dragging || event.pointerId !== state.pointerId) return;
      state.dragging = false;
      state.pointer = null;
      state.pointerId = null;
      card.classList.remove("grabbing");
      if (card.hasPointerCapture(event.pointerId)) {
        try {
          card.releasePointerCapture(event.pointerId);
        } catch {}
      }
    };

    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", () => {
      state.dragging = false;
      state.pointer = null;
      state.pointerId = null;
      card.classList.remove("grabbing");
    });
  }

  function resize() {
    const measured = measure();
    if (!measured) return;
    if (reduceMotion) {
      renderStatic();
    } else {
      startLoop();
    }
  }

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(resize);
    observer.observe(root);
  } else {
    window.addEventListener("resize", resize);
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      state.visible = entries[0].isIntersecting;
      if (state.visible) {
        startLoop();
      }
    }, { threshold: 0.02 });
    observer.observe(root);
  }

  resize();
}
