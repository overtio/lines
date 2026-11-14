/** A story's comments page, `https://news.ycombinator.com/item?id=…`: the story's id, or null for any other link. */
export function storyId(url: URL): string | null {
  if (url.protocol !== "https:" || url.hostname !== "news.ycombinator.com" || url.pathname !== "/item") return null;
  const id = url.searchParams.get("id");
  return id && /^\d{1,12}$/.test(id) ? id : null;
}

/** A story's comments page, made from its id alone. */
export const storyPage = (id: string) => `https://news.ycombinator.com/item?id=${id}`;
