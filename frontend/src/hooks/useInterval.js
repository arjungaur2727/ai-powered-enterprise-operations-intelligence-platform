/**
 * src/hooks/useInterval.js — React polling hook.
 */
import { useEffect, useRef } from "react";

export function useInterval(callback, delay) {
  const callbackRef = useRef(callback);
  useEffect(() => { callbackRef.current = callback; }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => callbackRef.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
