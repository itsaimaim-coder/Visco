export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  let response;
  try {
    response = await fetch(path, {
      credentials: "same-origin",
      ...options,
      headers
    });
  } catch {
    const error = new Error("Tidak bisa terhubung ke server. Periksa koneksi lalu coba lagi.");
    error.status = 0;
    throw error;
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data && typeof data.error === "string"
      ? data.error
      : `Permintaan gagal (${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export function showStatus(element, text, state = "") {
  if (!element) return;
  element.textContent = text;
  if (state) {
    element.dataset.state = state;
  } else {
    delete element.dataset.state;
  }
}

export function setBusy(element, busy, busyLabel) {
  if (!element) return;
  if (busy) {
    if (!element.dataset.idleLabel) {
      element.dataset.idleLabel = element.textContent || "";
    }
    element.disabled = true;
    element.setAttribute("aria-busy", "true");
    if (busyLabel) element.textContent = busyLabel;
  } else {
    element.disabled = false;
    element.removeAttribute("aria-busy");
    if (element.dataset.idleLabel) {
      element.textContent = element.dataset.idleLabel;
      delete element.dataset.idleLabel;
    }
  }
}

export function formatDate(value, options = {}) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Waktu tidak tersedia";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    ...options
  }).format(date);
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
