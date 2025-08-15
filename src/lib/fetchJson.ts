export async function fetchJSON<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (e) {
    console.error("Failed to fetch", path, e);
    return null;
  }
}
