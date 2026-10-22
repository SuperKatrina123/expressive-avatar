---
name: expressive-avatar
description: Turn a user-supplied illustrated character asset pack and natural-language interaction requirements into a working web avatar with a first-visit drawing intro, draggable SVG glasses, directional poses, and configurable staggered question marks. Use when users want this avatar effect or want to replace its artwork without rewriting animation code.
---

# Expressive Avatar

Convert this contract into a tested component:

```text
asset pack + interaction requirements + this skill = implementation
```

Use the bundled framework-agnostic Web Component and deterministic scripts. Adapt its wrapper to React/Vue/Svelte when needed; do not rewrite its animation engine unless the target cannot host a custom element.

## Workflow

1. Inspect the target project and identify its public/static asset directory and component entry point.
2. Read [the asset contract](references/assets.md). Compare it with the user's supplied files and report only actual gaps.
3. Translate natural-language interactions into the manifest schema in [interactions](references/interactions.md). Preserve the user's wording in `notes`, but use only supported trigger/action values in executable fields.
4. Run validation before integration:

   ```bash
   node scripts/validate-assets.mjs /absolute/path/avatar.manifest.json
   ```

5. Scaffold into an absent destination directory:

   ```bash
   node scripts/scaffold.mjs /absolute/path/to/project/public/expressive-avatar
   ```

6. Copy validated artwork into the scaffold, replace its example manifest, and follow [integration](references/integration.md).
7. Verify the requested triggers, touch/pointer behavior, reduced motion, intro replay gate, and console.

## Non-negotiable implementation rules

- Keep every pose on one shared canvas with identical dimensions and crop.
- Keep glasses as an independent SVG: two circles and a bridge path. Never bake glasses into pose images.
- Intro paths, pose images, glasses coordinates, and question marks share the manifest viewBox.
- Intro uses normalized SVG dash drawing and a pen that follows `getPointAtLength`; paint paths reveal the final image before the final crossfade.
- Pointer look changes pose without changing outer layout. Basic mode crossfades aligned pose PNGs; mesh mode morphs shared vertices. State which mode is implemented.
- Glasses lift and return through a damped spring and use pointer capture.
- Question marks appear in manifest order with configured stagger and duration. A trigger such as `look-left` may activate both a pose and question marks.
- Reduced motion skips the intro and jumps springs to stable states.

## Supported delivery modes

- `basic` (default): aligned transparent PNGs crossfade among rest/left/right/up/down/wonder. Foolproof and easy to replace.
- `mesh` (advanced): corresponding vertices and one triangle topology morph pose textures in WebGL. Use only when the user supplies a mesh or explicitly requests mesh authoring. Do not imply that crossfade equals mesh deformation.

## Completion checks

- Validator succeeds without errors.
- Intro finishes without a rectangular matte mismatch.
- Resting glasses align with both eyes; drag does not select text or scroll the page.
- Every requested directional trigger reaches the intended pose and action.
- Question marks stagger and restore after their configured duration.
- Keyboard/API equivalents exist for effects not discoverable by keyboard.
- No console errors or layout overflow at desktop and mobile widths.
