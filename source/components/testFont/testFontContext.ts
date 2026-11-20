import {
  idleResourceCatalog,
  type ResourceCatalog,
} from "../../../threshold/preprocess/resourceCatalog";

/** What the navbar-hosted Test Font tool needs from the signed-in session. */
export interface TestFontContext {
  resourceCatalog: ResourceCatalog;
  signedIn: boolean;
}

let current: TestFontContext = {
  resourceCatalog: idleResourceCatalog(),
  signedIn: false,
};

export const setTestFontContext = (next: TestFontContext): void => {
  current = next;
};

export const getTestFontContext = (): TestFontContext => current;
