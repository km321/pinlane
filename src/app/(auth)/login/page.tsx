import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border bg-white/90 p-8 shadow-xl shadow-[#0b1f2a]/5 backdrop-blur">
        <Link href="/" className="font-heading text-2xl font-bold">
          Pinlane
        </Link>
        <h1 className="mt-6 text-xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Log in to your agency workspace.
        </p>
        <div className="mt-6">
          <AuthForm mode="login" />
        </div>
      </div>
    </div>
  );
}
