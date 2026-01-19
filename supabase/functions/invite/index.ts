import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:5173";
const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
const resendFrom = Deno.env.get("RESEND_FROM") ?? "Workspace <no-reply@example.com>";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sendInviteEmail = async (email: string, workspaceName: string, link: string) => {
  if (!resendApiKey) {
    return { sent: false, warning: "RESEND_API_KEY is not configured." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [email],
      subject: `You're invited to ${workspaceName}`,
      html: `
        <p>You have been invited to join <strong>${workspaceName}</strong>.</p>
        <p><a href="${link}">Accept invitation</a></p>
      `,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return { sent: false, warning: text || "Invite email failed." };
  }

  return { sent: true };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Missing Supabase env vars" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let payload: { workspaceId?: string; email?: string; role?: string } = {};
  try {
    payload = await req.json();
  } catch (_error) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const workspaceId = payload.workspaceId?.trim();
  const email = payload.email?.trim().toLowerCase();
  const role = payload.role ?? "viewer";

  if (!workspaceId || !email) {
    return jsonResponse({ error: "workspaceId and email are required" }, 400);
  }

  if (!['viewer', 'editor', 'admin'].includes(role)) {
    return jsonResponse({ error: "Invalid role" }, 400);
  }

  const { data: adminMembership, error: membershipError } = await supabaseAdmin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (membershipError || adminMembership?.role !== "admin") {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const { data: workspace } = await supabaseAdmin
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .maybeSingle();

  const workspaceName = workspace?.name ?? "workspace";
  const redirectTo = `${appUrl}/invite/${workspaceId}`;

  let invitedUserId: string | null = null;
  let actionLink: string | null = null;

  const inviteResult = await supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (inviteResult.error) {
    const inviteLinkResult = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo },
    });

    if (!inviteLinkResult.error && inviteLinkResult.data?.user?.id) {
      invitedUserId = inviteLinkResult.data.user.id;
      actionLink = inviteLinkResult.data?.properties?.action_link ?? null;
    } else {
      const magicLinkResult = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo },
      });

      if (magicLinkResult.error || !magicLinkResult.data?.user?.id) {
        return jsonResponse(
          { error: magicLinkResult.error?.message ?? inviteLinkResult.error?.message ?? inviteResult.error.message },
          400,
        );
      }

      invitedUserId = magicLinkResult.data.user.id;
      actionLink = magicLinkResult.data?.properties?.action_link ?? null;
    }
  } else {
    invitedUserId = inviteResult.data.user?.id ?? null;
  }

  if (!invitedUserId) {
    return jsonResponse({ error: "Unable to resolve invited user" }, 500);
  }

  const { error: membershipInsertError } = await supabaseAdmin
    .from("workspace_members")
    .upsert({ workspace_id: workspaceId, user_id: invitedUserId, role });

  if (membershipInsertError) {
    return jsonResponse({ error: membershipInsertError.message }, 400);
  }

  if (actionLink) {
    const emailResult = await sendInviteEmail(email, workspaceName, actionLink);
    if (!emailResult.sent) {
      return jsonResponse({
        success: true,
        actionLink,
        warning: emailResult.warning ?? "Invite link created.",
      }, 200);
    }
  }

  return jsonResponse({ success: true, actionLink });
});
