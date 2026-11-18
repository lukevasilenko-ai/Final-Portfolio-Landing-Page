export type AdminAuthorizationTransition = 'signed-out' | 'blocking-check' | 'background-check';

export function getAdminAuthorizationTransition(
  nextUserId: string | null,
  authorizedUserId: string | null,
): AdminAuthorizationTransition {
  if (!nextUserId) return 'signed-out';
  return nextUserId === authorizedUserId ? 'background-check' : 'blocking-check';
}

export function getSupabaseAuthOptions(isIsolatedWebsitePreview: boolean) {
  return {
    autoRefreshToken: !isIsolatedWebsitePreview,
    detectSessionInUrl: !isIsolatedWebsitePreview,
    persistSession: !isIsolatedWebsitePreview,
  };
}

export function withTimeout<T>(value: PromiseLike<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error('authorization_timeout')), timeoutMs);
  });

  return Promise.race([Promise.resolve(value), deadline]).finally(() => {
    if (timeout !== undefined) clearTimeout(timeout);
  });
}
