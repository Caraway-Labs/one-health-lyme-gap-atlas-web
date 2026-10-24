/**
 * Official regional-center marks stored in /public.
 * Each file was downloaded from the center's own site. No separate
 * brand-usage page was published on those sites when these were saved.
 * Centers omitted here stay text-only.
 */
export type RegionalCenterLogo = {
  /** Intrinsic pixel size of the stored file. */
  height: number;
  /** Dense seals are painted slightly shorter inside the shared 48px slot. */
  optical: "standard" | "compact";
  src: string;
  /** Exact URL the file was taken from. */
  sourceUrl: string;
  width: number;
};

export const REGIONAL_CENTER_LOGOS: Record<string, RegionalCenterLogo> = {
  "gulf-south-vector": {
    height: 482,
    optical: "standard",
    src: "/resources/regional-centers/gulf-south-vector.png",
    sourceUrl:
      "https://vectoroutreach.org/wp-content/uploads/2024/07/cropped-GSV_Lockup_Color.png",
    width: 1137,
  },
  "midwest-center": {
    height: 67,
    optical: "standard",
    src: "/resources/regional-centers/midwest-center.png",
    sourceUrl:
      "https://mcevbd.wisc.edu/wp-content/uploads/sites/402/2022/08/MCE-Logo-Final-Web-Vector-1-1.png",
    width: 201,
  },
  nevbd: {
    height: 364,
    optical: "standard",
    src: "/resources/regional-centers/nevbd.png",
    sourceUrl: "https://www.neregionalvectorcenter.com/assets/img/nevbd.png",
    width: 436,
  },
  newvec: {
    height: 2500,
    optical: "compact",
    src: "/resources/regional-centers/newvec.webp",
    sourceUrl:
      "https://images.squarespace-cdn.com/content/v1/62a48cf7ab0cda28ec45e43f/da2134a8-5959-403a-95b0-fb82047a17b9/Logo+3.png",
    width: 2500,
  },
  pacvec: {
    height: 133,
    optical: "standard",
    src: "/resources/regional-centers/pacvec.png",
    sourceUrl:
      "https://pacvec.us/wp-content/uploads/2023/10/cropped-Colored-PacVec-Logo-Vector-400.png",
    width: 400,
  },
  rahpvec: {
    height: 1147,
    optical: "standard",
    src: "/resources/regional-centers/rahpvec.png",
    sourceUrl:
      "https://rahpvec.us/wp-content/uploads/sites/22/2023/12/RaHPVEC_transparent.png",
    width: 1920,
  },
  "southeastern-center": {
    height: 453,
    optical: "compact",
    src: "/resources/regional-centers/southeastern-center.png",
    sourceUrl:
      "https://sercoevbd-flgateway.org/wp-content/uploads/2023/01/Main_Logo_big.png",
    width: 472,
  },
  "tropical-islands": {
    height: 300,
    optical: "standard",
    src: "/resources/regional-centers/tropical-islands.svg",
    sourceUrl:
      "https://prvectorcontrol.org/wp-content/uploads/2026/08/Titec-logo.svg",
    width: 1100,
  },
  "vectored-network": {
    height: 781,
    optical: "standard",
    src: "/resources/regional-centers/vectored-network.webp",
    sourceUrl:
      "https://images.squarespace-cdn.com/content/v1/64ab57cee2bb472a605933b8/166e3b2f-922c-4e7e-98b6-27bb39836b31/VectorED+Network+Logo+%284%29.png",
    width: 2188,
  },
};

export function regionalCenterLogo(id: string): RegionalCenterLogo | null {
  return REGIONAL_CENTER_LOGOS[id] ?? null;
}
