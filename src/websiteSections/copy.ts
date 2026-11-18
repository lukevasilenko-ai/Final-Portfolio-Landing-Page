export type WebsiteCopy = Record<string, string>;

export function websiteCopy(copy: WebsiteCopy | undefined, key: string, fallback: string) {
  return copy?.[key] ?? fallback;
}
