/* =========================================================
  STEP VET-52.5J
  DPRO PET CARE LINE
  LINE公式で使える、ペット診察券・予防フォローシステム
  Cloudflare Worker API 完全版（既存API保持 + 本番登録API追加統合）

  目的：
  ・歯科デジタルQR診察券Workerを上書きせず、動物病院版専用Workerとして作成する
  ・Supabase相乗り環境でも dental_qr_ 系には一切触れない
  ・vet_ 系テーブルだけを使用する
  ・本番同等の流れ：
      GitHub Pages HTML
      → Cloudflare Worker API
      → Supabase vet_ テーブル保存
      → HTMLがAPIから再読込

  Worker名想定：
  ・dpro-vet-qr-api

  DEMO clinic_code：
  ・dpro_vet_demo

  必要なCloudflare Secrets：
  ・SUPABASE_URL
  ・SUPABASE_SERVICE_ROLE_KEY
  ・ADMIN_TOKEN

  任意のCloudflare環境変数：
  ・DEMO_CLINIC_CODE = dpro_vet_demo
  ・DISABLE_DEMO_OPERATIONS = true / false
  ・PUBLIC_SITE_URL = https://dpromstk2000-lab.github.io/DPRO-VET-QR/
  ・WORKER_PUBLIC_URL = https://dpro-vet-qr-api.<your-subdomain>.workers.dev

  安全ルール：
  ・dental_qr_ 系テーブルには触れない
  ・DEMOリセットは dpro_vet_demo のみ許可
  ・DEMOリセットは POST + 確認文言 + 管理コード必須
  ・本番 clinic_code ではDEMO操作を拒否
========================================================= */

const TABLES = {
  clinics: "vet_clinics",
  clinicSettings: "vet_clinic_settings",
  clinicRegularHolidays: "vet_clinic_regular_holidays",
  clinicSpecialDays: "vet_clinic_special_days",
  clinicCalendar2Months: "vet_clinic_calendar_2months",

  // 既存予約系テーブル。古い画面との互換用に残す。
  regularHours: "vet_regular_hours",
  specialDays: "vet_special_days",

  guardians: "vet_guardians",
  pets: "vet_pets",
  petCards: "vet_pet_cards",
  visits: "vet_visits",
  checkins: "vet_checkins",
  preventionSchedules: "vet_prevention_schedules",
  vaccineIntervalRules: "vet_vaccine_interval_rules",
  followups: "vet_followups",
  questionnaires: "vet_questionnaires",
  lineLinkTokens: "vet_line_link_tokens",
  messageTemplates: "vet_message_templates",
  messageQueue: "vet_message_queue",
  lineCallSettings: "vet_line_call_settings",
  operationLogs: "vet_operation_logs",
  consents: "vet_consents",
  duplicateReviews: "vet_duplicate_reviews",
  staffMembers: "vet_staff_members",
  productionSafetySettings: "vet_production_safety_settings",
  importBatches: "vet_import_batches",
  importRows: "vet_import_rows",

  petCardView: "vet_pet_card_view",
  checkinStatusView: "vet_checkin_status_view",
  preventionTodosView: "vet_prevention_todos_view",
  followupTodosView: "vet_followup_todos_view",
  ownerTodaySummaryView: "vet_owner_today_summary_view",

  queueSettings: "vet_queue_settings",
  waitingEntries: "vet_waiting_entries",
  previsitQuestionnaires: "vet_previsit_questionnaires",
  congestionStatus: "vet_congestion_status",
  waitingEntriesDetailView: "vet_waiting_entries_detail_view",
  queueSummaryView: "vet_queue_summary_view",

  // STEP VET-APPOINTMENT-1: 30分単位の日時指定予約
  exactAppointmentSettings: "vet_exact_appointment_settings",
  exactAppointmentServices: "vet_exact_appointment_services",
  exactAppointments: "vet_exact_appointments",
  exactAppointmentHistory: "vet_exact_appointment_history",

  // STEP VET-DOCTOR-SLOT-1: 獣医師別・診療内容別予約枠
  exactAppointmentDoctors: "vet_exact_appointment_doctors",
  exactAppointmentDoctorServices: "vet_exact_appointment_doctor_services",
  exactAppointmentDoctorHours: "vet_exact_appointment_doctor_hours",
  exactAppointmentDoctorBlocks: "vet_exact_appointment_doctor_blocks"
};

const DEFAULT_CLINIC_CODE = "dpro_vet_demo";
const WORKER_VERSION = "ANIMARY-COUNTER-V1.3-VACCINE-INTERVAL-20260816-INTEGRATED-6";
const INTEGRATED_API_VERSION = "DPRO-PET-CARE-INTEGRATED-V1.0";
const FEATURE_SWITCH_VERSION = "DPRO-VET-FEATURE-SWITCH-V1.1";
const WEB_QUESTIONNAIRE_VERSION = "DPRO-VET-WEB-QUESTIONNAIRE-V1.1.6";
const QUESTIONNAIRE_VISIT_LINK_VERSION = "DPRO-VET-QUESTIONNAIRE-VISIT-LINK-V1.1";
const DOCTOR_QUESTIONNAIRE_IMAGE_VIEW_VERSION = "DPRO-VET-DOCTOR-QUESTIONNAIRE-IMAGE-VIEW-V1.1";
const EXACT_APPOINTMENT_GUARD_VERSION = "VET-APPOINTMENT-1-R2";
const LINE_CALL_FEATURE_VERSION = "VET-LINE-CALL-1";
const DOCTOR_SLOT_FEATURE_VERSION = "VET-DOCTOR-SLOT-1";
const APPOINTMENT_REMINDER_AUTOMATION_VERSION = "VET-REMINDER-AUTO-1";
const APPOINTMENT_CHECKIN_FEATURE_VERSION = "VET-APPOINTMENT-CHECKIN-1";
const QR_APPOINTMENT_LINK_FEATURE_VERSION = "VET-QR-APPOINTMENT-LINK-1";
const APPOINTMENT_ACTION_NOTICE_FEATURE_VERSION = "VET-APPOINTMENT-NOTIFY-1";
const RECALL_AUTOMATION_VERSION = "VET-RECALL-AUTO-1";
const FINAL_AUDIT_VERSION = "FINAL-VET-AUDIT-1-R1";
const V11_FINAL_AUDIT_VERSION = "DPRO-VET-V1.1-FINAL-AUDIT-R1";
const MULTI_PET_BOOKING_VERSION = "DPRO-VET-MULTI-PET-BOOKING-V1.2";
const FLEXIBLE_APPOINTMENT_TIME_VERSION = "DPRO-VET-FLEX-TIME-V1.2-R3";
const VACCINE_INTERVAL_CONTROL_VERSION = "DPRO-VET-VACCINE-INTERVAL-V1.3";
const APPOINTMENT_REMINDER_RECOMMENDED_CRON = "0 0,1,2 * * *"; // JST 09:00 / 10:00 / 11:00
const LINE_PUSH_ENDPOINT = "https://api.line.me/v2/bot/message/push";
const LINE_BOT_INFO_ENDPOINT = "https://api.line.me/v2/bot/info";
const SERVICE_NAME = "DPRO PET CARE LINE";
const SERVICE_ID = "dpro-vet-qr-api";
const DEMO_OPERATION_CONFIRM_TEXT = "DEMO動物病院だけ実行";

// =========================================================
// DPRO PET CARE LINE V1.1 / hospital feature switches
// - Existing V1.0 functions default ON to preserve current behavior.
// - New V1.1+ functions default OFF until the corresponding feature is released.
// =========================================================
const DEFAULT_FEATURE_FLAGS = Object.freeze({
  pet_card: true,
  multi_pet_card: true,
  reception_queue: true,
  reception_general: true,
  reception_medicine_prevention: true,
  reception_care: true,
  previsit_questionnaire: true,
  questionnaire_branching: false,
  questionnaire_images: false,
  questionnaire_consent: false,
  exact_appointment: true,
  doctor_selection: true,
  qr_checkin: true,
  congestion_view: true,
  line_call: true,
  post_visit_followup: true,
  prevention_recall: true,
  revisit_recall: true,
  multi_pet_booking: false,
  vaccine_interval_control: false,
  cancel_waitlist: false,
  hp_sync: false
});

const FEATURE_FLAG_KEYS = Object.freeze(Object.keys(DEFAULT_FEATURE_FLAGS));

const DEFAULT_PUBLIC_CHANNEL_SETTINGS = Object.freeze({
  schema_version: INTEGRATED_API_VERSION,
  hp: Object.freeze({
    welcome_overlay: true,
    today_status: true,
    medical_services: true,
    first_visit: true,
    prevention: true,
    health_check: true,
    doctors: true,
    doctor_schedule: true,
    trimming: false,
    pet_hotel: false,
    dog_run: false,
    puppy_class: false,
    news: true,
    faq: true,
    access: true,
    emergency: true,
    blog: false,
    recruitment: false,
    multilingual: false,
    online_consultation: false
  }),
  line: Object.freeze({
    today_status: true,
    notice: true
  }),
  welcome: Object.freeze({
    enabled: true,
    show_mode: "every_visit",
    label: "TODAY / IMPORTANT"
  }),
  notice: Object.freeze({
    enabled: true,
    level: "important",
    title: "大切なお知らせ",
    link_label: "詳しく見る",
    link_url: "news.html"
  })
});

function normalizeJsonObject(value) {
  let source = value;
  if (typeof source === "string") {
    try { source = JSON.parse(source); } catch { source = {}; }
  }
  return source && !Array.isArray(source) && typeof source === "object" ? source : {};
}

function normalizePublicChannelSettings(input = {}) {
  const source = normalizeJsonObject(input);
  const hpSource = normalizeJsonObject(source.hp);
  const lineSource = normalizeJsonObject(source.line);
  const welcomeSource = normalizeJsonObject(source.welcome);
  const noticeSource = normalizeJsonObject(source.notice);
  const hp = { ...DEFAULT_PUBLIC_CHANNEL_SETTINGS.hp, ...hpSource };
  const line = { ...DEFAULT_PUBLIC_CHANNEL_SETTINGS.line, ...lineSource };
  Object.keys(DEFAULT_PUBLIC_CHANNEL_SETTINGS.hp).forEach((key) => {
    hp[key] = toBool(hp[key], DEFAULT_PUBLIC_CHANNEL_SETTINGS.hp[key]);
  });
  Object.keys(DEFAULT_PUBLIC_CHANNEL_SETTINGS.line).forEach((key) => {
    line[key] = toBool(line[key], DEFAULT_PUBLIC_CHANNEL_SETTINGS.line[key]);
  });
  return {
    ...source,
    schema_version: cleanString(source.schema_version || INTEGRATED_API_VERSION),
    hp,
    line,
    welcome: {
      ...DEFAULT_PUBLIC_CHANNEL_SETTINGS.welcome,
      ...welcomeSource,
      enabled: toBool(welcomeSource.enabled, DEFAULT_PUBLIC_CHANNEL_SETTINGS.welcome.enabled)
    },
    notice: {
      ...DEFAULT_PUBLIC_CHANNEL_SETTINGS.notice,
      ...noticeSource,
      enabled: toBool(noticeSource.enabled, DEFAULT_PUBLIC_CHANNEL_SETTINGS.notice.enabled)
    }
  };
}

function normalizeIntegratedBookingSource(value, fallback = "line", adminMode = false) {
  const raw = cleanString(value || fallback).toLowerCase();
  // INTEGRATED-6:
  // 旧受付PC値を正式source contractへ吸収し、今後の保存値を統一する。
  const aliases = {
    telephone: "phone",
    front_desk: "counter",
    manual_front: "counter",
    window: "counter",
    qr: "counter",
    qr_reception: "counter"
  };
  const source = aliases[raw] || raw;
  const memberAllowed = ["line", "web"];
  const staffAllowed = ["line", "web", "phone", "counter", "staff", "import"];
  const allowed = adminMode ? staffAllowed : memberAllowed;
  if (!allowed.includes(source)) throw new Error("予約・受付登録元が不正です。");
  return source;
}

function normalizeFeatureFlags(input = {}) {
  let source = input;
  if (typeof source === "string") {
    try { source = JSON.parse(source); } catch { source = {}; }
  }
  if (!source || Array.isArray(source) || typeof source !== "object") source = {};
  const out = { ...DEFAULT_FEATURE_FLAGS };
  FEATURE_FLAG_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      out[key] = toBool(source[key], DEFAULT_FEATURE_FLAGS[key]);
    }
  });
  return out;
}

function normalizeFeaturePreset(value) {
  const preset = cleanString(value || "standard").toLowerCase();
  return ["simple", "standard", "full", "custom"].includes(preset) ? preset : "custom";
}

const DEFAULT_QUESTIONNAIRE_MODULES = Object.freeze({
  general: true,
  vaccine: true,
  health_check: true,
  skin: true,
  digestive: true,
  respiratory: true,
  eye: true,
  ear: true,
  urinary: true,
  injury: true,
  medicine_prevention: true,
  other: true
});

function normalizeQuestionnaireModules(input = {}) {
  let source = input;
  if (typeof source === "string") {
    try { source = JSON.parse(source); } catch { source = {}; }
  }
  if (!source || Array.isArray(source) || typeof source !== "object") source = {};
  const out = { ...DEFAULT_QUESTIONNAIRE_MODULES };
  Object.keys(out).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      out[key] = toBool(source[key], DEFAULT_QUESTIONNAIRE_MODULES[key]);
    }
  });
  return out;
}

async function getClinicFeatureState(env, clinicCode) {
  const clinic = await getClinicByCode(env, clinicCode);
  const settings = await getClinicSettings(env, clinic.id);
  return {
    clinic,
    settings,
    feature_preset: normalizeFeaturePreset(settings?.feature_preset || "standard"),
    feature_flags: normalizeFeatureFlags(settings?.feature_flags),
    questionnaire_modules: normalizeQuestionnaireModules(settings?.questionnaire_modules)
  };
}

function featureDisabledResponse(key, message) {
  return errorResponse(message || "この機能は現在この動物病院では使用していません。", 403, {
    code: "feature_disabled",
    feature_key: key,
    feature_switch_version: FEATURE_SWITCH_VERSION
  });
}


// STEP VET-PHOTO-1B: ペット写真アイコン用設定
const PET_PHOTO_BUCKET = "vet-pet-photos";
const PET_PHOTO_MAX_BYTES = 524288;
const PET_PHOTO_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

// ANIMARY-COUNTER-V1.1-4: WEB問診 症状画像
const QUESTIONNAIRE_IMAGE_BUCKET = "vet-questionnaire-images";
const QUESTIONNAIRE_IMAGE_MAX_BYTES = 819200; // 800KB / image
const QUESTIONNAIRE_IMAGE_MAX_COUNT = 3;
const QUESTIONNAIRE_IMAGE_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const QUESTIONNAIRE_IMAGE_SIGNED_URL_SECONDS = 1800;


// =========================================================
// FINAL VET-AUDIT-1-R1
// 本番認証境界・CORS・公開データ最小化
// =========================================================
const LINE_ID_TOKEN_VERIFY_ENDPOINT = "https://api.line.me/oauth2/v2.1/verify";

function requestOriginAllowed(request, env) {
  const origin = cleanString(request.headers.get("Origin"));
  if (!origin) return { ok: true, origin: "", reason: "no_origin" };

  const allowed = new Set(["https://dpromstk2000-lab.github.io"]);
  const siteUrl = cleanString(env.PUBLIC_SITE_URL);
  if (siteUrl) {
    try { allowed.add(new URL(siteUrl).origin); } catch {}
  }
  cleanString(env.ADDITIONAL_ALLOWED_ORIGINS).split(",")
    .map((v) => cleanString(v)).filter(Boolean)
    .forEach((v) => { try { allowed.add(new URL(v).origin); } catch {} });

  if (toBool(env.ALLOW_LOCAL_DEV_ORIGIN, false) &&
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return { ok: true, origin, reason: "local_dev" };
  }
  return { ok: allowed.has(origin), origin, reason: allowed.has(origin) ? "allowlist" : "origin_not_allowed" };
}

function isDemoClinicCodeForAudit(env, clinicCode) {
  return cleanString(clinicCode) === getDemoClinicCode(env);
}

function lineIdentityTokenFromRequest(request, body = {}) {
  return cleanString(
    request.headers.get("x-line-id-token") ||
    request.headers.get("X-Line-ID-Token") ||
    body.line_id_token || body.id_token || ""
  );
}

async function verifyLineIdTokenForAudit(env, idToken) {
  const channelId = cleanString(env.LINE_LOGIN_CHANNEL_ID);
  if (!channelId) {
    return { ok:false, status:503, code:"line_login_channel_id_not_configured",
      message:"本番LINE本人確認用のLINE_LOGIN_CHANNEL_IDが未設定です。" };
  }
  if (!idToken) {
    return { ok:false, status:401, code:"line_id_token_required",
      message:"本番ではLINE本人確認が必要です。LINEアプリ内から開き直してください。" };
  }
  const form = new URLSearchParams();
  form.set("id_token", idToken);
  form.set("client_id", channelId);
  let response;
  try {
    response = await fetch(LINE_ID_TOKEN_VERIFY_ENDPOINT, {
      method:"POST",
      headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body:form.toString()
    });
  } catch (error) {
    return { ok:false, status:502, code:"line_id_token_verify_unreachable",
      message:"LINE本人確認サーバーへ接続できませんでした。" };
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !cleanString(data.sub)) {
    return { ok:false, status:401, code:"line_id_token_invalid",
      message:"LINE本人確認に失敗しました。LINEアプリ内から開き直してください。" };
  }
  if (data.exp && Number(data.exp)*1000 <= Date.now()) {
    return { ok:false, status:401, code:"line_id_token_expired",
      message:"LINE本人確認の有効期限が切れました。画面を開き直してください。" };
  }
  return { ok:true, status:200, line_user_id:cleanString(data.sub),
    name:cleanString(data.name), picture:cleanString(data.picture), exp:data.exp||null };
}

function memberIdentityProtectedPath(path) {
  return new Set([
    "/api/public/register","/api/member/register",
    "/api/public/register/check-duplicate","/api/member/register/check-duplicate",
    "/api/public/my-cards","/api/member/my-cards",
    "/api/public/line-link-complete","/api/member/line-link-complete-v2",
    "/api/member/pet-card","/api/member/pet-cards",
    "/api/member/questionnaire/create",
    "/api/member/questionnaire/image-upload-url",
    "/api/member/exact-appointments","/api/member/exact-appointments/create",
    "/api/member/exact-appointments/change","/api/member/exact-appointments/cancel",
    "/api/member/exact-appointments/multi-availability","/api/member/exact-appointments/multi-create",
    "/api/member/exact-appointments/multi-change","/api/member/exact-appointments/multi-cancel",
    "/api/member/vaccine-interval/options","/api/member/vaccine-interval/check",
    "/api/member/queue/create","/api/member/waiting/create","/api/member/waiting-entry/create",
    "/api/public/pets/photo/update","/api/member/pets/photo/update",
    "/api/public/pet-photo/update","/api/member/pet-photo/update",
    "/api/public/pets/photo/delete","/api/member/pets/photo/delete",
    "/api/public/pet-photo/delete","/api/member/pet-photo/delete"
  ]).has(path);
}

function requestHasCardCredential(path, body = {}, request = null) {
  if (!path.includes("photo")) return false;
  return Boolean(cleanString(
    body.card_token || body.qr_token || body.token || body.t ||
    (request ? getParam(request,"card_token","") : "") ||
    (request ? getParam(request,"qr_token","") : "") ||
    (request ? getParam(request,"token","") : "") ||
    (request ? getParam(request,"t","") : "")
  ));
}

function memberExistingGuardianRequiredPath(path) {
  return new Set([
    "/api/member/questionnaire/create",
    "/api/member/questionnaire/image-upload-url",
    "/api/member/queue/create",
    "/api/member/waiting/create",
    "/api/member/waiting-entry/create",
    "/api/member/exact-appointments/create",
    "/api/member/exact-appointments/multi-availability",
    "/api/member/exact-appointments/multi-create",
    "/api/member/exact-appointments/multi-change",
    "/api/member/exact-appointments/multi-cancel",
    "/api/member/vaccine-interval/options",
    "/api/member/vaccine-interval/check"
  ]).has(path);
}

async function enforceProductionMemberIdentity(request, env, path) {
  if (!memberIdentityProtectedPath(path)) return {ok:true, request, protected:false};

  // V1.1 FINAL-AUDIT-R1:
  // R2以降は画像本体をJSONへ載せないため、DEMO判定のためのquery-only fast pathは不要。
  // URLとbodyでclinic_codeが食い違う場合は、DEMO偽装による本番認証迂回を防ぐため拒否する。
  const body = request.method === "GET" || request.method === "HEAD" ? {} : await readJson(request);
  const queryClinicCode = cleanString(getParam(request, "clinic_code", ""));
  const bodyClinicCode = cleanString(body.clinic_code || "");
  if (queryClinicCode && bodyClinicCode && queryClinicCode !== bodyClinicCode) {
    return {ok:false, status:400, code:"clinic_code_mismatch",
      message:"医院コードの指定が一致しません。画面を開き直してください。"};
  }
  const clinicCode = getRequestedClinicCode(request, body);
  if (isDemoClinicCodeForAudit(env, clinicCode)) {
    return {ok:true, request, protected:true, demo_bypass:true, clinic_code:clinicCode};
  }
  if (requestHasCardCredential(path, body, request)) {
    return {ok:true, request, protected:true, card_credential:true, clinic_code:clinicCode};
  }

  const verified = await verifyLineIdTokenForAudit(env, lineIdentityTokenFromRequest(request, body));
  if (!verified.ok) return {...verified, protected:true, clinic_code:clinicCode};

  const clinic = await getClinicByCode(env, clinicCode);
  const guardian = await selectSingle(env, TABLES.guardians, {
    select:"*", clinic_id:`eq.${clinic.id}`,
    line_user_id:`eq.${verified.line_user_id}`, status:"eq.active", limit:1
  }).catch(() => null);

  if (!guardian && memberExistingGuardianRequiredPath(path)) {
    return {ok:false,status:403,code:"verified_guardian_required",
      message:"この操作にはLINE連携済みの飼い主情報が必要です。診察券画面から開き直してください。"};
  }

  const nextHeaders = new Headers(request.headers);
  nextHeaders.set("X-DPRO-Verified-Line-User-Id", verified.line_user_id);
  nextHeaders.delete("x-line-id-token");
  nextHeaders.delete("X-Line-ID-Token");

  if (request.method === "GET" || request.method === "HEAD") {
    const nextUrl = new URL(request.url);
    nextUrl.searchParams.set("line_user_id", verified.line_user_id);
    nextUrl.searchParams.delete("lineUserId");
    if (guardian?.id) nextUrl.searchParams.set("guardian_id", guardian.id);
    else nextUrl.searchParams.delete("guardian_id");
    const nextRequest = new Request(nextUrl.toString(), {method:request.method, headers:nextHeaders});
    return {ok:true, protected:true, verified:true, line_user_id:verified.line_user_id,
      guardian_id:guardian?.id||null, request:nextRequest};
  }

  const nextBody = {...body, line_user_id:verified.line_user_id, lineUserId:verified.line_user_id,
    line_identity_verified:true};
  delete nextBody.line_id_token; delete nextBody.id_token;
  if (guardian?.id) {
    nextBody.guardian_id = guardian.id;
    if (nextBody.pet_id) {
      const pet = await selectSingle(env, TABLES.pets, {
        select:"id,guardian_id,clinic_id,status", clinic_id:`eq.${clinic.id}`,
        id:`eq.${cleanString(nextBody.pet_id)}`, guardian_id:`eq.${guardian.id}`,
        status:"eq.active", limit:1
      }).catch(() => null);
      if (!pet) return {ok:false,status:403,code:"pet_not_owned_by_verified_guardian",
        message:"このペットを操作する本人確認ができませんでした。"};
    }
  } else {
    delete nextBody.guardian_id;
  }

  const nextRequest = new Request(request.url, {
    method:request.method, headers:nextHeaders, body:JSON.stringify(nextBody), redirect:request.redirect
  });
  return {ok:true, protected:true, verified:true, line_user_id:verified.line_user_id,
    guardian_id:guardian?.id||null, request:nextRequest};
}

function normalizeClinicForPublic(clinic) {
  if (!clinic) return null;
  return {
    id:clinic.id||null, clinic_code:clinic.clinic_code||"", public_slug:clinic.public_slug||"",
    clinic_name:clinic.clinic_name||"", display_name:clinic.display_name||"",
    service_name:clinic.service_name||SERVICE_NAME, service_description:clinic.service_description||"",
    phone:clinic.phone||"", address:clinic.address||"",
    business_hours_note:clinic.business_hours_note||"", closed_days_note:clinic.closed_days_note||"",
    timezone:clinic.timezone||"Asia/Tokyo", status:clinic.status||"",
    is_active:clinic.is_active!==false, public_note:clinic.public_note||""
  };
}


function normalizeIntegratedClinicForPublic(clinic, settings = {}) {
  const base = normalizeClinicForPublic(clinic) || {};
  const publicSettings = normalizeClinicSettingsForPublic(settings);
  const timeText = (value) => cleanString(value).slice(0, 5);
  const morning = [timeText(publicSettings.morning_open_time), timeText(publicSettings.morning_close_time)].filter(Boolean).join("〜");
  const afternoon = [timeText(publicSettings.afternoon_open_time), timeText(publicSettings.afternoon_close_time)].filter(Boolean).join("〜");
  return {
    ...base,
    clinic_name: publicSettings.clinic_name || base.clinic_name || "",
    display_name: publicSettings.display_name || base.display_name || "",
    phone: publicSettings.phone || base.phone || "",
    address: publicSettings.address || base.address || "",
    timezone: publicSettings.timezone || base.timezone || "Asia/Tokyo",
    business_hours_note: [morning ? `午前 ${morning}` : "", afternoon ? `午後 ${afternoon}` : ""].filter(Boolean).join(" / ") || base.business_hours_note || "",
    public_note: publicSettings.public_notice || base.public_note || ""
  };
}

function normalizeClinicSettingsForPublic(settings = {}) {
  return {
    clinic_code: settings.clinic_code || "",
    clinic_name: settings.clinic_name || "",
    display_name: settings.display_name || "",
    postal_code: settings.postal_code || "",
    address: settings.address || "",
    phone: settings.phone || "",
    official_line_name: settings.official_line_name || "",
    public_notice: settings.public_notice || "",
    timezone: settings.timezone || "Asia/Tokyo",
    reception_status: settings.reception_status || "open",
    time_slot_minutes: Number(settings.time_slot_minutes || 30),
    queue_mode: settings.queue_mode || "",
    morning_open_time: settings.morning_open_time || "",
    morning_close_time: settings.morning_close_time || "",
    morning_last_accept_time: settings.morning_last_accept_time || "",
    afternoon_open_time: settings.afternoon_open_time || "",
    afternoon_close_time: settings.afternoon_close_time || "",
    afternoon_last_accept_time: settings.afternoon_last_accept_time || "",
    max_morning_queue: Number(settings.max_morning_queue || 0),
    max_afternoon_queue: Number(settings.max_afternoon_queue || 0),
    status: settings.status || "",
    feature_switch_version: FEATURE_SWITCH_VERSION,
    feature_preset: normalizeFeaturePreset(settings.feature_preset || "standard"),
    feature_flags: normalizeFeatureFlags(settings.feature_flags),
    questionnaire_modules: normalizeQuestionnaireModules(settings.questionnaire_modules),
    public_channel_settings: normalizePublicChannelSettings(settings.public_channel_settings),
    integrated_api_version: INTEGRATED_API_VERSION,
    web_questionnaire_version: WEB_QUESTIONNAIRE_VERSION
  };
}

function normalizeCardLookupItemForPublic(clinicCode, card = {}) {
  const token = card.qr_token || card.card_token || "";
  return {
    guardian_id: card.guardian_id || "",
    guardian_name: card.guardian_name || "",
    pet_id: card.pet_id || "",
    pet_name: card.pet_name || "",
    animal_type: card.animal_type || card.species_label || "",
    species: card.species || "",
    species_label: card.species_label || card.animal_type || "",
    breed: card.breed || "",
    sex: card.sex || "",
    age_text: card.age_text || "",
    medical_note: card.medical_note || card.caution_memo || "",
    allergy_note: card.allergy_note || card.allergies || "",
    photo_url: card.photo_url || card.pet_photo_url || "",
    pet_photo_url: card.pet_photo_url || card.photo_url || "",
    card_id: card.card_id || card.id || "",
    card_no: card.card_no || "",
    card_token: token,
    qr_token: token,
    qr_payload: token ? `vetcard:${clinicCode}:${token}` : "",
    card_enabled: card.card_enabled !== false
  };
}

function sanitizePublicQueueEntry(row = {}) {
  return {
    queue_number:row.queue_number ?? row.reception_number ?? null,
    status:normalizeQueueStatus(row.status||row.queue_status||"","waiting"),
    target_date:row.target_date||row.date||"", day_part:row.day_part||"",
    entry_kind:row.entry_kind||"", request_category:row.request_category||""
  };
}

async function handlePublicQueueEntriesSafe(request, env) {
  const clinicCode = getParam(request,"clinic_code",DEFAULT_CLINIC_CODE);
  const clinic = await getClinicByCode(env,clinicCode);
  const date = normalizeQueueDate(getParam(request,"date",todayJST()));
  const dayPart = cleanString(getParam(request,"day_part",""));
  const rows = await getQueueEntriesRows(env,clinic.id,{
    date,day_part:dayPart,status:cleanString(getParam(request,"status","")),
    entry_kind:cleanString(getParam(request,"entry_kind","")),
    request_category:cleanString(getParam(request,"request_category","")),
    limit:normalizeLimit(getParam(request,"limit","120"),120,300)
  });
  const summaryRows = await getQueueSummaryRows(env,clinic.id,date,dayPart);
  return jsonResponse({
    ok:true, privacy_mode:"public_sanitized", clinic:normalizeClinicForPublic(clinic),
    date,day_part:dayPart||"all",items:rows.map(sanitizePublicQueueEntry),
    summary:summaryRows[0]||buildEmptyQueueSummary(clinic,date,dayPart||"full_day")
  });
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  // STEP VET-34C-R3:
  // 管理POSTだけブラウザで Failed to fetch になるケースを避けるため、
  // preflightの要求ヘッダー差異に強くする。
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "Content-Type, X-DPRO-Worker-Version",
  "Access-Control-Max-Age": "86400"
};

export default {
  async fetch(request, env) {
    const originCheck = requestOriginAllowed(request, env);
    if (!originCheck.ok) {
      return errorResponse("許可されていないWebサイトからのAPIアクセスを拒否しました。", 403, {
        code:"origin_not_allowed", final_audit_version:FINAL_AUDIT_VERSION
      });
    }
    if (request.method === "OPTIONS") {
      // V1.2-R2: Browser preflight が要求したヘッダー名をそのまま許可する。
      // application/json / LIFF本人確認ヘッダーを使う画面で "Failed to fetch" になる差異を吸収する。
      const preflightHeaders = {
        ...CORS_HEADERS,
        "X-DPRO-Worker-Version": WORKER_VERSION
      };
      const requestedHeaders = cleanString(request.headers.get("Access-Control-Request-Headers"));
      if (requestedHeaders) preflightHeaders["Access-Control-Allow-Headers"] = requestedHeaders;
      if (originCheck.origin) preflightHeaders["Access-Control-Allow-Origin"] = originCheck.origin;
      return new Response(null, {
        status: 204,
        headers: preflightHeaders
      });
    }

    const url = new URL(request.url);
    const path = normalizePath(url.pathname);

    try {
      const memberIdentity = await enforceProductionMemberIdentity(request, env, path);
      if (!memberIdentity.ok) {
        return errorResponse(memberIdentity.message || "LINE本人確認に失敗しました。",
          memberIdentity.status || 401, {
            code:memberIdentity.code || "member_identity_failed",
            final_audit_version:FINAL_AUDIT_VERSION
          });
      }
      if (memberIdentity.request) request = memberIdentity.request;
      if (path === "/api/health") {
        return jsonResponse({
          ok: true,
          service: SERVICE_ID,
          service_name: SERVICE_NAME,
          message: "DPRO PET CARE LINE VET API is running.",
          version: WORKER_VERSION,
          feature_switch_version: FEATURE_SWITCH_VERSION,
          web_questionnaire_version: WEB_QUESTIONNAIRE_VERSION,
          default_clinic_code: getDemoClinicCode(env),
          pet_photo_bucket: PET_PHOTO_BUCKET,
          pet_photo_max_bytes: PET_PHOTO_MAX_BYTES,
          pet_photo_allowed_mime_types: PET_PHOTO_ALLOWED_MIME_TYPES,
          questionnaire_image_bucket: QUESTIONNAIRE_IMAGE_BUCKET,
          questionnaire_image_max_bytes: QUESTIONNAIRE_IMAGE_MAX_BYTES,
          questionnaire_image_max_count: QUESTIONNAIRE_IMAGE_MAX_COUNT,
          questionnaire_image_allowed_mime_types: QUESTIONNAIRE_IMAGE_ALLOWED_MIME_TYPES,
          questionnaire_image_storage_mode: "private_signed_url",
          questionnaire_image_upload_mode: "browser_direct_signed_upload",
          questionnaire_visit_link_version: QUESTIONNAIRE_VISIT_LINK_VERSION,
          questionnaire_auto_link_mode: "pet_context_safe",
          questionnaire_queue_enrichment: true,
          questionnaire_appointment_enrichment: true,
          doctor_questionnaire_image_view_version: DOCTOR_QUESTIONNAIRE_IMAGE_VIEW_VERSION,
          doctor_questionnaire_image_view_feature_switch: "questionnaire_images",
          doctor_questionnaire_image_signed_url_seconds: QUESTIONNAIRE_IMAGE_SIGNED_URL_SECONDS,
          v11_final_audit_version: V11_FINAL_AUDIT_VERSION,
          v11_final_audit_clinic_code_mismatch_guard: true,
          v11_final_audit_verified_guardian_guard: true,
          v11_final_audit_staff_image_switch_enforced: true,
          multi_pet_booking_version: MULTI_PET_BOOKING_VERSION,
          multi_pet_booking_group_model: "one_exact_appointment_per_pet",
          multi_pet_booking_modes: ["consecutive", "same_time"],
          multi_pet_booking_feature_switch: "multi_pet_booking",
          multi_pet_booking_single_fallback: true,
          multi_pet_booking_compensating_rollback: true,
          multi_pet_booking_create_optimization_version: "DPRO-VET-MULTI-CREATE-R4",
          flexible_appointment_time_version: FLEXIBLE_APPOINTMENT_TIME_VERSION,
          vaccine_interval_control_version: VACCINE_INTERVAL_CONTROL_VERSION,
          vaccine_interval_control_feature_switch: "vaccine_interval_control",
          vaccine_interval_control_default: false,
          vaccine_interval_control_policy: "clinic_configured_no_fixed_medical_judgement",
          integrated_api_version: INTEGRATED_API_VERSION,
          integrated_state_api: true,
          integrated_member_sources: ["line", "web"],
          integrated_staff_sources: ["line", "web", "phone", "counter", "staff", "import"],
          exact_appointment_start_intervals: [10, 15, 20, 30],
          exact_appointment_duration_step_minutes: 5,
          exact_appointment_demo_slot_minutes: 30,
          exact_appointment_guard_version: EXACT_APPOINTMENT_GUARD_VERSION,
          line_call_feature_version: LINE_CALL_FEATURE_VERSION,
          doctor_slot_feature_version: DOCTOR_SLOT_FEATURE_VERSION,
          appointment_reminder_automation_version: APPOINTMENT_REMINDER_AUTOMATION_VERSION,
          appointment_reminder_recommended_cron: APPOINTMENT_REMINDER_RECOMMENDED_CRON,
          appointment_checkin_feature_version: APPOINTMENT_CHECKIN_FEATURE_VERSION,
          qr_appointment_link_feature_version: QR_APPOINTMENT_LINK_FEATURE_VERSION,
          appointment_action_notice_feature_version: APPOINTMENT_ACTION_NOTICE_FEATURE_VERSION,
          recall_automation_version: RECALL_AUTOMATION_VERSION,
          final_audit_version: FINAL_AUDIT_VERSION,
          cors_restricted: true,
          public_queue_detail_protected: true,
          production_member_identity_policy: "verified_line_id_token_required",
          line_login_channel_id_configured: Boolean(cleanString(env.LINE_LOGIN_CHANNEL_ID)),
          recall_automation_production_opt_in: toBool(env.VET_RECALL_AUTOMATION_ENABLED, false),
          line_channel_access_token_configured: Boolean(cleanString(env.LINE_CHANNEL_ACCESS_TOKEN)),
          line_notification_delivery_mode: normalizeLineDeliveryMode(env.LINE_NOTIFICATION_DELIVERY_MODE || "hold"),
          demo_line_delivery_forced_hold: true,
          now: new Date().toISOString()
        });
      }

      // =====================================================
      // STEP VET-34C-R3: 管理POST診断・登録POST安定化
      // =====================================================

      if (path === "/api/admin/post-echo" && (request.method === "POST" || request.method === "GET")) {
        const authResult = requireAdmin(request, env);
        if (!authResult.ok) return errorResponse(authResult.message, 401, {
          route: "admin_post_echo",
          worker_version: WORKER_VERSION
        });

        const body = request.method === "GET" ? Object.fromEntries(url.searchParams.entries()) : await readJson(request);

        return jsonResponse({
          ok: true,
          message: "管理POST通信はWorkerまで到達しています。",
          route: "admin_post_echo",
          method: request.method,
          path,
          worker_version: WORKER_VERSION,
          received_keys: Object.keys(body || {}),
          now: new Date().toISOString()
        });
      }

      if ((path === "/api/admin/register-by-staff" || path === "/api/admin/guardians/register-by-staff" || path === "/api/admin/staff/register") && request.method === "POST") {
        const authResult = requireAdmin(request, env);
        if (!authResult.ok) return errorResponse(authResult.message, 401, {
          route: "register_by_staff_r3",
          worker_version: WORKER_VERSION
        });

        return handleProdAdminRegisterByStaffR3(request, env);
      }

      // =====================================================
      // Public
      // =====================================================

      if (path === "/api/public/clinic" && request.method === "GET") {
        return handlePublicClinic(request, env);
      }

      if (path === "/api/public/clinic-settings" && request.method === "GET") {
        return handlePublicClinicSettings(request, env);
      }

      if (path === "/api/public/integrated-state" && request.method === "GET") {
        return handlePublicIntegratedState(request, env);
      }

      if (path === "/api/public/clinic-calendar" && request.method === "GET") {
        return handlePublicClinicCalendar(request, env);
      }

      if (path === "/api/public/clinic-today-status" && request.method === "GET") {
        return handlePublicClinicTodayStatus(request, env);
      }

      if (path === "/api/public/appointment-options" && request.method === "GET") {
        return handleAppointmentOptions(request, env);
      }

      // STEP VET-APPOINTMENT-1: 公開日時指定予約
      if (path === "/api/public/exact-appointments/settings" && request.method === "GET") {
        return handleExactAppointmentPublicSettings(request, env);
      }
      if (path === "/api/public/exact-appointments/availability" && request.method === "GET") {
        return handleExactAppointmentAvailability(request, env);
      }
      if (path === "/api/public/exact-appointments/doctors" && request.method === "GET") {
        return handleExactAppointmentPublicDoctors(request, env);
      }

      // =====================================================
      // STEP VET-PHOTO-1B: ペット写真アイコンAPI
      // 飼い主側の会員証画面から、ペットごとの写真を1枚だけ登録・変更・削除する。
      // 病院側は原則として確認用に見るだけ。
      // =====================================================

      if ((
        path === "/api/public/pets/photo/update" ||
        path === "/api/member/pets/photo/update" ||
        path === "/api/public/pet-photo/update" ||
        path === "/api/member/pet-photo/update"
      ) && request.method === "POST") {
        return handlePetPhotoUpdate(request, env);
      }

      if ((
        path === "/api/public/pets/photo/delete" ||
        path === "/api/member/pets/photo/delete" ||
        path === "/api/public/pet-photo/delete" ||
        path === "/api/member/pet-photo/delete"
      ) && request.method === "POST") {
        return handlePetPhotoDelete(request, env);
      }

      // =====================================================
      // STEP VET-34C-R2: 本番登録・LINE連携・QR診察券API
      // 既存Worker機能を残したまま追加
      // =====================================================

      if ((path === "/api/public/register" || path === "/api/member/register") && request.method === "POST") {
        return handleProdPublicRegisterOwnerSelf(request, env);
      }

      if ((path === "/api/public/register/check-duplicate" || path === "/api/member/register/check-duplicate") && request.method === "POST") {
        return handleProdPublicRegisterDuplicateCheck(request, env);
      }

      if ((path === "/api/public/my-cards" || path === "/api/member/my-cards") && (request.method === "GET" || request.method === "POST")) {
        return handleProdPublicMyCards(request, env);
      }

      if ((path === "/api/public/card-lookup" || path === "/api/member/card-lookup") && (request.method === "GET" || request.method === "POST")) {
        return handleProdPublicCardLookup(request, env);
      }

      if (path === "/api/public/line-link-token" && request.method === "GET") {
        return handleProdPublicLineLinkTokenGet(request, env);
      }

      if ((path === "/api/public/line-link-complete" || path === "/api/member/line-link-complete-v2") && request.method === "POST") {
        return handleProdPublicLineLinkComplete(request, env);
      }

      // =====================================================
      // Member / LIFF
      // =====================================================

      if (path === "/api/member/pet-card" && request.method === "GET") {
        return handleMemberPetCard(request, env);
      }

      if (path === "/api/member/pet-cards" && request.method === "GET") {
        return handleMemberPetCards(request, env);
      }

      if (path === "/api/member/line-link/status" && request.method === "GET") {
        return handleMemberLineLinkStatus(request, env);
      }

      if (path === "/api/member/line-link/complete" && request.method === "POST") {
        return handleMemberLineLinkComplete(request, env);
      }

      if (path === "/api/member/questionnaire/image-upload-url" && request.method === "POST") {
        return handleQuestionnaireImageUploadUrl(request, env);
      }

      if (path === "/api/member/questionnaire/create" && request.method === "POST") {
        return handleQuestionnaireCreate(request, env);
      }

      // STEP VET-APPOINTMENT-1: 飼い主の日時指定予約
      if (path === "/api/member/exact-appointments" && request.method === "GET") {
        return handleMemberExactAppointmentList(request, env);
      }
      if (path === "/api/member/exact-appointments/create" && request.method === "POST") {
        return handleMemberExactAppointmentCreate(request, env);
      }
      if (path === "/api/member/exact-appointments/change" && request.method === "POST") {
        return handleMemberExactAppointmentChange(request, env);
      }
      if (path === "/api/member/exact-appointments/cancel" && request.method === "POST") {
        return handleMemberExactAppointmentCancel(request, env);
      }

      // DPRO PET CARE LINE V1.2: 複数ペット同時予約（既存1予約=1ペット構造をグループ化）
      if (path === "/api/member/exact-appointments/multi-availability" && request.method === "POST") {
        return handleMemberMultiExactAppointmentAvailability(request, env);
      }
      if (path === "/api/member/exact-appointments/multi-create" && request.method === "POST") {
        return handleMemberMultiExactAppointmentCreate(request, env);
      }
      if (path === "/api/member/exact-appointments/multi-change" && request.method === "POST") {
        return handleMemberMultiExactAppointmentChange(request, env);
      }
      if (path === "/api/member/exact-appointments/multi-cancel" && request.method === "POST") {
        return handleMemberMultiExactAppointmentCancel(request, env);
      }

      // DPRO PET CARE LINE V1.3: ワクチン・予防の接種間隔制御
      if (path === "/api/member/vaccine-interval/options" && request.method === "POST") {
        return handleMemberVaccineIntervalOptions(request, env);
      }
      if (path === "/api/member/vaccine-interval/check" && request.method === "POST") {
        return handleMemberVaccineIntervalCheck(request, env);
      }

      // STEP VET-15: 飼い主用 順番受付 / 優先受付予約 / お薬・予防受付 / 混雑目安
      if ((path === "/api/member/queue/settings" || path === "/api/public/queue/settings") && request.method === "GET") {
        return handleQueueSettingsGet(request, env);
      }

      if ((path === "/api/member/queue/summary" || path === "/api/public/queue/summary") && request.method === "GET") {
        return handleQueueSummaryGet(request, env);
      }

      if ((path === "/api/member/queue/entries" || path === "/api/public/queue/entries") && request.method === "GET") {
        const queueClinicCode = getParam(request,"clinic_code",DEFAULT_CLINIC_CODE);
        const queueIsDemo = isDemoClinicCodeForAudit(env,queueClinicCode);
        const queueAdmin = requireAdmin(request,env);
        if (queueIsDemo || queueAdmin.ok) return handleQueueEntriesGet(request,env);
        return handlePublicQueueEntriesSafe(request,env);
      }

      if ((
        path === "/api/member/queue/create" ||
        path === "/api/member/waiting/create" ||
        path === "/api/member/waiting-entry/create"
      ) && request.method === "POST") {
        return handleQueueEntryCreate(request, env);
      }

      // =====================================================
      // ANIMARY-COUNTER-V1.1-5: 営業DEMO専用 WEB問診一覧
      // demo clinic のみ。実医院データには使用不可。
      // =====================================================
      if (path === "/api/demo/questionnaires" && request.method === "GET") {
        return handleQuestionnaireAdminList(request, env, true);
      }
      if (path === "/api/demo/questionnaires/review" && request.method === "POST") {
        return handleQuestionnaireReview(request, env, true);
      }

      // =====================================================
      // Admin / Owner / Doctor / Scan 認証必須
      // =====================================================

      if (
        path.startsWith("/api/scan/") ||
        path.startsWith("/api/doctor/") ||
        path.startsWith("/api/owner/") ||
        path.startsWith("/api/admin/")
      ) {
        const authResult = requireAdmin(request, env);
        if (!authResult.ok) return errorResponse(authResult.message, 401);
      }


      if (path === "/api/admin/queue/entries" && request.method === "GET") {
        return handleQueueEntriesGet(request, env);
      }

      // ANIMARY-COUNTER-V1.1-5: 院内側WEB問診確認
      if ((path === "/api/admin/questionnaires" || path === "/api/owner/questionnaires" || path === "/api/doctor/questionnaires") && request.method === "GET") {
        return handleQuestionnaireAdminList(request, env, false);
      }
      // ANIMARY-COUNTER-V1.1-7: ドクター画面から1問診の詳細・症状画像を安全に取得
      if (path === "/api/doctor/questionnaire-detail" && request.method === "GET") {
        return handleDoctorQuestionnaireDetail(request, env);
      }
      if ((path === "/api/admin/questionnaires/review" || path === "/api/owner/questionnaires/review" || path === "/api/doctor/questionnaires/review") && request.method === "POST") {
        return handleQuestionnaireReview(request, env, false);
      }

      // STEP VET-36B: 医院設定API
      if ((path === "/api/admin/clinic-settings" || path === "/api/owner/clinic-settings") && request.method === "GET") {
        return handleAdminClinicSettingsGet(request, env);
      }

      if ((path === "/api/admin/clinic-calendar" || path === "/api/owner/clinic-calendar") && request.method === "GET") {
        return handlePublicClinicCalendar(request, env);
      }

      if ((path === "/api/admin/clinic-settings/update" || path === "/api/admin/clinic-settings/save" || path === "/api/owner/clinic-settings/save") && request.method === "POST") {
        return handleAdminClinicSettingsUpdate(request, env);
      }

      if ((path === "/api/admin/clinic-regular-holidays/save" || path === "/api/owner/clinic-regular-holidays/save") && request.method === "POST") {
        return handleAdminClinicRegularHolidaysSave(request, env);
      }

      if ((path === "/api/admin/clinic-special-days/save" || path === "/api/owner/clinic-special-days/save") && request.method === "POST") {
        return handleAdminClinicSpecialDaysSave(request, env);
      }

      if ((path === "/api/admin/clinic-special-days/delete" || path === "/api/owner/clinic-special-days/delete") && request.method === "POST") {
        return handleAdminClinicSpecialDayDelete(request, env);
      }

      // STEP VET-34C-R2: 本番登録・受付登録・LINE連携 管理API
      if ((path === "/api/admin/register-by-staff" || path === "/api/admin/guardians/register-by-staff" || path === "/api/admin/staff/register") && request.method === "POST") {
        return handleProdAdminRegisterByStaff(request, env);
      }

      if ((path === "/api/admin/line-link-token" || path === "/api/admin/line-link-token/create-v2") && request.method === "POST") {
        return handleProdAdminLineLinkTokenCreate(request, env);
      }

      if (path === "/api/admin/line-unlink" && request.method === "POST") {
        return handleProdAdminLineUnlink(request, env);
      }

      if ((path === "/api/admin/pet/deactivate" || path === "/api/admin/pets/deactivate") && request.method === "POST") {
        return handleProdAdminPetDeactivate(request, env);
      }

      if (path === "/api/admin/duplicate-reviews" && request.method === "GET") {
        return handleProdAdminDuplicateReviews(request, env);
      }

      if (path === "/api/admin/duplicate-reviews/update" && request.method === "POST") {
        return handleProdAdminDuplicateReviewUpdate(request, env);
      }

      if ((path === "/api/admin/prod-register-check" || path === "/api/admin/register-readiness-check") && request.method === "GET") {
        return handleProdRegisterReadinessCheck(request, env);
      }

      // Safety
      if (path === "/api/admin/safety-check" && request.method === "GET") return handleAdminSafetyCheck(request, env);
      if (path === "/api/admin/production-readiness-check" && request.method === "GET") return handleProductionReadinessCheck(request, env);
      if (path === "/api/admin/clinic-readiness-check" && request.method === "GET") return handleProductionReadinessCheck(request, env);

      // =====================================================
      // STEP VET-38B: 営業前デモ準備API
      // system-check.html から1か所で実行するためのAPI。
      // 本番安全ガード：
      // - 管理コード必須
      // - POSTのみ実行
      // - clinic_code=dpro_vet_demo のみ許可
      // - 確認文言必須
      // =====================================================

      if ((path === "/api/admin/demo/prepare-status" || path === "/api/admin/demo/status") && request.method === "POST") {
        return handleSalesDemoPrepare(request, env);
      }

      if ((path === "/api/admin/demo/prepare-status" || path === "/api/admin/demo/status") && request.method === "GET") {
        return handleSalesDemoPrepareStatus(request, env);
      }

      const salesDemoPreparePaths = [
        "/api/admin/demo/prepare",
        "/api/admin/demo/sales-prepare",
        "/api/admin/demo/sales-demo-prepare",
        "/api/admin/demo/reset",
        "/api/admin/demo/sales-setup",
        "/api/admin/demo/sales-reset-final"
      ];

      if (salesDemoPreparePaths.includes(path) && request.method !== "POST") {
        return errorResponse("営業前デモ準備は安全対策のためPOSTのみ許可しています。GETでは実行できません。", 405, {
          path,
          method: request.method,
          required_method: "POST",
          allowed_endpoint: "/api/admin/demo/prepare",
          worker_version: WORKER_VERSION
        });
      }

      if (salesDemoPreparePaths.includes(path) && request.method === "POST") {
        return handleSalesDemoPrepare(request, env);
      }

      // Scan / reception
      if (path === "/api/scan/lookup" && request.method === "GET") return handleScanLookup(request, env);
      if (path === "/api/scan/today" && request.method === "GET") return handleTodayCheckins(request, env);
      if (path === "/api/scan/check-in" && request.method === "POST") return handleCheckIn(request, env);
      if (path === "/api/scan/reception/check-in" && request.method === "POST") return handleCheckIn(request, env);
      if (path === "/api/scan/check-in/cancel" && request.method === "POST") return handleCheckInCancel(request, env);
      if (path === "/api/scan/reception/check-in/cancel" && request.method === "POST") return handleCheckInCancel(request, env);
      if (path === "/api/scan/reception/cancel-check-in" && request.method === "POST") return handleCheckInCancel(request, env);

      // Doctor
      if (path === "/api/doctor/today" && request.method === "GET") return handleTodayCheckins(request, env);
      if (path === "/api/doctor/daily-statuses" && request.method === "GET") return handleTodayCheckins(request, env);
      if (path === "/api/doctor/exam-start" && request.method === "POST") return handleExamStart(request, env);
      if (path === "/api/doctor/exam-complete" && request.method === "POST") return handleExamComplete(request, env);
      if (path === "/api/doctor/memo-save" && request.method === "POST") return handleDoctorMemoSave(request, env);
      if (path === "/api/doctor/line-follow-copied" && request.method === "POST") return handleLineFollowCopied(request, env);

      // Owner
      if (path === "/api/owner/today" && request.method === "GET") return handleOwnerToday(request, env);
      if (path === "/api/owner/daily-statuses" && request.method === "GET") return handleTodayCheckins(request, env);
      if (path === "/api/owner/prevention-todos" && request.method === "GET") return handlePreventionTodos(request, env);
      if (path === "/api/owner/followups" && request.method === "GET") return handleFollowupTodos(request, env);
      if (path === "/api/owner/followups/update" && request.method === "POST") return handleFollowupUpdate(request, env);
      if (path === "/api/owner/line-unlinked-guardians" && request.method === "GET") return handleLineUnlinkedGuardians(request, env);
      if (path === "/api/owner/guardians/search" && (request.method === "GET" || request.method === "POST")) return handleGuardianSearch(request, env);
      if (path === "/api/owner/guardians/detail" && request.method === "GET") return handleGuardianDetail(request, env);
      if (path === "/api/owner/pets/detail" && request.method === "GET") return handlePetDetail(request, env);


      // STEP VET-15: 院内側 順番受付 / 優先受付予約 / 混雑目安
      if ((path === "/api/owner/queue/settings" || path === "/api/admin/queue/settings") && request.method === "GET") return handleQueueSettingsGet(request, env);
      if (path === "/api/admin/queue/settings" && request.method === "POST") return handleQueueSettingsSave(request, env);

      if ((path === "/api/owner/queue/summary" || path === "/api/doctor/queue/summary" || path === "/api/admin/queue/summary") && request.method === "GET") return handleQueueSummaryGet(request, env);
      if ((path === "/api/owner/queue/today" || path === "/api/doctor/queue/today" || path === "/api/admin/queue/today") && request.method === "GET") return handleQueueEntriesGet(request, env);
      if ((path === "/api/owner/queue/entries" || path === "/api/doctor/queue/entries" || path === "/api/admin/queue/entries") && request.method === "GET") return handleQueueEntriesGet(request, env);

      if ((path === "/api/admin/queue/create" || path === "/api/owner/queue/create") && request.method === "POST") return handleQueueEntryCreate(request, env);

      // STEP VET-43:
      // LINEを使わない飼い主さん、電話受付、スタッフ代理受付を
      // 受付PCから追加するための本番運用API。
      if ((
        path === "/api/admin/manual-reception/create" ||
        path === "/api/owner/manual-reception/create" ||
        path === "/api/admin/reception/manual-create" ||
        path === "/api/owner/reception/manual-create"
      ) && request.method === "POST") {
        return handleManualReceptionCreate(request, env);
      }

      // STEP VET-44:
      // 既存患者検索・このペットで受付。
      if ((
        path === "/api/admin/patients/search" ||
        path === "/api/owner/patients/search" ||
        path === "/api/admin/existing-patients/search" ||
        path === "/api/owner/existing-patients/search"
      ) && request.method === "GET") {
        return handleExistingPatientSearch(request, env);
      }

      if ((
        path === "/api/admin/existing-pet-reception/create" ||
        path === "/api/owner/existing-pet-reception/create" ||
        path === "/api/admin/reception/existing-pet-create" ||
        path === "/api/owner/reception/existing-pet-create"
      ) && request.method === "POST") {
        return handleExistingPetReceptionCreate(request, env);
      }

      // STEP VET-45:
      // スタッフ代理登録・既存飼い主へのペット追加。
      if ((
        path === "/api/admin/staff-proxy/register" ||
        path === "/api/owner/staff-proxy/register" ||
        path === "/api/admin/guardian-pet/register" ||
        path === "/api/owner/guardian-pet/register"
      ) && request.method === "POST") {
        return handleStaffProxyGuardianPetRegister(request, env);
      }

      if ((
        path === "/api/admin/existing-guardian/pet-add" ||
        path === "/api/owner/existing-guardian/pet-add" ||
        path === "/api/admin/guardian/pet-add" ||
        path === "/api/owner/guardian/pet-add"
      ) && request.method === "POST") {
        return handleExistingGuardianPetAdd(request, env);
      }

      // STEP VET-47:
      // 飼い主・ペット管理画面用API。
      if ((
        path === "/api/admin/guardians/search" ||
        path === "/api/owner/guardians/search" ||
        path === "/api/admin/patient-management/search" ||
        path === "/api/owner/patient-management/search"
      ) && request.method === "GET") {
        return handleGuardianPetManagementSearch(request, env);
      }

      if ((
        path === "/api/admin/guardian/detail" ||
        path === "/api/owner/guardian/detail" ||
        path === "/api/admin/patient-management/detail" ||
        path === "/api/owner/patient-management/detail"
      ) && request.method === "GET") {
        return handleGuardianPetManagementDetail(request, env);
      }

      if ((
        path === "/api/admin/guardian/update" ||
        path === "/api/owner/guardian/update"
      ) && request.method === "POST") {
        return handleGuardianManagementUpdate(request, env);
      }

      if ((
        path === "/api/admin/pet/update" ||
        path === "/api/owner/pet/update"
      ) && request.method === "POST") {
        return handlePetManagementUpdate(request, env);
      }

      if ((
        path === "/api/admin/pet-card/update" ||
        path === "/api/owner/pet-card/update" ||
        path === "/api/admin/card/update" ||
        path === "/api/owner/card/update"
      ) && request.method === "POST") {
        return handlePetCardManagementUpdate(request, env);
      }

      // STEP VET-48:
      // LINE連携済み / 未連携の整理・連携解除・手動連携。
      if ((
        path === "/api/admin/guardian/line-link/update" ||
        path === "/api/owner/guardian/line-link/update" ||
        path === "/api/admin/line-link/update" ||
        path === "/api/owner/line-link/update"
      ) && request.method === "POST") {
        return handleGuardianLineLinkUpdate(request, env);
      }

      if ((
        path === "/api/admin/guardian/line-link/unlink" ||
        path === "/api/owner/guardian/line-link/unlink" ||
        path === "/api/admin/line-link/unlink" ||
        path === "/api/owner/line-link/unlink"
      ) && request.method === "POST") {
        return handleGuardianLineLinkUnlink(request, env);
      }

      if ((
        path === "/api/admin/guardian/line-link/status" ||
        path === "/api/owner/guardian/line-link/status" ||
        path === "/api/admin/line-link/status" ||
        path === "/api/owner/line-link/status"
      ) && request.method === "GET") {
        return handleGuardianLineLinkStatus(request, env);
      }

      // STEP VET-49:
      // 本番前安全チェック。DB変更なしの読み取り専用API。
      if ((
        path === "/api/admin/production/final-check" ||
        path === "/api/owner/production/final-check" ||
        path === "/api/admin/production-final-check" ||
        path === "/api/owner/production-final-check" ||
        path === "/api/admin/final-safety-check" ||
        path === "/api/owner/final-safety-check"
      ) && request.method === "GET") {
        return handleProductionFinalSafetyCheck(request, env);
      }

      // STEP VET-50:
      // 既存患者CSV一括取込。previewは読み取りチェック、executeは確認文言必須。
      if ((
        path === "/api/admin/import/csv/preview" ||
        path === "/api/owner/import/csv/preview" ||
        path === "/api/admin/patients/import/preview" ||
        path === "/api/owner/patients/import/preview"
      ) && request.method === "POST") {
        return handlePatientCsvImportPreview(request, env);
      }

      if ((
        path === "/api/admin/import/csv/execute" ||
        path === "/api/owner/import/csv/execute" ||
        path === "/api/admin/patients/import/execute" ||
        path === "/api/owner/patients/import/execute"
      ) && request.method === "POST") {
        return handlePatientCsvImportExecute(request, env);
      }

      if ((path === "/api/admin/queue/status" || path === "/api/owner/queue/status" || path === "/api/doctor/queue/status") && request.method === "POST") return handleQueueStatusUpdate(request, env);

      // STEP VET-LINE-CALL-1: LINE直接呼び出し・予約前日案内
      if (path === "/api/admin/line-call/settings" && request.method === "GET") return handleLineCallSettingsGet(request, env);
      if (path === "/api/admin/line-call/settings" && request.method === "POST") return handleLineCallSettingsSave(request, env);
      if (path === "/api/admin/line-call/targets" && request.method === "GET") return handleLineCallTargets(request, env);
      if (path === "/api/admin/line-call/preview" && request.method === "POST") return handleLineCallPreview(request, env);
      if (path === "/api/admin/line-call/send" && request.method === "POST") return handleLineCallSend(request, env);
      if (path === "/api/admin/line-call/retry" && request.method === "POST") return handleLineCallRetry(request, env);
      if (path === "/api/admin/line-call/cancel" && request.method === "POST") return handleLineCallCancel(request, env);
      if (path === "/api/admin/line-call/history" && request.method === "GET") return handleLineCallHistory(request, env);
      if (path === "/api/admin/line-call/check" && request.method === "GET") return handleLineCallCheck(request, env);
      if (path === "/api/admin/line-reminder/status" && request.method === "GET") return handleAppointmentReminderAutomationStatus(request, env);
      if (path === "/api/admin/recall-automation/status" && request.method === "GET") return handleRecallAutomationStatus(request, env);

      if ((path === "/api/admin/queue/congestion" || path === "/api/owner/queue/congestion") && request.method === "POST") return handleQueueCongestionSave(request, env);
      if (path === "/api/admin/queue/demo/reset" && request.method === "POST") return handleQueueDemoReset(request, env);

      // STEP VET-APPOINTMENT-1: 日時指定予約 管理
      if (path === "/api/admin/exact-appointments/settings" && request.method === "GET") return handleAdminExactAppointmentSettingsGet(request, env);
      if (path === "/api/admin/exact-appointments/settings" && request.method === "POST") return handleAdminExactAppointmentSettingsSave(request, env);
      if (path === "/api/admin/exact-appointments/services" && request.method === "GET") return handleAdminExactAppointmentServicesGet(request, env);
      if (path === "/api/admin/exact-appointments/services/save" && request.method === "POST") return handleAdminExactAppointmentServiceSave(request, env);
      if (path === "/api/admin/exact-appointments/services/archive" && request.method === "POST") return handleAdminExactAppointmentServiceArchive(request, env);
      if (path === "/api/admin/exact-appointments" && request.method === "GET") return handleAdminExactAppointmentList(request, env);
      if (path === "/api/admin/exact-appointments/create" && request.method === "POST") return handleAdminExactAppointmentCreate(request, env);
      if (path === "/api/admin/exact-appointments/status" && request.method === "POST") return handleAdminExactAppointmentStatus(request, env);
      if (path === "/api/admin/exact-appointments/check-in" && request.method === "POST") return handleAdminExactAppointmentCheckIn(request, env);
      if (path === "/api/admin/exact-appointments/check" && request.method === "GET") return handleAdminExactAppointmentCheck(request, env);
      // STEP VET-DOCTOR-SLOT-1: 獣医師別予約枠
      if (path === "/api/admin/exact-appointments/doctors" && request.method === "GET") return handleAdminExactAppointmentDoctorsGet(request, env);
      if (path === "/api/admin/exact-appointments/doctors/save" && request.method === "POST") return handleAdminExactAppointmentDoctorSave(request, env);
      if (path === "/api/admin/exact-appointments/doctors/archive" && request.method === "POST") return handleAdminExactAppointmentDoctorArchive(request, env);
      if (path === "/api/admin/exact-appointments/doctors/schedule" && request.method === "POST") return handleAdminExactAppointmentDoctorScheduleSave(request, env);
      if (path === "/api/admin/exact-appointments/doctors/block" && request.method === "POST") return handleAdminExactAppointmentDoctorBlockSave(request, env);
      if (path === "/api/admin/exact-appointments/doctors/block-delete" && request.method === "POST") return handleAdminExactAppointmentDoctorBlockDelete(request, env);
      if (path === "/api/admin/exact-appointments/doctor-assign" && request.method === "POST") return handleAdminExactAppointmentDoctorAssign(request, env);

      // Admin settings
      if (path === "/api/admin/settings" && request.method === "GET") return handleSettingsGet(request, env);
      if (path === "/api/admin/settings" && request.method === "POST") return handleSettingsSave(request, env);
      if (path === "/api/admin/special-days" && request.method === "GET") return handleSpecialDaysGet(request, env);
      if (path === "/api/admin/special-days/upsert" && request.method === "POST") return handleSpecialDayUpsert(request, env);
      if (path === "/api/admin/special-days/delete" && request.method === "POST") return handleSpecialDayDelete(request, env);
      if (path === "/api/admin/appointment-options" && request.method === "GET") return handleAppointmentOptions(request, env);

      // Admin guardians / pets
      if ((path === "/api/admin/guardians" || path === "/api/admin/guardians/search") && (request.method === "GET" || request.method === "POST")) return handleGuardianSearch(request, env);
      if (path === "/api/admin/guardians/create" && request.method === "POST") return handleGuardianCreate(request, env);
      if (path === "/api/admin/guardians/update" && request.method === "POST") return handleGuardianUpdate(request, env);
      if (path === "/api/admin/guardians/detail" && request.method === "GET") return handleGuardianDetail(request, env);
      if (path === "/api/admin/guardians/archive" && request.method === "POST") return handleGuardianArchive(request, env);
      if (path === "/api/admin/guardians/restore" && request.method === "POST") return handleGuardianRestore(request, env);

      if (path === "/api/admin/pets/create" && request.method === "POST") return handlePetCreate(request, env);
      if (path === "/api/admin/pets/update" && request.method === "POST") return handlePetUpdate(request, env);
      if (path === "/api/admin/pets/detail" && request.method === "GET") return handlePetDetail(request, env);
      if (path === "/api/admin/pets/card/reissue" && request.method === "POST") return handlePetCardReissue(request, env);
      if (path === "/api/admin/pets/card/disable" && request.method === "POST") return handlePetCardSetEnabled(request, env, false);
      if (path === "/api/admin/pets/card/enable" && request.method === "POST") return handlePetCardSetEnabled(request, env, true);

      // Admin line link
      if (path === "/api/admin/line-link-token/create" && request.method === "POST") return handleLineLinkTokenCreate(request, env);
      if (path === "/api/admin/line-link-tokens" && request.method === "GET") return handleLineLinkTokens(request, env);
      if (path === "/api/admin/line-link-guide/copied" && request.method === "POST") return handleLineLinkGuideCopied(request, env);
      if (path === "/api/admin/line-unlinked-guardians" && request.method === "GET") return handleLineUnlinkedGuardians(request, env);

      // Admin prevention / followups / templates / logs
      if (path === "/api/admin/prevention-schedules" && request.method === "GET") return handlePreventionSchedules(request, env);
      if (path === "/api/admin/prevention-schedules/create" && request.method === "POST") return handlePreventionCreate(request, env);
      if (path === "/api/admin/prevention-schedules/update" && request.method === "POST") return handlePreventionUpdate(request, env);
      if (path === "/api/admin/vaccine-interval/rules" && request.method === "GET") return handleAdminVaccineIntervalRules(request, env);
      if (path === "/api/admin/vaccine-interval/rules/save" && request.method === "POST") return handleAdminVaccineIntervalRuleSave(request, env);
      if (path === "/api/admin/vaccine-interval/rules/archive" && request.method === "POST") return handleAdminVaccineIntervalRuleArchive(request, env);
      if (path === "/api/admin/followups" && request.method === "GET") return handleFollowupTodos(request, env);
      if (path === "/api/admin/followups/create" && request.method === "POST") return handleFollowupCreate(request, env);
      if (path === "/api/admin/followups/update" && request.method === "POST") return handleFollowupUpdate(request, env);
      if (path === "/api/admin/templates" && request.method === "GET") return handleTemplates(request, env);
      if (path === "/api/admin/message-queue" && request.method === "GET") return handleMessageQueue(request, env);
      if (path === "/api/admin/message-queue/create" && request.method === "POST") return handleMessageQueueCreate(request, env);
      if (path === "/api/admin/message-queue/update" && request.method === "POST") return handleMessageQueueUpdate(request, env);
      if (path === "/api/admin/operation-logs" && request.method === "GET") return handleOperationLogs(request, env);

      return errorResponse("API endpoint not found.", 404, { path, method: request.method });
    } catch (error) {
      console.error("Worker error:", error);
      return errorResponse(error && error.message ? error.message : "Internal server error.", 500, {
        service: SERVICE_ID,
        version: WORKER_VERSION
      });
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      const meta = {
        scheduled_time: event?.scheduledTime || Date.now(),
        cron: event?.cron || ""
      };

      try {
        const result = await runAppointmentReminderAutomation(env, meta);
        console.log("VET appointment reminder automation:", JSON.stringify(result));
      } catch (error) {
        console.error("VET appointment reminder automation failed:", error);
      }

      try {
        const result = await runRecallAutomation(env, meta);
        console.log("VET prevention/followup recall automation:", JSON.stringify(result));
      } catch (error) {
        console.error("VET prevention/followup recall automation failed:", error);
      }
    })());
  }
};


// =========================================================
// Response / Utility
// =========================================================

function normalizePath(pathname) {
  const path = String(pathname || "/").replace(/\/+$/, "");
  return path || "/";
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-DPRO-Worker-Version": WORKER_VERSION
    }
  });
}

function errorResponse(message, status = 400, extra = {}) {
  return jsonResponse({ ok: false, error: message, message, ...extra }, status);
}

async function readJson(request) {
  if (request.method === "GET" || request.method === "HEAD") return {};
  try {
    const cloned = request.clone();
    return await cloned.json();
  } catch {
    try {
      const text = await request.clone().text();
      if (!text) return {};
      return JSON.parse(text);
    } catch {
      return {};
    }
  }
}

async function withTimeout(promise, ms, label = "処理") {
  let timerId;
  const timeout = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(`${label}がタイムアウトしました。もう一度実行してください。`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timerId);
  }
}

function getParam(request, name, fallback = "") {
  const url = new URL(request.url);
  const value = url.searchParams.get(name);
  return value === null || value === undefined ? fallback : String(value).trim();
}

function cleanString(value) {
  return String(value ?? "").trim();
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanString(value));
}

function normalizeForLooseCompare(value) {
  return cleanString(value).replace(/\s+/g, "").toLowerCase();
}


function toHalfWidthPhoneText(value) {
  return String(value ?? "")
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/[＋]/g, "+")
    .replace(/[－ー―−]/g, "-")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")");
}

function normalizePhoneForSearch(value) {
  const text = toHalfWidthPhoneText(value).trim();
  if (!text) return "";

  let digits = text.replace(/[^0-9]/g, "");

  // +81 90 xxxx xxxx / 81 90 xxxx xxxx も 090xxxxxxxx として扱う。
  const compact = text.replace(/[\s\-()]/g, "");
  if ((compact.startsWith("+81") || compact.startsWith("81")) && digits.startsWith("81")) {
    digits = `0${digits.slice(2)}`;
  }

  return digits;
}

function normalizePhoneForSave(value) {
  const normalized = normalizePhoneForSearch(value);
  return normalized || cleanString(value);
}

function phoneValuesMatchForVet(a, b) {
  const aa = normalizePhoneForSearch(a);
  const bb = normalizePhoneForSearch(b);
  return Boolean(aa && bb && aa === bb);
}

function normalizePreferredContactForVet(value, fallback = "line") {
  // STEP VET-52.5D:
  // vet_guardians.preferred_contact のCHECK制約に存在しない "staff" を入れない。
  // 本番・DEMO共通で安全な値だけに正規化する。
  const text = cleanString(value).toLowerCase();
  const allowed = ["line", "phone", "email", "sms", "none"];
  if (allowed.includes(text)) return text;
  const fb = cleanString(fallback).toLowerCase();
  return allowed.includes(fb) ? fb : "line";
}

function nullIfEmpty(value) {
  const text = cleanString(value);
  return text ? text : null;
}

function toBool(value, fallback = false) {
  if (value === true || value === false) return value;
  const text = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(text)) return true;
  if (["false", "0", "no", "off"].includes(text)) return false;
  return fallback;
}

function normalizeLimit(value, fallback = 50, max = 200) {
  const n = Number(value || fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.floor(n), 1), max);
}

function todayJST() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(now);
}

function addDays(dateText, days) {
  const [y, m, d] = parseDateText(dateText);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + Number(days || 0));
  return toDateTextUTC(base);
}

function addMonths(dateText, months) {
  const [y, m, d] = parseDateText(dateText);
  const base = new Date(Date.UTC(y, m - 1, d));
  const originalDate = base.getUTCDate();
  base.setUTCMonth(base.getUTCMonth() + Number(months || 0));
  if (base.getUTCDate() < originalDate) base.setUTCDate(0);
  return toDateTextUTC(base);
}

function toDateTextUTC(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateText(dateText) {
  const match = String(dateText || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`Invalid date format. expected YYYY-MM-DD. value=${dateText}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function getDayOfWeekFromDateText(dateText) {
  const [y, m, d] = parseDateText(dateText);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function getDayLabel(day) {
  return ["日曜", "月曜", "火曜", "水曜", "木曜", "金曜", "土曜"][Number(day)] || "";
}

function compareDateText(a, b) {
  const aa = String(a || "");
  const bb = String(b || "");
  if (aa < bb) return -1;
  if (aa > bb) return 1;
  return 0;
}

function normalizeTime(value) {
  if (!value) return null;
  const text = String(value).trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const h = String(Number(match[1])).padStart(2, "0");
  const m = match[2];
  return `${h}:${m}`;
}

function timeToMinutes(value) {
  const time = normalizeTime(value);
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function buildSlotsFromRanges(ranges, slotMinutes, durationMinutes) {
  const slots = [];
  ranges.forEach((range) => {
    const start = timeToMinutes(range.open);
    const end = timeToMinutes(range.close);
    if (start === null || end === null || start >= end) return;
    const lastStart = Math.max(start, end - Number(durationMinutes || 0));
    for (let t = start; t <= lastStart; t += slotMinutes) {
      slots.push(minutesToTime(t));
    }
  });
  return Array.from(new Set(slots));
}

function buildRangesFromHourRow(row) {
  const ranges = [];
  if (!row || row.is_closed) return ranges;

  const open1 = normalizeTime(row.open_time_1);
  const close1 = normalizeTime(row.close_time_1);
  const open2 = normalizeTime(row.open_time_2);
  const close2 = normalizeTime(row.close_time_2);

  if (open1 && close1) ranges.push({ open: open1, close: close1 });
  if (open2 && close2) ranges.push({ open: open2, close: close2 });

  return ranges;
}

function createToken(prefix = "vet") {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex}`;
}

function escapePostgrestLike(value) {
  return String(value || "").replaceAll("%", "\\%").replaceAll("_", "\\_").replaceAll("*", "");
}


// =========================================================
// Auth / Safety
// =========================================================

function normalizeAdminCode(value) {
  return String(value || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function collectAdminCodeCandidates(request) {
  const url = new URL(request.url);
  const authHeader = request.headers.get("Authorization") || "";

  return [
    request.headers.get("x-dpro-admin-code"),
    request.headers.get("X-DPRO-Admin-Code"),
    request.headers.get("x-admin-token"),
    request.headers.get("X-Admin-Token"),
    request.headers.get("x-admin-code"),
    request.headers.get("X-Admin-Code"),
    authHeader,
    url.searchParams.get("admin_code"),
    url.searchParams.get("admin_token"),
    url.searchParams.get("token")
  ]
    .map(normalizeAdminCode)
    .filter(Boolean);
}

function requireAdmin(request, env) {
  const expected = normalizeAdminCode(env.ADMIN_TOKEN || env.DPRO_ADMIN_TOKEN || "");
  if (!expected) return {ok:false,message:"ADMIN_TOKEN is not set in Cloudflare Secrets."};

  const clinicCode = getRequestedClinicCode(request,{});
  const isDemo = cleanString(clinicCode) === getDemoClinicCode(env);
  const authHeader = request.headers.get("Authorization") || "";
  const headerCandidates = [
    request.headers.get("x-dpro-admin-code"),request.headers.get("X-DPRO-Admin-Code"),
    request.headers.get("x-admin-token"),request.headers.get("X-Admin-Token"),
    request.headers.get("x-admin-code"),request.headers.get("X-Admin-Code"),authHeader
  ].map(normalizeAdminCode).filter(Boolean);
  const candidates = isDemo ? collectAdminCodeCandidates(request) : headerCandidates;

  if (!candidates.length) return {ok:false,message:isDemo
    ?"管理コードがありません。管理設定で管理コードを保存してください。"
    :"管理コードはURLではなく管理画面から保存してください。"};
  if (!candidates.some((code)=>code===expected)) return {ok:false,message:"管理コードが正しくありません。"};
  return {ok:true,transport:isDemo&&candidates.length>headerCandidates.length?"demo_compat":"header_or_bearer"};
}

function getDemoClinicCode(env) {
  return cleanString(env.DEMO_CLINIC_CODE) || DEFAULT_CLINIC_CODE;
}

function isDemoOperationsDisabled(env) {
  const value = String(env.DISABLE_DEMO_OPERATIONS || "").trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes" || value === "on";
}

function getRequestedClinicCode(request, body = {}) {
  const url = new URL(request.url);
  return cleanString(
    body.clinic_code ||
    url.searchParams.get("clinic_code") ||
    url.searchParams.get("clinic") ||
    DEFAULT_CLINIC_CODE
  );
}

function booleanEnv(value) {
  const text = String(value || "").trim().toLowerCase();
  return text === "true" || text === "1" || text === "yes" || text === "on";
}

function getAdminAuthDetails(request, env) {
  const url = new URL(request.url);
  const expected = normalizeAdminCode(env.ADMIN_TOKEN || env.DPRO_ADMIN_TOKEN || "");
  const candidates = collectAdminCodeCandidates(request);
  const authHeader = request.headers.get("Authorization") || "";
  const headerCandidates = [
    request.headers.get("x-dpro-admin-code"),
    request.headers.get("X-DPRO-Admin-Code"),
    request.headers.get("x-admin-token"),
    request.headers.get("X-Admin-Token"),
    request.headers.get("x-admin-code"),
    request.headers.get("X-Admin-Code")
  ].map(normalizeAdminCode).filter(Boolean);
  const bearerCode = normalizeAdminCode(authHeader);
  const queryCandidates = [
    url.searchParams.get("admin_code"),
    url.searchParams.get("admin_token"),
    url.searchParams.get("token")
  ].map(normalizeAdminCode).filter(Boolean);

  let transport = "none";
  if (headerCandidates.length) transport = "header";
  else if (bearerCode) transport = "bearer";
  else if (queryCandidates.length) transport = "query";

  return {
    admin_token_configured: Boolean(expected),
    admin_code_provided: Boolean(candidates.length),
    transport,
    query_param_used: Boolean(queryCandidates.length),
    header_used: Boolean(headerCandidates.length),
    bearer_used: Boolean(bearerCode),
    provided_candidate_count: candidates.length,
    any_candidate_matched: Boolean(expected && candidates.some((code) => code === expected)),
    expected_length: expected.length,
    provided_lengths: candidates.map((code) => code.length),
    note: queryCandidates.length
      ? "管理コードがURLパラメータでも送られています。複数候補のうち1つでも一致すれば許可します。"
      : "管理コードはヘッダーまたはBearerで送られています。"
  };
}
function getCloudflareAccessDetails(request, env) {
  const accessEmail = request.headers.get("cf-access-authenticated-user-email") || "";
  const accessJwt = request.headers.get("cf-access-jwt-assertion") || "";
  const detected = Boolean(accessEmail || accessJwt);
  const required = booleanEnv(env.REQUIRE_CLOUDFLARE_ACCESS);

  return {
    detected,
    required,
    ok: !required || detected,
    mode: detected ? "cloudflare_access_detected" : "worker_admin_token_only",
    label: detected
      ? "Cloudflare Access を検出しました。"
      : "Cloudflare Access は未検出です。現在はWorker管理コードによる簡易保護中です。"
  };
}

function buildSafetyMeta(request, env, body = {}) {
  const requestedClinicCode = getRequestedClinicCode(request, body);
  const demoClinicCode = getDemoClinicCode(env);
  const demoOperationsDisabled = isDemoOperationsDisabled(env);
  const isDemoClinic = requestedClinicCode === demoClinicCode;
  const auth = getAdminAuthDetails(request, env);
  const access = getCloudflareAccessDetails(request, env);

  return {
    worker_version: WORKER_VERSION,
    service: SERVICE_ID,
    requested_clinic_code: requestedClinicCode,
    demo_clinic_code: demoClinicCode,
    is_demo_clinic: isDemoClinic,
    is_production_clinic: !isDemoClinic,
    demo_operations_disabled: demoOperationsDisabled,
    can_run_demo_operations: isDemoClinic && !demoOperationsDisabled,
    required_method_for_demo_operations: "POST",
    required_confirm_text: DEMO_OPERATION_CONFIRM_TEXT,
    auth,
    cloudflare_access: access,
    protection_mode: access.detected ? "cloudflare_access_plus_worker_admin_token" : "worker_admin_token_only"
  };
}

function assertDemoOperationAllowed(request, env, body = {}) {
  const meta = buildSafetyMeta(request, env, body);

  if (request.method !== "POST") {
    return {
      ok: false,
      status: 405,
      message: "営業前DEMO設定は安全対策のためPOSTのみ許可しています。GETでは実行できません。",
      safety: meta
    };
  }

  if (meta.demo_operations_disabled) {
    return {
      ok: false,
      status: 403,
      message: "Cloudflare環境変数 DISABLE_DEMO_OPERATIONS=true のため、営業前DEMO設定は停止中です。",
      safety: meta
    };
  }

  if (!meta.is_demo_clinic) {
    return {
      ok: false,
      status: 403,
      message: `本番安全ガードにより拒否しました。営業前DEMO設定は ${meta.demo_clinic_code} のみ実行できます。`,
      safety: meta
    };
  }

  const confirmText = cleanString(
    body.confirm_text ||
    body.confirmation ||
    body.confirm ||
    body.safety_confirm ||
    body.danger_confirm
  );

  if (confirmText !== DEMO_OPERATION_CONFIRM_TEXT) {
    return {
      ok: false,
      status: 400,
      message: `安全確認の文言が一致しません。「${DEMO_OPERATION_CONFIRM_TEXT}」と入力してから実行してください。`,
      safety: { ...meta, confirmation_received: Boolean(confirmText) }
    };
  }

  return {
    ok: true,
    status: 200,
    message: "DEMO操作の本番安全ガードを通過しました。",
    safety: meta
  };
}


// =========================================================
// Supabase REST
// =========================================================

function getSupabaseBaseUrl(env) {
  const url = env.SUPABASE_URL || "";
  if (!url) throw new Error("SUPABASE_URL is not set in Cloudflare Secrets.");
  return url.replace(/\/$/, "");
}

function getSupabaseServiceKey(env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set in Cloudflare Secrets.");
  return key;
}

async function supabaseRequest(env, tableName, options = {}) {
  const baseUrl = getSupabaseBaseUrl(env);
  const serviceKey = getSupabaseServiceKey(env);

  const method = options.method || "GET";
  const query = options.query || {};
  const body = options.body;
  const prefer = options.prefer;

  const url = new URL(`${baseUrl}/rest/v1/${tableName}`);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    Accept: "application/json"
  };

  if (prefer) headers.Prefer = prefer;

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await response.text();
  let data = null;

  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!response.ok) {
    const message = data?.message || data?.hint || data?.details || text || `Supabase request failed. status=${response.status}`;
    throw new Error(message);
  }

  return data;
}

async function supabaseRpc(env, functionName, body = {}) {
  const baseUrl = getSupabaseBaseUrl(env);
  const serviceKey = getSupabaseServiceKey(env);
  const url = `${baseUrl}/rest/v1/rpc/${functionName}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body || {})
  });

  const text = await response.text();
  let data = null;

  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.hint ||
      data?.details ||
      (typeof data === "string" ? data : "") ||
      `Supabase RPC failed. status=${response.status}`;

    throw new Error(message);
  }

  return data;
}

async function selectRows(env, tableName, query = {}) {
  const data = await supabaseRequest(env, tableName, { method: "GET", query });
  return Array.isArray(data) ? data : [];
}

async function selectSingle(env, tableName, query = {}) {
  const rows = await selectRows(env, tableName, { ...query, limit: query.limit || 1 });
  return rows[0] || null;
}

async function insertRows(env, tableName, body) {
  return supabaseRequest(env, tableName, { method: "POST", body, prefer: "return=representation" });
}

async function updateRows(env, tableName, query, body) {
  return supabaseRequest(env, tableName, { method: "PATCH", query, body, prefer: "return=representation" });
}

async function upsertRows(env, tableName, body, onConflict) {
  const query = {};
  if (onConflict) query.on_conflict = onConflict;
  return supabaseRequest(env, tableName, {
    method: "POST",
    query,
    body,
    prefer: "resolution=merge-duplicates,return=representation"
  });
}

async function deleteRows(env, tableName, query) {
  return supabaseRequest(env, tableName, { method: "DELETE", query, prefer: "return=representation" });
}


// =========================================================
// Data helpers
// =========================================================

async function getClinicByCode(env, clinicCode) {
  const clinic = await selectSingle(env, TABLES.clinics, {
    select: "*",
    clinic_code: `eq.${clinicCode || DEFAULT_CLINIC_CODE}`,
    is_active: "eq.true"
  });

  if (!clinic) throw new Error(`Clinic not found. clinic_code=${clinicCode || DEFAULT_CLINIC_CODE}`);
  return clinic;
}

async function getClinicSettings(env, clinicId) {
  // STEP VET-36B:
  // vet_clinic_settings は clinic_code 管理に変更した。
  // 既存の appointment-options 等が clinic_id で呼んでも壊れないよう、
  // clinic_id → clinic_code に変換してから新しい医院設定を読む。
  const clinic = await selectSingle(env, TABLES.clinics, {
    select: "*",
    id: `eq.${clinicId}`
  });

  const clinicCode = clinic?.clinic_code || DEFAULT_CLINIC_CODE;
  const settings = await getClinicSettingsByCode(env, clinicCode, clinic || {});

  // 古い画面が期待するフィールドも互換で返す。
  return {
    ...settings,
    clinic_id: clinicId,
    appointment_max_months_ahead: 2,
    appointment_min_days_ahead: 0,
    appointment_slot_minutes: Number(settings.time_slot_minutes || 30),
    default_visit_duration_minutes: Number(settings.time_slot_minutes || 30),
    allow_same_day_appointment: true,
    use_regular_hours: true,
    use_special_days: true,
    checkin_enabled: settings.reception_status !== "reception_stopped",
    line_liff_enabled: true,
    public_note: settings.public_notice || "",
    internal_note: settings.owner_notice || ""
  };
}

async function getRegularHours(env, clinicId) {
  return selectRows(env, TABLES.regularHours, {
    select: "*",
    clinic_id: `eq.${clinicId}`,
    order: "day_of_week.asc"
  });
}

async function getSpecialDays(env, clinicId, fromDate, toDate) {
  const query = {
    select: "*",
    clinic_id: `eq.${clinicId}`,
    order: "special_date.asc"
  };

  if (fromDate) query.special_date = `gte.${fromDate}`;
  if (fromDate && toDate) query.and = `(special_date.lte.${toDate})`;
  else if (toDate) query.special_date = `lte.${toDate}`;

  return selectRows(env, TABLES.specialDays, query);
}

async function getSpecialDayByDate(env, clinicId, dateText) {
  if (!dateText) return null;
  return selectSingle(env, TABLES.specialDays, {
    select: "*",
    clinic_id: `eq.${clinicId}`,
    special_date: `eq.${dateText}`
  });
}

async function getRegularHourByDate(env, clinicId, dateText) {
  const day = getDayOfWeekFromDateText(dateText);
  return selectSingle(env, TABLES.regularHours, {
    select: "*",
    clinic_id: `eq.${clinicId}`,
    day_of_week: `eq.${day}`
  });
}

async function getCardByToken(env, clinicId, token) {
  if (!token) return null;
  return selectSingle(env, TABLES.petCardView, {
    select: "*",
    clinic_id: `eq.${clinicId}`,
    qr_token: `eq.${token}`
  });
}

async function getGuardianById(env, guardianId) {
  if (!guardianId) return null;
  return selectSingle(env, TABLES.guardians, { select: "*", id: `eq.${guardianId}` });
}

async function getPetById(env, petId) {
  if (!petId) return null;
  return selectSingle(env, TABLES.pets, { select: "*", id: `eq.${petId}` });
}

async function getCardByPetId(env, petId) {
  if (!petId) return null;
  return selectSingle(env, TABLES.petCards, { select: "*", pet_id: `eq.${petId}` });
}

function buildNextVisitText(row) {
  const date = row?.next_visit_date || "";
  const time = row?.next_visit_time || "";
  const memo = row?.next_visit_memo || "";
  const parts = [];
  if (date) parts.push(date);
  if (time) parts.push(String(time).slice(0, 5));
  if (memo) parts.push(memo);
  return parts.join(" ") || "未設定";
}

function replaceTemplateVariables(template, data) {
  const values = {
    clinic_name: data.clinic_name || "",
    guardian_name: data.guardian_name || "",
    pet_name: data.pet_name || "",
    card_no: data.card_no || "",
    next_visit: data.next_visit || "",
    followup_due_date: data.followup_due_date || "",
    today: todayJST()
  };

  let text = String(template || "");
  Object.entries(values).forEach(([key, value]) => {
    text = text.replaceAll(`{{${key}}}`, value || "");
  });

  return text;
}

function createDefaultLineMessage(clinic, petCard, type = "recheck") {
  const templates = {
    recheck:
      "こんにちは。{{clinic_name}}です。\n\n{{pet_name}}ちゃんのその後の様子はいかがでしょうか。\n気になる症状があれば、このLINEにご返信ください。\n\n次回のご来院目安：\n{{next_visit}}",
    prevention:
      "こんにちは。{{clinic_name}}です。\n\n{{pet_name}}ちゃんの予防・健康管理について確認の時期です。\nご都合のよい日時がありましたら、このLINEにご返信ください。",
    line_link:
      "LINE公式からペット診察券を表示できるようになります。\n受付でお渡しした連携URLを開いて登録してください。"
  };

  return replaceTemplateVariables(templates[type] || templates.recheck, {
    clinic_name: clinic.clinic_name,
    pet_name: petCard.pet_name,
    card_no: petCard.card_no,
    next_visit: buildNextVisitText(petCard)
  });
}



// =========================================================
// STEP VET-36B: Clinic settings helpers
// =========================================================

function normalizeClinicSettingStatus(value) {
  const v = cleanString(value || "open");
  const allowed = ["open", "closed_today", "morning_closed", "afternoon_closed", "reception_stopped"];
  if (!allowed.includes(v)) throw new Error("受付状態が不正です。");
  return v;
}

function normalizeQueueMode(value) {
  const v = cleanString(value || "walkin");
  const allowed = ["walkin", "reservation", "mixed"];
  if (!allowed.includes(v)) throw new Error("受付方式が不正です。");
  return v;
}

function normalizeTimeSlotMinutes(value) {
  const n = Number(value || 30);
  if (![15, 30].includes(n)) throw new Error("受付単位は15分または30分にしてください。");
  return n;
}

function normalizeClockTimeForSlot(value, slotMinutes = 30, fieldName = "時間") {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const time = normalizeTime(value);
  if (!time) throw new Error(`${fieldName}の形式が不正です。HH:MMで入力してください。`);

  const [, minuteText] = time.split(":");
  const minute = Number(minuteText);
  const slot = normalizeTimeSlotMinutes(slotMinutes);

  if (minute % slot !== 0) {
    throw new Error(`${fieldName}は${slot}分単位で入力してください。`);
  }

  return time;
}

function normalizeClinicDayType(value) {
  const v = cleanString(value);
  const allowed = ["special_closed", "morning_closed", "afternoon_closed", "special_open", "reception_stopped"];
  if (!allowed.includes(v)) throw new Error("臨時休業の種類が不正です。");
  return v;
}

function normalizeClosedType(value) {
  const v = cleanString(value || "full");
  const allowed = ["full", "morning", "afternoon"];
  if (!allowed.includes(v)) throw new Error("定休日の種類が不正です。");
  return v;
}

function normalizeWeekday(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 6) {
    throw new Error("曜日は0〜6で指定してください。0=日曜、1=月曜、...、6=土曜です。");
  }
  return n;
}

function ensureDateWithinClinicSettingRange(dateText) {
  const today = todayJST();
  const maxDate = addMonths(today, 2);
  parseDateText(dateText);

  if (compareDateText(dateText, today) < 0) {
    throw new Error("過去の日付は設定できません。");
  }

  if (compareDateText(dateText, maxDate) > 0) {
    throw new Error("臨時休業は今日から2か月先まで設定できます。");
  }

  return dateText;
}

function getClinicSettingDefaults(clinicCode, clinic = {}) {
  const code = clinicCode || DEFAULT_CLINIC_CODE;
  const demo = code === DEFAULT_CLINIC_CODE;
  return {
    clinic_code: code,
    clinic_name: clinic.clinic_name || clinic.name || "DPROどうぶつ病院",
    display_name: clinic.display_name || clinic.clinic_name || clinic.name || "DPROどうぶつ病院",
    postal_code: clinic.postal_code || "",
    address: clinic.address || (demo ? "福岡県福岡市博多区DPRO町1-2-3" : ""),
    phone: clinic.phone || (demo ? "092-555-0112" : ""),
    official_line_name: clinic.official_line_name || "DPROどうぶつ病院 公式LINE",
    timezone: "Asia/Tokyo",
    reception_status: "open",
    owner_notice: "デモ用の医院設定です。定休日・臨時休業・受付時間をここから管理します。",
    public_notice: "本日は通常受付中です。診察券QRまたはLINEから受付できます。",
    time_slot_minutes: 30,
    morning_open_time: "09:00",
    morning_close_time: "12:00",
    afternoon_open_time: demo ? "16:00" : "15:00",
    afternoon_close_time: demo ? "19:00" : "18:30",
    morning_last_accept_time: "11:30",
    afternoon_last_accept_time: demo ? "18:30" : "18:00",
    queue_mode: "walkin",
    max_morning_queue: 30,
    max_afternoon_queue: 30,
    status: demo ? "demo" : "active",
    feature_preset: "standard",
    feature_flags: normalizeFeatureFlags({}),
    questionnaire_modules: normalizeQuestionnaireModules({}),
    public_channel_settings: normalizePublicChannelSettings({})
  };
}

async function getClinicSettingsByCode(env, clinicCode, clinic = {}) {
  const code = clinicCode || DEFAULT_CLINIC_CODE;
  let settings = await selectSingle(env, TABLES.clinicSettings, {
    select: "*",
    clinic_code: `eq.${code}`
  });

  if (!settings) {
    const inserted = await upsertRows(env, getTableName("clinicSettings"), getClinicSettingDefaults(code, clinic), "clinic_code");
    settings = Array.isArray(inserted) ? inserted[0] : inserted;
  }

  return {
    ...getClinicSettingDefaults(code, clinic),
    ...(settings || {})
  };
}

function getTableName(key) {
  return TABLES[key];
}

async function getClinicRegularHolidaysByCode(env, clinicCode) {
  return selectRows(env, TABLES.clinicRegularHolidays, {
    select: "*",
    clinic_code: `eq.${clinicCode}`,
    order: "weekday.asc,closed_type.asc"
  });
}

async function getClinicSpecialDaysByCode(env, clinicCode, fromDate, toDate) {
  const query = {
    select: "*",
    clinic_code: `eq.${clinicCode}`,
    order: "target_date.asc,day_type.asc"
  };

  if (fromDate && toDate) query.and = `(target_date.gte.${fromDate},target_date.lte.${toDate})`;
  else if (fromDate) query.target_date = `gte.${fromDate}`;
  else if (toDate) query.target_date = `lte.${toDate}`;

  return selectRows(env, TABLES.clinicSpecialDays, query);
}

async function getClinicCalendarByCode(env, clinicCode, fromDate, toDate) {
  const query = {
    select: "*",
    clinic_code: `eq.${clinicCode}`,
    order: "target_date.asc"
  };

  if (fromDate && toDate) query.and = `(target_date.gte.${fromDate},target_date.lte.${toDate})`;
  else if (fromDate) query.target_date = `gte.${fromDate}`;
  else if (toDate) query.target_date = `lte.${toDate}`;

  const rows = await selectRows(env, TABLES.clinicCalendar2Months, query);
  return rows.map(addClinicCalendarFlags);
}

function addClinicCalendarFlags(row) {
  const isFullClosed = row.is_full_closed === true;
  const isMorningClosed = row.is_morning_closed === true;
  const isAfternoonClosed = row.is_afternoon_closed === true;

  return {
    ...row,
    can_accept_morning: !isFullClosed && !isMorningClosed,
    can_accept_afternoon: !isFullClosed && !isAfternoonClosed,
    can_accept_today: !isFullClosed && (!isMorningClosed || !isAfternoonClosed),
    display_message: buildClinicCalendarMessage(row)
  };
}

function buildClinicCalendarMessage(row) {
  if (!row) return "";
  const label = row.reception_label || "通常受付";
  const title = row.special_title ? `（${row.special_title}）` : "";
  if (label === "休診") return `本日は休診です${title}`;
  if (label === "午前休診") return `本日は午前休診です。午後受付は可能です${title}`;
  if (label === "午後休診") return `本日は午後休診です。午前受付は可能です${title}`;
  return `本日は通常受付中です。午前 ${String(row.morning_open_time || "").slice(0,5)}〜${String(row.morning_last_accept_time || "").slice(0,5)} / 午後 ${String(row.afternoon_open_time || "").slice(0,5)}〜${String(row.afternoon_last_accept_time || "").slice(0,5)}`;
}

async function buildClinicSettingsPayload(env, clinicCode, options = {}) {
  const clinic = await getClinicByCode(env, clinicCode);
  const from = options.from || todayJST();
  const to = options.to || addMonths(from, 2);

  const [settings, regular_holidays, special_days, calendar] = await Promise.all([
    getClinicSettingsByCode(env, clinicCode, clinic),
    getClinicRegularHolidaysByCode(env, clinicCode),
    getClinicSpecialDaysByCode(env, clinicCode, from, to),
    getClinicCalendarByCode(env, clinicCode, from, to)
  ]);

  const today = todayJST();
  const today_status = calendar.find((row) => row.target_date === today) || null;

  return {
    ok: true,
    worker_version: WORKER_VERSION,
    clinic,
    settings,
    regular_holidays,
    special_days,
    calendar,
    today_status,
    appointment_rules: {
      min_date: today,
      max_date: addMonths(today, 2),
      slot_minutes: Number(settings.time_slot_minutes || 30),
      time_slot_minutes: Number(settings.time_slot_minutes || 30),
      can_set_special_days_until: addMonths(today, 2),
      past_date_allowed: false
    }
  };
}

function buildClinicSettingsUpdateBody(body, currentSettings = {}) {
  const nextSlot = body.time_slot_minutes !== undefined
    ? normalizeTimeSlotMinutes(body.time_slot_minutes)
    : normalizeTimeSlotMinutes(currentSettings.time_slot_minutes || 30);

  const update = {};

  const textFields = [
    "clinic_name",
    "display_name",
    "postal_code",
    "address",
    "phone",
    "official_line_name",
    "owner_notice",
    "public_notice"
  ];

  textFields.forEach((key) => {
    if (body[key] !== undefined) update[key] = cleanString(body[key]);
  });

  if (body.timezone !== undefined) update.timezone = cleanString(body.timezone) || "Asia/Tokyo";
  if (body.reception_status !== undefined) update.reception_status = normalizeClinicSettingStatus(body.reception_status);
  if (body.time_slot_minutes !== undefined) update.time_slot_minutes = nextSlot;
  if (body.queue_mode !== undefined) update.queue_mode = normalizeQueueMode(body.queue_mode);

  const timeFields = [
    ["morning_open_time", "午前開始"],
    ["morning_close_time", "午前終了"],
    ["afternoon_open_time", "午後開始"],
    ["afternoon_close_time", "午後終了"],
    ["morning_last_accept_time", "午前受付締切"],
    ["afternoon_last_accept_time", "午後受付締切"]
  ];

  timeFields.forEach(([key, label]) => {
    if (body[key] !== undefined) update[key] = normalizeClockTimeForSlot(body[key], nextSlot, label);
  });

  if (body.max_morning_queue !== undefined) update.max_morning_queue = Math.max(0, Number(body.max_morning_queue || 0));
  if (body.max_afternoon_queue !== undefined) update.max_afternoon_queue = Math.max(0, Number(body.max_afternoon_queue || 0));
  if (body.feature_preset !== undefined) update.feature_preset = normalizeFeaturePreset(body.feature_preset);
  if (body.feature_flags !== undefined) {
    update.feature_flags = normalizeFeatureFlags({
      ...normalizeFeatureFlags(currentSettings.feature_flags),
      ...normalizeJsonObject(body.feature_flags)
    });
  }
  if (body.questionnaire_modules !== undefined) {
    update.questionnaire_modules = normalizeQuestionnaireModules({
      ...normalizeQuestionnaireModules(currentSettings.questionnaire_modules),
      ...normalizeJsonObject(body.questionnaire_modules)
    });
  }
  if (body.public_channel_settings !== undefined) {
    const currentChannels = normalizePublicChannelSettings(currentSettings.public_channel_settings);
    const incomingChannels = normalizeJsonObject(body.public_channel_settings);
    update.public_channel_settings = normalizePublicChannelSettings({
      ...currentChannels,
      ...incomingChannels,
      hp: { ...currentChannels.hp, ...normalizeJsonObject(incomingChannels.hp) },
      line: { ...currentChannels.line, ...normalizeJsonObject(incomingChannels.line) },
      welcome: { ...currentChannels.welcome, ...normalizeJsonObject(incomingChannels.welcome) },
      notice: { ...currentChannels.notice, ...normalizeJsonObject(incomingChannels.notice) }
    });
  }
  if (body.status !== undefined) {
    const status = cleanString(body.status || "demo");
    if (!["demo", "active", "paused", "archived"].includes(status)) throw new Error("医院ステータスが不正です。");
    update.status = status;
  }

  // 時間の前後関係チェック
  const merged = { ...currentSettings, ...update };
  const mOpen = timeToMinutes(merged.morning_open_time);
  const mClose = timeToMinutes(merged.morning_close_time);
  const aOpen = timeToMinutes(merged.afternoon_open_time);
  const aClose = timeToMinutes(merged.afternoon_close_time);
  const mLast = timeToMinutes(merged.morning_last_accept_time);
  const aLast = timeToMinutes(merged.afternoon_last_accept_time);

  if (mOpen !== null && mClose !== null && mOpen >= mClose) throw new Error("午前の開始時間は終了時間より前にしてください。");
  if (aOpen !== null && aClose !== null && aOpen >= aClose) throw new Error("午後の開始時間は終了時間より前にしてください。");
  if (mLast !== null && mOpen !== null && mClose !== null && (mLast < mOpen || mLast > mClose)) throw new Error("午前受付締切は午前診療時間内にしてください。");
  if (aLast !== null && aOpen !== null && aClose !== null && (aLast < aOpen || aLast > aClose)) throw new Error("午後受付締切は午後診療時間内にしてください。");

  return update;
}

function normalizeRegularHolidayRow(row, clinicCode) {
  return {
    clinic_code: clinicCode,
    weekday: normalizeWeekday(row.weekday),
    closed_type: normalizeClosedType(row.closed_type),
    is_active: row.is_active === undefined ? true : toBool(row.is_active, true),
    note: cleanString(row.note || "")
  };
}

function normalizeSpecialDayRow(row, clinicCode, settings = {}) {
  const slot = normalizeTimeSlotMinutes(settings.time_slot_minutes || 30);
  const targetDate = ensureDateWithinClinicSettingRange(cleanString(row.target_date || row.date || row.special_date));

  const data = {
    clinic_code: clinicCode,
    target_date: targetDate,
    day_type: normalizeClinicDayType(row.day_type || row.type),
    title: cleanString(row.title || ""),
    note: cleanString(row.note || ""),
    is_active: row.is_active === undefined ? true : toBool(row.is_active, true)
  };

  const timeFields = [
    ["morning_open_time", "午前開始"],
    ["morning_close_time", "午前終了"],
    ["afternoon_open_time", "午後開始"],
    ["afternoon_close_time", "午後終了"],
    ["morning_last_accept_time", "午前受付締切"],
    ["afternoon_last_accept_time", "午後受付締切"]
  ];

  timeFields.forEach(([key, label]) => {
    if (row[key] !== undefined) data[key] = normalizeClockTimeForSlot(row[key], slot, label);
  });

  return data;
}


// =========================================================
// Public handlers
// =========================================================

async function handlePublicClinic(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const clinic = await getClinicByCode(env, clinicCode);
  return jsonResponse({ok:true,clinic:normalizeClinicForPublic(clinic)});
}

async function handlePublicClinicSettings(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const from = getParam(request, "from", todayJST());
  const to = getParam(request, "to", addMonths(from, 2));
  const payload = await buildClinicSettingsPayload(env,clinicCode,{from,to});
  return jsonResponse({
    ...payload,
    clinic: normalizeClinicForPublic(payload.clinic),
    settings: normalizeClinicSettingsForPublic(payload.settings)
  });
}

async function handlePublicClinicCalendar(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const from = getParam(request, "from", todayJST());
  const to = getParam(request, "to", addMonths(from, 2));
  const clinic = await getClinicByCode(env, clinicCode);
  const settings = await getClinicSettingsByCode(env, clinicCode, clinic);
  const calendar = await getClinicCalendarByCode(env, clinicCode, from, to);

  return jsonResponse({
    ok: true,
    worker_version: WORKER_VERSION,
    clinic: normalizeClinicForPublic(clinic),
    settings: normalizeClinicSettingsForPublic(settings),
    from,
    to,
    calendar,
    appointment_rules: {
      min_date: todayJST(),
      max_date: addMonths(todayJST(), 2),
      slot_minutes: Number(settings.time_slot_minutes || 30),
      past_date_allowed: false
    }
  });
}

async function handlePublicClinicTodayStatus(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const date = getParam(request, "date", todayJST());
  const clinic = await getClinicByCode(env, clinicCode);
  const settings = await getClinicSettingsByCode(env, clinicCode, clinic);
  const rows = await getClinicCalendarByCode(env, clinicCode, date, date);
  const today_status = rows[0] || null;

  return jsonResponse({
    ok: true,
    worker_version: WORKER_VERSION,
    clinic: normalizeClinicForPublic(clinic),
    settings: normalizeClinicSettingsForPublic(settings),
    target_date: date,
    today_status
  });
}

function publicQueueSettings(settings = {}) {
  return {
    same_day_queue_enabled: settings.same_day_queue_enabled !== false,
    same_day_morning_start: settings.same_day_morning_start || "",
    same_day_morning_end: settings.same_day_morning_end || "",
    same_day_afternoon_start: settings.same_day_afternoon_start || "",
    same_day_afternoon_end: settings.same_day_afternoon_end || "",
    same_day_morning_capacity: Number(settings.same_day_morning_capacity || 0),
    same_day_afternoon_capacity: Number(settings.same_day_afternoon_capacity || 0),
    priority_reservation_enabled: settings.priority_reservation_enabled === true,
    medicine_prevention_enabled: settings.medicine_prevention_enabled === true,
    congestion_public_enabled: settings.congestion_public_enabled !== false,
    public_note: settings.public_note || ""
  };
}

function queuePartClosed(summary) {
  if (!summary) return false;
  const level = cleanString(summary.manual_level || summary.display_level || "").toLowerCase();
  return summary.reception_closed === true || ["reception_closed", "closed", "emergency"].includes(level);
}

function integratedTodayState(settings, todayStatus, queueSummaries, queueSettings) {
  const flags = normalizeFeatureFlags(settings.feature_flags);
  const receptionStatus = cleanString(settings.reception_status || "open");
  let canMorning = todayStatus ? todayStatus.can_accept_morning !== false : true;
  let canAfternoon = todayStatus ? todayStatus.can_accept_afternoon !== false : true;

  if (receptionStatus === "closed_today") {
    canMorning = false;
    canAfternoon = false;
  } else if (receptionStatus === "morning_closed") {
    canMorning = false;
  } else if (receptionStatus === "afternoon_closed") {
    canAfternoon = false;
  }

  const morningSummary = queueSummaries.find((row) => cleanString(row.day_part) === "morning") || null;
  const afternoonSummary = queueSummaries.find((row) => cleanString(row.day_part) === "afternoon") || null;
  if (queuePartClosed(morningSummary)) canMorning = false;
  if (queuePartClosed(afternoonSummary)) canAfternoon = false;

  const queueFeatureEnabled = flags.reception_queue === true && flags.reception_general === true && queueSettings.same_day_queue_enabled !== false;
  // INTEGRATED-5-R2:
  // reception_stopped is an operational reception state, NOT a clinic closure.
  // It may come from the clinic setting (legacy/global) or today's special-day view flag.
  const receptionStopped =
    receptionStatus === "reception_stopped" ||
    todayStatus?.is_reception_stopped === true;
  const canAcceptQueue = queueFeatureEnabled && !receptionStopped && (canMorning || canAfternoon);

  let code = "open";
  if (!queueFeatureEnabled) code = "feature_off";
  else if (receptionStopped) code = "reception_stopped";
  else if (receptionStatus === "closed_today" || (canMorning === false && canAfternoon === false)) code = "closed_today";
  else if (!canMorning && canAfternoon) code = "morning_closed";
  else if (canMorning && !canAfternoon) code = "afternoon_closed";
  else if (queueSummaries.some((row) => cleanString(row.display_level || row.manual_level).toLowerCase() === "crowded")) code = "crowded";

  const labels = {
    open: "受付中",
    crowded: "混雑中",
    feature_off: "順番受付OFF",
    closed_today: "本日休診",
    morning_closed: "午前休診",
    afternoon_closed: "午後休診",
    reception_stopped: "受付停止"
  };
  const summaryMessage = queueSummaries.find((row) => cleanString(row.manual_message || row.closed_reason || row.display_message)) || null;
  const message = receptionStopped
    ? cleanString(settings.public_notice || "本日の受付は停止しています。診療時間・日時指定予約については病院へご確認ください。")
    : cleanString(
        summaryMessage?.manual_message || summaryMessage?.closed_reason ||
        todayStatus?.display_message || settings.public_notice || summaryMessage?.display_message || ""
      );

  return {
    code,
    label: labels[code] || labels.open,
    message,
    reception_status: receptionStatus,
    can_accept_morning: canMorning,
    can_accept_afternoon: canAfternoon,
    can_accept_queue: canAcceptQueue,
    queue_feature_enabled: queueFeatureEnabled,
    exact_appointment_feature_enabled: flags.exact_appointment === true,
    questionnaire_feature_enabled: flags.previsit_questionnaire === true
  };
}

async function handlePublicIntegratedState(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const date = getParam(request, "date", todayJST());
  parseDateText(date);
  const clinic = await getClinicByCode(env, clinicCode);
  const [settings, calendarRows, queueSettingsRaw, queueSummaries] = await Promise.all([
    getClinicSettingsByCode(env, clinicCode, clinic),
    getClinicCalendarByCode(env, clinicCode, date, date),
    getQueueSettings(env, clinic.id),
    getQueueSummaryRows(env, clinic.id, date, "all")
  ]);
  const publicSettings = normalizeClinicSettingsForPublic(settings);
  const todayStatus = calendarRows[0] || null;
  const queueSettings = publicQueueSettings(queueSettingsRaw || {});
  const state = integratedTodayState(settings, todayStatus, queueSummaries || [], queueSettings);
  const publicChannels = normalizePublicChannelSettings(settings.public_channel_settings);

  return jsonResponse({
    ok: true,
    integrated_api_version: INTEGRATED_API_VERSION,
    worker_version: WORKER_VERSION,
    clinic: normalizeIntegratedClinicForPublic(clinic, settings),
    settings: publicSettings,
    public_channel_settings: publicChannels,
    feature_flags: publicSettings.feature_flags,
    target_date: date,
    today_status: todayStatus,
    reception_state: state,
    queue: {
      settings: queueSettings,
      summaries: queueSummaries || []
    },
    notice: {
      text: settings.public_notice || "",
      channel: publicChannels.notice
    },
    source_contract: {
      member: ["line", "web"],
      staff: ["line", "web", "phone", "counter", "staff", "import"]
    },
    endpoints: {
      clinic_settings: "/api/public/clinic-settings",
      today_status: "/api/public/clinic-today-status",
      queue_summary: "/api/public/queue/summary",
      exact_appointment_availability: "/api/public/exact-appointments/availability"
    }
  });
}

async function handleAdminClinicSettingsGet(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const from = getParam(request, "from", todayJST());
  const to = getParam(request, "to", addMonths(from, 2));
  return jsonResponse(await buildClinicSettingsPayload(env, clinicCode, { from, to }));
}

async function handleAdminClinicSettingsUpdate(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const current = await getClinicSettingsByCode(env, clinicCode, clinic);
  const update = buildClinicSettingsUpdateBody(body, current);

  const saved = await upsertRows(env, TABLES.clinicSettings, {
    clinic_code: clinicCode,
    ...update
  }, "clinic_code");

  await logOperation(env, clinic.id, "staff", cleanString(body.staff_name) || "管理画面", "clinic_settings_update", "clinic", clinic.id, {
    clinic_code: clinicCode,
    updated_keys: Object.keys(update)
  });

  const payload = await buildClinicSettingsPayload(env, clinicCode, {
    from: todayJST(),
    to: addMonths(todayJST(), 2)
  });

  return jsonResponse({
    ok: true,
    worker_version: WORKER_VERSION,
    message: "医院設定を保存しました。",
    saved: Array.isArray(saved) ? saved[0] : saved,
    ...payload
  });
}

async function handleAdminClinicRegularHolidaysSave(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);

  const list = Array.isArray(body.regular_holidays)
    ? body.regular_holidays
    : Array.isArray(body.holidays)
      ? body.holidays
      : [body];

  const rows = list.map((row) => normalizeRegularHolidayRow(row, clinicCode));
  if (!rows.length) throw new Error("定休日データがありません。");

  const saved = await upsertRows(env, TABLES.clinicRegularHolidays, rows, "clinic_code,weekday,closed_type");

  await logOperation(env, clinic.id, "staff", cleanString(body.staff_name) || "管理画面", "clinic_regular_holidays_save", "clinic", clinic.id, {
    clinic_code: clinicCode,
    count: rows.length
  });

  return jsonResponse({
    ok: true,
    worker_version: WORKER_VERSION,
    message: "定休日を保存しました。",
    saved,
    regular_holidays: await getClinicRegularHolidaysByCode(env, clinicCode),
    calendar: await getClinicCalendarByCode(env, clinicCode, todayJST(), addMonths(todayJST(), 2))
  });
}

async function handleAdminClinicSpecialDaysSave(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const settings = await getClinicSettingsByCode(env, clinicCode, clinic);

  const list = Array.isArray(body.special_days)
    ? body.special_days
    : Array.isArray(body.days)
      ? body.days
      : [body];

  const rows = list.map((row) => normalizeSpecialDayRow(row, clinicCode, settings));
  if (!rows.length) throw new Error("臨時休業データがありません。");

  const saved = await upsertRows(env, TABLES.clinicSpecialDays, rows, "clinic_code,target_date,day_type");

  await logOperation(env, clinic.id, "staff", cleanString(body.staff_name) || "管理画面", "clinic_special_days_save", "clinic", clinic.id, {
    clinic_code: clinicCode,
    count: rows.length,
    target_dates: rows.map((row) => row.target_date)
  });

  return jsonResponse({
    ok: true,
    worker_version: WORKER_VERSION,
    message: "臨時休業・特別診療日を保存しました。",
    saved,
    special_days: await getClinicSpecialDaysByCode(env, clinicCode, todayJST(), addMonths(todayJST(), 2)),
    calendar: await getClinicCalendarByCode(env, clinicCode, todayJST(), addMonths(todayJST(), 2))
  });
}

async function handleAdminClinicSpecialDayDelete(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const targetDate = ensureDateWithinClinicSettingRange(cleanString(body.target_date || body.date || body.special_date));
  const dayType = normalizeClinicDayType(body.day_type || body.type);

  const deleted = await deleteRows(env, TABLES.clinicSpecialDays, {
    clinic_code: `eq.${clinicCode}`,
    target_date: `eq.${targetDate}`,
    day_type: `eq.${dayType}`
  });

  await logOperation(env, clinic.id, "staff", cleanString(body.staff_name) || "管理画面", "clinic_special_day_delete", "clinic", clinic.id, {
    clinic_code: clinicCode,
    target_date: targetDate,
    day_type: dayType
  });

  return jsonResponse({
    ok: true,
    worker_version: WORKER_VERSION,
    message: "臨時休業・特別診療日を削除しました。",
    deleted,
    special_days: await getClinicSpecialDaysByCode(env, clinicCode, todayJST(), addMonths(todayJST(), 2)),
    calendar: await getClinicCalendarByCode(env, clinicCode, todayJST(), addMonths(todayJST(), 2))
  });
}

function calculateMinAppointmentDate(settings) {
  const today = todayJST();
  let minDays = Number(settings.appointment_min_days_ahead || 0);
  if (settings.allow_same_day_appointment === false) minDays = Math.max(minDays, 1);
  return addDays(today, minDays);
}

function calculateMaxAppointmentDate(settings) {
  return addMonths(todayJST(), Number(settings.appointment_max_months_ahead || 3));
}

async function getAppointmentOptionsForDate(env, clinic, dateText) {
  if (!dateText) {
    return { ok: false, date: "", is_available: false, reason: "日付が指定されていません。", slots: [] };
  }

  const settings = await getClinicSettings(env, clinic.id);
  const minDate = calculateMinAppointmentDate(settings);
  const maxDate = calculateMaxAppointmentDate(settings);

  if (compareDateText(dateText, minDate) < 0) {
    return {
      ok: true,
      date: dateText,
      is_available: false,
      reason: "過去日、または予約可能開始日より前の日付です。",
      min_date: minDate,
      max_date: maxDate,
      slots: []
    };
  }

  if (compareDateText(dateText, maxDate) > 0) {
    return {
      ok: true,
      date: dateText,
      is_available: false,
      reason: `予約可能期間は${settings.appointment_max_months_ahead || 3}か月先までです。`,
      min_date: minDate,
      max_date: maxDate,
      slots: []
    };
  }

  const slotMinutes = Number(settings.appointment_slot_minutes || 15);
  const durationMinutes = Number(settings.default_visit_duration_minutes || 30);

  let source = "regular";
  let note = "";
  let ranges = [];

  const specialDay = settings.use_special_days !== false
    ? await getSpecialDayByDate(env, clinic.id, dateText)
    : null;

  if (specialDay && specialDay.day_type !== "memo") {
    source = "special_day";
    note = specialDay.note || specialDay.title || "";

    if (specialDay.is_closed === true || specialDay.day_type === "closed") {
      return {
        ok: true,
        date: dateText,
        is_available: false,
        reason: specialDay.title || "臨時休診日です。",
        min_date: minDate,
        max_date: maxDate,
        source,
        day_of_week: getDayOfWeekFromDateText(dateText),
        day_label: getDayLabel(getDayOfWeekFromDateText(dateText)),
        special_day: specialDay,
        slots: []
      };
    }

    ranges = buildRangesFromHourRow(specialDay);
  } else if (settings.use_regular_hours !== false) {
    const regular = await getRegularHourByDate(env, clinic.id, dateText);
    source = "regular";
    note = regular?.note || "";

    if (!regular || regular.is_closed === true) {
      const dow = getDayOfWeekFromDateText(dateText);
      return {
        ok: true,
        date: dateText,
        is_available: false,
        reason: regular?.display_label || `${getDayLabel(dow)}は休診日です。`,
        min_date: minDate,
        max_date: maxDate,
        source,
        day_of_week: dow,
        day_label: getDayLabel(dow),
        regular_hour: regular,
        special_day: specialDay,
        slots: []
      };
    }

    ranges = buildRangesFromHourRow(regular);
  }

  const slots = buildSlotsFromRanges(ranges, slotMinutes, durationMinutes);
  const dow = getDayOfWeekFromDateText(dateText);

  if (!slots.length) {
    return {
      ok: true,
      date: dateText,
      is_available: false,
      reason: "この日は受付可能な時間がありません。",
      min_date: minDate,
      max_date: maxDate,
      source,
      note,
      ranges,
      day_of_week: dow,
      day_label: getDayLabel(dow),
      special_day: specialDay,
      slots: []
    };
  }

  return {
    ok: true,
    date: dateText,
    is_available: true,
    reason: "",
    min_date: minDate,
    max_date: maxDate,
    source,
    note,
    ranges,
    day_of_week: dow,
    day_label: getDayLabel(dow),
    slot_minutes: slotMinutes,
    duration_minutes: durationMinutes,
    special_day: specialDay,
    slots
  };
}

async function handleAppointmentOptions(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const dateText = getParam(request, "date", todayJST());
  const clinic = await getClinicByCode(env, clinicCode);
  const options = await getAppointmentOptionsForDate(env, clinic, dateText);
  return jsonResponse({ ok: true, clinic, ...options });
}


// =========================================================
// STEP VET-PHOTO-1B: Pet photo icon helpers
// =========================================================

function getPetPhotoBucketName() {
  return PET_PHOTO_BUCKET;
}

function getPetPhotoPublicUrl(env, storagePath) {
  const path = cleanString(storagePath);
  if (!path) return null;
  const baseUrl = getSupabaseBaseUrl(env);
  return `${baseUrl}/storage/v1/object/public/${getPetPhotoBucketName()}/${encodeStoragePath(path)}`;
}

function encodeStoragePath(path) {
  return String(path || "")
    .split("/")
    .filter((part) => part !== "")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function sanitizeStoragePathSegment(value, fallback = "item") {
  const text = cleanString(value || fallback)
    .replace(/[\\/]+/g, "-")
    .replace(/[^a-zA-Z0-9_.-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return text || fallback;
}

function extensionFromMimeType(mimeType) {
  const mime = cleanString(mimeType).toLowerCase();
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

function decodeBase64ToUint8Array(base64Text) {
  const normalized = String(base64Text || "")
    .replace(/\s+/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  let binary = "";
  try {
    binary = atob(normalized);
  } catch {
    throw new Error("写真データの形式が不正です。もう一度画像を選択してください。");
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function parsePetPhotoPayload(body = {}) {
  const rawPhoto = cleanString(
    body.photo_base64 ||
    body.image_base64 ||
    body.file_base64 ||
    body.photo_data_url ||
    body.data_url ||
    body.photo ||
    body.image ||
    ""
  );

  if (!rawPhoto) {
    throw new Error("写真データがありません。画像を選択してから登録してください。");
  }

  let mimeType = cleanString(body.mime_type || body.content_type || body.file_type || "").toLowerCase();
  let base64Text = rawPhoto;

  const dataUrlMatch = rawPhoto.match(/^data:([^;]+);base64,(.+)$/i);
  if (dataUrlMatch) {
    mimeType = cleanString(dataUrlMatch[1]).toLowerCase();
    base64Text = dataUrlMatch[2];
  }

  if (!mimeType) mimeType = "image/jpeg";

  if (!PET_PHOTO_ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error("登録できる写真形式は JPEG / PNG / WebP のみです。");
  }

  const bytes = decodeBase64ToUint8Array(base64Text);

  if (!bytes.length) {
    throw new Error("写真データが空です。もう一度画像を選択してください。");
  }

  if (bytes.length > PET_PHOTO_MAX_BYTES) {
    throw new Error("写真サイズが大きすぎます。500KB以下の画像を選択してください。");
  }

  const originalName = sanitizeStoragePathSegment(body.file_name || body.filename || "pet-photo");
  const ext = extensionFromMimeType(mimeType);
  const safeFileName = originalName.includes(".") ? originalName : `${originalName}.${ext}`;

  return { mimeType, bytes, size: bytes.length, safeFileName };
}

async function supabaseStorageUpload(env, bucketName, storagePath, bytes, mimeType) {
  const baseUrl = getSupabaseBaseUrl(env);
  const serviceKey = getSupabaseServiceKey(env);
  const url = `${baseUrl}/storage/v1/object/${bucketName}/${encodeStoragePath(storagePath)}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": mimeType,
      "Cache-Control": "3600",
      "x-upsert": "true"
    },
    body: bytes
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!response.ok) {
    const message = data?.message || data?.error || text || `Storage upload failed. status=${response.status}`;
    throw new Error(message);
  }

  return data;
}

async function supabaseStorageDeleteObject(env, bucketName, storagePath) {
  const path = cleanString(storagePath);
  if (!path) return { ok: true, skipped: true };

  const baseUrl = getSupabaseBaseUrl(env);
  const serviceKey = getSupabaseServiceKey(env);
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    Accept: "application/json"
  };

  const attempts = [
    {
      method: "DELETE",
      url: `${baseUrl}/storage/v1/object/${bucketName}/${encodeStoragePath(path)}`,
      body: undefined
    },
    {
      method: "DELETE",
      url: `${baseUrl}/storage/v1/object/${bucketName}`,
      body: JSON.stringify({ prefixes: [path] })
    },
    {
      method: "POST",
      url: `${baseUrl}/storage/v1/object/${bucketName}/remove`,
      body: JSON.stringify({ prefixes: [path] })
    }
  ];

  let lastError = "";
  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url, {
        method: attempt.method,
        headers,
        body: attempt.body
      });
      const text = await response.text();
      if (response.ok) return { ok: true, status: response.status, response: text || null };
      lastError = text || `status=${response.status}`;
    } catch (error) {
      lastError = error?.message || String(error);
    }
  }

  return { ok: false, error: lastError || "Storage delete failed." };
}

// =========================================================
// ANIMARY-COUNTER-V1.1-4/5: WEB問診 症状画像 + 院内確認 helpers
// =========================================================
function parseQuestionnaireImagePayload(input = {}, index = 0) {
  const raw = cleanString(
    input.data_url || input.image_data_url || input.base64 || input.image_base64 || input.file_base64 || ""
  );
  if (!raw) throw new Error(`症状画像${index + 1}のデータがありません。`);

  let mimeType = cleanString(input.mime_type || input.content_type || input.file_type || "").toLowerCase();
  let base64Text = raw;
  const match = raw.match(/^data:([^;]+);base64,(.+)$/i);
  if (match) {
    mimeType = cleanString(match[1]).toLowerCase();
    base64Text = match[2];
  }
  if (!mimeType) mimeType = "image/jpeg";
  if (!QUESTIONNAIRE_IMAGE_ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`症状画像${index + 1}は JPEG / PNG / WebP のみ登録できます。`);
  }
  const bytes = decodeBase64ToUint8Array(base64Text);
  if (!bytes.length) throw new Error(`症状画像${index + 1}が空です。`);
  if (bytes.length > QUESTIONNAIRE_IMAGE_MAX_BYTES) {
    throw new Error(`症状画像${index + 1}が大きすぎます。1枚800KB以下にしてください。`);
  }
  const ext = extensionFromMimeType(mimeType);
  const originalName = sanitizeStoragePathSegment(input.file_name || input.filename || `symptom-${index + 1}`);
  const safeFileName = originalName.includes(".") ? originalName : `${originalName}.${ext}`;
  return { mimeType, bytes, size: bytes.length, safeFileName, ext };
}

async function createPrivateStorageSignedUploadUrl(env, bucketName, storagePath) {
  const path = cleanString(storagePath);
  if (!path) throw new Error("症状画像の保存先を作成できませんでした。");
  const baseUrl = getSupabaseBaseUrl(env);
  const serviceKey = getSupabaseServiceKey(env);
  const url = `${baseUrl}/storage/v1/object/upload/sign/${bucketName}/${encodeStoragePath(path)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-upsert": "false"
    },
    body: "{}"
  });
  const text = await response.text();
  let data = {};
  if (text) { try { data = JSON.parse(text); } catch { data = {}; } }
  if (!response.ok) throw new Error(data?.message || data?.error || text || "症状画像アップロードURLを作成できませんでした。");
  const returned = cleanString(data?.url || data?.signedURL || data?.signedUrl || "");
  if (!returned) throw new Error("症状画像アップロードURLの応答が不正です。");
  const uploadUrl = /^https?:\/\//i.test(returned)
    ? returned
    : `${baseUrl}/storage/v1${returned.startsWith("/") ? returned : `/${returned}`}`;
  let token = cleanString(data?.token || "");
  if (!token) { try { token = new URL(uploadUrl).searchParams.get("token") || ""; } catch {} }
  return { upload_url: uploadUrl, token, storage_path: path, expires_in: 7200 };
}

function normalizeDirectQuestionnaireImageMeta(input = {}, clinicCode = "", petId = "", index = 0) {
  const storagePath = cleanString(input.storage_path || input.path || "");
  if (!storagePath) return null;
  const clinicSegment = sanitizeStoragePathSegment(clinicCode, DEFAULT_CLINIC_CODE);
  const petSegment = sanitizeStoragePathSegment(petId, "pet");
  const expectedPrefix = `${clinicSegment}/${petSegment}/`;
  if (!storagePath.startsWith(expectedPrefix) || storagePath.includes("..")) {
    throw new Error(`症状画像${index + 1}の保存先を確認できませんでした。`);
  }
  const mimeType = cleanString(input.mime_type || input.content_type || "").toLowerCase();
  if (!QUESTIONNAIRE_IMAGE_ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`症状画像${index + 1}は JPEG / PNG / WebP のみ登録できます。`);
  }
  const size = Math.max(0, Number(input.size || 0));
  if (!size || size > QUESTIONNAIRE_IMAGE_MAX_BYTES) {
    throw new Error(`症状画像${index + 1}のサイズを確認できませんでした。`);
  }
  const fileName = sanitizeStoragePathSegment(input.file_name || input.filename || `symptom-${index + 1}.${extensionFromMimeType(mimeType)}`);
  return { storage_path: storagePath, file_name: fileName, mime_type: mimeType, size, private: true, upload_mode: "signed_direct" };
}

async function handleQuestionnaireImageUploadUrl(request, env) {
  try {
    const body = await readJson(request);
    const clinicCode = getRequestedClinicCode(request, body);
    const featureState = await getClinicFeatureState(env, clinicCode);
    const demoMarker = cleanString(body.demo || getParam(request, "demo", "")).toLowerCase();
    const demoOverrideAllowed = isDemoClinicCodeForAudit(env, clinicCode) && ["ready", "true", "1"].includes(demoMarker);
    let effectiveFeatureFlags = featureState.feature_flags;
    if (demoOverrideAllowed && body.demo_feature_flags && typeof body.demo_feature_flags === "object" && !Array.isArray(body.demo_feature_flags)) {
      effectiveFeatureFlags = normalizeFeatureFlags({ ...featureState.feature_flags, ...body.demo_feature_flags });
    }
    if (effectiveFeatureFlags.previsit_questionnaire !== true || effectiveFeatureFlags.questionnaire_images !== true) {
      return featureDisabledResponse("questionnaire_images", "この動物病院ではWEB問診の症状画像添付を使用していません。");
    }
    const petId = cleanString(body.pet_id);
    if (!petId) return errorResponse("問診対象のペットを選択してください。", 400);
    const mimeType = cleanString(body.mime_type || body.content_type || "").toLowerCase();
    if (!QUESTIONNAIRE_IMAGE_ALLOWED_MIME_TYPES.includes(mimeType)) {
      return errorResponse("症状画像は JPEG / PNG / WebP のみ登録できます。", 400);
    }
    const size = Math.max(0, Number(body.size || 0));
    if (!size || size > QUESTIONNAIRE_IMAGE_MAX_BYTES) {
      return errorResponse("症状画像は1枚800KB以下にしてください。", 400);
    }
    const ext = extensionFromMimeType(mimeType);
    const clinicSegment = sanitizeStoragePathSegment(clinicCode, DEFAULT_CLINIC_CODE);
    const petSegment = sanitizeStoragePathSegment(petId, "pet");
    const randomPart = `${Date.now()}-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
    const storagePath = `${clinicSegment}/${petSegment}/draft/${sanitizeStoragePathSegment(randomPart)}.${ext}`;
    const signed = await createPrivateStorageSignedUploadUrl(env, QUESTIONNAIRE_IMAGE_BUCKET, storagePath);
    return jsonResponse({
      ok: true,
      ...signed,
      file_name: sanitizeStoragePathSegment(body.file_name || body.filename || `symptom.${ext}`),
      mime_type: mimeType,
      size,
      private: true,
      upload_mode: "browser_direct_signed_upload",
      web_questionnaire_version: WEB_QUESTIONNAIRE_VERSION
    });
  } catch (error) {
    return errorResponse(error?.message || "症状画像アップロードURLを作成できませんでした。", 400, {
      route: "questionnaire_image_upload_url",
      upload_mode: "browser_direct_signed_upload"
    });
  }
}

async function createPrivateStorageSignedUrl(env, bucketName, storagePath, expiresIn = QUESTIONNAIRE_IMAGE_SIGNED_URL_SECONDS) {
  const path = cleanString(storagePath);
  if (!path) return null;
  const baseUrl = getSupabaseBaseUrl(env);
  const serviceKey = getSupabaseServiceKey(env);
  const url = `${baseUrl}/storage/v1/object/sign/${bucketName}/${encodeStoragePath(path)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ expiresIn: Math.max(60, Number(expiresIn || QUESTIONNAIRE_IMAGE_SIGNED_URL_SECONDS)) })
  });
  const text = await response.text();
  let data = {};
  if (text) { try { data = JSON.parse(text); } catch { data = {}; } }
  if (!response.ok) throw new Error(data?.message || data?.error || text || "症状画像の一時表示URLを作成できませんでした。");
  const signed = cleanString(data?.signedURL || data?.signedUrl || data?.url || "");
  if (!signed) return null;
  if (/^https?:\/\//i.test(signed)) return signed;
  return `${baseUrl}/storage/v1${signed.startsWith("/") ? signed : `/${signed}`}`;
}

async function uploadQuestionnaireImages(env, clinicCode, petId, questionnaireId, parsedImages = []) {
  const uploaded = [];
  try {
    for (let i = 0; i < parsedImages.length; i += 1) {
      const image = parsedImages[i];
      const storagePath = [
        sanitizeStoragePathSegment(clinicCode, DEFAULT_CLINIC_CODE),
        sanitizeStoragePathSegment(petId, "pet"),
        sanitizeStoragePathSegment(questionnaireId, "questionnaire"),
        `${String(i + 1).padStart(2, "0")}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${image.ext}`
      ].join("/");
      await supabaseStorageUpload(env, QUESTIONNAIRE_IMAGE_BUCKET, storagePath, image.bytes, image.mimeType);
      uploaded.push({
        storage_path: storagePath,
        file_name: image.safeFileName,
        mime_type: image.mimeType,
        size: image.size,
        private: true
      });
    }
    return uploaded;
  } catch (error) {
    for (const item of uploaded) {
      try { await supabaseStorageDeleteObject(env, QUESTIONNAIRE_IMAGE_BUCKET, item.storage_path); } catch {}
    }
    throw error;
  }
}

function questionnaireImageMeta(row = {}) {
  const answers = row?.answers && typeof row.answers === "object" && !Array.isArray(row.answers) ? row.answers : {};
  return Array.isArray(answers.images) ? answers.images.filter((x) => x && typeof x === "object") : [];
}

async function attachQuestionnaireSignedImages(env, row) {
  const images = questionnaireImageMeta(row);
  if (!images.length) return { ...row, image_count: 0, images: [] };
  const signed = [];
  for (const item of images.slice(0, QUESTIONNAIRE_IMAGE_MAX_COUNT)) {
    let signedUrl = null;
    try { signedUrl = await createPrivateStorageSignedUrl(env, QUESTIONNAIRE_IMAGE_BUCKET, item.storage_path); } catch {}
    signed.push({ ...item, signed_url: signedUrl, expires_in: QUESTIONNAIRE_IMAGE_SIGNED_URL_SECONDS });
  }
  return { ...row, image_count: signed.length, images: signed };
}

function assertDemoQuestionnaireRoute(request, env, body = {}) {
  const clinicCode = getRequestedClinicCode(request, body);
  if (clinicCode !== getDemoClinicCode(env)) {
    return { ok: false, status: 403, message: "DEMO問診APIは営業DEMO医院でのみ使用できます。", clinicCode };
  }
  const demoValue = cleanString(body.demo || getParam(request, "demo", "")).toLowerCase();
  if (!["ready", "true", "1"].includes(demoValue)) {
    return { ok: false, status: 403, message: "DEMO問診APIには demo=ready が必要です。", clinicCode };
  }
  return { ok: true, clinicCode };
}

async function handleQuestionnaireAdminList(request, env, demoOnly = false) {
  try {
    const body = {};
    if (demoOnly) {
      const guard = assertDemoQuestionnaireRoute(request, env, body);
      if (!guard.ok) return errorResponse(guard.message, guard.status, { route: "demo_questionnaires" });
    }
    const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
    const featureState = await getClinicFeatureState(env, clinicCode);
    const clinic = featureState.clinic;
    const isDemo = isDemoClinicCodeForAudit(env, clinicCode);
    const demoMarker = cleanString(getParam(request, "demo", "")).toLowerCase();
    const demoOverrideAllowed = demoOnly && isDemo && ["ready", "true", "1"].includes(demoMarker);
    const demoPrevisit = demoOverrideAllowed && toBool(getParam(request, "demo_previsit_questionnaire", "false"), false);
    const demoImages = demoOverrideAllowed && toBool(getParam(request, "demo_questionnaire_images", "false"), false);
    const previsitEnabled = featureState.feature_flags.previsit_questionnaire === true || demoPrevisit;
    const imagesEnabled = featureState.feature_flags.questionnaire_images === true || demoImages;

    if (!previsitEnabled) {
      return jsonResponse({
        ok: true,
        clinic: normalizeClinicForPublic(clinic),
        items: [],
        count: 0,
        demo_only: demoOnly,
        previsit_questionnaire_enabled: false,
        questionnaire_images_enabled: false,
        feature_disabled: "previsit_questionnaire",
        feature_switch_version: FEATURE_SWITCH_VERSION,
        web_questionnaire_version: WEB_QUESTIONNAIRE_VERSION
      });
    }

    const limit = normalizeLimit(getParam(request, "limit", "80"), 80, 200);
    const status = cleanString(getParam(request, "status", ""));
    const query = {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      order: "submitted_at.desc.nullslast,created_at.desc",
      limit
    };
    if (status) query.status = `eq.${status}`;
    const rows = await selectRows(env, TABLES.questionnaires, query);
    const items = [];
    for (const row of rows) {
      if (imagesEnabled) items.push(await attachQuestionnaireSignedImages(env, row));
      else items.push({ ...row, image_count: 0, images: [] });
    }
    return jsonResponse({
      ok: true,
      clinic: normalizeClinicForPublic(clinic),
      items,
      count: items.length,
      demo_only: demoOnly,
      previsit_questionnaire_enabled: true,
      questionnaire_images_enabled: imagesEnabled,
      questionnaire_image_storage_mode: imagesEnabled ? "private_signed_url" : "hidden_by_feature_switch",
      feature_switch_version: FEATURE_SWITCH_VERSION,
      web_questionnaire_version: WEB_QUESTIONNAIRE_VERSION,
      demo_feature_override_applied: demoOverrideAllowed && (demoPrevisit || demoImages)
    });
  } catch (error) {
    return errorResponse(error?.message || "WEB問診一覧を取得できませんでした。", 400, { route: "questionnaires_list" });
  }
}

async function handleDoctorQuestionnaireDetail(request, env) {
  try {
    const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
    const featureState = await getClinicFeatureState(env, clinicCode);
    const clinic = featureState.clinic;
    const isDemo = isDemoClinicCodeForAudit(env, clinicCode);
    const demoMarker = cleanString(getParam(request, "demo", "")).toLowerCase();
    const demoOverrideAllowed = isDemo && ["ready", "true", "1"].includes(demoMarker);
    const demoPrevisit = demoOverrideAllowed && toBool(getParam(request, "demo_previsit_questionnaire", "false"), false);
    const demoImages = demoOverrideAllowed && toBool(getParam(request, "demo_questionnaire_images", "false"), false);

    const previsitEnabled = featureState.feature_flags.previsit_questionnaire === true || demoPrevisit;
    const imagesEnabled = featureState.feature_flags.questionnaire_images === true || demoImages;
    if (!previsitEnabled) {
      return featureDisabledResponse("previsit_questionnaire", "この動物病院ではWEB問診を使用していません。");
    }

    const questionnaireId = cleanString(getParam(request, "questionnaire_id", ""));
    const waitingEntryId = cleanString(getParam(request, "waiting_entry_id", ""));
    if (!questionnaireId && !waitingEntryId) {
      return errorResponse("問診IDまたは受付IDがありません。", 400, { route: "doctor_questionnaire_detail" });
    }

    const query = { select: "*", clinic_id: `eq.${clinic.id}`, limit: 1 };
    if (questionnaireId) query.id = `eq.${questionnaireId}`;
    else query.waiting_entry_id = `eq.${waitingEntryId}`;
    if (!questionnaireId) query.order = "submitted_at.desc.nullslast,created_at.desc";
    const rows = await selectRows(env, TABLES.questionnaires, query);
    const row = rows?.[0] || null;
    if (!row) return errorResponse("この受付に紐づくWEB問診を確認できませんでした。", 404, { route: "doctor_questionnaire_detail" });

    let item = { ...row, image_count: questionnaireImageMeta(row).length, images: [] };
    if (imagesEnabled) item = await attachQuestionnaireSignedImages(env, row);

    return jsonResponse({
      ok: true,
      item,
      questionnaire_images_enabled: imagesEnabled,
      questionnaire_image_storage_mode: "private_signed_url",
      signed_url_expires_in: QUESTIONNAIRE_IMAGE_SIGNED_URL_SECONDS,
      doctor_questionnaire_image_view_version: DOCTOR_QUESTIONNAIRE_IMAGE_VIEW_VERSION,
      feature_switch_version: FEATURE_SWITCH_VERSION,
      demo_feature_override_applied: demoOverrideAllowed && (demoPrevisit || demoImages)
    });
  } catch (error) {
    return errorResponse(error?.message || "診察用WEB問診詳細を取得できませんでした。", 400, {
      route: "doctor_questionnaire_detail",
      doctor_questionnaire_image_view_version: DOCTOR_QUESTIONNAIRE_IMAGE_VIEW_VERSION
    });
  }
}

async function handleQuestionnaireReview(request, env, demoOnly = false) {
  try {
    const body = await readJson(request);
    if (demoOnly) {
      const guard = assertDemoQuestionnaireRoute(request, env, body);
      if (!guard.ok) return errorResponse(guard.message, guard.status, { route: "demo_questionnaires_review" });
    }
    const clinicCode = getRequestedClinicCode(request, body);
    const clinic = await getClinicByCode(env, clinicCode);
    const id = cleanString(body.id || body.questionnaire_id);
    if (!id) return errorResponse("問診IDがありません。", 400);
    const rows = await updateRows(env, TABLES.questionnaires, { id: `eq.${id}`, clinic_id: `eq.${clinic.id}` }, {
      status: "reviewed",
      updated_at: new Date().toISOString()
    });
    const questionnaire = rows?.[0] || rows;
    await logOperation(env, clinic.id, demoOnly ? "demo" : "staff", cleanString(body.staff_name) || (demoOnly ? "営業DEMO" : "院内スタッフ"),
      "web_questionnaire_review", "questionnaire", id, { questionnaire_version: WEB_QUESTIONNAIRE_VERSION });
    return jsonResponse({ ok: true, message: "問診を確認済みにしました。", questionnaire });
  } catch (error) {
    return errorResponse(error?.message || "問診の確認状態を更新できませんでした。", 400, { route: "questionnaires_review" });
  }
}

async function resolvePetPhotoAccess(request, env, body = {}) {
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);

  const rawPetId = cleanString(body.pet_id || body.id || getParam(request, "pet_id", "") || getParam(request, "id", ""));
  const petId = isUuidLike(rawPetId) ? rawPetId : "";
  const invalidPetId = rawPetId && !petId ? rawPetId : "";

  const lineUserId = cleanString(body.line_user_id || body.lineUserId || getParam(request, "line_user_id", "") || getParam(request, "lineUserId", ""));
  const guardianIdRaw = cleanString(body.guardian_id || body.owner_id || getParam(request, "guardian_id", "") || getParam(request, "owner_id", ""));
  const guardianId = isUuidLike(guardianIdRaw) ? guardianIdRaw : "";
  const rawCardToken = cleanString(body.card_token || body.qr_token || body.token || body.t || getParam(request, "card_token", "") || getParam(request, "qr_token", "") || getParam(request, "token", "") || getParam(request, "t", ""));
  const cardToken = rawCardToken ? extractTokenFromQrPayload(rawCardToken) : "";
  const petName = cleanString(body.pet_name || getParam(request, "pet_name", ""));
  const cardNo = cleanString(body.card_no || getParam(request, "card_no", ""));

  let guardian = null;
  let card = null;
  let pet = null;
  let accessMethod = "";

  // 1) UUID形式のpet_idがある場合だけ、vet_pets.idに直接問い合わせる。
  //    demo_pet_check のようなデモ用文字列をUUID列に投げるとPostgRESTが400になるため、ここで必ず止める。
  if (petId) {
    pet = await selectSingle(env, TABLES.pets, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      id: `eq.${petId}`,
      limit: 1
    });
  }

  // 2) pet_idがデモ用文字列でも、診察券tokenがあれば実データの診察券からpet_idを解決する。
  //    member.htmlのデモフォールバックカードでも写真登録できるようにするためのR1修正。
  if (!pet && cardToken) {
    card = await selectSingle(env, TABLES.petCardView, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      qr_token: `eq.${cardToken}`,
      limit: 1
    });

    if (!card) {
      card = await selectSingle(env, TABLES.petCards, {
        select: "*",
        clinic_id: `eq.${clinic.id}`,
        qr_token: `eq.${cardToken}`,
        limit: 1
      });
    }

    if (card?.pet_id && isUuidLike(card.pet_id)) {
      pet = await selectSingle(env, TABLES.pets, {
        select: "*",
        clinic_id: `eq.${clinic.id}`,
        id: `eq.${card.pet_id}`,
        limit: 1
      });
    }
  }

  // 3) LINE連携済みでpet_nameがある場合、飼い主配下のペット名から補助解決する。
  //    tokenが古い・取れない場合の保険。本番では同名ペットの可能性があるため、複数候補なら止める。
  if (!pet && lineUserId && petName) {
    guardian = await selectSingle(env, TABLES.guardians, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      line_user_id: `eq.${lineUserId}`,
      status: "eq.active",
      limit: 1
    });

    if (guardian?.id) {
      const candidatePets = await selectRows(env, TABLES.pets, {
        select: "*",
        clinic_id: `eq.${clinic.id}`,
        guardian_id: `eq.${guardian.id}`,
        status: "eq.active"
      });

      const normalizedTarget = normalizeForLooseCompare(petName);
      const matches = candidatePets.filter((row) => normalizeForLooseCompare(row.pet_name || row.name) === normalizedTarget);
      if (matches.length === 1) {
        pet = matches[0];
      } else if (matches.length > 1) {
        throw new Error("同じ名前のペットが複数いるため、写真登録用の診察券情報を特定できませんでした。診察券QRから開き直してください。");
      }
    }
  }

  // 4) card_noもある場合の補助解決。
  if (!pet && cardNo) {
    card = await selectSingle(env, TABLES.petCardView, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      card_no: `eq.${cardNo}`,
      limit: 1
    });

    if (card?.pet_id && isUuidLike(card.pet_id)) {
      pet = await selectSingle(env, TABLES.pets, {
        select: "*",
        clinic_id: `eq.${clinic.id}`,
        id: `eq.${card.pet_id}`,
        limit: 1
      });
    }
  }

  if (!pet) {
    if (invalidPetId) {
      throw new Error(`写真登録用の実データIDを確認できませんでした。デモ用ID「${invalidPetId}」では保存できないため、営業前デモ準備を実行してから再読み込みしてください。`);
    }
    throw new Error("ペット情報が見つかりません。");
  }

  // 権限確認。R2では「診察券token」を最優先にする。
  // 理由：営業デモURLの line_user_id=demo_line_link_001 が、実DBの guardian.line_user_id と完全一致しない場合でも、
  //       表示中の診察券QR token と pet_id が一致していれば、写真登録を許可できるため。
  const authErrors = [];

  if (cardToken) {
    let tokenCard = null;

    if (card && cleanString(card.pet_id) === cleanString(pet.id)) {
      tokenCard = card;
    }

    if (!tokenCard) {
      tokenCard = await selectSingle(env, TABLES.petCards, {
        select: "*",
        clinic_id: `eq.${clinic.id}`,
        pet_id: `eq.${pet.id}`,
        qr_token: `eq.${cardToken}`,
        limit: 1
      });
    }

    if (!tokenCard) {
      tokenCard = await selectSingle(env, TABLES.petCardView, {
        select: "*",
        clinic_id: `eq.${clinic.id}`,
        pet_id: `eq.${pet.id}`,
        qr_token: `eq.${cardToken}`,
        limit: 1
      });
    }

    if (tokenCard && cleanString(tokenCard.pet_id) === cleanString(pet.id)) {
      card = tokenCard;
      accessMethod = "card_token";
    } else {
      authErrors.push("診察券情報とペット情報が一致しません。");
    }
  }

  const verifiedLineUserId = cleanString(request.headers.get("X-DPRO-Verified-Line-User-Id"));
  const isDemoPhotoAccess = clinicCode === getDemoClinicCode(env);

  if (!accessMethod && guardianId && (isDemoPhotoAccess || verifiedLineUserId)) {
    guardian = await selectSingle(env, TABLES.guardians, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      id: `eq.${guardianId}`,
      status: "eq.active",
      limit: 1
    });

    if (guardian && cleanString(guardian.id) === cleanString(pet.guardian_id)) {
      accessMethod = "guardian_id";
    } else {
      authErrors.push("飼い主情報とペット情報が一致しません。");
    }
  }

  if (!accessMethod && lineUserId && (isDemoPhotoAccess || (verifiedLineUserId && verifiedLineUserId === lineUserId))) {
    guardian = guardian || await selectSingle(env, TABLES.guardians, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      line_user_id: `eq.${lineUserId}`,
      status: "eq.active",
      limit: 1
    });

    if (guardian && cleanString(guardian.id) === cleanString(pet.guardian_id)) {
      accessMethod = "line_user_id";
    } else {
      authErrors.push("LINE連携情報とペット情報が一致しません。");
    }
  }

  if (!accessMethod && clinicCode === getDemoClinicCode(env) && toBool(body.demo || getParam(request, "demo", "false"), false)) {
    accessMethod = "demo";
  }

  if (!accessMethod) {
    const detail = authErrors.length ? ` ${authErrors.join(" / ")}` : "";
    throw new Error(`このペットの写真を変更する権限を確認できませんでした。診察券QRから開き直すか、営業前デモ準備を実行してから再読み込みしてください。${detail}`);
  }

  return { clinicCode, clinic, pet, guardian, card, accessMethod, lineUserId };
}

function extractPetPhotoFields(row = {}) {
  const photoUrl = row.photo_url || row.pet_photo_url || null;
  const photoStoragePath = row.photo_storage_path || row.pet_photo_storage_path || null;
  const photoUpdatedAt = row.photo_updated_at || row.pet_photo_updated_at || null;
  return {
    photo_url: photoUrl,
    pet_photo_url: photoUrl,
    photo_storage_path: photoStoragePath,
    pet_photo_storage_path: photoStoragePath,
    photo_updated_at: photoUpdatedAt,
    pet_photo_updated_at: photoUpdatedAt,
    has_pet_photo: Boolean(photoUrl)
  };
}

async function attachPetPhotoFieldsToRows(env, clinicId, rows) {
  const arrayMode = Array.isArray(rows);
  const arr = arrayMode ? rows : (rows ? [rows] : []);
  if (!arr.length) return arrayMode ? [] : rows;

  const petIds = Array.from(new Set(arr.map((row) => cleanString(row.pet_id || row.id)).filter(Boolean)));
  if (!petIds.length) return arrayMode ? arr : arr[0];

  let pets = [];
  try {
    pets = await selectRows(env, TABLES.pets, {
      select: "id,photo_url,photo_storage_path,photo_updated_at",
      clinic_id: `eq.${clinicId}`,
      id: `in.(${petIds.join(",")})`
    });
  } catch {
    return arrayMode ? arr : arr[0];
  }

  const photoMap = new Map(pets.map((pet) => [String(pet.id), pet]));
  const enriched = arr.map((row) => {
    const petId = cleanString(row.pet_id || row.id);
    const photo = photoMap.get(petId) || {};
    return {
      ...row,
      ...extractPetPhotoFields({ ...photo, ...row })
    };
  });

  return arrayMode ? enriched : enriched[0];
}

async function handlePetPhotoUpdate(request, env) {
  try {
    const body = await readJson(request);
    const access = await resolvePetPhotoAccess(request, env, body);
    const payload = parsePetPhotoPayload(body);

    const clinicCodeSegment = sanitizeStoragePathSegment(access.clinicCode, DEFAULT_CLINIC_CODE);
    const petSegment = sanitizeStoragePathSegment(access.pet.id, "pet");
    const timestamp = Date.now();
    const ext = extensionFromMimeType(payload.mimeType);
    const storagePath = `${clinicCodeSegment}/${petSegment}/${timestamp}.${ext}`;
    const oldStoragePath = cleanString(access.pet.photo_storage_path || "");

    await supabaseStorageUpload(env, getPetPhotoBucketName(), storagePath, payload.bytes, payload.mimeType);
    const publicUrl = getPetPhotoPublicUrl(env, storagePath);
    const nowIso = new Date().toISOString();

    const updatedRows = await updateRows(env, TABLES.pets, {
      clinic_id: `eq.${access.clinic.id}`,
      id: `eq.${access.pet.id}`
    }, {
      photo_url: publicUrl,
      photo_storage_path: storagePath,
      photo_updated_at: nowIso
    });

    if (oldStoragePath && oldStoragePath !== storagePath) {
      await supabaseStorageDeleteObject(env, getPetPhotoBucketName(), oldStoragePath);
    }

    const updatedPet = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;

    return jsonResponse({
      ok: true,
      route: "step_vet_photo_1b_pet_photo_update",
      worker_version: WORKER_VERSION,
      message: "写真を更新しました。",
      clinic_code: access.clinicCode,
      clinic: access.clinic,
      pet: {
        ...updatedPet,
        ...extractPetPhotoFields(updatedPet || {})
      },
      photo_url: publicUrl,
      photo_storage_path: storagePath,
      photo_updated_at: nowIso,
      photo_size: payload.size,
      mime_type: payload.mimeType,
      access_method: access.accessMethod,
      bucket: getPetPhotoBucketName()
    });
  } catch (error) {
    return errorResponse(error?.message || "写真の更新に失敗しました。", 400, {
      route: "step_vet_photo_1b_pet_photo_update",
      worker_version: WORKER_VERSION,
      bucket: getPetPhotoBucketName(),
      max_bytes: PET_PHOTO_MAX_BYTES,
      allowed_mime_types: PET_PHOTO_ALLOWED_MIME_TYPES
    });
  }
}

async function handlePetPhotoDelete(request, env) {
  try {
    const body = await readJson(request);
    const access = await resolvePetPhotoAccess(request, env, body);
    const oldStoragePath = cleanString(access.pet.photo_storage_path || "");

    if (oldStoragePath) {
      await supabaseStorageDeleteObject(env, getPetPhotoBucketName(), oldStoragePath);
    }

    const updatedRows = await updateRows(env, TABLES.pets, {
      clinic_id: `eq.${access.clinic.id}`,
      id: `eq.${access.pet.id}`
    }, {
      photo_url: null,
      photo_storage_path: null,
      photo_updated_at: new Date().toISOString()
    });

    const updatedPet = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;

    return jsonResponse({
      ok: true,
      route: "step_vet_photo_1b_pet_photo_delete",
      worker_version: WORKER_VERSION,
      message: "写真を削除しました。",
      clinic_code: access.clinicCode,
      clinic: access.clinic,
      pet: {
        ...updatedPet,
        ...extractPetPhotoFields(updatedPet || {})
      },
      photo_url: null,
      photo_storage_path: null,
      access_method: access.accessMethod,
      bucket: getPetPhotoBucketName()
    });
  } catch (error) {
    return errorResponse(error?.message || "写真の削除に失敗しました。", 400, {
      route: "step_vet_photo_1b_pet_photo_delete",
      worker_version: WORKER_VERSION,
      bucket: getPetPhotoBucketName()
    });
  }
}

// =========================================================
// Member / LIFF handlers
// =========================================================

async function handleMemberPetCard(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const token = getParam(request, "t") || getParam(request, "token") || getParam(request, "qr_token");
  const petId = getParam(request, "pet_id", "");

  const clinic = await getClinicByCode(env, clinicCode);

  let card = null;
  if (token) {
    card = await getCardByToken(env, clinic.id, token);
  } else if (petId) {
    card = await selectSingle(env, TABLES.petCardView, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      pet_id: `eq.${petId}`
    });
  }

  if (!card) return errorResponse("Pet card not found.", 404, { scan_result: "not_found" });

  if (card.card_enabled === false || card.pet_status !== "active") {
    return errorResponse("This pet card is disabled.", 403, {
      scan_result: "disabled",
      card: {
        card_no: card.card_no,
        pet_name: card.pet_name,
        pet_status: card.pet_status,
        card_enabled: card.card_enabled
      }
    });
  }

  card = await attachPetPhotoFieldsToRows(env, clinic.id, card);

  const familyCardsRaw = await selectRows(env, TABLES.petCardView, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    guardian_id: `eq.${card.guardian_id}`,
    pet_status: "eq.active",
    order: "card_no.asc"
  });
  const family_cards = await attachPetPhotoFieldsToRows(env, clinic.id, familyCardsRaw);

  return jsonResponse({
    ok: true,
    clinic,
    guardian: extractGuardian(card),
    card,
    pet: extractPet(card),
    family_cards,
    prevention_items: card.prevention_items || []
  });
}

async function handleMemberPetCards(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const lineUserId = getParam(request, "line_user_id", "") || getParam(request, "lineUserId", "");
  const guardianId = getParam(request, "guardian_id", "");
  const demo = toBool(getParam(request, "demo", "false"), false);

  const clinic = await getClinicByCode(env, clinicCode);

  let guardian = null;
  if (guardianId) {
    guardian = await selectSingle(env, TABLES.guardians, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      id: `eq.${guardianId}`
    });
  } else if (lineUserId) {
    guardian = await selectSingle(env, TABLES.guardians, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      line_user_id: `eq.${lineUserId}`
    });
  } else if (demo && clinicCode === getDemoClinicCode(env)) {
    guardian = await selectSingle(env, TABLES.guardians, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      guardian_no: "eq.G-0001"
    });
  }

  if (!guardian) {
    return jsonResponse({
      ok: true,
      clinic,
      guardian: null,
      cards: [],
      line_link_status: "unlinked",
      message: "LINE連携済みの飼い主情報が見つかりません。受付で連携してください。"
    });
  }

  const cardsRaw = await selectRows(env, TABLES.petCardView, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    guardian_id: `eq.${guardian.id}`,
    pet_status: "eq.active",
    order: "card_no.asc"
  });
  const cards = await attachPetPhotoFieldsToRows(env, clinic.id, cardsRaw);

  return jsonResponse({
    ok: true,
    clinic,
    guardian,
    cards,
    line_link_status: guardian.line_link_status
  });
}

async function handleMemberLineLinkStatus(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const token = getParam(request, "token", "");
  const lineUserId = getParam(request, "line_user_id", "") || getParam(request, "lineUserId", "");

  const clinic = await getClinicByCode(env, clinicCode);

  let linkToken = null;
  if (token) {
    linkToken = await selectSingle(env, TABLES.lineLinkTokens, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      token: `eq.${token}`
    });
  }

  let guardian = null;
  if (linkToken) {
    guardian = await getGuardianById(env, linkToken.guardian_id);
  } else if (lineUserId) {
    guardian = await selectSingle(env, TABLES.guardians, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      line_user_id: `eq.${lineUserId}`
    });
  }

  return jsonResponse({
    ok: true,
    clinic,
    token: linkToken,
    guardian,
    is_linked: Boolean(guardian && guardian.line_link_status === "linked"),
    now: new Date().toISOString()
  });
}

async function handleMemberLineLinkComplete(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const tokenText = cleanString(body.token);
  const lineUserId = cleanString(body.line_user_id || body.lineUserId);
  const lineDisplayName = cleanString(body.line_display_name || body.displayName);
  const linePictureUrl = cleanString(body.line_picture_url || body.pictureUrl);

  if (!tokenText) return errorResponse("LINE連携トークンがありません。", 400);
  if (!lineUserId) return errorResponse("LINE userId がありません。LIFF内で開いてください。", 400);

  const clinic = await getClinicByCode(env, clinicCode);

  const linkToken = await selectSingle(env, TABLES.lineLinkTokens, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    token: `eq.${tokenText}`,
    status: "eq.active"
  });

  if (!linkToken) return errorResponse("有効なLINE連携トークンが見つかりません。", 404);

  const nowIso = new Date().toISOString();
  if (linkToken.expires_at && new Date(linkToken.expires_at).getTime() < Date.now()) {
    await updateRows(env, TABLES.lineLinkTokens, { id: `eq.${linkToken.id}` }, { status: "expired" });
    return errorResponse("LINE連携トークンの有効期限が切れています。", 410);
  }

  const updatedGuardianRows = await updateRows(env, TABLES.guardians, { id: `eq.${linkToken.guardian_id}` }, {
    line_user_id: lineUserId,
    line_display_name: lineDisplayName || null,
    line_picture_url: linePictureUrl || null,
    line_link_status: "linked",
    preferred_contact: "line"
  });

  await updateRows(env, TABLES.lineLinkTokens, { id: `eq.${linkToken.id}` }, {
    status: "used",
    used_at: nowIso,
    line_user_id: lineUserId
  });

  await logOperation(env, clinic.id, "guardian", "LINE連携完了", "line_link_complete", "guardian", linkToken.guardian_id, {
    token_id: linkToken.id,
    line_display_name: lineDisplayName || ""
  });

  return jsonResponse({
    ok: true,
    message: "LINE連携が完了しました。",
    clinic,
    guardian: Array.isArray(updatedGuardianRows) ? updatedGuardianRows[0] : updatedGuardianRows
  });
}


// =========================================================
// ANIMARY-COUNTER-V1.1-6: WEB問診 → 受付 / 日時予約 自動紐付け
// =========================================================
const QUESTIONNAIRE_TYPE_LABELS = Object.freeze({
  general:"体調不良", vaccine:"ワクチン", health_check:"健康診断", skin:"皮膚",
  digestive:"消化器", respiratory:"呼吸器", eye:"眼", ear:"耳", urinary:"泌尿器",
  injury:"ケガ", medicine_prevention:"お薬・予防", other:"その他"
});

function questionnaireAnswers(row = {}) {
  return row?.answers && typeof row.answers === "object" && !Array.isArray(row.answers) ? row.answers : {};
}
function questionnaireBranchContext(row = {}) {
  return row?.branch_context && typeof row.branch_context === "object" && !Array.isArray(row.branch_context) ? row.branch_context : {};
}
function questionnairePetName(row = {}) {
  const a=questionnaireAnswers(row), b=questionnaireBranchContext(row);
  return cleanString(a.pet_name || b.pet_name || row.pet_name || "");
}
function questionnaireGuardianName(row = {}) {
  const a=questionnaireAnswers(row), b=questionnaireBranchContext(row);
  return cleanString(a.guardian_name || b.guardian_name || row.guardian_name || "");
}
function questionnaireChiefComplaint(row = {}) {
  const a=questionnaireAnswers(row);
  const symptoms=row?.symptoms && typeof row.symptoms === "object" && !Array.isArray(row.symptoms) ? row.symptoms : {};
  return cleanString(
    a.chief_complaint || a.main_concern || a.concern || symptoms.chief_complaint ||
    row.free_text || a.free_text || ""
  );
}
function questionnaireSubmittedMs(row = {}) {
  const raw=cleanString(row.submitted_at || row.created_at || row.updated_at || "");
  const ms=raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(ms) ? ms : 0;
}
function questionnaireImageCount(row = {}) {
  const a=questionnaireAnswers(row);
  const n=Number(a.image_count || (Array.isArray(a.images) ? a.images.length : 0) || 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
function questionnaireSummaryText(row = {}) {
  const type=cleanString(row.questionnaire_type || "general").toLowerCase();
  const label=QUESTIONNAIRE_TYPE_LABELS[type] || type || "WEB問診";
  const concern=questionnaireChiefComplaint(row);
  const detail=[];
  if (row.since_when) detail.push(`いつ頃:${cleanString(row.since_when)}`);
  if (row.appetite) detail.push(`食欲:${cleanString(row.appetite)}`);
  if (row.energy) detail.push(`元気:${cleanString(row.energy)}`);
  if (row.vomiting) detail.push(`嘔吐:${cleanString(row.vomiting)}`);
  if (row.diarrhea) detail.push(`下痢:${cleanString(row.diarrhea)}`);
  const images=questionnaireImageCount(row);
  const parts=[label, concern, ...detail.slice(0,2), images ? `画像${images}枚` : ""].filter(Boolean);
  return parts.join("｜") || "WEB問診あり";
}
function questionnaireContextFromRow(row = {}) {
  if (!row?.id) return {};
  return {
    questionnaire_id: row.id,
    questionnaire_type: row.questionnaire_type || "general",
    questionnaire_summary: questionnaireSummaryText(row),
    questionnaire_image_count: questionnaireImageCount(row),
    questionnaire_status: row.status || "submitted",
    questionnaire_submitted_at: row.submitted_at || row.created_at || null,
    questionnaire_emergency_confirmed: row.emergency_confirmed === true,
    questionnaire_branching_used: row.branching_used === true,
    questionnaire_waiting_entry_id: row.waiting_entry_id || null,
    questionnaire_appointment_id: row.appointment_id || null,
    questionnaire_visit_link_version: QUESTIONNAIRE_VISIT_LINK_VERSION
  };
}
function questionnaireVisitDateMatches(row = {}, targetDate = "", fallbackHours = 72) {
  const qDate=cleanString(row.visit_date);
  const tDate=cleanString(targetDate);
  if (qDate && tDate) return qDate === tDate;
  const ms=questionnaireSubmittedMs(row);
  if (!ms) return false;
  const age=Date.now()-ms;
  return age >= -5*60*1000 && age <= Math.max(1,Number(fallbackHours||72))*60*60*1000;
}
async function resolveQuestionnaireDbContext(env, clinic, clinicCode, body = {}) {
  const rawPetId=cleanString(body.pet_id);
  const rawGuardianId=cleanString(body.guardian_id);
  const petName=cleanString(body.pet_name || body.answers?.pet_name || body.branch_context?.pet_name || "");
  let pet=null;
  if (isUuidLike(rawPetId)) {
    pet=await selectSingle(env,TABLES.pets,{select:"*",clinic_id:`eq.${clinic.id}`,id:`eq.${rawPetId}`}).catch(()=>null);
  }
  if (!pet && isDemoClinicCodeForAudit(env,clinicCode) && petName) {
    const rows=await selectRows(env,TABLES.pets,{select:"*",clinic_id:`eq.${clinic.id}`,pet_name:`eq.${petName}`,status:"eq.active",order:"created_at.asc",limit:2}).catch(()=>[]);
    if (rows.length===1) pet=rows[0];
  }
  if (!pet && !isDemoClinicCodeForAudit(env,clinicCode)) {
    throw new Error("問診対象のペット情報を確認できません。LINE診察券から開き直してください。");
  }
  const petId=pet?.id || (isUuidLike(rawPetId) ? rawPetId : null);
  const guardianId=pet?.guardian_id || (isUuidLike(rawGuardianId) ? rawGuardianId : null);
  return { pet, pet_id:petId, guardian_id:guardianId, pet_name:pet?.pet_name || petName };
}
async function recentQuestionnairesForClinic(env, clinicId, limit = 400) {
  return selectRows(env,TABLES.questionnaires,{
    select:"*", clinic_id:`eq.${clinicId}`, order:"submitted_at.desc.nullslast,created_at.desc", limit:Math.min(Math.max(Number(limit||400),1),500)
  }).catch(()=>[]);
}
function pickQuestionnaireForTarget(rows = [], opts = {}) {
  const targetId=cleanString(opts.target_id);
  const linkField=opts.link_field;
  const petId=cleanString(opts.pet_id);
  const petName=cleanString(opts.pet_name);
  const targetDate=cleanString(opts.target_date);
  const clinicIsDemo=opts.demo === true;
  const candidates=rows.filter(q=>{
    if (!q?.id) return false;
    const linked=cleanString(q[linkField]);
    if (linked && linked !== targetId) return false;
    const exactPet=petId && cleanString(q.pet_id)===petId;
    const demoName=clinicIsDemo && petName && !q.pet_id && questionnairePetName(q)===petName;
    if (!exactPet && !demoName) return false;
    return questionnaireVisitDateMatches(q,targetDate,72);
  }).sort((a,b)=>questionnaireSubmittedMs(b)-questionnaireSubmittedMs(a));
  return candidates[0] || null;
}
async function linkQuestionnaireToVisitTarget(env, clinic, questionnaire, field, targetId, actorName = "問診自動紐付け") {
  if (!questionnaire?.id || !targetId) return {ok:true,linked:false,skipped:true,reason:"missing_context"};
  const current=cleanString(questionnaire[field]);
  if (current && current !== targetId) return {ok:true,linked:false,skipped:true,reason:"already_linked_other",questionnaire_id:questionnaire.id};
  if (current === targetId) return {ok:true,linked:true,skipped:true,reason:"already_linked",questionnaire_id:questionnaire.id};
  const updated=await updateRows(env,TABLES.questionnaires,{id:`eq.${questionnaire.id}`,clinic_id:`eq.${clinic.id}`},{[field]:targetId,updated_at:new Date().toISOString()});
  await logOperation(env,clinic.id,"system",actorName,"web_questionnaire_visit_auto_link","questionnaire",questionnaire.id,{field,target_id:targetId,feature_version:QUESTIONNAIRE_VISIT_LINK_VERSION});
  return {ok:true,linked:true,skipped:false,questionnaire_id:questionnaire.id,row:updated?.[0]||questionnaire};
}
async function linkRecentQuestionnaireToWaitingEntry(env, clinic, opts = {}) {
  const waitingEntryId=cleanString(opts.waiting_entry_id);
  if (!waitingEntryId) return {ok:true,linked:false,skipped:true,reason:"waiting_entry_id_missing"};
  try {
    const rows=await recentQuestionnairesForClinic(env,clinic.id,300);
    const q=pickQuestionnaireForTarget(rows,{target_id:waitingEntryId,link_field:"waiting_entry_id",pet_id:opts.pet_id,pet_name:opts.pet_name,target_date:opts.target_date,demo:isDemoClinicCodeForAudit(env,clinic.clinic_code)});
    if (!q) return {ok:true,linked:false,skipped:true,reason:"questionnaire_not_found"};
    return await linkQuestionnaireToVisitTarget(env,clinic,q,"waiting_entry_id",waitingEntryId,opts.actor_name||"受付連動");
  } catch(error) { return {ok:false,linked:false,skipped:false,reason:"link_failed",error:error?.message||String(error)}; }
}
async function linkRecentQuestionnaireToAppointment(env, clinic, opts = {}) {
  const appointmentId=cleanString(opts.appointment_id);
  if (!appointmentId) return {ok:true,linked:false,skipped:true,reason:"appointment_id_missing"};
  try {
    const rows=await recentQuestionnairesForClinic(env,clinic.id,300);
    const q=pickQuestionnaireForTarget(rows,{target_id:appointmentId,link_field:"appointment_id",pet_id:opts.pet_id,pet_name:opts.pet_name,target_date:opts.appointment_date,demo:isDemoClinicCodeForAudit(env,clinic.clinic_code)});
    if (!q) return {ok:true,linked:false,skipped:true,reason:"questionnaire_not_found"};
    return await linkQuestionnaireToVisitTarget(env,clinic,q,"appointment_id",appointmentId,opts.actor_name||"予約連動");
  } catch(error) { return {ok:false,linked:false,skipped:false,reason:"link_failed",error:error?.message||String(error)}; }
}
async function autoLinkSubmittedQuestionnaire(env, clinic, questionnaire, context = {}) {
  if (!questionnaire?.id || !context.pet_id) return {ok:true,waiting:null,appointment:null,skipped:true,reason:"pet_context_missing"};
  let waiting=null,appointment=null;
  const today=todayJST();
  try {
    const active=await findActiveSameDayQueueEntry(env,clinic.id,context.pet_id,today);
    const waitingId=cleanString(active?.waiting_entry_id || active?.id);
    if (waitingId) waiting=await linkQuestionnaireToVisitTarget(env,clinic,questionnaire,"waiting_entry_id",waitingId,"WEB問診送信時自動紐付け");
  } catch(error) { waiting={ok:false,error:error?.message||String(error)}; }
  try {
    let target=null;
    const explicit=cleanString(questionnaire.appointment_id);
    if (explicit) {
      target=await selectSingle(env,TABLES.exactAppointments,{select:"*",clinic_id:`eq.${clinic.id}`,id:`eq.${explicit}`,pet_id:`eq.${context.pet_id}`}).catch(()=>null);
    }
    if (!target) {
      const rows=await selectRows(env,TABLES.exactAppointments,{select:"*",clinic_id:`eq.${clinic.id}`,pet_id:`eq.${context.pet_id}`,order:"appointment_date.asc,start_time.asc",limit:20}).catch(()=>[]);
      const visitDate=cleanString(questionnaire.visit_date);
      const eligible=rows.filter(a=>["scheduled","confirmed","checked_in"].includes(cleanString(a.status)) && compareDateText(cleanString(a.appointment_date),today)>=0 && (!visitDate || cleanString(a.appointment_date)===visitDate));
      if (eligible.length===1) target=eligible[0];
      else if (visitDate) target=eligible.find(a=>cleanString(a.appointment_date)===visitDate)||null;
    }
    if (target) appointment=await linkQuestionnaireToVisitTarget(env,clinic,questionnaire,"appointment_id",target.id,"WEB問診送信時予約自動紐付け");
  } catch(error) { appointment={ok:false,error:error?.message||String(error)}; }
  return {ok:true,waiting,appointment,feature_version:QUESTIONNAIRE_VISIT_LINK_VERSION};
}
async function attachWebQuestionnaireContextToRows(env, clinic, rows = [], mode = "queue") {
  if (!rows.length) return rows;
  const questionnaires=await recentQuestionnairesForClinic(env,clinic.id,500);
  const byWaiting=new Map(), byAppointment=new Map(), byPet=new Map(), byDemoName=new Map();
  for (const q of questionnaires) {
    if (q.waiting_entry_id && !byWaiting.has(cleanString(q.waiting_entry_id))) byWaiting.set(cleanString(q.waiting_entry_id),q);
    if (q.appointment_id && !byAppointment.has(cleanString(q.appointment_id))) byAppointment.set(cleanString(q.appointment_id),q);
    if (q.pet_id && !byPet.has(cleanString(q.pet_id))) byPet.set(cleanString(q.pet_id),q);
    const pn=questionnairePetName(q); if (pn && !byDemoName.has(pn)) byDemoName.set(pn,q);
  }
  const demo=isDemoClinicCodeForAudit(env,clinic.clinic_code);
  return rows.map(row=>{
    const directId=mode==="appointment" ? cleanString(row.id) : cleanString(row.waiting_entry_id||row.id);
    let q=mode==="appointment" ? byAppointment.get(directId) : byWaiting.get(directId);
    if (!q) {
      const petId=cleanString(row.pet_id);
      const targetDate=mode==="appointment" ? cleanString(row.appointment_date) : cleanString(row.target_date);
      const candidate=petId ? byPet.get(petId) : null;
      const linkField=mode==="appointment" ? "appointment_id" : "waiting_entry_id";
      if (candidate && (!candidate[linkField] || cleanString(candidate[linkField])===directId) && questionnaireVisitDateMatches(candidate,targetDate,72)) q=candidate;
      if (!q && demo) {
        const pn=cleanString(row.pet_name||row.pet_name_snapshot||"");
        const demoQ=pn ? byDemoName.get(pn) : null;
        if (demoQ && (!demoQ[linkField] || cleanString(demoQ[linkField])===directId) && questionnaireVisitDateMatches(demoQ,targetDate,72)) q=demoQ;
      }
    }
    return q ? {...row,...questionnaireContextFromRow(q),has_web_questionnaire:true} : {...row,has_web_questionnaire:false};
  });
}

async function handleQuestionnaireCreate(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const featureState = await getClinicFeatureState(env, clinicCode);
  const clinic = featureState.clinic;

  // V1.1-4-R1: 営業DEMOはFeature SwitchをブラウザlocalStorageへ保存するため、
  // DEMOに限り画面から送られたスイッチ状態を今回の問診送信だけに適用する。
  // 本番clinicではクライアント指定を一切採用せず、Supabase設定だけを正とする。
  const demoMarker = cleanString(body.demo || getParam(request, "demo", "")).toLowerCase();
  const demoOverrideAllowed = isDemoClinicCodeForAudit(env, clinicCode) && ["ready", "true", "1"].includes(demoMarker);
  let effectiveFeatureFlags = featureState.feature_flags;
  let effectiveQuestionnaireModules = featureState.questionnaire_modules;
  if (demoOverrideAllowed && body.demo_feature_flags && typeof body.demo_feature_flags === "object" && !Array.isArray(body.demo_feature_flags)) {
    effectiveFeatureFlags = normalizeFeatureFlags({ ...featureState.feature_flags, ...body.demo_feature_flags });
  }
  if (demoOverrideAllowed && body.demo_questionnaire_modules && typeof body.demo_questionnaire_modules === "object" && !Array.isArray(body.demo_questionnaire_modules)) {
    effectiveQuestionnaireModules = normalizeQuestionnaireModules({ ...featureState.questionnaire_modules, ...body.demo_questionnaire_modules });
  }

  if (effectiveFeatureFlags.previsit_questionnaire !== true) {
    return featureDisabledResponse("previsit_questionnaire", "この動物病院ではWEB問診を使用していません。");
  }

  const guardianId = cleanString(body.guardian_id);
  const petId = cleanString(body.pet_id);
  if (!petId) return errorResponse("問診対象のペットを選択してください。", 400);
  let dbContext;
  try { dbContext = await resolveQuestionnaireDbContext(env, clinic, clinicCode, body); }
  catch (error) { return errorResponse(error?.message || "問診対象のペット情報を確認できません。", 400); }

  const questionnaireType = cleanString(body.questionnaire_type || body.category || "general").toLowerCase();
  const modules = effectiveQuestionnaireModules;
  if (!Object.prototype.hasOwnProperty.call(modules, questionnaireType)) {
    return errorResponse("問診カテゴリが正しくありません。", 400);
  }
  if (modules[questionnaireType] !== true) {
    return featureDisabledResponse(`questionnaire_module:${questionnaireType}`, "この問診カテゴリは病院設定で使用しない設定になっています。");
  }

  const requestedImages = Array.isArray(body.images) ? body.images.filter(Boolean) : [];
  if (requestedImages.length > QUESTIONNAIRE_IMAGE_MAX_COUNT) {
    return errorResponse(`症状画像は最大${QUESTIONNAIRE_IMAGE_MAX_COUNT}枚までです。`, 400);
  }
  if (requestedImages.length && effectiveFeatureFlags.questionnaire_images !== true) {
    return featureDisabledResponse("questionnaire_images", "この動物病院ではWEB問診の症状画像添付を使用していません。");
  }

  let parsedImages = [];
  let directImageMeta = [];
  try {
    requestedImages.forEach((image, index) => {
      const direct = normalizeDirectQuestionnaireImageMeta(image, clinicCode, petId, index);
      if (direct) directImageMeta.push(direct);
      else parsedImages.push(parseQuestionnaireImagePayload(image, index));
    });
  } catch (error) {
    return errorResponse(error?.message || "症状画像を確認できませんでした。", 400, {
      max_count: QUESTIONNAIRE_IMAGE_MAX_COUNT,
      max_bytes: QUESTIONNAIRE_IMAGE_MAX_BYTES,
      allowed_mime_types: QUESTIONNAIRE_IMAGE_ALLOWED_MIME_TYPES
    });
  }

  const requestedBranching = toBool(body.branching_used, false);
  const branchingUsed = requestedBranching && effectiveFeatureFlags.questionnaire_branching === true;
  const answers = body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
    ? { ...body.answers }
    : {};
  const branchContext = branchingUsed && body.branch_context && typeof body.branch_context === "object" && !Array.isArray(body.branch_context)
    ? { ...body.branch_context }
    : {};

  const nowIso = new Date().toISOString();
  answers.image_count = directImageMeta.length + parsedImages.length;
  answers.images = [...directImageMeta];
  answers.pet_name = cleanString(body.pet_name || answers.pet_name || dbContext?.pet_name || "");
  answers.guardian_name = cleanString(body.guardian_name || answers.guardian_name || "");
  answers.pet_ref = petId;
  answers.guardian_ref = guardianId || null;
  branchContext.pet_name = cleanString(body.pet_name || branchContext.pet_name || "");
  branchContext.guardian_name = cleanString(body.guardian_name || branchContext.guardian_name || "");

  const payload = {
    clinic_id: clinic.id,
    guardian_id: dbContext?.guardian_id || null,
    pet_id: dbContext?.pet_id || null,
    visit_date: nullIfEmpty(body.visit_date),
    visit_time: normalizeTime(body.visit_time),
    symptoms: body.symptoms && typeof body.symptoms === "object" ? body.symptoms : {},
    appetite: nullIfEmpty(body.appetite),
    energy: nullIfEmpty(body.energy),
    vomiting: nullIfEmpty(body.vomiting),
    diarrhea: nullIfEmpty(body.diarrhea),
    since_when: nullIfEmpty(body.since_when),
    free_text: nullIfEmpty(body.free_text || body.memo),
    emergency_confirmed: toBool(body.emergency_confirmed, false),
    status: "submitted",
    questionnaire_type: questionnaireType,
    source: cleanString(body.source || "line"),
    appointment_id: isUuidLike(body.appointment_id) ? cleanString(body.appointment_id) : null,
    waiting_entry_id: isUuidLike(body.waiting_entry_id) ? cleanString(body.waiting_entry_id) : null,
    answers,
    branch_context: branchContext,
    branching_used: branchingUsed,
    questionnaire_version: WEB_QUESTIONNAIRE_VERSION,
    submitted_at: nowIso,
    updated_at: nowIso
  };

  let questionnaire = null;
  let imageMeta = [...directImageMeta];
  try {
    const inserted = await insertRows(env, TABLES.questionnaires, payload);
    questionnaire = inserted?.[0] || inserted;
    if (!questionnaire?.id) throw new Error("問診IDを発行できませんでした。");

    if (parsedImages.length) {
      const legacyUploaded = await uploadQuestionnaireImages(env, clinicCode, petId, questionnaire.id, parsedImages);
      imageMeta = [...directImageMeta, ...legacyUploaded];
    }
    if (imageMeta.length) {
      const updatedAnswers = { ...answers, images: imageMeta, image_count: imageMeta.length };
      const updatedRows = await updateRows(env, TABLES.questionnaires, { id: `eq.${questionnaire.id}`, clinic_id: `eq.${clinic.id}` }, {
        answers: updatedAnswers,
        updated_at: new Date().toISOString()
      });
      questionnaire = updatedRows?.[0] || questionnaire;
    }
  } catch (error) {
    for (const item of imageMeta) {
      try { await supabaseStorageDeleteObject(env, QUESTIONNAIRE_IMAGE_BUCKET, item.storage_path); } catch {}
    }
    if (questionnaire?.id) {
      try { await deleteRows(env, TABLES.questionnaires, { id: `eq.${questionnaire.id}`, clinic_id: `eq.${clinic.id}` }); } catch {}
    }
    return errorResponse(error?.message || "WEB問診を保存できませんでした。", 400, {
      route: "web_questionnaire_submit",
      questionnaire_image_bucket: QUESTIONNAIRE_IMAGE_BUCKET
    });
  }

  const visitLink = await autoLinkSubmittedQuestionnaire(env, clinic, questionnaire, {
    pet_id: dbContext?.pet_id || null,
    guardian_id: dbContext?.guardian_id || null,
    pet_name: dbContext?.pet_name || answers.pet_name || ""
  });
  if (visitLink?.waiting?.row || visitLink?.appointment?.row) {
    const latestRows = await selectRows(env, TABLES.questionnaires, { select:"*", id:`eq.${questionnaire.id}`, clinic_id:`eq.${clinic.id}`, limit:1 }).catch(()=>[]);
    questionnaire = latestRows[0] || questionnaire;
  }

  await logOperation(env, clinic.id, "guardian", cleanString(body.actor_name) || "飼い主LINE",
    "web_questionnaire_submit", "questionnaire", questionnaire?.id || null, {
      pet_id: petId,
      questionnaire_type: questionnaireType,
      branching_used: branchingUsed,
      image_count: imageMeta.length,
      appointment_id: payload.appointment_id,
      waiting_entry_id: payload.waiting_entry_id,
      questionnaire_version: WEB_QUESTIONNAIRE_VERSION
    });

  return jsonResponse({
    ok: true,
    message: imageMeta.length ? `来院前WEB問診を送信しました（画像${imageMeta.length}枚）。` : "来院前WEB問診を送信しました。",
    questionnaire,
    image_count: imageMeta.length,
    feature_switch_version: FEATURE_SWITCH_VERSION,
    web_questionnaire_version: WEB_QUESTIONNAIRE_VERSION,
    branching_used: branchingUsed,
    demo_feature_override_applied: demoOverrideAllowed,
    questionnaire_image_upload_mode: imageMeta.length ? "browser_direct_signed_upload" : "none",
    visit_link: visitLink,
    questionnaire_visit_link_version: QUESTIONNAIRE_VISIT_LINK_VERSION
  });
}


// =========================================================
// Scan / Doctor / Owner handlers
// =========================================================

async function handleScanLookup(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const token = getParam(request, "t") || getParam(request, "token") || getParam(request, "qr_token");
  const cardNo = getParam(request, "card_no", "");

  if (!token && !cardNo) return errorResponse("QR token または card_no が必要です。", 400);

  const clinic = await getClinicByCode(env, clinicCode);

  let card = null;
  if (token) {
    card = await selectSingle(env, TABLES.petCardView, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      qr_token: `eq.${token}`
    });
  } else {
    card = await selectSingle(env, TABLES.petCardView, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      card_no: `eq.${cardNo}`
    });
  }

  if (!card) return errorResponse("ペット診察券が見つかりません。", 404, { scan_result: "not_found" });

  const today = todayJST();
  const existing = await selectSingle(env, TABLES.checkinStatusView, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    pet_id: `eq.${card.pet_id}`,
    checkin_date: `eq.${today}`,
    order: "last_action_at.desc"
  });

  return jsonResponse({
    ok: true,
    scan_result: card.card_enabled ? "found" : "disabled",
    clinic,
    card,
    guardian: extractGuardian(card),
    pet: extractPet(card),
    today_checkin: existing
  });
}

async function handleTodayCheckins(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const date = getParam(request, "date", todayJST());
  const clinic = await getClinicByCode(env, clinicCode);

  const rowsRaw = await selectRows(env, TABLES.checkinStatusView, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    checkin_date: `eq.${date}`,
    order: "checkin_time.asc,last_action_at.asc"
  });
  const rows = await attachPetPhotoFieldsToRows(env, clinic.id, rowsRaw);

  return jsonResponse({
    ok: true,
    clinic,
    date,
    items: rows,
    counts: buildCheckinCounts(rows)
  });
}

function buildCheckinCounts(rows) {
  const counts = { total: rows.length, scheduled: 0, checked_in: 0, examining: 0, completed: 0, cancelled: 0 };
  rows.forEach((row) => {
    const key = row.status || "scheduled";
    if (counts[key] === undefined) counts[key] = 0;
    counts[key] += 1;
  });
  return counts;
}

async function handleCheckIn(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);

  const token = cleanString(body.qr_token || body.token || body.t);
  const petIdBody = cleanString(body.pet_id);
  const cardIdBody = cleanString(body.card_id);

  let card = null;

  if (token) {
    card = await selectSingle(env, TABLES.petCardView, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      qr_token: `eq.${token}`
    });
  } else if (petIdBody) {
    card = await selectSingle(env, TABLES.petCardView, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      pet_id: `eq.${petIdBody}`
    });
  } else if (cardIdBody) {
    card = await selectSingle(env, TABLES.petCardView, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      card_id: `eq.${cardIdBody}`
    });
  }

  if (!card) return errorResponse("受付対象のペット診察券が見つかりません。", 404);
  if (card.card_enabled === false) return errorResponse("この診察券は無効です。", 403);

  const date = cleanString(body.checkin_date || body.date) || todayJST();
  const time = normalizeTime(body.checkin_time || body.time) || normalizeTime(new Date().toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false })) || null;
  const status = cleanString(body.status) || "checked_in";

  let existing = await selectSingle(env, TABLES.checkins, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    pet_id: `eq.${card.pet_id}`,
    checkin_date: `eq.${date}`,
    status: "in.(scheduled,checked_in,examining)"
  });

  let result;
  if (existing) {
    result = await updateRows(env, TABLES.checkins, { id: `eq.${existing.id}` }, {
      status,
      checkin_time: time,
      purpose: nullIfEmpty(body.purpose) || existing.purpose,
      reception_memo: nullIfEmpty(body.reception_memo || body.memo) || existing.reception_memo,
      last_action_at: new Date().toISOString()
    });
  } else {
    result = await insertRows(env, TABLES.checkins, {
      clinic_id: clinic.id,
      guardian_id: card.guardian_id,
      pet_id: card.pet_id,
      card_id: card.card_id,
      checkin_date: date,
      checkin_time: time,
      status,
      purpose: nullIfEmpty(body.purpose) || "QR受付",
      reception_memo: nullIfEmpty(body.reception_memo || body.memo),
      doctor_memo: nullIfEmpty(body.doctor_memo),
      line_follow_copied: false
    });
  }

  await logOperation(env, clinic.id, "staff", cleanString(body.staff_name) || "受付", "check_in", "pet", card.pet_id, {
    card_no: card.card_no,
    pet_name: card.pet_name,
    status
  });

  return jsonResponse({
    ok: true,
    message: "受付しました。",
    clinic,
    checkin: result?.[0] || result,
    card
  });
}

async function handleCheckInCancel(request, env) {
  const body = await readJson(request);
  const checkinId = cleanString(body.checkin_id || body.id);
  if (!checkinId) return errorResponse("checkin_id が必要です。", 400);

  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);

  const result = await updateRows(env, TABLES.checkins, { id: `eq.${checkinId}`, clinic_id: `eq.${clinic.id}` }, {
    status: "cancelled",
    last_action_at: new Date().toISOString(),
    reception_memo: nullIfEmpty(body.memo || body.reception_memo)
  });

  await logOperation(env, clinic.id, "staff", cleanString(body.staff_name) || "受付", "check_in_cancel", "checkin", checkinId, {
    memo: cleanString(body.memo)
  });

  return jsonResponse({ ok: true, message: "受付を取り消しました。", checkin: result?.[0] || result });
}

async function updateCheckinStatus(request, env, nextStatus, defaultMessage) {
  const body = await readJson(request);
  const checkinId = cleanString(body.checkin_id || body.id);
  if (!checkinId) return errorResponse("checkin_id が必要です。", 400);

  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);

  const payload = {
    status: nextStatus,
    last_action_at: new Date().toISOString()
  };

  if (body.doctor_memo !== undefined || body.memo !== undefined) {
    payload.doctor_memo = nullIfEmpty(body.doctor_memo || body.memo);
  }

  const result = await updateRows(env, TABLES.checkins, { id: `eq.${checkinId}`, clinic_id: `eq.${clinic.id}` }, payload);

  await logOperation(env, clinic.id, "doctor", cleanString(body.staff_name) || "獣医師", nextStatus, "checkin", checkinId, {
    memo: cleanString(body.doctor_memo || body.memo)
  });

  return jsonResponse({ ok: true, message: defaultMessage, checkin: result?.[0] || result });
}

async function handleExamStart(request, env) {
  return updateCheckinStatus(request, env, "examining", "診察開始にしました。");
}

async function handleExamComplete(request, env) {
  const body = await readJson(request);
  const checkinId = cleanString(body.checkin_id || body.id);
  if (!checkinId) return errorResponse("checkin_id が必要です。", 400);

  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);

  const existing = await selectSingle(env, TABLES.checkins, {
    select: "*",
    id: `eq.${checkinId}`,
    clinic_id: `eq.${clinic.id}`
  });
  if (!existing) return errorResponse("受付データが見つかりません。", 404);

  // STEP VET-52.5O:
  // 先生の「診察済みにする」は、会計完了ではなく受付側の会計待ちへ進める。
  // 完了は受付スタッフが会計後に押す。
  const nextStatus = normalizeQueueStatus(body.next_status || "accounting", "accounting");
  const safeNextStatus = nextStatus === "completed" ? "accounting" : nextStatus;

  const updated = await updateRows(env, TABLES.checkins, { id: `eq.${checkinId}`, clinic_id: `eq.${clinic.id}` }, {
    status: safeNextStatus,
    doctor_memo: nullIfEmpty(body.doctor_memo || body.memo) || existing.doctor_memo,
    last_action_at: new Date().toISOString()
  });

  if (toBool(body.create_visit, true)) {
    await insertRows(env, TABLES.visits, {
      clinic_id: clinic.id,
      guardian_id: existing.guardian_id,
      pet_id: existing.pet_id,
      visited_on: existing.checkin_date || todayJST(),
      visit_type: cleanString(body.visit_type) || "consultation",
      chief_complaint: nullIfEmpty(existing.purpose),
      visit_note: nullIfEmpty(body.visit_note || body.doctor_memo || existing.doctor_memo),
      next_visit_date: nullIfEmpty(body.next_visit_date),
      next_visit_time: normalizeTime(body.next_visit_time),
      next_visit_memo: nullIfEmpty(body.next_visit_memo),
      vet_staff_name: nullIfEmpty(body.staff_name),
      status: "completed"
    });
  }

  await logOperation(env, clinic.id, "doctor", cleanString(body.staff_name) || "獣医師", "exam_to_accounting", "checkin", checkinId, {
    create_visit: toBool(body.create_visit, true),
    next_status: safeNextStatus
  });

  return jsonResponse({ ok: true, message: "診察済みにしました。受付側では会計待ちに表示されます。", checkin: updated?.[0] || updated });
}

async function handleDoctorMemoSave(request, env) {
  const body = await readJson(request);
  const checkinId = cleanString(body.checkin_id || body.id);
  if (!checkinId) return errorResponse("checkin_id が必要です。", 400);

  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);

  const updated = await updateRows(env, TABLES.checkins, { id: `eq.${checkinId}`, clinic_id: `eq.${clinic.id}` }, {
    doctor_memo: nullIfEmpty(body.doctor_memo || body.memo),
    last_action_at: new Date().toISOString()
  });

  return jsonResponse({ ok: true, message: "獣医師メモを保存しました。", checkin: updated?.[0] || updated });
}

async function handleLineFollowCopied(request, env) {
  const body = await readJson(request);
  const checkinId = cleanString(body.checkin_id || body.id);
  if (!checkinId) return errorResponse("checkin_id が必要です。", 400);

  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);

  const updated = await updateRows(env, TABLES.checkins, { id: `eq.${checkinId}`, clinic_id: `eq.${clinic.id}` }, {
    line_follow_copied: true,
    last_action_at: new Date().toISOString()
  });

  await logOperation(env, clinic.id, "doctor", cleanString(body.staff_name) || "獣医師", "line_follow_copied", "checkin", checkinId, {});

  return jsonResponse({ ok: true, message: "LINEフォロー文面をコピー済みにしました。", checkin: updated?.[0] || updated });
}

async function handleOwnerToday(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const date = getParam(request, "date", todayJST());
  const clinic = await getClinicByCode(env, clinicCode);

  const summary = await selectSingle(env, TABLES.ownerTodaySummaryView, {
    select: "*",
    clinic_id: `eq.${clinic.id}`
  });

  const checkinsRaw = await selectRows(env, TABLES.checkinStatusView, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    checkin_date: `eq.${date}`,
    order: "checkin_time.asc,last_action_at.asc"
  });
  const checkins = await attachPetPhotoFieldsToRows(env, clinic.id, checkinsRaw);

  const prevention_todos = await selectRows(env, TABLES.preventionTodosView, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    order: "due_date.asc",
    limit: 30
  });

  const followup_todos = await selectRows(env, TABLES.followupTodosView, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    order: "due_date.asc",
    limit: 30
  });

  const line_unlinked_guardians = await selectRows(env, TABLES.guardians, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    status: "eq.active",
    line_link_status: "neq.linked",
    order: "created_at.desc",
    limit: 30
  });

  const queueEntriesRaw = await selectRows(env, TABLES.waitingEntriesDetailView, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    target_date: `eq.${date}`,
    order: "day_part.asc,queue_number.asc,last_action_at.asc",
    limit: 120
  });
  const queue_entries = await attachPetPhotoFieldsToRows(env, clinic.id, queueEntriesRaw);

  const queue_summary = await selectRows(env, TABLES.queueSummaryView, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    target_date: `eq.${date}`,
    order: "day_part.asc"
  });

  return jsonResponse({
    ok: true,
    clinic,
    date,
    summary,
    checkins,
    checkin_counts: buildCheckinCounts(checkins),
    queue_entries,
    queue_summary,
    prevention_todos,
    followup_todos,
    line_unlinked_guardians
  });
}

async function handlePreventionTodos(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const clinic = await getClinicByCode(env, clinicCode);
  const rows = await selectRows(env, TABLES.preventionTodosView, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    order: "due_date.asc",
    limit: normalizeLimit(getParam(request, "limit", "100"), 100, 300)
  });
  return jsonResponse({ ok: true, clinic, items: rows });
}

async function handleFollowupTodos(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const clinic = await getClinicByCode(env, clinicCode);
  const rows = await selectRows(env, TABLES.followupTodosView, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    order: "due_date.asc",
    limit: normalizeLimit(getParam(request, "limit", "100"), 100, 300)
  });
  return jsonResponse({ ok: true, clinic, items: rows });
}

async function handleLineUnlinkedGuardians(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const clinic = await getClinicByCode(env, clinicCode);
  const rows = await selectRows(env, TABLES.guardians, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    status: "eq.active",
    line_link_status: "neq.linked",
    order: "created_at.desc",
    limit: normalizeLimit(getParam(request, "limit", "100"), 100, 300)
  });
  return jsonResponse({ ok: true, clinic, items: rows });
}



// =========================================================
// STEP VET-15 Queue / Priority reservation / Congestion handlers
// =========================================================

function normalizeQueueDate(value) {
  const text = cleanString(value);
  if (!text) return todayJST();
  parseDateText(text);
  return text;
}

function normalizeQueueDayPart(value, fallback = "morning") {
  const text = cleanString(value || fallback);
  if (["morning", "afternoon", "full_day"].includes(text)) return text;
  return fallback;
}

function normalizeQueueEntryKind(value) {
  const text = cleanString(value || "today_queue");
  if (["today_queue", "priority_reservation", "medicine_prevention", "care_consult", "grooming_surgery_consult"].includes(text)) return text;
  return "today_queue";
}

function normalizeQueueRequestCategory(value) {
  const text = cleanString(value || "general_exam");
  if ([
    "general_exam",
    "recheck",
    "vaccination",
    "prevention_medicine",
    "medicine_food",
    "hygiene_care",
    "health_check",
    "grooming",
    "surgery",
    "other"
  ].includes(text)) return text;
  return "general_exam";
}

function normalizeQueueStatus(value, fallback = "waiting") {
  const text = cleanString(value || fallback);

  // STEP VET-46:
  // 実際の動物病院の受付導線に合わせて「会計待ち」を追加。
  // 画面側や将来APIから別名が来ても accounting に寄せる。
  if (["accounting", "payment_waiting", "checkout_waiting", "billing", "kaikei"].includes(text)) return "accounting";

  if ([
    "reserved",
    "waiting",
    "checked_in",
    "examining",
    "accounting",
    "completed",
    "cancelled",
    "canceled",
    "no_show",
    "noshow"
  ].includes(text)) return text;

  return fallback;
}

function queueStatusLabelForWorker(status) {
  const text = normalizeQueueStatus(status, "waiting");
  const map = {
    reserved: "電話受付・来院予定",
    waiting: "来院待ち",
    checked_in: "院内受付済み",
    examining: "診察中",
    accounting: "会計待ち",
    completed: "完了",
    cancelled: "取消",
    canceled: "取消",
    no_show: "不在",
    noshow: "不在"
  };
  return map[text] || text || "-";
}

function normalizeManualCongestionLevel(value) {
  const text = cleanString(value || "auto");
  if (["auto", "quiet", "moderate", "crowded", "reception_closed", "emergency", "closed"].includes(text)) return text;
  return "auto";
}

async function getQueueSettings(env, clinicId) {
  let settings = await selectSingle(env, TABLES.queueSettings, {
    select: "*",
    clinic_id: `eq.${clinicId}`
  });

  if (!settings) {
    const inserted = await insertRows(env, TABLES.queueSettings, { clinic_id: clinicId });
    settings = Array.isArray(inserted) ? inserted[0] : inserted;
  }

  return settings;
}

async function getQueueSummaryRows(env, clinicId, date, dayPart = "") {
  const query = {
    select: "*",
    clinic_id: `eq.${clinicId}`,
    target_date: `eq.${date}`,
    order: "day_part.asc"
  };

  if (dayPart && dayPart !== "all") query.day_part = `eq.${dayPart}`;
  return selectRows(env, TABLES.queueSummaryView, query);
}

async function getQueueEntriesRows(env, clinicId, options = {}) {
  const date = options.date || todayJST();
  const dayPart = options.day_part || "";
  const status = options.status || "";
  const entryKind = options.entry_kind || "";
  const requestCategory = options.request_category || "";
  const limit = options.limit || 120;

  const query = {
    select: "*",
    clinic_id: `eq.${clinicId}`,
    target_date: `eq.${date}`,
    order: "day_part.asc,queue_number.asc,last_action_at.asc",
    limit
  };

  if (dayPart && dayPart !== "all") query.day_part = `eq.${dayPart}`;
  if (status && status !== "all") query.status = `eq.${status}`;
  if (entryKind && entryKind !== "all") query.entry_kind = `eq.${entryKind}`;
  if (requestCategory && requestCategory !== "all") query.request_category = `eq.${requestCategory}`;

  return selectRows(env, TABLES.waitingEntriesDetailView, query);
}

function buildEmptyQueueSummary(clinic, date, dayPart = "full_day") {
  return {
    clinic_id: clinic.id,
    clinic_code: clinic.clinic_code,
    clinic_name: clinic.clinic_name,
    display_name: clinic.display_name,
    timezone: clinic.timezone || "Asia/Tokyo",
    target_date: date,
    day_part: dayPart,
    general_exam_count: 0,
    medicine_prevention_count: 0,
    care_count: 0,
    grooming_surgery_count: 0,
    priority_reservation_count: 0,
    active_total_count: 0,
    waiting_general_exam_count: 0,
    current_exam_number: 0,
    manual_override: false,
    manual_level: "auto",
    manual_message: null,
    reception_closed: false,
    closed_reason: null,
    display_level: "quiet",
    display_level_label: "空いています",
    display_message: "比較的落ち着いています。"
  };
}

async function handleQueueSettingsGet(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const clinic = await getClinicByCode(env, clinicCode);
  const settings = await getQueueSettings(env, clinic.id);
  return jsonResponse({ ok: true, clinic, settings });
}

async function handleQueueSettingsSave(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);

  const allowed = [
    "same_day_queue_enabled",
    "same_day_morning_start",
    "same_day_morning_end",
    "same_day_afternoon_start",
    "same_day_afternoon_end",
    "same_day_morning_capacity",
    "same_day_afternoon_capacity",
    "priority_reservation_enabled",
    "priority_future_days",
    "priority_morning_capacity",
    "priority_afternoon_capacity",
    "medicine_prevention_enabled",
    "medicine_prevention_daily_capacity",
    "congestion_public_enabled",
    "auto_congestion_moderate_threshold",
    "auto_congestion_crowded_threshold",
    "public_note",
    "priority_note",
    "medicine_note"
  ];

  const payload = { clinic_id: clinic.id };
  allowed.forEach((key) => {
    if (body[key] !== undefined) payload[key] = body[key];
  });

  const rows = await upsertRows(env, TABLES.queueSettings, payload, "clinic_id");
  const settings = rows?.[0] || rows;
  await logOperation(env, clinic.id, "admin", cleanString(body.staff_name) || "管理者", "queue_settings_save", "queue_settings", settings?.id || clinic.id, payload);

  return jsonResponse({ ok: true, message: "順番受付設定を保存しました。", clinic, settings });
}

async function handleQueueSummaryGet(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const clinic = await getClinicByCode(env, clinicCode);
  const date = normalizeQueueDate(getParam(request, "date", todayJST()));
  const dayPart = cleanString(getParam(request, "day_part", ""));

  const settings = await getQueueSettings(env, clinic.id);
  const rows = await getQueueSummaryRows(env, clinic.id, date, dayPart);
  const items = rows.length ? rows : [buildEmptyQueueSummary(clinic, date, dayPart || "full_day")];

  return jsonResponse({
    ok: true,
    clinic,
    date,
    day_part: dayPart || "all",
    settings,
    summary: items[0],
    items
  });
}

async function handleQueueEntriesGet(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const clinic = await getClinicByCode(env, clinicCode);
  const date = normalizeQueueDate(getParam(request, "date", todayJST()));
  const dayPart = cleanString(getParam(request, "day_part", ""));
  const status = cleanString(getParam(request, "status", ""));
  const entryKind = cleanString(getParam(request, "entry_kind", ""));
  const requestCategory = cleanString(getParam(request, "request_category", ""));
  const limit = normalizeLimit(getParam(request, "limit", "120"), 120, 300);

  const itemsRaw = await getQueueEntriesRows(env, clinic.id, {
    date,
    day_part: dayPart,
    status,
    entry_kind: entryKind,
    request_category: requestCategory,
    limit
  });
  const photoItems = await attachPetPhotoFieldsToRows(env, clinic.id, itemsRaw);
  const questionnaireItems = await attachWebQuestionnaireContextToRows(env, clinic, photoItems, "queue");
  const items = questionnaireItems.map((row) => row.has_web_questionnaire ? {
    ...row,
    purpose_raw: row.purpose || null,
    purpose: [cleanString(row.purpose || row.visit_purpose || "通常診療"), "WEB問診あり"].filter(Boolean).join("｜"),
    symptoms_summary_raw: row.symptoms_summary || null,
    symptoms_summary: row.questionnaire_summary || row.symptoms_summary || null
  } : row);

  const summaryRows = await getQueueSummaryRows(env, clinic.id, date, dayPart);

  return jsonResponse({
    ok: true,
    clinic,
    date,
    day_part: dayPart || "all",
    items,
    summary: summaryRows[0] || buildEmptyQueueSummary(clinic, date, dayPart || "full_day"),
    summaries: summaryRows
  });
}


// =========================================================
// STEP VET-36E-R2: 同日同一ペットの二重受付防止
// =========================================================
// R2で強化したこと：
// - VIEWではなく vet_waiting_entries 本体テーブルを直接確認する
// - completed / cancelled / no_show 以外は全部「有効な受付」として扱う
// - 既存重複がある環境でも、これ以上増やさない
// - card_token / card_id / pet_id のどれから来ても pet_id を解決する
// =========================================================

function isFinishedQueueStatus(status) {
  const s = cleanString(status);
  return ["completed", "cancelled", "canceled", "no_show", "noshow"].includes(s);
}

function sanitizeQueueDbId(value) {
  const text = cleanString(value);
  if (!text) return null;
  if (/^demo[_-]/i.test(text)) return null;
  if (/^sample[_-]/i.test(text)) return null;
  return text;
}

function demoPetNameFromQueueBody(body = {}) {
  const direct = cleanString(body.pet_name || body.name || body.pet?.pet_name || body.pet?.name);
  if (direct) return direct;

  const source = cleanString([
    body.pet_id,
    body.card_id,
    body.card_no,
    body.qr_token,
    body.card_token,
    body.token
  ].filter(Boolean).join(" ")).toLowerCase();

  if (source.includes("cocoa")) return "ココアちゃん";
  if (source.includes("hana")) return "ハナちゃん";
  if (source.includes("momo")) return "モモちゃん";
  if (source.includes("check") || source.includes("000005") || source.includes("c175a675")) return "チェックちゃん";
  return "";
}

async function resolveDemoPetAndGuardianForQueue(env, clinic, body = {}) {
  if (!clinic || clinic.clinic_code !== getDemoClinicCode(env)) {
    return { guardianId: null, petId: null, reason: "not_demo_clinic" };
  }

  const petName = demoPetNameFromQueueBody(body);
  let pet = null;

  if (petName) {
    pet = await selectSingle(env, TABLES.pets, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      pet_name: `eq.${petName}`,
      status: "eq.active",
      limit: 1
    }).catch(() => null);

    if (!pet) {
      const detail = await selectSingle(env, TABLES.waitingEntriesDetailView, {
        select: "*",
        clinic_id: `eq.${clinic.id}`,
        pet_name: `eq.${petName}`,
        order: "created_at.desc",
        limit: 1
      }).catch(() => null);

      if (detail?.pet_id) {
        return {
          guardianId: detail.guardian_id || null,
          petId: detail.pet_id || null,
          reason: "demo_waiting_entry_detail_pet_name"
        };
      }
    }
  }

  if (pet) {
    return {
      guardianId: pet.guardian_id || null,
      petId: pet.id || null,
      reason: "demo_pet_name"
    };
  }

  const guardian = await selectSingle(env, TABLES.guardians, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    status: "eq.active",
    order: "created_at.asc",
    limit: 1
  }).catch(() => null);

  if (guardian) {
    const firstPet = await selectSingle(env, TABLES.pets, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      guardian_id: `eq.${guardian.id}`,
      status: "eq.active",
      order: "created_at.asc",
      limit: 1
    }).catch(() => null);

    return {
      guardianId: guardian.id || null,
      petId: firstPet?.id || null,
      reason: "demo_first_active_pet"
    };
  }

  return { guardianId: null, petId: null, reason: "demo_not_resolved" };
}

async function resolvePetAndGuardianForQueue(env, clinic, body, guardianId, petId) {
  let nextGuardianId = sanitizeQueueDbId(guardianId);
  let nextPetId = sanitizeQueueDbId(petId);

  const cardToken = cleanString(
    body.qr_token ||
    body.card_token ||
    body.pet_card_token ||
    body.token ||
    ""
  );

  if ((!nextGuardianId || !nextPetId) && cardToken) {
    const card = await getCardByToken(env, clinic.id, cardToken);
    if (card) {
      nextGuardianId = nextGuardianId || card.guardian_id || card.guardian_id_text || null;
      nextPetId = nextPetId || card.pet_id || card.pet_id_text || null;
    }
  }

  const cardId = cleanString(body.card_id || body.pet_card_id || body.cardId || "");
  if ((!nextGuardianId || !nextPetId) && cardId) {
    const cardById = await selectSingle(env, TABLES.petCards, {
      select: "*",
      id: `eq.${cardId}`,
      clinic_id: `eq.${clinic.id}`
    });
    if (cardById) {
      nextGuardianId = nextGuardianId || cardById.guardian_id || null;
      nextPetId = nextPetId || cardById.pet_id || null;
    }
  }

  return {
    guardianId: nextGuardianId,
    petId: nextPetId,
    cardToken
  };
}

async function findActiveSameDayQueueEntry(env, clinicId, petId, targetDate) {
  if (!clinicId || !petId || !targetDate) return null;

  // まず本体テーブルを直接見る。
  // status が null の古い行も「未完了扱い」にする。
  const directRows = await selectRows(env, TABLES.waitingEntries, {
    select: "*",
    clinic_id: `eq.${clinicId}`,
    pet_id: `eq.${petId}`,
    target_date: `eq.${targetDate}`,
    or: "(status.is.null,status.not.in.(completed,cancelled,canceled,no_show,noshow))",
    order: "queue_number.asc,created_at.asc",
    limit: 1
  });

  const direct = directRows[0] || null;
  if (direct) {
    const detail = await selectSingle(env, TABLES.waitingEntriesDetailView, {
      select: "*",
      waiting_entry_id: `eq.${direct.id}`
    }).catch(() => null);

    return {
      ...(detail || {}),
      ...direct,
      waiting_entry_id: detail?.waiting_entry_id || direct.id,
      id: direct.id
    };
  }

  // 念のためVIEW側も見る。
  // VIEWの status 表現が多少違っても、完了・取消以外を拾う。
  const viewRows = await selectRows(env, TABLES.waitingEntriesDetailView, {
    select: "*",
    clinic_id: `eq.${clinicId}`,
    pet_id: `eq.${petId}`,
    target_date: `eq.${targetDate}`,
    or: "(status.is.null,status.not.in.(completed,cancelled,canceled,no_show,noshow))",
    order: "queue_number.asc,created_at.asc",
    limit: 1
  });

  return viewRows[0] || null;
}

function buildDuplicateQueueMessage(entry) {
  const queueNumber = entry?.queue_number || entry?.display_queue_number || "-";
  const petName = entry?.pet_name ? `${entry.pet_name}ちゃんは` : "";
  return `${petName}すでに本日の受付済みです。受付番号：${queueNumber}`;
}

async function buildDuplicateQueueResponse(env, clinic, existingEntry, targetDate, dayPart, body = {}) {
  const actualDayPart = existingEntry?.day_part || dayPart || "morning";
  const summaryRows = await getQueueSummaryRows(env, clinic.id, targetDate, actualDayPart);
  const message = buildDuplicateQueueMessage(existingEntry);

  await logOperation(
    env,
    clinic.id,
    "member",
    cleanString(body.actor_name || body.staff_name) || "受付",
    "queue_entry_duplicate_blocked",
    "waiting_entry",
    existingEntry?.waiting_entry_id || existingEntry?.id || null,
    {
      pet_id: existingEntry?.pet_id || null,
      target_date: targetDate,
      day_part: actualDayPart,
      queue_number: existingEntry?.queue_number || null
    }
  );

  return jsonResponse({
    ok: true,
    duplicate: true,
    already_registered: true,
    message,
    clinic,
    result: {
      duplicate: true,
      already_registered: true,
      waiting_entry_id: existingEntry?.waiting_entry_id || existingEntry?.id || null,
      queue_number: existingEntry?.queue_number || null,
      status: existingEntry?.status || null,
      message
    },
    entry: {
      ...existingEntry,
      duplicate: true,
      already_registered: true,
      message
    },
    summary: summaryRows[0] || buildEmptyQueueSummary(clinic, targetDate, actualDayPart)
  });
}



// =========================================================
// STEP VET-52.5G: 同日受付番号の重複防止
// 飼い主側 waiting.html からの受付登録で、完了済みや取消済みを含む
// 同日既存受付番号を見て、必ずその日の最大番号+1を使う。
// 目的：受付番号3などが既存受付と重複する事故を防ぐ。
// =========================================================
async function getNextSafeQueueNumberForDay(env, clinicId, targetDate) {
  if (!clinicId || !targetDate) return null;

  const rows = await selectRows(env, TABLES.waitingEntries, {
    select: "id,queue_number,target_date,status,created_at",
    clinic_id: `eq.${clinicId}`,
    target_date: `eq.${targetDate}`,
    order: "created_at.asc",
    limit: 500
  }).catch(() => []);

  // STEP VET-52.5J:
  // 受付番号は「その日の呼び出し番号」です。
  // まれにカード番号・内部番号・壊れたRPC戻り値のような大きすぎる値が
  // queue_number に入ると、次番号が 1800151 のようになってしまうため、
  // 日内受付番号として現実的な 1〜999 の範囲だけを採用します。
  let maxNumber = 0;
  rows.forEach((row) => {
    const n = Number(row?.queue_number || 0);
    if (Number.isFinite(n) && n >= 1 && n <= 999 && n > maxNumber) {
      maxNumber = n;
    }
  });

  return maxNumber + 1;
}

async function forceSafeQueueNumberIfNeeded(env, clinicId, targetDate, waitingEntryId, desiredNumber) {
  if (!waitingEntryId || !desiredNumber) return null;

  const current = await selectSingle(env, TABLES.waitingEntries, {
    select: "*",
    id: `eq.${waitingEntryId}`,
    clinic_id: `eq.${clinicId}`,
    limit: 1
  }).catch(() => null);

  if (!current) return null;

  const currentNumber = Number(current.queue_number || 0);
  const desired = Number(desiredNumber || 0);

  // RPC側がすでに安全な番号を付けている場合も、desired と違えば統一する。
  // desired はRPC実行前の「当日最大+1」なので、同日で重複しにくい。
  if (Number.isFinite(desired) && desired > 0 && currentNumber !== desired) {
    const updated = await updateRows(env, TABLES.waitingEntries, {
      id: `eq.${waitingEntryId}`,
      clinic_id: `eq.${clinicId}`
    }, {
      queue_number: desired
    }).catch(() => null);

    const updatedRow = Array.isArray(updated) ? updated[0] : updated;
    return updatedRow || { ...current, queue_number: desired };
  }

  return current;
}


async function linkUniqueSameDayExactAppointmentToQueue(env, clinic, petId, targetDate, waitingEntryId, actorName = "受付PC") {
  const normalizedPetId = cleanString(petId);
  const normalizedWaitingEntryId = cleanString(waitingEntryId);
  const normalizedDate = cleanString(targetDate);
  if (!normalizedPetId || !normalizedWaitingEntryId) {
    return { ok: true, linked: false, skipped: true, reason: "missing_pet_or_waiting_entry" };
  }
  if (normalizedDate !== todayJST()) {
    return { ok: true, linked: false, skipped: true, reason: "not_today" };
  }

  let rows = [];
  try {
    rows = await selectRows(env, TABLES.exactAppointments, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      pet_id: `eq.${normalizedPetId}`,
      appointment_date: `eq.${normalizedDate}`,
      status: "in.(scheduled,confirmed,checked_in)",
      order: "start_time.asc",
      limit: 10
    });
  } catch (error) {
    return {
      ok: false,
      linked: false,
      skipped: true,
      reason: "exact_appointment_query_failed",
      error: error?.message || "query failed"
    };
  }

  const candidates = (rows || []).filter(Boolean);
  if (!candidates.length) {
    return { ok: true, linked: false, skipped: true, reason: "no_same_day_appointment" };
  }

  if (candidates.length > 1) {
    return {
      ok: true,
      linked: false,
      skipped: true,
      reason: "multiple_same_day_appointments",
      candidate_count: candidates.length,
      candidates: candidates.map((row) => ({
        id: row.id,
        appointment_no: row.appointment_no,
        start_time: row.start_time,
        status: row.status,
        waiting_entry_id: row.waiting_entry_id || null
      }))
    };
  }

  const appointment = candidates[0];
  const currentWaitingEntryId = cleanString(appointment.waiting_entry_id);
  if (currentWaitingEntryId && currentWaitingEntryId !== normalizedWaitingEntryId) {
    return {
      ok: true,
      linked: false,
      skipped: true,
      reason: "appointment_already_linked_elsewhere",
      appointment_id: appointment.id,
      waiting_entry_id: currentWaitingEntryId
    };
  }

  if (currentWaitingEntryId === normalizedWaitingEntryId && appointment.status === "checked_in") {
    return {
      ok: true,
      linked: true,
      skipped: true,
      reason: "already_linked",
      appointment_id: appointment.id,
      waiting_entry_id: normalizedWaitingEntryId
    };
  }

  try {
    if (appointment.status !== "checked_in") {
      await supabaseRpc(env, "vet_update_exact_appointment_status", {
        p_appointment_id: appointment.id,
        p_new_status: "checked_in",
        p_actor_type: "system",
        p_actor_name: actorName,
        p_reason: "受付PC・QR受付から日時指定予約を自動紐付け"
      });
    }

    await updateRows(env, TABLES.exactAppointments, {
      id: `eq.${appointment.id}`,
      clinic_id: `eq.${clinic.id}`
    }, {
      waiting_entry_id: normalizedWaitingEntryId,
      queue_linked_at: new Date().toISOString()
    });

    await logOperation(
      env,
      clinic.id,
      "system",
      actorName,
      "exact_appointment_auto_link_from_queue",
      "exact_appointment",
      appointment.id,
      {
        waiting_entry_id: normalizedWaitingEntryId,
        appointment_no: appointment.appointment_no || null,
        start_time: appointment.start_time || null,
        feature_version: QR_APPOINTMENT_LINK_FEATURE_VERSION
      }
    );

    return {
      ok: true,
      linked: true,
      skipped: false,
      appointment_id: appointment.id,
      appointment_no: appointment.appointment_no || null,
      start_time: appointment.start_time || null,
      waiting_entry_id: normalizedWaitingEntryId
    };
  } catch (error) {
    return {
      ok: false,
      linked: false,
      skipped: false,
      reason: "link_failed",
      appointment_id: appointment.id,
      error: error?.message || "link failed"
    };
  }
}

async function handleQueueEntryCreate(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const requestPath = normalizePath(new URL(request.url).pathname);
  const adminMode = requestPath.startsWith("/api/admin/") || requestPath.startsWith("/api/owner/");
  const source = normalizeIntegratedBookingSource(body.source, adminMode ? "staff" : "line", adminMode);

  let guardianId = sanitizeQueueDbId(body.guardian_id);
  let petId = sanitizeQueueDbId(body.pet_id);

  const resolvedQueueIds = await resolvePetAndGuardianForQueue(env, clinic, body, guardianId, petId);
  guardianId = sanitizeQueueDbId(resolvedQueueIds.guardianId);
  petId = sanitizeQueueDbId(resolvedQueueIds.petId);

  if ((!guardianId || !petId) && clinicCode === getDemoClinicCode(env)) {
    const demoResolved = await resolveDemoPetAndGuardianForQueue(env, clinic, body);
    guardianId = guardianId || sanitizeQueueDbId(demoResolved.guardianId);
    petId = petId || sanitizeQueueDbId(demoResolved.petId);
  }

  if (!guardianId && toBool(body.demo, false)) {
    const guardian = await selectSingle(env, TABLES.guardians, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      status: "eq.active",
      order: "created_at.asc"
    });
    guardianId = guardian?.id || null;
  }

  if (!petId && guardianId) {
    const pet = await selectSingle(env, TABLES.pets, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      guardian_id: `eq.${guardianId}`,
      status: "eq.active",
      order: "created_at.asc"
    });
    petId = pet?.id || null;
  }

  const entryKind = normalizeQueueEntryKind(body.entry_kind || body.kind);
  const requestCategory = normalizeQueueRequestCategory(body.request_category || body.category);
  const targetDate = normalizeQueueDate(body.target_date || body.date || todayJST());
  const dayPart = normalizeQueueDayPart(body.day_part || body.session, entryKind === "priority_reservation" ? "morning" : "morning");

  const queueFeatureState = await getClinicFeatureState(env, clinicCode);
  if (queueFeatureState.feature_flags.reception_queue !== true) {
    return featureDisabledResponse("reception_queue", "この動物病院では当日順番受付を使用していません。");
  }
  const queueFeatureByKind = {
    today_queue: "reception_general",
    medicine_prevention: "reception_medicine_prevention",
    care_consult: "reception_care"
  };
  const queueFeatureKey = queueFeatureByKind[entryKind] || "";
  if (queueFeatureKey && queueFeatureState.feature_flags[queueFeatureKey] !== true) {
    return featureDisabledResponse(queueFeatureKey, "この受付種別は病院設定で使用しない設定になっています。");
  }

  // STEP VET-36E-R2:
  // 同じペットが同じ日に、完了・取消以外の受付をすでに持っている場合は、
  // 新しい受付番号を発行しない。
  if (!petId) {
    return errorResponse("pet_id を特定できませんでした。診察券QRを確認してください。", 400);
  }

  const existingActiveEntry = await findActiveSameDayQueueEntry(env, clinic.id, petId, targetDate);
  if (existingActiveEntry) {
    const existingWaitingEntryId = cleanString(existingActiveEntry.waiting_entry_id || existingActiveEntry.id);
    if (existingWaitingEntryId) {
      const existingExactLink = await linkUniqueSameDayExactAppointmentToQueue(
        env,
        clinic,
        petId,
        targetDate,
        existingWaitingEntryId,
        cleanString(body.actor_name || body.staff_name) || "受付PC"
      );
      await linkRecentQuestionnaireToWaitingEntry(env, clinic, {
        waiting_entry_id: existingWaitingEntryId, pet_id: petId, pet_name: existingActiveEntry.pet_name || demoPetNameFromQueueBody(body),
        target_date: targetDate, actor_name: cleanString(body.actor_name || body.staff_name) || "受付PC"
      });
      if (existingExactLink?.appointment_id) {
        await linkRecentQuestionnaireToAppointment(env, clinic, {
          appointment_id: existingExactLink.appointment_id, pet_id: petId, pet_name: existingActiveEntry.pet_name || demoPetNameFromQueueBody(body),
          appointment_date: targetDate, actor_name: cleanString(body.actor_name || body.staff_name) || "受付PC"
        });
      }
    }
    return buildDuplicateQueueResponse(env, clinic, existingActiveEntry, targetDate, existingActiveEntry.day_part || dayPart, body);
  }

  const questionnaire = body.questionnaire && typeof body.questionnaire === "object"
    ? body.questionnaire
    : {
        purpose: body.purpose || null,
        onset_note: body.onset_note || null,
        appetite: body.appetite || null,
        energy_level: body.energy_level || null,
        vomiting_note: body.vomiting_note || null,
        diarrhea_note: body.diarrhea_note || null,
        cough_note: body.cough_note || null,
        skin_note: body.skin_note || null,
        injury_note: body.injury_note || null,
        medication_note: body.medication_note || null,
        photo_note: body.photo_note || null,
        free_text: body.free_text || body.questionnaire_free_text || null,
        emergency_flag: Boolean(body.emergency_flag)
      };

  // STEP VET-52.5G:
  // 完了・取消を含めて、その日の最大受付番号+1を先に確保する。
  // Supabase RPC側が有効受付数ベースで番号を付けても、後段でこの番号へ補正する。
  const safeQueueNumber = await getNextSafeQueueNumberForDay(env, clinic.id, targetDate);

  const rpcRows = await supabaseRpc(env, "vet_create_waiting_entry", {
    p_clinic_code: clinic.clinic_code,
    p_guardian_id: guardianId,
    p_pet_id: petId,
    p_entry_kind: entryKind,
    p_request_category: requestCategory,
    p_target_date: targetDate,
    p_day_part: dayPart,
    p_purpose: nullIfEmpty(body.purpose),
    p_symptoms_summary: nullIfEmpty(body.symptoms_summary || body.symptoms),
    p_desired_contact: cleanString(body.desired_contact || "line") || "line",
    p_questionnaire: questionnaire,
    // INTEGRATED-2: LINE / WEB / phone / counter / staff を共通受付へ保持する。
    // source は本人確認とは独立した流入チャネルで、認証ガードは既存経路のまま維持する。
    p_source: source
  });

  const created = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
  const waitingEntryId = created?.waiting_entry_id;

  // STEP VET-52.5G:
  // RPC実行後に番号を補正してから、detail viewを読み直す。
  const safeNumberRow = waitingEntryId
    ? await forceSafeQueueNumberIfNeeded(env, clinic.id, targetDate, waitingEntryId, safeQueueNumber)
    : null;

  const detail = waitingEntryId ? await selectSingle(env, TABLES.waitingEntriesDetailView, {
    select: "*",
    waiting_entry_id: `eq.${waitingEntryId}`
  }) : null;

  const exactAppointmentLink = waitingEntryId
    ? await linkUniqueSameDayExactAppointmentToQueue(
        env,
        clinic,
        petId,
        targetDate,
        waitingEntryId,
        cleanString(body.actor_name || body.staff_name) || "受付PC"
      )
    : { ok: true, linked: false, skipped: true, reason: "waiting_entry_id_missing" };

  const questionnaireWaitingLink = waitingEntryId ? await linkRecentQuestionnaireToWaitingEntry(env, clinic, {
    waiting_entry_id: waitingEntryId, pet_id: petId, pet_name: detail?.pet_name || demoPetNameFromQueueBody(body),
    target_date: targetDate, actor_name: cleanString(body.actor_name || body.staff_name) || "受付PC"
  }) : {ok:true,linked:false,skipped:true,reason:"waiting_entry_id_missing"};
  const questionnaireAppointmentLink = exactAppointmentLink?.appointment_id ? await linkRecentQuestionnaireToAppointment(env, clinic, {
    appointment_id: exactAppointmentLink.appointment_id, pet_id: petId, pet_name: detail?.pet_name || demoPetNameFromQueueBody(body),
    appointment_date: targetDate, actor_name: cleanString(body.actor_name || body.staff_name) || "受付PC"
  }) : {ok:true,linked:false,skipped:true,reason:"appointment_not_linked"};
  const questionnaireLink = { waiting: questionnaireWaitingLink, appointment: questionnaireAppointmentLink };

  const summaryRows = await getQueueSummaryRows(env, clinic.id, targetDate, dayPart);
  const actorType = adminMode ? "staff" : "member";
  const actorName = cleanString(body.actor_name || body.staff_name) || (adminMode ? "管理画面" : "飼い主");
  await logOperation(env, clinic.id, actorType, actorName, "queue_entry_create", "waiting_entry", waitingEntryId, { entryKind, requestCategory, targetDate, dayPart, source });

  return jsonResponse({
    ok: true,
    message: created?.message || "受付を登録しました。",
    source,
    clinic,
    result: {
      ...(created || {}),
      queue_number: detail?.queue_number || safeNumberRow?.queue_number || created?.queue_number || safeQueueNumber,
      safe_queue_number_applied: Boolean(safeNumberRow && safeQueueNumber)
    },
    entry: detail,
    queue_number: detail?.queue_number || safeNumberRow?.queue_number || created?.queue_number || safeQueueNumber,
    exact_appointment_link: exactAppointmentLink,
    questionnaire_link: questionnaireLink,
    questionnaire_visit_link_version: QUESTIONNAIRE_VISIT_LINK_VERSION,
    summary: summaryRows[0] || buildEmptyQueueSummary(clinic, targetDate, dayPart)
  });
}








const CSV_IMPORT_CONFIRM_TEXT = "既存患者CSV取込を実行";

async function handlePatientCsvImportPreview(request, env) {
  // STEP VET-50:
  // CSV一括取込の事前チェック。
  // このAPIはDBを更新しない。重複・エラー・警告だけ返す。
  try {
    const body = await readJson(request);
    const clinicCode = getRequestedClinicCode(request, body);
    const clinic = await getClinicByCode(env, clinicCode);
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const sourceFilename = cleanString(body.source_filename || body.filename || "patients.csv");

    if (!rows.length) {
      return errorResponse("CSVデータがありません。", 400, {
        route: "step_vet_50_csv_import_preview"
      });
    }

    const review = await buildPatientCsvImportReview(env, clinic, rows, {
      source_filename: sourceFilename
    });

    return jsonResponse({
      ok: true,
      route: "step_vet_50_csv_import_preview",
      worker_version: WORKER_VERSION,
      clinic,
      source_filename: sourceFilename,
      summary: review.summary,
      rows: review.rows,
      duplicate_candidates: review.duplicate_candidates,
      confirm_text_required: CSV_IMPORT_CONFIRM_TEXT,
      note: "事前チェックのみです。DBにはまだ登録していません。"
    });
  } catch (error) {
    return errorResponse(error?.message || "CSV取込プレビューに失敗しました。", 500, {
      route: "step_vet_50_csv_import_preview",
      worker_version: WORKER_VERSION,
      error_name: error && error.name ? error.name : "",
      error_stack_head: error && error.stack ? String(error.stack).split("\n").slice(0, 3).join("\n") : ""
    });
  }
}

async function handlePatientCsvImportExecute(request, env) {
  // STEP VET-50:
  // CSV一括取込の実行。
  //
  // 安全ルール：
  // - 確認文言必須
  // - 取込ログを残す
  // - エラー行はスキップ
  // - 重複行はデフォルトでスキップ
  // - 既存データ削除なし
  try {
    const body = await readJson(request);
    const clinicCode = getRequestedClinicCode(request, body);
    const clinic = await getClinicByCode(env, clinicCode);
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const sourceFilename = cleanString(body.source_filename || body.filename || "patients.csv");
    const confirmText = cleanString(body.confirm_text || body.confirm || "");
    const skipDuplicates = body.skip_duplicates === undefined ? true : Boolean(body.skip_duplicates);
    const staffName = cleanString(body.staff_name || body.actor_name) || "CSV取込画面";
    const note = cleanString(body.note || body.import_note || "");

    if (!rows.length) {
      return errorResponse("CSVデータがありません。", 400, {
        route: "step_vet_50_csv_import_execute"
      });
    }

    if (confirmText !== CSV_IMPORT_CONFIRM_TEXT) {
      return errorResponse(`確認文言が違います。「${CSV_IMPORT_CONFIRM_TEXT}」と入力してください。`, 400, {
        route: "step_vet_50_csv_import_execute",
        required_confirm_text: CSV_IMPORT_CONFIRM_TEXT
      });
    }

    const review = await buildPatientCsvImportReview(env, clinic, rows, {
      source_filename: sourceFilename
    });

    const batchRows = await insertRows(env, TABLES.importBatches, {
      clinic_id: clinic.id,
      import_type: "patients_csv",
      source_filename: sourceFilename,
      status: "executing",
      total_rows: review.summary.total_rows,
      valid_rows: review.summary.valid_rows,
      invalid_rows: review.summary.error_rows,
      duplicate_rows: review.summary.duplicate_rows,
      skipped_rows: 0,
      error_rows: 0,
      created_by: staffName,
      note: nullIfEmpty(note),
      updated_at: new Date().toISOString()
    });
    const batch = Array.isArray(batchRows) ? batchRows[0] : batchRows;

    const ownerCache = new Map();
    const resultRows = [];
    let importedGuardians = 0;
    let importedPets = 0;
    let skippedRows = 0;
    let errorRows = 0;

    // 既存飼い主の再利用用キャッシュ。
    const existingCardRows = await selectRows(env, TABLES.petCardView, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      limit: 3000
    });

    for (const rowReview of review.rows) {
      const normalized = rowReview.normalized;
      const raw = rowReview.raw || {};
      const baseLog = {
        batch_id: batch.id,
        clinic_id: clinic.id,
        row_number: rowReview.row_number,
        guardian_name: normalized.guardian_name || "",
        phone: normalized.phone || "",
        pet_name: normalized.pet_name || "",
        card_no: normalized.card_no || "",
        raw_data: raw,
        normalized_data: normalized,
        messages: rowReview.messages || []
      };

      try {
        if (rowReview.status === "error") {
          errorRows += 1;
          const logRows = await insertRows(env, TABLES.importRows, {
            ...baseLog,
            status: "error",
            severity: "error",
            action: "skipped_invalid"
          });
          resultRows.push({ ...rowReview, import_status: "error", log: Array.isArray(logRows) ? logRows[0] : logRows });
          continue;
        }

        if (skipDuplicates && rowReview.status === "duplicate") {
          skippedRows += 1;
          const logRows = await insertRows(env, TABLES.importRows, {
            ...baseLog,
            status: "duplicate",
            severity: "warning",
            action: "skipped_duplicate"
          });
          resultRows.push({ ...rowReview, import_status: "skipped_duplicate", log: Array.isArray(logRows) ? logRows[0] : logRows });
          continue;
        }

        const ownerKey = patientCsvOwnerKey(normalized);
        let guardian = ownerCache.get(ownerKey) || null;

        if (!guardian) {
          guardian = findExistingGuardianForImport(existingCardRows, normalized);
        }

        if (!guardian) {
          const guardianNo = await nextGuardianNo(env, clinic.id);
          const guardianMemo = [
            "CSV一括取込",
            normalized.postal_code ? `郵便番号:${normalized.postal_code}` : "",
            normalized.address ? `住所:${normalized.address}` : "",
            normalized.memo || "",
            note ? `取込メモ:${note}` : ""
          ].filter(Boolean).join(" / ");

          const guardianRows = await insertRows(env, TABLES.guardians, {
            clinic_id: clinic.id,
            guardian_no: guardianNo,
            guardian_name: normalized.guardian_name,
            guardian_kana: nullIfEmpty(normalized.guardian_kana),
            phone: nullIfEmpty(normalizePhoneForSave(normalized.phone)),
            email: nullIfEmpty(normalized.email),
            line_user_id: null,
            line_display_name: null,
            line_picture_url: null,
            line_link_status: "unlinked",
            preferred_contact: normalizePreferredContactForVet(normalized.phone ? "phone" : "line", "line"),
            memo: nullIfEmpty(guardianMemo),
            status: "active"
          });

          guardian = Array.isArray(guardianRows) ? guardianRows[0] : guardianRows;
          importedGuardians += 1;
        }

        ownerCache.set(ownerKey, guardian);

        const petNo = await nextPetNo(env, clinic.id);
        const animalType = normalized.species_label || normalized.species || "犬";
        const species = normalizePatientCsvSpecies(normalized.species || animalType);

        const cautionMemo = [
          "CSV一括取込",
          normalized.age_text ? `年齢:${normalized.age_text}` : "",
          normalized.caution_memo || "",
          normalized.memo || ""
        ].filter(Boolean).join(" / ");

        const petPayload = normalizePetPayload({
          pet_name: normalized.pet_name,
          species,
          species_label: animalType || speciesToLabel(species),
          breed: normalized.breed,
          sex: normalizePatientCsvSex(normalized.sex),
          birth_date: normalized.birth_date,
          weight_kg: normalized.weight_kg,
          neutered_status: normalizePatientCsvNeutered(normalized.neutered_status),
          insurance_status: normalized.insurance_status,
          allergies: normalized.allergy_note,
          chronic_conditions: normalized.chronic_conditions,
          caution_memo: cautionMemo,
          status: "active"
        }, clinic.id, guardian.id, petNo);

        const petRows = await insertRows(env, TABLES.pets, petPayload);
        const pet = Array.isArray(petRows) ? petRows[0] : petRows;

        const cardNo = normalized.card_no || await nextCardNo(env, clinic.id);
        const cardRows = await insertRows(env, TABLES.petCards, {
          clinic_id: clinic.id,
          pet_id: pet.id,
          card_no: cardNo,
          qr_token: createToken("card"),
          card_enabled: true,
          note: "STEP VET-50 CSV一括取込"
        });
        const card = Array.isArray(cardRows) ? cardRows[0] : cardRows;

        importedPets += 1;

        const logRows = await insertRows(env, TABLES.importRows, {
          ...baseLog,
          status: "imported",
          severity: rowReview.status === "duplicate" ? "warning" : "ok",
          action: guardian ? "imported_pet_card" : "imported_guardian_pet_card",
          created_guardian_id: guardian.id,
          created_pet_id: pet.id,
          created_card_id: card.id
        });

        resultRows.push({
          ...rowReview,
          import_status: "imported",
          guardian,
          pet,
          card,
          log: Array.isArray(logRows) ? logRows[0] : logRows
        });
      } catch (rowError) {
        errorRows += 1;
        const message = rowError?.message || "行の取込に失敗しました。";

        let log = null;
        try {
          const logRows = await insertRows(env, TABLES.importRows, {
            ...baseLog,
            status: "failed",
            severity: "error",
            action: "failed",
            messages: [
              ...(rowReview.messages || []),
              { type: "error", code: "import_failed", message }
            ]
          });
          log = Array.isArray(logRows) ? logRows[0] : logRows;
        } catch (logError) {
          log = null;
        }

        resultRows.push({
          ...rowReview,
          import_status: "failed",
          import_error: message,
          log
        });
      }
    }

    const finalStatus = errorRows > 0 ? "completed_with_errors" : "completed";
    await updateRows(env, TABLES.importBatches, {
      id: `eq.${batch.id}`,
      clinic_id: `eq.${clinic.id}`
    }, {
      status: finalStatus,
      imported_guardians: importedGuardians,
      imported_pets: importedPets,
      skipped_rows: skippedRows,
      error_rows: errorRows,
      executed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    await logOperation(env, clinic.id, "staff", staffName, "patients_csv_import_execute", "import_batch", batch.id, {
      source_filename: sourceFilename,
      total_rows: review.summary.total_rows,
      imported_guardians: importedGuardians,
      imported_pets: importedPets,
      skipped_rows: skippedRows,
      error_rows: errorRows,
      skip_duplicates: skipDuplicates,
      worker_version: WORKER_VERSION
    });

    return jsonResponse({
      ok: true,
      message: errorRows > 0 ? "CSV取込が完了しましたが、一部エラーがあります。" : "CSV取込が完了しました。",
      route: "step_vet_50_csv_import_execute",
      worker_version: WORKER_VERSION,
      clinic,
      batch: {
        ...batch,
        status: finalStatus
      },
      summary: {
        total_rows: review.summary.total_rows,
        imported_guardians: importedGuardians,
        imported_pets: importedPets,
        skipped_rows: skippedRows,
        error_rows: errorRows,
        duplicate_rows: review.summary.duplicate_rows
      },
      rows: resultRows.slice(0, 300),
      note: "既存データは削除していません。エラー行・重複行は取込ログに残ります。"
    });
  } catch (error) {
    return errorResponse(error?.message || "CSV取込実行に失敗しました。", 500, {
      route: "step_vet_50_csv_import_execute",
      worker_version: WORKER_VERSION,
      error_name: error && error.name ? error.name : "",
      error_stack_head: error && error.stack ? String(error.stack).split("\n").slice(0, 3).join("\n") : ""
    });
  }
}

async function buildPatientCsvImportReview(env, clinic, rawRows, options = {}) {
  const existingRows = await selectRows(env, TABLES.petCardView, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    limit: 3000
  });

  const existingIndex = buildPatientCsvExistingIndex(existingRows);
  const seenInFile = {
    cardNo: new Set(),
    ownerPet: new Set()
  };

  const rows = [];
  const duplicateCandidates = [];
  let validRows = 0;
  let duplicateRows = 0;
  let errorRows = 0;
  let warningRows = 0;

  const maxRows = Math.min(rawRows.length, 1000);

  for (let i = 0; i < maxRows; i += 1) {
    const raw = rawRows[i] || {};
    const normalized = normalizePatientCsvRow(raw);
    const messages = [];

    if (!normalized.guardian_name) {
      messages.push({ type: "error", code: "missing_guardian_name", message: "飼い主名がありません。" });
    }

    if (!normalized.pet_name) {
      messages.push({ type: "error", code: "missing_pet_name", message: "ペット名がありません。" });
    }

    if (!normalized.phone) {
      messages.push({ type: "warning", code: "missing_phone", message: "電話番号がありません。検索・重複確認が弱くなります。" });
    }

    if (!normalized.card_no) {
      messages.push({ type: "warning", code: "missing_card_no", message: "診察券番号が空です。取込時に自動発行します。" });
    }

    const cardKey = patientCsvCardKey(normalized.card_no);
    if (cardKey) {
      if (existingIndex.cardNo.has(cardKey)) {
        messages.push({ type: "warning", code: "duplicate_card_no_existing", message: `既存の診察券番号 ${normalized.card_no} と一致します。` });
      }
      if (seenInFile.cardNo.has(cardKey)) {
        messages.push({ type: "warning", code: "duplicate_card_no_in_file", message: `CSV内で診察券番号 ${normalized.card_no} が重複しています。` });
      }
      seenInFile.cardNo.add(cardKey);
    }

    const ownerPetKey = patientCsvOwnerPetKey(normalized);
    if (ownerPetKey) {
      if (existingIndex.ownerPet.has(ownerPetKey)) {
        messages.push({ type: "warning", code: "duplicate_owner_pet_existing", message: "既存の飼い主＋ペットと一致する可能性があります。" });
      }
      if (seenInFile.ownerPet.has(ownerPetKey)) {
        messages.push({ type: "warning", code: "duplicate_owner_pet_in_file", message: "CSV内で同じ飼い主＋ペットが重複しています。" });
      }
      seenInFile.ownerPet.add(ownerPetKey);
    }

    const duplicate = messages.some((m) => String(m.code || "").includes("duplicate"));
    const hasError = messages.some((m) => m.type === "error");
    const hasWarning = messages.some((m) => m.type === "warning");
    const status = hasError ? "error" : (duplicate ? "duplicate" : "valid");
    const severity = hasError ? "error" : (hasWarning ? "warning" : "ok");

    if (hasError) errorRows += 1;
    else if (duplicate) duplicateRows += 1;
    else validRows += 1;
    if (hasWarning && !hasError && !duplicate) warningRows += 1;

    const reviewedRow = {
      row_number: i + 2,
      status,
      severity,
      raw,
      normalized,
      messages
    };

    rows.push(reviewedRow);
    if (duplicate) duplicateCandidates.push(reviewedRow);
  }

  return {
    summary: {
      total_rows: maxRows,
      valid_rows: validRows,
      duplicate_rows: duplicateRows,
      warning_rows: warningRows,
      error_rows: errorRows,
      truncated: rawRows.length > maxRows,
      max_rows: 1000
    },
    rows,
    duplicate_candidates: duplicateCandidates.slice(0, 100)
  };
}

function normalizePatientCsvRow(row) {
  const pick = (...keys) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") return row[key];
    }
    return "";
  };

  const speciesRaw = cleanString(pick("animal_type", "動物種", "species_label", "species", "種類"));
  const sexRaw = cleanString(pick("sex", "性別"));
  const neuteredRaw = cleanString(pick("neutered_status", "避妊去勢", "避妊・去勢"));

  return {
    guardian_name: cleanString(pick("guardian_name", "飼い主名", "owner_name", "お名前", "氏名")),
    guardian_kana: cleanString(pick("guardian_kana", "ふりがな", "フリガナ", "飼い主ふりがな")),
    phone: normalizePatientCsvPhone(pick("phone", "電話番号", "tel", "携帯番号", "連絡先")),
    email: cleanString(pick("email", "メール", "メールアドレス")),
    postal_code: cleanString(pick("postal_code", "郵便番号")),
    address: cleanString(pick("address", "住所")),
    pet_name: cleanString(pick("pet_name", "ペット名", "動物名")),
    species: normalizePatientCsvSpecies(speciesRaw),
    species_label: speciesRaw || speciesToLabel(normalizePatientCsvSpecies(speciesRaw)),
    breed: cleanString(pick("breed", "品種")),
    sex: normalizePatientCsvSex(sexRaw),
    birth_date: normalizePatientCsvDate(pick("birth_date", "生年月日", "誕生日")),
    age_text: cleanString(pick("age_text", "年齢メモ", "年齢")),
    weight_kg: normalizePatientCsvWeight(pick("weight_kg", "体重kg", "体重")),
    neutered_status: normalizePatientCsvNeutered(neuteredRaw),
    insurance_status: cleanString(pick("insurance_status", "保険")),
    allergy_note: cleanString(pick("allergy_note", "allergies", "アレルギー")),
    chronic_conditions: cleanString(pick("chronic_conditions", "持病", "既往歴")),
    caution_memo: cleanString(pick("caution_memo", "注意メモ", "受付注意")),
    card_no: cleanString(pick("card_no", "診察券番号", "カルテ番号", "会員番号")),
    memo: cleanString(pick("memo", "メモ", "備考"))
  };
}

function normalizePatientCsvPhone(value) {
  return normalizePhoneForSave(value);
}

function normalizePatientCsvTextKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[　\s\-ー―−()（）]/g, "");
}

function normalizePatientCsvDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizePatientCsvSpecies(value) {
  const text = cleanString(value).toLowerCase();
  if (!text) return "dog";
  if (["dog", "犬", "いぬ"].includes(text)) return "dog";
  if (["cat", "猫", "ねこ"].includes(text)) return "cat";
  if (["rabbit", "うさぎ", "ウサギ"].includes(text)) return "rabbit";
  if (["hamster", "ハムスター"].includes(text)) return "hamster";
  if (["bird", "鳥", "とり"].includes(text)) return "bird";
  return "other";
}

function normalizePatientCsvSex(value) {
  const text = cleanString(value).toLowerCase();
  if (!text) return "";
  if (["male", "m", "男", "男の子", "オス", "雄"].includes(text)) return "male";
  if (["female", "f", "女", "女の子", "メス", "雌"].includes(text)) return "female";
  return "unknown";
}

function normalizePatientCsvNeutered(value) {
  const text = cleanString(value).toLowerCase();
  if (!text) return "unknown";
  if (["done", "済", "済み", "実施", "yes", "y"].includes(text)) return "done";
  if (["not_done", "未", "未実施", "なし", "no", "n"].includes(text)) return "not_done";
  return "unknown";
}

function normalizePatientCsvDate(value) {
  const text = cleanString(value);
  if (!text) return null;

  const normalized = text
    .replace(/[年月.]/g, "-")
    .replace(/[日]/g, "")
    .replace(/\//g, "-")
    .trim();

  const m = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;

  const yyyy = m[1];
  const mm = String(Number(m[2])).padStart(2, "0");
  const dd = String(Number(m[3])).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizePatientCsvWeight(value) {
  const text = cleanString(value).replace(/[^\d.]/g, "");
  if (!text) return "";
  const n = Number(text);
  return Number.isFinite(n) ? n : "";
}

function patientCsvCardKey(cardNo) {
  return normalizePatientCsvTextKey(cardNo);
}

function patientCsvOwnerKey(row) {
  const phone = normalizePatientCsvDigits(row.phone);
  const name = normalizePatientCsvTextKey(row.guardian_name);
  return `${phone || "no_phone"}:${name}`;
}

function patientCsvOwnerPetKey(row) {
  const phone = normalizePatientCsvDigits(row.phone);
  const name = normalizePatientCsvTextKey(row.guardian_name);
  const pet = normalizePatientCsvTextKey(row.pet_name);
  if (!name || !pet) return "";
  return `${phone || "no_phone"}:${name}:${pet}`;
}

function buildPatientCsvExistingIndex(rows) {
  const cardNo = new Set();
  const ownerPet = new Set();

  for (const row of rows || []) {
    const item = buildExistingPatientSearchItem(row);
    const c = patientCsvCardKey(item.card_no);
    if (c) cardNo.add(c);

    const key = patientCsvOwnerPetKey({
      phone: item.phone,
      guardian_name: item.guardian_name,
      pet_name: item.pet_name
    });
    if (key) ownerPet.add(key);
  }

  return { cardNo, ownerPet };
}

function findExistingGuardianForImport(existingRows, normalized) {
  const targetPhone = normalizePatientCsvDigits(normalized.phone);
  const targetName = normalizePatientCsvTextKey(normalized.guardian_name);

  if (!targetName) return null;

  for (const row of existingRows || []) {
    const item = buildExistingPatientSearchItem(row);
    const phone = normalizePatientCsvDigits(item.phone);
    const name = normalizePatientCsvTextKey(item.guardian_name);

    if (targetPhone && phone && targetPhone === phone && targetName === name) {
      return {
        id: item.guardian_id,
        clinic_id: row.clinic_id,
        guardian_name: item.guardian_name,
        guardian_no: item.guardian_no,
        phone: item.phone,
        line_user_id: item.line_user_id || null,
        line_link_status: item.line_link_status || "unlinked"
      };
    }
  }

  return null;
}


async function handleProductionFinalSafetyCheck(request, env) {
  // STEP VET-49:
  // 本番前の最終安全チェック。
  //
  // 重要：
  // - 読み取り専用。DBの作成・更新・削除はしない。
  // - demo専用機能が本番clinic_codeに混ざらないか確認する。
  // - GitHub/LINE/Supabase/Cloudflareの人間確認項目も返す。
  try {
    const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
    const safety = buildSafetyMeta(request, env, { clinic_code: clinicCode });

    let clinic = null;
    let clinicError = "";
    try {
      clinic = await getClinicByCode(env, clinicCode);
    } catch (error) {
      clinicError = error?.message || "Clinic lookup failed.";
    }

    let settings = null;
    let regularHours = [];
    let sampleCards = [];
    let lineLinkedCount = 0;
    let lineUnlinkedCount = 0;

    if (clinic) {
      try {
        settings = await getClinicSettings(env, clinic.id);
      } catch (error) {
        settings = null;
      }

      try {
        regularHours = await getRegularHours(env, clinic.id);
      } catch (error) {
        regularHours = [];
      }

      try {
        sampleCards = await selectRows(env, TABLES.petCardView, {
          select: "guardian_id,guardian_name,pet_id,pet_name,card_no,card_enabled,line_user_id,line_link_status",
          clinic_id: `eq.${clinic.id}`,
          limit: 300
        });
      } catch (error) {
        sampleCards = [];
      }

      for (const row of sampleCards || []) {
        const linked = normalizeLineLinkStatusForWorker(row.line_link_status, row.line_user_id) === "linked";
        if (linked) lineLinkedCount += 1;
        else lineUnlinkedCount += 1;
      }
    }

    const checks = [];

    checks.push(makeSafetyCheck(
      "clinic_exists",
      "clinic_code登録",
      clinic ? "pass" : "fail",
      clinic
        ? `clinic_code ${clinicCode} は vet_clinics に登録されています。`
        : `clinic_code ${clinicCode} が見つかりません。${clinicError || "vet_clinics を確認してください。"}`,
      clinic ? "success" : "danger"
    ));

    checks.push(makeSafetyCheck(
      "not_demo_for_real_production",
      "DEMOコード取り違え防止",
      safety.is_demo_clinic ? "warn" : "pass",
      safety.is_demo_clinic
        ? `現在はDEMO用 clinic_code=${safety.demo_clinic_code} です。実医院の本番では必ず別clinic_codeを作ってください。`
        : `現在の clinic_code=${clinicCode} はDEMOコードと分離されています。`,
      safety.is_demo_clinic ? "warning" : "success"
    ));

    checks.push(makeSafetyCheck(
      "admin_token_configured",
      "Worker管理コード",
      safety.auth.admin_token_configured ? "pass" : "fail",
      safety.auth.admin_token_configured
        ? "Cloudflare Worker Secrets に ADMIN_TOKEN または DPRO_ADMIN_TOKEN が設定されています。"
        : "ADMIN_TOKEN が未設定です。Cloudflare Worker の Secrets を確認してください。",
      safety.auth.admin_token_configured ? "success" : "danger"
    ));

    checks.push(makeSafetyCheck(
      "admin_code_not_query",
      "管理コード送信方式",
      safety.auth.query_param_used ? "warn" : "pass",
      safety.auth.query_param_used
        ? "管理コードがURLクエリで送信されています。ヘッダー保存方式を優先してください。"
        : "管理コードはヘッダー/Bearer方式で送られており、URLに残りにくい状態です。",
      safety.auth.query_param_used ? "warning" : "success"
    ));

    checks.push(makeSafetyCheck(
      "vet_tables_only",
      "テーブル分離",
      "pass",
      "このWorkerは vet_ 系テーブルだけを使用します。dental_qr_ 系には触れません。",
      "success"
    ));

    checks.push(makeSafetyCheck(
      "demo_reset_guard",
      "DEMOリセット隔離",
      safety.is_demo_clinic ? "warn" : "pass",
      safety.is_demo_clinic
        ? "現在はDEMO医院なので営業前DEMO準備の対象です。本番医院では実行対象にしないでください。"
        : "本番clinic_codeでは営業前DEMO準備APIが拒否される設計です。",
      safety.is_demo_clinic ? "warning" : "success"
    ));

    checks.push(makeSafetyCheck(
      "clinic_settings",
      "医院設定",
      settings ? "pass" : "fail",
      settings
        ? "vet_clinic_settings が作成されています。"
        : "医院設定が未作成です。診療時間・医院名などを設定してください。",
      settings ? "success" : "danger"
    ));

    checks.push(makeSafetyCheck(
      "regular_hours",
      "曜日別診療時間",
      regularHours.length >= 7 ? "pass" : "fail",
      regularHours.length >= 7
        ? "曜日別診療時間が7日分あります。"
        : `曜日別診療時間が ${regularHours.length} 件です。7日分必要です。`,
      regularHours.length >= 7 ? "success" : "danger"
    ));

    checks.push(makeSafetyCheck(
      "cards_exist",
      "診察券データ",
      sampleCards.length > 0 ? "pass" : "warn",
      sampleCards.length > 0
        ? `診察券/ペットデータを ${sampleCards.length} 件確認しました。`
        : "診察券/ペットデータがまだありません。初期登録・代理登録・CSV取込を確認してください。",
      sampleCards.length > 0 ? "success" : "warning"
    ));

    checks.push(makeSafetyCheck(
      "line_link_visibility",
      "LINE連携状態の見える化",
      "pass",
      `LINE連携済み ${lineLinkedCount} 件 / 未連携 ${lineUnlinkedCount} 件を確認できます。未連携でも窓口・電話受付で運用できます。`,
      "success"
    ));

    checks.push(makeSafetyCheck(
      "public_site_url_env",
      "PUBLIC_SITE_URL",
      env.PUBLIC_SITE_URL ? "pass" : "warn",
      env.PUBLIC_SITE_URL
        ? `PUBLIC_SITE_URL=${env.PUBLIC_SITE_URL}`
        : "PUBLIC_SITE_URL が未設定です。未設定でも動きますが、本番URL整理のため設定推奨です。",
      env.PUBLIC_SITE_URL ? "success" : "warning"
    ));

    checks.push(makeSafetyCheck(
      "worker_public_url_env",
      "WORKER_PUBLIC_URL",
      env.WORKER_PUBLIC_URL ? "pass" : "warn",
      env.WORKER_PUBLIC_URL
        ? `WORKER_PUBLIC_URL=${env.WORKER_PUBLIC_URL}`
        : "WORKER_PUBLIC_URL が未設定です。未設定でも動きますが、本番URL整理のため設定推奨です。",
      env.WORKER_PUBLIC_URL ? "success" : "warning"
    ));

    const baseSiteUrl = String(env.PUBLIC_SITE_URL || "https://dpromstk2000-lab.github.io/DPRO-VET-QR/").replace(/\/?$/, "/");
    const urls = {
      production_check: `${baseSiteUrl}production-check.html?clinic_code=${encodeURIComponent(clinicCode)}`,
      owner: `${baseSiteUrl}owner.html?clinic_code=${encodeURIComponent(clinicCode)}`,
      scan_pc: `${baseSiteUrl}scan-pc.html?clinic_code=${encodeURIComponent(clinicCode)}`,
      patients: `${baseSiteUrl}patients.html?clinic_code=${encodeURIComponent(clinicCode)}`,
      member_liff: `${baseSiteUrl}member.html?clinic_code=${encodeURIComponent(clinicCode)}`,
      waiting_liff: `${baseSiteUrl}waiting.html?clinic_code=${encodeURIComponent(clinicCode)}`,
      system_check_demo_only: `${baseSiteUrl}system-check.html?clinic_code=${encodeURIComponent(safety.demo_clinic_code)}`
    };

    const manualChecklist = [
      {
        id: "line_official_owner_account",
        label: "LINE公式アカウントは医院オーナー側の管理下にある",
        detail: "本番ではユーザー個人アカウントではなく、医院側のLINE Business ID/Provider配下で管理する。"
      },
      {
        id: "rich_menu_no_demo_params",
        label: "本番リッチメニューURLに demo=ready や固定 line_user_id が入っていない",
        detail: "本番の診察券・受付URLは LIFF で本人のLINE IDを取得する。demo_line_link_001 を使わない。"
      },
      {
        id: "unique_admin_code",
        label: "医院ごとに専用の管理コードを設定した",
        detail: "DEMO用管理コードを本番医院で使い回さない。Cloudflare Secrets の ADMIN_TOKEN を医院ごとに変更する。"
      },
      {
        id: "system_check_not_owner_menu",
        label: "system-check.html は医院オーナー通常メニューに出さない",
        detail: "営業デモ・開発確認用。通常運用は owner.html / scan-pc.html / patients.html を使う。"
      },
      {
        id: "cloudflare_secrets_set",
        label: "Cloudflare Secrets を本番用に設定した",
        detail: "SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY、ADMIN_TOKEN を確認する。"
      },
      {
        id: "supabase_backup_before_import",
        label: "既存患者データ取込前にバックアップ方針を決めた",
        detail: "CSV一括取込や大量登録前に、取込前バックアップ・取込ログ・重複確認を必ず行う。"
      },
      {
        id: "privacy_explanation_ready",
        label: "飼い主向け説明文を用意した",
        detail: "LINE診察券、受付通知、LINE未連携でも窓口受付可能であることを説明できるようにする。"
      },
      {
        id: "staff_operation_training",
        label: "受付スタッフの運用確認をした",
        detail: "窓口受付、電話受付、既存患者検索、代理登録、ペット追加、会計待ち、完了まで実演確認する。"
      },
      {
        id: "emergency_policy",
        label: "緊急時・時間外の案内を明記した",
        detail: "LINE受付は緊急対応を保証するものではない。電話案内や救急案内を別途明記する。"
      }
    ];

    const failCount = checks.filter((item) => item.status === "fail").length;
    const warnCount = checks.filter((item) => item.status === "warn").length;
    const passCount = checks.filter((item) => item.status === "pass").length;

    return jsonResponse({
      ok: true,
      route: "step_vet_49_production_final_safety_check",
      worker_version: WORKER_VERSION,
      service: SERVICE_ID,
      service_name: SERVICE_NAME,
      clinic_code: clinicCode,
      clinic,
      safety,
      summary: {
        pass: passCount,
        warn: warnCount,
        fail: failCount,
        ready_level: failCount > 0 ? "not_ready" : (warnCount > 0 ? "needs_review" : "ready"),
        message: failCount > 0
          ? "本番前に修正が必要な項目があります。"
          : (warnCount > 0 ? "本番前に確認すべき注意項目があります。" : "API上の必須チェックは通過しています。")
      },
      checks,
      urls,
      manual_checklist: manualChecklist,
      samples: {
        card_count_scanned: sampleCards.length,
        line_linked_count: lineLinkedCount,
        line_unlinked_count: lineUnlinkedCount,
        cards: sampleCards.slice(0, 10)
      },
      note: "このAPIは読み取り専用です。DBの更新・削除・DEMOリセットは実行しません。"
    });
  } catch (error) {
    return errorResponse(error?.message || "本番前安全チェックに失敗しました。", 500, {
      route: "step_vet_49_production_final_safety_check",
      worker_version: WORKER_VERSION,
      error_name: error && error.name ? error.name : "",
      error_stack_head: error && error.stack ? String(error.stack).split("\n").slice(0, 3).join("\n") : ""
    });
  }
}


async function handleGuardianLineLinkStatus(request, env) {
  // STEP VET-48:
  // 飼い主のLINE連携状態だけを軽く確認するAPI。
  try {
    const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
    const clinic = await getClinicByCode(env, clinicCode);
    const guardianId = cleanString(getParam(request, "guardian_id", "") || getParam(request, "owner_id", ""));

    if (!guardianId) {
      return errorResponse("guardian_id が必要です。", 400, {
        route: "step_vet_48_line_link_status"
      });
    }

    const guardian = await getGuardianById(env, guardianId);
    if (!guardian || guardian.clinic_id !== clinic.id) {
      return errorResponse("飼い主情報が見つかりません。", 404, {
        route: "step_vet_48_line_link_status"
      });
    }

    return jsonResponse({
      ok: true,
      route: "step_vet_48_line_link_status",
      worker_version: WORKER_VERSION,
      clinic,
      guardian_id: guardian.id,
      guardian_name: guardian.guardian_name,
      line_user_id: guardian.line_user_id || "",
      line_display_name: guardian.line_display_name || "",
      line_picture_url: guardian.line_picture_url || "",
      line_link_status: normalizeLineLinkStatusForWorker(guardian.line_link_status, guardian.line_user_id),
      preferred_contact: guardian.preferred_contact || "",
      status_label: lineLinkStatusLabelForWorker(guardian.line_link_status, guardian.line_user_id),
      member_url: guardian.line_user_id
        ? `https://dpromstk2000-lab.github.io/DPRO-VET-QR/member.html?clinic_code=${encodeURIComponent(clinic.clinic_code)}&line_user_id=${encodeURIComponent(guardian.line_user_id)}`
        : "",
      waiting_url: guardian.line_user_id
        ? `https://dpromstk2000-lab.github.io/DPRO-VET-QR/waiting.html?clinic_code=${encodeURIComponent(clinic.clinic_code)}&line_user_id=${encodeURIComponent(guardian.line_user_id)}`
        : ""
    });
  } catch (error) {
    return errorResponse(error?.message || "LINE連携状態の取得に失敗しました。", 500, {
      route: "step_vet_48_line_link_status",
      worker_version: WORKER_VERSION
    });
  }
}

async function handleGuardianLineLinkUpdate(request, env) {
  // STEP VET-48:
  // 管理画面から、既存飼い主にLINEユーザーIDを手動で紐づける。
  //
  // 本番の基本はLIFFで本人確認して連携すること。
  // これは受付スタッフが確認済みのときだけ使う補助機能。
  try {
    const body = await readJson(request);
    const clinicCode = getRequestedClinicCode(request, body);
    const clinic = await getClinicByCode(env, clinicCode);

    const guardianId = cleanString(body.guardian_id || body.owner_id);
    const lineUserId = cleanString(body.line_user_id || body.lineUserId || body.line_uid);
    const lineDisplayName = cleanString(body.line_display_name || body.lineDisplayName || body.display_name);
    const staffName = cleanString(body.staff_name || body.actor_name) || "受付スタッフ";
    const note = cleanString(body.note || body.staff_note || "");

    if (!guardianId) return errorResponse("guardian_id が必要です。", 400, { route: "step_vet_48_line_link_update" });
    if (!lineUserId) return errorResponse("line_user_id が必要です。", 400, { route: "step_vet_48_line_link_update" });

    const existing = await getGuardianById(env, guardianId);
    if (!existing || existing.clinic_id !== clinic.id) {
      return errorResponse("飼い主情報が見つかりません。", 404, { route: "step_vet_48_line_link_update" });
    }

    const patch = {
      line_user_id: lineUserId,
      line_display_name: lineDisplayName || existing.line_display_name || null,
      line_link_status: "linked",
      preferred_contact: "line",
      updated_at: new Date().toISOString()
    };

    if (body.line_picture_url !== undefined) {
      patch.line_picture_url = nullIfEmpty(body.line_picture_url);
    }

    if (note) {
      patch.memo = nullIfEmpty([existing.memo, `LINE手動連携：${note}`].filter(Boolean).join(" / "));
    }

    const rows = await updateRows(env, TABLES.guardians, {
      id: `eq.${guardianId}`,
      clinic_id: `eq.${clinic.id}`
    }, patch);

    const guardian = Array.isArray(rows) ? rows[0] : rows;

    await logOperation(env, clinic.id, "staff", staffName, "guardian_line_link_update", "guardian", guardianId, {
      line_user_id: lineUserId,
      line_display_name: lineDisplayName || "",
      previous_line_user_id: existing.line_user_id || "",
      note,
      worker_version: WORKER_VERSION
    });

    return jsonResponse({
      ok: true,
      message: "LINE連携情報を更新しました。",
      route: "step_vet_48_line_link_update",
      worker_version: WORKER_VERSION,
      clinic,
      guardian,
      line_link_status: "linked",
      status_label: "LINE連携済み",
      member_url: `https://dpromstk2000-lab.github.io/DPRO-VET-QR/member.html?clinic_code=${encodeURIComponent(clinic.clinic_code)}&line_user_id=${encodeURIComponent(lineUserId)}`,
      waiting_url: `https://dpromstk2000-lab.github.io/DPRO-VET-QR/waiting.html?clinic_code=${encodeURIComponent(clinic.clinic_code)}&line_user_id=${encodeURIComponent(lineUserId)}`,
      note: "本番では基本的にLIFF本人確認で連携します。これは受付スタッフ確認済み時の補助操作です。"
    });
  } catch (error) {
    return errorResponse(error?.message || "LINE連携情報の更新に失敗しました。", 500, {
      route: "step_vet_48_line_link_update",
      worker_version: WORKER_VERSION
    });
  }
}

async function handleGuardianLineLinkUnlink(request, env) {
  // STEP VET-48:
  // 飼い主のLINE連携を解除する。
  // LINEしていない方、機種変更、別のLINEアカウントに変える時に使う。
  try {
    const body = await readJson(request);
    const clinicCode = getRequestedClinicCode(request, body);
    const clinic = await getClinicByCode(env, clinicCode);

    const guardianId = cleanString(body.guardian_id || body.owner_id);
    const staffName = cleanString(body.staff_name || body.actor_name) || "受付スタッフ";
    const reason = cleanString(body.reason || body.note || body.staff_note || "管理画面から連携解除");

    if (!guardianId) return errorResponse("guardian_id が必要です。", 400, { route: "step_vet_48_line_link_unlink" });

    const existing = await getGuardianById(env, guardianId);
    if (!existing || existing.clinic_id !== clinic.id) {
      return errorResponse("飼い主情報が見つかりません。", 404, { route: "step_vet_48_line_link_unlink" });
    }

    const nextContact = existing.phone ? "phone" : "staff";
    const patch = {
      line_user_id: null,
      line_display_name: null,
      line_picture_url: null,
      line_link_status: "unlinked",
      preferred_contact: nextContact,
      memo: nullIfEmpty([existing.memo, `LINE連携解除：${reason}`].filter(Boolean).join(" / ")),
      updated_at: new Date().toISOString()
    };

    const rows = await updateRows(env, TABLES.guardians, {
      id: `eq.${guardianId}`,
      clinic_id: `eq.${clinic.id}`
    }, patch);

    const guardian = Array.isArray(rows) ? rows[0] : rows;

    await logOperation(env, clinic.id, "staff", staffName, "guardian_line_link_unlink", "guardian", guardianId, {
      previous_line_user_id: existing.line_user_id || "",
      previous_line_display_name: existing.line_display_name || "",
      reason,
      worker_version: WORKER_VERSION
    });

    return jsonResponse({
      ok: true,
      message: "LINE連携を解除しました。",
      route: "step_vet_48_line_link_unlink",
      worker_version: WORKER_VERSION,
      clinic,
      guardian,
      line_link_status: "unlinked",
      status_label: "LINE未連携",
      preferred_contact: nextContact,
      note: "LINE未連携として、窓口・電話・スタッフ対応で継続できます。"
    });
  } catch (error) {
    return errorResponse(error?.message || "LINE連携解除に失敗しました。", 500, {
      route: "step_vet_48_line_link_unlink",
      worker_version: WORKER_VERSION
    });
  }
}

function normalizeLineLinkStatusForWorker(status, lineUserId = "") {
  const text = cleanString(status).toLowerCase();
  if (text === "linked" || lineUserId) return "linked";
  return "unlinked";
}

function lineLinkStatusLabelForWorker(status, lineUserId = "") {
  return normalizeLineLinkStatusForWorker(status, lineUserId) === "linked"
    ? "LINE連携済み"
    : "LINE未連携";
}


async function handleGuardianPetManagementSearch(request, env) {
  // STEP VET-47:
  // 飼い主・ペット管理画面用の検索。
  // vet_pet_card_view を使って、飼い主単位に集約して返す。
  try {
    const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
    const clinic = await getClinicByCode(env, clinicCode);
    const q = cleanString(getParam(request, "q", "") || getParam(request, "keyword", "") || getParam(request, "search", ""));
    const limit = normalizeLimit(getParam(request, "limit", "40"), 40, 100);

    const rows = await selectRows(env, TABLES.petCardView, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      order: "guardian_name.asc,pet_name.asc",
      limit: 800
    });

    const filtered = (rows || [])
      .filter((row) => rowMatchesExistingPatientSearch(row, q));

    const map = new Map();
    const searchItemsWithPhotos = await enrichPatientSearchItemsWithPetPhotos(
      env,
      filtered.map((row) => buildExistingPatientSearchItem(row))
    );

    for (const item of searchItemsWithPhotos) {
      const guardianId = item.guardian_id || `unknown-${item.guardian_name}-${item.phone}`;
      if (!map.has(guardianId)) {
        map.set(guardianId, {
          guardian_id: item.guardian_id,
          guardian_no: item.guardian_no || "",
          guardian_name: item.guardian_name || "飼い主",
          phone: item.phone || "",
          line_user_id: item.line_user_id || "",
          line_link_status: item.line_link_status || "unlinked",
          pet_count: 0,
          pets: []
        });
      }

      const group = map.get(guardianId);
      const petKey = item.pet_id || item.card_no || item.pet_name;
      if (!group.pets.some((p) => (p.pet_id || p.card_no || p.pet_name) === petKey)) {
        group.pets.push({
          pet_id: item.pet_id,
          pet_no: item.pet_no,
          pet_name: item.pet_name,
          species: item.species,
          species_label: item.species_label,
          breed: item.breed,
          photo_url: item.photo_url || item.pet_photo_url || "",
          pet_photo_url: item.pet_photo_url || item.photo_url || "",
          photo_storage_path: item.photo_storage_path || item.pet_photo_storage_path || "",
          pet_photo_storage_path: item.pet_photo_storage_path || item.photo_storage_path || "",
          photo_updated_at: item.photo_updated_at || item.pet_photo_updated_at || "",
          pet_photo_updated_at: item.pet_photo_updated_at || item.photo_updated_at || "",
          has_pet_photo: Boolean(item.photo_url || item.pet_photo_url),
          card_id: item.card_id,
          card_no: item.card_no,
          card_enabled: item.card_enabled,
          pet_status: item.pet_status
        });
      }
      group.pet_count = group.pets.length;
    }

    const items = Array.from(map.values()).slice(0, limit);

    return jsonResponse({
      ok: true,
      route: "step_vet_47_guardian_pet_management_search",
      worker_version: WORKER_VERSION,
      clinic,
      query: q,
      count: items.length,
      total_scanned: rows.length,
      items,
      note: "飼い主・ペット管理画面用の検索結果です。"
    });
  } catch (error) {
    return errorResponse(error?.message || "飼い主・ペット検索に失敗しました。", 500, {
      route: "step_vet_47_guardian_pet_management_search",
      worker_version: WORKER_VERSION
    });
  }
}

async function handleGuardianPetManagementDetail(request, env) {
  // STEP VET-47:
  // 飼い主詳細と、その飼い主に紐づくペット・診察券一覧を返す。
  try {
    const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
    const clinic = await getClinicByCode(env, clinicCode);
    const guardianId = cleanString(getParam(request, "guardian_id", "") || getParam(request, "owner_id", ""));

    if (!guardianId) {
      return errorResponse("guardian_id が必要です。", 400, {
        route: "step_vet_47_guardian_pet_management_detail"
      });
    }

    const guardian = await getGuardianById(env, guardianId);
    if (!guardian || guardian.clinic_id !== clinic.id) {
      return errorResponse("飼い主情報が見つかりません。", 404, {
        route: "step_vet_47_guardian_pet_management_detail"
      });
    }

    const rows = await selectRows(env, TABLES.petCardView, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      guardian_id: `eq.${guardianId}`,
      order: "pet_name.asc,card_no.asc",
      limit: 200
    });

    const pets = [];
    const seen = new Set();

    // STEP VET-PHOTO-1B-R4:
    // vet_pet_card_view に写真カラムが無い環境でも、vet_pets から写真情報を補完する。
    // patients.html の登録ペット一覧は detail API を使うため、ここで補完しないと
    // 会員証・受付PC・受付iPad・doctor では写真が出ても、管理画面だけ通常アイコンのままになる。
    const baseItems = (rows || []).map((row) => buildExistingPatientSearchItem(row));
    const enrichedItems = await enrichPatientSearchItemsWithPetPhotos(env, baseItems);
    const rowByKey = new Map();
    (rows || []).forEach((row) => {
      const item = buildExistingPatientSearchItem(row);
      const key = item.pet_id || item.card_no || item.pet_name;
      if (!rowByKey.has(key)) rowByKey.set(key, row);
    });

    for (const item of enrichedItems || []) {
      const key = item.pet_id || item.card_no || item.pet_name;
      if (seen.has(key)) continue;
      seen.add(key);
      const row = rowByKey.get(key) || {};
      pets.push({
        pet_id: item.pet_id,
        pet_no: item.pet_no,
        pet_name: item.pet_name,
        species: item.species,
        species_label: item.species_label,
        breed: item.breed,
        photo_url: item.photo_url || item.pet_photo_url || row.photo_url || row.pet_photo_url || "",
        pet_photo_url: item.pet_photo_url || item.photo_url || row.pet_photo_url || row.photo_url || "",
        photo_storage_path: item.photo_storage_path || item.pet_photo_storage_path || row.photo_storage_path || row.pet_photo_storage_path || "",
        pet_photo_storage_path: item.pet_photo_storage_path || item.photo_storage_path || row.pet_photo_storage_path || row.photo_storage_path || "",
        photo_updated_at: item.photo_updated_at || item.pet_photo_updated_at || row.photo_updated_at || row.pet_photo_updated_at || "",
        pet_photo_updated_at: item.pet_photo_updated_at || item.photo_updated_at || row.pet_photo_updated_at || row.photo_updated_at || "",
        has_pet_photo: Boolean(item.photo_url || item.pet_photo_url || row.photo_url || row.pet_photo_url),
        sex: row.sex || "",
        birth_date: row.birth_date || null,
        weight_kg: row.weight_kg ?? null,
        neutered_status: row.neutered_status || "",
        insurance_status: row.insurance_status || "",
        allergies: row.allergies || "",
        chronic_conditions: row.chronic_conditions || "",
        caution_memo: row.caution_memo || "",
        pet_status: item.pet_status || row.status || "active",
        card_id: item.card_id,
        card_no: item.card_no,
        card_token: item.card_token,
        qr_token: item.qr_token,
        card_enabled: item.card_enabled
      });
    }

    return jsonResponse({
      ok: true,
      route: "step_vet_47_guardian_pet_management_detail",
      worker_version: WORKER_VERSION,
      clinic,
      guardian,
      pets,
      pet_count: pets.length
    });
  } catch (error) {
    return errorResponse(error?.message || "飼い主詳細の取得に失敗しました。", 500, {
      route: "step_vet_47_guardian_pet_management_detail",
      worker_version: WORKER_VERSION
    });
  }
}

async function handleGuardianManagementUpdate(request, env) {
  // STEP VET-47:
  // 飼い主情報を編集する。
  try {
    const body = await readJson(request);
    const clinicCode = getRequestedClinicCode(request, body);
    const clinic = await getClinicByCode(env, clinicCode);
    const guardianId = cleanString(body.guardian_id || body.owner_id);
    const staffName = cleanString(body.staff_name || body.actor_name) || "受付スタッフ";

    if (!guardianId) return errorResponse("guardian_id が必要です。", 400, { route: "step_vet_47_guardian_update" });

    const existing = await getGuardianById(env, guardianId);
    if (!existing || existing.clinic_id !== clinic.id) {
      return errorResponse("飼い主情報が見つかりません。", 404, { route: "step_vet_47_guardian_update" });
    }

    const patch = {};
    if (body.guardian_name !== undefined) patch.guardian_name = cleanString(body.guardian_name);
    if (body.guardian_kana !== undefined) patch.guardian_kana = nullIfEmpty(body.guardian_kana);
    if (body.phone !== undefined) patch.phone = nullIfEmpty(normalizePhoneForSave(body.phone));
    if (body.email !== undefined) patch.email = nullIfEmpty(body.email);
    if (body.preferred_contact !== undefined) patch.preferred_contact = normalizePreferredContactForVet(body.preferred_contact, "line");
    if (body.memo !== undefined) patch.memo = nullIfEmpty(body.memo);
    if (body.status !== undefined) patch.status = cleanString(body.status) || "active";
    patch.updated_at = new Date().toISOString();

    if (!patch.guardian_name && body.guardian_name !== undefined) {
      return errorResponse("飼い主名は空にできません。", 400, { route: "step_vet_47_guardian_update" });
    }

    const rows = await updateRows(env, TABLES.guardians, {
      id: `eq.${guardianId}`,
      clinic_id: `eq.${clinic.id}`
    }, patch);

    const guardian = Array.isArray(rows) ? rows[0] : rows;

    await logOperation(env, clinic.id, "staff", staffName, "guardian_update", "guardian", guardianId, {
      patch_keys: Object.keys(patch),
      guardian_name: guardian?.guardian_name,
      worker_version: WORKER_VERSION
    });

    return jsonResponse({
      ok: true,
      message: "飼い主情報を更新しました。",
      route: "step_vet_47_guardian_update",
      worker_version: WORKER_VERSION,
      guardian
    });
  } catch (error) {
    return errorResponse(error?.message || "飼い主情報の更新に失敗しました。", 500, {
      route: "step_vet_47_guardian_update",
      worker_version: WORKER_VERSION
    });
  }
}

async function handlePetManagementUpdate(request, env) {
  // STEP VET-47:
  // ペット情報を編集する。
  try {
    const body = await readJson(request);
    const clinicCode = getRequestedClinicCode(request, body);
    const clinic = await getClinicByCode(env, clinicCode);
    const petId = cleanString(body.pet_id);
    const staffName = cleanString(body.staff_name || body.actor_name) || "受付スタッフ";

    if (!petId) return errorResponse("pet_id が必要です。", 400, { route: "step_vet_47_pet_update" });

    const existing = await getPetById(env, petId);
    if (!existing || existing.clinic_id !== clinic.id) {
      return errorResponse("ペット情報が見つかりません。", 404, { route: "step_vet_47_pet_update" });
    }

    const patch = {};
    if (body.pet_name !== undefined) patch.pet_name = cleanString(body.pet_name);
    if (body.species !== undefined || body.animal_type !== undefined || body.species_label !== undefined) {
      const animalType = cleanString(body.animal_type || body.species_label || body.species || existing.species_label || existing.species || "犬");
      const species = speciesFromAnimalType(animalType);
      patch.species = species;
      patch.species_label = animalType || speciesToLabel(species);
    }
    if (body.breed !== undefined) patch.breed = nullIfEmpty(body.breed);
    if (body.sex !== undefined) patch.sex = normalizePetSex(body.sex);
    if (body.birth_date !== undefined) patch.birth_date = nullIfEmpty(body.birth_date);
    if (body.weight_kg !== undefined) patch.weight_kg = body.weight_kg === "" || body.weight_kg === null ? null : Number(body.weight_kg);
    if (body.neutered_status !== undefined) patch.neutered_status = cleanString(body.neutered_status) || "unknown";
    if (body.insurance_status !== undefined) patch.insurance_status = nullIfEmpty(body.insurance_status);
    if (body.allergies !== undefined) patch.allergies = nullIfEmpty(body.allergies);
    if (body.chronic_conditions !== undefined) patch.chronic_conditions = nullIfEmpty(body.chronic_conditions);
    if (body.caution_memo !== undefined) patch.caution_memo = nullIfEmpty(body.caution_memo);
    if (body.status !== undefined) patch.status = cleanString(body.status) || "active";
    patch.updated_at = new Date().toISOString();

    if (!patch.pet_name && body.pet_name !== undefined) {
      return errorResponse("ペット名は空にできません。", 400, { route: "step_vet_47_pet_update" });
    }

    const rows = await updateRows(env, TABLES.pets, {
      id: `eq.${petId}`,
      clinic_id: `eq.${clinic.id}`
    }, patch);

    const pet = Array.isArray(rows) ? rows[0] : rows;

    await logOperation(env, clinic.id, "staff", staffName, "pet_update", "pet", petId, {
      patch_keys: Object.keys(patch),
      pet_name: pet?.pet_name,
      guardian_id: pet?.guardian_id,
      worker_version: WORKER_VERSION
    });

    return jsonResponse({
      ok: true,
      message: "ペット情報を更新しました。",
      route: "step_vet_47_pet_update",
      worker_version: WORKER_VERSION,
      pet
    });
  } catch (error) {
    return errorResponse(error?.message || "ペット情報の更新に失敗しました。", 500, {
      route: "step_vet_47_pet_update",
      worker_version: WORKER_VERSION
    });
  }
}

async function handlePetCardManagementUpdate(request, env) {
  // STEP VET-47:
  // 診察券の有効/停止を切り替える。
  try {
    const body = await readJson(request);
    const clinicCode = getRequestedClinicCode(request, body);
    const clinic = await getClinicByCode(env, clinicCode);
    const cardId = cleanString(body.card_id || body.pet_card_id);
    const petId = cleanString(body.pet_id);
    const staffName = cleanString(body.staff_name || body.actor_name) || "受付スタッフ";

    if (!cardId && !petId) {
      return errorResponse("card_id または pet_id が必要です。", 400, { route: "step_vet_47_pet_card_update" });
    }

    const query = { clinic_id: `eq.${clinic.id}` };
    if (cardId) query.id = `eq.${cardId}`;
    if (petId) query.pet_id = `eq.${petId}`;

    const patch = {};
    if (body.card_enabled !== undefined) {
      patch.card_enabled = Boolean(body.card_enabled);
    }
    if (body.note !== undefined) {
      patch.note = nullIfEmpty(body.note);
    }
    patch.updated_at = new Date().toISOString();

    const rows = await updateRows(env, TABLES.petCards, query, patch);
    const cards = Array.isArray(rows) ? rows : [rows].filter(Boolean);

    await logOperation(env, clinic.id, "staff", staffName, "pet_card_update", "pet_card", cardId || petId, {
      patch_keys: Object.keys(patch),
      card_count: cards.length,
      worker_version: WORKER_VERSION
    });

    return jsonResponse({
      ok: true,
      message: "診察券情報を更新しました。",
      route: "step_vet_47_pet_card_update",
      worker_version: WORKER_VERSION,
      cards
    });
  } catch (error) {
    return errorResponse(error?.message || "診察券情報の更新に失敗しました。", 500, {
      route: "step_vet_47_pet_card_update",
      worker_version: WORKER_VERSION
    });
  }
}


async function handleStaffProxyGuardianPetRegister(request, env) {
  // STEP VET-45:
  // 受付スタッフが、新規の飼い主＋ペットを代理登録する。
  // LINEが苦手な方、スマホを持っていない方、受付で代わりに登録する方に対応。
  try {
    const body = await readJson(request);
    const clinicCode = getRequestedClinicCode(request, body);
    const clinic = await getClinicByCode(env, clinicCode);

    const guardianName = cleanString(body.guardian_name || body.owner_name || body.customer_name);
    const phone = cleanString(body.phone || body.tel || body.mobile);
    const petName = cleanString(body.pet_name);
    const animalType = cleanString(body.animal_type || body.species_label || body.species || "犬");
    const species = speciesFromAnimalType(animalType);
    const breed = nullIfEmpty(body.breed);
    const sex = normalizePetSex(body.sex);
    const ageText = nullIfEmpty(body.age_text || body.age);
    const staffName = cleanString(body.staff_name || body.actor_name) || "受付スタッフ";
    const memo = cleanString(body.memo || body.staff_note || body.registration_memo || "");

    if (!guardianName) return errorResponse("飼い主名が必要です。", 400, { route: "step_vet_45_staff_proxy_register" });
    if (!petName) return errorResponse("ペット名が必要です。", 400, { route: "step_vet_45_staff_proxy_register" });

    const guardianNo = cleanString(body.guardian_no) || await nextGuardianNo(env, clinic.id);

    const guardianRows = await insertRows(env, TABLES.guardians, {
      clinic_id: clinic.id,
      guardian_no: guardianNo,
      guardian_name: guardianName,
      guardian_kana: nullIfEmpty(body.guardian_kana),
      phone: nullIfEmpty(normalizePhoneForSave(phone)),
      email: nullIfEmpty(body.email),
      line_user_id: null,
      line_display_name: null,
      line_picture_url: null,
      line_link_status: "unlinked",
      preferred_contact: normalizePreferredContactForVet(phone ? "phone" : "line", "line"),
      memo: nullIfEmpty([
        "スタッフ代理登録",
        memo
      ].filter(Boolean).join(" / ")),
      status: "active"
    });
    const guardian = Array.isArray(guardianRows) ? guardianRows[0] : guardianRows;

    const created = await createPetCardForGuardian(env, clinic, guardian, {
      pet_name: petName,
      animal_type: animalType,
      species,
      breed,
      sex,
      age_text: ageText,
      allergy_note: body.allergy_note || body.allergies,
      chronic_conditions: body.chronic_conditions,
      memo,
      note_prefix: "STEP VET-45 スタッフ代理登録・LINE未連携"
    });

    let reception = null;
    if (Boolean(body.create_reception)) {
      reception = await createReceptionForExistingPetCore(env, clinic, guardian, created.pet, created.card_view || created.card, {
        reception_source: body.reception_source || "counter",
        request_category: body.request_category || "general_exam",
        entry_kind: body.entry_kind || "today_queue",
        target_date: body.target_date || body.date || todayJST(),
        day_part: body.day_part || "morning",
        visit_time: body.visit_time || "",
        purpose: body.purpose || "スタッフ代理登録：通常診察",
        memo: memo || cleanString(body.reception_memo || ""),
        staff_name: staffName,
        source_label_prefix: "スタッフ代理登録"
      });
    }

    await logOperation(env, clinic.id, "staff", staffName, "staff_proxy_guardian_pet_register", "pet", created.pet.id, {
      guardian_id: guardian.id,
      pet_id: created.pet.id,
      pet_name: created.pet.pet_name,
      guardian_name: guardian.guardian_name,
      phone,
      create_reception: Boolean(body.create_reception),
      worker_version: WORKER_VERSION
    });

    return jsonResponse({
      ok: true,
      message: "スタッフ代理登録で飼い主・ペットを作成しました。",
      route: "step_vet_45_staff_proxy_register",
      worker_version: WORKER_VERSION,
      clinic,
      guardian,
      pet: created.pet,
      card: created.card,
      card_view: created.card_view,
      reception,
      line_status: "unlinked",
      note: "LINE未連携の飼い主・ペットとしてスタッフ代理登録しました。"
    });
  } catch (error) {
    return errorResponse(error?.message || "スタッフ代理登録に失敗しました。", 500, {
      route: "step_vet_45_staff_proxy_register",
      worker_version: WORKER_VERSION,
      error_name: error && error.name ? error.name : "",
      error_stack_head: error && error.stack ? String(error.stack).split("\n").slice(0, 3).join("\n") : ""
    });
  }
}

async function handleExistingGuardianPetAdd(request, env) {
  // STEP VET-45:
  // 既存の飼い主に新しいペットを追加する。
  // 多頭飼い・新しく迎えた子・受付スタッフ代理入力に対応。
  try {
    const body = await readJson(request);
    const clinicCode = getRequestedClinicCode(request, body);
    const clinic = await getClinicByCode(env, clinicCode);

    const guardianId = cleanString(body.guardian_id || body.owner_id);
    const petName = cleanString(body.pet_name);
    const animalType = cleanString(body.animal_type || body.species_label || body.species || "犬");
    const species = speciesFromAnimalType(animalType);
    const breed = nullIfEmpty(body.breed);
    const sex = normalizePetSex(body.sex);
    const ageText = nullIfEmpty(body.age_text || body.age);
    const staffName = cleanString(body.staff_name || body.actor_name) || "受付スタッフ";
    const memo = cleanString(body.memo || body.staff_note || body.registration_memo || "");

    if (!guardianId) return errorResponse("guardian_id が必要です。検索結果から飼い主を選んでください。", 400, { route: "step_vet_45_existing_guardian_pet_add" });
    if (!petName) return errorResponse("ペット名が必要です。", 400, { route: "step_vet_45_existing_guardian_pet_add" });

    const guardian = await getGuardianById(env, guardianId);
    if (!guardian || guardian.clinic_id !== clinic.id) {
      return errorResponse("飼い主情報が見つかりません。", 404, { route: "step_vet_45_existing_guardian_pet_add" });
    }

    const created = await createPetCardForGuardian(env, clinic, guardian, {
      pet_name: petName,
      animal_type: animalType,
      species,
      breed,
      sex,
      age_text: ageText,
      allergy_note: body.allergy_note || body.allergies,
      chronic_conditions: body.chronic_conditions,
      memo,
      note_prefix: "STEP VET-45 既存飼い主へペット追加"
    });

    let reception = null;
    if (Boolean(body.create_reception)) {
      reception = await createReceptionForExistingPetCore(env, clinic, guardian, created.pet, created.card_view || created.card, {
        reception_source: body.reception_source || "counter",
        request_category: body.request_category || "general_exam",
        entry_kind: body.entry_kind || "today_queue",
        target_date: body.target_date || body.date || todayJST(),
        day_part: body.day_part || "morning",
        visit_time: body.visit_time || "",
        purpose: body.purpose || "ペット追加後受付：通常診察",
        memo: memo || cleanString(body.reception_memo || ""),
        staff_name: staffName,
        source_label_prefix: "ペット追加後受付"
      });
    }

    await logOperation(env, clinic.id, "staff", staffName, "existing_guardian_pet_add", "pet", created.pet.id, {
      guardian_id: guardian.id,
      pet_id: created.pet.id,
      pet_name: created.pet.pet_name,
      guardian_name: guardian.guardian_name,
      create_reception: Boolean(body.create_reception),
      worker_version: WORKER_VERSION
    });

    return jsonResponse({
      ok: true,
      message: "既存の飼い主にペットを追加しました。",
      route: "step_vet_45_existing_guardian_pet_add",
      worker_version: WORKER_VERSION,
      clinic,
      guardian,
      pet: created.pet,
      card: created.card,
      card_view: created.card_view,
      reception,
      line_status: guardian.line_link_status || "unlinked",
      note: "既存の飼い主に新しいペットを追加しました。"
    });
  } catch (error) {
    return errorResponse(error?.message || "既存飼い主へのペット追加に失敗しました。", 500, {
      route: "step_vet_45_existing_guardian_pet_add",
      worker_version: WORKER_VERSION,
      error_name: error && error.name ? error.name : "",
      error_stack_head: error && error.stack ? String(error.stack).split("\n").slice(0, 3).join("\n") : ""
    });
  }
}

async function createPetCardForGuardian(env, clinic, guardian, options) {
  const petNo = cleanString(options.pet_no) || await nextPetNo(env, clinic.id);

  const petPayload = normalizePetPayload({
    pet_name: options.pet_name,
    species: options.species,
    species_label: options.animal_type || speciesToLabel(options.species || ""),
    breed: options.breed,
    sex: options.sex,
    age_text: options.age_text,
    allergies: nullIfEmpty(options.allergy_note),
    chronic_conditions: nullIfEmpty(options.chronic_conditions),
    caution_memo: nullIfEmpty([
      options.note_prefix,
      options.age_text ? `年齢 ${options.age_text}` : "",
      options.memo
    ].filter(Boolean).join(" / "))
  }, clinic.id, guardian.id, petNo);

  const petRows = await insertRows(env, TABLES.pets, petPayload);
  const pet = Array.isArray(petRows) ? petRows[0] : petRows;

  const cardNo = await nextCardNo(env, clinic.id);
  const qrToken = createToken("card");

  const cardRows = await insertRows(env, TABLES.petCards, {
    clinic_id: clinic.id,
    pet_id: pet.id,
    card_no: cardNo,
    qr_token: qrToken,
    card_enabled: true,
    note: options.note_prefix || "STEP VET-45 ペット追加"
  });
  const card = Array.isArray(cardRows) ? cardRows[0] : cardRows;

  let cardView = null;
  try {
    cardView = await selectSingle(env, TABLES.petCardView, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      pet_id: `eq.${pet.id}`,
      order: "card_no.asc",
      limit: 1
    });
  } catch (error) {
    cardView = null;
  }

  return { pet, card, card_view: cardView };
}

async function createReceptionForExistingPetCore(env, clinic, guardian, pet, card, options = {}) {
  const receptionSourceRaw = cleanString(options.reception_source || "counter");
  const receptionSource = receptionSourceRaw === "phone" || receptionSourceRaw === "telephone" ? "phone" : "counter";
  const sourceLabel = receptionSource === "phone" ? "電話受付" : "窓口受付";
  const prefix = cleanString(options.source_label_prefix || "スタッフ代理登録");
  const targetDate = normalizeQueueDate(options.target_date || todayJST());
  const dayPart = normalizeQueueDayPart(options.day_part || "morning", "morning");
  const requestCategory = normalizeQueueRequestCategory(options.request_category || "general_exam");
  const entryKind = normalizeQueueEntryKind(options.entry_kind || "today_queue");
  const visitTime = cleanString(options.visit_time || "");
  const memo = cleanString(options.memo || "");
  const categoryLabel = requestCategoryLabelForWorker(requestCategory);

  const existingActiveEntry = await findActiveSameDayQueueEntry(env, clinic.id, pet.id, targetDate);
  if (existingActiveEntry) {
    return {
      ok: true,
      duplicate: true,
      message: "同じペットの本日受付がすでにあります。",
      entry: existingActiveEntry
    };
  }

  const purpose = [
    `${prefix}${sourceLabel}`,
    visitTime ? `来院予定 ${visitTime}` : "",
    cleanString(options.purpose) || categoryLabel
  ].filter(Boolean).join("：");

  const lineStatus = cleanString(guardian.line_link_status || card?.line_link_status || "");
  const desiredContact = lineStatus === "linked" && guardian.line_user_id ? "line" : normalizePreferredContactForVet(receptionSource === "phone" ? "phone" : "line", "line");

  const questionnaire = {
    purpose: cleanString(options.purpose) || categoryLabel,
    reception_source: receptionSource,
    reception_source_label: `${prefix}${sourceLabel}`,
    visit_time: visitTime || null,
    staff_memo: memo || null,
    free_text: memo || null,
    staff_proxy_registration: prefix.includes("代理"),
    pet_added_now: prefix.includes("ペット追加"),
    line_link_status: lineStatus || null
  };

  // STEP VET-52.5J:
  // スタッフ代理登録・既存ペット受付でも、飼い主側受付と同じく
  // 「今日の最大受付番号 + 1」を先に確保します。
  // RPC側が異常な番号を返しても、後段でこの番号へ補正します。
  const safeQueueNumber = await getNextSafeQueueNumberForDay(env, clinic.id, targetDate);

  const rpcRows = await supabaseRpc(env, "vet_create_waiting_entry", {
    p_clinic_code: clinic.clinic_code,
    p_guardian_id: guardian.id,
    p_pet_id: pet.id,
    p_entry_kind: entryKind,
    p_request_category: requestCategory,
    p_target_date: targetDate,
    p_day_part: dayPart,
    p_purpose: purpose,
    p_symptoms_summary: memo || purpose,
    p_desired_contact: desiredContact,
    p_source: "counter",
    p_questionnaire: questionnaire
  });

  const created = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
  const waitingEntryId = created?.waiting_entry_id || created?.id || null;

  const safeNumberRow = waitingEntryId
    ? await forceSafeQueueNumberIfNeeded(env, clinic.id, targetDate, waitingEntryId, safeQueueNumber)
    : null;

  let detail = waitingEntryId ? await selectSingle(env, TABLES.waitingEntriesDetailView, {
    select: "*",
    waiting_entry_id: `eq.${waitingEntryId}`
  }) : null;

  if (detail && safeNumberRow && safeNumberRow.queue_number) {
    detail = { ...detail, queue_number: safeNumberRow.queue_number };
  }

  const targetStatus = receptionSource === "phone" ? "reserved" : "checked_in";
  if (waitingEntryId) {
    try {
      await supabaseRpc(env, "vet_update_waiting_entry_status", {
        p_waiting_entry_id: waitingEntryId,
        p_status: targetStatus,
        p_staff_note: [`${prefix}${sourceLabel}`, visitTime ? `来院予定 ${visitTime}` : "", memo].filter(Boolean).join(" / ")
      });
      detail = await selectSingle(env, TABLES.waitingEntriesDetailView, {
        select: "*",
        waiting_entry_id: `eq.${waitingEntryId}`
      });
    } catch (statusError) {
      detail = detail || null;
    }
  }

  const summaryRows = await getQueueSummaryRows(env, clinic.id, targetDate, dayPart);

  return {
    ok: true,
    duplicate: false,
    result: {
      ...(created || {}),
      queue_number: detail?.queue_number || safeNumberRow?.queue_number || created?.queue_number || safeQueueNumber,
      safe_queue_number_applied: Boolean(safeNumberRow && safeQueueNumber)
    },
    entry: detail,
    queue_number: detail?.queue_number || safeNumberRow?.queue_number || created?.queue_number || safeQueueNumber,
    summary: summaryRows[0] || buildEmptyQueueSummary(clinic, targetDate, dayPart),
    reception_source: receptionSource
  };
}


async function handleExistingPatientSearch(request, env) {
  // STEP VET-44:
  // 受付PCから、既存の飼い主・ペット・診察券を検索する。
  // まずは安全重視で vet_pet_card_view を医院内だけ最大500件読み、
  // Worker側でキーワード抽出する。大規模医院向けの高速化は後続STEPで
  // PostgreSQL検索関数・インデックス化する。
  try {
    const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
    const clinic = await getClinicByCode(env, clinicCode);
    const q = cleanString(getParam(request, "q", "") || getParam(request, "keyword", "") || getParam(request, "search", ""));
    const limit = normalizeLimit(getParam(request, "limit", "30"), 30, 80);

    const rows = await selectRows(env, TABLES.petCardView, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      order: "card_no.asc",
      limit: 500
    });

    const filtered = (rows || [])
      .filter((row) => isActiveSearchPetCard(row))
      .filter((row) => rowMatchesExistingPatientSearch(row, q));

    const deduped = [];
    const seen = new Set();

    for (const row of filtered) {
      const item = buildExistingPatientSearchItem(row);
      const key = item.pet_id || item.card_id || `${item.guardian_name}-${item.pet_name}-${item.card_no}`;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
      if (deduped.length >= limit) break;
    }

    const itemsWithPhotos = await enrichPatientSearchItemsWithPetPhotos(env, deduped);

    return jsonResponse({
      ok: true,
      route: "step_vet_44_existing_patient_search",
      worker_version: WORKER_VERSION,
      clinic,
      query: q,
      count: itemsWithPhotos.length,
      total_scanned: rows.length,
      items: itemsWithPhotos,
      note: "既存患者検索結果です。写真登録済みのペットは検索結果にも写真アイコンを返します。"
    });
  } catch (error) {
    return errorResponse(error?.message || "既存患者検索に失敗しました。", 500, {
      route: "step_vet_44_existing_patient_search",
      worker_version: WORKER_VERSION
    });
  }
}

function isActiveSearchPetCard(row) {
  const petStatus = cleanString(row?.pet_status || row?.status || "active");
  const cardEnabled = row?.card_enabled;
  if (petStatus && petStatus !== "active") return false;
  if (cardEnabled === false || String(cardEnabled).toLowerCase() === "false") return false;
  return true;
}

function normalizeSearchTextForWorker(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[　\s\-ー―−()（）]/g, "");
}

function digitsOnlyForWorker(value) {
  return normalizePhoneForSearch(value);
}

function rowMatchesExistingPatientSearch(row, q) {
  const query = cleanString(q);
  if (!query) return true;

  const norm = normalizeSearchTextForWorker(query);
  const digits = digitsOnlyForWorker(query);

  const values = [
    row.guardian_name,
    row.owner_name,
    row.customer_name,
    row.guardian_kana,
    row.phone,
    row.tel,
    row.mobile,
    row.pet_name,
    row.pet_kana,
    row.card_no,
    row.pet_no,
    row.guardian_no,
    row.species_label,
    row.species,
    row.breed
  ];

  const blob = normalizeSearchTextForWorker(values.filter(Boolean).join(" "));
  if (norm && blob.includes(norm)) return true;

  if (digits) {
    const phoneBlob = digitsOnlyForWorker(values.filter(Boolean).join(" "));
    if (phoneBlob.includes(digits)) return true;
  }

  return false;
}

function buildExistingPatientSearchItem(row) {
  const lineStatus = cleanString(
    row.line_link_status ||
    row.guardian_line_link_status ||
    row.line_status ||
    ""
  ) || "unlinked";

  return {
    guardian_id: row.guardian_id || row.owner_id || null,
    guardian_no: row.guardian_no || null,
    guardian_name: row.guardian_name || row.owner_name || row.customer_name || "飼い主",
    phone: row.phone || row.guardian_phone || row.tel || row.mobile || "",
    line_user_id: row.line_user_id || row.guardian_line_user_id || "",
    line_link_status: lineStatus,
    pet_id: row.pet_id || null,
    pet_no: row.pet_no || null,
    pet_name: row.pet_name || "ペット",
    species: row.species || "",
    species_label: row.species_label || speciesToLabel(row.species || "") || "",
    breed: row.breed || "",
    photo_url: row.photo_url || row.pet_photo_url || row.pet_image_url || "",
    pet_photo_url: row.pet_photo_url || row.photo_url || row.pet_image_url || "",
    photo_storage_path: row.photo_storage_path || row.pet_photo_storage_path || "",
    pet_photo_storage_path: row.pet_photo_storage_path || row.photo_storage_path || "",
    photo_updated_at: row.photo_updated_at || row.pet_photo_updated_at || "",
    pet_photo_updated_at: row.pet_photo_updated_at || row.photo_updated_at || "",
    has_pet_photo: Boolean(row.photo_url || row.pet_photo_url || row.pet_image_url),
    card_id: row.card_id || row.pet_card_id || row.id || null,
    card_no: row.card_no || "",
    card_token: row.qr_token || row.card_token || "",
    qr_token: row.qr_token || row.card_token || "",
    card_enabled: row.card_enabled !== false,
    pet_status: row.pet_status || row.status || "active"
  };
}


function buildPetPhotoPayload(row) {
  if (!row) return {};
  const photoUrl = row.photo_url || row.pet_photo_url || row.pet_image_url || "";
  const storagePath = row.photo_storage_path || row.pet_photo_storage_path || "";
  const updatedAt = row.photo_updated_at || row.pet_photo_updated_at || "";
  return {
    photo_url: photoUrl,
    pet_photo_url: photoUrl,
    photo_storage_path: storagePath,
    pet_photo_storage_path: storagePath,
    photo_updated_at: updatedAt,
    pet_photo_updated_at: updatedAt,
    has_pet_photo: Boolean(photoUrl)
  };
}

function mergePetPhotoPayload(item, photo) {
  const payload = buildPetPhotoPayload(photo);
  if (!payload.photo_url) return item;
  return {
    ...item,
    ...payload
  };
}

async function buildPetPhotoMapByPetIds(env, petIds) {
  const ids = Array.from(new Set((petIds || []).map(cleanString).filter(isUuidLike)));
  const map = new Map();
  if (!ids.length) return map;

  const chunkSize = 80;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const rows = await selectRows(env, TABLES.pets, {
      select: "id,photo_url,photo_storage_path,photo_updated_at",
      id: `in.(${chunk.join(",")})`,
      limit: chunk.length
    });
    (rows || []).forEach((row) => {
      map.set(row.id, buildPetPhotoPayload(row));
    });
  }
  return map;
}

async function enrichPatientSearchItemsWithPetPhotos(env, items) {
  const baseItems = Array.isArray(items) ? items : [];
  const missingPhotoPetIds = baseItems
    .filter((item) => !(item.photo_url || item.pet_photo_url))
    .map((item) => item.pet_id)
    .filter(Boolean);

  const photoMap = await buildPetPhotoMapByPetIds(env, missingPhotoPetIds);

  return baseItems.map((item) => {
    if (item.photo_url || item.pet_photo_url) return item;
    const photo = photoMap.get(item.pet_id);
    return photo ? mergePetPhotoPayload(item, photo) : item;
  });
}

async function handleExistingPetReceptionCreate(request, env) {
  // STEP VET-44:
  // 検索結果で選んだ既存ペットを、今日の受付一覧へ追加する。
  // 二重受付はSTEP VET-36E-R2の既存ガードをそのまま使う。
  try {
    const body = await readJson(request);
    const clinicCode = getRequestedClinicCode(request, body);
    const clinic = await getClinicByCode(env, clinicCode);

    const petId = cleanString(body.pet_id);
    const guardianIdFromBody = cleanString(body.guardian_id);
    const cardToken = cleanString(body.card_token || body.qr_token || body.token || "");
    const cardId = cleanString(body.card_id || body.pet_card_id || "");

    let card = null;

    if (cardToken) {
      card = await getCardByToken(env, clinic.id, cardToken);
    }

    if (!card && petId) {
      card = await selectSingle(env, TABLES.petCardView, {
        select: "*",
        clinic_id: `eq.${clinic.id}`,
        pet_id: `eq.${petId}`,
        order: "card_no.asc",
        limit: 1
      });
    }

    if (!card && cardId) {
      const cardBase = await selectSingle(env, TABLES.petCards, {
        select: "*",
        clinic_id: `eq.${clinic.id}`,
        id: `eq.${cardId}`,
        limit: 1
      });
      if (cardBase?.pet_id) {
        card = await selectSingle(env, TABLES.petCardView, {
          select: "*",
          clinic_id: `eq.${clinic.id}`,
          pet_id: `eq.${cardBase.pet_id}`,
          order: "card_no.asc",
          limit: 1
        });
      }
    }

    let finalPetId = petId || card?.pet_id || null;
    let finalGuardianId = guardianIdFromBody || card?.guardian_id || null;

    if (!finalPetId) {
      return errorResponse("pet_id を特定できませんでした。検索結果からペットを選び直してください。", 400, {
        route: "step_vet_44_existing_pet_reception_create"
      });
    }

    if (!finalGuardianId) {
      const pet = await getPetById(env, finalPetId);
      if (!pet || pet.clinic_id !== clinic.id) {
        return errorResponse("ペット情報が見つかりません。", 404, { route: "step_vet_44_existing_pet_reception_create" });
      }
      finalGuardianId = pet.guardian_id;
    }

    const guardian = finalGuardianId ? await getGuardianById(env, finalGuardianId) : null;
    const pet = finalPetId ? await getPetById(env, finalPetId) : null;

    if (!guardian || guardian.clinic_id !== clinic.id) {
      return errorResponse("飼い主情報が見つかりません。", 404, { route: "step_vet_44_existing_pet_reception_create" });
    }

    if (!pet || pet.clinic_id !== clinic.id) {
      return errorResponse("ペット情報が見つかりません。", 404, { route: "step_vet_44_existing_pet_reception_create" });
    }

    const targetDate = normalizeQueueDate(body.target_date || body.date || todayJST());
    const dayPart = normalizeQueueDayPart(body.day_part || body.session, "morning");
    const entryKind = normalizeQueueEntryKind(body.entry_kind || "today_queue");
    const requestCategory = normalizeQueueRequestCategory(body.request_category || body.category || "general_exam");
    const receptionSourceRaw = cleanString(body.reception_source || body.source_type || "counter");
    const receptionSource = receptionSourceRaw === "phone" || receptionSourceRaw === "telephone" ? "phone" : "counter";
    const visitTime = cleanString(body.visit_time || body.arrival_time || "");
    const memo = cleanString(body.memo || body.staff_note || body.reception_memo || "");
    const staffName = cleanString(body.staff_name || body.actor_name) || "受付PC";
    const sourceLabel = receptionSource === "phone" ? "電話受付" : "窓口受付";
    const lineStatus = cleanString(guardian.line_link_status || card?.line_link_status || "");
    const desiredContact = lineStatus === "linked" && guardian.line_user_id ? "line" : normalizePreferredContactForVet(receptionSource === "phone" ? "phone" : "line", "line");

    const existingActiveEntry = await findActiveSameDayQueueEntry(env, clinic.id, finalPetId, targetDate);
    if (existingActiveEntry) {
      const existingWaitingEntryId = cleanString(existingActiveEntry.waiting_entry_id || existingActiveEntry.id);
      if (receptionSource !== "phone" && existingWaitingEntryId) {
        await linkUniqueSameDayExactAppointmentToQueue(
          env,
          clinic,
          finalPetId,
          targetDate,
          existingWaitingEntryId,
          staffName
        );
      }
      return buildDuplicateQueueResponse(env, clinic, existingActiveEntry, targetDate, existingActiveEntry.day_part || dayPart, body);
    }

    const categoryLabel = requestCategoryLabelForWorker(requestCategory);
    const purpose = [
      `既存患者${sourceLabel}`,
      visitTime ? `来院予定 ${visitTime}` : "",
      cleanString(body.purpose) || categoryLabel
    ].filter(Boolean).join("：");

    const questionnaire = {
      purpose: cleanString(body.purpose) || categoryLabel,
      reception_source: receptionSource,
      reception_source_label: `既存患者${sourceLabel}`,
      visit_time: visitTime || null,
      staff_memo: memo || null,
      free_text: memo || null,
      existing_patient: true,
      line_link_status: lineStatus || null,
      emergency_flag: Boolean(body.emergency_flag)
    };

    const rpcRows = await supabaseRpc(env, "vet_create_waiting_entry", {
      p_clinic_code: clinic.clinic_code,
      p_guardian_id: finalGuardianId,
      p_pet_id: finalPetId,
      p_entry_kind: entryKind,
      p_request_category: requestCategory,
      p_target_date: targetDate,
      p_day_part: dayPart,
      p_purpose: purpose,
      p_symptoms_summary: memo || purpose,
      p_desired_contact: desiredContact,
      // INTEGRATED-6: 院内QR/窓口は正式source contractの counter として保存する。
      p_source: "counter",
      p_questionnaire: questionnaire
    });

    const created = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    const waitingEntryId = created?.waiting_entry_id || created?.id || null;

    let detail = waitingEntryId ? await selectSingle(env, TABLES.waitingEntriesDetailView, {
      select: "*",
      waiting_entry_id: `eq.${waitingEntryId}`
    }) : null;

    const targetStatus = receptionSource === "phone" ? "reserved" : "checked_in";
    if (waitingEntryId) {
      try {
        await supabaseRpc(env, "vet_update_waiting_entry_status", {
          p_waiting_entry_id: waitingEntryId,
          p_status: targetStatus,
          p_staff_note: [`既存患者${sourceLabel}`, visitTime ? `来院予定 ${visitTime}` : "", memo].filter(Boolean).join(" / ")
        });
        detail = await selectSingle(env, TABLES.waitingEntriesDetailView, {
          select: "*",
          waiting_entry_id: `eq.${waitingEntryId}`
        });
      } catch (statusError) {
        detail = detail || null;
      }
    }

    const exactAppointmentLink = receptionSource !== "phone" && waitingEntryId
      ? await linkUniqueSameDayExactAppointmentToQueue(
          env,
          clinic,
          finalPetId,
          targetDate,
          waitingEntryId,
          staffName
        )
      : { ok: true, linked: false, skipped: true, reason: receptionSource === "phone" ? "phone_reception" : "waiting_entry_id_missing" };

    const summaryRows = await getQueueSummaryRows(env, clinic.id, targetDate, dayPart);

    await logOperation(env, clinic.id, "staff", staffName, "existing_pet_reception_create", "waiting_entry", waitingEntryId || finalPetId, {
      guardian_id: finalGuardianId,
      pet_id: finalPetId,
      guardian_name: guardian.guardian_name,
      pet_name: pet.pet_name,
      reception_source: receptionSource,
      target_date: targetDate,
      day_part: dayPart,
      worker_version: WORKER_VERSION
    });

    return jsonResponse({
      ok: true,
      message: `既存患者の${sourceLabel}を追加しました。`,
      route: "step_vet_44_existing_pet_reception_create",
      worker_version: WORKER_VERSION,
      clinic,
      guardian,
      pet,
      card: card ? buildExistingPatientSearchItem(card) : null,
      result: created,
      entry: detail,
      summary: summaryRows[0] || buildEmptyQueueSummary(clinic, targetDate, dayPart),
      exact_appointment_link: exactAppointmentLink,
      reception_source: receptionSource,
      line_link_status: lineStatus || guardian.line_link_status || "unlinked",
      note: "既存患者検索から、このペットで受付しました。"
    });
  } catch (error) {
    const msg = error && error.message ? error.message : "既存患者の受付追加に失敗しました。";
    return errorResponse(msg, 500, {
      route: "step_vet_44_existing_pet_reception_create",
      worker_version: WORKER_VERSION,
      error_name: error && error.name ? error.name : "",
      error_stack_head: error && error.stack ? String(error.stack).split("\n").slice(0, 3).join("\n") : ""
    });
  }
}


async function handleManualReceptionCreate(request, env) {
  // STEP VET-43:
  // 窓口受付・電話受付・スタッフ代理登録をまとめて行う。
  //
  // 方針：
  // - 受付スタッフが飼い主・ペットを簡易登録する
  // - 診察券番号を発行する
  // - LINE未連携のまま今日の受付一覧へ追加する
  // - LINE連携済みの通常フローは壊さない
  //
  // 注意：
  // - 既存患者検索・既存ペットへの受付追加は STEP VET-44 で追加する
  // - このSTEPは「新規・未連携・代理受付」の入口
  try {
    const body = await readJson(request);
    const clinicCode = getRequestedClinicCode(request, body);
    const clinic = await getClinicByCode(env, clinicCode);

    const receptionSourceRaw = cleanString(body.reception_source || body.source_type || body.manual_source || "counter");
    const receptionSource = receptionSourceRaw === "phone" || receptionSourceRaw === "telephone" ? "phone" : "counter";

    const guardianName = cleanString(body.guardian_name || body.owner_name || body.customer_name);
    const phone = cleanString(body.phone || body.tel || body.mobile);
    const petName = cleanString(body.pet_name);
    const animalType = cleanString(body.animal_type || body.species_label || body.species || "犬");
    const species = speciesFromAnimalType(animalType);
    const breed = nullIfEmpty(body.breed);
    const sex = normalizePetSex(body.sex);
    const ageText = nullIfEmpty(body.age_text || body.age);
    const staffName = cleanString(body.staff_name || body.actor_name) || "受付スタッフ";

    if (!guardianName) return errorResponse("飼い主名が必要です。", 400, { route: "step_vet_43_manual_reception" });
    if (!petName) return errorResponse("ペット名が必要です。", 400, { route: "step_vet_43_manual_reception" });

    const targetDate = normalizeQueueDate(body.target_date || body.date || todayJST());
    const dayPart = normalizeQueueDayPart(body.day_part || body.session, "morning");
    const entryKind = normalizeQueueEntryKind(body.entry_kind || "today_queue");
    const requestCategory = normalizeQueueRequestCategory(body.request_category || body.category || "general_exam");
    const visitTime = cleanString(body.visit_time || body.arrival_time || body.scheduled_time);

    const sourceLabel = receptionSource === "phone" ? "電話受付" : "窓口受付";
    const desiredContact = normalizePreferredContactForVet(phone ? "phone" : "line", "line");
    const memo = cleanString(body.memo || body.staff_note || body.reception_memo || "");
    const purposeBase = cleanString(body.purpose || body.symptoms_summary || "");
    const purpose = [
      sourceLabel,
      visitTime ? `来院予定 ${visitTime}` : "",
      purposeBase || requestCategoryLabelForWorker(requestCategory)
    ].filter(Boolean).join("：");

    const guardianNo = cleanString(body.guardian_no) || await nextGuardianNo(env, clinic.id);

    const guardianRows = await insertRows(env, TABLES.guardians, {
      clinic_id: clinic.id,
      guardian_no: guardianNo,
      guardian_name: guardianName,
      guardian_kana: nullIfEmpty(body.guardian_kana),
      phone: nullIfEmpty(normalizePhoneForSave(phone)),
      email: nullIfEmpty(body.email),
      line_user_id: null,
      line_display_name: null,
      line_picture_url: null,
      line_link_status: "unlinked",
      preferred_contact: normalizePreferredContactForVet(phone ? "phone" : "line", "line"),
      memo: nullIfEmpty([
        sourceLabel,
        visitTime ? `来院予定 ${visitTime}` : "",
        memo
      ].filter(Boolean).join(" / ")),
      status: "active"
    });
    const guardian = Array.isArray(guardianRows) ? guardianRows[0] : guardianRows;

    const petNo = cleanString(body.pet_no) || await nextPetNo(env, clinic.id);
    const petPayload = normalizePetPayload({
      pet_name: petName,
      species,
      species_label: animalType || speciesToLabel(species),
      breed,
      sex,
      age_text: ageText,
      allergies: nullIfEmpty(body.allergy_note || body.allergies),
      chronic_conditions: nullIfEmpty(body.chronic_conditions),
      caution_memo: nullIfEmpty([
        sourceLabel,
        ageText ? `年齢 ${ageText}` : "",
        memo
      ].filter(Boolean).join(" / "))
    }, clinic.id, guardian.id, petNo);

    const petRows = await insertRows(env, TABLES.pets, petPayload);
    const pet = Array.isArray(petRows) ? petRows[0] : petRows;

    const cardNo = cleanString(body.card_no) || await nextCardNo(env, clinic.id);
    const qrToken = cleanString(body.card_token || body.qr_token) || createToken("card");

    const cardRows = await insertRows(env, TABLES.petCards, {
      clinic_id: clinic.id,
      pet_id: pet.id,
      card_no: cardNo,
      qr_token: qrToken,
      card_enabled: true,
      note: `STEP VET-43 ${sourceLabel}・LINE未連携`
    });
    const card = Array.isArray(cardRows) ? cardRows[0] : cardRows;

    const questionnaire = {
      purpose: purposeBase || null,
      reception_source: receptionSource,
      reception_source_label: sourceLabel,
      visit_time: visitTime || null,
      phone: normalizePhoneForSave(phone) || null,
      staff_memo: memo || null,
      free_text: memo || purposeBase || null,
      emergency_flag: Boolean(body.emergency_flag)
    };

    const createdRows = await supabaseRpc(env, "vet_create_waiting_entry", {
      p_clinic_code: clinic.clinic_code,
      p_guardian_id: guardian.id,
      p_pet_id: pet.id,
      p_entry_kind: entryKind,
      p_request_category: requestCategory,
      p_target_date: targetDate,
      p_day_part: dayPart,
      p_purpose: purpose,
      p_symptoms_summary: memo || purposeBase || sourceLabel,
      p_desired_contact: desiredContact,
      // 既存DBの source 制約に当たりにくいよう、受付PCで既に動作確認済みの qr_reception を使う。
      // 実際の区分は purpose / questionnaire / guardian.memo に残す。
      p_source: "counter",
      p_questionnaire: questionnaire
    });

    const created = Array.isArray(createdRows) ? createdRows[0] : createdRows;
    const waitingEntryId = created?.waiting_entry_id || created?.id || null;

    let detail = waitingEntryId ? await selectSingle(env, TABLES.waitingEntriesDetailView, {
      select: "*",
      waiting_entry_id: `eq.${waitingEntryId}`
    }) : null;

    // 窓口は「院内受付済み」、電話は「予約済み/来院待ち」にする。
    // 失敗しても受付登録自体は成功として返す。
    const targetStatus = receptionSource === "phone" ? "reserved" : "checked_in";
    if (waitingEntryId) {
      try {
        await supabaseRpc(env, "vet_update_waiting_entry_status", {
          p_waiting_entry_id: waitingEntryId,
          p_status: targetStatus,
          p_staff_note: [sourceLabel, visitTime ? `来院予定 ${visitTime}` : "", memo].filter(Boolean).join(" / ")
        });
        detail = await selectSingle(env, TABLES.waitingEntriesDetailView, {
          select: "*",
          waiting_entry_id: `eq.${waitingEntryId}`
        });
      } catch (statusError) {
        // status更新だけ失敗しても、受付追加は成功扱いにする。
        detail = detail || null;
      }
    }

    const summaryRows = await getQueueSummaryRows(env, clinic.id, targetDate, dayPart);

    await logOperation(env, clinic.id, "staff", staffName, "manual_reception_create", "waiting_entry", waitingEntryId || pet.id, {
      reception_source: receptionSource,
      source_label: sourceLabel,
      guardian_name: guardianName,
      pet_name: petName,
      phone: normalizePhoneForSave(phone),
      target_date: targetDate,
      day_part: dayPart,
      visit_time: visitTime || null,
      worker_version: WORKER_VERSION
    });

    return jsonResponse({
      ok: true,
      message: `${sourceLabel}を追加しました。`,
      route: "step_vet_43_manual_reception_create",
      worker_version: WORKER_VERSION,
      clinic,
      reception_source: receptionSource,
      reception_source_label: sourceLabel,
      guardian,
      pet,
      card,
      result: created,
      entry: detail,
      summary: summaryRows[0] || buildEmptyQueueSummary(clinic, targetDate, dayPart),
      line_status: "unlinked",
      note: "LINE未連携の飼い主・ペットとして受付PCから追加しました。既存患者検索はSTEP VET-44で追加します。"
    });
  } catch (error) {
    const msg = error && error.message ? error.message : "窓口・電話受付の追加に失敗しました。";
    return errorResponse(msg, 500, {
      route: "step_vet_43_manual_reception_create",
      worker_version: WORKER_VERSION,
      hint: msg.includes("vet_create_waiting_entry")
        ? "受付登録RPCまたはDB制約を確認してください。"
        : (msg.includes("duplicate key") ? "採番重複の可能性があります。再度実行してください。" : ""),
      error_name: error && error.name ? error.name : "",
      error_stack_head: error && error.stack ? String(error.stack).split("\n").slice(0, 3).join("\n") : ""
    });
  }
}

function requestCategoryLabelForWorker(value) {
  const map = {
    general_exam: "通常診察",
    recheck: "再診",
    vaccination: "予防接種",
    prevention_medicine: "予防薬",
    medicine_food: "お薬・フード",
    hygiene_care: "衛生処置",
    health_check: "健康診断",
    grooming: "トリミング",
    surgery: "手術相談",
    other: "その他"
  };
  return map[value] || "通常診察";
}


async function handleQueueStatusUpdate(request, env) {
  let body = {};
  let waitingEntryId = "";
  let status = "waiting";
  let staffNote = null;

  try {
    body = await readJson(request);
    waitingEntryId = cleanString(body.waiting_entry_id || body.id);
    if (!waitingEntryId) return errorResponse("waiting_entry_id が必要です。", 400, {
      route: "queue_status_update_step_vet_52_5c",
      worker_version: WORKER_VERSION
    });

    status = normalizeQueueStatus(body.status, "waiting");
    if (status === "canceled") status = "cancelled";
    if (status === "noshow") status = "no_show";

    staffNote = nullIfEmpty(body.staff_note || body.memo || body.reception_memo);

    let rpcResult = null;
    let usedDirectFallback = false;
    let rpcErrorMessage = "";

    // STEP VET-52.5C:
    // 既存のRPCを優先する。ただし accounting=会計待ち などでRPC側の型・制約が古い場合、
    // ブラウザにはCORSに見える Failed to fetch が出ることがあるため、Worker内で必ず捕捉する。
    try {
      rpcResult = await supabaseRpc(env, "vet_update_waiting_entry_status", {
        p_waiting_entry_id: waitingEntryId,
        p_status: status,
        p_staff_note: staffNote
      });
    } catch (rpcError) {
      rpcErrorMessage = rpcError && rpcError.message ? rpcError.message : "RPC status update failed.";

      // RPCが古い場合の安全なフォールバック。
      // vet_waiting_entries 本体の status と last_action_at だけを更新する。
      const directRows = await updateRows(env, TABLES.waitingEntries, { id: `eq.${waitingEntryId}` }, {
        status,
        last_action_at: new Date().toISOString()
      });

      rpcResult = Array.isArray(directRows) ? directRows[0] : directRows;
      usedDirectFallback = true;
    }

    const detail = await selectSingle(env, TABLES.waitingEntriesDetailView, {
      select: "*",
      waiting_entry_id: `eq.${waitingEntryId}`
    });

    let summary = null;
    if (detail?.clinic_id && detail?.target_date) {
      try {
        const summaryRows = await getQueueSummaryRows(env, detail.clinic_id, detail.target_date, detail.day_part || "morning");
        summary = summaryRows?.[0] || null;
      } catch (summaryError) {
        summary = null;
      }
    }

    if (detail?.clinic_id) {
      try {
        await logOperation(env, detail.clinic_id, "staff", cleanString(body.staff_name) || "スタッフ", "queue_status_update", "waiting_entry", waitingEntryId, {
          status,
          status_label: queueStatusLabelForWorker(status),
          staffNote,
          used_direct_fallback: usedDirectFallback,
          rpc_error_message: rpcErrorMessage,
          worker_version: WORKER_VERSION
        });
      } catch (logError) {
        // 操作ログの失敗で受付ステータス更新自体を失敗扱いにしない。
      }
    }

    const exactAppointmentSync = await syncLinkedExactAppointmentFromQueue(
      env, waitingEntryId, status, cleanString(body.staff_name) || "受付連動"
    );

    return jsonResponse({
      ok: true,
      message: `受付ステータスを「${queueStatusLabelForWorker(status)}」に更新しました。`,
      route: "queue_status_update_step_vet_52_5c",
      worker_version: WORKER_VERSION,
      status,
      status_label: queueStatusLabelForWorker(status),
      used_direct_fallback: usedDirectFallback,
      rpc_error_message: rpcErrorMessage,
      result: Array.isArray(rpcResult) ? rpcResult[0] : rpcResult,
      entry: detail,
      summary,
      exact_appointment_sync: exactAppointmentSync
    });
  } catch (error) {
    const message = error && error.message ? error.message : "受付ステータス更新に失敗しました。";
    return errorResponse(message, 500, {
      route: "queue_status_update_step_vet_52_5c",
      worker_version: WORKER_VERSION,
      waiting_entry_id: waitingEntryId || null,
      requested_status: status || null,
      requested_status_label: status ? queueStatusLabelForWorker(status) : null,
      hint: message.includes("check constraint") || message.includes("violates")
        ? "DB側の vet_waiting_entries.status の制約に accounting / checked_in / examining / completed 等が含まれているか確認してください。"
        : "Worker側でエラーを捕捉しました。CORSではなく、このJSONのmessageが原因です。",
      error_name: error && error.name ? error.name : "",
      error_stack_head: error && error.stack ? String(error.stack).split("\n").slice(0, 3).join("\n") : ""
    });
  }
}

async function handleQueueCongestionSave(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const targetDate = normalizeQueueDate(body.target_date || body.date || todayJST());
  const dayPart = normalizeQueueDayPart(body.day_part || "morning", "morning");

  const payload = {
    clinic_id: clinic.id,
    target_date: targetDate,
    day_part: dayPart,
    manual_override: toBool(body.manual_override, false),
    manual_level: normalizeManualCongestionLevel(body.manual_level || body.level),
    manual_message: nullIfEmpty(body.manual_message || body.message),
    current_exam_number: body.current_exam_number === undefined || body.current_exam_number === null || body.current_exam_number === "" ? null : Number(body.current_exam_number),
    reception_closed: toBool(body.reception_closed, false),
    closed_reason: nullIfEmpty(body.closed_reason),
    source: cleanString(body.source || "staff") || "staff"
  };

  const rows = await upsertRows(env, TABLES.congestionStatus, payload, "clinic_id,target_date,day_part");
  const status = rows?.[0] || rows;
  const summaryRows = await getQueueSummaryRows(env, clinic.id, targetDate, dayPart);

  await logOperation(env, clinic.id, "staff", cleanString(body.staff_name) || "スタッフ", "queue_congestion_save", "congestion_status", status?.id || clinic.id, payload);

  return jsonResponse({
    ok: true,
    message: "混雑目安を保存しました。",
    clinic,
    congestion_status: status,
    summary: summaryRows[0] || buildEmptyQueueSummary(clinic, targetDate, dayPart)
  });
}

async function handleQueueDemoReset(request, env) {
  const body = await readJson(request);
  const guard = assertDemoOperationAllowed(request, env, body);
  if (!guard.ok) return errorResponse(guard.message, guard.status, { safety: guard.safety });

  const clinicCode = getRequestedClinicCode(request, body);
  const result = await supabaseRpc(env, "vet_reset_queue_demo_data", {
    p_clinic_code: clinicCode
  });

  const clinic = await getClinicByCode(env, clinicCode);
  await logOperation(env, clinic.id, "admin", cleanString(body.staff_name) || "管理者", "queue_demo_reset", "vet_queue", clinic.id, { result });

  return jsonResponse({
    ok: true,
    message: "STEP VET-14/15 の順番受付DEMOデータをリセットしました。再投入はSTEP VET-14 SQLを再実行してください。",
    safety: guard.safety,
    result
  });
}

// =========================================================
// Admin settings
// =========================================================

async function handleSettingsGet(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const clinic = await getClinicByCode(env, clinicCode);
  const settings = await getClinicSettings(env, clinic.id);
  const regular_hours = await getRegularHours(env, clinic.id);
  const special_days = await getSpecialDays(env, clinic.id, todayJST(), addMonths(todayJST(), 3));
  return jsonResponse({
    ok: true,
    clinic,
    settings: {
      ...(settings || {}),
      feature_switch_version: FEATURE_SWITCH_VERSION,
      feature_preset: normalizeFeaturePreset(settings?.feature_preset || "standard"),
      feature_flags: normalizeFeatureFlags(settings?.feature_flags),
      questionnaire_modules: normalizeQuestionnaireModules(settings?.questionnaire_modules),
      web_questionnaire_version: WEB_QUESTIONNAIRE_VERSION
    },
    regular_hours,
    special_days
  });
}

async function handleSettingsSave(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);

  const clinicPayload = {};
  [
    "clinic_name",
    "display_name",
    "phone",
    "address",
    "business_hours_note",
    "closed_days_note",
    "public_note",
    "internal_note"
  ].forEach((key) => {
    if (body[key] !== undefined) clinicPayload[key] = body[key];
  });

  let updatedClinic = clinic;
  if (Object.keys(clinicPayload).length) {
    const rows = await updateRows(env, TABLES.clinics, { id: `eq.${clinic.id}` }, clinicPayload);
    updatedClinic = rows?.[0] || rows || clinic;
  }

  const settingsPayload = {};
  [
    "appointment_max_months_ahead",
    "appointment_min_days_ahead",
    "appointment_slot_minutes",
    "default_visit_duration_minutes",
    "allow_same_day_appointment",
    "use_regular_hours",
    "use_special_days",
    "checkin_enabled",
    "line_liff_enabled",
    "public_site_url",
    "liff_id",
    "liff_url",
    "worker_public_url",
    "public_note",
    "internal_note",
    "rich_menu_note"
  ].forEach((key) => {
    if (body[key] !== undefined) settingsPayload[key] = body[key];
  });

  if (body.feature_preset !== undefined) {
    settingsPayload.feature_preset = normalizeFeaturePreset(body.feature_preset);
  }
  if (body.feature_flags !== undefined) {
    settingsPayload.feature_flags = normalizeFeatureFlags(body.feature_flags);
  }
  if (body.questionnaire_modules !== undefined) {
    settingsPayload.questionnaire_modules = normalizeQuestionnaireModules(body.questionnaire_modules);
  }

  let updatedSettings = await getClinicSettings(env, clinic.id);
  if (Object.keys(settingsPayload).length) {
    const rows = await updateRows(env, TABLES.clinicSettings, { clinic_id: `eq.${clinic.id}` }, settingsPayload);
    updatedSettings = rows?.[0] || rows || updatedSettings;
  }

  if (Array.isArray(body.regular_hours)) {
    const regularPayload = body.regular_hours.map((row) => normalizeRegularHourPayload(row, clinic.id));
    await upsertRows(env, TABLES.regularHours, regularPayload, "clinic_id,day_of_week");
  }

  await logOperation(env, clinic.id, "owner", cleanString(body.staff_name) || "管理者", "settings_save", "clinic", clinic.id, {
    feature_switch_version: FEATURE_SWITCH_VERSION,
    feature_preset: updatedSettings?.feature_preset || "standard",
    feature_flags_changed: body.feature_flags !== undefined,
    questionnaire_modules_changed: body.questionnaire_modules !== undefined
  });

  return jsonResponse({
    ok: true,
    message: "設定を保存しました。",
    clinic: updatedClinic,
    settings: {
      ...(updatedSettings || {}),
      feature_switch_version: FEATURE_SWITCH_VERSION,
      feature_preset: normalizeFeaturePreset(updatedSettings?.feature_preset || "standard"),
      feature_flags: normalizeFeatureFlags(updatedSettings?.feature_flags),
      questionnaire_modules: normalizeQuestionnaireModules(updatedSettings?.questionnaire_modules),
      web_questionnaire_version: WEB_QUESTIONNAIRE_VERSION
    },
    regular_hours: await getRegularHours(env, clinic.id)
  });
}

function normalizeRegularHourPayload(row, clinicId) {
  const isClosed = row.is_closed === true || row.is_closed === "true";
  return {
    clinic_id: clinicId,
    day_of_week: Number(row.day_of_week),
    is_closed: isClosed,
    open_time_1: isClosed ? null : normalizeTime(row.open_time_1),
    close_time_1: isClosed ? null : normalizeTime(row.close_time_1),
    open_time_2: isClosed ? null : normalizeTime(row.open_time_2),
    close_time_2: isClosed ? null : normalizeTime(row.close_time_2),
    display_label: cleanString(row.display_label),
    note: cleanString(row.note)
  };
}

function normalizeSpecialDayPayload(row, clinicId, staffName) {
  const dayType = row.day_type || "closed";
  const isClosed = row.is_closed === true || row.is_closed === "true" || dayType === "closed";
  return {
    clinic_id: clinicId,
    special_date: row.special_date,
    day_type: dayType,
    is_closed: isClosed,
    title: cleanString(row.title) || (isClosed ? "臨時休診" : "特別営業"),
    note: cleanString(row.note),
    open_time_1: isClosed || dayType === "memo" ? null : normalizeTime(row.open_time_1),
    close_time_1: isClosed || dayType === "memo" ? null : normalizeTime(row.close_time_1),
    open_time_2: isClosed || dayType === "memo" ? null : normalizeTime(row.open_time_2),
    close_time_2: isClosed || dayType === "memo" ? null : normalizeTime(row.close_time_2),
    created_by_staff: cleanString(row.created_by_staff) || cleanString(staffName)
  };
}

async function handleSpecialDaysGet(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const from = getParam(request, "from", todayJST());
  const to = getParam(request, "to", addMonths(from, 3));
  const clinic = await getClinicByCode(env, clinicCode);
  const rows = await getSpecialDays(env, clinic.id, from, to);
  return jsonResponse({ ok: true, clinic, from, to, items: rows });
}

async function handleSpecialDayUpsert(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);

  if (!body.special_date) return errorResponse("special_date が必要です。", 400);

  const payload = normalizeSpecialDayPayload(body, clinic.id, body.staff_name);
  const rows = await upsertRows(env, TABLES.specialDays, payload, "clinic_id,special_date");

  await logOperation(env, clinic.id, "owner", cleanString(body.staff_name) || "管理者", "special_day_upsert", "special_day", rows?.[0]?.id, payload);

  return jsonResponse({ ok: true, message: "臨時休診・特別営業日を保存しました。", special_day: rows?.[0] || rows });
}

async function handleSpecialDayDelete(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);

  const id = cleanString(body.id);
  const specialDate = cleanString(body.special_date);

  if (!id && !specialDate) return errorResponse("id または special_date が必要です。", 400);

  const query = { clinic_id: `eq.${clinic.id}` };
  if (id) query.id = `eq.${id}`;
  else query.special_date = `eq.${specialDate}`;

  const rows = await deleteRows(env, TABLES.specialDays, query);
  return jsonResponse({ ok: true, message: "臨時休診・特別営業日を削除しました。", deleted: rows });
}


// =========================================================
// Admin guardians / pets
// =========================================================

async function handleGuardianSearch(request, env) {
  const body = request.method === "POST" ? await readJson(request) : {};
  const clinicCode = getRequestedClinicCode(request, body);
  const keyword = cleanString(body.keyword || getParam(request, "q", "") || getParam(request, "keyword", ""));
  const limit = normalizeLimit(body.limit || getParam(request, "limit", "50"), 50, 200);
  const clinic = await getClinicByCode(env, clinicCode);

  // STEP VET-PHONE-1:
  // PostgREST の phone.ilike だけだと、090-1111-2222 / 09011112222 / 全角数字 / +81表記の揺れを吸収できない。
  // 医院内データを取得して、Worker側で電話番号正規化検索する。
  const rows = await selectRows(env, TABLES.guardians, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    order: "updated_at.desc,created_at.desc",
    limit: keyword ? 1000 : limit
  });

  const guardians = keyword
    ? rows.filter((guardian) => rowMatchesGuardianPhoneNormalizedSearch(guardian, keyword)).slice(0, limit)
    : rows.slice(0, limit);

  const enriched = [];
  for (const guardian of guardians) {
    const petsRaw = await selectRows(env, TABLES.petCardView, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      guardian_id: `eq.${guardian.id}`,
      order: "card_no.asc"
    });
    const pets = await attachPetPhotoFieldsToRows(env, clinic.id, petsRaw);
    enriched.push({ ...guardian, pets });
  }

  return jsonResponse({
    ok: true,
    clinic,
    keyword,
    count: enriched.length,
    total_scanned: rows.length,
    phone_normalized_search: true,
    worker_version: WORKER_VERSION,
    items: enriched
  });
}

function rowMatchesGuardianPhoneNormalizedSearch(row, keyword) {
  const query = cleanString(keyword);
  if (!query) return true;

  const norm = normalizeSearchTextForWorker(query);
  const queryPhone = normalizePhoneForSearch(query);

  const values = [
    row.guardian_name,
    row.guardian_kana,
    row.phone,
    row.guardian_no,
    row.line_display_name,
    row.email,
    row.memo,
    row.status
  ];

  const blob = normalizeSearchTextForWorker(values.filter(Boolean).join(" "));
  if (norm && blob.includes(norm)) return true;

  if (queryPhone) {
    const phoneBlob = normalizePhoneForSearch(values.filter(Boolean).join(" "));
    if (phoneBlob.includes(queryPhone)) return true;
  }

  return false;
}

async function handleGuardianDetail(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const guardianId = getParam(request, "guardian_id") || getParam(request, "id");
  if (!guardianId) return errorResponse("guardian_id が必要です。", 400);

  const clinic = await getClinicByCode(env, clinicCode);
  const guardian = await selectSingle(env, TABLES.guardians, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    id: `eq.${guardianId}`
  });
  if (!guardian) return errorResponse("飼い主が見つかりません。", 404);

  const cardsRaw = await selectRows(env, TABLES.petCardView, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    guardian_id: `eq.${guardian.id}`,
    order: "card_no.asc"
  });
  const cards = await attachPetPhotoFieldsToRows(env, clinic.id, cardsRaw);

  const visits = await selectRows(env, TABLES.visits, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    guardian_id: `eq.${guardian.id}`,
    order: "visited_at.desc",
    limit: 30
  });

  const followups = await selectRows(env, TABLES.followupTodosView, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    guardian_id: `eq.${guardian.id}`,
    order: "due_date.asc",
    limit: 30
  });

  return jsonResponse({ ok: true, clinic, guardian, cards, visits, followups });
}

async function handleGuardianCreate(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);

  const guardianName = cleanString(body.guardian_name);
  if (!guardianName) return errorResponse("飼い主名が必要です。", 400);

  const guardianNo = cleanString(body.guardian_no) || await nextGuardianNo(env, clinic.id);

  const payload = {
    clinic_id: clinic.id,
    guardian_no: guardianNo,
    guardian_name: guardianName,
    guardian_kana: nullIfEmpty(body.guardian_kana),
    phone: nullIfEmpty(normalizePhoneForSave(body.phone)),
    email: nullIfEmpty(body.email),
    line_user_id: nullIfEmpty(body.line_user_id),
    line_display_name: nullIfEmpty(body.line_display_name),
    line_picture_url: nullIfEmpty(body.line_picture_url),
    line_link_status: body.line_user_id ? "linked" : (body.line_link_status || "unlinked"),
    preferred_contact: body.preferred_contact || "line",
    memo: nullIfEmpty(body.memo),
    status: "active"
  };

  const rows = await insertRows(env, TABLES.guardians, payload);
  await logOperation(env, clinic.id, "staff", cleanString(body.staff_name) || "管理者", "guardian_create", "guardian", rows?.[0]?.id, payload);

  return jsonResponse({ ok: true, message: "飼い主を登録しました。", guardian: rows?.[0] || rows });
}

function uniqueDateId() {
  const now = new Date();
  const stamp = now.toISOString().replace(/\D/g, "").slice(2, 14);
  const bytes = new Uint8Array(2);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${stamp}-${rand}`;
}

async function nextGuardianNo(env, clinicId) {
  // STEP VET-34C-R5:
  // created_at順だけでは既存番号の最大値を拾えず、G-0001等が重複するケースがあるため、
  // 既存guardian_noを広めに取得して最大番号+1を採番し、さらに存在確認する。
  const rows = await selectRows(env, TABLES.guardians, {
    select: "guardian_no",
    clinic_id: `eq.${clinicId}`,
    order: "guardian_no.desc",
    limit: 1000
  });

  const used = new Set((rows || []).map((r) => String(r.guardian_no || "").trim()).filter(Boolean));
  let max = 0;

  for (const row of rows || []) {
    const m = String(row.guardian_no || "").match(/^G-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }

  for (let i = 1; i <= 200; i++) {
    const candidate = `G-${String(max + i).padStart(4, "0")}`;
    if (!used.has(candidate)) {
      const exists = await selectSingle(env, TABLES.guardians, {
        select: "id",
        clinic_id: `eq.${clinicId}`,
        guardian_no: `eq.${candidate}`,
        limit: 1
      });
      if (!exists) return candidate;
    }
  }

  return `G-${uniqueDateId()}`;
}

async function handleGuardianUpdate(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const guardianId = cleanString(body.guardian_id || body.id);
  if (!guardianId) return errorResponse("guardian_id が必要です。", 400);

  const clinic = await getClinicByCode(env, clinicCode);

  const payload = {};
  [
    "guardian_no",
    "guardian_name",
    "guardian_kana",
    "phone",
    "email",
    "line_user_id",
    "line_display_name",
    "line_picture_url",
    "line_link_status",
    "preferred_contact",
    "memo",
    "status"
  ].forEach((key) => {
    if (body[key] !== undefined) payload[key] = body[key];
  });

  const rows = await updateRows(env, TABLES.guardians, { id: `eq.${guardianId}`, clinic_id: `eq.${clinic.id}` }, payload);
  await logOperation(env, clinic.id, "staff", cleanString(body.staff_name) || "管理者", "guardian_update", "guardian", guardianId, payload);

  return jsonResponse({ ok: true, message: "飼い主情報を更新しました。", guardian: rows?.[0] || rows });
}

async function handleGuardianArchive(request, env) {
  return handleGuardianStatusChange(request, env, "archived", "飼い主をアーカイブしました。");
}

async function handleGuardianRestore(request, env) {
  return handleGuardianStatusChange(request, env, "active", "飼い主を復元しました。");
}

async function handleGuardianStatusChange(request, env, status, message) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const guardianId = cleanString(body.guardian_id || body.id);
  if (!guardianId) return errorResponse("guardian_id が必要です。", 400);
  const clinic = await getClinicByCode(env, clinicCode);
  const rows = await updateRows(env, TABLES.guardians, { id: `eq.${guardianId}`, clinic_id: `eq.${clinic.id}` }, { status });
  return jsonResponse({ ok: true, message, guardian: rows?.[0] || rows });
}

async function handlePetDetail(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const petId = getParam(request, "pet_id") || getParam(request, "id");
  if (!petId) return errorResponse("pet_id が必要です。", 400);

  const clinic = await getClinicByCode(env, clinicCode);
  let card = await selectSingle(env, TABLES.petCardView, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    pet_id: `eq.${petId}`
  });

  if (!card) return errorResponse("ペットが見つかりません。", 404);

  card = await attachPetPhotoFieldsToRows(env, clinic.id, card);

  const visits = await selectRows(env, TABLES.visits, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    pet_id: `eq.${petId}`,
    order: "visited_at.desc",
    limit: 30
  });

  const preventions = await selectRows(env, TABLES.preventionSchedules, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    pet_id: `eq.${petId}`,
    order: "due_date.asc",
    limit: 30
  });

  const followups = await selectRows(env, TABLES.followups, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    pet_id: `eq.${petId}`,
    order: "due_date.asc",
    limit: 30
  });

  return jsonResponse({ ok: true, clinic, card, pet: extractPet(card), guardian: extractGuardian(card), visits, preventions, followups });
}

async function handlePetCreate(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);

  const guardianId = cleanString(body.guardian_id);
  const petName = cleanString(body.pet_name);
  if (!guardianId) return errorResponse("guardian_id が必要です。", 400);
  if (!petName) return errorResponse("ペット名が必要です。", 400);

  const petNo = cleanString(body.pet_no) || await nextPetNo(env, clinic.id);

  const petPayload = normalizePetPayload(body, clinic.id, guardianId, petNo);
  const petRows = await insertRows(env, TABLES.pets, petPayload);
  const pet = petRows?.[0] || petRows;

  const cardNo = cleanString(body.card_no) || await nextCardNo(env, clinic.id);
  const cardRows = await insertRows(env, TABLES.petCards, {
    clinic_id: clinic.id,
    pet_id: pet.id,
    card_no: cardNo,
    qr_token: cleanString(body.qr_token) || createToken("vet_card"),
    card_enabled: true,
    note: nullIfEmpty(body.card_note)
  });

  await logOperation(env, clinic.id, "staff", cleanString(body.staff_name) || "管理者", "pet_create", "pet", pet.id, { pet_name: pet.pet_name, card_no: cardNo });

  return jsonResponse({ ok: true, message: "ペットを登録しました。", pet, card: cardRows?.[0] || cardRows });
}

function normalizePetPayload(body, clinicId, guardianId, petNo) {
  return {
    clinic_id: clinicId,
    guardian_id: guardianId,
    pet_no: petNo,
    pet_name: cleanString(body.pet_name),
    species: cleanString(body.species) || "dog",
    species_label: cleanString(body.species_label) || speciesToLabel(cleanString(body.species) || "dog"),
    breed: nullIfEmpty(body.breed),
    sex: normalizePetSex(body.sex),
    birth_date: nullIfEmpty(body.birth_date),
    weight_kg: body.weight_kg === undefined || body.weight_kg === "" ? null : Number(body.weight_kg),
    neutered_status: cleanString(body.neutered_status) || "unknown",
    insurance_status: nullIfEmpty(body.insurance_status),
    microchip_no: nullIfEmpty(body.microchip_no),
    allergies: nullIfEmpty(body.allergies),
    chronic_conditions: nullIfEmpty(body.chronic_conditions),
    caution_memo: nullIfEmpty(body.caution_memo),
    status: cleanString(body.status) || "active"
  };
}

function speciesToLabel(species) {
  const map = { dog: "犬", cat: "猫", rabbit: "うさぎ", hamster: "ハムスター", bird: "鳥", other: "その他" };
  return map[species] || "その他";
}

async function nextPetNo(env, clinicId) {
  const rows = await selectRows(env, TABLES.pets, {
    select: "pet_no",
    clinic_id: `eq.${clinicId}`,
    order: "pet_no.desc",
    limit: 1000
  });

  const used = new Set((rows || []).map((r) => String(r.pet_no || "").trim()).filter(Boolean));
  let max = 0;

  for (const row of rows || []) {
    const m = String(row.pet_no || "").match(/^P-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }

  for (let i = 1; i <= 200; i++) {
    const candidate = `P-${String(max + i).padStart(4, "0")}`;
    if (!used.has(candidate)) {
      const exists = await selectSingle(env, TABLES.pets, {
        select: "id",
        clinic_id: `eq.${clinicId}`,
        pet_no: `eq.${candidate}`,
        limit: 1
      });
      if (!exists) return candidate;
    }
  }

  return `P-${uniqueDateId()}`;
}

async function nextCardNo(env, clinicId) {
  const rows = await selectRows(env, TABLES.petCards, {
    select: "card_no",
    clinic_id: `eq.${clinicId}`,
    order: "card_no.desc",
    limit: 1000
  });

  const used = new Set((rows || []).map((r) => String(r.card_no || "").trim()).filter(Boolean));
  let max = 0;

  for (const row of rows || []) {
    const m = String(row.card_no || "").match(/^VET-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }

  for (let i = 1; i <= 200; i++) {
    const candidate = `VET-${String(max + i).padStart(6, "0")}`;
    if (!used.has(candidate)) {
      const exists = await selectSingle(env, TABLES.petCards, {
        select: "id",
        clinic_id: `eq.${clinicId}`,
        card_no: `eq.${candidate}`,
        limit: 1
      });
      if (!exists) return candidate;
    }
  }

  return `VET-${uniqueDateId()}`;
}

async function handlePetUpdate(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const petId = cleanString(body.pet_id || body.id);
  if (!petId) return errorResponse("pet_id が必要です。", 400);

  const payload = {};
  [
    "pet_no",
    "pet_name",
    "species",
    "species_label",
    "breed",
    "sex",
    "birth_date",
    "weight_kg",
    "neutered_status",
    "insurance_status",
    "microchip_no",
    "allergies",
    "chronic_conditions",
    "caution_memo",
    "status"
  ].forEach((key) => {
    if (body[key] !== undefined) payload[key] = body[key] === "" ? null : body[key];
  });

  if (payload.weight_kg !== undefined && payload.weight_kg !== null) payload.weight_kg = Number(payload.weight_kg);

  const rows = await updateRows(env, TABLES.pets, { id: `eq.${petId}`, clinic_id: `eq.${clinic.id}` }, payload);
  await logOperation(env, clinic.id, "staff", cleanString(body.staff_name) || "管理者", "pet_update", "pet", petId, payload);

  return jsonResponse({ ok: true, message: "ペット情報を更新しました。", pet: rows?.[0] || rows });
}

async function handlePetCardReissue(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const petId = cleanString(body.pet_id);
  if (!petId) return errorResponse("pet_id が必要です。", 400);

  const existing = await getCardByPetId(env, petId);
  if (!existing) return errorResponse("診察券が見つかりません。", 404);

  const newToken = createToken("vet_card");
  const rows = await updateRows(env, TABLES.petCards, { id: `eq.${existing.id}`, clinic_id: `eq.${clinic.id}` }, {
    qr_token: newToken,
    card_enabled: true,
    issued_at: new Date().toISOString(),
    disabled_at: null,
    note: nullIfEmpty(body.note) || "診察券を再発行"
  });

  await logOperation(env, clinic.id, "staff", cleanString(body.staff_name) || "管理者", "pet_card_reissue", "pet_card", existing.id, { pet_id: petId });

  return jsonResponse({ ok: true, message: "ペット診察券を再発行しました。", card: rows?.[0] || rows });
}

async function handlePetCardSetEnabled(request, env, enabled) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);

  const petId = cleanString(body.pet_id);
  const cardId = cleanString(body.card_id);
  if (!petId && !cardId) return errorResponse("pet_id または card_id が必要です。", 400);

  const query = { clinic_id: `eq.${clinic.id}` };
  if (cardId) query.id = `eq.${cardId}`;
  else query.pet_id = `eq.${petId}`;

  const rows = await updateRows(env, TABLES.petCards, query, {
    card_enabled: enabled,
    disabled_at: enabled ? null : new Date().toISOString(),
    note: nullIfEmpty(body.note)
  });

  return jsonResponse({ ok: true, message: enabled ? "診察券を有効化しました。" : "診察券を無効化しました。", card: rows?.[0] || rows });
}


// =========================================================
// Line link / templates / queue / prevention / followups
// =========================================================

async function handleLineLinkTokenCreate(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const guardianId = cleanString(body.guardian_id);
  if (!guardianId) return errorResponse("guardian_id が必要です。", 400);

  const token = createToken("vet_link");
  const rows = await insertRows(env, TABLES.lineLinkTokens, {
    clinic_id: clinic.id,
    guardian_id: guardianId,
    token,
    status: "active",
    expires_at: body.expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    created_by_staff: nullIfEmpty(body.staff_name)
  });

  await logOperation(env, clinic.id, "staff", cleanString(body.staff_name) || "管理者", "line_link_token_create", "guardian", guardianId, { token_id: rows?.[0]?.id });

  return jsonResponse({ ok: true, message: "LINE連携トークンを作成しました。", token: rows?.[0] || rows });
}

async function handleLineLinkTokens(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const clinic = await getClinicByCode(env, clinicCode);
  const rows = await selectRows(env, TABLES.lineLinkTokens, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    order: "created_at.desc",
    limit: normalizeLimit(getParam(request, "limit", "100"), 100, 300)
  });
  return jsonResponse({ ok: true, clinic, items: rows });
}

async function handleLineLinkGuideCopied(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  await logOperation(env, clinic.id, "staff", cleanString(body.staff_name) || "管理者", "line_link_guide_copied", "guardian", cleanString(body.guardian_id) || null, body);
  return jsonResponse({ ok: true, message: "LINE連携案内コピーを記録しました。" });
}

async function handlePreventionSchedules(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const clinic = await getClinicByCode(env, clinicCode);
  const query = {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    order: "due_date.asc",
    limit: normalizeLimit(getParam(request, "limit", "100"), 100, 300)
  };
  const petId = getParam(request, "pet_id", "");
  if (petId) query.pet_id = `eq.${petId}`;
  const rows = await selectRows(env, TABLES.preventionSchedules, query);
  return jsonResponse({ ok: true, clinic, items: rows });
}

async function handlePreventionCreate(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);

  const guardianId = cleanString(body.guardian_id);
  const petId = cleanString(body.pet_id);
  if (!guardianId || !petId) return errorResponse("guardian_id と pet_id が必要です。", 400);

  let payload = normalizePreventionPayload(body, clinic.id, guardianId, petId);
  payload = await applyVaccineIntervalRuleToPreventionPayload(env, clinic, payload);
  const rows = await insertRows(env, TABLES.preventionSchedules, payload);
  return jsonResponse({ ok: true, message: "予防予定を作成しました。", prevention: rows?.[0] || rows });
}

async function handlePreventionUpdate(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const id = cleanString(body.prevention_id || body.id);
  if (!id) return errorResponse("prevention_id が必要です。", 400);

  let payload = {};
  [
    "prevention_type",
    "title",
    "due_date",
    "last_done_date",
    "next_due_date",
    "vaccine_interval_rule_id",
    "status",
    "reminder_level",
    "line_message",
    "memo"
  ].forEach((key) => {
    if (body[key] !== undefined) payload[key] = body[key] === "" ? null : body[key];
  });
  const current = await selectSingle(env, TABLES.preventionSchedules, { select: "*", id: `eq.${id}`, clinic_id: `eq.${clinic.id}` });
  if (!current) return errorResponse("予防予定が見つかりません。", 404);
  const merged = { ...current, ...payload };
  const calculated = await applyVaccineIntervalRuleToPreventionPayload(env, clinic, merged);
  if (body.last_done_date !== undefined || body.vaccine_interval_rule_id !== undefined || body.next_due_date !== undefined || body.due_date !== undefined) {
    if (body.next_due_date === undefined && calculated.next_due_date !== merged.next_due_date) payload.next_due_date = calculated.next_due_date;
    if (body.due_date === undefined && calculated.due_date !== merged.due_date) payload.due_date = calculated.due_date;
  }

  const rows = await updateRows(env, TABLES.preventionSchedules, { id: `eq.${id}`, clinic_id: `eq.${clinic.id}` }, payload);
  return jsonResponse({ ok: true, message: "予防予定を更新しました。", prevention: rows?.[0] || rows });
}

function normalizePreventionPayload(body, clinicId, guardianId, petId) {
  return {
    clinic_id: clinicId,
    guardian_id: guardianId,
    pet_id: petId,
    prevention_type: cleanString(body.prevention_type) || "other",
    title: cleanString(body.title) || "予防予定",
    due_date: nullIfEmpty(body.due_date),
    last_done_date: nullIfEmpty(body.last_done_date),
    next_due_date: nullIfEmpty(body.next_due_date),
    vaccine_interval_rule_id: nullIfEmpty(body.vaccine_interval_rule_id),
    status: cleanString(body.status) || "soon",
    reminder_level: cleanString(body.reminder_level) || "normal",
    line_message: nullIfEmpty(body.line_message),
    memo: nullIfEmpty(body.memo)
  };
}


async function applyVaccineIntervalRuleToPreventionPayload(env, clinic, payload) {
  const next = { ...payload };
  const ruleId = cleanString(next.vaccine_interval_rule_id || "");
  const lastDone = cleanString(next.last_done_date || "");
  if (!ruleId || !lastDone) return next;
  const rule = await selectSingle(env, TABLES.vaccineIntervalRules, { select: "*", clinic_id: `eq.${clinic.id}`, id: `eq.${ruleId}`, is_active: "eq.true" });
  const standardDays = rule?.standard_interval_days === null || rule?.standard_interval_days === undefined ? null : Number(rule.standard_interval_days);
  if (!rule || !Number.isFinite(standardDays)) return next;
  const calculated = addDays(lastDone, standardDays);
  if (!cleanString(next.next_due_date || "")) next.next_due_date = calculated;
  if (!cleanString(next.due_date || "")) next.due_date = calculated;
  return next;
}

// =========================================================
// DPRO PET CARE LINE V1.3 / ワクチン・予防の接種間隔制御
// ・間隔値は病院設定。DPRO側で医療判断を決め打ちしない。
// ・既存 vet_prevention_schedules の接種履歴 / 次回予定日を優先利用する。
// ・Feature Switch OFF時はV1.2以前の予約挙動を完全維持する。
// =========================================================
function vaccineIntervalFeatureEnabled(env, clinicCode, featureState, body = {}) {
  let flags = featureState?.feature_flags || {};
  if (isDemoClinicCodeForAudit(env, clinicCode) && body.demo_feature_flags && typeof body.demo_feature_flags === "object" && !Array.isArray(body.demo_feature_flags)) {
    flags = normalizeFeatureFlags({ ...flags, ...body.demo_feature_flags });
  }
  return flags.vaccine_interval_control === true;
}

function normalizeVaccineRuleSpecies(value) {
  const text = cleanString(value).toLowerCase();
  if (["dog", "犬"].includes(text)) return "dog";
  if (["cat", "猫"].includes(text)) return "cat";
  if (["all", "すべて", "全て"].includes(text)) return "all";
  return text || "other";
}

function petSpeciesKey(pet) {
  return normalizeVaccineRuleSpecies(pet?.species || pet?.species_label || pet?.animal_type || "other");
}

function isVaccineAppointmentService(service) {
  const category = cleanString(service?.category).toLowerCase();
  return category === "vaccination";
}

function vaccineIntervalRulePublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    rule_code: row.rule_code,
    display_name: row.display_name,
    prevention_type: row.prevention_type,
    species: row.species,
    min_interval_days: row.min_interval_days === null || row.min_interval_days === undefined ? null : Number(row.min_interval_days),
    standard_interval_days: row.standard_interval_days === null || row.standard_interval_days === undefined ? null : Number(row.standard_interval_days),
    member_guard_mode: row.member_guard_mode || "warn",
    recommended_guard_mode: row.recommended_guard_mode || "warn",
    public_note: row.public_note || "",
    is_active: row.is_active !== false,
    sort_order: Number(row.sort_order || 100)
  };
}

async function getVaccineIntervalRules(env, clinic, options = {}) {
  const query = {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    order: "sort_order.asc,display_name.asc",
    limit: 200
  };
  if (options.activeOnly !== false) query.is_active = "eq.true";
  const rows = await selectRows(env, TABLES.vaccineIntervalRules, query);
  const species = normalizeVaccineRuleSpecies(options.species || "all");
  return rows.filter((row) => {
    if (!species || species === "all") return true;
    const target = normalizeVaccineRuleSpecies(row.species || "all");
    return target === "all" || target === species;
  });
}

async function getPetPreventionSchedulesForInterval(env, clinic, petId) {
  return selectRows(env, TABLES.preventionSchedules, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    pet_id: `eq.${petId}`,
    order: "updated_at.desc,created_at.desc",
    limit: 200
  });
}

function pickScheduleForRule(schedules, rule, requestedScheduleId = "") {
  const scheduleId = cleanString(requestedScheduleId);
  if (scheduleId) {
    const found = schedules.find((row) => cleanString(row.id) === scheduleId);
    if (!found) throw new Error("選択した予防予定が見つかりません。");
    const linked = cleanString(found.vaccine_interval_rule_id);
    if (linked && linked !== cleanString(rule.id)) throw new Error("予防予定と接種間隔ルールの組み合わせが一致しません。");
    if (!linked && cleanString(found.prevention_type) !== cleanString(rule.prevention_type)) throw new Error("予防予定の種別と接種間隔ルールが一致しません。");
    return found;
  }
  return schedules.find((row) => cleanString(row.vaccine_interval_rule_id) === cleanString(rule.id))
    || schedules.find((row) => cleanString(row.prevention_type) === cleanString(rule.prevention_type))
    || null;
}

function buildVaccineIntervalDates(rule, schedule) {
  const lastDone = cleanString(schedule?.last_done_date || "");
  const explicitNext = cleanString(schedule?.next_due_date || schedule?.due_date || "");
  const minDays = rule?.min_interval_days === null || rule?.min_interval_days === undefined ? null : Number(rule.min_interval_days);
  const standardDays = rule?.standard_interval_days === null || rule?.standard_interval_days === undefined ? null : Number(rule.standard_interval_days);
  const earliestDate = lastDone && Number.isFinite(minDays) ? addDays(lastDone, minDays) : "";
  const calculatedRecommended = lastDone && Number.isFinite(standardDays) ? addDays(lastDone, standardDays) : "";
  return {
    last_done_date: lastDone || null,
    earliest_date: earliestDate || null,
    recommended_date: explicitNext || calculatedRecommended || null,
    recommended_source: explicitNext ? "prevention_schedule" : (calculatedRecommended ? "clinic_interval_rule" : "none")
  };
}

function vaccineIntervalMessage(result, rule) {
  const name = cleanString(rule?.display_name) || "予防接種";
  if (result.result === "too_early") return `${name}は、病院設定の最短間隔より前の日付です。病院へご相談ください。`;
  if (result.result === "before_recommended") return `${name}は、病院が登録した推奨次回日より前の日付です。予約前に内容をご確認ください。`;
  if (result.result === "no_history") return `${name}の接種履歴・次回予定日から間隔を自動判定できません。必要に応じて病院へご確認ください。`;
  if (result.result === "not_configured") return "この病院では接種間隔の具体値が未設定です。予約可否は病院の運用に従います。";
  return cleanString(rule?.public_note || "");
}

async function evaluateVaccineIntervalForAppointment(env, context) {
  const {
    clinic, clinicCode, featureState, body = {}, pet, service, appointmentDate,
    adminMode = false
  } = context;
  const enabled = vaccineIntervalFeatureEnabled(env, clinicCode, featureState, body);
  const base = {
    version: VACCINE_INTERVAL_CONTROL_VERSION,
    enabled,
    applicable: false,
    allowed: true,
    result: enabled ? "not_applicable" : "disabled",
    message: "",
    rule: null,
    schedule: null,
    last_done_date: null,
    earliest_date: null,
    recommended_date: null,
    recommended_source: "none",
    overridden: false
  };
  if (!enabled || !isVaccineAppointmentService(service)) return base;
  base.applicable = true;

  const rules = await getVaccineIntervalRules(env, clinic, { activeOnly: true, species: petSpeciesKey(pet) });
  if (!rules.length) {
    return { ...base, result: "not_configured", message: "接種間隔ルールが未設定のため、自動制御は行いません。病院へご確認ください。" };
  }

  const requestedRuleId = cleanString(body.vaccine_interval_rule_id || body.vaccine_rule_id || "");
  let rule = requestedRuleId ? rules.find((row) => cleanString(row.id) === requestedRuleId) : null;
  if (!rule && rules.length === 1) rule = rules[0];
  if (!rule) {
    if (adminMode) return { ...base, result: "selection_required", message: "接種間隔ルール未選択（スタッフ判断で受付可能）" };
    return { ...base, allowed: false, result: "selection_required", message: "予約するワクチン・予防の種類を選択してください。", options_count: rules.length };
  }

  const schedules = await getPetPreventionSchedulesForInterval(env, clinic, pet.id);
  const schedule = pickScheduleForRule(schedules, rule, body.prevention_schedule_id || "");
  const dates = buildVaccineIntervalDates(rule, schedule);
  const result = {
    ...base,
    rule: vaccineIntervalRulePublic(rule),
    schedule: schedule ? {
      id: schedule.id,
      prevention_type: schedule.prevention_type,
      title: schedule.title || rule.display_name,
      last_done_date: schedule.last_done_date || null,
      due_date: schedule.due_date || null,
      next_due_date: schedule.next_due_date || null,
      status: schedule.status || ""
    } : null,
    ...dates,
    result: "ok"
  };
  const dateText = cleanString(appointmentDate || "");
  if (!dateText) return result;
  parseDateText(dateText);

  if (dates.earliest_date && compareDateText(dateText, dates.earliest_date) < 0) {
    const guardMode = cleanString(rule.member_guard_mode || "warn");
    if (guardMode === "off") {
      result.result = "ok";
      result.allowed = true;
      result.message = cleanString(rule.public_note || "");
    } else {
      result.result = "too_early";
      result.allowed = adminMode || guardMode !== "block";
      result.message = vaccineIntervalMessage(result, rule);
    }
  } else if (dates.recommended_date && compareDateText(dateText, dates.recommended_date) < 0) {
    result.result = "before_recommended";
    result.allowed = true;
    result.message = cleanString(rule.recommended_guard_mode || "warn") === "off" ? "" : vaccineIntervalMessage(result, rule);
  } else if (!dates.last_done_date && !dates.recommended_date) {
    result.result = "no_history";
    result.allowed = true;
    result.message = vaccineIntervalMessage(result, rule);
  } else if (rule.min_interval_days === null && rule.standard_interval_days === null && !dates.recommended_date) {
    result.result = "not_configured";
    result.allowed = true;
    result.message = vaccineIntervalMessage(result, rule);
  }

  if (adminMode && result.result === "too_early") {
    result.allowed = true;
    result.overridden = true;
    result.result = "staff_override";
    result.message = "病院スタッフの判断で受付しました。";
  }
  return result;
}

function vaccineIntervalSnapshot(evaluation, body = {}) {
  if (!evaluation?.applicable || !evaluation?.rule?.id) {
    return {
      prevention_schedule_id: null,
      vaccine_interval_rule_id: null,
      vaccine_interval_result: evaluation?.result || null,
      vaccine_interval_note: evaluation?.message || null,
      vaccine_interval_checked_at: new Date().toISOString(),
      vaccine_interval_override: evaluation?.overridden === true,
      vaccine_interval_override_reason: evaluation?.overridden ? (cleanString(body.vaccine_interval_override_reason) || "スタッフ判断") : null
    };
  }
  return {
    prevention_schedule_id: evaluation.schedule?.id || null,
    vaccine_interval_rule_id: evaluation.rule.id,
    vaccine_interval_result: evaluation.result,
    vaccine_interval_note: evaluation.message || null,
    vaccine_interval_checked_at: new Date().toISOString(),
    vaccine_interval_override: evaluation.overridden === true,
    vaccine_interval_override_reason: evaluation.overridden ? (cleanString(body.vaccine_interval_override_reason) || "スタッフ判断") : null
  };
}

async function handleMemberVaccineIntervalOptions(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const featureState = await getClinicFeatureState(env, clinicCode);
  const clinic = featureState.clinic;
  const member = await resolveExactAppointmentMember(env, clinic, request, body);
  if (!member.guardian) throw new Error("LINE連携済みの飼い主情報が見つかりません。");
  const pet = await resolveExactAppointmentPet(env, clinic, member.guardian, body.pet_id);
  const enabled = vaccineIntervalFeatureEnabled(env, clinicCode, featureState, body);
  const rules = await getVaccineIntervalRules(env, clinic, { activeOnly: true, species: petSpeciesKey(pet) });
  const schedules = await getPetPreventionSchedulesForInterval(env, clinic, pet.id);
  const options = rules.map((rule) => {
    const schedule = pickScheduleForRule(schedules, rule, "");
    const dates = buildVaccineIntervalDates(rule, schedule);
    return {
      rule: vaccineIntervalRulePublic(rule),
      schedule: schedule ? {
        id: schedule.id,
        title: schedule.title || rule.display_name,
        prevention_type: schedule.prevention_type,
        last_done_date: schedule.last_done_date || null,
        due_date: schedule.due_date || null,
        next_due_date: schedule.next_due_date || null,
        status: schedule.status || ""
      } : null,
      ...dates
    };
  });
  return jsonResponse({ ok: true, worker_version: WORKER_VERSION, vaccine_interval_control_version: VACCINE_INTERVAL_CONTROL_VERSION, clinic, enabled, pet: { id: pet.id, pet_name: pet.pet_name || "", species: pet.species || "", species_label: pet.species_label || "" }, options });
}

async function handleMemberVaccineIntervalCheck(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const featureState = await getClinicFeatureState(env, clinicCode);
  const clinic = featureState.clinic;
  const member = await resolveExactAppointmentMember(env, clinic, request, body);
  if (!member.guardian) throw new Error("LINE連携済みの飼い主情報が見つかりません。");
  const pet = await resolveExactAppointmentPet(env, clinic, member.guardian, body.pet_id);
  const service = await getExactAppointmentServiceByInput(env, clinic, body);
  const evaluation = await evaluateVaccineIntervalForAppointment(env, { clinic, clinicCode, featureState, body, pet, service, appointmentDate: body.appointment_date || body.date, adminMode: false });
  return jsonResponse({ ok: true, worker_version: WORKER_VERSION, vaccine_interval_control_version: VACCINE_INTERVAL_CONTROL_VERSION, evaluation });
}

async function handleAdminVaccineIntervalRules(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const clinic = await getClinicByCode(env, clinicCode);
  const rules = await getVaccineIntervalRules(env, clinic, { activeOnly: false, species: "all" });
  return jsonResponse({ ok: true, worker_version: WORKER_VERSION, vaccine_interval_control_version: VACCINE_INTERVAL_CONTROL_VERSION, clinic, rules });
}

function normalizeOptionalDays(value, min, max) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${min}〜${max}日の範囲で入力してください。`);
  return n;
}

async function handleAdminVaccineIntervalRuleSave(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const id = cleanString(body.id || body.rule_id || "");
  const ruleCode = cleanString(body.rule_code).toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const displayName = cleanString(body.display_name);
  if (!ruleCode || !displayName) throw new Error("ルールコードと表示名が必要です。");
  const minDays = normalizeOptionalDays(body.min_interval_days, 0, 3650);
  const standardDays = normalizeOptionalDays(body.standard_interval_days, 1, 3650);
  if (minDays !== null && standardDays !== null && standardDays < minDays) throw new Error("標準間隔は最短間隔以上にしてください。");
  const payload = {
    clinic_id: clinic.id,
    rule_code: ruleCode,
    display_name: displayName,
    prevention_type: cleanString(body.prevention_type) || "other",
    species: normalizeVaccineRuleSpecies(body.species || "all"),
    min_interval_days: minDays,
    standard_interval_days: standardDays,
    member_guard_mode: ["off","warn","block"].includes(cleanString(body.member_guard_mode)) ? cleanString(body.member_guard_mode) : "warn",
    recommended_guard_mode: ["off","warn"].includes(cleanString(body.recommended_guard_mode)) ? cleanString(body.recommended_guard_mode) : "warn",
    public_note: nullIfEmpty(body.public_note),
    staff_note: nullIfEmpty(body.staff_note),
    legal_reference_note: nullIfEmpty(body.legal_reference_note),
    is_active: body.is_active !== false,
    sort_order: Number.isFinite(Number(body.sort_order)) ? Math.max(0, Math.floor(Number(body.sort_order))) : 100
  };
  let saved;
  if (id) {
    const rows = await updateRows(env, TABLES.vaccineIntervalRules, { id: `eq.${id}`, clinic_id: `eq.${clinic.id}` }, payload);
    saved = rows?.[0] || null;
  } else {
    const rows = await insertRows(env, TABLES.vaccineIntervalRules, payload);
    saved = rows?.[0] || null;
  }
  await logOperation(env, clinic.id, "staff", cleanString(body.staff_name) || "管理画面", "vaccine_interval_rule_save", "vaccine_interval_rule", saved?.id || id || null, { rule_code: ruleCode, display_name: displayName });
  const rules = await getVaccineIntervalRules(env, clinic, { activeOnly: false, species: "all" });
  return jsonResponse({ ok: true, message: "接種間隔ルールを保存しました。", rule: saved, rules });
}

async function handleAdminVaccineIntervalRuleArchive(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const id = cleanString(body.id || body.rule_id || "");
  if (!id) throw new Error("rule_id が必要です。");
  const rows = await updateRows(env, TABLES.vaccineIntervalRules, { id: `eq.${id}`, clinic_id: `eq.${clinic.id}` }, { is_active: false });
  await logOperation(env, clinic.id, "staff", cleanString(body.staff_name) || "管理画面", "vaccine_interval_rule_archive", "vaccine_interval_rule", id, {});
  return jsonResponse({ ok: true, message: "接種間隔ルールを非表示にしました。", rule: rows?.[0] || null });
}

async function handleFollowupCreate(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);

  const guardianId = cleanString(body.guardian_id);
  const petId = cleanString(body.pet_id);
  if (!guardianId || !petId) return errorResponse("guardian_id と pet_id が必要です。", 400);

  const rows = await insertRows(env, TABLES.followups, {
    clinic_id: clinic.id,
    guardian_id: guardianId,
    pet_id: petId,
    followup_type: cleanString(body.followup_type) || "recheck",
    due_date: cleanString(body.due_date) || todayJST(),
    priority: cleanString(body.priority) || "normal",
    status: cleanString(body.status) || "todo",
    title: cleanString(body.title) || "再診フォロー",
    memo: nullIfEmpty(body.memo),
    line_message: nullIfEmpty(body.line_message)
  });

  return jsonResponse({ ok: true, message: "フォロー予定を作成しました。", followup: rows?.[0] || rows });
}

async function handleFollowupUpdate(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);

  const id = cleanString(body.followup_id || body.id);
  if (!id) return errorResponse("followup_id が必要です。", 400);

  const payload = {};
  [
    "followup_type",
    "due_date",
    "priority",
    "status",
    "title",
    "memo",
    "line_message",
    "snoozed_until"
  ].forEach((key) => {
    if (body[key] !== undefined) payload[key] = body[key] === "" ? null : body[key];
  });

  if (payload.status === "copied") payload.copied_at = new Date().toISOString();
  if (payload.status === "done") payload.done_at = new Date().toISOString();

  const rows = await updateRows(env, TABLES.followups, { id: `eq.${id}`, clinic_id: `eq.${clinic.id}` }, payload);
  return jsonResponse({ ok: true, message: "フォロー予定を更新しました。", followup: rows?.[0] || rows });
}


// =========================================================
// STEP VET-LINE-CALL-1
// LINE直接呼び出し・予約前日案内
// デモ医院は常にhold。本番医院のみsend可能。
// =========================================================

function normalizeLineDeliveryMode(value) {
  return cleanString(value).toLowerCase() === "send" ? "send" : "hold";
}

function isDemoClinicForLineCall(clinic) {
  return Boolean(
    clinic?.is_demo === true ||
    cleanString(clinic?.status).toLowerCase() === "demo" ||
    cleanString(clinic?.clinic_code) === DEFAULT_CLINIC_CODE ||
    cleanString(clinic?.clinic_code) === "dpro_vet_demo"
  );
}

function lineCallTypeLabel(type) {
  const map = {
    queue_soon: "順番が近づきました",
    come_to_reception: "院内受付へお越しください",
    medicine_ready: "お薬の準備ができました",
    appointment_reminder: "予約前日のご案内",
    manual: "個別メッセージ"
  };
  return map[cleanString(type)] || "個別メッセージ";
}

function lineCallDefaultTemplate(type) {
  const map = {
    queue_soon: "{pet_name}ちゃんの診察順が近づきました。\n安全に気をつけて、院内受付へお越しください。\n\n{clinic_name}",
    come_to_reception: "{pet_name}ちゃんのご案内準備ができました。\n院内受付へお越しください。\n\n{clinic_name}",
    medicine_ready: "{pet_name}ちゃんのお薬・フードの準備ができました。\n診療時間内に受付へお越しください。\n\n{clinic_name}",
    appointment_reminder: "{pet_name}ちゃんの診療予約は、{appointment_date} {appointment_time}です。\n変更やキャンセルが必要な場合は、病院へご連絡ください。\n\n{clinic_name}",
    manual: "{pet_name}ちゃんについて、病院からご案内があります。\n\n{clinic_name}"
  };
  return map[cleanString(type)] || map.manual;
}

function lineCallDateLabel(value) {
  const text = cleanString(value);
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return text;
  return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`;
}

function renderLineCallTemplate(template, variables = {}) {
  return String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => cleanString(variables[key]));
}

function sanitizeLineMessage(value) {
  const text = String(value || "").replace(/\r\n/g, "\n").trim();
  if (!text) throw new Error("LINEメッセージ本文が空です。");
  if (text.length > 2000) throw new Error("LINEメッセージ本文は2000文字以内にしてください。");
  return text;
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getLineCallSettings(env, clinic) {
  let settings = await selectSingle(env, TABLES.lineCallSettings, {
    select: "*",
    clinic_id: `eq.${clinic.id}`
  });
  if (!settings) {
    const rows = await insertRows(env, TABLES.lineCallSettings, {
      clinic_id: clinic.id,
      enabled: true,
      delivery_mode: "hold",
      feature_version: LINE_CALL_FEATURE_VERSION,
      owner_note: "デモ医院は保留保存。本番医院はLINEトークン設定後に送信へ切り替えます。"
    });
    settings = Array.isArray(rows) ? rows[0] : rows;
  }
  return settings;
}

function effectiveLineCallMode(env, clinic, settings) {
  if (isDemoClinicForLineCall(clinic)) return "hold";
  if (settings?.enabled !== true) return "hold";
  const envMode = cleanString(env.LINE_NOTIFICATION_DELIVERY_MODE);
  return normalizeLineDeliveryMode(envMode || settings?.delivery_mode || "hold");
}

function lineCallTokenConfigured(env) {
  return Boolean(cleanString(env.LINE_CHANNEL_ACCESS_TOKEN));
}

async function getLineCallTemplate(env, clinicId, messageType) {
  const row = await selectSingle(env, TABLES.messageTemplates, {
    select: "*",
    clinic_id: `eq.${clinicId}`,
    template_key: `eq.${messageType}`,
    is_active: "eq.true"
  }).catch(() => null);
  return row?.body || lineCallDefaultTemplate(messageType);
}

async function resolveLineCallTarget(env, clinic, body = {}) {
  const targetKind = ["queue", "appointment", "manual"].includes(cleanString(body.target_kind))
    ? cleanString(body.target_kind)
    : "queue";
  const targetId = cleanString(body.target_id || body.waiting_entry_id || body.exact_appointment_id);
  let source = null;
  let guardianId = cleanString(body.guardian_id);
  let petId = cleanString(body.pet_id);
  let appointmentDate = cleanString(body.appointment_date);
  let appointmentTime = cleanString(body.appointment_time || body.start_time).slice(0, 5);
  let serviceName = cleanString(body.service_name);

  if (targetKind === "queue") {
    if (!targetId) throw new Error("waiting_entry_id が必要です。");
    source = await selectSingle(env, TABLES.waitingEntries, {
      select: "*",
      id: `eq.${targetId}`,
      clinic_id: `eq.${clinic.id}`
    });
    if (!source) throw new Error("受付情報が見つかりません。");
    guardianId = source.guardian_id || guardianId;
    petId = source.pet_id || petId;
    appointmentDate = source.target_date || appointmentDate;
    appointmentTime = cleanString(source.visit_time || appointmentTime).slice(0, 5);
  } else if (targetKind === "appointment") {
    if (!targetId) throw new Error("exact_appointment_id が必要です。");
    source = await selectSingle(env, TABLES.exactAppointments, {
      select: "*",
      id: `eq.${targetId}`,
      clinic_id: `eq.${clinic.id}`
    });
    if (!source) throw new Error("日時指定予約が見つかりません。");
    guardianId = source.guardian_id || guardianId;
    petId = source.pet_id || petId;
    appointmentDate = source.appointment_date || appointmentDate;
    appointmentTime = cleanString(source.start_time || appointmentTime).slice(0, 5);
    if (source.service_type_id) {
      const svc = await selectSingle(env, TABLES.exactAppointmentServices, {
        select: "service_name",
        id: `eq.${source.service_type_id}`,
        clinic_id: `eq.${clinic.id}`
      }).catch(() => null);
      serviceName = svc?.service_name || serviceName;
    }
  }

  if (!guardianId) throw new Error("送信先の飼い主情報が見つかりません。");
  const guardian = await selectSingle(env, TABLES.guardians, {
    select: "*",
    id: `eq.${guardianId}`,
    clinic_id: `eq.${clinic.id}`
  });
  if (!guardian) throw new Error("送信先の飼い主情報が見つかりません。");

  let pet = null;
  if (petId) {
    pet = await selectSingle(env, TABLES.pets, {
      select: "*",
      id: `eq.${petId}`,
      clinic_id: `eq.${clinic.id}`
    }).catch(() => null);
  }

  const lineStatus = normalizeLineLinkStatusForWorker(guardian.line_link_status, guardian.line_user_id);
  return {
    target_kind: targetKind,
    target_id: targetId || guardian.id,
    source,
    guardian,
    pet,
    guardian_id: guardian.id,
    pet_id: pet?.id || petId || null,
    guardian_name: guardian.guardian_name || guardian.owner_name || "飼い主",
    pet_name: pet?.pet_name || source?.pet_name_snapshot || cleanString(body.pet_name) || "ペット",
    line_user_id: cleanString(guardian.line_user_id),
    line_link_status: lineStatus,
    can_send_line: lineStatus === "linked" && Boolean(cleanString(guardian.line_user_id)),
    appointment_date: appointmentDate,
    appointment_time: appointmentTime,
    service_name: serviceName,
    status: source?.status || ""
  };
}

async function buildLineCallMessage(env, clinic, target, messageType, customBody = "") {
  const type = cleanString(messageType) || "manual";
  const template = customBody ? sanitizeLineMessage(customBody) : await getLineCallTemplate(env, clinic.id, type);
  const text = renderLineCallTemplate(template, {
    clinic_name: clinic.clinic_name || clinic.display_name || SERVICE_NAME,
    guardian_name: target.guardian_name,
    pet_name: target.pet_name,
    appointment_date: lineCallDateLabel(target.appointment_date),
    appointment_time: target.appointment_time,
    service_name: target.service_name,
    queue_number: target.source?.queue_number || ""
  });
  return sanitizeLineMessage(text);
}

async function linePushText(env, lineUserId, text) {
  const token = cleanString(env.LINE_CHANNEL_ACCESS_TOKEN);
  if (!token) throw new Error("Cloudflare Secret LINE_CHANNEL_ACCESS_TOKEN が未設定です。");
  const response = await fetch(LINE_PUSH_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ to: lineUserId, messages: [{ type: "text", text }] })
  });
  const responseText = await response.text();
  let responseBody = null;
  if (responseText) {
    try { responseBody = JSON.parse(responseText); } catch { responseBody = responseText; }
  }
  const requestId = response.headers.get("x-line-request-id") || "";
  if (!response.ok) {
    const message = responseBody?.message || responseText || `LINE送信に失敗しました。status=${response.status}`;
    const error = new Error(message);
    error.response_status = response.status;
    error.request_id = requestId;
    error.response_body = responseBody;
    throw error;
  }
  return { ok: true, status: response.status, request_id: requestId, response: responseBody };
}

async function assertLineCallRateLimit(env, clinic, settings) {
  const maxPerMinute = Math.max(1, Math.min(100, Number(settings?.max_messages_per_minute || 20)));
  const since = new Date(Date.now() - 60 * 1000).toISOString();
  const rows = await selectRows(env, TABLES.messageQueue, {
    select: "id",
    clinic_id: `eq.${clinic.id}`,
    delivery_mode: "eq.send",
    last_attempt_at: `gte.${since}`,
    limit: maxPerMinute + 1
  });
  if (rows.length >= maxPerMinute) {
    throw new Error(`1分あたりのLINE送信上限（${maxPerMinute}件）に達しました。少し待ってから再実行してください。`);
  }
  return { ok: true, count: rows.length, max_per_minute: maxPerMinute };
}

async function sendExistingLineQueueItem(env, clinic, settings, item, target) {
  const mode = effectiveLineCallMode(env, clinic, settings);
  const now = new Date().toISOString();
  if (mode === "hold") {
    const rows = await updateRows(env, TABLES.messageQueue, {
      id: `eq.${item.id}`,
      clinic_id: `eq.${clinic.id}`
    }, {
      status: "pending",
      delivery_mode: "hold",
      delivery_status: "held",
      error_message: null,
      locked_at: null,
      payload: { ...(item.payload || {}), effective_mode: "hold", demo_forced_hold: isDemoClinicForLineCall(clinic) }
    });
    return { item: Array.isArray(rows) ? rows[0] : rows, held: true, sent: false };
  }

  if (!target?.can_send_line) throw new Error("LINE未連携のため送信できません。");
  if (!lineCallTokenConfigured(env)) throw new Error("Cloudflare Secret LINE_CHANNEL_ACCESS_TOKEN が未設定です。");
  await assertLineCallRateLimit(env, clinic, settings);

  await updateRows(env, TABLES.messageQueue, { id: `eq.${item.id}`, clinic_id: `eq.${clinic.id}` }, {
    delivery_mode: "send",
    delivery_status: "processing",
    locked_at: now,
    last_attempt_at: now,
    attempt_count: Number(item.attempt_count || 0) + 1,
    error_message: null
  });

  try {
    const result = await linePushText(env, target.line_user_id, item.body);
    const rows = await updateRows(env, TABLES.messageQueue, { id: `eq.${item.id}`, clinic_id: `eq.${clinic.id}` }, {
      status: "sent",
      delivery_status: "sent",
      sent_at: new Date().toISOString(),
      last_attempt_at: now,
      locked_at: null,
      provider_request_id: result.request_id || null,
      provider_response_code: result.status,
      error_message: null
    });
    return { item: Array.isArray(rows) ? rows[0] : rows, held: false, sent: true, provider: result };
  } catch (error) {
    const rows = await updateRows(env, TABLES.messageQueue, { id: `eq.${item.id}`, clinic_id: `eq.${clinic.id}` }, {
      status: "failed",
      delivery_status: "failed",
      last_attempt_at: now,
      locked_at: null,
      provider_request_id: error?.request_id || null,
      provider_response_code: error?.response_status || null,
      error_message: error?.message || "LINE送信に失敗しました。"
    });
    return { item: Array.isArray(rows) ? rows[0] : rows, held: false, sent: false, failed: true, error: error?.message || String(error) };
  }
}

async function handleLineCallSettingsGet(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const clinic = await getClinicByCode(env, clinicCode);
  const settings = await getLineCallSettings(env, clinic);
  return jsonResponse({
    ok: true,
    clinic,
    settings,
    feature_version: LINE_CALL_FEATURE_VERSION,
    is_demo: isDemoClinicForLineCall(clinic),
    configured_mode: normalizeLineDeliveryMode(settings.delivery_mode),
    effective_mode: effectiveLineCallMode(env, clinic, settings),
    token_configured: lineCallTokenConfigured(env),
    demo_forced_hold: isDemoClinicForLineCall(clinic)
  });
}

async function handleLineCallSettingsSave(request, env) {
  const body = await readJson(request);
  const clinic = await getClinicByCode(env, getRequestedClinicCode(request, body));
  const current = await getLineCallSettings(env, clinic);
  const requestedMode = normalizeLineDeliveryMode(body.delivery_mode || current.delivery_mode);
  const payload = {
    clinic_id: clinic.id,
    enabled: body.enabled === undefined ? current.enabled : toBool(body.enabled, true),
    delivery_mode: isDemoClinicForLineCall(clinic) ? "hold" : requestedMode,
    queue_call_enabled: body.queue_call_enabled === undefined ? current.queue_call_enabled : toBool(body.queue_call_enabled, true),
    medicine_ready_enabled: body.medicine_ready_enabled === undefined ? current.medicine_ready_enabled : toBool(body.medicine_ready_enabled, true),
    appointment_reminder_enabled: body.appointment_reminder_enabled === undefined ? current.appointment_reminder_enabled : toBool(body.appointment_reminder_enabled, true),
    allow_manual_message: body.allow_manual_message === undefined ? current.allow_manual_message : toBool(body.allow_manual_message, true),
    max_messages_per_minute: Math.max(1, Math.min(100, Number(body.max_messages_per_minute || current.max_messages_per_minute || 20))),
    owner_note: nullIfEmpty(body.owner_note),
    feature_version: LINE_CALL_FEATURE_VERSION
  };
  const rows = await upsertRows(env, TABLES.lineCallSettings, payload, "clinic_id");
  const settings = Array.isArray(rows) ? rows[0] : rows;
  await logOperation(env, clinic.id, "admin", cleanString(body.staff_name) || "管理者", "line_call_settings_save", "line_call_settings", clinic.id, {
    requested_mode: requestedMode,
    saved_mode: settings.delivery_mode,
    demo_forced_hold: isDemoClinicForLineCall(clinic),
    worker_version: WORKER_VERSION
  });
  return jsonResponse({
    ok: true,
    message: isDemoClinicForLineCall(clinic) && requestedMode === "send"
      ? "デモ医院のため、送信ではなく保留保存に固定しました。"
      : "LINE呼び出し設定を保存しました。",
    clinic,
    settings,
    effective_mode: effectiveLineCallMode(env, clinic, settings),
    token_configured: lineCallTokenConfigured(env)
  });
}

async function lineCallGuardianMap(env, clinicId, ids) {
  const unique = Array.from(new Set((ids || []).map(cleanString).filter(Boolean)));
  if (!unique.length) return new Map();
  const rows = await selectRows(env, TABLES.guardians, {
    select: "id,guardian_name,line_user_id,line_link_status,phone,status",
    clinic_id: `eq.${clinicId}`,
    id: `in.(${unique.join(",")})`,
    limit: unique.length
  });
  return new Map(rows.map((row) => [row.id, row]));
}

async function lineCallPetMap(env, clinicId, ids) {
  const unique = Array.from(new Set((ids || []).map(cleanString).filter(Boolean)));
  if (!unique.length) return new Map();
  const rows = await selectRows(env, TABLES.pets, {
    select: "id,pet_name,species,species_label,breed,status",
    clinic_id: `eq.${clinicId}`,
    id: `in.(${unique.join(",")})`,
    limit: unique.length
  });
  return new Map(rows.map((row) => [row.id, row]));
}

function buildLineCallTargetItem(kind, row, guardian, pet, extra = {}) {
  const lineStatus = normalizeLineLinkStatusForWorker(guardian?.line_link_status, guardian?.line_user_id);
  return {
    target_kind: kind,
    target_id: kind === "queue" ? (row.waiting_entry_id || row.id) : row.id,
    guardian_id: row.guardian_id || guardian?.id || null,
    pet_id: row.pet_id || pet?.id || null,
    guardian_name: guardian?.guardian_name || row.guardian_name_snapshot || row.guardian_name || "飼い主",
    pet_name: pet?.pet_name || row.pet_name_snapshot || row.pet_name || "ペット",
    line_link_status: lineStatus,
    can_send_line: lineStatus === "linked" && Boolean(cleanString(guardian?.line_user_id)),
    status: row.status || "",
    appointment_date: row.appointment_date || row.target_date || "",
    appointment_time: cleanString(row.start_time || row.visit_time).slice(0, 5),
    queue_number: row.queue_number || null,
    entry_kind: row.entry_kind || "",
    request_category: row.request_category || "",
    service_name: extra.service_name || "",
    source: row.source || ""
  };
}

async function handleLineCallTargets(request, env) {
  const clinic = await getClinicByCode(env, getParam(request, "clinic_code", DEFAULT_CLINIC_CODE));
  const kind = cleanString(getParam(request, "target_kind", "queue")) === "appointment" ? "appointment" : "queue";
  const date = normalizeQueueDate(getParam(request, "date", todayJST()));
  let rows = [];
  let serviceMap = new Map();

  if (kind === "appointment") {
    rows = await selectRows(env, TABLES.exactAppointments, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      appointment_date: `eq.${date}`,
      status: "in.(scheduled,confirmed)",
      order: "start_time.asc",
      limit: 200
    });
    const serviceIds = Array.from(new Set(rows.map((x) => x.service_type_id).filter(Boolean)));
    if (serviceIds.length) {
      const services = await selectRows(env, TABLES.exactAppointmentServices, {
        select: "id,service_name",
        clinic_id: `eq.${clinic.id}`,
        id: `in.(${serviceIds.join(",")})`,
        limit: serviceIds.length
      });
      serviceMap = new Map(services.map((x) => [x.id, x.service_name]));
    }
  } else {
    rows = await getQueueEntriesRows(env, clinic.id, { date, limit: 200 });
  }

  const guardianMap = await lineCallGuardianMap(env, clinic.id, rows.map((x) => x.guardian_id));
  const petMap = await lineCallPetMap(env, clinic.id, rows.map((x) => x.pet_id));
  const items = rows.map((row) => buildLineCallTargetItem(kind, row, guardianMap.get(row.guardian_id), petMap.get(row.pet_id), {
    service_name: serviceMap.get(row.service_type_id) || ""
  }));

  return jsonResponse({ ok: true, clinic, target_kind: kind, date, count: items.length, items });
}

async function handleLineCallPreview(request, env) {
  const body = await readJson(request);
  const clinic = await getClinicByCode(env, getRequestedClinicCode(request, body));
  const settings = await getLineCallSettings(env, clinic);
  const target = await resolveLineCallTarget(env, clinic, body);
  const messageType = cleanString(body.message_type) || "queue_soon";
  if (messageType === "manual" && settings.allow_manual_message !== true) {
    return errorResponse("個別メッセージは医院設定で無効です。", 403);
  }
  const message = await buildLineCallMessage(env, clinic, target, messageType, body.body || body.message || "");
  return jsonResponse({
    ok: true,
    clinic,
    target: { ...target, line_user_id: target.line_user_id ? "configured" : "" },
    message_type: messageType,
    message_type_label: lineCallTypeLabel(messageType),
    body: message,
    effective_mode: effectiveLineCallMode(env, clinic, settings),
    will_send: effectiveLineCallMode(env, clinic, settings) === "send" && target.can_send_line && lineCallTokenConfigured(env),
    demo_forced_hold: isDemoClinicForLineCall(clinic)
  });
}

async function handleLineCallSend(request, env) {
  const body = await readJson(request);
  const clinic = await getClinicByCode(env, getRequestedClinicCode(request, body));
  const settings = await getLineCallSettings(env, clinic);
  const target = await resolveLineCallTarget(env, clinic, body);
  const messageType = cleanString(body.message_type) || "queue_soon";

  if (settings.enabled !== true) return errorResponse("LINE呼び出しは医院設定で停止中です。", 403);
  if (!target.can_send_line) return errorResponse("LINE未連携の飼い主には送信できません。", 409, {
    line_link_status: target.line_link_status,
    guardian_name: target.guardian_name,
    pet_name: target.pet_name
  });
  if (messageType === "manual" && settings.allow_manual_message !== true) return errorResponse("個別メッセージは医院設定で無効です。", 403);

  const message = await buildLineCallMessage(env, clinic, target, messageType, body.body || body.message || "");
  const baseKey = `${messageType}:${target.target_kind}:${target.target_id}`;
  const dedupeKey = body.force_resend === true
    ? `${baseKey}:resend:${crypto.randomUUID()}`
    : baseKey;

  if (body.force_resend !== true) {
    const existing = await selectSingle(env, TABLES.messageQueue, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      dedupe_key: `eq.${dedupeKey}`,
      status: "neq.cancelled"
    });
    if (existing) return errorResponse("同じ対象へ同じ案内がすでに登録されています。二重送信を防止しました。", 409, {
      duplicate: true,
      existing_item: existing
    });
  }

  const mode = effectiveLineCallMode(env, clinic, settings);
  if (mode === "send") {
    if (!lineCallTokenConfigured(env)) return errorResponse("Cloudflare Secret LINE_CHANNEL_ACCESS_TOKEN が未設定です。", 412);
    try {
      await assertLineCallRateLimit(env, clinic, settings);
    } catch (error) {
      return errorResponse(error?.message || "LINE送信上限に達しました。", 429);
    }
  }
  const scheduledFor = body.scheduled_for || null;
  const insertPayload = {
    clinic_id: clinic.id,
    guardian_id: target.guardian_id,
    pet_id: target.pet_id,
    template_id: null,
    message_type: messageType,
    body: message,
    status: "pending",
    scheduled_for: scheduledFor,
    created_by_staff: nullIfEmpty(body.staff_name) || "スタッフ",
    target_kind: target.target_kind,
    target_id: target.target_id,
    waiting_entry_id: target.target_kind === "queue" ? target.target_id : null,
    exact_appointment_id: target.target_kind === "appointment" ? target.target_id : null,
    trigger_type: cleanString(body.trigger_type) || "manual_button",
    delivery_mode: mode,
    delivery_status: mode === "send" ? "queued" : "held",
    dedupe_key: dedupeKey,
    recipient_name: target.guardian_name,
    pet_name_snapshot: target.pet_name,
    provider: "line",
    attempt_count: 0,
    payload: {
      feature_version: LINE_CALL_FEATURE_VERSION,
      worker_version: WORKER_VERSION,
      message_type_label: lineCallTypeLabel(messageType),
      target_status: target.status,
      appointment_date: target.appointment_date || null,
      appointment_time: target.appointment_time || null,
      service_name: target.service_name || null,
      demo_forced_hold: isDemoClinicForLineCall(clinic)
    }
  };

  let item;
  try {
    const rows = await insertRows(env, TABLES.messageQueue, insertPayload);
    item = Array.isArray(rows) ? rows[0] : rows;
  } catch (error) {
    if (String(error?.message || "").toLowerCase().includes("duplicate")) {
      return errorResponse("同じ対象へ同じ案内がすでに登録されています。二重送信を防止しました。", 409, { duplicate: true });
    }
    throw error;
  }

  const result = await sendExistingLineQueueItem(env, clinic, settings, item, target);
  await logOperation(env, clinic.id, "staff", cleanString(body.staff_name) || "スタッフ", "line_call_send", "message_queue", item.id, {
    message_type: messageType,
    target_kind: target.target_kind,
    target_id: target.target_id,
    effective_mode: mode,
    sent: result.sent === true,
    held: result.held === true,
    failed: result.failed === true,
    worker_version: WORKER_VERSION
  });

  if (result.failed) return errorResponse(result.error || "LINE送信に失敗しました。", 502, {
    item: result.item,
    effective_mode: mode
  });

  return jsonResponse({
    ok: true,
    message: result.sent
      ? "LINEへ送信しました。"
      : "デモ・保留モードのため、実送信せず送信履歴へ保留保存しました。",
    item: result.item,
    sent: result.sent === true,
    held: result.held === true,
    effective_mode: mode,
    demo_forced_hold: isDemoClinicForLineCall(clinic)
  });
}

async function handleLineCallRetry(request, env) {
  const body = await readJson(request);
  const clinic = await getClinicByCode(env, getRequestedClinicCode(request, body));
  const settings = await getLineCallSettings(env, clinic);
  const id = cleanString(body.message_id || body.id);
  if (!id) return errorResponse("message_id が必要です。", 400);
  const item = await selectSingle(env, TABLES.messageQueue, {
    select: "*",
    id: `eq.${id}`,
    clinic_id: `eq.${clinic.id}`
  });
  if (!item) return errorResponse("送信履歴が見つかりません。", 404);
  if (["sent", "cancelled"].includes(item.delivery_status)) return errorResponse("送信済みまたは取消済みの履歴は再実行できません。", 409);
  const target = await resolveLineCallTarget(env, clinic, {
    target_kind: item.target_kind || (item.waiting_entry_id ? "queue" : item.exact_appointment_id ? "appointment" : "manual"),
    target_id: item.target_id || item.waiting_entry_id || item.exact_appointment_id,
    guardian_id: item.guardian_id,
    pet_id: item.pet_id,
    pet_name: item.pet_name_snapshot
  });
  const result = await sendExistingLineQueueItem(env, clinic, settings, item, target);
  if (result.failed) return errorResponse(result.error || "LINE再送信に失敗しました。", 502, { item: result.item });
  return jsonResponse({
    ok: true,
    message: result.sent ? "LINEへ再送信しました。" : "保留状態を更新しました。",
    item: result.item,
    sent: result.sent === true,
    held: result.held === true,
    effective_mode: effectiveLineCallMode(env, clinic, settings)
  });
}

async function handleLineCallCancel(request, env) {
  const body = await readJson(request);
  const clinic = await getClinicByCode(env, getRequestedClinicCode(request, body));
  const id = cleanString(body.message_id || body.id);
  if (!id) return errorResponse("message_id が必要です。", 400);
  const rows = await updateRows(env, TABLES.messageQueue, { id: `eq.${id}`, clinic_id: `eq.${clinic.id}` }, {
    status: "cancelled",
    delivery_status: "cancelled",
    error_message: nullIfEmpty(body.reason),
    locked_at: null
  });
  return jsonResponse({ ok: true, message: "送信予定を取り消しました。", item: Array.isArray(rows) ? rows[0] : rows });
}

async function handleLineCallHistory(request, env) {
  const clinic = await getClinicByCode(env, getParam(request, "clinic_code", DEFAULT_CLINIC_CODE));
  const limit = normalizeLimit(getParam(request, "limit", "100"), 100, 300);
  const query = {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    order: "created_at.desc",
    limit
  };
  const deliveryStatus = cleanString(getParam(request, "delivery_status", ""));
  if (deliveryStatus && deliveryStatus !== "all") query.delivery_status = `eq.${deliveryStatus}`;
  const rows = await selectRows(env, TABLES.messageQueue, query);
  return jsonResponse({ ok: true, clinic, feature_version: LINE_CALL_FEATURE_VERSION, count: rows.length, items: rows });
}

async function handleLineCallCheck(request, env) {
  const clinic = await getClinicByCode(env, getParam(request, "clinic_code", DEFAULT_CLINIC_CODE));
  const settings = await getLineCallSettings(env, clinic);
  const checks = [];
  const add = (key, label, ok, detail) => checks.push({ key, label, ok: Boolean(ok), detail });

  try {
    const rows = await selectRows(env, TABLES.lineCallSettings, { select: "clinic_id,enabled,delivery_mode,feature_version", clinic_id: `eq.${clinic.id}` });
    add("settings_table", "LINE呼び出し設定", rows.length === 1, rows[0] || null);
  } catch (error) { add("settings_table", "LINE呼び出し設定", false, error?.message || String(error)); }
  try {
    await selectRows(env, TABLES.messageQueue, { select: "id,delivery_status,dedupe_key,target_kind", clinic_id: `eq.${clinic.id}`, limit: 1 });
    add("message_queue_columns", "送信履歴拡張列", true, "読取可能");
  } catch (error) { add("message_queue_columns", "送信履歴拡張列", false, error?.message || String(error)); }
  try {
    const templates = await selectRows(env, TABLES.messageTemplates, { select: "id,template_key", clinic_id: `eq.${clinic.id}`, category: "eq.line_call", is_active: "eq.true" });
    add("templates", "LINE呼び出しテンプレート", templates.length >= 4, `${templates.length}件`);
  } catch (error) { add("templates", "LINE呼び出しテンプレート", false, error?.message || String(error)); }

  add("demo_guard", "デモ医院の実送信防止", !isDemoClinicForLineCall(clinic) || effectiveLineCallMode(env, clinic, settings) === "hold", isDemoClinicForLineCall(clinic) ? "デモはhold固定" : "本番医院");
  add("line_token", "LINE Channel Access Token", lineCallTokenConfigured(env), lineCallTokenConfigured(env) ? "設定済み" : "未設定（デモ保留検査は可能）");

  let bot = null;
  if (toBool(getParam(request, "validate_token", "false"), false) && lineCallTokenConfigured(env)) {
    try {
      const response = await fetch(LINE_BOT_INFO_ENDPOINT, { headers: { Authorization: `Bearer ${cleanString(env.LINE_CHANNEL_ACCESS_TOKEN)}` } });
      const text = await response.text();
      bot = text ? JSON.parse(text) : {};
      add("line_token_validation", "LINE Bot情報取得", response.ok, response.ok ? { displayName: bot.displayName, basicId: bot.basicId } : bot);
    } catch (error) { add("line_token_validation", "LINE Bot情報取得", false, error?.message || String(error)); }
  }

  const failed = checks.filter((x) => !x.ok && x.key !== "line_token");
  return jsonResponse({
    ok: failed.length === 0,
    clinic,
    feature_version: LINE_CALL_FEATURE_VERSION,
    worker_version: WORKER_VERSION,
    effective_mode: effectiveLineCallMode(env, clinic, settings),
    token_configured: lineCallTokenConfigured(env),
    demo_forced_hold: isDemoClinicForLineCall(clinic),
    checks,
    bot
  }, failed.length ? 500 : 200);
}



// =========================================================
// STEP VET-REMINDER-AUTO-1
// 日時指定予約の前日LINE案内をCloudflare Cron Triggerから自動実行。
// ・デモ医院は必ずhold保存（実送信しない）
// ・本番はLINE連携済みのみ送信
// ・手動送信と同じdedupe_keyを使用して二重送信を防止
// ・1回のCronで医院設定の1分上限まで処理し、残りは次のCronへ繰り越す
// =========================================================

async function appointmentReminderCandidateSummary(env, clinic, settings, targetDate) {
  const rows = await selectRows(env, TABLES.exactAppointments, {
    select: "id,guardian_id,pet_id,status,appointment_date,start_time,service_type_id",
    clinic_id: `eq.${clinic.id}`,
    appointment_date: `eq.${targetDate}`,
    status: "in.(scheduled,confirmed)",
    order: "start_time.asc",
    limit: 500
  });
  let eligible = 0;
  let unlinked = 0;
  let duplicate = 0;
  for (const row of rows) {
    try {
      const target = await resolveLineCallTarget(env, clinic, { target_kind: "appointment", target_id: row.id });
      if (!target.can_send_line) { unlinked += 1; continue; }
      const dedupeKey = `appointment_reminder:appointment:${row.id}`;
      const existing = await selectSingle(env, TABLES.messageQueue, {
        select: "id,delivery_status,status",
        clinic_id: `eq.${clinic.id}`,
        dedupe_key: `eq.${dedupeKey}`,
        status: "neq.cancelled"
      });
      if (existing) { duplicate += 1; continue; }
      eligible += 1;
    } catch (_) {}
  }
  return { total: rows.length, eligible, unlinked, duplicate, effective_mode: effectiveLineCallMode(env, clinic, settings) };
}

async function handleAppointmentReminderAutomationStatus(request, env) {
  const clinic = await getClinicByCode(env, getParam(request, "clinic_code", DEFAULT_CLINIC_CODE));
  const settings = await getLineCallSettings(env, clinic);
  const targetDate = addDays(todayJST(), 1);
  const summary = await appointmentReminderCandidateSummary(env, clinic, settings, targetDate);
  return jsonResponse({
    ok: true,
    clinic: { id: clinic.id, clinic_code: clinic.clinic_code, clinic_name: clinic.clinic_name || clinic.display_name },
    automation_version: APPOINTMENT_REMINDER_AUTOMATION_VERSION,
    recommended_cron: APPOINTMENT_REMINDER_RECOMMENDED_CRON,
    target_date: targetDate,
    enabled: settings.enabled === true && settings.appointment_reminder_enabled === true,
    token_configured: lineCallTokenConfigured(env),
    demo_forced_hold: isDemoClinicForLineCall(clinic),
    summary
  });
}

async function runAppointmentReminderAutomation(env, meta = {}) {
  const targetDate = addDays(todayJST(), 1);
  const result = {
    ok: true,
    automation_version: APPOINTMENT_REMINDER_AUTOMATION_VERSION,
    target_date: targetDate,
    cron: cleanString(meta.cron),
    scheduled_time: meta.scheduled_time || null,
    clinics: 0,
    appointments: 0,
    processed: 0,
    sent: 0,
    held: 0,
    skipped_unlinked: 0,
    skipped_duplicate: 0,
    deferred_batch_limit: 0,
    failed: 0,
    errors: []
  };

  const settingsRows = await selectRows(env, TABLES.lineCallSettings, {
    select: "*",
    enabled: "eq.true",
    appointment_reminder_enabled: "eq.true",
    limit: 500
  });

  for (const settings of settingsRows) {
    const clinic = await selectSingle(env, TABLES.clinics, {
      select: "*",
      id: `eq.${settings.clinic_id}`,
      is_active: "eq.true"
    }).catch(() => null);
    if (!clinic) continue;
    result.clinics += 1;

    const appointments = await selectRows(env, TABLES.exactAppointments, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      appointment_date: `eq.${targetDate}`,
      status: "in.(scheduled,confirmed)",
      order: "start_time.asc",
      limit: 500
    });
    result.appointments += appointments.length;

    const mode = effectiveLineCallMode(env, clinic, settings);
    const batchLimit = mode === "send"
      ? Math.max(1, Math.min(100, Number(settings.max_messages_per_minute || 20)))
      : 500;
    let batchCount = 0;

    for (const appointment of appointments) {
      if (batchCount >= batchLimit) {
        result.deferred_batch_limit += 1;
        continue;
      }
      try {
        const target = await resolveLineCallTarget(env, clinic, {
          target_kind: "appointment",
          target_id: appointment.id
        });
        if (!target.can_send_line) {
          result.skipped_unlinked += 1;
          continue;
        }

        const dedupeKey = `appointment_reminder:appointment:${appointment.id}`;
        const existing = await selectSingle(env, TABLES.messageQueue, {
          select: "*",
          clinic_id: `eq.${clinic.id}`,
          dedupe_key: `eq.${dedupeKey}`,
          status: "neq.cancelled"
        });
        if (existing) {
          result.skipped_duplicate += 1;
          continue;
        }

        const message = await buildLineCallMessage(env, clinic, target, "appointment_reminder", "");
        const insertPayload = {
          clinic_id: clinic.id,
          guardian_id: target.guardian_id,
          pet_id: target.pet_id,
          template_id: null,
          message_type: "appointment_reminder",
          body: message,
          status: "pending",
          scheduled_for: new Date().toISOString(),
          created_by_staff: "自動前日案内",
          target_kind: "appointment",
          target_id: appointment.id,
          waiting_entry_id: null,
          exact_appointment_id: appointment.id,
          trigger_type: "scheduled_cron",
          delivery_mode: mode,
          delivery_status: mode === "send" ? "queued" : "held",
          dedupe_key: dedupeKey,
          recipient_name: target.guardian_name,
          pet_name_snapshot: target.pet_name,
          provider: "line",
          attempt_count: 0,
          payload: {
            feature_version: LINE_CALL_FEATURE_VERSION,
            automation_version: APPOINTMENT_REMINDER_AUTOMATION_VERSION,
            worker_version: WORKER_VERSION,
            appointment_date: target.appointment_date || null,
            appointment_time: target.appointment_time || null,
            service_name: target.service_name || null,
            cron: cleanString(meta.cron),
            demo_forced_hold: isDemoClinicForLineCall(clinic)
          }
        };

        const rows = await insertRows(env, TABLES.messageQueue, insertPayload);
        const item = Array.isArray(rows) ? rows[0] : rows;
        batchCount += 1;
        result.processed += 1;

        const delivery = await sendExistingLineQueueItem(env, clinic, settings, item, target);
        if (delivery.sent) result.sent += 1;
        else if (delivery.held) result.held += 1;
        else if (delivery.failed) result.failed += 1;

        await logOperation(env, clinic.id, "system", "自動前日案内", "appointment_reminder_auto", "message_queue", item?.id || appointment.id, {
          appointment_id: appointment.id,
          target_date: targetDate,
          effective_mode: mode,
          sent: delivery.sent === true,
          held: delivery.held === true,
          failed: delivery.failed === true,
          automation_version: APPOINTMENT_REMINDER_AUTOMATION_VERSION,
          worker_version: WORKER_VERSION
        }).catch(() => null);
      } catch (error) {
        result.failed += 1;
        result.errors.push({ appointment_id: appointment.id, message: error?.message || String(error) });
      }
    }
  }

  result.ok = result.failed === 0;
  return result;
}


// =========================================================
// STEP VET-RECALL-AUTO-1
// 予防・再診フォローの自動LINEリコール
//
// 安全ルール:
// ・デモ医院は常にholdで実送信しない
// ・本番医院は VET_RECALL_AUTOMATION_ENABLED=true の明示設定がない限り実行しない
// ・予防は「7日前」と「予定日」の2段階
// ・再診フォローは「予定日」の1段階
// ・同じ予定・同じ段階はdedupe_keyで二重送信しない
// ・LINE未連携はスキップ
// ・通知失敗で元の予防/フォロー予定を変更しない
// =========================================================

function recallAutomationEnabled(env, clinic) {
  if (isDemoClinicForLineCall(clinic)) return true;
  return toBool(env.VET_RECALL_AUTOMATION_ENABLED, false);
}

function recallIgnoredPreventionStatus(value) {
  return ["done", "completed", "cancelled", "inactive", "notified"].includes(cleanString(value).toLowerCase());
}

function recallIgnoredFollowupStatus(value) {
  return ["done", "completed", "cancelled", "inactive", "copied"].includes(cleanString(value).toLowerCase());
}

function recallMessageForPrevention(clinic, target, row, stage) {
  const clinicName = clinic.clinic_name || clinic.display_name || SERVICE_NAME;
  const guardian = target.guardian_name || "飼い主";
  const pet = target.pet_name || "ペット";
  const title = cleanString(row.title) || "予防予定";
  const due = lineCallDateLabel(row.due_date);
  if (cleanString(row.line_message)) return sanitizeLineMessage(row.line_message);

  if (stage === "advance_7d") {
    return sanitizeLineMessage(
      `${guardian}様\n${pet}ちゃんの${title}の時期が近づいています。\n予定日：${due}\n\nご都合のよいタイミングで受診・ご相談ください。\n${clinicName}`
    );
  }
  return sanitizeLineMessage(
    `${guardian}様\n${pet}ちゃんの${title}の予定時期になりました。\n予定日：${due}\n\n受診時期についてご不明な点がありましたら病院へご相談ください。\n${clinicName}`
  );
}

function recallMessageForFollowup(clinic, target, row) {
  const clinicName = clinic.clinic_name || clinic.display_name || SERVICE_NAME;
  const guardian = target.guardian_name || "飼い主";
  const pet = target.pet_name || "ペット";
  const title = cleanString(row.title) || "再診・経過確認";
  const due = lineCallDateLabel(row.due_date);
  if (cleanString(row.line_message)) return sanitizeLineMessage(row.line_message);

  return sanitizeLineMessage(
    `${guardian}様\n${pet}ちゃんの${title}の予定日です。\n予定日：${due}\n\nその後の様子に合わせて、必要な場合は受診をご検討ください。\n${clinicName}`
  );
}

async function recallExistingQueueItem(env, clinicId, dedupeKey) {
  return selectSingle(env, TABLES.messageQueue, {
    select: "*",
    clinic_id: `eq.${clinicId}`,
    dedupe_key: `eq.${dedupeKey}`,
    status: "neq.cancelled"
  }).catch(() => null);
}

async function createAndDeliverRecallQueueItem(env, clinic, settings, target, options) {
  const existing = await recallExistingQueueItem(env, clinic.id, options.dedupe_key);
  if (existing) {
    return { ok: true, skipped: true, duplicate: true, reason: "dedupe_guard", item: existing };
  }

  const mode = effectiveLineCallMode(env, clinic, settings);
  if (mode === "send" && !lineCallTokenConfigured(env)) {
    return { ok: true, skipped: true, reason: "line_channel_access_token_missing" };
  }

  const rows = await insertRows(env, TABLES.messageQueue, {
    clinic_id: clinic.id,
    guardian_id: target.guardian_id,
    pet_id: target.pet_id,
    template_id: null,
    message_type: options.message_type,
    body: options.body,
    status: "pending",
    scheduled_for: new Date().toISOString(),
    created_by_staff: "自動リコール",
    target_kind: "manual",
    target_id: options.target_id,
    waiting_entry_id: null,
    exact_appointment_id: null,
    trigger_type: "scheduled_recall",
    delivery_mode: mode,
    delivery_status: mode === "send" ? "queued" : "held",
    dedupe_key: options.dedupe_key,
    recipient_name: target.guardian_name,
    pet_name_snapshot: target.pet_name,
    provider: "line",
    attempt_count: 0,
    payload: {
      feature_version: RECALL_AUTOMATION_VERSION,
      worker_version: WORKER_VERSION,
      recall_kind: options.recall_kind,
      recall_stage: options.recall_stage,
      due_date: options.due_date,
      demo_forced_hold: isDemoClinicForLineCall(clinic)
    }
  });

  const item = Array.isArray(rows) ? rows[0] : rows;
  const delivery = await sendExistingLineQueueItem(env, clinic, settings, item, target);
  return {
    ok: true,
    skipped: false,
    sent: delivery.sent === true,
    held: delivery.held === true,
    failed: delivery.failed === true,
    error: delivery.error || null,
    item: delivery.item || item
  };
}

async function recallCandidatesForClinic(env, clinic) {
  const today = todayJST();
  const advance = addDays(today, 7);
  const [preventionAdvance, preventionDue, followupDue] = await Promise.all([
    selectRows(env, TABLES.preventionSchedules, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      due_date: `eq.${advance}`,
      order: "due_date.asc",
      limit: 500
    }),
    selectRows(env, TABLES.preventionSchedules, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      due_date: `eq.${today}`,
      order: "due_date.asc",
      limit: 500
    }),
    selectRows(env, TABLES.followups, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      due_date: `eq.${today}`,
      order: "due_date.asc",
      limit: 500
    })
  ]);

  return {
    today,
    advance_date: advance,
    prevention_advance: preventionAdvance.filter((x) => !recallIgnoredPreventionStatus(x.status)),
    prevention_due: preventionDue.filter((x) => !recallIgnoredPreventionStatus(x.status)),
    followup_due: followupDue.filter((x) => {
      if (recallIgnoredFollowupStatus(x.status)) return false;
      if (x.snoozed_until && cleanString(x.snoozed_until) > today) return false;
      return true;
    })
  };
}

async function handleRecallAutomationStatus(request, env) {
  const clinic = await getClinicByCode(env, getParam(request, "clinic_code", DEFAULT_CLINIC_CODE));
  const settings = await getLineCallSettings(env, clinic);
  const candidates = await recallCandidatesForClinic(env, clinic);

  const countLinked = async (rows) => {
    let linked = 0;
    let unlinked = 0;
    for (const row of rows) {
      try {
        const target = await resolveLineCallTarget(env, clinic, {
          target_kind: "manual",
          guardian_id: row.guardian_id,
          pet_id: row.pet_id
        });
        if (target.can_send_line) linked += 1;
        else unlinked += 1;
      } catch (_) {
        unlinked += 1;
      }
    }
    return { total: rows.length, linked, unlinked };
  };

  const [advance, preventionDue, followupDue] = await Promise.all([
    countLinked(candidates.prevention_advance),
    countLinked(candidates.prevention_due),
    countLinked(candidates.followup_due)
  ]);

  return jsonResponse({
    ok: true,
    automation_version: RECALL_AUTOMATION_VERSION,
    clinic: {
      id: clinic.id,
      clinic_code: clinic.clinic_code,
      clinic_name: clinic.clinic_name || clinic.display_name
    },
    enabled: recallAutomationEnabled(env, clinic),
    production_opt_in: toBool(env.VET_RECALL_AUTOMATION_ENABLED, false),
    demo_forced_hold: isDemoClinicForLineCall(clinic),
    effective_mode: effectiveLineCallMode(env, clinic, settings),
    today: candidates.today,
    advance_date: candidates.advance_date,
    candidates: {
      prevention_advance_7d: advance,
      prevention_due_today: preventionDue,
      followup_due_today: followupDue
    }
  });
}

async function runRecallAutomation(env, meta = {}) {
  const result = {
    ok: true,
    automation_version: RECALL_AUTOMATION_VERSION,
    cron: cleanString(meta.cron),
    scheduled_time: meta.scheduled_time || null,
    clinics: 0,
    disabled_clinics: 0,
    candidates: 0,
    processed: 0,
    sent: 0,
    held: 0,
    skipped_unlinked: 0,
    skipped_duplicate: 0,
    deferred_batch_limit: 0,
    failed: 0,
    errors: []
  };

  const clinics = await selectRows(env, TABLES.clinics, {
    select: "*",
    is_active: "eq.true",
    limit: 500
  });

  for (const clinic of clinics) {
    if (!recallAutomationEnabled(env, clinic)) {
      result.disabled_clinics += 1;
      continue;
    }

    const settings = await getLineCallSettings(env, clinic);
    if (settings.enabled !== true) {
      result.disabled_clinics += 1;
      continue;
    }

    result.clinics += 1;
    const candidates = await recallCandidatesForClinic(env, clinic);
    const tasks = [
      ...candidates.prevention_advance.map((row) => ({
        kind: "prevention",
        stage: "advance_7d",
        row,
        due_date: row.due_date,
        message_type: "prevention_recall_advance"
      })),
      ...candidates.prevention_due.map((row) => ({
        kind: "prevention",
        stage: "due_today",
        row,
        due_date: row.due_date,
        message_type: "prevention_recall_due"
      })),
      ...candidates.followup_due.map((row) => ({
        kind: "followup",
        stage: "due_today",
        row,
        due_date: row.due_date,
        message_type: "followup_recall_due"
      }))
    ];
    result.candidates += tasks.length;

    const mode = effectiveLineCallMode(env, clinic, settings);
    const batchLimit = mode === "send"
      ? Math.max(1, Math.min(100, Number(settings.max_messages_per_minute || 20)))
      : 500;
    let batchCount = 0;

    for (const task of tasks) {
      if (batchCount >= batchLimit) {
        result.deferred_batch_limit += 1;
        continue;
      }

      try {
        const row = task.row;
        const target = await resolveLineCallTarget(env, clinic, {
          target_kind: "manual",
          guardian_id: row.guardian_id,
          pet_id: row.pet_id
        });
        if (!target.can_send_line) {
          result.skipped_unlinked += 1;
          continue;
        }

        const dedupeKey = `${task.kind}_recall:${task.stage}:${row.id}:${task.due_date}`;
        const body = task.kind === "prevention"
          ? recallMessageForPrevention(clinic, target, row, task.stage)
          : recallMessageForFollowup(clinic, target, row);

        const delivery = await createAndDeliverRecallQueueItem(env, clinic, settings, target, {
          target_id: row.id,
          recall_kind: task.kind,
          recall_stage: task.stage,
          due_date: task.due_date,
          dedupe_key: dedupeKey,
          message_type: task.message_type,
          body
        });

        if (delivery.duplicate) {
          result.skipped_duplicate += 1;
          continue;
        }
        if (delivery.skipped) {
          if (delivery.reason === "line_channel_access_token_missing") {
            result.failed += 1;
            result.errors.push({ id: row.id, reason: delivery.reason });
          }
          continue;
        }

        batchCount += 1;
        result.processed += 1;
        if (delivery.sent) result.sent += 1;
        else if (delivery.held) result.held += 1;
        else if (delivery.failed) result.failed += 1;

        await logOperation(
          env,
          clinic.id,
          "system",
          "自動リコール",
          "vet_recall_auto",
          task.kind,
          row.id,
          {
            recall_stage: task.stage,
            due_date: task.due_date,
            effective_mode: mode,
            sent: delivery.sent === true,
            held: delivery.held === true,
            failed: delivery.failed === true,
            automation_version: RECALL_AUTOMATION_VERSION,
            worker_version: WORKER_VERSION
          }
        ).catch(() => null);
      } catch (error) {
        result.failed += 1;
        result.errors.push({
          id: task.row?.id || null,
          kind: task.kind,
          stage: task.stage,
          message: error?.message || String(error)
        });
      }
    }
  }

  result.ok = result.failed === 0;
  return result;
}

async function handleTemplates(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const clinic = await getClinicByCode(env, clinicCode);
  const rows = await selectRows(env, TABLES.messageTemplates, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    is_active: "eq.true",
    order: "sort_order.asc"
  });
  return jsonResponse({ ok: true, clinic, items: rows });
}

async function handleMessageQueue(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const clinic = await getClinicByCode(env, clinicCode);
  const rows = await selectRows(env, TABLES.messageQueue, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    order: "created_at.desc",
    limit: normalizeLimit(getParam(request, "limit", "100"), 100, 300)
  });
  return jsonResponse({ ok: true, clinic, items: rows });
}

async function handleMessageQueueCreate(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  if (!body.body) return errorResponse("メッセージ本文が必要です。", 400);

  const rows = await insertRows(env, TABLES.messageQueue, {
    clinic_id: clinic.id,
    guardian_id: nullIfEmpty(body.guardian_id),
    pet_id: nullIfEmpty(body.pet_id),
    template_id: nullIfEmpty(body.template_id),
    message_type: cleanString(body.message_type) || "manual",
    body: cleanString(body.body),
    status: cleanString(body.status) || "pending",
    scheduled_for: body.scheduled_for || null,
    created_by_staff: nullIfEmpty(body.staff_name)
  });

  return jsonResponse({ ok: true, message: "メッセージキューを作成しました。", item: rows?.[0] || rows });
}

async function handleMessageQueueUpdate(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const id = cleanString(body.message_id || body.id);
  if (!id) return errorResponse("message_id が必要です。", 400);

  const payload = {};
  ["body", "status", "scheduled_for", "copied_at", "sent_at", "error_message"].forEach((key) => {
    if (body[key] !== undefined) payload[key] = body[key] === "" ? null : body[key];
  });

  if (payload.status === "copied" && !payload.copied_at) payload.copied_at = new Date().toISOString();
  if (payload.status === "sent" && !payload.sent_at) payload.sent_at = new Date().toISOString();

  const rows = await updateRows(env, TABLES.messageQueue, { id: `eq.${id}`, clinic_id: `eq.${clinic.id}` }, payload);
  return jsonResponse({ ok: true, message: "メッセージキューを更新しました。", item: rows?.[0] || rows });
}


// =========================================================
// Safety / readiness / demo
// =========================================================

function makeSafetyCheck(id, label, status, message, severity = "info") {
  return { id, label, status, message, severity };
}

async function handleAdminSafetyCheck(request, env) {
  const safety = buildSafetyMeta(request, env, {
    clinic_code: getParam(request, "clinic_code", DEFAULT_CLINIC_CODE)
  });

  let clinic = null;
  let clinic_error = null;
  try {
    clinic = await getClinicByCode(env, safety.requested_clinic_code);
  } catch (error) {
    clinic_error = error?.message || "Clinic lookup failed.";
  }

  const auth = safety.auth;
  const access = safety.cloudflare_access;
  const checks = [];

  checks.push(makeSafetyCheck(
    "admin_token_configured",
    "Worker管理コード",
    auth.admin_token_configured ? "pass" : "fail",
    auth.admin_token_configured
      ? "ADMIN_TOKEN または DPRO_ADMIN_TOKEN が設定されています。"
      : "ADMIN_TOKEN が未設定です。Cloudflare Worker の Secrets を確認してください。",
    auth.admin_token_configured ? "success" : "danger"
  ));

  checks.push(makeSafetyCheck(
    "admin_code_transport",
    "管理コード送信方式",
    auth.query_param_used ? "warn" : "pass",
    auth.query_param_used
      ? "URLパラメータで管理コードが送られています。ヘッダー送信を優先してください。"
      : "管理コードはヘッダーまたはBearerで送られており、URLに残りにくい状態です。",
    auth.query_param_used ? "warning" : "success"
  ));

  checks.push(makeSafetyCheck(
    "vet_table_separation",
    "テーブル分離",
    "pass",
    "このWorkerは vet_ 系テーブルだけを参照します。dental_qr_ 系には触れません。",
    "success"
  ));

  checks.push(makeSafetyCheck(
    "demo_clinic_guard",
    "DEMO動物病院ガード",
    safety.is_demo_clinic ? "warn" : "pass",
    safety.is_demo_clinic
      ? `現在のclinic_codeはDEMO ${safety.demo_clinic_code} です。DEMOリセットは表示対象です。`
      : `現在のclinic_codeは本番扱いです。DEMOリセットはWorker側で拒否されます。`,
    safety.is_demo_clinic ? "warning" : "success"
  ));

  checks.push(makeSafetyCheck(
    "demo_operations_disabled_env",
    "DEMO操作停止スイッチ",
    safety.demo_operations_disabled ? "pass" : "info",
    safety.demo_operations_disabled
      ? "DISABLE_DEMO_OPERATIONS=true のため、DEMOでも営業前DEMO設定は停止中です。"
      : "DISABLE_DEMO_OPERATIONS は有効ではありません。DEMOでは営業前DEMO設定を実行できます。",
    safety.demo_operations_disabled ? "success" : "info"
  ));

  return jsonResponse({
    ok: true,
    message: "DPRO PET CARE LINE Worker safety check completed.",
    safety,
    auth,
    cloudflare_access: access,
    clinic,
    clinic_error,
    checks,
    recommendations: [
      "歯科版Workerは上書きしないでください。",
      "動物病院版Workerは dpro-vet-qr-api として別作成してください。",
      "Supabaseでは vet_ 系テーブルだけを使用してください。",
      "本番動物病院では clinic_code を dpro_vet_demo 以外にしてください。",
      "本番公開前に Cloudflare Access で admin / owner / doctor / system-check を保護することを推奨します。"
    ]
  });
}

async function handleProductionReadinessCheck(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const safety = buildSafetyMeta(request, env, { clinic_code: clinicCode });

  let clinic = null;
  let clinicError = null;
  try {
    clinic = await getClinicByCode(env, clinicCode);
  } catch (error) {
    clinicError = error?.message || "Clinic lookup failed.";
  }

  const checks = [];

  checks.push(makeSafetyCheck(
    "clinic_exists",
    "動物病院コード登録",
    clinic ? "pass" : "fail",
    clinic ? `clinic_code ${clinicCode} は登録済みです。` : `clinic_code ${clinicCode} が見つかりません。vet_clinics を確認してください。`,
    clinic ? "success" : "danger"
  ));

  checks.push(makeSafetyCheck(
    "demo_clinic_not_used_for_production",
    "DEMOコードとの取り違え防止",
    clinicCode === safety.demo_clinic_code ? "warn" : "pass",
    clinicCode === safety.demo_clinic_code
      ? `現在はDEMO ${safety.demo_clinic_code} です。本番では別clinic_codeにしてください。`
      : `現在のclinic_codeは ${clinicCode} です。DEMOとは分離されています。`,
    clinicCode === safety.demo_clinic_code ? "warning" : "success"
  ));

  let settings = null;
  let regularHours = [];
  let sampleCards = [];
  if (clinic) {
    settings = await getClinicSettings(env, clinic.id);
    regularHours = await getRegularHours(env, clinic.id);
    sampleCards = await selectRows(env, TABLES.petCardView, {
      select: "card_no,pet_name,guardian_name,qr_token,card_enabled",
      clinic_id: `eq.${clinic.id}`,
      limit: 5
    });
  }

  checks.push(makeSafetyCheck(
    "clinic_settings_exists",
    "動物病院設定",
    settings ? "pass" : "fail",
    settings ? "vet_clinic_settings が作成されています。" : "vet_clinic_settings が未作成です。",
    settings ? "success" : "danger"
  ));

  checks.push(makeSafetyCheck(
    "regular_hours_7days",
    "曜日別診療時間",
    regularHours.length >= 7 ? "pass" : "fail",
    regularHours.length >= 7 ? "曜日別診療時間が7日分あります。" : `曜日別診療時間が ${regularHours.length} 件です。`,
    regularHours.length >= 7 ? "success" : "danger"
  ));

  checks.push(makeSafetyCheck(
    "sample_pet_cards",
    "ペット診察券データ",
    sampleCards.length > 0 ? "pass" : "warn",
    sampleCards.length > 0 ? `ペット診察券データが ${sampleCards.length}件以上あります。` : "ペット診察券データがまだありません。",
    sampleCards.length > 0 ? "success" : "warning"
  ));

  checks.push(makeSafetyCheck(
    "vet_table_separation",
    "歯科版との分離",
    "pass",
    "このチェックは vet_ 系テーブルのみを参照します。dental_qr_ 系には触れません。",
    "success"
  ));

  const failCount = checks.filter((item) => item.status === "fail").length;
  const warnCount = checks.filter((item) => item.status === "warn").length;
  const passCount = checks.filter((item) => item.status === "pass").length;

  return jsonResponse({
    ok: true,
    message: failCount === 0 ? "基本チェックは通っています。" : "不足している初期設定があります。",
    worker_version: WORKER_VERSION,
    clinic_code: clinicCode,
    demo_clinic_code: safety.demo_clinic_code,
    clinic,
    clinic_error: clinicError,
    settings,
    regular_hours_count: regularHours.length,
    sample_cards_count: sampleCards.length,
    summary: { pass: passCount, warn: warnCount, fail: failCount, total: checks.length },
    checks,
    recommendations: [
      "本番動物病院では dpro_vet_demo 以外の clinic_code を使用してください。",
      "病院名・電話番号・住所・診療時間・休診日メモを空欄にしないでください。",
      "曜日別診療時間は日〜土の7件を登録してください。",
      "本番公開前にペット1頭で診察券・QR受付・獣医師画面まで通し確認してください。"
    ]
  });
}


// =========================================================
// STEP VET-52.5U
// 営業デモ準備API 実データ作成確認・フォールバック
// =========================================================

const SALES_DEMO_QUEUE_PETS_STEP_52_5U = [
  {
    queue_number: 1,
    pet_name: "チェックちゃん",
    species: "dog",
    species_label: "犬",
    breed: "トイプードル",
    request_category: "general_exam",
    day_part: "morning",
    purpose: "営業デモ用：チェックちゃんの受付確認",
    symptoms_summary: "多頭登録の1頭目。診察券QRから受付した流れを見せます。",
    memo: "営業デモ用。チェックちゃんの受付確認。"
  },
  {
    queue_number: 2,
    pet_name: "ココアちゃん",
    species: "dog",
    species_label: "犬",
    breed: "ミックス",
    request_category: "vaccination",
    day_part: "morning",
    purpose: "ワクチン相談",
    symptoms_summary: "多頭登録の2頭目。同じ飼い主さんで別のペットを受付できます。",
    memo: "営業デモ用。ワクチン相談。"
  },
  {
    queue_number: 3,
    pet_name: "ハナちゃん",
    species: "cat",
    species_label: "猫",
    breed: "日本猫",
    request_category: "general_exam",
    day_part: "afternoon",
    purpose: "皮膚・耳の相談",
    symptoms_summary: "耳をかゆがる。皮膚をなめる。午後受付のサンプルです。",
    memo: "営業デモ用。皮膚・耳の相談。"
  },
  {
    queue_number: 4,
    pet_name: "モモちゃん",
    species: "dog",
    species_label: "犬",
    breed: "チワワ",
    request_category: "prevention_medicine",
    day_part: "afternoon",
    purpose: "フィラリア・予防相談",
    symptoms_summary: "予防薬と次回案内の相談。LINEフォローにつながるサンプルです。",
    memo: "営業デモ用。フィラリア・予防相談。"
  }
];

function isAcceptableClinicCalendarDay(row) {
  if (!row) return true;
  if (row.is_full_closed === true) return false;
  if (row.reception_closed === true) return false;
  if (row.can_accept_today === false) return false;
  if (row.can_accept_morning === false && row.can_accept_afternoon === false) return false;
  const label = cleanString(row.reception_label || row.day_label || row.status_label || row.memo);
  if (label.includes("休診") && !label.includes("午前") && !label.includes("午後")) return false;
  return true;
}

async function findSalesDemoTargetDateStep525U(env, clinicCode, startDate) {
  const today = normalizeQueueDate(startDate || todayJST());
  let calendar = [];
  try {
    calendar = await getClinicCalendarByCode(env, clinicCode, today, addDays(today, 45));
  } catch (error) {
    calendar = [];
  }

  if (!Array.isArray(calendar) || !calendar.length) {
    return { target_date: today, calendar, source: "no_calendar_today" };
  }

  const todayRow = calendar.find((row) => row.target_date === today) || null;
  if (!todayRow || isAcceptableClinicCalendarDay(todayRow)) {
    return { target_date: today, calendar, source: todayRow ? "today_open" : "today_no_row" };
  }

  const next = calendar.find((row) => row.target_date > today && isAcceptableClinicCalendarDay(row));
  if (next?.target_date) {
    return { target_date: next.target_date, calendar, source: "next_open_day" };
  }

  return { target_date: addDays(today, 1), calendar, source: "fallback_tomorrow" };
}

async function getQueueEntriesRangeRowsStep525U(env, clinicId, fromDate, toDate, limit = 500) {
  const query = {
    select: "*",
    clinic_id: `eq.${clinicId}`,
    order: "target_date.asc,day_part.asc,queue_number.asc,last_action_at.asc",
    limit
  };
  if (fromDate && toDate) query.and = `(target_date.gte.${fromDate},target_date.lte.${toDate})`;
  else if (fromDate) query.target_date = `gte.${fromDate}`;
  else if (toDate) query.target_date = `lte.${toDate}`;
  return selectRows(env, TABLES.waitingEntriesDetailView, query).catch(() => []);
}

async function buildSalesDemoSnapshotStep525U(env, clinic, options = {}) {
  const today = normalizeQueueDate(options.today || todayJST());
  const dateInfo = options.date_info || await findSalesDemoTargetDateStep525U(env, clinic.clinic_code, today);
  const targetDate = normalizeQueueDate(options.target_date || dateInfo.target_date || today);
  const rangeEntries = await getQueueEntriesRangeRowsStep525U(env, clinic.id, today, addDays(today, 45), 800);
  const todayEntries = rangeEntries.filter((item) => (item.target_date || item.date) === today);
  const targetEntries = rangeEntries.filter((item) => (item.target_date || item.date) === targetDate);
  const activeToday = todayEntries.filter((item) => !isFinishedQueueStatus(item.status));
  const activeTarget = targetEntries.filter((item) => !isFinishedQueueStatus(item.status));
  const futureActive = rangeEntries.filter((item) => {
    const d = item.target_date || item.date;
    return d && d > today && !isFinishedQueueStatus(item.status);
  });

  let nextBusinessDayEntries = [];
  let nextBusinessDate = null;
  if (targetDate > today) {
    nextBusinessDate = targetDate;
    nextBusinessDayEntries = activeTarget;
  } else if (futureActive.length) {
    nextBusinessDate = futureActive.map((item) => item.target_date || item.date).sort()[0];
    nextBusinessDayEntries = futureActive.filter((item) => (item.target_date || item.date) === nextBusinessDate);
  }

  const finishedToday = todayEntries.filter((item) => isFinishedQueueStatus(item.status));
  const calendarPreview = Array.isArray(dateInfo.calendar)
    ? dateInfo.calendar.filter((row) => row.reception_label && row.reception_label !== "通常受付").slice(0, 10)
    : [];
  const todayStatus = Array.isArray(dateInfo.calendar)
    ? (dateInfo.calendar.find((row) => row.target_date === today) || null)
    : null;

  return {
    today,
    target_date: targetDate,
    target_date_source: dateInfo.source || "unknown",
    today_status: todayStatus,
    calendar_preview: calendarPreview,
    active_today: activeToday,
    finished_today: finishedToday,
    active_target: activeTarget,
    next_business_day: nextBusinessDate ? { date: nextBusinessDate, entries: nextBusinessDayEntries } : null,
    next_business_day_entries: nextBusinessDayEntries,
    range_entries: rangeEntries,
    demo_ready: activeToday.length === 4 || nextBusinessDayEntries.length === 4 || (targetDate === today && activeTarget.length === 4)
  };
}

async function ensureSalesDemoGuardianStep525U(env, clinic) {
  const existing = await selectSingle(env, TABLES.guardians, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    guardian_name: "eq.本番確認 テスト",
    status: "eq.active",
    order: "created_at.asc",
    limit: 1
  }).catch(() => null);
  if (existing) return existing;

  const guardianNo = await nextGuardianNo(env, clinic.id);
  const rows = await insertRows(env, TABLES.guardians, {
    clinic_id: clinic.id,
    guardian_no: guardianNo,
    guardian_name: "本番確認 テスト",
    guardian_kana: "ホンバンカクニン テスト",
    phone: "090-0000-3434",
    email: null,
    line_user_id: null,
    line_display_name: null,
    line_picture_url: null,
    line_link_status: "unlinked",
    preferred_contact: "line",
    memo: "営業デモ用の飼い主データです。",
    status: "active"
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function ensureSalesDemoPetAndCardStep525U(env, clinic, guardian, spec) {
  let pet = await selectSingle(env, TABLES.pets, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    pet_name: `eq.${spec.pet_name}`,
    status: "eq.active",
    order: "created_at.asc",
    limit: 1
  }).catch(() => null);

  if (!pet) {
    const petNo = await nextPetNo(env, clinic.id);
    const petRows = await insertRows(env, TABLES.pets, normalizePetPayload({
      pet_name: spec.pet_name,
      species: spec.species || "dog",
      species_label: spec.species_label || speciesToLabel(spec.species || "dog"),
      breed: spec.breed || null,
      sex: spec.sex || "unknown",
      age_text: spec.age_text || "",
      caution_memo: `営業デモ用：${spec.purpose}`,
      status: "active"
    }, clinic.id, guardian.id, petNo));
    pet = Array.isArray(petRows) ? petRows[0] : petRows;
  }

  let card = await selectSingle(env, TABLES.petCards, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    pet_id: `eq.${pet.id}`,
    card_enabled: "eq.true",
    order: "created_at.asc",
    limit: 1
  }).catch(() => null);

  if (!card) {
    const cardNo = await nextCardNo(env, clinic.id);
    const cardRows = await insertRows(env, TABLES.petCards, {
      clinic_id: clinic.id,
      pet_id: pet.id,
      card_no: cardNo,
      qr_token: createToken("vet_card"),
      card_enabled: true,
      note: `STEP VET-52.5U 営業デモ用：${spec.pet_name}`
    });
    card = Array.isArray(cardRows) ? cardRows[0] : cardRows;
  }

  return { pet, card };
}

async function freeQueueNumbersForSalesDemoDateStep525U(env, clinicId, targetDate) {
  const rows = await selectRows(env, TABLES.waitingEntries, {
    select: "id,queue_number,status,target_date,created_at",
    clinic_id: `eq.${clinicId}`,
    target_date: `eq.${targetDate}`,
    order: "created_at.asc",
    limit: 500
  }).catch(() => []);

  const base = 800000 + Math.floor(Date.now() / 1000) % 90000;
  const moved = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const updated = await updateRows(env, TABLES.waitingEntries, { id: `eq.${row.id}` }, {
        status: "cancelled",
        queue_number: base + i + 1,
        last_action_at: new Date().toISOString()
      });
      moved.push(Array.isArray(updated) ? updated[0] : updated);
    } catch (error) {
      moved.push({ id: row.id, error: error?.message || String(error) });
    }
  }
  return { moved_count: moved.length, moved };
}

async function createSalesDemoQueueEntriesFallbackStep525U(env, clinic, targetDate) {
  const guardian = await ensureSalesDemoGuardianStep525U(env, clinic);
  const moved = await freeQueueNumbersForSalesDemoDateStep525U(env, clinic.id, targetDate);
  const createdEntries = [];
  const errors = [];

  for (const spec of SALES_DEMO_QUEUE_PETS_STEP_52_5U) {
    try {
      const { pet, card } = await ensureSalesDemoPetAndCardStep525U(env, clinic, guardian, spec);
      const rpcRows = await supabaseRpc(env, "vet_create_waiting_entry", {
        p_clinic_code: clinic.clinic_code,
        p_guardian_id: guardian.id,
        p_pet_id: pet.id,
        p_entry_kind: "today_queue",
        p_request_category: normalizeQueueRequestCategory(spec.request_category || "general_exam"),
        p_target_date: targetDate,
        p_day_part: normalizeQueueDayPart(spec.day_part || "morning", "morning"),
        p_purpose: spec.purpose,
        p_symptoms_summary: spec.symptoms_summary || spec.memo || spec.purpose,
        p_desired_contact: "line",
        p_source: "line",
        p_questionnaire: {
          purpose: spec.purpose,
          free_text: spec.symptoms_summary || spec.memo || spec.purpose,
          demo_sales_setup: true,
          demo_step: "STEP VET-52.5U",
          card_no: card?.card_no || null,
          emergency_flag: false
        }
      });
      const created = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
      const waitingEntryId = created?.waiting_entry_id || created?.id || null;
      if (waitingEntryId) {
        try {
          await updateRows(env, TABLES.waitingEntries, { id: `eq.${waitingEntryId}` }, {
            queue_number: spec.queue_number,
            status: "waiting",
            last_action_at: new Date().toISOString()
          });
        } catch (updateError) {
          try {
            await forceSafeQueueNumberIfNeeded(env, clinic.id, targetDate, waitingEntryId, spec.queue_number);
          } catch (forceError) {
            errors.push({ pet_name: spec.pet_name, stage: "queue_number_update", message: updateError?.message || forceError?.message || String(updateError || forceError) });
          }
        }
      }
      const detail = waitingEntryId ? await selectSingle(env, TABLES.waitingEntriesDetailView, {
        select: "*",
        waiting_entry_id: `eq.${waitingEntryId}`,
        limit: 1
      }).catch(() => null) : null;
      createdEntries.push(detail || { ...created, pet_name: spec.pet_name, queue_number: spec.queue_number, target_date: targetDate });
    } catch (error) {
      errors.push({ pet_name: spec.pet_name, message: error?.message || String(error) });
    }
  }

  return { guardian, moved, created_entries: createdEntries, errors };
}


async function handleSalesDemoPrepareStatus(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const date = getParam(request, "date", todayJST());
  const safety = buildSafetyMeta(request, env, { clinic_code: clinicCode });

  const clinic = await getClinicByCode(env, clinicCode);
  const settings = await getClinicSettingsByCode(env, clinicCode, clinic);
  const dateInfo = await findSalesDemoTargetDateStep525U(env, clinicCode, date);
  const snapshot = await buildSalesDemoSnapshotStep525U(env, clinic, { today: date, date_info: dateInfo });

  const activeEntries = snapshot.active_today;
  const finishedEntries = snapshot.finished_today;
  const nextEntries = snapshot.next_business_day_entries || [];

  return jsonResponse({
    ok: true,
    step: "STEP VET-52.5U",
    message: "営業前デモ準備の現在状態を取得しました。",
    worker_version: WORKER_VERSION,
    service: SERVICE_ID,
    service_name: SERVICE_NAME,
    clinic_code: clinicCode,
    target_date: snapshot.target_date,
    today: snapshot.today,
    target_date_source: snapshot.target_date_source,
    demo_ready: snapshot.demo_ready,
    safety,
    demo_prepare: {
      endpoint: "/api/admin/demo/prepare",
      status_endpoint: "/api/admin/demo/prepare-status",
      method: "POST",
      required_confirm_text: DEMO_OPERATION_CONFIRM_TEXT,
      can_run: Boolean(safety.can_run_demo_operations),
      display_name: "営業前デモ準備"
    },
    clinic,
    settings,
    today_status: snapshot.today_status,
    calendar_preview: snapshot.calendar_preview,
    active_entry_count: activeEntries.length,
    finished_history_count: finishedEntries.length,
    next_business_day: snapshot.next_business_day || { date: snapshot.target_date > snapshot.today ? snapshot.target_date : null, entries: nextEntries },
    next_business_day_entries: nextEntries,
    future_entries: nextEntries,
    active_entries: activeEntries,
    queue_entries: activeEntries,
    finished_history_sample: finishedEntries.slice(0, 10),
    recommendations: [
      "本日が休診日の場合は next_business_day_entries に次営業日の受付1〜4が入ります。",
      "営業前デモ準備は管理コードと確認文言を確認してからPOSTで実行します。",
      "本番医院コードではWorker側で拒否します。"
    ]
  });
}


async function handleSalesDemoPrepare(request, env) {
  // STEP VET-52.5U:
  // Supabase RPCが「完了」と返しても実データが0件のケースを検知し、
  // demo clinic に限って Worker 側で受付1〜4を安全に再作成する。
  try {
    const body = await readJson(request);
    const safety = assertDemoOperationAllowed(request, env, body);
    if (!safety.ok) {
      return jsonResponse({
        ok: false,
        error: safety.message,
        message: safety.message,
        step: "STEP VET-52.5U",
        worker_version: WORKER_VERSION,
        safety: safety.safety
      }, safety.status || 400);
    }

    const clinicCode = getRequestedClinicCode(request, body);
    const clinic = await getClinicByCode(env, clinicCode);
    const today = normalizeQueueDate(cleanString(body.date || body.target_date) || todayJST());
    const dateInfo = await findSalesDemoTargetDateStep525U(env, clinicCode, today);
    const targetDate = normalizeQueueDate(cleanString(body.target_date) || dateInfo.target_date || today);

    let rpcResult = null;
    let rpcErrorMessage = "";
    let usedFallback = false;
    let fallbackResult = null;

    try {
      rpcResult = await withTimeout(
        supabaseRpc(env, "vet_sales_demo_reset_final", {
          p_clinic_code: clinicCode
        }),
        25000,
        "営業前デモ準備"
      );
    } catch (rpcError) {
      rpcErrorMessage = rpcError?.message || String(rpcError);
    }

    let snapshot = await buildSalesDemoSnapshotStep525U(env, clinic, {
      today,
      target_date: targetDate,
      date_info: dateInfo
    });

    if (!snapshot.demo_ready) {
      usedFallback = true;
      fallbackResult = await createSalesDemoQueueEntriesFallbackStep525U(env, clinic, targetDate);
      snapshot = await buildSalesDemoSnapshotStep525U(env, clinic, {
        today,
        target_date: targetDate,
        date_info: dateInfo
      });
    }

    const activeToday = snapshot.active_today || [];
    const nextEntries = snapshot.next_business_day_entries || [];
    const activeTarget = snapshot.active_target || [];
    const ready = snapshot.demo_ready;

    let logStatus = "ok";
    let logError = null;
    try {
      await logOperation(
        env,
        clinic.id,
        "owner",
        cleanString(body.staff_name) || "管理者",
        "sales_demo_prepare_step_vet_52_5u",
        "clinic",
        clinic.id,
        {
          source_screen: cleanString(body.source_screen) || "system-check.html",
          source_step: "STEP VET-52.5U",
          target_date: targetDate,
          rpc_error_message: rpcErrorMessage || null,
          used_fallback: usedFallback,
          fallback_errors: fallbackResult?.errors || [],
          active_today_count: activeToday.length,
          next_business_day_count: nextEntries.length
        }
      );
    } catch (error) {
      logStatus = "warning";
      logError = error?.message || String(error);
    }

    if (!ready) {
      return jsonResponse({
        ok: false,
        step: "STEP VET-52.5U",
        message: `営業デモ準備APIは実行されましたが、受付1〜4を確認できません。本日${activeToday.length}件、次営業日${nextEntries.length}件です。`,
        worker_version: WORKER_VERSION,
        service: SERVICE_ID,
        service_name: SERVICE_NAME,
        clinic_code: clinicCode,
        today,
        target_date: targetDate,
        rpc_result: rpcResult,
        rpc_error_message: rpcErrorMessage,
        used_fallback: usedFallback,
        fallback_result: fallbackResult,
        active_entries: activeToday,
        next_business_day_entries: nextEntries,
        future_entries: nextEntries,
        errors: fallbackResult?.errors || [],
        safety: safety.safety,
        cors_safe: true
      }, 500);
    }

    const successCount = targetDate === today ? activeToday.length : nextEntries.length;
    const successDate = targetDate === today ? today : targetDate;

    return jsonResponse({
      ok: true,
      step: "STEP VET-52.5U",
      message: targetDate === today
        ? "営業デモ準備が完了しました。本日の受付1〜4を作成・確認しました。"
        : `営業デモ準備が完了しました。本日は休診/受付停止のため、次営業日 ${targetDate} に受付1〜4を作成・確認しました。`,
      worker_version: WORKER_VERSION,
      service: SERVICE_ID,
      service_name: SERVICE_NAME,
      clinic_code: clinicCode,
      today,
      target_date: targetDate,
      success_date: successDate,
      result: rpcResult,
      rpc_error_message: rpcErrorMessage || null,
      used_fallback: usedFallback,
      fallback_result: fallbackResult,
      summary: {
        active_entry_count: successCount,
        active_today_count: activeToday.length,
        next_business_day_count: nextEntries.length,
        target_date: targetDate,
        expected_queue_numbers: [1, 2, 3, 4],
        expected_demo_pets: ["チェックちゃん", "ココアちゃん", "ハナちゃん", "モモちゃん"]
      },
      active_entries: activeToday,
      queue_entries: activeToday,
      next_business_day: snapshot.next_business_day || (targetDate > today ? { date: targetDate, entries: nextEntries } : null),
      next_business_day_entries: nextEntries,
      future_entries: nextEntries,
      target_entries: activeTarget,
      log_status: logStatus,
      log_error: logError,
      safety: safety.safety,
      cors_safe: true,
      next_check_urls: {
        system_check: "https://dpromstk2000-lab.github.io/DPRO-VET-QR/system-check.html?v=step-vet-52-5u&clinic_code=dpro_vet_demo",
        scan_pc: "https://dpromstk2000-lab.github.io/DPRO-VET-QR/scan-pc.html?v=step-vet-52-5u&clinic_code=dpro_vet_demo",
        scan_ipad: "https://dpromstk2000-lab.github.io/DPRO-VET-QR/scan-ipad.html?v=step-vet-52-5u&clinic_code=dpro_vet_demo",
        doctor: "https://dpromstk2000-lab.github.io/DPRO-VET-QR/doctor.html?v=step-vet-52-5u&clinic_code=dpro_vet_demo"
      }
    });
  } catch (error) {
    console.error("STEP VET-52.5U prepare error:", error);
    return jsonResponse({
      ok: false,
      step: "STEP VET-52.5U",
      error: error?.message || String(error),
      message: error?.message || String(error),
      worker_version: WORKER_VERSION,
      service: SERVICE_ID,
      service_name: SERVICE_NAME,
      cors_safe: true,
      hint: "営業前デモ準備APIの実データ作成でエラーが出ています。このJSONのmessageを確認してください。"
    }, 500);
  }
}



// 旧エンドポイント互換用。
// /api/admin/demo/reset や /api/admin/demo/sales-setup で呼ばれても、
// STEP VET-38Bの営業前デモ準備APIに統一する。
async function handleDemoReset(request, env) {
  return handleSalesDemoPrepare(request, env);
}



// =========================================================
// STEP VET-34C-R2
// Production registration / LINE link / safe QR card API
// 既存Worker統合版：既存の受付・順番受付・doctor・owner・admin・DEMO APIは残す
// =========================================================

function extractTokenFromQrPayload(value) {
  const text = cleanString(value);
  if (!text) return "";

  // vetcard:{clinic_code}:{card_token}
  const vetcardMatch = text.match(/^vetcard:([^:]+):(.+)$/);
  if (vetcardMatch) return cleanString(vetcardMatch[2]);

  // URL形式: ?token= / ?card_token= / ?t=
  try {
    const url = new URL(text);
    return cleanString(url.searchParams.get("card_token") || url.searchParams.get("token") || url.searchParams.get("t"));
  } catch (_) {
    // URLではない場合はそのままtokenとして扱う
  }

  return text;
}


function buildDirectRegistrationItem(clinicCode, guardian, pet, card, lineStatus) {
  const cardToken = card?.qr_token || card?.card_token || "";
  return {
    guardian_id: guardian?.id || guardian?.guardian_id || "",
    pet_id: pet?.id || pet?.pet_id || "",
    card_id: card?.id || card?.card_id || "",
    card_no: card?.card_no || "",
    card_token: cardToken,
    qr_payload: cardToken ? `vetcard:${clinicCode}:${cardToken}` : "",
    line_status: lineStatus || "registered_unlinked"
  };
}

function normalizeGuardianForPublic(guardian) {
  if (!guardian) return null;
  return {
    guardian_id: guardian.id || guardian.guardian_id || "",
    guardian_name: guardian.guardian_name || "",
    phone: guardian.phone || "",
    line_user_id: guardian.line_user_id || "",
    line_display_name: guardian.line_display_name || "",
    line_status: guardian.line_link_status || guardian.line_status || "",
    line_link_status: guardian.line_link_status || guardian.line_status || ""
  };
}

function normalizePetForPublic(pet) {
  if (!pet) return null;
  return {
    pet_id: pet.id || pet.pet_id || "",
    pet_name: pet.pet_name || "",
    animal_type: pet.species_label || pet.animal_type || speciesToLabel(pet.species),
    breed: pet.breed || "",
    sex: pet.sex || "",
    age_text: pet.age_text || "",
    medical_note: pet.caution_memo || pet.medical_note || "",
    allergy_note: pet.allergies || pet.allergy_note || "",
    status: pet.status || ""
  };
}

function normalizeCardForPublic(clinicCode, card) {
  if (!card) return null;
  const cardToken = card.qr_token || card.card_token || "";
  return {
    card_id: card.id || card.card_id || "",
    card_no: card.card_no || "",
    card_token: cardToken,
    qr_payload: cardToken ? `vetcard:${clinicCode}:${cardToken}` : "",
    card_enabled: card.card_enabled
  };
}


function normalizePetSex(value) {
  const text = String(value || "").trim().toLowerCase();

  // Supabase vet_pets_sex_check 対応:
  // DBには日本語表示ではなく、安定した英字コードを入れる。
  if (!text) return "unknown";

  if (
    text === "male" ||
    text === "m" ||
    text.includes("男") ||
    text.includes("オス") ||
    text.includes("♂") ||
    text.includes("boy")
  ) {
    return "male";
  }

  if (
    text === "female" ||
    text === "f" ||
    text.includes("女") ||
    text.includes("メス") ||
    text.includes("♀") ||
    text.includes("girl")
  ) {
    return "female";
  }

  if (
    text === "castrated_male" ||
    text === "neutered_male" ||
    text.includes("去勢")
  ) {
    return "male";
  }

  if (
    text === "spayed_female" ||
    text === "neutered_female" ||
    text.includes("避妊")
  ) {
    return "female";
  }

  return "unknown";
}

function speciesFromAnimalType(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("猫") || text.includes("cat")) return "cat";
  if (text.includes("うさ") || text.includes("rabbit")) return "rabbit";
  if (text.includes("ハム") || text.includes("hamster")) return "hamster";
  if (text.includes("鳥") || text.includes("bird")) return "bird";
  if (text.includes("フェレット") || text.includes("ferret")) return "other";
  if (text.includes("犬") || text.includes("dog")) return "dog";
  return text || "dog";
}

function publicSiteBaseUrl(env) {
  const raw = cleanString(env.PUBLIC_SITE_URL) || "https://dpromstk2000-lab.github.io/DPRO-VET-QR/";
  return raw.replace(/\/+$/, "");
}

function normalizeRpcSingle(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

function normalizeRpcRows(data) {
  if (Array.isArray(data)) return data;
  if (!data) return [];
  return [data];
}

function convertRegisterError(error) {
  const message = error?.message || String(error || "");
  if (message.includes("DUPLICATE_PHONE_REVIEW_REQUIRED")) {
    return {
      status: 409,
      body: {
        ok: false,
        code: "duplicate_review_required",
        message: "同じ電話番号の登録があります。既に病院に登録されている可能性があるため、受付スタッフにご確認ください。",
        original_error: message
      }
    };
  }
  return null;
}

async function handleProdPublicRegisterOwnerSelf(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);

  const lineUserId = cleanString(body.line_user_id || body.lineUserId);
  const guardianName = cleanString(body.guardian_name || body.owner_name);
  const petName = cleanString(body.pet_name);

  if (!clinicCode) return errorResponse("clinic_code が必要です。", 400);
  if (!lineUserId) return errorResponse("LINE userId がありません。LIFF内で開いてください。", 400);
  if (!guardianName) return errorResponse("飼い主名が必要です。", 400);
  if (!petName) return errorResponse("ペット名が必要です。", 400);
  if (body.consent_checked !== true && body.consent_checked !== "true" && body.consent_checked !== "1") {
    return errorResponse("LINE診察券利用への同意が必要です。", 400, { code: "consent_required" });
  }

  const guardianNo = cleanString(body.guardian_no) || await nextGuardianNo(env, clinic.id);

  const guardianRows = await insertRows(env, TABLES.guardians, {
    clinic_id: clinic.id,
    guardian_no: guardianNo,
    guardian_name: guardianName,
    guardian_kana: nullIfEmpty(body.guardian_kana),
    phone: nullIfEmpty(normalizePhoneForSave(body.phone)),
    email: nullIfEmpty(body.email),
    line_user_id: lineUserId,
    line_display_name: nullIfEmpty(body.line_display_name || body.displayName),
    line_picture_url: nullIfEmpty(body.line_picture_url || body.pictureUrl),
    line_link_status: "linked",
    preferred_contact: "line",
    memo: nullIfEmpty(body.memo),
    status: "active"
  });
  const guardian = Array.isArray(guardianRows) ? guardianRows[0] : guardianRows;

  const petNo = cleanString(body.pet_no) || await nextPetNo(env, clinic.id);
  const animalType = cleanString(body.animal_type || body.species_label || body.species);
  const species = speciesFromAnimalType(animalType || body.species || "dog");

  const petPayload = normalizePetPayload({
    ...body,
    pet_name: petName,
    species,
    species_label: animalType || speciesToLabel(species),
    sex: normalizePetSex(body.sex),
    allergies: nullIfEmpty(body.allergy_note || body.allergies),
    caution_memo: nullIfEmpty(body.medical_note || body.medical_history || body.memo)
  }, clinic.id, guardian.id, petNo);

  const petRows = await insertRows(env, TABLES.pets, petPayload);
  const pet = Array.isArray(petRows) ? petRows[0] : petRows;

  const cardNo = cleanString(body.card_no) || await nextCardNo(env, clinic.id);
  const qrToken = cleanString(body.card_token || body.qr_token) || createToken("card");

  const cardRows = await insertRows(env, TABLES.petCards, {
    clinic_id: clinic.id,
    pet_id: pet.id,
    card_no: cardNo,
    qr_token: qrToken,
    card_enabled: true,
    note: "STEP VET-34C-R4 飼い主自己登録"
  });
  const card = Array.isArray(cardRows) ? cardRows[0] : cardRows;

  try {
    await insertRows(env, TABLES.operationLogs, {
      clinic_id: clinic.id,
      actor_type: "owner",
      actor_name: guardianName,
      action: "owner_self_register",
      target_type: "guardian",
      target_id: guardian.id,
      detail: {
        pet_name: petName,
        card_no: cardNo,
        worker_version: WORKER_VERSION
      }
    });
  } catch (_) {}

  const item = buildDirectRegistrationItem(clinicCode, guardian, pet, card, "linked");

  return jsonResponse({
    ok: true,
    message: "LINE診察券を作成しました。",
    route: "owner_self_register_r4_direct",
    worker_version: WORKER_VERSION,
    clinic_code: clinicCode,
    registration: item,
    guardian,
    pet,
    card,
    member_url: `${publicSiteBaseUrl(env)}/member.html?clinic_code=${encodeURIComponent(clinicCode)}`
  });
}

async function handleProdPublicRegisterDuplicateCheck(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const phone = cleanString(body.phone);
  const petName = cleanString(body.pet_name);
  const items = [];

  if (phone) {
    const rawPhone = normalizePhoneForSearch(phone);
    const guardians = await selectRows(env, TABLES.guardians, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      status: "eq.active",
      order: "created_at.desc",
      limit: 500
    });

    guardians.forEach((g) => {
      const gPhone = normalizePhoneForSearch(g.phone);
      if (gPhone && rawPhone && gPhone === rawPhone) {
        items.push({
          guardian_id: g.id,
          guardian_name: g.guardian_name,
          phone: g.phone,
          pet_name: "",
          match_reason: "電話番号が一致"
        });
      }
    });
  }

  if (petName) {
    const pets = await selectRows(env, TABLES.pets, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      status: "eq.active",
      pet_name: `ilike.*${escapePostgrestLike(petName)}*`,
      order: "created_at.desc",
      limit: 30
    });

    pets.forEach((p) => {
      items.push({
        guardian_id: p.guardian_id,
        pet_id: p.id,
        pet_name: p.pet_name,
        match_reason: "ペット名が類似"
      });
    });
  }

  const isDemo = isDemoClinicCodeForAudit(env,clinicCode);
  const publicItems = isDemo ? items : (items.length ? [{match_reason:"登録候補あり"}] : []);
  return jsonResponse({
    ok:true,route:"duplicate_check_r4_direct",worker_version:WORKER_VERSION,
    clinic_code:clinicCode,phone_normalized_duplicate_check:true,
    has_duplicates:items.length>0,items:publicItems,
    privacy_mode:isDemo?"demo_detail":"production_masked",
    message:items.length>0
      ?"重複の可能性がある登録があります。受付スタッフに確認してください。"
      :"重複候補は見つかりませんでした。"
  });
}

async function handleProdPublicMyCards(request, env) {
  const body = request.method === "POST" ? await readJson(request) : {};
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const lineUserId = cleanString(body.line_user_id || body.lineUserId || getParam(request, "line_user_id", "") || getParam(request, "lineUserId", ""));

  if (!lineUserId) {
    return jsonResponse({
      ok: true,
      clinic_code: clinicCode,
      line_link_status: "unlinked",
      items: [],
      cards: [],
      message: "LINE userId がありません。LIFF内で開くか、初回登録してください。"
    });
  }

  const guardian = await selectSingle(env, TABLES.guardians, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    line_user_id: `eq.${lineUserId}`,
    status: "eq.active",
    limit: 1
  });

  if (!guardian) {
    return jsonResponse({
      ok: true,
      clinic,
      clinic_code: clinicCode,
      line_user_id: lineUserId,
      line_link_status: "unlinked",
      guardian: null,
      items: [],
      cards: [],
      message: "LINE連携済みの診察券が見つかりません。"
    });
  }

  const cardsRaw = await selectRows(env, TABLES.petCardView, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    guardian_id: `eq.${guardian.id}`,
    pet_status: "eq.active",
    order: "card_no.asc"
  });

  const cards = await attachPetPhotoFieldsToRows(env, clinic.id, cardsRaw);

  const items = cards.map((card) => ({
    ...card,
    guardian_id: card.guardian_id || guardian.id,
    guardian_name: card.guardian_name || guardian.guardian_name,
    phone: card.phone || guardian.phone,
    card_token: card.card_token || card.qr_token,
    qr_payload: card.qr_payload || `vetcard:${clinicCode}:${card.card_token || card.qr_token}`
  }));

  return jsonResponse({
    ok: true,
    route: "my_cards_r4_direct",
    worker_version: WORKER_VERSION,
    clinic,
    clinic_code: clinicCode,
    line_user_id: lineUserId,
    line_link_status: "linked",
    guardian: normalizeGuardianForPublic(guardian),
    items,
    cards: items,
    message: items.length ? "LINE診察券を取得しました。" : "登録済みのペット診察券がありません。"
  });
}

async function handleProdPublicCardLookup(request, env) {
  const body = request.method === "POST" ? await readJson(request) : {};
  let clinicCode = getRequestedClinicCode(request, body);
  const rawToken = cleanString(body.card_token || body.qr_payload || body.token || body.t || getParam(request, "card_token", "") || getParam(request, "token", "") || getParam(request, "t", ""));

  if (!rawToken) return errorResponse("card_token または QR文字列が必要です。", 400);

  const vetcardMatch = rawToken.match(/^vetcard:([^:]+):(.+)$/);
  if (vetcardMatch) clinicCode = cleanString(vetcardMatch[1]) || clinicCode;

  const clinic = await getClinicByCode(env, clinicCode);
  const cardToken = extractTokenFromQrPayload(rawToken);

  let card = await selectSingle(env, TABLES.petCardView, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    qr_token: `eq.${cardToken}`,
    limit: 1
  });

  if (!card) return errorResponse("ペット診察券が見つかりません。", 404, { scan_result: "not_found" });

  card = await attachPetPhotoFieldsToRows(env, clinic.id, card);

  return jsonResponse({
    ok: true,
    route: "card_lookup_r4_direct",
    worker_version: WORKER_VERSION,
    scan_result: card.card_enabled === false ? "disabled" : "found",
    clinic: normalizeClinicForPublic(clinic),
    clinic_code: clinicCode,
    card_token: cardToken,
    item: normalizeCardLookupItemForPublic(clinicCode, card),
    guardian: {
      guardian_id: card.guardian_id || "",
      guardian_name: card.guardian_name || ""
    },
    pet: normalizePetForPublic(extractPet(card)),
    card: {
      card_id: card.card_id,
      card_no: card.card_no,
      card_token: card.qr_token,
      qr_payload: `vetcard:${clinicCode}:${card.qr_token}`
    }
  });
}

async function handleProdPublicLineLinkTokenGet(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const clinic = await getClinicByCode(env, clinicCode);
  const token = getParam(request, "token", "");
  if (!token) return errorResponse("token が必要です。", 400);

  const tokenRow = await selectSingle(env, TABLES.lineLinkTokens, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    token: `eq.${token}`,
    limit: 1
  });

  if (!tokenRow) return errorResponse("LINE連携トークンが見つかりません。", 404);

  const expired = tokenRow.expires_at ? new Date(tokenRow.expires_at).getTime() < Date.now() : false;

  let guardian = null;
  if (tokenRow.guardian_id) {
    guardian = await selectSingle(env, TABLES.guardians, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      id: `eq.${tokenRow.guardian_id}`,
      limit: 1
    });
  }

  let pet = null;
  if (tokenRow.pet_id) {
    pet = await selectSingle(env, TABLES.pets, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      id: `eq.${tokenRow.pet_id}`,
      limit: 1
    });
  }

  let card = null;
  if (tokenRow.pet_id) {
    card = await selectSingle(env, TABLES.petCards, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      pet_id: `eq.${tokenRow.pet_id}`,
      limit: 1
    });
  }

  return jsonResponse({
    ok: true,
    route: "line_link_token_get_r4_direct",
    worker_version: WORKER_VERSION,
    token_status: expired ? "expired" : (tokenRow.status || "active"),
    is_available: !expired && tokenRow.status === "active",
    clinic: normalizeClinicForPublic(clinic),
    token: {status:tokenRow.status||"",expires_at:tokenRow.expires_at||null,used_at:tokenRow.used_at||null},
    guardian: guardian ? {
      guardian_id:guardian.id||guardian.guardian_id||"",
      guardian_name:guardian.guardian_name||"",
      line_link_status:guardian.line_link_status||""
    } : null,
    pet: pet ? normalizePetForPublic(pet) : null,
    card: card ? normalizeCardForPublic(clinicCode, card) : null,
    message: expired ? "連携QRの有効期限が切れています。受付で再発行してください。" : "LINE連携できます。"
  });
}

async function handleProdPublicLineLinkComplete(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const token = cleanString(body.token);
  const lineUserId = cleanString(body.line_user_id || body.lineUserId);

  if (!token) return errorResponse("token が必要です。", 400);
  if (!lineUserId) return errorResponse("LINE userId がありません。LIFF内で開いてください。", 400);

  const tokenRow = await selectSingle(env, TABLES.lineLinkTokens, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    token: `eq.${token}`,
    status: "eq.active",
    limit: 1
  });

  if (!tokenRow) return errorResponse("有効なLINE連携トークンが見つかりません。", 404);

  if (tokenRow.expires_at && new Date(tokenRow.expires_at).getTime() < Date.now()) {
    await updateRows(env, TABLES.lineLinkTokens, { id: `eq.${tokenRow.id}` }, { status: "expired" });
    return errorResponse("LINE連携トークンの有効期限が切れています。", 410);
  }

  const guardianRows = await updateRows(env, TABLES.guardians, {
    id: `eq.${tokenRow.guardian_id}`,
    clinic_id: `eq.${clinic.id}`
  }, {
    line_user_id: lineUserId,
    line_display_name: nullIfEmpty(body.line_display_name || body.displayName),
    line_picture_url: nullIfEmpty(body.line_picture_url || body.pictureUrl),
    line_link_status: "linked",
    preferred_contact: "line"
  });

  await updateRows(env, TABLES.lineLinkTokens, { id: `eq.${tokenRow.id}` }, {
    status: "used",
    used_at: new Date().toISOString(),
    line_user_id: lineUserId
  });

  await logOperation(env, clinic.id, "owner", cleanString(body.line_display_name || body.displayName) || "LINEユーザー", "line_link_complete", "guardian", tokenRow.guardian_id, {
    token_id: tokenRow.id,
    line_user_id: lineUserId,
    worker_version: WORKER_VERSION
  });

  const guardian = Array.isArray(guardianRows) ? guardianRows[0] : guardianRows;

  return jsonResponse({
    ok: true,
    message: "LINE診察券の連携が完了しました。",
    route: "line_link_complete_r4_direct",
    worker_version: WORKER_VERSION,
    clinic_code: clinicCode,
    guardian: normalizeGuardianForPublic(guardian),
    member_url: `${publicSiteBaseUrl(env)}/member.html?clinic_code=${encodeURIComponent(clinicCode)}`
  });
}


async function handleProdAdminRegisterByStaffR3(request, env) {
  try {
    const body = await readJson(request);
    const clinicCode = getRequestedClinicCode(request, body);
    const clinic = await getClinicByCode(env, clinicCode);

    const guardianName = cleanString(body.guardian_name || body.owner_name || body.test_guardian_name);
    const petName = cleanString(body.pet_name || body.test_pet_name);

    if (!guardianName) return errorResponse("飼い主名が必要です。", 400, { route: "register_by_staff_r4" });
    if (!petName) return errorResponse("ペット名が必要です。", 400, { route: "register_by_staff_r4" });

    const guardianNo = cleanString(body.guardian_no) || await nextGuardianNo(env, clinic.id);

    const guardianPayload = {
      clinic_id: clinic.id,
      guardian_no: guardianNo,
      guardian_name: guardianName,
      guardian_kana: nullIfEmpty(body.guardian_kana),
      phone: nullIfEmpty(normalizePhoneForSave(body.phone)),
      email: nullIfEmpty(body.email),
      line_user_id: nullIfEmpty(body.line_user_id),
      line_display_name: nullIfEmpty(body.line_display_name),
      line_picture_url: nullIfEmpty(body.line_picture_url),
      line_link_status: body.line_user_id ? "linked" : "unlinked",
      preferred_contact: "line",
      memo: nullIfEmpty(body.memo),
      status: "active"
    };

    const guardianRows = await insertRows(env, TABLES.guardians, guardianPayload);
    const guardian = Array.isArray(guardianRows) ? guardianRows[0] : guardianRows;

    const petNo = cleanString(body.pet_no) || await nextPetNo(env, clinic.id);
    const animalType = cleanString(body.animal_type || body.species_label || body.species);
    const species = speciesFromAnimalType(animalType || body.species || "dog");

    const petPayload = normalizePetPayload({
      ...body,
      pet_name: petName,
      species,
      species_label: animalType || speciesToLabel(species),
      sex: normalizePetSex(body.sex),
      allergies: nullIfEmpty(body.allergy_note || body.allergies),
      caution_memo: nullIfEmpty(body.medical_note || body.medical_history || body.memo)
    }, clinic.id, guardian.id, petNo);

    const petRows = await insertRows(env, TABLES.pets, petPayload);
    const pet = Array.isArray(petRows) ? petRows[0] : petRows;

    const cardNo = cleanString(body.card_no) || await nextCardNo(env, clinic.id);
    const qrToken = cleanString(body.card_token || body.qr_token) || createToken("card");

    const cardRows = await insertRows(env, TABLES.petCards, {
      clinic_id: clinic.id,
      pet_id: pet.id,
      card_no: cardNo,
      qr_token: qrToken,
      card_enabled: true,
      note: "STEP VET-34C-R4 受付登録"
    });
    const card = Array.isArray(cardRows) ? cardRows[0] : cardRows;

    await logOperation(env, clinic.id, "staff", cleanString(body.staff_name) || "受付スタッフ", "register_by_staff", "guardian", guardian.id, {
      guardian_name: guardianName,
      pet_name: petName,
      card_no: cardNo,
      worker_version: WORKER_VERSION
    });

    const item = buildDirectRegistrationItem(clinicCode, guardian, pet, card, body.line_user_id ? "linked" : "registered_unlinked");

    return jsonResponse({
      ok: true,
      message: "受付で飼い主・ペットを登録し、診察券QRを発行しました。",
      route: "register_by_staff_r4_direct",
      worker_version: WORKER_VERSION,
      clinic_code: clinicCode,
      registration: item,
      guardian,
      pet,
      card,
      line_status: item.line_status
    });
  } catch (error) {
    const msg = error && error.message ? error.message : "受付登録に失敗しました。";
    return errorResponse(msg, 500, {
      route: "register_by_staff_r5_unique_numbering",
      worker_version: WORKER_VERSION,
      hint: msg.includes("duplicate key")
        ? "採番重複です。Worker R6では既存番号の最大値を確認してから採番します。再度実行してください。"
        : (msg.includes("vet_pets_sex_check") ? "ペット性別のDB許可値エラーです。Worker R6では 男の子/女の子 を male/female に変換します。" : ""),
      error_name: error && error.name ? error.name : "",
      error_stack_head: error && error.stack ? String(error.stack).split("\n").slice(0, 3).join("\n") : ""
    });
  }
}

async function handleProdAdminRegisterByStaff(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const guardianName = cleanString(body.guardian_name || body.owner_name);
  const petName = cleanString(body.pet_name);

  if (!guardianName) return errorResponse("飼い主名が必要です。", 400);
  if (!petName) return errorResponse("ペット名が必要です。", 400);

  const result = await supabaseRpc(env, "vet_register_by_staff", {
    p_clinic_code: clinicCode,
    p_guardian_name: guardianName,
    p_phone: nullIfEmpty(normalizePhoneForSave(body.phone)),
    p_pet_name: petName,
    p_animal_type: nullIfEmpty(body.animal_type || body.species || body.species_label),
    p_age_text: nullIfEmpty(body.age_text || body.age),
    p_sex: nullIfEmpty(body.sex),
    p_medical_note: nullIfEmpty(body.medical_note || body.medical_history || body.memo),
    p_allergy_note: nullIfEmpty(body.allergy_note || body.allergies),
    p_actor_name: cleanString(body.staff_name) || "受付スタッフ"
  });

  const item = normalizeRpcSingle(result);
  return jsonResponse({
    ok: true,
    message: "受付で飼い主・ペットを登録し、診察券QRを発行しました。",
    clinic_code: clinicCode,
    registration: item,
    line_status: "registered_unlinked"
  });
}

async function handleProdAdminLineLinkTokenCreate(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const guardianId = cleanString(body.guardian_id);
  const petId = cleanString(body.pet_id);

  if (!guardianId) return errorResponse("guardian_id が必要です。", 400);

  const guardian = await selectSingle(env, TABLES.guardians, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    id: `eq.${guardianId}`
  });
  if (!guardian) return errorResponse("飼い主が見つかりません。", 404);

  const token = createToken("vet_link");
  const expiresMinutes = Math.max(5, Math.min(Number(body.expires_minutes || 60), 1440));
  const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000).toISOString();

  const insertPayload = {
    clinic_id: clinic.id,
    guardian_id: guardianId,
    token,
    status: "active",
    expires_at: expiresAt,
    created_by_staff: nullIfEmpty(body.staff_name)
  };

  if (petId) insertPayload.pet_id = petId;

  const rows = await insertRows(env, TABLES.lineLinkTokens, insertPayload);
  const item = Array.isArray(rows) ? rows[0] : rows;

  await logOperation(env, clinic.id, "staff", cleanString(body.staff_name) || "受付スタッフ", "line_link_token_create", "guardian", guardianId, {
    token_id: item?.id,
    pet_id: petId || null,
    worker_version: WORKER_VERSION
  });

  const linkUrl = `${publicSiteBaseUrl(env)}/link.html?token=${encodeURIComponent(token)}&clinic_code=${encodeURIComponent(clinicCode)}`;

  return jsonResponse({
    ok: true,
    message: "LINE連携QR用トークンを発行しました。",
    route: "line_link_token_r4_direct",
    worker_version: WORKER_VERSION,
    clinic_code: clinicCode,
    token,
    expires_at: expiresAt,
    link_url: linkUrl,
    qr_payload: linkUrl,
    item
  });
}

async function handleProdAdminLineUnlink(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const guardianId = cleanString(body.guardian_id || body.id);
  if (!guardianId) return errorResponse("guardian_id が必要です。", 400);

  const payload = {
    line_user_id: null,
    line_display_name: null,
    line_picture_url: null,
    line_linked_at: null,
    line_status: "link_revoked",
    line_link_status: "unlinked",
    preferred_contact: "phone",
    memo: body.memo !== undefined ? body.memo : undefined
  };
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

  let rows = [];
  try {
    rows = await updateRows(env, TABLES.guardians, {
      clinic_code: `eq.${clinicCode}`,
      guardian_id: `eq.${guardianId}`
    }, payload);
  } catch (error) {
    // 既存旧スキーマ行の場合は id / clinic_id でも試す
    const clinic = await getClinicByCode(env, clinicCode);
    rows = await updateRows(env, TABLES.guardians, {
      clinic_id: `eq.${clinic.id}`,
      id: `eq.${guardianId}`
    }, payload);
  }

  return jsonResponse({ ok: true, message: "LINE連携を解除しました。", guardian: rows?.[0] || rows });
}

async function handleProdAdminPetDeactivate(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const petId = cleanString(body.pet_id || body.id);
  if (!petId) return errorResponse("pet_id が必要です。", 400);

  const payload = {
    status: cleanString(body.status) || "inactive",
    pet_status: cleanString(body.pet_status) || "inactive",
    memo: body.memo !== undefined ? body.memo : undefined
  };
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

  let rows = [];
  try {
    rows = await updateRows(env, TABLES.pets, {
      clinic_code: `eq.${clinicCode}`,
      pet_id: `eq.${petId}`
    }, payload);
  } catch (error) {
    const clinic = await getClinicByCode(env, clinicCode);
    rows = await updateRows(env, TABLES.pets, {
      clinic_id: `eq.${clinic.id}`,
      id: `eq.${petId}`
    }, payload);
  }

  return jsonResponse({ ok: true, message: "ペットを通常表示から外しました。", pet: rows?.[0] || rows });
}

async function handleProdAdminDuplicateReviews(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const status = getParam(request, "status", "pending");
  const query = {
    select: "*",
    clinic_code: `eq.${clinicCode}`,
    order: "created_at.desc",
    limit: normalizeLimit(getParam(request, "limit", "100"), 100, 300)
  };
  if (status) query.status = `eq.${status}`;

  const rows = await selectRows(env, TABLES.duplicateReviews, query);
  return jsonResponse({ ok: true, clinic_code: clinicCode, items: rows });
}

async function handleProdAdminDuplicateReviewUpdate(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const reviewId = cleanString(body.review_id || body.id);
  if (!reviewId) return errorResponse("review_id が必要です。", 400);

  const rows = await updateRows(env, TABLES.duplicateReviews, {
    clinic_code: `eq.${clinicCode}`,
    review_id: `eq.${reviewId}`
  }, {
    status: cleanString(body.status) || "reviewed",
    review_note: nullIfEmpty(body.review_note || body.memo),
    reviewed_by: nullIfEmpty(body.reviewed_by || body.staff_name),
    reviewed_at: new Date().toISOString()
  });

  return jsonResponse({ ok: true, message: "重複確認を更新しました。", review: rows?.[0] || rows });
}

async function handleProdRegisterReadinessCheck(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const safety = buildSafetyMeta(request, env, { clinic_code: clinicCode });
  const checks = [];

  async function addRpcCheck(id, label, fnName, body) {
    try {
      await supabaseRpc(env, fnName, body);
      checks.push(makeSafetyCheck(id, label, "pass", `${fnName} を呼び出せます。`, "success"));
    } catch (error) {
      const msg = error?.message || String(error || "");
      // 必須引数不足など、関数自体が存在する場合のエラーは warn とする
      const exists = !msg.includes("Could not find the function") && !msg.includes("schema cache");
      checks.push(makeSafetyCheck(id, label, exists ? "warn" : "fail", exists ? `${fnName} は存在しますがテスト引数不足です: ${msg}` : `${fnName} が見つかりません: ${msg}`, exists ? "warning" : "danger"));
    }
  }

  // 存在確認目的。実登録を避けるため、引数不足エラーは warn 扱い。
  await addRpcCheck("rpc_register_owner_self", "飼い主初回登録RPC", "vet_register_owner_self", {});
  await addRpcCheck("rpc_register_by_staff", "受付登録RPC", "vet_register_by_staff", {});
  await addRpcCheck("rpc_duplicate_check", "重複候補チェックRPC", "vet_check_duplicate_candidates", { p_clinic_code: clinicCode, p_phone: null, p_pet_name: null });
  await addRpcCheck("rpc_create_line_link", "LINE連携トークンRPC", "vet_create_line_link_token", {});
  await addRpcCheck("rpc_complete_line_link", "LINE連携完了RPC", "vet_complete_line_link", {});
  await addRpcCheck("rpc_my_cards", "自分の診察券取得RPC", "vet_get_my_cards", { p_clinic_code: clinicCode, p_line_user_id: "dummy" });
  await addRpcCheck("rpc_card_lookup", "QR診察券照会RPC", "vet_lookup_card_token", { p_clinic_code: clinicCode, p_card_token: "dummy" });

  const failCount = checks.filter((item) => item.status === "fail").length;
  const warnCount = checks.filter((item) => item.status === "warn").length;
  const passCount = checks.filter((item) => item.status === "pass").length;

  return jsonResponse({
    ok: true,
    message: failCount === 0 ? "STEP VET-34C-R2 本番登録APIの基本確認が完了しました。" : "本番登録APIに不足があります。STEP VET-34B SQLを確認してください。",
    worker_version: WORKER_VERSION,
    clinic_code: clinicCode,
    safety,
    summary: { pass: passCount, warn: warnCount, fail: failCount, total: checks.length },
    checks,
    endpoints: {
      public_register: "/api/public/register",
      duplicate_check: "/api/public/register/check-duplicate",
      my_cards: "/api/public/my-cards",
      card_lookup: "/api/public/card-lookup",
      line_link_token_preview: "/api/public/line-link-token?token=...",
      line_link_complete: "/api/public/line-link-complete",
      staff_register: "/api/admin/register-by-staff",
      admin_line_link_token: "/api/admin/line-link-token",
      line_unlink: "/api/admin/line-unlink",
      pet_deactivate: "/api/admin/pet/deactivate",
      duplicate_reviews: "/api/admin/duplicate-reviews"
    }
  });
}

// =========================================================
// Logs / extraction
// =========================================================

async function handleOperationLogs(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const clinic = await getClinicByCode(env, clinicCode);
  const rows = await selectRows(env, TABLES.operationLogs, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    order: "created_at.desc",
    limit: normalizeLimit(getParam(request, "limit", "100"), 100, 300)
  });
  return jsonResponse({ ok: true, clinic, items: rows });
}

async function logOperation(env, clinicId, actorType, actorName, operationType, targetType, targetId, detail = {}) {
  try {
    await insertRows(env, TABLES.operationLogs, {
      clinic_id: clinicId,
      actor_type: actorType || "system",
      actor_name: actorName || "",
      operation_type: operationType,
      target_type: targetType || "",
      target_id: targetId || null,
      detail: detail || {}
    });
  } catch (error) {
    console.warn("logOperation failed:", error?.message || error);
  }
}

function extractGuardian(row) {
  if (!row) return null;
  return {
    guardian_id: row.guardian_id,
    guardian_no: row.guardian_no,
    guardian_name: row.guardian_name,
    guardian_kana: row.guardian_kana,
    guardian_phone: row.guardian_phone,
    line_user_id: row.line_user_id,
    line_display_name: row.line_display_name,
    line_link_status: row.line_link_status
  };
}

function extractPet(row) {
  if (!row) return null;
  return {
    pet_id: row.pet_id,
    pet_no: row.pet_no,
    pet_name: row.pet_name,
    species: row.species,
    species_label: row.species_label,
    breed: row.breed,
    sex: row.sex,
    birth_date: row.birth_date,
    age_years: row.age_years,
    weight_kg: row.weight_kg,
    neutered_status: row.neutered_status,
    insurance_status: row.insurance_status,
    microchip_no: row.microchip_no,
    allergies: row.allergies,
    chronic_conditions: row.chronic_conditions,
    caution_memo: row.caution_memo,
    photo_url: row.photo_url || row.pet_photo_url || null,
    pet_photo_url: row.photo_url || row.pet_photo_url || null,
    photo_storage_path: row.photo_storage_path || row.pet_photo_storage_path || null,
    pet_photo_storage_path: row.photo_storage_path || row.pet_photo_storage_path || null,
    photo_updated_at: row.photo_updated_at || row.pet_photo_updated_at || null,
    pet_photo_updated_at: row.photo_updated_at || row.pet_photo_updated_at || null,
    has_pet_photo: Boolean(row.photo_url || row.pet_photo_url),
    pet_status: row.pet_status
  };
}

// =========================================================
// STEP VET-APPOINTMENT-1
// 病院別10/15/20/30分開始刻み + 診療内容5分単位の日時指定予約
// 既存の順番受付・午前午後優先受付とは独立して併用する。
// =========================================================

function exactAppointmentDefaultSettings(clinicId, isDemo = false) {
  return {
    clinic_id: clinicId,
    exact_time_booking_enabled: false,
    slot_minutes: 30,
    same_day_booking_enabled: false,
    min_days_ahead: 1,
    max_days_ahead: 60,
    booking_lead_minutes: 120,
    default_capacity: 1,
    allow_member_change: true,
    allow_member_cancel: true,
    doctor_booking_enabled: false,
    doctor_selection_mode: "off",
    auto_assign_doctor: true,
    allow_member_doctor_change: true,
    doctor_feature_version: DOCTOR_SLOT_FEATURE_VERSION,
    change_deadline_hours: 24,
    cancel_deadline_hours: 24,
    public_note: "時間を指定して受診したい場合にご利用ください。診療内容や急患対応により、開始時刻が前後する場合があります。",
    owner_note: "順番受付・午前午後優先受付と併用できます。",
    status: "active",
    is_demo: isDemo
  };
}

async function getExactAppointmentSettings(env, clinic, options = {}) {
  let settings = await selectSingle(env, TABLES.exactAppointmentSettings, {
    select: "*",
    clinic_id: `eq.${clinic.id}`
  });

  if (!settings && options.createIfMissing) {
    const rows = await upsertRows(
      env,
      TABLES.exactAppointmentSettings,
      exactAppointmentDefaultSettings(clinic.id, clinic.clinic_code === getDemoClinicCode(env)),
      "clinic_id"
    );
    settings = Array.isArray(rows) ? rows[0] : rows;
  }

  return { ...exactAppointmentDefaultSettings(clinic.id, clinic.clinic_code === getDemoClinicCode(env)), ...(settings || {}) };
}

async function getExactAppointmentServices(env, clinicId, activeOnly = true) {
  const query = {
    select: "*",
    clinic_id: `eq.${clinicId}`,
    order: "sort_order.asc,service_name.asc"
  };
  if (activeOnly) query.is_active = "eq.true";
  return selectRows(env, TABLES.exactAppointmentServices, query);
}


async function getExactAppointmentDoctors(env, clinicId, activeOnly = true) {
  const query = {
    select: "*",
    clinic_id: `eq.${clinicId}`,
    order: "sort_order.asc,doctor_name.asc"
  };
  if (activeOnly) query.is_active = "eq.true";
  return selectRows(env, TABLES.exactAppointmentDoctors, query);
}

async function getExactAppointmentDoctorServices(env, clinicId) {
  return selectRows(env, TABLES.exactAppointmentDoctorServices, {
    select: "*",
    clinic_id: `eq.${clinicId}`,
    order: "created_at.asc"
  });
}

async function getExactAppointmentDoctorHours(env, clinicId, doctorId = "") {
  const query = {
    select: "*",
    clinic_id: `eq.${clinicId}`,
    order: "doctor_id.asc,weekday.asc,period_no.asc"
  };
  if (doctorId) query.doctor_id = `eq.${doctorId}`;
  return selectRows(env, TABLES.exactAppointmentDoctorHours, query);
}

async function getExactAppointmentDoctorBlocks(env, clinicId, options = {}) {
  const query = {
    select: "*",
    clinic_id: `eq.${clinicId}`,
    order: "block_date.asc,start_time.asc"
  };
  if (options.doctorId) query.doctor_id = `eq.${options.doctorId}`;
  if (options.date) query.block_date = `eq.${options.date}`;
  if (options.from) query.block_date = `gte.${options.from}`;
  if (options.to) query.block_date = query.block_date ? query.block_date : `lte.${options.to}`;
  if (options.activeOnly !== false) query.is_active = "eq.true";
  return selectRows(env, TABLES.exactAppointmentDoctorBlocks, query);
}

function normalizeExactAppointmentDoctor(row, serviceIds = []) {
  return {
    ...row,
    service_ids: serviceIds,
    doctor_name: row?.doctor_name || row?.display_name || "",
    display_name: row?.display_name || row?.doctor_name || "担当獣医師"
  };
}

async function enrichExactAppointmentDoctors(env, clinicId, doctors = null) {
  const rows = doctors || await getExactAppointmentDoctors(env, clinicId, true);
  const mappings = await getExactAppointmentDoctorServices(env, clinicId);
  const byDoctor = new Map();
  for (const map of mappings.filter((x) => x.is_active !== false)) {
    if (!byDoctor.has(map.doctor_id)) byDoctor.set(map.doctor_id, []);
    byDoctor.get(map.doctor_id).push(map.service_type_id);
  }
  return rows.map((row) => normalizeExactAppointmentDoctor(row, byDoctor.get(row.id) || []));
}

function exactDoctorPublicSettings(settings) {
  const mode = ["off", "optional", "required"].includes(cleanString(settings.doctor_selection_mode))
    ? cleanString(settings.doctor_selection_mode)
    : "off";
  return {
    doctor_booking_enabled: settings.doctor_booking_enabled === true && mode !== "off",
    doctor_selection_mode: settings.doctor_booking_enabled === true ? mode : "off",
    auto_assign_doctor: settings.auto_assign_doctor !== false,
    allow_member_doctor_change: settings.allow_member_doctor_change !== false,
    doctor_feature_version: settings.doctor_feature_version || DOCTOR_SLOT_FEATURE_VERSION
  };
}

function doctorWorksInInterval(doctorId, serviceId, startMinutes, endMinutes, weekday, context, excludeId = "") {
  const doctor = context.doctorMap.get(doctorId);
  if (!doctor || doctor.is_active === false) return false;

  const mappings = context.serviceMapByDoctor.get(doctorId) || [];
  if (mappings.length && !mappings.includes(serviceId)) return false;

  const hours = context.hoursByDoctor.get(doctorId) || [];
  const withinHours = hours.some((row) => row.is_active !== false && Number(row.weekday) === weekday && timeToMinutes(row.open_time) <= startMinutes && timeToMinutes(row.close_time) >= endMinutes);
  if (!withinHours) return false;

  const blocks = context.blocksByDoctor.get(doctorId) || [];
  const blocked = blocks.some((row) => {
    if (row.is_active === false) return false;
    if (row.all_day === true) return true;
    return timeToMinutes(row.start_time) < endMinutes && timeToMinutes(row.end_time) > startMinutes;
  });
  if (blocked) return false;

  const busy = context.existing.some((row) => {
    if (excludeId && row.id === excludeId) return false;
    if (!row.doctor_id || row.doctor_id !== doctorId) return false;
    const rowStart = timeToMinutes(row.start_time);
    const rowEnd = timeToMinutes(row.end_time);
    return rowStart < endMinutes && rowEnd > startMinutes;
  });
  return !busy;
}

async function exactDoctorAvailabilityContext(env, clinic, serviceId, dateText, existing) {
  const weekday = getDayOfWeekFromDateText(dateText);
  const [doctors, mappings, hours, blocks] = await Promise.all([
    getExactAppointmentDoctors(env, clinic.id, true),
    getExactAppointmentDoctorServices(env, clinic.id),
    getExactAppointmentDoctorHours(env, clinic.id),
    getExactAppointmentDoctorBlocks(env, clinic.id, { date: dateText, activeOnly: true })
  ]);
  const doctorMap = new Map(doctors.map((row) => [row.id, row]));
  const serviceMapByDoctor = new Map();
  for (const row of mappings.filter((x) => x.is_active !== false)) {
    if (!serviceMapByDoctor.has(row.doctor_id)) serviceMapByDoctor.set(row.doctor_id, []);
    serviceMapByDoctor.get(row.doctor_id).push(row.service_type_id);
  }
  const hoursByDoctor = new Map();
  for (const row of hours) {
    if (!hoursByDoctor.has(row.doctor_id)) hoursByDoctor.set(row.doctor_id, []);
    hoursByDoctor.get(row.doctor_id).push(row);
  }
  const blocksByDoctor = new Map();
  for (const row of blocks) {
    if (!blocksByDoctor.has(row.doctor_id)) blocksByDoctor.set(row.doctor_id, []);
    blocksByDoctor.get(row.doctor_id).push(row);
  }
  return { doctors, doctorMap, serviceMapByDoctor, hoursByDoctor, blocksByDoctor, existing, serviceId, weekday };
}

function normalizeExactAppointmentService(row, settings = {}) {
  const rawDuration = Number(row?.duration_minutes || 30);
  const duration = Number.isFinite(rawDuration) ? Math.max(5, Math.min(240, rawDuration)) : 30;
  const normalizedDuration = Math.ceil(duration / 5) * 5;
  const capacity = Math.max(1, Number(row?.capacity_per_slot || settings.default_capacity || 1));
  return {
    ...row,
    duration_minutes: normalizedDuration,
    capacity_per_slot: capacity
  };
}

function exactAppointmentPublicSettings(settings) {
  return {
    exact_time_booking_enabled: settings.exact_time_booking_enabled === true && settings.status !== "inactive",
    slot_minutes: [10, 15, 20, 30].includes(Number(settings.slot_minutes)) ? Number(settings.slot_minutes) : 30,
    same_day_booking_enabled: settings.same_day_booking_enabled === true,
    min_days_ahead: Number(settings.min_days_ahead || 0),
    max_days_ahead: Number(settings.max_days_ahead || 60),
    booking_lead_minutes: Number(settings.booking_lead_minutes || 0),
    allow_member_change: settings.allow_member_change === true,
    allow_member_cancel: settings.allow_member_cancel === true,
    ...exactDoctorPublicSettings(settings),
    change_deadline_hours: Number(settings.change_deadline_hours || 0),
    cancel_deadline_hours: Number(settings.cancel_deadline_hours || 0),
    public_note: settings.public_note || ""
  };
}

function nowJstParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}`,
    minutes: Number(map.hour) * 60 + Number(map.minute)
  };
}

function exactAppointmentDateTimeMs(dateText, timeText) {
  const time = normalizeTime(timeText);
  if (!time) return NaN;
  return Date.parse(`${dateText}T${time}:00+09:00`);
}

function exactAppointmentDeadlineOk(row, deadlineHours) {
  const startMs = exactAppointmentDateTimeMs(row.appointment_date, row.start_time);
  if (!Number.isFinite(startMs)) return false;
  return Date.now() <= startMs - Math.max(0, Number(deadlineHours || 0)) * 60 * 60 * 1000;
}


function buildExactAppointmentNo(dateText) {
  const suffix = createToken("a").replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase();
  return `VETA-${String(dateText || "").replaceAll("-", "")}-${suffix}`;
}

function normalizeExactAppointmentStatus(value) {
  const status = cleanString(value || "scheduled");
  const allowed = ["scheduled", "confirmed", "checked_in", "completed", "cancelled", "no_show"];
  if (!allowed.includes(status)) throw new Error("予約ステータスが不正です。");
  return status;
}

function normalizeExactAppointmentSource(value, fallback = "line", adminMode = false) {
  return normalizeIntegratedBookingSource(value, fallback, adminMode);
}

function validateExactAppointmentSettingsInput(body, current) {
  const merged = { ...current };
  const boolKeys = [
    "exact_time_booking_enabled", "same_day_booking_enabled",
    "allow_member_change", "allow_member_cancel",
    "doctor_booking_enabled", "auto_assign_doctor", "allow_member_doctor_change"
  ];
  boolKeys.forEach((key) => {
    if (body[key] !== undefined) merged[key] = toBool(body[key], merged[key]);
  });

  const numberRules = {
    min_days_ahead: [0, 30],
    max_days_ahead: [1, 180],
    booking_lead_minutes: [0, 10080],
    default_capacity: [1, 20],
    change_deadline_hours: [0, 720],
    cancel_deadline_hours: [0, 720]
  };
  Object.entries(numberRules).forEach(([key, [min, max]]) => {
    if (body[key] === undefined) return;
    const value = Number(body[key]);
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${key}の値が範囲外です。`);
    merged[key] = value;
  });
  if (body.slot_minutes !== undefined) {
    const slotMinutes = Number(body.slot_minutes);
    if (![10, 15, 20, 30].includes(slotMinutes)) throw new Error("予約開始刻みは10・15・20・30分から選択してください。");
    merged.slot_minutes = slotMinutes;
  } else {
    const currentSlot = Number(merged.slot_minutes || 30);
    merged.slot_minutes = [10, 15, 20, 30].includes(currentSlot) ? currentSlot : 30;
  }
  if (Number(merged.max_days_ahead) < Number(merged.min_days_ahead)) {
    throw new Error("予約可能終了日は予約可能開始日以降にしてください。");
  }
  if (body.doctor_selection_mode !== undefined) {
    const mode = cleanString(body.doctor_selection_mode || "off");
    if (!["off", "optional", "required"].includes(mode)) throw new Error("獣医師選択モードが不正です。");
    merged.doctor_selection_mode = mode;
  }
  if (body.public_note !== undefined) merged.public_note = cleanString(body.public_note);
  if (body.owner_note !== undefined) merged.owner_note = cleanString(body.owner_note);
  if (body.status !== undefined) merged.status = cleanString(body.status) === "inactive" ? "inactive" : "active";
  return merged;
}

async function exactAppointmentOperatingRanges(env, clinic, dateText) {
  parseDateText(dateText);
  const clinicSettings = await getClinicSettingsByCode(env, clinic.clinic_code, clinic);
  const calendarRows = await getClinicCalendarByCode(env, clinic.clinic_code, dateText, dateText);
  const calendar = calendarRows[0] || null;

  if (calendar) {
    if (calendar.is_full_closed === true || calendar.reception_label === "休診") {
      return { available: false, reason: calendar.display_message || "休診日です。", ranges: [], calendar };
    }
    const ranges = [];
    if (calendar.can_accept_morning !== false && calendar.is_morning_closed !== true) {
      const open = normalizeTime(calendar.morning_open_time || clinicSettings.morning_open_time);
      const close = normalizeTime(calendar.morning_close_time || clinicSettings.morning_close_time);
      if (open && close) ranges.push({ open, close, label: "午前" });
    }
    if (calendar.can_accept_afternoon !== false && calendar.is_afternoon_closed !== true) {
      const open = normalizeTime(calendar.afternoon_open_time || clinicSettings.afternoon_open_time);
      const close = normalizeTime(calendar.afternoon_close_time || clinicSettings.afternoon_close_time);
      if (open && close) ranges.push({ open, close, label: "午後" });
    }
    return { available: ranges.length > 0, reason: ranges.length ? "" : (calendar.display_message || "予約可能時間がありません。"), ranges, calendar };
  }

  const weekday = getDayOfWeekFromDateText(dateText);
  const [regularHolidays, specialDays] = await Promise.all([
    getClinicRegularHolidaysByCode(env, clinic.clinic_code),
    getClinicSpecialDaysByCode(env, clinic.clinic_code, dateText, dateText)
  ]);
  const activeSpecials = specialDays.filter((row) => row.is_active !== false);
  const fullSpecial = activeSpecials.some((row) => ["special_closed", "reception_stopped"].includes(row.day_type));
  if (fullSpecial) return { available: false, reason: activeSpecials[0]?.title || "臨時休診日です。", ranges: [], calendar: null };

  const fullRegular = regularHolidays.some((row) => Number(row.weekday) === weekday && row.is_active !== false && row.closed_type === "full");
  if (fullRegular) return { available: false, reason: `${getDayLabel(weekday)}は休診日です。`, ranges: [], calendar: null };

  const morningClosed = activeSpecials.some((row) => row.day_type === "morning_closed") ||
    regularHolidays.some((row) => Number(row.weekday) === weekday && row.is_active !== false && row.closed_type === "morning");
  const afternoonClosed = activeSpecials.some((row) => row.day_type === "afternoon_closed") ||
    regularHolidays.some((row) => Number(row.weekday) === weekday && row.is_active !== false && row.closed_type === "afternoon");

  const ranges = [];
  if (!morningClosed) {
    const open = normalizeTime(clinicSettings.morning_open_time);
    const close = normalizeTime(clinicSettings.morning_close_time);
    if (open && close) ranges.push({ open, close, label: "午前" });
  }
  if (!afternoonClosed) {
    const open = normalizeTime(clinicSettings.afternoon_open_time);
    const close = normalizeTime(clinicSettings.afternoon_close_time);
    if (open && close) ranges.push({ open, close, label: "午後" });
  }
  return { available: ranges.length > 0, reason: ranges.length ? "" : "予約可能時間がありません。", ranges, calendar: null };
}

function exactAppointmentDateRange(settings) {
  const today = todayJST();
  const minDays = settings.same_day_booking_enabled === true
    ? Math.max(0, Number(settings.min_days_ahead || 0))
    : Math.max(1, Number(settings.min_days_ahead || 1));
  return {
    min_date: addDays(today, minDays),
    max_date: addDays(today, Number(settings.max_days_ahead || 60))
  };
}

async function exactAppointmentAvailability(env, clinic, settings, service, dateText, options = {}) {
  const range = exactAppointmentDateRange(settings);
  if (compareDateText(dateText, range.min_date) < 0 || compareDateText(dateText, range.max_date) > 0) {
    return { ok: true, available: false, date: dateText, reason: `予約可能日は${range.min_date}〜${range.max_date}です。`, ...range, slots: [] };
  }

  const operating = await exactAppointmentOperatingRanges(env, clinic, dateText);
  if (!operating.available) {
    return { ok: true, available: false, date: dateText, reason: operating.reason, ...range, ranges: operating.ranges, slots: [] };
  }

  const normalizedService = normalizeExactAppointmentService(service, settings);
  const slotMinutes = [10, 15, 20, 30].includes(Number(settings.slot_minutes)) ? Number(settings.slot_minutes) : 30;
  const starts = buildSlotsFromRanges(operating.ranges, slotMinutes, normalizedService.duration_minutes);
  const now = nowJstParts();
  const leadMinutes = Math.max(0, Number(settings.booking_lead_minutes || 0));
  const activeStatuses = "in.(scheduled,confirmed,checked_in)";
  const existingRaw = await selectRows(env, TABLES.exactAppointments, {
    select: "id,pet_id,doctor_id,appointment_date,start_time,end_time,status,service_type_id",
    clinic_id: `eq.${clinic.id}`,
    appointment_date: `eq.${dateText}`,
    status: activeStatuses,
    order: "start_time.asc"
  });

  const excludeId = cleanString(options.excludeAppointmentId || "");
  const excludeIds = new Set([
    excludeId,
    ...(Array.isArray(options.excludeAppointmentIds) ? options.excludeAppointmentIds.map((v) => cleanString(v)) : [])
  ].filter(Boolean));
  const existing = existingRaw.filter((row) => !excludeIds.has(cleanString(row.id)));
  const petId = cleanString(options.petId || "");
  const clinicCapacity = Math.max(1, Number(settings.default_capacity || 1));
  const serviceCapacity = Math.max(1, Number(normalizedService.capacity_per_slot || clinicCapacity));
  const doctorSettings = exactDoctorPublicSettings(settings);
  const requestedDoctorId = cleanString(options.doctorId || "");
  const doctorContext = doctorSettings.doctor_booking_enabled
    ? await exactDoctorAvailabilityContext(env, clinic, normalizedService.id, dateText, existing)
    : null;

  const slots = starts.map((startTime) => {
    const startMinutes = timeToMinutes(startTime);
    const endTime = minutesToTime(startMinutes + normalizedService.duration_minutes);
    const endMinutes = timeToMinutes(endTime);
    const overlapping = existing.filter((row) => {
      if (excludeId && row.id === excludeId) return false;
      const rowStart = timeToMinutes(row.start_time);
      const rowEnd = timeToMinutes(row.end_time);
      return rowStart < endMinutes && rowEnd > startMinutes;
    });
    const clinicBookedCount = overlapping.length;
    const serviceBookedCount = overlapping.filter((row) => row.service_type_id === normalizedService.id).length;
    const petConflict = Boolean(petId && overlapping.some((row) => row.pet_id === petId));
    const leadOk = !(dateText === now.date && startMinutes < now.minutes + leadMinutes);
    const clinicRemaining = Math.max(0, clinicCapacity - clinicBookedCount);
    const serviceRemaining = Math.max(0, serviceCapacity - serviceBookedCount);
    let availableDoctors = [];
    if (doctorContext) {
      availableDoctors = doctorContext.doctors
        .filter((doctor) => !requestedDoctorId || doctor.id === requestedDoctorId)
        .filter((doctor) => doctorWorksInInterval(doctor.id, normalizedService.id, startMinutes, endMinutes, doctorContext.weekday, doctorContext, excludeId))
        .map((doctor) => ({ id: doctor.id, doctor_code: doctor.doctor_code, display_name: doctor.display_name || doctor.doctor_name, doctor_name: doctor.doctor_name }));
    }
    const doctorRemaining = doctorContext ? availableDoctors.length : Math.min(clinicCapacity, serviceCapacity);
    const remaining = Math.max(0, Math.min(clinicRemaining, serviceRemaining, doctorRemaining));
    let reason = "";
    if (!leadOk) reason = "受付締切を過ぎています";
    else if (petConflict) reason = "このペットは同時間帯に予約済みです";
    else if (clinicRemaining <= 0) reason = "病院全体の予約枠が満席です";
    else if (serviceRemaining <= 0) reason = "この予約内容の枠が満席です";
    else if (doctorContext && requestedDoctorId && !availableDoctors.length) reason = "選択した獣医師はこの時間帯に予約できません";
    else if (doctorContext && !availableDoctors.length) reason = "この時間帯に担当できる獣医師がいません";
    return {
      start_time: startTime,
      end_time: endTime,
      capacity: Math.min(clinicCapacity, serviceCapacity),
      clinic_capacity: clinicCapacity,
      service_capacity: serviceCapacity,
      booked_count: serviceBookedCount,
      clinic_booked_count: clinicBookedCount,
      service_booked_count: serviceBookedCount,
      available_doctor_count: availableDoctors.length,
      available_doctors: availableDoctors,
      remaining,
      pet_conflict: petConflict,
      available: leadOk && !petConflict && remaining > 0,
      reason
    };
  });

  return {
    ok: true,
    available: slots.some((slot) => slot.available),
    date: dateText,
    reason: slots.some((slot) => slot.available) ? "" : "この日は予約可能な時間枠がありません。",
    ...range,
    ranges: operating.ranges,
    service: normalizedService,
    slot_minutes: slotMinutes,
    clinic_capacity: clinicCapacity,
    service_capacity: serviceCapacity,
    doctor_settings: doctorSettings,
    requested_doctor_id: requestedDoctorId || null,
    slots
  };
}

async function resolveExactAppointmentMember(env, clinic, request, body = {}) {
  const requestedLineUserId = cleanString(body.line_user_id || body.lineUserId || getParam(request,"line_user_id","") || getParam(request,"lineUserId",""));
  const verifiedLineUserId = cleanString(request.headers.get("X-DPRO-Verified-Line-User-Id"));
  const isDemoClinic = clinic.clinic_code === getDemoClinicCode(env);
  const lineUserId = isDemoClinic ? requestedLineUserId : verifiedLineUserId;
  const guardianId = cleanString(body.guardian_id || getParam(request, "guardian_id", ""));
  const demoValue = cleanString(body.demo ?? getParam(request, "demo", "false")).toLowerCase();
  const demo = ["true", "1", "yes", "on", "ready"].includes(demoValue);
  let guardian = null;

  if (lineUserId) {
    guardian = await selectSingle(env, TABLES.guardians, { select: "*", clinic_id: `eq.${clinic.id}`, line_user_id: `eq.${lineUserId}` });
    if (guardianId && guardian && guardian.id !== guardianId) guardian = null;
  } else if (demo && clinic.clinic_code === getDemoClinicCode(env) && guardianId) {
    guardian = await selectSingle(env, TABLES.guardians, { select: "*", clinic_id: `eq.${clinic.id}`, id: `eq.${guardianId}` });
  } else if (demo && clinic.clinic_code === getDemoClinicCode(env)) {
    guardian = await selectSingle(env, TABLES.guardians, { select: "*", clinic_id: `eq.${clinic.id}`, guardian_no: "eq.G-0001" });
  }

  return { guardian, lineUserId: lineUserId || guardian?.line_user_id || "", demo };
}

async function resolveExactAppointmentPet(env, clinic, guardian, petId) {
  const id = cleanString(petId);
  if (!id) throw new Error("予約するペットを選択してください。");
  const pet = await selectSingle(env, TABLES.pets, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    guardian_id: `eq.${guardian.id}`,
    id: `eq.${id}`,
    status: "eq.active"
  });
  if (!pet) throw new Error("選択したペットが飼い主情報に登録されていません。");
  return pet;
}

async function getExactAppointmentServiceByInput(env, clinic, body, activeOnly = true) {
  const serviceId = cleanString(body.service_id || body.service_type_id);
  const serviceCode = cleanString(body.service_code);
  const query = { select: "*", clinic_id: `eq.${clinic.id}` };
  if (serviceId) query.id = `eq.${serviceId}`;
  else if (serviceCode) query.service_code = `eq.${serviceCode}`;
  else throw new Error("予約内容を選択してください。");
  if (activeOnly) query.is_active = "eq.true";
  const service = await selectSingle(env, TABLES.exactAppointmentServices, query);
  if (!service) throw new Error("選択した予約内容は現在利用できません。");
  return service;
}

async function enrichExactAppointments(env, rows, settings = null) {
  const serviceIds = Array.from(new Set(rows.map((row) => row.service_type_id).filter(Boolean)));
  let services = [];
  if (serviceIds.length) {
    services = await selectRows(env, TABLES.exactAppointmentServices, {
      select: "*",
      id: `in.(${serviceIds.join(",")})`
    });
  }
  const doctorIds = Array.from(new Set(rows.map((row) => row.doctor_id).filter(Boolean)));
  let doctors = [];
  if (doctorIds.length) {
    doctors = await selectRows(env, TABLES.exactAppointmentDoctors, { select: "*", id: `in.(${doctorIds.join(",")})` });
  }
  const serviceMap = new Map(services.map((row) => [row.id, row]));
  const doctorMap = new Map(doctors.map((row) => [row.id, row]));
  const baseRows = rows.map((row) => {
    const service = serviceMap.get(row.service_type_id) || null;
    const doctor = doctorMap.get(row.doctor_id) || null;
    const publicSettings = settings ? exactAppointmentPublicSettings(settings) : null;
    return {
      ...row,
      start_time: normalizeTime(row.start_time),
      end_time: normalizeTime(row.end_time),
      service,
      service_name: service?.service_name || "日時指定予約",
      doctor,
      doctor_name: row.doctor_name_snapshot || doctor?.display_name || doctor?.doctor_name || "おまかせ",
      can_member_change: Boolean(publicSettings?.allow_member_change && ["scheduled", "confirmed"].includes(row.status) && exactAppointmentDeadlineOk(row, publicSettings.change_deadline_hours)),
      can_member_cancel: Boolean(publicSettings?.allow_member_cancel && ["scheduled", "confirmed"].includes(row.status) && exactAppointmentDeadlineOk(row, publicSettings.cancel_deadline_hours))
    };
  });
  if (!baseRows.length) return baseRows;
  const clinicId=cleanString(baseRows[0]?.clinic_id);
  const clinic=clinicId ? await selectSingle(env,TABLES.clinics,{select:"*",id:`eq.${clinicId}`}).catch(()=>null) : null;
  return clinic ? attachWebQuestionnaireContextToRows(env,clinic,baseRows,"appointment") : baseRows;
}

async function findExactAppointmentForMember(env, clinic, request, body, settings) {
  const appointmentId = cleanString(body.appointment_id);
  const appointmentNo = cleanString(body.appointment_no);
  if (!appointmentId && !appointmentNo) throw new Error("予約番号がありません。");
  const query = { select: "*", clinic_id: `eq.${clinic.id}` };
  if (appointmentId) query.id = `eq.${appointmentId}`;
  else query.appointment_no = `eq.${appointmentNo}`;
  const appointment = await selectSingle(env, TABLES.exactAppointments, query);
  if (!appointment) throw new Error("予約が見つかりません。");

  const member = await resolveExactAppointmentMember(env, clinic, request, body);
  const token = cleanString(body.booking_token || getParam(request, "booking_token", ""));
  let tokenMatched = false;
  if (token) tokenMatched = (await sha256Hex(token)) === appointment.booking_token_hash;
  const guardianMatched = Boolean(member.guardian && appointment.guardian_id === member.guardian.id);
  if (!tokenMatched && !guardianMatched) throw new Error("この予約を変更する権限を確認できません。");
  return { appointment, member, settings };
}


function exactAppointmentActionNoticeText(clinic, target, action) {
  const clinicName = clinic.clinic_name || clinic.display_name || SERVICE_NAME;
  const guardianName = target.guardian_name || "飼い主";
  const petName = target.pet_name || "ペット";
  const date = lineCallDateLabel(target.appointment_date);
  const time = cleanString(target.appointment_time).slice(0, 5);
  const service = cleanString(target.service_name);
  const detail = [date, time].filter(Boolean).join(" ");
  const serviceLine = service ? `\n内容：${service}` : "";

  if (action === "changed") {
    return sanitizeLineMessage(
      `${guardianName}様\n${petName}ちゃんの日時指定予約を変更しました。\n日時：${detail}${serviceLine}\n\n急患対応や診療内容により、開始時刻が前後する場合があります。\n${clinicName}`
    );
  }
  if (action === "cancelled") {
    return sanitizeLineMessage(
      `${guardianName}様\n${petName}ちゃんの日時指定予約キャンセルを受け付けました。\n対象日時：${detail}${serviceLine}\n\n改めて受診をご希望の場合は、LINEの予約・受付画面からご確認ください。\n${clinicName}`
    );
  }
  return sanitizeLineMessage(
    `${guardianName}様\n${petName}ちゃんの日時指定予約を受け付けました。\n日時：${detail}${serviceLine}\n\n急患対応や診療内容により、開始時刻が前後する場合があります。\n前日にもLINEでご案内します。\n${clinicName}`
  );
}

function exactAppointmentActionNoticeDedupeKey(action, target) {
  const id = cleanString(target.target_id);
  if (action === "changed") {
    return [
      "appointment_changed",
      id,
      cleanString(target.appointment_date),
      cleanString(target.appointment_time),
      cleanString(target.source?.service_type_id),
      cleanString(target.source?.doctor_id)
    ].join(":");
  }
  if (action === "cancelled") return `appointment_cancelled:${id}`;
  return `appointment_created:${id}`;
}

async function autoNotifyExactAppointmentAction(env, clinic, appointmentId, action, actorName = "system") {
  const result = {
    ok: true,
    feature_version: APPOINTMENT_ACTION_NOTICE_FEATURE_VERSION,
    action,
    appointment_id: appointmentId,
    sent: false,
    held: false,
    skipped: false,
    duplicate: false
  };

  try {
    const settings = await getLineCallSettings(env, clinic);
    if (settings.enabled !== true || settings.appointment_reminder_enabled !== true) {
      return { ...result, skipped: true, reason: "appointment_line_notice_disabled" };
    }

    const target = await resolveLineCallTarget(env, clinic, {
      target_kind: "appointment",
      target_id: appointmentId
    });

    if (!target.can_send_line) {
      return {
        ...result,
        skipped: true,
        reason: "line_unlinked",
        line_link_status: target.line_link_status
      };
    }

    const dedupeKey = exactAppointmentActionNoticeDedupeKey(action, target);
    const existing = await selectSingle(env, TABLES.messageQueue, {
      select: "*",
      clinic_id: `eq.${clinic.id}`,
      dedupe_key: `eq.${dedupeKey}`,
      status: "neq.cancelled"
    }).catch(() => null);

    if (existing) {
      return {
        ...result,
        skipped: true,
        duplicate: true,
        reason: "dedupe_guard",
        queue_item_id: existing.id,
        delivery_status: existing.delivery_status
      };
    }

    const mode = effectiveLineCallMode(env, clinic, settings);
    if (mode === "send" && !lineCallTokenConfigured(env)) {
      return { ...result, skipped: true, reason: "line_channel_access_token_missing" };
    }

    if (mode === "send") {
      try {
        await assertLineCallRateLimit(env, clinic, settings);
      } catch (error) {
        return { ...result, skipped: true, reason: "rate_limit", error: error?.message || String(error) };
      }
    }

    const body = exactAppointmentActionNoticeText(clinic, target, action);
    const rows = await insertRows(env, TABLES.messageQueue, {
      clinic_id: clinic.id,
      guardian_id: target.guardian_id,
      pet_id: target.pet_id,
      template_id: null,
      message_type: action === "changed"
        ? "appointment_changed"
        : action === "cancelled"
          ? "appointment_cancelled"
          : "appointment_created",
      body,
      status: "pending",
      scheduled_for: null,
      created_by_staff: nullIfEmpty(actorName) || "system",
      target_kind: "appointment",
      target_id: target.target_id,
      waiting_entry_id: null,
      exact_appointment_id: target.target_id,
      trigger_type: "appointment_action_auto",
      delivery_mode: mode,
      delivery_status: mode === "send" ? "queued" : "held",
      dedupe_key: dedupeKey,
      recipient_name: target.guardian_name,
      pet_name_snapshot: target.pet_name,
      provider: "line",
      attempt_count: 0,
      payload: {
        feature_version: APPOINTMENT_ACTION_NOTICE_FEATURE_VERSION,
        worker_version: WORKER_VERSION,
        action,
        appointment_date: target.appointment_date || null,
        appointment_time: target.appointment_time || null,
        service_name: target.service_name || null,
        demo_forced_hold: isDemoClinicForLineCall(clinic)
      }
    });
    const item = Array.isArray(rows) ? rows[0] : rows;

    const delivery = await sendExistingLineQueueItem(env, clinic, settings, item, target);
    await logOperation(
      env,
      clinic.id,
      "system",
      cleanString(actorName) || "予約自動案内",
      "exact_appointment_action_notice",
      "message_queue",
      item?.id || appointmentId,
      {
        action,
        appointment_id: appointmentId,
        effective_mode: mode,
        sent: delivery.sent === true,
        held: delivery.held === true,
        failed: delivery.failed === true,
        feature_version: APPOINTMENT_ACTION_NOTICE_FEATURE_VERSION
      }
    );

    return {
      ...result,
      sent: delivery.sent === true,
      held: delivery.held === true,
      failed: delivery.failed === true,
      queue_item_id: delivery.item?.id || item?.id || null,
      delivery_status: delivery.item?.delivery_status || null,
      error: delivery.error || null
    };
  } catch (error) {
    // 通知の失敗で予約本体を失敗させない。
    return {
      ...result,
      ok: false,
      skipped: true,
      reason: "notification_error",
      error: error?.message || String(error)
    };
  }
}

async function handleExactAppointmentPublicSettings(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const featureState = await getClinicFeatureState(env, clinicCode);
  const clinic = featureState.clinic;
  if (featureState.feature_flags.exact_appointment !== true) {
    const settings = await getExactAppointmentSettings(env, clinic);
    return jsonResponse({
      ok: true,
      worker_version: WORKER_VERSION,
      clinic,
      settings: { ...exactAppointmentPublicSettings(settings), exact_time_booking_enabled: false, doctor_booking_enabled: false },
      services: [],
      doctors: [],
      feature_disabled: true,
      feature_key: "exact_appointment",
      reason: "日時指定予約は病院設定でOFFです。"
    });
  }
  const [settings, services, doctors] = await Promise.all([
    getExactAppointmentSettings(env, clinic),
    getExactAppointmentServices(env, clinic.id, true),
    enrichExactAppointmentDoctors(env, clinic.id)
  ]);
  const range = exactAppointmentDateRange(settings);
  return jsonResponse({
    ok: true,
    worker_version: WORKER_VERSION,
    clinic,
    settings: exactAppointmentPublicSettings(settings),
    services: services.map((row) => normalizeExactAppointmentService(row, settings)),
    doctors: settings.doctor_booking_enabled === true && featureState.feature_flags.doctor_selection === true ? doctors : [],
    ...range
  });
}


async function handleExactAppointmentPublicDoctors(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const featureState = await getClinicFeatureState(env, clinicCode);
  const clinic = featureState.clinic;
  const settings = await getExactAppointmentSettings(env, clinic);
  if (featureState.feature_flags.exact_appointment !== true || featureState.feature_flags.doctor_selection !== true) {
    return jsonResponse({ ok: true, worker_version: WORKER_VERSION, clinic, settings: { ...exactAppointmentPublicSettings(settings), doctor_booking_enabled: false }, doctors: [], feature_disabled: true });
  }
  const doctors = settings.doctor_booking_enabled === true ? await enrichExactAppointmentDoctors(env, clinic.id) : [];
  const serviceId = cleanString(getParam(request, "service_id", ""));
  const filtered = serviceId ? doctors.filter((d) => !d.service_ids.length || d.service_ids.includes(serviceId)) : doctors;
  return jsonResponse({ ok: true, worker_version: WORKER_VERSION, clinic, settings: exactAppointmentPublicSettings(settings), doctors: filtered });
}

async function handleExactAppointmentAvailability(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const dateText = cleanString(getParam(request, "date", ""));
  if (!dateText) return errorResponse("予約日を指定してください。", 400);
  const featureState = await getClinicFeatureState(env, clinicCode);
  const clinic = featureState.clinic;
  const settings = await getExactAppointmentSettings(env, clinic);
  if (featureState.feature_flags.exact_appointment !== true) {
    return jsonResponse({ ok: true, available: false, clinic, settings: { ...exactAppointmentPublicSettings(settings), exact_time_booking_enabled: false }, date: dateText, reason: "日時指定予約は病院設定でOFFです。", slots: [], feature_disabled: true });
  }
  if (settings.exact_time_booking_enabled !== true || settings.status === "inactive") {
    return jsonResponse({ ok: true, available: false, clinic, settings: exactAppointmentPublicSettings(settings), date: dateText, reason: "日時指定予約は現在受け付けていません。", slots: [] });
  }
  const service = await getExactAppointmentServiceByInput(env, clinic, {
    service_id: getParam(request, "service_id", ""),
    service_code: getParam(request, "service_code", "")
  });
  const availability = await exactAppointmentAvailability(env, clinic, settings, service, dateText, {
    excludeAppointmentId: getParam(request, "exclude_appointment_id", ""),
    petId: getParam(request, "pet_id", ""),
    doctorId: getParam(request, "doctor_id", "")
  });
  return jsonResponse({ ok: true, worker_version: WORKER_VERSION, clinic, settings: exactAppointmentPublicSettings(settings), ...availability });
}

async function createExactAppointmentCore(request, env, body, adminMode = false, options = {}) {
  const clinicCode = getRequestedClinicCode(request, body);
  const featureState = await getClinicFeatureState(env, clinicCode);
  const clinic = featureState.clinic;
  if (featureState.feature_flags.exact_appointment !== true) throw new Error("日時指定予約は病院設定でOFFです。");
  const settings = await getExactAppointmentSettings(env, clinic, { createIfMissing: adminMode });
  if (settings.exact_time_booking_enabled !== true || settings.status === "inactive") throw new Error("日時指定予約は現在受け付けていません。");

  let guardian = null;
  let lineUserId = cleanString(body.line_user_id || body.lineUserId);
  if (adminMode) {
    const guardianId = cleanString(body.guardian_id);
    if (!guardianId) throw new Error("飼い主を選択してください。");
    guardian = await selectSingle(env, TABLES.guardians, { select: "*", clinic_id: `eq.${clinic.id}`, id: `eq.${guardianId}` });
  } else {
    const member = await resolveExactAppointmentMember(env, clinic, request, body);
    guardian = member.guardian;
    lineUserId = member.lineUserId;
  }
  if (!guardian) throw new Error("LINE連携済みの飼い主情報が見つかりません。先に診察券を登録してください。");

  const pet = await resolveExactAppointmentPet(env, clinic, guardian, body.pet_id);
  const service = await getExactAppointmentServiceByInput(env, clinic, body);
  const dateText = cleanString(body.appointment_date || body.date);
  const startTime = normalizeTime(body.start_time || body.time);
  if (!dateText || !startTime) throw new Error("予約日と開始時刻を選択してください。");
  parseDateText(dateText);

  const vaccineIntervalEvaluation = await evaluateVaccineIntervalForAppointment(env, {
    clinic, clinicCode, featureState, body, pet, service, appointmentDate: dateText, adminMode
  });
  if (!vaccineIntervalEvaluation.allowed) throw new Error(vaccineIntervalEvaluation.message || "この日付では予約できません。病院へご相談ください。");

  const doctorSelectionEnabled = featureState.feature_flags.doctor_selection === true;
  const requestedDoctorId = doctorSelectionEnabled ? cleanString(body.doctor_id || "") : "";
  const doctorSettingsRaw = exactDoctorPublicSettings(settings);
  const doctorSettings = doctorSelectionEnabled
    ? doctorSettingsRaw
    : { ...doctorSettingsRaw, doctor_booking_enabled: false, doctor_selection_mode: "disabled", auto_assign_doctor: false };
  if (doctorSettings.doctor_booking_enabled && doctorSettings.doctor_selection_mode === "required" && !requestedDoctorId) {
    throw new Error("担当獣医師を選択してください。");
  }
  const availability = await exactAppointmentAvailability(env, clinic, settings, service, dateText, { petId: pet.id, doctorId: requestedDoctorId });
  const selectedSlot = availability.slots.find((slot) => slot.start_time === startTime);
  if (!selectedSlot || !selectedSlot.available) throw new Error(selectedSlot?.reason || "選択した時間枠は予約できません。");

  const bookingToken = createToken("vetapt");
  const bookingTokenHash = await sha256Hex(bookingToken);
  const appointmentNo = buildExactAppointmentNo(dateText);
  const source = normalizeExactAppointmentSource(body.source, adminMode ? "staff" : "line", adminMode);
  const actorType = adminMode ? "staff" : "member";
  const actorName = adminMode ? (cleanString(body.staff_name) || "管理画面") : (guardian.guardian_name || "飼い主");

  const rows = await supabaseRpc(env, "vet_create_exact_appointment_doctor", {
    p_clinic_id: clinic.id,
    p_guardian_id: guardian.id,
    p_pet_id: pet.id,
    p_service_type_id: service.id,
    p_appointment_date: dateText,
    p_start_time: selectedSlot.start_time,
    p_end_time: selectedSlot.end_time,
    p_capacity: Number(service.capacity_per_slot || settings.default_capacity || 1),
    p_appointment_no: appointmentNo,
    p_booking_token_hash: bookingTokenHash,
    p_source: source,
    p_guardian_name_snapshot: guardian.guardian_name || "",
    p_pet_name_snapshot: pet.pet_name || "",
    p_phone_snapshot: guardian.phone || "",
    p_line_user_id: lineUserId || guardian.line_user_id || null,
    p_request_note: cleanString(body.request_note || body.note),
    p_internal_note: adminMode ? cleanString(body.internal_note) : null,
    p_actor_type: actorType,
    p_actor_name: actorName,
    p_is_demo: clinicCode === getDemoClinicCode(env),
    p_doctor_id: requestedDoctorId || null,
    p_doctor_assignment_source: requestedDoctorId ? (adminMode ? "staff" : "selected") : "unassigned",
    p_auto_assign_doctor: doctorSettings.auto_assign_doctor === true
  });
  let appointment = Array.isArray(rows) ? rows[0] : rows;
  if (appointment?.id && vaccineIntervalEvaluation.enabled) {
    try {
      await updateRows(env, TABLES.exactAppointments, { id: `eq.${appointment.id}`, clinic_id: `eq.${clinic.id}` }, vaccineIntervalSnapshot(vaccineIntervalEvaluation, body));
      appointment = await selectSingle(env, TABLES.exactAppointments, { select: "*", id: `eq.${appointment.id}`, clinic_id: `eq.${clinic.id}` }) || appointment;
    } catch (snapshotError) {
      await logOperation(env, clinic.id, "system", "V1.3接種間隔", "vaccine_interval_snapshot_failed", "exact_appointment", appointment.id, { error: snapshotError?.message || String(snapshotError) }).catch(() => null);
    }
  }
  await logOperation(env, clinic.id, actorType, actorName, "exact_appointment_create", "exact_appointment", appointment?.id || null, {
    appointment_no: appointmentNo,
    appointment_date: dateText,
    start_time: selectedSlot.start_time,
    service_name: service.service_name,
    doctor_id: appointment?.doctor_id || null,
    doctor_name: appointment?.doctor_name_snapshot || null,
    source
  });
  const questionnaireLink = options.suppressQuestionnaireLink === true
    ? {ok:true,linked:false,skipped:true,reason:"suppressed_for_multi_transaction"}
    : (appointment?.id ? await linkRecentQuestionnaireToAppointment(env, clinic, {
        appointment_id: appointment.id, pet_id: pet.id, pet_name: pet.pet_name || "", appointment_date: dateText, actor_name: actorName
      }) : {ok:true,linked:false,skipped:true,reason:"appointment_id_missing"});
  const enriched = await enrichExactAppointments(env, [appointment], settings);
  const notification = options.suppressNotification === true
    ? { ok: true, skipped: true, reason: "suppressed_for_multi_transaction" }
    : (appointment?.id
        ? await autoNotifyExactAppointmentAction(env, clinic, appointment.id, "created", actorName)
        : { ok: false, skipped: true, reason: "appointment_id_missing" });
  return { clinic, settings, appointment: enriched[0], booking_token: bookingToken, notification, questionnaire_link: questionnaireLink, questionnaire_visit_link_version: QUESTIONNAIRE_VISIT_LINK_VERSION, vaccine_interval_evaluation: vaccineIntervalEvaluation };
}

async function handleMemberExactAppointmentCreate(request, env) {
  const body = await readJson(request);
  const result = await createExactAppointmentCore(request, env, body, false);
  return jsonResponse({ ok: true, worker_version: WORKER_VERSION, message: "日時指定予約を受け付けました。", ...result });
}

async function handleMemberExactAppointmentList(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const featureState = await getClinicFeatureState(env, clinicCode);
  const clinic = featureState.clinic;
  const settings = await getExactAppointmentSettings(env, clinic);
  if (featureState.feature_flags.exact_appointment !== true) {
    return jsonResponse({ ok: true, clinic, settings: { ...exactAppointmentPublicSettings(settings), exact_time_booking_enabled: false }, appointments: [], feature_disabled: true, message: "日時指定予約は病院設定でOFFです。" });
  }
  const member = await resolveExactAppointmentMember(env, clinic, request, {});
  if (!member.guardian) return jsonResponse({ ok: true, clinic, settings: exactAppointmentPublicSettings(settings), appointments: [], message: "LINE連携済みの飼い主情報が見つかりません。" });
  const includeHistory = toBool(getParam(request, "include_history", "false"), false);
  const query = {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    guardian_id: `eq.${member.guardian.id}`,
    order: "appointment_date.asc,start_time.asc",
    limit: normalizeLimit(getParam(request, "limit", "100"), 100, 200)
  };
  if (!includeHistory) query.appointment_date = `gte.${todayJST()}`;
  const rows = await selectRows(env, TABLES.exactAppointments, query);
  return jsonResponse({
    ok: true,
    worker_version: WORKER_VERSION,
    clinic,
    guardian: member.guardian,
    settings: exactAppointmentPublicSettings(settings),
    appointments: await enrichExactAppointments(env, rows, settings)
  });
}

async function handleMemberExactAppointmentChange(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const featureState = await getClinicFeatureState(env, clinicCode);
  const clinic = featureState.clinic;
  const settings = await getExactAppointmentSettings(env, clinic);
  if (settings.allow_member_change !== true) throw new Error("予約変更は病院へ直接ご連絡ください。");
  const found = await findExactAppointmentForMember(env, clinic, request, body, settings);
  if (!exactAppointmentDeadlineOk(found.appointment, settings.change_deadline_hours)) throw new Error("LINEから変更できる期限を過ぎています。病院へ直接ご連絡ください。");

  const service = await getExactAppointmentServiceByInput(env, clinic, body);
  const dateText = cleanString(body.appointment_date || body.date);
  const startTime = normalizeTime(body.start_time || body.time);
  if (!dateText || !startTime) throw new Error("変更後の日付と時刻を選択してください。");
  const pet = await selectSingle(env, TABLES.pets, { select: "*", clinic_id: `eq.${clinic.id}`, id: `eq.${found.appointment.pet_id}` });
  const vaccineIntervalEvaluation = await evaluateVaccineIntervalForAppointment(env, {
    clinic, clinicCode, featureState, body, pet, service, appointmentDate: dateText, adminMode: false
  });
  if (!vaccineIntervalEvaluation.allowed) throw new Error(vaccineIntervalEvaluation.message || "この日付では予約できません。病院へご相談ください。");
  const doctorSettings = exactDoctorPublicSettings(settings);
  let requestedDoctorId = body.doctor_id !== undefined ? cleanString(body.doctor_id || "") : cleanString(found.appointment.doctor_id || "");
  if (doctorSettings.doctor_booking_enabled && doctorSettings.allow_member_doctor_change === false) requestedDoctorId = cleanString(found.appointment.doctor_id || "");
  if (doctorSettings.doctor_booking_enabled && doctorSettings.doctor_selection_mode === "required" && !requestedDoctorId) throw new Error("担当獣医師を選択してください。");
  const availability = await exactAppointmentAvailability(env, clinic, settings, service, dateText, { excludeAppointmentId: found.appointment.id, petId: found.appointment.pet_id, doctorId: requestedDoctorId });
  const slot = availability.slots.find((item) => item.start_time === startTime);
  if (!slot || !slot.available) throw new Error(slot?.reason || "選択した時間枠へ変更できません。");

  const rows = await supabaseRpc(env, "vet_change_exact_appointment_doctor", {
    p_appointment_id: found.appointment.id,
    p_new_service_type_id: service.id,
    p_new_appointment_date: dateText,
    p_new_start_time: slot.start_time,
    p_new_end_time: slot.end_time,
    p_capacity: Number(service.capacity_per_slot || settings.default_capacity || 1),
    p_request_note: cleanString(body.request_note || body.note) || null,
    p_actor_type: "member",
    p_actor_name: found.member.guardian?.guardian_name || "飼い主",
    p_reason: cleanString(body.reason || "LINEから予約変更"),
    p_new_doctor_id: requestedDoctorId || null,
    p_doctor_assignment_source: requestedDoctorId ? "selected" : "unassigned",
    p_auto_assign_doctor: doctorSettings.auto_assign_doctor === true
  });
  let changedRow = Array.isArray(rows) ? rows[0] : rows;
  if (changedRow?.id && vaccineIntervalEvaluation.enabled) {
    try {
      await updateRows(env, TABLES.exactAppointments, { id: `eq.${changedRow.id}`, clinic_id: `eq.${clinic.id}` }, vaccineIntervalSnapshot(vaccineIntervalEvaluation, body));
      changedRow = await selectSingle(env, TABLES.exactAppointments, { select: "*", id: `eq.${changedRow.id}`, clinic_id: `eq.${clinic.id}` }) || changedRow;
    } catch (snapshotError) {
      await logOperation(env, clinic.id, "system", "V1.3接種間隔", "vaccine_interval_snapshot_failed", "exact_appointment", changedRow.id, { error: snapshotError?.message || String(snapshotError) }).catch(() => null);
    }
  }
  const appointment = (await enrichExactAppointments(env, [changedRow], settings))[0];
  const notification = appointment?.id
    ? await autoNotifyExactAppointmentAction(env, clinic, appointment.id, "changed", found.member.guardian?.guardian_name || "飼い主")
    : { ok: false, skipped: true, reason: "appointment_id_missing" };
  return jsonResponse({ ok: true, worker_version: WORKER_VERSION, message: "予約日時を変更しました。", clinic, appointment, notification });
}

async function handleMemberExactAppointmentCancel(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const settings = await getExactAppointmentSettings(env, clinic);
  if (settings.allow_member_cancel !== true) throw new Error("予約キャンセルは病院へ直接ご連絡ください。");
  const found = await findExactAppointmentForMember(env, clinic, request, body, settings);
  if (!exactAppointmentDeadlineOk(found.appointment, settings.cancel_deadline_hours)) throw new Error("LINEからキャンセルできる期限を過ぎています。病院へ直接ご連絡ください。");
  const reason = cleanString(body.reason || "飼い主都合");
  const rows = await supabaseRpc(env, "vet_cancel_exact_appointment", {
    p_appointment_id: found.appointment.id,
    p_actor_type: "member",
    p_actor_name: found.member.guardian?.guardian_name || "飼い主",
    p_reason: reason
  });
  const appointment = (await enrichExactAppointments(env, [Array.isArray(rows) ? rows[0] : rows], settings))[0];
  const notification = appointment?.id
    ? await autoNotifyExactAppointmentAction(env, clinic, appointment.id, "cancelled", found.member.guardian?.guardian_name || "飼い主")
    : { ok: false, skipped: true, reason: "appointment_id_missing" };
  return jsonResponse({ ok: true, worker_version: WORKER_VERSION, message: "予約をキャンセルしました。", clinic, appointment, notification });
}


// =========================================================
// DPRO PET CARE LINE V1.2 / 複数ペット同時予約
// 重要: vet_exact_appointments は 1行=1ペットを維持する。
// booking_group_* は複数頭を束ねるメタデータのみで、受付・問診・QR・獣医師枠は各ペット単位。
// =========================================================
function normalizeMultiBookingMode(value) {
  const mode = cleanString(value || "consecutive").toLowerCase();
  if (!["consecutive", "same_time"].includes(mode)) throw new Error("複数ペット予約方式が不正です。");
  return mode;
}

function multiBookingFeatureEnabled(env, clinicCode, featureState, body = {}) {
  let flags = featureState.feature_flags;
  if (isDemoClinicCodeForAudit(env, clinicCode) && body.demo_feature_flags && typeof body.demo_feature_flags === "object" && !Array.isArray(body.demo_feature_flags)) {
    flags = normalizeFeatureFlags({ ...featureState.feature_flags, ...body.demo_feature_flags });
  }
  return flags.multi_pet_booking === true;
}

function normalizeMultiBookingItems(input) {
  if (!Array.isArray(input)) throw new Error("複数ペット予約の対象を選択してください。");
  if (input.length < 2) throw new Error("複数ペット予約は2頭以上を選択してください。");
  if (input.length > 10) throw new Error("一度に予約できるペットは10頭までです。");
  const items = input.map((item, index) => ({
    index,
    appointment_id: cleanString(item?.appointment_id || item?.id || ""),
    pet_id: cleanString(item?.pet_id || ""),
    service_id: cleanString(item?.service_id || item?.service_type_id || ""),
    doctor_id: item?.doctor_id === null ? "" : cleanString(item?.doctor_id || ""),
    request_note: cleanString(item?.request_note || item?.note || ""),
    vaccine_interval_rule_id: cleanString(item?.vaccine_interval_rule_id || item?.vaccine_rule_id || ""),
    prevention_schedule_id: cleanString(item?.prevention_schedule_id || "")
  }));
  const petIds = items.map((item) => item.pet_id);
  if (petIds.some((id) => !id)) throw new Error("予約するペットをすべて選択してください。");
  if (new Set(petIds).size !== petIds.length) throw new Error("同じペットを複数回選択することはできません。");
  if (items.some((item) => !item.service_id)) throw new Error("各ペットの予約内容を選択してください。");
  return items;
}

function buildMultiBookingGroupNo(dateText) {
  const suffix = createToken("g").replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase();
  return `VETG-${String(dateText || "").replaceAll("-", "")}-${suffix}`;
}

function intervalsOverlap(a, b) {
  return timeToMinutes(a.start_time) < timeToMinutes(b.end_time) && timeToMinutes(a.end_time) > timeToMinutes(b.start_time);
}

function hasDistinctDoctorAssignment(plans) {
  const ordered = plans
    .map((plan, idx) => ({ idx, choices: (plan.slot?.available_doctors || []).map((d) => cleanString(d.id)).filter(Boolean) }))
    .sort((a, b) => a.choices.length - b.choices.length);
  const used = new Set();
  function walk(pos) {
    if (pos >= ordered.length) return true;
    for (const doctorId of ordered[pos].choices) {
      if (used.has(doctorId)) continue;
      used.add(doctorId);
      if (walk(pos + 1)) return true;
      used.delete(doctorId);
    }
    return false;
  }
  return ordered.every((x) => x.choices.length > 0) && walk(0);
}

async function resolveMultiBookingContext(request, env, body, options = {}) {
  const clinicCode = getRequestedClinicCode(request, body);
  const featureState = await getClinicFeatureState(env, clinicCode);
  const clinic = featureState.clinic;
  if (featureState.feature_flags.exact_appointment !== true) throw new Error("日時指定予約は病院設定でOFFです。");
  if (!multiBookingFeatureEnabled(env, clinicCode, featureState, body)) {
    throw new Error("複数ペット同時予約は病院設定でOFFです。");
  }
  const settings = await getExactAppointmentSettings(env, clinic);
  if (settings.exact_time_booking_enabled !== true || settings.status === "inactive") throw new Error("日時指定予約を現在受け付けていません。");
  const member = await resolveExactAppointmentMember(env, clinic, request, body);
  if (!member.guardian) throw new Error("LINE連携済みの飼い主情報が見つかりません。診察券画面から開き直してください。");
  return { clinicCode, featureState, clinic, settings, member };
}

async function prepareMultiBookingItems(env, context, rawItems) {
  const items = normalizeMultiBookingItems(rawItems);
  const doctorSettingsRaw = exactDoctorPublicSettings(context.settings);
  const doctorSettings = context.featureState.feature_flags.doctor_selection === true
    ? doctorSettingsRaw
    : { ...doctorSettingsRaw, doctor_booking_enabled: false, doctor_selection_mode: "off", auto_assign_doctor: false };
  const prepared = [];
  for (const item of items) {
    const pet = await resolveExactAppointmentPet(env, context.clinic, context.member.guardian, item.pet_id);
    const service = await getExactAppointmentServiceByInput(env, context.clinic, { service_id: item.service_id });
    let doctorId = doctorSettings.doctor_booking_enabled ? item.doctor_id : "";
    if (doctorSettings.doctor_booking_enabled && doctorSettings.doctor_selection_mode === "required" && !doctorId) {
      throw new Error(`${pet.pet_name || "ペット"}の担当獣医師を選択してください。`);
    }
    prepared.push({ ...item, pet, service, doctor_id: doctorId });
  }
  return { items: prepared, doctorSettings };
}

function evaluateMultiBookingStart(prepared, candidateStart, mode, availabilityByPet) {
  const plans = [];
  let cursor = timeToMinutes(candidateStart);

  for (const item of prepared.items) {
    const availability = availabilityByPet.get(item.pet.id);
    let startTime = candidateStart;
    if (mode === "consecutive") {
      const declaredStarts = Array.from(availability?.slotMap?.keys?.() || [])
        .map((time) => ({ time, minutes: timeToMinutes(time) }))
        .filter((row) => Number.isFinite(row.minutes) && row.minutes >= cursor)
        .sort((a, b) => a.minutes - b.minutes);
      startTime = declaredStarts[0]?.time || minutesToTime(cursor);
    }
    const slot = availability?.slotMap?.get(startTime) || null;
    if (!slot || !slot.available) {
      return {
        available: false,
        reason: `${item.pet.pet_name || "ペット"}：${slot?.reason || availability?.reason || "予約できません"}`,
        start_time: candidateStart,
        items: plans
      };
    }
    plans.push({ ...item, start_time: slot.start_time, end_time: slot.end_time, slot, availability });
    if (mode === "consecutive") cursor = timeToMinutes(slot.end_time);
  }

  // 既存予約に加えて、このグループ内の同時重複数を容量へ加算する。
  for (const plan of plans) {
    const simultaneous = plans.filter((other) => intervalsOverlap(plan, other));
    if (Number(plan.slot.clinic_booked_count || 0) + simultaneous.length > Number(plan.slot.clinic_capacity || 1)) {
      return { available: false, reason: "病院全体の同時予約枠が不足しています。", start_time: candidateStart, items: plans };
    }
    const sameService = simultaneous.filter((other) => other.service.id === plan.service.id);
    if (Number(plan.slot.service_booked_count || 0) + sameService.length > Number(plan.slot.service_capacity || 1)) {
      return { available: false, reason: `${plan.service.service_name || "予約内容"}の同時予約枠が不足しています。`, start_time: candidateStart, items: plans };
    }
  }

  // 獣医師枠を使う場合、重なる予約には異なる獣医師を割り当てられる必要がある。
  if (prepared.doctorSettings.doctor_booking_enabled && plans.some((a, i) => plans.some((b, j) => i !== j && intervalsOverlap(a, b)))) {
    const fixed = plans.filter((p) => p.doctor_id);
    for (let i = 0; i < fixed.length; i++) {
      for (let j = i + 1; j < fixed.length; j++) {
        if (fixed[i].doctor_id === fixed[j].doctor_id && intervalsOverlap(fixed[i], fixed[j])) {
          return { available: false, reason: "同じ獣医師を同時間帯に複数頭へ指定できません。", start_time: candidateStart, items: plans };
        }
      }
    }
    if (!hasDistinctDoctorAssignment(plans)) {
      return { available: false, reason: "同時間帯に担当できる獣医師数が不足しています。", start_time: candidateStart, items: plans };
    }
  }

  return {
    available: true,
    reason: "",
    start_time: candidateStart,
    end_time: plans.reduce(
      (latest, p) => timeToMinutes(p.end_time) > timeToMinutes(latest) ? p.end_time : latest,
      plans[0]?.end_time || candidateStart
    ),
    items: plans
  };
}

async function buildMultiBookingAvailability(env, context, body, options = {}) {
  const mode = normalizeMultiBookingMode(body.booking_mode || body.mode);
  const dateText = cleanString(body.appointment_date || body.date);
  if (!dateText) throw new Error("予約日を選択してください。");

  const prepared = await prepareMultiBookingItems(env, context, body.items);
  for (const item of prepared.items) {
    const intervalBody = { ...body, ...item, vaccine_interval_rule_id: item.vaccine_interval_rule_id, prevention_schedule_id: item.prevention_schedule_id };
    item.vaccine_interval_evaluation = await evaluateVaccineIntervalForAppointment(env, {
      clinic: context.clinic, clinicCode: context.clinicCode, featureState: context.featureState,
      body: intervalBody, pet: item.pet, service: item.service, appointmentDate: dateText, adminMode: false
    });
    if (!item.vaccine_interval_evaluation.allowed) {
      throw new Error(`${item.pet.pet_name || "ペット"}：${item.vaccine_interval_evaluation.message || "この日付では予約できません。"}`);
    }
  }
  const excludeByPet = options.excludeByPet || new Map();
  const excludeAppointmentIds = Array.isArray(options.excludeAppointmentIds)
    ? options.excludeAppointmentIds.map((v) => cleanString(v)).filter(Boolean)
    : [];

  // V1.2-R2:
  // 各候補時刻ごとに exactAppointmentAvailability を再実行すると、
  // 2頭 × 全候補時刻ぶん Supabase subrequest が増え、Cloudflare の実行上限に
  // 到達してブラウザ側が "Failed to fetch" になる可能性がある。
  // ペットごとの空き枠は1回だけ取得し、以降はメモリ上で組み合わせ判定する。
  const availabilityByPet = new Map();
  for (const item of prepared.items) {
    const excludeAppointmentId = cleanString(
      excludeByPet.get(item.pet.id) || item.appointment_id || ""
    );
    const availability = await exactAppointmentAvailability(
      env,
      context.clinic,
      context.settings,
      item.service,
      dateText,
      {
        excludeAppointmentId,
        excludeAppointmentIds,
        petId: item.pet.id,
        doctorId: item.doctor_id
      }
    );
    availabilityByPet.set(item.pet.id, {
      ...availability,
      slotMap: new Map((availability.slots || []).map((slot) => [slot.start_time, slot]))
    });
  }

  const first = prepared.items[0];
  const firstAvailability = availabilityByPet.get(first.pet.id) || { slots: [] };
  const candidateStarts = (firstAvailability.slots || []).map((slot) => slot.start_time);
  const slots = [];

  for (const start of candidateStarts) {
    const evaluated = evaluateMultiBookingStart(prepared, start, mode, availabilityByPet);
    slots.push({
      start_time: start,
      end_time: evaluated.end_time || "",
      available: evaluated.available === true,
      reason: evaluated.reason || "",
      items: (evaluated.items || []).map((p) => ({
        pet_id: p.pet.id,
        pet_name: p.pet.pet_name || "ペット",
        service_id: p.service.id,
        service_name: p.service.service_name || "日時指定予約",
        doctor_id: p.doctor_id || null,
        start_time: p.start_time,
        end_time: p.end_time,
        available_doctor_count: p.slot?.available_doctor_count || 0,
        available_doctors: p.slot?.available_doctors || [],
        vaccine_interval_evaluation: p.vaccine_interval_evaluation || p.availability?.vaccine_interval_evaluation || prepared.items.find((x) => x.pet.id === p.pet.id)?.vaccine_interval_evaluation || null
      }))
    });
  }

  return {
    mode,
    date: dateText,
    prepared,
    slots,
    available: slots.some((s) => s.available),
    min_date: firstAvailability.min_date,
    max_date: firstAvailability.max_date
  };
}

async function handleMemberMultiExactAppointmentAvailability(request, env) {
  const body = await readJson(request);
  const context = await resolveMultiBookingContext(request, env, body);
  const result = await buildMultiBookingAvailability(env, context, body);
  return jsonResponse({
    ok: true,
    worker_version: WORKER_VERSION,
    multi_pet_booking_version: MULTI_PET_BOOKING_VERSION,
    clinic: context.clinic,
    settings: exactAppointmentPublicSettings(context.settings),
    booking_mode: result.mode,
    date: result.date,
    min_date: result.min_date,
    max_date: result.max_date,
    available: result.available,
    reason: result.available ? "" : "選択した複数ペットで予約できる時間がありません。",
    slots: result.slots
  });
}

async function cancelCreatedAppointmentsForRollback(env, appointments, actorName, reason) {
  const results = [];
  for (const appointment of [...appointments].reverse()) {
    if (!appointment?.id) continue;
    try {
      const rows = await supabaseRpc(env, "vet_cancel_exact_appointment", {
        p_appointment_id: appointment.id,
        p_actor_type: "system",
        p_actor_name: actorName,
        p_reason: reason
      });
      await updateRows(env, TABLES.exactAppointments, { id: `eq.${appointment.id}` }, {
        booking_group_id: null,
        booking_group_no: null,
        booking_group_token_hash: null,
        booking_group_order: null,
        booking_group_size: null,
        booking_group_mode: null,
        booking_group_created_at: null,
        prevention_schedule_id: null,
        vaccine_interval_rule_id: null,
        vaccine_interval_result: null,
        vaccine_interval_note: null,
        vaccine_interval_checked_at: null,
        vaccine_interval_override: false,
        vaccine_interval_override_reason: null
      }).catch(() => []);
      results.push({ id: appointment.id, ok: true, row: Array.isArray(rows) ? rows[0] : rows });
    } catch (error) {
      results.push({ id: appointment.id, ok: false, error: error?.message || String(error) });
    }
  }
  return results;
}

async function createPreparedMultiExactAppointment(env, context, availability, plan, input, source = "line") {
  // V1.2-R4: multi-availability で既に検証済みの clinic/member/pet/service/slot を再利用する。
  // createExactAppointmentCore を頭数分呼ぶと、同じ空き枠計算・獣医師計算・会員解決を
  // 再実行してCloudflare subrequest上限へ近づくため、確定RPCだけを実行する。
  const clinic = context.clinic;
  const settings = context.settings;
  const guardian = context.member.guardian;
  const pet = input.pet;
  const service = input.service;
  const requestedDoctorId = cleanString(input.doctor_id || "");
  const doctorSettings = availability.prepared.doctorSettings;
  const bookingToken = createToken("vetapt");
  const bookingTokenHash = await sha256Hex(bookingToken);
  const appointmentNo = buildExactAppointmentNo(availability.date);
  const actorName = guardian.guardian_name || "飼い主";

  const rows = await supabaseRpc(env, "vet_create_exact_appointment_doctor", {
    p_clinic_id: clinic.id,
    p_guardian_id: guardian.id,
    p_pet_id: pet.id,
    p_service_type_id: service.id,
    p_appointment_date: availability.date,
    p_start_time: plan.start_time,
    p_end_time: plan.end_time,
    p_capacity: Number(service.capacity_per_slot || settings.default_capacity || 1),
    p_appointment_no: appointmentNo,
    p_booking_token_hash: bookingTokenHash,
    p_source: source,
    p_guardian_name_snapshot: guardian.guardian_name || "",
    p_pet_name_snapshot: pet.pet_name || "",
    p_phone_snapshot: guardian.phone || "",
    p_line_user_id: context.member.lineUserId || guardian.line_user_id || null,
    p_request_note: cleanString(input.request_note || ""),
    p_internal_note: null,
    p_actor_type: "member",
    p_actor_name: actorName,
    p_is_demo: context.clinicCode === getDemoClinicCode(env),
    p_doctor_id: requestedDoctorId || null,
    p_doctor_assignment_source: requestedDoctorId ? "selected" : "unassigned",
    p_auto_assign_doctor: doctorSettings.auto_assign_doctor === true
  });
  let appointment = Array.isArray(rows) ? rows[0] : rows;
  if (!appointment?.id) throw new Error("予約作成結果を確認できませんでした。");
  const intervalEvaluation = input.vaccine_interval_evaluation || null;
  if (intervalEvaluation?.enabled) {
    try {
      await updateRows(env, TABLES.exactAppointments, { id: `eq.${appointment.id}`, clinic_id: `eq.${clinic.id}` }, vaccineIntervalSnapshot(intervalEvaluation, input));
      appointment = await selectSingle(env, TABLES.exactAppointments, { select: "*", id: `eq.${appointment.id}`, clinic_id: `eq.${clinic.id}` }) || appointment;
    } catch (snapshotError) {
      await logOperation(env, clinic.id, "system", "V1.3接種間隔", "vaccine_interval_snapshot_failed", "exact_appointment", appointment.id, { error: snapshotError?.message || String(snapshotError) }).catch(() => null);
    }
  }

  await logOperation(env, clinic.id, "member", actorName, "exact_appointment_create", "exact_appointment", appointment.id, {
    appointment_no: appointmentNo,
    appointment_date: availability.date,
    start_time: plan.start_time,
    service_name: service.service_name,
    doctor_id: appointment.doctor_id || null,
    doctor_name: appointment.doctor_name_snapshot || null,
    source,
    multi_pet_booking: true
  });
  return { appointment, booking_token: bookingToken };
}

async function handleMemberMultiExactAppointmentCreate(request, env) {
  const body = await readJson(request);
  const context = await resolveMultiBookingContext(request, env, body);
  const availability = await buildMultiBookingAvailability(env, context, body);
  const startTime = normalizeTime(body.start_time || body.time);
  if (!startTime) throw new Error("予約時間を選択してください。");
  const selected = availability.slots.find((slot) => slot.start_time === startTime);
  if (!selected || !selected.available) throw new Error(selected?.reason || "選択した複数ペット予約枠は利用できません。");

  const groupId = crypto.randomUUID ? crypto.randomUUID() : createToken("vetgroup");
  const groupNo = buildMultiBookingGroupNo(availability.date);
  const groupToken = createToken("vetgroup");
  const groupTokenHash = await sha256Hex(groupToken);
  const created = [];
  const actorName = context.member.guardian.guardian_name || "飼い主";
  const source = normalizeIntegratedBookingSource(body.source, "line", false);
  try {
    for (let i = 0; i < selected.items.length; i++) {
      const plan = selected.items[i];
      const input = availability.prepared.items.find((item) => item.pet.id === plan.pet_id);
      if (!input) throw new Error("予約対象ペットの検証済み情報が見つかりません。");
      const result = await createPreparedMultiExactAppointment(env, context, availability, plan, input, source);
      created.push({ ...result.appointment, booking_group_id: groupId, booking_group_no: groupNo, booking_group_order: i + 1, booking_group_size: selected.items.length, booking_group_mode: availability.mode, booking_token: result.booking_token });
      await updateRows(env, TABLES.exactAppointments, { id: `eq.${result.appointment.id}`, clinic_id: `eq.${context.clinic.id}` }, {
        booking_group_id: groupId,
        booking_group_no: groupNo,
        booking_group_token_hash: groupTokenHash,
        booking_group_order: i + 1,
        booking_group_size: selected.items.length,
        booking_group_mode: availability.mode,
        booking_group_created_at: new Date().toISOString()
      });
    }
  } catch (error) {
    const rollback = await cancelCreatedAppointmentsForRollback(env, created, "複数ペット予約ロールバック", "複数ペット予約の途中失敗を自動取消");
    await logOperation(env, context.clinic.id, "system", "複数ペット予約", "multi_exact_appointment_create_rollback", "booking_group", groupId, { group_no: groupNo, error: error?.message || String(error), rollback });
    throw new Error(`複数ペット予約を確定できなかったため、途中登録分を自動取消しました。${error?.message || ""}`);
  }

  const finalized = await selectRows(env, TABLES.exactAppointments, { select: "*", clinic_id: `eq.${context.clinic.id}`, booking_group_id: `eq.${groupId}`, order: "booking_group_order.asc" });
  const enriched = await enrichExactAppointments(env, finalized, context.settings);
  const notifications = [];
  const questionnaireLinks = [];
  for (const appointment of enriched) {
    questionnaireLinks.push(await linkRecentQuestionnaireToAppointment(env, context.clinic, {
      appointment_id: appointment.id, pet_id: appointment.pet_id, pet_name: appointment.pet_name_snapshot || "", appointment_date: appointment.appointment_date, actor_name: actorName
    }));
    notifications.push(await autoNotifyExactAppointmentAction(env, context.clinic, appointment.id, "created", actorName));
  }
  await logOperation(env, context.clinic.id, "member", actorName, "multi_exact_appointment_create", "booking_group", groupId, { group_no: groupNo, mode: availability.mode, count: enriched.length, source, appointment_ids: enriched.map((a) => a.id) });
  return jsonResponse({
    ok: true,
    worker_version: WORKER_VERSION,
    multi_pet_booking_version: MULTI_PET_BOOKING_VERSION,
    source,
    message: `${enriched.length}頭分の予約をまとめて受け付けました。`,
    clinic: context.clinic,
    booking_group: { id: groupId, group_no: groupNo, mode: availability.mode, size: enriched.length, booking_token: groupToken },
    appointments: enriched.map((a) => ({ ...a, booking_token: created.find((c) => c.id === a.id)?.booking_token || "" })),
    questionnaire_links: questionnaireLinks,
    notifications
  });
}

async function findMultiBookingGroupForMember(env, context, body) {
  const groupId = cleanString(body.booking_group_id || body.group_id || "");
  const groupNo = cleanString(body.booking_group_no || body.group_no || "");
  if (!groupId && !groupNo) throw new Error("複数ペット予約グループを指定してください。");
  const query = { select: "*", clinic_id: `eq.${context.clinic.id}`, order: "booking_group_order.asc,appointment_date.asc,start_time.asc" };
  if (groupId) query.booking_group_id = `eq.${groupId}`;
  else query.booking_group_no = `eq.${groupNo}`;
  const rows = await selectRows(env, TABLES.exactAppointments, query);
  if (!rows.length) throw new Error("複数ペット予約グループが見つかりません。");
  const guardianOwns = rows.every((row) => cleanString(row.guardian_id) === cleanString(context.member.guardian.id));
  if (!guardianOwns) throw new Error("この複数ペット予約を操作する権限がありません。");
  return rows;
}

async function handleMemberMultiExactAppointmentChange(request, env) {
  const body = await readJson(request);
  const context = await resolveMultiBookingContext(request, env, body);
  if (context.settings.allow_member_change !== true) throw new Error("予約変更は病院へ直接ご連絡ください。");
  const currentRows = await findMultiBookingGroupForMember(env, context, body);
  const activeRows = currentRows.filter((row) => ["scheduled", "confirmed"].includes(row.status));
  if (activeRows.length < 2) throw new Error("まとめて変更できる予約が2頭分以上ありません。");
  if (activeRows.some((row) => !exactAppointmentDeadlineOk(row, context.settings.change_deadline_hours))) throw new Error("LINEから変更できる期限を過ぎた予約が含まれています。病院へ直接ご連絡ください。");

  const requestedItems = normalizeMultiBookingItems(body.items);
  const currentByPet = new Map(activeRows.map((row) => [cleanString(row.pet_id), row]));
  if (requestedItems.length !== activeRows.length || requestedItems.some((item) => !currentByPet.has(item.pet_id))) {
    throw new Error("まとめて変更では、現在の予約グループと同じペットをすべて指定してください。1頭だけ変更する場合は通常の変更を使用してください。");
  }
  body.items = requestedItems.map((item) => ({ ...item, appointment_id: currentByPet.get(item.pet_id).id }));
  const excludeByPet = new Map(activeRows.map((row) => [cleanString(row.pet_id), cleanString(row.id)]));
  const availability = await buildMultiBookingAvailability(env, context, body, { excludeByPet, excludeAppointmentIds: activeRows.map((row) => row.id) });
  const startTime = normalizeTime(body.start_time || body.time);
  const selected = availability.slots.find((slot) => slot.start_time === startTime);
  if (!selected || !selected.available) throw new Error(selected?.reason || "選択した変更先は利用できません。");

  const changed = [];
  const actorName = context.member.guardian.guardian_name || "飼い主";
  try {
    for (const plan of selected.items) {
      const old = currentByPet.get(plan.pet_id);
      const input = availability.prepared.items.find((item) => item.pet.id === plan.pet_id);
      const doctorSettings = exactDoctorPublicSettings(context.settings);
      const rows = await supabaseRpc(env, "vet_change_exact_appointment_doctor", {
        p_appointment_id: old.id,
        p_new_service_type_id: plan.service_id,
        p_new_appointment_date: availability.date,
        p_new_start_time: plan.start_time,
        p_new_end_time: plan.end_time,
        p_capacity: Number(input.service.capacity_per_slot || context.settings.default_capacity || 1),
        p_request_note: input.request_note || null,
        p_actor_type: "member",
        p_actor_name: actorName,
        p_reason: cleanString(body.reason || "LINEから複数ペット予約をまとめて変更"),
        p_new_doctor_id: input.doctor_id || null,
        p_doctor_assignment_source: input.doctor_id ? "selected" : "unassigned",
        p_auto_assign_doctor: doctorSettings.auto_assign_doctor === true
      });
      let changedRow = Array.isArray(rows) ? rows[0] : rows;
      if (input.vaccine_interval_evaluation?.enabled && changedRow?.id) {
        try {
          await updateRows(env, TABLES.exactAppointments, { id: `eq.${changedRow.id}`, clinic_id: `eq.${context.clinic.id}` }, vaccineIntervalSnapshot(input.vaccine_interval_evaluation, input));
          changedRow = await selectSingle(env, TABLES.exactAppointments, { select: "*", id: `eq.${changedRow.id}`, clinic_id: `eq.${context.clinic.id}` }) || changedRow;
        } catch (snapshotError) {
          await logOperation(env, context.clinic.id, "system", "V1.3接種間隔", "vaccine_interval_snapshot_failed", "exact_appointment", changedRow.id, { error: snapshotError?.message || String(snapshotError) }).catch(() => null);
        }
      }
      changed.push({ old, row: changedRow });
    }
    for (const entry of changed) {
      await updateRows(env, TABLES.exactAppointments, { id: `eq.${entry.old.id}`, clinic_id: `eq.${context.clinic.id}` }, {
        booking_group_mode: availability.mode,
        booking_group_size: activeRows.length
      });
    }
  } catch (error) {
    const rollback = [];
    for (const entry of [...changed].reverse()) {
      try {
        const oldService = await getExactAppointmentServiceByInput(env, context.clinic, { service_id: entry.old.service_type_id }, false);
        const rows = await supabaseRpc(env, "vet_change_exact_appointment_doctor", {
          p_appointment_id: entry.old.id,
          p_new_service_type_id: entry.old.service_type_id,
          p_new_appointment_date: entry.old.appointment_date,
          p_new_start_time: normalizeTime(entry.old.start_time),
          p_new_end_time: normalizeTime(entry.old.end_time),
          p_capacity: Number(oldService.capacity_per_slot || context.settings.default_capacity || 1),
          p_request_note: entry.old.request_note || null,
          p_actor_type: "system",
          p_actor_name: "複数ペット予約ロールバック",
          p_reason: "まとめて変更の途中失敗を元へ戻す",
          p_new_doctor_id: entry.old.doctor_id || null,
          p_doctor_assignment_source: entry.old.doctor_id ? "selected" : "unassigned",
          p_auto_assign_doctor: false
        });
        await updateRows(env, TABLES.exactAppointments, { id: `eq.${entry.old.id}`, clinic_id: `eq.${context.clinic.id}` }, {
          booking_group_mode: entry.old.booking_group_mode || "consecutive",
          booking_group_size: entry.old.booking_group_size || activeRows.length,
          prevention_schedule_id: entry.old.prevention_schedule_id || null,
          vaccine_interval_rule_id: entry.old.vaccine_interval_rule_id || null,
          vaccine_interval_result: entry.old.vaccine_interval_result || null,
          vaccine_interval_note: entry.old.vaccine_interval_note || null,
          vaccine_interval_checked_at: entry.old.vaccine_interval_checked_at || null,
          vaccine_interval_override: entry.old.vaccine_interval_override === true,
          vaccine_interval_override_reason: entry.old.vaccine_interval_override_reason || null
        }).catch(() => []);
        rollback.push({ id: entry.old.id, ok: true, row: Array.isArray(rows) ? rows[0] : rows });
      } catch (rollbackError) {
        rollback.push({ id: entry.old.id, ok: false, error: rollbackError?.message || String(rollbackError) });
      }
    }
    await logOperation(env, context.clinic.id, "system", "複数ペット予約", "multi_exact_appointment_change_rollback", "booking_group", currentRows[0].booking_group_id || null, { error: error?.message || String(error), rollback });
    throw new Error(`まとめて変更を完了できなかったため、変更済み分を元へ戻しました。${error?.message || ""}`);
  }

  const refreshed = await selectRows(env, TABLES.exactAppointments, { select: "*", clinic_id: `eq.${context.clinic.id}`, booking_group_id: `eq.${currentRows[0].booking_group_id}`, order: "booking_group_order.asc" });
  const enriched = await enrichExactAppointments(env, refreshed, context.settings);
  const notifications = [];
  for (const appointment of enriched.filter((a) => ["scheduled", "confirmed"].includes(a.status))) {
    notifications.push(await autoNotifyExactAppointmentAction(env, context.clinic, appointment.id, "changed", actorName));
  }
  await logOperation(env, context.clinic.id, "member", actorName, "multi_exact_appointment_change", "booking_group", currentRows[0].booking_group_id || null, { group_no: currentRows[0].booking_group_no || "", mode: availability.mode, count: changed.length });
  return jsonResponse({ ok: true, worker_version: WORKER_VERSION, multi_pet_booking_version: MULTI_PET_BOOKING_VERSION, message: `${changed.length}頭分の予約をまとめて変更しました。`, booking_group: { id: currentRows[0].booking_group_id, group_no: currentRows[0].booking_group_no, mode: availability.mode, size: changed.length }, appointments: enriched, notifications });
}

async function handleMemberMultiExactAppointmentCancel(request, env) {
  const body = await readJson(request);
  const context = await resolveMultiBookingContext(request, env, body);
  if (context.settings.allow_member_cancel !== true) throw new Error("予約キャンセルは病院へ直接ご連絡ください。");
  const currentRows = await findMultiBookingGroupForMember(env, context, body);
  const activeRows = currentRows.filter((row) => ["scheduled", "confirmed"].includes(row.status));
  if (!activeRows.length) throw new Error("キャンセルできる予約がありません。");
  if (activeRows.some((row) => !exactAppointmentDeadlineOk(row, context.settings.cancel_deadline_hours))) throw new Error("LINEからキャンセルできる期限を過ぎた予約が含まれています。病院へ直接ご連絡ください。");
  const actorName = context.member.guardian.guardian_name || "飼い主";
  const reason = cleanString(body.reason || "飼い主都合（複数ペットまとめて取消）");
  const cancelled = [];
  try {
    for (const appointment of activeRows) {
      const rows = await supabaseRpc(env, "vet_cancel_exact_appointment", {
        p_appointment_id: appointment.id,
        p_actor_type: "member",
        p_actor_name: actorName,
        p_reason: reason
      });
      cancelled.push({ old: appointment, row: Array.isArray(rows) ? rows[0] : rows });
    }
  } catch (error) {
    const rollback = [];
    for (const entry of [...cancelled].reverse()) {
      try {
        const rows = await supabaseRpc(env, "vet_update_exact_appointment_status", {
          p_appointment_id: entry.old.id,
          p_new_status: entry.old.status,
          p_actor_type: "system",
          p_actor_name: "複数ペット予約ロールバック",
          p_reason: "まとめてキャンセルの途中失敗を元へ戻す"
        });
        rollback.push({ id: entry.old.id, ok: true, row: Array.isArray(rows) ? rows[0] : rows });
      } catch (rollbackError) {
        rollback.push({ id: entry.old.id, ok: false, error: rollbackError?.message || String(rollbackError) });
      }
    }
    await logOperation(env, context.clinic.id, "system", "複数ペット予約", "multi_exact_appointment_cancel_rollback", "booking_group", currentRows[0].booking_group_id || null, { error: error?.message || String(error), rollback });
    throw new Error(`まとめてキャンセルを完了できなかったため、取消済み分を元へ戻しました。${error?.message || ""}`);
  }

  const notifications = [];
  for (const entry of cancelled) notifications.push(await autoNotifyExactAppointmentAction(env, context.clinic, entry.old.id, "cancelled", actorName));
  const refreshed = await selectRows(env, TABLES.exactAppointments, { select: "*", clinic_id: `eq.${context.clinic.id}`, booking_group_id: `eq.${currentRows[0].booking_group_id}`, order: "booking_group_order.asc" });
  const enriched = await enrichExactAppointments(env, refreshed, context.settings);
  await logOperation(env, context.clinic.id, "member", actorName, "multi_exact_appointment_cancel", "booking_group", currentRows[0].booking_group_id || null, { group_no: currentRows[0].booking_group_no || "", count: cancelled.length, reason });
  return jsonResponse({ ok: true, worker_version: WORKER_VERSION, multi_pet_booking_version: MULTI_PET_BOOKING_VERSION, message: `${cancelled.length}頭分の予約をまとめてキャンセルしました。`, appointments: enriched, notifications });
}

async function handleAdminExactAppointmentSettingsGet(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const clinic = await getClinicByCode(env, clinicCode);
  const settings = await getExactAppointmentSettings(env, clinic, { createIfMissing: true });
  return jsonResponse({ ok: true, worker_version: WORKER_VERSION, clinic, settings });
}

async function handleAdminExactAppointmentSettingsSave(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const current = await getExactAppointmentSettings(env, clinic, { createIfMissing: true });
  const next = validateExactAppointmentSettingsInput(body, current);
  const payload = {
    clinic_id: clinic.id,
    exact_time_booking_enabled: next.exact_time_booking_enabled,
    slot_minutes: next.slot_minutes,
    same_day_booking_enabled: next.same_day_booking_enabled,
    min_days_ahead: next.min_days_ahead,
    max_days_ahead: next.max_days_ahead,
    booking_lead_minutes: next.booking_lead_minutes,
    default_capacity: next.default_capacity,
    allow_member_change: next.allow_member_change,
    allow_member_cancel: next.allow_member_cancel,
    doctor_booking_enabled: next.doctor_booking_enabled,
    doctor_selection_mode: next.doctor_selection_mode,
    auto_assign_doctor: next.auto_assign_doctor,
    allow_member_doctor_change: next.allow_member_doctor_change,
    doctor_feature_version: DOCTOR_SLOT_FEATURE_VERSION,
    change_deadline_hours: next.change_deadline_hours,
    cancel_deadline_hours: next.cancel_deadline_hours,
    public_note: next.public_note,
    owner_note: next.owner_note,
    status: next.status,
    is_demo: clinicCode === getDemoClinicCode(env)
  };
  const rows = await upsertRows(env, TABLES.exactAppointmentSettings, payload, "clinic_id");
  await logOperation(env, clinic.id, "owner", cleanString(body.staff_name) || "管理画面", "exact_appointment_settings_save", "clinic", clinic.id, payload);
  return jsonResponse({ ok: true, worker_version: WORKER_VERSION, message: "日時指定予約の設定を保存しました。", clinic, settings: Array.isArray(rows) ? rows[0] : rows });
}

async function handleAdminExactAppointmentServicesGet(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const clinic = await getClinicByCode(env, clinicCode);
  const settings = await getExactAppointmentSettings(env, clinic, { createIfMissing: true });
  return jsonResponse({ ok: true, worker_version: WORKER_VERSION, clinic, settings, services: await getExactAppointmentServices(env, clinic.id, false) });
}

async function handleAdminExactAppointmentServiceSave(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const serviceId = cleanString(body.id || body.service_id);
  const serviceCode = cleanString(body.service_code).replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  const serviceName = cleanString(body.service_name);
  if (!serviceCode || !serviceName) throw new Error("サービスコードと予約内容名を入力してください。");
  const duration = Number(body.duration_minutes || 30);
  if (!Number.isInteger(duration) || duration < 5 || duration > 240 || duration % 5 !== 0) throw new Error("所要時間は5〜240分の5分単位で指定してください。");
  const capacity = Number(body.capacity_per_slot || 1);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) throw new Error("1枠の受付可能件数は1〜20件で指定してください。");
  const payload = {
    clinic_id: clinic.id,
    service_code: serviceCode,
    service_name: serviceName,
    category: cleanString(body.category || "recheck"),
    description: cleanString(body.description),
    duration_minutes: duration,
    capacity_per_slot: capacity,
    allow_new_patient: toBool(body.allow_new_patient, false),
    allow_existing_patient: toBool(body.allow_existing_patient, true),
    is_active: body.is_active === undefined ? true : toBool(body.is_active, true),
    sort_order: Math.max(0, Number(body.sort_order || 10)),
    is_demo: clinicCode === getDemoClinicCode(env)
  };
  let rows;
  if (serviceId) rows = await updateRows(env, TABLES.exactAppointmentServices, { id: `eq.${serviceId}`, clinic_id: `eq.${clinic.id}` }, payload);
  else rows = await upsertRows(env, TABLES.exactAppointmentServices, payload, "clinic_id,service_code");
  const saved = Array.isArray(rows) ? rows[0] : rows;
  await logOperation(env, clinic.id, "owner", cleanString(body.staff_name) || "管理画面", "exact_appointment_service_save", "exact_appointment_service", saved?.id || serviceId || null, { service_code: serviceCode, service_name: serviceName });
  return jsonResponse({ ok: true, worker_version: WORKER_VERSION, message: "予約内容を保存しました。", service: saved, services: await getExactAppointmentServices(env, clinic.id, false) });
}

async function handleAdminExactAppointmentServiceArchive(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const serviceId = cleanString(body.id || body.service_id);
  if (!serviceId) throw new Error("予約内容IDがありません。");
  const rows = await updateRows(env, TABLES.exactAppointmentServices, { id: `eq.${serviceId}`, clinic_id: `eq.${clinic.id}` }, { is_active: false });
  return jsonResponse({ ok: true, worker_version: WORKER_VERSION, message: "予約内容を非表示にしました。", service: Array.isArray(rows) ? rows[0] : rows, services: await getExactAppointmentServices(env, clinic.id, false) });
}

async function handleAdminExactAppointmentList(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const clinic = await getClinicByCode(env, clinicCode);
  const settings = await getExactAppointmentSettings(env, clinic, { createIfMissing: true });
  const from = cleanString(getParam(request, "from", todayJST()));
  const to = cleanString(getParam(request, "to", addDays(from, 30)));
  const status = cleanString(getParam(request, "status", ""));
  const query = {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    and: `(appointment_date.gte.${from},appointment_date.lte.${to})`,
    order: "appointment_date.asc,start_time.asc",
    limit: normalizeLimit(getParam(request, "limit", "200"), 200, 500)
  };
  if (status) query.status = `eq.${normalizeExactAppointmentStatus(status)}`;
  const rows = await selectRows(env, TABLES.exactAppointments, query);
  const enriched = await enrichExactAppointments(env, rows, settings);
  const appointments = enriched.map((row) => row.has_web_questionnaire ? {
    ...row,
    service_name_raw: row.service_name,
    service_name: `${row.service_name || "日時指定予約"}｜WEB問診あり`
  } : row);
  return jsonResponse({ ok: true, worker_version: WORKER_VERSION, clinic, settings, from, to, appointments, questionnaire_visit_link_version: QUESTIONNAIRE_VISIT_LINK_VERSION });
}

async function handleAdminExactAppointmentCreate(request, env) {
  const body = await readJson(request);
  const result = await createExactAppointmentCore(request, env, body, true);
  return jsonResponse({ ok: true, worker_version: WORKER_VERSION, message: "スタッフ受付で日時指定予約を登録しました。", ...result });
}

async function handleAdminExactAppointmentStatus(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const appointmentId = cleanString(body.appointment_id || body.id);
  if (!appointmentId) throw new Error("予約IDがありません。");
  const current = await selectSingle(env, TABLES.exactAppointments, { select: "*", clinic_id: `eq.${clinic.id}`, id: `eq.${appointmentId}` });
  if (!current) throw new Error("予約が見つかりません。");
  const status = normalizeExactAppointmentStatus(body.status);
  const actorName = cleanString(body.staff_name) || "管理画面";
  const rows = await supabaseRpc(env, "vet_update_exact_appointment_status", {
    p_appointment_id: appointmentId,
    p_new_status: status,
    p_actor_type: "owner",
    p_actor_name: actorName,
    p_reason: cleanString(body.reason)
  });
  const settings = await getExactAppointmentSettings(env, clinic, { createIfMissing: true });
  const appointment = (await enrichExactAppointments(env, [Array.isArray(rows) ? rows[0] : rows], settings))[0];
  await logOperation(env, clinic.id, "owner", actorName, "exact_appointment_status", "exact_appointment", appointmentId, { old_status: current.status, new_status: status });
  return jsonResponse({ ok: true, worker_version: WORKER_VERSION, message: "予約ステータスを更新しました。", appointment });
}



function exactAppointmentQueueSyncStatus(queueStatus) {
  const status = normalizeQueueStatus(queueStatus || "", "");
  if (["completed"].includes(status)) return "completed";
  if (["cancelled"].includes(status)) return "cancelled";
  if (["no_show"].includes(status)) return "no_show";
  if (["waiting", "reserved", "checked_in", "examining", "accounting", "payment_waiting"].includes(status)) return "checked_in";
  return "";
}

async function syncLinkedExactAppointmentFromQueue(env, waitingEntryId, queueStatus, actorName = "受付連動") {
  if (!waitingEntryId) return null;
  let exact = null;
  try {
    exact = await selectSingle(env, TABLES.exactAppointments, {
      select: "*",
      waiting_entry_id: `eq.${waitingEntryId}`
    });
  } catch (error) {
    // STEP VET-APPOINTMENT-CHECKIN-1 SQL未実行の場合は、既存の順番受付更新を止めない。
    return { ok: false, skipped: true, reason: "waiting_entry_id_column_unavailable" };
  }
  if (!exact) return { ok: true, skipped: true, reason: "not_linked" };

  const nextStatus = exactAppointmentQueueSyncStatus(queueStatus);
  if (!nextStatus || exact.status === nextStatus) {
    return { ok: true, skipped: true, appointment_id: exact.id, status: exact.status };
  }
  if (["cancelled", "completed", "no_show"].includes(exact.status) && exact.status !== nextStatus) {
    return { ok: true, skipped: true, appointment_id: exact.id, status: exact.status, reason: "terminal_status" };
  }

  try {
    const rows = await supabaseRpc(env, "vet_update_exact_appointment_status", {
      p_appointment_id: exact.id,
      p_new_status: nextStatus,
      p_actor_type: "system",
      p_actor_name: actorName,
      p_reason: `順番受付ステータス連動: ${queueStatus}`
    });
    return {
      ok: true,
      skipped: false,
      appointment_id: exact.id,
      old_status: exact.status,
      new_status: nextStatus,
      row: Array.isArray(rows) ? rows[0] : rows
    };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      appointment_id: exact.id,
      old_status: exact.status,
      new_status: nextStatus,
      error: error?.message || "exact appointment sync failed"
    };
  }
}

async function handleAdminExactAppointmentCheckIn(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const appointmentId = cleanString(body.appointment_id || body.id);
  const actorName = cleanString(body.staff_name) || "受付";
  if (!appointmentId) return errorResponse("予約IDがありません。", 400);

  const current = await selectSingle(env, TABLES.exactAppointments, {
    select: "*",
    clinic_id: `eq.${clinic.id}`,
    id: `eq.${appointmentId}`
  });
  if (!current) return errorResponse("日時指定予約が見つかりません。", 404);

  const today = todayJST();
  if (cleanString(current.appointment_date) !== today) {
    return errorResponse("来院受付できるのは本日の日時指定予約だけです。", 400, {
      appointment_date: current.appointment_date,
      today
    });
  }
  if (["cancelled", "completed", "no_show"].includes(current.status)) {
    return errorResponse("この予約は来院受付できる状態ではありません。", 409, {
      appointment_status: current.status
    });
  }

  if (current.waiting_entry_id) {
    const linked = await selectSingle(env, TABLES.waitingEntriesDetailView, {
      select: "*",
      waiting_entry_id: `eq.${current.waiting_entry_id}`
    });
    if (linked) {
      if (current.status !== "checked_in") {
        try {
          await supabaseRpc(env, "vet_update_exact_appointment_status", {
            p_appointment_id: current.id,
            p_new_status: "checked_in",
            p_actor_type: "staff",
            p_actor_name: actorName,
            p_reason: "既存の順番受付との紐付けを確認"
          });
        } catch {}
      }
      const questionnaireWaitingLink = await linkRecentQuestionnaireToWaitingEntry(env, clinic, {
        waiting_entry_id: current.waiting_entry_id, pet_id: current.pet_id, pet_name: current.pet_name_snapshot || linked.pet_name || "", target_date: today, actor_name: actorName
      });
      const questionnaireAppointmentLink = await linkRecentQuestionnaireToAppointment(env, clinic, {
        appointment_id: current.id, pet_id: current.pet_id, pet_name: current.pet_name_snapshot || linked.pet_name || "", appointment_date: current.appointment_date, actor_name: actorName
      });
      const questionnaireLink = { waiting: questionnaireWaitingLink, appointment: questionnaireAppointmentLink };
      const settings = await getExactAppointmentSettings(env, clinic, { createIfMissing: true });
      const latest = await selectSingle(env, TABLES.exactAppointments, {
        select: "*", clinic_id: `eq.${clinic.id}`, id: `eq.${appointmentId}`
      });
      return jsonResponse({
        ok: true,
        worker_version: WORKER_VERSION,
        feature_version: APPOINTMENT_CHECKIN_FEATURE_VERSION,
        duplicate: true,
        message: "この予約はすでに来院受付済みです。",
        appointment: (await enrichExactAppointments(env, [latest], settings))[0],
        waiting_entry: linked,
        questionnaire_link: questionnaireLink,
        questionnaire_visit_link_version: QUESTIONNAIRE_VISIT_LINK_VERSION
      });
    }
  }

  const guardian = current.guardian_id ? await getGuardianById(env, current.guardian_id) : null;
  const pet = current.pet_id ? await getPetById(env, current.pet_id) : null;
  if (!guardian || !pet) return errorResponse("予約に紐づく飼い主・ペット情報を確認できません。", 409);

  let card = null;
  try {
    card = await selectSingle(env, TABLES.petCardView, { select: "*", clinic_id: `eq.${clinic.id}`, pet_id: `eq.${pet.id}` });
  } catch {
    card = await getCardByPetId(env, pet.id);
  }
  const service = current.service_type_id ? await selectSingle(env, TABLES.exactAppointmentServices, {
    select: "*", clinic_id: `eq.${clinic.id}`, id: `eq.${current.service_type_id}`
  }) : null;

  const startText = String(current.start_time || "").slice(0, 5);
  const dayPart = timeToMinutes(startText || "09:00") < 13 * 60 ? "morning" : "afternoon";
  const requestCategory = normalizeQueueRequestCategory(service?.category || "general_exam", "general_exam");
  const doctorName = cleanString(current.doctor_name_snapshot) || "";
  const purposeText = ["日時指定予約", startText ? `${startText}予約` : "", cleanString(service?.service_name), doctorName ? `担当 ${doctorName}` : ""].filter(Boolean).join("｜");
  const memoText = [current.appointment_no ? `予約番号 ${current.appointment_no}` : "", cleanString(current.request_note)].filter(Boolean).join(" / ");

  const created = await createReceptionForExistingPetCore(env, clinic, guardian, pet, card, {
    reception_source: "counter",
    source_label_prefix: "日時予約来院",
    target_date: today,
    day_part: dayPart,
    request_category: requestCategory,
    entry_kind: "today_queue",
    visit_time: startText,
    purpose: purposeText,
    memo: memoText
  });

  const waitingEntryId = cleanString(created?.entry?.waiting_entry_id) || cleanString(created?.entry?.id) || cleanString(created?.result?.waiting_entry_id) || cleanString(created?.result?.id);
  if (!waitingEntryId) return errorResponse("順番受付は作成されましたが、受付IDを確認できませんでした。", 500, { result: created });

  if (current.status !== "checked_in") {
    await supabaseRpc(env, "vet_update_exact_appointment_status", {
      p_appointment_id: current.id,
      p_new_status: "checked_in",
      p_actor_type: "staff",
      p_actor_name: actorName,
      p_reason: created?.duplicate ? "既存の本日受付へ日時予約を紐付け" : "日時指定予約から来院受付"
    });
  }

  await updateRows(env, TABLES.exactAppointments, { id: `eq.${current.id}`, clinic_id: `eq.${clinic.id}` }, {
    waiting_entry_id: waitingEntryId,
    queue_linked_at: new Date().toISOString()
  });

  const questionnaireWaitingLink = await linkRecentQuestionnaireToWaitingEntry(env, clinic, {
    waiting_entry_id: waitingEntryId, pet_id: current.pet_id, pet_name: current.pet_name_snapshot || pet.pet_name || "", target_date: today, actor_name: actorName
  });
  const questionnaireAppointmentLink = await linkRecentQuestionnaireToAppointment(env, clinic, {
    appointment_id: current.id, pet_id: current.pet_id, pet_name: current.pet_name_snapshot || pet.pet_name || "", appointment_date: current.appointment_date, actor_name: actorName
  });
  const latest = await selectSingle(env, TABLES.exactAppointments, { select: "*", clinic_id: `eq.${clinic.id}`, id: `eq.${current.id}` });
  const waitingEntry = await selectSingle(env, TABLES.waitingEntriesDetailView, { select: "*", waiting_entry_id: `eq.${waitingEntryId}` });
  const settings = await getExactAppointmentSettings(env, clinic, { createIfMissing: true });

  await logOperation(env, clinic.id, "staff", actorName, "exact_appointment_check_in", "exact_appointment", current.id, {
    appointment_no: current.appointment_no,
    waiting_entry_id: waitingEntryId,
    queue_duplicate_reused: Boolean(created?.duplicate),
    doctor_name: doctorName || null,
    feature_version: APPOINTMENT_CHECKIN_FEATURE_VERSION
  });

  return jsonResponse({
    ok: true,
    worker_version: WORKER_VERSION,
    feature_version: APPOINTMENT_CHECKIN_FEATURE_VERSION,
    duplicate: Boolean(created?.duplicate),
    message: created?.duplicate ? "既存の本日受付へ日時指定予約を紐付け、来院受付にしました。" : "日時指定予約を本日の順番受付へ追加し、来院受付にしました。",
    appointment: (await enrichExactAppointments(env, [latest], settings))[0],
    waiting_entry: waitingEntry,
    queue_result: created,
    questionnaire_link: { waiting: questionnaireWaitingLink, appointment: questionnaireAppointmentLink },
    questionnaire_visit_link_version: QUESTIONNAIRE_VISIT_LINK_VERSION
  });
}



async function handleAdminExactAppointmentDoctorsGet(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const clinic = await getClinicByCode(env, clinicCode);
  const [settings, doctors, mappings, hours, blocks] = await Promise.all([
    getExactAppointmentSettings(env, clinic, { createIfMissing: true }),
    getExactAppointmentDoctors(env, clinic.id, false),
    getExactAppointmentDoctorServices(env, clinic.id),
    getExactAppointmentDoctorHours(env, clinic.id),
    getExactAppointmentDoctorBlocks(env, clinic.id, { from: todayJST(), activeOnly: false })
  ]);
  const byDoctorServices = new Map();
  for (const row of mappings.filter((x) => x.is_active !== false)) {
    if (!byDoctorServices.has(row.doctor_id)) byDoctorServices.set(row.doctor_id, []);
    byDoctorServices.get(row.doctor_id).push(row.service_type_id);
  }
  const byDoctorHours = new Map();
  for (const row of hours) {
    if (!byDoctorHours.has(row.doctor_id)) byDoctorHours.set(row.doctor_id, []);
    byDoctorHours.get(row.doctor_id).push(row);
  }
  const byDoctorBlocks = new Map();
  for (const row of blocks) {
    if (!byDoctorBlocks.has(row.doctor_id)) byDoctorBlocks.set(row.doctor_id, []);
    byDoctorBlocks.get(row.doctor_id).push(row);
  }
  return jsonResponse({
    ok: true,
    worker_version: WORKER_VERSION,
    clinic,
    settings: exactAppointmentPublicSettings(settings),
    doctors: doctors.map((row) => ({ ...normalizeExactAppointmentDoctor(row, byDoctorServices.get(row.id) || []), hours: byDoctorHours.get(row.id) || [], blocks: byDoctorBlocks.get(row.id) || [] }))
  });
}

async function handleAdminExactAppointmentDoctorSave(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const id = cleanString(body.id);
  const doctorCode = cleanString(body.doctor_code || body.code).toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const doctorName = cleanString(body.doctor_name || body.name);
  const displayName = cleanString(body.display_name || body.doctor_name || body.name);
  if (!doctorCode || !doctorName || !displayName) throw new Error("獣医師コード・氏名・表示名を入力してください。");
  const payload = {
    clinic_id: clinic.id,
    doctor_code: doctorCode,
    doctor_name: doctorName,
    display_name: displayName,
    description: cleanString(body.description),
    accepts_new_patient: toBool(body.accepts_new_patient, true),
    accepts_existing_patient: toBool(body.accepts_existing_patient, true),
    sort_order: Math.max(0, Number(body.sort_order || 10)),
    is_active: toBool(body.is_active, true),
    is_demo: clinicCode === getDemoClinicCode(env)
  };
  let rows;
  if (id) rows = await updateRows(env, TABLES.exactAppointmentDoctors, { id: `eq.${id}`, clinic_id: `eq.${clinic.id}` }, payload);
  else rows = await upsertRows(env, TABLES.exactAppointmentDoctors, payload, "clinic_id,doctor_code");
  const doctor = Array.isArray(rows) ? rows[0] : rows;
  if (!doctor?.id) throw new Error("獣医師情報を保存できませんでした。");

  if (Array.isArray(body.service_ids)) {
    await deleteRows(env, TABLES.exactAppointmentDoctorServices, { clinic_id: `eq.${clinic.id}`, doctor_id: `eq.${doctor.id}` });
    const serviceIds = Array.from(new Set(body.service_ids.map(cleanString).filter(Boolean)));
    if (serviceIds.length) {
      await insertRows(env, TABLES.exactAppointmentDoctorServices, serviceIds.map((serviceId) => ({ clinic_id: clinic.id, doctor_id: doctor.id, service_type_id: serviceId, is_active: true })));
    }
  }
  await logOperation(env, clinic.id, "staff", cleanString(body.staff_name) || "管理画面", "exact_doctor_save", "exact_appointment_doctor", doctor.id, { doctor_code: doctorCode, display_name: displayName });
  return handleAdminExactAppointmentDoctorsGet(new Request(`${new URL(request.url).origin}/api/admin/exact-appointments/doctors?clinic_code=${encodeURIComponent(clinicCode)}`, { headers: request.headers }), env);
}

async function handleAdminExactAppointmentDoctorArchive(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const doctorId = cleanString(body.doctor_id || body.id);
  if (!doctorId) throw new Error("獣医師を選択してください。");
  const rows = await updateRows(env, TABLES.exactAppointmentDoctors, { id: `eq.${doctorId}`, clinic_id: `eq.${clinic.id}` }, { is_active: false });
  return jsonResponse({ ok: true, worker_version: WORKER_VERSION, message: "獣医師を予約画面から非表示にしました。", doctor: Array.isArray(rows) ? rows[0] : rows });
}

async function handleAdminExactAppointmentDoctorScheduleSave(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const doctorId = cleanString(body.doctor_id);
  if (!doctorId) throw new Error("獣医師を選択してください。");
  const doctor = await selectSingle(env, TABLES.exactAppointmentDoctors, { select: "*", clinic_id: `eq.${clinic.id}`, id: `eq.${doctorId}` });
  if (!doctor) throw new Error("獣医師が見つかりません。");
  const periods = Array.isArray(body.periods) ? body.periods : [];
  const normalized = periods.map((row) => ({
    clinic_id: clinic.id,
    doctor_id: doctorId,
    weekday: Number(row.weekday),
    period_no: Number(row.period_no || 1),
    open_time: normalizeTime(row.open_time),
    close_time: normalizeTime(row.close_time),
    is_active: row.is_active !== false
  })).filter((row) => Number.isInteger(row.weekday) && row.weekday >= 0 && row.weekday <= 6 && Number.isInteger(row.period_no) && row.period_no >= 1 && row.period_no <= 6 && row.open_time && row.close_time && timeToMinutes(row.close_time) > timeToMinutes(row.open_time));
  await deleteRows(env, TABLES.exactAppointmentDoctorHours, { clinic_id: `eq.${clinic.id}`, doctor_id: `eq.${doctorId}` });
  if (normalized.length) await insertRows(env, TABLES.exactAppointmentDoctorHours, normalized);
  return jsonResponse({ ok: true, worker_version: WORKER_VERSION, message: "獣医師の勤務時間を保存しました。", hours: await getExactAppointmentDoctorHours(env, clinic.id, doctorId) });
}

async function handleAdminExactAppointmentDoctorBlockSave(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const doctorId = cleanString(body.doctor_id);
  const blockDate = cleanString(body.block_date || body.date);
  if (!doctorId || !blockDate) throw new Error("獣医師と休止日を選択してください。");
  parseDateText(blockDate);
  const allDay = toBool(body.all_day, false);
  const startTime = allDay ? null : normalizeTime(body.start_time);
  const endTime = allDay ? null : normalizeTime(body.end_time);
  if (!allDay && (!startTime || !endTime || timeToMinutes(endTime) <= timeToMinutes(startTime))) throw new Error("休止時間を正しく入力してください。");
  const rows = await insertRows(env, TABLES.exactAppointmentDoctorBlocks, {
    clinic_id: clinic.id, doctor_id: doctorId, block_date: blockDate, all_day: allDay,
    start_time: startTime, end_time: endTime, reason: cleanString(body.reason), is_active: true
  });
  return jsonResponse({ ok: true, worker_version: WORKER_VERSION, message: "休止枠を追加しました。", block: Array.isArray(rows) ? rows[0] : rows });
}

async function handleAdminExactAppointmentDoctorBlockDelete(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const blockId = cleanString(body.block_id || body.id);
  if (!blockId) throw new Error("削除する休止枠を選択してください。");
  await deleteRows(env, TABLES.exactAppointmentDoctorBlocks, { id: `eq.${blockId}`, clinic_id: `eq.${clinic.id}` });
  return jsonResponse({ ok: true, worker_version: WORKER_VERSION, message: "休止枠を削除しました。" });
}

async function handleAdminExactAppointmentDoctorAssign(request, env) {
  const body = await readJson(request);
  const clinicCode = getRequestedClinicCode(request, body);
  const clinic = await getClinicByCode(env, clinicCode);
  const appointmentId = cleanString(body.appointment_id);
  const doctorId = cleanString(body.doctor_id || "");
  if (!appointmentId) throw new Error("予約を選択してください。");
  const rows = await supabaseRpc(env, "vet_assign_exact_appointment_doctor", {
    p_appointment_id: appointmentId,
    p_doctor_id: doctorId || null,
    p_actor_name: cleanString(body.staff_name) || "管理画面",
    p_reason: cleanString(body.reason || "管理画面から担当獣医師を変更")
  });
  const settings = await getExactAppointmentSettings(env, clinic, { createIfMissing: true });
  const appointment = (await enrichExactAppointments(env, [Array.isArray(rows) ? rows[0] : rows], settings))[0];
  return jsonResponse({ ok: true, worker_version: WORKER_VERSION, message: "担当獣医師を更新しました。", appointment });
}

async function handleAdminExactAppointmentCheck(request, env) {
  const clinicCode = getParam(request, "clinic_code", DEFAULT_CLINIC_CODE);
  const clinic = await getClinicByCode(env, clinicCode);
  const checks = [];
  async function add(key, label, fn) {
    try {
      const value = await fn();
      checks.push({ key, label, ok: true, value });
    } catch (error) {
      checks.push({ key, label, ok: false, error: error?.message || String(error) });
    }
  }
  await add("settings_table", "日時指定予約設定", async () => {
    const row = await selectSingle(env, TABLES.exactAppointmentSettings, { select: "id,exact_time_booking_enabled,slot_minutes,conflict_guard_version", clinic_id: `eq.${clinic.id}` });
    if (!row) throw new Error("日時指定予約設定がありません。");
    if (row.conflict_guard_version !== EXACT_APPOINTMENT_GUARD_VERSION) {
      throw new Error(`競合防止SQLが未更新です。expected=${EXACT_APPOINTMENT_GUARD_VERSION}, actual=${row.conflict_guard_version || "未設定"}`);
    }
    return { exists: true, enabled: row.exact_time_booking_enabled === true, slot_minutes: row.slot_minutes || null, conflict_guard_version: row.conflict_guard_version };
  });
  await add("services_table", "予約内容", async () => {
    const rows = await selectRows(env, TABLES.exactAppointmentServices, { select: "id,is_active", clinic_id: `eq.${clinic.id}` });
    return { total: rows.length, active: rows.filter((row) => row.is_active === true).length };
  });
  await add("appointments_table", "日時指定予約", async () => {
    const rows = await selectRows(env, TABLES.exactAppointments, { select: "id,status", clinic_id: `eq.${clinic.id}`, limit: 10 });
    return { readable: true, sample_count: rows.length };
  });
  await add("history_table", "予約変更履歴", async () => {
    const rows = await selectRows(env, TABLES.exactAppointmentHistory, { select: "id", clinic_id: `eq.${clinic.id}`, limit: 1 });
    return { readable: true, sample_count: rows.length };
  });
  if (settings?.doctor_booking_enabled === true) {
    await add("doctors_table", "獣医師マスタ", async () => {
      const rows = await selectRows(env, TABLES.exactAppointmentDoctors, { select: "id,is_active", clinic_id: `eq.${clinic.id}` });
      return { total: rows.length, active: rows.filter((row) => row.is_active === true).length };
    });
    await add("doctor_services_table", "獣医師×予約内容", async () => {
      const rows = await selectRows(env, TABLES.exactAppointmentDoctorServices, { select: "id,is_active", clinic_id: `eq.${clinic.id}` });
      return { total: rows.length, active: rows.filter((row) => row.is_active === true).length };
    });
    await add("doctor_hours_table", "獣医師勤務時間", async () => {
      const rows = await selectRows(env, TABLES.exactAppointmentDoctorHours, { select: "id,is_active", clinic_id: `eq.${clinic.id}` });
      return { total: rows.length, active: rows.filter((row) => row.is_active === true).length };
    });
  }
  return jsonResponse({
    ok: checks.every((check) => check.ok),
    worker_version: WORKER_VERSION,
    clinic_code: clinicCode,
    database_feature: EXACT_APPOINTMENT_GUARD_VERSION,
    doctor_feature: DOCTOR_SLOT_FEATURE_VERSION,
    checks
  }, checks.every((check) => check.ok) ? 200 : 500);
}
