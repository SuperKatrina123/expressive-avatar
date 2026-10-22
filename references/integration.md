# Integration

Scaffold the component and serve the generated directory as static files. The component fetches the manifest relative to its `manifest` attribute.

## HTML

```html
<script type="module" src="/expressive-avatar/expressive-avatar.js"></script>
<expressive-avatar manifest="/expressive-avatar/avatar.manifest.json"></expressive-avatar>
```

## React

```tsx
import "/expressive-avatar/expressive-avatar.js";

export function Portrait() {
  return <expressive-avatar manifest="/expressive-avatar/avatar.manifest.json" />;
}
```

Copy `expressive-avatar.d.ts` into a TypeScript source directory for JSX types.

## External wonder trigger

```js
document.querySelector("expressive-avatar")?.wonder();
```

or:

```js
avatar.dispatchEvent(new CustomEvent("avatar-wonder"));
```

## Replay intro

```js
avatar.replay();
```

Normal visits use `intro.replayHours`; explicit replay is intended for previews and controls.

## Styling

```css
expressive-avatar {
  width: 8rem;
  color: #171614;
  --avatar-paper: #fff;
}
```

The component keeps its outer box stable during all interactions.
