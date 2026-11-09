const img = document.getElementById("map-image");
const canvas = document.getElementById("highlight");
const profileEl = document.getElementById("profile");
const listEl = document.getElementById("hood-list");
const searchEl = document.getElementById("search");
const hintEl = document.getElementById("map-hint");
const mapView = document.getElementById("map-view");
const aboutView = document.getElementById("about-view");
const aboutContent = document.getElementById("about-content");
const viewLinks = document.querySelectorAll(".topbar a[data-view]");

const hitImage = new Image();
hitImage.src = "hitmap.png";

let hitData = null;
let selectedName = null;
let profileToken = 0;
let aboutLoaded = false;

const idToName = {};
NEIGHBORHOODS.forEach((entry, index) => {
  idToName[index + 1] = entry.name;
});

function pageFor(name) {
  return NEIGHBORHOODS.find((entry) => entry.name === name);
}

function mountHtml(container, html, pageUrl) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const base = new URL(pageUrl, window.location.href);
  doc.querySelectorAll("[src], a[href]").forEach((el) => {
    const attr = el.hasAttribute("src") ? "src" : "href";
    const value = el.getAttribute(attr);
    if (!value || /^(https?:|data:|mailto:|#)/.test(value)) return;
    el.setAttribute(attr, new URL(value, base).href);
  });
  container.replaceChildren(...doc.body.childNodes);
}

async function renderProfile(name) {
  const token = ++profileToken;
  if (!name) {
    profileEl.className = "profile empty";
    profileEl.innerHTML = `
      <h2>Select a neighborhood</h2>
      <p>Click a highlighted area on the map, or choose a name from the list.</p>
    `;
    return;
  }

  const entry = pageFor(name);
  profileEl.className = "profile";
  profileEl.innerHTML = `<h2></h2><p>Loading…</p>`;
  profileEl.querySelector("h2").textContent = name;
  if (!entry) return;

  try {
    const response = await fetch(entry.page);
    if (!response.ok) throw new Error(String(response.status));
    const html = await response.text();
    if (token !== profileToken) return;
    mountHtml(profileEl, html, entry.page);
  } catch (error) {
    if (token !== profileToken) return;
    profileEl.innerHTML = `<h2></h2><p>This neighborhood page could not be loaded.</p>`;
    profileEl.querySelector("h2").textContent = name;
  }
}

function renderList(query) {
  const needle = query.trim().toLowerCase();
  const visible = NEIGHBORHOODS.filter((entry) => entry.name.toLowerCase().includes(needle));
  listEl.innerHTML = visible.map((entry) => `
    <li>
      <button type="button" data-name="${entry.name}" ${entry.name === selectedName ? 'aria-current="true"' : ""}>
        ${entry.name}
      </button>
    </li>
  `).join("");
}

function resizeCanvas() {
  const rect = img.getBoundingClientRect();
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
}

function drawHighlight(name) {
  if (mapView.hidden) return;
  resizeCanvas();
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!name || !hitData) return;

  const ids = new Set();
  const direct = Object.keys(idToName).find((id) => idToName[id] === name);
  if (direct) ids.add(Number(direct));
  if (!ids.size) return;

  const overlay = ctx.createImageData(canvas.width, canvas.height);
  const src = hitData.data;
  const dst = overlay.data;
  for (let i = 0; i < src.length; i += 4) {
    if (!ids.has(src[i])) continue;
    dst[i] = 255;
    dst[i + 1] = 186;
    dst[i + 2] = 48;
    dst[i + 3] = 175;
  }
  ctx.putImageData(overlay, 0, 0);
}

function pixelFromEvent(event) {
  const rect = img.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) * (img.naturalWidth / rect.width));
  const y = Math.floor((event.clientY - rect.top) * (img.naturalHeight / rect.height));
  return { x, y };
}

function nameAtPixel(x, y) {
  if (!hitData) return null;
  if (x < 0 || y < 0 || x >= hitImage.width || y >= hitImage.height) return null;
  const offset = (y * hitImage.width + x) * 4;
  const id = hitData.data[offset];
  return idToName[id] || null;
}

function selectNeighborhood(name) {
  selectedName = name;
  renderProfile(name);
  renderList(searchEl.value);
  drawHighlight(name);
  hintEl.textContent = name;
  const button = listEl.querySelector(`button[data-name="${CSS.escape(name)}"]`);
  if (button) button.scrollIntoView({ block: "nearest" });
}

async function showAbout() {
  if (aboutLoaded) return;
  aboutLoaded = true;
  try {
    const response = await fetch("about.html");
    if (!response.ok) throw new Error(String(response.status));
    mountHtml(aboutContent, await response.text(), "about.html");
  } catch (error) {
    aboutLoaded = false;
    aboutContent.innerHTML = "<h1>About</h1><p>The about page could not be loaded.</p>";
  }
}

function showView(view) {
  const about = view === "about";
  mapView.hidden = about;
  aboutView.hidden = !about;
  viewLinks.forEach((link) => {
    if (link.dataset.view === view) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (about) showAbout();
  else drawHighlight(selectedName);
}

img.addEventListener("click", (event) => {
  const { x, y } = pixelFromEvent(event);
  const name = nameAtPixel(x, y);
  if (name) selectNeighborhood(name);
});

img.addEventListener("mousemove", (event) => {
  const { x, y } = pixelFromEvent(event);
  const name = nameAtPixel(x, y);
  img.style.cursor = name ? "pointer" : "default";
  if (!selectedName) hintEl.textContent = name || "Click a neighborhood";
});

img.addEventListener("mouseleave", () => {
  hintEl.textContent = selectedName || "Click a neighborhood";
});

listEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-name]");
  if (button) selectNeighborhood(button.dataset.name);
});

searchEl.addEventListener("input", () => renderList(searchEl.value));
window.addEventListener("resize", () => drawHighlight(selectedName));
window.addEventListener("hashchange", () => {
  showView(location.hash === "#about" ? "about" : "map");
});

hitImage.onload = () => {
  const scratch = document.createElement("canvas");
  scratch.width = hitImage.width;
  scratch.height = hitImage.height;
  const ctx = scratch.getContext("2d");
  ctx.drawImage(hitImage, 0, 0);
  hitData = ctx.getImageData(0, 0, hitImage.width, hitImage.height);
  if (selectedName) drawHighlight(selectedName);
};

img.addEventListener("load", () => drawHighlight(selectedName));

renderProfile(null);
renderList("");
showView(location.hash === "#about" ? "about" : "map");
