/** Pure, deterministic selector, shared by the viewer and other consumers. */
export function selectMascot(catalog, request = {}) {
  const images = Array.isArray(catalog?.images) ? catalog.images.filter(image =>
    image && typeof image.id === 'string' && image.reviewStatus === 'revisada' && typeof image.alt === 'string' && image.alt.trim()
    && /^\/biblioteca-bitara\/images\/[a-z0-9-]+\.webp$/.test(image.src)
    && image.width > 0 && image.height > 0) : [];
  const sorted = [...images].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return sorted.find(image => image.id === request?.id)
    ?? sorted.find(image => image.kind === 'pose' && image.category === request?.category)
    ?? sorted.find(image => image.id === catalog?.fallbackId && image.kind === 'pose')
    ?? sorted.find(image => image.kind === 'pose' && image.category === 'neutra')
    ?? null;
}
