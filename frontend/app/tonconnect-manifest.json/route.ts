import { NextResponse } from 'next/server';
export function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return NextResponse.json({ url: appUrl, name: 'YIRS Blockchain Revenue System', iconUrl: `${appUrl}/yirs-icon.png`, termsOfUseUrl: `${appUrl}/terms`, privacyPolicyUrl: `${appUrl}/privacy` });
}
