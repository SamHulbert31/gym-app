import type { ReactNode } from 'react';

interface IconProps {
  size?: number;
  stroke?: number;
}

const icon =
  (paths: ReactNode, defaultStroke = 2) =>
  ({ size = 20, stroke = defaultStroke }: IconProps) => (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths}
    </svg>
  );

export const ArrowRight = icon(<path d="M5 12h14M13 6l6 6-6 6" />, 2.2);
export const ChevronLeft = icon(<path d="m15 5-7 7 7 7" />);
export const ChevronDown = icon(<path d="m6 9 6 6 6-6" />);
export const Swap = icon(<path d="M17 3l4 4-4 4M21 7H7M7 21l-4-4 4-4M3 17h14" />);
export const Check = icon(<path d="m5 12 5 5 9-10" />, 2.4);
export const HomeIcon = icon(<path d="M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />, 1.8);
export const Dumbbell = icon(<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" />, 1.8);
export const Trend = icon(<path d="M3 17l6-6 4 4 8-9M15 6h6v6" />, 1.8);
export const Plus = icon(<path d="M12 5v14M5 12h14" />);
export const Close = icon(<path d="M6 6l12 12M18 6 6 18" />);
export const ChevronUp = icon(<path d="m6 15 6-6 6 6" />);
export const ChevronRight = icon(<path d="m9 5 7 7-7 7" />);
export const Gear = icon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </>,
  1.8,
);
