// ============================================================
// 🛠️ Installer & Referrer Logic (V20.0 - UI Polished)
// ============================================================

const SUPABASE_URL = 'https://iytxwgyhemetdkmqoxoa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5dHh3Z3loZW1ldGRrbXFveG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMzI3MDIsImV4cCI6MjA3OTkwODcwMn0.ZsiueMCjwm5FoPlC3IDEgmsPaabkhefw3uHFl6gBm7Q';

const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentProfile = null;

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

    // Get Installers for dropdown
    const { data: allInstallers } = await sbClient.from('partners').select('id, company_name').eq('role', 'solar_pro').order('company_name');
    renderDefaultInstallerBox(allInstallers);

    // Get Leads
    const { data: leads } = await sbClient.from('leads').select('*').eq('referral_code', myCode).order('created_at', { ascending: false });
    
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

        let progressHTML = getSegmentedProgressHTML(status, isActuallyAssigned);

        let earnedDisplay = '';
        if (status === 'fraud') earnedDisplay = `<div style="color:#ef4444; font-size:0.8rem;">Fraud / Invalid</div>`;
        else if (status === 'cancelled') earnedDisplay = `<div style="color:#f59e0b; font-size:0.8rem; font-weight:700;">Cancelled</div><div style="font-size:0.65rem; color:#64748b;">(Fee Retained)</div>`;
        else if (status === 'installed') earnedDisplay = `<div style="font-size:0.75rem; color:#10b981;">Unlock: +$${unlockFee}</div><div style="font-size:0.75rem; color:#10b981;">Comm: +$${commVal}</div><div style="font-weight:700; color:#059669; border-top:1px dashed #bbf7d0;">Net: $${unlockFee + commVal}</div>`;
        else if (['contacted', 'site_visit', 'deposit'].includes(status)) earnedDisplay = `<div style="font-size:0.75rem; color:#10b981;">Unlock: +$${unlockFee}</div><div style="font-weight:700; color:#059669;">Net: $${unlockFee}</div>`;
        else earnedDisplay = `<div style="color:#10b981; font-weight:700; font-size:0.8rem; line-height:1.2;">Wait to contact<br>to earn $20</div>`;

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
            <td style="vertical-align: middle;">${progressHTML}</td>
            <td style="vertical-align: middle;">${earnedDisplay}</td>
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
    
    // 🟢 [Fix] Updated ID target for new UI
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
                const comm = Number(lead.final_commission);
                const fee = comm * 0.05;
                const total = comm + fee;
                items.push(`<div style="display:flex; justify-content:space-between;"><span style="color:#334155;">✅ Comm</span><span style="color:#ef4444; font-weight:700;">-$${total.toFixed(0)}</span></div><div style="font-size:0.65rem; color:#94a3b8; text-align:right; margin-top:-2px;">(Net: $${comm} | Fee: $${fee.toFixed(0)})</div>`);
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
            <td style="vertical-align:middle;">${visualSteps}</td>
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

function getSegmentedProgressHTML(status, isAssigned) {
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
        if (activeLevel >= i) activeClass = (i === 5) ? 'active-green' : 'active';
        segments += `<div class="step-segment ${activeClass}"></div>`;
    }

    const currentLabel = activeLevel > 0 ? labels[activeLevel - 1] : 'Pending Allocation';
    return `<div class="step-container"><div class="step-bar">${segments}</div><div class="progress-label"><span>${currentLabel}</span><span>Step ${activeLevel}/5</span></div></div>`;
}

window.handleStatusChange = async function(leadId, newStatus, oldStatus, feePaid) {
    if (!confirm(`⚠️ Confirm Status Change?\n\nTo: ${newStatus.toUpperCase()}`)) { loadInstallerDashboard(); return; }

    const { data: partner } = await sbClient.from('partners').select('wallet_balance').eq('id', currentProfile.id).single();
    let currentBalance = partner ? Number(partner.wallet_balance) : 0;

    const unlockTriggers = ['contacted', 'site_visit', 'deposit'];
    let shouldPayUnlock = unlockTriggers.includes(newStatus) && !feePaid; 
    
    if (shouldPayUnlock) {
        if (currentBalance < 50) { alert("❌ Insufficient Credit! Need $50.00."); loadInstallerDashboard(); return; }
        if (!confirm(`💰 PAYMENT REQUIRED\n\nLead Unlock Fee: $50.00\n\nProceed?`)) { loadInstallerDashboard(); return; }
    }

    let commissionAmount = 0, totalDeduction = 0, shouldPayComm = (newStatus === 'installed');
    if (shouldPayComm) {
        const input = prompt("🎉 INSTALLATION COMPLETE!\n\nEnter Net Commission for Referrer:", "200");
        if (!input) { loadInstallerDashboard(); return; }
        commissionAmount = Number(input);
        totalDeduction = commissionAmount * 1.05;

        if (currentBalance < totalDeduction) { alert(`❌ Insufficient Credit! Need $${totalDeduction.toFixed(2)}.`); loadInstallerDashboard(); return; }
        if (!confirm(`💰 CONFIRM PAYOUT\n\nReferrer: $${commissionAmount}\nPlatform: $${(commissionAmount*0.05).toFixed(2)}\nTotal: $${totalDeduction.toFixed(2)}`)) { loadInstallerDashboard(); return; }
    }

    try {
        const updateData = { status: newStatus };
        if (shouldPayUnlock) updateData.fee_paid = true;
        if (shouldPayComm) updateData.final_commission = commissionAmount;

        if (newStatus === 'cancelled' || newStatus === 'fraud') {
            const { data: currentLeadData } = await sbClient.from('leads').select('cancelled_by_ids').eq('id', leadId).single();
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
window.handleNudge = function(leadId) {
    const btn = event.target;
    btn.innerText = "Sending...";
    setTimeout(() => { alert("Nudge sent!"); btn.innerText = "Nudged ✅"; }, 800);
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