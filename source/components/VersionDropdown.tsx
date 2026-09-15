import React from "react";
import type { ReleaseListEntry } from "../engine/releaseManifestClient";

export type VersionDropdownProps = {
  releases: ReleaseListEntry[];
  selected: string;
  onSelect: (release: string) => void;
  style?: React.CSSProperties;
};

export const VersionDropdown = ({
  releases,
  selected,
  onSelect,
  style,
}: VersionDropdownProps) => {
  return (
    <label style={style}>
      Use EasyEyes version
      <select
        aria-label="Use EasyEyes version"
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
      >
        {releases.map(({ release, changelog }) => (
          <option key={release} value={release}>
            {release} — {changelog}
          </option>
        ))}
      </select>
    </label>
  );
};
