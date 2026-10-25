// Softimage Face Robot Synoptic View frame shell — Path only; HTML body LOCK (dump-attested).
const el = (tag: string, cls?: string, text?: string) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/** Synoptic View frame shell — Path only; HTML body LOCK. */
export function faceRobotSynopticSlot(host: HTMLElement, opts: {
  name: string;
  path?: string;
  note?: string;
}) {
  const root = el('div', 'fr-synoptic-slot');
  host.appendChild(root);
  root.dataset.siViewType = 'Synoptic View';
  root.dataset.siFrFrame = opts.name;
  root.append(
    el('div', 'fr-synoptic-label', `Synoptic View · ${opts.name}`),
    el('div', 'fr-synoptic-path', opts.path ?? '(no Path — HTML body LOCK)'),
    el('div', 'fr-synoptic-lock', opts.note ?? 'Synoptic HTML / FR.dll body LOCK (dump-attested frame only).'),
  );
  return root;
}
