// The row of small buttons on the Compiler's first screen, one per kind of
// resource in the scientist's Pavlovia account: fonts, forms, texts, images,
// code, phrases, and sound files.
//
// Folders have no button of their own. A folder of images is listed under
// Images and a folder of sounds under Sound; components/folderKinds.js works
// out which is which, and until it has, a folder is listed under both.
import React, { useEffect, useMemo, useState } from "react";

import ResourceButton from "./ResourceButton";
import { folderBelongsIn, loadFolderKinds } from "./components/folderKinds";
import { resourcesFileTypes } from "../threshold/preprocess/constants";
import { resourceListingFor } from "../threshold/preprocess/resourceCatalog";

// The kinds of resource that share the one Sound button.
const SOUND_TYPES = [
  "folders",
  "impulseResponses",
  "frequencyResponses",
  "targetSoundLists",
];

/**
 * The kind of each folder, by name, and whether every folder has been looked
 * at. Both belong to one set of folders of one scientist: when either
 * changes, what was known is dropped at once, in the same render, so a count
 * made from stale kinds is never shown.
 */
const useFolderKinds = (user, folderNames) => {
  const namesKey = folderNames.join("\n");
  const userId = user?.id;
  const key = `${userId ?? ""}\n${namesKey}`;
  const [state, setState] = useState({ key, kinds: {}, settled: false });
  useEffect(() => {
    let cancelled = false;
    setState({ key, kinds: {}, settled: false });
    void Promise.resolve(
      loadFolderKinds(
        user,
        namesKey ? namesKey.split("\n") : [],
        (name, kind) =>
          setState((known) =>
            known.key === key
              ? { ...known, kinds: { ...known.kinds, [name]: kind } }
              : known,
          ),
        () => cancelled,
      ),
    ).finally(() => {
      if (!cancelled)
        setState((known) =>
          known.key === key ? { ...known, settled: true } : known,
        );
    });
    return () => {
      cancelled = true;
    };
    // `user` is a new object on many renders; its id is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const current = state.key === key;
  return {
    kinds: current ? state.kinds : {},
    settled: current && state.settled,
  };
};

export default function ResourceButtons({ resourceCatalog, onRetry, user }) {
  const folders = resourceListingFor(resourceCatalog, "folders");
  const folderNames = useMemo(
    () => (folders.kind === "ready" ? folders.names : []),
    [folders],
  );
  const { kinds, settled } = useFolderKinds(user, folderNames);
  // Until every folder has been sorted, Images and Sound do not show a
  // number: a count that included a folder and then dropped it would look
  // like a mistake. They keep their spinner and show one number, the final
  // one. (After the first visit the answers are remembered, so this is
  // brief.)
  const sorting = folderNames.length > 0 && !settled;

  // The folders that belong in a category. While the list of folders is still
  // loading, or failed, that state is passed on as it is.
  const foldersIn = (category) =>
    folders.kind === "ready"
      ? {
          kind: "ready",
          names: folderNames.filter((name) =>
            folderBelongsIn(kinds[name], category),
          ),
        }
      : folders;

  return (
    <>
      {resourcesFileTypes
        .filter((fileType) => !SOUND_TYPES.includes(fileType))
        .map((fileType) => (
          <ResourceButton
            key={`resource-button-${fileType}`}
            name={fileType}
            listing={resourceListingFor(resourceCatalog, fileType)}
            folderListing={
              fileType === "images" ? foldersIn("images") : undefined
            }
            counting={fileType === "images" && sorting}
            onRetry={onRetry}
            user={user}
          />
        ))}
      <ResourceButton
        key="resource-button-sound"
        name="sound"
        listings={SOUND_TYPES.map((type) =>
          type === "folders"
            ? foldersIn("sound")
            : resourceListingFor(resourceCatalog, type),
        )}
        counting={sorting}
        onRetry={onRetry}
      />
    </>
  );
}
