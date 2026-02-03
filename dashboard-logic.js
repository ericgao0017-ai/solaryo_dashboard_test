// ============================================================
// 🛠️ Installer & Referrer Logic (V21.2 - Yellow Steps & Inline Comm)
// ============================================================

const SUPABASE_URL = 'https://iytxwgyhemetdkmqoxoa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5dHh3Z3loZW1ldGRrbXFveG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMzI3MDIsImV4cCI6MjA3OTkwODcwMn0.ZsiueMCjwm5FoPlC3IDEgmsPaabkhefw3uHFl6gBm7Q';

const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentProfile = null;
let currentLeads = []; // 🔥 新增这一行，用来存数据给弹窗用
let cachedRefMap = {};

// Status Flow
const STATUS_FLOW = ['new', 'contacted', 'site_visit', 'deposit', 'installed'];

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    if (currentUser) {
        await loadProfile();
        await initView();
    }
});

// ==========================================
// 🔐 Authentication Logic (Auto-Login)
// ==========================================
async function checkAuth() {
    // 1. 获取当前 Session
    const { data: { session }, error } = await sbClient.auth.getSession();

    // 2. 监听认证状态变化 (比如 Token 刷新或在其他窗口登出)
    sbClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
            // 如果用户登出，强制踢回首页
            window.location.replace("index.html");
        }
    });

    // 3. 判断结果
    if (error || !session) {
        // 没有 Session，跳回登录页
        // 使用 replace 防止用户点“后退”按钮回到这个受保护的页面
        window.location.replace("index.html#partner"); 
        return;
    }

    // 4. 成功获取用户，赋值给全局变量
    currentUser = session.user;
    
    // (可选) 打印日志确认
    // console.log("✅ Auto-logged in as:", currentUser.email);
}

async function loadProfile() {
    try {
        const { data } = await sbClient.from('partners').select('*').eq('auth_id', currentUser.id).single();
        if (data) {
            currentProfile = data;
            document.getElementById('nav-user-name').innerText = data.company_name || data.contact_name || "Partner";
            document.getElementById('nav-user-role').innerText = (data.role || 'Partner').toUpperCase();
            document.getElementById('loading-view').style.display = 'none';
        }
    } catch (err) { console.error(err); }
}

async function initView() {
    document.getElementById('view-installer').style.display = 'none';
    document.getElementById('view-referral').style.display = 'none';
    
    if (currentProfile.role === 'referral') {
        loadReferrerDashboard();
    } else {
        loadInstallerDashboard();
    }
}

// ============================================================
// 📢 Referrer Dashboard Logic
// ============================================================
async function loadReferrerDashboard() {
    document.getElementById('view-referral').style.display = 'block';

    document.getElementById('ref-welcome-name').innerText = currentProfile.contact_name || "Partner";
    const myCode = currentProfile.ref_code || "NO_CODE";
    document.getElementById('ref-code-display').innerText = myCode;
    const linkInput = document.querySelector('#ref-link-box input');
    if (linkInput && myCode !== "NO_CODE") linkInput.value = `${window.location.origin}/index.html?ref=${myCode}`;

    const { data: allInstallers } = await sbClient.from('partners').select('id, company_name').eq('role', 'solar_pro').order('company_name');
    renderDefaultInstallerBox(allInstallers);

    const { data: leads } = await sbClient.from('leads').select('*').eq('referral_code', myCode).order('created_at', { ascending: false });
    
    currentLeads = leads || []; // 🔥 新增：把数据存入全局变量

    await updateReferrerStats(leads);
    renderReferrerTable(leads, allInstallers);
}

function renderDefaultInstallerBox(allInstallers) {
    const defBox = document.getElementById('default-installer-box');
    if (defBox && allInstallers) {
        const currentDefId = currentProfile.default_installer_id;
        let optionsHtml = `<option value="null">🌐 Open Network (Pool)</option>`;
        allInstallers.forEach(inst => {
            const isSel = (inst.id === currentDefId) ? 'selected' : '';
            optionsHtml += `<option value="${inst.id}" ${isSel}>${inst.company_name}</option>`;
        });
        defBox.innerHTML = `<span style="font-size:0.75rem; color:#15803d;">Default:</span><select onchange="updateDefaultInstaller(this.value)" style="border:none; bg:transparent; font-weight:700; color:#166534; font-size:0.8rem; cursor:pointer; outline:none;">${optionsHtml}</select>`;
    }
}

async function updateReferrerStats(leads) {
    const { data: freshProfile } = await sbClient.from('partners').select('wallet_balance').eq('id', currentProfile.id).single();
    const wallet = freshProfile ? Number(freshProfile.wallet_balance) : 0;
    
    let pendingPayout = 0;
    let totalPaidOut = 0;
    const { data: payouts } = await sbClient.from('payouts').select('amount, status').eq('partner_id', currentProfile.id);
    
    if(payouts) {
        pendingPayout = payouts.filter(p => p.status === 'pending').reduce((sum, i) => sum + Number(i.amount), 0);
        totalPaidOut = payouts.filter(p => p.status === 'paid').reduce((sum, i) => sum + Number(i.amount), 0);
    }

    let contactedCount = 0;
    let installedCount = 0;
    if (leads) {
        contactedCount = leads.filter(l => ['contacted', 'site_visit', 'deposit', 'installed'].includes(l.status)).length;
        installedCount = leads.filter(l => l.status === 'installed').length;
    }

    const fmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
    document.getElementById('stat-earned').innerText = fmt.format(wallet);
    document.getElementById('stat-pending').innerText = fmt.format(pendingPayout);
    document.getElementById('stat-total-paid').innerText = fmt.format(totalPaidOut);
    document.getElementById('stat-referrals').innerText = leads ? leads.length : 0;
    document.getElementById('stat-contacted-count').innerText = `${contactedCount} Contacted`;
    document.getElementById('stat-installed-count').innerText = `${installedCount} Installed`;
}

function renderReferrerTable(leads, installers) {
    const tbody = document.getElementById('referrer-leads-body');
    if(!tbody) return;
    tbody.innerHTML = '';

    if (!leads || leads.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:#94a3b8;">No leads yet. Share your code!</td></tr>`;
        return;
    }

    leads.forEach(lead => {
        const commVal = lead.commission_reward || 200;
        const unlockFee = 20; 
        const status = lead.status;
        const cancelledList = lead.cancelled_by_ids || [];
        const isActuallyAssigned = !!lead.assigned_partner_id && status !== 'pending';

        // 1. 进度条 (保持显示 Under Review)
        let progressHTML = getSegmentedProgressHTML(status, isActuallyAssigned, lead.commission_reward);
        
        // 2. 收益列显示 (保持显示 Under Review)
        let earnedDisplay = '';
        if (status === 'fraud_review') earnedDisplay = `<div style="color:#f59e0b; font-size:0.8rem; font-weight:600;">🛡️ Under Review</div>`;
        else if (status === 'fraud') earnedDisplay = `<div style="color:#ef4444; font-size:0.8rem;">⛔ Invalid Lead</div>`;
        else if (status === 'cancelled') earnedDisplay = `<div style="color:#f59e0b; font-size:0.8rem; font-weight:700;">Cancelled</div><div style="font-size:0.65rem; color:#64748b;">(Fee Retained)</div>`;
        else if (status === 'installed') earnedDisplay = `<div style="font-size:0.75rem; color:#10b981;">Unlock: +$${unlockFee}</div><div style="font-size:0.75rem; color:#10b981;">Comm: +$${commVal}</div><div style="font-weight:700; color:#059669; border-top:1px dashed #bbf7d0;">Net: $${unlockFee + commVal}</div>`;
        else if (['contacted', 'site_visit', 'deposit'].includes(status)) earnedDisplay = `<div style="font-size:0.75rem; color:#10b981;">Unlock: +$${unlockFee}</div><div style="font-weight:700; color:#059669;">Net: $${unlockFee}</div>`;
        else earnedDisplay = `<div class="waiting-badge" style="white-space:nowrap;">⏳ Wait for<br>Contact ($20) </div>`;

        // 3. 锁定选择框 (保持锁定，防止审核期间换人)
        const isLocked = (isActuallyAssigned && !['cancelled', 'pending'].includes(status)) || status === 'fraud_review' || status === 'fraud';
        const selectedId = lead.assigned_partner_id || currentProfile.default_installer_id;
        
        let assignSelect = `<select id="sel-lead-${lead.id}" class="installer-select" onchange="updateReassignUI(${lead.id})"
            ${isLocked ? 'disabled style="background:#f1f5f9; color:#94a3b8; border-color:#e2e8f0;"' : ''}>
            <option value="null">-- Select --</option>`;
            
        let isCurrentSelectionRejected = false;
        if (installers) {
            installers.forEach(inst => {
                const isRejected = cancelledList.includes(inst.id);
                const isSel = (inst.id === selectedId);
                if (isSel && isRejected) isCurrentSelectionRejected = true;
                let label = `⚡ ${inst.company_name}`;
                if (isRejected) label += " (Rejected)"; 
                assignSelect += `<option value="${inst.id}" ${isSel?'selected':''} data-rejected="${isRejected}">${label}</option>`;
            });
        }
        assignSelect += `</select>`;

        // 4. 🔥 按钮逻辑修正：Fraud Review 状态下仍然显示 Report
        let actionBtn = '';
        const btnId = `btn-action-${lead.id}`;
        
        // 🚨 优先级 1: 已确认欺诈 (永久禁用)
        if (status === 'fraud') {
             actionBtn = `<button class="btn-action btn-report" disabled style="opacity:0.5">⛔ Invalid</button>`;
        }
        // 🚨 优先级 2: 已取消 (处理重新分配逻辑)
        else if (status === 'cancelled') {
             if (isCurrentSelectionRejected) actionBtn = `<button id="${btnId}" onclick="handleReport(${lead.id}, 'Rejected')" class="btn-action btn-report">🚩 Report Issue</button>`;
             else actionBtn = `<button id="${btnId}" onclick="handleConfirmAllocation(${lead.id}, true)" class="btn-action btn-confirm" style="background:#f59e0b; border-color:#d97706;">🔄 Re-Assign</button>`;
        }
        // 🚨 优先级 3: 未分配
        else if (!isActuallyAssigned) {
             actionBtn = `<button id="${btnId}" onclick="handleConfirmAllocation(${lead.id}, false)" class="btn-action btn-confirm">✅ Confirm</button>`;
        }
        // 🚨 优先级 4: 新分配未读
        else if (isActuallyAssigned && status === 'new') {
             actionBtn = `<button id="${btnId}" onclick="handleNudge(${lead.id})" class="btn-action btn-nudge">🔔 Nudge</button>`;
        }
        // 🚨 优先级 5: 其他所有状态 (包含 fraud_review) -> 显示 Report 按钮
        // 这样 Referrer 可以在审核期间点击 Report 进行质疑
        else {
             // 如果是审核中，为了醒目，可以稍微加深一点颜色，或者直接用标准的 report 样式
             // 这里使用标准样式，点击后弹出 prompt
             actionBtn = `<button id="${btnId}" onclick="handleReport(${lead.id}, '${status}')" class="btn-action btn-report-light">🚩 Report</button>`;
        }

        const dateStr = new Date(lead.created_at).toLocaleDateString('en-AU', {year: 'numeric', month:'short', day:'numeric'});
        const leadSafe = encodeURIComponent(JSON.stringify(lead));

        const tr = document.createElement('tr');
        if (!isActuallyAssigned || status === 'cancelled') tr.className = 'row-attention';
        
        tr.innerHTML = `
            <td>
                <div class="clickable-name" onclick="showLeadDetails('${leadSafe}')">${lead.name}</div>
                <div class="user-sub">${dateStr}</div>
            </td>
            <td style="vertical-align: middle;">${earnedDisplay}</td>
            <td style="vertical-align: middle;">
            <div onclick="openTimelineModal('${lead.id}')" style="cursor:pointer; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
              ${progressHTML}
            </div>
            </td>
            <td style="vertical-align: middle;">${assignSelect}</td>
            <td style="vertical-align: middle; text-align: right;">${actionBtn}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ============================================================
// 🛠️ Installer Dashboard Logic
// ============================================================
async function loadInstallerDashboard() {
    const view = document.getElementById('view-installer');
    if(view) view.style.display = 'block';
    
    document.getElementById('inst-welcome-name').innerText = currentProfile.company_name || "Solar Pro";

    // 1. 获取余额
    const { data: partnerData } = await sbClient.from('partners').select('wallet_balance').eq('id', currentProfile.id).single();
    const currentBalance = partnerData ? Number(partnerData.wallet_balance) : 0;
    const fmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
    document.getElementById('inst-stat-credit').innerText = fmt.format(currentBalance);

    // 2. 获取 Referrer 映射表并存入全局
    const { data: allPartners } = await sbClient.from('partners').select('ref_code, contact_name, company_name');
    cachedRefMap = {}; // 重置
    if (allPartners) {
        allPartners.forEach(p => { if(p.ref_code) cachedRefMap[p.ref_code] = p.company_name || p.contact_name; });
    }

    // 3. 获取 Leads 数据
    const { data: leads } = await sbClient
    .from('leads')
    .select('*')
    .neq('status', 'pending')
    .or(`assigned_partner_id.eq.${currentProfile.id},cancelled_by_ids.cs.{${currentProfile.id}}`)
    .order('created_at', { ascending: false }); // <--- 改成 created_at
    
    currentLeads = leads || [];

    // 🌟 核心改动：调用独立的渲染函数
    renderInstallerTable(currentLeads);
}

function updateInstallerStatsUI(total, activeNew, valid, cancelled, installed, contacted, unlockPaid, commPaid) {
    const fmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });

    // ============================================================
    // 🎨 Part 1: 更新新的环形图卡片 (Option 1 Logic)
    // ============================================================
    
    // 1. 更新文字数字 (使用安全检查，防止找不到元素报错)
    const elChartTotal = document.getElementById('chart-total');
    if (elChartTotal) elChartTotal.innerText = total;

    const elChartNew = document.getElementById('chart-new');
    if (elChartNew) elChartNew.innerText = activeNew;

    const elChartValid = document.getElementById('chart-valid');
    if (elChartValid) elChartValid.innerText = valid;

    const elChartCancelled = document.getElementById('chart-cancelled');
    if (elChartCancelled) elChartCancelled.innerText = cancelled;

    // 2. 核心魔法：更新 CSS 圆环 (conic-gradient)
    const chartEl = document.getElementById('leads-donut');
    if (chartEl) {
        // 防止除以 0
        const safeTotal = total > 0 ? total : 1;
        
        // 计算百分比
        const pctNew = (activeNew / safeTotal) * 100;
        const pctValid = (valid / safeTotal) * 100;
        
        // 计算渐变的分界点 (累加)
        const endNew = pctNew;
        const endValid = endNew + pctValid;

        // 应用渐变：橙色(New) -> 绿色(Valid) -> 红色(Cancelled)
        chartEl.style.background = `conic-gradient(
            var(--orange) 0% ${endNew}%, 
            var(--accent) ${endNew}% ${endValid}%, 
            var(--red) ${endValid}% 100%
        )`;
    }

    // ============================================================
    // 📋 Part 2: 更新其他卡片 (保持原样，因为你只改了第一张卡)
    // ============================================================
    
    const elCompleted = document.getElementById('inst-stat-completed');
    if (elCompleted) elCompleted.innerText = installed;

    const elComm = document.getElementById('inst-stat-comm-paid');
    if (elComm) elComm.innerText = fmt.format(commPaid);

    const elContacted = document.getElementById('inst-stat-contacted');
    if (elContacted) elContacted.innerText = contacted;

    const elUnlock = document.getElementById('inst-stat-unlock-paid');
    if (elUnlock) elUnlock.innerText = fmt.format(unlockPaid);

    const elSpent = document.getElementById('inst-stat-total-spent');
    if (elSpent) elSpent.innerText = fmt.format(unlockPaid + commPaid);
}


// ==========================================
// 🔍 Lead Details Modal Logic (Final V6 - With Tag Mapping)
// ==========================================
window.showLeadDetails = function(leadEncoded) {
    const lead = JSON.parse(decodeURIComponent(leadEncoded));
    const profile = lead.user_profile || {}; 
    
    // 1. 获取 DOM 元素
    const modal = document.getElementById('lead-details-modal');
    const content = document.getElementById('modal-body');
    const title = document.getElementById('modal-lead-name');
    if (title) title.innerText = lead.name;
    
    // 2. 判断角色权限
    const isInstaller = (currentProfile.role === 'solar_pro' || currentProfile.role === 'installer');

    // ==========================================
    // A. 基础信息 (Referrer & Installer 可见)
    // ==========================================
    let html = `
        <div class="detail-row"><span class="detail-label">Phone:</span> <span class="detail-value"><a href="tel:${lead.phone}">${lead.phone || 'N/A'}</a></span></div>
        <div class="detail-row"><span class="detail-label">Email:</span> <span class="detail-value"><a href="mailto:${lead.email}">${lead.email || 'N/A'}</a></span></div>
        <div class="detail-row"><span class="detail-label">Address:</span> <span class="detail-value">${lead.address || 'N/A'}</span></div>
        <div class="detail-row"><span class="detail-label">Quarterly Bill:</span> <span class="detail-value">${lead.bill_amount ? '$' + lead.bill_amount : 'N/A'}</span></div>
    `;

    // ==========================================
    // B. 安装模式 (逻辑：关键字判断)
    // ==========================================
    const rawMode = lead.installation_mode || profile.install_mode || 'both';
    const modeStr = String(rawMode).toLowerCase();
    let modeDisplay = '';

    if (isInstaller) {
        if (modeStr.includes('both') || (modeStr.includes('solar') && modeStr.includes('battery'))) {
            modeDisplay = `<div style="font-weight:700; color:var(--primary);">${lead.solar_size || 6.6}kW Solar + ${lead.battery_size || 10}kWh Battery</div>`;
        }
        else if (modeStr.includes('battery')) {
            const existSolar = profile.existing_solar_size ? `${profile.existing_solar_size}kW` : 'Unknown';
            modeDisplay = `<div style="font-weight:700; color:var(--primary);">${lead.battery_size || 0}kWh Battery</div>
                           <div style="font-size:0.75rem; color:var(--text-light); margin-top:2px;">(Existing Solar: ${existSolar})</div>`;
        } 
        else if (modeStr.includes('solar')) {
            modeDisplay = `<div style="font-weight:700; color:var(--primary);">${lead.solar_size || 6.6}kW Solar System</div>`;
        }
        else {
            modeDisplay = `<div style="font-weight:700; color:var(--text-light);">${rawMode}</div>`;
        }
    } else {
        modeDisplay = `<span style="font-weight:600; color:var(--text-main);">${rawMode}</span>`;
    }
    
    html += `<div class="detail-row" style="align-items:flex-start;"><span class="detail-label">System Mode:</span> <span class="detail-value">${modeDisplay}</span></div>`;

    // ==========================================
    // C. Installer 专属详细信息 (全量字段)
    // ==========================================
    if (isInstaller) {
        const language = lead.language || profile.language || 'English';
        const phase = lead.property_phase || profile.property_phase || 'Unknown'; 

        // 1. Property Profile 数据提取
        const pType = lead.property_type || profile.property_type || 'Unknown';
        const pStoreys = lead.property_storeys || profile.property_storeys || profile.storey || 'Unknown';
        const pRoof = lead.property_roof || profile.property_roof || profile.roof_type || 'Unknown';
        const pShade = lead.property_shade || profile.property_shade || profile.shade || 'Unknown';

        // 2. User Profile 标签映射表 (Key -> 显示文字)
        const TAG_MAP = {
            'ac': '❄️ Air Con',
            'hws': '💧 Elec. Hot Water',
            'pool': '🏊 Pool Pump',
            'ev_now': '🚗 EV Owner',
            'ev_plan': '🔜 Plan to buy EV',
            'wfh': '🏠 Work From Home',
            'gas2elec': '🔥 Switch Gas to Elec',
            'backup': '🔋 Backup Power',
            'general': '📺 General Usage',
            'others': '⚡ High Load'
        };

        // 3. 提取所有值为 true 的标签
        const profileFlags = Object.entries(profile)
            .filter(([key, val]) => (val === true || val === 'true' || val === 'Yes') && TAG_MAP[key])
            .map(([key, val]) => TAG_MAP[key]);

        html += `
            <hr style="border:0; border-top:1px solid #e2e8f0; margin:15px 0;">
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px;">
                <div>
                    <div class="detail-label">Est. Price</div>
                    <div style="color:var(--accent); font-weight:700;">${lead.estimated_price || 'N/A'}</div>
                </div>
                <div>
                    <div class="detail-label">Language</div>
                    <div style="font-weight:600;">${language}</div>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px;">
                <div>
                    <div class="detail-label">Brand Pref</div>
                    <div>${profile.selected_brand || 'Any Tier 1'}</div>
                </div>
                <div>
                    <div class="detail-label">Phase</div>
                    <div>${phase}</div>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px;">
                <div>
                    <div class="detail-label">Timeframe</div>
                    <div>${profile.install_timeframe || 'Flexible'}</div>
                </div>
                <div>
                    <div class="detail-label">Contact Method</div>
                    <div>${profile.contact_method || 'Any'}</div>
                </div>
            </div>

            <div style="background:#f1f5f9; padding:12px; border-radius:8px; margin-bottom:15px; border:1px solid #e2e8f0;">
                <div class="detail-label" style="margin-bottom:8px; font-weight:700; color:var(--primary);">Property Profile</div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; font-size:0.8rem;">
                    <div><span style="color:#64748b;">Type:</span> <span style="font-weight:600; color:var(--text-main); display:block;">${pType}</span></div>
                    <div><span style="color:#64748b;">Storeys:</span> <span style="font-weight:600; color:var(--text-main); display:block;">${pStoreys}</span></div>
                    <div><span style="color:#64748b;">Roof:</span> <span style="font-weight:600; color:var(--text-main); display:block;">${pRoof}</span></div>
                    <div><span style="color:#64748b;">Shade:</span> <span style="font-weight:600; color:var(--text-main); display:block;">${pShade}</span></div>
                </div>
            </div>

            ${profileFlags.length > 0 ? `
            <div style="margin-bottom:15px;">
                <div class="detail-label" style="margin-bottom:6px;">Usage & Lifestyle</div>
                <div style="display:flex; flex-wrap:wrap; gap:6px;">
                    ${profileFlags.map(flag => `<span style="background:#e0f2fe; color:#0369a1; padding:4px 10px; border-radius:15px; font-size:0.75rem; font-weight:600; border:1px solid #bae6fd;">${flag}</span>`).join('')}
                </div>
            </div>` : ''}

            <div>
                <div class="detail-label" style="margin-bottom:8px;">Site Photos</div>
                <div style="display:flex; gap:10px;">
                    ${renderPhotoBox(lead.meter_box_photo, 'Meter Box')}
                    ${renderPhotoBox(lead.roof_photo, 'Roof')}
                </div>
            </div>

            <div style="margin-top:20px; border-top:2px solid #f1f5f9; padding-top:15px;">
                <div style="font-weight:700; font-size:0.85rem; margin-bottom:10px; color:var(--primary);">User log / notes</div>
                <div id="lead-history-container">${renderSimpleHistory(lead.notes)}</div>
            </div>
        `;
    }

    content.innerHTML = html;
    modal.style.display = 'flex';
    setTimeout(() => { modal.style.opacity = '1'; }, 10);
}

// ==========================================
// 🧩 Helper Functions (Add these at the bottom if missing)
// ==========================================

// 1. 渲染照片小方块
function renderPhotoBox(url, label) {
    if (url) {
        return `<a href="${url}" target="_blank" style="text-decoration:none;">
            <div style="width:70px; height:70px; background:#e2e8f0; border-radius:8px; background-image:url('${url}'); background-size:cover; border:1px solid #cbd5e1; position:relative;">
                <span style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.5); color:white; font-size:0.6rem; text-align:center; padding:2px;">${label}</span>
            </div>
        </a>`;
    } else {
        return `<div style="width:70px; height:70px; background:#f8fafc; border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; border:1px dashed #cbd5e1; color:#94a3b8;">
            <span style="font-size:1.2rem;">📷</span>
            <span style="font-size:0.6rem;">No ${label}</span>
        </div>`;
    }
}

// 2. 渲染简单的历史记录 (用于详情弹窗底部)
function renderSimpleHistory(notes) {
    if (!notes) return '<div style="font-size:0.75rem; color:#94a3b8; font-style:italic;">No changes recorded.</div>';
    
    return notes.split('\n').filter(l => l.trim()).reverse().map(log => {
        let borderColor = '#cbd5e1';
        let bgColor = '#f8fafc';
        
        if (log.includes('[LOCK_ALERT]')) { borderColor = '#f59e0b'; bgColor = '#fff7ed'; }
        if (log.includes('[CONFIG_UPDATE]')) { borderColor = '#10b981'; bgColor = '#f0fdf4'; }
        
        return `<div style="font-size:0.75rem; margin-bottom:5px; padding:6px 10px; background:${bgColor}; border-left:3px solid ${borderColor}; border-radius:4px; color:var(--text-main);">
            ${log}
        </div>`;
    }).join('');
}

// 辅助函数：渲染照片框
//function renderPhotoBox(url, label) {
//    if (url) return `<a href="${url}" target="_blank" style="width:60px; height:60px; background:#e2e8f0; border-radius:8px; background-image:url('${url}'); background-size:cover;"></a>`;
//    return `<div style="width:60px; height:60px; background:#f1f5f9; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:0.65rem; color:#94a3b8; border:1px dashed #cbd5e1;">No ${label}</div>`;
//}

// 辅助函数：渲染简单历史记录
//function renderSimpleHistory(notes) {
//    if (!notes) return '<div style="font-size:0.75rem; color:#94a3b8;">No history.</div>';
//    return notes.split('\n').filter(l => l.trim()).reverse().map(log => {
//        let color = log.includes('[LOCK_ALERT]') ? '#f59e0b' : (log.includes('[CONFIG_UPDATE]') ? '#10b981' : '#64748b');
//        return `<div style="font-size:0.75rem; margin-bottom:4px; padding:4px 8px; background:#f8fafc; border-left:3px solid ${color};">${log}</div>`;
//    }).join('');
//}

window.closeLeadModal = function(e) {
    if (e && e.target.id !== 'lead-details-modal' && !e.target.classList.contains('modal-close')) return;
    const modal = document.getElementById('lead-details-modal');
    modal.style.opacity = '0';
    setTimeout(() => modal.style.display = 'none', 300);
}

// 🔥 [Updated] Progress Bar: Added Fraud Review State
function getSegmentedProgressHTML(status, isAssigned, commissionReward) {
    let activeLevel = 0; 
    
    // 1. 特殊状态处理：审核中 & 已确认欺诈 & 已取消
    if (status === 'fraud_review') {
        return `<div class="step-container">
            <div class="step-bar"><div class="step-segment active-orange" style="flex:1; opacity: 0.8; background-image: repeating-linear-gradient(45deg, #f59e0b, #f59e0b 10px, #d97706 10px, #d97706 20px);"></div></div>
            <div class="progress-label"><span style="color:#d97706; font-weight:800;">⚠️ FRAUD UNDER REVIEW</span></div>
        </div>`;
    }

    if (status === 'fraud') {
        return `<div class="step-container">
            <div class="step-bar"><div class="step-segment active-red" style="flex:1;"></div></div>
            <div class="progress-label"><span style="color:#ef4444; font-weight:800;">⛔ FRAUD CONFIRMED</span></div>
        </div>`;
    }

    if (status === 'cancelled') {
        return `<div class="step-container">
            <div class="step-bar"><div class="step-segment active-red" style="flex:1;"></div></div>
            <div class="progress-label"><span style="color:#ef4444">CANCELLED</span></div>
        </div>`;
    }

    // 2. 正常流程处理
    if (status === 'installed') activeLevel = 5;
    else if (status === 'deposit') activeLevel = 4;
    else if (status === 'site_visit') activeLevel = 3;
    else if (status === 'contacted') activeLevel = 2;
    else if (isAssigned && status !== 'pending') activeLevel = 1; 
    else activeLevel = 0;

    let segments = '';
    const labels = ['Allocated', 'Contact', 'Quote', 'Deposit', 'Install'];
    
    for (let i = 1; i <= 5; i++) {
        let activeClass = '';
        if (activeLevel >= i) {
            if (i === 5) activeClass = 'active-green';
            else if (i === 3 || i === 4) activeClass = 'active-orange'; 
            else activeClass = 'active';
        }
        segments += `<div class="step-segment ${activeClass}"></div>`;
    }

    let currentLabel = activeLevel > 0 ? labels[activeLevel - 1] : 'Pending Allocation';
    
    // Inline Est. Comm Display
    if ((status === 'site_visit' || status === 'deposit') && commissionReward) {
        const est = Number(commissionReward);
        if (est > 0) {
            const low = (est * 0.8).toFixed(0);
            const high = (est * 1.2).toFixed(0);
            currentLabel += ` <span style="font-size:0.65rem; color:#f59e0b; font-weight:700; background:#fff7ed; padding:1px 4px; border-radius:4px; border:1px solid #ffedd5; margin-left:5px;">Est.Comm: $${low}-$${high}</span>`;
        }
    }

    return `<div class="step-container"><div class="step-bar">${segments}</div><div class="progress-label"><span>${currentLabel}</span><span>Step ${activeLevel}/5</span></div></div>`;
}

// 🔥 [Updated] Handle Status Change with Estimated Commission Logic
// 🔥 [Updated] Handle Status Change with Fraud Reason & Logic
window.handleStatusChange = async function(leadId, newStatus, oldStatus, feePaid) {
    
    // 1. Fetch current lead data (Increased scope to fetch 'notes')
    // 我们多取一个 'notes' 字段，以便把原因追加进去
    const { data: currentLeadData } = await sbClient
        .from('leads')
        .select('commission_reward, cancelled_by_ids, notes')
        .eq('id', leadId)
        .single();
        
    const savedEst = currentLeadData?.commission_reward;
    const currentNotes = currentLeadData?.notes || '';

    // ---------------------------------------------------------
    // 🛡️ 1. 防撞单拦截逻辑 (Fraud Protection Interceptor)
    // ---------------------------------------------------------
    let finalStatus = newStatus;
    let fraudReason = null; // 用于存储输入的原因
    
    // 如果用户选了 "Report Invalid"
    if (newStatus === 'fraud') {
        // 🔥 强制要求输入原因
        const input = prompt(
            "🛡️ REPORT INVALID LEAD\n\n" +
            "Please enter the reason (e.g., 'Wrong Number', 'Duplicate', 'Out of Service Area').\n" +
            "This will be sent to the platform for review.\n\n" +
            "Reason (Required):"
        );

        // 校验 1: 用户点击了取消
        if (input === null) {
            loadInstallerDashboard(); // 重置 UI
            return; 
        }

        // 校验 2: 输入为空
        if (input.trim() === "") {
            alert("❌ Reason is REQUIRED to report a lead.");
            loadInstallerDashboard(); // 重置 UI
            return;
        }

        fraudReason = input.trim();
        finalStatus = 'fraud_review'; // 强制改为审核状态
    } 
    else {
        // 普通状态变更的确认
        if (!confirm(`⚠️ Confirm Status Change?\n\nTo: ${newStatus.toUpperCase()}`)) { 
            loadInstallerDashboard(); 
            return; 
        }
    }
    // ---------------------------------------------------------

    const { data: partner } = await sbClient.from('partners').select('wallet_balance').eq('id', currentProfile.id).single();
    let currentBalance = partner ? Number(partner.wallet_balance) : 0;

    const unlockTriggers = ['contacted', 'site_visit', 'deposit'];
    let shouldPayUnlock = unlockTriggers.includes(finalStatus) && !feePaid; 
    
    if (shouldPayUnlock) {
        if (currentBalance < 50) { alert("❌ Insufficient Credit! Need $50.00."); loadInstallerDashboard(); return; }
        if (!confirm(`💰 PAYMENT REQUIRED\n\nLead Unlock Fee: $50.00\n\nProceed?`)) { loadInstallerDashboard(); return; }
    }

    let newEstComm = null;
    if (finalStatus === 'site_visit') {
        const promptMsg = savedEst && savedEst > 0
            ? `🚚 Site Visit / Quote\n\nExisting Estimate: $${savedEst}\nUpdate Estimated Referrer Commission ($):` 
            : `🚚 Site Visit / Quote\n\nPlease enter ESTIMATED Referrer Commission ($):`;
            
        const input = prompt(promptMsg, savedEst || "200");
        if (input === null) { loadInstallerDashboard(); return; }
        newEstComm = Number(input);
        if (isNaN(newEstComm) || newEstComm < 0) { alert("Invalid amount."); loadInstallerDashboard(); return; }
    }

    let commissionAmount = 0, totalDeduction = 0, shouldPayComm = (finalStatus === 'installed');
    
    if (shouldPayComm) {
        if (savedEst && savedEst > 0) {
            commissionAmount = Number(savedEst);
            if(!confirm(`🎉 INSTALLATION COMPLETE!\n\nProcessing Payout using Quoted Estimate:\nReferrer Comm: $${commissionAmount}\nPlatform Fee: $${(commissionAmount*0.05).toFixed(2)}\n\nProceed?`)) {
                 loadInstallerDashboard(); return; 
            }
        } else {
            const input = prompt("🎉 INSTALLATION COMPLETE!\n\nNo estimate found. Enter Net Commission for Referrer:", "200");
            if (!input) { loadInstallerDashboard(); return; }
            commissionAmount = Number(input);
        }
        totalDeduction = commissionAmount * 1.05;
        if (currentBalance < totalDeduction) { alert(`❌ Insufficient Credit! Need $${totalDeduction.toFixed(2)}.`); loadInstallerDashboard(); return; }
    }

    try {
        const updateData = { status: finalStatus }; 
        const now = new Date().toISOString();

        // 1. 设置各类时间戳
        if (finalStatus === 'contacted') updateData.date_contacted = now;
        if (finalStatus === 'site_visit') updateData.date_site_visit = now;
        if (finalStatus === 'deposit') updateData.date_deposit = now;
        if (finalStatus === 'installed') updateData.date_installed = now;
        if (['cancelled', 'fraud', 'fraud_review'].includes(finalStatus)) {
            updateData.date_cancelled = now; 
        }
        updateData.updated_at = now;

        // 2. 处理支付字段
        if (shouldPayUnlock) updateData.fee_paid = true;
        if (shouldPayComm) updateData.final_commission = commissionAmount;
        if (newEstComm !== null) updateData.commission_reward = newEstComm; 

        // 3. 处理黑名单 (Cancelled / Fraud)
        if (finalStatus === 'cancelled' || finalStatus === 'fraud' || finalStatus === 'fraud_review') {
            let currentBlacklist = currentLeadData?.cancelled_by_ids || [];
            if (!currentBlacklist.includes(currentProfile.id)) currentBlacklist.push(currentProfile.id);
            updateData.cancelled_by_ids = currentBlacklist;
        }

        // 4. 🔥 核心：将原因写入 Notes
        if (fraudReason) {
            // 格式： [FRAUD_REPORT] 2023-10-xx: 原因内容
            const reasonLog = `[FRAUD_REPORT] ${new Date().toLocaleDateString('en-AU')}: ${fraudReason}`;
            updateData.notes = currentNotes ? currentNotes + '\n' + reasonLog : reasonLog;
        }

        const { error: leadErr } = await sbClient.from('leads').update(updateData).eq('id', leadId);
        if (leadErr) throw leadErr;

        // 5. 扣款与分润逻辑
        if (shouldPayUnlock) {
            await rpcUpdateBalance(currentProfile.id, -50);
            await recordTransaction(currentProfile.id, -50, 'lead_unlock', `Unlock Lead #${leadId}`);
            const { data: leadInfo } = await sbClient.from('leads').select('referral_code').eq('id', leadId).single();
            if (leadInfo?.referral_code) {
                const { data: refPartner } = await sbClient.from('partners').select('id').eq('ref_code', leadInfo.referral_code).single();
                if (refPartner) { 
                    await rpcUpdateBalance(refPartner.id, 20); 
                    await recordTransaction(refPartner.id, 20, 'commission_unlock', `Lead #${leadId} Unlocked`); 
                }
            }
        }

        if (shouldPayComm) {
            await rpcUpdateBalance(currentProfile.id, -totalDeduction);
            await recordTransaction(currentProfile.id, -totalDeduction, 'commission_paid', `Lead #${leadId} Installed`);
            const { data: leadInfo } = await sbClient.from('leads').select('referral_code').eq('id', leadId).single();
            if (leadInfo?.referral_code) {
                const { data: refPartner } = await sbClient.from('partners').select('id').eq('ref_code', leadInfo.referral_code).single();
                if (refPartner) { 
                    await rpcUpdateBalance(refPartner.id, commissionAmount); 
                    await recordTransaction(refPartner.id, commissionAmount, 'commission_final', `Lead #${leadId} Installed`); 
                }
            }
        }

        // 6. 成功提示
        if (finalStatus === 'fraud_review') {
            alert("🛡️ Report Submitted.\n\nStatus: 'Under Review'.\nNote added to history.");
        } else {
            alert("Processed Successfully! ✅");
        }
        
        loadInstallerDashboard();

    } catch (err) { console.error(err); alert("Error: " + err.message); loadInstallerDashboard(); }
}

async function rpcUpdateBalance(partnerId, amount) {
    const { error } = await sbClient.rpc('increment_balance', { row_id: partnerId, amount: amount });
    if (error) { console.error("RPC Error:", error); alert("Wallet update failed! Check console."); }
}
async function recordTransaction(partnerId, amount, type, desc) {
    await sbClient.from('transactions').insert([{ partner_id: partnerId, amount: amount, type: type, description: desc }]);
}
window.handleConfirmAllocation = async function(leadId, isReassign) {
    const selectEl = document.getElementById(`sel-lead-${leadId}`);
    const newInstallerId = selectEl?.value;
    if (!newInstallerId || newInstallerId === 'null') { alert("Please select a valid installer first."); return; }
    let updatePayload = { assigned_partner_id: newInstallerId, status: 'new' };
    if (isReassign) {
        if (!confirm("🔄 Re-assign this lead?\n\nThis will reset the workflow.")) return;
        const { data: currentLead } = await sbClient.from('leads').select('assigned_partner_id, cancelled_by_ids').eq('id', leadId).single();
        const oldId = currentLead?.assigned_partner_id;
        let newBlacklist = currentLead?.cancelled_by_ids || [];
        if (oldId && !newBlacklist.includes(oldId)) newBlacklist.push(oldId);
        updatePayload.fee_paid = false; updatePayload.cancelled_by_ids = newBlacklist;
    }
    const { error } = await sbClient.from('leads').update(updatePayload).eq('id', leadId);
    if (error) alert("Allocation failed: " + error.message); else { alert(isReassign ? "Re-assigned! 🔄" : "Allocated! ✅"); loadReferrerDashboard(); }
}
window.updateReassignUI = function(leadId) {
    const selectEl = document.getElementById(`sel-lead-${leadId}`);
    const btnEl = document.getElementById(`btn-action-${leadId}`);
    if (!selectEl || !btnEl) return;
    const selectedOption = selectEl.options[selectEl.selectedIndex];
    const isRejected = selectedOption.getAttribute('data-rejected') === 'true';
    const rowHTML = selectEl.closest('tr').innerHTML;
    const isCancelledRow = rowHTML.includes('Cancelled');
    if (isRejected) {
        btnEl.innerText = "🚩 Report Issue"; btnEl.className = "btn-action btn-report"; btnEl.onclick = function() { handleReport(leadId, 'Repeated Assignment'); };
        btnEl.style.background = "#fff"; btnEl.style.borderColor = "#fecaca"; btnEl.style.color = "#ef4444";
    } else {
        if (isCancelledRow) {
            btnEl.innerText = "🔄 Re-Assign"; btnEl.className = "btn-action btn-confirm"; btnEl.onclick = function() { handleConfirmAllocation(leadId, true); };
            btnEl.style.background = "#f59e0b"; btnEl.style.borderColor = "#d97706"; btnEl.style.color = "#fff";
        } else {
            btnEl.innerText = "✅ Confirm"; btnEl.className = "btn-action btn-confirm"; btnEl.onclick = function() { handleConfirmAllocation(leadId, false); };
            btnEl.style.background = "#0f172a"; btnEl.style.borderColor = "transparent"; btnEl.style.color = "#fff";
        }
    }
}
window.updateDefaultInstaller = async function(val) {
    const newId = val === 'null' ? null : val;
    await sbClient.from('partners').update({ default_installer_id: newId }).eq('id', currentProfile.id);
    currentProfile.default_installer_id = newId;
    alert("Default installer updated!");
}
window.handleWithdraw = async function() {
    const balance = currentProfile.wallet_balance || 0;
    if (balance <= 0) return alert("Wallet is empty.");
    const amount = prompt(`Available: $${balance}\nWithdraw Amount:`, balance);
    if (amount > 0) {
        await sbClient.from('payouts').insert({ partner_id: currentProfile.id, amount: amount, status: 'pending' });
        await rpcUpdateBalance(currentProfile.id, -amount);
        await recordTransaction(currentProfile.id, -amount, 'withdrawal', `Payout Request: $${amount}`);
        alert("Withdrawal submitted.");
        if(currentProfile.role === 'referral') loadReferrerDashboard(); else loadInstallerDashboard();
    }
}
window.handleNudge = async function(leadId) {
    const btn = event.target;
    const originalText = btn.innerText;
    
    // 1. UI 变化：显示正在发送
    btn.innerText = "Sending...";
    btn.disabled = true;

    // 2. (可选) 这里可以调用 Supabase 插入一条通知给 Installer
    // await sbClient.from('notifications').insert({ ... });

    // 3. 模拟发送延迟
    setTimeout(() => {
        alert("✅ Nudge Sent! \nWe've reminded the installer to update this lead.");
        
        // 4. 按钮变绿，防止重复点
        btn.innerText = "Nudged ✅";
        btn.style.background = "#dcfce7";
        btn.style.color = "#166534";
    }, 800);
}
window.handleReport = function(leadId, status) { prompt(`Report issue for Lead #${leadId}:`); alert("Report submitted."); }
window.appSwitchToReferral = function() {
    document.getElementById('view-installer').style.display = 'none';
    document.getElementById('view-referral').style.display = 'block';
    loadReferrerDashboard();
    const btn = document.getElementById('btn-back-installer');
    if(btn) btn.style.display = 'inline-block';
}
window.appBackToInstaller = function() {
    document.getElementById('view-referral').style.display = 'none';
    document.getElementById('view-installer').style.display = 'block';
}
// ==========================================
// 📱 Mobile UX Helpers
// ==========================================
window.scrollToActions = function() {
    const container = document.querySelector('#view-referral .table-container');
    const hint = document.getElementById('ref-swipe-hint');

    // 1. 自动向右平滑滚动表格
    if(container) {
        container.scrollTo({
            left: container.scrollWidth,
            behavior: 'smooth'
        });
    }

    // 2. 停止闪烁，改变样式
    if(hint) {
        hint.classList.add('stopped');
        hint.innerHTML = "Swiped ✅"; // 文字变更为已完成
        hint.onclick = null; // 移除点击事件
    }
}

// ==========================================
// ⚙️ Profile Settings Logic (Secure V2)
// ==========================================

// 1. 打开主 Profile 弹窗
window.openProfileModal = async function() {
    const modal = document.getElementById('profile-modal');
    
    // 🔥 每次打开都重置为锁定状态
    document.getElementById('prof-lock-panel').style.display = 'flex';
    document.getElementById('prof-secure-fields').style.display = 'none';

    // 填充只读和基础信息
    document.getElementById('prof-role').value = (currentProfile.role || 'Partner').toUpperCase();
    document.getElementById('prof-email').value = currentUser.email || '';
    document.getElementById('prof-code').value = currentProfile.ref_code || '-';
    
    document.getElementById('prof-name').value = currentProfile.contact_name || '';
    document.getElementById('prof-company').value = currentProfile.company_name || '';
    document.getElementById('prof-phone').value = currentProfile.phone || '';
    document.getElementById('prof-abn').value = currentProfile.abn_acn || '';
    document.getElementById('prof-notify').checked = currentProfile.notify_email !== false;

    // 预填充敏感信息（虽然此时不可见，但先填进去，等解锁后直接显示）
    document.getElementById('prof-bank').value = currentProfile.payment_details || '';
    document.getElementById('prof-pin').value = currentProfile.payment_pin || ''; 
    document.getElementById('prof-new-pass').value = ''; 

    modal.style.display = 'flex';
    setTimeout(() => modal.style.opacity = '1', 10);
}

window.closeProfileModal = function(e) {
    if (e && e.target.id !== 'profile-modal' && !e.target.classList.contains('modal-close')) return;
    document.getElementById('profile-modal').style.opacity = '0';
    setTimeout(() => document.getElementById('profile-modal').style.display = 'none', 300);
}

// 2. 二级验证弹窗逻辑
window.openVerifyModal = function() {
    document.getElementById('verify-password-input').value = ''; // 清空
    const vModal = document.getElementById('verify-modal');
    vModal.style.display = 'flex';
    setTimeout(() => {
        vModal.style.opacity = '1';
        document.getElementById('verify-password-input').focus(); // 自动聚焦
    }, 10);
}

window.closeVerifyModal = function(e) {
    if (e && e.target.id !== 'verify-modal' && !e.target && !e.target.innerText === 'Cancel') return;
    document.getElementById('verify-modal').style.opacity = '0';
    setTimeout(() => document.getElementById('verify-modal').style.display = 'none', 300);
}

// 3. 提交解锁验证 (核心安全逻辑)
window.submitUnlock = async function() {
    const pass = document.getElementById('verify-password-input').value;
    const btn = document.getElementById('btn-verify-submit');
    
    if(!pass) return alert("Please enter password.");
    
    btn.innerText = "Checking...";
    
    // ⚡ 调用 Supabase 验证当前密码
    const { error } = await sbClient.auth.signInWithPassword({
        email: currentUser.email,
        password: pass
    });

    btn.innerText = "Unlock";

    if (error) {
        alert("❌ Password Incorrect. Access Denied.");
        document.getElementById('verify-password-input').value = '';
    } else {
        // ✅ 验证成功
        closeVerifyModal();
        // 切换 UI：隐藏锁，显示真实表单
        document.getElementById('prof-lock-panel').style.display = 'none';
        document.getElementById('prof-secure-fields').style.display = 'block';
    }
}

// 4. 保存所有设置
// (注：能点到保存，说明要么没改敏感信息，要么已经解锁了敏感信息)
window.saveProfileSettings = async function() {
    const btn = document.getElementById('btn-save-profile');
    const originalText = btn.innerText;
    btn.innerText = "Saving...";
    btn.disabled = true;

    // 获取值
    const newName = document.getElementById('prof-name').value.trim();
    const newCompany = document.getElementById('prof-company').value.trim();
    const newPhone = document.getElementById('prof-phone').value.trim();
    const newABN = document.getElementById('prof-abn').value.trim();
    const newNotify = document.getElementById('prof-notify').checked;
    
    // 敏感值 (如果未解锁，这些值就是 openModal 时预填的旧值，保存也没问题)
    const newBank = document.getElementById('prof-bank').value.trim();
    const newPin = document.getElementById('prof-pin').value.trim();
    const newPass = document.getElementById('prof-new-pass').value;

    if (!newName) { alert("Contact Name is required."); btn.innerText = originalText; btn.disabled = false; return; }
    if (newPin && !/^\d{4,6}$/.test(newPin)) {
        alert("PIN must be 4-6 digits numbers only.");
        btn.innerText = originalText; btn.disabled = false; return;
    }

    try {
        // A. 更新数据库
        const updates = {
            contact_name: newName,
            company_name: newCompany,
            phone: newPhone,
            abn_acn: newABN,
            payment_details: newBank,
            payment_pin: newPin,
            notify_email: newNotify
        };

        const { error } = await sbClient.from('partners').update(updates).eq('id', currentProfile.id);
        if (error) throw error;

        // B. 如果填了新密码，更新 Auth
        if (newPass) {
            const { error: passErr } = await sbClient.auth.updateUser({ password: newPass });
            if (passErr) throw passErr;
            alert("✅ Profile & Password updated successfully!");
        } else {
            alert("✅ Profile saved successfully!");
        }

        await loadProfile(); 
        closeProfileModal();

    } catch (err) {
        console.error(err);
        alert("Error: " + err.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

window.handleLogout = async function() {
    if(confirm("Are you sure you want to sign out?")) {
        await sbClient.auth.signOut();
        window.location.replace("index.html");
    }
}

// ==========================================
// ⏱️ Timeline Modal Logic (Milestone Version)
// ==========================================

window.openTimelineModal = function(leadId) {
    if (!currentLeads || currentLeads.length === 0) return;
    const lead = currentLeads.find(l => l.id == leadId);
    if (!lead) return;

    // 1. 头部信息 (保持不变)
    const displayName = lead.name || lead.contact_name || lead.client_name || 'Valued Client';
    document.getElementById('time-lead-name').innerText = displayName;
    document.getElementById('time-lead-avatar').innerText = displayName.charAt(0).toUpperCase();
    
    const statusEl = document.getElementById('time-lead-status');
    statusEl.innerText = 'Current: ' + formatStatus(lead.status);
    statusEl.style.background = getStatusColor(lead.status) + '20'; 
    statusEl.style.color = getStatusColor(lead.status);

    // 2. 生成时间轴
    const listContainer = document.getElementById('timeline-list');
    listContainer.innerHTML = ''; 

    // 定义每个阶段对应的时间字段
    // 结构：[状态代码, 显示标题, 对应数据库字段, 描述文案]
    const milestones = [
        { id: 'new',        title: 'Lead Created',  time: lead.created_at,       desc: 'Customer submitted details.' },
        { id: 'contacted',  title: 'Contacted',     time: lead.date_contacted,   desc: 'Initial call made & verified.' },
        { id: 'site_visit', title: 'Site Visit',    time: lead.date_site_visit,  desc: 'Site inspection & Quote sent.' },
        { id: 'deposit',    title: 'Deposit Paid',  time: lead.date_deposit,     desc: 'Quote accepted & Deposit received.' },
        { id: 'installed',  title: 'Installed',     time: lead.date_installed,   desc: 'System installation completed.' }
    ];

    let html = '';
    let isCancelled = ['cancelled', 'void', 'fraud'].includes(lead.status);
    let reachedCurrent = false;

    // A. 遍历正常流程
    milestones.forEach((step, index) => {
        // 如果已经到了取消状态，且当前步骤还没发生过（没时间），就跳过后续步骤
        if (isCancelled && !step.time && index > 0) return; 

        // 判定状态：
        // 1. 有时间 = Done (已完成)
        // 2. 是当前状态 = Current (进行中)
        // 3. 没时间 = Pending (灰色)
        
        let isDone = !!step.time; // 有时间就算做过
        let isCurrent = (lead.status === step.id);
        
        // 特殊处理：有些步骤可能跳过了（比如直接从New变Installed），中间没时间但逻辑上算过
        // 如果当前步骤的索引 < 实际状态的索引，且没有时间，我们给它补一个 "Skipped/Auto" 或者默认显示
        // 这里为了简单，我们只显示"有时间"的或者"当前"的
        
        // 渲染逻辑：
        // 显示条件：(有时间) 或者 (是当前状态) 或者 (是第一步)
        if (step.time || isCurrent || step.id === 'new') {
            
            let timeDisplay = step.time ? formatTime(step.time) : 'In Progress...';
            
            // 计算停滞时间 (Stagnation Alert)
            let alertHtml = '';
            if (isCurrent && step.time) {
                const diffDays = (new Date() - new Date(step.time)) / (1000 * 60 * 60 * 24);
                if (diffDays > 3) {
                    alertHtml = `<div style="font-size:0.65rem; color:#ef4444; font-weight:700; margin-top:2px;">⏳ No updates for ${Math.floor(diffDays)} days</div>`;
                }
            }

            html += `
                <div class="timeline-item">
                    <div class="timeline-dot ${isCurrent ? 'current' : 'done'}"></div>
                    <div class="timeline-content">
                        <div class="timeline-time">${timeDisplay}</div>
                        <div class="timeline-title">${step.title}</div>
                        <div class="timeline-desc">${step.desc}</div>
                        ${alertHtml}
                    </div>
                </div>
            `;
        }
    });

    // B. 如果是取消状态，在最后追加一个红色节点
    if (isCancelled) {
        const cancelTime = lead.date_cancelled || lead.updated_at;
        html += `
            <div class="timeline-item">
                <div class="timeline-dot cancelled"></div>
                <div class="timeline-content">
                    <div class="timeline-time">${formatTime(cancelTime)}</div>
                    <div class="timeline-title" style="color:var(--red)">${formatStatus(lead.status)}</div>
                    <div class="timeline-desc">${lead.notes || 'Process terminated.'}</div>
                </div>
            </div>`;
    }

    listContainer.innerHTML = html;
    
    const modal = document.getElementById('timeline-modal');
    modal.style.display = 'flex';
    setTimeout(() => modal.style.opacity = '1', 10);
}

// 辅助函数：优化时间显示
// 如果有时间 -> 显示时间
// 如果没时间 -> 显示 "Done" 而不是 "Completed" (更简洁)
function createTimelineItem(isDone, title, dateStr, desc, isCurrent = false) {
    const dotClass = isCurrent ? 'current' : (isDone ? 'done' : '');
    
    // 🔥 这里控制显示什么文字
    let timeDisplay = '✔ Done'; 
    if (dateStr) {
        timeDisplay = formatTime(dateStr);
    }
    
    return `
        <div class="timeline-item">
            <div class="timeline-dot ${dotClass}"></div>
            <div class="timeline-content">
                <div class="timeline-time">${timeDisplay}</div>
                <div class="timeline-title">${title}</div>
                <div class="timeline-desc">${desc}</div>
            </div>
        </div>
    `;
}

// 新增一个小助手：统一时间格式 (月-日 时:分)
function formatTime(isoString) {
    if (!isoString) return '';
    return new Date(isoString).toLocaleString('en-AU', {
        month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'
    });
}

// 辅助函数：生成单行 HTML
function createTimelineItem(isDone, title, dateStr, desc, isCurrent = false) {
    const dotClass = isCurrent ? 'current' : (isDone ? 'done' : '');
    const timeDisplay = dateStr ? new Date(dateStr).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : 'Completed';
    
    return `
        <div class="timeline-item">
            <div class="timeline-dot ${dotClass}"></div>
            <div class="timeline-content">
                <div class="timeline-time">${timeDisplay}</div>
                <div class="timeline-title">${title}</div>
                <div class="timeline-desc">${desc}</div>
            </div>
        </div>
    `;
}

// 辅助函数：每个步骤的描述文案
function getStepDescription(status) {
    switch(status) {
        case 'contacted': return 'Initial call made & requirements verified.';
        case 'site_visit': return 'Site inspection scheduled/completed.';
        case 'deposit': return 'Quote accepted & deposit received.';
        case 'installed': return 'System installation completed.';
        default: return 'Status updated.';
    }
}

window.closeTimelineModal = function(e) {
    if (e && e.target.id !== 'timeline-modal' && !e.target.classList.contains('modal-close')) return;
    document.getElementById('timeline-modal').style.opacity = '0';
    setTimeout(() => document.getElementById('timeline-modal').style.display = 'none', 300);
}

// ==========================================
// 🎨 Helper Functions (Missing Pieces)
// ==========================================

// 1. 格式化状态文字 (例如: "site_visit" -> "Site Visit")
function formatStatus(status) {
    if (!status) return 'Unknown';
    // 把下划线替换为空格，并首字母大写
    return status.split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// 2. 获取状态对应的颜色
function getStatusColor(status) {
    switch (status) {
        case 'new': return '#3b82f6';       // 蓝色
        case 'contacted': return '#8b5cf6'; // 紫色
        case 'site_visit': return '#f59e0b';// 橙色
        case 'deposit': return '#eab308';   // 黄色
        case 'installed': return '#10b981'; // 绿色
        case 'cancelled': return '#ef4444'; // 红色
        case 'fraud': return '#ef4444';     // 红色
        case 'fraud_review': return '#f97316'; // 🔥 Orange for Review
        case 'void': return '#94a3b8';      // 灰色
        default: return '#cbd5e1';          // 默认灰
    }
}

// ==========================================
// 🍊 Update Tag Logic (Click-to-Clear)
// ==========================================
window.handleLeadClick = async function(leadEncoded, leadId) {
    // 1. 先做正事：打开详情弹窗 (调用你原来的函数)
    // 注意：leadEncoded 是被编码过的字符串，可以直接传给 showLeadDetails
    if (typeof showLeadDetails === 'function') {
        showLeadDetails(leadEncoded);
    }

    // 2. 视觉反馈：查找那个 ID 对应的橙色标签
    const tagElement = document.getElementById(`tag-update-${leadId}`);
    
    // 如果标签存在（说明是未读状态），我们把它消灭掉
    if (tagElement) {
        // A. 立即在界面上隐藏（给用户极快的感觉）
        tagElement.style.display = 'none';

        try {
            // B. 在后台默默告诉数据库：这个更新已读了
            const { error } = await sbClient
                .from('leads')
                .update({ has_client_update: false })
                .eq('id', leadId);

            if (error) {
                console.error("Failed to sync read status:", error);
            } else {
                // console.log("Update flag cleared for lead:", leadId);
            }
        } catch (err) {
            console.error("Error clearing update flag:", err);
        }
    }
};

// ==========================================
// 📊 数据功能：搜索筛选 & CSV 导出
// ==========================================

// 1. 缓存安装商列表（全局变量），供搜索重新渲染使用
let cachedInstallersList = [];

// 2. 搜索过滤主逻辑
window.filterLeads = function(role) {
    const inputId = role === 'referral' ? 'ref-search-input' : 'inst-search-input';
    const searchTerm = document.getElementById(inputId).value.toLowerCase();
    
    const filtered = currentLeads.filter(lead => {
        const name = (lead.name || "").toLowerCase();
        // 如果想搜电话，就把下面这行加上
        // const phone = (lead.phone || "").toLowerCase();
        return name.includes(searchTerm);
    });

    if (role === 'referral') {
        renderReferrerTable(filtered, cachedInstallersList);
    } else {
        // 🌟 现在搜索时可以正确渲染 Installer 表格了
        renderInstallerTable(filtered);
    }
};

// 3. 专门为 Installer 搜索使用的轻量渲染函数
function renderInstallerRowsOnly(leads) {
    const tbody = document.getElementById('installer-leads-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    // 重新运行 loadInstallerDashboard 里的循环部分
    // 注意：这里可能需要 refMap，建议在 loadInstallerDashboard 里将其设为全局
    if (leads.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:40px; color:#94a3b8;">No matching leads.</td></tr>`;
        return;
    }
    // 逻辑同 loadInstallerDashboard 的循环体，建议将该循环体抽离成独立函数以优化代码
    // 为了简单起见，搜索时可以直接重新执行 loadInstallerDashboard() 
    // 但更优雅的做法是将渲染逻辑抽离出来。
}

// 4. CSV 导出功能
window.exportLeadsToCSV = function(role) {
    if (!currentLeads || currentLeads.length === 0) {
        alert("No leads available to export.");
        return;
    }

    // 定义表头
    const headers = ["Created At", "Name", "Email", "Phone", "Status", "Address", "Estimated Commission"];
    
    // 转换为 CSV 格式的行
    const csvRows = [
        headers.join(","), // 第一行：标题
        ...currentLeads.map(lead => [
            new Date(lead.created_at).toLocaleDateString(),
            `"${lead.name || ''}"`,
            lead.email || '',
            `"${lead.phone || ''}"`,
            lead.status || '',
            `"${lead.address || ''}"`,
            lead.commission_reward || 0
        ].join(","))
    ].join("\n");

    // 创建下载链接
    const blob = new Blob([csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Solaryo_Leads_${role}_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// 5. 修正：在已有的 loadReferrerDashboard 中保存 cachedInstallersList
const originalLoadReferrer = window.loadReferrerDashboard;
window.loadReferrerDashboard = async function() {
    // 拦截并保存 installer 列表
    const { data: allInstallers } = await sbClient.from('partners').select('id, company_name').eq('role', 'solar_pro').order('company_name');
    cachedInstallersList = allInstallers || [];
    // 继续原来的逻辑
    await originalLoadReferrer(); 
};

// 🌟 新增的独立渲染函数
function renderInstallerTable(leads) {
    const tbody = document.getElementById('installer-leads-body');
    if(!tbody) return;
    tbody.innerHTML = '';

    // 统计变量
    let countTotal = 0, countNew = 0, countCancelled = 0, countValid = 0, countInstalled = 0, countContacted = 0;
    let totalUnlockPaid = 0, totalCommPaid = 0;

    if (!leads || leads.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:40px; color:#94a3b8;">No jobs found.</td></tr>`;
        updateInstallerStatsUI(0, 0, 0, 0, 0, 0, 0, 0); 
        return;
    }

    leads.forEach(lead => {
        const isMyLead = lead.assigned_partner_id === currentProfile.id;
        const isPastCancelled = lead.cancelled_by_ids && lead.cancelled_by_ids.includes(currentProfile.id);
        const displayStatus = isPastCancelled && !isMyLead ? 'cancelled' : lead.status;

        // --- 统计逻辑 ---
        countTotal++;
        if (displayStatus === 'new') countNew++;
        if (['cancelled', 'fraud', 'fraud_review'].includes(displayStatus)) countCancelled++;
        else countValid++;

        if (isMyLead) {
            if (lead.fee_paid) { countContacted++; totalUnlockPaid += 50; }
            if (lead.status === 'installed' && lead.final_commission) {
                countInstalled++; totalCommPaid += Number(lead.final_commission) * 1.05;
            }
        }

        // --- 财务 HTML 生成 ---
        let financialHtml = `<span style="color:#cbd5e1;">-</span>`;
        let items = [];
        if (isMyLead) {
            if (lead.fee_paid) items.push(`<div style="display:flex; justify-content:space-between;"><span style="color:#334155;">🔓 Unlock</span><span style="color:#ef4444; font-weight:700;">-$50</span></div>`);
            if (lead.status === 'installed' && lead.final_commission) {
                const comm = Number(lead.final_commission);
                const fee = comm * 0.05;
                items.push(`<div style="display:flex; justify-content:space-between;"><span style="color:#334155;">✅ Comm</span><span style="color:#ef4444; font-weight:700;">-$${(comm + fee).toFixed(0)}</span></div>`);
            } else if (lead.commission_reward > 0) {
                items.push(`<div style="display:flex; justify-content:space-between;"><span style="color:#64748b;">Est. Comm</span><span style="color:#f59e0b; font-weight:700;">$${lead.commission_reward}</span></div>`);
            }
            if (items.length > 0) financialHtml = `<div style="font-size:0.75rem; line-height:1.4;">${items.join('<div style="border-top:1px dashed #e2e8f0; margin:2px 0;"></div>')}</div>`;
        } else if (isPastCancelled) {
            financialHtml = `<div style="font-size:0.7rem; color:#94a3b8; font-style:italic;">Connection Ended</div>`;
        }

        // --- 下拉菜单与状态逻辑 (保持你原来的 optionsHtml 生成代码) ---
        const currentIdx = STATUS_FLOW.indexOf(displayStatus);
        let optionsHtml = '';
        STATUS_FLOW.forEach((step, idx) => {
            let label = step.charAt(0).toUpperCase() + step.slice(1);
            if (step === 'site_visit') label = "🚚 Site Visit";
            if (step === 'new') label = "📥 New Received";
            if (step === 'contacted') label = "📞 Contacted ($50)";
            if (step === 'deposit') label = "💰 Deposit";
            if (step === 'installed') label = "✅ Installed (Comm.)";
            const isReviewing = (displayStatus === 'fraud_review');
            const isDisabled = (idx < currentIdx) || isReviewing; 
            optionsHtml += `<option value="${step}" ${step===displayStatus?'selected':''} ${isDisabled?'disabled':''}>${isDisabled && !isReviewing?'✔ ':''}${label}</option>`;
        });
        optionsHtml += `<option value="cancelled" ${displayStatus==='cancelled'?'selected':''}>❌ Cancelled</option>`;
        if (displayStatus === 'fraud_review') optionsHtml += `<option value="fraud_review" selected>⏳ Reviewing...</option>`;
        else if (displayStatus === 'fraud') optionsHtml += `<option value="fraud" selected>⛔ Fraud Confirmed</option>`;
        else optionsHtml += `<option value="fraud">🚩 Report Invalid</option>`;

        // --- 行渲染 ---
        const isLocked = !isMyLead || ['installed', 'cancelled', 'fraud', 'fraud_review'].includes(lead.status);
        const refName = lead.referral_code && cachedRefMap[lead.referral_code] ? cachedRefMap[lead.referral_code] : '-';
        const leadSafe = encodeURIComponent(JSON.stringify(lead));
        const updateTag = lead.has_client_update ? `<span id="tag-update-${lead.id}" style="background:var(--orange); color:white; padding:1px 5px; border-radius:4px; font-size:9px; margin-left:5px; font-weight:800; display:inline-block;">UPDATED</span>` : '';

        const tr = document.createElement('tr');
        if (displayStatus === 'new' && isMyLead) tr.style.backgroundColor = '#f0fdf4';
        
        tr.innerHTML = `
            <td>
                <div class="clickable-name" onclick="handleLeadClick('${leadSafe}',${lead.id})">${lead.name}${updateTag}</div>
                <div class="user-sub">${new Date(lead.created_at).toLocaleDateString('en-AU', {year: 'numeric', month:'short', day:'numeric'})}</div>
            </td>
            <td style="vertical-align:middle; font-size:0.8rem; font-weight:600; color:#475569;">${refName}</td>
            <td style="vertical-align:top;">${financialHtml}</td>
            <td style="vertical-align:middle;">
                <select onchange="handleStatusChange(${lead.id}, this.value, '${lead.status}', ${lead.fee_paid})" class="installer-select" ${isLocked ? 'disabled style="background:#f1f5f9;"' : ''}>
                    ${optionsHtml}
                </select>
            </td>
            <td style="vertical-align:middle;">
                <div onclick="openTimelineModal('${lead.id}')" style="cursor:pointer;">${getSegmentedProgressHTML(displayStatus, true)}</div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // 渲染完成后更新统计 UI
    updateInstallerStatsUI(countTotal, countNew, countValid, countCancelled, countInstalled, countContacted, totalUnlockPaid, totalCommPaid);
}

// ==========================================
// 🔃 排序功能逻辑 (通用版 V2)
// ==========================================

// 全局排序状态
let currentSortState = { column: 'created_at', direction: 'desc' };

window.handleSort = function(column) {
    // 1. 切换排序方向
    if (currentSortState.column === column) {
        currentSortState.direction = currentSortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortState.column = column;
        currentSortState.direction = 'desc'; // 新列默认降序
    }

    // 2. 执行排序
    currentLeads.sort((a, b) => {
        let valA, valB;

        switch(column) {
            case 'created_at':
                valA = new Date(a.created_at).getTime();
                valB = new Date(b.created_at).getTime();
                break;
                
            case 'financials':
                valA = Number(a.commission_reward || 0);
                valB = Number(b.commission_reward || 0);
                break;
                
            case 'status':
                const statusOrder = ['new', 'contacted', 'site_visit', 'deposit', 'installed', 'cancelled', 'fraud', 'fraud_review'];
                valA = statusOrder.indexOf(a.status);
                valB = statusOrder.indexOf(b.status);
                break;

            case 'referrer': // Installer 视图专用：按 Referrer 名字
                valA = (cachedRefMap && cachedRefMap[a.referral_code] || '').toLowerCase();
                valB = (cachedRefMap && cachedRefMap[b.referral_code] || '').toLowerCase();
                break;

            case 'installer': // Partner 视图专用：按 Installer 名字
                // 从缓存列表里找名字
                const getInstName = (id) => {
                    if (!id) return 'zzzz'; // 未分配的排最后
                    const inst = cachedInstallersList.find(i => i.id === id);
                    return inst ? inst.company_name.toLowerCase() : 'zzzz';
                };
                valA = getInstName(a.assigned_partner_id);
                valB = getInstName(b.assigned_partner_id);
                break;
                
            default:
                valA = 0; valB = 0;
        }

        if (valA < valB) return currentSortState.direction === 'asc' ? -1 : 1;
        if (valA > valB) return currentSortState.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // 3. 更新图标 UI (根据当前角色决定更新哪一组 ID)
    const prefix = (currentProfile.role === 'referral') ? 'ref-' : 'inst-';
    updateSortIcons(column, currentSortState.direction, prefix);

    // 4. 根据角色重新渲染对应的表格
    if (currentProfile.role === 'referral') {
        renderReferrerTable(currentLeads, cachedInstallersList);
    } else {
        renderInstallerTable(currentLeads);
    }
};

// 辅助：更新图标样式 (带前缀支持)
function updateSortIcons(activeCol, direction, prefix) {
    // 所有的排序字段
    const cols = ['created_at', 'financials', 'status', 'referrer', 'installer', 'status2'];
    
    cols.forEach(col => {
        const el = document.getElementById(`${prefix}sort-icon-${col}`);
        if(el) {
            el.innerText = '⇅'; 
            el.style.color = '#cbd5e1'; // 灰色
        }
    });

    // 设置当前激活的图标
    const activeEl = document.getElementById(`${prefix}sort-icon-${activeCol}`);
    if(activeEl) {
        activeEl.innerText = direction === 'asc' ? '▲' : '▼';
        activeEl.style.color = 'var(--primary)'; // 激活色
    }
    
    // 特殊处理：Installer 视图有两个 Status 列
    if(activeCol === 'status' && prefix === 'inst-') {
         const el2 = document.getElementById('inst-sort-icon-status2');
         if(el2) {
             el2.innerText = direction === 'asc' ? '▲' : '▼';
             el2.style.color = 'var(--primary)';
         }
    }
}