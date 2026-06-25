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

let hoverTooltipElement = null;

function ensureHoverTooltip() {
  if (hoverTooltipElement) return hoverTooltipElement;
  hoverTooltipElement = document.createElement("div");
  hoverTooltipElement.className = "value-hover-tooltip";
  hoverTooltipElement.setAttribute("role", "tooltip");
  document.body.appendChild(hoverTooltipElement);
  return hoverTooltipElement;
}

function positionHoverTooltip(event) {
  if (!hoverTooltipElement) return;
  const margin = 12;
  const offset = 14;
  const rect = hoverTooltipElement.getBoundingClientRect();
  let left = event.clientX + offset;
  let top = event.clientY + offset;

  if (left + rect.width > window.innerWidth - margin) {
    left = event.clientX - rect.width - offset;
  }
  if (top + rect.height > window.innerHeight - margin) {
    top = event.clientY - rect.height - offset;
  }

  hoverTooltipElement.style.left = `${Math.max(margin, left)}px`;
  hoverTooltipElement.style.top = `${Math.max(margin, top)}px`;
}

function showHoverTooltip(marker, event) {
  if (!marker?.dataset.tooltip) return;
  const tooltip = ensureHoverTooltip();
  tooltip.textContent = marker.dataset.tooltip;
  tooltip.classList.add("is-visible");
  positionHoverTooltip(event);
}

function hideHoverTooltip() {
  if (!hoverTooltipElement) return;
  hoverTooltipElement.classList.remove("is-visible");
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
    const severity = Math.round(node.x);
    const confidence = Math.round(node.y);
    const diameter = mapDiameterForValue(value, info);
    const radius = diameter / 2;
    const valuesTooltip = mainBubbleTooltipText(value, severity, confidence);
    const marker = document.createElement("button");
    marker.className = node.id === state.selectedId ? "bubble-marker is-selected" : "bubble-marker";
    marker.type = "button";
    marker.style.left = `${node.x}%`;
    marker.style.top = `${node.y}%`;
    marker.style.width = `${diameter}px`;
    marker.style.height = `${diameter}px`;
    marker.dataset.tooltip = valuesTooltip;
    marker.setAttribute(
      "aria-label",
      `alert count ${formatValue(value)}, severity ${severity}, confidence ${confidence}, diameter ${formatPx(diameter)}`
    );
    marker.setAttribute("aria-pressed", String(node.id === state.selectedId));
    marker.dataset.nodeId = node.id;
    map.appendChild(marker);
  });

  points.forEach((node) => {
    if (node.id !== state.selectedId) return;
    const value = valueForNode(node);
    const severity = Math.round(node.x);
    const confidence = Math.round(node.y);
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
          <dt>Alert count</dt>
          <dd>${formatValue(value)}</dd>
        </div>
        <div>
          <dt>Severity</dt>
          <dd>${formatValue(severity)}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>${formatValue(confidence)}</dd>
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

const STUDY_VERSION = "bounded-bubbles-test-v3";
const STUDY_MAX_TRIAL_DURATION_MS = 30000;
const STUDY_MAIN_TRIAL_COUNT = 24;
const STUDY_PRACTICE_TRIAL_COUNT = 1;
const STUDY_CONDITIONS = ["referenceFit", "smallValueEmphasis", "largeValueEmphasis"];
const STUDY_TASK_CONDITIONS = {
  small: ["referenceFit", "smallValueEmphasis"],
  large: ["referenceFit", "largeValueEmphasis"],
};
const STUDY_CHART_SCENARIO = "synthetic-security-dashboard";
const STUDY_VALUE_MIN = 1;
const STUDY_VALUE_MAX = 1000;
const STUDY_D_MIN = D_MIN;
const STUDY_D_MAX = D_MAX * 2;

const studyCategories = [
  "Suspicious Login",
  "Privilege Escalation",
  "Malware",
  "Data Exfiltration",
  "Cloud Misconfiguration",
  "Endpoint Anomaly",
  "Policy Violation",
];

const studyCategoryStyles = {
  "Suspicious Login": {
    fill: "rgba(49, 119, 156, 0.34)",
    border: "rgba(31, 82, 110, 0.34)",
  },
  "Privilege Escalation": {
    fill: "rgba(132, 92, 161, 0.34)",
    border: "rgba(96, 61, 122, 0.34)",
  },
  Malware: {
    fill: "rgba(184, 85, 78, 0.34)",
    border: "rgba(139, 58, 54, 0.36)",
  },
  "Data Exfiltration": {
    fill: "rgba(49, 128, 99, 0.34)",
    border: "rgba(33, 93, 72, 0.34)",
  },
  "Cloud Misconfiguration": {
    fill: "rgba(196, 142, 58, 0.34)",
    border: "rgba(146, 101, 35, 0.34)",
  },
  "Endpoint Anomaly": {
    fill: "rgba(101, 122, 55, 0.34)",
    border: "rgba(73, 91, 38, 0.34)",
  },
  "Policy Violation": {
    fill: "rgba(116, 119, 125, 0.34)",
    border: "rgba(82, 87, 94, 0.34)",
  },
};

const studyTrialTemplates = [
  {
    datasetId: "sec-dataset-01",
    taskPrompt: "Click the high-risk suspicious login cluster with 1 alert.",
    targetId: "sec01-target",
    targetLabel: "North Gateway Login",
    targetCategory: "Suspicious Login",
    targetSeverity: 91,
    targetConfidence: 88,
    targetAlertCount: 1,
  },
  {
    datasetId: "sec-dataset-02",
    taskPrompt: "Click the high-risk malware cluster with 2 alerts.",
    targetId: "sec02-target",
    targetLabel: "Kernel Loader Beacon",
    targetCategory: "Malware",
    targetSeverity: 94,
    targetConfidence: 91,
    targetAlertCount: 2,
  },
  {
    datasetId: "sec-dataset-03",
    taskPrompt: "Click the data exfiltration cluster near the upper-right corner with 5 alerts.",
    targetId: "sec03-target",
    targetLabel: "Outbound Vault Probe",
    targetCategory: "Data Exfiltration",
    targetSeverity: 89,
    targetConfidence: 95,
    targetAlertCount: 5,
  },
  {
    datasetId: "sec-dataset-04",
    taskPrompt: "Click the suspicious login cluster with 10 alerts in the high-risk zone.",
    targetId: "sec04-target",
    targetLabel: "Dormant Admin Login",
    targetCategory: "Suspicious Login",
    targetSeverity: 87,
    targetConfidence: 92,
    targetAlertCount: 10,
  },
  {
    datasetId: "sec-dataset-05",
    taskPrompt: "Click the high-confidence privilege escalation cluster with 3 alerts.",
    targetId: "sec05-target",
    targetLabel: "Credential Replay Thread",
    targetCategory: "Privilege Escalation",
    targetSeverity: 86,
    targetConfidence: 96,
    targetAlertCount: 3,
  },
  {
    datasetId: "sec-dataset-06",
    taskPrompt: "Click the cloud misconfiguration cluster with 10 alerts near the high-risk zone.",
    targetId: "sec06-target",
    targetLabel: "Public Storage Policy",
    targetCategory: "Cloud Misconfiguration",
    targetSeverity: 92,
    targetConfidence: 86,
    targetAlertCount: 10,
  },
  {
    datasetId: "sec-dataset-07",
    taskFocus: "large",
    taskPrompt: "Click the low-risk suspicious login cluster with 610 alerts.",
    targetId: "sec07-target",
    targetLabel: "Routine Login Flood",
    targetCategory: "Suspicious Login",
    targetSeverity: 24,
    targetConfidence: 28,
    targetAlertCount: 610,
  },
  {
    datasetId: "sec-dataset-08",
    taskFocus: "large",
    taskPrompt: "Click the policy violation cluster with 680 alerts.",
    targetId: "sec08-target",
    targetLabel: "Policy Exception Backlog",
    targetCategory: "Policy Violation",
    targetSeverity: 34,
    targetConfidence: 18,
    targetAlertCount: 680,
  },
  {
    datasetId: "sec-dataset-09",
    taskFocus: "large",
    taskPrompt: "Click the endpoint anomaly cluster with 720 alerts.",
    targetId: "sec09-target",
    targetLabel: "Endpoint Telemetry Flood",
    targetCategory: "Endpoint Anomaly",
    targetSeverity: 42,
    targetConfidence: 34,
    targetAlertCount: 720,
  },
  {
    datasetId: "sec-dataset-10",
    taskFocus: "large",
    taskPrompt: "Click the cloud misconfiguration cluster with 740 alerts.",
    targetId: "sec10-target",
    targetLabel: "Cloud Inventory Drift",
    targetCategory: "Cloud Misconfiguration",
    targetSeverity: 28,
    targetConfidence: 46,
    targetAlertCount: 740,
  },
  {
    datasetId: "sec-dataset-11",
    taskFocus: "large",
    taskPrompt: "Click the endpoint anomaly cluster with 830 alerts.",
    targetId: "sec11-target",
    targetLabel: "Device Hygiene Backlog",
    targetCategory: "Endpoint Anomaly",
    targetSeverity: 48,
    targetConfidence: 22,
    targetAlertCount: 830,
  },
  {
    datasetId: "sec-dataset-12",
    taskFocus: "large",
    taskPrompt: "Click the policy violation cluster with 880 alerts.",
    targetId: "sec12-target",
    targetLabel: "Policy Audit Batch",
    targetCategory: "Policy Violation",
    targetSeverity: 56,
    targetConfidence: 40,
    targetAlertCount: 880,
  },
];

const practiceTrialTemplate = {
  datasetId: "practice-dataset-01",
  taskPrompt: "Practice: Click the alert cluster with 25 alerts.",
  targetId: "practice-target",
  targetLabel: "Practice Alert Cluster",
  targetCategory: "Endpoint Anomaly",
  targetSeverity: 58,
  targetConfidence: 62,
  targetAlertCount: 25,
};

let testingState = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function makeSecurityPoint(
  id,
  label,
  category,
  severity,
  confidence,
  alertCount,
  isTarget = false,
  showLabel = false
) {
  return {
    id,
    label,
    category,
    severity: Math.round(clamp(severity, 1, 99)),
    confidence: Math.round(clamp(confidence, 1, 99)),
    alertCount: Math.round(clamp(alertCount, STUDY_VALUE_MIN, STUDY_VALUE_MAX)),
    isTarget,
    showLabel,
  };
}

function mainBubbleTooltipText(value, severity, confidence) {
  return `Alert count ${formatValue(value)} | Severity ${formatValue(severity)} | Confidence ${formatValue(confidence)}`;
}

function studyBubbleTooltipText(point) {
  return `Alert count ${formatValue(point.alertCount)} | Severity ${formatValue(point.severity)} | Confidence ${formatValue(point.confidence)}`;
}

function categoryAt(index) {
  return studyCategories[((index % studyCategories.length) + studyCategories.length) % studyCategories.length];
}

function buildPracticePoints() {
  return [
    makeSecurityPoint("practice-low-01", "Routine Login Batch", "Suspicious Login", 24, 31, 720),
    makeSecurityPoint("practice-low-02", "Policy Noise", "Policy Violation", 38, 24, 610),
    makeSecurityPoint("practice-mid-01", "Endpoint Burst", "Endpoint Anomaly", 61, 57, 180),
    makeSecurityPoint("practice-mid-02", "Cloud Drift", "Cloud Misconfiguration", 68, 48, 140),
    makeSecurityPoint("practice-near-01", "Malware Review Queue", "Malware", 53, 67, 18),
    makeSecurityPoint("practice-near-02", "Login Watchlist", "Suspicious Login", 64, 60, 32),
    makeSecurityPoint("practice-target", "Practice Alert Cluster", "Endpoint Anomaly", 58, 62, 25, true),
    makeSecurityPoint("practice-high-01", "Data Export Burst", "Data Exfiltration", 94, 77, 80),
    makeSecurityPoint("practice-high-02", "Privilege Review", "Privilege Escalation", 72, 76, 44),
    makeSecurityPoint("practice-low-03", "Device Hygiene", "Endpoint Anomaly", 44, 36, 830),
  ];
}

function addStudyScaleAnchors(pointsForTrial, datasetId) {
  const hasVisibleDMin = pointsForTrial.some((point) => point.alertCount === STUDY_VALUE_MIN);
  const hasVisibleDMax = pointsForTrial.some((point) => point.alertCount === STUDY_VALUE_MAX);
  const anchors = [];

  if (!hasVisibleDMax) {
    anchors.push(
      makeSecurityPoint(
        `${datasetId}-scale-max`,
        "Scale maximum anchor",
        "Policy Violation",
        10,
        10,
        STUDY_VALUE_MAX
      )
    );
  }

  if (!hasVisibleDMin) {
    anchors.push(
      makeSecurityPoint(
        `${datasetId}-scale-min`,
        "Scale minimum anchor",
        "Policy Violation",
        96,
        92,
        STUDY_VALUE_MIN
      )
    );
  }

  return [...pointsForTrial, ...anchors];
}

function buildLargeValueSecurityPoints(template, templateIndex) {
  const indexOffset = templateIndex + 1;
  const pointsForTrial = [
    makeSecurityPoint(
      template.targetId,
      template.targetLabel,
      template.targetCategory,
      template.targetSeverity,
      template.targetConfidence,
      template.targetAlertCount,
      true
    ),
  ];

  const largeDistractorSpecs = [
    [16, 20, 980],
    [28, 18, 930],
    [42, 22, 900],
    [56, 28, 860],
    [68, 38, 820],
    [20, 42, 780],
    [34, 36, 740],
    [50, 44, 700],
    [62, 52, 660],
    [26, 58, 610],
    [42, 56, 560],
    [58, 62, 500],
    [72, 58, 430],
    [78, 46, 340],
  ];
  const targetCategoryIndex = studyCategories.indexOf(template.targetCategory);
  largeDistractorSpecs
    .filter(
      ([severity, confidence, alertCount]) =>
        alertCount !== template.targetAlertCount &&
        Math.hypot(severity - template.targetSeverity, confidence - template.targetConfidence) > 10
    )
    .forEach(([severity, confidence, alertCount], distractorIndex) => {
      const category = categoryAt(targetCategoryIndex + distractorIndex + 1);
      pointsForTrial.push(
        makeSecurityPoint(
          `${template.datasetId}-large-${distractorIndex + 1}`,
          `${category} high-volume ${distractorIndex + 1}`,
          category,
          severity,
          confidence,
          alertCount
        )
      );
    });

  const smallBackgroundSpecs = [
    [88, 88, 12],
    [82, 76, 24],
    [94, 72, 42],
    [76, 92, 35],
    [92, 60, 75],
    [68, 86, 18],
    [80, 64, 120],
    [60, 90, 160],
  ];
  smallBackgroundSpecs.forEach(([severity, confidence, alertCount], distractorIndex) => {
    const category = categoryAt(indexOffset + distractorIndex + 3);
    pointsForTrial.push(
      makeSecurityPoint(
        `${template.datasetId}-background-${distractorIndex + 1}`,
        `${category} background ${distractorIndex + 1}`,
        category,
        severity,
        confidence,
        alertCount
      )
    );
  });

  return pointsForTrial;
}

function nearbyLowCountDistractorCounts(targetCount) {
  return [1, 2, 3, 5, 10, 15, 24, 32]
    .filter((alertCount) => alertCount !== targetCount)
    .sort(
      (a, b) =>
        Math.abs(Math.log(a / targetCount)) - Math.abs(Math.log(b / targetCount))
    )
    .slice(0, 4);
}

function buildSecurityPoints(template, templateIndex) {
  if (template.taskFocus === "large") {
    return buildLargeValueSecurityPoints(template, templateIndex);
  }

  const indexOffset = templateIndex + 1;
  const pointsForTrial = [
    makeSecurityPoint(
      template.targetId,
      template.targetLabel,
      template.targetCategory,
      template.targetSeverity,
      template.targetConfidence,
      template.targetAlertCount,
      true
    ),
  ];

  const targetCategoryIndex = studyCategories.indexOf(template.targetCategory);
  const targetCount = template.targetAlertCount;
  const nearbyOffsets = [
    { severity: -4, confidence: 3, categoryOffset: 0 },
    { severity: 4, confidence: -4, categoryOffset: 2 },
    { severity: -7, confidence: -6, categoryOffset: 3 },
    { severity: 6, confidence: 5, categoryOffset: 5 },
  ];
  const nearbyDistractors = nearbyLowCountDistractorCounts(targetCount).map((alertCount, index) => ({
    ...nearbyOffsets[index],
    alertCount,
  }));
  nearbyDistractors.forEach((spec, distractorIndex) => {
    pointsForTrial.push(
      makeSecurityPoint(
        `${template.datasetId}-near-${distractorIndex + 1}`,
        `${categoryAt(targetCategoryIndex + spec.categoryOffset)} nearby ${distractorIndex + 1}`,
        categoryAt(targetCategoryIndex + spec.categoryOffset),
        template.targetSeverity + spec.severity,
        template.targetConfidence + spec.confidence,
        spec.alertCount
      )
    );
  });

  const largeLowRiskSpecs = [
    [18, 27, 860],
    [29, 39, 740],
    [42, 21, 950],
    [33, 52, 680],
    [51, 33, 880],
    [22, 58, 610],
  ];
  largeLowRiskSpecs.forEach(([severity, confidence, alertCount], distractorIndex) => {
    const jitter = ((indexOffset + distractorIndex) % 5) - 2;
    pointsForTrial.push(
      makeSecurityPoint(
        `${template.datasetId}-large-${distractorIndex + 1}`,
        `${categoryAt(distractorIndex + indexOffset)} large ${distractorIndex + 1}`,
        categoryAt(distractorIndex + indexOffset),
        severity + jitter * 2,
        confidence - jitter * 2,
        alertCount - jitter * 24
      )
    );
  });

  const mediumRiskSpecs = [
    [58, 62, 180],
    [63, 72, 120],
    [72, 58, 165],
    [48, 69, 140],
    [69, 44, 230],
    [54, 51, 260],
    [75, 66, 95],
    [46, 56, 155],
    [67, 73, 72],
    [57, 42, 210],
    [62, 35, 190],
    [39, 68, 130],
  ];
  mediumRiskSpecs.forEach(([severity, confidence, alertCount], distractorIndex) => {
    const jitter = ((indexOffset * 2 + distractorIndex) % 7) - 3;
    pointsForTrial.push(
      makeSecurityPoint(
        `${template.datasetId}-medium-${distractorIndex + 1}`,
        `${categoryAt(distractorIndex + indexOffset + 2)} medium ${distractorIndex + 1}`,
        categoryAt(distractorIndex + indexOffset + 2),
        severity + jitter,
        confidence - jitter,
        alertCount + jitter * 9
      )
    );
  });

  const mixedDistractorSpecs = [
    [82, 79, 18],
    [78, 88, 50],
    [85, 71, 110],
    [31, 82, 440],
    [73, 83, 30],
    [90, 63, 160],
    [64, 86, 90],
    [44, 47, 530],
    [36, 76, 390],
    [79, 37, 580],
  ];
  mixedDistractorSpecs.forEach(([severity, confidence, alertCount], distractorIndex) => {
    const jitter = ((indexOffset * 3 + distractorIndex) % 5) - 2;
    pointsForTrial.push(
      makeSecurityPoint(
        `${template.datasetId}-mixed-${distractorIndex + 1}`,
        `${categoryAt(distractorIndex + indexOffset + 4)} mixed ${distractorIndex + 1}`,
        categoryAt(distractorIndex + indexOffset + 4),
        severity + jitter * 2,
        confidence + jitter,
        alertCount + jitter * 2
      )
    );
  });

  return pointsForTrial;
}

function createStudyTrial(template, condition, templateIndex) {
  const rawPointsForTrial =
    template.datasetId === practiceTrialTemplate.datasetId
      ? buildPracticePoints()
      : buildSecurityPoints(template, templateIndex);
  const pointsForTrial = addStudyScaleAnchors(rawPointsForTrial, template.datasetId);
  const taskFocus = template.taskFocus || "small";

  return {
    datasetId: template.datasetId,
    taskPrompt: template.taskPrompt,
    targetId: template.targetId,
    taskFocus,
    condition,
    points: pointsForTrial,
  };
}

function shuffledStudyTrials(trials) {
  const shuffled = [...trials];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function hasAdjacentRepeatedDataset(trials) {
  return trials.some((trial, index) => index > 0 && trial.datasetId === trials[index - 1].datasetId);
}

function randomizedStudyTrials(trials) {
  let bestShuffle = shuffledStudyTrials(trials);
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const candidate = shuffledStudyTrials(trials);
    if (!hasAdjacentRepeatedDataset(candidate)) {
      return candidate;
    }
    bestShuffle = candidate;
  }

  const remaining = [...bestShuffle];
  const ordered = [];
  while (remaining.length) {
    const previousDataset = ordered.at(-1)?.datasetId;
    let nextIndex = remaining.findIndex((trial) => trial.datasetId !== previousDataset);
    if (nextIndex < 0) nextIndex = 0;
    ordered.push(remaining.splice(nextIndex, 1)[0]);
  }
  return ordered;
}

function createMainStudyTrials() {
  const trials = [];
  studyTrialTemplates.forEach((template, templateIndex) => {
    const taskFocus = template.taskFocus || "small";
    const conditions = STUDY_TASK_CONDITIONS[taskFocus] || STUDY_TASK_CONDITIONS.small;
    conditions.forEach((condition) => {
      trials.push(createStudyTrial(template, condition, templateIndex));
    });
  });
  return randomizedStudyTrials(trials).map((trial, index) => ({
    ...trial,
    displayIndex: index + 1,
  }));
}

function createRandomizationId() {
  return `order-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createTestingParticipantId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return `bb-${window.crypto.randomUUID()}`;
  }

  return `bb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createTestingState() {
  return {
    phase: "welcome",
    participantId: createTestingParticipantId(),
    randomizationId: createRandomizationId(),
    consentChecked: false,
    practiceTrial: createStudyTrial(practiceTrialTemplate, "referenceFit", 0),
    mainTrials: createMainStudyTrials(),
    currentMainIndex: null,
    runtime: null,
    results: [],
    copyStatus: "",
    advanceTimerId: null,
  };
}

function studyDiameterForPoint(point, condition) {
  if (condition === "linearDiameter") {
    return linearDiameter(point.alertCount, STUDY_VALUE_MIN, STUDY_VALUE_MAX, STUDY_D_MIN, STUDY_D_MAX);
  }
  if (condition === "smallValueEmphasis") {
    return emphasizedDiameter(
      point.alertCount,
      STUDY_VALUE_MIN,
      STUDY_VALUE_MAX,
      -1,
      STUDY_D_MIN,
      STUDY_D_MAX
    );
  }
  if (condition === "largeValueEmphasis") {
    return emphasizedDiameter(
      point.alertCount,
      STUDY_VALUE_MIN,
      STUDY_VALUE_MAX,
      1,
      STUDY_D_MIN,
      STUDY_D_MAX
    );
  }
  return referenceFitDiameter(point.alertCount, STUDY_VALUE_MIN, STUDY_VALUE_MAX, STUDY_D_MIN, STUDY_D_MAX);
}

function getStudyTarget(trial) {
  return trial.points.find((point) => point.id === trial.targetId);
}

function setTestingMode(isTesting) {
  const shell = document.querySelector(".app-shell");
  const tabs = document.querySelector(".page-tabs");
  const testingRoot = $("#testing-root");
  if (shell) shell.classList.toggle("is-testing-mode", isTesting);
  if (tabs) tabs.hidden = isTesting;
  if (testingRoot) testingRoot.hidden = !isTesting;

  if (isTesting) {
    document.querySelectorAll(".page-tab-panel").forEach((panel) => {
      panel.hidden = true;
    });
    return;
  }

  const activePageTab =
    document.querySelector('.page-tabs [data-tab-group="page"].is-active') || $("#explore-tab-button");
  if (activePageTab) {
    activateTab(activePageTab);
  } else {
    const explorePanel = $("#explore-panel");
    if (explorePanel) explorePanel.hidden = false;
  }
}

function clearActiveTrialTimers() {
  if (!testingState) return;
  if (testingState.runtime?.timeoutId) {
    window.clearTimeout(testingState.runtime.timeoutId);
  }
  if (testingState.advanceTimerId) {
    window.clearTimeout(testingState.advanceTimerId);
    testingState.advanceTimerId = null;
  }
}

function beginTestingFlow() {
  clearActiveTrialTimers();
  testingState = createTestingState();
  setTestingMode(true);
  renderTestingFlow();
}

function returnToPrototype() {
  clearActiveTrialTimers();
  testingState = null;
  setTestingMode(false);
}

function showTestingInstructions() {
  if (!testingState || !testingState.consentChecked) return;
  testingState.phase = "instructions";
  testingState.copyStatus = "";
  renderTestingFlow();
}

function startPracticeTrial() {
  if (!testingState) return;
  startStudyTrial(testingState.practiceTrial, {
    practice: true,
    trialIndex: 0,
    mainIndex: null,
  });
}

function startMainTrial(mainIndex) {
  if (!testingState) return;
  const trial = testingState.mainTrials[mainIndex];
  startStudyTrial(trial, {
    practice: false,
    trialIndex: mainIndex + 1,
    mainIndex,
  });
}

function startStudyTrial(trial, options) {
  clearActiveTrialTimers();
  testingState.phase = "trial";
  testingState.currentMainIndex = options.mainIndex;
  testingState.runtime = {
    trial,
    practice: options.practice,
    trialIndex: options.trialIndex,
    mainIndex: options.mainIndex,
    started: false,
    finished: false,
    feedback: "",
    startPerformance: null,
    startTimeISO: null,
    chartWidth: 0,
    chartHeight: 0,
    wrongMarkerClicks: 0,
    emptyPlotClicks: 0,
    totalClicks: 0,
    hoverCount: 0,
    hoveredPointIds: new Set(),
    timeoutId: null,
  };
  renderTestingFlow();
}

function armTrialTimer() {
  const runtime = testingState?.runtime;
  if (!runtime || runtime.started || runtime.finished) return;

  window.requestAnimationFrame(() => {
    if (!testingState || testingState.runtime !== runtime || runtime.started || runtime.finished) {
      return;
    }

    const plot = $("#study-plot");
    const plotRect = plot?.getBoundingClientRect();
    runtime.chartWidth = Math.round(plotRect?.width || 0);
    runtime.chartHeight = Math.round(plotRect?.height || 0);
    runtime.started = true;
    runtime.startPerformance = performance.now();
    runtime.startTimeISO = new Date().toISOString();
    runtime.timeoutId = window.setTimeout(() => {
      finishActiveTrial(false, true);
    }, STUDY_MAX_TRIAL_DURATION_MS);
  });
}

function finishActiveTrial(success, timedOut) {
  const runtime = testingState?.runtime;
  if (!testingState || !runtime || runtime.finished || !runtime.started) return;

  runtime.finished = true;
  if (runtime.timeoutId) {
    window.clearTimeout(runtime.timeoutId);
    runtime.timeoutId = null;
  }

  const endPerformance = performance.now();
  const endTimeISO = new Date().toISOString();
  const durationMs = success ? Math.round(endPerformance - runtime.startPerformance) : null;
  const target = getStudyTarget(runtime.trial);
  const targetDiameter = target ? studyDiameterForPoint(target, runtime.trial.condition) : 0;

  testingState.results.push({
    participantId: testingState.participantId,
    studyVersion: STUDY_VERSION,
    randomizationId: testingState.randomizationId,
    trialIndex: runtime.trialIndex,
    practice: runtime.practice,
    condition: runtime.trial.condition,
    taskFocus: runtime.trial.taskFocus,
    taskPrompt: runtime.trial.taskPrompt,
    datasetId: runtime.trial.datasetId,
    targetId: runtime.trial.targetId,
    targetLabel: target?.label || "",
    targetCategory: target?.category || "",
    targetAlertCount: target?.alertCount || 0,
    targetSeverity: target?.severity || 0,
    targetConfidence: target?.confidence || 0,
    targetDiameter: Number(targetDiameter.toFixed(2)),
    chartWidth: runtime.chartWidth,
    chartHeight: runtime.chartHeight,
    startTimeISO: runtime.startTimeISO,
    endTimeISO,
    durationMs,
    success,
    timedOut,
    wrongMarkerClicks: runtime.wrongMarkerClicks,
    emptyPlotClicks: runtime.emptyPlotClicks,
    totalClicks: runtime.totalClicks,
    hoverCount: runtime.hoverCount,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    userAgent: navigator.userAgent,
  });

  runtime.feedback = success ? "Correct" : "Timed out";
  renderTestingFlow();

  testingState.advanceTimerId = window.setTimeout(() => {
    advanceAfterTrial();
  }, success ? 500 : 800);
}

function advanceAfterTrial() {
  if (!testingState?.runtime) return;
  const runtime = testingState.runtime;
  testingState.runtime = null;
  testingState.advanceTimerId = null;

  if (runtime.practice) {
    startMainTrial(0);
    return;
  }

  const nextIndex = runtime.mainIndex + 1;
  if (nextIndex < testingState.mainTrials.length) {
    startMainTrial(nextIndex);
    return;
  }

  testingState.phase = "results";
  testingState.currentMainIndex = null;
  renderTestingFlow();
}

function handleStudyMarkerClick(pointId) {
  const runtime = testingState?.runtime;
  if (!runtime || !runtime.started || runtime.finished) return;

  runtime.totalClicks += 1;
  if (pointId === runtime.trial.targetId) {
    finishActiveTrial(true, false);
    return;
  }

  runtime.wrongMarkerClicks += 1;
}

function handleStudyEmptyClick() {
  const runtime = testingState?.runtime;
  if (!runtime || !runtime.started || runtime.finished) return;
  runtime.totalClicks += 1;
  runtime.emptyPlotClicks += 1;
}

function handleStudyMarkerHover(pointId) {
  const runtime = testingState?.runtime;
  if (!runtime || !runtime.started || runtime.finished || !pointId) return;
  if (runtime.hoveredPointIds.has(pointId)) return;
  runtime.hoveredPointIds.add(pointId);
  runtime.hoverCount += 1;
}

function valuesForCondition(condition, taskFocus = null) {
  return testingState.results.filter(
    (result) =>
      !result.practice &&
      result.condition === condition &&
      (taskFocus === null || result.taskFocus === taskFocus)
  );
}

function successfulDurationsForCondition(condition, taskFocus = null) {
  return valuesForCondition(condition, taskFocus)
    .filter((result) => result.success && typeof result.durationMs === "number")
    .map((result) => result.durationMs);
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function mean(values) {
  if (!values.length) return null;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function successRate(condition, taskFocus = null) {
  const conditionResults = valuesForCondition(condition, taskFocus);
  if (!conditionResults.length) return null;
  const successes = conditionResults.filter((result) => result.success).length;
  return Number((successes / conditionResults.length).toFixed(3));
}

function clickSum(condition, fieldName, taskFocus = null) {
  return valuesForCondition(condition, taskFocus).reduce((total, result) => total + result[fieldName], 0);
}

function computeStudySummary() {
  const smallReferenceDurations = successfulDurationsForCondition("referenceFit", "small");
  const smallEmphasisDurations = successfulDurationsForCondition("smallValueEmphasis", "small");
  const largeReferenceDurations = successfulDurationsForCondition("referenceFit", "large");
  const largeEmphasisDurations = successfulDurationsForCondition("largeValueEmphasis", "large");
  return {
    medianReferenceFitSmallMs: median(smallReferenceDurations),
    medianSmallValueEmphasisMs: median(smallEmphasisDurations),
    medianReferenceFitLargeMs: median(largeReferenceDurations),
    medianLargeValueEmphasisMs: median(largeEmphasisDurations),
    meanReferenceFitSmallMs: mean(smallReferenceDurations),
    meanSmallValueEmphasisMs: mean(smallEmphasisDurations),
    meanReferenceFitLargeMs: mean(largeReferenceDurations),
    meanLargeValueEmphasisMs: mean(largeEmphasisDurations),
    successRateReferenceFitSmall: successRate("referenceFit", "small"),
    successRateSmallValueEmphasis: successRate("smallValueEmphasis", "small"),
    successRateReferenceFitLarge: successRate("referenceFit", "large"),
    successRateLargeValueEmphasis: successRate("largeValueEmphasis", "large"),
    wrongClicksReferenceFitSmall: clickSum("referenceFit", "wrongMarkerClicks", "small"),
    wrongClicksSmallValueEmphasis: clickSum("smallValueEmphasis", "wrongMarkerClicks", "small"),
    wrongClicksReferenceFitLarge: clickSum("referenceFit", "wrongMarkerClicks", "large"),
    wrongClicksLargeValueEmphasis: clickSum("largeValueEmphasis", "wrongMarkerClicks", "large"),
    emptyClicksReferenceFitSmall: clickSum("referenceFit", "emptyPlotClicks", "small"),
    emptyClicksSmallValueEmphasis: clickSum("smallValueEmphasis", "emptyPlotClicks", "small"),
    emptyClicksReferenceFitLarge: clickSum("referenceFit", "emptyPlotClicks", "large"),
    emptyClicksLargeValueEmphasis: clickSum("largeValueEmphasis", "emptyPlotClicks", "large"),
  };
}

function buildStudyExport() {
  return {
    metadata: {
      appName: "Bounded Bubbles",
      studyVersion: STUDY_VERSION,
      participantId: testingState.participantId,
      randomizationId: testingState.randomizationId,
      createdAt: new Date().toISOString(),
      description:
        "Browser-only interaction test comparing reference fit with small-value emphasis for low-count targets and large-value emphasis for high-count targets in synthetic security bubbles.",
      dataPolicy:
        "Results are stored only in browser memory by this static app. No backend upload, account, analytics, or personal identity collection is used.",
    },
    configuration: {
      conditions: [...STUDY_CONDITIONS],
      taskConditionPairs: {
        small: [...STUDY_TASK_CONDITIONS.small],
        large: [...STUDY_TASK_CONDITIONS.large],
      },
      mainTrialCount: STUDY_MAIN_TRIAL_COUNT,
      practiceTrialCount: STUDY_PRACTICE_TRIAL_COUNT,
      maxTrialDurationMs: STUDY_MAX_TRIAL_DURATION_MS,
      chartScenario: STUDY_CHART_SCENARIO,
      valueMin: STUDY_VALUE_MIN,
      valueMax: STUDY_VALUE_MAX,
      dMin: STUDY_D_MIN,
      dMax: STUDY_D_MAX,
      mainTrialOrder: testingState.mainTrials.map((trial) => ({
        displayIndex: trial.displayIndex,
        datasetId: trial.datasetId,
        taskFocus: trial.taskFocus,
        condition: trial.condition,
        targetId: trial.targetId,
      })),
    },
    summary: computeStudySummary(),
    trials: testingState.results,
  };
}

function formatMetricMs(value) {
  return value === null ? "n/a" : `${formatValue(value)} ms`;
}

function formatRateMetric(value) {
  return value === null ? "n/a" : `${Math.round(value * 100)}%`;
}

function formatFilenameTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function downloadStudyJson() {
  if (!testingState) return;
  const exportData = buildStudyExport();
  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bounded-bubbles-results-${testingState.participantId}-${formatFilenameTimestamp()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) {
    throw new Error("Copy command was not available.");
  }
}

async function copyStudyJson() {
  if (!testingState) return;
  const text = JSON.stringify(buildStudyExport(), null, 2);
  let copied = false;

  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      copied = true;
    } else {
      fallbackCopyText(text);
      copied = true;
    }
  } catch (error) {
    try {
      fallbackCopyText(text);
      copied = true;
    } catch (fallbackError) {
      copied = false;
    }
  }

  testingState.copyStatus = copied
    ? "JSON copied to clipboard."
    : "Copy failed. Use Download JSON Results instead.";
  renderTestingFlow();
}

function renderDesktopWarning() {
  if (window.innerWidth >= 900) return "";
  return `
    <div class="testing-warning" role="note">
      This test is designed for desktop or laptop screens. Results from small screens may be less reliable.
    </div>
  `;
}

function renderTestingWelcome() {
  return `
    <section class="testing-card" aria-labelledby="testing-welcome-title">
      <div>
        <p class="eyebrow">Interaction study</p>
        <h2 id="testing-welcome-title">Bounded Bubbles Interaction Test</h2>
      </div>
      <p>
        This short test measures how quickly and accurately people can select low-count and high-count bubbles in a synthetic security dashboard. The study runs entirely in your browser. It does not collect your name, email, or any personal information. At the end, you can download an anonymous JSON file with your results.
      </p>
      ${renderDesktopWarning()}
      <dl class="testing-facts">
        <div>
          <dt>Estimated time</dt>
          <dd>5-8 minutes</dd>
        </div>
        <div>
          <dt>Recommended device</dt>
          <dd>Desktop or laptop</dd>
        </div>
        <div>
          <dt>Collected data</dt>
          <dd>Timing, clicks, condition, viewport size, and browser user agent</dd>
        </div>
        <div>
          <dt>Trial order</dt>
          <dd>Randomized each session; paired maps are not shown back-to-back</dd>
        </div>
        <div>
          <dt>Data type</dt>
          <dd>No personal identity; synthetic security data only</dd>
        </div>
      </dl>
      <label class="testing-consent" for="testing-consent">
        <input id="testing-consent" type="checkbox" ${testingState.consentChecked ? "checked" : ""}>
        <span>I understand and agree to continue.</span>
      </label>
      <div class="testing-actions">
        <button class="test-button" type="button" data-test-action="continue-welcome" ${testingState.consentChecked ? "" : "disabled"}>
          Continue
        </button>
        <button class="test-button secondary" type="button" data-test-action="return-prototype">
          Return to Prototype
        </button>
      </div>
    </section>
  `;
}

function renderTestingInstructions() {
  return `
    <section class="testing-card" aria-labelledby="testing-instructions-title">
      <div>
        <p class="eyebrow">How it works</p>
        <h2 id="testing-instructions-title">Instructions</h2>
      </div>
      ${renderDesktopWarning()}
      <ul>
        <li>X-axis = Severity</li>
        <li>Y-axis = Confidence</li>
        <li>Bubble size = Alert count</li>
        <li>Each bubble represents a cluster of security alerts</li>
      </ul>
      <p>
        For each trial, click the alert cluster described in the prompt as quickly and accurately as possible.
      </p>
      <p>
        Some targets have low alert counts in the high-risk zone; others have high alert counts but are not the largest bubbles in the chart. Hovering a bubble shows alert count, severity, and confidence. Wrong clicks are allowed; keep trying until the correct bubble is selected or time runs out.
      </p>
      <div class="testing-actions">
        <button class="test-button" type="button" data-test-action="start-practice">
          Start Practice
        </button>
        <button class="test-button secondary" type="button" data-test-action="return-prototype">
          Return to Prototype
        </button>
      </div>
    </section>
  `;
}

function markerStyleForCategory(category) {
  const style = studyCategoryStyles[category] || studyCategoryStyles["Policy Violation"];
  return `--marker-fill: ${style.fill}; --marker-border: ${style.border};`;
}

function renderStudyMarker(point, trial) {
  const diameter = studyDiameterForPoint(point, trial.condition);
  const left = clamp(point.severity, 0, 100);
  const top = 100 - clamp(point.confidence, 0, 100);
  const valuesTooltip = studyBubbleTooltipText(point);
  const title = `${valuesTooltip} | ${point.label} | ${point.category}`;
  const label = point.showLabel
    ? `<span class="study-target-label" style="left: ${left}%; top: ${top}%;">${escapeHtml(point.label)}</span>`
    : "";

  return `
    <button
      class="study-marker"
      type="button"
      data-point-id="${escapeHtml(point.id)}"
      aria-label="${escapeHtml(title)}"
      data-tooltip="${escapeHtml(valuesTooltip)}"
      style="left: ${left}%; top: ${top}%; width: ${diameter.toFixed(2)}px; height: ${diameter.toFixed(2)}px; ${markerStyleForCategory(point.category)}"
    ></button>
    ${label}
  `;
}

function renderStudyPlot(trial) {
  const markers = [...trial.points]
    .sort((a, b) => studyDiameterForPoint(b, trial.condition) - studyDiameterForPoint(a, trial.condition))
    .map((point) => renderStudyMarker(point, trial))
    .join("");
  return `
    <div class="study-plot-shell">
      <div class="study-axis-y">Confidence</div>
      <div id="study-plot" class="study-plot" aria-label="Synthetic security alert bubble chart">
        <span class="study-axis-tick study-axis-tick-x" style="left: 10%;">10</span>
        <span class="study-axis-tick study-axis-tick-x" style="left: 50%;">50</span>
        <span class="study-axis-tick study-axis-tick-x" style="left: 90%;">90</span>
        <span class="study-axis-tick study-axis-tick-y" style="bottom: 10%;">10</span>
        <span class="study-axis-tick study-axis-tick-y" style="bottom: 50%;">50</span>
        <span class="study-axis-tick study-axis-tick-y" style="bottom: 90%;">90</span>
        ${markers}
      </div>
      <div class="study-axis-x">Severity</div>
    </div>
  `;
}

function renderTestingTrial() {
  const runtime = testingState.runtime;
  const progressText = runtime.practice
    ? "Practice"
    : `Trial ${runtime.trialIndex} of ${STUDY_MAIN_TRIAL_COUNT}`;
  const feedbackClass = runtime.feedback === "Timed out" ? " is-timeout" : "";
  return `
    <section class="testing-trial-shell" aria-labelledby="trial-title">
      <div class="trial-topbar">
        <div>
          <p class="eyebrow">Synthetic security dashboard</p>
          <h2 id="trial-title">${runtime.practice ? "Practice trial" : "Interaction trial"}</h2>
        </div>
        <span class="trial-progress">${progressText}</span>
      </div>
      <p class="trial-prompt">${escapeHtml(runtime.trial.taskPrompt)}</p>
      <div class="trial-feedback${feedbackClass}" aria-live="assertive">${escapeHtml(runtime.feedback)}</div>
      ${renderStudyPlot(runtime.trial)}
    </section>
  `;
}

function resultSpeedMessage(summary) {
  const comparisons = [];
  if (summary.medianReferenceFitSmallMs !== null && summary.medianSmallValueEmphasisMs !== null) {
    comparisons.push(
      summary.medianSmallValueEmphasisMs < summary.medianReferenceFitSmallMs
        ? "For low-count targets, e=-1 was faster than reference fit."
        : "For low-count targets, e=-1 was not faster than reference fit in this session."
    );
  }
  if (summary.medianReferenceFitLargeMs !== null && summary.medianLargeValueEmphasisMs !== null) {
    comparisons.push(
      summary.medianLargeValueEmphasisMs < summary.medianReferenceFitLargeMs
        ? "For high-count targets, e=1 was faster than reference fit."
        : "For high-count targets, e=1 was not faster than reference fit in this session."
    );
  }
  const comparison = comparisons.length
    ? comparisons.join(" ")
    : "Complete the trials to compare reference fit with task-aware emphasis.";
  return `${comparison} This is a single-session result and not a formal statistical analysis. The exported JSON can be combined with other participants' results for analysis.`;
}

function renderTaskResultTable({
  title,
  referenceLabel,
  emphasisLabel,
  referenceCount,
  emphasisCount,
  referenceMedian,
  emphasisMedian,
  referenceMean,
  emphasisMean,
  referenceSuccess,
  emphasisSuccess,
  referenceWrongClicks,
  emphasisWrongClicks,
  referenceEmptyClicks,
  emphasisEmptyClicks,
}) {
  return `
    <div class="result-section">
      <h3>${escapeHtml(title)}</h3>
      <div class="table-scroll">
        <table class="summary-table">
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col">${escapeHtml(referenceLabel)}</th>
              <th scope="col">${escapeHtml(emphasisLabel)}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Main trials</td>
              <td>${referenceCount}</td>
              <td>${emphasisCount}</td>
            </tr>
            <tr>
              <td>Median duration</td>
              <td>${formatMetricMs(referenceMedian)}</td>
              <td>${formatMetricMs(emphasisMedian)}</td>
            </tr>
            <tr>
              <td>Mean duration</td>
              <td>${formatMetricMs(referenceMean)}</td>
              <td>${formatMetricMs(emphasisMean)}</td>
            </tr>
            <tr>
              <td>Success rate</td>
              <td>${formatRateMetric(referenceSuccess)}</td>
              <td>${formatRateMetric(emphasisSuccess)}</td>
            </tr>
            <tr>
              <td>Wrong marker clicks</td>
              <td>${referenceWrongClicks}</td>
              <td>${emphasisWrongClicks}</td>
            </tr>
            <tr>
              <td>Empty plot clicks</td>
              <td>${referenceEmptyClicks}</td>
              <td>${emphasisEmptyClicks}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderTestingResults() {
  const summary = computeStudySummary();
  const smallReferenceCount = valuesForCondition("referenceFit", "small").length;
  const smallEmphasisCount = valuesForCondition("smallValueEmphasis", "small").length;
  const largeReferenceCount = valuesForCondition("referenceFit", "large").length;
  const largeEmphasisCount = valuesForCondition("largeValueEmphasis", "large").length;

  return `
    <section class="testing-card" aria-labelledby="testing-results-title">
      <div>
        <p class="eyebrow">Results</p>
        <h2 id="testing-results-title">Session Summary</h2>
      </div>
      <div class="result-message">${escapeHtml(resultSpeedMessage(summary))}</div>
      <div class="results-grid" aria-label="Summary metrics">
        <div class="result-metric">
          <span>Low-count reference fit</span>
          <strong>${formatMetricMs(summary.medianReferenceFitSmallMs)}</strong>
        </div>
        <div class="result-metric">
          <span>Low-count e=-1</span>
          <strong>${formatMetricMs(summary.medianSmallValueEmphasisMs)}</strong>
        </div>
        <div class="result-metric">
          <span>High-count reference fit</span>
          <strong>${formatMetricMs(summary.medianReferenceFitLargeMs)}</strong>
        </div>
        <div class="result-metric">
          <span>High-count e=1</span>
          <strong>${formatMetricMs(summary.medianLargeValueEmphasisMs)}</strong>
        </div>
      </div>
      ${renderTaskResultTable({
        title: "Low-count target tasks",
        referenceLabel: "Reference fit",
        emphasisLabel: "e=-1 small-value emphasis",
        referenceCount: smallReferenceCount,
        emphasisCount: smallEmphasisCount,
        referenceMedian: summary.medianReferenceFitSmallMs,
        emphasisMedian: summary.medianSmallValueEmphasisMs,
        referenceMean: summary.meanReferenceFitSmallMs,
        emphasisMean: summary.meanSmallValueEmphasisMs,
        referenceSuccess: summary.successRateReferenceFitSmall,
        emphasisSuccess: summary.successRateSmallValueEmphasis,
        referenceWrongClicks: summary.wrongClicksReferenceFitSmall,
        emphasisWrongClicks: summary.wrongClicksSmallValueEmphasis,
        referenceEmptyClicks: summary.emptyClicksReferenceFitSmall,
        emphasisEmptyClicks: summary.emptyClicksSmallValueEmphasis,
      })}
      ${renderTaskResultTable({
        title: "High-count target tasks",
        referenceLabel: "Reference fit",
        emphasisLabel: "e=1 large-value emphasis",
        referenceCount: largeReferenceCount,
        emphasisCount: largeEmphasisCount,
        referenceMedian: summary.medianReferenceFitLargeMs,
        emphasisMedian: summary.medianLargeValueEmphasisMs,
        referenceMean: summary.meanReferenceFitLargeMs,
        emphasisMean: summary.meanLargeValueEmphasisMs,
        referenceSuccess: summary.successRateReferenceFitLarge,
        emphasisSuccess: summary.successRateLargeValueEmphasis,
        referenceWrongClicks: summary.wrongClicksReferenceFitLarge,
        emphasisWrongClicks: summary.wrongClicksLargeValueEmphasis,
        referenceEmptyClicks: summary.emptyClicksReferenceFitLarge,
        emphasisEmptyClicks: summary.emptyClicksLargeValueEmphasis,
      })}
      <div class="testing-actions">
        <button class="test-button" type="button" data-test-action="download-json">
          Download JSON Results
        </button>
        <button class="test-button secondary" type="button" data-test-action="copy-json">
          Copy JSON to Clipboard
        </button>
        <button class="test-button secondary" type="button" data-test-action="return-prototype">
          Return to Prototype
        </button>
        <button class="test-button secondary" type="button" data-test-action="restart-test">
          Restart Test
        </button>
      </div>
      <div class="copy-status" aria-live="polite">${escapeHtml(testingState.copyStatus)}</div>
    </section>
  `;
}

function renderTestingFlow() {
  const root = $("#testing-root");
  if (!root || !testingState) return;

  if (testingState.phase === "welcome") {
    root.innerHTML = renderTestingWelcome();
  } else if (testingState.phase === "instructions") {
    root.innerHTML = renderTestingInstructions();
  } else if (testingState.phase === "trial") {
    root.innerHTML = renderTestingTrial();
    armTrialTimer();
  } else if (testingState.phase === "results") {
    root.innerHTML = renderTestingResults();
  }
}

function handleTestingAction(action) {
  if (action === "continue-welcome") {
    showTestingInstructions();
  } else if (action === "start-practice") {
    startPracticeTrial();
  } else if (action === "return-prototype") {
    returnToPrototype();
  } else if (action === "restart-test") {
    beginTestingFlow();
  } else if (action === "download-json") {
    downloadStudyJson();
  } else if (action === "copy-json") {
    copyStudyJson();
  }
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

document.addEventListener("pointerover", (event) => {
  const marker = event.target.closest(".bubble-marker[data-tooltip], .study-marker[data-tooltip]");
  if (!marker) return;
  showHoverTooltip(marker, event);
});

document.addEventListener("pointermove", (event) => {
  if (!hoverTooltipElement?.classList.contains("is-visible")) return;
  positionHoverTooltip(event);
});

document.addEventListener("pointerout", (event) => {
  const marker = event.target.closest(".bubble-marker[data-tooltip], .study-marker[data-tooltip]");
  if (!marker) return;
  const nextMarker = event.relatedTarget?.closest?.(".bubble-marker[data-tooltip], .study-marker[data-tooltip]");
  if (nextMarker === marker) return;
  hideHoverTooltip();
});

document.addEventListener("focusin", (event) => {
  const marker = event.target.closest(".bubble-marker[data-tooltip], .study-marker[data-tooltip]");
  if (!marker) return;
  const rect = marker.getBoundingClientRect();
  showHoverTooltip(marker, {
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  });
});

document.addEventListener("focusout", (event) => {
  const marker = event.target.closest(".bubble-marker[data-tooltip], .study-marker[data-tooltip]");
  if (!marker) return;
  hideHoverTooltip();
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

const beginTestingButton = $("#begin-testing-button");
if (beginTestingButton) {
  beginTestingButton.addEventListener("click", beginTestingFlow);
}

const testingRoot = $("#testing-root");
if (testingRoot) {
  testingRoot.addEventListener("click", (event) => {
    const marker = event.target.closest(".study-marker");
    if (marker && testingRoot.contains(marker)) {
      handleStudyMarkerClick(marker.dataset.pointId);
      return;
    }

    const plot = event.target.closest("#study-plot");
    if (plot && testingRoot.contains(plot)) {
      handleStudyEmptyClick();
      return;
    }

    const actionButton = event.target.closest("[data-test-action]");
    if (!actionButton || !testingRoot.contains(actionButton)) return;
    handleTestingAction(actionButton.dataset.testAction);
  });

  testingRoot.addEventListener("change", (event) => {
    if (event.target.id !== "testing-consent" || !testingState) return;
    testingState.consentChecked = event.target.checked;
    renderTestingFlow();
  });

  testingRoot.addEventListener("pointerover", (event) => {
    const marker = event.target.closest(".study-marker");
    if (!marker || !testingRoot.contains(marker)) return;
    handleStudyMarkerHover(marker.dataset.pointId);
  });
}

render();
