/**
 * @file What the Test Font panel needs to know about the signed-in session.
 *
 * The panel is opened from the navbar, which is static HTML outside React, so
 * it cannot receive props. React publishes the little it needs here instead:
 * the font names already listed from EasyEyesResources, and enough state to
 * explain an empty list. Font bytes are fetched separately, through the same
 * GitLab client a compile uses, which loads its own tokens from storage.
 */

export interface TestFontContext {
  /** File names under fonts/ in the user's EasyEyesResources repo. */
  fonts: string[];
  /** False while the repo listing is still in flight. */
  resourcesLoaded: boolean;
  signedIn: boolean;
}

let current: TestFontContext = {
  fonts: [],
  resourcesLoaded: false,
  signedIn: false,
};

export const setTestFontContext = (next: TestFontContext): void => {
  current = next;
};

export const getTestFontContext = (): TestFontContext => current;
