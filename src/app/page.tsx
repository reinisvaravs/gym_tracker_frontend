import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Track every rep.
        </h1>
        <p className="text-muted-foreground max-w-md text-balance">
          Log your workouts, watch your lifts climb, and keep the streak alive.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/signup" className={buttonVariants({ size: "lg" })}>
          Sign up
        </Link>
        <Link
          href="/login"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          Login
        </Link>
      </div>
    </main>
  );
}
