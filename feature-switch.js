/* =========================================================
 DPRO PET CARE LINE V1.1
 Hospital Feature Switch client helper
 Version: DPRO-VET-FEATURE-SWITCH-V1.1.2
========================================================= */
(function(){
  "use strict";

  const VERSION = "DPRO-VET-FEATURE-SWITCH-V1.1.2";
  const DEFAULTS = Object.freeze({
    pet_card:true,
    multi_pet_card:true,
    reception_queue:true,
    reception_general:true,
    reception_medicine_prevention:true,
    reception_care:true,
    previsit_questionnaire:true,
    questionnaire_branching:false,
    questionnaire_images:false,
    questionnaire_consent:false,
    exact_appointment:true,
    doctor_selection:true,
    qr_checkin:true,
    congestion_view:true,
    line_call:true,
    post_visit_followup:true,
    prevention_recall:true,
    revisit_recall:true,
    multi_pet_booking:false,
    vaccine_interval_control:false,
    cancel_waitlist:false,
    hp_sync:false
  });

  const QUESTIONNAIRE_MODULE_DEFAULTS = Object.freeze({
    general:true,
    vaccine:true,
    health_check:true,
    skin:true,
    digestive:true,
    respiratory:true,
    eye:true,
    ear:true,
    urinary:true,
    injury:true,
    medicine_prevention:true,
    other:true
  });

  const state = {
    loaded:false,
    loading:null,
    clinicCode:"",
    preset:"standard",
    flags:{...DEFAULTS},
    questionnaireModules:{...QUESTIONNAIRE_MODULE_DEFAULTS},
    raw:null,
    error:null
  };

  const clean = (v)=>String(v ?? "").trim();
  const CONFIG = window.DPRO_VET_CONFIG || window.DPRO_CONFIG || window.APP_CONFIG || {};

  function getClinicCode(){
    try {
      const p = new URL(location.href).searchParams;
      return clean(p.get("clinic_code")) || clean(CONFIG?.clinic?.clinicCode) || clean(CONFIG.CLINIC_CODE) || "dpro_vet_demo";
    } catch {
      return clean(CONFIG?.clinic?.clinicCode) || "dpro_vet_demo";
    }
  }

  function getApiBase(){
    return clean(CONFIG?.api?.baseUrl || CONFIG.API_BASE_URL || CONFIG?.urls?.apiBaseUrl || "https://dpro-vet-qr-api.dpromstk2000.workers.dev").replace(/\/$/,"");
  }

  function normalize(input, defaults){
    const src = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const out = {...defaults};
    Object.keys(out).forEach((key)=>{
      if (Object.prototype.hasOwnProperty.call(src,key)) {
        out[key] = src[key] === true || src[key] === 1 || String(src[key]).toLowerCase() === "true";
      }
    });
    return out;
  }

  async function load(options={}){
    if (state.loaded && !options.force) return snapshot();
    if (state.loading && !options.force) return state.loading;

    state.loading = (async()=>{
      const clinicCode = getClinicCode();
      const url = new URL(`${getApiBase()}/api/public/clinic-settings`);
      url.searchParams.set("clinic_code",clinicCode);
      const res = await fetch(url.toString(),{method:"GET",cache:"no-store",headers:{Accept:"application/json"}});
      const data = await res.json().catch(()=>({}));
      if (!res.ok || data.ok === false) throw new Error(data.message || data.error || `Feature settings API error ${res.status}`);
      const settings = data.settings || {};
      state.clinicCode = clinicCode;
      state.preset = clean(settings.feature_preset) || "standard";
      state.flags = normalize(settings.feature_flags,DEFAULTS);
      state.questionnaireModules = normalize(settings.questionnaire_modules,QUESTIONNAIRE_MODULE_DEFAULTS);
      state.raw = data;
      state.error = null;
      state.loaded = true;
      return snapshot();
    })().catch((error)=>{
      state.clinicCode = getClinicCode();
      state.preset = "standard";
      state.flags = {...DEFAULTS};
      state.questionnaireModules = {...QUESTIONNAIRE_MODULE_DEFAULTS};
      state.raw = null;
      state.error = error;
      state.loaded = true;
      console.warn("DPRO feature settings fallback to defaults:",error);
      return snapshot();
    }).finally(()=>{ state.loading = null; });

    return state.loading;
  }

  function isEnabled(key){
    return state.flags[key] !== false;
  }

  function isQuestionnaireModuleEnabled(key){
    return state.questionnaireModules[key] !== false;
  }

  function applyDom(root=document){
    root.querySelectorAll("[data-feature]").forEach((el)=>{
      const key = clean(el.getAttribute("data-feature"));
      if (!key) return;
      const enabled = isEnabled(key);
      el.classList.toggle("dpro-feature-off",!enabled);
      el.hidden = !enabled;
      el.setAttribute("aria-hidden",enabled ? "false" : "true");
    });
    root.querySelectorAll("[data-questionnaire-module]").forEach((el)=>{
      const key = clean(el.getAttribute("data-questionnaire-module"));
      if (!key) return;
      const enabled = isQuestionnaireModuleEnabled(key);
      el.classList.toggle("dpro-feature-off",!enabled);
      el.hidden = !enabled;
      el.setAttribute("aria-hidden",enabled ? "false" : "true");
    });
    return snapshot();
  }

  function requireFeature(key, options={}){
    if (isEnabled(key)) return true;
    const message = clean(options.message) || "この機能は現在この動物病院では使用していません。";
    const target = clean(options.redirect);
    if (target) {
      const url = new URL(target,location.href);
      url.searchParams.set("clinic_code",getClinicCode());
      location.replace(url.toString());
      return false;
    }
    if (options.throwError !== false) throw new Error(message);
    return false;
  }

  function snapshot(){
    return {
      version:VERSION,
      loaded:state.loaded,
      clinic_code:state.clinicCode || getClinicCode(),
      preset:state.preset,
      flags:{...state.flags},
      questionnaire_modules:{...state.questionnaireModules},
      error:state.error ? String(state.error.message || state.error) : "",
      raw:state.raw
    };
  }

  window.DPRO_VET_FEATURES = {
    VERSION,
    DEFAULTS,
    QUESTIONNAIRE_MODULE_DEFAULTS,
    load,
    isEnabled,
    isQuestionnaireModuleEnabled,
    applyDom,
    requireFeature,
    getState:snapshot
  };
})();
