import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createSupabaseClients } from "../_shared/supabaseAuth.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt((value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const MAX_FILE_BYTES = parsePositiveInt(Deno.env.get("TASK_MEDIA_MAX_FILE_BYTES"), 5 * 1024 * 1024);
const USER_QUOTA_BYTES = parsePositiveInt(Deno.env.get("TASK_MEDIA_USER_QUOTA_BYTES"), 200 * 1024 * 1024);
const WORKSPACE_QUOTA_BYTES = parsePositiveInt(Deno.env.get("TASK_MEDIA_WORKSPACE_QUOTA_BYTES"), 2 * 1024 * 1024 * 1024);

const { supabaseAdmin } = createSupabaseClients(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-workspace-id, x-file-name",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const hexEncode = (bytes: Uint8Array) => Array.from(bytes)
  .map((value) => value.toString(16).padStart(2, "0"))
  .join("");

const hexDecode = (hex: string) => {
  const clean = hex.startsWith("\\x") ? hex.slice(2) : hex;
  if (!/^[a-fA-F0-9]*$/.test(clean) || clean.length % 2 !== 0) {
    return null;
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let index = 0; index < clean.length; index += 2) {
    bytes[index / 2] = Number.parseInt(clean.slice(index, index + 2), 16);
  }
  return bytes;
};

const createRandomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let binary = "";
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const sha256Hex = async (value: string) => {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return hexEncode(new Uint8Array(digest));
};

const constantTimeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
};

const sanitizeFileName = (value: string | null) => {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  return raw.slice(0, 180);
};

const getAuthUser = async (req: Request) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return { error: "Unauthorized", status: 401 };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return { error: "Unauthorized", status: 401 };
  }

  return { user: data.user };
};

const ensureWorkspaceAccess = async (workspaceId: string, userId: string) => {
  const [{ data: workspace, error: workspaceError }, { data: membership, error: membershipError }] = await Promise.all([
    supabaseAdmin
      .from("workspaces")
      .select("id, owner_id")
      .eq("id", workspaceId)
      .maybeSingle(),
    supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (workspaceError) {
    return { error: workspaceError.message, status: 400 };
  }
  if (!workspace) {
    return { error: "Workspace not found.", status: 404 };
  }
  if (membershipError) {
    return { error: membershipError.message, status: 400 };
  }

  const isOwner = workspace.owner_id === userId;
  const isMember = Boolean(membership);
  if (!isOwner && !isMember) {
    return { error: "Forbidden", status: 403 };
  }

  return {};
};

const getUsageBytes = async (column: "owner_id" | "workspace_id", id: string) => {
  const { data, error } = await supabaseAdmin
    .from("task_media")
    .select("byte_size")
    .eq(column, id);
  if (error) {
    return { error: error.message };
  }

  const usedBytes = (data ?? []).reduce((sum, row) => {
    const value = typeof row.byte_size === "number" ? row.byte_size : 0;
    return sum + Math.max(0, value);
  }, 0);

  return { usedBytes };
};

const handleUpload = async (req: Request) => {
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Missing Supabase env vars" }, 500);
  }

  const authResult = await getAuthUser(req);
  if ("error" in authResult) {
    return jsonResponse({ error: authResult.error }, authResult.status ?? 401);
  }

  const workspaceId = (req.headers.get("x-workspace-id") ?? "").trim();
  if (!workspaceId) {
    return jsonResponse({ error: "x-workspace-id header is required." }, 400);
  }

  const workspaceAccess = await ensureWorkspaceAccess(workspaceId, authResult.user.id);
  if ("error" in workspaceAccess) {
    return jsonResponse({ error: workspaceAccess.error }, workspaceAccess.status ?? 403);
  }

  const mimeType = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!mimeType.startsWith("image/")) {
    return jsonResponse({ error: "Only image uploads are supported." }, 400);
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await req.arrayBuffer());
  } catch (_error) {
    return jsonResponse({ error: "Invalid binary payload." }, 400);
  }

  if (bytes.byteLength === 0) {
    return jsonResponse({ error: "Empty file." }, 400);
  }
  if (bytes.byteLength > MAX_FILE_BYTES) {
    return jsonResponse({ error: `File size limit exceeded (${MAX_FILE_BYTES} bytes).` }, 413);
  }

  const userUsageResult = await getUsageBytes("owner_id", authResult.user.id);
  if ("error" in userUsageResult) {
    return jsonResponse({ error: userUsageResult.error }, 400);
  }
  if (userUsageResult.usedBytes + bytes.byteLength > USER_QUOTA_BYTES) {
    return jsonResponse({ error: `User storage quota exceeded (${USER_QUOTA_BYTES} bytes).` }, 413);
  }

  const workspaceUsageResult = await getUsageBytes("workspace_id", workspaceId);
  if ("error" in workspaceUsageResult) {
    return jsonResponse({ error: workspaceUsageResult.error }, 400);
  }
  if (workspaceUsageResult.usedBytes + bytes.byteLength > WORKSPACE_QUOTA_BYTES) {
    return jsonResponse({ error: `Workspace storage quota exceeded (${WORKSPACE_QUOTA_BYTES} bytes).` }, 413);
  }

  const accessToken = createRandomToken();
  const accessTokenHash = await sha256Hex(accessToken);
  const fileName = sanitizeFileName(req.headers.get("x-file-name"));
  const bytea = `\\x${hexEncode(bytes)}`;

  const { data, error } = await supabaseAdmin
    .from("task_media")
    .insert({
      workspace_id: workspaceId,
      owner_id: authResult.user.id,
      file_name: fileName,
      mime_type: mimeType,
      byte_size: bytes.byteLength,
      content: bytea,
      access_token_hash: accessTokenHash,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return jsonResponse({ error: error?.message ?? "Failed to upload image." }, 400);
  }

  return jsonResponse({
    id: data.id,
    token: accessToken,
    byteSize: bytes.byteLength,
    userUsedBytes: userUsageResult.usedBytes + bytes.byteLength,
  });
};

const handleDownload = async (req: Request, mediaId: string) => {
  const token = (new URL(req.url)).searchParams.get("token")?.trim() ?? "";
  if (!token) {
    return jsonResponse({ error: "Missing token." }, 401);
  }

  const { data, error } = await supabaseAdmin
    .from("task_media")
    .select("id, mime_type, content, access_token_hash")
    .eq("id", mediaId)
    .maybeSingle();

  if (error) {
    return jsonResponse({ error: error.message }, 400);
  }
  if (!data) {
    return jsonResponse({ error: "Image not found." }, 404);
  }

  const tokenHash = await sha256Hex(token);
  if (!constantTimeEqual(tokenHash, data.access_token_hash ?? "")) {
    return jsonResponse({ error: "Invalid token." }, 401);
  }

  const content = typeof data.content === "string" ? data.content : "";
  const bytes = hexDecode(content);
  if (!bytes) {
    return jsonResponse({ error: "Stored image payload is corrupted." }, 500);
  }

  supabaseAdmin
    .from("task_media")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => undefined)
    .catch(() => undefined);

  return new Response(bytes, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": data.mime_type || "application/octet-stream",
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};

export const handler = async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/+/, "");
  const [, mediaId] = path.split("/");

  if (req.method === "POST" && !mediaId) {
    return handleUpload(req);
  }

  if (req.method === "GET" && mediaId) {
    return handleDownload(req, mediaId);
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
};

if (import.meta.main) {
  serve(handler);
}
