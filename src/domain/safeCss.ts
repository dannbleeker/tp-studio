/**
 * Allow only CSS color values that can't break out of an inline `style`
 * attribute.
 *
 * The HTML export interpolates `customEntityClass.color` into
 * `style="background:${color}"`. `escapeHtml` only neutralises `< > " ' &`, so
 * a crafted value like `red;background-image:url(http://attacker/x.png)` —
 * which contains none of those — survives intact and injects an extra CSS
 * declaration (an external-resource beacon that fires when the exported `.html`
 * is opened) into the file. The same unvalidated value is also applied live via
 * React `style={{}}` props, where the CSSOM setter rejects it — but the
 * string-concatenation export path does not, so it's validated here at the
 * trust boundary.
 *
 * Allowlist: hex (#rgb / #rgba / #rrggbb / #rrggbbaa), the
 * rgb()/rgba()/hsl()/hsla() functions with purely numeric content, and a
 * curated set of named colors. Anything carrying `;`, `:`, `{`, `}`, or
 * `url(` fails all three and is rejected.
 */
const HEX_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const COLOR_FN_RE = /^(?:rgb|rgba|hsl|hsla)\(\s*[0-9.,%/\s]+\)$/i;
const NAMED_COLORS: ReadonlySet<string> = new Set([
  'transparent',
  'currentcolor',
  'black',
  'white',
  'red',
  'green',
  'blue',
  'yellow',
  'orange',
  'purple',
  'pink',
  'gray',
  'grey',
  'brown',
  'cyan',
  'magenta',
  'lime',
  'teal',
  'indigo',
  'violet',
  'navy',
  'maroon',
  'olive',
  'silver',
  'gold',
  'coral',
  'salmon',
  'crimson',
  'khaki',
  'tan',
  'beige',
  'ivory',
  'lavender',
  'plum',
  'orchid',
  'turquoise',
  'aqua',
  'fuchsia',
]);

export const isSafeCssColor = (color: string): boolean => {
  const v = color.trim().toLowerCase();
  if (v.length === 0) return false;
  return HEX_RE.test(v) || COLOR_FN_RE.test(v) || NAMED_COLORS.has(v);
};
