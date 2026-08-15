/* =========================================================
 * STEP VET-MIGRATION-2
 * DPRO PET CARE LINE
 * 既存システム乗り換え専用 Cloudflare Worker 完全版
 * Worker名: dpro-vet-migration-api
 * Version: VET-MIGRATION-2-R4-R2-MISSING-EXEC-GUARDS-AWAIT-FIX-20260719
 *
 * 重要:
 * - 現在の dpro-vet-qr-api を上書きしない。
 * - 通常受付・LINE診察券とは別Workerとして配備する。
 * - ソトマチ以外のCSVにも対応する。
 * - previewでは患者・予約本体を変更しない。
 * - executeは管理コード・実行トークン・確認文言が必須。
 * ========================================================= */

const VERSION = "VET-MIGRATION-3-OWNER-INTEGRATION-COMPLETED-CANCEL-GUARD-20260720";
const SERVICE = "dpro-vet-migration-api";
const DEFAULT_CLINIC_CODE = "dpro_vet_demo";
const PATIENT_CONFIRM = "既存患者移行を実行";
const RESERVATION_CONFIRM = "未来予約移行を実行";
const CANCEL_CONFIRM = "事前確認バッチを取消";
const MAX_ROWS = 2000;
const PATIENT_EXECUTE_CHUNK_SIZE = 2;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "Content-Type,X-DPRO-Worker-Version",
  "Access-Control-Max-Age": "86400"
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { ...CORS, "X-DPRO-Worker-Version": VERSION } });
    }

    const url = new URL(request.url);
    const path = normalizePath(url.pathname);

    try {
      if (path === "/api/health" && request.method === "GET") {
        return json({
          ok: true,
          service: SERVICE,
          service_name: "DPRO PET CARE LINE Migration API",
          version: VERSION,
          default_clinic_code: env.DEFAULT_CLINIC_CODE || DEFAULT_CLINIC_CODE,
          separated_from_normal_api: true,
          registration_path: "supabase_transaction_rpc",
          worker_to_worker_fetch: false,
          error_1042_avoided: true,
          now: new Date().toISOString()
        });
      }

      const auth = requireAdmin(request, env);
      if (!auth.ok) return error(auth.message, 401);
      requireEnv(env);

      if (path === "/api/migration/check" && request.method === "GET") {
        return await handleCheck(request, env);
      }
      if (path === "/api/migration/patients/preview" && request.method === "POST") {
        return await handlePatientPreview(request, env);
      }
      if (path === "/api/migration/patients/execute" && request.method === "POST") {
        return await handlePatientExecute(request, env);
      }
      if (path === "/api/migration/reservations/preview" && request.method === "POST") {
        return await handleReservationPreview(request, env);
      }
      if (path === "/api/migration/reservations/execute" && request.method === "POST") {
        return await handleReservationExecute(request, env);
      }
      if (path === "/api/migration/batches" && request.method === "GET") {
        return await handleBatchList(request, env);
      }
      if (path === "/api/migration/batch" && request.method === "GET") {
        return await handleBatchDetail(request, env);
      }
      if (path === "/api/migration/batch/cancel" && request.method === "POST") {
        return await handleBatchCancel(request, env);
      }
      if (path === "/api/migration/relink" && request.method === "GET") {
        return await handleRelinkList(request, env);
      }
      if (path === "/api/migration/relink/update" && request.method === "POST") {
        return await handleRelinkUpdate(request, env);
      }

      return error("API endpoint not found.", 404, { path, method: request.method });
    } catch (e) {
      console.error(e);
      return error(e?.message || "Internal server error.", 500, { version: VERSION });
    }
  }
};

function normalizePath(v) {
  const p = String(v || "/").replace(/\/+$/, "");
  return p || "/";
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-DPRO-Worker-Version": VERSION }
  });
}
function error(message, status = 400, extra = {}) {
  return json({ ok: false, error: message, message, ...extra }, status);
}
function clean(v) { return String(v ?? "").trim(); }
function lower(v) { return clean(v).toLowerCase(); }
function nullIfEmpty(v) { const s = clean(v); return s || null; }
function requireEnv(env) {
  for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_TOKEN"]) {
    if (!clean(env[key])) throw new Error(`${key} が設定されていません。`);
  }
}
function requireAdmin(request, env) {
  const expected = clean(env.ADMIN_TOKEN);
  const auth = clean(request.headers.get("Authorization"));
  const bearer = auth.toLowerCase().startsWith("bearer ") ? clean(auth.slice(7)) : "";
  const supplied = clean(request.headers.get("X-Admin-Token") || request.headers.get("X-Admin-Code") || bearer);
  if (!expected) return { ok: false, message: "Worker Secret ADMIN_TOKEN が未設定です。" };
  if (!supplied || supplied !== expected) return { ok: false, message: "管理コードが正しくありません。" };
  return { ok: true };
}
async function readBody(request) {
  try { return await request.json(); } catch { return {}; }
}
function getQuery(request, key, fallback = "") {
  return clean(new URL(request.url).searchParams.get(key) ?? fallback);
}
function clinicCodeFrom(request, body = {}) {
  return clean(body.clinic_code || getQuery(request, "clinic_code") || DEFAULT_CLINIC_CODE);
}
function normalizePhone(v) {
  let t = clean(v)
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[＋]/g, "+");
  let digits = t.replace(/[^0-9]/g, "");
  const compact = t.replace(/[\s\-()（）]/g, "");
  if ((compact.startsWith("+81") || compact.startsWith("81")) && digits.startsWith("81")) digits = `0${digits.slice(2)}`;
  return digits;
}
function normalizeDate(v) {
  const s = clean(v).replace(/[./]/g, "-");
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return "";
  const d = new Date(`${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}T00:00:00+09:00`);
  if (Number.isNaN(d.getTime())) return "";
  return `${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`;
}
function todayJST() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
}
function normalizeSpecies(value) {
  const s = lower(value);
  if (["dog","犬","いぬ"].includes(s)) return { code:"dog", label:"犬" };
  if (["cat","猫","ねこ"].includes(s)) return { code:"cat", label:"猫" };
  if (["rabbit","うさぎ","兎"].includes(s)) return { code:"rabbit", label:"うさぎ" };
  if (["hamster","ハムスター"].includes(s)) return { code:"hamster", label:"ハムスター" };
  if (["bird","鳥","とり"].includes(s)) return { code:"bird", label:"鳥" };
  return { code:"other", label: clean(value) || "その他" };
}
function normalizeSex(value) {
  const s = lower(value);
  if (["male","m","男","雄","オス","男の子"].includes(s)) return "male";
  if (["female","f","女","雌","メス","女の子"].includes(s)) return "female";
  return "unknown";
}
function normalizeNeutered(value) {
  const s = lower(value);
  if (["済み","済","yes","true","neutered","避妊済み","去勢済み"].includes(s)) return "neutered";
  if (["未実施","未","no","false","not_neutered"].includes(s)) return "not_neutered";
  return "unknown";
}
function normalizeDayPart(value, exactTime = "") {
  const s = lower(value);
  if (["午前","morning","am"].includes(s)) return "morning";
  if (["午後","afternoon","pm"].includes(s)) return "afternoon";
  if (["終日","full_day","all"].includes(s)) return "full_day";
  const hh = Number((clean(exactTime).match(/^(\d{1,2}):/) || [])[1]);
  if (Number.isFinite(hh)) return hh < 13 ? "morning" : "afternoon";
  return "";
}
function normalizeRequestCategory(value, purpose = "") {
  const s = `${lower(value)} ${lower(purpose)}`;
  if (/再診|recheck/.test(s)) return "recheck";
  if (/ワクチン|予防接種|vacc/.test(s)) return "vaccination";
  if (/予防薬|フィラリア|ノミ|ダニ/.test(s)) return "prevention_medicine";
  if (/薬|フード|medicine|food/.test(s)) return "medicine_food";
  if (/爪|耳掃除|肛門腺|衛生/.test(s)) return "hygiene_care";
  if (/健診|健康診断|checkup/.test(s)) return "health_check";
  if (/トリミング|groom/.test(s)) return "grooming";
  if (/手術|surgery/.test(s)) return "surgery";
  if (/通常|診察|general/.test(s)) return "general_exam";
  return "other";
}
function canonicalSource(v) {
  const s = lower(v).replace(/\s+/g, "_");
  return s || "other";
}
function generateToken(prefix = "mig") {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}_${Date.now().toString(36)}`;
}
async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,"0")).join("");
}
function escapeFilter(v) { return encodeURIComponent(clean(v)); }

async function sb(env, path, options = {}) {
  const base = clean(env.SUPABASE_URL).replace(/\/+$/, "");
  const res = await fetch(`${base}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = data?.message || data?.error || data?.hint || text || `Supabase ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function entityId(row, type) {
  if (!row) return null;
  if (type === "guardian") return row.id || row.guardian_id || null;
  if (type === "pet") return row.id || row.pet_id || null;
  if (type === "card") return row.id || row.card_id || null;
  return row.id || null;
}
function migrationAgeText(n) {
  if (clean(n.age_note)) return clean(n.age_note);
  if (clean(n.birth_date)) return `生年月日:${clean(n.birth_date)}`;
  return "";
}
function migrationMemo(n, batch) {
  return [
    clean(n.memo),
    clean(n.address) ? `住所:${clean(n.address)}` : "",
    clean(n.postal_code) ? `郵便番号:${clean(n.postal_code)}` : "",
    n.weight_kg ? `体重:${n.weight_kg}kg` : "",
    clean(n.neutered_status) && n.neutered_status !== "unknown"
      ? `避妊去勢:${clean(n.neutered_status)}` : "",
    `移行元:${batch.source_system}`,
    clean(n.external_guardian_id) ? `旧飼い主ID:${clean(n.external_guardian_id)}` : "",
    clean(n.external_pet_id) ? `旧ペットID:${clean(n.external_pet_id)}` : "",
    clean(n.card_no) ? `旧診察券番号:${clean(n.card_no)}` : ""
  ].filter(Boolean).join(" / ");
}
async function createViaMigrationRpc(env, clinic, n, batch, existingGuardian = null) {
  const rpc = await sb(env, "rpc/vet_migration_register_patient", {
    method: "POST",
    body: {
      p_clinic_code: clinic.clinic_code,
      p_existing_guardian_id: entityId(existingGuardian, "guardian"),
      p_guardian_name: nullIfEmpty(n.guardian_name),
      p_guardian_kana: nullIfEmpty(n.guardian_kana),
      p_phone: nullIfEmpty(n.phone),
      p_email: nullIfEmpty(n.email),
      p_guardian_memo: nullIfEmpty(migrationMemo(n, batch)),
      p_pet_name: n.pet_name,
      p_species: n.species || "other",
      p_species_label: n.species_label || "その他",
      p_breed: nullIfEmpty(n.breed),
      p_sex: n.sex || "unknown",
      p_birth_date: nullIfEmpty(n.birth_date),
      p_weight_kg: n.weight_kg,
      p_neutered_status: n.neutered_status || "unknown",
      p_allergies: nullIfEmpty(n.allergies),
      p_chronic_conditions: nullIfEmpty(n.chronic_conditions),
      p_caution_memo: nullIfEmpty([
        n.caution_memo,
        migrationAgeText(n),
        `移行元:${batch.source_system}`,
        n.external_pet_id ? `旧ペットID:${n.external_pet_id}` : ""
      ].filter(Boolean).join(" / ")),
      p_requested_card_no: nullIfEmpty(n.card_no),
      p_card_note: `STEP VET-MIGRATION-2-R4 / 移行元:${batch.source_system}`
    }
  });

  if (!rpc?.ok || !rpc.guardian_id || !rpc.pet_id) {
    throw new Error(rpc?.error || "患者登録RPCから正常な登録結果を取得できませんでした。");
  }

  const guardians = await sb(
    env,
    `vet_guardians?id=eq.${rpc.guardian_id}&clinic_id=eq.${clinic.id}&select=*&limit=1`
  );
  const pets = await sb(
    env,
    `vet_pets?id=eq.${rpc.pet_id}&clinic_id=eq.${clinic.id}&select=*&limit=1`
  );

  const guardian = guardians?.[0] || { id: rpc.guardian_id };
  const pet = pets?.[0] || { id: rpc.pet_id };

  return {
    guardian,
    pet,
    card: { id: rpc.card_id, card_no: rpc.card_no },
    createdGuardian: Boolean(rpc.guardian_created),
    createdPet: Boolean(rpc.pet_created),
    registrationPath: rpc.registration_path
  };
}

async function resetRetryableFailedRows(env, batchId) {
  await sb(
    env,
    `vet_migration_rows?batch_id=eq.${batchId}&status=eq.failed&action=in.(create,merge)`,
    {
      method: "PATCH",
      body: {
        status: "previewed",
        error_message: null,
        result_action: "retry_requested"
      }
    }
  );
}
function patientExecutionAllowed(batch) {
  return ["previewed", "executing", "completed_with_errors"].includes(batch.status);
}
async function verifyPatientExecution(batch, token, confirmText) {
  if (!patientExecutionAllowed(batch)) {
    throw new Error(`このバッチは実行できません。現在状態: ${batch.status}`);
  }
  if (clean(confirmText) !== PATIENT_CONFIRM) {
    throw new Error(`確認文言「${PATIENT_CONFIRM}」を入力してください。`);
  }
  if (batch.status === "previewed") {
    if (new Date(batch.preview_expires_at).getTime() < Date.now()) {
      throw new Error("事前チェックの有効期限が切れています。もう一度事前チェックしてください。");
    }
    if (!clean(token) || await sha256(clean(token)) !== batch.token_hash) {
      throw new Error("実行トークンが一致しません。もう一度事前チェックしてください。");
    }
  }
}

async function getClinic(env, clinicCode) {
  const rows = await sb(env, `vet_clinics?clinic_code=eq.${escapeFilter(clinicCode)}&is_active=eq.true&select=id,clinic_code,clinic_name,display_name,status&limit=1`);
  if (!rows?.length) throw new Error("clinic_code が見つかりません。");
  return rows[0];
}
async function findGuardian(env, clinicId, phone, guardianName) {
  const norm = normalizePhone(phone);
  if (norm) {
    const rows = await sb(env, `vet_migration_guardian_lookup_view?clinic_id=eq.${clinicId}&phone_normalized=eq.${escapeFilter(norm)}&status=eq.active&select=*&limit=5`);
    if (rows?.length) return rows[0];
  }
  const name = clean(guardianName);
  if (name) {
    const rows = await sb(env, `vet_guardians?clinic_id=eq.${clinicId}&guardian_name=eq.${escapeFilter(name)}&status=eq.active&select=*&limit=5`);
    if (rows?.length === 1) return rows[0];
  }
  return null;
}
async function findPet(env, clinicId, guardianId, petName, speciesCode = "") {
  if (!guardianId || !clean(petName)) return null;
  let q = `vet_pets?clinic_id=eq.${clinicId}&guardian_id=eq.${guardianId}&pet_name=eq.${escapeFilter(petName)}&status=eq.active&select=*&limit=10`;
  const rows = await sb(env, q);
  if (!rows?.length) return null;
  if (speciesCode) return rows.find(x => clean(x.species) === speciesCode) || rows[0];
  return rows[0];
}
async function entityLink(env, clinicId, source, type, externalId) {
  if (!clean(externalId)) return null;
  const rows = await sb(env, `vet_migration_entity_links?clinic_id=eq.${clinicId}&source_system=eq.${escapeFilter(source)}&entity_type=eq.${type}&external_id=eq.${escapeFilter(externalId)}&is_active=eq.true&select=*&limit=1`);
  return rows?.[0] || null;
}
async function upsertEntityLink(env, payload) {
  const rows = await sb(env, "vet_migration_entity_links?on_conflict=clinic_id,source_system,entity_type,external_id", {
    method: "POST", body: payload, prefer: "resolution=merge-duplicates,return=representation"
  });
  return rows?.[0] || null;
}
async function createBatch(env, clinic, type, body, rows, summary) {
  const token = generateToken("execute");
  const tokenHash = await sha256(token);
  const inserted = await sb(env, "vet_migration_batches", {
    method: "POST",
    body: {
      clinic_id: clinic.id,
      migration_type: type,
      source_system: canonicalSource(body.source_system),
      source_label: nullIfEmpty(body.source_label),
      file_name: nullIfEmpty(body.file_name),
      status: "previewed",
      token_hash: tokenHash,
      row_count: rows.length,
      valid_count: summary.valid_count || 0,
      duplicate_count: summary.duplicate_count || 0,
      manual_count: summary.manual_count || 0,
      error_count: summary.error_count || 0,
      created_by: nullIfEmpty(body.actor || body.created_by || "管理者"),
      note: nullIfEmpty(body.note)
    }
  });
  const batch = inserted?.[0];
  if (!batch) throw new Error("移行バッチを作成できませんでした。");
  return { batch, token };
}
async function insertPreviewRows(env, batchId, type, previewRows) {
  if (!previewRows.length) return;
  const payload = previewRows.map(r => ({
    batch_id: batchId,
    row_no: r.row_no,
    external_id: nullIfEmpty(r.external_id),
    row_type: type === "patients" ? "patient" : "reservation",
    action: r.action,
    status: r.action === "manual_adjustment" ? "manual" : "previewed",
    raw_data: r.raw_data,
    normalized_data: r.normalized_data,
    validation_messages: r.messages,
    duplicate_guardian_id: r.duplicate_guardian_id || null,
    duplicate_pet_id: r.duplicate_pet_id || null
  }));
  await sb(env, "vet_migration_rows", { method:"POST", body:payload });
}
async function getBatchAndRows(env, clinicId, batchId) {
  const batches = await sb(env, `vet_migration_batches?id=eq.${batchId}&clinic_id=eq.${clinicId}&select=*&limit=1`);
  if (!batches?.length) throw new Error("移行バッチが見つかりません。");
  const rows = await sb(env, `vet_migration_rows?batch_id=eq.${batchId}&select=*&order=row_no.asc&limit=${MAX_ROWS}`);
  return { batch:batches[0], rows:rows || [] };
}
async function verifyExecution(batch, token, confirmText, expectedConfirm) {
  if (batch.status !== "previewed") throw new Error(`このバッチは実行できません。現在状態: ${batch.status}`);
  if (new Date(batch.preview_expires_at).getTime() < Date.now()) throw new Error("事前チェックの有効期限が切れています。もう一度事前チェックしてください。");
  if (clean(confirmText) !== expectedConfirm) throw new Error(`確認文言「${expectedConfirm}」を入力してください。`);
  if (!clean(token) || await sha256(clean(token)) !== batch.token_hash) throw new Error("実行トークンが一致しません。もう一度事前チェックしてください。");
}

async function handleCheck(request, env) {
  const clinicCode = clinicCodeFrom(request);
  const clinic = await getClinic(env, clinicCode);
  const check = await sb(env, "rpc/vet_migration_schema_check", {
    method:"POST",
    body:{ p_clinic_code: clinicCode }
  });
  const counts = {};
  for (const table of [
    "vet_migration_batches",
    "vet_migration_rows",
    "vet_migration_entity_links",
    "vet_migration_relink_status"
  ]) {
    const rows = await sb(
      env,
      `${table}?clinic_id=eq.${clinic.id}&select=id&limit=1`,
      { headers:{ Prefer:"count=exact" } }
    ).catch(() => []);
    counts[table] = Array.isArray(rows) ? rows.length : 0;
  }

  return json({
    ok:Boolean(check?.ok),
    service:SERVICE,
    version:VERSION,
    clinic,
    database:check,
    registration_rpc_ok:Boolean(check?.registration_rpc),
    worker_to_worker_fetch:false,
    error_1042_avoided:true,
    module_is_optional:true,
    normal_system_unchanged:true,
    completed_batch_cancel_protection:true,
    cancel_policy:"preview_only",
    counts
  });
}

async function handlePatientPreview(request, env) {
  const body = await readBody(request);
  const clinic = await getClinic(env, clinicCodeFrom(request, body));
  const source = canonicalSource(body.source_system);
  const rows = Array.isArray(body.rows) ? body.rows.slice(0, MAX_ROWS) : [];
  if (!rows.length) throw new Error("取込対象の患者行がありません。");
  if ((body.rows || []).length > MAX_ROWS) throw new Error(`1回の上限は${MAX_ROWS}行です。`);

  const previews = [];
  const summary = { valid_count:0, duplicate_count:0, manual_count:0, error_count:0 };
  for (let i=0; i<rows.length; i++) {
    const raw = rows[i] || {};
    const species = normalizeSpecies(raw.species || raw["動物種"]);
    const normalized = {
      external_guardian_id: clean(raw.external_guardian_id || raw.guardian_external_id || raw.owner_id),
      external_pet_id: clean(raw.external_pet_id || raw.pet_external_id || raw.patient_id),
      guardian_name: clean(raw.guardian_name || raw["飼い主名"]),
      guardian_kana: clean(raw.guardian_kana || raw["ふりがな"]),
      phone: normalizePhone(raw.phone || raw["電話番号"]),
      email: clean(raw.email || raw["メール"]),
      postal_code: clean(raw.postal_code || raw["郵便番号"]),
      address: clean(raw.address || raw["住所"]),
      pet_name: clean(raw.pet_name || raw["ペット名"]),
      species: species.code,
      species_label: species.label,
      breed: clean(raw.breed || raw["品種"]),
      sex: normalizeSex(raw.sex || raw["性別"]),
      birth_date: normalizeDate(raw.birth_date || raw["生年月日"]),
      age_note: clean(raw.age_note || raw["年齢メモ"]),
      weight_kg: Number(raw.weight_kg || raw["体重kg"] || 0) || null,
      neutered_status: normalizeNeutered(raw.neutered_status || raw["避妊去勢"]),
      allergies: clean(raw.allergies || raw["アレルギー"]),
      chronic_conditions: clean(raw.chronic_conditions || raw["持病"]),
      caution_memo: clean(raw.caution_memo || raw["注意メモ"]),
      card_no: clean(raw.card_no || raw["診察券番号"]),
      memo: clean(raw.memo || raw["メモ"])
    };
    const messages = [];
    if (!normalized.guardian_name) messages.push("飼い主名が未入力です。");
    if (!normalized.pet_name) messages.push("ペット名が未入力です。");
    if (normalized.birth_date === "" && clean(raw.birth_date || raw["生年月日"])) messages.push("生年月日の形式が不正です。");

    let guardian = null, pet = null, action = "create";
    const guardianExternal = await entityLink(env, clinic.id, source, "guardian", normalized.external_guardian_id);
    if (guardianExternal) {
      const gRows = await sb(env, `vet_guardians?id=eq.${guardianExternal.dpro_entity_id}&clinic_id=eq.${clinic.id}&select=*&limit=1`);
      guardian = gRows?.[0] || null;
    }
    if (!guardian) guardian = await findGuardian(env, clinic.id, normalized.phone, normalized.guardian_name);
    if (guardian) pet = await findPet(env, clinic.id, guardian.id, normalized.pet_name, normalized.species);

    if (messages.length) {
      action = "error"; summary.error_count++;
    } else if (pet) {
      action = "skip_duplicate"; summary.duplicate_count++;
      messages.push("同じ飼い主・ペットの候補があるため本登録ではスキップします。");
    } else if (guardian) {
      action = "merge"; summary.valid_count++;
      messages.push("既存飼い主へ新しいペットとして追加します。");
    } else {
      action = "create"; summary.valid_count++;
      messages.push("新しい飼い主・ペットとして登録します。");
    }

    previews.push({
      row_no:i+1,
      external_id: normalized.external_pet_id || normalized.card_no || `row-${i+1}`,
      raw_data:raw,
      normalized_data:normalized,
      action,
      messages,
      duplicate_guardian_id:guardian?.id || null,
      duplicate_pet_id:pet?.id || null
    });
  }

  const { batch, token } = await createBatch(env, clinic, "patients", body, rows, summary);
  await insertPreviewRows(env, batch.id, "patients", previews);
  return json({ ok:true, message:"患者CSVの事前チェックが完了しました。DBの患者本体は変更していません。", clinic, batch, execution_token:token, required_confirm_text:PATIENT_CONFIRM, summary:{ row_count:rows.length, ...summary }, rows:previews });
}

async function uniqueCardNo(env, clinicId, desired, batchId, rowNo) {
  const base = clean(desired) || `MIG-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${batchId.slice(0,6)}-${String(rowNo).padStart(4,"0")}`;
  const rows = await sb(env, `vet_pet_cards?clinic_id=eq.${clinicId}&card_no=eq.${escapeFilter(base)}&select=id&limit=1`);
  if (!rows?.length) return base;
  return `${base}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;
}
async function insertGuardian(env, clinic, n, batch, row) {
  const memoParts = [n.memo, n.address ? `住所:${n.address}` : "", n.postal_code ? `郵便番号:${n.postal_code}` : "", `移行元:${batch.source_system}`, n.external_guardian_id ? `旧飼い主ID:${n.external_guardian_id}` : ""].filter(Boolean);
  const rows = await sb(env, "vet_guardians", { method:"POST", body:{
    clinic_id:clinic.id,
    guardian_no:null,
    guardian_name:n.guardian_name,
    guardian_kana:nullIfEmpty(n.guardian_kana),
    phone:nullIfEmpty(n.phone),
    email:nullIfEmpty(n.email),
    line_user_id:null,
    line_link_status:"unlinked",
    preferred_contact:n.phone ? "phone" : "none",
    memo:memoParts.join(" / "),
    status:"active"
  }});
  return rows?.[0];
}
async function insertPet(env, clinic, guardian, n, batch) {
  const caution = [n.caution_memo, n.age_note ? `年齢メモ:${n.age_note}` : "", `移行元:${batch.source_system}`, n.external_pet_id ? `旧ペットID:${n.external_pet_id}` : ""].filter(Boolean).join(" / ");
  const rows = await sb(env, "vet_pets", { method:"POST", body:{
    clinic_id:clinic.id,
    guardian_id:guardian.id,
    pet_no:null,
    pet_name:n.pet_name,
    species:n.species,
    species_label:n.species_label,
    breed:nullIfEmpty(n.breed),
    sex:n.sex,
    birth_date:nullIfEmpty(n.birth_date),
    weight_kg:n.weight_kg,
    neutered_status:n.neutered_status,
    allergies:nullIfEmpty(n.allergies),
    chronic_conditions:nullIfEmpty(n.chronic_conditions),
    caution_memo:nullIfEmpty(caution),
    status:"active"
  }});
  return rows?.[0];
}
async function ensureCard(env, clinic, pet, n, batchId, rowNo) {
  const exists = await sb(env, `vet_pet_cards?clinic_id=eq.${clinic.id}&pet_id=eq.${pet.id}&select=*&limit=1`);
  if (exists?.length) return exists[0];
  const cardNo = await uniqueCardNo(env, clinic.id, n.card_no, batchId, rowNo);
  const rows = await sb(env, "vet_pet_cards", { method:"POST", body:{
    clinic_id:clinic.id, pet_id:pet.id, card_no:cardNo,
    qr_token:`mig_${crypto.randomUUID().replace(/-/g,"")}`,
    card_enabled:true,
    note:`STEP VET-MIGRATION-2 / 移行元:${n.card_no || "新規発行"}`
  }});
  return rows?.[0];
}
async function updateMigrationRow(env, rowId, patch) {
  await sb(env, `vet_migration_rows?id=eq.${rowId}`, { method:"PATCH", body:patch });
}
async function updateBatch(env, batchId, patch) {
  const rows = await sb(env, `vet_migration_batches?id=eq.${batchId}`, { method:"PATCH", body:patch });
  return rows?.[0] || null;
}

async function handlePatientExecute(request, env) {
  const body = await readBody(request);
  const clinic = await getClinic(env, clinicCodeFrom(request, body));
  let { batch, rows } = await getBatchAndRows(env, clinic.id, clean(body.batch_id));
  if (batch.migration_type !== "patients") throw new Error("患者移行バッチではありません。");
  await verifyPatientExecution(batch, body.execution_token, body.confirm_text);

  if (Boolean(body.retry_failed)) {
    await resetRetryableFailedRows(env, batch.id);
    ({ batch, rows } = await getBatchAndRows(env, clinic.id, batch.id));
  }
  if (batch.status !== "executing") {
    batch = await updateBatch(env, batch.id, { status:"executing", executed_by:nullIfEmpty(body.actor || "管理者") }) || batch;
  }

  const pending = rows.filter(r => r.status === "previewed").slice(0, PATIENT_EXECUTE_CHUNK_SIZE);
  for (const row of pending) {
    if (row.action === "error") {
      await updateMigrationRow(env,row.id,{status:"failed",error_message:"事前チェックエラー",result_action:"validation_error"});
      continue;
    }
    if (row.action === "skip_duplicate") {
      await updateMigrationRow(env,row.id,{status:"skipped",result_action:"existing_duplicate_kept",error_message:null});
      continue;
    }

    const n = row.normalized_data || {};
    try {
      let guardian = null;
      let pet = null;
      let createdGuardian = false;
      let createdPet = false;

      const guardianExternalId = n.external_guardian_id || `generated:${normalizePhone(n.phone) || lower(n.guardian_name)}`;
      const petExternalId = n.external_pet_id || row.external_id || `generated:${guardianExternalId}:${lower(n.pet_name)}`;

      const gLink = await entityLink(env, clinic.id, batch.source_system, "guardian", guardianExternalId);
      if (gLink) {
        const gRows = await sb(env, `vet_guardians?id=eq.${gLink.dpro_entity_id}&clinic_id=eq.${clinic.id}&select=*&limit=1`);
        guardian = gRows?.[0] || null;
      }
      if (!guardian) guardian = await findGuardian(env, clinic.id, n.phone, n.guardian_name);

      if (guardian) {
        const pLink = await entityLink(env, clinic.id, batch.source_system, "pet", petExternalId);
        if (pLink) {
          const pRows = await sb(env, `vet_pets?id=eq.${pLink.dpro_entity_id}&clinic_id=eq.${clinic.id}&select=*&limit=1`);
          pet = pRows?.[0] || null;
        }
        if (!pet) pet = await findPet(env, clinic.id, entityId(guardian,"guardian"), n.pet_name, n.species);
      }

      if (!pet) {
        const created = await createViaMigrationRpc(env, clinic, n, batch, guardian);
        guardian = created.guardian;
        pet = created.pet;
        createdGuardian = created.createdGuardian;
        createdPet = created.createdPet;
      }
      if (!guardian || !pet) throw new Error("飼い主・ペットを登録できませんでした。");

      const guardianId = entityId(guardian,"guardian");
      const petId = entityId(pet,"pet");
      const existingGuardianLink = await entityLink(env, clinic.id, batch.source_system, "guardian", guardianExternalId);
      if (!existingGuardianLink) {
        await upsertEntityLink(env,{ clinic_id:clinic.id,batch_id:batch.id,source_system:batch.source_system,entity_type:"guardian",external_id:guardianExternalId,dpro_entity_id:guardianId,created_by_migration:createdGuardian,metadata:{row_no:row.row_no,generated_external_id:!n.external_guardian_id} });
      }
      const existingPetLink = await entityLink(env, clinic.id, batch.source_system, "pet", petExternalId);
      if (!existingPetLink) {
        await upsertEntityLink(env,{ clinic_id:clinic.id,batch_id:batch.id,source_system:batch.source_system,entity_type:"pet",external_id:petExternalId,dpro_entity_id:petId,created_by_migration:createdPet,metadata:{row_no:row.row_no,card_no:n.card_no || null,generated_external_id:!n.external_pet_id} });
      }
      await sb(env, "vet_migration_relink_status?on_conflict=clinic_id,guardian_id", {
        method:"POST",
        body:{ clinic_id:clinic.id,guardian_id:guardianId,batch_id:batch.id,status:guardian.line_user_id ? "linked" : "unlinked",linked_at:guardian.line_user_id ? new Date().toISOString() : null,staff_confirmed:false },
        prefer:"resolution=merge-duplicates,return=representation"
      });

      const resultAction = createdGuardian ? "created_via_supabase_rpc" : createdPet ? "pet_added_via_supabase_rpc" : "recovered_existing_after_retry";
      await updateMigrationRow(env,row.id,{ status:createdGuardian || createdPet ? "imported" : "merged", result_guardian_id:guardianId,result_pet_id:petId,result_action:resultAction,error_message:null });
    } catch (e) {
      await updateMigrationRow(env,row.id,{status:"failed",error_message:e?.message || "取込失敗",result_action:"supabase_rpc_execute_failed"});
    }
  }

  const refreshed = await getBatchAndRows(env, clinic.id, batch.id);
  const allRows = refreshed.rows || [];
  const counts = {
    imported: allRows.filter(r => r.status === "imported").length,
    merged: allRows.filter(r => r.status === "merged").length,
    skipped: allRows.filter(r => r.status === "skipped").length,
    failed: allRows.filter(r => r.status === "failed").length,
    pending: allRows.filter(r => r.status === "previewed").length
  };
  const done = counts.pending === 0;
  let finalBatch = refreshed.batch;
  if (done) {
    finalBatch = await updateBatch(env,batch.id,{
      status:counts.failed ? "completed_with_errors" : "completed",
      imported_count:counts.imported,
      merged_count:counts.merged,
      skipped_count:counts.skipped,
      failed_count:counts.failed,
      executed_at:new Date().toISOString()
    }) || finalBatch;
  } else {
    finalBatch = await updateBatch(env,batch.id,{
      status:"executing",
      imported_count:counts.imported,
      merged_count:counts.merged,
      skipped_count:counts.skipped,
      failed_count:counts.failed
    }) || finalBatch;
  }

  const failedRows = allRows
    .filter(r => r.status === "failed")
    .map(r => ({
      row_no: r.row_no,
      guardian_name: r.normalized_data?.guardian_name || "",
      pet_name: r.normalized_data?.pet_name || "",
      error_message: r.error_message || "取込に失敗しました。"
    }));

  return json({
    ok:true,
    message:done ? "既存患者移行を実行しました。" : `既存患者移行を処理中です。残り${counts.pending}件`,
    clinic,
    batch:finalBatch,
    done,
    continue_required:!done,
    chunk_size:PATIENT_EXECUTE_CHUNK_SIZE,
    summary:counts,
    failed_rows:failedRows,
    normal_api_bridge_used:false,
    worker_to_worker_fetch:false,
    error_1042_avoided:true,
    normal_system_unchanged:true,
    registration_path:"supabase_transaction_rpc"
  });
}

async function handleReservationPreview(request, env) {
  const body = await readBody(request);
  const clinic = await getClinic(env, clinicCodeFrom(request, body));
  const source = canonicalSource(body.source_system);
  const rows = Array.isArray(body.rows) ? body.rows.slice(0,MAX_ROWS) : [];
  if (!rows.length) throw new Error("取込対象の未来予約行がありません。");
  if ((body.rows || []).length > MAX_ROWS) throw new Error(`1回の上限は${MAX_ROWS}行です。`);
  const previews=[];
  const summary={valid_count:0,duplicate_count:0,manual_count:0,error_count:0};
  for (let i=0;i<rows.length;i++) {
    const raw=rows[i]||{};
    const date=normalizeDate(raw.reservation_date || raw["予約日"]);
    const exact=clean(raw.source_exact_time || raw["元の時刻"] || raw["予約時刻"]);
    const dayPart=normalizeDayPart(raw.dpro_time_band || raw["DPRO時間帯"] || raw["時間帯"], exact);
    const decision=clean(raw.migration_decision || raw["移行判定"]);
    const normalized={
      external_reservation_id:clean(raw.external_reservation_id || raw.reservation_id || raw["旧予約ID"]),
      reservation_date:date,
      source_exact_time:exact,
      day_part:dayPart,
      guardian_name:clean(raw.guardian_name || raw["飼い主名"]),
      phone:normalizePhone(raw.phone || raw["電話番号"]),
      pet_name:clean(raw.pet_name || raw["ペット名"]),
      species:normalizeSpecies(raw.species || raw["動物種"]).code,
      purpose:clean(raw.purpose || raw["目的"] || raw["診療内容"]),
      symptoms_or_request:clean(raw.symptoms_or_request || raw["症状・要望"]),
      assigned_vet_name:clean(raw.assigned_vet_name || raw["担当獣医師"]),
      source_status:clean(raw.source_status || raw["元ステータス"]),
      migration_decision:decision,
      manual_adjustment_note:clean(raw.manual_adjustment_note || raw["手動調整メモ"]),
      request_category:normalizeRequestCategory(raw.reception_type || raw["受付種別"], raw.purpose || raw["目的"])
    };
    const messages=[];
    if (!date) messages.push("予約日の形式が不正です。");
    else if (date <= todayJST()) messages.push("未来予約は明日以降を指定してください。");
    if (!normalized.guardian_name && !normalized.phone) messages.push("飼い主名または電話番号が必要です。");
    if (!normalized.pet_name) messages.push("ペット名が必要です。");
    if (!dayPart || dayPart === "full_day") messages.push("午前または午後へ分類してください。");

    let guardian=null,pet=null,existing=null,action="import_priority";
    if (normalized.external_reservation_id) existing=await entityLink(env,clinic.id,source,"reservation",normalized.external_reservation_id);
    guardian=await findGuardian(env,clinic.id,normalized.phone,normalized.guardian_name);
    if (guardian) pet=await findPet(env,clinic.id,guardian.id,normalized.pet_name,normalized.species);
    if (!guardian || !pet) messages.push("DPRO内の飼い主・ペットを特定できません。患者移行を先に実行してください。");

    if (messages.length) { action="error"; summary.error_count++; }
    else if (existing) { action="skip_duplicate";summary.duplicate_count++;messages.push("同じ旧予約IDはすでに移行済みです。"); }
    else if (/cancel|cancelled|canceled|取消|キャンセル|無効/.test(lower(normalized.source_status))) { action="manual_adjustment";summary.manual_count++;messages.push("元システムで取消・無効の可能性があるため自動登録しません。"); }
    else if (/手動|manual|移行しない/.test(lower(decision)) || (exact && !/優先受付|priority/.test(lower(decision)))) { action="manual_adjustment";summary.manual_count++;messages.push("時刻確約を失わないよう自動登録せず手動調整にします。"); }
    else { action="import_priority";summary.valid_count++;messages.push(`${dayPart === "morning" ? "午前" : "午後"}の優先受付予約として登録します。`); }

    previews.push({row_no:i+1,external_id:normalized.external_reservation_id || `reservation-${i+1}`,raw_data:raw,normalized_data:normalized,action,messages,duplicate_guardian_id:guardian?.id||null,duplicate_pet_id:pet?.id||null});
  }
  const {batch,token}=await createBatch(env,clinic,"reservations",body,rows,summary);
  await insertPreviewRows(env,batch.id,"reservations",previews);
  return json({ok:true,message:"未来予約CSVの事前チェックが完了しました。予約本体は変更していません。",clinic,batch,execution_token:token,required_confirm_text:RESERVATION_CONFIRM,summary:{row_count:rows.length,...summary},rows:previews});
}

async function nextQueueNumber(env, clinicId, date, dayPart) {
  const rows=await sb(env,`vet_waiting_entries?clinic_id=eq.${clinicId}&target_date=eq.${date}&day_part=eq.${dayPart}&select=queue_number&order=queue_number.desc.nullslast&limit=1`);
  return Math.max(0,Number(rows?.[0]?.queue_number||0))+1;
}
async function priorityCapacityAvailable(env, clinicId, date, dayPart) {
  const settings=await sb(env,`vet_queue_settings?clinic_id=eq.${clinicId}&select=priority_reservation_enabled,priority_future_days,priority_morning_capacity,priority_afternoon_capacity&limit=1`);
  const s=settings?.[0]||{};
  if (s.priority_reservation_enabled === false) return {ok:false,message:"優先受付予約が無効です。"};

  const target = new Date(`${date}T00:00:00+09:00`);
  const today = new Date(`${todayJST()}T00:00:00+09:00`);
  const daysAhead = Math.round((target.getTime() - today.getTime()) / 86400000);
  const maxFutureDays = Number(s.priority_future_days ?? 30);
  if (daysAhead < 1) return {ok:false,message:"優先受付予約は明日以降が必要です。"};
  if (daysAhead > maxFutureDays) return {ok:false,message:`優先受付予約の受付範囲（${maxFutureDays}日先まで）を超えています。`};

  const cap=dayPart === "morning" ? Number(s.priority_morning_capacity ?? 1) : Number(s.priority_afternoon_capacity ?? 1);
  const entries=await sb(env,`vet_waiting_entries?clinic_id=eq.${clinicId}&target_date=eq.${date}&day_part=eq.${dayPart}&entry_kind=eq.priority_reservation&status=in.(reserved,waiting,checked_in,examining)&select=id&limit=100`);
  return {ok:(entries?.length||0)<cap,message:`優先受付枠 ${entries?.length||0}/${cap}`,capacity:cap,current:entries?.length||0};
}

async function handleReservationExecute(request, env) {
  const body=await readBody(request);
  const clinic=await getClinic(env,clinicCodeFrom(request,body));
  const {batch,rows}=await getBatchAndRows(env,clinic.id,clean(body.batch_id));
  if (batch.migration_type!=="reservations") throw new Error("未来予約移行バッチではありません。");
  await verifyExecution(batch,body.execution_token,body.confirm_text,RESERVATION_CONFIRM);
  await updateBatch(env,batch.id,{status:"executing",executed_by:nullIfEmpty(body.actor||"管理者")});
  let imported=0,skipped=0,manual=0,failed=0;
  for (const row of rows) {
    if (row.action==="manual_adjustment") {manual++;await updateMigrationRow(env,row.id,{status:"manual",result_action:"manual_adjustment_required"});continue;}
    if (row.action==="skip_duplicate") {skipped++;await updateMigrationRow(env,row.id,{status:"skipped",result_action:"existing_reservation_kept"});continue;}
    if (row.action!=="import_priority") {failed++;await updateMigrationRow(env,row.id,{status:"failed",error_message:"事前チェックエラー"});continue;}
    const n=row.normalized_data||{};
    try {
      const guardian=await findGuardian(env,clinic.id,n.phone,n.guardian_name);
      const pet=guardian ? await findPet(env,clinic.id,guardian.id,n.pet_name,n.species) : null;
      if (!guardian||!pet) throw new Error("飼い主・ペットを特定できません。");
      const available=await priorityCapacityAvailable(env,clinic.id,n.reservation_date,n.day_part);
      if (!available.ok) throw new Error(available.message);
      const queueNumber=await nextQueueNumber(env,clinic.id,n.reservation_date,n.day_part);
      const externalKey=`migration:${batch.source_system}:${n.external_reservation_id || batch.id+":"+row.row_no}`;
      const inserted=await sb(env,"vet_waiting_entries",{method:"POST",body:{
        clinic_id:clinic.id,guardian_id:guardian.id,pet_id:pet.id,
        entry_kind:"priority_reservation",request_category:n.request_category||"other",
        target_date:n.reservation_date,day_part:n.day_part,queue_number:queueNumber,
        priority_slot:n.day_part==="morning"?"morning_priority":"afternoon_priority",
        status:"reserved",guardian_name_snapshot:guardian.guardian_name,pet_name_snapshot:pet.pet_name,
        purpose:nullIfEmpty(n.purpose),symptoms_summary:nullIfEmpty(n.symptoms_or_request),desired_contact:"line",
        reception_memo:nullIfEmpty([n.source_exact_time?`旧予約時刻:${n.source_exact_time}`:"",n.assigned_vet_name?`旧担当:${n.assigned_vet_name}`:"",n.manual_adjustment_note].filter(Boolean).join(" / ")),
        internal_note:`STEP VET-MIGRATION-2 / 移行元:${batch.source_system}`,
        source:`migration:${batch.source_system}`,external_key:externalKey
      }});
      const entry=inserted?.[0];
      if (!entry) throw new Error("優先受付予約を登録できませんでした。");
      await upsertEntityLink(env,{clinic_id:clinic.id,batch_id:batch.id,source_system:batch.source_system,entity_type:"reservation",external_id:n.external_reservation_id||`${batch.id}:${row.row_no}`,dpro_entity_id:entry.id,created_by_migration:true,metadata:{row_no:row.row_no,source_exact_time:n.source_exact_time||null}});
      await updateMigrationRow(env,row.id,{status:"imported",result_guardian_id:guardian.id,result_pet_id:pet.id,result_waiting_entry_id:entry.id,result_action:"priority_reservation_created",error_message:null});
      imported++;
    } catch(e) {failed++;await updateMigrationRow(env,row.id,{status:"failed",error_message:e?.message||"予約移行失敗"});}
  }
  const status=failed?"completed_with_errors":"completed";
  const finalBatch=await updateBatch(env,batch.id,{status,imported_count:imported,skipped_count:skipped,manual_count:manual,failed_count:failed,executed_at:new Date().toISOString()});
  return json({ok:true,message:"未来予約移行を実行しました。",clinic,batch:finalBatch,summary:{imported,skipped,manual,failed},exact_time_is_not_guaranteed:true});
}

async function handleBatchList(request, env) {
  const clinic=await getClinic(env,clinicCodeFrom(request));
  const limit=Math.min(Math.max(Number(getQuery(request,"limit","50"))||50,1),200);
  const rows=await sb(env,`vet_migration_batches?clinic_id=eq.${clinic.id}&select=*&order=created_at.desc&limit=${limit}`);
  return json({ok:true,clinic,items:rows||[]});
}
async function handleBatchDetail(request, env) {
  const clinic=await getClinic(env,clinicCodeFrom(request));
  const batchId=getQuery(request,"batch_id")||getQuery(request,"id");
  const data=await getBatchAndRows(env,clinic.id,batchId);
  return json({ok:true,clinic,...data});
}
async function countRelated(env, table, column, id) {
  const rows=await sb(env,`${table}?${column}=eq.${id}&select=id&limit=1`).catch(()=>[]);
  return rows?.length||0;
}
async function handleBatchCancel(request, env) {
  const body = await readBody(request);
  const clinic = await getClinic(env, clinicCodeFrom(request, body));

  if (clean(body.confirm_text) !== CANCEL_CONFIRM) {
    throw new Error(`確認文言「${CANCEL_CONFIRM}」を入力してください。`);
  }

  const { batch, rows } = await getBatchAndRows(env, clinic.id, clean(body.batch_id));

  if (batch.status === "cancelled") {
    return json({
      ok: true,
      message: "この事前確認バッチは取消済みです。",
      clinic,
      batch,
      cancel_policy: "preview_only"
    });
  }

  const importedRows = rows.filter((row) =>
    ["imported", "merged"].includes(row.status) ||
    Boolean(row.result_guardian_id) ||
    Boolean(row.result_pet_id) ||
    Boolean(row.result_waiting_entry_id)
  );

  const importedCount =
    Number(batch.imported_count || 0) +
    Number(batch.merged_count || 0) +
    importedRows.length;

  if (
    batch.status === "completed" ||
    batch.status === "rollback_partial" ||
    importedCount > 0
  ) {
    return error(
      "完了済み・取込済みバッチはこの画面から取消できません。患者や予約を変更する場合は、通常の患者管理・受付管理から個別に対応してください。",
      409,
      {
        code: "COMPLETED_BATCH_CANCEL_BLOCKED",
        cancel_policy: "preview_only",
        batch_status: batch.status,
        imported_count: importedCount
      }
    );
  }

  if (batch.status === "executing") {
    return error(
      "実行中バッチは取消できません。処理完了後に履歴を再確認してください。",
      409,
      {
        code: "EXECUTING_BATCH_CANCEL_BLOCKED",
        cancel_policy: "preview_only"
      }
    );
  }

  const cancellable = ["previewed", "failed", "completed_with_errors"];
  if (!cancellable.includes(batch.status)) {
    return error(
      `現在状態「${batch.status}」のバッチは取消対象ではありません。`,
      409,
      {
        code: "BATCH_NOT_CANCELLABLE",
        cancel_policy: "preview_only"
      }
    );
  }

  const updated = await updateBatch(env, batch.id, {
    status: "cancelled",
    cancelled_by: nullIfEmpty(body.actor || "管理者"),
    cancelled_at: new Date().toISOString(),
    note: [batch.note, "STEP VET-MIGRATION-3：事前確認履歴のみ取消"].filter(Boolean).join(" / ")
  });

  return json({
    ok: true,
    message: "事前確認履歴を取消しました。患者・ペット・診察券・未来予約の本体は変更していません。",
    clinic,
    batch: updated,
    cancel_policy: "preview_only",
    summary: { deleted: 0, blocked: 0 }
  });
}

async function handleRelinkList(request, env) {
  const clinic=await getClinic(env,clinicCodeFrom(request));
  const status=getQuery(request,"status");
  const q=status?`&migration_relink_status=eq.${escapeFilter(status)}`:"";
  const rows=await sb(env,`vet_migration_relink_view?clinic_id=eq.${clinic.id}${q}&select=*&order=created_at.desc&limit=500`);
  return json({ok:true,clinic,items:rows||[]});
}
async function handleRelinkUpdate(request, env) {
  const body=await readBody(request);
  const clinic=await getClinic(env,clinicCodeFrom(request,body));
  const guardianId=clean(body.guardian_id);
  if (!guardianId) throw new Error("guardian_id が必要です。");
  const allowed=["unlinked","guided","linked","no_line","hold"];
  const status=allowed.includes(clean(body.status))?clean(body.status):"unlinked";
  const patch={status,staff_confirmed:Boolean(body.staff_confirmed),contact_method:nullIfEmpty(body.contact_method),note:nullIfEmpty(body.note)};
  if (status==="guided") patch.guided_at=new Date().toISOString();
  if (status==="linked") patch.linked_at=new Date().toISOString();
  const rows=await sb(env,`vet_migration_relink_status?clinic_id=eq.${clinic.id}&guardian_id=eq.${guardianId}`,{method:"PATCH",body:patch});
  return json({ok:true,message:"LINE再連携状況を更新しました。",clinic,item:rows?.[0]||null});
}
