# Expressive Avatar

Turn an illustrated character pack and plain-language interaction requirements into a reusable web avatar component.

```text
artwork + interaction requirements + $expressive-avatar
                              = working web component
```

The generated avatar can: 

- draw itself on first visit with animated SVG paths;
- reveal its final artwork with textured paint strokes;
- lift and drag an independent pair of SVG glasses;
- look left, right, up, or down as the pointer moves;
- switch to a wondering pose;
- pop out staggered question marks;
- combine triggers and actions through declarative rules;
- work in HTML, React, Vue, or Svelte without a framework dependency.

## How it works

You provide a small asset pack and describe the behavior you want in natural language:

> Draw the character on first visit. When the pointer moves left, turn the head left and show three question marks. Look right without question marks. Clicking the glasses should lift them; dragging moves them; releasing returns them with a spring.

The Skill validates the artwork, translates the request into an `avatar.manifest.json`, scaffolds a Web Component, integrates it into the target project, and verifies the result.

## Install the Skill

Copy or clone this repository into your Codex skills directory:

```bash
git clone https://github.com/SuperKatrina123/expressive-avatar.git ~/.codex/skills/expressive-avatar
```

Restart or reconnect Codex if the Skill is not immediately listed. Then invoke it with:

```text
Use $expressive-avatar. Here is my asset pack.
Draw the character on first visit. Look left and show question marks when the pointer is on the left.
Clicking the glasses should lift them, dragging should move them, and releasing should return them.
```

## Artwork you need

### Minimum pack

```text
avatar-pack/
├── rest.png
├── outline.svg
└── paint.svg
```

- `rest.png` is the final neutral character without glasses or question marks.
- `outline.svg` contains ordered paths used by the first-visit drawing animation.
- `paint.svg` contains broad brush trajectories that reveal `rest.png`.

Add only the poses required by your interactions:

```text
left.png
right.png
up.png
down.png
wonder.png
```

For example, “look left and show question marks” only requires `left.png`; it does not require a separate `wonder.png` unless you want a distinct wondering face.

### Artwork constraints

- Every pose must use exactly the same pixel dimensions.
- The character must remain aligned on the same canvas and crop.
- Do not draw glasses into pose images.
- Do not draw question marks into pose images.
- Transparent PNG is recommended.
- `outline.svg` and `paint.svg` must use the same viewBox as the image canvas.
- Leave enough space around the head for question marks and lifted glasses.

See [the complete asset contract](references/assets.md).

## Describe interactions in plain language

You do not need to write JSON. Describe what should happen:

```text
When the pointer is left of the face, turn left and show question marks once.
When it moves right, turn right without question marks.
When it moves below the face, look down.
When it leaves, return to rest.
```

The Skill translates that into rules such as:

```json
[
  {
    "when": "look-left",
    "do": ["pose:left", "question-marks"],
    "onceUntilLeave": true
  },
  {
    "when": "look-right",
    "do": ["pose:right"]
  },
  {
    "when": "look-down",
    "do": ["pose:down"]
  },
  {
    "when": "look-away",
    "do": ["pose:rest"]
  }
]
```

Supported triggers and actions are documented in [interaction rules](references/interactions.md).

## Glasses

Glasses are generated as an independent SVG layer, not an image baked into the character. Supply two lens circles, a bridge path, stroke width, and transform origin in the manifest:

```json
{
  "glasses": {
    "left": { "cx": 50.2, "cy": 59.3, "r": 10.4 },
    "right": { "cx": 81.8, "cy": 57.4, "r": 10.4 },
    "bridgePath": "M62.6 58 69.4 57.6",
    "strokeWidth": 0.7,
    "origin": [66, 57.6],
    "lift": [0.38, -0.22],
    "spring": { "stiffness": 0.1, "damping": 0.45 }
  }
}
```

Pointer capture makes the glasses draggable with mouse, pen, and touch. Releasing them returns the SVG to its resting position through a damped spring.

## Validate an asset pack

Run the deterministic validator before integration:

```bash
node scripts/validate-assets.mjs /absolute/path/avatar.manifest.json
```

It checks:

- manifest version and mode;
- required files;
- PNG dimensions and alpha capability;
- SVG viewBoxes and path counts;
- missing poses referenced by interaction rules;
- glasses geometry and canvas bounds;
- question-mark paths and dot coordinates;
- supported triggers and actions.

A successful result looks like:

```json
{
  "ok": true,
  "poses": [
    { "name": "rest", "width": 512, "height": 512, "alpha": true },
    { "name": "left", "width": 512, "height": 512, "alpha": true }
  ],
  "outlinePaths": 8,
  "paintPaths": 2,
  "rules": 4,
  "errors": [],
  "warnings": []
}
```

## Scaffold the component

Generate the reusable runtime into a new directory:

```bash
node scripts/scaffold.mjs /absolute/path/to/project/public/expressive-avatar
```

The command intentionally refuses to overwrite an existing directory. It produces:

```text
expressive-avatar/
├── avatar.manifest.json
├── expressive-avatar.js
└── expressive-avatar.d.ts
```

Copy the validated artwork beside those files and update the manifest paths.

## Use in HTML

```html
<script
  type="module"
  src="/expressive-avatar/expressive-avatar.js"
></script>

<expressive-avatar
  manifest="/expressive-avatar/avatar.manifest.json"
></expressive-avatar>
```

## Use in React

```tsx
import "/expressive-avatar/expressive-avatar.js";

export function Portrait() {
  return (
    <expressive-avatar
      manifest="/expressive-avatar/avatar.manifest.json"
    />
  );
}
```

Copy `expressive-avatar.d.ts` into a TypeScript source directory to register the JSX element type. Vue and Svelte can use the same custom-element markup. See [integration details](references/integration.md).

## Trigger question marks from another element

Call the public API:

```js
document.querySelector("expressive-avatar")?.wonder();
```

Or dispatch an event:

```js
avatar.dispatchEvent(new CustomEvent("avatar-wonder"));
```

This is useful when hovering or focusing a hidden-detail sentence should make the character react.

## Replay the drawing intro

Normal playback is gated by `intro.replayHours`. For a preview or explicit replay control:

```js
document.querySelector("expressive-avatar")?.replay();
```

The intro uses normalized SVG dash drawing, follows each path with a pen, reveals the final image through noisy image-textured paint strokes, and crossfades to the final pose. Pointer, keyboard, wheel, or touch input accelerates the remainder rather than abruptly skipping it.

## Basic and mesh modes

### Basic

The bundled runtime implements `basic` mode. Aligned PNG layers crossfade between poses. It is predictable, easy to validate, and easy to replace.

### Mesh

`mesh` mode is intended for continuous WebGL deformation. It requires: 

- shared UV coordinates;
- one triangle topology;
- corresponding vertex positions for every pose;
- left-eye, right-eye, and mouth landmarks;
- a project-specific renderer.

Mesh mode is not automatically reconstructed from unrelated images. The manifest reserves the mode, but the bundled runtime deliberately does not pretend that a crossfade is mesh deformation.

## Repository structure

```text
expressive-avatar/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── assets/
│   └── template/
│       ├── avatar.manifest.json
│       ├── expressive-avatar.js
│       └── expressive-avatar.d.ts
├── references/
│   ├── assets.md
│   ├── integration.md
│   └── interactions.md
└── scripts/
    ├── scaffold.mjs
    └── validate-assets.mjs
```

## Accessibility and motion

- The component has a stable outer layout box.
- `prefers-reduced-motion: reduce` skips the intro and jumps springs to stable states.
- External effects expose method/event triggers for keyboard-accessible controls.
- Question marks are decorative and excluded from the accessibility tree.
- The avatar exposes an image role and descriptive label.

## License and artwork

This repository contains reusable interaction code and configuration templates. Supply artwork you own or have permission to use. Do not redistribute reference-site artwork as part of a generated avatar pack.
