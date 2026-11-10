import { useEffect, useRef, useState } from 'react';
import { selectOnFocus } from '../utils';

const parse = (text: string): number | undefined => {
  const n = parseFloat(text.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};
const format = (n: number | undefined) => (n === undefined ? '' : String(n));

interface Props {
  value: number | undefined;
  /** Called on every keystroke with the parsed number, or undefined when the field is empty. */
  onChange: (n: number | undefined) => void;
  decimal?: boolean;
  className?: string;
  label: string;
  placeholder?: string;
}

// A number field that saves as you type. While it has focus it owns its text: the database
// echoes each keystroke back a moment later, and a stale echo must never overwrite what is being
// typed ("82." has to survive, and so does "102.5" typed faster than the database answers).
// When it does not have focus it follows the stored value, e.g. reps filled in by marking a set done.
export default function NumInput({ value, onChange, decimal, className, label, placeholder }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(format(value));

  useEffect(() => {
    if (document.activeElement === ref.current) return;
    setText((cur) => (parse(cur) === value ? cur : format(value)));
  }, [value]);

  return (
    <input
      ref={ref}
      className={className}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      aria-label={label}
      placeholder={placeholder}
      value={text}
      onFocus={selectOnFocus}
      onChange={(e) => {
        const next = e.target.value.replace(decimal ? /[^0-9.,]/g : /[^0-9]/g, '');
        setText(next);
        onChange(parse(next));
      }}
      onBlur={() => setText((cur) => (parse(cur) === value ? cur : format(value)))}
    />
  );
}
