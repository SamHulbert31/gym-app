import type { FocusEvent } from 'react';

// Focusing a field selects its contents so one tap replaces the value.
export const selectOnFocus = (e: FocusEvent<HTMLInputElement>) => e.currentTarget.select();
