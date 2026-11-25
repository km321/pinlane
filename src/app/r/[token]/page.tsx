import { redirect } from "next/navigation";
import { ReviewClaimForm } from "@/components/review-claim-form";
import { brandingFromWorkspace } from "@/lib/branding";
import {
  createReviewSession,
  loadReviewInvite,
} from "@/lib/review-claim";

export const dynamic = "force-dynamic";

function Unavailable({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f6f8] px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[#d5dee5] bg-white p-8 shadow-xl">
        <h1 className="text-xl font-semibold">Invite unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

export default async function ReviewClaimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const loaded = await loadReviewInvite(token);

  if (!loaded.ok) {
    return <Unavailable message={loaded.error} />;
  }

  const { invite, project, workspace } = loaded;
  const branding = brandingFromWorkspace(workspace);
  const assigned = invite.assignedName?.trim();

  // Named links: claim + redirect on the server so reviewers never see a
  // Pinlane flash before their agency branding / the live site.
  if (assigned) {
    const session = await createReviewSession(
      invite.id,
      assigned,
      project.siteUrl,
      project.publicKey,
    );
    redirect(session.redirectUrl);
  }

  return (
    <ReviewClaimForm
      token={token}
      inviteLabel={invite.label}
      projectName={project.name}
      branding={branding}
    />
  );
}
