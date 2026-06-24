/* ============================================================
   SPK LAUNDRY — PROFILE MATCHING
   Metode: Profile Matching (NCF 60% + NSF 40%)
   Penulis: Script yang diperbaiki sesuai logika Profile Matching
   ============================================================ */

/* ============================================================
   DATA — Kriteria
   ============================================================ */

const criteria = [
  {
    id: "C1",
    name: "Harga per Kilogram",
    type: "Cost",
    factor: "core",
    ideal: 5,
    note: "Harga sudah dikonversi ke skala 1–5. Nilai 5 = harga paling murah (terbaik)."
  },
  {
    id: "C2",
    name: "Kecepatan Pengerjaan",
    type: "Benefit",
    factor: "core",
    ideal: 5,
    note: "Semakin cepat proses pengerjaan, semakin tinggi nilainya."
  },
  {
    id: "C3",
    name: "Kualitas Hasil Cucian",
    type: "Benefit",
    factor: "secondary",
    ideal: 5,
    note: "Menilai kebersihan, kerapian, dan keharuman hasil cucian."
  },
  {
    id: "C4",
    name: "Pelayanan dan Respons",
    type: "Benefit",
    factor: "secondary",
    ideal: 5,
    note: "Menilai keramahan dan kecepatan respons pihak laundry."
  },
  {
    id: "C5",
    name: "Tingkat Kerusakan atau Kesalahan",
    type: "Cost",
    factor: "core",
    ideal: 5,
    note: "Nilai 5 berarti tidak terjadi kerusakan, kehilangan, atau tertukar (terbaik)."
  }
];

/* ============================================================
   TABEL KONVERSI GAP
   ============================================================ */

const gapWeights = {
  "0":   5,
  "1":   4.5,
  "-1":  4,
  "2":   3.5,
  "-2":  3,
  "3":   2.5,
  "-3":  2,
  "4":   1.5,
  "-4":  1
};

const orderedGaps = [0, 1, -1, 2, -2, 3, -3, 4, -4];

/* ============================================================
   DATA — Alternatif
   Sumber: Survey_Alternatif_Laundry-2(1).xlsx
   ============================================================ */

const alternatives = [
  {
    id: "A1",
    name: "Laundry Family",
    scores: { C1: 4, C2: 4, C3: 3, C4: 4, C5: 4 }
  },
  {
    id: "A2",
    name: "Lore Laundry",
    scores: { C1: 4, C2: 3, C3: 3, C4: 4, C5: 3 }
  },
  {
    id: "A3",
    name: "Monica Laundry",
    scores: { C1: 5, C2: 4, C3: 4, C4: 4, C5: 5 }
  },
  {
    id: "A4",
    name: "Hanif Laundry",
    scores: { C1: 4, C2: 3, C3: 3, C4: 2, C5: 3 }
  },
  {
    id: "A5",
    name: "Salma Laundry",
    scores: { C1: 4, C2: 4, C3: 4, C4: 4, C5: 4 }
  }
];

/* ============================================================
   DATA — Survei
   ============================================================ */

const surveySummary = [
  { id: "C1", label: "Harga per Kilogram",              average: 4.10, dominant: 4, total: 40, percentage: 63 },
  { id: "C2", label: "Kecepatan Pengerjaan",             average: 3.60, dominant: 4, total: 40, percentage: 57 },
  { id: "C3", label: "Kualitas Hasil Cucian",            average: 3.35, dominant: 3, total: 40, percentage: 40 },
  { id: "C4", label: "Pelayanan dan Respons",            average: 3.75, dominant: 4, total: 40, percentage: 43 },
  { id: "C5", label: "Tingkat Kerusakan atau Kesalahan", average: 3.68, dominant: 4, total: 40, percentage: 70 }
];

/* ============================================================
   SIMULATOR BOBOT — State
   Slider C1, C2, C5 = bobot relatif di dalam kelompok Core Factor.
   Slider C3, C4     = bobot relatif di dalam kelompok Secondary Factor.
   Normalisasi dilakukan per kelompok, bukan global.
   ============================================================ */

/**
 * Default: semua prioritas sama sehingga hasil identik dengan
 * rata-rata sederhana per kelompok (NCF = avg C1,C2,C5 ; NSF = avg C3,C4).
 */
const DEFAULT_WEIGHTS = { C1: 3, C2: 3, C3: 3, C4: 3, C5: 3 };

let criterionWeights = { ...DEFAULT_WEIGHTS };

/* Roman numerals untuk tampilan ranking */
const ROMAN = ["I", "II", "III", "IV", "V"];

let selectedAlternativeId = null;

/* ============================================================
   UTILITIES
   ============================================================ */

const $ = (selector, parent = document) =>
  parent.querySelector(selector);

function escapeHTML(value) {
  return String(value)
    .replaceAll("&",  "&amp;")
    .replaceAll("<",  "&lt;")
    .replaceAll(">",  "&gt;")
    .replaceAll('"',  "&quot;")
    .replaceAll("'",  "&#039;");
}

function formatNumber(value) {
  return Number(value).toFixed(2);
}

/* ============================================================
   VALIDASI
   ============================================================ */

/**
 * Validasi nilai alternatif.
 * @param {number} score – nilai mentah
 * @param {string} criterionId – ID kriteria untuk pesan error
 * @param {string} alternativeName – nama alternatif untuk pesan error
 * @returns {number} nilai yang sudah tervalidasi
 * @throws {Error} jika nilai tidak valid
 */
function validateAlternativeScore(score, criterionId, alternativeName) {
  const n = Number(score);
  if (isNaN(n) || !isFinite(n)) {
    throw new Error(
      `Nilai ${criterionId} pada "${alternativeName}" bukan angka yang valid (${score}).`
    );
  }
  if (n < 1 || n > 5) {
    throw new Error(
      `Nilai ${criterionId} pada "${alternativeName}" harus antara 1–5, ditemukan: ${n}.`
    );
  }
  return n;
}

/**
 * Validasi profil ideal kriteria.
 * @param {object} criterion
 * @throws {Error}
 */
function validateCriteria(criterion) {
  const ideal = Number(criterion.ideal);
  if (isNaN(ideal) || ideal < 1 || ideal > 5) {
    throw new Error(
      `Profil ideal ${criterion.id} tidak valid: ${criterion.ideal}.`
    );
  }
}

/* ============================================================
   FUNGSI GAP WEIGHT — dengan penanganan error
   ============================================================ */

/**
 * Kembalikan bobot GAP dari tabel konversi.
 * Melempar Error jika GAP tidak ada di tabel.
 * @param {number} gap
 * @returns {number}
 */
function getGapWeight(gap) {
  const key = String(gap);
  if (!Object.prototype.hasOwnProperty.call(gapWeights, key)) {
    throw new Error(
      `Nilai GAP ${gap} tidak tersedia dalam tabel konversi. ` +
      `Rentang yang didukung: -4 sampai +4.`
    );
  }
  return gapWeights[key];
}

/* ============================================================
   PERHITUNGAN — calculateWeightedFactor
   Menghitung NCF atau NSF dari kelompok kriteria dengan
   bobot relatif yang dinormalisasi per kelompok.
   ============================================================ */

/**
 * @param {Array<{id: string, gapWeight: number}>} items
 *   – daftar detail kriteria dalam satu kelompok (core atau secondary)
 * @returns {number} nilai rata-rata berbobot kelompok tersebut
 */
function calculateWeightedFactor(items) {
  if (!items.length) return 0;

  /* Jumlah bobot mentah (slider) dari kelompok ini */
  const totalWeight = items.reduce((total, item) => {
    const w = criterionWeights[item.id];
    return total + Math.max(0, isNaN(w) ? 0 : w);
  }, 0);

  /* Fallback: rata-rata sederhana jika semua bobot = 0 */
  if (totalWeight === 0) {
    return items.reduce((total, item) => total + item.gapWeight, 0) / items.length;
  }

  /* Rata-rata berbobot (bobot dinormalisasi di dalam kelompok) */
  return items.reduce((total, item) => {
    const rawWeight     = Math.max(0, isNaN(criterionWeights[item.id]) ? 0 : criterionWeights[item.id]);
    const normalizedWeight = rawWeight / totalWeight;
    return total + item.gapWeight * normalizedWeight;
  }, 0);
}

/* ============================================================
   PERHITUNGAN — calculateAlternative
   ============================================================ */

/**
 * Hitung semua nilai Profile Matching untuk satu alternatif.
 * @param {object} alternative
 * @returns {object} alternatif dengan details, coreScore, secondaryScore, finalScore
 */
function calculateAlternative(alternative) {
  /* Hitung detail per kriteria */
  const details = criteria.map((criterion) => {
    validateCriteria(criterion);
    const score    = validateAlternativeScore(
      alternative.scores[criterion.id],
      criterion.id,
      alternative.name
    );
    const ideal    = Number(criterion.ideal);
    const gap      = score - ideal;
    const gapW     = getGapWeight(gap);

    /* Bobot relatif di dalam kelompok — dihitung nanti, disimpan untuk detail */
    return {
      id:        criterion.id,
      name:      criterion.name,
      factor:    criterion.factor,
      score,
      ideal,
      gap,
      gapWeight: gapW
    };
  });

  /* Pisahkan kelompok */
  const coreItems      = details.filter(d => d.factor === "core");
  const secondaryItems = details.filter(d => d.factor === "secondary");

  /* Hitung NCF dan NSF dengan bobot relatif per kelompok */
  const coreScore      = calculateWeightedFactor(coreItems);
  const secondaryScore = calculateWeightedFactor(secondaryItems);

  /* Nilai akhir: 60% NCF + 40% NSF */
  const finalScore = 0.60 * coreScore + 0.40 * secondaryScore;

  /* Hitung bobot relatif untuk setiap detail (untuk tampilan) */
  const coreTotalW = coreItems.reduce((s, d) => {
    const w = criterionWeights[d.id];
    return s + Math.max(0, isNaN(w) ? 0 : w);
  }, 0);
  const secTotalW = secondaryItems.reduce((s, d) => {
    const w = criterionWeights[d.id];
    return s + Math.max(0, isNaN(w) ? 0 : w);
  }, 0);

  const enrichedDetails = details.map(d => {
    const rawW    = Math.max(0, isNaN(criterionWeights[d.id]) ? 0 : criterionWeights[d.id]);
    const groupTotalW = d.factor === "core" ? coreTotalW : secTotalW;
    const normW   = groupTotalW === 0 ? (1 / (d.factor === "core" ? coreItems.length : secondaryItems.length)) : rawW / groupTotalW;
    const contribution = d.gapWeight * normW;

    return { ...d, rawWeight: rawW, groupTotalWeight: groupTotalW, normalizedWeight: normW, contribution };
  });

  return { ...alternative, details: enrichedDetails, coreScore, secondaryScore, finalScore };
}

/* ============================================================
   PERHITUNGAN — calculateRankings
   ============================================================ */

function calculateRankings() {
  const results = [];

  for (const alt of alternatives) {
    try {
      results.push(calculateAlternative(alt));
    } catch (err) {
      showToast(`Error pada ${alt.name}: ${err.message}`);
      console.error(`[Profile Matching] Error pada ${alt.name}:`, err);
    }
  }

  return results
    .sort((a, b) => {
      if (Math.abs(b.finalScore - a.finalScore) > 1e-9) return b.finalScore - a.finalScore;
      if (Math.abs(b.coreScore  - a.coreScore)  > 1e-9) return b.coreScore  - a.coreScore;
      if (Math.abs(b.secondaryScore - a.secondaryScore) > 1e-9) return b.secondaryScore - a.secondaryScore;
      return a.name.localeCompare(b.name);
    })
    .map((alt, idx) => ({ ...alt, rank: idx + 1 }));
}

/* ============================================================
   RENDER — Slider Controls
   ============================================================ */

function renderSliders() {
  const container = $("#sliders-container");
  if (!container) return;

  container.innerHTML = criteria
    .map((criterion) => {
      const w = criterionWeights[criterion.id] ?? 0;
      const factorLabel = criterion.factor === "core" ? "CF" : "SF";
      return `
        <div class="slider-item">
          <div class="slider-label-row">
            <span class="slider-criterion-name">
              ${criterion.id} <span class="slider-factor-badge ${criterion.factor}">${factorLabel}</span> — ${escapeHTML(criterion.name)}
            </span>
            <span class="slider-pct" id="pct-${criterion.id}">${w}</span>
          </div>
          <input
            type="range"
            class="sim-slider"
            id="slider-${criterion.id}"
            min="1"
            max="5"
            step="1"
            value="${w}"
            data-criterion="${criterion.id}"
            aria-label="Prioritas ${criterion.id} skala 1 sampai 5"
          />
        </div>
      `;
    })
    .join("");

  container.querySelectorAll(".sim-slider").forEach((slider) => {
    slider.addEventListener("input", handleSliderChange);
  });
}

function handleSliderChange(event) {
  const cid = event.target.dataset.criterion;
  criterionWeights[cid] = Number(event.target.value);

  const pctEl = $(`#pct-${cid}`);
  if (pctEl) pctEl.textContent = criterionWeights[cid];

  renderRanking();   /* update real-time */
}

/* ============================================================
   RENDER — Kriteria Cards
   ============================================================ */

function renderCriteria() {
  const container = $("#criteria-list");
  if (!container) return;

  container.innerHTML = criteria
    .map((criterion) => {
      const factorLabel =
        criterion.factor === "core" ? "Core Factor" : "Secondary Factor";

      return `
        <article class="criteria-card">
          <div class="criteria-top">
            <div class="criteria-title">
              <span class="badge">${criterion.id}</span>
              <span>${escapeHTML(criterion.name)}</span>
            </div>
            <span class="badge ${criterion.factor}">${factorLabel}</span>
          </div>
          <p>${criterion.type} · Profil Ideal ${criterion.ideal}</p>
          <p>${escapeHTML(criterion.note)}</p>
        </article>
      `;
    })
    .join("");
}

/* ============================================================
   RENDER — Survei
   ============================================================ */

function renderSurveySummary() {
  const container = $("#survey-list");
  if (!container) return;

  container.innerHTML = surveySummary
    .map((item) => {
      const pct = item.percentage;
      return `
        <article class="survey-item">
          <div class="survey-top">
            <strong>${item.id} - ${escapeHTML(item.label)}</strong>
            <span class="badge">${pct}%</span>
          </div>
          <div class="bar" aria-label="Persentase ${pct}%">
            <div class="bar-fill" style="--bar:${pct}%"></div>
          </div>
          <p>Berdasarkan ${item.total} responden, nilai rata-rata adalah ${formatNumber(item.average)} dengan skor dominan ${item.dominant}</p>
        </article>
      `;
    })
    .join("");
}

/* ============================================================
   RENDER — Tabel Konversi GAP
   ============================================================ */

function renderGapGrid() {
  const container = $("#gap-grid");
  if (!container) return;

  container.innerHTML = orderedGaps
    .map((gap) => {
      const label = gap > 0 ? `+${gap}` : gap;
      return `
        <div class="gap-item">
          <strong>${label}</strong>
          <span>Bobot ${gapWeights[String(gap)]}</span>
        </div>
      `;
    })
    .join("");
}

/* ============================================================
   RENDER — Simulator Result Item
   ============================================================ */

function createSimResultItem(item, index) {
  const roman      = ROMAN[index] ?? String(index + 1);
  const percentage = Math.min(100, (item.finalScore / 5) * 100);
  const isActive   = item.id === selectedAlternativeId;

  return `
    <div
      class="sim-result-item ${isActive ? "active" : ""}"
      data-id="${item.id}"
      tabindex="0"
      role="listitem button"
      aria-label="${escapeHTML(item.name)}, nilai ${formatNumber(item.finalScore)}"
    >
      <span class="sim-rank-roman">${roman}</span>
      <div class="sim-result-info">
        <span class="sim-result-name">${escapeHTML(item.name)}</span>
        <span class="sim-result-id">${item.id}</span>
      </div>
      <div class="sim-result-right">
        <span class="sim-result-score">${formatNumber(item.finalScore)}</span>
        <div class="sim-result-bar-wrap">
          <div class="sim-result-bar" style="width:${percentage}%"></div>
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   RENDER — Full Ranking
   ============================================================ */

function renderRanking() {
  const rankings    = calculateRankings();
  const rankingBody = $("#ranking-body");

  /* Auto-select top jika seleksi tidak valid */
  if (
    !selectedAlternativeId ||
    !rankings.some(item => item.id === selectedAlternativeId)
  ) {
    selectedAlternativeId = rankings[0]?.id ?? null;
  }

  if (rankingBody) {
    rankingBody.innerHTML = rankings
      .map((item, idx) => createSimResultItem(item, idx))
      .join("");
  }

  renderTopRecommendation(rankings[0]);
}

/* ============================================================
   RENDER — Hero top recommendation
   ============================================================ */

function renderTopRecommendation(top) {
  const nameEl    = $("#top-name");
  const scoreEl   = $("#top-score");
  const summaryEl = $("#top-summary");
  if (!nameEl || !scoreEl || !summaryEl) return;

  if (!top) {
    nameEl.textContent    = "-";
    scoreEl.textContent   = "0.00";
    summaryEl.textContent = "Belum tersedia data alternatif.";
    return;
  }

  nameEl.textContent  = top.name;
  scoreEl.textContent = formatNumber(top.finalScore);
  summaryEl.textContent =
    `${top.name} menjadi rekomendasi terbaik ` +
    `dengan NCF ${formatNumber(top.coreScore)}, ` +
    `NSF ${formatNumber(top.secondaryScore)}, ` +
    `dan nilai akhir ${formatNumber(top.finalScore)}.`;
}

/* ============================================================
   TOAST
   ============================================================ */

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast._tid);
  showToast._tid = setTimeout(
    () => toast.classList.remove("show"),
    2800
  );
}

/* ============================================================
   EXPORT CSV — lengkap dengan semua kolom
   ============================================================ */

function exportRankingCSV() {
  const rankings = calculateRankings();

  /* Header */
  const criteriaHeaders = criteria.flatMap(c => [
    `${c.id} Nilai`, `${c.id} Ideal`, `${c.id} GAP`,
    `${c.id} Bobot GAP`, `${c.id} Prioritas (1-5)`,
    `${c.id} Bobot Relatif (%)`, `${c.id} Kontribusi`
  ]);
  const header = [
    "Ranking", "Kode", "Alternatif", "NCF", "NSF", "Nilai Akhir",
    ...criteriaHeaders
  ];

  const rows = rankings.map((item) => {
    const detailCols = criteria.flatMap(c => {
      const d = item.details.find(dd => dd.id === c.id);
      if (!d) return ["", "", "", "", "", "", ""];
      return [
        d.score,
        d.ideal,
        d.gap,
        d.gapWeight,
        d.rawWeight,
        (d.normalizedWeight * 100).toFixed(1),
        formatNumber(d.contribution)
      ];
    });

    return [
      item.rank,
      item.id,
      item.name,
      formatNumber(item.coreScore),
      formatNumber(item.secondaryScore),
      formatNumber(item.finalScore),
      ...detailCols
    ];
  });

  const csv = [header, ...rows]
    .map(row =>
      row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = "hasil-ranking-profile-matching.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showToast("Hasil ranking berhasil diekspor ke CSV.");
}

/* ============================================================
   HAMBURGER MENU
   ============================================================ */

function initializeHamburger() {
  const hamburger  = $("#hamburger");
  const navActions = $("#nav-actions");
  if (!hamburger || !navActions) return;

  hamburger.addEventListener("click", () => {
    const isOpen = hamburger.classList.toggle("open");
    navActions.classList.toggle("open", isOpen);
    hamburger.setAttribute("aria-expanded", String(isOpen));
  });

  navActions.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      hamburger.classList.remove("open");
      navActions.classList.remove("open");
      hamburger.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("click", (event) => {
    if (!hamburger.contains(event.target) && !navActions.contains(event.target)) {
      hamburger.classList.remove("open");
      navActions.classList.remove("open");
      hamburger.setAttribute("aria-expanded", "false");
    }
  });
}

/* ============================================================
   RANKING EVENTS (click / keyboard)
   ============================================================ */

function initializeRankingEvents() {
  const rankingBody = $("#ranking-body");
  if (!rankingBody) return;

  function selectItem(target) {
    const item = target.closest(".sim-result-item[data-id]");
    if (!item) return;
    selectedAlternativeId = item.dataset.id;
    renderRanking();
  }

  rankingBody.addEventListener("click",   (e) => selectItem(e.target));
  rankingBody.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    selectItem(e.target);
  });
}

/* ============================================================
   INITIALISE
   ============================================================ */

function initializeApplication() {
  renderCriteria();
  renderSurveySummary();
  renderGapGrid();
  renderSliders();
  renderRanking();
  initializeHamburger();
  initializeRankingEvents();

  /* Stat counter */
  const statEl = $("#stat-alternatives");
  if (statEl) statEl.textContent = alternatives.length;

  /* Hitung Ulang button */
  const calcBtn = $("#btn-calculate");
  if (calcBtn) {
    calcBtn.addEventListener("click", () => {
      renderRanking();
      showToast("Perhitungan Profile Matching berhasil dilakukan.");
      $("#hasil-ranking")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  /* Reset ke bobot awal */
  const resetBobotBtn = $("#btn-reset-bobot");
  if (resetBobotBtn) {
    resetBobotBtn.addEventListener("click", () => {
      criterionWeights = { ...DEFAULT_WEIGHTS };
      renderSliders();
      renderRanking();
      showToast("Prioritas dikembalikan ke nilai tengah skala 1-5.");
    });
  }

  /* Export CSV */
  const exportBtn = $("#btn-export");
  if (exportBtn) {
    exportBtn.addEventListener("click", exportRankingCSV);
  }

  /* Console acceptance test */
  const testResults = calculateRankings();
  console.group("[SPK Profile Matching] Acceptance Test — Default Weights");
  console.table(
    testResults.map(item => ({
      Ranking:     item.rank,
      Alternatif:  item.name,
      NCF:         formatNumber(item.coreScore),
      NSF:         formatNumber(item.secondaryScore),
      "Nilai Akhir": formatNumber(item.finalScore)
    }))
  );

  /* Expected results */
  const expected = [
    { id: "A3", ncf: 4.67, nsf: 4.00, final: 4.40 },
    { id: "A5", ncf: 4.00, nsf: 4.00, final: 4.00 },
    { id: "A1", ncf: 4.00, nsf: 3.50, final: 3.80 },
    { id: "A2", ncf: 3.33, nsf: 3.50, final: 3.40 },
    { id: "A4", ncf: 3.33, nsf: 2.50, final: 3.00 }
  ];

  const TOLERANCE = 0.01;
  let allPassed = true;
  expected.forEach((exp, idx) => {
    const actual = testResults[idx];
    const ok =
      actual &&
      actual.id === exp.id &&
      Math.abs(actual.coreScore      - exp.ncf)   <= TOLERANCE &&
      Math.abs(actual.secondaryScore - exp.nsf)   <= TOLERANCE &&
      Math.abs(actual.finalScore     - exp.final) <= TOLERANCE;
    if (!ok) {
      allPassed = false;
      console.warn(
        `GAGAL rank ${idx + 1}: expected ${exp.id} ncf=${exp.ncf} nsf=${exp.nsf} final=${exp.final},` +
        ` actual ${actual?.id} ncf=${formatNumber(actual?.coreScore)} nsf=${formatNumber(actual?.secondaryScore)} final=${formatNumber(actual?.finalScore)}`
      );
    }
  });

  if (allPassed) {
    console.log("%c✓ Semua acceptance test LULUS.", "color:green;font-weight:bold");
  } else {
    console.error("✗ Ada acceptance test yang GAGAL. Periksa data dan logika perhitungan.");
  }
  console.groupEnd();
}

/* ============================================================
   BOOT
   ============================================================ */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApplication);
} else {
  initializeApplication();
}
