export function bannerMatchesPath(placement: string, targetPath: string | null, pathname: string): boolean {
  if (placement === "PAGE") return targetPath === pathname;
  if (placement === "HOMEPAGE") return /^\/(nl|en|fr)\/?$/u.test(pathname);
  if (placement === "CATEGORY") return /^\/(nl|en|fr)\/categories(?:\/|$)/u.test(pathname);
  return /^\/(nl|en|fr)\/(?:acties|promotions|promotions-fr)(?:\/|$)/u.test(pathname);
}
