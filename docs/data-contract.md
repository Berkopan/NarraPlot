# Data and project contract

The runtime definitions are `src/data/csv.ts` and `src/story/model.ts`.
This document explains their user-facing meaning; it is not a second schema.

## CSV input

The importer accepts a header row and at least one data row. The user explicitly
chooses comma, semicolon, or tab as the separator. Quoted cells, escaped quotation
marks, line endings, and a UTF-8 byte-order mark are handled by the CSV reader.
Headers must be unique and non-empty. Every row must contain the same number of
cells as the header row.

The alpha limits input to 200,000 characters and a mapped story to 1–12 rows.
It rejects excess rows instead of silently selecting a subset. A label and value
must come from different columns. Additional columns are not charted.

## Labels and numbers

Labels stay strings, including leading zeroes. Leading and trailing whitespace
is trimmed during mapping. Labels must be non-empty, unique, and at most 80
characters. Duplicate rows are not combined.

Only the selected value column is parsed. Decimal-dot and decimal-comma formats
are explicit choices. Grouping separators, currency symbols, and percent signs
are unsupported. Missing values are errors. Zero and negative values are valid;
negative zero is normalized to zero. Values must be finite. Nonzero magnitudes
must be between `1e-9` and `1e12` inclusive.

For a structurally valid table and valid column mapping, the importer checks all
numeric cells before applying data. It shows the first three numeric failures
with one-based data-row numbers, the mapped value-column header, a bounded raw
cell preview (120 characters maximum), and a reason; any remaining failures
are counted. Missing cells are labeled explicitly, and CSV cell text is shown
as text rather than interpreted as markup. A failed import never applies only
the valid rows. Correcting pasted cells keeps the chosen separator, number
format, column mapping, unit and source. The existing project is replaced only
after **Use this data** is confirmed.

Line charts preserve row order with equal spacing. A label that looks like a date
or a number is still a label. No time interval or continuous x-axis is inferred.

## Saved projects

A `.narraplot.json` file contains `schemaVersion: 1`, the data points, chart type,
theme, unit, source, and exactly three ordered scenes. The runtime validator checks
the supported values, text bounds, unique labels, highlights, and review flags.
Unknown fields are not carried into the application model. HTML or JavaScript in
text fields is rendered as text, not executed.

Project input is limited to 200,000 characters. Unsupported versions fail with an
error; they are not silently interpreted as version 1. A future schema change
must either provide a migration or clearly reject old formats.

## Data changes and annotations

Replacing data marks all scene annotations for review. An old highlighted label
that no longer exists is cleared. A scene cannot be exported until its annotation
has been confirmed; the complete HTML story requires all three scenes to be
confirmed. Saving an unreviewed project is allowed so unfinished work is not lost.

Confirmation means the user has reviewed the annotation. NarraPlot does not
fact-check the user's wording or automatically recompute narrative claims.
