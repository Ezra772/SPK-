const STORAGE_KEY = "spk_laundry_profile_matching_v2";

const criteria = [
  {
    id: "C1",
    name: "Harga per Kg",
    type: "Cost",
    factor: "secondary",
    criterionWeight: 10,
    ideal: 5,
    note: "Nilai 5 berarti harga paling murah, yaitu <= Rp 4.000/kg."
  },
  {
    id: "C2",
    name: "Kecepatan Pengerjaan",
    type: "Benefit",
    factor: "core",
    criterionWeight: 20,
    ideal: 5,
    note: "Nilai 5 berarti pengerjaan sangat cepat, kurang dari 4 jam."
  },
  {
    id: "C3",
    name: "Kualitas Cucian",
    type: "Benefit",
    factor: "core",
    criterionWeight: 15,
    ideal: 5,
    note: "Nilai 5 berarti cucian sangat bersih, wangi tahan lama, dan rapi."
  },
  {
    id: "C4",
    name: "Jarak dari Kos/Kampus",
    type: "Cost",
    factor: "secondary",
    criterionWeight: 10,
    ideal: 5,
    note: "Nilai 5 berarti lokasi sangat dekat, <= 200 meter."
  },
  {
    id: "C5",
    name: "Pelayanan & Respons",
    type: "Benefit",
    factor: "core",
    criterionWeight: 25,
    ideal: 5,
    note: "Nilai 5 berarti staff sangat ramah, respons real-time, dan ada garansi."
  },
  {
    id: "C6",
    name: "Tingkat Kesalahan",
    type: "Cost",
    factor: "secondary",
    criterionWeight: 20,
    ideal: 5,
    note: "Nilai 5 berarti tidak pernah ada kesalahan pakaian hilang, tertukar, atau rusak."
  }
];

const gapWeights = {
  "0": 5,
  "1": 4.5,
  "-1": 4,
  "2": 3.5,
  "-2": 3,
  "3": 2.5,
  "-3": 2,
  "4": 1.5,
  "-4": 1
};

const factorWeights = {
  core: 0.6,
  secondary: 0.4
};

const scoreValues = [1, 2, 3, 4, 5];
const orderedGaps = [0, 1, -1, 2, -2, 3, -3, 4, -4];

const surveySummary = [
  { id: "C1", average: 4.23, dominant: 4, label: "Harga per Kilogram" },
  { id: "C2", average: 4.32, dominant: 4, label: "Kecepatan Pengerjaan" },
  { id: "C3", average: 4.52, dominant: 5, label: "Kualitas Hasil Cucian" },
  { id: "C4", average: 4.05, dominant: 4, label: "Jarak dari Tempat Tinggal" },
  { id: "C5", average: 4.55, dominant: 5, label: "Pelayanan dan Respons" },
  { id: "C6", average: 4.36, dominant: 4, label: "Tingkat Kerusakan atau Kesalahan" }
];

const defaultAlternatives = [
  { id: "A1", name: "Laundry family", scores: { C1: 4, C2: 4, C3: 5, C4: 3, C5: 4, C6: 4 } },
  { id: "A2", name: "Lore laundry", scores: { C1: 3, C2: 5, C3: 4, C4: 4, C5: 4, C6: 3 } },
  { id: "A3", name: "Monica Laundry", scores: { C1: 3, C2: 4, C3: 4, C4: 3, C5: 4, C6: 4 } },
  { id: "A4", name: "Hanif Laundry", scores: { C1: 5, C2: 3, C3: 3, C4: 5, C5: 3, C6: 3 } },
  { id: "A5", name: "Salma laundry", scores: { C1: 3, C2: 5, C3: 4, C4: 3, C5: 5, C6: 4 } }
];

let alternatives = loadAlternatives();
let selectedAlternativeId = null;

const $ = (selector, root = document) => root.querySelector(selector);

function loadAlternatives() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaultAlternatives);

  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Data kosong");
    return parsed;
  } catch (error) {
    console.warn("Gagal membaca localStorage, memakai data default.", error);
    return structuredClone(defaultAlternatives);
  }
}

function saveAlternatives() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alternatives));
  $("#stat-alternatives").textContent = alternatives.length;
}

function findAlternative(id) {
  return alternatives.find((item) => item.id === id);
}

function refreshAlternativeViews({ includeTable = false } = {}) {
  saveAlternatives();
  if (includeTable) renderAlternativeTable();
  renderRanking();
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value) {
  return Number(value).toFixed(2);
}

function getGapWeight(gap) {
  return gapWeights[String(gap)] ?? 1;
}

function weightedAverage(items, factor) {
  const filtered = items.filter((item) => item.factor === factor);
  const totalWeight = filtered.reduce((sum, item) => sum + item.criterionWeight, 0);
  if (totalWeight === 0) return 0;
  return filtered.reduce((sum, item) => sum + item.gapWeight * item.criterionWeight, 0) / totalWeight;
}

function calculateAlternative(alternative) {
  const details = criteria.map((criterion) => {
    const score = Number(alternative.scores[criterion.id]) || 1;
    const gap = score - criterion.ideal;
    return {
      ...criterion,
      score,
      gap,
      gapWeight: getGapWeight(gap)
    };
  });

  const coreScore = weightedAverage(details, "core");
  const secondaryScore = weightedAverage(details, "secondary");
  const finalScore = coreScore * factorWeights.core + secondaryScore * factorWeights.secondary;

  return {
    ...alternative,
    details,
    coreScore,
    secondaryScore,
    finalScore
  };
}

function calculateRankings() {
  return alternatives
    .map(calculateAlternative)
    .sort((a, b) => {
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      if (b.coreScore !== a.coreScore) return b.coreScore - a.coreScore;
      return b.secondaryScore - a.secondaryScore;
    })
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

function createScoreOptions(selectedValue) {
  return scoreValues
    .map((value) => `<option value="${value}" ${Number(selectedValue) === value ? "selected" : ""}>${value}</option>`)
    .join("");
}

function createAlternativeScoreCell(alternative, criterion) {
  return `
    <td>
      <select class="score-select" data-action="score" data-id="${alternative.id}" data-criterion="${criterion.id}" aria-label="${criterion.name} untuk ${alternative.name}">
        ${createScoreOptions(alternative.scores[criterion.id])}
      </select>
    </td>
  `;
}

function createAlternativeRow(alternative) {
  const scoreCells = criteria.map((criterion) => createAlternativeScoreCell(alternative, criterion)).join("");

  return `
    <tr>
      <td class="code-cell">${alternative.id}</td>
      <td>
        <input class="name-input" data-action="name" data-id="${alternative.id}" value="${escapeHTML(alternative.name)}" aria-label="Nama ${alternative.id}" />
      </td>
      ${scoreCells}
      <td>
        <button class="icon-btn" data-action="delete" data-id="${alternative.id}" title="Hapus ${escapeHTML(alternative.name)}">Hapus</button>
      </td>
    </tr>
  `;
}

function createRankingRow(item) {
  const percentage = Math.min(100, (item.finalScore / 5) * 100);

  return `
    <tr data-id="${item.id}" class="${item.id === selectedAlternativeId ? "active" : ""}">
      <td><span class="rank-number">${item.rank}</span></td>
      <td><strong>${escapeHTML(item.name)}</strong><br><span class="muted">${item.id}</span></td>
      <td>${formatNumber(item.coreScore)}</td>
      <td>${formatNumber(item.secondaryScore)}</td>
      <td class="final-score">${formatNumber(item.finalScore)}</td>
      <td><div class="bar" aria-hidden="true"><div class="bar-fill" style="--bar:${percentage}%"></div></div></td>
    </tr>
  `;
}

function createDetailRow(detail) {
  return `
    <tr>
      <td><strong>${detail.id}</strong><br><span class="muted">${detail.factor === "core" ? "CF" : "SF"}</span></td>
      <td>${detail.score}</td>
      <td>${detail.gap > 0 ? "+" : ""}${detail.gap}</td>
      <td>${detail.gapWeight}</td>
    </tr>
  `;
}

function renderCriteria() {
  const container = $("#criteria-list");
  container.innerHTML = criteria
    .map((criterion) => `
      <article class="criteria-card">
        <div class="criteria-top">
          <div class="criteria-title">
            <span class="badge">${criterion.id}</span>
            <span>${criterion.name}</span>
          </div>
          <span class="badge ${criterion.factor}">${criterion.factor === "core" ? "Core" : "Secondary"}</span>
        </div>
        <p>${criterion.type} - Bobot kriteria ${criterion.criterionWeight}% - Ideal ${criterion.ideal}</p>
        <p>${criterion.note}</p>
      </article>
    `)
    .join("");
}

function renderSurveySummary() {
  const container = $("#survey-list");
  container.innerHTML = surveySummary
    .map((item) => {
      const width = Math.min(100, (item.average / 5) * 100);
      return `
        <article class="survey-item">
          <div class="survey-top">
            <strong>${item.id} - ${item.label}</strong>
            <span class="badge">${formatNumber(item.average)}</span>
          </div>
          <div class="bar" aria-hidden="true"><div class="bar-fill" style="--bar:${width}%"></div></div>
          <p>Rata-rata ${formatNumber(item.average)} dari 5 - Modus ${item.dominant}</p>
        </article>
      `;
    })
    .join("");
}

function renderGapGrid() {
  $("#gap-grid").innerHTML = orderedGaps
    .map((gap) => `
      <div class="gap-item">
        <strong>${gap > 0 ? "+" : ""}${gap}</strong>
        <span>Bobot ${gapWeights[String(gap)]}</span>
      </div>
    `)
    .join("");
}

function renderAlternativeTable() {
  const body = $("#alternative-body");
  body.innerHTML = alternatives.map(createAlternativeRow).join("");
}

function renderRanking() {
  const rankings = calculateRankings();
  if (!selectedAlternativeId || !rankings.some((item) => item.id === selectedAlternativeId)) {
    selectedAlternativeId = rankings[0]?.id ?? null;
  }

  const body = $("#ranking-body");
  body.innerHTML = rankings.map(createRankingRow).join("");

  renderTopRecommendation(rankings[0]);
  renderDetail(rankings.find((item) => item.id === selectedAlternativeId) || rankings[0]);
}

function renderTopRecommendation(top) {
  if (!top) {
    $("#top-name").textContent = "-";
    $("#top-score").textContent = "0.00";
    $("#top-summary").textContent = "Belum ada data laundry.";
    return;
  }
  $("#top-name").textContent = top.name;
  $("#top-score").textContent = formatNumber(top.finalScore);
  $("#top-summary").textContent = `${top.name} menjadi rekomendasi terbaik karena memperoleh NCF ${formatNumber(top.coreScore)} dan NSF ${formatNumber(top.secondaryScore)}.`;
}

function renderDetail(item) {
  if (!item) {
    $("#detail-title").textContent = "Pilih alternatif";
    $("#detail-score").textContent = "-";
    $("#detail-table").innerHTML = "";
    return;
  }

  $("#detail-title").textContent = `${item.rank}. ${item.name}`;
  $("#detail-score").textContent = `Nilai akhir ${formatNumber(item.finalScore)} - NCF ${formatNumber(item.coreScore)} - NSF ${formatNumber(item.secondaryScore)}`;

  $("#detail-table").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Kode</th>
          <th>Nilai</th>
          <th>GAP</th>
          <th>Bobot</th>
        </tr>
      </thead>
      <tbody>
        ${item.details.map(createDetailRow).join("")}
      </tbody>
    </table>
  `;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function addAlternative() {
  const input = $("#new-laundry-name");
  const name = input.value.trim();
  if (!name) {
    showToast("Nama laundry belum diisi.");
    input.focus();
    return;
  }

  const nextNumber = alternatives.reduce((max, item) => {
    const number = Number(String(item.id).replace(/\D/g, ""));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0) + 1;

  const scores = Object.fromEntries(criteria.map((criterion) => [criterion.id, 3]));
  alternatives.push({ id: `A${nextNumber}`, name, scores });
  input.value = "";
  refreshAlternativeViews({ includeTable: true });
  showToast(`${name} berhasil ditambahkan.`);
}

function resetData() {
  const isConfirmed = window.confirm("Reset semua data ke data awal?");
  if (!isConfirmed) return;
  alternatives = structuredClone(defaultAlternatives);
  selectedAlternativeId = null;
  refreshAlternativeViews({ includeTable: true });
  showToast("Data berhasil dikembalikan ke default.");
}

function exportRankingCSV() {
  const rankings = calculateRankings();
  const header = ["Rank", "Kode", "Nama", "NCF", "NSF", "Nilai Akhir", ...criteria.map((item) => item.id)];
  const rows = rankings.map((item) => [
    item.rank,
    item.id,
    item.name,
    formatNumber(item.coreScore),
    formatNumber(item.secondaryScore),
    formatNumber(item.finalScore),
    ...criteria.map((criterion) => item.scores[criterion.id])
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "hasil-ranking-spk-laundry.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("File CSV ranking berhasil dibuat.");
}

function updateAlternativeScore(target, alternative) {
  alternative.scores[target.dataset.criterion] = Number(target.value);
  refreshAlternativeViews();
}

function updateAlternativeName(target, alternative) {
  alternative.name = target.value.trim() || alternative.id;
  refreshAlternativeViews();
}

function deleteAlternative(id) {
  alternatives = alternatives.filter((item) => item.id !== id);
  if (selectedAlternativeId === id) selectedAlternativeId = null;
  refreshAlternativeViews({ includeTable: true });
  showToast("Alternatif berhasil dihapus.");
}

function handleAlternativeTableEvent(event) {
  const { action, id } = event.target.dataset;
  if (!action || !id) return;

  const alternative = findAlternative(id);
  if (!alternative) return;

  if (action === "score") updateAlternativeScore(event.target, alternative);
  if (action === "name") updateAlternativeName(event.target, alternative);
  if (action === "delete") deleteAlternative(id);
}

function handleRankingClick(event) {
  const row = event.target.closest("tr[data-id]");
  if (!row) return;
  selectedAlternativeId = row.dataset.id;
  renderRanking();
}

function init() {
  renderCriteria();
  renderSurveySummary();
  renderGapGrid();
  renderAlternativeTable();
  renderRanking();
  saveAlternatives();

  $("#btn-calculate").addEventListener("click", () => {
    renderRanking();
    showToast("Ranking sudah dihitung ulang.");
    $("#hasil-ranking").scrollIntoView({ behavior: "smooth" });
  });
  $("#btn-reset").addEventListener("click", resetData);
  $("#btn-add").addEventListener("click", addAlternative);
  $("#btn-export").addEventListener("click", exportRankingCSV);
  $("#new-laundry-name").addEventListener("keydown", (event) => {
    if (event.key === "Enter") addAlternative();
  });
  $("#alternative-body").addEventListener("change", handleAlternativeTableEvent);
  $("#alternative-body").addEventListener("input", handleAlternativeTableEvent);
  $("#alternative-body").addEventListener("click", handleAlternativeTableEvent);
  $("#ranking-body").addEventListener("click", handleRankingClick);

  // Hamburger menu toggle
  const hamburger = $("#hamburger");
  const navActions = $("#nav-actions");
  if (hamburger && navActions) {
    hamburger.addEventListener("click", () => {
      const isOpen = hamburger.classList.toggle("open");
      navActions.classList.toggle("open", isOpen);
      hamburger.setAttribute("aria-expanded", String(isOpen));
    });
    // Close menu on nav link click
    navActions.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        hamburger.classList.remove("open");
        navActions.classList.remove("open");
        hamburger.setAttribute("aria-expanded", "false");
      });
    });
    // Close on outside click
    document.addEventListener("click", (e) => {
      if (!hamburger.contains(e.target) && !navActions.contains(e.target)) {
        hamburger.classList.remove("open");
        navActions.classList.remove("open");
        hamburger.setAttribute("aria-expanded", "false");
      }
    });
  }
}

init();
