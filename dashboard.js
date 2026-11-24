import { api, showStatus, setBusy, formatDate } from "./shared.js";

const list = document.querySelector("#letter-list");
if (list) initDashboard();

function initDashboard() {
  const status = document.querySelector("#dash-status");
  const stateBox = document.querySelector("#dash-state");
  const search = document.querySelector("#search");
  const filters = Array.from(document.querySelectorAll("[data-filter]"));
  const logout = document.querySelector("#logout-button");
  const total = document.querySelector("#count-total");
  const countBaru = document.querySelector("#count-baru");
  const countDibaca = document.querySelector("#count-dibaca");
  const countSelesai = document.querySelector("#count-selesai");

  const state = {
    items: [],
    filter: "semua",
    query: ""
  };

  let searchTimer = 0;
  let cardSequence = 0;

  function updateCounts() {
    const counts = { total: state.items.length, baru: 0, dibaca: 0, selesai: 0 };
    for (const item of state.items) {
      if (Object.prototype.hasOwnProperty.call(counts, item.status)) {
        counts[item.status] += 1;
      }
    }
    total.textContent = String(counts.total);
    countBaru.textContent = String(counts.baru);
    countDibaca.textContent = String(counts.dibaca);
    countSelesai.textContent = String(counts.selesai);
  }

  function renderState(title, text, actionLabel, action) {
    stateBox.replaceChildren();
    const heading = document.createElement("h3");
    heading.textContent = title;
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    stateBox.append(heading, paragraph);

    if (actionLabel && action) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "text-button";
      button.textContent = actionLabel;
      button.addEventListener("click", action);
      stateBox.append(button);
    }

    stateBox.hidden = false;
  }

  function filterItems() {
    return state.items.filter((item) => {
      if (state.filter !== "semua" && item.status !== state.filter) return false;
      if (!state.query) return true;
      const haystack = [item.name, item.className, item.message]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(state.query);
    });
  }

  function resetFilters() {
    state.filter = "semua";
    state.query = "";
    search.value = "";
    for (const button of filters) {
      button.setAttribute("aria-pressed", button.dataset.filter === "semua" ? "true" : "false");
    }
    render();
    search.focus();
  }

  function render() {
    const items = filterItems();
    list.replaceChildren();
    updateCounts();

    if (!items.length) {
      stateBox.hidden = true;
      if (state.items.length) {
        renderState(
          "Tidak ada surat yang cocok.",
          "Coba kata kunci lain atau tampilkan semua status.",
          "Tampilkan semua surat",
          resetFilters
        );
        showStatus(status, `${items.length} dari ${state.items.length} surat ditampilkan.`);
      } else {
        renderState(
          "Kotak masuk masih kosong.",
          "Surat dari siswa akan muncul di sini setelah dikirim."
        );
        showStatus(status, "Kotak masuk masih kosong.");
      }
      return;
    }

    stateBox.hidden = true;
    const fragment = document.createDocumentFragment();
    for (const item of items) {
      fragment.append(createLetter(item));
    }
    list.append(fragment);

    if (items.length === state.items.length) {
      showStatus(status, `${state.items.length} surat di kotak masuk.`);
    } else {
      showStatus(status, `${items.length} dari ${state.items.length} surat ditampilkan.`);
    }
  }

  function statusLabel(value) {
    if (value === "dibaca") return "Dibaca";
    if (value === "selesai") return "Selesai";
    return "Baru";
  }

  function createStatusSelect(item) {
    const wrapper = document.createElement("label");
    wrapper.className = "sr-only";
    wrapper.textContent = `Status surat dari ${item.name || "anonim"}`;
    const select = document.createElement("select");
    select.className = "status-select";
    select.id = `status-${item.id}`;
    wrapper.htmlFor = select.id;

    for (const value of ["baru", "dibaca", "selesai"]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = statusLabel(value);
      select.append(option);
    }

    select.value = item.status;
    select.addEventListener("change", () => updateStatus(item, select));
    return { wrapper, select };
  }

  function createLetter(item) {
    const article = document.createElement("article");
    article.className = "letter-card";
    article.dataset.status = item.status;

    const heading = document.createElement("h3");
    heading.className = "sr-only";
    heading.id = `letter-title-${cardSequence += 1}`;
    heading.textContent = `Surat dari ${item.name || "anonim"}`;
    article.setAttribute("aria-labelledby", heading.id);

    const head = document.createElement("div");
    head.className = "letter-head";

    const meta = document.createElement("div");
    meta.className = "letter-meta";

    const from = document.createElement("span");
    from.className = "letter-from";
    from.textContent = item.name || "Anonim";

    const to = document.createElement("span");
    to.className = "letter-to";
    to.textContent = item.className ? `Kelas ${item.className}` : "Tanpa kelas";

    meta.append(from, to);

    const time = document.createElement("time");
    time.className = "letter-time";
    time.dateTime = item.createdAt || "";
    time.textContent = formatDate(item.createdAt);

    head.append(meta, time);

    const message = document.createElement("p");
    message.className = "letter-message";
    message.textContent = item.message;

    const foot = document.createElement("div");
    foot.className = "letter-foot";

    const badge = document.createElement("span");
    badge.className = "status-badge";
    badge.dataset.status = item.status;
    badge.textContent = statusLabel(item.status);

    const actions = document.createElement("div");
    actions.className = "letter-actions";

    const statusSelect = createStatusSelect(item);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "button button-quiet button-small letter-delete";
    remove.textContent = "Hapus";
    remove.setAttribute("aria-label", `Hapus surat dari ${item.name || "anonim"}`);
    remove.addEventListener("click", () => deleteLetter(item, remove));

    actions.append(statusSelect.wrapper, statusSelect.select, remove);
    foot.append(badge, actions);
    article.append(heading, head, message, foot);
    return article;
  }

  async function updateStatus(item, select) {
    const nextStatus = select.value;
    const previousStatus = item.status;

    if (nextStatus === previousStatus) return;
    select.disabled = true;

    try {
      const data = await api(`/api/aspirations/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus })
      });
      item.status = data.item && data.item.status ? data.item.status : nextStatus;
      select.value = item.status;

      const card = select.closest(".letter-card");
      const badge = card ? card.querySelector(".status-badge") : null;
      if (badge) {
        badge.dataset.status = item.status;
        badge.textContent = statusLabel(item.status);
      }

      updateCounts();
      showStatus(status, "Status surat diperbarui.");

      if (state.filter !== "semua" && state.filter !== item.status) {
        render();
        showStatus(status, "Status surat diperbarui.");
      } else {
        stateBox.hidden = true;
      }
    } catch (error) {
      select.value = previousStatus;
      if (error.status === 401) {
        window.location.replace("/masuk");
        return;
      }
      showStatus(status, error.message, "error");
    } finally {
      select.disabled = false;
    }
  }

  async function deleteLetter(item, button) {
    if (!window.confirm("Hapus surat ini? Tindakan ini tidak bisa dibatalkan.")) return;
    button.disabled = true;

    try {
      await api(`/api/aspirations/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      state.items = state.items.filter((entry) => entry.id !== item.id);
      render();
      showStatus(status, "Surat dihapus.");
    } catch (error) {
      if (error.status === 401) {
        window.location.replace("/masuk");
        return;
      }
      showStatus(status, error.message, "error");
      button.disabled = false;
    }
  }

  for (const button of filters) {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      for (const filterButton of filters) {
        filterButton.setAttribute("aria-pressed", filterButton === button ? "true" : "false");
      }
      render();
    });
  }

  search.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      state.query = search.value.trim().toLowerCase();
      render();
    }, 120);
  });

  if (logout) {
    logout.addEventListener("click", async () => {
      setBusy(logout, true, "Keluar...");
      try {
        await api("/api/logout", { method: "POST" });
        window.location.replace("/");
      } catch (error) {
        showStatus(status, error.message, "error");
        setBusy(logout, false);
      }
    });
  }

  async function load() {
    list.setAttribute("aria-busy", "true");
    showStatus(status, "Memuat surat...");
    renderState("Memuat surat.", "Sebentar, kotak masuk sedang dibuka.");

    try {
      const data = await api("/api/aspirations");
      state.items = Array.isArray(data.items) ? data.items : [];
      render();
    } catch (error) {
      if (error.status === 401) {
        window.location.replace("/masuk");
        return;
      }
      list.replaceChildren();
      stateBox.hidden = true;
      renderState(
        "Tidak bisa memuat surat.",
        error.message,
        "Coba lagi",
        load
      );
      showStatus(status, error.message, "error");
    } finally {
      list.setAttribute("aria-busy", "false");
    }
  }

  load();
}
