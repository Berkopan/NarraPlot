import type { CSSProperties } from 'react';

export type IconName =
  | 'bars'
  | 'line'
  | 'upload'
  | 'download'
  | 'folder'
  | 'save'
  | 'arrow'
  | 'check'
  | 'close'
  | 'play'
  | 'pause'
  | 'help'
  | 'file'
  | 'image'
  | 'code'
  | 'globe'
  | 'refresh';
const paths: Record<IconName, React.ReactNode> = {
  bars: (
    <>
      <path d="M4 20V12M12 20V7M20 20V3" />
      <path d="M2 21h20" />
    </>
  ),
  line: (
    <>
      <path d="M3 18l6-7 5 3 7-10" />
      <circle cx="3" cy="18" r="1" />
      <circle cx="9" cy="11" r="1" />
      <circle cx="14" cy="14" r="1" />
      <circle cx="21" cy="4" r="1" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5" />
    </>
  ),
  folder: <path d="M3 7V4h6l3 3h9v13H3V7Z" />,
  save: (
    <>
      <path d="M4 3h13l4 4v14H3V3h1Z" />
      <path d="M7 3v6h9V3M7 21v-8h10v8" />
    </>
  ),
  arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  play: <path d="m8 4 12 8-12 8V4Z" />,
  pause: (
    <>
      <path d="M8 4v16M16 4v16" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4M12 17h.01" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H5v18h14V8l-5-5Z" />
      <path d="M14 3v6h5M8 13h8M8 17h6" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8" cy="8" r="1.5" />
      <path d="m3 18 5-5 4 4 5-8 4 6" />
    </>
  ),
  code: <path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5" />
    </>
  ),
};

export function Icon({
  name,
  size = 18,
  style,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {paths[name]}
    </svg>
  );
}
