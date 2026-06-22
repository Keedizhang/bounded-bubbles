const D_MIN = 12;
const D_MAX = 64;
const VALUE_MIN = 1;
const VALUE_MAX = 100;
const VALUE_CONTROL_MAX = 300;
const VALUE_BREAKPOINT_LARGE = 100000;
const VALUE_BREAKPOINT_LOG = 10000000000;
const VALUE_SLIDER_MIN = 0;
const VALUE_SLIDER_MAX = 100;
const VALUE_CONTINUOUS_END = 66.6667;
const VALUE_BREAKPOINT_LARGE_POSITION = 83.3333;
const DIAMETER_CONTROL_MIN = 8;
const DIAMETER_CONTROL_MAX = 96;
const DIAMETER_RANGE_GAP = 4;
const SQRT_DEMO_MIN_DIAMETER = 2;

const selectedValueSamples = [1, 2, 3, 5, 10, 20, 28, 29, 30, 100];

const pointLayout = [
  [1, 16, 86],
  [2, 25, 78],
  [3, 20, 68],
  [4, 36, 88],
  [5, 34, 73],
  [6, 44, 82],
  [8, 39, 61],
  [10, 51, 76],
  [12, 47, 58],
  [14, 59, 69],
  [16, 55, 49],
  [18, 67, 63],
  [21, 45, 42],
  [24, 71, 76],
  [27, 73, 54],
  [30, 67, 34],
  [34, 80, 69],
  [38, 64, 43],
  [42, 44, 70],
  [46, 83, 52],
  [50, 60, 58],
  [52, 56, 40],
  [55, 58, 35],
  [57, 53, 66],
  [58, 74, 61],
  [60, 49, 30],
  [61, 76, 34],
  [62, 64, 80],
  [64, 52, 23],
  [66, 80, 77],
  [68, 42, 33],
  [70, 78, 44],
  [72, 56, 84],
  [74, 84, 63],
  [76, 47, 51],
  [78, 64, 52],
  [82, 74, 20],
  [88, 86, 30],
  [94, 78, 12],
  [100, 91, 10],
];

const points = pointLayout.map(([baseValue, x, y], index) => ({
  id: `p${String(index + 1).padStart(2, "0")}`,
  baseValue,
  x,
  y,
}));

const $ = (selector) => document.querySelector(selector);
const svgNs = "http://www.w3.org/2000/svg";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

function unconstrainedFitAlpha(vMin, vMax, dMin = D_MIN, dMax = D_MAX) {
  if (vMin <= 0 || vMax <= vMin) {
    throw new Error("Values must be positive and vMax must be greater than vMin.");
  }

  const m = vMax / vMin;
  const k = dMax / dMin;
  return Math.log(k) / Math.log(m);
}

function globalFitAlpha(vMin, vMax, dMin = D_MIN, dMax = D_MAX) {
  return Math.min(0.5, unconstrainedFitAlpha(vMin, vMax, dMin, dMax));
}

function areaProportionalFits(vMin, vMax, dMin = D_MIN, dMax = D_MAX) {
  return unconstrainedFitAlpha(vMin, vMax, dMin, dMax) >= 0.5;
}

function getFitState(valueRatio, alpha0) {
  if (valueRatio >= 1e10) return "logRecommended";
  if (valueRatio >= 1e5) return "largeRange";
  if (alpha0 >= 0.45) return "nearArea";
  if (alpha0 >= 0.35) return "mildCompression";
  return "hardFit";
}

function fitInfo(vMin = state.valueMin, vMax = state.valueMax, dMin = state.dMin, dMax = state.dMax) {
  const valueRatio = vMax / vMin;
  const diameterRatio = dMax / dMin;
  const rawAlpha = unconstrainedFitAlpha(vMin, vMax, dMin, dMax);
  const activeAlpha = globalFitAlpha(vMin, vMax, dMin, dMax);
  const stateName = getFitState(valueRatio, rawAlpha);
  return {
    valueRatio,
    diameterRatio,
    rawAlpha,
    activeAlpha,
    stateName,
    noRedistribution: areaProportionalFits(vMin, vMax, dMin, dMax),
  };
}

function isBoundaryFitState(stateName) {
  return stateName === "largeRange" || stateName === "logRecommended";
}

const fitStateCopy = {
  nearArea: {
    label: "Near area-proportional",
    copy: "Good fit. The value range is close to area-proportional sizing under the current marker budget.",
  },
  mildCompression: {
    label: "Mild compression",
    copy: "Good range for bounded emphasis. The full range fits with mild compression.",
  },
  hardFit: {
    label: "Hard fit - use caution",
    copy: "Hard fit. Bounded emphasis may still be useful, but consider narrowing the data range.",
  },
  largeRange: {
    label: "Large dynamic range",
    copy: "Large dynamic range. Local marker-size emphasis is no longer the right tool.",
  },
  logRecommended: {
    label: "Log recommended",
    copy: "Log recommended. This range spans many orders of magnitude.",
  },
};

function logPosition(value, vMin = VALUE_MIN, vMax = VALUE_MAX) {
  if (vMin <= 0 || vMax <= vMin) {
    throw new Error("Values must be positive and vMax must be greater than vMin.");
  }

  const m = vMax / vMin;
  return clamp(Math.log(value / vMin) / Math.log(m), 0, 1);
}

function referenceFitDiameter(value, vMin = VALUE_MIN, vMax = VALUE_MAX, dMin = D_MIN, dMax = D_MAX) {
  const alpha0 = globalFitAlpha(vMin, vMax, dMin, dMax);
  return dMin * Math.pow(value / vMin, alpha0);
}

function linearDiameter(value, vMin = VALUE_MIN, vMax = VALUE_MAX, dMin = D_MIN, dMax = D_MAX) {
  const t = (value - vMin) / (vMax - vMin);
  return dMin + (dMax - dMin) * clamp(t, 0, 1);
}

function smoothSmallValueWarpDiameter(
  value,
  vMin,
  vMax,
  emphasis,
  dMin = D_MIN,
  dMax = D_MAX
) {
  const e = clamp(emphasis, -1, 0);
  const a = Math.max(-e, 0);
  const m = vMax / vMin;
  const alpha0 = globalFitAlpha(vMin, vMax, dMin, dMax);
  const x = logPosition(value, vMin, vMax);
  const dFit = referenceFitDiameter(value, vMin, vMax, dMin, dMax);
  const cMax = Math.max(0, Math.min(alpha0, 0.5 - alpha0));
  const warp = Math.exp(
    ((a * cMax * Math.log(m)) / Math.PI) * Math.sin(Math.PI * x)
  );

  return dFit * warp;
}

function emphasizedDiameter(
  value,
  vMin,
  vMax,
  emphasis,
  dMin = D_MIN,
  dMax = D_MAX
) {
  const e = clamp(emphasis, -1, 1);
  const dFit = referenceFitDiameter(value, vMin, vMax, dMin, dMax);
  const info = fitInfo(vMin, vMax, dMin, dMax);
  if (info.noRedistribution || isBoundaryFitState(info.stateName)) {
    return clamp(dFit, dMin, dMax);
  }

  const dSmallWarp =
    e < 0
      ? smoothSmallValueWarpDiameter(value, vMin, vMax, e, dMin, dMax)
      : dFit;
  const dLinear = linearDiameter(value, vMin, vMax, dMin, dMax);
  const b = Math.max(e, 0);
  const diameter = (1 - b) * dSmallWarp + b * dLinear;

  return clamp(diameter, dMin, dMax);
}

function valueForBaseValue(baseValue) {
  const t = clamp((baseValue - VALUE_MIN) / (VALUE_MAX - VALUE_MIN), 0, 1);
  if (fitInfo().stateName === "logRecommended") {
    const m = state.valueMax / state.valueMin;
    return Math.round(state.valueMin * Math.pow(m, t));
  }

  return Math.round(state.valueMin + (state.valueMax - state.valueMin) * t);
}

function valueForNode(node) {
  return valueForBaseValue(node.baseValue);
}

function comparisonValues() {
  const values = selectedValueSamples.map(valueForBaseValue);
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function diameterForValue(value, emphasis = state.emphasis) {
  return emphasizedDiameter(value, state.valueMin, state.valueMax, emphasis, state.dMin, state.dMax);
}

function sqrtDemoDiameter(value) {
  return SQRT_DEMO_MIN_DIAMETER * Math.sqrt(value / state.valueMin);
}

function logScaleDemoDiameter(value) {
  const t = logPosition(value, state.valueMin, state.valueMax);
  return state.dMin + (state.dMax - state.dMin) * t;
}

function mapDiameterForValue(value, info = fitInfo()) {
  if (info.stateName === "largeRange") return sqrtDemoDiameter(value);
  if (info.stateName === "logRecommended") return logScaleDemoDiameter(value);
  return diameterForValue(value, state.emphasis);
}

function activeEmphasis() {
  const info = fitInfo();
  return info.noRedistribution || isBoundaryFitState(info.stateName)
    ? 0
    : state.emphasis;
}

function radiusForValue(value, emphasis = state.emphasis) {
  return diameterForValue(value, emphasis) / 2;
}

function linearReferenceDiameter(value) {
  return linearDiameter(value, state.valueMin, state.valueMax, state.dMin, state.dMax);
}

function sqrtReferenceDiameter(value) {
  return state.dMin * Math.sqrt(value / state.valueMin);
}

function fitStatus(alpha0) {
  if (alpha0 >= 0.5) return "No compression needed";
  if (alpha0 >= 0.45) return "Near area-proportional";
  if (alpha0 >= 0.35) return "Mild compression";
  if (alpha0 >= 0.25) return "Hard fit - use caution";
  return "Consider log, filtering, faceting, or aggregation";
}

function formatValue(value) {
  return Math.round(value).toLocaleString("en-US");
}

function formatCompactValue(value) {
  if (value === VALUE_BREAKPOINT_LOG) return "10^10";
  if (value === VALUE_BREAKPOINT_LARGE) return "10^5";
  if (value >= 1e9) return `${(value / 1e9).toFixed(value % 1e9 === 0 ? 0 : 1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(value % 1e6 === 0 ? 0 : 1)}M`;
  if (value >= 10000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return formatValue(value);
}

function formatNumber(value) {
  return value.toFixed(3);
}

function formatEmphasis(value) {
  return value.toFixed(2);
}

function formatRatio(value) {
  if (value === VALUE_BREAKPOINT_LOG) return "10^10x";
  if (value === VALUE_BREAKPOINT_LARGE) return "10^5x";
  if (value >= 1000) return `${formatValue(value)}x`;
  return `${value.toFixed(2)}x`;
}

function formatComparisonNumber(value) {
  if (value === VALUE_BREAKPOINT_LOG) return "10<sup>10</sup>";
  if (value === VALUE_BREAKPOINT_LARGE) return "10<sup>5</sup>";
  if (value >= 1000) return formatValue(value);
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1).replace(/\.0$/, "");
  return value.toFixed(2).replace(/\.00$/, "").replace(/0$/, "");
}

function comparisonFormulaHtml(valueRatio, operator, visualBudget) {
  return `
    <span class="comparison-formula">
      <span class="formula-term">V<sub>max</sub>/V<sub>min</sub></span>
      <span>=</span>
      <strong>${formatComparisonNumber(valueRatio)}</strong>
      <span>${operator}</span>
      <span class="formula-term">(D<sub>max</sub>/D<sub>min</sub>)<sup>2</sup></span>
      <span>=</span>
      <strong>${formatComparisonNumber(visualBudget)}</strong>
    </span>
  `;
}

function formatPx(value) {
  return `${value.toFixed(1)}px`;
}

function formatSliderRatio(value) {
  if (value >= VALUE_BREAKPOINT_LOG) return "10^10";
  if (value >= VALUE_BREAKPOINT_LARGE) return "10^5";
  if (value >= 1000) return formatValue(value);
  return formatValue(value);
}

function formatSliderRatioHtml(value) {
  if (value >= VALUE_BREAKPOINT_LOG) return "10<sup>10</sup>";
  if (value >= VALUE_BREAKPOINT_LARGE) return "10<sup>5</sup>";
  return formatSliderRatio(value);
}

function valueMaxFromSliderPosition(position) {
  const sliderPosition = clamp(Number(position), VALUE_SLIDER_MIN, VALUE_SLIDER_MAX);
  if (sliderPosition <= VALUE_CONTINUOUS_END) {
    const t = sliderPosition / VALUE_CONTINUOUS_END;
    return Math.max(2, Math.round(VALUE_MIN + (VALUE_CONTROL_MAX - VALUE_MIN) * t));
  }

  if (sliderPosition < VALUE_BREAKPOINT_LARGE_POSITION) {
    return VALUE_CONTROL_MAX;
  }

  if (sliderPosition < VALUE_SLIDER_MAX) {
    return VALUE_BREAKPOINT_LARGE;
  }

  return VALUE_BREAKPOINT_LOG;
}

function sliderPositionFromValueMax(valueMax) {
  const value = clamp(Number(valueMax), 2, VALUE_BREAKPOINT_LOG);
  if (value >= VALUE_BREAKPOINT_LOG) return VALUE_SLIDER_MAX;
  if (value >= VALUE_BREAKPOINT_LARGE) return VALUE_BREAKPOINT_LARGE_POSITION;
  if (value >= VALUE_CONTROL_MAX) return VALUE_CONTINUOUS_END;

  const t = (value - VALUE_MIN) / (VALUE_CONTROL_MAX - VALUE_MIN);
  return clamp(t, 0, 1) * VALUE_CONTINUOUS_END;
}

function valueAnchorPosition(value) {
  if (value >= VALUE_BREAKPOINT_LOG) return VALUE_SLIDER_MAX;
  if (value >= VALUE_BREAKPOINT_LARGE) return VALUE_BREAKPOINT_LARGE_POSITION;
  if (value >= VALUE_CONTROL_MAX) return VALUE_CONTINUOUS_END;
  if (value <= VALUE_MIN) return VALUE_SLIDER_MIN;

  return ((value - VALUE_MIN) / (VALUE_CONTROL_MAX - VALUE_MIN)) * VALUE_CONTINUOUS_END;
}

function renderValueAnchorLabels() {
  document.querySelectorAll("[data-value-anchor]").forEach((button) => {
    const anchor = Number(button.dataset.valueAnchor);
    button.style.left = `${valueAnchorPosition(anchor)}%`;
    button.classList.toggle("is-active", state.valueMax === anchor);
  });
}

function setThumbLabel(selector, position, text) {
  const label = $(selector);
  if (!label) return;
  label.style.left = `${clamp(position, 0, 100)}%`;
  label.textContent = text;
}

function setThumbLabelHtml(selector, position, html) {
  const label = $(selector);
  if (!label) return;
  label.style.left = `${clamp(position, 0, 100)}%`;
  label.innerHTML = html;
}

function setHtml(selector, value) {
  const element = $(selector);
  if (element) element.innerHTML = value;
}

function emphasisLabel(emphasis) {
  const info = fitInfo();
  if (isBoundaryFitState(info.stateName)) {
    return "Range too large";
  }
  if (info.noRedistribution) {
    return "No redistribution needed";
  }
  if (emphasis < -0.05) return "Small-value differences";
  if (emphasis > 0.05) return "Large-value differences";
  return "Reference fit";
}

const emphasisPresets = {
  large: 1,
  neutral: 0,
  small: -1,
};

const state = {
  emphasis: 0,
  valueMin: VALUE_MIN,
  valueMax: VALUE_MAX,
  dMin: D_MIN,
  dMax: D_MAX,
  selectedId: "p01",
  // Future user-testing flow can use these fields without adding a backend:
  // create participantId once, push interaction events into events,
  // then download a JSON/CSV result file at the end of the study.
  participantId: null,
  events: [],
};

function createParticipantId() {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `P-${digits}`;
}

function recordEvent(type, payload = {}) {
  if (!state.participantId) state.participantId = createParticipantId();
  state.events.push({
    type,
    payload,
    participantId: state.participantId,
    timestamp: new Date().toISOString(),
  });
}

function selectedNode() {
  return points.find((node) => node.id === state.selectedId) || points[0];
}

function createSvgElement(tagName, attributes = {}) {
  const element = document.createElementNS(svgNs, tagName);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function renderBubbles() {
  const map = $("#bubble-map");
  map.innerHTML = "";
  const info = fitInfo();
  const boundaryState = isBoundaryFitState(info.stateName);
  map.classList.toggle("has-range-warning", boundaryState);
  map.classList.toggle("is-sqrt-demo", info.stateName === "largeRange");
  map.classList.toggle("is-log-demo", info.stateName === "logRecommended");

  points.forEach((node) => {
    const value = valueForNode(node);
    const diameter = mapDiameterForValue(value, info);
    const radius = diameter / 2;
    const marker = document.createElement("button");
    marker.className = node.id === state.selectedId ? "bubble-marker is-selected" : "bubble-marker";
    marker.type = "button";
    marker.style.left = `${node.x}%`;
    marker.style.top = `${node.y}%`;
    marker.style.width = `${diameter}px`;
    marker.style.height = `${diameter}px`;
    marker.title = `v=${formatValue(value)}, D=${formatPx(diameter)}, r=${formatPx(radius)}`;
    marker.setAttribute("aria-label", `value ${formatValue(value)}, diameter ${formatPx(diameter)}`);
    marker.setAttribute("aria-pressed", String(node.id === state.selectedId));
    marker.dataset.nodeId = node.id;
    map.appendChild(marker);
  });

  points.forEach((node) => {
    if (node.id !== state.selectedId) return;
    const value = valueForNode(node);
    const diameter = mapDiameterForValue(value, info);
    const radius = diameter / 2;
    const rawSqrtRadius = sqrtReferenceDiameter(value) / 2;
    const tooltip = document.createElement("aside");
    tooltip.className = "bubble-tooltip";
    tooltip.style.left = `${node.x}%`;
    tooltip.style.top = `${node.y}%`;
    tooltip.setAttribute("aria-live", "polite");
    tooltip.innerHTML = `
      <dl>
        <div>
          <dt>Value</dt>
          <dd>${formatValue(value)}</dd>
        </div>
        <div>
          <dt>Radius</dt>
          <dd>${formatPx(radius)}</dd>
        </div>
        <div>
          <dt>Raw sqrt R</dt>
          <dd>${formatPx(rawSqrtRadius)}</dd>
        </div>
      </dl>
    `;
    map.appendChild(tooltip);
  });

  if (boundaryState) {
    const overlay = document.createElement("div");
    overlay.className = "bubble-range-overlay";
    overlay.innerHTML =
      info.stateName === "logRecommended"
        ? "<strong>Log-scale demo</strong><span>Diameter follows log(value), so the same range becomes visually usable again.</span>"
        : "<strong>Raw sqrt demo</strong><span>Minimum point is 2px; large values explode far beyond the marker budget.</span>";
    map.appendChild(overlay);
  }
}

function renderFormula() {
  const node = selectedNode();
  const value = valueForNode(node);
  const info = fitInfo();
  const alpha0 = info.rawAlpha;
  const m = state.valueMax / state.valueMin;
  const k = state.dMax / state.dMin;
  const selectedDiameter = diameterForValue(value, state.emphasis);

  setText("#formula-emphasis", formatEmphasis(state.emphasis));
  setText("#formula-alpha0", formatNumber(alpha0));
  setText("#formula-v-min", formatValue(state.valueMin));
  setText("#formula-v-max", formatValue(state.valueMax));
  setText("#formula-m", formatRatio(m));
  setText("#formula-k", formatRatio(k));
  setText("#formula-fit-status", fitStatus(alpha0));
  setText("#formula-d-min", formatPx(state.dMin));
  setText("#formula-d-max", formatPx(state.dMax));
  setText("#formula-selected-value", formatValue(value));
  setText("#formula-selected-diameter", formatPx(selectedDiameter));
  setText("#formula-selected-radius", formatPx(selectedDiameter / 2));
  setText("#formula-mode", emphasisLabel(state.emphasis));

  const formulaPanel = document.querySelector(".formula-page");
  const boundaryNote = $("#formula-boundary-note");
  if (formulaPanel) {
    formulaPanel.classList.toggle("is-deemphasized", info.stateName === "largeRange");
    formulaPanel.classList.toggle("is-hidden-math", info.stateName === "logRecommended");
  }
  if (boundaryNote) {
    const boundaryState = isBoundaryFitState(info.stateName);
    boundaryNote.hidden = !boundaryState;
    boundaryNote.textContent =
      info.stateName === "logRecommended"
        ? "Formula hidden because this range exceeds the recommended use of bounded emphasis."
        : "Formula de-emphasized because this boundary example is better handled with log scaling, filtering, faceting, aggregation, or another view.";
  }
}

function renderTable() {
  const body = $("#comparison-body");
  body.innerHTML = "";

  const values = comparisonValues();

  values.forEach((value, index) => {
    const previousValue = values[index - 1];
    const emphasisDiameter = diameterForValue(value, state.emphasis);
    const previousDiameter =
      previousValue === undefined ? null : diameterForValue(previousValue, state.emphasis);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${formatValue(value)}</td>
      <td>${formatPx(linearReferenceDiameter(value))}</td>
      <td>${formatPx(sqrtReferenceDiameter(value))}</td>
      <td>${formatPx(referenceFitDiameter(value, state.valueMin, state.valueMax, state.dMin, state.dMax))}</td>
      <td>${formatPx(emphasisDiameter)}</td>
      <td>${previousDiameter === null ? "-" : formatPx(emphasisDiameter - previousDiameter)}</td>
    `;
    body.appendChild(row);
  });
}

function setRangeInput(selector, min, max, step, value) {
  const input = $(selector);
  if (!input) return;
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
}

function updateRangeTrack(selector, minValue, maxValue, controlMin, controlMax) {
  const rangeControl = $(selector);
  if (!rangeControl) return;
  const span = controlMax - controlMin;
  const start = ((minValue - controlMin) / span) * 100;
  const end = ((maxValue - controlMin) / span) * 100;
  rangeControl.style.setProperty("--range-start", `${clamp(start, 0, 100)}%`);
  rangeControl.style.setProperty("--range-end", `${clamp(end, 0, 100)}%`);
}

function renderConstraintControls() {
  const info = fitInfo();
  const sliderValue = sliderPositionFromValueMax(state.valueMax);
  const inBreakpointMode = isBoundaryFitState(info.stateName);
  const valueRatio = state.valueMax / state.valueMin;
  const markerVarianceBudget = Math.pow(state.dMax / state.dMin, 2);
  const valueRangeWarning =
    valueRatio > markerVarianceBudget * 2 && info.stateName !== "logRecommended";

  setRangeInput("#value-max-slider", VALUE_SLIDER_MIN, VALUE_SLIDER_MAX, 0.5, sliderValue);
  setRangeInput("#diameter-min-slider", DIAMETER_CONTROL_MIN, DIAMETER_CONTROL_MAX, 1, state.dMin);
  setRangeInput("#diameter-max-slider", DIAMETER_CONTROL_MIN, DIAMETER_CONTROL_MAX, 1, state.dMax);
  ["#diameter-min-slider", "#diameter-max-slider"].forEach((selector) => {
    const input = $(selector);
    if (input) input.disabled = inBreakpointMode;
  });

  const diameterCard = $("#diameter-range-card");
  if (diameterCard) {
    diameterCard.classList.toggle("is-disabled", inBreakpointMode);
  }

  const valueRangeControl = $("#value-range-control");
  if (valueRangeControl) {
    valueRangeControl.classList.toggle("is-warning", valueRangeWarning);
  }
  const valueRangeCard = valueRangeControl?.closest(".range-card");
  if (valueRangeCard) {
    valueRangeCard.classList.toggle("has-value-warning", valueRangeWarning);
  }

  updateRangeTrack(
    "#value-range-control",
    VALUE_SLIDER_MIN,
    sliderValue,
    VALUE_SLIDER_MIN,
    VALUE_SLIDER_MAX
  );
  updateRangeTrack(
    "#diameter-range-control",
    state.dMin,
    state.dMax,
    DIAMETER_CONTROL_MIN,
    DIAMETER_CONTROL_MAX
  );

  setHtml("#value-range-output", formatSliderRatioHtml(valueRatio));
  setHtml("#diameter-range-output", formatSliderRatioHtml(info.diameterRatio));
  setText("#condition-operator", valueRatio > markerVarianceBudget ? ">" : "<=");
  setText("#diameter-axis-min", formatPx(DIAMETER_CONTROL_MIN));
  setText("#diameter-axis-max", formatPx(DIAMETER_CONTROL_MAX));

  setThumbLabelHtml("#value-range-thumb-label", sliderValue, formatSliderRatioHtml(valueRatio));
  setThumbLabel(
    "#diameter-min-thumb-label",
    ((state.dMin - DIAMETER_CONTROL_MIN) / (DIAMETER_CONTROL_MAX - DIAMETER_CONTROL_MIN)) * 100,
    formatPx(state.dMin)
  );
  setThumbLabel(
    "#diameter-max-thumb-label",
    ((state.dMax - DIAMETER_CONTROL_MIN) / (DIAMETER_CONTROL_MAX - DIAMETER_CONTROL_MIN)) * 100,
    formatPx(state.dMax)
  );

  renderValueAnchorLabels();
}

function renderControls() {
  const info = fitInfo();
  const boundaryState = isBoundaryFitState(info.stateName);
  const noRedistribution = info.noRedistribution;
  const disabled = noRedistribution || boundaryState;
  const displayedEmphasis = activeEmphasis();
  const visualBudget = Math.pow(state.dMax / state.dMin, 2);
  const comparisonOperator = info.valueRatio > visualBudget ? ">" : "<=";
  const slider = $("#emphasis-slider");
  slider.min = "-1";
  slider.max = "1";
  slider.step = "0.01";
  slider.value = formatEmphasis(displayedEmphasis);
  slider.disabled = disabled;
  slider.closest(".emphasis-slider-field")?.classList.toggle("is-disabled", disabled);
  slider.title = boundaryState
    ? info.stateName === "logRecommended"
      ? "Disabled because the value range is too large for local emphasis. Use log, filtering, faceting, or aggregation."
      : "Disabled because the value range is too large for local emphasis. Narrow, filter, facet, or aggregate the data."
    : "";
  setText("#emphasis-output", `e = ${formatEmphasis(displayedEmphasis)}`);
  setText("#emphasis-label", emphasisLabel(displayedEmphasis));

  const note = $("#tuning-comparison-note");
  if (note) {
    const comparisonPrefix = comparisonFormulaHtml(info.valueRatio, comparisonOperator, visualBudget);
    let explanation = "";
    if (info.stateName === "logRecommended") {
      explanation = "a log-scale demo makes this range visually usable again.";
    } else if (boundaryState) {
      explanation = "this range is too large for bounded emphasis; use filtering, faceting, aggregation, or another view.";
    } else if (noRedistribution) {
      explanation = "the available marker-size budget can preserve area-proportional differences, so e is not needed.";
    } else {
      explanation = "variation of bubble size will be visually compressed; use e to allocate visual variance to smaller or larger values based on the task.";
    }
    note.innerHTML = `
      <span class="comparison-line">${comparisonPrefix}</span>
      <span class="comparison-text">${explanation}</span>
    `;
    note.classList.toggle("is-muted", noRedistribution && !boundaryState);
    note.classList.toggle("is-warning", boundaryState);
  }

  document.querySelectorAll(".preset-button").forEach((button) => {
    if (button.dataset.preset) {
      button.dataset.emphasis = String(emphasisPresets[button.dataset.preset]);
    }
    const emphasis = Number(button.dataset.emphasis);
    button.disabled = disabled;
    button.classList.toggle("is-active", Math.abs(emphasis - displayedEmphasis) < 0.01);
  });
}

function recommendationContent(info) {
  if (info.stateName === "logRecommended") {
    return `
      <h3>Use log or split the view</h3>
      <p>This range spans many orders of magnitude. A bounded bubble-size transfer curve cannot responsibly represent both small and large values in one size scale.</p>
      <ul>
        <li>Use a log scale and label it clearly</li>
        <li>Split the view into facets or small multiples</li>
        <li>Filter by relevant value band</li>
        <li>Aggregate or bin long-tail values</li>
        <li>Use a table, ranked bar chart, or outlier panel for exact comparison</li>
      </ul>
    `;
  }

  return `
    <h3>Large dynamic range</h3>
    <p>This value range is too wide for local marker-size emphasis. The issue is no longer small visual adjustment; it is large dynamic range visualization.</p>
    <ul>
      <li>Filter to a narrower range</li>
      <li>Facet by category, severity, region, or time</li>
      <li>Aggregate or bin values</li>
      <li>Cap values with clear disclosure</li>
      <li>Use another encoding or chart type</li>
    </ul>
  `;
}

function renderBoundaryPanel() {
  const info = fitInfo();
  const boundaryState = isBoundaryFitState(info.stateName);
  const boundaryPanel = $("#boundary-panel");
  const controlPanel = document.querySelector(".control-panel");
  const analysisPanel = document.querySelector(".analysis-panel");
  const workflowPane = document.querySelector(".workflow-pane");

  if (workflowPane) workflowPane.classList.toggle("is-boundary-mode", boundaryState);
  if (controlPanel) controlPanel.hidden = boundaryState;
  if (analysisPanel) analysisPanel.hidden = boundaryState;
  if (!boundaryPanel) return;

  boundaryPanel.hidden = !boundaryState;
  if (!boundaryState) return;

  boundaryPanel.innerHTML = `
    <p class="eyebrow">${fitStateCopy[info.stateName].label}</p>
    ${recommendationContent(info)}
  `;
}

function renderRangeRecommendation(info) {
  const chartContent = $("#curve-chart-content");
  const recommendationPanel = $("#range-recommendation-panel");
  const boundaryState = isBoundaryFitState(info.stateName);
  if (chartContent) chartContent.hidden = boundaryState;
  if (!recommendationPanel) return;

  recommendationPanel.hidden = !boundaryState;
  if (boundaryState) {
    recommendationPanel.innerHTML = recommendationContent(info);
  }
}

function renderCurve() {
  const svg = $("#curve-preview");
  if (!svg) return;
  const info = fitInfo();
  renderRangeRecommendation(info);
  if (isBoundaryFitState(info.stateName)) {
    return;
  }

  svg.innerHTML = "";

  const width = 640;
  const height = 210;
  const left = 48;
  const right = 16;
  const top = 16;
  const bottom = 30;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const yMin = state.dMin;
  const yMax = Math.max(sqrtReferenceDiameter(state.valueMax), state.dMax) * 1.04;

  function xScale(value) {
    return left + logPosition(value, state.valueMin, state.valueMax) * plotWidth;
  }

  function yScale(diameter) {
    const t = (diameter - yMin) / (yMax - yMin);
    return top + (1 - clamp(t, 0, 1)) * plotHeight;
  }

  function makePath(valueToDiameter) {
    const pointsOnCurve = [];
    const steps = 120;
    const m = state.valueMax / state.valueMin;
    for (let index = 0; index <= steps; index += 1) {
      const x = index / steps;
      const value = state.valueMin * Math.pow(m, x);
      pointsOnCurve.push([xScale(value), yScale(valueToDiameter(value))]);
    }
    return pointsOnCurve
      .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
      .join(" ");
  }

  const frame = createSvgElement("rect", {
    class: "curve-frame",
    x: left,
    y: top,
    width: plotWidth,
    height: plotHeight,
  });
  svg.appendChild(frame);

  [state.dMin, state.dMax].forEach((diameter) => {
    const y = yScale(diameter);
    svg.appendChild(
      createSvgElement("line", {
        class: diameter === state.dMax ? "curve-cap-line" : "curve-grid-line",
        x1: left,
        x2: width - right,
        y1: y,
        y2: y,
      })
    );
    svg.appendChild(
      createSvgElement("text", {
        class: "curve-axis-label",
        x: 8,
        y: y + 4,
      })
    ).textContent = diameter === state.dMax ? "Dmax" : "Dmin";
  });

  [
    ["curve-linear", linearReferenceDiameter],
    ["curve-sqrt", sqrtReferenceDiameter],
    [
      "curve-fit",
      (value) => referenceFitDiameter(value, state.valueMin, state.valueMax, state.dMin, state.dMax),
    ],
    ["curve-emphasis", (value) => diameterForValue(value, state.emphasis)],
  ].forEach(([className, valueToDiameter]) => {
    svg.appendChild(
      createSvgElement("path", {
        class: `curve-path ${className}`,
        d: makePath(valueToDiameter),
      })
    );
  });

  svg.appendChild(
    createSvgElement("text", {
      class: "curve-axis-label",
      x: left,
      y: height - 9,
    })
  ).textContent = `v=${state.valueMin}`;
  svg.appendChild(
    createSvgElement("text", {
      class: "curve-axis-label curve-axis-label-end",
      x: width - right,
      y: height - 9,
    })
  ).textContent = `v=${state.valueMax}`;

}

function render() {
  renderConstraintControls();
  renderControls();
  renderBoundaryPanel();
  renderBubbles();
  renderFormula();
  renderTable();
  renderCurve();
}

function updateConstraintRange(kind, edge, rawValue) {
  const value = Number(rawValue);

  if (kind === "value") {
    state.valueMin = VALUE_MIN;
    state.valueMax = valueMaxFromSliderPosition(value);
  }

  if (kind === "diameter") {
    if (edge === "min") {
      state.dMin = Math.min(value, state.dMax - DIAMETER_RANGE_GAP);
      state.dMin = clamp(state.dMin, DIAMETER_CONTROL_MIN, DIAMETER_CONTROL_MAX - DIAMETER_RANGE_GAP);
    } else {
      state.dMax = Math.max(value, state.dMin + DIAMETER_RANGE_GAP);
      state.dMax = clamp(state.dMax, DIAMETER_CONTROL_MIN + DIAMETER_RANGE_GAP, DIAMETER_CONTROL_MAX);
    }
  }

  render();
}

function typesetPanel(panel) {
  if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
    window.MathJax.typesetPromise([panel]).catch(() => {});
  }
}

function activateTab(button) {
  const group = button.dataset.tabGroup;
  const targetId = button.dataset.tabTarget;
  const panel = document.getElementById(targetId);
  if (!group || !panel) return;

  document.querySelectorAll(`[data-tab-group="${group}"]`).forEach((tabButton) => {
    const isActive = tabButton === button;
    tabButton.classList.toggle("is-active", isActive);
    tabButton.setAttribute("aria-selected", String(isActive));
  });

  document.querySelectorAll(`[data-tab-group="${group}"]`).forEach((tabButton) => {
    const controlledPanel = document.getElementById(tabButton.dataset.tabTarget);
    if (!controlledPanel) return;
    controlledPanel.hidden = tabButton !== button;
  });

  typesetPanel(panel);
}

document.querySelectorAll("[data-tab-target]").forEach((button) => {
  button.addEventListener("click", () => activateTab(button));
});

$("#emphasis-slider").addEventListener("input", (event) => {
  state.emphasis = clamp(Number(event.target.value), -1, 1);
  render();
});

[
  ["#value-max-slider", "value", "max"],
  ["#diameter-min-slider", "diameter", "min"],
  ["#diameter-max-slider", "diameter", "max"],
].forEach(([selector, kind, edge]) => {
  const input = $(selector);
  if (!input) return;
  input.addEventListener("input", (event) => {
    updateConstraintRange(kind, edge, event.target.value);
  });
});

document.querySelectorAll("[data-value-anchor]").forEach((button) => {
  button.addEventListener("click", () => {
    state.valueMin = VALUE_MIN;
    state.valueMax = Number(button.dataset.valueAnchor);
    recordEvent("value_anchor", { valueMax: state.valueMax });
    render();
  });
});

const valueRangeBackButton = $("#value-range-back");
if (valueRangeBackButton) {
  valueRangeBackButton.addEventListener("click", () => {
    state.valueMin = VALUE_MIN;
    state.valueMax = VALUE_CONTROL_MAX;
    recordEvent("value_range_back", { valueMax: state.valueMax });
    render();
  });
}

document.querySelectorAll(".preset-button").forEach((button) => {
  button.addEventListener("click", () => {
    state.emphasis = Number(button.dataset.emphasis);
    recordEvent("emphasis_preset", { emphasis: state.emphasis });
    render();
  });
});

$("#bubble-map").addEventListener("click", (event) => {
  const marker = event.target.closest(".bubble-marker");
  if (!marker) return;
  state.selectedId = marker.dataset.nodeId;
  recordEvent("bubble_select", {
    emphasis: state.emphasis,
    nodeId: state.selectedId,
    value: valueForNode(selectedNode()),
  });
  render();
});

render();
