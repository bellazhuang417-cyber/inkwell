import { isTauri } from './env';

const HTTP_URL_RE = /^https?:\/\//i;

export function isExternalUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return HTTP_URL_RE.test(url);
}

export async function openExternalUrl(url: string): Promise<void> {
  if (!isExternalUrl(url)) return;
  if (isTauri()) {
    try {
      const mod = await import('@tauri-apps/plugin-opener');
      await mod.openUrl(url);
      return;
    } catch (err) {
      console.error('[inkwell] openUrl via plugin failed, falling back:', err);
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
