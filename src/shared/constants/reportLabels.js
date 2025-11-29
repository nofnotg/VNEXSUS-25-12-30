// Centralized report UI labels and section titles
// Keep magic strings out of renderers (HTML/CSV/CLI)

export const REPORT_LABELS = {
  // Title and meta
  title_default: "Outpatient Episodes Case Comparison Summary",
  meta_generated_at: "Generated at:",

  // Sections
  section_aggregate: "Aggregate",
  section_top_groups: "Top Diagnostic Groups",
  section_exports: "Exports",
  section_summary_by_config: "Summary by File/Config",

  // Metrics in Aggregate card
  metric_cases: "Cases",
  metric_total_episodes: "Total Episodes",
  metric_total_records: "Total Records",
  metric_claims_within_window: "Claims Within Window",
  metric_disease_anchors: "Disease Anchors",
  metric_tests_within_timeframe: "Tests Within Timeframe",

  // Exports
  export_download_csv: "Download CSV",

  // Controls (pagination)
  controls_page_size: "Page size",
  controls_prev: "Prev",
  controls_next: "Next",
  controls_page_label: "Page",
  controls_rows_label: "Rows",
};

