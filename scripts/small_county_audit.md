# Small-county suppression audit

Generated: 2026-05-07T20:18:34.515Z
Metrics audited: 49

## Why this matters

Federal sources publish metrics for very small counties (e.g. ACS B25034 reports a value for Loving County TX, pop 43, derived from ~25 housing units). The point estimate has a margin of error so wide that the value reflects more noise than signal, but it still appears in the atlas with the same visual weight as a value from a county of 1 million.

This audit reports, for every metric, how many of the smallest counties (population < 5,000 and < 1,000) carry a published value vs are suppressed by the source.

**High share + small county = trustworthy source-side suppression policy.**
**Low share + small county = source published noisy values; the atlas is over-trusting them.**

## Top metrics by share-of-small-counties-with-values (pop < 1,000)

| Slug | Total | Avail (all) | Pop<5k avail | Pop<1k avail | Smallest county w/ value |
|---|---|---|---|---|---|
| adult_smoking_pct | 3144 | 3137 | 324/324 (100%) | 36/36 (100%) | 48301 (pop 43) |
| all_ages_poverty_rate | 3143 | 3143 | 323/323 (100%) | 35/35 (100%) | 48301 (pop 43) |
| broadband_access_pct | 3144 | 3137 | 324/324 (100%) | 36/36 (100%) | 48301 (pop 43) |
| child_poverty_rate_u18 | 3143 | 3143 | 323/323 (100%) | 35/35 (100%) | 48301 (pop 43) |
| distance_to_hospital | 3144 | 3144 | 324/324 (100%) | 36/36 (100%) | 48301 (pop 43) |
| ej_screen_index | 3144 | 3144 | 324/324 (100%) | 36/36 (100%) | 48301 (pop 43) |
| food_insecurity_pct | 3144 | 3137 | 324/324 (100%) | 36/36 (100%) | 48301 (pop 43) |
| hospital_closure_since_2010 | 3144 | 3144 | 324/324 (100%) | 36/36 (100%) | 48301 (pop 43) |
| hpsa_dental_score | 3144 | 3144 | 324/324 (100%) | 36/36 (100%) | 48301 (pop 43) |
| hpsa_mental_health_score | 3144 | 3144 | 324/324 (100%) | 36/36 (100%) | 48301 (pop 43) |
| hpsa_primary_care_score | 3144 | 3144 | 324/324 (100%) | 36/36 (100%) | 48301 (pop 43) |
| mental_health_providers_per_100k | 3144 | 2966 | 199/324 (61%) | 36/36 (100%) | 48301 (pop 43) |
| ob_providers_per_10k | 3144 | 3142 | 324/324 (100%) | 36/36 (100%) | 48301 (pop 43) |
| ob_unit_presence | 3144 | 3144 | 324/324 (100%) | 36/36 (100%) | 48301 (pop 43) |
| physical_inactivity_pct | 3144 | 3137 | 324/324 (100%) | 36/36 (100%) | 48301 (pop 43) |
| primary_care_physicians_per_100k | 3144 | 2985 | 240/324 (74%) | 36/36 (100%) | 48301 (pop 43) |
| severe_housing_problems_pct | 3144 | 3137 | 324/324 (100%) | 36/36 (100%) | 48301 (pop 43) |
| svi_housing_transport | 3144 | 3144 | 324/324 (100%) | 36/36 (100%) | 48301 (pop 43) |
| svi_minority | 3144 | 3144 | 324/324 (100%) | 36/36 (100%) | 48301 (pop 43) |
| svi_overall | 3144 | 3144 | 324/324 (100%) | 36/36 (100%) | 48301 (pop 43) |

## Bottom metrics by share-of-small-counties-with-values

| Slug | Total | Avail (all) | Pop<5k avail | Pop<1k avail |
|---|---|---|---|---|
| teen_births_per_1000 | 3144 | 2908 | 131/324 (40%) | 0/36 (0%) |
| suicide_rate_per_100k | 3144 | 2446 | 8/324 (2%) | 0/36 (0%) |
| reading_scores_grade_level | 3144 | 2591 | 175/324 (54%) | 0/36 (0%) |
| low_birth_weight_pct | 3144 | 3042 | 225/324 (69%) | 0/36 (0%) |
| life_expectancy | 3144 | 3067 | 250/324 (77%) | 0/36 (0%) |
| infant_mortality_per_1000 | 3144 | 1179 | 0/324 (0%) | 0/36 (0%) |
| high_school_graduation_pct | 3144 | 2496 | 18/324 (6%) | 0/36 (0%) |
| drug_overdose_deaths_per_100k | 3144 | 2003 | 4/324 (1%) | 0/36 (0%) |
| disconnected_youth_pct | 3144 | 1146 | 6/324 (2%) | 0/36 (0%) |
| no_vehicle_rate | 3144 | 2668 | 83/324 (26%) | 5/36 (14%) |

## Findings & recommendations

- **MOE-aware ACS suppression is now active** (Phase 1h, May 2026). All ACS-direct ingests (B25034 / B25044 / S1601 / B17001) and the SAHIE/SAIPE timeseries APIs pull `*_M` (or `_LB90`/`_UB90` for SAHIE) and suppress counties where 90% MOE/estimate > 0.5. Counties filtered by source: lead_exposure ~55, no_vehicle ~476, lep ~1144, child_uninsured ~4, youth_under5_poverty ~1197. SAIPE all-ages and child poverty: 0 (model-based, tight CIs).
- NCHS-derived rate metrics (infant mortality, premature death) are appropriately suppressed by source for low-count counties. No action needed.
- CHR&R composite metrics inherit suppression from underlying NCHS rules. Acceptable as-is.
- Behavioral health PLACES metrics use BRFSS small-area estimation and are smoothed across counties — small-county estimates are model-based, not direct, and that should be disclosed in the methods notes (already mentioned in PLACES ingest comments).

## Files

- `scripts/audit_small_county_suppression.ts` — this script
- `scripts/small_county_audit.md` — this report
