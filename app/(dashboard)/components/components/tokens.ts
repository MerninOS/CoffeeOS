/**
 * Layout constants specific to the /components worksheet.
 *
 * The type roles (`mono` / `overline` / `sans`) are NOT redefined here — they
 * come from `@/lib/instrument/tokens`, the shared module `/products` introduced
 * in CoffeeOS#69 and thirteen files now consume. The `/orders` tree still keeps
 * a per-directory copy from before that module existed; a third copy would be
 * strictly worse than importing the one that is already shared.
 *
 * What stays local is the thing that is genuinely about this screen: its grid.
 */

/**
 * The worksheet's four tracks. Every group lands on these same columns — the
 * point of the conversion is that a packaging cost and an ingredient cost are
 * read against one ruler, where today each type group builds its own
 * `min-w-[560px]` grid and the columns do not line up across groups. Rows are
 * `subgrid` children so the definition lives here, once.
 *
 * Every track is minmax(0, …) so a long component name cannot widen the cost
 * column. The cost track is fixed: tests/e2e/components-layout.spec.ts asserts
 * its geometry above 1400px, which neither baseline viewport (1280 / 375) sees —
 * that blind band is where /orders shipped an unreadable overlapping figure.
 */
export const GRID = "minmax(0,1.1fr) minmax(0,1.5fr) minmax(0,150px) 72px";
