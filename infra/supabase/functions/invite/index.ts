import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import {
  APP_REALM_ROLES,
  type AppRealmRole,
  ensureKeycloakReady,
  ensureKeycloakUser,
  ensureRealmRoles,
  getKeycloakConfig,
  sendKeycloakExecuteActionsEmail,
  syncUserRealmRoles,
} from "../_shared/keycloak.ts";
import {
  createSupabaseClients,
  ensureKeycloakIdentityLink,
  ensureSupabaseUserByEmail,
  getRoleSnapshotMap,
  type WorkspaceRole,
} from "../_shared/supabaseAuth.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const appUrl = (Deno.env.get("APP_URL") ?? "http://localhost:5173").replace(/\/+$/, "");

const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
const resendFrom = Deno.env.get("RESEND_FROM") ?? "Workspace <no-reply@example.com>";

const keycloakConfig = getKeycloakConfig();
const keycloakIssuer = `${keycloakConfig.baseUrl}/realms/${keycloakConfig.realm}`;

const { supabaseAdmin } = createSupabaseClients(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const workspaceRoleToRealmRole: Record<WorkspaceRole, AppRealmRole> = {
  viewer: "app_workspace_viewer",
  editor: "app_workspace_editor",
  admin: "app_workspace_admin",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const readJson = async <T>(req: Request) => {
  try {
    return { data: (await req.json()) as T };
  } catch (_error) {
    return { error: "Invalid JSON body" };
  }
};

const getAuthUser = async (req: Request) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return { error: "Unauthorized", status: 401 };

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) {
    return { error: "Unauthorized", status: 401 };
  }
  return { user: authData.user };
};

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
      subject: `You were invited to ${workspaceName}`,
      html: `
        <p>You were invited to join <strong>${workspaceName}</strong>.</p>
        <p>Open application: <a href="${link}">${link}</a></p>
        <p>Authentication is handled by Keycloak. Use your Keycloak account to sign in.</p>
      `,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return { sent: false, warning: text || "Invite email failed." };
  }

  return { sent: true };
};

const buildDesiredRealmRoles = async (userId: string) => {
  const snapshotResult = await getRoleSnapshotMap(supabaseAdmin, [userId]);
  if ("error" in snapshotResult) {
    return { error: snapshotResult.error };
  }

  const snapshot = snapshotResult.roleMap.get(userId);
  const roles = new Set<AppRealmRole>();
  if (snapshot?.isSuperAdmin) {
    roles.add("app_super_admin");
  }
  snapshot?.workspaceRoles.forEach((role) => {
    roles.add(workspaceRoleToRealmRole[role]);
  });

  return { roles: Array.from(roles) };
};

const ensureLinkedUserByEmail = async (email: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return { error: "Email is required." };
  }

  const keycloakReady = ensureKeycloakReady(keycloakConfig);
  if ("error" in keycloakReady) {
    return { error: keycloakReady.error };
  }

  const rolesResult = await ensureRealmRoles(keycloakConfig, APP_REALM_ROLES);
  if ("error" in rolesResult) {
    return { error: rolesResult.error };
  }

  const keycloakResult = await ensureKeycloakUser(keycloakConfig, {
    email: normalizedEmail,
    enabled: true,
    emailVerified: true,
    requiredActions: ["UPDATE_PASSWORD"],
  });

  if ("error" in keycloakResult || !keycloakResult.user) {
    return { error: "error" in keycloakResult ? keycloakResult.error : "Failed to resolve Keycloak user." };
  }

  const authResult = await ensureSupabaseUserByEmail(supabaseAdmin, normalizedEmail);
  if ("error" in authResult || !authResult.user) {
    return { error: "error" in authResult ? authResult.error : "Failed to resolve Supabase user." };
  }

  const linkResult = await ensureKeycloakIdentityLink(
    supabaseAdmin,
    {
      supabaseUserId: authResult.user.id,
      email: normalizedEmail,
      keycloakUserId: keycloakResult.user.id,
      issuer: keycloakIssuer,
    },
  );

  if ("error" in linkResult) {
    return linkResult;
  }

  return {
    userId: authResult.user.id,
    email: normalizedEmail,
    keycloakUserId: keycloakResult.user.id,
    keycloakCreated: keycloakResult.created,
  };
};

const handleInvite = async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Missing Supabase env vars" }, 500);
  }

  const authResult = await getAuthUser(req);
  if ("error" in authResult) {
    return jsonResponse({ error: authResult.error }, authResult.status ?? 401);
  }

  const { data: payload, error } = await readJson<{
    workspaceId?: string;
    email?: string;
    role?: WorkspaceRole;
    groupId?: string | null;
  }>(req);
  if (error) {
    return jsonResponse({ error }, 400);
  }

  const workspaceId = payload.workspaceId?.trim();
  const email = payload.email?.trim().toLowerCase();
  const role = payload.role ?? "viewer";
  const groupId = payload.groupId?.trim() || null;

  if (!workspaceId || !email) {
    return jsonResponse({ error: "workspaceId and email are required" }, 400);
  }

  if (!["viewer", "editor", "admin"].includes(role)) {
    return jsonResponse({ error: "Invalid role" }, 400);
  }

  const { data: adminMembership, error: membershipError } = await supabaseAdmin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", authResult.user.id)
    .maybeSingle();

  if (membershipError || adminMembership?.role !== "admin") {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const { data: workspace } = await supabaseAdmin
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .maybeSingle();

  if (groupId) {
    const { data: group, error: groupError } = await supabaseAdmin
      .from("member_groups")
      .select("id")
      .eq("id", groupId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (groupError || !group) {
      return jsonResponse({ error: "Group not found." }, 400);
    }
  }

  const linked = await ensureLinkedUserByEmail(email);
  if ("error" in linked) {
    return jsonResponse({ error: linked.error }, 400);
  }

  const { error: membershipInsertError } = await supabaseAdmin
    .from("workspace_members")
    .upsert({ workspace_id: workspaceId, user_id: linked.userId, role, group_id: groupId });

  if (membershipInsertError) {
    return jsonResponse({ error: membershipInsertError.message }, 400);
  }

  const desiredRolesResult = await buildDesiredRealmRoles(linked.userId);
  if ("error" in desiredRolesResult) {
    return jsonResponse({ error: desiredRolesResult.error }, 400);
  }

  const roleSyncResult = await syncUserRealmRoles(
    keycloakConfig,
    linked.keycloakUserId,
    desiredRolesResult.roles,
    APP_REALM_ROLES,
  );

  if ("error" in roleSyncResult) {
    return jsonResponse({ error: roleSyncResult.error }, 400);
  }

  const warnings: string[] = [];
  if (linked.keycloakCreated) {
    const actionsResult = await sendKeycloakExecuteActionsEmail(keycloakConfig, linked.keycloakUserId, ["UPDATE_PASSWORD"]);
    if ("error" in actionsResult) {
      warnings.push(`Keycloak setup email was not sent: ${actionsResult.error}`);
    }
  }

  const inviteLink = `${appUrl}/invite/${workspaceId}`;
  const workspaceName = workspace?.name ?? "workspace";
  const emailResult = await sendInviteEmail(email, workspaceName, inviteLink);
  if (!emailResult.sent && emailResult.warning) {
    warnings.push(emailResult.warning);
  }

  return jsonResponse({
    success: true,
    actionLink: inviteLink,
    warning: warnings.length > 0 ? warnings.join(" ") : undefined,
  });
};

export const handler = async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return handleInvite(req);
};

if (import.meta.main) {
  serve(handler);
}
