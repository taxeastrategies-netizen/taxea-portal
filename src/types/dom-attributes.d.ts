import 'react';

declare module 'react' {
  interface HTMLAttributes<T> {
    /** React 18 uses the empty attribute; newer runtimes accept a boolean. */
    inert?: '' | boolean;
  }
}

// Optional Image Capture capabilities vary by browser and are feature-tested.
declare global {
interface MediaTrackCapabilities {
  focusMode?: string[];
  exposureMode?: string[];
  whiteBalanceMode?: string[];
  torch?: boolean;
}
interface MediaTrackConstraintSet {
  focusMode?: string;
  exposureMode?: string;
  whiteBalanceMode?: string;
  torch?: boolean;
}

}
