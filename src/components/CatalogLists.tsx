import { BIKE_MODELS, CAR_MODELS, CITIES, type Kind } from "@/lib/catalog";

export const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
export const makeListId = (kind: Kind) => `cat-makes-${kind}`;
export const modelListId = (kind: Kind, make: string) => `cat-models-${kind}-${slugOf(make)}`;
export const CITY_LIST_ID = "cat-cities";

/**
 * <datalist>s for every brand, model and city. Inputs point at them with
 * `list=`, so people pick from the full catalogue but can still type a
 * brand or model that is not in it yet.
 */
export function CatalogLists({ kinds = ["car", "bike"] }: { kinds?: Kind[] }) {
  return (
    <>
      {kinds.map((kind) => {
        const book = kind === "bike" ? BIKE_MODELS : CAR_MODELS;
        return (
          <span key={kind} hidden>
            <datalist id={makeListId(kind)}>{Object.keys(book).sort().map((m) => <option key={m} value={m} />)}</datalist>
            {Object.entries(book).map(([make, models]) => (
              <datalist key={make} id={modelListId(kind, make)}>{models.map((m) => <option key={m} value={m} />)}</datalist>
            ))}
          </span>
        );
      })}
      <datalist id={CITY_LIST_ID}>{CITIES.map((c) => <option key={c} value={c} />)}</datalist>
    </>
  );
}
