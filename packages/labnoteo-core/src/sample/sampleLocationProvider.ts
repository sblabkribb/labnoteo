/**
 * Sample storage-location resolution seam.
 *
 * Today a sample's physical location is authored locally and lives on the
 * {@link SampleRecord.location} field. This interface exists so that source can
 * change without touching call sites: a future `PartbankLocationProvider`
 * (DNA/Plasmid/Primer → partbank Part → Stock → Storage) can be dropped in,
 * resolving the location over HTTP and falling back to the local field on a
 * miss or network error.
 *
 * Kept platform-neutral (no fetch/requestUrl here): a networked implementation
 * belongs in the host layer, which already owns the HTTP transport.
 */
import type { SampleRecord } from '../lib/sampleStorage';

/** What a provider needs to resolve a location. */
export interface SampleLocationQuery {
  /** Sample type, e.g. `DNA`, `Plasmid`, `Reagent`. */
  type: string;
  /** Sample id, e.g. `DNA-12`. */
  id: string;
  /** The loaded record, when available (carries the local `location` field). */
  record?: SampleRecord;
}

/** Resolves a sample's storage location, or `null` when unknown. */
export interface SampleLocationProvider {
  getLocation(query: SampleLocationQuery): Promise<string | null>;
}

/**
 * Default provider: returns the record's locally-authored `location` field.
 * This is the no-partbank path and the fallback a networked provider delegates
 * to when a lookup misses.
 */
export class LocalSampleLocationProvider implements SampleLocationProvider {
  async getLocation(query: SampleLocationQuery): Promise<string | null> {
    const loc = query.record?.location;
    return loc && loc.trim() ? loc : null;
  }
}
