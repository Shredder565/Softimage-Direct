// Softimage Face Robot Synoptic View frame shell — closer95/modules-gdi Path DUMP_READY; HTML body LOCK.
const el = (tag: string, cls?: string, text?: string) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/** Synoptic View frame shell — dump-attested Path only; HTML body LOCK. */
export function faceRobotSynopticSlot(host: HTMLElement, opts: {
  name: string;
  path?: string;
  note?: string;
  pathStatus?: string;
}) {
  const root = el('div', 'fr-synoptic-slot');
  host.appendChild(root);
  root.dataset.siViewType = 'Synoptic View';
  root.dataset.siFrFrame = opts.name;
  if (opts.pathStatus) root.dataset.siFrPathStatus = opts.pathStatus;
  else if (opts.path) root.dataset.siFrPathStatus = 'DUMP_READY';
  root.append(
    el('div', 'fr-synoptic-label', `Synoptic View · ${opts.name}`),
    el('div', 'fr-synoptic-path', opts.path ?? '(no Path — HTML body LOCK)'),
    el('div', 'fr-synoptic-lock', opts.note ?? 'Synoptic Path DUMP_READY; HTML / FR.dll body LOCK (no invent).'),
  );
  return root;
}
