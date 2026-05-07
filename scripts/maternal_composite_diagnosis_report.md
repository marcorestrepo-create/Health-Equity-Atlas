# Maternal access composite — diagnosis

Generated: 2026-05-07T20:42:44.286Z

## Question

Phase 1e validated the maternalAccess composite against perinatal outcomes and got r=0.28 vs IM, r=0.09 vs LBW. Is that because the components don't track outcomes, or because the equal-weight composite formula is destroying signal? This script breaks the composite apart and tests every variant.

## Sample

- Atlas counties: 3144
- Counties with at least one CHR&R outcome: 3144

## Per-component correlations

### Low Birth Weight (% of live births)

| Predictor | n | Pearson r | Spearman ρ |
|---|---|---|---|
| `ob_unit` | 3035 | 0.142 | 0.136 |
| `desert_raw` | 3035 | 0.096 | 0.085 |
| `composite_distance_uncapped` | 3035 | 0.091 | 0.050 |
| `composite_current` | 3035 | 0.087 | 0.048 |
| `composite_distance_log` | 3035 | 0.087 | 0.048 |
| `composite_provider_heavy` | 3035 | 0.043 | 0.035 |
| `ob_deficit` | 3035 | -0.043 | -0.042 |
| `composite_no_obunit` | 3035 | 0.041 | 0.017 |
| `ob_per_10k` | 3035 | 0.037 | 0.042 |
| `distance_raw` | 3035 | -0.018 | -0.005 |
| `distance_clamp60` | 3035 | -0.008 | -0.005 |
| `distance_clamp30` | 3035 | -0.004 | -0.005 |
| `distance_log` | 3035 | -0.002 | -0.005 |

### Infant Mortality (per 1,000)

| Predictor | n | Pearson r | Spearman ρ |
|---|---|---|---|
| `desert_raw` | 1172 | 0.313 | 0.263 |
| `composite_no_obunit` | 1172 | 0.299 | 0.236 |
| `composite_distance_uncapped` | 1172 | 0.284 | 0.238 |
| `composite_current` | 1172 | 0.280 | 0.238 |
| `composite_distance_log` | 1172 | 0.278 | 0.237 |
| `composite_provider_heavy` | 1172 | 0.260 | 0.232 |
| `ob_deficit` | 1172 | 0.197 | 0.218 |
| `ob_unit` | 1172 | 0.159 | 0.148 |
| `ob_per_10k` | 1172 | -0.151 | -0.217 |
| `distance_raw` | 1172 | 0.140 | 0.044 |
| `distance_clamp60` | 1172 | 0.118 | 0.044 |
| `distance_log` | 1172 | 0.096 | 0.044 |
| `distance_clamp30` | 1172 | 0.093 | 0.044 |

## Multi-variable OLS (standardized betas)

Linear regression with all four base components (z-scored): desert_raw, ob_deficit, ob_unit, distance_log. The standardized coefficient tells you how much that component matters relative to the others, holding the rest constant.

### Low Birth Weight (% of live births)

- n=3035, multiple R=0.220, R²=0.048
- desert: β=0.119
- ob_deficit: β=-0.168
- ob_unit: β=0.208
- distance_log: β=-0.121

### Infant Mortality (per 1,000)

- n=1172, multiple R=0.319, R²=0.102
- desert: β=0.284
- ob_deficit: β=0.054
- ob_unit: β=-0.011
- distance_log: β=0.040

## Files

- `scripts/maternal_composite_diagnosis.ts` (this script)
- `scripts/maternal_composite_diagnosis_report.md`
- `scripts/maternal_composite_diagnosis_report.json`