import "./style.css";
import handleData from "./arenaAPI.js";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state = {
  currentImage: null,
  totalParts: 4,
  selectedPart: 0,
  loadedImage: null,
  gridMode: "dropdown",
};

let dockMinimized = false;
let cachedCtx = null;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function getImageBlocks(blocks) {
  return blocks
    .filter((b) => b.class === "Image" && b.image)
    .map((b) => ({
      id: b.id,
      title: b.title || b.generated_title || "Untitled",
      url: b.image?.display.url ?? "",
      originalUrl: b.image?.original.url ?? "",
    }));
}

function getGridDimensions(total) {
  if (total <= 0) return { cols: 1, rows: 1 };
  const sqrt = Math.sqrt(total);
  let rows = Math.floor(sqrt);
  while (total % rows !== 0 && rows > 1) rows--;
  return { cols: total / rows, rows };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Debounce utility
// ---------------------------------------------------------------------------

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ---------------------------------------------------------------------------
// Dropdown helpers
// ---------------------------------------------------------------------------

function toggleDropdown(menu, button) {
  const willOpen = !menu.classList.contains("dropdown-menu--open");
  menu.classList.toggle("dropdown-menu--open", willOpen);
  button.classList.toggle("dropdown-button--open", willOpen);
}

function closeDropdown(menu, button) {
  menu.classList.remove("dropdown-menu--open");
  button.classList.remove("dropdown-button--open");
}

function bindOutsideClick(container, menu, button) {
  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) closeDropdown(menu, button);
  });
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderCanvas() {
  const display = document.getElementById("image-display");
  if (!display || !state.loadedImage) return;

  let canvas = display.querySelector("canvas");
  if (!canvas) {
    display.innerHTML = "";
    const container = document.createElement("div");
    container.className = "image-display__container";
    canvas = document.createElement("canvas");
    canvas.className = "image-display__canvas";
    container.appendChild(canvas);
    display.appendChild(container);
    cachedCtx = null;
  }

  const img = state.loadedImage;
  const { cols, rows } = getGridDimensions(state.totalParts);
  const col = state.selectedPart % cols;
  const row = Math.floor(state.selectedPart / cols);

  const viewW = display.clientWidth || globalThis.innerWidth;
  const viewH = display.clientHeight || globalThis.innerHeight;

  const totalW = cols * viewW;
  const totalH = rows * viewH;

  const scale = Math.max(totalW / img.naturalWidth, totalH / img.naturalHeight);
  const scaledW = img.naturalWidth * scale;
  const scaledH = img.naturalHeight * scale;

  const offsetX = (totalW - scaledW) / 2;
  const offsetY = (totalH - scaledH) / 2;
  const srcX = (col * viewW - offsetX) / scale;
  const srcY = (row * viewH - offsetY) / scale;
  const srcW = viewW / scale;
  const srcH = viewH / scale;

  if (canvas.width !== viewW || canvas.height !== viewH) {
    canvas.width = viewW;
    canvas.height = viewH;
    canvas.style.width = `${viewW}px`;
    canvas.style.height = `${viewH}px`;
    cachedCtx = null;
  }

  const ctx = (cachedCtx ??= canvas.getContext("2d"));
  if (!ctx) return;

  ctx.clearRect(0, 0, viewW, viewH);
  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, viewW, viewH);
}

function loadAndRender(image) {
  state.currentImage = image;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    state.loadedImage = img;
    renderCanvas();
  };
  img.src = image.originalUrl || image.url;
}

// ---------------------------------------------------------------------------
// Dock: part selector
// ---------------------------------------------------------------------------

function selectPart(index) {
  state.selectedPart = index;
  updateGridSelector();
  updatePartDropdownButton();
  if (state.loadedImage) renderCanvas();
}

function updatePartDropdownButton() {
  const textEl = document
    .getElementById("part-dropdown-button")
    ?.querySelector(".dropdown-button__text");
  if (textEl) textEl.textContent = String(state.selectedPart + 1);
}

function updatePartDropdownMenu() {
  const menu = document.getElementById("part-dropdown-menu");
  if (!menu) return;

  menu.innerHTML = "";

  for (let i = 0; i < state.totalParts; i++) {
    const item = document.createElement("button");
    item.className = "dropdown-menu__item";
    if (i === state.selectedPart)
      item.classList.add("dropdown-menu__item--active");
    item.textContent = String(i + 1);

    item.addEventListener("click", () => {
      selectPart(i);
      const btn = document.getElementById("part-dropdown-button");
      closeDropdown(menu, btn);
      menu
        .querySelectorAll(".dropdown-menu__item")
        .forEach((el) => el.classList.remove("dropdown-menu__item--active"));
      item.classList.add("dropdown-menu__item--active");
    });

    menu.appendChild(item);
  }
}

function updateGridSelector() {
  const grid = document.getElementById("part-grid");
  if (!grid) return;

  const { cols, rows } = getGridDimensions(state.totalParts);
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

  const existing = grid.querySelectorAll(".grid-selector__cell");
  const needed = state.totalParts;

  for (let i = existing.length; i < needed; i++) {
    const cell = document.createElement("button");
    cell.className = "grid-selector__cell";
    cell.textContent = String(i + 1);
    cell.addEventListener("click", () => selectPart(i));
    grid.appendChild(cell);
  }

  for (let i = grid.childElementCount - 1; i >= needed; i--) {
    grid.children.remove();
  }

  grid.querySelectorAll(".grid-selector__cell").forEach((cell, i) => {
    cell.classList.toggle(
      "grid-selector__cell--active",
      i === state.selectedPart,
    );
  });
}

// ---------------------------------------------------------------------------
// Dock: grid-mode toggle
// ---------------------------------------------------------------------------

const GRID_MODES = ["off", "dropdown", "grid"];

function toggleGridControls() {
  state.gridMode =
    GRID_MODES[(GRID_MODES.indexOf(state.gridMode) + 1) % GRID_MODES.length];

  document
    .querySelectorAll(".dock-section-dropdown")
    .forEach((el) =>
      el.classList.toggle(
        "dock-hidden-section--visible",
        state.gridMode === "dropdown",
      ),
    );
  document
    .querySelectorAll(".dock-section-grid")
    .forEach((el) =>
      el.classList.toggle(
        "dock-hidden-section--visible",
        state.gridMode === "grid",
      ),
    );
}

// ---------------------------------------------------------------------------
// Dock: minimise toggle
// ---------------------------------------------------------------------------

function toggleDockMinimized() {
  const dock = document.querySelector(".floating-dock");
  if (!dock) return;

  dockMinimized = !dockMinimized;
  dock.classList.toggle("floating-dock--minimized", dockMinimized);

  if (dockMinimized) {
    document.querySelectorAll(".dropdown-menu--open").forEach((menu) => {
      const btn = menu.previousElementSibling;
      if (btn) closeDropdown(menu, btn);
    });
  }
}

// ---------------------------------------------------------------------------
// DOM builders
// ---------------------------------------------------------------------------

function createImageDisplay() {
  const display = document.createElement("div");
  display.className = "image-display";
  display.id = "image-display";

  const placeholder = document.createElement("p");
  placeholder.className = "image-display__placeholder";
  placeholder.textContent = "Select an image from the dock below";
  display.appendChild(placeholder);

  return display;
}

function createDropdown(buttonContent, menuId, buttonId, extraClasses = "") {
  const container = document.createElement("div");
  container.className = `dropdown-container${extraClasses ? ` ${extraClasses}` : ""
    }`;

  const button = document.createElement("button");
  button.className = "dropdown-button";
  if (buttonId) button.id = buttonId;
  button.innerHTML = buttonContent;

  const menu = document.createElement("div");
  menu.className = "dropdown-menu";
  if (menuId) menu.id = menuId;

  button.addEventListener("click", () => toggleDropdown(menu, button));
  bindOutsideClick(container, menu, button);

  container.appendChild(button);
  container.appendChild(menu);

  return { container, button, menu };
}

function createDivider(extraClasses = "") {
  const el = document.createElement("div");
  el.className = `dock-divider${extraClasses ? ` ${extraClasses}` : ""}`;
  return el;
}

function createFloatingDock(images) {
  const dock = document.createElement("div");
  dock.className = "floating-dock";

  const dockContent = document.createElement("div");
  dockContent.className = "dock-content";

  const {
    container: imgContainer,
    button: imgButton,
    menu: imgMenu,
  } = createDropdown(
    `<span class="dropdown-button__text">Select an image</span>
     <svg class="dropdown-button__icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
       <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
     </svg>`,
    "dropdown-menu",
  );

  images.forEach((image) => {
    const item = document.createElement("button");
    item.className = "dropdown-menu__item";
    item.textContent = image.title;
    item.title = image.title;

    item.addEventListener("click", () => {
      loadAndRender(image);
      const textEl = imgButton.querySelector(".dropdown-button__text");
      if (textEl) textEl.textContent = image.title;
      closeDropdown(imgMenu, imgButton);
      imgMenu
        .querySelectorAll(".dropdown-menu__item")
        .forEach((el) => el.classList.remove("dropdown-menu__item--active"));
      item.classList.add("dropdown-menu__item--active");
    });

    imgMenu.appendChild(item);
  });

  const partsContainer = document.createElement("div");
  partsContainer.className = "parts-container";

  const partsLabel = document.createElement("label");
  partsLabel.className = "parts-label";
  partsLabel.textContent = "Parts";
  partsLabel.htmlFor = "parts-input";

  const partsInput = document.createElement("input");
  partsInput.className = "parts-input";
  partsInput.id = "parts-input";
  partsInput.type = "number";
  partsInput.min = "1";
  partsInput.max = "64";
  partsInput.value = String(state.totalParts);

  partsInput.addEventListener("change", () => {
    const val = clamp(parseInt(partsInput.value) || 1, 1, 64);
    partsInput.value = String(val);
    state.totalParts = val;
    if (state.selectedPart >= val) state.selectedPart = 0;
    updateGridSelector();
    updatePartDropdownMenu();
    updatePartDropdownButton();
    if (state.loadedImage) renderCanvas();
  });

  partsContainer.appendChild(partsLabel);
  partsContainer.appendChild(partsInput);

  const partButtonHTML = `
    <span class="dropdown-button__text">${state.selectedPart + 1}</span>
    <svg class="dropdown-button__icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  const {
    container: partContainer,
    button: partButton,
    menu: partMenu,
  } = createDropdown(
    partButtonHTML,
    "part-dropdown-menu",
    "part-dropdown-button",
    "dock-hidden-section dock-section-dropdown dock-hidden-section--visible",
  );
  partButton.classList.add("dropdown-button--compact");

  const gridContainer = document.createElement("div");
  gridContainer.className =
    "grid-selector dock-hidden-section dock-section-grid";

  const grid = document.createElement("div");
  grid.className = "grid-selector__grid";
  grid.id = "part-grid";
  gridContainer.appendChild(grid);

  const dockToggle = document.createElement("button");
  dockToggle.className = "dock-toggle";
  dockToggle.setAttribute("aria-label", "Toggle dock");
  dockToggle.innerHTML = `
    <svg class="dock-toggle__icon dock-toggle__icon--collapse" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <svg class="dock-toggle__icon dock-toggle__icon--expand" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="5" height="5" rx="1" fill="currentColor" opacity="0.9"/>
      <rect x="9" y="2" width="5" height="5" rx="1" fill="currentColor" opacity="0.6"/>
      <rect x="2" y="9" width="5" height="5" rx="1" fill="currentColor" opacity="0.6"/>
      <rect x="9" y="9" width="5" height="5" rx="1" fill="currentColor" opacity="0.4"/>
    </svg>`;
  dockToggle.addEventListener("click", toggleDockMinimized);

  dockContent.append(
    imgContainer,
    createDivider(),
    partsContainer,
    createDivider(
      "dock-hidden-section dock-section-dropdown dock-hidden-section--visible",
    ),
    partContainer,
    createDivider("dock-hidden-section dock-section-grid"),
    gridContainer,
    createDivider("dock-toggle-divider"),
    dockToggle,
  );
  dock.appendChild(dockContent);

  requestAnimationFrame(() => {
    updateGridSelector();
    updatePartDropdownMenu();
  });

  return dock;
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

function showLoading(app) {
  app.innerHTML = '<div class="loading">Loading…</div>';
}

function showError(app, message) {
  app.innerHTML = `<div class="error">${message}</div>`;
}

async function init() {
  const app = document.querySelector("#app");
  if (!app) {
    console.error("App container not found");
    return;
  }

  showLoading(app);

  try {
    const arenaData = await handleData();
    const images = getImageBlocks(arenaData.contents);

    app.innerHTML = "";

    const container = document.createElement("div");
    container.className = "container";
    container.appendChild(createImageDisplay());

    app.appendChild(container);
    document.body.appendChild(createFloatingDock(images));

    globalThis.addEventListener("resize", debounce(renderCanvas, 100));

    document.addEventListener("keydown", (e) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === "g" || e.key === "G") toggleGridControls();
    });
  } catch (err) {
    console.error("Failed to load Arena data:", err);
    showError(app, "Failed to load images. Please try again later.");
  }
}

globalThis.onload = init;
