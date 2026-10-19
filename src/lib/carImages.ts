/**
 * HD car image URLs from Unsplash for common Pakistani market makes.
 * Used as fallback when a listing has no uploaded photo.
 */

/** Map of make (lowercase) → Unsplash photo ID that shows that brand. */
const MAKE_PHOTO: Record<string, string> = {
  toyota:  "1568605116567-9a06b14c62e8",  // silver toyota sedan
  honda:   "1580274455191-1c62773470e8",  // silver honda
  suzuki:  "1609521263047-f8f205293f24",  // hatchback / suzuki style
  kia:     "1617886322168-72b886573c35",  // modern kia suv
  hyundai: "1619682817481-e994891cd1f5",  // hyundai
  changan: "1494976388531-d1058494cdd8",  // silver sedan on road
  mg:      "1533473359331-0135ef1b58bf",  // modern suv-style
  haval:   "1558618666-fcd25c85cd64",     // suv
  nissan:  "1544636331-e26879cd4d9b",     // nissan sedan
  daihatsu:"1609521263047-f8f205293f24",  // hatchback
  yamaha:  "1558618666-fcd25c85cd64",     // motorcycle
  united:  "1558618666-fcd25c85cd64",     // motorcycle
  road_prince: "1558618666-fcd25c85cd64",
};

/** Body type → Unsplash photo ID fallback. */
const BODY_PHOTO: Record<string, string> = {
  sedan:      "1568605116567-9a06b14c62e8",
  suv:        "1533473359331-0135ef1b58bf",
  hatchback:  "1609521263047-f8f205293f24",
  crossover:  "1617886322168-72b886573c35",
  pickup:     "1506703719100-a0f3a48c0f86",
  truck:      "1506703719100-a0f3a48c0f86",
  van:        "1544636331-e26879cd4d9b",
  motorcycle: "1558618666-fcd25c85cd64",
  bike:       "1558618666-fcd25c85cd64",
};

const DEFAULT_PHOTO = "1494976388531-d1058494cdd8";

/**
 * Returns a high-resolution Unsplash car photo URL for the given make/body type.
 * `w` and `q` control output size and quality.
 */
export function carImageUrl(make?: string, body?: string, w = 800, q = 80): string {
  const id =
    (make ? MAKE_PHOTO[make.toLowerCase().replace(/\s+/g, "_")] : undefined) ||
    (body ? BODY_PHOTO[body.toLowerCase()] : undefined) ||
    DEFAULT_PHOTO;
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=${q}`;
}
