import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isSignupOpen } from "@/lib/signup-gate";

export async function HomeCta() {
  const open = await isSignupOpen();

  return (
    <div className="mt-8 flex flex-wrap gap-3">
      {open ? (
        <>
          <Button size="lg" render={<Link href="/signup" />}>
            Create owner account
          </Button>
          <Button size="lg" variant="outline" render={<Link href="/login" />}>
            I already have an account
          </Button>
        </>
      ) : (
        <Button size="lg" render={<Link href="/login" />}>
          Log in to workspace
        </Button>
      )}
    </div>
  );
}

export async function HomeHeaderActions() {
  const open = await isSignupOpen();

  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" render={<Link href="/login" />}>
        Log in
      </Button>
      {open ? (
        <Button render={<Link href="/signup" />}>Start install</Button>
      ) : null}
    </div>
  );
}
