import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { Button } from "@/components/ui/button";
import { isSignupOpen } from "@/lib/signup-gate";

export default async function SignupPage() {
  const open = await isSignupOpen();

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border bg-white/90 p-8 shadow-xl shadow-[#0b1f2a]/5 backdrop-blur">
        <Link href="/" className="font-heading text-2xl font-bold">
          Pinlane
        </Link>
        {open ? (
          <>
            <h1 className="mt-6 text-xl font-semibold">
              Create the owner account
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              First signup on this install becomes the agency owner. Signup locks
              after that.
            </p>
            <div className="mt-6">
              <AuthForm mode="signup" />
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-xl font-semibold">Signup is locked</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This self-hosted Pinlane already has an owner. Log in with that
              account — public signup stays closed so clients can&apos;t create
              agency workspaces.
            </p>
            <Button className="mt-6 w-full" render={<Link href="/login" />}>
              Go to log in
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
