# Flood Susceptibility Pipeline — Barpeta Build, Wayanad Second

## Scope

This plan covers the flood-susceptibility workflow from **Step 1 through Step 10**:

1. Define the pilot area
2. Query Sentinel-1 RTC scenes
3. Obtain Sentinel-1 VV/VH data
4. Generate water masks
5. Remove permanent water and flag flooded cropland
6. Build the multi-date water-mask stack
7. Calculate inundation frequency
8. Calculate HAND
9. Combine inundation frequency + HAND into a flood-susceptibility surface
10. Aggregate the resulting surface to H3 resolution 8

The plan follows the SETU-DRR PRD. The PRD defines flood susceptibility as **empirical, not
modelled**, using a Sentinel-1 SAR water-mask stack, inundation frequency, and HAND. It does
not prescribe a mathematical weighting for combining the two; that combination is an
implementation decision and is documented here.

The pipeline is **AOI-parameterised** (FR-2.3). A district is an input, not a hard-coded
assumption. The build AOI is **Barpeta, Assam**; the second run is **Wayanad, Kerala**.

---

## 0.1 Why Barpeta is the build district

This is the one decision in the plan that is not reversible by editing a config file, so it
is stated first.

Inundation frequency measures **standing water at the moment of a satellite overpass**. It
can only see floods that persist longer than the revisit interval. Measured from the
INDOFLOODS gauge catalogue and the live MSPC scene inventory:

| | Wayanad | Barpeta |
|---|---|---|
| Hydrological regime | Plateau, 700–2,100 m, flash flood | Brahmaputra floodplain, riverine |
| Median flood-event duration | **1.5 days** | Multi-day to multi-week |
| Flood-day duty cycle, 2015–2020 | **2.3%** (51 of 2,191 days) | **6.3%** at the nearest floodplain gauges |
| RTC scenes, 2015–2020 | 355 | **869** |
| Expected acquisitions on a flood day | **~8** | **~55** |
| RTC scenes, 2015–2025 | 632 | **1,697** |
| Usable tracks | 2 descending | 4 (2 asc, 2 desc) |

A ~7× difference in observation opportunity. Built on Wayanad first, `F(x,y)` would be
near-zero across most of the district and the non-zero remainder would be dominated by
flooded paddy in the Kabini valley — a plausible-looking map with no way to distinguish a
working detection threshold from a broken one. Built on Barpeta, the surface is legible and
wrong answers are visible.

The Barpeta duty cycle is a **lower bound**: INDOFLOODS releases no gauges in Assam at all
(the Ganga-basin restriction, PRD §8.6), so 6.3% comes from the nearest floodplain analogues
on the Teesta and Torsa, ~250 km west. Actual Brahmaputra mainstem inundation persists
longer. Barpeta's own event history comes from India Flood Inventory v3, not from gauges.

Nothing about the Wayanad demo narrative is lost: Wayanad's headline hazard in PRD §9.4 is
landslide, and its 4,728 Kerala-2018 points still make it the primary landslide district.

## 0.2 Verified Day-0 facts

Checked 2026-08-31. Do not re-probe; PRD §8.2a records the same results.

- MSPC STAC endpoint live; `sentinel-1-rtc` collection licensed **CC BY 4.0**.
- `GET /api/sas/v1/token/sentinel-1-rtc` issues an **anonymous** SAS token, ~1 hour expiry.
  No subscription key, no login.
- Unsigned asset reads return **HTTP 409**. Assets must be signed; refresh on expiry.
- Signed reads return 200, and range requests return 206 with a valid COG header — windowed
  reads work, which is what makes this tractable.
- Assets are **~1.9 GB per band per full swath**. Barpeta's bbox is a small fraction of a
  scene, but a naive native-resolution windowed read still costs ~100 MB/band/scene.
- Barpeta polarisation is **not** homogeneous: 1,583 dual-pol VV+VH and **114 VV-only**.

## 0.3 Target outcome

```text
Sentinel-1 RTC scenes  (one track, consistent polarisation)
        ↓
VV / VH backscatter, overview level, speckle-filtered
        ↓
Shadow / layover / steep-slope exclusion
        ↓
Water masks for each date
        ↓
Permanent-water removal  +  cropland flagging
        ↓
Multi-date inundation stack  +  valid-observation stack
        ↓
Inundation frequency
        +
Copernicus DEM GLO-30 → HAND
        ↓
Hard zero where HAND > 30 m or slope > 15°   (FR-3.17)
        ↓
Flood susceptibility raster + confidence
        ↓
H3 resolution 8
        ↓
hazard_static rows, hazard_type = 'riverine_flood'   (FR-3.16)
```

The output is a **susceptibility score**, not a flood probability and not a hydrodynamic
simulation.

---

# Step 1 — Define the Pilot Area

## Objective

Create the exact spatial boundaries used for every downstream operation.

### Inputs

- District boundary (build AOI: **Barpeta, Assam**)
- LGD administrative code
- CRS appropriate for raster processing

### Three AOIs, not two

The original plan distinguished a reporting AOI from a processing AOI. HAND needs a third,
and conflating it with the second is a correctness bug rather than a tidiness issue.

| AOI | Definition | Used by |
|---|---|---|
| **Reporting** | The district polygon exactly | H3 polyfill, all published output |
| **SAR processing** | District + ~5 km buffer | Scene clipping, edge effects |
| **Hydrological** | The **full upstream contributing area** of every stream entering the district, clipped to basin — *not* a fixed-km buffer | Flow accumulation, drainage extraction, HAND |

Flow accumulation truncated at an arbitrary buffer edge produces a wrong drainage network
and therefore wrong HAND everywhere downstream of the cut. Barpeta receives the Brahmaputra
and the Beki/Manas from outside the district, so a 5 km buffer would misplace the drainage
reference for most of the district. Derive the hydrological AOI from a coarse DEM
pre-pass or an existing basin polygon, and record its area.

### Tasks

1. Obtain the authoritative district polygon (geoBoundaries / DataMeet — note the Git LFS
   trap in PRD §8.7; use `/raw/<commit-sha>/` media URLs).
2. Validate geometry — no self-intersections, no unexpected multipart artifacts.
3. Store in a canonical local format, GeoPackage preferred.
4. Derive the three AOIs above and store each separately.
5. Record the LGD code on the reporting AOI. It is the join key for everything downstream.

### Recommended structure

```text
data/raw/boundaries/barpeta.gpkg
data/interim/aoi/barpeta_reporting.gpkg
data/interim/aoi/barpeta_sar_processing.gpkg
data/interim/aoi/barpeta_hydrological.gpkg
```

### Validation

- Plot each boundary on a basemap; confirm identity and containment order.
- Confirm CRS and units on each.
- Record area in km² for all three.

---

# Step 2 — Query Sentinel-1 RTC Scenes

## Objective

Build a scene inventory covering multiple monsoon seasons, on a **single consistent
acquisition geometry**.

### Tools

`pystac-client`, `planetary-computer`, `stackstac` / `odc-stac` downstream.

### Track selection — decide before downloading anything

Available over Barpeta (2015–2025):

| Relative orbit | Pass | Scenes |
|---|---|---|
| 41 | ascending | 543 |
| 150 | descending | 539 |
| 114 | ascending | 328 |
| 77 | descending | 287 |

**Pick one track and hold it for the whole stack.** Backscatter depends on incidence angle
and look direction; a threshold calibrated on one geometry does not transfer to another, and
mixing tracks silently changes the detection rule mid-series. Orbit 41 or 150 gives ~540
scenes over eleven years — far more than needed.

Apply the same rule to polarisation. 114 Barpeta scenes are VV-only; either restrict the
stack to dual-pol dates or commit to VV-only throughout. Do not mix.

### Query requirements

Filter on: spatial intersection with the SAR processing AOI · `sentinel-1-rtc` collection ·
acquisition date · `sat:relative_orbit` · `sat:orbit_state` · `sar:polarizations`.

Cloud cover is not a SAR selection criterion.

### Time period

Start with **monsoon months (JJAS) across 2016–2024** on the chosen track. That is roughly
120–140 scenes at Barpeta — enough for a stable frequency estimate without a week of
downloading. Do not attempt a pan-India or all-season exhaustive pull.

Retain the full-year inventory in the parquet even if only monsoon dates are processed; the
seasonal composition of the denominator is a documented parameter, not an accident of what
was downloaded.

### Scene inventory

```text
scene_id · acquisition_time · relative_orbit · orbit_state · polarizations
bbox · stac_url · asset_urls · selected_for_stack (bool) · selection_reason
```

Cache the raw STAC response to object storage before parsing (FR-1.2).

### Validation

1. Open a sample STAC item; confirm VV/VH assets exist.
2. Confirm assets intersect the SAR processing AOI.
3. Confirm the track and polarisation filter actually held — count by
   `(relative_orbit, orbit_state, polarizations)` and assert a single group.
4. Render one `rendered_preview` asset before bulk processing.

### Output

```text
data/interim/sentinel1/barpeta_scene_inventory.parquet
```

---

# Step 3 — Obtain Sentinel-1 VV/VH Data

## Objective

Read the backscatter required for water detection, at a resolution the rest of the pipeline
can actually afford.

### Read an overview, not the full COG

Full assets are ~1.9 GB per band. An H3 res-8 cell is 0.74 km², which at **20 m** (overview
level 1) still contains ~1,850 pixels — ample for a zonal mean. Reading native 10 m multiplies
transfer by four for no gain at the output resolution.

Rough transfer budget, one track, VV only, ~130 monsoon scenes: **~3.5 GB at 20 m**, versus
~14 GB at native resolution. Decide this before Milestone B, not after.

### Preferred workflow

```text
STAC item → sign with SAS → asset selection → windowed COG read at overview level
          → clip to SAR processing AOI → speckle filter → VV / VH raster
```

Use STAC metadata to locate assets. Never hard-code blob URLs — they require a fresh
signature and the token expires in about an hour. Sign per session and handle expiry
mid-run; a long stack build **will** cross a token boundary.

### Preprocessing, per scene

1. Read VV (and VH where the chosen configuration includes it).
2. Clip to the SAR processing AOI.
3. **Handle nodata explicitly.** Confirm how RTC encodes invalid pixels — if it is `0`
   rather than a nodata flag, every downstream "valid non-water" count is wrong and
   Step 4.3's careful handling silently fails. Check this once, on a real scene, and record
   the answer.
4. Convert to a consistent representation — decide dB or linear power and hold it. Thresholds
   are not transferable between the two.
5. **Apply a speckle filter** — refined Lee, or a 3×3 median as the cheap version. Per-pixel
   thresholding of unfiltered GRD produces salt-and-pepper masks, and the noise lands
   preferentially in the low-frequency range that matters most here.
6. Confirm spatial alignment across dates; preserve acquisition timestamp and scene id.

### Important distinction

RTC is already **radiometrically** terrain corrected. It is not geometrically free of
shadow and layover — see Step 4.2. The PRD chooses this collection to avoid rebuilding the
GRD → calibrate → terrain-correct chain, not to avoid terrain effects entirely.

### Validation

Inspect VV and VH histograms, spatial coverage, nodata extent, raster transform and CRS, and
VV/VH alignment for several scenes. A bimodal VV histogram over a floodplain in flood season
is the signal Step 4 depends on; if it is unimodal everywhere, stop and diagnose before
building the stack.

### Output

```text
data/interim/sentinel1/barpeta/<date>_vv.tif
data/interim/sentinel1/barpeta/<date>_vh.tif
```

---

# Step 4 — Generate a Water Mask for Each Scene

## Objective

Convert each acquisition into a binary estimate of surface water.

## 4.1 Threshold as a calibrated parameter, not a constant

Low backscatter indicates smooth open water, but no single global threshold is correct
across land cover, season and terrain.

```text
water_mask = detect_water(VV, VH, parameters)
```

Prefer a **per-scene adaptive threshold** — Otsu over a tiled histogram, keeping only tiles
that are genuinely bimodal — over one hard-coded number for the whole stack. Atmospheric and
seasonal drift in backscatter otherwise appears as a spurious trend in inundation frequency.

## 4.2 Exclude what cannot be measured, before thresholding

**Radar shadow is spectrally indistinguishable from open water.** Both are dark. In terrain
with relief, shadow sits systematically on slopes adjacent to valleys — precisely where a
reader will interpret it as flooding. This matters less at Barpeta than at Wayanad, but the
mask must exist before the pipeline moves.

Minimum viable treatment, using the slope raster from Step 8:

```text
exclude where slope > 15°
exclude where the scene's own nodata / invalid flag is set
```

Better, if time allows: compute local incidence angle from GLO-30 and the orbit geometry and
derive an explicit layover-shadow mask. Record which of the two was used.

## 4.3 Three states, never two

```text
0      = valid non-water
1      = valid water
nodata = invalid observation (shadow, layover, off-swath, sensor nodata, excluded slope)
```

A missing observation must never become a non-water observation. This distinction is the
whole basis of Step 7's denominator.

## 4.4 Choose the simplest rule that survives scoring

Test VV-only, VH-only, and a combined rule. Do not assume the most complicated rule wins.

## 4.5 Score the rule quantitatively (ML-6, M-7)

Visual inspection selects candidate rules; it does not validate them. Score the chosen rule
against the **Sen1Floods11 hand-labelled India chips** (PRD §8.3 — 68 hand-labelled) and
report **precision and recall**. This is the cheapest real metric available anywhere in the
flood pipeline and it converts Step 4 from a judgement call into a number.

Then inspect visually over rivers, reservoirs, ponds, paddy, built-up areas, vegetated
terrain and known flood dates — to find failure *modes*, not to establish correctness.

### Output

```text
data/interim/flood/barpeta/masks/<date>_water_mask.tif
data/interim/flood/barpeta/water_rule_scorecard.json   # precision, recall, threshold, rule
```

---

# Step 5 — Remove Permanent Water, Flag Flooded Cropland

## Objective

Separate persistent water and seasonally flooded agriculture from genuine temporary
inundation.

### 5.1 Permanent water — JRC

```text
Sentinel-1 water mask  MINUS  JRC Global Surface Water permanent  =  candidate inundation
```

1. Obtain JRC Global Surface Water v1.4 (PRD Tier A, direct GCS tiles).
2. Reproject/resample to the Sentinel-1 processing grid.
3. Define the permanent-water mask (record the occurrence threshold used).
4. Per date: `if permanent_water: flood_water = 0 else: flood_water = sentinel_water`.
5. Preserve nodata separately — permanent water is a known non-flood, not a missing
   observation.

Without this, a reservoir detected as water every pass becomes a maximum-susceptibility
region.

### 5.2 Flooded cropland — WorldCover

JRC does not remove **flooded paddy**, which reads as open water in SAR for weeks each
season and is not flood hazard. Both pilot districts are full of it — the Kabini valley in
Wayanad, the Brahmaputra floodplain in Barpeta.

Use **ESA WorldCover v200** cropland (already in the Tier A stack, no new dependency) to
produce a `cropland_fraction` layer at the processing grid. Then choose deliberately, and
record the choice:

- **Flag** — keep cropland pixels in `F` but carry `cropland_fraction` alongside so the
  dossier can qualify the score. Preferred; paddy flooding and floodplain flooding genuinely
  overlap and hard removal deletes real hazard.
- **Mask** — zero them outright. Only if inspection shows the frequency layer is being
  driven by agriculture.

Do not make this decision implicitly by skipping the step.

### Validation

Overlay the S1 water mask, JRC permanent water, WorldCover cropland and the resulting
inundation mask over several known water bodies and paddy tracts.

### Output

```text
data/interim/flood/barpeta/inundation/<date>_inundation_mask.tif
data/interim/flood/barpeta/cropland_fraction.tif
```

---

# Step 6 — Build the Multi-Date Stack

## Objective

Assemble the time series, with its validity mask.

Align every raster to identical CRS, pixel size, extent, transform and dimensions.

### Two stacks, not one

```text
W_i(x,y)  observed inundation      1 = water, 0 = valid non-water
V_i(x,y)  valid observation        1 = valid,  0 = nodata/excluded
```

A missing Sentinel-1 observation must not be counted as a non-flood observation. Keeping
`V` as a first-class array is what makes Step 7 correct.

### Storage

```text
data/interim/flood/barpeta/inundation_stack.zarr
```

with the acquisition index retained: `observation_id · timestamp · source_scene_id ·
relative_orbit · polarization`.

### Validation

Extract the time series for several hand-picked pixels — a known channel, a paddy plot, a
ridge, a settlement — and read it as a table:

```text
date        water  valid
2019-06-10    0      1
2019-06-22    0      1
2019-07-04    1      1
2019-07-16    1      1
2019-07-28    -      0
```

Confirm dates, ordering and mask alignment before computing anything from it.

---

# Step 7 — Calculate Inundation Frequency

## Objective

How often each pixel was observed inundated, **among valid observations only**.

$$F(x,y)=\frac{\sum_i W_i(x,y)}{\sum_i V_i(x,y)}$$

Never divide by the number of downloaded scenes.

### Minimum valid observations

A pixel with `F = 0.5` from 4 observations is not comparable to one with `F = 0.5` from 100.
Set and record a floor — **`n_valid ≥ 20`** is a reasonable start for a ~130-scene monsoon
stack. Below it, emit `F` but mark the pixel low-confidence rather than dropping it silently.

### Output

```text
inundation_frequency.tif
valid_observation_count.tif
water_detection_count.tif
```

Interpretation: `0.00` never observed inundated · `0.10` inundated in ~10% of valid
observations · `1.00` inundated in every valid observation.

---

# Step 8 — Calculate HAND

## Objective

Height Above Nearest Drainage from Copernicus DEM GLO-30, over the **hydrological AOI** from
Step 1 — not the SAR processing AOI.

```text
low HAND → closer in elevation to drainage → more susceptible to riverine inundation
```

## 8.1 Obtain the DEM

Copernicus DEM GLO-30, `s3://copernicus-dem-30m`. Sync with `--include "*_DEM.tif"` or you
download roughly double what you need (PRD §8.7).

## 8.2 Condition and derive

```text
DEM → hydrologically conditioned DEM → flow direction → flow accumulation
    → drainage network → HAND
```

Record the conditioning method. Different depression-filling and breaching choices produce
materially different drainage networks, and therefore different HAND, and therefore a
different hazard map.

Watch memory: depression filling over a full contributing basin at 1 arc-second is the step
most likely to exhaust a laptop. Tile it or run on a coarsened DEM and refine locally.

## 8.3 Extract drainage

The flow-accumulation threshold defining a drainage cell is a **first-class parameter**. Do
not bury it. Record:

```text
flow_accumulation_threshold · DEM version · DEM preprocessing method · HAND algorithm/version
```

## 8.4 Compute HAND

$$HAND = Elevation(cell) - Elevation(nearest\ drainage)$$

Also emit **slope** here — Step 4.2 and Step 9.1 both need it, and deriving it twice invites
two different answers.

### Output

```text
hand.tif · slope.tif · drainage_network.gpkg · flow_accumulation.tif
```

### Validation

River and valley floors → low HAND. Hills and ridges → high HAND. Inspect all four cases
explicitly; an inverted or flat HAND surface is usually a conditioning failure, not a subtle
one.

---

# Step 9 — Combine Inundation Frequency + HAND

## Objective

Produce the empirical flood-susceptibility raster and its confidence layer.

### 9.1 Hard zero first (FR-3.17)

**Before any normalisation:**

```text
S_flood = 0  where  HAND > 30 m  OR  slope > 15°
```

Min–max normalised HAND otherwise gives a ridge top a susceptibility around 0.1–0.3, which
FR-3.2 then amplifies by `(1 + β·T)` on every monsoon trigger, lighting the entire district
during rainfall. FR-3.3 guarantees zeros survive the trigger; this rule is what creates the
zeros in the first place. Both thresholds are recorded parameters, not constants in code.

### 9.2 Normalise HAND

$$H_{hand}=1-N(HAND)$$

over the non-zeroed domain. Document the normalisation — percentile-based, min–max over
AOI, or a domain-threshold transform. Percentile-based is the more defensible default because
it is not hostage to a single outlier cell. Do not choose by which produces the prettiest map.

### 9.3 Combine

The PRD requires inundation frequency + HAND and prescribes no formula, so this is an
explicit, documented implementation choice:

$$S_f = w_F F + w_H H_{hand}, \qquad w_F + w_H = 1$$

| AOI | Weights | Reason |
|---|---|---|
| **Barpeta** (build) | `w_F = 0.5, w_H = 0.5` | Baseline. ~55 flood-day acquisitions — `F` carries real signal |
| **Wayanad** (second run) | `w_F = 0.2, w_H = 0.8` | ~8 flood-day acquisitions. Weighting a four-observation frequency at 50% asserts precision that does not exist |

Neither pair is PRD-mandated. Both are recorded in the config and in the model card.

### 9.4 Confidence — define it, do not gesture at it

`hazard_static.confidence` is required by PRD §9.5 and NFR-9 hatches on it, so it needs a
formula rather than a list of inputs:

```text
confidence = min(1, n_valid / 30) × valid_pixel_fraction
```

Carry `inundation_frequency`, `valid_observation_count`, `HAND` and `cropland_fraction`
through as supporting variables so the dossier can explain a low score.

### 9.5 Validate against something, not everything

Qualitative checks — high susceptibility near river corridors, not on hills; permanent water
excluded; sensible in known flood-prone locations — are necessary but are not the validation.

The quantitative checks, in priority order:

1. **Water-rule scorecard** from Step 4.5 (precision/recall on Sen1Floods11 chips).
2. **Known-event corroboration.** Pick a documented flood, pull the bracketing acquisitions,
   confirm the inundation mask responds. At Wayanad the August 2018 Kerala flood is the
   natural test and also the honest illustration of the limit: INDOFLOODS logs Kuttyadi's
   severe event as 2018-08-14 → 08-16, and the available passes are 08-09 (five days early),
   **08-14** (onset, orbit 63) and 08-21 (five days late). One usable observation of the
   largest Kerala flood in a century.
3. **Catchment-level rank correlation.** INDOFLOODS event frequency per catchment against
   mean inundation frequency, as an independent directional check. Not a per-pixel label.

### 9.6 Do not call it probability

Name it `flood_susceptibility`. Not `flood_probability`, absent a separate probabilistic
calibration.

### Output

```text
flood_susceptibility.tif · confidence.tif · metadata.yaml
```

`metadata.yaml` carries: `sentinel1_collection · relative_orbit · polarization ·
observation_period · seasonal_filter · overview_level · speckle_filter ·
water_detection_method · water_detection_threshold · water_rule_precision ·
water_rule_recall · shadow_layover_treatment · permanent_water_source ·
cropland_treatment · min_valid_observations · hand_dem · hand_method · hand_parameters ·
flow_accumulation_threshold · hard_zero_hand_m · hard_zero_slope_deg · hand_normalization ·
frequency_formula · combination_formula · weights · confidence_formula · model_version ·
licences_and_attribution`

---

# Step 10 — Aggregate to H3 Resolution 8 and Load

## Objective

Move the raster onto the platform's common grid and into Postgres. Step 10 is not complete
when a parquet exists; it is complete when the layer renders from the database.

## 10.1 Generate cells

Polyfill the **reporting** AOI at H3 res 8. Store indices as `BIGINT` (FR-2.4), never text.

## 10.2 Zonal statistics

Per cell, at minimum:

```text
mean_flood_susceptibility · max_flood_susceptibility · mean_inundation_frequency
mean_HAND · min_HAND · mean_confidence · valid_pixel_fraction · mean_cropland_fraction
```

Primary value: **mean** susceptibility, with max retained for inspection. Mean is the
defensible default at res 8 — a 0.74 km² cell taking the max would let a single channel
pixel classify a whole settlement.

## 10.3 Quality control

Cells below the recorded `valid_pixel_fraction` threshold are marked low-confidence, not
silently valued. Record the threshold as a pipeline parameter.

## 10.4 Write `hazard_static`

```text
h3             = <BIGINT H3 index>
hazard_type    = 'riverine_flood'          -- FR-3.16, never 'flash_flood'
susceptibility = 0.73
confidence     = 0.91
model_version  = 'flood-susceptibility-v0.1'
```

**`hazard_type` is `riverine_flood`.** Inundation frequency plus HAND measures standing
water and floodplain position. Writing it as `flash_flood` applies FR-3.5's weight of 1.0
instead of 0.8, and corrupts `dominant_hazard` in FR-3.7 — which propagates into zone class,
triage tier and every priority score a District Magistrate sees. Flash-flood susceptibility
comes from the I–D threshold path (FR-4.2/FR-4.8), not from this pipeline.

## 10.5 Final validation

1. Render the H3 layer from Postgres, not from the parquet.
2. Compare against the inundation-frequency raster, HAND, major rivers, JRC permanent water
   and known historical flood locations.
3. Inspect individual high- and low-scoring cells.
4. Confirm no permanent-water region dominates.
5. Confirm values stay in `[0, 1]` and that hard-zeroed cells are actually 0.
6. Confirm H3 coverage spans the reporting AOI with no holes.

### Final output

```text
data/processed/flood/barpeta/
├── flood_susceptibility_h3_res8.parquet
├── flood_susceptibility.tif
├── confidence.tif
├── inundation_frequency.tif
├── hand.tif
├── slope.tif
├── water_rule_scorecard.json
└── metadata.yaml
```

plus rows in `hazard_static` and the attribution strings carried into the manifest
(FR-1.5, NFR-8): Copernicus Sentinel data, MSPC RTC (CC BY 4.0), JRC GSW, ESA WorldCover
(CC BY 4.0), Copernicus DEM.

---

# Implementation Order

Do not implement everything at once.

| Milestone | Deliverable | Timebox |
|---|---|---|
| **A** | STAC → one signed scene → VV → speckle filter → one water mask | 2 h |
| **B** | 10 scenes → masks → permanent water + cropland → stack → frequency | 3 h |
| **B+** | Water-rule scorecard against Sen1Floods11 chips (Step 4.5) | 1.5 h |
| **C** | GLO-30 → conditioned DEM → drainage → HAND + slope, visually validated | 3 h |
| **D** | Hard zero → normalise → combine → susceptibility + confidence | 2 h |
| **E** | H3 res-8 zonal stats → `hazard_static` rows → renders from Postgres | 2 h |
| **F** | Rerun the whole pipeline over Wayanad with `w_F = 0.2` | 1 h |

Milestone F is one hour because the pipeline is AOI-parameterised. That is the entire
argument for building on Barpeta: the second district is a config change.

### Timebox warning

PRD Day 3 carries the landslide XGBoost with spatial block CV *and* this flood layer *and*
the first `MHI_static`. This plan at full fidelity is ~2.5–3 focused days. To fit inside
Day 3, take: one orbit track, VV only, JJAS months only (~130 scenes), 20 m overview, and
skip the VV/VH comparison in Step 4.4. Milestones A–C are the ones that must land; D and E
are an afternoon once C works.

---

# Decisions That Must Be Recorded

Configuration, not buried constants.

1. Build AOI and run order (Barpeta → Wayanad)
2. Three AOIs and the hydrological AOI derivation
3. Sentinel-1 RTC collection and STAC catalogue
4. **Relative orbit and pass direction**
5. Polarisation configuration and how VV-only scenes were handled
6. Observation date range and seasonal filter
7. Overview level / working resolution
8. Speckle filter and parameters
9. Water-detection rule and threshold, global or per-scene adaptive
10. **Water-rule precision and recall on Sen1Floods11**
11. Shadow/layover treatment and slope exclusion angle
12. Permanent-water definition and occurrence threshold
13. Cropland treatment — flagged or masked
14. Minimum valid observations
15. HAND drainage extraction threshold, DEM conditioning method
16. **Hard-zero thresholds (HAND m, slope °)**
17. HAND normalisation method
18. Frequency/HAND combination formula and weights, per AOI
19. Confidence formula
20. H3 zonal-statistics method and minimum valid raster coverage
21. `hazard_type` written and why
22. Dataset licences and attribution strings

---

# Success Criterion

The phase is complete when a fresh AOI can be passed to the pipeline and produce a
reproducible map in which:

- permanent water and flagged cropland are not read as flood susceptibility,
- radar shadow and steep slopes are excluded rather than detected as water,
- the water-detection rule has a **reported precision and recall**, not a visual endorsement,
- low-HAND areas receive greater terrain-based susceptibility and ridges receive **exactly
  zero**,
- historical inundation is reflected spatially where the satellite could observe it,
- sparse observation is expressed as low confidence and hatched rather than hidden,
- every H3 cell carries a traceable source and `model_version`,
- rows land in `hazard_static` as `riverine_flood` and render from Postgres,
- and rerunning it over a second district is a configuration change.
