// Where each CJK subset file ends up after the build. Kept in its own chunk:
// it lists ~800 files and is only needed once a CJK outline is asked for.
export const FILES = import.meta.glob(
  '/node_modules/@fontsource/{noto-serif-sc,noto-sans-sc,noto-serif-tc,lxgw-wenkai-tc,noto-serif-jp,noto-sans-jp,noto-serif-kr}/files/*-400-normal.woff',
  { query: '?url', import: 'default', eager: true },
) as Record<string, string>;
