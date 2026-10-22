# Asset contract

All pose images must use one shared canvas, dimensions, crop, head location, shoulder location, and lighting. PNG is required for deterministic validation. Transparent backgrounds are recommended.

## Minimum pack

```text
avatar-pack/
├── avatar.manifest.json
├── rest.png
├── outline.svg
└── paint.svg
```

Add one image for every pose named in the interaction requirements:

```text
left.png
right.png
up.png
down.png
wonder.png
```

Only `rest.png`, `outline.svg`, and `paint.svg` are universally required. For “look left and show question marks,” add `left.png`; a separate `wonder.png` is optional unless explicitly desired.

## Image requirements

- Recommended size: 512×512 or 1024×1024.
- Every pose must exactly match `rest.png` dimensions.
- Do not include glasses or question marks in any pose image.
- Keep outer silhouette movement restrained for clean basic-mode crossfades.
- Leave space around the head for effects.
- A matte background is allowed only if `appearance.background` exactly matches it.

## `outline.svg`

- Same viewBox as the manifest canvas.
- Ordered, open `<path>` elements only.
- `fill="none"`; round caps and joins.
- Order as a person would draw: silhouette, hair/face, clothing, features.

## `paint.svg`

- Same viewBox.
- One to four broad centreline paths sweeping through colored regions.
- These are brush trajectories, not filled silhouettes.
- Split distant regions rather than creating long jumps.

## Glasses

No image is needed. Supply two circles, a bridge path, stroke width, and transform origin in the manifest. Measure coordinates on `rest.png`.

```json
{
  "left": { "cx": 190, "cy": 224, "r": 40 },
  "right": { "cx": 312, "cy": 217, "r": 40 },
  "bridgePath": "M230 220 L272 218",
  "strokeWidth": 2.7,
  "origin": [251, 220]
}
```

## Question marks

Supply one SVG path and dot location per mark. Three marks are recommended. Paths use the shared viewBox, so they remain aligned as the component scales.

## Advanced mesh pack

For true continuous morphing, additionally supply `mesh.json` with shared UVs, triangles, and a corresponding XY vertex array for every pose. Preserve vertex count and order. Provide named left-eye, right-eye, and mouth landmarks so glasses can follow the affine facial transform.
