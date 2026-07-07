import { useEffect } from 'react';

export function useHashView<T extends string>(value: T, setValue: (next: T) => void, allowed: T[]) {
  useEffect(() => {
    const fromHash = window.location.hash.replace(/^#\/?/, '') as T;
    if (allowed.includes(fromHash)) {
      setValue(fromHash);
    }
  }, []);

  useEffect(() => {
    window.location.hash = `/${value}`;
  }, [value]);
}
