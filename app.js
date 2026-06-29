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

function lineupValues() {
  const count = 32;
  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0 : index / (count - 1);
    return state.valueMin + (state.valueMax - state.valueMin) * t;
  });
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
const hoverTooltipSelector =
  ".bubble-marker[data-tooltip], .study-marker[data-tooltip], .example-bubble[data-tooltip]";

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

function tooltipPayloadAttribute(payload) {
  return JSON.stringify(payload);
}

function tooltipPayloadPlainText(payload) {
  if (!payload || typeof payload !== "object") return String(payload || "");
  const lines = [`${payload.valueLabel || "Value"}: ${payload.valueText || ""}`];
  if (payload.title) lines.push(payload.title);
  (payload.items || []).forEach((item) => {
    lines.push(`${item.label}: ${item.value}`);
  });
  return lines.join("\n");
}

function renderTooltipPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return `<div class="tooltip-plain">${escapeHtml(String(payload || ""))}</div>`;
  }

  const items = (payload.items || [])
    .filter((item) => item?.label && item?.value !== undefined && item?.value !== null)
    .map(
      (item) => `
        <div>
          <dt>${escapeHtml(item.label)}</dt>
          <dd>${escapeHtml(item.value)}</dd>
        </div>
      `
    )
    .join("");

  return `
    <div class="structured-tooltip">
      <div class="tooltip-value-block">
        <span>${escapeHtml(payload.valueLabel || "Value")}</span>
        <strong>${escapeHtml(payload.valueText || "")}</strong>
      </div>
      ${payload.title ? `<p class="tooltip-identity">${escapeHtml(payload.title)}</p>` : ""}
      ${items ? `<dl class="tooltip-detail-list">${items}</dl>` : ""}
    </div>
  `;
}

function parseTooltipPayload(rawTooltip) {
  try {
    return JSON.parse(rawTooltip);
  } catch {
    return rawTooltip;
  }
}

function showHoverTooltip(marker, event) {
  if (!marker?.dataset.tooltip) return;
  const tooltip = ensureHoverTooltip();
  tooltip.innerHTML = renderTooltipPayload(parseTooltipPayload(marker.dataset.tooltip));
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
    const tooltipData = mainBubbleTooltipData(value, severity, confidence);
    const marker = document.createElement("button");
    marker.className = node.id === state.selectedId ? "bubble-marker is-selected" : "bubble-marker";
    marker.type = "button";
    marker.style.left = `${node.x}%`;
    marker.style.top = `${node.y}%`;
    marker.style.width = `${diameter}px`;
    marker.style.height = `${diameter}px`;
    marker.dataset.tooltip = tooltipPayloadAttribute(tooltipData);
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
    tooltip.innerHTML = renderTooltipPayload({
      valueLabel: "Alert count",
      valueText: formatValue(value),
      items: [
        { label: "Severity", value: formatValue(severity) },
        { label: "Confidence", value: formatValue(confidence) },
        { label: "Radius", value: formatPx(radius) },
        { label: "Raw sqrt R", value: formatPx(rawSqrtRadius) },
      ],
    });
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

function renderLineup() {
  const svg = $("#diameter-lineup");
  if (!svg) return;

  svg.innerHTML = "";

  const values = lineupValues();
  const lineupDMin = state.dMin / 2;
  const lineupDMax = state.dMax / 2;
  const rows = [
    {
      label: "Raw sqrt reference",
      className: "lineup-sqrt",
      diameter: (value) => lineupDMin * Math.sqrt(value / state.valueMin),
    },
    {
      label: "Reference fit",
      className: "lineup-fit",
      diameter: (value) =>
        referenceFitDiameter(value, state.valueMin, state.valueMax, lineupDMin, lineupDMax),
    },
    {
      label: "e = 1",
      className: "lineup-large",
      diameter: (value) =>
        emphasizedDiameter(value, state.valueMin, state.valueMax, 1, lineupDMin, lineupDMax),
    },
    {
      label: "e = -1",
      className: "lineup-small",
      diameter: (value) =>
        emphasizedDiameter(value, state.valueMin, state.valueMax, -1, lineupDMin, lineupDMax),
    },
  ];
  const rowDiameters = rows.map((row) => values.map((value) => row.diameter(value)));
  const rowMaxDiameters = rowDiameters.map((diameters) => Math.max(...diameters));
  const maxDiameter = Math.max(...rowMaxDiameters);
  const width = 760;
  const left = 32;
  const right = Math.max(52, maxDiameter / 2 + 20);
  const top = 62;
  const rowGap = Math.max(96, maxDiameter + 56);
  const bottom = maxDiameter + 42;
  const height = top + rowGap * (rows.length - 1) + bottom;
  const xStart = left;
  const xEnd = width - right;
  const step = values.length > 1 ? (xEnd - xStart) / (values.length - 1) : 0;

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  rows.forEach((row, rowIndex) => {
    const rowTop = top + rowIndex * rowGap;
    const rowMaxDisplayDiameter = rowMaxDiameters[rowIndex];
    const group = createSvgElement("g", {
      class: `lineup-row ${row.className}`,
    });

    group.appendChild(
      createSvgElement("text", {
        class: "lineup-row-label",
        x: xStart,
        y: rowTop - 16,
      })
    ).textContent = row.label;

    group.appendChild(
      createSvgElement("line", {
        class: "lineup-baseline",
        x1: xStart,
        x2: xEnd,
        y1: rowTop,
        y2: rowTop,
      })
    );

    values.forEach((value, valueIndex) => {
      const diameter = rowDiameters[rowIndex][valueIndex];
      const displayDiameter = Math.max(1, diameter);
      const circle = createSvgElement("circle", {
        class: "lineup-circle",
        cx: xStart + valueIndex * step,
        cy: rowTop + displayDiameter / 2,
        r: displayDiameter / 2,
      });
      circle.appendChild(
        createSvgElement("title")
      ).textContent = `${row.label}, v=${formatValue(value)}, D=${formatPx(diameter)}`;
      group.appendChild(circle);
    });

    svg.appendChild(group);
  });

  [
    [xStart, `v=${formatCompactValue(values[0])}`],
    [xEnd, `v=${formatCompactValue(values[values.length - 1])}`],
  ].forEach(([x, label], index) => {
    svg.appendChild(
      createSvgElement("text", {
        class: `lineup-value-label ${index === 1 ? "lineup-value-label-end" : ""}`,
        x,
        y: height - 14,
      })
    ).textContent = label;
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
  const height = 480;
  const left = 48;
  const right = 16;
  const top = 16;
  const bottom = 30;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const yMin = state.dMin;
  const yMax = Math.max(sqrtReferenceDiameter(state.valueMax), state.dMax) * 1.04;

  function xScale(value) {
    const t = (value - state.valueMin) / (state.valueMax - state.valueMin);
    return left + clamp(t, 0, 1) * plotWidth;
  }

  function yScale(diameter) {
    const t = (diameter - yMin) / (yMax - yMin);
    return top + (1 - clamp(t, 0, 1)) * plotHeight;
  }

  function makePath(valueToDiameter) {
    const pointsOnCurve = [];
    const steps = 120;
    for (let index = 0; index <= steps; index += 1) {
      const t = index / steps;
      const value = state.valueMin + (state.valueMax - state.valueMin) * t;
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

const STUDY_VERSION = "bounded-bubbles-test-v5";
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
    taskPrompt: "Click the high-risk suspicious login cluster with 3 alerts.",
    targetId: "sec01-target",
    targetLabel: "North Gateway Login",
    targetCategory: "Suspicious Login",
    targetSeverity: 91,
    targetConfidence: 88,
    targetAlertCount: 3,
  },
  {
    datasetId: "sec-dataset-02",
    taskPrompt: "Click the high-risk malware cluster with 4 alerts.",
    targetId: "sec02-target",
    targetLabel: "Kernel Loader Beacon",
    targetCategory: "Malware",
    targetSeverity: 94,
    targetConfidence: 91,
    targetAlertCount: 4,
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
    taskPrompt: "Click the high-confidence privilege escalation cluster with 72 alerts.",
    targetId: "sec05-target",
    targetLabel: "Credential Replay Thread",
    targetCategory: "Privilege Escalation",
    targetSeverity: 86,
    targetConfidence: 96,
    targetAlertCount: 72,
  },
  {
    datasetId: "sec-dataset-06",
    taskPrompt: "Click the cloud misconfiguration cluster with 160 alerts near the high-risk zone.",
    targetId: "sec06-target",
    targetLabel: "Public Storage Policy",
    targetCategory: "Cloud Misconfiguration",
    targetSeverity: 92,
    targetConfidence: 86,
    targetAlertCount: 160,
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

function mainBubbleTooltipData(value, severity, confidence) {
  return {
    valueLabel: "Alert count",
    valueText: formatValue(value),
    items: [
      { label: "Severity", value: formatValue(severity) },
      { label: "Confidence", value: formatValue(confidence) },
    ],
  };
}

function studyBubbleTooltipData(point) {
  return {
    valueLabel: "Alert count",
    valueText: formatValue(point.alertCount),
    title: point.label,
    items: [
      { label: "Severity", value: formatValue(point.severity) },
      { label: "Confidence", value: formatValue(point.confidence) },
      { label: "Category", value: point.category },
    ],
  };
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
  return [1, 2, 3, 4, 5, 6, 8, 10, 15, 24, 32, 50, 64, 80, 96, 120, 150, 180, 210]
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
    document.querySelector('.page-tabs [data-tab-group="page"].is-active') || $("#example-tab-button");
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
  if (testingState.runtime?.countdownIntervalId) {
    window.clearInterval(testingState.runtime.countdownIntervalId);
  }
  if (testingState.advanceTimerId) {
    window.clearTimeout(testingState.advanceTimerId);
    testingState.advanceTimerId = null;
  }
}

function beginTestingFlow(options = {}) {
  clearActiveTrialTimers();
  testingState = createTestingState();
  setTestingMode(true);
  renderTestingFlow();
  if (!options.skipRouteUpdate) updateAppRoute("begin-test");
}

function returnToPrototype(options = {}) {
  clearActiveTrialTimers();
  testingState = null;
  setTestingMode(false);
  if (!options.skipRouteUpdate) {
    const activePageTab =
      document.querySelector('.page-tabs [data-tab-group="page"].is-active') ||
      $("#example-tab-button");
    updateAppRoute(routeNameForTab(activePageTab) || "applications");
  }
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
    countdownIntervalId: null,
  };
  renderTestingFlow();
}

function updateTrialCountdown(runtime) {
  if (!runtime?.started || runtime.finished || !runtime.startPerformance) return;
  const elapsed = performance.now() - runtime.startPerformance;
  const remainingMs = clamp(STUDY_MAX_TRIAL_DURATION_MS - elapsed, 0, STUDY_MAX_TRIAL_DURATION_MS);
  const seconds = Math.ceil(remainingMs / 1000);
  const progress = remainingMs / STUDY_MAX_TRIAL_DURATION_MS;
  const countdown = $("#trial-countdown");
  const meter = $("#trial-countdown-meter");
  if (countdown) {
    countdown.textContent = `${seconds}s remaining`;
    countdown.classList.toggle("is-low", seconds <= 10);
  }
  if (meter) {
    meter.style.transform = `scaleX(${progress.toFixed(4)})`;
    meter.classList.toggle("is-low", seconds <= 10);
  }
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
    updateTrialCountdown(runtime);
    runtime.countdownIntervalId = window.setInterval(() => {
      updateTrialCountdown(runtime);
    }, 250);
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
  if (runtime.countdownIntervalId) {
    window.clearInterval(runtime.countdownIntervalId);
    runtime.countdownIntervalId = null;
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
      <p class="testing-ethics-note">
        Participation is voluntary and you may stop at any time. For questions about the study, use of results, or removing a submitted result file from analysis, contact <a href="mailto:keedizhang@gmail.com">keedizhang@gmail.com</a>.
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
  const tooltipData = studyBubbleTooltipData(point);
  const title = tooltipPayloadPlainText(tooltipData);
  const label = point.showLabel
    ? `<span class="study-target-label" style="left: ${left}%; top: ${top}%;">${escapeHtml(point.label)}</span>`
    : "";

  return `
    <button
      class="study-marker"
      type="button"
      data-point-id="${escapeHtml(point.id)}"
      aria-label="${escapeHtml(title)}"
      data-tooltip="${escapeHtml(tooltipPayloadAttribute(tooltipData))}"
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
      <div class="trial-countdown-wrap" aria-live="polite">
        <span id="trial-countdown" class="trial-countdown">${Math.ceil(STUDY_MAX_TRIAL_DURATION_MS / 1000)}s remaining</span>
        <span class="trial-countdown-track" aria-hidden="true">
          <span id="trial-countdown-meter" class="trial-countdown-meter"></span>
        </span>
      </div>
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
  renderLineup();
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

const appRoutes = {
  applications: {
    path: "Applications",
    tabId: "example-tab-button",
    aliases: ["applications", "application", "appliations"],
  },
  method: {
    path: "Method",
    tabId: "explore-tab-button",
    aliases: ["method", "methods", "explore"],
  },
  math: {
    path: "Math",
    tabId: "math-tab-button",
    aliases: ["math", "math-explanation", "math_explanation"],
  },
  "begin-test": {
    path: "Begin-Test",
    aliases: ["begin-test", "begin-test", "begin-testing", "testing", "test"],
  },
};

let isApplyingAppRoute = false;

function normalizeRouteSegment(segment) {
  return decodeURIComponent(segment || "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}

function routeNameForSegment(segment) {
  const normalized = normalizeRouteSegment(segment);
  if (!normalized || normalized === "index.html") return "applications";
  return (
    Object.entries(appRoutes).find(([, route]) =>
      [route.path, ...(route.aliases || [])]
        .map(normalizeRouteSegment)
        .includes(normalized)
    )?.[0] || "applications"
  );
}

function routeNameForTab(button) {
  if (!button) return null;
  return Object.entries(appRoutes).find(([, route]) => route.tabId === button.id)?.[0] || null;
}

function currentRouteSegment() {
  const hashRoute = window.location.hash.match(/^#\/?(.+)$/)?.[1];
  if (hashRoute) return hashRoute;
  const routeParam = new URLSearchParams(window.location.search).get("route");
  if (routeParam) return routeParam;
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  return pathParts[pathParts.length - 1] || "";
}

function appBasePath() {
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1] || "";
  const lastIsRoute =
    lastPart === "index.html" ||
    Object.values(appRoutes).some((route) =>
      [route.path, ...(route.aliases || [])]
        .map(normalizeRouteSegment)
        .includes(normalizeRouteSegment(lastPart))
    );
  const baseParts = lastIsRoute ? pathParts.slice(0, -1) : pathParts;
  return `/${baseParts.join("/")}${baseParts.length ? "/" : ""}`;
}

function appRouteUrl(routeName) {
  const route = appRoutes[routeName] || appRoutes.applications;
  return `${appBasePath()}${route.path}`;
}

function updateAppRoute(routeName, mode = "push") {
  const nextUrl = new URL(window.location.href);
  if (window.location.protocol === "file:") {
    nextUrl.hash = `/${(appRoutes[routeName] || appRoutes.applications).path}`;
  } else {
    nextUrl.pathname = appRouteUrl(routeName);
    nextUrl.search = "";
    nextUrl.hash = "";
  }
  if (nextUrl.href === window.location.href) return;
  const method = mode === "replace" ? "replaceState" : "pushState";
  window.history[method]({ appRoute: routeName }, "", nextUrl);
}

function applyAppRouteFromLocation(options = {}) {
  const routeName = routeNameForSegment(currentRouteSegment());
  const route = appRoutes[routeName] || appRoutes.applications;
  isApplyingAppRoute = true;

  if (routeName === "begin-test") {
    beginTestingFlow({ skipRouteUpdate: true });
  } else {
    if (testingState) {
      clearActiveTrialTimers();
      testingState = null;
    }
    setTestingMode(false);
    const button = document.getElementById(route.tabId);
    if (button) activateTab(button);
  }

  isApplyingAppRoute = false;
  if (options.replace !== false) {
    updateAppRoute(routeName, "replace");
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

  if (group === "page" && !isApplyingAppRoute) {
    const routeName = routeNameForTab(button);
    if (routeName) updateAppRoute(routeName);
  }
}

document.querySelectorAll("[data-tab-target]").forEach((button) => {
  button.addEventListener("click", () => activateTab(button));
});

window.addEventListener("popstate", () => applyAppRouteFromLocation({ replace: false }));

document.addEventListener("pointerover", (event) => {
  const marker = event.target.closest(hoverTooltipSelector);
  if (!marker) return;
  showHoverTooltip(marker, event);
});

document.addEventListener("pointermove", (event) => {
  if (!hoverTooltipElement?.classList.contains("is-visible")) return;
  positionHoverTooltip(event);
});

document.addEventListener("pointerout", (event) => {
  const marker = event.target.closest(hoverTooltipSelector);
  if (!marker) return;
  const nextMarker = event.relatedTarget?.closest?.(hoverTooltipSelector);
  if (nextMarker === marker) return;
  hideHoverTooltip();
});

document.addEventListener("focusin", (event) => {
  const marker = event.target.closest(hoverTooltipSelector);
  if (!marker) return;
  const rect = marker.getBoundingClientRect();
  showHoverTooltip(marker, {
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  });
});

document.addEventListener("focusout", (event) => {
  const marker = event.target.closest(hoverTooltipSelector);
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

const exampleConfig = {
  focusDMin: 16,
  focusDMax: 96,
};

const laParkNeedsTrimmedAreas = [
  ["Unincorporated El Monte/ Unincorporated Monrovia", 0.246722, 77731, 16.0, 1065.18406, "Low", 55.841019],
  ["City of LA Hollywood - South", 0.267015, 49524, 19.0, 3234.743205, "Very High", 70.387175],
  ["City of Baldwin Park", 0.275162, 61507, 32.0, 4338.314111, "Very High", 21.618983],
  ["City of Glendale - Southside", 0.277685, 50373, 15.0, 2876.781428, "Very High", 90.365596],
  ["City of Maywood", 0.331637, 43852, 49.0, 755.68967, "Very High", 93.691692],
  ["Unincorporated San Jose Hills", 0.338277, 64973, 37.0, 969.979681, "Moderate", 48.568881],
  ["City of LA West Adams", 0.377223, 49053, 26.0, 3758.700208, "Very High", 45.5917],
  ["City of Bell", 0.378774, 44854, 47.0, 1675.999008, "Very High", 76.798149],
  ["City of El Monte", 0.385383, 48678, 40.0, 6153.361888, "Very High", 41.612082],
  ["Unincorporated West Carson/ Unincorporated Harbor City", 0.387889, 77382, 14.0, 1643.27877, "High", 24.291288],
  ["City of LA Central City", 0.394437, 45987, 16.0, 2234.888639, "Very High", 91.828999],
  ["City of LA Harbor Gateway", 0.440668, 53499, 25.0, 3240.645908, "High", 45.271415],
  ["City of LA Canoga Park - Winnetka", 0.459554, 68851, 23.0, 5024.95515, "Very High", 23.182597],
  ["City of LA Mission Hills - Panorama City - North Hills", 0.464389, 56823, 29.0, 7563.984112, "Very High", 50.98015],
  ["City of San Gabriel", 0.499664, 63566, 20.0, 2645.189379, "Moderate", 59.591725],
  ["City of Temple City", 0.5, 78722, 14.0, 2576.569292, "High", 23.434859],
  ["City of Lomita", 0.515436, 75036, 11.0, 1227.498343, "Moderate", 51.611369],
  ["City of Bradbury / Unincorporated Bradbury", 0.518366, 130637, 7.0, 1273.040072, "Very Low", 10.302468],
  ["City of LA Palms - Mar Vista - Del Rey", 0.522371, 79269, 10.0, 5263.033615, "Very High", 38.030562],
  ["City of LA South Los Angeles", 0.547817, 40050, 32.0, 4481.844588, "Very High", 58.664214],
  ["City of LA Bel Air - Beverly Crest/ Unincorporated Hollywood Hills", 0.569377, 200001, 3.0, 9796.283465, "Very Low", 18.975401],
  ["City of LA Wilshire - West", 0.57683, 86904, 6.0, 5978.867589, "High", 46.483287],
  ["City of Compton", 0.578266, 52404, 37.0, 6464.163994, "High", 58.3937],
  ["Unincorporated Charter Oak Islands/ Unincorporated Covina/ Unincorporated Covina Islands", 0.583436, 78851, 14.0, 1232.421744, "High", 16.450145],
  ["City of West Hollywood", 0.600933, 76320, 2.0, 1213.322472, "Very High", 72.057036],
  ["City of LA Southeast Los Angeles - North", 0.609038, 34651, 56.0, 4312.463052, "Very High", 83.618942],
  ["Unincorporated East Rancho Dominguez", 0.612241, 51013, 45.0, 528.027181, "Very High", 75.555367],
  ["City of LA Boyle Heights", 0.625703, 39678, 48.0, 3827.138948, "Very High", 75.217657],
  ["City of Hawthorne", 0.627895, 53692, 21.0, 3888.565004, "Very High", 65.938917],
  ["Unincorporated Del Aire", 0.653998, 90974, 13.0, 652.184068, "High", 59.140529],
  ["City of LA Westwood / Unincorporated Sawtelle VA Center", 0.663576, 82748, 3.0, 2935.452267, "Very High", 26.022636],
  ["City of LA Westlake", 0.668962, 33363, 40.0, 1943.364931, "Very High", 81.378611],
  ["City of Bellflower", 0.68, 58182, 22.0, 3943.375827, "Very High", 45.889323],
  ["City of Huntington Park", 0.687603, 41914, 53.0, 1928.884237, "Very High", 68.009634],
  ["City of South El Monte/ Unincorporated El Monte/ Unincorporated Whittier Narrows", 0.703984, 52588, 43.0, 1903.492428, "Low", 35.64852],
  ["Unincorporated Quartz Hill / Unincorporated Lancaster / Unincorporated Palmdale", 0.741362, 80849, 12.0, 9224.840074, "Moderate", 5.365995],
  ["Unincorporated Bassett-West Puente Valley", 0.743906, 71739, 31.0, 1295.968286, "Very High", 40.183507],
  ["City of Inglewood", 0.784492, 52078, 24.0, 5823.019525, "Very High", 42.029104],
  ["City of Lawndale", 0.786099, 60951, 26.0, 1261.054588, "Very High", 95.661],
  ["Unincorporated Acton/ Unincorporated South Antelope Valley", 0.794438, 102188, 10.0, 115230.585005, "Very Low", 0.762173],
  ["City of LA Sherman Oaks - Studio City - Toluca Lake - Cahuenga Pass / Unic Universal City", 0.807402, 105770, 3.0, 9084.352206, "Low", 36.377378],
  ["Unincorporated San Pasqual/ Unincorporated East Pasadena", 0.816523, 106393, 9.0, 1012.610072, "Very Low", 28.486252],
  ["City of Cudahy", 0.819525, 43724, 48.0, 786.597696, "Very High", 81.668536],
  ["City of Gardena", 0.824004, 58567, 16.0, 3749.458442, "High", 61.175204],
  ["City of LA Westchester - Playa del Rey / City of LA Los Angeles International Airport", 0.843841, 108518, 2.0, 9102.535566, "High", 15.601901],
  ["City of LA Venice", 0.874883, 109977, 5.0, 2006.307039, "Very High", 75.915302],
  ["Unincorporated Altadena", 0.893305, 103961, 10.0, 5650.145734, "Low", 32.132527],
  ["City of Monrovia", 0.9, 82849, 10.0, 8800.751126, "Low", 57.882232],
  ["City of LA Valley Glen - North Sherman Oaks", 0.90933, 61211, 18.0, 4240.540629, "High", 31.526025],
  ["City of Long Beach North", 0.914829, 55281, 26.0, 4648.34, "High", 63.594894],
  ["City of Alhambra", 0.917058, 64542, 17.0, 4883.735648, "High", 43.899916],
  ["City of LA West Los Angeles", 0.982705, 100358, 5.0, 4573.898537, "High", 36.575063],
  ["City of Rosemead", 0.993771, 54282, 32.0, 3310.640676, "Moderate", 46.162141],
  ["City of Artesia", 1.002206, 65469, 19.0, 1038.725518, "High", 46.245204],
  ["City of Covina", 1.009688, 76847, 13.0, 4501.571131, "Moderate", 40.340337],
  ["Unincorporated East Los Angeles - Northwest", 1.011493, 46516, 48.0, 2848.723278, "Very High", 44.646475],
  ["City of Avalon / Unincorporated Channel Islands North", 1.014801, 64294, 9.0, 47833.892712, "Very Low", 59.278677],
  ["City of Norwalk", 1.060293, 69168, 24.0, 6246.933731, "High", 47.239193],
  ["City of Burbank", 1.078017, 80693, 8.0, 11082.269499, "Low", 64.280767],
  ["City of LA Southeast Los Angeles", 1.096769, 36308, 45.0, 5568.011058, "Very High", 56.922352],
  ["City of Downey", 1.105872, 74280, 20.0, 8045.448708, "High", 38.72123],
  ["City of LA North Hollywood - Valley Village", 1.123886, 57290, 16.0, 6791.468849, "Very High", 39.173281],
  ["City of LA Sun Valley - La Tuna Canyon", 1.199641, 60161, 30.0, 10504.568668, "High", 29.382559],
  ["Unincorporated Florence-Firestone", 1.220454, 40139, 54.0, 2277.536, "Very High", 59.287894],
  ["City of Pico Rivera", 1.289736, 68392, 27.0, 5595.756166, "Low", 43.809992],
  ["City of Arcadia", 1.297628, 101862, 7.0, 7108.042128, "Low", 69.636727],
  ["City of Bell Gardens", 1.309718, 42905, 51.0, 1577.405826, "Very High", 81.61911],
  ["City of Montebello", 1.319649, 56505, 26.0, 5355.874359, "Moderate", 60.470029],
  ["City of Redondo Beach", 1.368521, 120818, 3.0, 3970.933566, "Moderate", 87.336943],
  ["City of San Fernando", 1.376143, 59864, 35.0, 1518.21369, "High", 80.410182],
  ["Unincorporated Pellissier Village-Avocado Heights-North Whittier", 1.379259, 84952, 27.0, 1829.649631, "Very Low", 45.186431],
  ["City of West Covina", 1.413627, 82692, 14.0, 10279.642049, "Moderate", 43.932671],
  ["City of Pomona - Southside", 1.418835, 59019, 31.0, 7101.529041, "Moderate", 53.302648],
  ["City of Pasadena - Eastside / Unincorporated Kinneloa Mesa", 1.431107, 86473, 11.0, 6376.846589, "Moderate", 51.117601],
  ["City of LA Northridge", 1.439836, 80860, 10.0, 6332.076047, "High", 15.46287],
  ["City of Santa Monica", 1.447654, 97276, 5.0, 5350.446935, "Moderate", 72.356457],
  ["City of Carson", 1.528341, 84979, 18.0, 12121.776482, "High", 51.063177],
  ["Unincorporated West Rancho Dominguez", 1.533241, 54042, 24.0, 1052.170738, "Very Low", 54.252188],
  ["City of South Gate", 1.534991, 53101, 42.0, 4704.951269, "Very High", 44.709483],
  ["City of LA Central City North", 1.554053, 50355, 29.0, 2022.349957, "High", 49.448705],
  ["Unincorporated South Whittier/ Unincorporated East La Mirada", 1.570393, 76245, 19.0, 4119.628988, "Moderate", 44.602435],
  ["City of Long Beach West", 1.626048, 57594, 27.0, 4330.310356, "Very High", 61.196111],
  ["City of Lynwood/ Unincorporated Lynwood", 1.643601, 52069, 42.0, 3183.559445, "High", 62.834718],
  ["City of Long Beach Central", 1.67029, 79877, 9.0, 4416.031071, "Low", 66.868599],
  ["Unincorporated Topanga Canyon / Topanga", 1.740899, 140572, 1.0, 15425.70921, "Very Low", 46.018894],
  ["City of Glendora / Unincorporated Glendora", 1.750393, 93881, 9.0, 12919.685393, "Low", 43.0],
  ["City of Paramount", 1.815072, 53580, 34.0, 3090.531029, "Very High", 60.19668],
  ["City of Beverly Hills", 1.9, 117361, 4.0, 3655.722453, "Moderate", 80.149613],
  ["Unincorporated Littlerock", 1.93886, 59823, 35.0, 36278.792005, "Very Low", 2.117548],
  ["City of Lakewood / Unincorporated Lakewood", 1.956177, 92217, 9.0, 6071.978674, "Low", 55.617529],
  ["City of La Habra Heights", 1.979308, 139537, 6.0, 3943.037267, "Very Low", 25.687925],
  ["City of San Marino", 1.987977, 191916, 2.0, 2410.700877, "Very Low", 41.06001],
  ["City of Monterey Park", 2.009912, 66885, 20.0, 4951.897723, "Moderate", 60.105096],
  ["City of Hermosa Beach", 2.048564, 140221, 2.0, 937.692109, "Moderate", 99.999881],
  ["City of Glendale - Northside", 2.2, 87712, 9.0, 16730.860204, "Low", 45.0],
  ["City of LA Granada Hills - Knollwood", 2.240001, 93583, 10.0, 10388.465934, "Moderate", 13.472348],
  ["City of Sierra Madre", 2.256588, 106742, 1.0, 1893.450614, "Very Low", 84.707649],
  ["Unincorporated Hawthorne/ Unincorporated  Alondra Park", 2.277704, 68460, 22.0, 808.283351, "Very High", 62.279063],
  ["City of Commerce", 2.289099, 52621, 40.0, 4194.724406, "Moderate", 50.255081],
  ["Unincorporated La Crescenta - Montrose", 2.3, 106521, 6.0, 2207.876116, "Very Low", 17.842259],
  ["City of Long Beach South", 2.3, 57622, 20.0, 9858.839878, "High", 89.369551],
  ["City of Agoura Hills", 2.325132, 131125, 3.0, 4995.570459, "Very Low", 44.202459],
  ["City of Palmdale - Eastside / Unincorporated South Antelope Valley", 2.4, 53262, 31.0, 51233.136916, "Low", 20.602912],
  ["City of Torrance - South", 2.404592, 102565, 4.0, 7064.548029, "Low", 76.953517],
  ["Unincorporated Azusa", 2.5, 69235, 27.0, 1002.116912, "Moderate", 61.405491],
  ["City of Torrance - North", 2.546888, 86864, 7.0, 6085.510822, "High", 64.349399],
  ["City of LA West Hills - Woodland Hills  /  Unic Conoga Park - West Hills", 2.570857, 108909, 5.0, 13035.302073, "Moderate", 31.730922],
  ["City of Lancaster - Westside", 2.626041, 60798, 14.0, 42145.86643, "Moderate", 13.58587],
  ["City of Diamond Bar", 2.7, 105279, 5.0, 9383.966241, "Low", 27.805405],
  ["City of El Segundo", 2.7, 106363, 3.0, 3482.24833, "Low", 97.318232],
  ["City of La Verne / Unincorporated La Verne/ Unincorporated Claremont", 2.7, 93717, 7.0, 8289.95476, "Very Low", 58.025288],
  ["City of La Puente", 2.833238, 65627, 36.0, 2223.182672, "High", 23.671274],
  ["City of LA Reseda - West Van Nuys", 2.848411, 66465, 20.0, 7777.615595, "High", 27.730528],
  ["City of Lancaster - Eastside", 2.958572, 48442, 21.0, 18344.073372, "Moderate", 7.925526],
  ["City of South Pasadena", 3.1288, 102323, 3.0, 2185.762529, "Low", 54.778668],
  ["City of Manhattan Beach", 3.15495, 170584, 2.0, 2523.71132, "Low", 95.190709],
  ["Unincorporated Compton", 3.204554, 65870, 19.0, 1728.538797, "Low", 3.46212],
  ["Unincorporated West Whittier - Los Nietos", 3.3, 75317, 24.0, 1756.781535, "Low", 36.93132],
  ["City of Claremont / Unincorporated Claremont", 3.371267, 107668, 6.0, 9343.034916, "Low", 71.294244],
  ["Unincorporated Marina del Rey", 3.572707, 115319, 1.0, 606.890585, "Moderate", 44.651884],
  ["Unincorporated Willowbrook", 3.601261, 48624, 40.0, 2567.1512, "High", 66.088416],
  ["City of LA Northeast Los Angeles - North", 3.636028, 68431, 20.0, 9611.011639, "Moderate", 49.636449],
  ["City of Whittier", 3.8, 81541, 12.0, 9385.525769, "Low", 76.708144],
  ["Santa Clarita - North", 3.82494, 110601, 7.0, 18090.205911, "Moderate", 22.991736],
  ["City of LA Chatsworth - Porter Ranch / Unin. Chatsworth / Unic. Northridge / Unic. Conoga Park / Unic Porter Ranch-Oat Mountain", 3.94779, 92580, 10.0, 26378.800522, "Low", 41.942126],
  ["City of La Mirada", 4.1, 96403, 9.0, 5017.766019, "Moderate", 60.0],
  ["City of Westlake Village", 4.2, 149833, 1.0, 3523.477425, "Very Low", 54.645233],
  ["City of LA Sylmar", 4.221127, 74259, 28.0, 7888.760176, "Moderate", 35.089855],
  ["Unincorporated Valinda", 4.232478, 79570, 28.0, 1305.53106, "Moderate", 17.239524],
  ["City of Cerritos  /  Unincorporated Cerritos", 4.4, 107321, 6.0, 5685.595586, "Low", 83.743853],
  ["City of LA Arleta - Pacoima", 4.540436, 59845, 41.0, 6619.442128, "High", 37.233899],
  ["City of LA Wilmington - Harbor City / City of LA Port of Los Angeles", 4.574369, 55186, 36.0, 6855.246001, "Moderate", 61.764127],
  ["Santa Clarita - South", 4.776954, 93105, 10.0, 24128.180821, "Moderate", 16.176643],
  ["City of Palmdale - Westside", 4.9, 84213, 15.0, 33244.549462, "Low", 19.410864],
  ["City of LA Baldwin Hills - Leimert - Hyde Park", 5.577321, 44025, 18.0, 4452.564971, "High", 50.247602],
  ["City of Santa Fe Springs", 5.759331, 69331, 20.0, 5684.366503, "Low", 67.466094],
  ["City of Calabasas", 5.8, 138714, 3.0, 8292.985894, "Very Low", 55.562694],
  ["City of Rolling Hills Estates / Unincorporated Westfield", 5.993033, 175804, 2.0, 2743.356728, "Very Low", 61.017326],
  ["City of Pasadena - Westside", 6.106014, 90744, 10.0, 9454.475298, "Moderate", 58.311593],
  ["City of LA Brentwood - Pacific Palisades", 6.523099, 164440, 2.0, 24319.323463, "Moderate", 29.704955],
  ["City of LA Northeast Los Angeles - South", 6.609527, 51864, 34.0, 6066.580854, "Moderate", 61.908931],
  ["Unincorporated Malibu", 6.806363, 181293, 3.0, 31700.953803, "Low", 19.078014],
  ["Unincorporated Lake Los Angeles /  Unincorp Pearblossom /  Unincorp Liano /  Unincorp Valyermo", 7.148299, 50478, 26.0, 175160.95867, "Very Low", 1.913146],
  ["City of Walnut", 7.553551, 111989, 7.0, 5744.034782, "Very Low", 76.0],
  ["City of Signal Hill", 8.151555, 81851, 14.0, 1407.844783, "Very Low", 97.052024],
  ["City of LA Sunland - Tujunga - Lake View Terrace - Shadow Hills", 8.599252, 76261, 14.0, 16428.801938, "Low", 42.826803],
  ["City of Long Beach East / Unincorporated Long Beach", 8.601173, 105432, 5.0, 9887.230797, "Low", 43.166469],
  ["City of LA San Pedro / City of LA Port of Los Angeles / Unincorporated La Rambla", 8.744505, 70935, 17.0, 8333.631297, "Moderate", 88.963368],
  ["City of LA Encino - Tarzana", 8.805535, 96514, 6.0, 12988.798545, "Moderate", 10.459357],
  ["City of LA Silver Lake - Echo Park - Elysian Valley", 8.837859, 74284, 16.0, 4552.371487, "Moderate", 55.523755],
  ["City of Malibu", 9.1, 157275, 2.0, 12649.847233, "Very Low", 24.799576],
  ["Unincorporated Stevenson/Newhall Ranch/ Unincorporated Castaic - Val Verde", 9.858612, 139134, 4.0, 31300.072672, "Very Low", 30.727746],
  ["Unincorporated Northeast Antelope Valley", 11.826182, 42221, 22.0, 207680.223402, "Very Low", 2.025528],
  ["Unincorporated La Habra Heights/ Unincorporated Rowland Heights", 12.2, 76410, 13.0, 12371.081969, "Moderate", 26.533943],
  ["Unincorporated Avacado Heights/ Unincorporated Hacienda Heights/ Unincorporated Whittier", 12.4, 91884, 12.0, 10971.173125, "Low", 35.813214],
  ["City of Culver City", 12.453881, 101186, 7.0, 3286.183748, "Moderate", 70.99941],
  ["City of Pomona - Northside", 16.445581, 59624, 27.0, 7594.953181, "Moderate", 54.505817],
  ["City of Rancho Palos Verdes", 20.0, 145190, 2.0, 8661.122895, "Very Low", 52.025365],
  ["Unincorporated Ladera Heights / View Park - Windsor Hills", 25.265275, 104393, 3.0, 3077.804276, "Very Low", 33.518038],
  ["City of Palos Verdes Estates", 32.229568, 200001, 1.0, 3054.187232, "Very Low", 45.158362],
  ["City of Azusa", 42.5, 67706, 20.0, 6183.198693, "Moderate", 72.0],
].map(([name, value, x, y, parkAcres, need, walkable], index) => ({
  name,
  value,
  x,
  y,
  parkAcres,
  need,
  walkable,
  rank: index + 1,
  highlight: index === 0 || index === 160,
}));

const canadaOutlineFeature = {"type":"Feature","properties":{"name":"Canada","source":"Natural Earth Admin 0 Countries 110m"},"geometry":{"type":"MultiPolygon","coordinates":[[[[-122.84,49],[-122.97421,49.002538],[-124.91024,49.98456],[-125.62461,50.41656],[-127.43561,50.83061],[-127.99276,51.71583],[-127.85032,52.32961],[-129.12979,52.75538],[-129.30523,53.56159],[-130.51497,54.28757],[-130.536109,54.802754],[-130.53611,54.80278],[-129.98,55.285],[-130.00778,55.91583],[-131.70781,56.55212],[-132.73042,57.69289],[-133.35556,58.41028],[-134.27111,58.86111],[-134.945,59.27056],[-135.47583,59.78778],[-136.47972,59.46389],[-137.4525,58.905],[-138.34089,59.56211],[-139.039,60],[-140.013,60.27682],[-140.99778,60.30639],[-140.9925,66.00003],[-140.986,69.712],[-140.985988,69.711998],[-139.12052,69.47102],[-137.54636,68.99002],[-136.50358,68.89804],[-135.62576,69.31512],[-134.41464,69.62743],[-132.92925,69.50534],[-131.43136,69.94451],[-129.79471,70.19369],[-129.10773,69.77927],[-128.36156,70.01286],[-128.13817,70.48384],[-127.44712,70.37721],[-125.75632,69.48058],[-124.42483,70.1584],[-124.28968,69.39969],[-123.06108,69.56372],[-122.6835,69.85553],[-121.47226,69.79778],[-119.94288,69.37786],[-117.60268,69.01128],[-116.22643,68.84151],[-115.2469,68.90591],[-113.89794,68.3989],[-115.30489,67.90261],[-113.49727,67.68815],[-110.798,67.80612],[-109.94619,67.98104],[-108.8802,67.38144],[-107.79239,67.88736],[-108.81299,68.31164],[-108.16721,68.65392],[-106.95,68.7],[-106.15,68.8],[-105.34282,68.56122],[-104.33791,68.018],[-103.22115,68.09775],[-101.45433,67.64689],[-99.90195,67.80566],[-98.4432,67.78165],[-98.5586,68.40394],[-97.66948,68.57864],[-96.11991,68.23939],[-96.12588,67.29338],[-95.48943,68.0907],[-94.685,68.06383],[-94.23282,69.06903],[-95.30408,69.68571],[-96.47131,70.08976],[-96.39115,71.19482],[-95.2088,71.92053],[-93.88997,71.76015],[-92.87818,71.31869],[-91.51964,70.19129],[-92.40692,69.69997],[-90.5471,69.49766],[-90.55151,68.47499],[-89.21515,69.25873],[-88.01966,68.61508],[-88.31749,67.87338],[-87.35017,67.19872],[-86.30607,67.92146],[-85.57664,68.78456],[-85.52197,69.88211],[-84.10081,69.80539],[-82.62258,69.65826],[-81.28043,69.16202],[-81.2202,68.66567],[-81.96436,68.13253],[-81.25928,67.59716],[-81.38653,67.11078],[-83.34456,66.41154],[-84.73542,66.2573],[-85.76943,66.55833],[-86.0676,66.05625],[-87.03143,65.21297],[-87.32324,64.77563],[-88.48296,64.09897],[-89.91444,64.03273],[-90.70398,63.61017],[-90.77004,62.96021],[-91.93342,62.83508],[-93.15698,62.02469],[-94.24153,60.89865],[-94.62931,60.11021],[-94.6846,58.94882],[-93.21502,58.78212],[-92.76462,57.84571],[-92.29703,57.08709],[-90.89769,57.28468],[-89.03953,56.85172],[-88.03978,56.47162],[-87.32421,55.99914],[-86.07121,55.72383],[-85.01181,55.3026],[-83.36055,55.24489],[-82.27285,55.14832],[-82.4362,54.28227],[-82.12502,53.27703],[-81.40075,52.15788],[-79.91289,51.20842],[-79.14301,51.53393],[-78.60191,52.56208],[-79.12421,54.14145],[-79.82958,54.66772],[-78.22874,55.13645],[-77.0956,55.83741],[-76.54137,56.53423],[-76.62319,57.20263],[-77.30226,58.05209],[-78.51688,58.80458],[-77.33676,59.85261],[-77.77272,60.75788],[-78.10687,62.31964],[-77.41067,62.55053],[-75.69621,62.2784],[-74.6682,62.18111],[-73.83988,62.4438],[-72.90853,62.10507],[-71.67708,61.52535],[-71.37369,61.13717],[-69.59042,61.06141],[-69.62033,60.22125],[-69.2879,58.95736],[-68.37455,58.80106],[-67.64976,58.21206],[-66.20178,58.76731],[-65.24517,59.87071],[-64.58352,60.33558],[-63.80475,59.4426],[-62.50236,58.16708],[-61.39655,56.96745],[-61.79866,56.33945],[-60.46853,55.77548],[-59.56962,55.20407],[-57.97508,54.94549],[-57.3332,54.6265],[-56.93689,53.78032],[-56.15811,53.64749],[-55.75632,53.27036],[-55.68338,52.14664],[-56.40916,51.7707],[-57.12691,51.41972],[-58.77482,51.0643],[-60.03309,50.24277],[-61.72366,50.08046],[-63.86251,50.29099],[-65.36331,50.2982],[-66.39905,50.22897],[-67.23631,49.51156],[-68.51114,49.06836],[-69.95362,47.74488],[-71.10458,46.82171],[-70.25522,46.98606],[-68.65,48.3],[-66.55243,49.1331],[-65.05626,49.23278],[-64.17099,48.74248],[-65.11545,48.07085],[-64.79854,46.99297],[-64.47219,46.23849],[-63.17329,45.73902],[-61.52072,45.88377],[-60.51815,47.00793],[-60.4486,46.28264],[-59.80287,45.9204],[-61.03988,45.26525],[-63.25471,44.67014],[-64.24656,44.26553],[-65.36406,43.54523],[-66.1234,43.61867],[-66.16173,44.46512],[-64.42549,45.29204],[-66.02605,45.25931],[-67.13741,45.13753],[-67.79134,45.70281],[-67.79046,47.06636],[-68.23444,47.35486],[-68.905,47.185],[-69.237216,47.447781],[-69.99997,46.69307],[-70.305,45.915],[-70.66,45.46],[-71.08482,45.30524],[-71.405,45.255],[-71.50506,45.0082],[-73.34783,45.00738],[-74.867,45.00048],[-75.31821,44.81645],[-76.375,44.09631],[-76.5,44.018459],[-76.820034,43.628784],[-77.737885,43.629056],[-78.72028,43.625089],[-79.171674,43.466339],[-79.01,43.27],[-78.92,42.965],[-78.939362,42.863611],[-80.247448,42.3662],[-81.277747,42.209026],[-82.439278,41.675105],[-82.690089,41.675105],[-83.02981,41.832796],[-83.142,41.975681],[-83.12,42.08],[-82.9,42.43],[-82.43,42.98],[-82.137642,43.571088],[-82.337763,44.44],[-82.550925,45.347517],[-83.592851,45.816894],[-83.469551,45.994686],[-83.616131,46.116927],[-83.890765,46.116927],[-84.091851,46.275419],[-84.14212,46.512226],[-84.3367,46.40877],[-84.6049,46.4396],[-84.543749,46.538684],[-84.779238,46.637102],[-84.87608,46.900083],[-85.652363,47.220219],[-86.461991,47.553338],[-87.439793,47.94],[-88.378114,48.302918],[-89.272917,48.019808],[-89.6,48.01],[-90.83,48.27],[-91.64,48.14],[-92.61,48.45],[-93.63087,48.60926],[-94.32914,48.67074],[-94.64,48.84],[-94.81758,49.38905],[-95.15609,49.38425],[-95.15907,49],[-97.22872,49.0007],[-100.65,49],[-104.04826,48.99986],[-107.05,49],[-110.05,49],[-113,49],[-116.04818,49],[-117.03121,49],[-120,49],[-122.84,49]]],[[[-83.99367,62.4528],[-83.25048,62.91409],[-81.87699,62.90458],[-81.89825,62.7108],[-83.06857,62.15922],[-83.77462,62.18231],[-83.99367,62.4528]]],[[[-79.775833,72.802902],[-80.876099,73.333183],[-80.833885,73.693184],[-80.353058,73.75972],[-78.064438,73.651932],[-76.34,73.102685],[-76.251404,72.826385],[-77.314438,72.855545],[-78.39167,72.876656],[-79.486252,72.742203],[-79.775833,72.802902]]],[[[-80.315395,62.085565],[-79.92939,62.3856],[-79.52002,62.36371],[-79.26582,62.158675],[-79.65752,61.63308],[-80.09956,61.7181],[-80.36215,62.01649],[-80.315395,62.085565]]],[[[-93.612756,74.979997],[-94.156909,74.592347],[-95.608681,74.666864],[-96.820932,74.927623],[-96.288587,75.377828],[-94.85082,75.647218],[-93.977747,75.29649],[-93.612756,74.979997]]],[[[-93.840003,77.519997],[-94.295608,77.491343],[-96.169654,77.555111],[-96.436304,77.834629],[-94.422577,77.820005],[-93.720656,77.634331],[-93.840003,77.519997]]],[[[-96.754399,78.765813],[-95.559278,78.418315],[-95.830295,78.056941],[-97.309843,77.850597],[-98.124289,78.082857],[-98.552868,78.458105],[-98.631984,78.87193],[-97.337231,78.831984],[-96.754399,78.765813]]],[[[-88.15035,74.392307],[-89.764722,74.515555],[-92.422441,74.837758],[-92.768285,75.38682],[-92.889906,75.882655],[-93.893824,76.319244],[-95.962457,76.441381],[-97.121379,76.751078],[-96.745123,77.161389],[-94.684086,77.097878],[-93.573921,76.776296],[-91.605023,76.778518],[-90.741846,76.449597],[-90.969661,76.074013],[-89.822238,75.847774],[-89.187083,75.610166],[-87.838276,75.566189],[-86.379192,75.482421],[-84.789625,75.699204],[-82.753445,75.784315],[-81.128531,75.713983],[-80.057511,75.336849],[-79.833933,74.923127],[-80.457771,74.657304],[-81.948843,74.442459],[-83.228894,74.564028],[-86.097452,74.410032],[-88.15035,74.392307]]],[[[-111.264443,78.152956],[-109.854452,77.996325],[-110.186938,77.697015],[-112.051191,77.409229],[-113.534279,77.732207],[-112.724587,78.05105],[-111.264443,78.152956]]],[[[-110.963661,78.804441],[-109.663146,78.601973],[-110.881314,78.40692],[-112.542091,78.407902],[-112.525891,78.550555],[-111.50001,78.849994],[-110.963661,78.804441]]],[[[-55.600218,51.317075],[-56.134036,50.68701],[-56.795882,49.812309],[-56.143105,50.150117],[-55.471492,49.935815],[-55.822401,49.587129],[-54.935143,49.313011],[-54.473775,49.556691],[-53.476549,49.249139],[-53.786014,48.516781],[-53.086134,48.687804],[-52.958648,48.157164],[-52.648099,47.535548],[-53.069158,46.655499],[-53.521456,46.618292],[-54.178936,46.807066],[-53.961869,47.625207],[-54.240482,47.752279],[-55.400773,46.884994],[-55.997481,46.91972],[-55.291219,47.389562],[-56.250799,47.632545],[-57.325229,47.572807],[-59.266015,47.603348],[-59.419494,47.899454],[-58.796586,48.251525],[-59.231625,48.523188],[-58.391805,49.125581],[-57.35869,50.718274],[-56.73865,51.287438],[-55.870977,51.632094],[-55.406974,51.588273],[-55.600218,51.317075]]],[[[-83.882626,65.109618],[-82.787577,64.766693],[-81.642014,64.455136],[-81.55344,63.979609],[-80.817361,64.057486],[-80.103451,63.725981],[-80.99102,63.411246],[-82.547178,63.651722],[-83.108798,64.101876],[-84.100417,63.569712],[-85.523405,63.052379],[-85.866769,63.637253],[-87.221983,63.541238],[-86.35276,64.035833],[-86.224886,64.822917],[-85.883848,65.738778],[-85.161308,65.657285],[-84.975764,65.217518],[-84.464012,65.371772],[-83.882626,65.109618]]],[[[-78.770639,72.352173],[-77.824624,72.749617],[-75.605845,72.243678],[-74.228616,71.767144],[-74.099141,71.33084],[-72.242226,71.556925],[-71.200015,70.920013],[-68.786054,70.525024],[-67.91497,70.121948],[-66.969033,69.186087],[-68.805123,68.720198],[-66.449866,68.067163],[-64.862314,67.847539],[-63.424934,66.928473],[-61.851981,66.862121],[-62.163177,66.160251],[-63.918444,64.998669],[-65.14886,65.426033],[-66.721219,66.388041],[-68.015016,66.262726],[-68.141287,65.689789],[-67.089646,65.108455],[-65.73208,64.648406],[-65.320168,64.382737],[-64.669406,63.392927],[-65.013804,62.674185],[-66.275045,62.945099],[-68.783186,63.74567],[-67.369681,62.883966],[-66.328297,62.280075],[-66.165568,61.930897],[-68.877367,62.330149],[-71.023437,62.910708],[-72.235379,63.397836],[-71.886278,63.679989],[-73.378306,64.193963],[-74.834419,64.679076],[-74.818503,64.389093],[-77.70998,64.229542],[-78.555949,64.572906],[-77.897281,65.309192],[-76.018274,65.326969],[-73.959795,65.454765],[-74.293883,65.811771],[-73.944912,66.310578],[-72.651167,67.284576],[-72.92606,67.726926],[-73.311618,68.069437],[-74.843307,68.554627],[-76.869101,68.894736],[-76.228649,69.147769],[-77.28737,69.76954],[-78.168634,69.826488],[-78.957242,70.16688],[-79.492455,69.871808],[-81.305471,69.743185],[-84.944706,69.966634],[-87.060003,70.260001],[-88.681713,70.410741],[-89.51342,70.762038],[-88.467721,71.218186],[-89.888151,71.222552],[-90.20516,72.235074],[-89.436577,73.129464],[-88.408242,73.537889],[-85.826151,73.803816],[-86.562179,73.157447],[-85.774371,72.534126],[-84.850112,73.340278],[-82.31559,73.750951],[-80.600088,72.716544],[-80.748942,72.061907],[-78.770639,72.352173]]],[[[-94.503658,74.134907],[-92.420012,74.100025],[-90.509793,73.856732],[-92.003965,72.966244],[-93.196296,72.771992],[-94.269047,72.024596],[-95.409856,72.061881],[-96.033745,72.940277],[-96.018268,73.43743],[-95.495793,73.862417],[-94.503658,74.134907]]],[[[-122.854924,76.116543],[-122.854925,76.116543],[-121.157535,76.864508],[-119.103939,77.51222],[-117.570131,77.498319],[-116.198587,77.645287],[-116.335813,76.876962],[-117.106051,76.530032],[-118.040412,76.481172],[-119.899318,76.053213],[-121.499995,75.900019],[-122.854924,76.116543]]],[[[-132.710008,54.040009],[-131.74999,54.120004],[-132.04948,52.984621],[-131.179043,52.180433],[-131.57783,52.182371],[-132.180428,52.639707],[-132.549992,53.100015],[-133.054611,53.411469],[-133.239664,53.85108],[-133.180004,54.169975],[-132.710008,54.040009]]],[[[-105.492289,79.301594],[-103.529282,79.165349],[-100.825158,78.800462],[-100.060192,78.324754],[-99.670939,77.907545],[-101.30394,78.018985],[-102.949809,78.343229],[-105.176133,78.380332],[-104.210429,78.67742],[-105.41958,78.918336],[-105.492289,79.301594]]],[[[-123.510002,48.510011],[-124.012891,48.370846],[-125.655013,48.825005],[-125.954994,49.179996],[-126.850004,49.53],[-127.029993,49.814996],[-128.059336,49.994959],[-128.444584,50.539138],[-128.358414,50.770648],[-127.308581,50.552574],[-126.695001,50.400903],[-125.755007,50.295018],[-125.415002,49.950001],[-124.920768,49.475275],[-123.922509,49.062484],[-123.510002,48.510011]]],[[[-121.53788,74.44893],[-120.10978,74.24135],[-117.55564,74.18577],[-116.58442,73.89607],[-115.51081,73.47519],[-116.76794,73.22292],[-119.22,72.52],[-120.46,71.82],[-120.46,71.383602],[-123.09219,70.90164],[-123.62,71.34],[-125.928949,71.868688],[-125.5,72.292261],[-124.80729,73.02256],[-123.94,73.68],[-124.91775,74.29275],[-121.53788,74.44893]]],[[[-107.81943,75.84552],[-106.92893,76.01282],[-105.881,75.9694],[-105.70498,75.47951],[-106.31347,75.00527],[-109.7,74.85],[-112.22307,74.41696],[-113.74381,74.39427],[-113.87135,74.72029],[-111.79421,75.1625],[-116.31221,75.04343],[-117.7104,75.2222],[-116.34602,76.19903],[-115.40487,76.47887],[-112.59056,76.14134],[-110.81422,75.54919],[-109.0671,75.47321],[-110.49726,76.42982],[-109.5811,76.79417],[-108.54859,76.67832],[-108.21141,76.20168],[-107.81943,75.84552]]],[[[-106.52259,73.07601],[-105.40246,72.67259],[-104.77484,71.6984],[-104.46476,70.99297],[-102.78537,70.49776],[-100.98078,70.02432],[-101.08929,69.58447],[-102.73116,69.50402],[-102.09329,69.11962],[-102.43024,68.75282],[-104.24,68.91],[-105.96,69.18],[-107.12254,69.11922],[-109,68.78],[-111.534149,68.630059],[-113.3132,68.53554],[-113.85496,69.00744],[-115.22,69.28],[-116.10794,69.16821],[-117.34,69.96],[-116.67473,70.06655],[-115.13112,70.2373],[-113.72141,70.19237],[-112.4161,70.36638],[-114.35,70.6],[-116.48684,70.52045],[-117.9048,70.54056],[-118.43238,70.9092],[-116.11311,71.30918],[-117.65568,71.2952],[-119.40199,71.55859],[-118.56267,72.30785],[-117.86642,72.70594],[-115.18909,73.31459],[-114.16717,73.12145],[-114.66634,72.65277],[-112.44102,72.9554],[-111.05039,72.4504],[-109.92035,72.96113],[-109.00654,72.63335],[-108.18835,71.65089],[-107.68599,72.06548],[-108.39639,73.08953],[-107.51645,73.23598],[-106.52259,73.07601]]],[[[-100.43836,72.70588],[-101.54,73.36],[-100.35642,73.84389],[-99.16387,73.63339],[-97.38,73.76],[-97.12,73.47],[-98.05359,72.99052],[-96.54,72.56],[-96.72,71.66],[-98.35966,71.27285],[-99.32286,71.35639],[-100.01482,71.73827],[-102.5,72.51],[-102.48,72.83],[-100.43836,72.70588]]],[[[-106.6,73.6],[-105.26,73.64],[-104.5,73.42],[-105.38,72.76],[-106.94,73.46],[-106.6,73.6]]],[[[-98.5,76.72],[-97.735585,76.25656],[-97.704415,75.74344],[-98.16,75],[-99.80874,74.89744],[-100.88366,75.05736],[-100.86292,75.64075],[-102.50209,75.5638],[-102.56552,76.3366],[-101.48973,76.30537],[-99.98349,76.64634],[-98.57699,76.58859],[-98.5,76.72]]],[[[-96.01644,80.60233],[-95.32345,80.90729],[-94.29843,80.97727],[-94.73542,81.20646],[-92.40984,81.25739],[-91.13289,80.72345],[-89.45,80.509322],[-87.81,80.32],[-87.02,79.66],[-85.81435,79.3369],[-87.18756,79.0393],[-89.03535,78.28723],[-90.80436,78.21533],[-92.87669,78.34333],[-93.95116,78.75099],[-93.93574,79.11373],[-93.14524,79.3801],[-94.974,79.37248],[-96.07614,79.70502],[-96.70972,80.15777],[-96.01644,80.60233]]],[[[-91.58702,81.89429],[-90.1,82.085],[-88.93227,82.11751],[-86.97024,82.27961],[-85.5,82.652273],[-84.260005,82.6],[-83.18,82.32],[-82.42,82.86],[-81.1,83.02],[-79.30664,83.13056],[-76.25,83.172059],[-75.71878,83.06404],[-72.83153,83.23324],[-70.665765,83.169781],[-68.5,83.106322],[-65.82735,83.02801],[-63.68,82.9],[-61.85,82.6286],[-61.89388,82.36165],[-64.334,81.92775],[-66.75342,81.72527],[-67.65755,81.50141],[-65.48031,81.50657],[-67.84,80.9],[-69.4697,80.61683],[-71.18,79.8],[-73.2428,79.63415],[-73.88,79.430162],[-76.90773,79.32309],[-75.52924,79.19766],[-76.22046,79.01907],[-75.39345,78.52581],[-76.34354,78.18296],[-77.88851,77.89991],[-78.36269,77.50859],[-79.75951,77.20968],[-79.61965,76.98336],[-77.91089,77.022045],[-77.88911,76.777955],[-80.56125,76.17812],[-83.17439,76.45403],[-86.11184,76.29901],[-87.6,76.42],[-89.49068,76.47239],[-89.6161,76.95213],[-87.76739,77.17833],[-88.26,77.9],[-87.65,77.970222],[-84.97634,77.53873],[-86.34,78.18],[-87.96192,78.37181],[-87.15198,78.75867],[-85.37868,78.9969],[-85.09495,79.34543],[-86.50734,79.73624],[-86.93179,80.25145],[-84.19844,80.20836],[-83.408696,80.1],[-81.84823,80.46442],[-84.1,80.58],[-87.59895,80.51627],[-89.36663,80.85569],[-90.2,81.26],[-91.36786,81.5531],[-91.58702,81.89429]]],[[[-75.21597,67.44425],[-75.86588,67.14886],[-76.98687,67.09873],[-77.2364,67.58809],[-76.81166,68.14856],[-75.89521,68.28721],[-75.1145,68.01036],[-75.10333,67.58202],[-75.21597,67.44425]]],[[[-96.257401,69.49003],[-95.647681,69.10769],[-96.269521,68.75704],[-97.617401,69.06003],[-98.431801,68.9507],[-99.797401,69.40003],[-98.917401,69.71003],[-98.218261,70.14354],[-97.157401,69.86003],[-96.557401,69.68003],[-96.257401,69.49003]]],[[[-64.51912,49.87304],[-64.17322,49.95718],[-62.85829,49.70641],[-61.835585,49.28855],[-61.806305,49.10506],[-62.29318,49.08717],[-63.58926,49.40069],[-64.51912,49.87304]]],[[[-64.01486,47.03601],[-63.6645,46.55001],[-62.9393,46.41587],[-62.01208,46.44314],[-62.50391,46.03339],[-62.87433,45.96818],[-64.1428,46.39265],[-64.39261,46.72747],[-64.01486,47.03601]]]]}};

const wealthInequalityPercentiles = [
  { name: "US 30-31 percentile", percentile: "p30p31", rank: "p30p31", x: 30.5, y: 0.02, value: 11958.7, wealthShare: 0.0002, year: 2024, country: "United States", highlight: true },
  { name: "US 35-36 percentile", percentile: "p35p36", rank: "p35p36", x: 35.5, y: 0.05, value: 26979.4, wealthShare: 0.0005, year: 2024, country: "United States" },
  { name: "US 40-41 percentile", percentile: "p40p41", rank: "p40p41", x: 40.5, y: 0.08, value: 42386.3, wealthShare: 0.0008, year: 2024, country: "United States" },
  { name: "US 45-46 percentile", percentile: "p45p46", rank: "p45p46", x: 45.5, y: 0.12, value: 59125.8, wealthShare: 0.0012, year: 2024, country: "United States" },
  { name: "US 50-51 percentile", percentile: "p50p51", rank: "p50p51", x: 50.5, y: 0.16, value: 84351.7, wealthShare: 0.0016, year: 2024, country: "United States" },
  { name: "US 55-56 percentile", percentile: "p55p56", rank: "p55p56", x: 55.5, y: 0.24, value: 121388.2, wealthShare: 0.0024, year: 2024, country: "United States" },
  { name: "US 60-61 percentile", percentile: "p60p61", rank: "p60p61", x: 60.5, y: 0.33, value: 169684.6, wealthShare: 0.0033, year: 2024, country: "United States" },
  { name: "US 65-66 percentile", percentile: "p65p66", rank: "p65p66", x: 65.5, y: 0.45, value: 231482.9, wealthShare: 0.0045, year: 2024, country: "United States" },
  { name: "US 70-71 percentile", percentile: "p70p71", rank: "p70p71", x: 70.5, y: 0.61, value: 313003.4, wealthShare: 0.0061, year: 2024, country: "United States" },
  { name: "US 75-76 percentile", percentile: "p75p76", rank: "p75p76", x: 75.5, y: 0.82, value: 420425.8, wealthShare: 0.0082, year: 2024, country: "United States" },
  { name: "US 80-81 percentile", percentile: "p80p81", rank: "p80p81", x: 80.5, y: 1.09, value: 559856.7, wealthShare: 0.0109, year: 2024, country: "United States" },
  { name: "US 85-86 percentile", percentile: "p85p86", rank: "p85p86", x: 85.5, y: 1.47, value: 752699.4, wealthShare: 0.0147, year: 2024, country: "United States" },
  { name: "US 90-91 percentile", percentile: "p90p91", rank: "p90p91", x: 90.5, y: 2.11, value: 1080172.7, wealthShare: 0.0211, year: 2024, country: "United States" },
  { name: "US 91-92 percentile", percentile: "p91p92", rank: "p91p92", x: 91.5, y: 2.31, value: 1180850.6, wealthShare: 0.0231, year: 2024, country: "United States" },
  { name: "US 92-93 percentile", percentile: "p92p93", rank: "p92p93", x: 92.5, y: 2.55, value: 1302489, wealthShare: 0.0255, year: 2024, country: "United States" },
  { name: "US 93-94 percentile", percentile: "p93p94", rank: "p93p94", x: 93.5, y: 2.84, value: 1453089.5, wealthShare: 0.0284, year: 2024, country: "United States" },
  { name: "US 94-95 percentile", percentile: "p94p95", rank: "p94p95", x: 94.5, y: 3.22, value: 1645863.7, wealthShare: 0.0322, year: 2024, country: "United States", highlight: true },
];

const climateJusticeCountries = [
  { name: "Malawi", label: "Malawi", rank: "MWI", x: 1286.7, y: 392.6, value: 0.088, year: 2022, isoCode: "MWI", highlight: true },
  { name: "Niger", label: "Niger", rank: "NER", x: 978.9, y: 534.4, value: 0.126, year: 2022, isoCode: "NER" },
  { name: "Ethiopia", label: "Ethiopia", rank: "ETH", x: 2153.2, y: 651.3, value: 0.135, year: 2022, isoCode: "ETH" },
  { name: "Rwanda", label: "Rwanda", rank: "RWA", x: 2085.3, y: 498.2, value: 0.143, year: 2022, isoCode: "RWA" },
  { name: "Chad", label: "Chad", rank: "TCD", x: 1306.8, y: 448.1, value: 0.152, year: 2022, isoCode: "TCD" },
  { name: "Sierra Leone", label: "Sierra Leone", rank: "SLE", x: 1411.3, y: 766.9, value: 0.174, year: 2022, isoCode: "SLE" },
  { name: "Kenya", label: "Kenya", rank: "KEN", x: 3508.8, y: 1609.9, value: 0.379, year: 2022, isoCode: "KEN" },
  { name: "India", label: "India", rank: "IND", x: 7349.6, y: 7057.2, value: 1.986, year: 2022, isoCode: "IND" },
  { name: "Indonesia", label: "Indonesia", rank: "IDN", x: 12552.8, y: 9859.9, value: 2.719, year: 2022, isoCode: "IDN" },
  { name: "Brazil", label: "Brazil", rank: "BRA", x: 15156, y: 17744.2, value: 2.283, year: 2022, isoCode: "BRA" },
  { name: "Mexico", label: "Mexico", rank: "MEX", x: 15810.5, y: 17858.7, value: 3.528, year: 2022, isoCode: "MEX" },
  { name: "South Africa", label: "South Africa", rank: "ZAF", x: 11599.5, y: 21580.7, value: 6.874, year: 2022, isoCode: "ZAF" },
  { name: "Germany", label: "Germany", rank: "DEU", x: 46495.3, y: 41094.1, value: 7.942, year: 2022, isoCode: "DEU" },
  { name: "China", label: "China", rank: "CHN", x: 18921.1, y: 31235.7, value: 8.218, year: 2022, isoCode: "CHN" },
  { name: "Japan", label: "Japan", rank: "JPN", x: 38196.7, y: 39974.9, value: 8.237, year: 2022, isoCode: "JPN" },
  { name: "Canada", label: "Canada", rank: "CAN", x: 45369.4, y: 102122.4, value: 14.107, year: 2022, isoCode: "CAN" },
  { name: "Australia", label: "Australia", rank: "AUS", x: 51305.4, y: 63386.5, value: 14.659, year: 2022, isoCode: "AUS" },
  { name: "United States", label: "United States", rank: "USA", x: 57075.3, y: 77627.7, value: 14.802, year: 2022, isoCode: "USA", highlight: true },
];

const countryFlagByIso3 = {
  AUS: "🇦🇺",
  BRA: "🇧🇷",
  CAN: "🇨🇦",
  CHN: "🇨🇳",
  DEU: "🇩🇪",
  ETH: "🇪🇹",
  IDN: "🇮🇩",
  IND: "🇮🇳",
  JPN: "🇯🇵",
  KEN: "🇰🇪",
  MEX: "🇲🇽",
  MWI: "🇲🇼",
  NER: "🇳🇪",
  RWA: "🇷🇼",
  SLE: "🇸🇱",
  TCD: "🇹🇩",
  USA: "🇺🇸",
  ZAF: "🇿🇦",
};

const exampleDatasets = [
  {
    id: "eco",
    svgId: "eco-example-svg",
    sliderId: "eco-example-emphasis-slider",
    outputId: "eco-example-emphasis-output",
    valueMin: 0.246722,
    valueMax: 42.500000,
    focusDMin: 16,
    focusDMax: 96,
    valueUnit: "acres/1k",
    xDomain: [30000, 205000],
    yDomain: [0, 60],
    xTableLabel: "Median Household Income",
    yTableLabel: "No High School Diploma Pct",
    tableCaption: "Trimmed middle 161 study areas by Acres/1000, ascending",
    valueFormatter: (value) => `${value < 1 ? value.toFixed(3) : value.toFixed(1)} acres/1k`,
    xValueFormatter: (value) => `$${formatValue(value)}`,
    yValueFormatter: (value) => `${formatExampleRawNumber(value)}%`,
    xTickFormatter: (value) => `$${formatValue(value / 1000)}k`,
    yTickFormatter: (value) => `${formatValue(value)}%`,
    xAxisLabel: "Median household income",
    yAxisLabel: "No high school diploma (%)",
    beforeTitle: "Standard sqrt scaling compresses the park-poor tracts.",
    afterTitle: "Bounded emphasis reallocates diameter inside the same endpoints.",
    palette: {
      small: "#f4d35e",
      mid: "#78a6b8",
      large: "#2f7d68",
      stroke: "#1f5a54",
    },
    data: laParkNeedsTrimmedAreas,
  },
  {
    id: "language",
    svgId: "language-example-svg",
    sliderId: "language-example-emphasis-slider",
    outputId: "language-example-emphasis-output",
    valueMin: 1200,
    valueMax: 152000,
    focusDMin: 24,
    focusDMax: 80,
    valueUnit: "mother-tongue speakers",
    layout: "geo",
    geoFeature: canadaOutlineFeature,
    geoYOffsetRatio: -0.1,
    calloutLabels: true,
    calloutOffsets: {
      "Wakashan family": { dx: -92, dy: 26 },
      "Tsimshian family": { dx: -112, dy: -20 },
      "Salish family": { dx: -82, dy: 64 },
      "Siouan family": { dx: -72, dy: 24 },
      "Montagnais-Naskapi": { dx: 58, dy: -22 },
      "Oji-Cree": { dx: 66, dy: -20 },
      "Athapaskan family": { dx: -92, dy: -34 },
      "Ojibway family": { dx: 66, dy: 24 },
      "Inuktitut": { dx: 72, dy: -36 },
      "Cree": { dx: 84, dy: -4 },
      "Algonquian family": { dx: 76, dy: 48 },
    },
    xTableLabel: "Representative longitude",
    yTableLabel: "Representative latitude",
    valueFormatter: (value) => `${formatValue(value)} mother-tongue speakers`,
    xValueFormatter: (value) => `${Math.abs(value).toFixed(3)}°W`,
    yValueFormatter: (value) => `${value.toFixed(3)}°N`,
    xAxisLabel: "Representative longitude",
    yAxisLabel: "Representative latitude",
    tableCaption: "UNESCO speaker counts with representative Glottolog coordinates",
    beforeTitle: "Sqrt scaling keeps the range honest but makes tiny communities quiet.",
    afterTitle: "Bounded emphasis makes smaller language families legible.",
    palette: {
      small: "#c03a3e",
      mid: "#9a6a4f",
      large: "#4b2c67",
      stroke: "#372044",
    },
    data: [
      {
        name: "Wakashan family",
        value: 1200,
        x: -127.308,
        y: 50.9269,
        representativeName: "Kwak'wala",
        glottocode: "kwak1269",
        highlight: true,
      },
      {
        name: "Tsimshian family",
        value: 2400,
        x: -128.544545,
        y: 52.59103,
        representativeName: "Southern-Coastal Tsimshian",
        glottocode: "nucl1649",
      },
      {
        name: "Salish family",
        value: 3700,
        x: -123.757114,
        y: 48.51614,
        representativeName: "Northern Straits Salish",
        glottocode: "stra1244",
      },
      {
        name: "Siouan family",
        value: 6000,
        x: -114.984,
        y: 51.1939,
        representativeName: "Stoney",
        glottocode: "ston1242",
      },
      {
        name: "Montagnais-Naskapi",
        value: 11000,
        x: -68.7376,
        y: 49.0533,
        representativeName: "Montagnais",
        glottocode: "mont1268",
      },
      {
        name: "Oji-Cree",
        value: 12000,
        x: -89.9331,
        y: 53.9092,
        representativeName: "Severn Ojibwa",
        glottocode: "seve1240",
      },
      {
        name: "Athapaskan family",
        value: 20000,
        x: -125.67,
        y: 63.5,
        representativeName: "North Slavey",
        glottocode: "nort2942",
      },
      {
        name: "Ojibway family",
        value: 26000,
        x: -87.7862,
        y: 51.6192,
        representativeName: "Northwestern Ojibwa",
        glottocode: "nort2961",
      },
      {
        name: "Inuktitut",
        value: 33000,
        x: -75.6139,
        y: 62.1735,
        representativeName: "Eastern Canadian Inuktitut",
        glottocode: "east2534",
      },
      {
        name: "Cree",
        value: 85000,
        x: -95,
        y: 56,
        representativeName: "Swampy Cree",
        glottocode: "swam1239",
      },
      {
        name: "Algonquian family",
        value: 152000,
        x: -77.5258,
        y: 47.3876,
        representativeName: "Algonquin",
        glottocode: "algo1255",
        highlight: true,
      },
    ],
  },
  {
    id: "wealth",
    svgId: "wealth-example-svg",
    sliderId: "wealth-example-emphasis-slider",
    outputId: "wealth-example-emphasis-output",
    valueMin: 11958.7,
    valueMax: 1645863.7,
    focusDMin: 16,
    focusDMax: 96,
    valueUnit: "average net worth",
    valueLabel: "Average net worth",
    xDomain: [28, 97],
    yDomain: [0, 3.8],
    xTableLabel: "Percentile rank",
    yTableLabel: "Wealth share",
    tableCaption: "WID United States 2024 one-percentile wealth display slice",
    valueFormatter: (value) => `$${formatValue(Math.round(value))}`,
    xValueFormatter: (value) => `${value.toFixed(1)} percentile rank`,
    yValueFormatter: (value) => `${value.toFixed(2)}%`,
    xTickFormatter: (value) => `${formatValue(value)}th`,
    yTickFormatter: (value) => `${value.toFixed(1)}%`,
    xAxisLabel: "Percentile rank",
    yAxisLabel: "Share of total wealth (%)",
    beforeTitle: "Sqrt scaling compresses the high-wealth tail.",
    afterTitle: "Large-value emphasis separates adjacent upper percentiles.",
    caption: "WID U.S. 2024 one-point percentile bins; same Dmin and Dmax.",
    palette: {
      small: "#8db7a6",
      mid: "#c6a15b",
      large: "#5c3d8a",
      stroke: "#3e2c5f",
    },
    data: wealthInequalityPercentiles,
  },
  {
    id: "climate",
    svgId: "climate-example-svg",
    sliderId: "climate-example-emphasis-slider",
    outputId: "climate-example-emphasis-output",
    valueMin: 0.088,
    valueMax: 14.802,
    focusDMin: 16,
    focusDMax: 96,
    valueUnit: "t CO2/person",
    valueLabel: "CO2 per capita",
    xScaleType: "log",
    yScaleType: "log",
    xDomain: [800, 80000],
    yDomain: [250, 150000],
    xTickValues: [1000, 3000, 10000, 30000, 80000],
    yTickValues: [300, 1000, 3000, 10000, 30000, 100000],
    xTableLabel: "GDP per capita",
    yTableLabel: "Energy per capita",
    tableCaption: "OWID CO2 2022 country display slice with GDP, energy, and CO2 columns",
    valueFormatter: (value) => `${value.toFixed(value < 1 ? 3 : 1)} t/person`,
    xValueFormatter: (value) => `$${formatValue(Math.round(value))}`,
    yValueFormatter: (value) => `${formatValue(Math.round(value))} kWh/person`,
    xTickFormatter: (value) => `$${formatValue(value / 1000)}k`,
    yTickFormatter: (value) => `${formatValue(value / 1000)}k`,
    xAxisLabel: "GDP per capita, log scale",
    yAxisLabel: "Energy per capita, log scale",
    beforeTitle: "Sqrt scaling hides separation among high-emission countries.",
    afterTitle: "Large-value emphasis keeps the high end inspectable.",
    palette: {
      small: "#6aa5a9",
      mid: "#d08a4d",
      large: "#9f2f45",
      stroke: "#632235",
    },
    data: climateJusticeCountries,
  },
];

function addSingleBoundedExample(baseId, id, svgId) {
  const baseDataset = exampleDatasets.find((dataset) => dataset.id === baseId);
  if (!baseDataset) return;
  exampleDatasets.push({
    ...baseDataset,
    id,
    svgId,
    panelMode: "singleAfter",
  });
}

addSingleBoundedExample("language", "languageBounded", "language-bounded-example-svg");
addSingleBoundedExample("climate", "climateBounded", "climate-bounded-example-svg");

function exampleValueRatio(dataset) {
  return dataset.valueMax / dataset.valueMin;
}

function exampleFocusDiameterBudget(dataset) {
  return {
    dMin: dataset.focusDMin ?? exampleConfig.focusDMin,
    dMax: dataset.focusDMax ?? exampleConfig.focusDMax,
  };
}

function exampleDiameterBudget(dataset) {
  const focusBudget = exampleFocusDiameterBudget(dataset);
  if (dataset.panelMode === "singleAfter") {
    return focusBudget;
  }
  return {
    dMin: dataset.comparisonDMin ?? focusBudget.dMin / 2,
    dMax: dataset.comparisonDMax ?? focusBudget.dMax / 2,
  };
}

function exampleReferenceDiameter(value, dataset) {
  const { dMin } = exampleDiameterBudget(dataset);
  return dMin * Math.sqrt(value / dataset.valueMin);
}

function exampleFitAlpha(dataset) {
  const { dMin, dMax } = exampleDiameterBudget(dataset);
  return Math.min(
    0.5,
    Math.log(dMax / dMin) /
      Math.log(exampleValueRatio(dataset))
  );
}

function exampleFitDiameter(value, dataset) {
  const { dMin } = exampleDiameterBudget(dataset);
  return dMin * Math.pow(value / dataset.valueMin, exampleFitAlpha(dataset));
}

function exampleLogPosition(value, dataset) {
  return clamp(
    Math.log(value / dataset.valueMin) / Math.log(exampleValueRatio(dataset)),
    0,
    1
  );
}

function exampleSmallValueDiameter(value, dataset, emphasis) {
  const { dMin, dMax } = exampleDiameterBudget(dataset);
  const alpha0 = exampleFitAlpha(dataset);
  const x = exampleLogPosition(value, dataset);
  const localBoost =
    Math.max(-emphasis, 0) * 0.24 * Math.sin(Math.PI * x) * (1 - 0.55 * x);
  const logDiameterRatio = (alpha0 + localBoost) * x * Math.log(exampleValueRatio(dataset));
  return clamp(
    dMin * Math.exp(logDiameterRatio),
    dMin,
    dMax
  );
}

function exampleLinearDiameter(value, dataset) {
  const { dMin, dMax } = exampleDiameterBudget(dataset);
  const t = (value - dataset.valueMin) / (dataset.valueMax - dataset.valueMin);
  return dMin + (dMax - dMin) * clamp(t, 0, 1);
}

function exampleActiveDiameter(value, dataset, emphasis) {
  const { dMin, dMax } = exampleDiameterBudget(dataset);
  const e = clamp(emphasis, -1, 1);
  const small = e < 0 ? exampleSmallValueDiameter(value, dataset, e) : exampleFitDiameter(value, dataset);
  const large = exampleLinearDiameter(value, dataset);
  const blended = (1 - Math.max(e, 0)) * small + Math.max(e, 0) * large;
  return clamp(blended, dMin, dMax);
}

function exampleColor(point, dataset) {
  const logPosition = exampleLogPosition(point.value, dataset);
  if (logPosition <= 0.35) return dataset.palette.small;
  if (logPosition >= 0.72) return dataset.palette.large;
  return dataset.palette.mid;
}

function formatExampleRawNumber(value) {
  return Number.isInteger(value) ? formatValue(value) : String(value);
}

function formatExampleTableValue(value, formatter) {
  return formatter ? formatter(value) : formatExampleRawNumber(value);
}

function exampleBubbleTooltipData(point, dataset) {
  const valueLabel =
    dataset.valueLabel || (dataset.valueUnit === "acres/1k" ? "Acres/1k" : "Value");
  const flagEmoji =
    dataset.valueUnit === "t CO2/person" && point.isoCode
      ? countryFlagByIso3[point.isoCode]
      : "";
  const items = [
    { label: "Name", value: flagEmoji ? `${flagEmoji} ${point.name}` : point.name },
  ];

  if (point.year) {
    items.push({ label: "Year", value: point.year });
  }
  if (point.percentile) {
    items.push({ label: "Percentile bin", value: point.percentile });
  }
  if (point.isoCode) {
    items.push({ label: "ISO code", value: point.isoCode });
  }

  if (Number.isFinite(point.parkAcres)) {
    items.push({
      label: "Park acres",
      value: Number(point.parkAcres).toLocaleString("en-US", {
        maximumFractionDigits: 3,
      }),
    });
  }

  if (point.representativeName) {
    items.push({ label: "Representative point", value: point.representativeName });
  }
  if (point.glottocode) {
    items.push({ label: "Glottocode", value: point.glottocode });
  }

  items.push(
    {
      label: dataset.xTableLabel || dataset.xAxisLabel || "X",
      value: formatExampleTableValue(point.x, dataset.xValueFormatter),
    },
    {
      label: dataset.yTableLabel || dataset.yAxisLabel || "Y",
      value: formatExampleTableValue(point.y, dataset.yValueFormatter),
    }
  );

  return {
    valueLabel,
    valueText: dataset.valueFormatter(point.value),
    items,
  };
}

function renderExampleDataTables() {
  document.querySelectorAll(".dataset-raw-table-host").forEach((host) => {
    const dataset = exampleDatasets.find(
      (candidate) => candidate.id === host.dataset.exampleTable
    );
    if (!dataset) return;

    const rows = dataset.data
      .map(
        (point, index) => `
          <tr>
            <td>${escapeHtml(String(point.rank || index + 1))}</td>
            <th scope="row">${escapeHtml(point.name)}</th>
            <td>${escapeHtml(
              dataset.valueFormatter
                ? dataset.valueFormatter(point.value)
                : `${formatExampleRawNumber(point.value)} ${dataset.valueUnit}`
            )}</td>
            <td>${escapeHtml(formatExampleTableValue(point.x, dataset.xValueFormatter))}</td>
            <td>${escapeHtml(formatExampleTableValue(point.y, dataset.yValueFormatter))}</td>
          </tr>`
      )
      .join("");

    host.innerHTML = `
      <table class="dataset-raw-table">
        <caption>${escapeHtml(dataset.tableCaption || "Display subset and plot layout")}</caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Item</th>
            <th scope="col">Value</th>
            <th scope="col">${escapeHtml(dataset.xTableLabel || "Plot X (derived)")}</th>
            <th scope="col">${escapeHtml(dataset.yTableLabel || "Plot Y (derived)")}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  });
}

function drawExampleDataset(dataset, emphasis) {
  const d3 = window.d3;
  const svgNode = document.getElementById(dataset.svgId);
  if (!svgNode) return;

  if (!d3) {
    svgNode.outerHTML = `<div class="example-no-d3">D3.js did not load. Check the network connection and reload this page to render the interactive example.</div>`;
    return;
  }

  const svg = d3.select(svgNode);
  const panelMode = dataset.panelMode || "comparison";
  const isSingleAfter = panelMode === "singleAfter";
  const width = isSingleAfter ? 1320 : 1800;
  const height = isSingleAfter ? 743 : 430;
  const margin = isSingleAfter
    ? { top: 58, right: 44, bottom: 90, left: 78 }
    : { top: 18, right: 28, bottom: 20, left: 34 };
  const panelGap = isSingleAfter ? 0 : 42;
  const isGeoLayout = dataset.layout === "geo" && dataset.geoFeature;
  const isCleanMode = dataset.cleanMode === true;
  const panelSpecs = isSingleAfter
    ? [{ key: "after" }]
    : [{ key: "raw" }, { key: "fit" }, { key: "after" }];
  const panelWidth =
    (width - margin.left - margin.right - panelGap * (panelSpecs.length - 1)) /
    panelSpecs.length;
  const plotHeight = height - margin.top - margin.bottom;
  const panels = panelSpecs.map((panel, index) => ({
    ...panel,
    xOffset: margin.left + index * (panelWidth + panelGap),
  }));
  const makeScale = (scaleType, domain, range) => {
    if (scaleType === "log") {
      return d3.scaleLog().domain(domain).range(range);
    }
    return d3.scaleLinear().domain(domain).nice().range(range);
  };
  const xScale = isGeoLayout
    ? null
    : makeScale(dataset.xScaleType, dataset.xDomain || [0, 100], [0, panelWidth]);
  const yScale = isGeoLayout
    ? null
    : makeScale(dataset.yScaleType, dataset.yDomain || [0, 100], [plotHeight, 0]);
  const geoYOffset = isGeoLayout ? (dataset.geoYOffsetRatio || 0) * plotHeight : 0;
  const geoFitPadding = isSingleAfter
    ? { left: 2, top: 2, right: 2, bottom: 2 }
    : { left: 10, top: 4, right: 10, bottom: 6 };
  let geoProjection = isGeoLayout
    ? d3
        .geoConicConformal()
        .parallels([49, 77])
        .rotate([96, 0])
        .fitExtent(
          [
            [geoFitPadding.left, geoFitPadding.top],
            [panelWidth - geoFitPadding.right, plotHeight - geoFitPadding.bottom],
          ],
          dataset.geoFeature
        )
    : null;

  if (isGeoLayout && isSingleAfter && geoProjection) {
    const comparisonWidth = 1800;
    const comparisonMargin = { top: 18, right: 28, bottom: 20, left: 34 };
    const comparisonPanelGap = 42;
    const comparisonPanelWidth =
      (comparisonWidth -
        comparisonMargin.left -
        comparisonMargin.right -
        comparisonPanelGap * 2) /
      3;
    const currentBounds = d3.geoPath(geoProjection).bounds(dataset.geoFeature);
    const currentMapWidth = currentBounds[1][0] - currentBounds[0][0];
    const targetMapWidth = comparisonPanelWidth * 1.6;
    const scaleFactor = currentMapWidth > 0 ? Math.max(1, targetMapWidth / currentMapWidth) : 1;

    if (Number.isFinite(scaleFactor) && scaleFactor > 1) {
      const center = [
        (currentBounds[0][0] + currentBounds[1][0]) / 2,
        (currentBounds[0][1] + currentBounds[1][1]) / 2,
      ];
      const translate = geoProjection.translate();
      geoProjection
        .scale(geoProjection.scale() * scaleFactor)
        .translate([
          scaleFactor * translate[0] + (1 - scaleFactor) * center[0],
          scaleFactor * translate[1] + (1 - scaleFactor) * center[1],
        ]);
    }
  }

  const geoPath = isGeoLayout ? d3.geoPath(geoProjection) : null;
  const geoGraticule = isGeoLayout
    ? d3.geoGraticule().extent([
        [-142, 42],
        [-52, 84],
      ])
    : null;
  const pointPosition = (point) => {
    if (!isGeoLayout) return [xScale(point.x), yScale(point.y)];
    const projected = geoProjection([point.x, point.y]) || [0, 0];
    return [projected[0], projected[1] + geoYOffset];
  };

  svg.attr("viewBox", `0 0 ${width} ${height}`);
  const layoutKey = `${isGeoLayout ? "geo" : "xy"}-${panelMode}-${isCleanMode ? "clean" : "full"}-${width}x${height}`;

  if (
    svg.selectAll(".example-dataset-panel").size() !== panels.length ||
    svg.attr("data-example-layout") !== layoutKey
  ) {
    svg.selectAll("*").remove();
    svg.attr("data-example-layout", layoutKey);

    if (!isCleanMode) {
      svg
        .selectAll(".example-panel-divider")
        .data(panels.slice(1).map((panel) => panel.xOffset - panelGap / 2))
        .join("line")
        .attr("class", "example-panel-divider")
        .attr("x1", (x) => x)
        .attr("x2", (x) => x)
        .attr("y1", margin.top - 18)
        .attr("y2", height - margin.bottom + 10);
    }

    const panelGroups = svg
      .selectAll(".example-dataset-panel")
      .data(panels)
      .join("g")
      .attr("class", "example-dataset-panel")
      .attr("data-panel-key", (panel) => panel.key)
      .attr("transform", (panel) => `translate(${panel.xOffset},${margin.top})`);

    if (isGeoLayout && !isCleanMode) {
      panelGroups
        .append("path")
        .datum(geoGraticule())
        .attr("class", "example-map-graticule")
        .attr("transform", `translate(0,${geoYOffset})`)
        .attr("d", geoPath);

      panelGroups
        .append("path")
        .datum(dataset.geoFeature)
        .attr("class", "example-map-land")
        .attr("transform", `translate(0,${geoYOffset})`)
        .attr("d", geoPath);
    } else if (!isCleanMode) {
      const xAxis = d3
        .axisBottom(xScale)
        .ticks(dataset.xTickCount || 4)
        .tickFormat(isSingleAfter ? dataset.xTickFormatter || null : () => "")
        .tickSizeOuter(0);
      const yAxis = d3
        .axisLeft(yScale)
        .ticks(dataset.yTickCount || 4)
        .tickFormat(isSingleAfter ? dataset.yTickFormatter || null : () => "")
        .tickSizeOuter(0);

      if (dataset.xTickValues) xAxis.tickValues(dataset.xTickValues);
      if (dataset.yTickValues) yAxis.tickValues(dataset.yTickValues);

      panelGroups
        .append("g")
        .attr("class", "example-axis")
        .attr("transform", `translate(0,${plotHeight})`)
        .call(xAxis);

      panelGroups
        .append("g")
        .attr("class", "example-axis")
        .call(yAxis);

      if (isSingleAfter) {
        panelGroups
          .append("text")
          .attr("class", "example-axis-label example-axis-label-x")
          .attr("x", panelWidth / 2)
          .attr("y", plotHeight + 58)
          .attr("text-anchor", "middle")
          .text(dataset.xAxisLabel);

        panelGroups
          .append("text")
          .attr("class", "example-axis-label example-axis-label-y")
          .attr("transform", "rotate(-90)")
          .attr("x", -plotHeight / 2)
          .attr("y", -56)
          .attr("text-anchor", "middle")
          .text(dataset.yAxisLabel);
      }
    }

  }

  panels.forEach((panel) => {
    const group = svg.select(`.example-dataset-panel[data-panel-key="${panel.key}"]`);
    const bubbleData = dataset.data.map((point) => {
      let diameter = exampleActiveDiameter(point.value, dataset, emphasis);
      if (panel.key === "raw") diameter = exampleReferenceDiameter(point.value, dataset);
      if (panel.key === "fit") diameter = exampleFitDiameter(point.value, dataset);
      return { ...point, diameter };
    });

    const bubbles = group
      .selectAll(`.example-bubble-${panel.key}`)
      .data(bubbleData, (point) => point.name)
      .join("circle")
      .attr(
        "class",
        (point) =>
          `example-bubble example-bubble-${panel.key} ${point.highlight ? "example-bubble-highlight" : ""}`
      )
      .attr("cx", (point) => pointPosition(point)[0])
      .attr("cy", (point) => pointPosition(point)[1])
      .attr("fill", (point) => exampleColor(point, dataset))
      .attr("stroke", dataset.palette.stroke);

    if (isCleanMode) {
      bubbles.attr("data-tooltip", null).attr("aria-label", null);
    } else {
      bubbles
        .attr("data-tooltip", (point) =>
          tooltipPayloadAttribute(exampleBubbleTooltipData(point, dataset))
        )
        .attr("aria-label", (point) =>
          tooltipPayloadPlainText(exampleBubbleTooltipData(point, dataset)).replace(/\n/g, " | ")
        );
    }

    bubbles
      .attr("r", function () {
        return this.getAttribute("r") || 0;
      })
      .transition()
      .duration(200)
      .attr("r", (point) => point.diameter / 2);

    bubbles.selectAll("title").remove();
    const shouldDrawCallouts =
      dataset.calloutLabels === true &&
      isSingleAfter &&
      panel.key === "after" &&
      !isCleanMode;

    if (shouldDrawCallouts) {
      const callouts = group
        .selectAll(`.example-callout-${panel.key}`)
        .data(bubbleData, (point) => point.name)
        .join((enter) => {
          const callout = enter
            .append("g")
            .attr("class", `example-callout example-callout-${panel.key}`);
          callout.append("line").attr("class", "example-callout-line");
          callout.append("text").attr("class", "example-callout-label");
          return callout;
        });

      callouts.each(function (point) {
        const callout = d3.select(this);
        const [bubbleX, bubbleY] = pointPosition(point);
        const offset = dataset.calloutOffsets?.[point.name] || { dx: 56, dy: -16 };
        const labelX = clamp(bubbleX + offset.dx, 10, panelWidth - 10);
        const labelY = clamp(bubbleY + offset.dy, 20, plotHeight - 12);
        const labelSide = labelX >= bubbleX ? "right" : "left";
        const labelGap = 7;
        const lineEndX = labelX + (labelSide === "right" ? -labelGap : labelGap);
        const lineEndY = labelY - 4;
        const deltaX = lineEndX - bubbleX;
        const deltaY = lineEndY - bubbleY;
        const lineLength = Math.hypot(deltaX, deltaY) || 1;
        const edgePadding = point.diameter / 2 + 4;
        const lineStartX = bubbleX + (deltaX / lineLength) * edgePadding;
        const lineStartY = bubbleY + (deltaY / lineLength) * edgePadding;

        callout
          .select(".example-callout-line")
          .attr("x1", lineStartX)
          .attr("y1", lineStartY)
          .attr("x2", lineEndX)
          .attr("y2", lineEndY);

        callout
          .select(".example-callout-label")
          .attr("x", labelX)
          .attr("y", labelY)
          .attr("text-anchor", labelSide === "right" ? "start" : "end")
          .text(point.name);
      });
    } else {
      group.selectAll(`.example-callout-${panel.key}`).remove();
    }

    group.selectAll(`.example-label-${panel.key}`).remove();
  });
}

function exampleDatasetEmphasis(dataset) {
  const slider = document.getElementById(dataset.sliderId);
  if (!slider) return -1;
  const min = Number.isFinite(Number(slider.min)) ? Number(slider.min) : -1;
  const max = Number.isFinite(Number(slider.max)) ? Number(slider.max) : 1;
  return clamp(Number(slider.value), min, max);
}

function updateExampleDataset(dataset) {
  const output = document.getElementById(dataset.outputId);
  const emphasis = exampleDatasetEmphasis(dataset);
  if (output) output.textContent = `e = ${formatEmphasis(emphasis)}`;
  drawExampleDataset(dataset, emphasis);
}

function updateExampleApplications() {
  exampleDatasets.forEach(updateExampleDataset);
}

function initializeExampleApplications() {
  renderExampleDataTables();
  exampleDatasets.forEach((dataset) => {
    const slider = document.getElementById(dataset.sliderId);
    if (!slider) return;
    slider.addEventListener("input", () => {
      window.requestAnimationFrame(() => updateExampleDataset(dataset));
    });
  });
  updateExampleApplications();
}

render();
initializeExampleApplications();
applyAppRouteFromLocation();
