/**
 * Debounce Utilities
 * Prevent excessive reactive updates and recalculations
 */

/**
 * Debounce a function call
 * Multiple rapid calls are coalesced into a single execution
 *
 * @param fn Function to debounce
 * @param delay Milliseconds to wait after last call
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function debouncedFn(...args: Parameters<T>) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Debounce store updates
 * Useful for preventing excessive localStorage/Supabase writes
 *
 * @param fn Function that updates the store
 * @param delay Milliseconds to wait
 * @returns Debounced update function
 */
export function debounceStore<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  return debounce(fn, delay);
}

/**
 * Create a debounced setter for input HTML elements
 * Attaches debounced change handler to input
 *
 * @param element Input HTML element
 * @param updateFn Function to call with new value
 * @param delay Milliseconds to wait
 */
export function attachDebouncedInput(
  element: HTMLInputElement | HTMLSelectElement,
  updateFn: (value: string | number) => void,
  delay: number = 300
): void {
  const debouncedUpdate = debounce((value: string | number) => {
    updateFn(value);
  }, delay);

  element.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    const value =
      target instanceof HTMLInputElement
        ? target.type === 'number'
          ? parseFloat(target.value) || 0
          : target.value
        : target.value;
    debouncedUpdate(value);
  });
}

/**
 * Create a debounced binding for Svelte bind directives
 * Use with: <input bind:value={debouncedValue} />
 *
 * @param initialValue Starting value
 * @param onUpdate Callback when user stops typing
 * @param delay Milliseconds to wait
 * @returns Object with value property for binding
 */
export function createDebouncedBinding<T>(
  initialValue: T,
  onUpdate: (value: T) => void,
  delay: number = 300
) {
  let currentValue = initialValue;
  const debouncedUpdate = debounce((value: T) => {
    onUpdate(value);
  }, delay);

  return {
    get value() {
      return currentValue;
    },
    set value(v: T) {
      currentValue = v;
      debouncedUpdate(v);
    }
  };
}
