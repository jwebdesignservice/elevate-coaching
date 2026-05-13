// app/api/_debug/sentry/route.ts — REMOVE AFTER VERIFICATION (Task 42)
import { NextResponse } from 'next/server';

export async function GET() {
  throw new Error('SP-1 Sentry test — this error is expected.');
  return NextResponse.json({ ok: true });
}
