const categoryLabels: Record<string, string> = {
  'product-posters': 'პროდუქტის პოსტერები',
  branding: 'ბრენდინგი და იდენტობა',
  'branding-identity': 'ბრენდინგი და იდენტობა',
  'billboards-print': 'ბილბორდები და ბეჭდური მასალა',
};

export function getCategoryAdminLabel(category: { slug: string; name: string }) {
  return categoryLabels[category.slug] ?? category.name;
}
