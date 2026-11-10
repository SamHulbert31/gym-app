import type { ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

// Bottom sheet over a dimmed backdrop. Tapping the backdrop closes it.
export default function Sheet({ title, onClose, children }: Props) {
  return (
    <div className="overlay sheet-wrap">
      <button className="backdrop" aria-label="Close" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={title}>
        <h2 className="card-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
