/**
 * Normalizes known H4 heading aliases in unit operation sections.
 *
 * Kept in its own tiny, dependency-free module so the webview can import it
 * (for its sample-button rules) WITHOUT pulling the js-yaml-dependent
 * workflow parser into the browser bundle.
 */
export function normalizeWorkflowUnitSectionHeading(heading: string): string {
  if (heading === 'Reagen') return 'Reagent';
  // Pre-v0.54.8 templates emitted "Consumables"; we treat it as the new
  // "Labware and Consumables" so legacy notebooks parse to the same section.
  if (heading === 'Consumables') return 'Labware and Consumables';
  return heading;
}
