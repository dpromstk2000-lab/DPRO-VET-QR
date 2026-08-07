/* =========================================================
 FINAL VET-AUDIT-1-R2
 DPRO PET CARE LINE / config.js
 本番LIFF本人確認 共通版
========================================================= */
(function () {
  "use strict";

  const SITE_BASE_URL = "https://dpromstk2000-lab.github.io/DPRO-VET-QR";
  const API_BASE_URL = "https://dpro-vet-qr-api.dpromstk2000.workers.dev";
  const DEMO_CLINIC_CODE = "dpro_vet_demo";
  const LIFF_SDK_URL = "https://static.line-scdn.net/liff/edge/2/sdk.js";
  const LIFF_AUTH_VERSION = "FINAL-VET-AUDIT-1-R2";

  const CONFIG = {
    version: "final-vet-audit-1-r2-production-liff",
    project: {
      repoName: "DPRO-VET-QR",
      serviceId: "dpro-pet-care-line",
      serviceName: "DPRO PET CARE LINE",
      serviceDescription: "LINE公式で使える、ペット診察券・予防フォローシステム",
      industry: "animal_hospital",
      mode: "demo"
    },
    clinic: {
      clinicCode: DEMO_CLINIC_CODE,
      publicSlug: "dpro-vet-demo",
      clinicName: "DPROどうぶつ病院",
      displayName: "DPRO PET CARE LINE",
      phone: "097-000-0000",
      address: "大分県杵築市サンプル町1-2-3",
      businessHoursNote: "午前 9:00〜12:00 / 午後 15:00〜18:30",
      closedDaysNote: "水曜午後・日曜・祝日",
      timezone: "Asia/Tokyo"
    },
    urls: {
      siteBaseUrl: SITE_BASE_URL, apiBaseUrl: API_BASE_URL,
      index:`${SITE_BASE_URL}/index.html`,
      member:`${SITE_BASE_URL}/member.html`,
      owner:`${SITE_BASE_URL}/owner.html`,
      admin:`${SITE_BASE_URL}/admin.html`,
      adminQueue:`${SITE_BASE_URL}/admin-queue.html`,
      appointment:`${SITE_BASE_URL}/appointment.html`,
      appointmentAdmin:`${SITE_BASE_URL}/appointment-admin.html`,
      appointmentCalendar:`${SITE_BASE_URL}/appointment-calendar.html`,
      waiting:`${SITE_BASE_URL}/waiting.html`,
      richMenu:`${SITE_BASE_URL}/rich-menu.html`,
      doctor:`${SITE_BASE_URL}/doctor.html`,
      scanIpad:`${SITE_BASE_URL}/scan-ipad.html`,
      scanPc:`${SITE_BASE_URL}/scan-pc.html`,
      systemCheck:`${SITE_BASE_URL}/system-check.html`,
      demoGuide:`${SITE_BASE_URL}/demo-guide.html`,
      operations:`${SITE_BASE_URL}/operations.html`,
      todayBoard:`${SITE_BASE_URL}/today-board.html`,
      lineCallAdmin:`${SITE_BASE_URL}/line-call-admin.html`,
      recallAdmin:`${SITE_BASE_URL}/recall-admin.html`,
      lineUnlinkedFollow:`${SITE_BASE_URL}/line-unlinked-follow.html`,
      queueStatus:`${SITE_BASE_URL}/queue-status.html`,
      lineDemo:`${SITE_BASE_URL}/line-demo.html`,
      richMenuPreview:`${SITE_BASE_URL}/rich-menu-preview.html`,
      questionnaire:`${SITE_BASE_URL}/questionnaire.html`,
      prevention:`${SITE_BASE_URL}/prevention.html`,
      access:`${SITE_BASE_URL}/access.html`
    },
    api: {
      baseUrl: API_BASE_URL,
      health:`${API_BASE_URL}/api/health`,
      publicClinic:`${API_BASE_URL}/api/public/clinic`,
      publicClinicSettings:`${API_BASE_URL}/api/public/clinic-settings`,
      publicAppointmentOptions:`${API_BASE_URL}/api/public/appointment-options`,
      publicExactAppointmentSettings:`${API_BASE_URL}/api/public/exact-appointments/settings`,
      publicExactAppointmentAvailability:`${API_BASE_URL}/api/public/exact-appointments/availability`,
      memberPetCard:`${API_BASE_URL}/api/member/pet-card`,
      memberPetCards:`${API_BASE_URL}/api/member/pet-cards`,
      memberLineLinkStatus:`${API_BASE_URL}/api/member/line-link/status`,
      memberLineLinkComplete:`${API_BASE_URL}/api/member/line-link/complete`,
      memberQuestionnaireCreate:`${API_BASE_URL}/api/member/questionnaire/create`,
      memberExactAppointments:`${API_BASE_URL}/api/member/exact-appointments`,
      memberExactAppointmentCreate:`${API_BASE_URL}/api/member/exact-appointments/create`,
      memberExactAppointmentChange:`${API_BASE_URL}/api/member/exact-appointments/change`,
      memberExactAppointmentCancel:`${API_BASE_URL}/api/member/exact-appointments/cancel`,
      scanLookup:`${API_BASE_URL}/api/scan/lookup`,
      scanToday:`${API_BASE_URL}/api/scan/today`,
      scanCheckIn:`${API_BASE_URL}/api/scan/check-in`,
      scanCancelCheckIn:`${API_BASE_URL}/api/scan/check-in/cancel`,
      doctorToday:`${API_BASE_URL}/api/doctor/today`,
      doctorExamStart:`${API_BASE_URL}/api/doctor/exam-start`,
      doctorExamComplete:`${API_BASE_URL}/api/doctor/exam-complete`,
      doctorMemoSave:`${API_BASE_URL}/api/doctor/memo-save`,
      doctorLineFollowCopied:`${API_BASE_URL}/api/doctor/line-follow-copied`,
      ownerToday:`${API_BASE_URL}/api/owner/today`,
      ownerDailyStatuses:`${API_BASE_URL}/api/owner/daily-statuses`,
      ownerPreventionTodos:`${API_BASE_URL}/api/owner/prevention-todos`,
      ownerFollowups:`${API_BASE_URL}/api/owner/followups`,
      ownerFollowupUpdate:`${API_BASE_URL}/api/owner/followups/update`,
      ownerLineUnlinkedGuardians:`${API_BASE_URL}/api/owner/line-unlinked-guardians`,
      ownerGuardiansSearch:`${API_BASE_URL}/api/owner/guardians/search`,
      ownerGuardianDetail:`${API_BASE_URL}/api/owner/guardians/detail`,
      ownerPetDetail:`${API_BASE_URL}/api/owner/pets/detail`,
      adminSafetyCheck:`${API_BASE_URL}/api/admin/safety-check`,
      adminReadinessCheck:`${API_BASE_URL}/api/admin/production-readiness-check`,
      adminSettings:`${API_BASE_URL}/api/admin/settings`,
      adminSpecialDays:`${API_BASE_URL}/api/admin/special-days`,
      adminSpecialDayUpsert:`${API_BASE_URL}/api/admin/special-days/upsert`,
      adminSpecialDayDelete:`${API_BASE_URL}/api/admin/special-days/delete`,
      adminAppointmentOptions:`${API_BASE_URL}/api/admin/appointment-options`,
      adminExactAppointmentSettings:`${API_BASE_URL}/api/admin/exact-appointments/settings`,
      adminExactAppointmentServices:`${API_BASE_URL}/api/admin/exact-appointments/services`,
      adminExactAppointmentServiceSave:`${API_BASE_URL}/api/admin/exact-appointments/services/save`,
      adminExactAppointmentServiceArchive:`${API_BASE_URL}/api/admin/exact-appointments/services/archive`,
      adminExactAppointments:`${API_BASE_URL}/api/admin/exact-appointments`,
      adminExactAppointmentCreate:`${API_BASE_URL}/api/admin/exact-appointments/create`,
      adminExactAppointmentStatus:`${API_BASE_URL}/api/admin/exact-appointments/status`,
      adminExactAppointmentCheck:`${API_BASE_URL}/api/admin/exact-appointments/check`,
      adminGuardiansSearch:`${API_BASE_URL}/api/admin/guardians/search`,
      adminGuardianCreate:`${API_BASE_URL}/api/admin/guardians/create`,
      adminGuardianUpdate:`${API_BASE_URL}/api/admin/guardians/update`,
      adminGuardianDetail:`${API_BASE_URL}/api/admin/guardians/detail`,
      adminGuardianArchive:`${API_BASE_URL}/api/admin/guardians/archive`,
      adminGuardianRestore:`${API_BASE_URL}/api/admin/guardians/restore`,
      adminPetCreate:`${API_BASE_URL}/api/admin/pets/create`,
      adminPetUpdate:`${API_BASE_URL}/api/admin/pets/update`,
      adminPetDetail:`${API_BASE_URL}/api/admin/pets/detail`,
      adminPetCardReissue:`${API_BASE_URL}/api/admin/pets/card/reissue`,
      adminPetCardDisable:`${API_BASE_URL}/api/admin/pets/card/disable`,
      adminPetCardEnable:`${API_BASE_URL}/api/admin/pets/card/enable`,
      adminLineLinkTokenCreate:`${API_BASE_URL}/api/admin/line-link-token/create`,
      adminLineLinkTokens:`${API_BASE_URL}/api/admin/line-link-tokens`,
      adminLineLinkGuideCopied:`${API_BASE_URL}/api/admin/line-link-guide/copied`,
      adminLineUnlinkedGuardians:`${API_BASE_URL}/api/admin/line-unlinked-guardians`,
      adminPreventionSchedules:`${API_BASE_URL}/api/admin/prevention-schedules`,
      adminPreventionCreate:`${API_BASE_URL}/api/admin/prevention-schedules/create`,
      adminPreventionUpdate:`${API_BASE_URL}/api/admin/prevention-schedules/update`,
      adminFollowups:`${API_BASE_URL}/api/admin/followups`,
      adminFollowupCreate:`${API_BASE_URL}/api/admin/followups/create`,
      adminFollowupUpdate:`${API_BASE_URL}/api/admin/followups/update`,
      adminTemplates:`${API_BASE_URL}/api/admin/templates`,
      adminMessageQueue:`${API_BASE_URL}/api/admin/message-queue`,
      adminMessageQueueCreate:`${API_BASE_URL}/api/admin/message-queue/create`,
      adminMessageQueueUpdate:`${API_BASE_URL}/api/admin/message-queue/update`,
      adminOperationLogs:`${API_BASE_URL}/api/admin/operation-logs`,
      adminDemoReset:`${API_BASE_URL}/api/admin/demo/reset`
    },
    liff: {
      enabled:false,
      liffId:"",
      liffUrl:"",
      authVersion:LIFF_AUTH_VERSION,
      idTokenHeaderName:"X-Line-ID-Token",
      requireVerifiedIdentityInProduction:true,
      autoLoadSdk:true,
      note:"DEMOはLIFF未設定で動作。本番clinicではLIFF IDを設定し、Worker側LINE_LOGIN_CHANNEL_IDと組み合わせて本人確認する。"
    },
    demo: {
      enabled:true, clinicCode:DEMO_CLINIC_CODE, guardianNo:"G-0001",
      lineUserId:"demo_line_tanaka_misaki",
      sampleTokens:{coco:"vet_demo_coco_qr_token",momo:"vet_demo_momo_qr_token",hana:"vet_demo_hana_qr_token",mugi:"vet_demo_mugi_qr_token"},
      resetConfirmText:"DEMO動物病院だけ実行",
      resetNote:"DEMOリセットはWorker側でPOST + 管理コード + 確認文言必須。"
    },
    admin: {
      tokenStorageKey:"dpro_vet_admin_code",
      tokenHeaderName:"X-DPRO-Admin-Code",
      tokenQueryName:"admin_code",
      tokenStorageKeys:["dpro_vet_admin_code","DPRO_VET_ADMIN_CODE","DPRO_VET_ADMIN_TOKEN","dpro_vet_admin_token","DPRO_ADMIN_TOKEN","dpro_admin_token"],
      warning:"管理コードはGitHubに保存しない。Cloudflare Worker Secretのみ。ブラウザ保存はlocalStorage/sessionStorageのみ。"
    },
    richMenu: {
      title:"DPRO PET CARE LINE リッチメニュー",layout:"6分割",
      buttons:[
        {id:"pet-card",label:"ペット診察券",description:"飼い主LINEから複数ペットの診察券を表示",url:`${SITE_BASE_URL}/member.html`},
        {id:"reservation",label:"予約・受付",description:"順番受付・優先受付・日時指定予約への導線",url:`${SITE_BASE_URL}/member.html`},
        {id:"questionnaire",label:"来院前問診",description:"来院前の症状確認フォーム",url:`${SITE_BASE_URL}/questionnaire.html`},
        {id:"prevention",label:"予防予定",description:"ワクチン・フィラリア・健診の確認",url:`${SITE_BASE_URL}/prevention.html`},
        {id:"news",label:"お知らせ",description:"休診日・予防シーズン案内",url:`${SITE_BASE_URL}/index.html`},
        {id:"access",label:"診療時間・アクセス",description:"病院情報",url:`${SITE_BASE_URL}/access.html`}
      ]
    },
    labels:{owner:"飼い主",pet:"ペット",petCard:"ペット診察券",multiPetCard:"多頭飼いペット診察券",clinic:"動物病院",doctor:"獣医師",checkin:"受付",prevention:"予防予定",followup:"再診フォロー",lineLink:"LINE連携"},
    safety:{databasePrefix:"vet_",dentalTablesTouched:false,dentalWorkerTouched:false,finalAuditVersion:"FINAL-VET-AUDIT-1-R2",note:"DPRO PET CARE LINE専用。歯科版 dental_qr_ 系には触れない。"}
  };

  CONFIG.SITE_BASE_URL = SITE_BASE_URL;
  CONFIG.API_BASE_URL = API_BASE_URL;
  CONFIG.API_BASE = API_BASE_URL;
  CONFIG.CLINIC_CODE = CONFIG.clinic.clinicCode;
  CONFIG.DEFAULT_CLINIC_CODE = CONFIG.clinic.clinicCode;
  CONFIG.DEMO_CLINIC_CODE = DEMO_CLINIC_CODE;

  function buildQuery(params) {
    const search = new URLSearchParams();
    Object.entries(params || {}).forEach(([key,value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== "") search.set(key,String(value));
    });
    return search.toString();
  }
  function withClinic(url, extraParams) {
    return `${url}?${buildQuery({clinic_code:CONFIG.clinic.clinicCode,...(extraParams||{})})}`;
  }
  function getAdminStorageKeys() {
    return Array.from(new Set([CONFIG.admin.tokenStorageKey,...(CONFIG.admin.tokenStorageKeys||[])].filter(Boolean)));
  }
  function getAdminCode() {
    try {
      for (const key of getAdminStorageKeys()) {
        const value = sessionStorage.getItem(key);
        if (value && String(value).trim()) return String(value).trim();
      }
      for (const key of getAdminStorageKeys()) {
        const value = localStorage.getItem(key);
        if (value && String(value).trim()) return String(value).trim();
      }
    } catch {}
    return "";
  }
  function setAdminCode(value) {
    const code = String(value || "").trim();
    try {
      if (!code) return clearAdminCode();
      getAdminStorageKeys().forEach(k=>sessionStorage.setItem(k,code));
      getAdminStorageKeys().forEach(k=>localStorage.setItem(k,code));
    } catch (error) { console.warn("管理コードの保存に失敗しました。",error); }
  }
  function clearAdminCode() {
    try {
      getAdminStorageKeys().forEach(k=>sessionStorage.removeItem(k));
      getAdminStorageKeys().forEach(k=>localStorage.removeItem(k));
    } catch (error) { console.warn("管理コードの削除に失敗しました。",error); }
  }
  function getAdminHeaders(extraHeaders) {
    const code = getAdminCode();
    return {
      "Content-Type":"application/json",
      ...(code?{
        "X-DPRO-Admin-Code":code,"x-dpro-admin-code":code,"x-admin-token":code,
        "X-Admin-Token":code,"X-Admin-Code":code,"Authorization":`Bearer ${code}`
      }:{}),
      ...(extraHeaders||{})
    };
  }

  const PROTECTED_MEMBER_PATHS = new Set([
    "/api/public/register","/api/member/register",
    "/api/public/register/check-duplicate","/api/member/register/check-duplicate",
    "/api/public/my-cards","/api/member/my-cards",
    "/api/public/line-link-complete","/api/member/line-link-complete-v2",
    "/api/member/pet-card","/api/member/pet-cards",
    "/api/member/questionnaire/create",
    "/api/member/exact-appointments","/api/member/exact-appointments/create",
    "/api/member/exact-appointments/change","/api/member/exact-appointments/cancel",
    "/api/member/queue/create","/api/member/waiting/create","/api/member/waiting-entry/create",
    "/api/public/pets/photo/update","/api/member/pets/photo/update",
    "/api/public/pet-photo/update","/api/member/pet-photo/update",
    "/api/public/pets/photo/delete","/api/member/pets/photo/delete",
    "/api/public/pet-photo/delete","/api/member/pet-photo/delete"
  ]);

  const nativeFetch = window.fetch.bind(window);
  let liffSdkPromise = null;
  let liffInitPromise = null;
  let liffLoginRedirectStarted = false;

  const clean = (v) => String(v ?? "").trim();

  function getLiffId() {
    try { return clean(new URL(location.href).searchParams.get("liff_id")) || clean(CONFIG.liff.liffId); }
    catch { return clean(CONFIG.liff.liffId); }
  }
  function isDemoClinicCode(clinicCode) {
    return clean(clinicCode || CONFIG.clinic.clinicCode) === clean(CONFIG.demo.clinicCode || DEMO_CLINIC_CODE);
  }
  function parseBodyObject(body) {
    if (!body) return {};
    if (typeof body === "string") { try { return JSON.parse(body)||{}; } catch { return {}; } }
    if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) return Object.fromEntries(body.entries());
    return {};
  }
  function requestUrlOf(input) {
    try {
      if (typeof input === "string" || (typeof URL !== "undefined" && input instanceof URL)) return new URL(String(input),location.href);
      if (input && input.url) return new URL(input.url,location.href);
    } catch {}
    return null;
  }
  function resolveRequestClinicCode(url, input, init) {
    const q = url ? clean(url.searchParams.get("clinic_code")) : "";
    if (q) return q;
    const body = parseBodyObject(init && init.body);
    return clean(body.clinic_code) || clean(CONFIG.clinic.clinicCode);
  }
  function isWorkerRequest(url) {
    try { return Boolean(url && url.origin === new URL(API_BASE_URL).origin); } catch { return false; }
  }
  function isProtectedMemberRequest(url) {
    return Boolean(url && PROTECTED_MEMBER_PATHS.has((url.pathname.replace(/\/+$/,"") || "/")));
  }
  function sanitizeProtectedIdentityQuery(url) {
    const next = new URL(url.toString());
    ["line_user_id","lineUserId","uid","guardian_id"].forEach(k=>next.searchParams.delete(k));
    return next;
  }
  function loadLiffSdk() {
    if (window.liff) return Promise.resolve(window.liff);
    if (liffSdkPromise) return liffSdkPromise;
    liffSdkPromise = new Promise((resolve,reject)=>{
      const existing = Array.from(document.scripts||[]).find(s=>String(s.src||"").includes("static.line-scdn.net/liff"));
      if (existing) {
        if (window.liff) return resolve(window.liff);
        existing.addEventListener("load",()=>window.liff?resolve(window.liff):reject(new Error("LIFF SDKを読み込めませんでした。")),{once:true});
        existing.addEventListener("error",()=>reject(new Error("LIFF SDKの読み込みに失敗しました。")),{once:true});
        return;
      }
      const script = document.createElement("script");
      script.src = LIFF_SDK_URL;
      script.async = true;
      script.onload = ()=>window.liff?resolve(window.liff):reject(new Error("LIFF SDKを読み込めませんでした。"));
      script.onerror = ()=>reject(new Error("LIFF SDKの読み込みに失敗しました。"));
      document.head.appendChild(script);
    });
    return liffSdkPromise;
  }
  async function ensureLiffInitialized() {
    const liffId = getLiffId();
    if (!liffId) throw new Error("本番LINE本人確認用のLIFF IDが未設定です。");
    const liff = await loadLiffSdk();
    try { if (liff.getIDToken && liff.getIDToken()) return liff; } catch {}
    try { if (liff.getContext && liff.getContext()) return liff; } catch {}
    if (!liffInitPromise) liffInitPromise = Promise.resolve(liff.init({liffId})).then(()=>liff);
    return liffInitPromise;
  }
  async function getVerifiedLineIdToken() {
    const liff = await ensureLiffInitialized();
    if (!liff.isLoggedIn()) {
      if (!liffLoginRedirectStarted) {
        liffLoginRedirectStarted = true;
        liff.login({redirectUri:location.href});
      }
      return new Promise(()=>{});
    }
    const token = clean(liff.getIDToken && liff.getIDToken());
    if (!token) throw new Error("LINE本人確認トークンを取得できませんでした。LINEアプリ内で開き直してください。");
    return token;
  }
  async function secureFetch(input, init) {
    const originalUrl = requestUrlOf(input);
    if (!isWorkerRequest(originalUrl) || !isProtectedMemberRequest(originalUrl)) return nativeFetch(input,init);
    const clinicCode = resolveRequestClinicCode(originalUrl,input,init||{});
    if (isDemoClinicCode(clinicCode)) return nativeFetch(input,init);

    const idToken = await getVerifiedLineIdToken();
    const headers = new Headers((init&&init.headers)||(input&&typeof input!=="string"&&input.headers)||{});
    headers.set(CONFIG.liff.idTokenHeaderName||"X-Line-ID-Token",idToken);
    headers.set("X-DPRO-LIFF-Auth-Version",LIFF_AUTH_VERSION);
    const safeUrl = sanitizeProtectedIdentityQuery(originalUrl);
    const nextInit = {...(init||{}),headers};

    if (input && typeof input !== "string" && !(input instanceof URL)) {
      return nativeFetch(new Request(safeUrl.toString(),input),nextInit);
    }
    return nativeFetch(safeUrl.toString(),nextInit);
  }
  window.fetch = secureFetch;

  async function getLineIdToken() {
    if (isDemoClinicCode(CONFIG.clinic.clinicCode)) return "";
    return getVerifiedLineIdToken();
  }
  function getLiffAuthStatus() {
    return {
      version:LIFF_AUTH_VERSION,
      clinic_code:CONFIG.clinic.clinicCode,
      is_demo:isDemoClinicCode(CONFIG.clinic.clinicCode),
      liff_id_configured:Boolean(getLiffId()),
      sdk_loaded:Boolean(window.liff),
      protected_paths:PROTECTED_MEMBER_PATHS.size
    };
  }

  async function apiGet(url,params,options) {
    const res = await fetch(withClinic(url,params),{
      method:"GET",
      headers:options&&options.admin?getAdminHeaders():{"Content-Type":"application/json"}
    });
    const data = await res.json().catch(()=>null);
    if (!res.ok || !data || data.ok===false) throw new Error(data&&(data.message||data.error)?(data.message||data.error):`APIエラー status=${res.status}`);
    return data;
  }
  async function apiPost(url,body,options) {
    const res = await fetch(url,{
      method:"POST",
      headers:options&&options.admin?getAdminHeaders():{"Content-Type":"application/json"},
      body:JSON.stringify({clinic_code:CONFIG.clinic.clinicCode,...(body||{})})
    });
    const data = await res.json().catch(()=>null);
    if (!res.ok || !data || data.ok===false) throw new Error(data&&(data.message||data.error)?(data.message||data.error):`APIエラー status=${res.status}`);
    return data;
  }

  const helpers = {
    buildQuery,withClinic,getAdminStorageKeys,getAdminCode,setAdminCode,clearAdminCode,
    getAdminHeaders,apiGet,apiPost,getLineIdToken,getLiffAuthStatus
  };
  CONFIG.getAdminToken=getAdminCode;
  CONFIG.getAdminCode=getAdminCode;
  CONFIG.setAdminToken=setAdminCode;
  CONFIG.setAdminCode=setAdminCode;
  CONFIG.clearAdminToken=clearAdminCode;
  CONFIG.clearAdminCode=clearAdminCode;
  CONFIG.getAdminHeaders=getAdminHeaders;
  CONFIG.getLineIdToken=getLineIdToken;
  CONFIG.getLiffAuthStatus=getLiffAuthStatus;

  window.DPRO_VET_CONFIG=CONFIG;
  window.DPRO_VET_HELPERS=helpers;
  window.DPRO_VET_AUTH={
    version:LIFF_AUTH_VERSION,
    getLineIdToken,
    getStatus:getLiffAuthStatus,
    protectedPaths:Array.from(PROTECTED_MEMBER_PATHS)
  };
  window.DPRO_CONFIG=CONFIG;
  window.DPRO_HELPERS=helpers;
  window.APP_CONFIG=CONFIG;
  window.APP_HELPERS=helpers;
})();