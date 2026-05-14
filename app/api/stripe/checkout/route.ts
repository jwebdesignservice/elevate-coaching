import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';
import { stripe, PRICE_IDS } from '@/lib/stripe';

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { priceId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const validPriceIds = Object.values(PRICE_IDS);
  if (!body.priceId || !validPriceIds.includes(body.priceId)) {
    return NextResponse.json({ error: 'Invalid price ID' }, { status: 400 });
  }

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('stripe_customer_id, email')
    .eq('id', user.id)
    .single();
  const profile = profileRaw as { stripe_customer_id: string | null; email: string } | null;

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  let stripeCustomerId = profile.stripe_customer_id;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: profile.email,
      metadata: { supabase_user_id: user.id },
    });
    stripeCustomerId = customer.id;
    const admin = createSupabaseAdminClient();
    await admin
      .from('profiles')
      .update({ stripe_customer_id: stripeCustomerId } as never)
      .eq('id', user.id);
  }

  const origin = new URL(req.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{ price: body.priceId, quantity: 1 }],
    success_url: `${origin}/settings?plan=upgraded`,
    cancel_url:  `${origin}/pricing`,
    metadata: { supabase_user_id: user.id },
  });

  return NextResponse.json({ url: session.url });
}
