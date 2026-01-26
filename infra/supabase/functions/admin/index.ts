import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
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

const ensureSuperAdmin = async (userId: string) => {
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

const listSuperAdminIds = async () => {
  const { data, error } = await supabaseAdmin
    .from("super_admins")
    .select("user_id");
  if (error) {
    return { error: error.message, userIds: [] as string[] };
  }
  return { userIds: (data ?? []).map((row) => row.user_id) };
};

const ensureSuperAdminUser = async (userId: string) => {
  const { data, error } = await supabaseAdmin
    .from("super_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return false;
  return true;
};

const removeUserFromWorkspaces = async (userId: string) => {
  const { error } = await supabaseAdmin
    .from("workspace_members")
    .delete()
    .eq("user_id", userId);
  if (error) {
    return { error: error.message };
  }
  return {};
};

const handleUsersList = async (payload: { page?: number; perPage?: number; search?: string; loadAll?: boolean }) => {
  const page = payload.page && payload.page > 0 ? payload.page : 1;
  const perPage = payload.perPage && payload.perPage > 0 ? payload.perPage : 200;
  const search = payload.search?.trim().toLowerCase() ?? "";
  const shouldScanAll = Boolean(payload.loadAll || search);
  const maxPages = 50;
  const effectivePerPage = shouldScanAll ? Math.min(perPage, 1000) : perPage;

  let users: Array<{
    id: string;
    email?: string | null;
    created_at?: string | null;
    last_sign_in_at?: string | null;
  }> = [];
  let total = 0;

  if (shouldScanAll) {
    let currentPage = 1;
    while (currentPage <= maxPages) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page: currentPage,
        perPage: effectivePerPage,
      });
      if (error || !data) {
        return jsonResponse({ error: error?.message ?? "Failed to load users." }, 400);
      }
      users = users.concat(data.users);
      total = data.total ?? users.length;
      if (data.users.length < effectivePerPage) break;
      currentPage += 1;
    }
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: effectivePerPage,
    });
    if (error || !data) {
      return jsonResponse({ error: error?.message ?? "Failed to load users." }, 400);
    }
    users = data.users;
    total = data.total ?? users.length;
  }

  const { userIds: superAdminIds } = await listSuperAdminIds();
  const superAdminSet = new Set(superAdminIds);

  if (reserveAdminEmail) {
    const reserveUser = await findUserByEmail(reserveAdminEmail);
    if ("error" in reserveUser) {
      return jsonResponse({ error: reserveUser.error }, 400);
    }
    if (reserveUser.user?.id) {
      superAdminSet.add(reserveUser.user.id);
    }
  }

  const visibleUsers = users.filter((user) => !superAdminSet.has(user.id));
  const userIds = visibleUsers.map((user) => user.id);

  if (userIds.length === 0) {
    return jsonResponse({ users: [], total: 0 });
  }

  const [{ data: profiles }, { data: memberships }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, display_name, email")
      .in("id", userIds),
    supabaseAdmin
      .from("workspace_members")
      .select("user_id, role, workspace_id, workspaces(id, name)")
      .in("user_id", userIds),
  ]);

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );

  const workspaceMap = new Map<string, Array<{ id: string; name: string; role: string }>>();
  (memberships ?? []).forEach((row) => {
    const list = workspaceMap.get(row.user_id) ?? [];
    list.push({
      id: row.workspace_id,
      name: row.workspaces?.name ?? "Workspace",
      role: row.role,
    });
    workspaceMap.set(row.user_id, list);
  });

  let result = visibleUsers.map((user) => {
    const profile = profileMap.get(user.id);
    const workspaces = workspaceMap.get(user.id) ?? [];
    return {
      id: user.id,
      email: user.email ?? profile?.email ?? null,
      displayName: profile?.display_name ?? null,
      createdAt: user.created_at ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
      workspaceCount: workspaces.length,
      workspaces,
    };
  });

  if (search) {
    result = result.filter((item) => {
      const workspaceNames = item.workspaces.map((workspace) => workspace.name.toLowerCase());
      return (
        (item.email ?? "").toLowerCase().includes(search)
        || item.id.toLowerCase().includes(search)
        || (item.displayName ?? "").toLowerCase().includes(search)
        || workspaceNames.some((name) => name.includes(search))
      );
    });
  }

  return jsonResponse({ users: result, total: search ? result.length : total });
};

const handleUsersCreate = async (payload: { email?: string; password?: string; displayName?: string; superAdmin?: boolean }) => {
  const email = payload.email?.trim().toLowerCase() ?? "";
  const password = payload.password?.trim() ?? "";
  if (!email || !password) {
    return jsonResponse({ error: "email and password are required" }, 400);
  }
  if (password.length < 6) {
    return jsonResponse({ error: "Password must be at least 6 characters." }, 400);
  }

  const createResult = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createResult.error || !createResult.data?.user?.id) {
    return jsonResponse({ error: createResult.error?.message ?? "Failed to create user." }, 400);
  }

  const userId = createResult.data.user.id;
  const displayName = payload.displayName?.trim();
  if (displayName) {
    await supabaseAdmin
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", userId);
  }

  if (payload.superAdmin) {
    const { error: superAdminError } = await supabaseAdmin
      .from("super_admins")
      .upsert({ user_id: userId });
    if (superAdminError) {
      return jsonResponse({ error: superAdminError.message }, 400);
    }
    const result = await removeUserFromWorkspaces(userId);
    if ("error" in result) {
      return jsonResponse({ error: result.error }, 400);
    }
  }

  return jsonResponse({
    user: {
      id: userId,
      email,
      displayName: displayName ?? null,
    },
  });
};

const handleUsersUpdate = async (payload: { userId?: string; email?: string; password?: string; displayName?: string; superAdmin?: boolean }) => {
  const userId = payload.userId?.trim() ?? "";
  if (!userId) {
    return jsonResponse({ error: "userId is required" }, 400);
  }

  const email = payload.email?.trim().toLowerCase();
  const password = payload.password?.trim();
  const displayName = payload.displayName?.trim();

  if (email || password) {
    const updateResult = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ...(email ? { email, email_confirm: true } : {}),
      ...(password ? { password } : {}),
    });
    if (updateResult.error) {
      return jsonResponse({ error: updateResult.error.message }, 400);
    }
  }

  if (displayName !== undefined || email !== undefined) {
    const profileUpdates: Record<string, string | null> = {};
    if (displayName !== undefined) {
      profileUpdates.display_name = displayName.length > 0 ? displayName : null;
    }
    if (email !== undefined) {
      profileUpdates.email = email;
    }
    if (Object.keys(profileUpdates).length > 0) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdates)
        .eq("id", userId);
      if (error) {
        return jsonResponse({ error: error.message }, 400);
      }
    }
  }

  if (payload.superAdmin !== undefined) {
    if (payload.superAdmin) {
      const { error } = await supabaseAdmin
        .from("super_admins")
        .upsert({ user_id: userId });
      if (error) {
        return jsonResponse({ error: error.message }, 400);
      }
      const result = await removeUserFromWorkspaces(userId);
      if ("error" in result) {
        return jsonResponse({ error: result.error }, 400);
      }
    } else {
      const { error } = await supabaseAdmin
        .from("super_admins")
        .delete()
        .eq("user_id", userId);
      if (error) {
        return jsonResponse({ error: error.message }, 400);
      }
    }
  }

  return jsonResponse({ success: true });
};

const handleUsersResetPassword = async (payload: { userId?: string; password?: string }) => {
  const userId = payload.userId?.trim() ?? "";
  const password = payload.password?.trim() ?? "";

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

const handleUsersDelete = async (payload: { userId?: string }, currentUserId: string) => {
  const userId = payload.userId?.trim() ?? "";
  if (!userId) {
    return jsonResponse({ error: "userId is required" }, 400);
  }
  if (userId === currentUserId) {
    return jsonResponse({ error: "You cannot delete your own account." }, 400);
  }

  if (await ensureSuperAdminUser(userId)) {
    return jsonResponse({ error: "Cannot delete a super admin account." }, 400);
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

const handleWorkspacesList = async () => {
  const { data: workspaces, error } = await supabaseAdmin
    .from("workspaces")
    .select("id, name, owner_id, created_at");
  if (error) {
    return jsonResponse({ error: error.message }, 400);
  }

  const workspaceIds = (workspaces ?? []).map((workspace) => workspace.id);
  const ownerIds = Array.from(new Set((workspaces ?? []).map((workspace) => workspace.owner_id)));

  if (workspaceIds.length === 0) {
    return jsonResponse({ workspaces: [] });
  }

  const [{ data: members }, { data: tasks }, { data: owners }] = await Promise.all([
    supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .in("workspace_id", workspaceIds),
    supabaseAdmin
      .from("tasks")
      .select("workspace_id")
      .in("workspace_id", workspaceIds),
    supabaseAdmin
      .from("profiles")
      .select("id, email, display_name")
      .in("id", ownerIds),
  ]);

  const memberCounts = new Map<string, number>();
  (members ?? []).forEach((row) => {
    memberCounts.set(row.workspace_id, (memberCounts.get(row.workspace_id) ?? 0) + 1);
  });

  const taskCounts = new Map<string, number>();
  (tasks ?? []).forEach((row) => {
    taskCounts.set(row.workspace_id, (taskCounts.get(row.workspace_id) ?? 0) + 1);
  });

  const ownerMap = new Map(
    (owners ?? []).map((owner) => [owner.id, owner]),
  );

  const result = (workspaces ?? []).map((workspace) => {
    const owner = ownerMap.get(workspace.owner_id);
    return {
      id: workspace.id,
      name: workspace.name,
      ownerId: workspace.owner_id,
      ownerEmail: owner?.email ?? null,
      ownerDisplayName: owner?.display_name ?? null,
      membersCount: memberCounts.get(workspace.id) ?? 0,
      tasksCount: taskCounts.get(workspace.id) ?? 0,
      createdAt: workspace.created_at ?? null,
    };
  });

  return jsonResponse({ workspaces: result });
};

const handleWorkspacesUpdate = async (payload: { workspaceId?: string; name?: string }) => {
  const workspaceId = payload.workspaceId?.trim() ?? "";
  const name = payload.name?.trim() ?? "";
  if (!workspaceId || !name) {
    return jsonResponse({ error: "workspaceId and name are required" }, 400);
  }

  const { error } = await supabaseAdmin
    .from("workspaces")
    .update({ name })
    .eq("id", workspaceId);
  if (error) {
    return jsonResponse({ error: error.message }, 400);
  }

  return jsonResponse({ success: true });
};

const handleWorkspacesDelete = async (payload: { workspaceId?: string }) => {
  const workspaceId = payload.workspaceId?.trim() ?? "";
  if (!workspaceId) {
    return jsonResponse({ error: "workspaceId is required" }, 400);
  }

  const { error } = await supabaseAdmin
    .from("workspaces")
    .delete()
    .eq("id", workspaceId);
  if (error) {
    return jsonResponse({ error: error.message }, 400);
  }

  return jsonResponse({ success: true });
};

const handleSuperAdminsList = async () => {
  const { data, error } = await supabaseAdmin
    .from("super_admins")
    .select("user_id, created_at");
  if (error) {
    return jsonResponse({ error: error.message }, 400);
  }

  const userIds = (data ?? []).map((row) => row.user_id);
  if (userIds.length === 0) {
    return jsonResponse({ superAdmins: [] });
  }
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, email, display_name")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );

  const result = (data ?? []).map((row) => {
    const profile = profileMap.get(row.user_id);
    return {
      userId: row.user_id,
      email: profile?.email ?? null,
      displayName: profile?.display_name ?? null,
      createdAt: row.created_at ?? null,
    };
  });

  return jsonResponse({ superAdmins: result });
};

const handleSuperAdminsCreate = async (payload: { email?: string; password?: string; displayName?: string }) => {
  const email = payload.email?.trim().toLowerCase() ?? "";
  const password = payload.password?.trim() ?? "";
  if (!email || !password) {
    return jsonResponse({ error: "email and password are required" }, 400);
  }
  if (password.length < 6) {
    return jsonResponse({ error: "Password must be at least 6 characters." }, 400);
  }

  let userId: string | null = null;
  const existing = await findUserByEmail(email);
  if ("error" in existing) {
    return jsonResponse({ error: existing.error }, 400);
  }

  if (existing.user?.id) {
    userId = existing.user.id;
    const updateResult = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
    if (updateResult.error) {
      return jsonResponse({ error: updateResult.error.message }, 400);
    }
  } else {
    const createResult = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createResult.error || !createResult.data?.user?.id) {
      return jsonResponse({ error: createResult.error?.message ?? "Failed to create super admin." }, 400);
    }
    userId = createResult.data.user.id;
  }

  if (!userId) {
    return jsonResponse({ error: "Failed to resolve super admin user." }, 400);
  }

  const displayName = payload.displayName?.trim();
  if (displayName) {
    await supabaseAdmin
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", userId);
  }

  const { error: superAdminInsertError } = await supabaseAdmin
    .from("super_admins")
    .upsert({ user_id: userId });
  if (superAdminInsertError) {
    return jsonResponse({ error: superAdminInsertError.message }, 400);
  }

  const result = await removeUserFromWorkspaces(userId);
  if ("error" in result) {
    return jsonResponse({ error: result.error }, 400);
  }

  return jsonResponse({
    success: true,
    user: { id: userId, email, displayName: displayName ?? null },
  });
};

const handleSuperAdminsDelete = async (payload: { userId?: string }, currentUserId: string) => {
  const userId = payload.userId?.trim() ?? "";
  if (!userId) {
    return jsonResponse({ error: "userId is required" }, 400);
  }
  if (userId === currentUserId) {
    return jsonResponse({ error: "You cannot remove yourself." }, 400);
  }

  if (reserveAdminEmail) {
    const reserveUser = await findUserByEmail(reserveAdminEmail);
    if ("error" in reserveUser) {
      return jsonResponse({ error: reserveUser.error }, 400);
    }
    if (reserveUser.user?.id && reserveUser.user.id === userId) {
      return jsonResponse({ error: "Cannot remove reserve admin account." }, 400);
    }
  }

  const { error } = await supabaseAdmin
    .from("super_admins")
    .delete()
    .eq("user_id", userId);
  if (error) {
    return jsonResponse({ error: error.message }, 400);
  }

  return jsonResponse({ success: true });
};

export const handler = async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Missing Supabase env vars" }, 500);
  }

  await ensureReserveAdminOnce();

  const authResult = await getAuthUser(req);
  if ("error" in authResult) {
    return jsonResponse({ error: authResult.error }, authResult.status ?? 401);
  }

  const isSuperAdmin = await ensureSuperAdmin(authResult.user.id);
  if (!isSuperAdmin) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const { data: payload, error } = await readJson<{ action?: string } & Record<string, unknown>>(req);
  if (error) {
    return jsonResponse({ error }, 400);
  }

  const action = payload.action ?? "";
  switch (action) {
    case "users.list":
      return handleUsersList(payload as { page?: number; perPage?: number; search?: string });
    case "users.create":
      return handleUsersCreate(payload as { email?: string; password?: string; displayName?: string; superAdmin?: boolean });
    case "users.update":
      return handleUsersUpdate(payload as { userId?: string; email?: string; password?: string; displayName?: string; superAdmin?: boolean });
    case "users.resetPassword":
      return handleUsersResetPassword(payload as { userId?: string; password?: string });
    case "users.delete":
      return handleUsersDelete(payload as { userId?: string }, authResult.user.id);
    case "workspaces.list":
      return handleWorkspacesList();
    case "workspaces.update":
      return handleWorkspacesUpdate(payload as { workspaceId?: string; name?: string });
    case "workspaces.delete":
      return handleWorkspacesDelete(payload as { workspaceId?: string });
    case "superAdmins.list":
      return handleSuperAdminsList();
    case "superAdmins.create":
      return handleSuperAdminsCreate(payload as { email?: string; password?: string; displayName?: string });
    case "superAdmins.delete":
      return handleSuperAdminsDelete(payload as { userId?: string }, authResult.user.id);
    default:
      return jsonResponse({ error: "Unknown action" }, 400);
  }
};

if (import.meta.main) {
  serve(handler);
}
