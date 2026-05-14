import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe, tierFromPriceId } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig ?? '', env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: 'Invalid Stripe signature' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const supabaseUserId = session.metadata?.supabase_user_id;
      const subscriptionId = session.subscription as string | null;

      if (!supabaseUserId || !subscriptionId) break;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const item = subscription.items.data[0];
      const priceId = item?.price.id ?? '';
      const tier = tierFromPriceId(priceId);
      // In Stripe SDK v22+, current_period_end is on each SubscriptionItem, not the Subscription.
      const rawPeriodEnd = (item as { current_period_end?: number } | undefined)?.current_period_end;

      await supabase
        .from('profiles')
        .update({
          stripe_customer_id:               session.customer as string,
          stripe_subscription_id:           subscriptionId,
          subscription_tier:                tier,
          subscription_period_end:          rawPeriodEnd ? new Date(rawPeriodEnd * 1000).toISOString() : null,
          subscription_cancel_at_period_end: subscription.cancel_at_period_end,
        } as never)
        .eq('id', supabaseUserId);
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const subItem = sub.items.data[0];
      const priceId = subItem?.price.id ?? '';
      // In Stripe SDK v22+, current_period_end is on each SubscriptionItem.
      const rawSubPeriodEnd = (subItem as { current_period_end?: number } | undefined)?.current_period_end;
      const periodEnd = rawSubPeriodEnd ? new Date(rawSubPeriodEnd * 1000).toISOString() : null;

      if (sub.status === 'canceled' || sub.status === 'unpaid') {
        await supabase
          .from('profiles')
          .update({
            subscription_tier:                'free',
            stripe_subscription_id:           null,
            subscription_period_end:          null,
            subscription_cancel_at_period_end: false,
          } as never)
          .eq('stripe_customer_id', sub.customer as string);
      } else if (sub.status === 'past_due') {
        // Grace period — do not change tier; only update period end + cancel flag
        await supabase
          .from('profiles')
          .update({
            subscription_period_end:          periodEnd,
            subscription_cancel_at_period_end: sub.cancel_at_period_end,
          } as never)
          .eq('stripe_customer_id', sub.customer as string);
      } else {
        await supabase
          .from('profiles')
          .update({
            subscription_tier:                tierFromPriceId(priceId),
            stripe_subscription_id:           sub.id,
            subscription_period_end:          periodEnd,
            subscription_cancel_at_period_end: sub.cancel_at_period_end,
          } as never)
          .eq('stripe_customer_id', sub.customer as string);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await supabase
        .from('profiles')
        .update({
          subscription_tier:                'free',
          stripe_subscription_id:           null,
          subscription_period_end:          null,
          subscription_cancel_at_period_end: false,
        } as never)
        .eq('stripe_customer_id', sub.customer as string);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
