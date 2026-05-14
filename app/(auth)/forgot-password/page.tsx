import Link from 'next/link';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { env } from '@/lib/env';

export const metadata = {
  title: 'Reset password · Elevate Coaching',
};

/**
 * Forgot-password stub.
 *
 * The Supabase password-reset flow (request OTP → set new password via
 * the same `/auth/confirm` route) ships in SP-2 alongside the rest of
 * the profile work. Until then, route users to their coach so they
 * don't hit a 404 from the sign-in form's "Forgot password?" link.
 */
export default function ForgotPasswordPage() {
  const whatsappHref = `https://wa.me/${env.NEXT_PUBLIC_COACH_WHATSAPP}`;

  return (
    <Card className="bg-surface border-border">
      <CardHeader>
        <CardTitle className="text-text font-heading text-xl">Reset your password</CardTitle>
        <CardDescription className="text-text-muted">
          Self-serve password reset is coming in the next release.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-text-muted text-sm leading-relaxed">
          In the meantime, message your coach and they&apos;ll get you back into your account within
          the hour.
        </p>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-accent text-accent-fg hover:bg-accent/25 hover:text-white hover:border-accent inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          Message your coach on WhatsApp
        </a>
        <Link
          href="/sign-in"
          className="text-text-muted hover:text-text inline-flex items-center gap-1 text-xs"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to sign in
        </Link>
      </CardContent>
    </Card>
  );
}
