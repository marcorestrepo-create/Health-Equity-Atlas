---
title: "The 10 Components of Health Equity: How We Measure It"
metaDescription: "How Pulse Atlas constructs its 10-component composite Health Equity Gap Score. Methodology, weights, data sources, sensitivity analysis, and limitations."
slug: "research/composite-score-methodology"
targetQueries: ["health equity composite score", "measuring health equity", "health equity index methodology"]
canonicalUrl: "https://www.thepulseatlas.com/research/composite-score-methodology"
ogImage: "/og/research/composite-score-methodology.png"
publishDate: "2026-07-02"
author: "Marco Restrepo, Partner, Chartis Group"
---

# The 10 Weighted Components of Health Equity: How We Measure What Matters

Composite indexes are both useful and dangerous. They are useful because they reduce multi-dimensional complexity to a communicable summary that supports comparison, prioritization, and decision-making. They are dangerous because the aggregation process embeds assumptions about relative importance — assumptions that can be obscured by the apparent authority of a numerical score. This piece makes those assumptions explicit, explains why Pulse Atlas made the choices it did, and identifies the conditions under which the composite score is most and least useful.

The technical documentation for the composite score is at [Pulse Atlas Methods](/methods). This article is designed to explain the methodology in terms relevant to practitioners — health system strategists, policy analysts, and funders — rather than to reproduce the full specification.

## Why Ten Components

Health equity is not a single phenomenon. A county can have adequate provider supply but catastrophic insurance coverage. Another can have decent coverage but extreme environmental burden. A third can score well on access measures but have chronic disease rates reflecting decades of food insecurity and poverty.

Any composite measure that collapses health equity to a single dimension — the uninsured rate, or the primary care physician-to-population ratio — will rank counties in misleading ways. The Pulse Atlas framework draws on the multi-domain structure established by [County Health Rankings & Roadmaps](https://www.countyhealthrankings.org/health-data/methodology-and-sources/data-documentation), [HRSA](https://data.hrsa.gov/), and [America's Health Rankings](https://www.americashealthrankings.org), adapting components and weights to reflect the analytical priorities most relevant to health system strategy and community investment. The ten components are each grounded in publicly available data sources with established validity.

## The Ten Components

### 1. Chronic Disease Burden (13%)

The largest single weight in the composite reflects the dual role chronic disease plays in health equity analysis: it is both an outcome (the product of prior structural disadvantage) and a driver of current care utilization and cost. [CDC PLACES county-level data](https://www.cdc.gov/places/index.html) provides small-area estimates for adult obesity, diabetes prevalence, hypertension, COPD, and coronary heart disease across all U.S. counties.

The chronic disease component is weighted most heavily because it is the domain where county-level variation is most predictive of long-term population health cost. [County Health Rankings research](https://pmc.ncbi.nlm.nih.gov/articles/PMC4415342/) demonstrates that premature mortality — the most important health outcome — is more strongly correlated with chronic disease burden than with any other single factor in the framework.

The specific diseases included are those where the [IHME Global Burden of Disease data](https://www.healthdata.org/research-analysis/gbd) confirms the highest burden in U.S. counties and where preventive intervention is most clearly effective: type 2 diabetes, hypertension, obesity, COPD, and cardiovascular disease. Mental health conditions are captured separately in the Behavioral Health component.

### 2. Social Vulnerability Gap (12%)

The Social Vulnerability Gap component draws from the [CDC Social Vulnerability Index](https://www.atsdr.cdc.gov/placeandhealth/svi/index.html), which aggregates 15 census variables across four themes: socioeconomic status (poverty, unemployment, income, education); household characteristics (disability, single-parent households, English proficiency, population age); racial and ethnic minority status; and housing type and transportation.

This component is weighted second highest because social determinants of health — the conditions in which people are born, grow, live, work, and age — have stronger aggregate effects on health outcomes than clinical care factors according to [County Health Rankings](https://www.countyhealthrankings.org/) and a substantial epidemiological literature. The "gap" framing is intentional: the score reflects the magnitude of social vulnerability relative to national norms, not the absolute level.

### 3. Provider Access (12%)

Provider access draws on [HRSA Bureau of Health Workforce data](https://data.hrsa.gov/topics/health-professional-shortage-areas/shortage-area) on primary care physicians, nurse practitioners, and physician assistants per 10,000 population, as well as Health Professional Shortage Area designation status. Provider access is weighted equally with social vulnerability because the two interact: social disadvantage leads to poor health outcomes most powerfully when provider access is simultaneously limited. The Pulse Atlas score uses HPSA status as a modifier to the raw provider ratio to partially account for the known limitation that provider count per capita overstates effective access where providers do not accept Medicaid.

### 4. Insurance Gap (11%)

The insurance gap component measures the percentage of the under-65 population without health insurance, sourced from [Census Bureau SAHIE](https://www.census.gov/programs-surveys/sahie.html) and [ACS 5-year estimates](https://www.census.gov/programs-surveys/acs). The "gap" is calculated relative to a national benchmark adjusted for state Medicaid expansion status, so that a county in a non-expansion state is not penalized for a policy choice made at the state level — the gap reflects the county's performance given its policy environment.

At 11%, this component is weighted below chronic disease and social vulnerability but still substantially. Insurance coverage is a necessary but insufficient condition for access to care: a county can have high coverage but inadequate providers, or high coverage with providers who do not accept the payer mix. This limits the insurance gap component's predictive power as a standalone measure, which is why it is embedded in a multi-component composite rather than used alone.

### 5. Maternal Access (11%)

Maternal access draws from the [March of Dimes county classification system](https://www.marchofdimes.org/peristats/data?top=23) and the [HRSA Maternity Care Target Area index](https://data.hrsa.gov/). Counties designated as maternity care deserts receive maximum gap scores on this component; counties with full access receive near-zero scores.

The equal weighting of maternal access and insurance gap (both 11%) reflects a judgment that obstetric care availability is as structurally determinative as overall insurance coverage for the women and families most affected. The concentration of maternity care deserts in specific states and county types — documented in the [Pulse Atlas maternity care deserts analysis](/research/maternity-care-deserts-2026) — means this component drives composite scores upward in the rural Midwest and Plains in ways that other components may not.

### 6. Perinatal Outcomes (10%)

While the maternal access component measures structural access, perinatal outcomes measures what actually happens: preterm birth rates, low birth weight rates, infant mortality rates, and neonatal intensive care admission rates. Data sources include [CDC NCHS vital statistics](https://www.cdc.gov/nchs/index.htm), [March of Dimes PeriStats](https://www.marchofdimes.org/peristats), and state vital records.

The distinction between access (input) and outcomes (output) is deliberate. A county can have moderate access deficits but still achieve reasonable perinatal outcomes if its population has strong insurance coverage and minimal poverty. Conversely, a county with technically adequate provider supply can have poor perinatal outcomes driven by systemic racism, poverty, and psychosocial stress — factors that access measures do not capture. Weighting both components at 10% allows the composite to reflect both dimensions.

### 7. Behavioral Health (10%)

Behavioral health — encompassing mental health disorders, substance use disorders, and the availability of treatment resources — has grown in its contribution to overall health burden substantially over the past decade. [CDC drug overdose data](https://www.cdc.gov/drugoverdose/data/index.html) and [County Health Rankings](https://www.countyhealthrankings.org/) data on mental health provider availability and poor mental health days inform this component.

The 10% weight reflects both the significance of the burden and the limitations of available county-level data. Mental health hospitalization and treatment utilization data is less complete at the county level than acute care data, and stigma-related underreporting affects self-reported measures. The component should be read as a floor, not a ceiling, of behavioral health disadvantage.

### 8. Child Poverty (8%)

Child poverty is distinct from general poverty as a health equity driver because the health effects of poverty are most severe and most durable when experienced in childhood. [ACS data on children below the poverty line](https://www.census.gov/programs-surveys/acs) by county informs this component. [County Health Rankings research](https://pmc.ncbi.nlm.nih.gov/articles/PMC8803257/) consistently documents that childhood poverty predicts worse adult health outcomes across virtually every domain. The 8% weight is lower than the social vulnerability gap component because child poverty is partially captured within the broader social vulnerability measure; retaining it separately preserves the signal for counties where child poverty is unusually high relative to overall poverty — a pattern common in tribal counties and high-cost metropolitan areas.

### 9. Environmental Burden (7%)

The environmental burden component draws from the [EPA EJScreen](https://www.epa.gov/ejscreen) environmental justice screening tool, aggregating pollution burden and population vulnerability indicators including air quality (PM2.5, ozone), water quality, proximity to Superfund sites, and traffic-related exposure. The 7% weight reflects growing evidence that environmental exposures contribute to chronic disease burden and perinatal outcomes, while acknowledging that the pathway is more distal and less well characterized at the county level than direct access measures.

### 10. Infrastructure (6%)

The infrastructure component — the smallest weight at 6% — measures broadband access, transportation reliability, and housing quality, drawing on [ACS housing data](https://www.census.gov/programs-surveys/acs) and [FCC broadband maps](https://broadbandmap.fcc.gov/). Infrastructure is an enabling condition rather than a direct health driver: its weight is modest, but in counties already scoring poorly on provider access and insurance, poor infrastructure amplifies disadvantage through the composite aggregation.

## Sensitivity Analysis in Plain English

How much do the weights matter? Substantially, but less than the component selection.

When Pulse Atlas analysts vary the weights by ±5 percentage points for each component while holding the others constant, the counties in the bottom decile of the composite score remain largely stable — the same 300–350 counties appear in the bottom 10% under almost every plausible weighting scheme because they score poorly across nearly every component simultaneously. Rank order within the bottom decile shifts, but the membership is robust.

The weight choices matter most for counties in the second and third deciles — those with moderate overall disadvantage but concentrated deficits in one or two domains. A county with severe insurance gaps but moderate scores on everything else will rank higher or lower depending on how much weight the insurance gap receives. These are the counties where alternative weighting schemes generate the most debate, and where component-level analysis is more informative than the composite score alone.

## When the Composite Misleads

The composite score is most useful when the goal is county-level triage: identifying which of 3,144 counties have the most severe cumulative disadvantage. It is least useful — and potentially actively misleading — in four situations:

**When the relevant question is program-specific.** A maternal health initiative should prioritize on the maternal access and perinatal outcomes components, not the composite. The composite score is not a proxy for any specific intervention's targeting criteria.

**When county boundaries are irrelevant.** Many health problems — referral networks, health system catchment areas, environmental plumes — do not map to county lines. The composite can mask within-county variation in large, heterogeneous counties, and it can miss cross-county dynamics in multi-county metropolitan areas.

**When the population unit matters.** The composite score is a population-average measure. A county with a large wealthy suburban population and a concentrated pocket of poverty can score moderately on the composite while having pockets of extreme disadvantage. The [CDC SVI](https://www.atsdr.cdc.gov/placeandhealth/svi/index.html) at the census tract level provides more granular data for sub-county targeting.

**When temporal dynamics matter.** The composite is a snapshot. Counties experiencing rapid demographic change — immigration, industrial collapse, population growth — may have composite scores that lag current conditions by 2–3 years given data vintage constraints.

For [Idaho County, ID](/county/16049) and [Comanche County, OK](/county/40031), these caveats matter: both counties have component profiles that differ substantially from their composite rank, and strategy built on the composite alone would miss the nuance. The [Pulse Atlas Methods](/methods) page documents data vintages and update schedules for each component source.

---

*Data sources: CDC PLACES, CDC Social Vulnerability Index, HRSA Bureau of Health Workforce, Census Bureau SAHIE and ACS, March of Dimes PeriStats, CDC NCHS Vital Statistics, EPA EJScreen, County Health Rankings 2025, IHME Global Burden of Disease.*
