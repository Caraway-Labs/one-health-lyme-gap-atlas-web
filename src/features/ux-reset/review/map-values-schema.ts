import { z } from "zod";

const countyMapValuesSchema = z.object({
  fips: z.string().regex(/^\d{5}$/),
  incidence_floor_2023: z.number().nullable(),
  svi_percentile: z.number().nullable(),
  uninsured_percent: z.number().nullable(),
  rucc_2023: z.number().int().nullable(),
});

export const mapValuesCollectionSchema = z.object({
  release_id: z.string(),
  counties: z.array(countyMapValuesSchema),
});

export type MapValuesCollection = z.infer<typeof mapValuesCollectionSchema>;
export type CountyMapValues = z.infer<typeof countyMapValuesSchema>;
