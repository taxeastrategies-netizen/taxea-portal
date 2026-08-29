import 'react-router-dom';

declare module 'react-router-dom' {
  export function useOutletContext<T = any>(): T;
}
