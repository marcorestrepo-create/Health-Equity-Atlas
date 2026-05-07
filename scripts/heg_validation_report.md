# HEG v2 Validation Study

Generated: 2026-05-07T19:21:44.120Z

## 1. Construct Validity

The HEG composite is meant to capture county-level health-equity disadvantage.
A useful index should correlate strongly with downstream health outcomes that
are NOT direct inputs. We test against two independent CHR&R 2025 outcomes
that the score does not consume.

### Premature Death (YPLL75 per 100,000)

- **Pearson r = 0.678** (95% CI [0.657, 0.702])
- **Spearman ρ = 0.748**
- n = 3080 counties (suppressed/missing dropped)
- Source: CHR&R 2025 — Premature Death (YPLL75 per 100,000) — NCHS underlying source

### Preventable Hospital Stays (per 100,000 Medicare)

- **Pearson r = 0.333** (95% CI [0.302, 0.363])
- **Spearman ρ = 0.346**
- n = 3061 counties
- Source: CHR&R 2025 — Preventable Hospital Stays (per 100,000 Medicare enrollees) — CMS source

**Interpretation.** Pearson r above ~0.5 indicates a meaningfully strong association at the
county level; r above ~0.7 is strong by any social-science standard. A composite that
fails to correlate with downstream mortality and avoidable hospitalization would not
deserve the name "health-equity gap."

## 2. Sensitivity to Component Weights

Each of the 10 HEG components had its weight perturbed by ±20% (renormalized
across the others). For each perturbation we measured the Jaccard similarity
between the baseline top-decile of counties (highest HEG) and the perturbed
top-decile. A robust composite has Jaccard ≥ 0.85 across all single-weight
perturbations — meaning the bottom-rung-of-counties story is not an artifact
of one analyst's weight choice.

- **Top decile size:** 314 counties (top 10%)
- **Minimum Jaccard across all 20 perturbations:** 0.892
- **Mean Jaccard:** 0.922
- **Threshold (≥0.85):** **PASS**

| Component | Perturbation | Top-Decile Jaccard | Median Rank Shift (within baseline top) |
|---|---|---|---|
| insurance | -20% | 0.920 | 10 |
| insurance | +20% | 0.926 | 12 |
| maternalAccess | -20% | 0.892 | 16 |
| maternalAccess | +20% | 0.915 | 10 |
| chronicDisease | -20% | 0.920 | 9 |
| chronicDisease | +20% | 0.926 | 10 |
| providerAccess | -20% | 0.920 | 13 |
| providerAccess | +20% | 0.915 | 9 |
| behavioralHealth | -20% | 0.944 | 9 |
| behavioralHealth | +20% | 0.915 | 12 |
| perinatal | -20% | 0.926 | 9 |
| perinatal | +20% | 0.926 | 11 |
| childPoverty | -20% | 0.926 | 8 |
| childPoverty | +20% | 0.926 | 10 |
| social | -20% | 0.903 | 12 |
| social | +20% | 0.932 | 9 |
| environmental | -20% | 0.926 | 10 |
| environmental | +20% | 0.926 | 10 |
| infrastructure | -20% | 0.926 | 9 |
| infrastructure | +20% | 0.920 | 10 |

## 3. Stress Tests

To verify the index doesn't collapse under more extreme manipulation:

### Chronic Disease +50% (well outside reasonable analyst variation)

Top-decile Jaccard: **0.915**

### Drop Each Component Entirely (zero its weight)

| Component Dropped | Top-Decile Jaccard vs Baseline |
|---|---|
| insurance | 0.769 |
| maternalAccess | 0.566 |
| chronicDisease | 0.836 |
| providerAccess | 0.716 |
| behavioralHealth | 0.880 |
| perinatal | 0.853 |
| childPoverty | 0.858 |
| social | 0.693 |
| environmental | 0.920 |
| infrastructure | 0.909 |

If any single drop pulls Jaccard far below 0.7, the index is over-relying on
that component. Components contributing in the 0.85–0.95 range when dropped are
healthy contributors; very high values (>0.97) signal weak contribution.

## 4. Methodology Notes

- HEG re-derived from public county fields (uninsured rate, SVI, etc.) using
  the same v2 formula as `shared/county-metrics.ts`. Validated against the
  primary computation; mismatch would invalidate the sensitivity analysis.
- Premature Death and Preventable Stays are downstream of upstream determinants
  but conceptually distinct from the HEG inputs (insurance access, provider
  density, environmental exposure, etc.). Some shared upstream causation is
  unavoidable in observational health data; the test is whether HEG points in
  the right direction with meaningful magnitude.
- Bootstrap CIs use 1000 resamples with seed 42 for reproducibility.
- Ranks for Spearman use mid-rank for ties (standard).

## 5. Limitations

- Both outcomes are themselves modeled (NCHS / CMS small-area smoothing).
  Neither is a clinical-trial gold standard.
- The HEG is a single-author construct. External validation by a second team,
  or peer review, is the next step beyond what's done here.
- Spatial autocorrelation is not addressed. Counties cluster geographically;
  effective sample size is smaller than the row count suggests.
- Race-stratified analysis is not run here; structural-disadvantage indices
  often perform differently across racial subgroups.
