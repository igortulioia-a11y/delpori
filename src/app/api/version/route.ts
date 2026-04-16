import { NextResponse } from "next/server";

// Endpoint lido pelo VersionChecker a cada 5 min + visibilitychange.
// Se a versao mudar entre polls, o cliente mostra banner "Nova versao disponivel".
// Evita que usuario bata em ChunkLoadError apos deploy.

export const dynamic = "force-dynamic";

export async function GET() {
  const version =
    process.env.VERCEL_DEPLOYMENT_ID ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    "dev";

  return NextResponse.json(
    { version },
    {
      headers: {
        "Cache-Control": "no-store, must-revalidate",
      },
    }
  );
}
