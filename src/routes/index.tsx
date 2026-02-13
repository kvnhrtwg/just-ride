import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { api } from '../../convex/_generated/api'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      convexQuery(api.auth.getCurrentUser, {}),
    )
  },
  component: Home,
})

function Home() {
  const { data: user } = useSuspenseQuery(
    convexQuery(api.auth.getCurrentUser, {}),
  )

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          location.reload()
        },
      },
    })
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-16">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">
            TanStack Start • shadcn/ui • Better Auth • Convex
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Starter authentication flow
          </h1>
          <p className="text-muted-foreground">
            Sign up, sign in, and see your authenticated session.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Session</CardTitle>
            <CardDescription>
              {user
                ? 'You are signed in and ready to build.'
                : 'Create an account or sign in to continue.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Signed in as
                </p>
                <p className="text-lg font-semibold">
                  {user.email ?? 'Unknown email'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No active session found.
              </p>
            )}
          </CardContent>
          <CardFooter className="justify-between gap-3">
            {user ? (
              <Button onClick={handleSignOut}>Sign out</Button>
            ) : (
              <div className="flex flex-wrap gap-3">
                <Link
                  className={buttonVariants({ variant: 'default' })}
                  to="/login"
                >
                  Log in
                </Link>
                <Link
                  className={buttonVariants({ variant: 'outline' })}
                  to="/signup"
                >
                  Create account
                </Link>
              </div>
            )}
            {!user ? (
              <Link
                className={buttonVariants({ variant: 'ghost' })}
                to="/signup"
              >
                Need an account?
              </Link>
            ) : null}
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}
