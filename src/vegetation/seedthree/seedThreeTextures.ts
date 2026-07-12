const barkModules = import.meta.glob('../../../vendor/seedthree/assets/bark/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const leafModules = import.meta.glob('../../../vendor/seedthree/assets/leaves/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function byBasename(modules: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, url] of Object.entries(modules)) {
    out[path.split('/').pop() ?? path] = url;
  }
  return out;
}

const barkUrls = byBasename(barkModules);
const leafUrls = byBasename(leafModules);

export function seedThreeBarkUrl(name: string): string | undefined {
  return barkUrls[name];
}

export function seedThreeLeafUrl(name: string): string | undefined {
  return leafUrls[name];
}
