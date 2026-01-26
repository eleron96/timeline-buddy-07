import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:5173";
const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
const resendFrom = Deno.env.get("RESEND_FROM") ?? "Workspace <no-reply@example.com>";
const reserveAdminEmail = (Deno.env.get("RESERVE_ADMIN_EMAIL") ?? "").trim().toLowerCase();
const reserveAdminPassword = Deno.env.get("RESERVE_ADMIN_PASSWORD") ?? "";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

let reserveAdminSynced = false;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getRouteName = (req: Request) => {
  const { pathname } = new URL(req.url);
  const segments = pathname.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? "";
};

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

const ensureAdmin = async (userId: string) => {
  const { data, error } = await supabaseAdmin
    .from("super_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return false;
  return true;
};

const findUserByEmail = async (email: string) => {
  const target = email.trim().toLowerCase();
  if (!target) return { user: null as { id?: string } | null };
  const perPage = 1000;
  let page = 1;

  while (page <= 50) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error || !data) {
      return { error: error?.message ?? "Failed to list users." };
    }

    const match = data.users.find((user) => (user.email ?? "").toLowerCase() === target);
    if (match) {
      return { user: match };
    }

    if (data.users.length < perPage) {
      break;
    }
    page += 1;
  }

  return { user: null };
};

const ensureReserveAdminAccount = async () => {
  if (!reserveAdminEmail || !reserveAdminPassword) {
    return { error: "RESERVE_ADMIN_EMAIL or RESERVE_ADMIN_PASSWORD is not configured." };
  }

  let reserveUserId: string | null = null;
  const existing = await findUserByEmail(reserveAdminEmail);
  if ("error" in existing) {
    return { error: existing.error };
  }

  if (existing.user?.id) {
    reserveUserId = existing.user.id;
  } else {
    const createResult = await supabaseAdmin.auth.admin.createUser({
      email: reserveAdminEmail,
      password: reserveAdminPassword,
      email_confirm: true,
    });
    if (createResult.error || !createResult.data?.user?.id) {
      return { error: createResult.error?.message ?? "Failed to create reserve admin." };
    }
    reserveUserId = createResult.data.user.id;
  }

  if (!reserveUserId) {
    return { error: "Failed to resolve reserve admin user." };
  }

  const updateResult = await supabaseAdmin.auth.admin.updateUserById(reserveUserId, {
    password: reserveAdminPassword,
  });
  if (updateResult.error) {
    return { error: updateResult.error.message };
  }

  const { error: membershipDelete } = await supabaseAdmin
    .from("workspace_members")
    .delete()
    .eq("user_id", reserveUserId);
  if (membershipDelete) {
    return { error: membershipDelete.message };
  }

  const { error: superAdminInsertError } = await supabaseAdmin
    .from("super_admins")
    .upsert({ user_id: reserveUserId });
  if (superAdminInsertError) {
    return { error: superAdminInsertError.message };
  }

  return { userId: reserveUserId, email: reserveAdminEmail };
};

const ensureReserveAdminOnce = async () => {
  if (reserveAdminSynced) return;
  if (!reserveAdminEmail || !reserveAdminPassword) return;

  const result = await ensureReserveAdminAccount();
  if ("error" in result) {
    console.error("Reserve admin setup failed:", result.error);
    return;
  }

  reserveAdminSynced = true;
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

  const { data: payload, error } = await readJson<{ workspaceId?: string; email?: string; role?: string }>(req);
  if (error) {
    return jsonResponse({ error }, 400);
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
};

const handleAdminUsers = async (req: Request) => {
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

  const isAdmin = await ensureAdmin(authResult.user.id);
  if (!isAdmin) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const { data: payload } = await readJson<{ page?: number; perPage?: number }>(req);
  const page = payload?.page && payload.page > 0 ? payload.page : 1;
  const perPage = payload?.perPage && payload.perPage > 0 ? payload.perPage : 200;

  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
  if (error || !data) {
    return jsonResponse({ error: error?.message ?? "Failed to load users." }, 400);
  }

  const users = data.users
    .filter((user) => {
      // Скрываем резервного админа из списка пользователей
      if (!reserveAdminEmail || !user.email) return true;
      return user.email.trim().toLowerCase() !== reserveAdminEmail;
    })
    .map((user) => ({
      id: user.id,
      email: user.email ?? null,
      createdAt: user.created_at ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
    }));

  return jsonResponse({ users, total: data.total ?? users.length });
};

const handleAdminDelete = async (req: Request) => {
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

  const isAdmin = await ensureAdmin(authResult.user.id);
  if (!isAdmin) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const { data: payload, error } = await readJson<{ userId?: string }>(req);
  if (error) {
    return jsonResponse({ error }, 400);
  }

  const userId = payload.userId?.trim();
  if (!userId) {
    return jsonResponse({ error: "userId is required" }, 400);
  }

  if (userId === authResult.user.id) {
    return jsonResponse({ error: "You cannot delete your own account." }, 400);
  }

  if (reserveAdminEmail) {
    const reserveUser = await findUserByEmail(reserveAdminEmail);
    if ("error" in reserveUser) {
      return jsonResponse({ error: reserveUser.error }, 400);
    }
    if (reserveUser.user?.id && reserveUser.user.id === userId) {
      return jsonResponse({ error: "Cannot delete reserve admin account." }, 400);
    }
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return jsonResponse({ error: deleteError.message }, 400);
  }

  return jsonResponse({ success: true });
};

const handleAdminReset = async (req: Request) => {
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

  const isAdmin = await ensureAdmin(authResult.user.id);
  if (!isAdmin) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const { data: payload, error } = await readJson<{ userId?: string; password?: string }>(req);
  if (error) {
    return jsonResponse({ error }, 400);
  }

  const userId = payload.userId?.trim();
  const password = payload.password?.trim();

  if (!userId || !password) {
    return jsonResponse({ error: "userId and password are required" }, 400);
  }

  if (password.length < 6) {
    return jsonResponse({ error: "Password must be at least 6 characters." }, 400);
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
  if (updateError) {
    return jsonResponse({ error: updateError.message }, 400);
  }

  return jsonResponse({ success: true });
};

const handleAdminEnsureReserve = async (req: Request) => {
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

  const isAdmin = await ensureAdmin(authResult.user.id);
  if (!isAdmin) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const result = await ensureReserveAdminAccount();
  if ("error" in result) {
    return jsonResponse({ error: result.error }, 400);
  }

  return jsonResponse({ success: true, ...result });
};

export const handler = async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  await ensureReserveAdminOnce();

  const route = getRouteName(req);
  if (route === "invite") return handleInvite(req);
  if (route === "admin-users") return handleAdminUsers(req);
  if (route === "admin-delete") return handleAdminDelete(req);
  if (route === "admin-reset") return handleAdminReset(req);
  if (route === "admin-reserve") return handleAdminEnsureReserve(req);

  return jsonResponse({ error: "Not found" }, 404);
};

if (import.meta.main) {
  serve(handler);
}
