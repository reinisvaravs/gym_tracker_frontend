"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<typeof Card>) {
  const router = useRouter();

  // handle form submission
  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    // show inline error messages below fields but using alert for now

    // validate full name
    if (!data.fullName) {
      alert("Full name is required");
      return;
    }

    // validate email
    if (!data.email) {
      alert("Email is required");
      return;
    }

    // validate password and confirm password
    if (data.password !== data["confirmPassword"]) {
      alert("Passwords do not match");
      return;
    }

    // validate password length
    if (typeof data.password !== "string" || data.password.length < 8) {
      alert("Password must be at least 8 characters long");
      return;
    }

    // send data to backend
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include", // include cookies in the request
          body: JSON.stringify(data),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        alert(errorData.message || "An error occurred while registering.");
        return;
      }

      // redirect to home
      router.push("/home");
    } catch (error) {
      console.error("Error registering user:", error);
      alert("An error occurred while registering. Please try again.");
    }

    return;
  };

  return (
    <Card className={className} {...props}>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Enter your information below to create your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignup}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="fullName">Full Name</FieldLabel>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="John Doe"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="m@example.com"
                required
              />
              <FieldDescription>
                We&apos;ll use this to contact you. We will not share your email
                with anyone else.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input id="password" name="password" type="password" required />
              <FieldDescription>
                Must be at least 8 characters long.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="confirmPassword">
                Confirm Password
              </FieldLabel>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
              />
              <FieldDescription>Please confirm your password.</FieldDescription>
            </Field>
            <Field>
              <Button type="submit">Create Account</Button>
              <Button variant="outline" type="button">
                Sign up with Google
              </Button>
              <FieldDescription className="px-6 text-center">
                Already have an account? <Link href="/login">Login</Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
