# Public Data

This folder keeps the public-source data files used to ground the example application.

## LA Park Needs

- Official source page: https://egis-lacounty.hub.arcgis.com/datasets/lacounty::l-a-county-park-needs-assessment-demographics/about
- Dashboard CSV supplied locally: `PNA_Demographics_for_Dashboard_(View_Layer_SDE)_-5491569836771984818.csv`
- Selected source columns for the LA example:
  - Bubble value: `Acres/1000`
  - X axis: `Median Household Income`
  - Y axis: `No High School Diploma Pct`
- Downloaded files:
  - `la_park_needs_study_areas.geojson`: full downloaded GeoJSON, 188 study areas.
  - `la_park_needs_study_areas.csv`: derived CSV with key columns, including `AC_PER_1K`.
  - `la_park_needs_feature_server_metadata.json`: FeatureServer metadata.
  - `la_park_needs_layer0_metadata.json`: layer metadata, including field definitions.
  - `la_park_needs_example_subset.csv`: 161-row trimmed display subset used by the static example page. It starts from valid positive, non-aggregate study areas with `Acres/1000`, `Median Household Income`, and `No High School Diploma Pct`; sorts ascending by `Acres/1000`; then drops the 10 smallest and 10 largest records.

## UNESCO Endangered Languages

- Official source record: https://unesdoc.unesco.org/ark:/48223/pf0000212034
- `187026eng.pdf`: user-downloaded official UNESCO Atlas PDF.
- `canada_aboriginal_language_families_subset.csv`: North America display subset from the Canada and Greenland chapter, printed pp. 114-115. It uses 2006 mother-tongue populations for selected Aboriginal language families/categories, from Wakashan family (1,200) to Algonquian family (152,000), giving an empirical ratio of about 127x. The `longitude` and `latitude` columns are representative Glottolog language points matched to each family/category label; they are not exact family distribution polygons.
- `canada_outline_natural_earth_110m.geojson`: Canada country outline extracted from Natural Earth Admin 0 Countries, 110m scale.
- Coordinate source: Glottolog `languages_and_dialects_geo.csv`.

## WID Wealth Inequality

- Official source page: https://wid.world/data/
- `wid_us_wealth_percentile_display_subset.csv`: 17 one-percentile U.S. 2024 bins from p30-p31 through p94-p95, selected from the WID country bulk file so all bubble values are positive and the display ratio stays near the bounded-bubbles regime.
- Selected source variables:
  - Bubble value: WID `ahwealj992`, exported as `average_net_worth_usd`
  - X axis: percentile midpoint, exported as `percentile_rank`
  - Y axis: WID `shwealj992`, exported as `wealth_share`; the app multiplies by 100 for percent display
- Display range: $11,958.70 to $1,645,863.70 average net worth, giving an empirical ratio of about 137.6x.

## OWID Climate Justice

- Official source repository: https://github.com/owid/co2-data
- `owid_climate_justice_display_subset.csv`: 18 country rows from 2022, the latest year in the downloaded OWID CO2 file where the selected country rows have GDP, population, energy per capita, and CO2 per capita.
- Selected source columns:
  - Bubble value: OWID `co2_per_capita`, exported as `per_capita_co2`
  - X axis: computed `gdp / population`, exported as `gdp_per_capita`
  - Y axis: OWID `energy_per_capita`
- Display range: Malawi at 0.088 metric tons CO2 per person to the United States at 14.802 metric tons CO2 per person, giving an empirical ratio of about 168.2x.
