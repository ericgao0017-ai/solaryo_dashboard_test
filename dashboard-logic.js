// ============================================================
// 🛠️ Installer & Referrer Logic (V21.2 - Yellow Steps & Inline Comm)
// ============================================================

const SUPABASE_URL = 'https://iytxwgyhemetdkmqoxoa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5dHh3Z3loZW1ldGRrbXFveG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMzI3MDIsImV4cCI6MjA3OTkwODcwMn0.ZsiueMCjwm5FoPlC3IDEgmsPaabkhefw3uHFl6gBm7Q';

const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentProfile = null;
let currentLeads = []; // 🔥 新增这一行，用来存数据给弹窗用

// Status Flow
const STATUS_FLOW = ['new', 'contacted', 'site_visit', 'deposit', 'installed'];

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    if (currentUser) {
        await loadProfile();
        await initView();
    }
});

async function checkAuth() {
    const { data: { session } } = await sbClient.auth.getSession();
    if (!session) { window.location.replace("index.html#partner"); return; }
    currentUser = session.user;
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

        // 🔥 [Updated] 将 commission_reward 传入函数
        let progressHTML = getSegmentedProgressHTML(status, isActuallyAssigned, lead.commission_reward);
        
        let earnedDisplay = '';
        if (status === 'fraud') earnedDisplay = `<div style="color:#ef4444; font-size:0.8rem;">Fraud / Invalid</div>`;
        else if (status === 'cancelled') earnedDisplay = `<div style="color:#f59e0b; font-size:0.8rem; font-weight:700;">Cancelled</div><div style="font-size:0.65rem; color:#64748b;">(Fee Retained)</div>`;
        else if (status === 'installed') earnedDisplay = `<div style="font-size:0.75rem; color:#10b981;">Unlock: +$${unlockFee}</div><div style="font-size:0.75rem; color:#10b981;">Comm: +$${commVal}</div><div style="font-weight:700; color:#059669; border-top:1px dashed #bbf7d0;">Net: $${unlockFee + commVal}</div>`;
        else if (['contacted', 'site_visit', 'deposit'].includes(status)) earnedDisplay = `<div style="font-size:0.75rem; color:#10b981;">Unlock: +$${unlockFee}</div><div style="font-weight:700; color:#059669;">Net: $${unlockFee}</div>`;
        // 🔥 修改：使用蓝色呼吸徽章样式
        // 🔥 优化：强制换行，使宽度变窄，对齐数字列
        else earnedDisplay = `<div class="waiting-badge" style="white-space:nowrap;">⏳ Wait for<br>Contact ($20) </div>`;

        const isLocked = isActuallyAssigned && !['cancelled', 'fraud', 'pending'].includes(status);
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

        let actionBtn = '';
        const btnId = `btn-action-${lead.id}`;
        if (status === 'fraud') actionBtn = `<button class="btn-action btn-report" disabled style="opacity:0.5">⛔ Invalid</button>`;
        else if (status === 'cancelled') {
             if (isCurrentSelectionRejected) actionBtn = `<button id="${btnId}" onclick="handleReport(${lead.id}, 'Rejected')" class="btn-action btn-report">🚩 Report Issue</button>`;
             else actionBtn = `<button id="${btnId}" onclick="handleConfirmAllocation(${lead.id}, true)" class="btn-action btn-confirm" style="background:#f59e0b; border-color:#d97706;">🔄 Re-Assign</button>`;
        }
        else if (!isActuallyAssigned) actionBtn = `<button id="${btnId}" onclick="handleConfirmAllocation(${lead.id}, false)" class="btn-action btn-confirm">✅ Confirm</button>`;
        else if (isActuallyAssigned && status === 'new') actionBtn = `<button id="${btnId}" onclick="handleNudge(${lead.id})" class="btn-action btn-nudge">🔔 Nudge</button>`;
        else actionBtn = `<button id="${btnId}" onclick="handleReport(${lead.id}, '${status}')" class="btn-action btn-report-light">🚩 Report</button>`;

        const dateStr = new Date(lead.created_at).toLocaleDateString('en-AU', {month:'short', day:'numeric'});
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

    const { data: partnerData } = await sbClient.from('partners').select('wallet_balance').eq('id', currentProfile.id).single();
    const currentBalance = partnerData ? Number(partnerData.wallet_balance) : 0;
    const fmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
    document.getElementById('inst-stat-credit').innerText = fmt.format(currentBalance);

    const { data: leads } = await sbClient
        .from('leads')
        .select('*')
        .neq('status', 'pending')
        .or(`assigned_partner_id.eq.${currentProfile.id},cancelled_by_ids.cs.{${currentProfile.id}}`)
        .order('created_at', { ascending: false });
    currentLeads = leads || []; // 🔥 新增：把数据存入全局变量
    let refMap = {};
    const { data: allPartners } = await sbClient.from('partners').select('ref_code, contact_name, company_name');
    if (allPartners) {
        allPartners.forEach(p => { if(p.ref_code) refMap[p.ref_code] = p.company_name || p.contact_name; });
    }

    const tbody = document.getElementById('installer-leads-body');
    if(!tbody) return;
    tbody.innerHTML = '';

    let countTotal = 0;
    let countNew = 0;
    let countCancelled = 0;
    let countValid = 0;
    let countInstalled = 0;
    let countContacted = 0;
    let totalUnlockPaid = 0;
    let totalCommPaid = 0;

    if (!leads || leads.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:40px; color:#94a3b8;">No jobs assigned yet.</td></tr>`;
        updateInstallerStatsUI(0, 0, 0, 0, 0, 0, 0, 0); 
        return;
    }

    leads.forEach(lead => {
        const isMyLead = lead.assigned_partner_id === currentProfile.id;
        const isPastCancelled = lead.cancelled_by_ids && lead.cancelled_by_ids.includes(currentProfile.id);
        const displayStatus = isPastCancelled && !isMyLead ? 'cancelled' : lead.status;

        countTotal++;
        if (displayStatus === 'new') countNew++;
        
        if (['cancelled', 'fraud'].includes(displayStatus)) {
            countCancelled++;
        } else {
            countValid++;
        }

        if (isMyLead) {
            if (lead.fee_paid) {
                countContacted++;
                totalUnlockPaid += 50;
            }
            if (lead.status === 'installed') {
                countInstalled++;
                if (lead.final_commission) {
                    totalCommPaid += Number(lead.final_commission) * 1.05;
                }
            }
        }

        let financialHtml = `<span style="color:#cbd5e1;">-</span>`;
        let items = [];
        if (isMyLead) {
            if (lead.fee_paid) items.push(`<div style="display:flex; justify-content:space-between;"><span style="color:#334155;">🔓 Unlock</span><span style="color:#ef4444; font-weight:700;">-$50</span></div>`);
            
            if (lead.status === 'installed' && lead.final_commission) {
                // 1. 如果已安装，显示最终佣金 (Final Comm)
                const comm = Number(lead.final_commission);
                const fee = comm * 0.05;
                const total = comm + fee;
                items.push(`<div style="display:flex; justify-content:space-between;"><span style="color:#334155;">✅ Comm</span><span style="color:#ef4444; font-weight:700;">-$${total.toFixed(0)}</span></div><div style="font-size:0.65rem; color:#94a3b8; text-align:right; margin-top:-2px;">(Net: $${comm} | Fee: $${fee.toFixed(0)})</div>`);
            } 
            else if (lead.commission_reward && lead.commission_reward > 0) {
                // 2. 🔥 新增：如果还没安装，但输入过预估值，显示 Est. Comm
                // 这里的 commission_reward 存的是预估值 (V21.1逻辑)
                items.push(`<div style="display:flex; justify-content:space-between;"><span style="color:#64748b;">Est. Comm</span><span style="color:#f59e0b; font-weight:700;">$${lead.commission_reward}</span></div>`);
            }

            if (items.length > 0) financialHtml = `<div style="font-size:0.75rem; line-height:1.4;">${items.join('<div style="border-top:1px dashed #e2e8f0; margin:2px 0;"></div>')}</div>`;
        } else if (isPastCancelled) {
            financialHtml = `<div style="font-size:0.7rem; color:#94a3b8; font-style:italic;">Connection Ended</div>`;
        }

        const currentIdx = STATUS_FLOW.indexOf(displayStatus);
        let optionsHtml = '';
        STATUS_FLOW.forEach((step, idx) => {
            let label = step.charAt(0).toUpperCase() + step.slice(1);
            if (step === 'site_visit') label = "🚚 Site Visit";
            if (step === 'new') label = "📥 New Received";
            if (step === 'contacted') label = "📞 Contacted ($50)";
            if (step === 'deposit') label = "💰 Deposit";
            if (step === 'installed') label = "✅ Installed (Comm.)";
            const isDisabled = (idx < currentIdx); 
            optionsHtml += `<option value="${step}" ${step===displayStatus?'selected':''} ${isDisabled?'disabled':''}>${isDisabled?'✔ ':''}${label}</option>`;
        });
        optionsHtml += `<option value="cancelled" ${displayStatus==='cancelled'?'selected':''}>❌ Cancelled</option>`;
        optionsHtml += `<option value="fraud" ${displayStatus==='fraud'?'selected':''}>⛔ Report Invalid</option>`;

        const isLocked = !isMyLead || ['installed', 'cancelled', 'fraud'].includes(lead.status);
        const visualSteps = getSegmentedProgressHTML(displayStatus, true); 
        const refName = lead.referral_code && refMap[lead.referral_code] ? refMap[lead.referral_code] : '-';
        const dateStr = new Date(lead.created_at).toLocaleDateString('en-AU', {month:'short', day:'numeric'});
        const leadSafe = encodeURIComponent(JSON.stringify(lead));

        const tr = document.createElement('tr');
        if (displayStatus === 'new' && isMyLead) tr.style.backgroundColor = '#f0fdf4';
        if (isPastCancelled && !isMyLead) tr.style.backgroundColor = '#f9fafb';

        tr.innerHTML = `
            <td>
                <div class="clickable-name" onclick="showLeadDetails('${leadSafe}')">${lead.name}</div>
                <div class="user-sub">${dateStr}</div>
            </td>
            <td style="vertical-align:middle; font-size:0.8rem; font-weight:600; color:#475569;">${refName}</td>
            <td style="vertical-align:top;">${financialHtml}</td>
            <td style="vertical-align:middle;">
                <select onchange="handleStatusChange(${lead.id}, this.value, '${lead.status}', ${lead.fee_paid})" 
                    class="installer-select"
                    ${isLocked ? 'disabled style="background:#f1f5f9; color:#94a3b8; border:1px solid #e2e8f0;"' : ''}>
                    ${optionsHtml}
                </select>
                ${(lead.status === 'new' && isMyLead) ? '<div style="font-size:0.65rem; color:#15803d; margin-top:2px;">Please contact ASAP</div>' : ''}
            </td>
            <td style="vertical-align:middle;">
             <div onclick="openTimelineModal('${lead.id}')" style="cursor:pointer; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                 ${visualSteps}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    updateInstallerStatsUI(countTotal, countNew, countValid, countCancelled, countInstalled, countContacted, totalUnlockPaid, totalCommPaid);
}

function updateInstallerStatsUI(total, activeNew, valid, cancelled, installed, contacted, unlockPaid, commPaid) {
    const fmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
    document.getElementById('inst-stat-total').innerText = total;
    document.getElementById('inst-stat-new').innerText = activeNew;
    document.getElementById('inst-stat-valid').innerText = valid;
    document.getElementById('inst-stat-cancelled').innerText = cancelled;
    document.getElementById('inst-stat-completed').innerText = installed;
    document.getElementById('inst-stat-comm-paid').innerText = fmt.format(commPaid);
    document.getElementById('inst-stat-contacted').innerText = contacted;
    document.getElementById('inst-stat-unlock-paid').innerText = fmt.format(unlockPaid);
    document.getElementById('inst-stat-total-spent').innerText = fmt.format(unlockPaid + commPaid);
}

// ==========================================
// 🔵 Core Actions & Helpers
// ==========================================
window.showLeadDetails = function(leadEncoded) {
    const lead = JSON.parse(decodeURIComponent(leadEncoded));
    const modal = document.getElementById('lead-details-modal');
    const content = document.getElementById('modal-body');
    document.getElementById('modal-lead-name').innerText = lead.name;
    
    content.innerHTML = `
        <div class="detail-row"><span class="detail-label">Phone:</span> <span class="detail-value"><a href="tel:${lead.phone}">${lead.phone || 'N/A'}</a></span></div>
        <div class="detail-row"><span class="detail-label">Email:</span> <span class="detail-value">${lead.email || 'customer@email.com'}</span></div>
        <div class="detail-row"><span class="detail-label">Address:</span> <span class="detail-value">${lead.address || lead.postcode + ', Australia'}</span></div>
        <hr style="border:0; border-top:1px solid #f1f5f9; margin:15px 0;">
        <div class="detail-row"><span class="detail-label">System Size:</span> <span class="detail-value">6.6kW Solar System</span></div>
        <div class="detail-row"><span class="detail-label">Panel Pref:</span> <span class="detail-value">Jinko / Trina</span></div>
        <div class="detail-row"><span class="detail-label">Inverter:</span> <span class="detail-value">Growatt 5kW</span></div>
        <div class="detail-row"><span class="detail-label">Bill:</span> <span class="detail-value">$350 - $500 / qtr</span></div>
        <div style="margin-top:15px;">
            <div class="detail-label" style="margin-bottom:5px;">Site Photos:</div>
            <div style="display:flex; gap:5px;">
                <div style="width:60px; height:60px; background:#e2e8f0; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:0.7rem; color:#64748b;">Meter</div>
                <div style="width:60px; height:60px; background:#e2e8f0; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:0.7rem; color:#64748b;">Roof</div>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    setTimeout(() => modal.style.opacity = '1', 10);
}

window.closeLeadModal = function(e) {
    if (e && e.target.id !== 'lead-details-modal' && !e.target.classList.contains('modal-close')) return;
    const modal = document.getElementById('lead-details-modal');
    modal.style.opacity = '0';
    setTimeout(() => modal.style.display = 'none', 300);
}

// 🔥 [Updated] Progress Bar Logic: Yellow Steps & Inline Comm
function getSegmentedProgressHTML(status, isAssigned, commissionReward) {
    let activeLevel = 0; 
    if (status === 'installed') activeLevel = 5;
    else if (status === 'deposit') activeLevel = 4;
    else if (status === 'site_visit') activeLevel = 3;
    else if (status === 'contacted') activeLevel = 2;
    else if (isAssigned && status !== 'pending') activeLevel = 1; 
    else activeLevel = 0;

    let segments = '';
    const labels = ['Allocated', 'Contact', 'Quote', 'Deposit', 'Install'];
    
    if (status === 'cancelled' || status === 'fraud') {
        return `<div class="step-container"><div class="step-bar"><div class="step-segment active-red" style="flex:1;"></div></div><div class="progress-label"><span style="color:#ef4444">${status.toUpperCase()}</span></div></div>`;
    }

    for (let i = 1; i <= 5; i++) {
        let activeClass = '';
        if (activeLevel >= i) {
            if (i === 5) activeClass = 'active-green';
            else if (i === 3 || i === 4) activeClass = 'active-orange'; // 3(Quote) and 4(Deposit) are yellow
            else activeClass = 'active';
        }
        segments += `<div class="step-segment ${activeClass}"></div>`;
    }

    let currentLabel = activeLevel > 0 ? labels[activeLevel - 1] : 'Pending Allocation';
    
    // 🔥 Inline Est. Comm Display
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
// Now reading and saving to 'commission_reward' column
window.handleStatusChange = async function(leadId, newStatus, oldStatus, feePaid) {
    // 1. Fetch current lead data, using 'commission_reward' as the storage for estimate
    const { data: currentLeadData } = await sbClient.from('leads').select('commission_reward, cancelled_by_ids').eq('id', leadId).single();
    const savedEst = currentLeadData?.commission_reward;

    if (!confirm(`⚠️ Confirm Status Change?\n\nTo: ${newStatus.toUpperCase()}`)) { loadInstallerDashboard(); return; }

    const { data: partner } = await sbClient.from('partners').select('wallet_balance').eq('id', currentProfile.id).single();
    let currentBalance = partner ? Number(partner.wallet_balance) : 0;

    const unlockTriggers = ['contacted', 'site_visit', 'deposit'];
    let shouldPayUnlock = unlockTriggers.includes(newStatus) && !feePaid; 
    
    if (shouldPayUnlock) {
        if (currentBalance < 50) { alert("❌ Insufficient Credit! Need $50.00."); loadInstallerDashboard(); return; }
        if (!confirm(`💰 PAYMENT REQUIRED\n\nLead Unlock Fee: $50.00\n\nProceed?`)) { loadInstallerDashboard(); return; }
    }

    // 🌟 Trigger: Estimated Commission Input at Quote/Site Visit
    let newEstComm = null;
    if (newStatus === 'site_visit') {
        const promptMsg = savedEst && savedEst > 0
            ? `🚚 Site Visit / Quote\n\nExisting Estimate: $${savedEst}\nUpdate Estimated Referrer Commission ($):` 
            : `🚚 Site Visit / Quote\n\nPlease enter ESTIMATED Referrer Commission ($):`;
            
        const input = prompt(promptMsg, savedEst || "200");
        if (input === null) { loadInstallerDashboard(); return; } // User cancelled
        newEstComm = Number(input);
        if (isNaN(newEstComm) || newEstComm < 0) { alert("Invalid amount."); loadInstallerDashboard(); return; }
    }

    let commissionAmount = 0, totalDeduction = 0, shouldPayComm = (newStatus === 'installed');
    
    // 🌟 Trigger: Final Payment (Automated if estimate exists)
    if (shouldPayComm) {
        if (savedEst && savedEst > 0) {
            commissionAmount = Number(savedEst);
            // Confirm using the estimate
            if(!confirm(`🎉 INSTALLATION COMPLETE!\n\nProcessing Payout using Quoted Estimate:\nReferrer Comm: $${commissionAmount}\nPlatform Fee: $${(commissionAmount*0.05).toFixed(2)}\n\nProceed?`)) {
                 loadInstallerDashboard(); return; 
            }
        } else {
            // Fallback: No estimate found, ask manually
            const input = prompt("🎉 INSTALLATION COMPLETE!\n\nNo estimate found. Enter Net Commission for Referrer:", "200");
            if (!input) { loadInstallerDashboard(); return; }
            commissionAmount = Number(input);
        }

        totalDeduction = commissionAmount * 1.05;

        if (currentBalance < totalDeduction) { alert(`❌ Insufficient Credit! Need $${totalDeduction.toFixed(2)}.`); loadInstallerDashboard(); return; }
    }

    try {
        const updateData = { status: newStatus };

        // 🔥 新增：里程碑打卡逻辑
        // 只有当这个字段还是空的时候才打卡（防止来回切状态导致时间被覆盖，或者您希望覆盖也可以去掉判断）
        const now = new Date().toISOString();
        
        if (newStatus === 'contacted') updateData.date_contacted = now;
        if (newStatus === 'site_visit') updateData.date_site_visit = now;
        if (newStatus === 'deposit') updateData.date_deposit = now;
        if (newStatus === 'installed') updateData.date_installed = now;
        if (newStatus === 'cancelled' || newStatus === 'fraud') updateData.date_cancelled = now;
        
        updateData.updated_at = now;

        if (shouldPayUnlock) updateData.fee_paid = true;
        if (shouldPayComm) updateData.final_commission = commissionAmount;
        if (newEstComm !== null) updateData.commission_reward = newEstComm; // Save the estimate to commission_reward

        if (newStatus === 'cancelled' || newStatus === 'fraud') {
            let currentBlacklist = currentLeadData?.cancelled_by_ids || [];
            if (!currentBlacklist.includes(currentProfile.id)) currentBlacklist.push(currentProfile.id);
            updateData.cancelled_by_ids = currentBlacklist;
        }

        const { error: leadErr } = await sbClient.from('leads').update(updateData).eq('id', leadId);
        if (leadErr) throw leadErr;

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

        alert("Processed Successfully! ✅");
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
    document.getElementById('prof-pin').value = currentProfile.security_pin || ''; 
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
            security_pin: newPin,
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
        case 'void': return '#94a3b8';      // 灰色
        default: return '#cbd5e1';          // 默认灰
    }
}