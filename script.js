// ==========================================
// 0. SUPABASE CONFIGURATION (请填写你的密钥)
// ==========================================
const SUPABASE_URL = 'https://iytxwgyhemetdkmqoxoa.supabase.co'; // 替换这里
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5dHh3Z3loZW1ldGRrbXFveG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMzI3MDIsImV4cCI6MjA3OTkwODcwMn0.ZsiueMCjwm5FoPlC3IDEgmsPaabkhefw3uHFl6gBm7Q';          // 替换这里
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// ============================================================
// 🟢 [新增] 1. 专属链接捕获 (放在文件最顶部)
// ============================================================
// ============================================================
// 🟢 [升级版] 专属链接捕获 + 验证 + 记录访问量
// ============================================================
// ============================================================
// 🟢 [增强版] 专属链接捕获 + 自动分配 Opensea (入口统一处理)
// ============================================================
window.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const rawRefCode = urlParams.get('ref'); // 获取 ?ref= 后的值

    // 🌟 情况 A: 用户带来了 referral code (可能是有效的，也可能是乱写的)
    if (rawRefCode) {
        console.log(`[CPS] 正在验证推荐码: ${rawRefCode}...`);

        try {
            // 1. 验证：这个码是否有效？
            const { data, error } = await supabaseClient
                .from('partners')
                .select('ref_code')
                .eq('ref_code', rawRefCode)
                .single();

            if (data && !error) {
                // ✅ 验证成功：是真实存在的代理商
                console.log(`[CPS] ✅ 有效推荐人: ${rawRefCode}`);
                
                // 存入本地缓存
                localStorage.setItem('solaryo_ref_code', rawRefCode);

                // 记录访问量 (仅针对真实代理商)
                await supabaseClient.from('referral_visits').insert([
                    { 
                        ref_code: rawRefCode,
                        user_agent: navigator.userAgent 
                    }
                ]);

            } else {
                // ❌ 验证失败：码是乱写的
                console.warn(`[CPS] ⚠️ 无效/伪造的推荐码，回退到 opensea。`);
                localStorage.setItem('solaryo_ref_code', 'opensea');
            }

        } catch (err) {
            console.error("[CPS] 验证出错，回退到 opensea:", err);
            localStorage.setItem('solaryo_ref_code', 'opensea');
        }
    } 
    // 🌟 情况 B: 用户完全没有带 ref 参数 (自然流量)
    else {
        // 检查之前是否已经有存过的码？(防止覆盖回头客的归属)
        // 逻辑：只有当本地完全没记录时，才标记为 opensea
        if (!localStorage.getItem('solaryo_ref_code')) {
            console.log("[CPS] 🌍 自然流量，自动标记为 opensea");
            localStorage.setItem('solaryo_ref_code', 'opensea');
        } else {
            console.log(`[CPS] 🔄 欢迎回来，保持原有归属: ${localStorage.getItem('solaryo_ref_code')}`);
        }
    }
});
// 🟢 [新增] 州与区域的映射关系 (Partner Hub)
const regionMap = {
    'Nationwide': [],
    'NSW_ACT': ['Sydney Metro', 'Western Sydney', 'Central Coast', 'Newcastle/Hunter', 'Illawarra/Wollongong', 'ACT (Canberra)', 'Regional NSW'],
    'VIC': ['Melbourne Metro', 'Geelong', 'Mornington Peninsula', 'Regional VIC'],
    'QLD': ['Brisbane', 'Gold Coast', 'Sunshine Coast', 'Regional QLD'],
    'SA': ['Adelaide', 'Regional SA'],
    'WA': ['Perth', 'Regional WA'],
    'TAS': ['Hobart', 'Launceston', 'Regional TAS'],
    'NT': ['Darwin', 'Regional NT']
};
// 全局变量：存聊天记录
let globalChatHistory = [];
// 🟢 [新增] 全局变量：存储当前选中的电池/逆变器品牌名称
let currentSelectedBrandName = "";
// ==========================================
// 1. 全局变量与配置 (Global Config & Variables)
// ==========================================
// --- [NEW] Brand & Tier Configuration ---
// ==========================================
// 1. 全局变量与配置 (Global Config & Variables)
// ==========================================
// --- [UPDATED] Brand & Tier Configuration ---
const brandConfig = {
    entry: {
        title: "Entry Tier (High Capacity Only)",
        brands: [
            // Only allows > 39kWh. Logic: Old Entry Gross * 0.5
            { id: 'felicity', name: 'Felicity', markup: 0, markupPerKwh: 0 }
        ]
    },
    medium: {
        title: "Medium Tier Brands",
        brands: [
            // Medium - Low (Base = Old Entry Price) fox only
            { id: 'fox', name: 'FoxESS', markup: 0, markupPerKwh: 0 },

            // Medium - Low (Base = Old Entry Price)
            { id: 'dyness', name: 'Dyness', markup: 0, markupPerKwh: 22 },
            { id: 'solplanet', name: 'Solplanet', markup: 0, markupPerKwh: 22 },

            // Medium - High (Base + $55/kWh)
            { id: 'goodwe', name: 'GoodWe', markup: 0, markupPerKwh: 55, tag: 'Smart' },
            { id: 'alpha', name: 'AlphaESS', markup: 0, markupPerKwh: 55, tag: 'Design' }
        ]
    },
    premium: {
        title: "Premium Tier Brands",
        brands: [
            // Premium - Low (Base = Old Medium Price ($600/kWh base))
            { id: 'sungrow', name: 'Sungrow', markup: 0, markupPerKwh: 0 },
            { id: 'sigenergy', name: 'Sigenergy', markup: 0, markupPerKwh: 0 },

            // Premium - High (Tesla = Old Premium Price ($900/kWh base))
            // Difference between Old Premium (900) and Old Medium (600) is 300.
            { id: 'tesla', name: 'Tesla', markup: 0, markupPerKwh: 300, tag: 'Tesla' }
        ]
    }
};

// 全局变量：存储 calculate 计算出来的三个档位的“裸价”（不含品牌加价）
let currentBasePrices = { entry: 0, medium: 0, premium: 0 };
let currentSelectedBrandMarkup = 0; // 当前选中的品牌加价

// Google Places & Roof Preview Variables
let autocomplete;
let extractedPostcode = "";
let extractedState = "";
const GOOGLE_API_KEY = "AIzaSyDPGUUSb3VX0CGsUgwENW0djTyl6morWTY";

// 用户用电画像状态
let userApplianceProfile = {
    wfh: false,       // 居家办公
    pool: false,      // 泳池
    ac: false,        // 空调
    general: false,   // 大型家电
    ev_now: false,    // 现有电动车
    ev_plan: false,   // 计划电动车
    hws: false,       // 电热水器
    gas2elec: false,  // 煤气改电
    backup: false,    // 停电备份
    others: false,
};

let config = {
    base_pricing: {
        solar_per_w: 0.9,
        install_base_fee: 0,
        battery_tiers: {
            entry_rate_per_kwh: 350,
            medium_rate_per_kwh: 600,
            premium_rate_per_kwh: 900,
            fixed_profit_markup: 4000
        },
        install_labor_adder: { mixed_install: 500, battery_only: 1500 },
        addon_extras: { addon_roof_terra: 800, addon_storey_double: 300, addon_storey_triple: 500, addon_shading: 1500 }
    },
    subsidy_logic: {
        fed_stc_price_net: 37.5,
        stc_deeming_years: 6,
        fed_bat_rate_per_kwh: 340,
        fed_bat_cap_kwh: 50,
        nsw_vpp_cap_kwh: 28,
        rebate_vic: 1400,
        rebate_qld: 3000,
        rebate_nsw_rate: 55,
        rebate_sa: 350
    },
    roi_logic: {
        annual_tariff_escalation_percent: 0.04,
        battery_lifespan_years: 15,
        battery_savings_penalty_threshold: 2.5
    }
};

const solarTiers = [6.6, 8, 10, 13, 15, 20];

// [智能联动推荐表]
const recommendationMap = [
    { bill: 0, solarIdx: 0, solarKw: 6.6, bat: 20, validBats: [20, 30], inverter: 5 },
    { bill: 301, solarIdx: 1, solarKw: 8, bat: 30, validBats: [30], inverter: 5 },
    { bill: 501, solarIdx: 2, solarKw: 10, bat: 40, validBats: [40], inverter: 10 },
    { bill: 1001, solarIdx: 3, solarKw: 13, bat: 40, validBats: [40], inverter: 10 },
    { bill: 1501, solarIdx: 5, solarKw: 20, bat: 50, validBats: [50], inverter: 15, is3Phase: true }
];

const i18n = {
    cn: {
        lbl_notes: "备注 / 特殊需求 (选填)",
        ph_notes: "温馨提示：如果您方便上传电费单或电表箱照片，将有助于工程师为您提供最精准的最终报价。",
        lbl_file: "上传电费单或照片 (选填)",
        title: "澳洲光伏储能智能报价器",
        subtitle: "Solaryo 官方认证引擎",
        lbl_mode: "安装模式", mode_solar: "仅太阳能", mode_bat: "加装电池", mode_both: "太阳能+电池",
        lbl_state: "所在州/领地", sec_house: "房屋详情",
        lbl_storeys: "房屋层数", storey_1: "单层", storey_2: "双层", storey_3: "三层",
        lbl_roof: "屋顶材质", roof_tin: "铁皮顶", roof_tile: "水泥瓦", roof_terra: "陶土瓦/石板",
        lbl_property_type: "房产类型", property_house: "独立屋 (House)", property_duplex: "双拼屋 (Duplex)", property_townhouse: "联排别墅 (Townhouse)", property_villa: "别墅 (Villa)", property_land: "空地 (Land)", property_unknown: "不清楚 (Unknown)",
        lbl_phase: "电相", phase_single: "单相", phase_three: "三相", phase_unknown: "不清楚",
        lbl_shade: "是否有阴影?", shade_no: "无阴影", shade_yes: "有部分遮挡",
        sec_usage: "用电情况", lbl_bill: "季度电费",
        lbl_solar_size: "新装系统大小", lbl_exist_solar: "现有太阳能系统", lbl_bat_size: "电池容量",
        note_exist_solar: "* 用于计算电池充电效率。",
        lbl_eligible: "可用补贴政策",
        reb_vic: "维州 Solar Homes 补贴 ($1,400)", reb_qld: "昆州 Battery Booster 补贴 (名额已满)",
        nsw_vpp_label: "NSW VPP 连接奖励 (BESS2)", nsw_vpp_disabled: "不可申请 (电池容量 ≥ 28kWh)",
        reb_act: "可申请 ACT $15k 无息贷款", reb_tas: "可申请 TAS 节能贷款", reb_nt: "符合 Zone 1 最高 STC 补贴标准！",
        btn_calc: "计算报价", rec_title: "专家建议：",
        res_gross: "总造价",
        res_stc_solar: "联邦 STC (太阳能)", res_stc_battery: "联邦 STC (电池 50kWh封顶)",
        res_state: "州政府 VPP 补贴",
        res_net: "预计自付 (含GST)",
        res_final_comparison: "最终净价对比 (三档方案)",
        tier_entry: "入门级", tier_medium: "中端级", tier_premium: "高端级/特斯拉",
        lead_title: "获取正式方案", lead_desc: "我们将根据您所在的州发送定制方案。", btn_submit: "提交咨询",
        unlock_title: "解锁完整报价单", unlock_desc: "输入您的联系方式以查看详细价格明细。", btn_unlock: "查看完整价格",
        disclaimer: "* 声明：所有估价均为预估值 (Estimate)，实际报价以销售人员最终报价为准。NSW补贴仅限<28kWh。",
        alert_sent: "已发送！我们会尽快联系您。",
        rec_nt: "您位于北领地 (Zone 1)，太阳能 STC 补贴全澳最高！",
        rec_loan: "提示：该州提供无息贷款，可大大降低首付压力。",
        rec_std: "标准配置，适合您的用电习惯。",
        rec_bat: "建议加装电池！(注意：NSW用户若安装>28kWh将失去州补贴)",
        rec_warn_small_solar: "⚠️ 警告：您的太阳能系统太小，无法充满这台大容量电池，升级您的系统大小。",
        warn_nsw_limit: "⚠️ 注意：电池容量超过28kWh，无法申请NSW州政府补贴。",
        warn_qld_exhausted: "⚠️ 注意：昆州 Battery Booster 补贴目前已耗尽，暂无法申请。",
        roi_title: "预计每年节省电费", payback_label: "预计回本周期：", chart_curr: "当前电费 (年)", chart_new: "安装后电费 (年)", chart_saved: "预计节省金额:", years: "年",
        err_required: "请填写所有必填字段（姓名、邮箱、电话）。", err_email: "请输入有效的邮箱地址。", err_phone: "请输入有效的澳洲电话号码（例如 04xx xxx xxx）。",
        ph_name: "姓名 (Name)*", ph_email: "电子邮箱 (Email)*", ph_phone: "电话 (Phone)*", ph_address: "安装地址 (Address)",
        badge_rec: "🌟 我们的建议",
        rec_prefix: "基于电费", rec_suffix: "，推荐配置：",
        rec_inv: "kW 逆变器", rec_phase3: "(仅限三相)",
        rec_not_rec: "由于您的季度电费较低，加装太阳能系统的回本周期会过长。从投资回报角度考量，建议您暂时无需安装。",
        vpp_title: "加入 VPP 还能再省钱！",
        vpp_desc: "连接电池到虚拟电厂，每年额外躺赚最高至 $800。",
        vpp_what_is: "(什么是 VPP?)",
        modal_vpp_title: "什么是虚拟电厂 (VPP)?",
        modal_vpp_text: "虚拟电厂 (VPP) 将您的家用电池与其他用户的电池联网。在用电高峰期，网络会自动将您存储的电能以高价卖回给电网。<br><br><strong>核心收益：</strong> 您无需任何操作即可获得被动收入抵扣电费，既帮助了电网稳定，又缩短了您的回本周期。",
        btn_final_enquiry: "提交您的咨询",
        no_obligation: "✓ 0风险 • 0骚扰 • 优质服务承诺",
        modal_conf_title: "确认联系方式",
        modal_conf_desc: "请核对您的信息。我们的工程师将尽快联系您以制定最终方案。",
        btn_confirm_send: "确认并发送正式询盘",
        alert_final_success: "收到！我们会优先处理您的咨询。",
        ph_postcode: "邮编 (Postcode)*",
        err_postcode: "请输入有效的澳洲4位邮编。",
        lbl_contact_method: "偏好联系方式", contact_phone: "电话", contact_email: "邮件", contact_sms: "短信",
        lbl_timeframe: "期望安装时间", tf_imm: "越快越好", tf_4w: "未来 4 周内", tf_3m: "未来 3 个月内", tf_later: "3个月以后 / 仅询价",
        social_proof: "已有 <span class='proof-number'>{num}+</span> 澳洲家庭获取了报价",
        roof_found: "已定位屋顶",
        lbl_appliance_trigger: "家庭能耗画像 & 需求",
        modal_profile_title: "选择您的用电设施",
        modal_profile_desc: "请选择符合您情况的选项，这将帮助我们精准计算自用率。",
        btn_done: "选好了",
        use_wfh: "居家办公", use_pool: "泳池/Spa", use_ac: "中央空调", use_general: "大型家电/烘干机",
        use_ev_now: "已有电动车", use_ev_plan: "计划买电动车",
        use_hws: "电热水器", use_gas2elec: "煤气改电", use_backup: "需要停电备份", use_others: "其他设备",
        selected_count: "已选择 {n} 项",

        lbl_budget: "您的心理预算 (选填)", // 🟢 新增
        // --- 补充导航与Tab翻译 ---
        nav_quote: "报价",
        nav_map: "地图",
        nav_partner: "合作伙伴",
        tab_join: "入驻申请",
        tab_login: "登录后台",
        // ... (在 role_brand_req 下方添加)
        role_ref: "能源推荐官", // 🔥 您指定的名称
        role_ref_tag: "高额佣金回报",
        role_ref_desc: "利用您的人脉资源变现。无论是房产中介还是社区KOL，推荐成功即可获得 $200-$500 现金奖励。",
        
        lbl_ref_source: "您的身份类型",
        opt_past_client: "老客户 / 业主",
        opt_real_estate: "房产中介 / 物业经理",
        opt_trades: "装修 / 建筑行业伙伴",
        opt_influencer_simple: "社区博主 / 团长",
        
        lbl_pay_method: "期望佣金结算方式",
        ph_pay_method: "例如：PayID, 银行转账, 现金...",
        // ...

        // --- Partner Hub CN ---
        btn_partner_hub: "服务商入口",
        p_title: "加入 Solaryo 能源网络",
        // 在 i18n.cn 中找到 p_sub 并修改：
        p_sub: "成为澳洲增长最快的能源合作伙伴<br><span style='font-size:0.9em; font-weight:600; display:block; margin-top:8px;'>请选择您的角色：</span>",
        role_inst: "光伏零售商 & 安装商",
        role_inst_tag: "线索 & 供给",
        role_inst_desc: "获取高质量线索，寻找优质货源及电工。这些交给我们，您专注安装交付。",
        role_inst_req: "要求: CEC 认证 • ABN",
        
        role_elec: "电工",
        role_elec_tag: "光伏 & 储能",
        role_elec_desc: "承接光伏、储能及充电桩安装工单。灵活补位，填满您的日程空档。",
        role_elec_req: "优先: 电工执照 • CEC • 学徒",
        
        role_brand: "品牌方 & 供应商",
        role_brand_desc: "将您的产品上架至我们的智能报价引擎。直连 500+ 安装商，实时洞察市场趋势。",
        role_brand_req: "对象: 厂家 • 分销商",
        
        p_contact_text: "服务商支持: info@solaryo.com.au",
        p_back: "‹ 返回",
        p_reg_title: "注册申请",
        lbl_biz_details: "详细信息", /* 修改为 Details */
        
        lbl_biz_type: "商业实体类型",
        opt_company: "公司 (Company)",
        opt_sole: "个体户 (Sole Trader)",
        opt_partner: "合伙 (Partnership)",
        opt_private: "私人 (Private)",
        
        lbl_company_name: "公司 / 经营名称",
        lbl_abn: "ABN / ACN",
        lbl_contact: "联系人姓名",
        lbl_phone: "电话 (手机/座机)",
        lbl_email: "电子邮箱",
        lbl_address: "地址",
        lbl_notes: "备注 / 其他说明 (选填)",
        
        lbl_biz_focus: "业务重心",
        opt_retailer: "销售线索",
        opt_installer: "招聘电工",
        opt_both: "寻找货源",
        opt_all: "以上都要", // 🟢 新增

        map_mode_consumer: "我是房主",
        map_mode_provider: "我是安装商",
        btn_live_map: "活点地图",
        
        lbl_cec: "CEC 认证编号",
        lbl_svc_area: "服务区域",
        lbl_svc_state: "服务所在的州/领地",
        lbl_svc_regions: "具体服务区域 (可多选)",
        opt_nationwide: "全澳洲 (Nationwide)",
        opt_nsw_act: "新州 & 堪培拉 (NSW & ACT)",
        txt_all_au: "✅ 已选择全澳覆盖模式",
        
        lbl_elec_level: "电工等级",
        opt_licensed: "持牌电工 (General)",
        opt_cec_elec: "CEC 认证电工",
        opt_apprentice: "电工学徒",
        lbl_exp: "安装经验 (多选)",
        lbl_license: "执照号码 (License No.)",
        lbl_upload_ins: "上传文件 (COC/Lic/Others)",
        lbl_dist_brands: "代理品牌",
        lbl_prod_cat: "产品类别",
        lbl_upload_prod: "上传产品清单/价格表 (选填)",
        
        btn_submit_app: "提交申请",
        msg_submitting: "正在提交...",
        msg_success: "申请提交成功！✓",
        msg_err_phone: "错误：请输入有效的澳洲电话号码",
        msg_err_email: "错误：请输入有效的邮箱地址",
        msg_err_general: "提交失败，请重试。",

        // 在 i18n.cn 中添加:
        flash_title: "⚡ 60秒获取精准报价",
        flash_subtitle: "电池补贴即将调整，立即查看您的资格！",
        // 在 cn 对象里找个地方加这两行
        partner_note: "说明：合作伙伴为【邀约制】。请先填表申请，资质审核通过后，我们将为您开通账户。",
        btn_apply: "提交入驻申请",

        // Partner Access Modal
        pa_title: "🔒 合作伙伴入口",
        paa_title: "合作伙伴入口",
        pa_desc: "请输入账号密码以解锁线索详情。",
        ph_email_simple: "电子邮箱",
        ph_password: "登录密码",
        pa_forgot: "忘记密码？",
        pa_login_btn: "登录后台",

        lbl_ambassador: "推广大使",      // 或者 "能源推广大使"
        lbl_industry: "行业合作伙伴",    // 或者 "商业合作伙伴"

        // ...
        pa_benefits_title: "为什么加入 Solaryo 合作伙伴？",
        
        ben_1_title: "查看推荐进度",
        ben_1_desc: "实时追踪推荐状态，透明结算。",
        
        ben_2_title: "获取精准线索",
        ben_2_desc: "直接对接高意向、已验证的订单。",
        
        ben_3_title: "分享安装心得",
        ben_3_desc: "与行业专家交流技术与避坑经验。",
        
        ben_4_title: "寻找优质伙伴",
        ben_4_desc: "链接顶尖品牌方与靠谱安装商。",

        // [新增] 底部悬浮栏 & 假加载
        sticky_net: "预估净价",
        btn_book_now: "咨询",
        step_1: "正在分析用电量和系统配置...",
        step_2: "正在计算联邦与州政府补贴...",
        step_3: "正在比对售商报价...",
        quote_ready: "报价已生成！",

        chat_agent: "Solaryo 智能客服",
        chat_online: "在线",
        chat_welcome: "👋 您好！我是您的太阳能助手。<br>关于报价、电池或补贴有什么可以帮您的吗？",
        chat_placeholder: "请输入您的问题...",
        chat_just_now: "刚刚",
        

        // --- Hero / Inline Analysis ---
        inline_max_capacity: "最大装机容量",
        inline_roof_area: "预估屋顶面积",
        inline_est_max_gen: "预估最大发电量", // 修改点 2
        inline_value_label: "产值(搭配电池)：",
        inline_month_gen_title: "月度发电量 (估算)",
        inline_battery_reco: "您的屋顶发电潜力巨大，建议加装电池，提高自发自用并减少电网依赖。",
        
        // 按钮
        btn_sat: "卫星图",
        btn_heat: "热力图",
        inline_btn_yes: "✅ 是的，我有光伏",
        inline_btn_no: "❌ 没有（新装方案）",

        inline_orientation: "屋顶主朝向",
        // 方向
        dir_n: "正北 (最佳)",
        dir_ne: "东北",
        dir_e: "正东",
        dir_se: "东南",
        dir_s: "正南",
        dir_sw: "西南",
        dir_w: "正西",
        dir_nw: "西北",

        guide_title: "想要更精准的方案？",
        guide_desc: "请在下方完善您的电费和房屋信息，获取精确报价。",

        // Disclaimer
        inline_disclaimer_1: "* 声明：影像数据基于 Google Maps，仅供估算参考。",
        inline_disclaimer_2: "预估数据是以房屋光照和最大装机量估算，实际发电量以实际配置为准。", // 修改点 1

        // 环保数据 (新)
        env_label_plant: "相当于种植",
        env_unit_trees: "棵树 / 年",
        env_desc_trees: "二氧化碳吸收抵消",
        
        env_label_save: "相当于节省",
        env_unit_cars: "辆车 / 年",
        env_desc_cars: "避免的燃油排放",
        
        // 分数描述
        inline_grade_excellent: "极佳",
        inline_grade_good: "良好",
        inline_grade_fair: "一般",
        inline_score_desc_excellent: "日照充足且遮挡风险低，适合高效方案。",
        inline_score_desc_good: "整体表现良好，优化排布可进一步提升。",
        inline_score_desc_fair: "可能存在遮挡或屋顶空间限制，建议做定制化设计。",
    },
    en: {

        // --- Inline Solar Analysis (Hero) ---
        inline_data_source_title: "Data Source",
        inline_imagery_quality_label: "Required quality:",
        inline_imagery_date_label: "Imagery date:",
        inline_imagery_disclaimer: "Due to Google coverage limits, some rooftops may be less accurate (MEDIUM coverage expansion applied).",
        inline_month_model_tag: "Seasonality model (estimated)",
        inline_battery_reco: "Your roof shows strong generation potential — we recommend adding a battery to capture more self-consumption and reduce grid reliance.",
        inline_sunshine_score: "Sunshine / Shade Score",
        inline_capacity_score: "Installable Capacity Score",
        inline_grade_excellent: "Excellent",
        inline_grade_good: "Good",
        inline_grade_fair: "Fair",
        inline_score_desc_excellent: "Strong irradiation signals and low shade risk — ideal for high output.",
        inline_score_desc_good: "Good sunlight profile. Layout optimization can improve results further.",
        inline_score_desc_fair: "Some shading or limited roof area detected. A tailored design is recommended.",
        inline_max_capacity: "Max Capacity",
        inline_est_generation: "Est. Generation",
        inline_value_label: "Value（with battery):",
        inline_env_trees: "Trees",
        inline_env_cars: "Cars",
        inline_btn_yes: "✅ Yes, I do",
        inline_btn_no: "❌ No (New Setup)",
        lbl_notes: "Notes / Special Requirements (Optional)",
        ph_notes: "Tip: Uploading your electricity bill or a photo of your switchboard helps us provide the most accurate quote possible.",
        lbl_file: "Upload Bill or Photo (Optional)",
        title: "Smart Solar & Battery Quote",
        subtitle: "Official Solaryo Engine",
        lbl_mode: "Installation Mode", mode_solar: "Solar Only", mode_bat: "Battery Only", mode_both: "Solar + Battery",
        lbl_state: "State / Territory", sec_house: "Property Details",
        lbl_storeys: "Storeys", storey_1: "Single Storey", storey_2: "Double Storey", storey_3: "Triple Storey",
        lbl_roof: "Roof Type", roof_tin: "Tin/Metal", roof_tile: "Tile", roof_terra: "Terracotta / Slate",
        lbl_property_type: "Property Type", property_house: "House", property_duplex: "Duplex", property_townhouse: "Townhouse", property_villa: "Villa", property_land: "Land", property_unknown: "Unknown",
        lbl_phase: "Phase Type", phase_single: "Single Phase", phase_three: "Three Phase", phase_unknown: "Unknown",
        lbl_shade: "Shading?", shade_no: "No Shade", shade_yes: "Partial Shade",
        sec_usage: "Usage Profile", lbl_bill: "Quarterly Bill",
        lbl_solar_size: "New System Size", lbl_exist_solar: "Existing Solar System", lbl_bat_size: "Battery Storage",
        note_exist_solar: "* Needed for charging calculation.",
        lbl_eligible: "Incentives & Rebates",
        reb_vic: "VIC Solar Homes Rebate ($1,400)", reb_qld: "QLD Battery Booster (Allocation Exhausted)",
        nsw_vpp_label: "NSW VPP Connection Incentive", nsw_vpp_disabled: "Ineligible (Capacity ≥ 28kWh)",
        reb_act: "Eligible for ACT $15k Interest-Free Loan", reb_tas: "Eligible for TAS Energy Saver Loan", reb_nt: "Eligible for Zone 1 High Subsidy!",
        btn_calc: "Get Quote", rec_title: "Our Recommendation:",
        res_gross: "Gross Price",
        res_stc_solar: "Federal Solar STC", res_stc_battery: "Federal Battery STC (50kWh Cap)",
        res_state: "State VPP Incentive (<28kWh)",
        res_net: "Total Net Price (Inc. GST)",
        res_final_comparison: "Final Net Price Comparison",
        tier_entry: "Entry", tier_medium: "Medium", tier_premium: "Premium/Tesla",
        lead_title: "Lock in Quote", lead_desc: "Get a formal consultation based on your location.", btn_submit: "Send Enquiry",
        unlock_title: "UNLOCK FULL QUOTE", unlock_desc: "Enter your details to reveal the net price breakdown.", btn_unlock: "Reveal Price",
        disclaimer: "* Disclaimer: All quotes are estimates only.",
        alert_sent: "Enquiry Sent! We will contact you shortly.",
        rec_nt: "Zone 1 (NT) offers the highest Solar STC rebate in Australia!",
        rec_loan: "Tip: Interest-Free Loans available in this state.",
        rec_std: "Standard setup matches your usage.",
        rec_bat: "Battery Recommended! (Note: NSW State rebate void if >28kWh)",
        rec_warn_small_solar: "⚠️ Warning: Your solar system is too small to fully charge this large battery，upgrade your system size.",
        warn_nsw_limit: "⚠️ Alert: System ≥28kWh is ineligible for NSW VPP Rebate.",
        warn_qld_exhausted: "⚠️ Note: QLD Battery Booster allocation is currently exhausted.",
        roi_title: "Estimated Annual Savings", payback_label: "Est. Payback Period:", chart_curr: "Current Bill", chart_new: "New Bill", chart_saved: "EST. Annual Savings:", years: "Years",
        err_required: "Please fill in all required fields (Name, Email, Phone).", err_email: "Please enter a valid email address.", err_phone: "Please enter a valid Australian phone number.",
        ph_name: "Name*", ph_email: "Email*", ph_phone: "Phone*", ph_address: "Installation Address",
        badge_rec: "🌟 Our Recommendation",
        rec_prefix: "Based on bill", rec_suffix: ", recommended:",
        rec_inv: "kW Inverter", rec_phase3: " (3-Phase Only)",
        rec_not_rec: "Given your low quarterly bill, payback period would be excessive.",
        vpp_title: "Join VPP & Earn Extra!", vpp_desc: "Connect battery to earn an extra up to $800/year.", vpp_what_is: "(What is VPP?)",
        modal_vpp_title: "What is a Virtual Power Plant (VPP)?", modal_vpp_text: "A VPP connects your home battery to a network of other batteries. During times of high electricity demand, the network automatically sells your stored energy back to the grid at premium rates.<br><br><strong>Benefit:</strong> You earn passive income credits without lifting a finger, helping the grid while reducing your own payback period.",
        btn_final_enquiry: "submit your enquiry",
        no_obligation: "✓ Risk-free • No Spam • Premium Service",
        modal_conf_title: "Final Confirmation", modal_conf_desc: "Please verify your details.",
        btn_confirm_send: "Confirm & Send Enquiry",
        alert_final_success: "Received! We will prioritize your enquiry.",
        ph_postcode: "Postcode*", err_postcode: "Please enter a valid 4-digit Postcode.",
        lbl_contact_method: "Preferred Contact Method", contact_phone: "Phone", contact_email: "Email", contact_sms: "SMS",
        lbl_timeframe: "Preferred Installation Time", tf_imm: "Immediately", tf_4w: "In the next 4 weeks", tf_3m: "In the next 3 months", tf_later: "Over 3 months / Ballpark price",
        social_proof: "Already <span class='proof-number'>{num}+</span> Aussie families requested quotes",
        roof_found: "Roof Detected",
        lbl_appliance_trigger: "Energy Profile & Needs",
        modal_profile_title: "Select Energy Profile",
        modal_profile_desc: "Select all that apply for accurate ROI calculation.",
        btn_done: "Done",
        use_wfh: "Home Office", use_pool: "Pool / Spa", use_ac: "Central A/C", use_general: "Large Appliances",
        use_ev_now: "EV (Existing)", use_ev_plan: "EV (Planned)",
        use_hws: "Elec Hot Water", use_gas2elec: "Gas to Electric", use_backup: "Need Backup", use_others: "Others",
        selected_count: "{n} items selected",
        // 在 i18n.en 中添加:
        flash_title: "⚡ Discover Savings in 60 seconds",
        flash_subtitle: "Rebates are changing soon. Check eligibility now!",

        lbl_budget: "Target Budget (Opt.)", // 🟢 新增
        btn_live_map: "Live Map",
        // --- Supplement Nav & Tab ---
        nav_quote: "Quote",
        nav_map: "Map",
        nav_partner: "Partner",
        tab_join: "Join Network",
        tab_login: "Partner Login",

        // ...
        pa_benefits_title: "WHY JOIN SOLARYO PARTNER HUB?",
        
        ben_1_title: "Track Progress",
        ben_1_desc: "Real-time updates on referrals & payouts.",
        
        ben_2_title: "Verified Leads",
        ben_2_desc: "Access high-intent, ready-to-install jobs.",
        
        ben_3_title: "Tech Community",
        ben_3_desc: "Share insights & installation experiences.",
        
        ben_4_title: "Quality Network",
        ben_4_desc: "Connect with top brands & trusted installers.",

        lbl_ambassador: "Energy Ambassador",
        lbl_industry: "Industry Partners",
        // ... (在 role_brand_req 下方添加)
        role_ref: "Referral Partner",
        role_ref_tag: "Commission Rewards",
        role_ref_desc: "Turn your network into net worth. Ideal for agents & influencers. Earn $200-$500 per successful referral.",
        
        lbl_ref_source: "I am a...",
        opt_past_client: "Past Customer / Homeowner",
        opt_real_estate: "Real Estate / Strata Agent",
        opt_trades: "Builder / Tradie",
        opt_influencer_simple: "Influencer / Community Leader",
        
        lbl_pay_method: "Preferred Payout Method",
        ph_pay_method: "e.g. Bank Transfer, PayID...",
        // ...

        // 在 en 对象里找到合适的位置加入：
        map_mode_consumer: "I'm a Homeowner",
        map_mode_provider: "I'm an Installer",
        // 在 en 对象里找个地方加这两行
        partner_note: "Note: Partnership is <strong>invite-only</strong>. Accounts are issued after application & verification.",
        btn_apply: "Apply for Access",
        // Partner Access Modal
        pa_title: "🔒 Partner Access",
        paa_title: "Partner Access",
        pa_desc: "Enter credentials to unlock lead details.",
        ph_email_simple: "Email Address",
        ph_password: "Password",
        pa_forgot: "Forgot Password?",
        pa_login_btn: "Login",

        // --- Partner Hub EN ---
        btn_partner_hub: "Partner Hub",
        p_title: "Partner Hub",
        // 在 i18n.cn 中找到 p_sub 并修改：
        p_sub: "Join Australia's fastest-growing energy network.<br><span style='font-size:0.9em; font-weight:600; display:block; margin-top:8px;'>Please select your role:</span>",
        role_inst: "Solar Retailer & Installer",
        role_inst_tag: "Leads & Supply",
        role_inst_desc: "Access pre-qualifed solar & battery leads but also stocks & electricians. We handle the these. you handle the jobs.",
        role_inst_req: "Req: CEC Accreditation • ABN",
        
        role_elec: "Electrician",
        role_elec_tag: "Solar & ESS",
        role_elec_desc: "Pick up jobs for solar, battery, EV charger installs, and more. Perfect for flling your schedule.",
        role_elec_req: "Prefer: Elec License • CEC • Apprentice",
        
        role_brand: "Vendor & Supplier",
        role_brand_desc: "List your products in our guoting engine. Connect directly with 500+ installers and track market trends.",
        role_brand_req: "For: Manufacturers • Distributors",
        
        p_contact_text: "Partner Support: info@solaryo.com.au",
        p_back: "‹ Back",
        p_reg_title: "Registration",
        lbl_biz_details: "Details", /* Shortened */
        
        lbl_biz_type: "Business / Entity Type",
        opt_company: "Company (Pty Ltd)",
        opt_sole: "Sole Trader",
        opt_partner: "Partnership",
        opt_private: "Private / Individual",
        
        lbl_company_name: "Company / Trading Name",
        lbl_abn: "ABN / ACN",
        lbl_contact: "Contact Person",
        lbl_phone: "Phone (Mobile/Landline)",
        lbl_email: "Email Address",
        lbl_address: "Address",
        lbl_notes: "Notes / Comments (Optional)",
        
        lbl_biz_focus: "Business Focus",
        opt_retailer: "Get Leads",
        opt_installer: "Find Electrician",
        opt_both: "Source suppliers",
        opt_all: "All of the above", // 🟢 新增
        
        lbl_cec: "CEC Accreditation Number",
        lbl_svc_area: "Service Areas",
        lbl_svc_state: "Service State / Territory",
        lbl_svc_regions: "Specific Regions (Multi-select)",
        opt_nationwide: "Nationwide (All Australia)",
        opt_nsw_act: "NSW & ACT",
        txt_all_au: "✅ Nationwide coverage selected",
        
        lbl_elec_level: "Electrician Level",
        opt_licensed: "Licensed Electrician (General)",
        opt_cec_elec: "CEC Accredited Electrician",
        opt_apprentice: "Electrician Apprentice",
        lbl_exp: "Installation Experience (Multi-select)",
        lbl_license: "License No.",
        lbl_upload_ins: "Upload files (COC/Lic/Others)",
        lbl_dist_brands: "Brands Distributed",
        lbl_prod_cat: "Product Categories",
        lbl_upload_prod: "Upload Product List / Pricing (Optional)",
        
        btn_submit_app: "Submit Application",
        msg_submitting: "Submitting...",
        msg_success: "Application Received! ✓",
        msg_err_phone: "Error: Invalid AU Phone Number",
        msg_err_email: "Error: Invalid Email Address",
        msg_err_general: "Error. Please try again.",

        // --- Hero / Inline Analysis ---
        inline_max_capacity: "Max Capacity",
        inline_roof_area: "Roof Area (Est.)",
        inline_est_max_gen: "Est. Max Generation", // 修改点 2
        inline_value_label: "Value(with battery):",
        inline_month_gen_title: "Monthly Generation(est.)",
        inline_battery_reco: "Your roof shows strong generation potential — we recommend adding a battery.",

        // Buttons
        btn_sat: "Satellite",
        btn_heat: "Heatmap",
        inline_btn_yes: "✅ Yes, I have Solar",
        inline_btn_no: "❌ No (New Setup)",

        // Disclaimer
        inline_disclaimer_1: "* Disclaimer: Imagery based on Google Maps data. Estimates only.",
        inline_disclaimer_2: "Estimated values based on roof irradiance and max capacity. Actual output depends on final system configuration.", // 修改点 1

        // Env Data (New)
        env_label_plant: "Equivalent to planting",
        env_unit_trees: "trees / year",
        env_desc_trees: "CO2 absorption offset",
        
        env_label_save: "Equivalent to saving",
        env_unit_cars: "cars / year",
        env_desc_cars: "Petrol emissions avoided",

        // ... 原有翻译 ...
        inline_orientation: "Dominant Orientation",
        // Directions
        dir_n: "North (Ideal)",
        dir_ne: "North East",
        dir_e: "East",
        dir_se: "South East",
        dir_s: "South",
        dir_sw: "South West",
        dir_w: "West",
        dir_nw: "North West",

        // ... 原有翻译 ...
        guide_title: "Want precise savings?",
        guide_desc: "Enter your bill details below to unlock accurate ROI.",

        // Score Desc
        inline_grade_excellent: "Excellent",
        inline_grade_good: "Good",
        inline_grade_fair: "Fair",
        inline_score_desc_excellent: "Strong irradiation signals and low shade risk — ideal for high output.",
        inline_score_desc_good: "Good sunlight profile. Layout optimization can improve results further.",
        inline_score_desc_fair: "Some shading or limited roof area detected. A tailored design is recommended.",

        // [New] Sticky Footer & Fake Loader
        sticky_net: "Total Net Price",
        btn_book_now: "Enquiry",
        step_1: "Analyzing usage profile and system configuration...",
        step_2: "Calculating Federal & State Rebates...",
        step_3: "Comparing pricing across retailers...",
        quote_ready: "Quote Ready!",

        chat_agent: "Solaryo Expert",
        chat_online: "Online",
        chat_welcome: "👋 Hi there! I'm your virtual solar assistant. <br>Need help with the quote, battery advice, or pricing?",
        chat_placeholder: "Type a message...",
        chat_just_now: "Just now"
    }
};

// --- 2. 交互逻辑 (Interaction) ---

let curLang = 'en';
let curMode = 'solar';
let selectedTier = 'medium';
let currentRecValues = { solarIdx: -1, validBats: [] };

function setLang(lang) {
    curLang = lang;
    
    // 🔴 [核心修复] 不要直接覆盖 className，而是只增删语言类
    // 之前是 document.body.className = 'lang-' + lang; (这会把 hide-fomo 删掉)
    // 改为：
    document.body.classList.remove('lang-en', 'lang-cn'); // 先移除旧的
    document.body.classList.add('lang-' + lang);          // 再加新的

    // 🟢 [同步高亮按钮逻辑] (保持之前的修复)
    const switchers = document.querySelectorAll('.lang-switch');
    switchers.forEach(group => {
        const btns = group.querySelectorAll('button');
        btns.forEach(b => b.classList.remove('active'));
        if (lang === 'cn') {
            if (btns[0]) btns[0].classList.add('active');
        } else {
            if (btns[1]) btns[1].classList.add('active');
        }
    });

    // --- 翻译逻辑 ---
    
    // 1. 普通文本
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[lang] && i18n[lang][key]) {
            if (el.tagName === 'INPUT' && el.hasAttribute('placeholder')) { 
                // do nothing
            } else {
                el.innerHTML = i18n[lang][key];
            }
        }
    });

    // 2. 输入框 Placeholder
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        const key = el.getAttribute('data-i18n-ph');
        if (i18n[lang] && i18n[lang][key]) {
            el.placeholder = i18n[lang][key];
        }
    });

    // --- 更新其他动态组件 ---
    updateSocialProof();
    updateTriggerText();
    checkRebates();
    
    // 只有当结果卡片已经显示时，才重新计算价格
    if (document.getElementById('result-card').style.display === 'block') {
        calculate(false);
    }
}

// ==========================================
// 2. 交互逻辑 (Interaction) - Updated setMode
// ==========================================
function setMode(mode) {
    curMode = mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-' + mode).classList.add('active');

    const groups = {
        solar: document.getElementById('group-solar'),
        exist: document.getElementById('group-exist-solar'),
        shade: document.getElementById('group-shade'),
        battery: document.getElementById('group-battery'),
        solarPropertyFields: document.getElementById('solar-property-fields'),
        batteryPropertyFields: document.getElementById('battery-property-fields')
    };

    if (mode === 'battery') {
        groups.solar.style.display = 'none'; groups.exist.style.display = 'block'; groups.shade.style.display = 'none';
        groups.battery.style.display = 'block'; groups.solarPropertyFields.style.display = 'none'; groups.batteryPropertyFields.style.display = 'grid';
    } else if (mode === 'both') {
        groups.solar.style.display = 'block'; groups.exist.style.display = 'none'; groups.shade.style.display = 'block';
        groups.battery.style.display = 'block'; groups.solarPropertyFields.style.display = 'grid'; groups.batteryPropertyFields.style.display = 'grid';
    } else {
        // Solar Only
        groups.solar.style.display = 'block'; groups.exist.style.display = 'none'; groups.shade.style.display = 'block';
        groups.battery.style.display = 'none'; groups.solarPropertyFields.style.display = 'grid'; groups.batteryPropertyFields.style.display = 'none';
    }

    // 1. 检查各州补贴资格 (变灰逻辑)
    checkRebates();

    // 2. 🟢 核心修复：如果结果卡片已经显示出来了，切换模式时必须立即重算！
    // 这样才能刷新 VPP Banner 的显示状态，以及重新计算不同模式下的价格。
    if (document.getElementById('result-card').style.display === 'block') {
        calculate(false);
    }
}

// ==========================================
// [UPDATED] 数值更新逻辑 (修复：拖动滑块时立即检查补贴)
// ==========================================
function updateVal(type) {
    const solarInput = document.getElementById('solar-input');
    const batInput = document.getElementById('bat-input');
    const badgeSolar = document.getElementById('badge-solar');
    const badgeBat = document.getElementById('badge-bat');

    // 1. 更新界面显示的数字
    if (type === 'solar') document.getElementById('solar-val').innerText = solarTiers[parseInt(solarInput.value)];
    if (type === 'exist-solar') document.getElementById('exist-solar-val').innerText = solarTiers[parseInt(document.getElementById('exist-solar-input').value)];

    if (type === 'battery') {
        document.getElementById('bat-val').innerText = batInput.value;
        // 🟢 [核心修复] 拖动电池滑块时，立即检查补贴状态 (是否变灰)
        checkRebates();
    }

    if (type === 'bill') document.getElementById('bill-val').innerText = document.getElementById('bill-input').value;
    // 🟢 [新增] 预算滑块逻辑
    if (type === 'budget') {
        const val = parseInt(document.getElementById('budget-input').value);
        document.getElementById('budget-val').innerText = val.toLocaleString();
        
        // 如果结果已显示，拖动时实时切换推荐档位
        if (document.getElementById('result-card').style.display === 'block') {
            autoSelectTierByBudget(val);
        }
    }
    // 2. 账单滑块的特殊逻辑 (智能推荐)
    if (type === 'bill') {
        const billVal = parseFloat(document.getElementById('bill-input').value);
        let rec = recommendationMap[0];
        for (let i = 0; i < recommendationMap.length; i++) {
            if (billVal >= recommendationMap[i].bill) rec = recommendationMap[i];
        }
        currentRecValues.solarIdx = rec.solarIdx;
        currentRecValues.validBats = rec.validBats;

        solarInput.value = rec.solarIdx;
        document.getElementById('solar-val').innerText = solarTiers[rec.solarIdx];
        batInput.value = rec.bat;
        document.getElementById('bat-val').innerText = rec.bat;

        // 账单变化也会改变电池大小，所以这里也要检查补贴
        checkRebates();

        if (curMode !== 'battery' && billVal <= 200) {
            badgeSolar.style.display = 'none'; badgeBat.style.display = 'none';
        } else {
            badgeSolar.style.display = 'inline-block'; badgeBat.style.display = 'inline-block';
        }
        if (document.getElementById('result-card').style.display === 'block') calculate(false);
    }

    // 3. 徽章显示逻辑
    if (type === 'solar') {
        if (parseInt(solarInput.value) !== currentRecValues.solarIdx) badgeSolar.style.display = 'none';
        else if (currentRecValues.solarIdx !== -1) badgeSolar.style.display = 'inline-block';
    }
    if (type === 'battery') {
        const curBat = parseInt(batInput.value);
        if (!currentRecValues.validBats.includes(curBat)) badgeBat.style.display = 'none';
        else if (currentRecValues.validBats.length > 0) badgeBat.style.display = 'inline-block';
    }
}

// [MODIFIED] 选择档位：不仅高亮盒子，还要渲染下方的品牌
function selectTier(tier) {
    selectedTier = tier; // 更新全局变量

    // 1. UI 高亮档位盒子
    document.querySelectorAll('.tier-box').forEach(box => box.classList.remove('active'));
    document.getElementById(`box-${tier}`).classList.add('active');

    // 2. 渲染该档位下的品牌列表
    renderBrands(tier);
}

// [NEW] 渲染品牌列表
function renderBrands(tier) {
    const container = document.getElementById('brand-selection-container');
    const list = document.getElementById('brand-list');
    const title = document.getElementById('brand-area-title');

    // Solar Only 模式隐藏逻辑 (保持不变)
    if (curMode === 'solar') {
        if (container) container.style.display = 'none';
        const basePrice = currentBasePrices[tier] || 0;
        const fmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
        const outNet = document.getElementById('out-net');
        if (outNet) outNet.innerText = fmt.format(basePrice);
        const stickyPrice = document.getElementById('sticky-net-price');
        if (stickyPrice) stickyPrice.innerText = fmt.format(basePrice);
        return;
    }

    if (!container || !list) return;

    const config = brandConfig[tier];
    if (!config) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    if (title) title.innerText = config.title;
    list.innerHTML = '';

    config.brands.forEach((brand, index) => {
        const div = document.createElement('div');
        div.className = 'brand-card';
        div.onclick = () => selectBrand(brand.id, brand.markup, tier);
        div.id = `brand-${brand.id}`;

        // 🟢 [核心修改] 图片 + 文字的组合
        // 逻辑：默认显示图片。
        // onerror="..." 的意思是：如果图片加载失败（比如你还没上传），就自动隐藏图片，并显示下面的文字 span。
        let html = `
            <img 
                src="${brand.id}.png" 
                class="brand-logo-img" 
                alt="${brand.name}" 
                onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
            >
            <span class="brand-name-fallback" style="display:none;">${brand.name}</span>
        `;

        div.innerHTML = html;
        list.appendChild(div);

        if (index === 0) {
            selectBrand(brand.id, brand.markup, tier, true);
        }
    });
}

// [UPDATED] 选择具体品牌 (支持按 kWh 加价)
// ==========================================
// 🟢 [UPDATED] 选择具体品牌 (含动态 ROI 刷新)
// ==========================================
function selectBrand(brandId, markup, tier, isAutoSelect = false) {
    // 1. UI 高亮品牌卡片
    document.querySelectorAll('.brand-card').forEach(c => c.classList.remove('active'));
    const activeCard = document.getElementById(`brand-${brandId}`);
    if (activeCard) activeCard.classList.add('active');

    // 2. 计算加价逻辑 (支持固定加价 + 按kWh加价)
    const batSize = parseFloat(document.getElementById('bat-input').value) || 0;

    let extraCost = markup; // 基础固定加价

    // 查找当前品牌的 perKwh 配置
    const tierConfig = brandConfig[tier];
    if (tierConfig) {
        const brandObj = tierConfig.brands.find(b => b.id === brandId);
        if (brandObj) {
            currentSelectedBrandName = brandObj.name;

            if (brandObj.markupPerKwh) {
                extraCost += (brandObj.markupPerKwh * batSize);
            }
        }
    }

    currentSelectedBrandMarkup = extraCost;

    // 获取当前档位的基准价格 (Base Price)
    const basePrice = currentBasePrices[tier];
    const finalPrice = basePrice + extraCost;

    // 3. 更新大字价格 (#out-net) & 底部悬浮栏
    const fmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
    document.getElementById('out-net').innerText = fmt.format(finalPrice);

    const stickyPriceEl = document.getElementById('sticky-net-price');
    if (stickyPriceEl) stickyPriceEl.innerText = fmt.format(finalPrice);

    // 4. 🟢 核心新增：动态刷新 ROI 图表
    // 必须重新获取当前的系统参数，才能算出准确的回本周期
    const billAmount = parseFloat(document.getElementById('bill-input').value);

    // 获取当前活跃的太阳能板大小
    const solarNewIndex = parseInt(document.getElementById('solar-input').value);
    const solarNewKw = solarTiers[solarNewIndex];
    const solarExistIndex = parseInt(document.getElementById('exist-solar-input').value);
    const solarExistKw = solarTiers[solarExistIndex];
    let activeSolarKw = (curMode === 'battery') ? solarExistKw : solarNewKw;

    // 调用图表更新函数，传入包含品牌溢价后的 finalPrice
    updateChart(finalPrice, billAmount, curMode !== 'solar', batSize, activeSolarKw);
}
// ==========================================
// [UPDATED] 检查补贴逻辑 (NSW变灰但不改字版)
// ==========================================
// ==========================================
// [UPDATED] 检查补贴逻辑 (checkRebates)
// ==========================================
// ==========================================
// [UPDATED] 检查补贴逻辑 (NSW变灰但不改字版)
// ==========================================
// ==========================================
// [FIXED] 检查补贴逻辑 (修复 QLD 禁用 & 贷款提示)
// ==========================================
function checkRebates() {
    const state = document.getElementById('state-select').value;
    const section = document.getElementById('rebate-section');
    const batSize = parseFloat(document.getElementById('bat-input').value);

    // 获取所有 DOM 元素
    const els = {
        vic: document.getElementById('check-vic-solar'),
        qld: document.getElementById('check-qld-bat'),
        nsw: document.getElementById('check-nsw-prds'),
        act: document.getElementById('check-act-loan'),
        tas: document.getElementById('check-tas-loan'),
        nt: document.getElementById('check-nt-stc'),
        sa: document.getElementById('check-sa-vpp')
    };

    // 1. 先全部隐藏 & 重置状态
    Object.values(els).forEach(el => {
        if (el) {
            el.style.display = 'none';
            el.style.opacity = '1';
            el.style.pointerEvents = 'auto';
            const input = el.querySelector('input');
            if (input) input.disabled = false;
        }
    });

    // 默认隐藏整个板块
    section.style.display = 'none';
    let hasInfo = false;

    // --- 2. 逐个州判断逻辑 ---

    // VIC Logic
    if (state === 'VIC' && curMode !== 'battery') {
        els.vic.style.display = 'flex';
        hasInfo = true;
    }

    // QLD Logic (修复：强制变灰 & 禁用)
    if (state === 'QLD' && curMode !== 'solar') {
        els.qld.style.display = 'flex';
        hasInfo = true;

        // 强制禁用逻辑
        const qldInput = els.qld.querySelector('input');
        if (qldInput) {
            qldInput.checked = false; // 强制不勾选
            qldInput.disabled = true; // 禁止点击
        }
        els.qld.style.opacity = '0.5'; // 变灰
        els.qld.style.pointerEvents = 'none'; // 禁止鼠标交互

        // 可选：修改文字提示用户
        const qldLabel = els.qld.querySelector('label');
        if (qldLabel) qldLabel.innerHTML = curLang === 'cn' ? "昆州电池补贴 (名额已满)" : "QLD Battery Booster (Exhausted)";
    }

    // NSW Logic
    const NSW_CAP = config.subsidy_logic.nsw_vpp_cap_kwh || 28;
    if (state === 'NSW' && curMode !== 'solar') {
        els.nsw.style.display = 'flex';
        hasInfo = true;
        const cb = els.nsw.querySelector('input');
        const lbl = els.nsw.querySelector('label');

        // 重置文字
        if (lbl) lbl.innerText = i18n[curLang].nsw_vpp_label;

        if (batSize >= NSW_CAP) {
            if (cb) { cb.checked = false; cb.disabled = true; }
            els.nsw.style.opacity = '0.5';
            els.nsw.style.pointerEvents = 'none';
        } else {
            if (cb) { cb.disabled = false; if (!cb.checked) cb.checked = true; }
            els.nsw.style.opacity = '1';
            els.nsw.style.pointerEvents = 'auto';
        }
    }

    // ACT Logic (修复：确保显示)
    if (state === 'ACT') {
        els.act.style.display = 'flex';
        hasInfo = true;
    }

    // TAS Logic (修复：确保显示)
    if (state === 'TAS') {
        els.tas.style.display = 'flex';
        hasInfo = true;
    }

    // NT Logic
    if (state === 'NT' && curMode !== 'battery') {
        els.nt.style.display = 'flex';
        hasInfo = true;
    }

    if (state === 'SA' && curMode !== 'solar') {
        if (els.sa) {
            els.sa.style.display = 'flex';
            hasInfo = true;
        }
    }

    // 3. 只要有一条信息，就显示整个板块
    if (hasInfo) {
        section.style.display = 'block';
    }
}
// --- 4. 计算逻辑 (Calculation) ---

function safeSetText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }
function getZoneRating(state) { return (state === 'NT') ? 1.622 : (state === 'VIC' || state === 'TAS' ? 1.185 : 1.382); }
function calculateBatteryGross(batteryKwh, tier) {
    const T = config.base_pricing.battery_tiers;
    let rate = (tier === 'entry') ? T.entry_rate_per_kwh : (tier === 'medium' ? T.medium_rate_per_kwh : T.premium_rate_per_kwh);
    return (batteryKwh * rate) + T.fixed_profit_markup;
}


// [UPDATED] 推荐逻辑 (已移除"系统过小"警告)
// ==========================================
function generateRecommendation(state, billAmount, time, shade, hasBat, batteryKwh, isSolarTooSmall, activeSolarKw) {
    const lang = i18n[curLang];

    // 1. 定义标题
    const titleText = curLang === 'cn' ? "当前选定系统配置" : "SELECTED SYSTEM CONFIGURATION";

    // 2. 计算逆变器大小 & 后缀
    let inverterSize = 5;
    let invSuffix = "";

    if (!hasBat) {
        // --- 场景 A: 只有太阳能 ---
        if (activeSolarKw >= 15) inverterSize = 15;
        else if (activeSolarKw >= 12) inverterSize = 10;
        else if (activeSolarKw >= 8) inverterSize = 8;
        else if (activeSolarKw > 6.6) inverterSize = 6;
        else inverterSize = 5;
    } else {
        // --- 场景 B: 有电池 ---
        if (batteryKwh > 43) {
            inverterSize = 15;
            invSuffix = curLang === 'cn'
                ? "<span style='display:block; font-size:0.6em; font-weight:400; opacity:0.8;'>(需三相电)</span>"
                : "<span style='display:block; font-size:0.6em; font-weight:400; opacity:0.8;'>(3-Phase Only)</span>";
        } else if (batteryKwh >= 33) {
            inverterSize = 10;
        } else {
            inverterSize = 5;
        }
    }

    // 3. 构建网格 HTML
    let gridHtml = `<div class="spec-grid">`;
    const inverterDisplayHtml = `${inverterSize} kW <span style="color:var(--solar-gold); vertical-align: super; font-size: 0.6em;">*</span>${invSuffix}`;

    if (curMode !== 'battery') {
        gridHtml += `
            <div class="spec-item">
                <div class="spec-icon">☀️</div>
                <div class="spec-label">${curLang === 'cn' ? "太阳能板" : "Solar Panels"}</div>
                <div class="spec-value">${activeSolarKw} kW</div>
            </div>
            <div class="spec-item">
                <div class="spec-icon">⚡</div>
                <div class="spec-label">${curLang === 'cn' ? "逆变器" : "Inverter"}</div>
                <div class="spec-value">${inverterDisplayHtml}</div>
            </div>
        `;

        if (hasBat) {
            gridHtml += `
                <div class="spec-item">
                    <div class="spec-icon">🔋</div>
                    <div class="spec-label">${curLang === 'cn' ? "储能电池" : "Battery"}</div>
                    <div class="spec-value">${batteryKwh} kWh</div>
                </div>
            `;
        } else {
            gridHtml += `
                <div class="spec-item" style="opacity:0.3; border-style:dashed;">
                    <div class="spec-icon">🔋</div>
                    <div class="spec-label">${curLang === 'cn' ? "电池 (可选)" : "Battery (Opt)"}</div>
                    <div class="spec-value">-</div>
                </div>
            `;
        }
    } else {
        // Battery Only 模式
        gridHtml += `
            <div class="spec-item" style="opacity:0.5;">
                <div class="spec-icon">🏠</div>
                <div class="spec-label">${curLang === 'cn' ? "现有系统" : "Existing Solar"}</div>
                <div class="spec-value">${activeSolarKw} kW</div>
            </div>
            <div class="spec-item">
                <div class="spec-icon">⚡</div>
                <div class="spec-label">${curLang === 'cn' ? "新逆变器" : "New Inverter"}</div>
                <div class="spec-value">${inverterDisplayHtml}</div>
            </div>
            <div class="spec-item">
                <div class="spec-icon">🔋</div>
                <div class="spec-label">${curLang === 'cn' ? "储能电池" : "Battery"}</div>
                <div class="spec-value">${batteryKwh} kWh</div>
            </div>
        `;
    }
    gridHtml += `</div>`;

    // 4. 构建提示信息
    let tipsHtml = `<div class="spec-warnings">`;
    let hasTips = false;

    // Note
    const invNote = curLang === 'cn'
        ? "* 备注：如需升级逆变器容量，价格可能会有所变动。"
        : "* Note: Price may vary if upgrading inverter capacity.";
    tipsHtml += `<div class="warning-item" style="color:#94a3b8; font-style: italic;">${invNote}</div>`;
    hasTips = true;

    // 🔥 移除 NSW limit 警告
    // 🔥 移除 isSolarTooSmall 警告 (这里删除了相关代码)

    // Upsells
    if (userApplianceProfile.backup) {
        if (hasBat) {
            // 有电池：显示绿色 ✅
            const txt = curLang === 'cn' ? "✅ 含全屋离网备份" : "✅ Includes Full Backup";
            tipsHtml += `<div class="upsell-item">${txt}</div>`;
            hasTips = true;
        } else {
            // 🟢 [核心新增] 仅光伏：显示红色 ⚠️
            const txt = curLang === 'cn'
                ? "⚠️ 仅光伏模式下 Backup 可能无效，详情请咨询专家。"
                : "⚠️ Backup might be ineffective in Solar Only mode. Ask an expert.";
            tipsHtml += `<div class="warning-item" style="color:#ef5350">${txt}</div>`;
            hasTips = true;
        }
    }
    if (userApplianceProfile.gas2elec) {
        const txt = curLang === 'cn' ? "⚡ 已预留电气化容量" : "⚡ Ready for Electrification";
        tipsHtml += `<div class="upsell-item">${txt}</div>`;
        hasTips = true;
    }

    // High Bill Suggestion
    if (curMode === 'solar' && billAmount > 250) {
        const txt = curLang === 'cn'
            ? "💡 建议：您的电费较高，加装电池可大幅提升回报率。"
            : "💡 Tip: High bill detected. Adding a battery can significantly boost your ROI.";
        tipsHtml += `<div class="upsell-item" style="font-weight:600;">${txt}</div>`;
        hasTips = true;
    }

    // Low Bill Warning
    const isSolarOnlyWarn = (curMode === 'solar' && billAmount <= 200);
    const isBothWarn = (curMode === 'both' && billAmount <= 200 && activeSolarKw >= 6.6);

    if (isSolarOnlyWarn || isBothWarn) {
        const txt = curLang === 'cn' ? "💡 提示：电费较低，回本周期较长。" : "💡 Tip: Low bill, longer payback.";
        tipsHtml += `<div class="warning-item" style="color:#fbbf24">${txt}</div>`;
        hasTips = true;
    }
    tipsHtml += `</div>`;

    return `
        <strong class="config-title">${titleText}</strong>
        ${gridHtml}
        ${hasTips ? tipsHtml : ''}
    `;
}

// ==========================================
// 🟢 [UPDATED] 核心计算函数 (Fix: Entry=(Gross-STC)*50%, Fix State Rebate Display)
// ==========================================
// ==========================================
// 🟢 [UPDATED] 核心计算函数 (Fix: 禁止自动弹窗 + 之前所有修复)
// ==========================================
function calculate(forceShow = false) {
    try {
        const card = document.getElementById('result-card');
        const isVisible = card.style.display === 'block';
        const isUnlocked = sessionStorage.getItem('quoteUnlocked') === 'true';

        // 🛑 [修复核心] 防止选下拉框时自动弹窗
        // 如果当前还没显示结果(isVisible=false)，且不是点击按钮触发(forceShow=false)，直接退出
        if (!isVisible && !forceShow) return;

        // --- 1. 默认值拦截逻辑 (点击按钮时才检查) ---
        if (forceShow && !isVisible) {
            const currentBill = parseFloat(document.getElementById('bill-input').value);
            const currentState = document.getElementById('state-select').value;
            const currentSolar = document.getElementById('solar-input').value;
            const hasProfile = Object.values(userApplianceProfile).some(val => val === true);

            if (currentBill <= 100 && currentState === 'NSW' && currentSolar === "0" && !hasProfile) {
                const msg = curLang === 'cn' ? "请先输入基础信息，才能算出准确价格哦~" : "Please provide more details first.";
                showToast(msg);
                const billGroup = document.getElementById('bill-input').parentElement;
                billGroup.classList.add('input-highlight');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setTimeout(() => billGroup.classList.remove('input-highlight'), 2000);
                return;
            }
        }

        if (forceShow && !isVisible && !isUnlocked) {
            playAnalysisAnimation();
        }


        // --- 2. 获取基础数据 ---
        const state = document.getElementById('state-select').value;
        const solarNewIndex = parseInt(document.getElementById('solar-input').value);
        const solarNewKw = solarTiers[solarNewIndex];
        const batteryKwh = parseFloat(document.getElementById('bat-input').value);

        // 确定活跃太阳能系统 (Solar Cost)
        const BP = config.base_pricing;
        const P_SOLAR_KW = (BP.solar_per_w || 0.9) * 1000;
        const P_BASE_INSTALL = BP.install_base_fee || 0;
        const costShade = parseFloat(document.getElementById('shade-select').value) === 1500 ? BP.addon_extras.addon_shading : 0;


        // 计算太阳能部分的 Gross Price (不含电池)
        let grossSolarBase = 0;
        if (curMode !== 'battery') {
            grossSolarBase = (solarNewKw * P_SOLAR_KW) + P_BASE_INSTALL + costShade;
        }

        // --- 3. 电池基准价格计算 (Gross Battery Logic) ---
        const OLD_ENTRY_RATE = 329.6; //tier 中间档改这里
        const OLD_MEDIUM_RATE = 600;
        const FIXED_PROFIT = 4000;
        const P_BAT_LABOR = (curMode === 'battery') ? 1500 : 500;

        // 基础造价 (不含GST)
        const baseCostOldEntry = (batteryKwh * OLD_ENTRY_RATE) + FIXED_PROFIT + P_BAT_LABOR;
        const baseCostOldMedium = (batteryKwh * OLD_MEDIUM_RATE) + FIXED_PROFIT + P_BAT_LABOR;

        // --- 4. 新 Tier Gross (含 GST) ---
        let grossBatNewEntry = baseCostOldEntry * 1.1;
        let grossBatNewMedium = baseCostOldEntry * 1.1; // Medium Base = Entry Gross
        let grossBatNewPremium = baseCostOldMedium * 1.1; // Premium Base = Medium Gross

        // --- 5. 补贴计算 (STC & State) ---
        const SL = config.subsidy_logic;

        // A. STC Solar
        let stcSolarValue = 0;
        if (curMode !== 'battery') {
            stcSolarValue = Math.floor(solarNewKw * getZoneRating(state) * SL.stc_deeming_years) * SL.fed_stc_price_net;
        }

        // B. STC Battery
        let stcBatteryValue = 0;
        if (curMode !== 'solar') {
            stcBatteryValue = Math.min(batteryKwh, SL.fed_bat_cap_kwh) * SL.fed_bat_rate_per_kwh;
        }

        const totalSTC = stcSolarValue + stcBatteryValue;

        // C. State Rebates (州政府补贴)
        let stateRebateVal = 0;
        if (state === 'NSW' && curMode !== 'solar') {
            const nswCb = document.getElementById('cb-nsw-prds');
            // 如果电池 >= 28，补贴为0；否则看是否勾选
            if (batteryKwh < SL.nsw_vpp_cap_kwh && nswCb && nswCb.checked) {
                stateRebateVal += (batteryKwh * SL.rebate_nsw_rate);
            }
        }
        if (state === 'VIC' && curMode !== 'battery') {
            const vicCb = document.getElementById('cb-vic-solar');
            if (vicCb && vicCb.checked) stateRebateVal += SL.rebate_vic;
        }
        if (state === 'SA' && curMode !== 'solar') {
            stateRebateVal += SL.rebate_sa;
        }

        // 杂项费用
        const valRoof = parseFloat(document.getElementById('roof-select').value) === 800 ? 800 : 0;
        const valStorey = parseFloat(document.getElementById('storey-select').value);
        let costStorey = (valStorey === 300) ? 300 : (valStorey === 500 ? 500 : 0);
        let costBackup = userApplianceProfile.backup ? 600 : 0;
        const valPhase = parseFloat(document.getElementById('phase-select').value) === 1000 ? 1000 : 0;
        const siteExtras = valRoof + costStorey + costBackup + valPhase;
       
       
        // --- 6. 最终净价计算 (Net Prices) ---

        const fmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });

        // >>> ENTRY TIER (Felicity) <<<
        // 逻辑：(Gross - STC) * 50%。不减 State Rebate。
        const grossEntryTotal = grossSolarBase + grossBatNewEntry + siteExtras;
        const netEntryFinal = (grossBatNewEntry - stcBatteryValue) * 0.5 + (grossSolarBase - stcSolarValue) - stateRebateVal;

        currentBasePrices['entry'] = netEntryFinal;
        safeSetText('net-entry', fmt.format(netEntryFinal));

        // >>> MEDIUM TIER <<<
        // 标准逻辑：Gross - STC - State Rebate
        const grossMediumTotal = grossSolarBase + grossBatNewMedium + siteExtras;
        const netMediumBase = grossMediumTotal - totalSTC - stateRebateVal;

        currentBasePrices['medium'] = netMediumBase;
        const medHighMarkup = 55 * batteryKwh;
        safeSetText('net-medium', `${fmt.format(netMediumBase)} ~ ${fmt.format(netMediumBase + medHighMarkup)}`);

        // >>> PREMIUM TIER <<<
        const grossPremiumTotal = grossSolarBase + grossBatNewPremium + siteExtras;
        const netPremiumBase = grossPremiumTotal - totalSTC - stateRebateVal;

        currentBasePrices['premium'] = netPremiumBase;
        const premHighMarkup = 300 * batteryKwh;
        safeSetText('net-premium', `${fmt.format(netPremiumBase)} ~ ${fmt.format(netPremiumBase + premHighMarkup)}`);

        // --- 7. Entry Tier 禁用逻辑 (Felicity > 39kWh only) ---
        const entryBox = document.getElementById('box-entry');
        if (curMode !== 'solar' && batteryKwh <= 39) {
            entryBox.classList.add('disabled');
            if (selectedTier === 'entry') {
                selectTier('medium');
            }
        } else {
            entryBox.classList.remove('disabled');
        }

        // --- 8. 界面显示更新 ---

        // 动态修改补贴名字
        let dynamicStateLabel = i18n[curLang].res_state;
        if (state === 'VIC') dynamicStateLabel = curLang === 'cn' ? "维州太阳能补贴 (Solar Homes)" : "VIC Solar Homes Rebate";
        else if (state === 'NSW') dynamicStateLabel = curLang === 'cn' ? "新州电池/VPP 补贴" : "NSW PDRS/VPP Incentive";
        else if (state === 'SA') dynamicStateLabel = curLang === 'cn' ? "南澳 VPP 加入奖励" : "SA VPP Join Bonus";
        else if (state === 'ACT') dynamicStateLabel = curLang === 'cn' ? "ACT 无息贷款权益" : "ACT Loan Benefit";

        const rowStateDiv = document.getElementById('row-state');
        if (rowStateDiv) {
            const labelSpan = rowStateDiv.querySelector('span');
            if (labelSpan) labelSpan.innerText = dynamicStateLabel;
        }

        // 显示选中档位的 Gross 
        let activeGross = 0;
        if (selectedTier === 'entry') activeGross = grossEntryTotal;
        else if (selectedTier === 'medium') activeGross = grossMediumTotal;
        else activeGross = grossPremiumTotal;

        safeSetText('lbl-gross-title', `${i18n[curLang].res_gross} (${i18n[curLang]['tier_' + selectedTier]})`);
        safeSetText('out-gross', fmt.format(activeGross));

        // 更新补贴数值显示
        safeSetText('out-stc-solar', "-" + fmt.format(stcSolarValue));
        safeSetText('out-stc-battery', "-" + fmt.format(stcBatteryValue));
        safeSetText('out-state', "-" + fmt.format(stateRebateVal));

        // Rows visibility
        const rowSolar = document.getElementById('row-stc-solar'); if (rowSolar) rowSolar.style.display = stcSolarValue > 0 ? 'flex' : 'none';
        const rowBat = document.getElementById('row-stc-battery'); if (rowBat) rowBat.style.display = stcBatteryValue > 0 ? 'flex' : 'none';

        if (rowStateDiv) {
            rowStateDiv.style.display = stateRebateVal > 0 ? 'flex' : 'none';
        }

        // Solar Only Logic
        const grid = document.querySelector('.comparison-grid');
        const gridTitle = document.querySelector('.section-title[data-i18n="res_final_comparison"]');
        if (curMode === 'solar') {
            if (grid) grid.style.display = 'none';
            if (gridTitle) gridTitle.style.display = 'none';

            const solarOnlyGross = grossSolarBase + siteExtras;
            safeSetText('out-gross', fmt.format(solarOnlyGross));
            const solarOnlyNet = solarOnlyGross - totalSTC - stateRebateVal;
            safeSetText('out-net', fmt.format(solarOnlyNet));

            currentBasePrices['entry'] = solarOnlyNet;
            currentBasePrices['medium'] = solarOnlyNet;
            currentBasePrices['premium'] = solarOnlyNet;
        } else {
            if (grid) grid.style.display = 'grid';
            if (gridTitle) gridTitle.style.display = 'block';
        }

        // 🔥 找回太阳能板 Logo 逻辑
        const panelBox = document.getElementById('panel-brand-container');
        if (panelBox) {
            panelBox.style.display = (curMode === 'battery') ? 'none' : 'block';
        }

        // --- 9. 推荐与图表更新 ---
        const billAmount = parseFloat(document.getElementById('bill-input').value);
        let activeSolarKw = (curMode === 'battery') ? solarTiers[parseInt(document.getElementById('exist-solar-input').value)] : solarNewKw;
        const recEl = document.getElementById('rec-text');

        // 无警告逻辑
        let isSolarTooSmall = (activeSolarKw * 2.5 < batteryKwh);
        if (recEl) {
            recEl.innerHTML = generateRecommendation(state, billAmount, 'day', 0, curMode !== 'solar', batteryKwh, isSolarTooSmall, activeSolarKw);
        }

        const currentNetPrice = parseFloat(document.getElementById('out-net').innerText.replace(/[^0-9.-]+/g, ""));
        updateChart(currentNetPrice || currentBasePrices['medium'], billAmount, curMode !== 'solar', batteryKwh, activeSolarKw);

        // --- 10. 显示结果 & 刷新 ---
        card.style.display = 'block';
        const budgetVal = parseFloat(document.getElementById('budget-input').value);
        autoSelectTierByBudget(budgetVal);

        if (isUnlocked) {
            document.getElementById('unlock-overlay').classList.add('hidden');
            // 🟢 新增：刷新后，也要给小按钮加上呼吸
            const stickyBtn = document.querySelector('.sticky-btn');
         if (stickyBtn) {
             stickyBtn.classList.add('highlight');
         // 🟢 同样强制写死文案
             stickyBtn.innerText = (curLang === 'cn') ? "咨询" : "Enquiry";
         }
            document.querySelectorAll('.price-number').forEach(el => el.classList.remove('locked'));

            // 🟢 [修复开始]：刷新后，如果检测到已解锁，必须强制把按钮和 VPP Banner 显示出来
            const finalBtn = document.getElementById('btn-final-enquiry');
            if (finalBtn) finalBtn.style.display = 'flex';

            const vppBanner = document.getElementById('vpp-banner');
            // 注意：VPP Banner 只有在非纯光伏模式下才显示
            if (vppBanner && curMode !== 'solar') vppBanner.style.display = 'flex';
            // 🟢 [修复结束]

            setupStickyObserver();
        } else {
            document.getElementById('unlock-overlay').classList.remove('hidden');
            document.querySelectorAll('.price-number').forEach(el => el.classList.add('locked'));

            // 🟢 [建议]：如果是未解锁状态，确保按钮是隐藏的（防止逻辑冲突）
            const finalBtn = document.getElementById('btn-final-enquiry');
            if (finalBtn) finalBtn.style.display = 'none';
        }

        if (forceShow) card.scrollIntoView({ behavior: "smooth" });

    } catch (err) {
        console.error("Calculate Error:", err);
    }
}
let myChart = null;
function updateChart(netPrice, quarterlyBill, hasBattery, batterySize, solarSizeKw) {
    const annualBill = quarterlyBill * 4;

    // --- [Smart ROI Algorithm] ---
    let selfConsumptionRate = 0.30;

    // 根据 Profile 调整系数
    if (userApplianceProfile.wfh) selfConsumptionRate += 0.15;
    if (userApplianceProfile.pool) selfConsumptionRate += 0.15;
    if (userApplianceProfile.ac) selfConsumptionRate += 0.10;
    if (userApplianceProfile.hws) selfConsumptionRate += 0.12;
    if (userApplianceProfile.general) selfConsumptionRate += 0.05;
    if (userApplianceProfile.others) selfConsumptionRate += 0.05;

    if (userApplianceProfile.ev_now) {
        selfConsumptionRate += hasBattery ? 0.15 : 0.05;
    }
    if (userApplianceProfile.ev_plan) {
        selfConsumptionRate += 0.02;
    }
    if (userApplianceProfile.gas2elec) {
        selfConsumptionRate += 0.05; // 假设用电量增大，浪费减少
    }

    if (selfConsumptionRate > 0.75) selfConsumptionRate = 0.75;

    let savingsRate = 0;
    if (!hasBattery) {
        // Solar Only: 自用率 + 余电上网(假设值)
        savingsRate = selfConsumptionRate + 0.15;
    } else {
        // Battery: 基础自用 + 电池提升
        let batteryBoost = 0.40;
        if (solarSizeKw * 4 < batterySize) batteryBoost *= 0.6; // 板子太小充不满
        savingsRate = selfConsumptionRate + batteryBoost;
    }
    if (savingsRate > 0.95) savingsRate = 0.95;

    const newAnnualBill = annualBill * (1 - savingsRate);
    const annualSavings = annualBill - newAnnualBill;
    const escalation = config.roi_logic.annual_tariff_escalation_percent;
    let paybackYears = 0; let cumulativeSavings = 0;
    while (cumulativeSavings < netPrice && paybackYears < 30) {
        paybackYears++; cumulativeSavings += annualSavings * Math.pow(1 + escalation, paybackYears - 1);
    }
    const labelYear = curLang === 'cn' ? " 年" : " Years";
    document.getElementById('payback-years').innerText = paybackYears < 30 ? paybackYears + labelYear : "30+ Years";
    const fmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
    document.getElementById('savings-val').innerText = fmt.format(annualSavings);

    const ctx = document.getElementById('roiChart').getContext('2d');
    const labels = [i18n[curLang].chart_curr, i18n[curLang].chart_new];
    const dataVals = [annualBill, newAnnualBill];
    if (myChart) { myChart.destroy(); }
    myChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: i18n[curLang].chart_saved, data: dataVals, backgroundColor: ['#ef5350', '#66bb6a'], borderRadius: 4, barPercentage: 0.6 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => '$' + c.raw.toFixed(0) } } }, scales: { y: { beginAtZero: true, ticks: { callback: function (val) { return '$' + val; }, font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.1)' } }, x: { ticks: { color: '#fff', font: { size: 11 } }, grid: { display: false } } } }
    });
}

// --- Modals & Submission ---

function openApplianceModal() {
    document.getElementById('appliance-modal').style.display = 'flex';
}

function closeApplianceModal(event) {
    const overlay = document.getElementById('appliance-modal');
    if (!event || event.target === overlay || event.target.classList.contains('close-btn') || event.target.classList.contains('btn-modal-ok')) {
        overlay.style.display = 'none';
        updateTriggerText();
        if (document.getElementById('result-card').style.display === 'block') calculate(false);
    }
}

function toggleUsage(type) {
    userApplianceProfile[type] = !userApplianceProfile[type];
    const btn = document.getElementById('btn-use-' + type);
    if (btn) {
        if (userApplianceProfile[type]) btn.classList.add('active');
        else btn.classList.remove('active');
    }
}

function updateTriggerText() {
    const triggerText = document.getElementById('appliance-summary');
    const triggerDiv = document.querySelector('.custom-select-trigger');
    if (!triggerText || !triggerDiv) return;

    let activeKeys = Object.keys(userApplianceProfile).filter(k => userApplianceProfile[k]);
    let count = activeKeys.length;

    if (count === 0) {
        triggerText.innerText = curLang === 'cn' ? "点击选择用电设备..." : "Select appliances...";
        triggerDiv.classList.remove('has-value');
    } else {
        const template = i18n[curLang].selected_count || "{n} items selected";
        triggerText.innerText = template.replace('{n}', count);
        triggerDiv.classList.add('has-value');
    }
}

function openVPPModal() { document.getElementById('vpp-modal').style.display = 'flex'; }
function closeVPPModal(event) {
    const overlay = document.getElementById('vpp-modal');
    if (!event || event.target === overlay || event.target.classList.contains('close-btn') || event.target.classList.contains('btn-modal-ok')) {
        overlay.style.display = 'none';
    }
}

function openConfirmModal() {
    // 1. 【上锁】给 body 加类，隐藏 FOMO Bar
    document.body.classList.add('hide-fomo');

    // 🟢 [Existing] 隐藏品牌墙悬浮标
    const brandBadge = document.querySelector('.fixed-brand-badge');
    if (brandBadge) brandBadge.style.display = 'none';

    // 🟢 [NEW] Hide Bottom Nav & Sticky Footer (防止遮挡或视觉干扰)
    const navBar = document.querySelector('.bottom-nav-container');
    if (navBar) navBar.style.display = 'none';

    const stickyFooter = document.getElementById('sticky-footer');
    if (stickyFooter) stickyFooter.style.display = 'none';

    // ... (Existing form population logic remains unchanged) ...
    document.getElementById('conf-name').value = document.getElementById('lead-name').value;
    document.getElementById('conf-phone').value = document.getElementById('lead-phone').value;
    document.getElementById('conf-email').value = document.getElementById('lead-email').value;

    if (extractedPostcode) {
        document.getElementById('conf-postcode').value = extractedPostcode;
    } else {
        const rawAddress = document.getElementById('lead-address').value || "";
        const pcMatches = rawAddress.match(/\b\d{4}\b/g);
        if (pcMatches && pcMatches.length > 0) document.getElementById('conf-postcode').value = pcMatches[pcMatches.length - 1];
    }

    document.getElementById('confirm-modal').style.display = 'flex';
    document.getElementById('final-msg').innerText = '';
    document.getElementById('btn-final-submit').disabled = false;
    document.getElementById('btn-final-submit').innerText = i18n[curLang].btn_confirm_send;
}

function closeConfirmModal(event) {
    const overlay = document.getElementById('confirm-modal');
    if (!event || event.target === overlay || event.target.classList.contains('close-btn')) {
        overlay.style.display = 'none';

        // 2. 【解锁】移除类，FOMO Bar 恢复显示
        document.body.classList.remove('hide-fomo');

        // 🟢 [Existing] 恢复品牌墙悬浮标
        const brandBadge = document.querySelector('.fixed-brand-badge');
        if (brandBadge) brandBadge.style.display = 'flex';

        // 🟢 [NEW] Restore Bottom Nav & Sticky Footer
        const navBar = document.querySelector('.bottom-nav-container');
        if (navBar) navBar.style.display = ''; // Reverts to CSS default (flex)

        const stickyFooter = document.getElementById('sticky-footer');
        if (stickyFooter) stickyFooter.style.display = ''; // Reverts to CSS default
    }
}
function isValidAustralianPhone(p) { return /^(?:04|\+?614)\d{8}$|^(?:02|03|07|08)\d{8}$/.test(p.replace(/[\s()-]/g, '')); }
function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function isValidPostcode(p) { return /^\d{4}$/.test(p); }

// ==========================================
// [UPDATED] 提交初步线索 (Unlock Quote) - 保存到 Supabase
// ==========================================
// ==========================================
// 🟢 修改版 submitLead (防重 + 暴力解锁 UI)
// ==========================================
// ==========================================
// 🟢 修改版 submitLead (完整版 - 含 AI 数据提交)
// ==========================================
async function submitLead() {
    // --- 1. 获取基础 DOM 元素 (原有逻辑) ---
    const name = document.getElementById('lead-name').value.trim();
    const email = document.getElementById('lead-email').value.trim();
    const phone = document.getElementById('lead-phone').value.trim();
    const address = document.getElementById('lead-address').value.trim(); 
    const msgEl = document.getElementById('submit-msg');

    // 尝试从缓存里取出推荐码
    let trackingCode = localStorage.getItem('solaryo_ref_code');
    if (!trackingCode || trackingCode.trim() === "") {
        trackingCode = 'opensea';
    }

    // UI 显隐逻辑
    const finalBtn = document.getElementById('btn-final-enquiry');
    if (finalBtn) {
        finalBtn.style.display = 'flex';
        finalBtn.classList.add('highlight'); 
    }
    const stickyBtn = document.querySelector('.sticky-btn');
    if (stickyBtn) {
        stickyBtn.innerText = (curLang === 'cn') ? "咨询" : "Enquiry"; 
        stickyBtn.classList.add('highlight');
    }

    msgEl.innerText = '';

    // --- 2. 基础验证 (原有逻辑) ---
    if (!name || !email || !phone) {
        msgEl.style.color = '#ef5350';
        msgEl.innerText = i18n[curLang].err_required;
        return;
    }
    if (!isValidEmail(email)) {
        msgEl.style.color = '#ef5350';
        msgEl.innerText = i18n[curLang].err_email;
        return;
    }
    if (!isValidAustralianPhone(phone)) {
        msgEl.style.color = '#ef5350';
        msgEl.innerText = i18n[curLang].err_phone;
        return;
    }

    const btn = document.getElementById('btn-submit');
    const originalBtnText = btn.innerText; 

    // 更改按钮状态
    btn.innerText = curLang === 'cn' ? "处理中..." : "Processing...";
    btn.disabled = true;

    try {
        // --- 3. 准备数据 (这里就是你担心删掉的部分，其实都在) ---
        const solarText = document.getElementById('solar-val').innerText;
        const batText = document.getElementById('bat-val').innerText;
        const priceText = document.getElementById('out-net').innerText;

        // 🟢 [新增] 获取 AI 分析的隐藏数据 (从 index.html 的隐藏 input 里拿)
        // 如果用户没用 AI 分析，这些就是 null，不影响流程
       // 优先取隐藏框的值，如果没有（或为NaN），则取全局变量 window.selectedLat
        let latVal = document.getElementById('hidden-lat') ? parseFloat(document.getElementById('hidden-lat').value) : null;
        let lngVal = document.getElementById('hidden-lng') ? parseFloat(document.getElementById('hidden-lng').value) : null;

        // 🟢 [修复] 兜底逻辑：如果 DOM 里没取到，试试全局变量
        if (!latVal && window.selectedLat) latVal = window.selectedLat;
        if (!lngVal && window.selectedLng) lngVal = window.selectedLng;
        
        const solarDataRaw = document.getElementById('hidden-solar-data') ? document.getElementById('hidden-solar-data').value : null;
        
        let solarJson = {};
        try { solarJson = solarDataRaw ? JSON.parse(solarDataRaw) : {}; } catch(e){}

        // --- 4. 构建发送给数据库的数据包 ---
        
        // A. 准备发送给智能大脑 (SQL V13) 的核心数据
        const rpcPayload = {
            p_name: name,
            p_phone: phone,
            p_email: email.toLowerCase(),
            p_address: address,
            p_postcode: extractedPostcode || "",
            
            // 这里用到了上面获取的 solarText 和 batText
            p_solar_size: solarText,
            p_battery_size: batText,
            
            p_bill: document.getElementById('bill-input').value,
            p_estimated_price: priceText,
            
            // 🟢 [修改] 把 AI 数据合并进 user_profile
            p_user_profile: {
                ...userApplianceProfile,          // 原有的家电画像
                solar_ai_data: solarJson,         // 新增：卫星分析结果
                geo: { lat: latVal, lng: lngVal } // 新增：经纬度
            }, 
            p_ref_code: trackingCode
        };

        // B. 准备详情 Update 数据 (用于后续补全)
        const detailPayload = {
            language: curLang,
            installation_mode: curMode,
            state: document.getElementById('state-select').value,
            updated_at: new Date().toISOString(),
            has_client_update: true,
            
            // 🟢 [新增] 如果你的 leads 表里有 lat/lng 字段，可以在这里直接存
            lat: latVal, 
            lng: lngVal,

            notes: "[System] User Unlocked Price (Preliminary Lead)",
            property_storeys: getSelectedText('storey-select'),
            property_roof: getSelectedText('roof-select'),
            property_shade: getSelectedText('shade-select'),
            property_type: getSelectedText('property-type-select'),
            property_phase: getSelectedText('phase-select'),
            existing_solar_size: document.getElementById('exist-solar-val').innerText,
            budget_target: document.getElementById('budget-input').value,
            quote_tier: selectedTier,
            chat_history: globalChatHistory
        };

        // --- 5. 调用 Supabase (RPC) ---
        const { data, error } = await supabaseClient.rpc('submit_smart_quote', rpcPayload);

        if (error) throw error;

        // 拿到 ID
        const currentLeadId = data.id;
        console.log("Smart Submit Result:", data.status, "ID:", currentLeadId);
        
        // 存入缓存
        localStorage.setItem('current_lead_id', currentLeadId);

        // --- 6. 立即补全详情 (Update) ---
        if (currentLeadId) {
            await supabaseClient.from('leads').update(detailPayload).eq('id', currentLeadId);
        }

        // --- 7. 成功后的 UI 逻辑 (解锁报价) ---
        sessionStorage.setItem('quoteUnlocked', 'true');

        // 处理遮罩层
        const overlay = document.getElementById('unlock-overlay');
        if (overlay) {
            overlay.classList.add('hidden');      // 你的原代码逻辑
            overlay.classList.add('hidden-opt');  // 我们的修复逻辑
            overlay.style.display = 'none';       // 暴力隐藏
        }

        // 处理文字模糊
        document.querySelectorAll('.price-number').forEach(el => {
            el.classList.remove('locked');
            el.classList.remove('blur-text');
            el.style.filter = 'none';          
            el.style.webkitFilter = 'none';    
            el.style.textShadow = 'none';      
            el.style.color = '';      
            el.style.opacity = '1';
        });

        // 显示 VPP Banner
        const vppBanner = document.getElementById('vpp-banner');
        if (vppBanner && curMode !== 'solar') vppBanner.style.display = 'flex';

        const finalBtnDisplay = document.getElementById('btn-final-enquiry');
        if (finalBtnDisplay) finalBtnDisplay.style.display = 'flex';

        setupStickyObserver();

        msgEl.style.color = '#66bb6a';
        msgEl.innerText = i18n[curLang].alert_sent;
        
        // 撒花特效
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#10b981', '#f59e0b', '#0f172a'] });

        btn.innerText = curLang === 'cn' ? "解锁成功" : "Unlocked!";

    } catch (err) {
        console.error("Submit Lead Error:", err);
        msgEl.style.color = '#ef5350';
        msgEl.innerText = "Network Error. Please try again.";
        btn.disabled = false;
        btn.innerText = originalBtnText;
    }
}
// 辅助函数：获取 Select 选中的文本
function getSelectedText(elementId) {
    const el = document.getElementById(elementId);
    if (el && el.selectedIndex !== -1) return el.options[el.selectedIndex].text;
    return "";
}
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

// 辅助函数：获取 Select 选中的文本
function getSelectedText(elementId) {
    const el = document.getElementById(elementId);
    if (el && el.selectedIndex !== -1) return el.options[el.selectedIndex].text;
    return "";
}
// [MODIFIED] C端最终询价 (支持多文件上传)
// ==========================================
// 🟢 修改版 sendFinalEnquiry (只更新不插入)
// ==========================================
// ==========================================
// 🟢 修改版 sendFinalEnquiry (Update Success Logic)
// ==========================================
async function sendFinalEnquiry() {
    // ... (Previous logic for getting elements and validation remains unchanged) ...
    
    // 1. 获取 DOM 元素
    const nameEl = document.getElementById('conf-name');
    const phoneEl = document.getElementById('conf-phone');
    const emailEl = document.getElementById('conf-email');
    const postcodeEl = document.getElementById('conf-postcode');
    const addressEl = document.getElementById('lead-address');
    const notesEl = document.getElementById('conf-notes');
    const stateEl = document.getElementById('state-select');
    const billInput = document.getElementById('bill-input');
    const contactMethodEl = document.querySelector('input[name="contact-method"]:checked');
    const fileInput = document.getElementById('conf-file');
    
    // 更严谨的写法：确保一定是 null 或者 有效字符串
    let trackingCode = localStorage.getItem('solaryo_ref_code');
    if (!trackingCode || trackingCode.trim() === "") {
        trackingCode = 'opensea';
    }
    if (!nameEl.value || !phoneEl.value || !postcodeEl.value) {
        document.getElementById('final-msg').style.color = 'red';
        document.getElementById('final-msg').innerText = curLang === 'cn' ? "请完善联系信息 (含邮编)" : "Please complete contact details (inc. Postcode)";
        return;
    }

    const btn = document.getElementById('btn-final-submit');
    const originalBtnText = btn.innerText;
    btn.disabled = true;
    btn.innerText = curLang === 'cn' ? "提交中..." : "Sending...";

    try {
        // ... (File upload logic and payload construction remain unchanged) ...
        let fileUrl = null;
        let fileName = null;

        if (fileInput.files.length > 0) {
            const files = Array.from(fileInput.files);
            // ... (File upload loop) ...
             const uploadPromises = files.map(async (file) => {
                const uniqueName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                const { data: uploadData, error: uploadError } = await supabaseClient
                    .storage.from('uploads').upload(uniqueName, file);
                if (uploadError) throw uploadError;
                const { data: publicUrlData } = supabaseClient
                    .storage.from('uploads').getPublicUrl(uploadData.path);
                return { url: publicUrlData.publicUrl, name: file.name };
            });
            const results = await Promise.all(uploadPromises);
            fileUrl = results.map(r => r.url).join(',');
            fileName = results.map(r => r.name).join(', ');
        }

        const payload = {
            language: curLang,
            installation_mode: curMode,
            state: stateEl.value,
            name: nameEl.value,
            phone: phoneEl.value,
            email: emailEl.value,
            postcode: postcodeEl.value,
            address: addressEl ? addressEl.value : "",
            contact_method: contactMethodEl ? contactMethodEl.value : 'phone',
            install_timeframe: getSelectedText('conf-timeframe'),
            notes: notesEl.value ? `[User Note]: ${notesEl.value}` : null,
            file_name: fileName,
            file_url: fileUrl,
            bill_amount: billInput.value,
            budget_target: document.getElementById('budget-input').value,
            solar_size: document.getElementById('solar-val').innerText,
            battery_size: document.getElementById('bat-val').innerText,
            existing_solar_size: document.getElementById('exist-solar-val').innerText,
            quote_tier: selectedTier,
            estimated_price: document.getElementById('out-net').innerText,
            selected_brand: (curMode === 'solar') ? 'Solar Only (Panels)' : currentSelectedBrandName,
            user_profile: userApplianceProfile,
            chat_history: globalChatHistory,
            referral_code: trackingCode,
            updated_at: new Date().toISOString(),
            has_client_update: true 
        };

        const leadId = localStorage.getItem('current_lead_id');

        if (leadId) {
            const { error } = await supabaseClient.from('leads').update(payload).eq('id', leadId);
            if (error) throw error;
        } else {
            console.warn("No ID found, falling back to insert...");
            payload.created_at = new Date().toISOString();
            payload.status = 'new';
            const { error } = await supabaseClient.from('leads').insert([payload]);
            if (error) throw error;
        }

        // 6. 成功反馈
        setTimeout(() => {
            document.getElementById('final-msg').style.color = '#66bb6a';
            document.getElementById('final-msg').innerText = i18n[curLang].alert_final_success;
            btn.innerText = curLang === 'cn' ? "已提交" : "Submitted";

            setTimeout(() => {
                document.getElementById('confirm-modal').style.display = 'none';
                document.body.classList.remove('hide-fomo');
                
                // 🟢 Restore elements on success close
                const brandBadge = document.querySelector('.fixed-brand-badge');
                if (brandBadge) brandBadge.style.display = 'flex';

                const navBar = document.querySelector('.bottom-nav-container');
                if (navBar) navBar.style.display = '';

                const stickyFooter = document.getElementById('sticky-footer');
                if (stickyFooter) stickyFooter.style.display = '';

            }, 2000);
        }, 1000);

    } catch (error) {
        console.error("Error:", error);
        let errMsg = "System Error.";
        if (error.message) errMsg = error.message;
        document.getElementById('final-msg').style.color = 'red';
        document.getElementById('final-msg').innerText = errMsg;
        btn.disabled = false;
        btn.innerText = originalBtnText;
    }
}
// --- Inline Validation ---
const phoneInput = document.getElementById('lead-phone');
if (phoneInput) phoneInput.addEventListener('input', function (e) { let x = e.target.value.replace(/\D/g, '').match(/(\d{0,4})(\d{0,3})(\d{0,3})/); e.target.value = !x[2] ? x[1] : x[1] + ' ' + x[2] + (x[3] ? ' ' + x[3] : ''); });
const confPhoneInput = document.getElementById('conf-phone');
if (confPhoneInput) confPhoneInput.addEventListener('input', function (e) { let x = e.target.value.replace(/\D/g, '').match(/(\d{0,4})(\d{0,3})(\d{0,3})/); e.target.value = !x[2] ? x[1] : x[1] + ' ' + x[2] + (x[3] ? ' ' + x[3] : ''); });

function setupInlineValidation(inputId, errorMsgId, validateFn, errorTextObj) {
    const inputEl = document.getElementById(inputId);
    const msgEl = document.getElementById(errorMsgId);
    if (!inputEl || !msgEl) return;
    inputEl.addEventListener('blur', () => {
        const val = inputEl.value.trim();
        if (val === "") return;
        if (!validateFn(val)) {
            inputEl.classList.add('input-error');
            msgEl.style.display = 'block';
            msgEl.innerText = curLang === 'cn' ? errorTextObj.cn : errorTextObj.en;
        }
    });
    inputEl.addEventListener('input', () => {
        if (inputEl.classList.contains('input-error')) {
            inputEl.classList.remove('input-error');
            msgEl.style.display = 'none';
        }
    });
}
setTimeout(() => {
    setupInlineValidation('lead-email', 'err-lead-email', isValidEmail, { cn: "请输入有效的邮箱地址", en: "Please enter a valid email address." });
    setupInlineValidation('lead-phone', 'err-lead-phone', isValidAustralianPhone, { cn: "请输入有效的澳洲电话号码 (04xx 或 02/03...)", en: "Invalid AU phone number (04xx or Landline)" });
}, 500);

// ==========================================
// [UPDATED] Google Maps & Autocomplete Logic (双输入框支持)
// ==========================================
// 全局变量存储选中的坐标
window.selectedLat = null;
window.selectedLng = null;

function initAutocomplete() {
    console.log("🟢 initAutocomplete starting...");

    const options = {
        componentRestrictions: { country: "au" },
        fields: ["address_components", "formatted_address", "geometry"],
        types: ["address"],
    };

    // 1. 绑定底部的报价表单 (原逻辑)
    const leadInput = document.getElementById('lead-address');
    if (leadInput) {
        const acLead = new google.maps.places.Autocomplete(leadInput, options);
        acLead.addListener("place_changed", () => {
            fillInAddress(acLead, 'lead');
        });
    }

    // 2. [新增] 绑定顶部的 Hero 搜索框 (AI 分析入口)
    const heroInput = document.getElementById('hero-address');
    if (heroInput) {
        const acHero = new google.maps.places.Autocomplete(heroInput, options);
        acHero.addListener("place_changed", () => {
            fillInAddress(acHero, 'hero');
        });
    }
}

// 提取公用的填充逻辑
function fillInAddress(autocompleteObj, source) {
    const place = autocompleteObj.getPlace();
    
    // 1. 保存全局坐标 (给 AI 分析用)
    if (place.geometry && place.geometry.location) {
        window.selectedLat = place.geometry.location.lat();
        window.selectedLng = place.geometry.location.lng();
        
        // 自动填入隐藏字段 (防丢失)
        const latField = document.getElementById('hidden-lat');
        const lngField = document.getElementById('hidden-lng');
        if(latField) latField.value = window.selectedLat;
        if(lngField) lngField.value = window.selectedLng;
    }

    // 2. 解析邮编和州
    extractedPostcode = "";
    extractedState = "";
    if (place.address_components) {
        for (const component of place.address_components) {
            const type = component.types[0];
            if (type === "postal_code") extractedPostcode = component.long_name;
            if (type === "administrative_area_level_1") extractedState = component.short_name;
        }
    }

    // 3. 自动选择州 (Dropdown)
    if (extractedState) {
        const stateSelect = document.getElementById('state-select');
        const targetVal = extractedState.toUpperCase();
        for (let i = 0; i < stateSelect.options.length; i++) {
            if (stateSelect.options[i].value === targetVal) {
                stateSelect.selectedIndex = i;
                stateSelect.dispatchEvent(new Event('change'));
                break;
            }
        }
    }
    
    // 4. [新增] 如果是在顶部输入的，把数据同步到底部，但暂时不跳转
    if (source === 'hero') {
        const leadAddr = document.getElementById('lead-address');
        if (leadAddr) leadAddr.value = document.getElementById('hero-address').value;
    }
}

// 保持暴露给全局
window.initAutocomplete = initAutocomplete;

// ==========================================
// [NEW] Modal & Appliance Logic
// ==========================================

// Attach to window
window.openApplianceModal = openApplianceModal;
window.closeApplianceModal = closeApplianceModal;
window.toggleUsage = toggleUsage;

// 显示顶部提示
function showToast(message) {
    let toast = document.getElementById("toast-notification");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast-notification";
        toast.className = "toast-msg";
        document.body.appendChild(toast);
    }
    toast.innerHTML = `<span>☝️</span> ${message}`;
    toast.classList.add("show");

    // 3秒后消失
    setTimeout(() => { toast.classList.remove("show"); }, 3000);
}

// ==========================================
// Social Proof Logic
// ==========================================
function updateSocialProof() {
    const baseCount = 1240;
    const startDate = new Date('2025-01-01').getTime();
    const now = new Date().getTime();
    const daysPassed = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
    const randomBuffer = Math.floor(Math.random() * 3);
    const currentCount = baseCount + (daysPassed * 4) + randomBuffer;
    const formattedNum = currentCount.toLocaleString();

    let template = (i18n[curLang] && i18n[curLang].social_proof) ? i18n[curLang].social_proof : "Already <span class='proof-number'>{num}+</span> families requested quotes";
    const finalHtml = template.replace('{num}', formattedNum);

    const elMain = document.getElementById('proof-content');
    if (elMain) elMain.innerHTML = finalHtml;
    const elModal = document.getElementById('conf-proof-content');
    if (elModal) elModal.innerHTML = finalHtml;
}

// ============================================================
// 🟢 [NEW] 地图抢单核心逻辑
// ============================================================
// ============================================================
// 🟢 [UPDATED] 地图抢单核心逻辑 (增加了角色权限检查)
// ============================================================
async function claimLeadOnMap(leadId) {
    // 1. 防抖：禁用所有按钮
    const btns = document.querySelectorAll('.info-btn');
    btns.forEach(b => { 
        if(!b.disabled) {
             b._originalText = b.innerText;
             b.disabled = true; 
             b.innerText = "Claiming..."; 
        }
    });

    try {
        // 2. 身份检查
        const { data: { user } } = await supabaseClient.auth.getUser();
        if(!user) throw new Error("Please Login first.");

        // 🟢 [修改点] 这里多查一个 role 字段
        const { data: partner } = await supabaseClient
            .from('partners')
            .select('id, role') // <--- 获取 role
            .eq('auth_id', user.id)
            .single();

        if(!partner) throw new Error("Partner account error.");

        // 🛑 [核心拦截] 只有 solar_pro 角色可以抢单
        // 如果您还有 'installer' 这个旧角色名，建议写成: if (partner.role !== 'solar_pro' && partner.role !== 'installer')
        if (partner.role !== 'solar_pro') {
            throw new Error("🚫 Access Denied: Only INSTALLER accounts can claim leads.");
        }

        // 3. 调用数据库 RPC 进行抢单
        const { data, error } = await supabaseClient.rpc('claim_lead_from_map', {
            p_lead_id: leadId,
            p_installer_id: partner.id
        });

        if (error) throw error;

        // 4. 处理结果
        if (data.success) {
            alert("🎉 " + data.message);
            window.location.href = 'dashboard.html'; 
        } else {
            alert("⚠️ " + data.message);
            fetchMapData(); // 刷新地图
        }
    } catch (err) {
        console.error("Claim Error:", err);
        alert(err.message); // 会弹出 "Access Denied..."
        
        // 恢复按钮状态
        btns.forEach(b => { 
            b.disabled = false; 
            if(b._originalText) b.innerText = b._originalText;
        });
    }
}

// 暴露给全局
window.claimLeadOnMap = claimLeadOnMap;

// ==========================================
// [NEW] Helper Functions (Sticky Footer & Animation)
// ==========================================

// 1. 游戏化加载动画 (Gamified Analysis Animation)
// ==========================================
// [UPDATED] 游戏化加载动画 (修复：动画过程中完全隐藏表单)
// ==========================================
// ==========================================
// [UPDATED] 游戏化加载动画 (强制覆盖 CSS !important)
// ==========================================
function playAnalysisAnimation() {
    const loader = document.getElementById('analysis-loader');
    const formContent = document.getElementById('unlock-form-content');
    const bar = document.getElementById('progress-bar');
    const text = document.getElementById('progress-text');

    // --- 1. 初始状态：强制隐藏表单 (使用 setProperty 覆盖 CSS 的 !important) ---
    if (formContent) {
        // 🟢 [核心修复] 使用 'important' 参数，强制打败 CSS 里的 display: flex !important
        formContent.style.setProperty('display', 'none', 'important');
        formContent.classList.remove('fade-in');
    }

    if (loader) loader.style.display = 'block'; // 显示加载圈
    if (bar) bar.style.width = '0%';
    if (text) text.innerText = i18n[curLang].step_1;

    // --- 2. 动画步骤 ---

    // 0.1秒
    setTimeout(() => {
        if (bar) bar.style.width = '35%';
    }, 100);

    // 1.5秒
    setTimeout(() => {
        if (text) text.innerText = i18n[curLang].step_2;
        if (bar) bar.style.width = '70%';
    }, 1500);

    // 3.0秒
    setTimeout(() => {
        if (text) text.innerText = i18n[curLang].step_3;
        if (bar) bar.style.width = '92%';
    }, 3000);

    // --- 3. 动画完成 (4.2秒)：强制显示表单 ---
    setTimeout(() => {
        // 隐藏加载器
        if (loader) loader.style.display = 'none';

        // 显示表单
        if (formContent) {
            // 🟢 [核心修复] 恢复显示，必须用 flex 才能保持居中，且同样需要 important
            formContent.style.setProperty('display', 'flex', 'important');

            // 加上淡入动画
            formContent.classList.add('fade-in');
        }

        // 更新标题
        const titleEl = document.querySelector('.unlock-title');
        if (titleEl) titleEl.innerText = i18n[curLang].quote_ready;

    }, 4200);
}

// 2. 底部悬浮栏监听 (Sticky Footer Logic)
function setupStickyObserver() {
    const mainBtn = document.getElementById('btn-final-enquiry');
    const footer = document.getElementById('sticky-footer');

    if (!mainBtn || !footer) return;

    // 先清除旧的，防止重复绑定 (可选优化)

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const isUnlocked = sessionStorage.getItem('quoteUnlocked') === 'true';
            // 只有在已解锁 且 结果卡片显示时 才生效
            const resultCard = document.getElementById('result-card');
            if (!resultCard || resultCard.style.display === 'none') return;

            if (!entry.isIntersecting && isUnlocked) {
                footer.classList.add('visible');
            } else {
                footer.classList.remove('visible');
            }
        });
    }, { threshold: 0 });

    observer.observe(mainBtn);
}

// ==========================================
// Initialization
// ==========================================
setMode('solar');
setLang('en');
currentRecValues.solarIdx = -1;
currentRecValues.validBats = [];
document.getElementById('badge-solar').style.display = 'none';
document.getElementById('badge-bat').style.display = 'none';
document.getElementById('bill-val').innerText = "100";
document.getElementById('solar-val').innerText = solarTiers[0];
document.getElementById('bat-val').innerText = "20";
updateTriggerText();
// ==========================================
// [NEW] Chat Widget Logic
// ==========================================

// ==========================================
// [NEW] Smart Chat Widget Logic (完整功能版)
// ==========================================

let isChatOpen = false;

// 1. 切换聊天窗口开关
function toggleChat() {
    isChatOpen = !isChatOpen;
    const win = document.getElementById('chat-window');
    const badge = document.querySelector('.chat-badge');

    // 获取悬浮标元素
    const cecBadge = document.querySelector('.fixed-trust-badge');
    const brandBadge = document.querySelector('.fixed-brand-badge');

    if (isChatOpen) {
        win.classList.add('open');
        if (badge) badge.style.display = 'none'; // 打开后隐藏小红点
        setTimeout(() => document.getElementById('chat-input').focus(), 300);

        // 🟢 [新增] 打开聊天时隐藏悬浮标，防止遮挡
        if (cecBadge) cecBadge.style.display = 'none';
        if (brandBadge) brandBadge.style.display = 'none';
    } else {
        win.classList.remove('open');

        // 🟢 [新增] 关闭聊天时恢复显示
        if (cecBadge) cecBadge.style.display = 'flex';
        if (brandBadge) brandBadge.style.display = 'flex';
    }
}

// 2. 监听回车键
function handleChatKey(e) {
    if (e.key === 'Enter') sendChatMessage();
}

// 3. 发送消息核心逻辑
function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const txt = input.value.trim();
    if (!txt) return;

    // 显示用户消息
    addMessage(txt, 'user');
    input.value = '';

    // 模拟机器人思考和打字延迟
    setTimeout(() => {
        const reply = generateSmartBotReply(txt);
        addMessage(reply, 'bot');
    }, 1000 + Math.random() * 500); // 随机延迟 1~1.5秒
}

// 4. 在界面添加气泡
function addMessage(text, sender) {
    const body = document.getElementById('chat-body');
    const div = document.createElement('div');
    div.classList.add('message', sender);

    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    div.innerHTML = `
        <div class="msg-content">${text}</div>
        <div class="msg-time">${timeString}</div>
    `;

    body.appendChild(div);
    body.scrollTop = body.scrollHeight;

    // 记录到全局变量
    globalChatHistory.push({
        sender: sender === 'user' ? 'Client' : 'AI Bot',
        text: text,
        time: new Date().toISOString()
    });
}

// ==========================================
// [SMART BRAIN] 升级版知识库逻辑
// ==========================================

// 规则库：包含关键词和对应的中英文回复
const chatRules = [
    {
        id: 'price',
        keywords: ['多少钱', '价格', '报价', '贵', 'price', 'cost', 'quote', 'expensive', 'how much'],
        text_cn: "最终价格取决于您的屋顶难度和选配（如黑科技板或微逆）。建议您先使用左侧计算器得到一个【预估范围】，如果您对价格满意，点击最后一步的“预约咨询”，我们的销售总监可以给您申请特批折扣。",
        text_en: "Final pricing depends on roof complexity and hardware choice. I recommend using the calculator on the left to get a baseline range first. If the ROI looks good, book a consultation at the end—our director might approve a special discount."
    },
    {
        id: 'battery_advice',
        keywords: ['电池', '储能', 'battery', 'storage', 'batteries'],
        text_cn: "现在的电池价格已经比几年前降了很多！如果您家里有泳池、电动车或者晚上用电多，加装电池（10kWh+）绝对划算，回本周期通常能控制在 6-7 年内。",
        text_en: "Battery prices have dropped significantly! If you have a pool, EV, or high night usage, a 10kWh+ battery is a no-brainer. Payback periods are now often under 7 years."
    },
    {
        id: 'brands_panels',
        keywords: ['板子', '组件', '品牌', 'jinko', 'longi', 'trina', 'panels', 'brand', 'tier 1'],
        text_cn: "Solaryo 只选用 CEC 认证的 Tier 1 一线品牌（如 Jinko, Trina, Longi）。这些板子通常带有 25 年性能质保，既能保证澳洲夏天的耐热性，也是银行认可的可融资品牌。",
        text_en: "We only strictly use CEC Accredited Tier 1 panels (e.g., Jinko, Trina, Longi). They come with 25-year performance warranties and are bankable brands proven to withstand the harsh Aussie sun."
    },
    {
        id: 'inverter',
        keywords: ['逆变器', '华为', '锦浪', '固德威', 'sungrow', 'goodwe', 'inverter', 'fronius', 'enphase'],
        text_cn: "逆变器是系统的心脏。默认配置我们推荐 Sungrow 或 Goodwe（性价比之王），如果您预算充足且有阴影遮挡问题，我们也可以升级为 Enphase 微型逆变器。",
        text_en: "The inverter is the heart of the system. We recommend Sungrow or Goodwe for the best bang-for-buck. If you have shading issues, we can upgrade you to Enphase Micro-inverters."
    },
    {
        id: 'warranty',
        keywords: ['保修', '质保', '坏了', '维修', 'warranty', 'guarantee', 'broken', 'repair'],
        text_cn: "放心，我们提供【10年安装工艺质保】+【厂家25年性能质保】。如果在保修期内出现非人为故障，我们会免费上门更换，不让您操心。",
        text_en: "Peace of mind is key. We offer a 10-Year Workmanship Warranty + 25-Year Manufacturer Performance Warranty. If anything fails, we handle the replacement for free."
    },
    {
        id: 'tesla',
        keywords: ['特斯拉', 'tesla', 'powerwall'],
        text_cn: "Tesla Powerwall 确实是好产品，但价格较高（约 $16k+）。从投资回报率(ROI)角度看，我们更推荐同等容量但价格只要一半的 Tier 1 储能品牌（如 Sungrow 或 Goodwe），省下的钱都够交好几年电费了！",
        text_en: "The Tesla Powerwall is a premium product, but pricey ($16k+). For better ROI, we recommend Tier 1 alternatives (like Sungrow/Goodwe) that offer similar capacity for half the price. The savings alone cover years of bills!"
    },
    {
        id: 'rebate',
        keywords: ['补贴', '政府', 'rebate', 'subsidy', 'gov', 'incentive'],
        text_cn: "澳洲的补贴政策一直在变（比如 STC 每年递减）。好消息是，我们的计算器是实时更新的！只要您在上方的下拉菜单选择正确的【州/领地】，系统会自动扣除您能拿到的所有补贴。",
        text_en: "Rebates change often (STC drops every year). The good news is our calculator is live-updated! Just select your correct State from the dropdown above, and we'll automatically deduct all eligible incentives."
    },
    {
        id: 'human',
        keywords: ['人工', '人', '电话', 'human', 'person', 'call', 'speak', 'support'],
        text_cn: "想直接和专家聊聊？没问题！请在计算器最后一步输入您的电话，我们会有高级工程师（不是销售客服）在 24 小时内回访您，为您做定制方案。",
        text_en: "Want to speak to a human? Sure! Just verify your phone number at the final step of the quote. A senior engineer (not just a sales rep) will call you within 24 hours."
    },

    // --- [新增] 1. 热情打招呼 ---
    {
        id: 'greeting',
        keywords: ['你好', '您好', '哈喽', '嗨', 'hello', 'hi', 'hey', 'morning', 'afternoon', 'evening', 'gday'],
        text_cn: "您好！很高兴为您服务。我是 Solaryo 的智能助手 🤖。您是想了解今天的最新报价，还是想咨询电池方案？",
        text_en: "Hi there! Great to see you. I'm Solaryo's virtual assistant 🤖. Are you looking for a quick quote or some advice on batteries?"
    },

    // --- [新增] 2. 感谢与肯定 (引导留资) ---
    {
        id: 'thanks',
        keywords: ['谢谢', '感谢', '好的', 'ok', 'thx', 'thanks', 'thank', 'cool', 'great', 'awesome'],
        text_cn: "不客气！能帮到您是我的荣幸。🌟 如果您对目前的方案还满意，记得在计算器最后一步输入联系方式，我可以为您锁定今天的优惠价格！",
        text_en: "You're very welcome! Happy to help. 🌟 If you like what you see, don't forget to enter your details at the final step to lock in today's special pricing!"
    },

    // --- [新增] 3. 抱怨与负面情绪 (安抚 + 转人工) ---
    {
        id: 'complaint',
        keywords: ['甚至', '蠢', '傻', '笨', '垃圾', '滚', '太贵', '慢', '没用', 'stupid', 'dumb', 'bad', 'shit', 'fuck', 'useless', 'slow', 'expensive', 'hate'],
        text_cn: "非常抱歉给您带来不好的体验 😔。我只是一个 AI 程序，可能没能完全理解您的需求。强烈建议您在页面底部留下电话，我们的【高级客户经理】会亲自致电向您赔礼道歉，并解决您的问题。",
        text_en: "I'm really sorry to hear you're frustrated 😔. As an AI, I might have missed the mark. I strongly suggest leaving your number at the bottom—our 【Senior Manager】 will call you personally to sort this out for you."
    },
];

// 兜底回复库 (当不知道怎么回的时候，引导去发邮件)
const fallbackResponses = {
    cn: [
        "这个问题我暂时答不上来 😅。如果您有任何具体需求或疑问，欢迎发送邮件至 <a href='mailto:info@solaryo.com.au' style='color:#0f172a; text-decoration:underline; font-weight:bold;'>info@solaryo.com.au</a>，我们会尽快回复。",
        "抱歉，我可能没完全理解。如有任何业务需求，请直接 Email 联系我们：<a href='mailto:info@solaryo.com.au' style='color:#0f172a; text-decoration:underline; font-weight:bold;'>info@solaryo.com.au</a>"
    ],
    en: [
        "I'm not sure about that one 😅. If you have any specific requirements, please email us at <a href='mailto:info@solaryo.com.au' style='color:#0f172a; text-decoration:underline; font-weight:bold;'>info@solaryo.com.au</a>",
        "Sorry, I missed that. For any specific enquiries, feel free to email us directly: <a href='mailto:info@solaryo.com.au' style='color:#0f172a; text-decoration:underline; font-weight:bold;'>info@solaryo.com.au</a>"
    ]
};

// 匹配引擎
function generateSmartBotReply(input) {
    const lowerInput = input.toLowerCase();
    const isCN = (typeof curLang !== 'undefined' && curLang === 'cn');

    // 1. 遍历规则库
    for (const rule of chatRules) {
        for (const key of rule.keywords) {
            if (lowerInput.includes(key)) {
                return isCN ? rule.text_cn : rule.text_en;
            }
        }
    }

    // 2. 随机兜底
    const fallbackList = isCN ? fallbackResponses.cn : fallbackResponses.en;
    const randomIdx = Math.floor(Math.random() * fallbackList.length);
    return fallbackList[randomIdx];
}

// 🟢 [新增] 根据预算自动选择最接近的 Tier
function autoSelectTierByBudget(budgetVal) {
    if (!budgetVal) budgetVal = parseFloat(document.getElementById('budget-input').value);

    // 获取当前计算出的三个档位的净价
    const pEntry = currentBasePrices.entry; 
    const pMedium = currentBasePrices.medium;
    const pPremium = currentBasePrices.premium;

    // 检查 Entry 是否被禁用
    const isEntryDisabled = document.getElementById('box-entry').classList.contains('disabled');

    // 计算差值 (如果禁用则设为无穷大，确保不被选中)
    const diffEntry = isEntryDisabled ? Infinity : Math.abs(pEntry - budgetVal);
    const diffMedium = Math.abs(pMedium - budgetVal);
    const diffPremium = Math.abs(pPremium - budgetVal);

    // 找出差值最小的那个
    let bestMatch = 'medium'; 
    let minDiff = diffMedium;

    if (diffEntry < minDiff) { minDiff = diffEntry; bestMatch = 'entry'; }
    if (diffPremium < minDiff) { minDiff = diffPremium; bestMatch = 'premium'; }

    // 执行高亮选择
    selectTier(bestMatch);
}
// ==========================================
// [MODIFIED] FOMO Bar Logic (Supabase Connected)
// ==========================================

// 1. 定义一个空数组，稍后填入数据
let fomoData = [];
let currentFomoIndex = 0;
let fomoInterval;

// 2. 从 Supabase 获取数据
async function fetchFomoData() {
    try {
        const { data, error } = await supabaseClient
            .from('fomo_news')
            .select('*')
            .eq('is_active', true)         // 只读取激活的新闻
            .order('created_at', { ascending: false }); // 最新的在前面

        if (error) throw error;

        if (data && data.length > 0) {
            fomoData = data;
            // 数据加载完了，启动滚动条
            initFomoBar();
        } else {
            // 如果没数据，隐藏条子
            document.getElementById('fomo-bar').style.display = 'none';
        }

    } catch (err) {
        console.error('Error fetching FOMO news:', err);
        // 出错时也可以显示一条默认的
        document.getElementById('fomo-text').innerText = "Contact us for latest solar deals!";
    }
}

// 3. 初始化滚动逻辑
function initFomoBar() {
    // 安全检查：如果没数据或元素不存在，直接退出
    if (!fomoData || fomoData.length === 0) return;
    if (!document.getElementById('fomo-bar')) return;

    // 先显示第一条
    updateFomoContent();

    // 如果只有一条数据，就不需要滚动了
    if (fomoData.length === 1) return;

    // 清除旧定时器（防止重复运行）
    if (fomoInterval) clearInterval(fomoInterval);

    fomoInterval = setInterval(() => {
        const contentEl = document.querySelector('.fomo-content');
        if (!contentEl) return;

        // 向上滚出
        contentEl.classList.add('scrolling-out');

        setTimeout(() => {
            currentFomoIndex = (currentFomoIndex + 1) % fomoData.length;
            updateFomoContent();

            // 瞬间移到底部
            contentEl.classList.remove('scrolling-out');
            contentEl.classList.add('scrolling-in-ready');

            // 强制重绘
            void contentEl.offsetWidth;

            // 向上滚入
            contentEl.classList.remove('scrolling-in-ready');
        }, 500);

    }, 5000);
}

// 4. 更新内容函数 (保持不变，但为了确保上下文，这里完整列出)
function updateFomoContent() {
    if (!fomoData || fomoData.length === 0) return;

    const item = fomoData[currentFomoIndex];
    const isCN = (typeof curLang !== 'undefined' && curLang === 'cn');

    // 更新图标
    const iconEl = document.getElementById('fomo-icon');
    if (iconEl) iconEl.innerText = item.icon || '🔥';

    // 更新文字
    const textEl = document.getElementById('fomo-text');
    if (textEl) textEl.innerText = isCN ? item.title_cn : item.title_en;

    // 更新标签颜色
    const labelEl = document.querySelector('.fomo-label');
    if (labelEl) {
        labelEl.style.display = "inline-flex";
        labelEl.style.alignItems = "center";
        labelEl.style.justifyContent = "center";
        labelEl.style.height = "16px";
        labelEl.style.padding = "0 6px";
        labelEl.style.borderRadius = "4px";

        if (item.type === 'news') {
            labelEl.innerText = "NEWS";
            labelEl.style.backgroundColor = "#ef4444";
            labelEl.style.color = "#ffffff";
        } else {
            labelEl.innerText = "CASE";
            labelEl.style.backgroundColor = "#10b981";
            labelEl.style.color = "#ffffff";
        }
    }
}

// 5. 确保在页面加载完成后调用
document.addEventListener('DOMContentLoaded', () => {
    // 启动数据拉取
    fetchFomoData();
});

// ==========================================
// [INTERACTION] FOMO Modal Logic
// ==========================================

function openFomoModal() {
    // 安全检查
    if (!fomoData || fomoData.length === 0) return;

    // 1. 获取元素
    const item = fomoData[currentFomoIndex];
    const isCN = (typeof curLang !== 'undefined' && curLang === 'cn');
    const modal = document.getElementById('fomo-detail-modal');
    const card = document.querySelector('.fomo-card'); // 获取卡片元素

    // 2. 填充内容 (保持不变)
    const imgEl = document.getElementById('fomo-modal-img');
    if (item.img_url) {
        imgEl.src = item.img_url;
        imgEl.parentElement.style.display = 'block';
    } else {
        imgEl.parentElement.style.display = 'none';
    }

    const badgeEl = document.getElementById('fomo-modal-badge');
    if (item.type === 'news') {
        badgeEl.innerText = isCN ? "NEWS" : "NEWS";
        badgeEl.style.background = "#ef4444";
    } else {
        badgeEl.innerText = isCN ? "CASE" : "CASE";
        badgeEl.style.background = "#10b981";
    }

    document.getElementById('fomo-modal-title').innerText = isCN ? item.title_cn : item.title_en;
    document.getElementById('fomo-modal-desc').innerHTML = isCN ? item.desc_cn : item.desc_en;
    document.getElementById('fomo-modal-date').innerText = item.date || 'Just Now';

    // ===============================================
    // 🟢 修复核心：调整执行顺序
    // ===============================================

    // 第一步：先让弹窗显示出来！(这一步必须在重排之前)
    // 只有显示了，浏览器才知道这个元素多大，才能进行重排
    modal.style.display = 'flex';

    // 第二步：先移除动画
    card.style.animation = 'none';

    // 第三步：强制浏览器计算高度 (触发重排 Reflow)
    // 此时因为 display 已经是 flex 了，offsetWidth 才有数值，重排才会生效
    void card.offsetWidth;

    // 第四步：手动重新指定动画 (直接把 CSS 里的动画参数写在这里)
    // 这样能确保浏览器认为这是一个新的动画指令
    card.style.animation = 'cardPopUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
}

function closeFomoModal(event) {
    const overlay = document.getElementById('fomo-detail-modal');

    // 点击遮罩层、关闭按钮、或底部按钮时关闭
    // 注意：点击卡片内部(.fomo-card)不应该关闭
    if (!event ||
        event.target === overlay ||
        event.target.closest('.fomo-close-btn') ||
        event.target.closest('.fomo-action-btn')) {

        overlay.style.display = 'none';

        // 可选：如果之前暂停了，这里可以重新启动滚动
        // initFomoBar(); 
    }
}

// 将其挂载到全局初始化
document.addEventListener('DOMContentLoaded', () => {
    initFomoBar();
});

// 为了支持语言切换时即时更新
const originalSetLang = window.setLang; // 劫持原本的 setLang
window.setLang = function (lang) {
    if (originalSetLang) originalSetLang(lang); // 执行原逻辑
    updateFomoContent(); // 执行 FOMO 更新
};
// ==========================================
// [FINAL COMPLETE] Brand Hub & Detail Logic (Bilingual + Supabase)
// ==========================================

// 1. 定义全局变量
let brandDataDB = {};

// 2. 从 Supabase 拉取数据 (包含中英文)
async function fetchBrandDetails() {
    try {
        const { data, error } = await supabaseClient
            .from('brand_details')
            .select('*')
            .eq('is_active', true)
            .order('id', { ascending: true });

        if (error) throw error;

        if (data) {
            brandDataDB = {}; // 清空旧数据

            data.forEach(item => {
                brandDataDB[item.brand_id] = {
                    // 核心字段
                    type: item.type,
                    logo: item.logo_url,
                    
                    // 英文数据
                    name_en: item.name,
                    desc_en: item.description,
                    tags_en: item.tags || [],
                    features_en: item.features || [],

                    // 中文数据 (如果没有中文，回退到英文)
                    name_cn: item.name_cn || item.name,
                    desc_cn: item.description_cn || item.description,
                    tags_cn: item.tags_cn || item.tags || [],
                    features_cn: item.features_cn || item.features || []
                };
            });
            
            // 拉取完立即渲染
            renderBrandHub(); 
        }

    } catch (err) {
        console.error("品牌数据加载失败:", err);
    }
}

// 3. 渲染品牌列表 (支持语言切换)
function renderBrandHub() {
    const batteryGrid = document.getElementById('hub-grid-battery');
    const solarGrid = document.getElementById('hub-grid-solar');
    
    if(!batteryGrid || !solarGrid) return;
    
    batteryGrid.innerHTML = '';
    solarGrid.innerHTML = '';

    // 判断当前语言
    const isCN = (typeof curLang !== 'undefined' && curLang === 'cn');

    Object.keys(brandDataDB).forEach(key => {
        const brand = brandDataDB[key];
        
        // 动态获取名字
        const displayName = isCN ? brand.name_cn : brand.name_en;

        const card = document.createElement('div');
        card.className = 'hub-brand-item';
        card.onclick = () => showBrandDetail(key);
        
        const html = `
            <img src="${brand.logo}" class="hub-brand-img" alt="${displayName}" 
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
            <span class="hub-brand-name" ${brand.logo ? 'style="display:none;"' : ''}>${displayName}</span>
        `;
        card.innerHTML = html;

        if (brand.type === 'battery') {
            batteryGrid.appendChild(card);
        } else if (brand.type === 'solar') {
            solarGrid.appendChild(card);
        }
    });
}

// 4. 打开详情页 (支持语言切换 + HTML内容)
function showBrandDetail(brandKey) {
    const brand = brandDataDB[brandKey];
    if (!brand) return;

    const isCN = (typeof curLang !== 'undefined' && curLang === 'cn');

    // 获取对应语言的数据
    const dName = isCN ? brand.name_cn : brand.name_en;
    const dDesc = isCN ? brand.desc_cn : brand.desc_en;
    const dTags = isCN ? brand.tags_cn : brand.tags_en;
    const dFeatures = isCN ? brand.features_cn : brand.features_en;

    // 填充 Logo
    const logoEl = document.getElementById('detail-logo');
    logoEl.src = brand.logo;
    logoEl.onerror = () => { logoEl.style.display = 'none'; }; 
    logoEl.onload = () => { logoEl.style.display = 'block'; };

    // 填充文字 (注意使用 innerHTML 支持 Supabase 里的图片代码)
    document.getElementById('detail-name').innerText = dName;
    document.getElementById('detail-desc').innerHTML = dDesc; 

    // 渲染标签
    const tagsContainer = document.getElementById('detail-tags');
    tagsContainer.innerHTML = dTags.map(t => `<span class="d-tag">${t}</span>`).join('');

    // 渲染特性列表
    const featuresList = document.getElementById('detail-features-list');
    featuresList.innerHTML = dFeatures.map(f => `<li>${f}</li>`).join('');

    // 切换界面：隐藏列表，显示详情
    document.getElementById('brand-hub-modal').style.display = 'none';
    document.getElementById('brand-detail-modal').style.display = 'flex';
}

// 5. 打开品牌中心 (Level 1)
function openBrandHub() {
    // 每次打开检查数据，如果为空则拉取
    if (Object.keys(brandDataDB).length === 0) {
        fetchBrandDetails();
    }
    
    document.getElementById('brand-hub-modal').style.display = 'flex';
    
    // 隐藏悬浮元素，防止遮挡
    const badge = document.querySelector('.fixed-brand-badge');
    if (badge) badge.style.display = 'none';

    const fomo = document.getElementById('fomo-bar');
    if (fomo) fomo.style.display = 'none';

    // 🟢 [新增] 隐藏底部导航栏 (防止遮挡内容)
    const navBar = document.querySelector('.bottom-nav-container');
    if (navBar) navBar.style.display = 'none';
}

// 6. 关闭品牌中心 (Level 1)
function closeBrandHub(e) {
    const overlay = document.getElementById('brand-hub-modal');
    if (!e || e.target === overlay || e.target.classList.contains('close-btn')) {
        overlay.style.display = 'none';
        
        // 恢复悬浮元素
        const badge = document.querySelector('.fixed-brand-badge');
        if (badge) badge.style.display = 'flex'; 

        const fomo = document.getElementById('fomo-bar');
        // 只有当有新闻数据时才恢复显示
        if (fomo && typeof fomoData !== 'undefined' && fomoData.length > 0) {
            fomo.style.display = 'flex';
        }

        // 🟢 [新增] 恢复底部导航栏
        const navBar = document.querySelector('.bottom-nav-container');
        if (navBar) navBar.style.display = ''; // 清空内联样式，恢复CSS里的 flex
    }
}

// 7. 从详情页返回列表
function backToHub() {
    document.getElementById('brand-detail-modal').style.display = 'none';
    document.getElementById('brand-hub-modal').style.display = 'flex';
}

// 8. 关闭详情页 (直接关闭所有弹窗)
function closeBrandDetail(e) {
    const overlay = document.getElementById('brand-detail-modal');
    if (!e || e.target === overlay || e.target.classList.contains('close-btn') || e.target.classList.contains('btn-modal-ok')) {
        overlay.style.display = 'none';
        
        // 恢复悬浮元素
        const badge = document.querySelector('.fixed-brand-badge');
        if (badge) badge.style.display = 'flex';

        const fomo = document.getElementById('fomo-bar');
        if (fomo && typeof fomoData !== 'undefined' && fomoData.length > 0) {
            fomo.style.display = 'flex';
        }

        // 🟢 [新增] 恢复底部导航栏
        const navBar = document.querySelector('.bottom-nav-container');
        if (navBar) navBar.style.display = ''; // 清空内联样式，恢复CSS里的 flex
    }
}

// 9. 监听语言切换事件
// (劫持 setLang 函数，以便在切换语言时重新渲染品牌墙)
const originalSetLangForBrand = window.setLang; 
window.setLang = function (lang) {
    if (originalSetLangForBrand) originalSetLangForBrand(lang); // 执行原逻辑
    
    // 执行额外刷新逻辑
    if (typeof updateFomoContent === 'function') updateFomoContent(); // 更新滚动条语言
    renderBrandHub();    // 更新品牌墙语言

    // [NEW] Refresh inline analysis texts after language switch
    if (window.inlineAnalysisState) {
        const s = window.inlineAnalysisState;
        renderSolarScore(s.totalScore, s.gradeKey);
        setSubScore('inline-sun-score', 'inline-sun-bar', s.sunScore);
        setSubScore('inline-cap-score', 'inline-cap-bar', s.capScore);
        const reco = document.getElementById('inline-battery-reco');
        if (reco) reco.textContent = (i18n[curLang] && i18n[curLang].inline_battery_reco)
            ? i18n[curLang].inline_battery_reco
            : reco.textContent;
    }
};

// 10. 暴露给全局 window
window.openBrandHub = openBrandHub;
window.closeBrandHub = closeBrandHub;
window.backToHub = backToHub;
window.closeBrandDetail = closeBrandDetail;

// 11. 初始化加载
document.addEventListener('DOMContentLoaded', () => {
    fetchBrandDetails();
});
// ==========================================
// [NEW] Welcome Flash Logic
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. 延迟 0.5秒 显示，给用户一点反应时间
    setTimeout(() => {
        const flash = document.getElementById('welcome-flash');
        if (flash) {
            flash.classList.add('show');
            
            // 2. 3.5秒后自动隐藏 (配合 CSS 的进度条时间)
            setTimeout(() => {
                flash.classList.remove('show');
            }, 4500); 
        }
    }, 800);
});

// ==========================================
// [NEW] Partner Hub Logic (Complete & Translated)
// ==========================================

// 1. 通用电话格式化 (全局调用)
function formatPhone(input) {
    let x = input.value.replace(/\D/g, '').match(/(\d{0,4})(\d{0,3})(\d{0,3})/);
    input.value = !x[2] ? x[1] : x[1] + ' ' + x[2] + (x[3] ? ' ' + x[3] : '');
}

// 1. 打开/关闭逻辑 (控制 FOMO 和 底部悬浮按钮 显隐)
function openPartnerModal() {
    document.getElementById('partner-step-1').style.display = 'block';
    document.getElementById('partner-step-2').style.display = 'none';
    document.getElementById('partner-modal').style.display = 'flex';
    
    // 🟢 [修改] 隐藏所有干扰元素 (FOMO + 右下角三件套)
    const elementsToHide = [
        'fomo-bar',                // 顶部通知条
        '.chat-widget-container',  // 客服聊天
        '.fixed-trust-badge',      // CEC Logo
        '.fixed-brand-badge'       // Top Brand Logo
    ];

    elementsToHide.forEach(selector => {
        // 判断是 ID 还是 Class
        const el = selector.startsWith('.') 
            ? document.querySelector(selector) 
            : document.getElementById(selector);
        if(el) el.style.display = 'none';
    });
}

function closePartnerModal(e) {
    const overlay = document.getElementById('partner-modal');
    // 判断点击的是遮罩层还是关闭按钮
    if (!e || e.target === overlay || e.target.classList.contains('close-btn')) {
        overlay.style.display = 'none';
        
        // 🟢 [修改] 恢复所有干扰元素
        const elementsToShow = [
            'fomo-bar',
            '.chat-widget-container',
            '.fixed-trust-badge',
            '.fixed-brand-badge'
        ];

        elementsToShow.forEach(selector => {
            const el = selector.startsWith('.') 
                ? document.querySelector(selector) 
                : document.getElementById(selector);
            
            if(el) {
                // 特殊处理 FOMO Bar: 只有当有数据时才恢复 flex，否则保持 none
                if (selector === 'fomo-bar') {
                    if (typeof fomoData !== 'undefined' && fomoData.length > 0) {
                        el.style.display = 'flex';
                    }
                } else {
                    // 其他元素：清空内联样式，让它恢复 CSS 里的默认值 (flex 或 block)
                    el.style.display = ''; 
                }
            }
        });
    }
}

function backToRoles() {
    document.getElementById('partner-step-1').style.display = 'block';
    document.getElementById('partner-step-2').style.display = 'none';
}

// 3. 辅助函数：生成服务区域 HTML (State + Region Tags)
// 3. 辅助函数：生成服务区域 HTML (State + Region Tags)
function getServiceAreaHTML() {
    const t = i18n[curLang];
    
    // 🟢 [修改 1] 去掉 grid-2-compact，改为垂直排列
    // 🟢 [修改 2] Option 显示文本改为全称 (New South Wales, Victoria...)
    return `
        <div class="form-group-compact">
            <label>${t.lbl_svc_state}</label>
            <select id="p-service-state" onchange="renderServiceRegions(this.value)">
                <option value="NSW_ACT">New South Wales & ACT</option>
                <option value="VIC">Victoria</option>
                <option value="QLD">Queensland</option>
                <option value="SA">South Australia</option>
                <option value="WA">Western Australia</option>
                <option value="TAS">Tasmania</option>
                <option value="NT">Northern Territory</option>
                <option value="Nationwide" style="font-weight:bold; color:#1d4ed8;">${t.opt_nationwide}</option>
            </select>
        </div>
        
        <div class="form-group-compact" id="region-container-wrapper">
            <label>${t.lbl_svc_regions}</label>
            <div id="region-pills-container" class="checkbox-group-pills">
                </div>
        </div>
    `;
}

// 4. 渲染 Region 标签
function renderServiceRegions(state) {
    const container = document.getElementById('region-pills-container');
    if (!container) return;

    container.innerHTML = ''; // 清空
    const t = i18n[curLang];

    if (state === 'Nationwide') {
        container.innerHTML = `<div style="font-size:0.85rem; color:#10b981; font-weight:600; padding:8px;">${t.txt_all_au}</div>`;
        return;
    }

    const regions = regionMap[state] || [];
    regions.forEach(region => {
        const label = document.createElement('label');
        label.className = 'check-pill';
        label.innerHTML = `
            <input type="checkbox" name="svc_region" value="${region}">
            <span>${region}</span>
        `;
        container.appendChild(label);
    });
}

// 5. 动态表单生成 (双语 + 备注框)
// [MODIFIED] 动态生成表单 (已添加 multiple 属性)
function showPartnerForm(role) {
    document.getElementById('p-role').value = role;
    const t = i18n[curLang]; 

    // 设置标题 & 标签
    document.getElementById('form-role-title').innerText = t.p_reg_title;
    document.querySelector('.form-section-title').innerText = t.lbl_biz_details;
    document.querySelector('label[for="p-company"]').innerText = t.lbl_company_name;
    document.querySelector('label[for="p-address"]').innerText = t.lbl_address;
    document.querySelector('label[for="p-abn"]').innerText = t.lbl_abn;
    document.querySelector('label[for="p-contact"]').innerText = t.lbl_contact;
    document.querySelector('label[for="p-phone"]').innerText = t.lbl_phone;
    document.querySelector('label[for="p-email"]').innerText = t.lbl_email;
    document.querySelector('.btn-partner-submit').innerText = t.btn_submit_app;

    const radioLabels = document.querySelectorAll('.radio-box-small span');
    if(radioLabels.length >= 4) {
        radioLabels[0].innerText = t.opt_company;
        radioLabels[1].innerText = t.opt_sole;
        radioLabels[2].innerText = t.opt_partner;
        radioLabels[3].innerText = t.opt_private;
    }

    const container = document.getElementById('dynamic-fields-area');
    container.innerHTML = ''; 

    // --- A. Solar Pro ---
    if (role === 'solar_pro') {
        container.innerHTML = `
            <div class="form-group-compact">
                <label>${t.lbl_biz_focus}</label>
                <select id="p-focus">
                    <option value="retailer_leads">${t.opt_retailer}</option>
                    <option value="installer_jobs">${t.opt_installer}</option>
                    <option value="both">${t.opt_both}</option>
                    <option value="both">${t.opt_all}</option>
                </select>
            </div>
            <div class="form-group-compact">
                <label>${t.lbl_cec}</label>
                <input type="text" id="p-cec" placeholder="Axxxxxxx">
            </div>
            ${getServiceAreaHTML()} 
        `;
    } 
    // --- B. Electrician ---
    else if (role === 'electrician') {
        container.innerHTML = `
            <div class="form-group-compact">
                <label>${t.lbl_elec_level}</label>
                <select id="p-elec-type">
                    <option value="licensed">${t.opt_licensed}</option>
                    <option value="cec_accredited">${t.opt_cec_elec}</option>
                    <option value="apprentice">${t.opt_apprentice}</option>
                </select>
            </div>
            <div class="form-group-compact">
                <label>${t.lbl_exp}</label>
                <div class="checkbox-group-pills">
                    <label class="check-pill"><input type="checkbox" name="elec_exp" value="Solar PV"><span>☀️ Solar PV</span></label>
                    <label class="check-pill"><input type="checkbox" name="elec_exp" value="Battery"><span>🔋 Battery</span></label>
                    <label class="check-pill"><input type="checkbox" name="elec_exp" value="EV Charger"><span>🚗 EV Charger</span></label>
                </div>
            </div>
            <div class="form-group-compact">
                <label>${t.lbl_license}</label>
                <input type="text" id="p-license">
            </div>
            ${getServiceAreaHTML()}
            <div class="form-group-compact">
                <label>${t.lbl_upload_ins}</label>
                <div class="file-upload-wrapper">
                    <input type="file" id="p-file-insurance" accept="image/*,.pdf" multiple>
                </div>
            </div>
        `;
    } 
    // --- C. Brand ---
    else if (role === 'brand') {
        container.innerHTML = `
            <div class="form-group-compact">
                <label>${t.lbl_dist_brands}</label>
                <input type="text" id="p-brands" required>
            </div>
            <div class="form-group-compact">
                <label>${t.lbl_prod_cat}</label>
                <select id="p-prod-type">
                    <option value="panels">Solar Panels</option>
                    <option value="inverter">Inverters</option>
                    <option value="battery">Batteries</option>
                    <option value="mounting">Mounting / BoS</option>
                    <option value="all">Full Range</option>
                </select>
            </div>
            ${getServiceAreaHTML()}
            <div class="form-group-compact">
                <label>${t.lbl_upload_prod}</label>
                <div class="file-upload-wrapper">
                    <input type="file" id="p-file-product" accept=".pdf,.xlsx,.csv" multiple>
                </div>
            </div>
        `;
    }
    // ... 前面是 role === 'brand' 的逻辑 ...

    // --- D. 能源推荐官 (Referral) ---
    else if (role === 'referral') {
        container.innerHTML = `
            <div class="form-group-compact">
                <label>${t.lbl_ref_source}</label>
                <select id="p-ref-source">
                    <option value="customer">${t.opt_past_client}</option>
                    <option value="agent">${t.opt_real_estate}</option>
                    <option value="trade">${t.opt_trades}</option>
                    <option value="influencer">${t.opt_influencer_simple}</option>
                </select>
            </div>
            
            <div class="form-group-compact">
                <label>${t.lbl_pay_method}</label>
                <input type="text" id="p-payment" placeholder="${t.ph_pay_method}">
            </div>

            ${getServiceAreaHTML()}
        `;
    }
    
    // ... 后续代码 ...

    // 备注框
    const notesField = document.createElement('div');
    notesField.innerHTML = `
        <div class="form-group-compact" style="margin-top: 15px; border-top: 1px dashed #e2e8f0; padding-top: 15px;">
            <label>${t.lbl_notes}</label>
            <textarea id="p-notes" rows="2"></textarea>
        </div>
    `;
    container.appendChild(notesField);

    document.getElementById('partner-step-1').style.display = 'none';
    document.getElementById('partner-step-2').style.display = 'block';

    initPartnerAddressAutocomplete();
    renderServiceRegions('NSW_ACT');
}

// 6. 初始化 Google Autocomplete
function initPartnerAddressAutocomplete() {
    const input = document.getElementById('p-address');
    if (!input) return;
    const options = {
        componentRestrictions: { country: "au" },
        fields: ["formatted_address"],
        types: ["address"],
    };
    new google.maps.places.Autocomplete(input, options);
}

// 7. 提交逻辑
// [REPLACED] 合作伙伴申请提交 (仅存数据库，不创建 Auth 账号)
async function submitPartner(e) {
    e.preventDefault();
    const t = i18n[curLang];
    const btn = document.querySelector('.btn-partner-submit');
    const originalText = btn.innerText;

    // --- 1. 获取输入值 ---
    const phoneInput = document.getElementById('p-phone');
    const emailInput = document.getElementById('p-email');
    
    // 注意：这里不再获取 passwordInput
    
    const phoneVal = phoneInput.value.trim().replace(/[\s-]/g, '');
    const emailVal = emailInput.value.trim();

    // --- 2. 验证 ---
    if (!/^(?:04\d{8}|0[2378]\d{8})$/.test(phoneVal)) {
        alert(t.msg_err_phone); phoneInput.focus(); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
        alert(t.msg_err_email); emailInput.focus(); return;
    }

    btn.disabled = true;
    btn.innerText = t.msg_submitting;

    try {
        // --- [修改点] 不再创建 Auth 账号 ---
        // 我们直接跳过 auth.signUp，只处理文件上传和数据库写入

        // --- 3. 准备数据 ---
        const role = document.getElementById('p-role').value;
        const bizType = document.querySelector('input[name="biz_type"]:checked')?.value || 'company';
        const selectedState = document.getElementById('p-service-state')?.value || '';
        
        let finalServiceAreaStr = "";
        if (selectedState === 'Nationwide') finalServiceAreaStr = "Nationwide";
        else if (selectedState) {
            const regions = Array.from(document.querySelectorAll('input[name="svc_region"]:checked')).map(cb => cb.value);
            finalServiceAreaStr = regions.length > 0 ? `${selectedState}: ${regions.join(', ')}` : `${selectedState}`;
        }

        const payload = {
            // [注意] 我们不再传 id: userId，让数据库自动生成主键 ID
            created_at: new Date().toISOString(),
            role: role,
            business_type: bizType,
            company_name: document.getElementById('p-company').value,
            abn_acn: document.getElementById('p-abn').value,
            contact_name: document.getElementById('p-contact').value,
            phone: phoneInput.value,
            email: emailInput.value,
            address: document.getElementById('p-address').value,
            notes: document.getElementById('p-notes').value,
            
            // 业务字段
            business_focus: document.getElementById('p-focus')?.value || null,
            cec_number: document.getElementById('p-cec')?.value || null,
            service_postcodes: finalServiceAreaStr || null,
            specialty_brands: document.getElementById('p-brands')?.value || null,
            electrician_type: document.getElementById('p-elec-type')?.value || null,
            install_experience: Array.from(document.querySelectorAll('input[name="elec_exp"]:checked')).map(cb => cb.value).join(', ') || null,
            license_number: document.getElementById('p-license')?.value || null,
            product_category: document.getElementById('p-prod-type')?.value || null,
            // ... 在 payload 对象中 ...
            
            // 🟢 新增：推荐官专属字段
            referral_source: document.getElementById('p-ref-source')?.value || null, 
            payout_method: document.getElementById('p-payment')?.value || null,     
            
        // ...
            // [关键] 状态设为待审核
            status: 'pending_review' 
        };

        // --- 4. 文件上传 (保持不变) ---
        let fileInput = null;
        if (role === 'electrician') fileInput = document.getElementById('p-file-insurance');
        if (role === 'brand') fileInput = document.getElementById('p-file-product');

        if (fileInput && fileInput.files.length > 0) {
            const files = Array.from(fileInput.files);
            const uploadPromises = files.map(async (file) => {
                const fileName = `${role}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                const { data: uploadData, error: uploadError } = await supabaseClient.storage.from('uploads').upload(fileName, file);
                if (uploadError) throw uploadError;
                const { data: urlData } = supabaseClient.storage.from('uploads').getPublicUrl(uploadData.path);
                return urlData.publicUrl;
            });
            const uploadedUrls = await Promise.all(uploadPromises);
            payload.file_url = uploadedUrls.join(',');
        }

        // --- 5. 写入数据库 ---
        const { error: dbError } = await supabaseClient.from('partners').insert([payload]);
        if (dbError) throw dbError;

        // --- 6. 成功反馈 ---
        btn.innerText = "Application Sent ✓";
        btn.style.background = "#10b981";
        
        setTimeout(() => {
            closePartnerModal();
            btn.disabled = false;
            btn.innerText = originalText;
            btn.style.background = ""; 
            document.getElementById('partner-form').reset();
            backToRoles();
            
            // 提示文案修改
            const msg = (curLang === 'cn') 
                ? "申请已提交！审核通过后我们会通过邮件发送注册链接。" 
                : "Application received! We will email you the registration link upon approval.";
            showToast(msg);
            
        }, 2000);

    } catch (err) {
        console.error("Application Error:", err);
        
        let errMsg = "提交失败，请稍后重试。";
        
        // 🟢 [新增] 捕捉“唯一性冲突”错误 (Postgres 错误码 23505)
        if (err.code === '23505' || (err.message && err.message.includes('unique'))) {
            errMsg = (typeof curLang !== 'undefined' && curLang === 'cn')
                ? "该邮箱已经提交过申请，请勿重复提交。"
                : "This email has already applied. No need to submit again.";
        } 
        else if (err.message) {
            errMsg = err.message;
        }

        alert(errMsg); // 或者使用 showToast(errMsg) 如果您想更美观
        
        // 恢复按钮状态
        btn.innerText = originalText;
        btn.disabled = false;
        btn.style.background = "#ef5350"; // 变红表示错误
    }
}

// 挂载到全局
window.openPartnerModal = openPartnerModal;
window.closePartnerModal = closePartnerModal;
window.backToRoles = backToRoles;
window.showPartnerForm = showPartnerForm;
window.submitPartner = submitPartner;
window.formatPhone = formatPhone;
window.renderServiceRegions = renderServiceRegions;
window.initPartnerAddressAutocomplete = initPartnerAddressAutocomplete;

// ==========================================
// [NEW] LIVE MAP LOGIC (Supabase + Clean Map)
// ==========================================

let mapInstance = null;
let markerCluster = null;
let currentMapMode = 'consumer'; 
let allMarkers = []; 
let mapData = []; 
let activeFilters = { type1: true, type2: true }; 
let userHasLoggedIn = false; 
let cameFromMap = false; 

// 1. 打开/关闭逻辑
async function openLiveMap() {
    // 隐藏主页面的干扰元素
    document.body.classList.add('hide-fomo');
    const floaters = document.querySelectorAll('.chat-widget-container, .fixed-trust-badge, .fixed-brand-badge, #fomo-bar');
    floaters.forEach(el => { if(el) el.style.display = 'none'; });

    document.getElementById('map-modal').style.display = 'flex';

    if (!mapInstance) {
        await initMap();
    }
    
    renderMarkers(); 
}

function closeLiveMap() {
    document.getElementById('map-modal').style.display = 'none';
    
    // 恢复主页面元素
    document.body.classList.remove('hide-fomo');
    const floaters = document.querySelectorAll('.chat-widget-container, .fixed-trust-badge, .fixed-brand-badge');
    floaters.forEach(el => { if(el) el.style.display = ''; }); 
    
    if(typeof fomoData !== 'undefined' && fomoData.length > 0) {
        const fomo = document.getElementById('fomo-bar');
        if(fomo) fomo.style.display = 'flex';
    }
}

// 2. 地图初始化 (纯净风格 + 鼠标直缩放 + 修复样式不生效问题)
async function initMap() {
    const defaultCenter = { lat: -33.8688, lng: 151.2093 }; // 默认悉尼

    // --- 定义纯净版地图样式 (Clean Style JSON) ---
    const cleanMapStyles = [
        {
            "featureType": "all",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#64748b" }] // 让地名文字变灰一点，不喧宾夺主
        },
        {
            "featureType": "poi", // 🔥 核心：隐藏所有兴趣点 (商场、学校、医院、公园图标)
            "elementType": "all",
            "stylers": [{ "visibility": "off" }]
        },
        {
            "featureType": "transit", // 🔥 核心：隐藏所有交通设施 (地铁站、公交站图标)
            "elementType": "all",
            "stylers": [{ "visibility": "off" }]
        },
        {
            "featureType": "road",
            "elementType": "labels.icon", // 隐藏道路编号图标 (如高速公路盾牌)
            "stylers": [{ "visibility": "off" }]
        },
        {
            "featureType": "landscape", // 让陆地背景更干净
            "elementType": "geometry",
            "stylers": [{ "color": "#f8fafc" }] // 极淡的灰白色，类似你的网页背景
        },
        {
            "featureType": "water", // 让水体颜色变成淡雅的蓝色
            "elementType": "geometry",
            "stylers": [{ "color": "#e0f2fe" }] 
        },
        {
            "featureType": "water",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#94a3b8" }]
        }
    ];

    try {
        mapInstance = new google.maps.Map(document.getElementById("ecosystem-map"), {
            zoom: 12, 
            center: defaultCenter,
            
            // ❌ 删除下面这一行 mapId，否则 styles 代码会被忽略！
            // mapId: "DEMO_MAP_ID", 
            
            // --- 交互与界面配置 ---
            disableDefaultUI: true,    // 隐藏默认控件
            zoomControl: true,         // 只保留右下角的 +/- 缩放按钮
            gestureHandling: 'greedy', // 🔥 开启鼠标滚轮直接缩放
            styles: cleanMapStyles,    // 🔥 应用上面的纯净样式
        });

        // 初始化定位
        handleUserLocation();
        
        // 拉取数据 (加了错误捕获，防止卡死)
        await fetchMapData(); 
        
    } catch (e) {
        console.error("地图初始化失败:", e);
        // 如果地图挂了，至少不影响页面其他功能
    }
}

function handleUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
                mapInstance.setCenter(pos);
                mapInstance.setZoom(13);
                new google.maps.Marker({
                    position: pos, map: mapInstance,
                    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#3b82f6", fillOpacity: 1, strokeColor: "white", strokeWeight: 2 },
                    title: "You are here"
                });
            },
            () => { console.log("Geo permission denied"); }
        );
    }
}

function switchMapMode(mode) {
    currentMapMode = mode;
    document.querySelectorAll('.map-switch-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-map-${mode}`).classList.add('active');
    activeFilters = { type1: true, type2: true };
    renderMarkers();
}

// 3. 拉取 Supabase 数据
async function fetchMapData() {
    try {
        const { data, error } = await supabaseClient
            .from('map_markers')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (data) {
            mapData = data;
            renderMarkers();
        }

    } catch (err) {
        console.error("Error fetching map markers:", err);
    }
}

// 4. 渲染标记点
function renderMarkers() {
    if (markerCluster) { markerCluster.clearMarkers(); }
    allMarkers.forEach(m => m.setMap(null));
    allMarkers = [];

    const filtersEl = document.getElementById('map-filters');
    const isCN = (typeof curLang !== 'undefined' && curLang === 'cn');
    
    let type1 = '', type2 = '';
    let label1 = '', label2 = '';

    if (currentMapMode === 'consumer') {
        type1 = 'case'; label1 = isCN ? '真实案例' : 'Real Cases';
        type2 = 'installer'; label2 = isCN ? '安装商' : 'Installers';
    } else {
        type1 = 'lead'; label1 = isCN ? '商机线索' : 'Active Leads';
        type2 = 'electrician'; label2 = isCN ? '找电工' : 'Electricians';
    }

    filtersEl.innerHTML = `
        <div class="map-filter-pill ${activeFilters.type1 ? 'active' : ''}" onclick="toggleMapFilter('type1')">
            <span class="dot" style="color:${getColor(type1)}">●</span> ${label1}
        </div>
        <div class="map-filter-pill ${activeFilters.type2 ? 'active' : ''}" onclick="toggleMapFilter('type2')">
            <span class="dot" style="color:${getColor(type2)}">●</span> ${label2}
        </div>
    `;

    const markers = mapData.map(item => {
        const isType1 = (item.type === type1);
        const isType2 = (item.type === type2);
        if (!isType1 && !isType2) return null; 
        if (isType1 && !activeFilters.type1) return null; 
        if (isType2 && !activeFilters.type2) return null;

        const marker = new google.maps.Marker({
            position: { lat: item.lat, lng: item.lng },
            label: { text: getIconChar(item.type), fontSize: "16px" },
            title: item.title
        });

        marker.addListener("click", () => { showInfoWindow(marker, item); });

        allMarkers.push(marker);
        return marker;
    }).filter(m => m !== null);

    markerCluster = new markerClusterer.MarkerClusterer({ map: mapInstance, markers: markers });
}

function toggleMapFilter(key) {
    activeFilters[key] = !activeFilters[key];
    renderMarkers();
}

function getColor(type) {
    if(type === 'case') return '#f59e0b'; 
    if(type === 'installer') return '#3b82f6';
    if(type === 'lead') return '#10b981';
    if(type === 'electrician') return '#eab308';
    return '#ccc';
}

function getIconChar(type) {
    if(type === 'case') return '🏠';
    if(type === 'installer') return '🛠️';
    if(type === 'lead') return '🟢';
    if(type === 'electrician') return '⚡';
    return '?';
}

// 5. InfoWindow 弹窗逻辑 (适配 SQL 字段)
// ==========================================
// [UPDATED] InfoWindow 逻辑 (带关闭键 + 智能需求显示)
// ==========================================

let currentInfoWindow = null;

function showInfoWindow(marker, item) {
    if (currentInfoWindow) currentInfoWindow.close();

    const isCN = (typeof curLang !== 'undefined' && curLang === 'cn');
    const title = isCN ? (item.title_cn || item.title) : item.title;
    const desc = isCN ? (item.description_cn || item.description) : item.description;
    
    // --- 定义通用的关闭按钮 HTML ---
    const closeBtnHtml = `<button class="info-close-btn" onclick="currentInfoWindow.close()" title="Close">×</button>`;

    let content = '';

    // [A] 真实案例
    if (item.type === 'case') {
        const btnText = isCN ? "查看详情 & 抄作业" : "View Details & Copy";
        const savingsText = isCN ? (item.savings_cn || item.savings) : item.savings;
        
        content = `
            <div class="info-card">
                ${closeBtnHtml} <span class="info-tag" style="background:#fffbeb; color:#b45309;">REAL CASE</span>
                <div class="info-title">${title}</div>
                <div class="info-desc">${desc}</div>
                ${savingsText ? `<div style="color:#166534; font-weight:bold; font-size:0.8rem; margin-bottom:8px;">💰 ${savingsText}</div>` : ''}
                <button class="info-btn" onclick="openCaseDetail(${item.id})">${btnText}</button>
            </div>
        `;
    }
    // [B] 安装商
    else if (item.type === 'installer') {
        const btnText = isCN ? "获取报价" : "Get Quote";
        content = `
            <div class="info-card">
                ${closeBtnHtml}
                <span class="info-tag" style="background:#eff6ff; color:#1d4ed8;">INSTALLER</span>
                <div class="info-title">${title}</div>
                <div class="info-desc">${desc}</div>
                <button class="info-btn" onclick="triggerQuoteFromMap()">${btnText}</button>
            </div>
        `;
    }
    // [C] 线索 (核心修改：未解锁也显示需求类型)
    // [MODIFIED] 线索展示逻辑：未登录时隐藏详情
    // ... (前文 installer/case/electrician 部分保持不变)

    // [C] 线索 (核心修改：从 lead_data 读取详情 + Claim 按钮)
    else if (item.type === 'lead') {
        
        let buttonHtml = '';
        
        // A. 按钮逻辑：未登录显示Login，已登录显示Claim
        if (!userHasLoggedIn) {
            buttonHtml = `<button class="info-btn" onclick="openLoginModal()" style="background:#3b82f6;">Login to Claim</button>`;
        } else {
            // 这里的 lead_reference_id 是源头 ID，如果为空则兜底用 item.id
            const actualLeadId = item.lead_reference_id || item.id;

            buttonHtml = `
                <div id="action-area-${item.id}">
                    <button class="info-btn" onclick="claimLeadOnMap('${actualLeadId}')" 
                            style="margin-top:10px; background: #10b981; color:white; font-weight:bold; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
                        ⚡ Claim (Lock 2h)
                    </button>
                    <div style="font-size:0.7rem; color:#64748b; margin-top:6px; text-align:center;">
                        First come, first served.
                    </div>
                </div>
            `;
        }

        // B. 详情解析：从 lead_data JSON 中解包数据
        // (数据库里存的是 jsonb，Supabase 会自动转为 JS 对象)
        const meta = item.lead_data || {}; 
        
        // 拼接房屋规格: "House • Tile Roof • 1 Storey"
        const specs = [
            meta.type, 
            (meta.roof && meta.roof !== '-') ? meta.roof : null, 
            (meta.storeys && meta.storeys !== '-') ? meta.storeys : null
        ].filter(Boolean).join(' • ');

        // 拼接电费
        const billDisplay = meta.bill ? `$${meta.bill}` : 'N/A';
        
        // 拼接时间要求
        const timeDisplay = meta.timeframe ? meta.timeframe : 'Flexible';

        // 拼接预算 (如果有)
        const priceHtml = meta.est_price ? `<div style="margin-top:2px; color:#059669;">💰 Budget: ${meta.est_price}</div>` : '';

        content = `
            <div class="info-card">
                ${closeBtnHtml}
                <span class="info-tag" style="background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0;">ACTIVE LEAD</span>
                
                <div class="info-title" style="margin-top:8px;">${item.title}</div> 
                
                <div class="info-desc" style="font-weight:700; color:#0f172a; margin-bottom:8px;">
                    ${item.description}
                </div>
                
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:8px; font-size:0.75rem; color:#475569; line-height:1.6;">
                    ${specs ? `<div style="margin-bottom:2px;">🏠 ${specs}</div>` : ''}
                    <div style="display:flex; justify-content:space-between;">
                        <span>💵 Bill: <strong>${billDisplay}</strong></span>
                        <span>⏳ ${timeDisplay}</span>
                    </div>
                    ${priceHtml}
                </div>

                ${buttonHtml}
            </div>
        `;
    }

// ... (后续 electrican 部分保持不变)
    // [D] 电工
    else if (item.type === 'electrician') {
        content = `
            <div class="info-card">
                ${closeBtnHtml}
                <span class="info-tag" style="background:#fefce8; color:#a16207;">ELECTRICIAN</span>
                <div class="info-title">${title}</div>
                <div class="info-desc">${desc}</div>
                <button class="info-btn" onclick="connectElectrician()">${isCN ? "联系他" : "Contact"}</button>
            </div>
        `;
    }

    currentInfoWindow = new google.maps.InfoWindow({ content: content });
    currentInfoWindow.open(mapInstance, marker);
}

// [NEW] 忘记密码处理逻辑
// [REPLACED] 真实的发送重置邮件
// ==========================================
// [FIXED] 忘记密码逻辑 (自动识别是弹窗还是主页)
// ==========================================
async function handleForgotPassword() {
    // 1. 尝试获取两个地方的输入框
    const inputPage = document.getElementById('login-email-page'); // Partner Hub 主页
    const inputModal = document.getElementById('login-email');     // 地图/线索弹窗

    // 2. 看看用户到底在哪填了邮箱
    let targetEmail = "";
    let targetInput = null;

    if (inputPage && inputPage.value.trim()) {
        targetEmail = inputPage.value.trim();
        targetInput = inputPage;
    } else if (inputModal && inputModal.value.trim()) {
        targetEmail = inputModal.value.trim();
        targetInput = inputModal;
    }

    const isCN = (typeof curLang !== 'undefined' && curLang === 'cn');
    
    // 3. 如果两边都没填，报错
    if(!targetEmail || !targetEmail.includes('@')) {
        alert(isCN ? "请先在输入框中填写您的注册邮箱。" : "Please enter your email address in the field above.");
        // 如果当前是主页视图，就聚焦主页输入框
        if(document.getElementById('hub-view-login').style.display === 'block' && inputPage) {
            inputPage.focus();
        } else if (inputModal) {
            inputModal.focus();
        }
        return;
    }

    // 4. UI 状态变更
    // 找到被点击的那个链接 (这里为了简单，我们查找所有忘记密码链接并变灰)
    const links = document.querySelectorAll('.forgot-pwd-link, a[onclick="handleForgotPassword()"]');
    links.forEach(l => {
        l._originalText = l.innerText;
        l.innerText = isCN ? "发送中..." : "Sending...";
        l.style.pointerEvents = "none";
        l.style.opacity = "0.6";
    });

    try {
        // 指向你的重置页面
        const redirectUrl = window.location.origin + '/reset.html';

        const { data, error } = await supabaseClient.auth.resetPasswordForEmail(targetEmail, {
            redirectTo: redirectUrl,
        });

        if (error) throw error;

        alert(isCN ? `重置邮件已发送至 ${targetEmail}，请查收 (含垃圾箱)。` : `Reset email sent to ${targetEmail}. Check your inbox (and spam).`);
        
    } catch (err) {
        console.error("Reset Error:", err);
        let msg = isCN ? "发送失败，请稍后再试" : "Failed to send reset email";
        
        // 针对请求过频的友好提示
        if (err.message.includes("limit") || err.status === 429) {
            msg = isCN ? "请求过于频繁，请过几分钟再试。" : "Too many requests. Please wait a few minutes.";
        }
        alert(msg);
    } finally {
        // 恢复按钮状态
        links.forEach(l => {
            if(l._originalText) l.innerText = l._originalText;
            l.style.pointerEvents = "auto";
            l.style.opacity = "1";
        });
    }
}

// 6. 交互功能
function openCaseDetail(id) {
    const item = mapData.find(i => i.id === id);
    if (!item) return;
    
    const isCN = (typeof curLang !== 'undefined' && curLang === 'cn');
    
    document.getElementById('case-title').innerText = isCN ? item.title_cn : item.title;
    const story = isCN ? (item.full_story_cn || "") : (item.full_story || "");
    document.getElementById('case-story').innerHTML = story;
    const hwText = isCN ? (item.hardware_text_cn || "标准配置") : (item.hardware_text || "Standard Config");
    document.getElementById('case-config-display').innerText = hwText;
    const savings = isCN ? item.savings_cn : item.savings;
    document.getElementById('case-saving-tag').innerText = savings || "Savings";

    const imgEl = document.getElementById('case-img-hero');
    if(item.images && item.images.length > 0) {
    imgEl.src = item.images[0]; 
    } else {
    // 换成 placehold.co
    imgEl.src = 'https://placehold.co/400x200?text=No+Image';
    }

    const btn = document.getElementById('btn-copy-setup');
    btn.onclick = () => copySetup(item);
    
    document.getElementById('case-detail-modal').style.display = 'flex';
}

// ==========================================
// [FIXED] Copy Setup (修复 Battery Only 跳转失败问题)
// ==========================================
function copySetup(item) {
    // 1. 关闭地图
    document.getElementById('case-detail-modal').style.display = 'none';
    closeLiveMap();

    // 2. 准备文本
    const text = (item.hardware_text || "") + " " + (item.hardware_text_cn || "");
    
    // 3. 解析数据
    // 找太阳能 (kW)
    const solarMatch = text.match(/(\d+(\.\d+)?)\s*kW\b/i);
    let targetSolar = 0;
    let foundSolar = false;

    if (solarMatch) {
        targetSolar = parseFloat(solarMatch[1]);
        foundSolar = true;
    } else {
        targetSolar = 6.6; // 没找到默认 6.6，但在下面我们会根据 foundSolar 来决定模式
    }
    
    // 找电池 (kWh)
    const batMatch = text.match(/(\d+(\.\d+)?)\s*kWh/i);
    let targetBat = batMatch ? parseFloat(batMatch[1]) : 0;
    const hasBattery = targetBat > 0 || text.toLowerCase().includes('battery') || text.includes('电池') || text.includes('Powerwall');

    // 4. 设置滑块档位
    // Solar Slider
    let bestSolarIdx = 0;
    let minDiff = 999;
    solarTiers.forEach((tier, index) => {
        const diff = Math.abs(tier - targetSolar);
        if(diff < minDiff) { minDiff = diff; bestSolarIdx = index; }
    });
    
    const solarInput = document.getElementById('solar-input');
    const existSolarInput = document.getElementById('exist-solar-input');
    
    if (solarInput) { solarInput.value = bestSolarIdx; updateVal('solar'); }
    if (existSolarInput) { existSolarInput.value = bestSolarIdx; updateVal('exist-solar'); }

    // Battery Slider
    if(hasBattery) {
        const batInput = document.getElementById('bat-input');
        if (batInput) {
            batInput.value = (targetBat > 4) ? targetBat : 10; 
            updateVal('battery');
        }
    }

    // 5. 🟢 智能切换模式 (核心修复)
    if (hasBattery && !foundSolar) {
        // 有电池但没写太阳能 -> 认为是 "Battery Only" (加装)
        setMode('battery');
    } else if (hasBattery && foundSolar) {
        // 都有 -> "Solar + Battery"
        setMode('both');
    } else {
        // 只有太阳能 -> "Solar Only"
        setMode('solar');
    }

    // 6. 🟢 破解拦截验证 (关键一步)
    // 无论什么情况，只要是 Copy Setup，都把账单设为 $500，防止因为默认 $100 而被 calculate() 函数拦截
    const billInput = document.getElementById('bill-input');
    if (billInput && parseInt(billInput.value) <= 100) {
        billInput.value = 500;
        updateVal('bill');
    }

    // 7. 触发计算跳转
    setTimeout(() => {
        const calcBtn = document.querySelector('.btn-calc');
        if(calcBtn) calcBtn.click(); 
        
        const msg = (typeof curLang !== 'undefined' && curLang === 'cn') 
            ? "已加载案例配置！" : "Configuration Copied!";
        showToast(msg);
    }, 300);
}

function triggerQuoteFromMap() {
    closeLiveMap();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast("Let's calculate a quote first!");
}

function openLoginModal() {
    document.getElementById('lead-login-modal').style.display = 'flex';
}

// [REPLACED] 真实的登录逻辑
async function attemptLeadLogin() {
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const btn = document.querySelector('#lead-login-modal .btn-calc'); // 登录按钮
    
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const isCN = (typeof curLang !== 'undefined' && curLang === 'cn');

    if (!email || !password) {
        alert(isCN ? "请输入邮箱和密码" : "Please enter email and password");
        return;
    }

    // UI 状态更新
    const originalText = btn.innerText;
    btn.innerText = isCN ? "登录中..." : "Logging in...";
    btn.disabled = true;

    try {
        // --- 真实验证 ---
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) throw error;

        // --- 登录成功 ---
        userHasLoggedIn = true; // 更新全局状态
        document.getElementById('lead-login-modal').style.display = 'none';
        
        showToast(isCN ? "登录成功！线索已解锁" : "Login Successful! Leads Unlocked.");
        
        // 刷新地图标记，显示已解锁的线索
        renderMarkers(); 

    } catch (err) {
        console.error("Login Error:", err);
        let msg = isCN ? "登录失败：账号或密码错误" : "Login Failed: Invalid credentials";
        if (err.message.includes("Email not confirmed")) {
            msg = isCN ? "请先去邮箱激活您的账号" : "Please confirm your email first";
        }
        alert(msg);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function redirectToPartnerReg() {
    document.getElementById('lead-login-modal').style.display = 'none';
    closeLiveMap();
    cameFromMap = true;
    openPartnerModal();
}

function connectElectrician() {
    closeLiveMap();
    cameFromMap = true;
    openPartnerModal();
}

// 劫持 Partner 弹窗关闭，实现闭环
// ==========================================
// [FIXED] 劫持 Partner 弹窗关闭，实现闭环 (修复冒泡导致的误触)
// ==========================================
const originalClosePartner = window.closePartnerModal;
window.closePartnerModal = function(e) {
    // 1. 获取遮罩层元素
    const overlay = document.getElementById('partner-modal');
    
    // 2. 核心判断：用户是否真的点击了“关闭”？
    // 只有当 e 不存在 (手动调用)，或者点击的是遮罩层本身，或者点击的是关闭按钮时，才算“关闭”
    // 如果点击的是弹窗内部的 Input、按钮或卡片，shouldClose 为 false
    const shouldClose = !e || e.target === overlay || e.target.classList.contains('close-btn');

    // 3. 执行原始的关闭逻辑 (隐藏 UI)
    if(originalClosePartner) originalClosePartner(e); 

    // 4. 只有在【确认要关闭】且【来自地图】的情况下，才重新打开地图
    if (shouldClose && cameFromMap) {
        setTimeout(() => {
            openLiveMap();
            cameFromMap = false; 
        }, 300);
    }
}

// ==========================================
// [UPDATED] 路由守卫：区分 邀请注册 vs 找回密码
// ==========================================

// 1. 监听 URL 哈希 (最快响应)
window.addEventListener('DOMContentLoaded', () => {
    const hash = window.location.hash;

    if (hash) {
        // 场景 A: 合作伙伴邀请 (Invite User)
        if (hash.includes('type=invite')) {
            console.log("检测到邀请链接，跳转至激活页面...");
            window.location.href = '/register.html' + hash;
        }
        // 场景 B: 找回密码 (Password Recovery)
        else if (hash.includes('type=recovery')) {
            console.log("检测到重置链接，跳转至重置页面...");
            window.location.href = '/reset.html' + hash;
        }
    }
});

// 2. 监听 Supabase 事件 (双重保险)
supabaseClient.auth.onAuthStateChange((event, session) => {
    // 这里主要处理一些边缘情况，大部分情况上面的 hash 监听就够了
    if (event === 'PASSWORD_RECOVERY') {
        // 注意：这里无法区分是 invite 还是 recovery，
        // 但通常 recovery 会触发这个事件。
        // 为了安全起见，我们优先信任 URL hash 的判断。
        const hash = window.location.hash;
        if (!hash.includes('type=invite')) {
             window.location.href = '/reset.html';
        }
    }
});

// ==========================================
// [FIXED] 补充缺失的连接申请函数 (带 Email 写入)
// ==========================================
async function requestConnection(leadId) {
    const container = document.getElementById(`action-area-${leadId}`);
    const btn = container ? container.querySelector('button') : null;
    const isCN = (typeof curLang !== 'undefined' && curLang === 'cn');

    if (btn) {
        btn.innerText = isCN ? "申请中..." : "Requesting...";
        btn.disabled = true;
    }

    try {
        // 1. 获取当前登录用户
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        
        if (authError || !user) {
            throw new Error(isCN ? "未检测到登录状态，请重新登录" : "User session invalid. Please relogin.");
        }

        // 2. 向 Supabase 写入申请记录
        const { error: dbError } = await supabaseClient
            .from('lead_applications')
            .insert([
                {
                    lead_id: leadId,
                    partner_id: user.id,
                    partner_email: user.email, // 🟢 新增：显式写入邮箱
                    status: 'pending',
                    created_at: new Date().toISOString()
                }
            ]);

        if (dbError) throw dbError;

        // 3. 成功反馈
        if (btn) {
            btn.innerText = isCN ? "已申请 ✅" : "Request Sent ✅";
            btn.style.background = "#10b981";
            btn.style.cursor = "default";
        }
        
        showToast(isCN ? "申请已发送！请等待管理员审核。" : "Connection request sent!");

    } catch (err) {
        console.error("Connection Request Error:", err);
        let errMsg = err.message;
        if (err.code === '42501') errMsg = "权限不足 (RLS Error)";
        // 捕捉字段不存在的错误
        if (err.code === '42703') errMsg = "数据库缺少 partner_email 字段"; 
        
        alert((isCN ? "申请失败: " : "Request Failed: ") + errMsg);
        
        if (btn) {
            btn.innerText = isCN ? "重试" : "Retry";
            btn.disabled = false;
        }
    }
}

window.requestConnection = requestConnection;

/* ==========================================
   [NEW] Bottom Navigation Logic
   ========================================== */

// ==========================================
// [ROUTING] 核心路由逻辑 (支持单页分享链接)
// ==========================================

// 0. 辅助函数：修改 URL Hash 但不刷新页面
function updateUrlHash(hash) {
    history.replaceState(null, null, '#' + hash);
}

// 1. 主导航切换 (Quote / Partner)
// 修改点：切换时同步更新 URL
function switchTab(tabName) {
    // A. 处理底部导航高亮
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
    
    // B. 处理视图显示
    const viewHome = document.getElementById('view-home');
    const viewPartner = document.getElementById('view-partner');
    
    // 关闭地图 (如果开着的话)
    if(document.getElementById('map-modal').style.display === 'flex') {
        closeLiveMap();
    }

    if (tabName === 'quote') {
        document.querySelector('.nav-tab:nth-child(1)').classList.add('active'); 
        viewHome.classList.add('active');
        viewPartner.classList.remove('active');
        
        // 恢复悬浮元素
        document.body.classList.remove('hide-fomo');
        const floaters = document.querySelectorAll('.chat-widget-container, .fixed-trust-badge, .fixed-brand-badge');
        floaters.forEach(el => el.style.display = '');

    } else if (tabName === 'partner') {
        document.querySelector('.nav-tab:nth-child(3)').classList.add('active'); 
        viewHome.classList.remove('active');
        viewPartner.classList.add('active');
        
        // 隐藏悬浮元素
        document.body.classList.add('hide-fomo');
        const floaters = document.querySelectorAll('.chat-widget-container, .fixed-trust-badge, .fixed-brand-badge');
        floaters.forEach(el => el.style.display = 'none');
    }
    
    // 滚回顶部
    window.scrollTo({ top: 0, behavior: 'instant' });

    // 🟢 [新增] 更新 URL 为 #quote 或 #partner
    updateUrlHash(tabName);
}

// 2. Partner 内部切换 (Join / Login) - 保持不变
function switchHubInnerTab(tab) {
    document.querySelectorAll('.hub-tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');

    document.getElementById('hub-view-join').style.display = (tab === 'join') ? 'block' : 'none';
    document.getElementById('hub-view-login').style.display = (tab === 'login') ? 'block' : 'none';
}

// 3. 劫持 openPartnerModal
// 修改点：复用 switchTab 以确保 URL 更新
window.openPartnerModal = function() {
    switchTab('partner');
};

// 4. 劫持 openLiveMap
// 修改点：打开地图时，URL 变更为 #map
const _originalOpenLiveMap = window.openLiveMap;
window.openLiveMap = function() {
    if (_originalOpenLiveMap) _originalOpenLiveMap();
    
    // UI 高亮切换到第二个 Tab
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
    document.querySelector('.nav-tab:nth-child(2)').classList.add('active');

    // 🟢 [新增] 更新 URL 为 #map
    updateUrlHash('map');
};

// 5. 劫持 closeLiveMap
// 修改点：关闭地图时，根据底下的页面恢复正确的 URL (#partner 或 #quote)
const _originalCloseLiveMap = window.closeLiveMap;
window.closeLiveMap = function() {
    if (_originalCloseLiveMap) _originalCloseLiveMap();

    const isPartnerViewActive = document.getElementById('view-partner').classList.contains('active');
    
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));

    if (isPartnerViewActive) {
        // 如果底下是 Partner 页面
        document.querySelector('.nav-tab:nth-child(3)').classList.add('active');
        // 🟢 [新增] 恢复 URL 为 #partner
        updateUrlHash('partner');
    } else {
        // 否则默认是 Quote 页面
        document.querySelector('.nav-tab:nth-child(1)').classList.add('active');
        // 🟢 [新增] 恢复 URL 为 #quote
        updateUrlHash('quote');
    }
};

// 6. 劫持 closePartnerModal
// 修改点：如果通过这个关闭，通常意味着回首页，所以 URL 设为 #quote
const _originalClosePartnerModal = window.closePartnerModal;
window.closePartnerModal = function(e) {
    const overlay = document.getElementById('partner-modal');
    const shouldClose = !e || e.target === overlay || e.target.classList.contains('close-btn');
    
    if (_originalClosePartnerModal) _originalClosePartnerModal(e);
    
    if (shouldClose) {
        document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
        document.querySelector('.nav-tab:nth-child(1)').classList.add('active');
        // 🟢 [新增] 恢复 URL 为 #quote
        updateUrlHash('quote');
    }
};

// 7. 🟢 [新增] 页面加载时的路由监听 (Entry Point)
// 这是实现“别人发链接给你，你能直接打开对应页面”的关键
document.addEventListener("DOMContentLoaded", () => {
    // 获取网址 # 后面的内容
    const hash = window.location.hash; 

    // 稍微延迟确保 DOM 渲染完毕
    setTimeout(() => {
        if (hash === '#partner') {
            switchTab('partner');
        } else if (hash === '#map') {
            openLiveMap();
        } else {
            // 如果没有 hash 或者 hash 是 #quote，默认就是首页，不需要额外操作
            // 但为了美观，可以补全一个 #quote
            if(!hash) updateUrlHash('quote');
        }
    }, 50);
});
// ==========================================
// 🟢 [补全] Partner Hub 页面主登录逻辑
// ==========================================
async function attemptLoginFromPage() {
    const emailInput = document.getElementById('login-email-page');
    const passwordInput = document.getElementById('login-password-page');
    const btn = document.querySelector('#hub-view-login .btn-calc'); // 获取登录按钮

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const isCN = (typeof curLang !== 'undefined' && curLang === 'cn');

    // 1. 基础验证
    if (!email || !password) {
        showToast(isCN ? "请输入邮箱和密码" : "Please enter email and password");
        // 给输入框加个红框提醒一下
        emailInput.style.borderColor = "#ef4444";
        setTimeout(() => emailInput.style.borderColor = "#e2e8f0", 2000);
        return;
    }

    // 2. UI 变更为加载状态
    const originalText = btn.innerText;
    btn.innerText = isCN ? "验证中..." : "Verifying...";
    btn.disabled = true;
    btn.style.opacity = "0.7";

    try {
        // 3. 向 Supabase 发起登录请求
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) throw error;

        // 4. 登录成功
        btn.innerText = "Success! 🚀";
        btn.style.backgroundColor = "#10b981"; 

        // 5. 跳转到 Dashboard
        showToast(isCN ? "登录成功！正在跳转..." : "Login successful! Redirecting...");
        setTimeout(() => {
            window.location.href = "dashboard.html"; 
        }, 800);

    } catch (err) {
        console.error("Login Error:", err);
        
        // 🟢 智能错误提示
        let msg = isCN ? "登录失败：账号或密码错误" : "Login Failed: Invalid credentials";
        
        // 针对“邮箱未验证”的特殊提示
        if (err.message.includes("Email not confirmed")) {
            msg = isCN ? "您的账号尚未激活，请检查邮箱 (含垃圾箱)" : "Please verify your email first.";
        }
        // 针对“网络错误”
        else if (err.message.includes("fetch")) {
            msg = isCN ? "网络连接失败，请检查网络" : "Network error.";
        }

        // 使用 Toast 提示，而不是丑陋的 alert
        showToast("⚠️ " + msg);
        
        // 恢复按钮
        btn.innerText = originalText;
        btn.disabled = false;
        btn.style.backgroundColor = "";
        btn.style.opacity = "1";
        
        // 密码框震动效果 (可选优化)
        passwordInput.value = "";
        passwordInput.focus();
    }
}

// 导出给 HTML 调用
window.attemptLoginFromPage = attemptLoginFromPage;

// ============================================================
// 🚀 INLINE Solar Analysis (Pro Dashboard - Real API Ready)
// ============================================================

let monthlyChartInstance = null;

// 1. 触发分析 (UI 动画)
function triggerInlineAnalysis() {
    const heroInput = document.getElementById('hero-address');
    const container = document.getElementById('hero-input-container');
    const panel = document.getElementById('inline-analysis-panel');
    const btn = document.getElementById('btn-analyze-trigger');

    if (!heroInput.value || !window.selectedLat) {
        showToast("Please select an address from the dropdown first.");
        heroInput.focus();
        return;
    }

    // UI 状态变更
    container.classList.add('expanded'); // 搜索框变直角
    panel.classList.remove('hidden');    // 展开面板
    
    // 显示 Loading
    document.getElementById('inline-loader').style.display = 'block';
    document.getElementById('inline-results').style.display = 'none';
    
    btn.innerText = "Analyzing...";
    btn.disabled = true;

    // 开始执行
    runInlineAnalysis();
}

// ============================================================
// 🛡️ 修复版 Solar Analysis (防崩 + 提高成功率)
// ============================================================

// 1. 调用 API (删除了 HIGH 质量要求)

async function runInlineAnalysis() {
    const lat = window.selectedLat;
    const lng = window.selectedLng;
    const apiKey = GOOGLE_API_KEY;

    // 1. 设置图片源 (更高清晰度 zoom=20)
    const satelliteUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=20&size=600x400&maptype=satellite&scale=2&key=${apiKey}`;
    
    const imgEl = document.getElementById('inline-map-img');
    if (imgEl) {
        imgEl.src = satelliteUrl;
        // 重置为卫星模式
        toggleMapMode('satellite');
    }

    const coordsEl = document.getElementById('inline-coords');
    if (coordsEl) coordsEl.innerText = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    // 2. 调用 Solar API
    let apiData = null;
    try {
        const solarUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=MEDIUM&key=${apiKey}`;
        const resp = await fetch(solarUrl);
        if (resp.ok) apiData = await resp.json();
    } catch (e) {
        console.warn("Solar API failed, fallback to simulated values.", e);
    }

    setTimeout(() => finishAnalysis(apiData), 700);
}

function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function scoreFromRange(value, vMin, vMax) {
    const p = (value - vMin) / (vMax - vMin);
    return Math.round(clamp(p, 0, 1) * 100);
}

function gradeFromScore(total) {
    // Only: Excellent / Good / Fair
    if (total >= 80) return 'excellent';
    if (total >= 65) return 'good';
    return 'fair';
}

function renderSolarScore(total, gradeKey) {
    const circle = document.querySelector('.circle');
    const scoreText = document.getElementById('score-text');
    const gradeEl = document.getElementById('score-grade');
    const descEl = document.getElementById('score-desc');

    if (scoreText) scoreText.textContent = total;

    const gradeMap = (i18n[curLang] || {});
    const gradeLabel = gradeMap['inline_grade_' + gradeKey] || gradeKey;
    const descLabel = gradeMap['inline_score_desc_' + gradeKey] || '';

    // Color logic (subtle, not too flashy)
    let color = "#10b981";
    if (gradeKey === 'good') color = "#f59e0b";
    if (gradeKey === 'fair') color = "#fbbf24";

    if (gradeEl) {
        gradeEl.textContent = gradeLabel;
        gradeEl.style.color = color;
    }
    if (descEl) descEl.textContent = descLabel || (gradeKey === 'excellent'
        ? "Low shade risk and strong irradiation signals."
        : gradeKey === 'good'
            ? "Good sunlight profile. Output can be improved with layout optimization."
            : "Some shading or limited roof area detected. A tailored design is recommended.");

    if (circle) {
        circle.style.stroke = color;
        setTimeout(() => circle.setAttribute('stroke-dasharray', `${total}, 100`), 100);
    }
}

function setSubScore(idVal, idBar, val) {
    safeSetText(idVal, String(val));
    const bar = document.getElementById(idBar);
    if (bar) bar.style.width = clamp(val, 0, 100) + "%";
}

function finishAnalysis(apiData) {
    const lat = window.selectedLat;
    const lng = window.selectedLng;

    // --- 默认值 ---
    let maxKw = (Math.floor(Math.random() * 4) + 5) + 0.6; 
    let yearlyKwh = Math.floor(maxKw * 3.9 * 365);
    // 默认模拟朝向 (随机 0-360)
    let azimuthDegrees = Math.floor(Math.random() * 360); 

    // --- 如果有真实 API 数据 ---
    if (apiData && apiData.solarPotential) {
        const pot = apiData.solarPotential;
        const panelKw = 0.44; 

        // 1. 容量计算
        if (typeof pot.maxArrayPanelsCount === 'number') {
            maxKw = (pot.maxArrayPanelsCount * panelKw) * 0.7; 
        }
        if (typeof pot.maxSunshineHoursPerYear === 'number') {
            yearlyKwh = Math.floor(maxKw * pot.maxSunshineHoursPerYear * 0.85);
        }

        // ============================================================
        // 2. 【修正】获取主朝向 (Azimuth) - 核心修改部分
        // ============================================================
        // 逻辑：先找到"装板子最多"的配置方案(Config)，再在那个方案里找"装板子最多"的屋顶面(Segment)
        if (pot.solarPanelConfigs && pot.solarPanelConfigs.length > 0) {
            
            // A. 找到板子总数最多的配置 (通常是列表最后一个，但保险起见我们对比一下)
            const bestConfig = pot.solarPanelConfigs.reduce((prev, current) => {
                return (current.panelsCount > prev.panelsCount) ? current : prev;
            });

            // B. 在这个最佳配置中，遍历所有屋顶面，找到安装板子数量最多的那个面
            if (bestConfig.roofSegmentSummaries && bestConfig.roofSegmentSummaries.length > 0) {
                const mainSegment = bestConfig.roofSegmentSummaries.reduce((prev, current) => {
                    return (current.panelsCount > prev.panelsCount) ? current : prev;
                });
                
                // C. 获取该面的朝向
                if (typeof mainSegment.azimuthDegrees === 'number') {
                    azimuthDegrees = mainSegment.azimuthDegrees;
                }
            }
        }
    }

    // --- 计算其余数据 (保持不变) ---
    const roofArea = Math.floor(maxKw * 6);
    const annualValue = Math.floor(yearlyKwh * 0.28);

    // 计算分数
    const sunScore = scoreFromRange(maxKw, 4, 10); 
    const capScore = scoreFromRange(maxKw, 3, 15);
    const totalScore = Math.round(sunScore * 0.55 + capScore * 0.45);
    const gradeKey = gradeFromScore(totalScore);

    // --- 填充朝向数据 ---
    const dirKey = getCardinalDirection(azimuthDegrees); 
    const dirText = (i18n[curLang] && i18n[curLang][dirKey]) ? i18n[curLang][dirKey] : "North"; 
    
    safeSetText('inline-orientation-val', dirText);
    
    // 指南针旋转动画
    const compassIcon = document.getElementById('inline-compass-icon');
    if(compassIcon) {
        compassIcon.style.display = 'inline-block';
        // 稍微延迟一点执行动画，视觉效果更好
        setTimeout(() => {
            compassIcon.style.transform = `rotate(${azimuthDegrees}deg)`;
            compassIcon.style.transition = 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)'; // 增加弹性效果
        }, 100);
    }

    // --- 填充其他数据 ---
    safeSetText('inline-max-kw', maxKw.toFixed(1));
    safeSetText('inline-roof-area', roofArea);
    safeSetText('inline-annual-kwh', yearlyKwh.toLocaleString());
    safeSetText('inline-annual-value', "$" + annualValue.toLocaleString());

    safeSetText('env-trees', String(Math.floor(yearlyKwh * 0.85 / 20)));
    safeSetText('env-cars', String((yearlyKwh * 0.85 / 4600).toFixed(1)));

    renderMonthlyChart(yearlyKwh);
    renderSolarScore(totalScore, gradeKey);
    
    document.getElementById('inline-loader').style.display = 'none';
    document.getElementById('inline-results').style.display = 'block';
    
    const btn = document.getElementById('btn-analyze-trigger');
    if (btn) { btn.innerText = "Re-Analyze"; btn.disabled = false; }
}

/**
 * Phase-1 Compare slider (static images): drag to reveal flux overlay.
 */
function initCompareSlider(containerId, overlayId, handleId) {
    const container = document.getElementById(containerId);
    const overlay = document.getElementById(overlayId);
    const handle = document.getElementById(handleId);
    if (!container || !overlay || !handle) return;

    // Avoid double-binding
    if (container.dataset.sliderBound === "1") return;
    container.dataset.sliderBound = "1";

    let isDragging = false;

    const move = (e) => {
        if (!isDragging) return;
        const rect = container.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let x = clientX - rect.left;
        x = clamp(x, 0, rect.width);
        const percent = (x / rect.width) * 100;

        overlay.style.width = percent + "%";
        handle.style.left = percent + "%";
    };

    const startDrag = (e) => { isDragging = true; move(e); };
    const stopDrag = () => { isDragging = false; };

    handle.addEventListener('mousedown', startDrag);
    handle.addEventListener('touchstart', startDrag, { passive: true });

    container.addEventListener('mousedown', startDrag);
    container.addEventListener('touchstart', startDrag, { passive: true });

    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('mouseup', stopDrag);
    window.addEventListener('touchend', stopDrag);
}
function renderMonthlyChart(annualTotal) {
    const ctx = document.getElementById('monthlyChart').getContext('2d');
    
    const seasonality = [1.2, 1.1, 1.0, 0.8, 0.6, 0.5, 0.6, 0.7, 0.9, 1.0, 1.1, 1.2];
    const avgMonthly = annualTotal / 12;
    const dataPoints = seasonality.map(factor => Math.floor(avgMonthly * factor));

    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (monthlyChartInstance) monthlyChartInstance.destroy();

    monthlyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: dataPoints,
                backgroundColor: '#f59e0b',
                borderRadius: 3,
                hoverBackgroundColor: '#fbbf24'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false }, 
                
                // 🟢 【核心修改】自定义 Tooltip 显示格式
                tooltip: { 
                    enabled: true,
                    callbacks: {
                        label: function(context) {
                            // context.raw 是原始数值，后面拼接 " kWh"
                            return context.raw + ' kWh';
                        }
                    }
                } 
            },
            scales: {
                y: { display: false }, 
                x: { 
                    grid: { display: false },
                    ticks: { 
                        color: '#64748b', 
                        font: { size: 10 } 
                    }
                }
            }
        }
    });
}
// ============================================================
// 🎯 决策逻辑：用户点击 Yes/No 后触发
// ============================================================
function applyAnalysisOutcome(hasSolar) {
    // 1. 自动填充地址
    const heroAddr = document.getElementById('hero-address').value;
    const leadAddr = document.getElementById('lead-address');
    
    if (leadAddr && heroAddr) {
        leadAddr.value = heroAddr;
        // 视觉反馈：闪烁绿色
        leadAddr.style.transition = "background-color 0.5s";
        leadAddr.style.backgroundColor = "#dcfce7";
        setTimeout(() => leadAddr.style.backgroundColor = "", 2000);
    }

    // 2. 模式切换
    if (hasSolar === 'yes') {
        // 有光伏 -> 去 Battery Only
        setMode('battery');
        showToast("Switched to 'Battery Only' mode.");
    } else {
        // 无光伏 -> 去 Solar + Battery (利润最大)
        setMode('both');
        showToast("Switched to 'Solar + Battery' mode.");
    }

    // 3. 平滑滚动到报价区
    // 目标定位到 "Energy Usage" (电费滑块) 这一栏
    const targetSection = document.querySelector('.section-title[data-i18n="sec_usage"]');
    if (targetSection) {
        targetSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // 注意：这里不自动调用 calculate()，等待用户调整电费后主动点击
}

// 暴露给全局
window.triggerInlineAnalysis = triggerInlineAnalysis;
window.applyAnalysisOutcome = applyAnalysisOutcome;

// 放在 script.js 全局作用域
function toggleMapMode(mode) {
    const img = document.getElementById('inline-map-img');
    const btns = document.querySelectorAll('.map-tog-btn');
    
    // 更新图片类名以应用不同的 CSS Filter
    if(mode === 'satellite') {
        img.classList.remove('heatmap-mode');
        img.classList.add('satellite-mode');
        btns[0].classList.add('active');
        btns[1].classList.remove('active');
    } else {
        img.classList.remove('satellite-mode');
        img.classList.add('heatmap-mode');
        btns[0].classList.remove('active');
        btns[1].classList.add('active');
    }
} // --- 辅助函数：将角度转换为罗盘方向 ---
function getCardinalDirection(angle) {
    // Google API: 0=North, 90=East, 180=South, 270=West
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    // 360度分8份，每份45度。加22.5是为了让 N 覆盖 337.5~22.5 的范围
    const index = Math.round(((angle %= 360) < 0 ? angle + 360 : angle) / 45) % 8;
    
    // 返回翻译键值 (如 'dir_n', 'dir_ne')
    return 'dir_' + directions[index].toLowerCase();
}

// ==========================================
// 🟢 [新增] 自动检测登录状态 (Auto-Login Check)
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. 检查当前是否已有 Supabase 会话
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session) {
        userHasLoggedIn = true;
        // console.log("✅ Detected active session. User is logged in.");
    }

    // 2. 监听状态变化 (防止用户在其他标签页登出)
    supabaseClient.auth.onAuthStateChange((event, session) => {
        userHasLoggedIn = !!session; // 有 session 为 true，无 session 为 false
    });
});
