/* =========================================================
  STEP VET-21A
  DPRO PET CARE LINE
  config.js 動物病院版 完全版 管理コード保存キー統一

  目的：
  ・GitHub Pages 側のHTMLが、動物病院版Worker dpro-vet-qr-api を参照する
  ・歯科版Worker / dental_qr_ 系とは完全分離する
  ・ADMIN_TOKEN は絶対にここへ書かない
  ・管理コードはCloudflare Worker Secretだけに保存する

  公開URL：
  ・GitHub Pages：
    https://dpromstk2000-lab.github.io/DPRO-VET-QR/

  API：
  ・Cloudflare Worker：
    https://dpro-vet-qr-api.dpromstk2000.workers.dev

  DEMO clinic_code：
  ・dpro_vet_demo
========================================================= */

(function () {
  "use strict";

  const SITE_BASE_URL = "https://dpromstk2000-lab.github.io/DPRO-VET-QR";
  const API_BASE_URL = "https://dpro-vet-qr-api.dpromstk2000.workers.dev";

  const CONFIG = {
    version: "step-vet-21a-admin-code-storage-unified",
    project: {
      repoName: "DPRO-VET-QR",
      serviceId: "dpro-pet-care-line",
      serviceName: "DPRO PET CARE LINE",
      serviceDescription: "LINE公式で使える、ペット診察券・予防フォローシステム",
      industry: "animal_hospital",
      mode: "demo"
    },

    clinic: {
      clinicCode: "dpro_vet_demo",
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
      siteBaseUrl: SITE_BASE_URL,
      apiBaseUrl: API_BASE_URL,

      index: `${SITE_BASE_URL}/index.html`,
      member: `${SITE_BASE_URL}/member.html`,
      owner: `${SITE_BASE_URL}/owner.html`,
      admin: `${SITE_BASE_URL}/admin.html`,
      adminQueue: `${SITE_BASE_URL}/admin-queue.html`,
      waiting: `${SITE_BASE_URL}/waiting.html`,
      richMenu: `${SITE_BASE_URL}/rich-menu.html`,
      doctor: `${SITE_BASE_URL}/doctor.html`,
      scanIpad: `${SITE_BASE_URL}/scan-ipad.html`,
      scanPc: `${SITE_BASE_URL}/scan-pc.html`,
      systemCheck: `${SITE_BASE_URL}/system-check.html`,
      demoGuide: `${SITE_BASE_URL}/demo-guide.html`,

      // 今後追加予定
      lineDemo: `${SITE_BASE_URL}/line-demo.html`,
      richMenuPreview: `${SITE_BASE_URL}/rich-menu-preview.html`,
      questionnaire: `${SITE_BASE_URL}/questionnaire.html`,
      prevention: `${SITE_BASE_URL}/prevention.html`,
      access: `${SITE_BASE_URL}/access.html`
    },

    api: {
      baseUrl: API_BASE_URL,

      // public
      health: `${API_BASE_URL}/api/health`,
      publicClinic: `${API_BASE_URL}/api/public/clinic`,
      publicClinicSettings: `${API_BASE_URL}/api/public/clinic-settings`,
      publicAppointmentOptions: `${API_BASE_URL}/api/public/appointment-options`,

      // member / LIFF
      memberPetCard: `${API_BASE_URL}/api/member/pet-card`,
      memberPetCards: `${API_BASE_URL}/api/member/pet-cards`,
      memberLineLinkStatus: `${API_BASE_URL}/api/member/line-link/status`,
      memberLineLinkComplete: `${API_BASE_URL}/api/member/line-link/complete`,
      memberQuestionnaireCreate: `${API_BASE_URL}/api/member/questionnaire/create`,

      // scan / reception
      scanLookup: `${API_BASE_URL}/api/scan/lookup`,
      scanToday: `${API_BASE_URL}/api/scan/today`,
      scanCheckIn: `${API_BASE_URL}/api/scan/check-in`,
      scanCancelCheckIn: `${API_BASE_URL}/api/scan/check-in/cancel`,

      // doctor
      doctorToday: `${API_BASE_URL}/api/doctor/today`,
      doctorExamStart: `${API_BASE_URL}/api/doctor/exam-start`,
      doctorExamComplete: `${API_BASE_URL}/api/doctor/exam-complete`,
      doctorMemoSave: `${API_BASE_URL}/api/doctor/memo-save`,
      doctorLineFollowCopied: `${API_BASE_URL}/api/doctor/line-follow-copied`,

      // owner
      ownerToday: `${API_BASE_URL}/api/owner/today`,
      ownerDailyStatuses: `${API_BASE_URL}/api/owner/daily-statuses`,
      ownerPreventionTodos: `${API_BASE_URL}/api/owner/prevention-todos`,
      ownerFollowups: `${API_BASE_URL}/api/owner/followups`,
      ownerFollowupUpdate: `${API_BASE_URL}/api/owner/followups/update`,
      ownerLineUnlinkedGuardians: `${API_BASE_URL}/api/owner/line-unlinked-guardians`,
      ownerGuardiansSearch: `${API_BASE_URL}/api/owner/guardians/search`,
      ownerGuardianDetail: `${API_BASE_URL}/api/owner/guardians/detail`,
      ownerPetDetail: `${API_BASE_URL}/api/owner/pets/detail`,

      // admin
      adminSafetyCheck: `${API_BASE_URL}/api/admin/safety-check`,
      adminReadinessCheck: `${API_BASE_URL}/api/admin/production-readiness-check`,
      adminSettings: `${API_BASE_URL}/api/admin/settings`,
      adminSpecialDays: `${API_BASE_URL}/api/admin/special-days`,
      adminSpecialDayUpsert: `${API_BASE_URL}/api/admin/special-days/upsert`,
      adminSpecialDayDelete: `${API_BASE_URL}/api/admin/special-days/delete`,
      adminAppointmentOptions: `${API_BASE_URL}/api/admin/appointment-options`,
      adminGuardiansSearch: `${API_BASE_URL}/api/admin/guardians/search`,
      adminGuardianCreate: `${API_BASE_URL}/api/admin/guardians/create`,
      adminGuardianUpdate: `${API_BASE_URL}/api/admin/guardians/update`,
      adminGuardianDetail: `${API_BASE_URL}/api/admin/guardians/detail`,
      adminGuardianArchive: `${API_BASE_URL}/api/admin/guardians/archive`,
      adminGuardianRestore: `${API_BASE_URL}/api/admin/guardians/restore`,
      adminPetCreate: `${API_BASE_URL}/api/admin/pets/create`,
      adminPetUpdate: `${API_BASE_URL}/api/admin/pets/update`,
      adminPetDetail: `${API_BASE_URL}/api/admin/pets/detail`,
      adminPetCardReissue: `${API_BASE_URL}/api/admin/pets/card/reissue`,
      adminPetCardDisable: `${API_BASE_URL}/api/admin/pets/card/disable`,
      adminPetCardEnable: `${API_BASE_URL}/api/admin/pets/card/enable`,
      adminLineLinkTokenCreate: `${API_BASE_URL}/api/admin/line-link-token/create`,
      adminLineLinkTokens: `${API_BASE_URL}/api/admin/line-link-tokens`,
      adminLineLinkGuideCopied: `${API_BASE_URL}/api/admin/line-link-guide/copied`,
      adminLineUnlinkedGuardians: `${API_BASE_URL}/api/admin/line-unlinked-guardians`,
      adminPreventionSchedules: `${API_BASE_URL}/api/admin/prevention-schedules`,
      adminPreventionCreate: `${API_BASE_URL}/api/admin/prevention-schedules/create`,
      adminPreventionUpdate: `${API_BASE_URL}/api/admin/prevention-schedules/update`,
      adminFollowups: `${API_BASE_URL}/api/admin/followups`,
      adminFollowupCreate: `${API_BASE_URL}/api/admin/followups/create`,
      adminFollowupUpdate: `${API_BASE_URL}/api/admin/followups/update`,
      adminTemplates: `${API_BASE_URL}/api/admin/templates`,
      adminMessageQueue: `${API_BASE_URL}/api/admin/message-queue`,
      adminMessageQueueCreate: `${API_BASE_URL}/api/admin/message-queue/create`,
      adminMessageQueueUpdate: `${API_BASE_URL}/api/admin/message-queue/update`,
      adminOperationLogs: `${API_BASE_URL}/api/admin/operation-logs`,
      adminDemoReset: `${API_BASE_URL}/api/admin/demo/reset`
    },

    liff: {
      enabled: false,
      liffId: "",
      liffUrl: "",
      note: "STEP VET-21A時点ではLIFF未作成。LINE Developersで作成後にここへ設定する。"
    },

    demo: {
      enabled: true,
      clinicCode: "dpro_vet_demo",
      guardianNo: "G-0001",
      lineUserId: "demo_line_tanaka_misaki",
      sampleTokens: {
        coco: "vet_demo_coco_qr_token",
        momo: "vet_demo_momo_qr_token",
        hana: "vet_demo_hana_qr_token",
        mugi: "vet_demo_mugi_qr_token"
      },
      resetConfirmText: "DEMO動物病院だけ実行",
      resetNote: "DEMOリセットはWorker側でPOST + 管理コード + 確認文言必須。"
    },

    admin: {
      // 重要：
      // ADMIN_TOKEN はここに絶対に書かない。
      // Cloudflare Worker Secret にだけ保存する。
      tokenStorageKey: "dpro_vet_admin_code",
      tokenHeaderName: "X-DPRO-Admin-Code",
      tokenQueryName: "admin_code",
      // STEP VET-21A：
      // 旧画面・新画面で保存キーが混ざると「正しい管理コードなのに違う」と見えるため、
      // ここで全画面共通の保存キーとして扱う。
      tokenStorageKeys: [
        "dpro_vet_admin_code",
        "DPRO_VET_ADMIN_CODE",
        "DPRO_VET_ADMIN_TOKEN",
        "dpro_vet_admin_token",
        "DPRO_ADMIN_TOKEN",
        "dpro_admin_token"
      ],
      warning: "管理コードはGitHubに保存しない。Cloudflare Worker Secretのみ。ブラウザ保存はlocalStorage/sessionStorageのみ。"
    },

    richMenu: {
      title: "DPRO PET CARE LINE リッチメニュー",
      layout: "6分割",
      buttons: [
        {
          id: "pet-card",
          label: "ペット診察券",
          description: "飼い主LINEから複数ペットの診察券を表示",
          url: `${SITE_BASE_URL}/member.html`
        },
        {
          id: "reservation",
          label: "予約・受付",
          description: "予約・順番受付への導線",
          url: `${SITE_BASE_URL}/member.html`
        },
        {
          id: "questionnaire",
          label: "来院前問診",
          description: "来院前の症状確認フォーム",
          url: `${SITE_BASE_URL}/questionnaire.html`
        },
        {
          id: "prevention",
          label: "予防予定",
          description: "ワクチン・フィラリア・健診の確認",
          url: `${SITE_BASE_URL}/prevention.html`
        },
        {
          id: "news",
          label: "お知らせ",
          description: "休診日・予防シーズン案内",
          url: `${SITE_BASE_URL}/index.html`
        },
        {
          id: "access",
          label: "診療時間・アクセス",
          description: "病院情報",
          url: `${SITE_BASE_URL}/access.html`
        }
      ]
    },

    labels: {
      owner: "飼い主",
      pet: "ペット",
      petCard: "ペット診察券",
      multiPetCard: "多頭飼いペット診察券",
      clinic: "動物病院",
      doctor: "獣医師",
      checkin: "受付",
      prevention: "予防予定",
      followup: "再診フォロー",
      lineLink: "LINE連携"
    },

    safety: {
      databasePrefix: "vet_",
      dentalTablesTouched: false,
      dentalWorkerTouched: false,
      note: "この設定はDPRO PET CARE LINE専用。歯科版 dental_qr_ 系には触れない。"
    }
  };

  function buildQuery(params) {
    const search = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        search.set(key, String(value));
      }
    });
    return search.toString();
  }

  function withClinic(url, extraParams) {
    const params = {
      clinic_code: CONFIG.clinic.clinicCode,
      ...(extraParams || {})
    };
    return `${url}?${buildQuery(params)}`;
  }

  function getAdminStorageKeys() {
    return Array.from(new Set([
      CONFIG.admin.tokenStorageKey,
      ...(CONFIG.admin.tokenStorageKeys || [])
    ].filter(Boolean)));
  }

  function getAdminCode() {
    try {
      const keys = getAdminStorageKeys();

      for (const key of keys) {
        const value = sessionStorage.getItem(key);
        if (value && String(value).trim()) return String(value).trim();
      }

      for (const key of keys) {
        const value = localStorage.getItem(key);
        if (value && String(value).trim()) return String(value).trim();
      }

      return "";
    } catch (error) {
      return "";
    }
  }

  function setAdminCode(value, persist) {
    const code = String(value || "").trim();
    try {
      const keys = getAdminStorageKeys();

      if (!code) {
        clearAdminCode();
        return;
      }

      // sessionStorage は全キーに保存
      keys.forEach((key) => sessionStorage.setItem(key, code));

      // persist指定がない画面もあるため、localStorageにも保存して画面間で揃える
      keys.forEach((key) => localStorage.setItem(key, code));
    } catch (error) {
      console.warn("管理コードの保存に失敗しました。", error);
    }
  }

  function clearAdminCode() {
    try {
      const keys = getAdminStorageKeys();
      keys.forEach((key) => sessionStorage.removeItem(key));
      keys.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      console.warn("管理コードの削除に失敗しました。", error);
    }
  }

  function getAdminHeaders(extraHeaders) {
    const code = getAdminCode();

    return {
      "Content-Type": "application/json",
      ...(code ? {
        "X-DPRO-Admin-Code": code,
        "x-dpro-admin-code": code,
        "x-admin-token": code,
        "X-Admin-Token": code,
        "X-Admin-Code": code,
        "Authorization": `Bearer ${code}`
      } : {}),
      ...(extraHeaders || {})
    };
  }

  async function apiGet(url, params, options) {
    const finalUrl = withClinic(url, params);
    const headers = options && options.admin ? getAdminHeaders() : { "Content-Type": "application/json" };

    const res = await fetch(finalUrl, {
      method: "GET",
      headers
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok === false) {
      const message = data && (data.message || data.error) ? (data.message || data.error) : `APIエラー status=${res.status}`;
      throw new Error(message);
    }
    return data;
  }

  async function apiPost(url, body, options) {
    const payload = {
      clinic_code: CONFIG.clinic.clinicCode,
      ...(body || {})
    };

    const res = await fetch(url, {
      method: "POST",
      headers: options && options.admin ? getAdminHeaders() : { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok === false) {
      const message = data && (data.message || data.error) ? (data.message || data.error) : `APIエラー status=${res.status}`;
      throw new Error(message);
    }
    return data;
  }

  const helpers = {
    buildQuery,
    withClinic,
    getAdminStorageKeys,
    getAdminCode,
    setAdminCode,
    clearAdminCode,
    getAdminHeaders,
    apiGet,
    apiPost
  };

  // STEP VET-21A：
  // 新しい画面は DPRO_CONFIG.getAdminToken を見るため、CONFIG直下にも互換関数を持たせる。
  CONFIG.getAdminToken = getAdminCode;
  CONFIG.getAdminCode = getAdminCode;
  CONFIG.setAdminToken = setAdminCode;
  CONFIG.setAdminCode = setAdminCode;
  CONFIG.clearAdminToken = clearAdminCode;
  CONFIG.clearAdminCode = clearAdminCode;
  CONFIG.getAdminHeaders = getAdminHeaders;

  // 新しいHTML用
  window.DPRO_VET_CONFIG = CONFIG;
  window.DPRO_VET_HELPERS = helpers;

  // 互換用：既存HTMLが DPRO_CONFIG / DPRO_HELPERS を見ても動くようにする
  window.DPRO_CONFIG = CONFIG;
  window.DPRO_HELPERS = helpers;

  // さらに短い別名
  window.APP_CONFIG = CONFIG;
  window.APP_HELPERS = helpers;
})();
