// Phase 0 stub — replaced with Better Auth's createAuthClient in Phase 1.
// The shape mirrors better-auth/react's useSession so consumers (Header,
// Home, guards) are written once and don't change when real auth lands.

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
};

export type Session = { user: SessionUser } | null;

export function useSession(): { data: Session; isPending: boolean } {
  return { data: null, isPending: false };
}

export async function signOut(): Promise<void> {
  // no-op until Better Auth lands in Phase 1
}
