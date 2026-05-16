export type PlatformKey =
  | "netflix"
  | "disney_plus"
  | "apple_tv_plus"
  | "crave"
  | "prime_video"
  | "paramount_plus";

export type Platform = { key: PlatformKey; displayName: string };

export const PLATFORMS: readonly Platform[] = [
  { key: "netflix", displayName: "Netflix" },
  { key: "disney_plus", displayName: "Disney+" },
  { key: "apple_tv_plus", displayName: "Apple TV+" },
  { key: "crave", displayName: "Crave" },
  { key: "prime_video", displayName: "Prime Video" },
  { key: "paramount_plus", displayName: "Paramount+" },
] as const;

const PLATFORM_KEY_SET = new Set<string>(PLATFORMS.map((p) => p.key));

export function isValidPlatformKey(key: string): key is PlatformKey {
  return PLATFORM_KEY_SET.has(key);
}
