const categoryLabels: Record<string, string> = {
  'product-posters': 'პროდუქტის პოსტერები',
  branding: 'ბრენდინგი და იდენტობა',
  'branding-identity': 'ბრენდინგი და იდენტობა',
  'billboards-print': 'ბილბორდები და ბეჭდური მასალა',
};

export function getCategoryAdminLabel(category: { slug: string; name: string }) {
  return categoryLabels[category.slug] ?? category.name;
}

// Georgian national romanization, used to build URL codes from category names.
const GEORGIAN_TO_LATIN: Record<string, string> = {
  ა: 'a', ბ: 'b', გ: 'g', დ: 'd', ე: 'e', ვ: 'v', ზ: 'z', თ: 't', ი: 'i', კ: 'k', ლ: 'l', მ: 'm',
  ნ: 'n', ო: 'o', პ: 'p', ჟ: 'zh', რ: 'r', ს: 's', ტ: 't', უ: 'u', ფ: 'p', ქ: 'k', ღ: 'gh', ყ: 'q',
  შ: 'sh', ჩ: 'ch', ც: 'ts', ძ: 'dz', წ: 'ts', ჭ: 'ch', ხ: 'kh', ჯ: 'j', ჰ: 'h',
};

/** "შეფუთვის დიზაინი" → "sheputvis-dizaini"; returns '' when nothing usable is left. */
export function slugifyCategoryName(name: string) {
  return [...name.trim().toLowerCase()]
    .map((character) => GEORGIAN_TO_LATIN[character] ?? character)
    .join('')
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}
