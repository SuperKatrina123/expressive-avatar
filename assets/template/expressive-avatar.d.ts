import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare class ExpressiveAvatarElement extends HTMLElement {
  wonder(): void;
  replay(): void;
}

declare global {
  interface HTMLElementTagNameMap {
    "expressive-avatar": ExpressiveAvatarElement;
  }
  namespace JSX {
    interface IntrinsicElements {
      "expressive-avatar": DetailedHTMLProps<HTMLAttributes<ExpressiveAvatarElement>, ExpressiveAvatarElement> & { manifest?: string };
    }
  }
}

export {};
