import prisma from './db.js';

export type CategoryCrumb = { id: string; name: string; parentId: string | null };

/** Walk up to `max` ancestors (category tree depth cap aligns with F0). */
export async function categoryBreadcrumbs(
  startId: string | null,
  max: number,
): Promise<CategoryCrumb[]> {
  const out: CategoryCrumb[] = [];
  let id: string | null = startId;
  for (let i = 0; i < max && id; i++) {
    const c = await prisma.category.findUnique({ where: { id } });
    if (!c) break;
    out.unshift({ id: c.id, name: c.name, parentId: c.parentId });
    id = c.parentId;
  }
  return out;
}
