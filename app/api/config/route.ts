/**
 * Config API Route (Simplified)
 * Only returns non-auth configuration now.
 * Auth has moved to /api/auth.
 */

import { NextResponse } from 'next/server';
import { getEnvVar } from '@/lib/env';

export const runtime = 'edge';

export async function GET() {
    const SUBSCRIPTION_SOURCES = getEnvVar('SUBSCRIPTION_SOURCES') || getEnvVar('NEXT_PUBLIC_SUBSCRIPTION_SOURCES');
    return NextResponse.json({
        subscriptionSources: SUBSCRIPTION_SOURCES,
    });
}
