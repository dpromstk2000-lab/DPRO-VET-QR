/* =========================================================
  STEP VET-1
  DPRO PET CARE LINE
  動物病院向け ペット診察券・予防フォローシステム
  config.js 完全版

  リポジトリ：DPRO-VET-QR
  営業表示名：DPRO PET CARE LINE
  説明文：LINE公式で使える、ペット診察券・予防フォローシステム

  重要：
  ・このファイルには秘密情報を入れない
  ・SUPABASE_SERVICE_ROLE_KEY や LINE Channel Secret は絶対に入れない
  ・ここに入れるのは公開されてもよい設定だけ
  ・歯科版の dental_qr_ テーブル / 既存Worker / 既存LIFF は触らない
  ・動物病院版は、別Worker・vet_ 系テーブル・別LIFFで分離する

  STEP VET-1 の状態：
  ・GitHub Pages URL は DPRO-VET-QR 用に変更済み
  ・clinic_code は dpro_vet_demo に変更済み
  ・API URL は将来作成する別Worker dpro-vet-qr-api に変更済み
  ・LIFF ID は未作成のため空欄
  ・Supabase / Worker / LIFF はまだ触らない
========================================================= */

(function () {
  "use strict";

  const BASE_PUBLIC_URL = "https://dpromstk2000-lab.github.io/DPRO-VET-QR";
  const API_BASE_URL = "https://dpro-vet-qr-api.dpromstk2000.workers.dev";

  const CLINIC_CODE = "dpro_vet_demo";
  const PUBLIC_SLUG = "dpro-vet-demo";

  const CONFIG = {
    SYSTEM_NAME: "DPRO PET CARE LINE",
    BRAND_NAME: "DPRO SHOP",
    SERVICE_NAME: "ペット診察券・予防フォローシステム",
    SERVICE_COPY: "LINE公式で使える、ペット診察券・予防フォローシステム",
    SERVICE_DESCRIPTION: "飼い主さんのLINEに複数ペットの診察券をまとめ、受付QR・来院前問診・予防案内・再診フォローにつなげる動物病院向けLINE公式DEMOです。",
    VERSION: "step-vet-1-config-dpro-pet-care-line",
    TIMEZONE: "Asia/Tokyo",

    /* 既存画面との互換用トップレベル値 */
    API_BASE_URL: API_BASE_URL,
    API_BASE: API_BASE_URL,
    CLINIC_CODE: CLINIC_CODE,
    SHOP_CODE: CLINIC_CODE,
    PUBLIC_SLUG: PUBLIC_SLUG,
    LIFF_ID: "",

    CLINIC: {
      CLINIC_CODE: CLINIC_CODE,
      SHOP_CODE: CLINIC_CODE,
      PUBLIC_SLUG: PUBLIC_SLUG,

      NAME: "DPROどうぶつ病院",
      NAME_KANA: "ディープロドウブツビョウイン",
      DISPLAY_NAME: "DPROどうぶつ病院",

      PHONE: "000-0000-0000",
      ADDRESS: "大分県内",

      BUSINESS_HOURS_NOTE: "月・火・水・金 9:00〜18:00 / 土 9:00〜13:00",
      CLOSED_DAYS_NOTE: "木曜・日曜・祝日",

      NOTICE_TITLE: "LINEペット診察券のご案内",
      NOTICE_BODY: "次回来院時は、この画面のペット診察券QRを受付でご提示ください。",
      PUBLIC_NOTE: "予防予定・再診予定は目安です。体調に不安がある場合や緊急時は、LINEではなくお電話でご相談ください。",

      THEME_LABEL: "LINE公式 × 多頭飼いペット診察券",
      OWNER_LABEL: "飼い主",
      PATIENT_LABEL: "ペット",
      FAMILY_LABEL: "多頭飼い",
      STAFF_LABEL: "受付スタッフ",
      DOCTOR_LABEL: "獣医師",
      FACILITY_LABEL: "動物病院"
    },

    API: {
      BASE_URL: API_BASE_URL,
      HEALTH_URL: API_BASE_URL + "/api/health",

      ENDPOINTS: {
        /* 公開・飼い主側 */
        PUBLIC_CLINIC: "/api/public/clinic",
        PUBLIC_CLINIC_SETTINGS: "/api/public/clinic-settings",
        MEMBER_CARD: "/api/member/card",
        MEMBER_PET_CARDS: "/api/member/pet-cards",
        MEMBER_FAMILY_CARDS: "/api/member/pet-cards",
        MEMBER_LINE_LINK_STATUS: "/api/member/line-link/status",
        MEMBER_LINE_LINK_COMPLETE: "/api/member/line-link/complete",
        MEMBER_PREVENTION: "/api/member/prevention",
        MEMBER_QUESTIONNAIRE_CREATE: "/api/member/questionnaire/create",

        /* 受付・スキャン */
        SCAN_LOOKUP: "/api/scan/lookup",
        SCAN_LOG: "/api/scan/log",
        SCAN_TODAY: "/api/scan/today",
        SCAN_CHECK_IN: "/api/scan/check-in",
        SCAN_CHECK_IN_CANCEL: "/api/scan/check-in/cancel",

        /* 獣医師画面 */
        DOCTOR_TODAY: "/api/doctor/today",
        DOCTOR_DAILY_STATUSES: "/api/doctor/daily-statuses",
        DOCTOR_EXAM_START: "/api/doctor/exam-start",
        DOCTOR_EXAM_COMPLETE: "/api/doctor/exam-complete",
        DOCTOR_MEMO_SAVE: "/api/doctor/memo-save",
        DOCTOR_LINE_FOLLOW_COPIED: "/api/doctor/line-follow-copied",

        /* オーナー画面 */
        OWNER_TODAY: "/api/owner/today",
        OWNER_DAILY_STATUSES: "/api/owner/daily-statuses",
        OWNER_DAILY_STATUS_UPDATE: "/api/owner/daily-status/update",
        OWNER_GUARDIAN_SEARCH: "/api/owner/guardians/search",
        OWNER_PET_SEARCH: "/api/owner/pets/search",
        OWNER_PET_DETAIL: "/api/owner/pets/detail",
        OWNER_FAMILIES: "/api/owner/families",
        OWNER_FAMILY_DETAIL: "/api/owner/families/detail",
        OWNER_PREVENTION_TODOS: "/api/owner/prevention-todos",
        OWNER_FOLLOWUPS: "/api/owner/followups",
        OWNER_FOLLOWUPS_UPDATE: "/api/owner/followups/update",
        OWNER_TEMPLATES: "/api/owner/templates",
        OWNER_VISIT_CREATE: "/api/owner/visits/create",
        OWNER_VISIT_UPDATE: "/api/owner/visits/update",
        OWNER_LINE_UNLINKED_GUARDIANS: "/api/owner/line-unlinked-guardians",

        /* 管理画面 */
        ADMIN_GUARDIANS: "/api/admin/guardians",
        ADMIN_GUARDIAN_CREATE: "/api/admin/guardians/create",
        ADMIN_GUARDIAN_UPDATE: "/api/admin/guardians/update",
        ADMIN_PETS: "/api/admin/pets",
        ADMIN_PET_CREATE: "/api/admin/pets/create",
        ADMIN_PET_UPDATE: "/api/admin/pets/update",
        ADMIN_PET_DETAIL: "/api/admin/pets/detail",
        ADMIN_PET_CARD_REISSUE: "/api/admin/pets/card/reissue",
        ADMIN_PET_CARD_DISABLE: "/api/admin/pets/card/disable",
        ADMIN_PET_CARD_ENABLE: "/api/admin/pets/card/enable",
        ADMIN_FAMILIES: "/api/admin/families",
        ADMIN_FAMILY_DETAIL: "/api/admin/families/detail",
        ADMIN_FAMILY_UPSERT: "/api/admin/families/upsert",
        ADMIN_FAMILY_MEMBER_ADD: "/api/admin/families/member/add",
        ADMIN_FAMILY_MEMBER_REMOVE: "/api/admin/families/member/remove",
        ADMIN_LINE_LINK_TOKEN_CREATE: "/api/admin/line-link-token/create",
        ADMIN_LINE_LINK_TOKENS: "/api/admin/line-link-tokens",
        ADMIN_PREVENTION_SCHEDULES: "/api/admin/prevention-schedules",
        ADMIN_PREVENTION_UPSERT: "/api/admin/prevention-schedules/upsert",
        ADMIN_SETTINGS: "/api/admin/settings",
        ADMIN_SPECIAL_DAYS: "/api/admin/special-days",
        ADMIN_SPECIAL_DAYS_UPSERT: "/api/admin/special-days/upsert",
        ADMIN_SPECIAL_DAYS_DELETE: "/api/admin/special-days/delete",
        ADMIN_DEMO_RESET: "/api/admin/demo/reset",
        ADMIN_SAFETY_CHECK: "/api/admin/safety-check",
        ADMIN_PRODUCTION_READINESS_CHECK: "/api/admin/production-readiness-check",

        /* 既存歯科HTMLとの一時互換キー：中身はVET用エンドポイントへ向ける */
        OWNER_PATIENT_SEARCH: "/api/owner/pets/search",
        OWNER_PATIENT_DETAIL: "/api/owner/pets/detail",
        OWNER_LINE_UNLINKED_PATIENTS: "/api/owner/line-unlinked-guardians",
        ADMIN_PATIENTS: "/api/admin/pets",
        ADMIN_PATIENT_CREATE: "/api/admin/pets/create",
        ADMIN_PATIENT_UPDATE: "/api/admin/pets/update",
        ADMIN_PATIENT_DETAIL: "/api/admin/pets/detail",
        ADMIN_PATIENT_CARD_REISSUE: "/api/admin/pets/card/reissue",
        ADMIN_PATIENT_CARD_DISABLE: "/api/admin/pets/card/disable",
        ADMIN_PATIENT_CARD_ENABLE: "/api/admin/pets/card/enable",
        ADMIN_LINE_UNLINKED_PATIENTS: "/api/admin/line-unlinked-guardians"
      }
    },

    PAGES: {
      BASE_PUBLIC_URL: BASE_PUBLIC_URL,

      INDEX_URL: BASE_PUBLIC_URL + "/index.html",
      INDEX_LIST_URL: BASE_PUBLIC_URL + "/index-list.html",
      MEMBER_URL: BASE_PUBLIC_URL + "/member.html",
      QR_URL: BASE_PUBLIC_URL + "/qr.html",
      SCAN_URL: BASE_PUBLIC_URL + "/scan.html",
      SCAN_IPAD_URL: BASE_PUBLIC_URL + "/scan-ipad.html",
      SCAN_PC_URL: BASE_PUBLIC_URL + "/scan-pc.html",
      DOCTOR_URL: BASE_PUBLIC_URL + "/doctor.html",
      OWNER_URL: BASE_PUBLIC_URL + "/owner.html",
      ADMIN_URL: BASE_PUBLIC_URL + "/admin.html",
      SYSTEM_CHECK_URL: BASE_PUBLIC_URL + "/system-check.html",
      DEMO_GUIDE_URL: BASE_PUBLIC_URL + "/demo-guide.html",
      LINE_DEMO_URL: BASE_PUBLIC_URL + "/line-demo.html",
      RICH_MENU_PREVIEW_URL: BASE_PUBLIC_URL + "/rich-menu-preview.html",

      DEMO_MEMBER_URL: BASE_PUBLIC_URL + "/member.html?t=demo-vet-pet-coco",
      DEMO_PET_COCO_URL: BASE_PUBLIC_URL + "/member.html?t=demo-vet-pet-coco",
      DEMO_PET_MOMO_URL: BASE_PUBLIC_URL + "/member.html?t=demo-vet-pet-momo",
      DEMO_PET_HANA_URL: BASE_PUBLIC_URL + "/member.html?t=demo-vet-pet-hana"
    },

    LINE: {
      /*
        STEP VET-1時点では、動物病院版LIFFはまだ作成しません。
        作成後に LIFF_ID を入れ、USE_LIFF を true にします。
      */
      USE_LIFF: false,
      LIFF_ID: "",
      LIFF_ENDPOINT_URL: BASE_PUBLIC_URL + "/member.html",

      /*
        LINE公式リッチメニュー用リンク候補。
        LIFF ID作成前は MEMBER_URL / DEMO_MEMBER_URL を使って動作確認します。
        LIFF ID作成後は https://liff.line.me/{LIFF_ID} に変更します。
      */
      RICH_MENU_CARD_URL: BASE_PUBLIC_URL + "/member.html",
      RICH_MENU_DEMO_CARD_URL: BASE_PUBLIC_URL + "/member.html?t=demo-vet-pet-coco",
      RICH_MENU_RESERVE_URL: BASE_PUBLIC_URL + "/index.html",
      RICH_MENU_QUESTIONNAIRE_URL: BASE_PUBLIC_URL + "/index.html#questionnaire",
      RICH_MENU_PREVENTION_URL: BASE_PUBLIC_URL + "/member.html?t=demo-vet-pet-coco#prevention",
      RICH_MENU_NEWS_URL: BASE_PUBLIC_URL + "/index.html#news",
      RICH_MENU_ACCESS_URL: BASE_PUBLIC_URL + "/index.html#access",

      USE_MESSAGING_API: false,
      OFFICIAL_ACCOUNT_NAME: "DPROどうぶつ病院",
      OFFICIAL_ACCOUNT_ID: "",
      FRIEND_ADD_URL: "",

      RICH_MENU_LABELS: {
        CARD: "ペット診察券",
        RESERVE: "予約・受付",
        QUESTIONNAIRE: "来院前問診",
        PREVENTION: "予防予定",
        NEWS: "お知らせ",
        ACCESS: "診療時間・アクセス"
      }
    },

    FEATURES: {
      PET_CARDS: true,
      MULTI_PET_CARDS: true,
      FAMILY_CARDS: true,
      CHILD_CARDS: false,
      GUARDIAN_MANAGEMENT: true,
      LINE_LINK: true,
      LIFF_PROFILE: false,

      QR_CARD: true,
      QR_SCAN: true,
      CHECK_IN: true,

      PREVENTION_SCHEDULES: true,
      PREVENTION_FOLLOWUP: true,
      REVISIT_FOLLOWUP: true,
      QUESTIONNAIRE: true,
      RICH_MENU_DEMO: true,

      OWNER_DASHBOARD: true,
      ADMIN_DASHBOARD: true,
      DOCTOR_DASHBOARD: true,

      DEMO_RESET: true,
      SALES_EXPLAIN_MODE: true,

      MESSAGING_API_SEND: false,
      PAYMENT: false,
      MEDICAL_RECORD_DETAIL: false,
      AI_DIAGNOSIS: false
    },

    STORAGE_KEYS: {
      ADMIN_CODE: "dpro_vet_qr_admin_code",
      STAFF_NAME: "dpro_vet_qr_staff_name",
      SELECTED_PET_TOKEN: "dpro_vet_qr_selected_pet_token",
      LINE_PROFILE: "dpro_vet_qr_line_profile"
    },

    ADMIN: {
      DEFAULT_STAFF_NAME: "受付スタッフ",
      ADMIN_LABEL: "管理者",
      OWNER_LABEL: "オーナー",
      DOCTOR_LABEL: "獣医師",
      SCAN_STAFF_LABEL: "受付スタッフ"
    },

    SCAN: {
      TITLE: "ペット診察券QR受付",
      DESCRIPTION: "飼い主さんのLINEに表示されたペット診察券QRを読み取り、来院受付を行います。",
      DEFAULT_VISIT_TYPE: "general_exam",
      DEFAULT_VISIT_STATUS: "visited",
      DEFAULT_CHECKIN_STATUS: "checked_in"
    },

    DEMO: {
      CLINIC_CODE: CLINIC_CODE,
      PUBLIC_SLUG: PUBLIC_SLUG,

      FAMILY_CODE: "VET-FAM-DEMO-TANAKA",
      FAMILY_NAME: "田中さんのペット",

      LINE_USER_ID: "demo-line-guardian-tanaka",
      LINE_DISPLAY_NAME: "田中 美咲（飼い主）",

      GUARDIAN: {
        LABEL: "飼い主",
        GUARDIAN_NAME: "田中 美咲",
        GUARDIAN_KANA: "タナカ ミサキ",
        PHONE: "000-0000-0000",
        LINE_USER_ID: "demo-line-guardian-tanaka",
        LINE_DISPLAY_NAME: "田中 美咲"
      },

      PET_COCO: {
        LABEL: "ココちゃん",
        PET_NAME: "ココ",
        PET_NAME_DISPLAY: "ココちゃん",
        SPECIES: "犬",
        BREED: "トイプードル",
        SEX: "女の子",
        AGE_LABEL: "5歳",
        MEMBER_NO: "V260600001",
        QR_TOKEN: "demo-vet-pet-coco",
        PREVENTION_LABEL: "フィラリア予防のご案内対象",
        NOTE: "皮膚が弱い。フード変更時は注意。"
      },

      PET_MOMO: {
        LABEL: "モモちゃん",
        PET_NAME: "モモ",
        PET_NAME_DISPLAY: "モモちゃん",
        SPECIES: "猫",
        BREED: "MIX",
        SEX: "女の子",
        AGE_LABEL: "3歳",
        MEMBER_NO: "V260600002",
        QR_TOKEN: "demo-vet-pet-momo",
        PREVENTION_LABEL: "健康診断おすすめ時期",
        NOTE: "キャリーが苦手。待合で落ち着きにくい。"
      },

      PET_HANA: {
        LABEL: "ハナちゃん",
        PET_NAME: "ハナ",
        PET_NAME_DISPLAY: "ハナちゃん",
        SPECIES: "犬",
        BREED: "チワワ",
        SEX: "女の子",
        AGE_LABEL: "12歳",
        MEMBER_NO: "V260600003",
        QR_TOKEN: "demo-vet-pet-hana",
        PREVENTION_LABEL: "シニア健診・再診フォロー対象",
        NOTE: "心臓の経過観察。興奮しやすいのでゆっくり対応。"
      },

      /* 既存歯科HTMLとの一時互換。後続STEPでPET表記へ置換する。 */
      MOTHER: {
        LABEL: "飼い主",
        PATIENT_NAME: "田中 美咲",
        MEMBER_NO: "V260600000",
        QR_TOKEN: "demo-vet-guardian-tanaka"
      },
      CHILD_TARO: {
        LABEL: "ココちゃん / 犬",
        PATIENT_NAME: "ココちゃん",
        MEMBER_NO: "V260600001",
        QR_TOKEN: "demo-vet-pet-coco"
      },
      CHILD_SAKURA: {
        LABEL: "モモちゃん / 猫",
        PATIENT_NAME: "モモちゃん",
        MEMBER_NO: "V260600002",
        QR_TOKEN: "demo-vet-pet-momo"
      }
    },

    PET_SPECIES: {
      dog: "犬",
      cat: "猫",
      rabbit: "うさぎ",
      hamster: "ハムスター",
      ferret: "フェレット",
      bird: "鳥",
      other: "その他"
    },

    PREVENTION_TYPES: {
      rabies: "狂犬病予防接種",
      mixed_vaccine: "混合ワクチン",
      filaria: "フィラリア予防",
      flea_tick: "ノミ・マダニ予防",
      health_check: "健康診断",
      senior_check: "シニア健診",
      revisit: "再診フォロー",
      food_followup: "フード・サプリ継続確認"
    },

    PATIENT_STATUS: {
      active: "通院中",
      new: "初回来院",
      followup: "再診フォロー",
      prevention_due: "予防案内対象",
      inactive: "しばらく来院なし",
      blocked: "利用停止",
      archived: "無効"
    },

    PET_STATUS: {
      active: "通院中",
      new: "初回来院",
      followup: "再診フォロー",
      prevention_due: "予防案内対象",
      senior: "シニアケア",
      inactive: "しばらく来院なし",
      archived: "無効"
    },

    VISIT_TYPES: {
      general_exam: "一般診療",
      vaccine: "ワクチン",
      rabies: "狂犬病予防接種",
      filaria: "フィラリア予防",
      flea_tick: "ノミ・マダニ予防",
      health_check: "健康診断",
      senior_check: "シニア健診",
      revisit: "再診",
      surgery_followup: "術後チェック",
      grooming: "トリミング相談",
      other: "その他"
    },

    VISIT_STATUS: {
      reserved: "予約あり",
      checked_in: "受付済み",
      waiting: "待機中",
      in_exam: "診察中",
      visited: "来院済み",
      completed: "診療完了",
      canceled: "キャンセル",
      no_show: "未来院"
    },

    DAILY_STATUS: {
      reserved: "予約あり",
      checked_in: "受付済み",
      in_exam: "診察中",
      completed: "診療完了",
      line_follow_copied: "LINE文面コピー済み",
      canceled: "キャンセル"
    },

    DEFAULT_MESSAGES: {
      prevention_filaria:
        "こんにちは。{{clinic_name}}です。\n\n{{pet_name}}ちゃんのフィラリア予防のご案内です。\n\n予防の時期になりましたので、ご都合のよい日にご来院ください。\n体調やお薬について気になることがあれば、このLINEにご返信ください。\n\n※緊急時はLINEではなくお電話ください。",

      prevention_vaccine:
        "こんにちは。{{clinic_name}}です。\n\n{{pet_name}}ちゃんのワクチン時期が近づいています。\n\n体調の良い日に接種できるよう、事前にご相談・ご予約ください。\n\n※接種可否は当日の体調確認後に判断します。",

      senior_check:
        "こんにちは。{{clinic_name}}です。\n\n{{pet_name}}ちゃんの年齢に合わせた健康チェックのご案内です。\n\n元気に見えても、年齢とともに体調の変化が出やすくなります。\n気になることがあれば、お気軽にご相談ください。",

      revisit_followup:
        "こんにちは。{{clinic_name}}です。\n\n先日は{{pet_name}}ちゃんのご来院ありがとうございました。\n\nその後、体調はいかがでしょうか。\n食欲・元気・お薬の飲み方などで気になることがあれば、このLINEにご返信ください。\n\n次回のご来院目安：\n{{next_appointment}}\n\n※急な体調変化や緊急時はお電話ください。",

      questionnaire_notice:
        "ご来院前に、LINEから簡単な問診を入力できます。\n症状・食欲・元気・嘔吐や下痢の有無などを事前に共有いただくと、受付後の確認がスムーズです。"
    },

    TEXT: {
      LINE_LINK_TITLE: "LINE公式との連携",
      LINE_LINK_DESCRIPTION:
        "LINE公式からペット診察券を開くと、このLINEアカウントと飼い主・ペット情報を紐づけできます。",

      FAMILY_CARD_DESCRIPTION:
        "飼い主さんのLINEに、複数ペットの診察券をまとめて表示できます。",

      MULTI_PET_CARD_DESCRIPTION:
        "犬・猫など複数のペットを、飼い主さんのLINEから切り替えて表示できます。",

      SALES_MAIN_COPY:
        "LINE公式を、ペット診察券・QR受付・来院前問診・予防案内・再診フォローの入口に変えます。",

      SALES_SUB_COPY:
        "紙の診察券を持ち歩く必要を減らし、多頭飼いの飼い主さんにも使いやすいLINE導線を作ります。病院側は予防・再診の案内対象を見える化できます。",

      OWNER_MAIN_COPY:
        "今日の受付と、これから来院につながる予防フォローが見える管理画面です。",

      SAFETY_NOTICE:
        "このDEMOは営業確認用です。実際の診療判断・緊急相談・投薬指示は、必ず動物病院の通常フローで対応してください。"
    }
  };

  function cleanText(value) {
    return String(value === undefined || value === null ? "" : value).trim();
  }

  function getConfigValue(path, fallback = "") {
    const keys = String(path || "").split(".").filter(Boolean);
    let current = CONFIG;

    for (const key of keys) {
      if (!current || typeof current !== "object" || !(key in current)) {
        return fallback;
      }
      current = current[key];
    }

    return current === undefined || current === null ? fallback : current;
  }

  function getApiUrl(path) {
    const cleanPath = String(path || "").startsWith("/")
      ? String(path || "")
      : "/" + String(path || "");

    return CONFIG.API.BASE_URL.replace(/\/+$/, "") + cleanPath;
  }

  function getPageUrl(pageName) {
    const key = String(pageName || "").toUpperCase() + "_URL";
    return CONFIG.PAGES[key] || CONFIG.PAGES.BASE_PUBLIC_URL;
  }

  function getEndpoint(key, fallback = "") {
    return CONFIG.API.ENDPOINTS[key] || fallback || "";
  }

  function getClinicCode() {
    return CONFIG.CLINIC.CLINIC_CODE || CONFIG.CLINIC_CODE || CLINIC_CODE;
  }

  function getAdminCode() {
    try {
      return localStorage.getItem(CONFIG.STORAGE_KEYS.ADMIN_CODE) || "";
    } catch (error) {
      return "";
    }
  }

  function setAdminCode(value) {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEYS.ADMIN_CODE, cleanText(value));
    } catch (error) {}
  }

  function getStaffName() {
    try {
      return localStorage.getItem(CONFIG.STORAGE_KEYS.STAFF_NAME) || CONFIG.ADMIN.DEFAULT_STAFF_NAME;
    } catch (error) {
      return CONFIG.ADMIN.DEFAULT_STAFF_NAME;
    }
  }

  function setStaffName(value) {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEYS.STAFF_NAME, cleanText(value) || CONFIG.ADMIN.DEFAULT_STAFF_NAME);
    } catch (error) {}
  }

  function todayJST() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: CONFIG.TIMEZONE || "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  }

  function formatDate(value) {
    const text = cleanText(value);
    if (!text) return "";
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return text;
    return `${Number(match[2])}/${Number(match[3])}`;
  }

  function formatDateTime(value) {
    const text = cleanText(value);
    if (!text) return "";
    const datePart = text.slice(0, 10);
    const timePart = text.slice(11, 16);
    return `${formatDate(datePart)} ${timePart}`.trim();
  }

  function formatTime(value) {
    const text = cleanText(value);
    if (!text) return "";
    const match = text.match(/(\d{1,2}):(\d{2})/);
    return match ? `${String(Number(match[1])).padStart(2, "0")}:${match[2]}` : text;
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function nl2br(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
  }

  async function copyText(value) {
    const text = String(value || "");
    if (!text) return false;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {}

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (error) {
      ok = false;
    }
    textarea.remove();
    return ok;
  }

  function getStatusLabel(value) {
    return CONFIG.PET_STATUS[value] || CONFIG.PATIENT_STATUS[value] || value || "";
  }

  function getVisitTypeLabel(value) {
    return CONFIG.VISIT_TYPES[value] || value || "";
  }

  function getVisitStatusLabel(value) {
    return CONFIG.VISIT_STATUS[value] || CONFIG.DAILY_STATUS[value] || value || "";
  }

  function buildNextAppointmentText(data) {
    const date = data?.next_appointment_date || data?.next_visit_date || data?.next_revisit_date || "";
    const time = data?.next_appointment_time || data?.next_visit_time || "";
    const memo = data?.next_appointment_memo || data?.next_visit_memo || "";
    const parts = [];
    if (date) parts.push(date);
    if (time) parts.push(String(time).slice(0, 5));
    if (memo) parts.push(memo);
    return parts.join(" ") || "未設定";
  }

  function replaceTemplateVariables(template, data = {}) {
    const petName = data.pet_name || data.patient_name || data.name || "ペット";
    const guardianName = data.guardian_name || data.owner_name || data.family_name || "飼い主様";

    const values = {
      clinic_name: data.clinic_name || CONFIG.CLINIC.NAME,
      pet_name: petName,
      patient_name: petName,
      guardian_name: guardianName,
      owner_name: guardianName,
      member_no: data.member_no || "",
      next_appointment: data.next_appointment || buildNextAppointmentText(data),
      followup_due_date: data.followup_due_date || "",
      prevention_type: data.prevention_type || "",
      last_visit_date: data.last_visit_date || "",
      today: todayJST()
    };

    let text = String(template || "");
    Object.entries(values).forEach(([key, value]) => {
      text = text.replaceAll(`{{${key}}}`, value || "");
    });
    return text;
  }

  async function apiFetch(path, options = {}) {
    const method = options.method || "GET";
    const params = Object.assign({}, options.params || {});
    params.clinic_code = params.clinic_code || getClinicCode();
    params._t = String(Date.now());

    const url = new URL(getApiUrl(path));
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value) !== "") {
        url.searchParams.set(key, String(value));
      }
    });

    const headers = Object.assign({}, options.headers || {});
    const adminCode = options.adminCode || getAdminCode();
    if (adminCode) headers["X-DPRO-Admin-Code"] = adminCode;

    const fetchOptions = {
      method,
      cache: "no-store",
      mode: "cors",
      headers
    };

    if (method !== "GET" && method !== "HEAD") {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
      fetchOptions.body = JSON.stringify(Object.assign({ clinic_code: getClinicCode() }, options.body || {}));
    }

    const response = await fetch(url.toString(), fetchOptions);
    const raw = await response.text();
    let data = {};

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (error) {
      throw new Error("API応答をJSONとして読めませんでした：" + raw.slice(0, 300));
    }

    if (!response.ok || data.ok === false) {
      throw new Error(data.message || data.error || "HTTP " + response.status);
    }

    return data;
  }

  CONFIG.utils = {
    getConfig: function () { return CONFIG; },
    get: getConfigValue,
    getConfigValue,
    getApiUrl,
    getPageUrl,
    getEndpoint,
    getClinicCode,
    getAdminCode,
    setAdminCode,
    getStaffName,
    setStaffName,
    getTodayJST: todayJST,
    todayJST,
    formatDate,
    formatDateTime,
    formatTime,
    escapeHtml,
    nl2br,
    copyText,
    getStatusLabel,
    getVisitTypeLabel,
    getVisitStatusLabel,
    buildNextAppointmentText,
    replaceTemplateVariables,
    apiFetch
  };

  /* 新しい動物病院版の正式名 */
  window.DPRO_VET_QR_CONFIG = CONFIG;
  window.DPRO_PET_CARE_LINE_CONFIG = CONFIG;

  /* 既存HTMLとの互換用。後続STEPでHTML側もVET名へ置換予定。 */
  window.DPRO_DENTAL_QR_CONFIG = CONFIG;
  window.DPRO_CONFIG = CONFIG;

  window.DPRO_VET_QR_HELPERS = CONFIG.utils;
  window.DPRO_PET_CARE_LINE_HELPERS = CONFIG.utils;
  window.DPRO_DENTAL_QR_HELPERS = CONFIG.utils;
})();
