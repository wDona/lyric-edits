import { Composition } from "remotion";
import { Edit } from "./Edit.tsx";
import { presetStyle } from "./presets.ts";
import { durationOf, FPS, H, W } from "./timing.ts";
import type { EditProps } from "./types.ts";

const empty: EditProps = { lines: [], edits: {}, style: presetStyle("pop"), media: [], audio: null, start: 0, end: 5, rate: 1, beats: [], env: [] };

export function Root() {
  return (
    <Composition
      id="LyricEdit"
      component={Edit}
      width={W}
      height={H}
      fps={FPS}
      durationInFrames={durationOf(empty)}
      defaultProps={empty}
      calculateMetadata={({ props }) => ({ durationInFrames: durationOf(props) })}
    />
  );
}
