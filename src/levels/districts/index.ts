import type { DistrictGameplay, DistrictId } from "./types";
import { gameplay as res } from "./D-RES";
import { gameplay as main } from "./D-MAIN";
import { gameplay as school } from "./D-SCHOOL";
import { gameplay as shop } from "./D-SHOP";
import { gameplay as civic } from "./D-CIVIC";
import { gameplay as park } from "./D-PARK";
import { gameplay as zoo } from "./D-ZOO";
import { gameplay as edge } from "./D-EDGE";
import { gameplay as grove } from "./D-GROVE";
export const districtGameplay: Record<DistrictId, DistrictGameplay> = {
  "D-RES": res,
  "D-MAIN": main,
  "D-SCHOOL": school,
  "D-SHOP": shop,
  "D-CIVIC": civic,
  "D-PARK": park,
  "D-ZOO": zoo,
  "D-EDGE": edge,
  "D-GROVE": grove,
};
