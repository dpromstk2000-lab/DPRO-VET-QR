/* =========================================================
  DPRO SHOP
  歯科デジタルQR診察券 / LINE公式・LIFF連携設定

  STEP 30-21D
  config.js 完全版

  重要：
  ・このファイルには秘密情報を入れない
  ・SUPABASE_SERVICE_ROLE_KEY や LINE Channel Secret は絶対に入れない
  ・ここに入れるのは公開されてもよい設定だけ
========================================================= */

(function () {
  "use strict";

  const BASE_PUBLIC_URL = "https://dpromstk2000-lab.github.io/DEGITAL-QR";
  const API_BASE_URL = "https://dpro-dental-qr-api.dpromstk2000.workers.dev";

  const CONFIG = {
    SYSTEM_NAME: "DPRO SHOP",
    SERVICE_NAME: "歯科デジタルQR診察券",
    SERVICE_COPY: "LINE公式で開ける、家族対応デジタル診察券",
    VERSION: "step-30-21e-liff-id-set",
    TIMEZONE: "Asia/Tokyo",

    CLINIC: {
      CLINIC_CODE: "dpro_dental_demo",
      PUBLIC_SLUG: "dpro-dental-demo",

      NAME: "DPRO歯科クリニック",
      NAME_KANA: "ディープロシカクリニック",

      PHONE: "000-0000-0000",
      ADDRESS: "大分県内",

      BUSINESS_HOURS_NOTE: "月・火・水・金 9:00〜18:00 / 土 9:00〜13:00",
      CLOSED_DAYS_NOTE: "木曜・日曜・祝日",

      NOTICE_TITLE: "QR診察券のご案内",
      NOTICE_BODY: "次回来院時は、この画面のQR診察券を受付でご提示ください。",

      THEME_LABEL: "LINE公式 × 家族診察券"
    },

    API: {
      BASE_URL: API_BASE_URL,
      HEALTH_URL: API_BASE_URL + "/api/health",

      ENDPOINTS: {
        MEMBER_CARD: "/api/member/card",
        MEMBER_FAMILY_CARDS: "/api/member/family-cards",
        MEMBER_LINE_LINK_STATUS: "/api/member/line-link/status",
        MEMBER_LINE_LINK_COMPLETE: "/api/member/line-link/complete",

        SCAN_LOOKUP: "/api/scan/lookup",

        OWNER_TODAY: "/api/owner/today",
        OWNER_PATIENT_SEARCH: "/api/owner/patients/search",
        OWNER_PATIENT_DETAIL: "/api/owner/patients/detail",
        OWNER_FAMILIES: "/api/owner/families",
        OWNER_FAMILY_DETAIL: "/api/owner/families/detail",

        ADMIN_PATIENT_CREATE: "/api/admin/patients/create",
        ADMIN_FAMILIES: "/api/admin/families",
        ADMIN_FAMILY_DETAIL: "/api/admin/families/detail",
        ADMIN_LINE_LINK_TOKEN_CREATE: "/api/admin/line-link-token/create",
        ADMIN_LINE_LINK_TOKENS: "/api/admin/line-link-tokens",
        ADMIN_DEMO_RESET: "/api/admin/demo/reset"
      }
    },

    PAGES: {
      BASE_PUBLIC_URL: BASE_PUBLIC_URL,

      INDEX_URL: BASE_PUBLIC_URL + "/index.html",
      MEMBER_URL: BASE_PUBLIC_URL + "/member.html",
      SCAN_URL: BASE_PUBLIC_URL + "/scan.html",
      OWNER_URL: BASE_PUBLIC_URL + "/owner.html",
      ADMIN_URL: BASE_PUBLIC_URL + "/admin.html",

      DEMO_MEMBER_URL: BASE_PUBLIC_URL + "/member.html?t=demo-dental-patient-001",
      DEMO_CHILD_TARO_URL: BASE_PUBLIC_URL + "/member.html?t=demo-dental-child-taro",
      DEMO_CHILD_SAKURA_URL: BASE_PUBLIC_URL + "/member.html?t=demo-dental-child-sakura"
    },

    LINE: {
      /*
        STEP 30-21D時点では、ここは空でOKです。

        本番でLIFF IDを取得したら、下の LIFF_ID に入れます。

        例：
        LIFF_ID: "2000000000-xxxxxxxx"

        LIFF ID を入れると、member.html が
        liff.init → liff.getProfile を実行し、
        LINE userId を取得して家族診察券と紐づけます。
      */
      USE_LIFF: true,
      LIFF_ID: "2010491267-waXBAIje",

      /*
        LINE Developers の LIFF Endpoint URL には、
        基本的にこのURLを登録します。

        本番：
        https://dpromstk2000-lab.github.io/DEGITAL-QR/member.html

        デモ確認：
        https://dpromstk2000-lab.github.io/DEGITAL-QR/member.html?t=demo-dental-patient-001
      */
      LIFF_ENDPOINT_URL: BASE_PUBLIC_URL + "/member.html",

      /*
        LINE公式リッチメニュー「診察券」ボタンのリンク先候補です。
        最初はDEMO_MEMBER_URLを使うと営業デモが簡単です。
        本番では MEMBER_URL を使い、LINE userId から家族診察券を自動表示します。
      */
      RICH_MENU_CARD_URL: "https://liff.line.me/2010491267-waXBAIje",
      RICH_MENU_DEMO_CARD_URL: "https://liff.line.me/2010491267-waXBAIje?t=demo-dental-patient-001",

      /*
        Messaging API送信は、まだこのSTEPでは使いません。
        実際の送信には Channel access token が必要です。
        それはCloudflare WorkerのSecretに保存し、このconfig.jsには入れません。
      */
      USE_MESSAGING_API: false,

      OFFICIAL_ACCOUNT_NAME: "DPRO歯科クリニック",
      OFFICIAL_ACCOUNT_ID: "",
      FRIEND_ADD_URL: ""
    },

    FEATURES: {
      FAMILY_CARDS: true,
      CHILD_CARDS: true,
      LINE_LINK: true,
      LIFF_PROFILE: true,

      QR_CARD: true,
      QR_SCAN: true,

      OWNER_DASHBOARD: true,
      ADMIN_DASHBOARD: true,

      DEMO_RESET: true,
      SALES_EXPLAIN_MODE: true,

      MESSAGING_API_SEND: false
    },

    DEMO: {
      FAMILY_CODE: "FAM-DEMO-YAMADA",
      FAMILY_NAME: "山田家",

      LINE_USER_ID: "demo-line-mother-yamada",
      LINE_DISPLAY_NAME: "山田花子（お母さん）",

      MOTHER: {
        LABEL: "お母さん",
        PATIENT_NAME: "山田 花子",
        MEMBER_NO: "D260600001",
        QR_TOKEN: "demo-dental-patient-001"
      },

      CHILD_TARO: {
        LABEL: "長男・太郎くん",
        PATIENT_NAME: "山田 太郎",
        MEMBER_NO: "D260600002",
        QR_TOKEN: "demo-dental-child-taro"
      },

      CHILD_SAKURA: {
        LABEL: "長女・さくらちゃん",
        PATIENT_NAME: "山田 さくら",
        MEMBER_NO: "D260600003",
        QR_TOKEN: "demo-dental-child-sakura"
      }
    },

    TEXT: {
      LINE_LINK_TITLE: "LINE公式との連携",
      LINE_LINK_DESCRIPTION:
        "LINE公式から診察券を開くと、このLINEアカウントと家族診察券を紐づけできます。",

      FAMILY_CARD_DESCRIPTION:
        "お母さん・保護者様のLINEに、家族の診察券をまとめて表示できます。",

      SALES_MAIN_COPY:
        "LINE公式を、デジタル診察券・家族診察券・受付・再来院フォローの入口に変えます。",

      SALES_SUB_COPY:
        "紙の診察券を家族分持ち歩く必要がなくなり、医院側はLINE友だちと患者情報を紐づけて管理できます。"
    }
  };

  /*
    既存画面との互換用。
    どちらの名前でも読めるようにしておきます。
  */
  window.DPRO_DENTAL_QR_CONFIG = CONFIG;
  window.DPRO_CONFIG = CONFIG;

  /*
    小さな共通ヘルパー。
    HTML側で必要に応じて使えます。
  */
  window.DPRO_DENTAL_QR_HELPERS = {
    getConfig() {
      return CONFIG;
    },

    get(path, fallback = "") {
      const keys = String(path || "").split(".");
      let current = CONFIG;

      for (const key of keys) {
        if (!current || typeof current !== "object" || !(key in current)) {
          return fallback;
        }

        current = current[key];
      }

      return current === undefined || current === null ? fallback : current;
    },

    getApiUrl(path) {
      const cleanPath = String(path || "").startsWith("/")
        ? String(path || "")
        : "/" + String(path || "");

      return CONFIG.API.BASE_URL.replace(/\/+$/, "") + cleanPath;
    },

    getPageUrl(pageName) {
      const key = String(pageName || "").toUpperCase() + "_URL";
      return CONFIG.PAGES[key] || CONFIG.PAGES.BASE_PUBLIC_URL;
    }
  };
})();
