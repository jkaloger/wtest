const PROTECTED = ["/dashboard"];

export function isProtected(pathname: string): boolean {
  return PROTECTED.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

// Cookie presence only. The dashboard RSC performs the real `getUser()`.
export function redirectFor(pathname: string, hasSession: boolean): string | null {
  if (isProtected(pathname) && !hasSession) return "/login";
  return null;
}
