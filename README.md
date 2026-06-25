# Bounded Bubbles

A static GitHub Pages prototype for tuning and explaining bounded bubble-size scaling in an interactive dashboard.

The app has no backend, no database, no login, and no required data storage. All current data is synthetic and embedded in the client-side files.

## Current Version

This version is an exploratory display prototype:

- Shows a synthetic value-distribution bubble map on the left.
- Lets the designer adjust the dataset maximum continuously from 1 to 1000, with breakpoint examples at `10^5` and `10^10`.
- Lets the designer adjust the marker diameter range with a dual-handle slider.
- Lets the designer tune emphasis with presets and a slider on the right.
- Separates the exploratory prototype and the math explanation into two page-level tabs.
- Lets the designer switch between the transfer curve preview and linked calculation table inside the prototype.
- Uses example values from 1 to 100 by default, with an adjustable data ratio.
- Preserves the selected marker diameter range exactly: default `D_MIN = 12px`, `D_MAX = 64px`.
- Displays the current bounded global diameter formula, transfer curve preview, selected point details, diameter metrics, and calculation table.
- Dynamically updates the plot, curve preview, metrics, and table together.

It also includes a lightweight browser-only testing mode for a short target-selection study.

## Testing Mode

Click **Begin Testing** in the top-right corner of the app to run a 5-8 minute interaction study.

The test compares the reference fit against task-aware emphasis using the same testing-specific `D_MIN = 12px`, `D_MAX = 128px`, `V_MIN = 1`, and `V_MAX = 1000` in all conditions. Six low-count tasks compare reference fit with `e=-1`; six high-count tasks compare reference fit with `e=1`. Correct low-count targets cover the `1x`, `2x`, `3x`, `5x`, and `10x` range rather than clustering at the minimum. Correct high-count targets are large but not maximum values, so the task tests whether large-value emphasis improves discrimination among near-large bubbles. Each testing plot includes fixed scale-anchor bubbles at `1` and `1000`, keeping the visible `D_MIN` and `D_MAX` identical across conditions. It records anonymous timing and click data locally in browser memory, including condition, task focus, viewport size, and browser user agent. It does not use a backend, account, analytics, upload, or personal data collection.

The main trial order is randomized each time the testing flow starts. The randomizer avoids showing the same dataset twice in a row, so the reference and emphasis versions of the same map should not appear back-to-back. The exported JSON includes a `randomizationId` and `mainTrialOrder` for later order-effect checks.

At the end of the flow, download the JSON results or copy the JSON to the clipboard. Results can be aggregated manually across participants for later analysis.

## Metrics

The testing mode records:

- Time-to-target-click for successful trials.
- Wrong marker clicks.
- Empty plot clicks.
- Success rate.

This is a lightweight synthetic interaction study. It measures target-selection friction, not full analytical understanding or perceptual accuracy.

## Concept

Bounded Bubbles combines three interpretable behaviors. Reference fit compresses the full data range into the available marker diameter range. Small-value emphasis uses a smooth endpoint-preserving warp that lifts the reference fit toward the low-value range while keeping the local exponent bounded by the area-proportional reference of 0.5. Large-value emphasis morphs the curve toward linear diameter mapping, making large values more visually separated.

This method is not a new alternative to log scaling. If the data spans several orders of magnitude, log scaling, filtering, faceting, or aggregation may be more appropriate. The method is intended for medium-range dashboard data where the designer wants to adjust local visual discrimination under fixed marker-size constraints.

## Use Boundaries

This prototype is intended for medium-range values, where the maximum is roughly tens to hundreds of times the minimum under the current marker-size budget. The app computes the global fit exponent `alpha0`. When `alpha0` becomes small, the problem shifts from local visual emphasis to large dynamic range visualization. In that case, the UI recommends log scaling, filtering, faceting, aggregation, capping with disclosure, or using another visual encoding.

Values around `1-100` or `1-300` are useful for exploring task-aware emphasis. Values such as `1-10^5` or `1-10^10` are intentionally treated as boundary examples where the app teaches users not to rely on bounded emphasis.

At `1-10^5`, the tuning and transfer-curve cards are replaced by a large dynamic range recommendation. The bubble map switches to a raw sqrt demonstration with the smallest point fixed at `2px`, making the largest points visibly exceed the practical marker budget.

At `1-10^10`, the right panel recommends log scale or split views, and the bubble map switches to a log-scale demonstration to show how orders of magnitude become visually manageable again.

The reference fit exponent is:

```text
alpha0 = min(0.5, ln(D_MAX / D_MIN) / ln(V_MAX / V_MIN))
```

When `D_MAX / D_MIN >= sqrt(V_MAX / V_MIN)`, the marker-size budget can already show the area-proportional sqrt relationship without compression. In that case Reference fit equals the raw sqrt reference, and the emphasis control does not redistribute sizes.

The log-space position and smooth small-value warp are:

```text
x = ln(v / V_MIN) / ln(V_MAX / V_MIN)
cMax = max(0, min(alpha0, 0.5 - alpha0))

D_smallWarp(v, a) =
  D_fit(v) * exp((a * cMax * ln(M) / PI) * sin(PI * x))
```

The emphasis curve is:

```text
a = max(-e, 0)
b = max(e, 0)

D(v, e) =
  clamp(
    (1 - b) * D_smallWarp(v, a) +
    b * D_linear(v),
    D_MIN,
    D_MAX
  )
```

The large-value target is:

```text
D_linear(v) = D_MIN + (D_MAX - D_MIN) * ((v - V_MIN) / (V_MAX - V_MIN))
```

## Run

Open `index.html` directly in a browser, or publish the folder with GitHub Pages.

For a lightweight local check:

```bash
npm run build
```
