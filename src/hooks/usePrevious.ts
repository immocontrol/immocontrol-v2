import { useRef, useEffect } from "react";

/** IMP-139: Hook to track the previous value of a variable */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => { ref.current = value; });
  return ref.current;
}
