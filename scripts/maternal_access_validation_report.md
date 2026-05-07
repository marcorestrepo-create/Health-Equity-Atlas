# Maternal Access Composite — Construct Validation

Generated: 2026-05-07T19:36:33.329Z

## Why this matters

Phase 1g sensitivity analysis showed `maternalAccess` is the single most load-bearing component of HEG v2 — dropping it changes the top-decile county list by Jaccard 0.57. Before relying on it, we needed direct evidence that the composite actually tracks perinatal outcomes.

## Method

- **Composite re-derived** from public county fields: `mean(maternityCareDesert/3, obProvidersDeficit, obUnitClosure, clamp(distance/30))`. Range 0-1.
- **Outcomes** from CHR&R 2025 (NCHS source data, 2017-2023 aggregation):
  - Low Birth Weight share of live births
  - Infant Mortality per 1,000 live births
- Neither outcome is a direct input to `maternalAccess`. (Both feed the separate `perinatal` HEG component, computed independently.)
- Pearson r with 1000-resample percentile bootstrap 95% CI (seed 42); Spearman rho for monotonic robustness.

### Why not CDC WONDER county-level maternal mortality

CDC WONDER's API [explicitly blocks county-level grouping](https://wonder.cdc.gov/wonder/help/wonder-api.html) for vital statistics: "only national data are available for query by the API." The web form allows county queries but >90% of U.S. counties have <10 maternal deaths per multi-year period and are suppressed. Pivoted to LBW + infant mortality at the county level, where coverage is reliable and the outcomes still capture maternal/perinatal care quality.

## Results

### Correlation: maternalAccess composite ↔ Low Birth Weight

- n = 3035 counties
- Pearson r = 0.087 (95% CI 0.049–0.127)
- Spearman ρ = 0.048

### Correlation: maternalAccess composite ↔ Infant Mortality

- n = 1172 counties
- Pearson r = 0.280 (95% CI 0.212–0.349)
- Spearman ρ = 0.238

### Stratified comparison: maternity care deserts (MCD≥2) vs non-deserts

| Outcome | Deserts (MCD≥2) | Non-deserts (MCD≤1) | Delta |
|---|---|---|---|
| Low Birth Weight (%) | 8.70 (n=1249) | 8.22 (n=1786) | +0.48 pp |
| Infant Mortality (per 1k) | 8.04 (n=178) | 6.30 (n=994) | +1.74 /1k |

## Interpretation

- Pearson r = 0.09 for LBW and 0.28 for infant mortality. Both outcomes are noisy at the county level (especially infant mortality, which is suppressed for ~63% of counties even in CHR&R's 7-year aggregation), so we expect attenuated correlations relative to YPLL75.
- The stratified comparison is the more interpretable test: maternity care deserts have measurably worse perinatal outcomes than non-deserts. If the composite were noise, this gap would be near zero.
- This is consistent with the drop-component finding: removing maternalAccess from HEG materially changes top-decile membership because the composite captures a real signal that no other component substitutes for.

## Files

- `scripts/maternal_access_validation.ts` — this script
- `scripts/maternal_access_validation_report.md` — this report
- `scripts/maternal_access_validation_report.json` — machine-readable result
