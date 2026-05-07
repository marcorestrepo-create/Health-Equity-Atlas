# Behavioral health composite validation

Generated: 2026-05-07T20:22:49.828Z

## Hypothesis

If the behavioral health (BH) burden of a county is real, counties with higher BH burden should have higher rates of behavioral-health mortality outcomes (drug overdose, suicide).

## BH burden index (predictor)

```
mean(depression/30, frequent_mental_distress/22, lack_emotional_support/25, loneliness/35), each clamped 0-1.
```

Inputs (all from CDC PLACES 2024, BRFSS small-area estimation):
- depression_prevalence (CDC PLACES 2024)
- frequent_mental_distress (CDC PLACES 2024)
- lack_emotional_support_pct (CDC PLACES 2024)
- loneliness_pct (CDC PLACES 2024)

## Outcomes (independent)

- drug_overdose_deaths_per_100k (CHR&R 2025 / NCHS 2018-2022 pooled)
- suicide_rate_per_100k (CHR&R 2025 / NCHS 2017-2021 pooled)

> drug_overdose and suicide are NOT inputs to bh_burden_index. They ARE inputs to HEG's behavHealthGap component, but bh_burden_index is constructed independently to keep the test clean.

## Construct validity — full-county Pearson

| Outcome | n | Pearson r | 95% CI | Spearman ρ | Outcome mean (SD) |
|---|---|---|---|---|---|
| Drug overdose deaths per 100k (NCHS 2018-2022 pooled) | 1461 | 0.401 | 0.361–0.442 | 0.371 | 32.18 (±18.84) |
| Suicide rate per 100k (NCHS 2017-2021 pooled) | 1796 | 0.227 | 0.187–0.269 | 0.266 | 18.91 (±7.68) |

## Stratified test — top quartile vs bottom quartile of BH burden

| Outcome | Low-burden Q1 (n) | High-burden Q4 (n) | Δ | Δ (relative %) |
|---|---|---|---|---|
| Drug overdose deaths/100k | 24.42 (n=365) | 42.20 (n=365) | +17.78 deaths per 100k | +72.8% |
| Suicide rate/100k | 16.73 (n=449) | 20.99 (n=449) | +4.27 deaths per 100k | +25.5% |

## Interpretation

- Drug overdose: r=0.401 (moderate). The BH burden index is positively associated with county drug overdose mortality.
- Suicide: r=0.227 (weak-moderate). The BH burden index is positively associated with county suicide mortality.

Why correlations may be modest:

- BH burden is measured as PREVALENCE (depression rate, mental distress rate, etc.) while overdose/suicide are MORTALITY rates that depend on access to lethal means, treatment availability, and demographic risk factors not in the index.
- CDC PLACES uses BRFSS small-area estimation which smooths across counties; sharp county-to-county distinctions wash out.
- NCHS suppresses overdose/suicide rates for low-count counties (<10 deaths), so the validation is sample-restricted to higher-population counties — in practice, an upper bound on the rural signal.

## Files

- `scripts/behavioral_health_validation.ts`
- `scripts/behavioral_health_validation_report.md` (this file)
- `scripts/behavioral_health_validation_report.json`
