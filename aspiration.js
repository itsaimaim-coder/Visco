import { api, showStatus, setBusy, clamp } from "./shared.js";

const form = document.querySelector("#aspiration-form");
if (form) initAspirationForm(form);

function initAspirationForm(root) {
  const panel = root.closest(".letter-panel");
  const stage = document.querySelector("#box-stage");
  const status = document.querySelector("#form-status");
  const submit = document.querySelector("#submit-button");
  const message = document.querySelector("#message");
  const count = document.querySelector("#char-count");
  const error = document.querySelector("#message-error");
  const anonymous = document.querySelector("#anonymous");
  const name = document.querySelector("#name");
  const className = document.querySelector("#className");

  function updateAnonymousFields() {
    const isAnonymous = anonymous.checked;
    name.disabled = isAnonymous;
    className.disabled = isAnonymous;
    if (isAnonymous) {
      name.value = "";
      className.value = "";
    }
  }

  function updateCount() {
    count.textContent = String(message.value.length);
  }

  function clearMessageError() {
    message.removeAttribute("aria-invalid");
    if (error) {
      error.hidden = true;
      error.textContent = "";
    }
  }

  function showMessageError(text) {
    message.setAttribute("aria-invalid", "true");
    if (error) {
      error.textContent = text;
      error.hidden = false;
    }
    showStatus(status, text, "error");
    message.focus();
  }

  anonymous.addEventListener("change", updateAnonymousFields);
  updateAnonymousFields();

  message.addEventListener("input", () => {
    updateCount();
    if (message.value.trim().length >= 10) {
      clearMessageError();
      if (status.dataset.state === "error") showStatus(status, "");
    }
  });
  updateCount();

  root.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessageError();

    const text = message.value.trim();
    if (text.length < 10) {
      showMessageError("Tulis minimal 10 karakter agar pengurus paham maksud suratmu.");
      return;
    }
    if (text.length > 2000) {
      showMessageError("Isi aspirasi maksimal 2000 karakter.");
      return;
    }

    showStatus(status, "");
    setBusy(submit, true, "Memasukkan surat...");

    try {
      await api("/api/aspirations", {
        method: "POST",
        body: JSON.stringify({
          name: name.value.trim(),
          className: className.value.trim(),
          message: text,
          anonymous: anonymous.checked
        })
      });

      root.reset();
      updateAnonymousFields();
      updateCount();
      showStatus(status, "Surat sedang dimasukkan ke kotak...");
      await flyLetter(panel, stage, message);
      showStatus(status, "Surat sudah masuk ke kotak. Terima kasih.");
    } catch (requestError) {
      showStatus(status, requestError.message, "error");
    } finally {
      setBusy(submit, false);
    }
  });
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

let lockedScrollY = 0;
let scrollLocked = false;

function lockScroll() {
  if (scrollLocked) return;
  scrollLocked = true;
  lockedScrollY = window.scrollY;
  document.documentElement.style.overflow = "hidden";
  document.body.classList.add("is-letter-flying");
  document.body.style.position = "fixed";
  document.body.style.top = `-${lockedScrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}

function unlockScroll() {
  if (!scrollLocked) return;
  scrollLocked = false;
  document.documentElement.style.overflow = "";
  document.body.classList.remove("is-letter-flying");
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  const previousBehavior = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = "auto";
  window.scrollTo(0, lockedScrollY);
  document.documentElement.style.scrollBehavior = previousBehavior;
}

async function flyLetter(panel, stage, source) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!stage) return;

  if (reduceMotion) {
    stage.classList.add("is-receiving");
    await wait(520);
    stage.classList.remove("is-receiving");
    return;
  }

  const slot = stage.querySelector(".box-slot");
  if (!panel || !slot) return;

  const stageRect = stage.getBoundingClientRect();
  if (stageRect.top > window.innerHeight - 96 || stageRect.bottom < 96) {
    stage.scrollIntoView({ behavior: "smooth", block: "center" });
    await wait(500);
  }

  lockScroll();

  try {
    const sourceRect = (source || panel).getBoundingClientRect();
    const slotRect = slot.getBoundingClientRect();
    const letter = document.createElement("span");
    letter.className = "flight-letter";
    letter.setAttribute("aria-hidden", "true");

    const halfWidth = 60;
    const halfHeight = 41;
    const startX = clamp(
      sourceRect.left + (sourceRect.width / 2) - halfWidth,
      halfWidth + 8,
      window.innerWidth - halfWidth - 8
    );
    let startY = sourceRect.top + (sourceRect.height / 2) - halfHeight;
    let sourceOffscreen = false;
    if (sourceRect.bottom < 0 || startY < -24) {
      startY = -30;
      sourceOffscreen = true;
    } else if (sourceRect.top > window.innerHeight) {
      startY = window.innerHeight + 20;
      sourceOffscreen = true;
    }

    const endX = slotRect.left + (slotRect.width / 2) - halfWidth;
    const endY = slotRect.top + (slotRect.height / 2) - halfHeight;
    const dx = endX - startX;
    const dy = endY - startY;
    const lift = sourceOffscreen ? 0 : Math.min(130, 50 + Math.abs(dx) * 0.16);
    const earlyY = sourceOffscreen ? dy * 0.12 : -lift;

    letter.style.left = `${startX}px`;
    letter.style.top = `${startY}px`;
    document.body.append(letter);

    if (typeof letter.animate !== "function") {
      letter.remove();
      stage.classList.add("is-receiving");
      await wait(1900);
      return;
    }

    stage.classList.add("is-receiving");

    const animation = letter.animate([
      {
        transform: "translate3d(0, 0, 0) rotate(-3deg) scale(1)",
        opacity: 1,
        offset: 0,
        easing: "cubic-bezier(0.45, 0, 0.55, 1)"
      },
      {
        transform: `translate3d(${dx * 0.3}px, ${earlyY}px, 0) rotate(-6deg) scale(1.03)`,
        opacity: 1,
        offset: 0.28,
        easing: "cubic-bezier(0.4, 0, 0.6, 1)"
      },
      {
        transform: `translate3d(${dx * 0.75}px, ${(dy * 0.35) - (lift * 0.25)}px, 0) rotate(4deg) scale(0.86)`,
        opacity: 1,
        offset: 0.62,
        easing: "cubic-bezier(0.4, 0, 0.6, 1)"
      },
      {
        transform: `translate3d(${dx * 0.94}px, ${dy * 0.72}px, 0) rotate(7deg) scale(0.78)`,
        opacity: 1,
        offset: 0.82,
        easing: "cubic-bezier(0.55, 0, 0.85, 0.4)"
      },
      {
        transform: `translate3d(${dx * 0.985}px, ${dy * 0.92}px, 0) rotate(10deg) scale(0.48)`,
        opacity: 0.75,
        offset: 0.93,
        easing: "cubic-bezier(0.6, 0, 0.9, 0.5)"
      },
      {
        transform: `translate3d(${dx}px, ${dy}px, 0) rotate(12deg) scale(0.16)`,
        opacity: 0,
        offset: 1
      }
    ], {
      duration: 1500,
      easing: "linear",
      fill: "forwards"
    });

    await new Promise((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        letter.remove();
        resolve();
      };
      animation.onfinish = finish;
      animation.oncancel = finish;
    });

    await wait(400);
  } finally {
    stage.classList.remove("is-receiving");
    unlockScroll();
  }
}
