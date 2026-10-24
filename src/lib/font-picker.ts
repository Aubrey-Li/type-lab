import { select, type OptionGroup } from './controls';
import { CATALOG, CATEGORY_LABELS, fontStore, getUploads, type Category } from './fonts';

function groups(): OptionGroup<string>[] {
  const byCategory = (Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => ({
    label: CATEGORY_LABELS[cat],
    options: CATALOG.filter((e) => e.category === cat).map((e) => ({ value: e.id, label: e.name })),
  }));
  const uploads = getUploads();
  return uploads.length
    ? [...byCategory, { label: 'Your fonts', options: uploads.map((f) => ({ value: f.key, label: f.name })) }]
    : byCategory;
}

/** A select bound to the shared current font. */
export function fontPicker(label = 'Typeface') {
  const ctl = select({
    label,
    groups: groups(),
    value: fontStore.get().key,
    onChange: (key) => void fontStore.select(key),
  });
  fontStore.subscribe((f) => ctl.setGroups(groups(), f.key));
  return ctl.el;
}
