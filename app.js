const firebaseConfig = {
   apiKey: "AIzaSyCzMSEp324rtnTwtRLPq9hGxgdDsv4pS3c",
    authDomain: "locker-manage.firebaseapp.com",
    projectId: "locker-manage",
    storageBucket: "locker-manage.firebasestorage.app",
    messagingSenderId: "812684053866",
    appId: "1:812684053866:web:be21dc3859b3593d946913"
};
window.firebaseConfig = firebaseConfig;

const isConfigured = true;

let app, auth, db;
try {
    if (isConfigured) {
        app = firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
    }
} catch (err) {
    alert("FATAL ERROR during initialization: " + err.message);
}

// Global State
window.currentUser = null;
window.currentUserData = null;
window.db = db;
window.auth = auth;

// UI Utilities
window.showLoader = () => document.getElementById('loader').classList.remove('hidden');
window.hideLoader = () => document.getElementById('loader').classList.add('hidden');

window.logAuditEvent = async (action, type, details) => {
    try {
        await window.db.collection("audit_logs").add({
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            uid: window.currentUser ? window.currentUser.uid : 'system',
            user_name: window.currentUserData ? window.currentUserData.name : (window.currentUser ? window.currentUser.email : 'System'),
            user_role: window.currentUserData ? window.currentUserData.role : 'N/A',
            action: action,
            type: type, // login, logout, declaration, deletion, admin, security
            details: details,
            branch_id: (window.currentUserData && window.currentUserData.branch_id) ? window.currentUserData.branch_id : null
        });
    } catch (err) {
        console.error("Audit log error:", err);
    }
};

window.showToast = (message, type = 'info') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// Routing & View Management
const switchView = (targetId) => {
    document.querySelectorAll('.view-section').forEach(section => section.classList.add('hidden'));
    document.getElementById(targetId).classList.remove('hidden');

    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    document.querySelector(`[data-target="${targetId}"]`).classList.add('active');
};

window.updateReportHeader = (sectionId, summaryText) => {
    const section = document.getElementById(sectionId);
    if (!section) return;

    const summaryEl = section.querySelector('.report-summary');
    const generatedEl = section.querySelector('.report-generated');

    if (summaryEl) {
        summaryEl.textContent = summaryText || '';
    }

    if (generatedEl) {
        generatedEl.textContent = new Date().toLocaleString();
    }
};

function escapeExportHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

window.downloadReportExcel = (sectionId, fileNameBase = 'report') => {
    const section = document.getElementById(sectionId);
    const table = section?.querySelector('table');

    if (!table) {
        window.showToast('No report table available to export.', 'error');
        return;
    }

    const reportTitle = section.querySelector('.report-print-header h1')?.textContent || 'Report';
    const reportSummary = section.querySelector('.report-summary')?.textContent || '';
    const generatedAt = new Date().toLocaleString();
    const safeFileName = String(fileNameBase || 'report')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'report';

    const clonedTable = table.cloneNode(true);
    clonedTable.querySelectorAll('i').forEach(icon => icon.remove());

    const excelHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
    <meta charset="UTF-8">
    <meta name="ProgId" content="Excel.Sheet">
    <meta name="Generator" content="Gold Vault">
    <style>
        body { font-family: Arial, sans-serif; padding: 16px; color: #111111; }
        h1 { font-size: 22px; margin: 0 0 6px; }
        p { margin: 0 0 6px; color: #444444; }
        table { border-collapse: collapse; width: 100%; margin-top: 16px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
        th { background: #f8fafc; font-weight: 700; }
    </style>
</head>
<body>
    <h1>${escapeExportHtml(reportTitle)}</h1>
    <p>${escapeExportHtml(reportSummary)}</p>
    <p>Generated On: ${escapeExportHtml(generatedAt)}</p>
    ${clonedTable.outerHTML}
</body>
</html>`;

    const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${safeFileName}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

window.printReport = (sectionId) => {
    window.updateReportHeader(
        sectionId,
        document.querySelector(`#${sectionId} .report-summary`)?.textContent || ''
    );
    document.body.setAttribute('data-print-section', sectionId);
    window.print();
};

window.addEventListener('afterprint', () => {
    document.body.removeAttribute('data-print-section');
});

document.querySelectorAll('.nav-item').forEach(nav => {
    nav.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(nav.dataset.target);
    });
});

document.querySelectorAll('.nav-dropdown-toggle').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
        e.preventDefault();
        const menu = toggle.nextElementSibling;
        const icon = toggle.querySelector('.fa-chevron-down');
        if (icon) icon.style.transition = 'transform 0.3s ease';

        if (menu.classList.contains('hidden')) {
            menu.classList.remove('hidden');
            if (icon) icon.style.transform = 'rotate(180deg)';
        } else {
            menu.classList.add('hidden');
            if (icon) icon.style.transform = 'rotate(0deg)';
        }
    });
});

// Authentication Flow
const loginForm = document.getElementById('login-form');
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isConfigured) return;

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    window.showLoader();
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        window.hideLoader();
        window.showToast(error.message, "error");
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    if (auth) auth.signOut();
});

if (isConfigured) {
    auth.onAuthStateChanged(async (user) => {
        window.showLoader();
        if (user) {
            window.currentUser = user;
            try {
                const userDoc = await db.collection("users").doc(user.uid).get();
                if (userDoc.exists) {
                    window.currentUserData = userDoc.data();

                    if (window.currentUserData.is_resigned) {
                        window.showToast("Your access has been revoked due to resignation.", "error");
                        auth.signOut();
                        return;
                    }

                    if (window.currentUserData.role !== 'admin' && window.currentUserData.role !== 'hr' && window.currentUserData.role !== 'ho') {
                        const contexts = [];

                        // 1. Check if user SENT a key TEMPORARILY (Access Suspended)
                        let suspended = false;
                        try {
                            const sentKeysSnap = await db.collection('key_transfers')
                                .where('sender_id', '==', user.uid)
                                .where('status', '==', 'accepted')
                                .where('transfer_type', '==', 'temporary')
                                .get();

                            if (!sentKeysSnap.empty) {
                                suspended = true;
                                window.currentUserData.sent_key_to = sentKeysSnap.docs[0].data().receiver_name;
                            }
                        } catch (err) { console.error("Error fetching sent keys:", err); }

                        // 2. Add original context if not suspended
                        const originalBranchId = window.currentUserData.branch_id ? String(window.currentUserData.branch_id) : null;
                        if (!suspended && originalBranchId) {
                            try {
                                const branchDoc = await db.collection('branches').doc(originalBranchId).get();
                                contexts.push({
                                    branch_id: originalBranchId,
                                    branch_name: branchDoc.exists ? (branchDoc.data().name || "My Branch") : "My Branch",
                                    roles: [window.currentUserData.role || 'user'],
                                    type: 'original'
                                });
                            } catch (err) { console.error("Error fetching original branch:", err); }
                        }

                        // 3. Fetch all RECEIVED keys (Transferred contexts)
                        try {
                            const activeKeysSnap = await db.collection('key_transfers')
                                .where('receiver_id', '==', user.uid)
                                .where('status', '==', 'accepted')
                                .get();

                            for (const docSnap of activeKeysSnap.docs) {
                                const keyData = docSnap.data();
                                const bId = keyData.branch_id ? String(keyData.branch_id) : null;
                                if (!bId) continue;

                                const branchDoc = await db.collection('branches').doc(bId).get();
                                const bName = branchDoc.exists ? (branchDoc.data().name || bId) : bId;

                                const senderDoc = await db.collection('users').doc(keyData.sender_id).get();
                                const sRole = senderDoc.exists ? senderDoc.data().role : 'user';

                                let existing = contexts.find(c => c.branch_id === bId);
                                if (existing) {
                                    if (!existing.roles.includes(sRole)) existing.roles.push(sRole);
                                } else {
                                    contexts.push({
                                        branch_id: bId,
                                        branch_name: bName,
                                        roles: [sRole],
                                        type: 'transferred'
                                    });
                                }
                            }
                        } catch (err) { console.error("Error fetching received keys:", err); }

                        window.currentUserData.available_contexts = contexts;

                        // Set default context if none selected
                        if (!window.activeContextId || !contexts.find(c => c.branch_id === window.activeContextId)) {
                            window.activeContextId = contexts.length > 0 ? contexts[0].branch_id : originalBranchId;
                        }

                        const activeContext = contexts.find(c => c.branch_id === window.activeContextId);
                        if (activeContext) {
                            window.currentUserData.branch_id = activeContext.branch_id;
                            window.currentUserData.active_roles = activeContext.roles;
                        } else {
                            window.currentUserData.active_roles = ['user'];
                        }
                    }

                    setupDashboard(window.currentUserData);
                    window.logAuditEvent("User Login", "login", `Logged in to role: ${window.currentUserData.role}`);
                } else {
                    const allUsers = await db.collection("users").get();
                    if (allUsers.empty) {
                        const newAdminData = {
                            email: user.email,
                            role: 'admin',
                            name: 'Administrator',
                            created_at: firebase.firestore.FieldValue.serverTimestamp()
                        };
                        await db.collection("users").doc(user.uid).set(newAdminData);
                        window.currentUserData = newAdminData;
                        window.currentUserData.active_roles = ['admin'];
                        setupDashboard(window.currentUserData);
                        window.logAuditEvent("Initial Admin Setup", "admin", "First account auto-created as Admin");
                        window.showToast("First account automatically set as Admin.", "success");
                    } else {
                        window.showToast("User record not found in database. Contact your Admin.", "error");
                        auth.signOut();
                    }
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
                alert("Database Error: " + error.message + "\n\nDid you enable Firestore Database in the console?");
                window.showToast("Failed to fetch user data.", "error");
                auth.signOut();
            }
        } else {
            if (window.currentUser) {
                window.logAuditEvent("User Logout", "logout", "Session ended");
            }
            window.currentUser = null;
            window.currentUserData = null;
            showLogin();
        }
        window.hideLoader();
    });
}

function showLogin() {
    document.getElementById('login-section').classList.add('active');
    document.getElementById('main-app').classList.add('hidden');
    document.getElementById('nav-admin').classList.add('hidden');
    document.getElementById('nav-user1').classList.add('hidden');
    document.getElementById('nav-user2').classList.add('hidden');
    document.getElementById('nav-reserve').classList.add('hidden');
}

window.switchContext = async (branchId) => {
    window.showLoader();
    window.activeContextId = branchId;

    const context = window.currentUserData.available_contexts.find(c => c.branch_id === branchId);
    if (context) {
        window.currentUserData.branch_id = context.branch_id;
        window.currentUserData.active_roles = context.roles;
    }

    // Reset navigation visibility before re-setup
    document.getElementById('nav-admin').classList.add('hidden');
    document.getElementById('nav-user1').classList.add('hidden');
    document.getElementById('nav-user2').classList.add('hidden');
    document.getElementById('nav-reserve').classList.add('hidden');

    setupDashboard(window.currentUserData);
    window.hideLoader();
};

function setupDashboard(userData) {
    document.getElementById('login-section').classList.remove('active');
    document.getElementById('main-app').classList.remove('hidden');

    document.getElementById('user-display-name').textContent = userData.name || "User";

    // Branch Switcher Logic
    const switcher = document.getElementById('branch-switcher-container');
    const select = document.getElementById('branch-context-select');
    if (userData.available_contexts && userData.available_contexts.length > 1) {
        if (switcher) switcher.classList.remove('hidden');
        if (select) {
            select.innerHTML = '';
            userData.available_contexts.forEach(ctx => {
                const opt = document.createElement('option');
                opt.value = ctx.branch_id;
                opt.textContent = ctx.branch_name + (ctx.type === 'transferred' ? ' (Transferred)' : '');
                if (ctx.branch_id === window.activeContextId) opt.selected = true;
                select.appendChild(opt);
            });

            if (!select.dataset.listenerAdded) {
                select.addEventListener('change', (e) => {
                    const newBranchId = e.target.value;
                    if (newBranchId !== window.activeContextId) {
                        window.switchContext(newBranchId);
                    }
                });
                select.dataset.listenerAdded = "true";
            }
        }
    } else {
        if (switcher) switcher.classList.add('hidden');
    }

    let activeRoles = userData.active_roles || [userData.role];
    if (activeRoles.includes('user') && (activeRoles.includes('user1') || activeRoles.includes('user2') || activeRoles.includes('user1and1'))) {
        activeRoles = activeRoles.filter(r => r !== 'user');
    }

    let roleDisplay = "Reserve User";
    const isActingReserve = userData.role === 'user' && (activeRoles.includes('user1') || activeRoles.includes('user2') || activeRoles.includes('user1and1'));
    if (activeRoles.includes('admin') || activeRoles.includes('hr') || activeRoles.includes('ho')) {
        if (activeRoles.includes('admin')) roleDisplay = "Administrator";
        else if (activeRoles.includes('hr')) roleDisplay = "HR (Human Resources)";
        else roleDisplay = "HO (Head Office)";
    } else {
        const parts = [];
        if (activeRoles.includes('user1') || activeRoles.includes('user1and1')) parts.push("Entry (Maker)");
        if (activeRoles.includes('user2')) parts.push("Verifier (Checker)");
        if (parts.length > 0) {
            roleDisplay = parts.join(" & ");
            if (isActingReserve) {
                roleDisplay += " (Acting)";
            }
        }
    }

    document.getElementById('user-display-role').textContent = roleDisplay;

    if (activeRoles.includes('admin') || activeRoles.includes('hr') || activeRoles.includes('ho')) {
        const navAdmin = document.getElementById('nav-admin');
        navAdmin.classList.remove('hidden');
        const allItems = navAdmin.querySelectorAll('.nav-item');
        if (activeRoles.includes('ho') && !activeRoles.includes('admin')) {
            const allowedForHo = ['admin-reports', 'admin-backdate-approval', 'admin-key-holdings'];
            allItems.forEach(item => {
                if (allowedForHo.includes(item.dataset.target)) item.style.display = 'block';
                else item.style.display = 'none';
            });
            switchView('admin-reports');
        } else {
            allItems.forEach(item => { item.style.display = 'block'; });
            switchView('admin-overview');
        }
        document.dispatchEvent(new Event('initAdmin'));
    } else {
        let defaultView = 'reserve-overview';

        if (activeRoles.includes('user1') || activeRoles.includes('user1and1')) {
            document.getElementById('nav-user1').classList.remove('hidden');
            document.dispatchEvent(new Event('initUser1'));
            defaultView = 'user1-entry';
        }

        if (activeRoles.includes('user2')) {
            document.getElementById('nav-user2').classList.remove('hidden');
            document.dispatchEvent(new Event('initUser2'));
            if (!activeRoles.includes('user1') && !activeRoles.includes('user1and1')) {
                defaultView = 'user2-verify';
            }
        }

        // Only show Reserve nav if the user has no active transferred roles
        if (activeRoles.includes('user') && !activeRoles.includes('user1') && !activeRoles.includes('user2') && !activeRoles.includes('user1and1')) {
            document.getElementById('nav-reserve').classList.remove('hidden');
            const reserveHeader = document.querySelector('#reserve-overview h2');
            const reserveMsg = document.querySelector('#reserve-overview header p');
            if (userData.sent_key_to) {
                if (reserveHeader) reserveHeader.textContent = "Access Suspended";
                if (reserveMsg) reserveMsg.innerHTML = `<span class="text-danger"><i class="fa-solid fa-lock"></i> Your key is currently transferred to <strong>${escapeHtml(userData.sent_key_to)}</strong>. You cannot perform your duties until the key is returned.</span>`;
            } else {
                if (reserveHeader) reserveHeader.textContent = "Reserve Dashboard";
                if (reserveMsg) reserveMsg.innerHTML = `You do not have any assigned duties. You can gain temporary access if a key is transferred to you.`;
            }
        }

        if (activeRoles.includes('user1') || activeRoles.includes('user2') || activeRoles.includes('user1and1')) {
            document.dispatchEvent(new Event('initKeyTransfer'));
        }

        switchView(defaultView);
    }
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDateDisplay(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

// Global A4 Branch Declaration Printing Function
window.printSingleDeclaration = async (branchId, dateStr) => {
    if (typeof window.showLoader === 'function') window.showLoader();
    try {
        const docId = branchId + "_" + dateStr;
        const [branchDoc, declDoc] = await Promise.all([
            window.db.collection("branches").doc(branchId).get(),
            window.db.collection("declarations").doc(docId).get()
        ]);

        if (!branchDoc.exists) {
            throw new Error("Branch metadata not found in system.");
        }
        if (!declDoc.exists) {
            throw new Error("Declaration document not found for this date.");
        }

        const branchData = branchDoc.data();
        const declData = declDoc.data();

        const signerIds = [declData.user1_id, declData.user2_id].filter(Boolean);
        const signerDocs = await Promise.all(
            signerIds.map(userId => window.db.collection("users").doc(userId).get())
        );
        const signerDataById = {};
        signerDocs.forEach((userDoc, index) => {
            if (userDoc.exists) {
                signerDataById[signerIds[index]] = userDoc.data();
            }
        });

        const cleanKey = (key) => String(key || '').trim();
        const normalizeKey = (key) => cleanKey(key).toUpperCase();
        const uniqueKeys = (keys) => {
            const seen = new Set();
            return keys.map(cleanKey).filter(key => {
                if (!key || key.toUpperCase() === 'N/A') return false;
                const normalized = normalizeKey(key);
                if (seen.has(normalized)) return false;
                seen.add(normalized);
                return true;
            });
        };
        const getSignedKeys = (primaryKey, secondaryKey, userId, fallbackKey1, fallbackKey2) => {
            const userData = signerDataById[userId] || {};
            const keys = uniqueKeys([primaryKey, secondaryKey, userData.key1, userData.key2]);
            const fallbackKeys = uniqueKeys([fallbackKey1, fallbackKey2]);
            return {
                key1: keys[0] || fallbackKeys[0] || "N/A",
                key2: keys[1] || fallbackKeys[1] || "N/A",
                list: keys
            };
        };
        const makerKeys = getSignedKeys(declData.user1_key1, declData.user1_key2, declData.user1_id, branchData.key1, branchData.key2);
        const checkerKeys = getSignedKeys(declData.user2_key1, declData.user2_key2, declData.user2_id, branchData.key1, branchData.key2);
        const signedKeysById = {
            [declData.user1_id]: makerKeys.list,
            [declData.user2_id]: checkerKeys.list
        };

        // Fetch key transfer positions for each signer to determine physical key location
        const keyPositionById = {};
        await Promise.all(signerIds.map(async (userId) => {
            const uData = signerDataById[userId] || {};
            const signerName = uData.name || (userId === declData.user1_id ? declData.user1_name : declData.user2_name) || 'Holder';
            const signedKeys = signedKeysById[userId] || [];
            const fallbackAssignedKeys = uniqueKeys([uData.key1, uData.key2]);
            const knownKeys = signedKeys.length > 0 ? signedKeys : fallbackAssignedKeys;
            const positions = [];

            // Check if any of user's own keys are currently lent out
            const sentSnap = await window.db.collection('key_transfers')
                .where('sender_id', '==', userId)
                .where('status', '==', 'accepted')
                .where('transfer_type', '==', 'temporary')
                .get();
            const lentKeys = {};
            sentSnap.forEach(doc => {
                const d = doc.data();
                lentKeys[normalizeKey(d.key_number)] = d.receiver_name || 'Unknown';
            });

            // Check if user is holding a key received via temporary transfer
            const receivedSnap = await window.db.collection('key_transfers')
                .where('receiver_id', '==', userId)
                .where('status', '==', 'accepted')
                .where('transfer_type', '==', 'temporary')
                .get();
            const heldKeys = {};
            receivedSnap.forEach(doc => {
                const d = doc.data();
                const keyNumber = cleanKey(d.key_number);
                if (keyNumber) {
                    heldKeys[normalizeKey(keyNumber)] = { key: keyNumber, from: d.sender_name || 'Unknown' };
                }
            });

            knownKeys.forEach(key => {
                const normalized = normalizeKey(key);
                if (heldKeys[normalized]) {
                    positions.push(`${heldKeys[normalized].key} (With ${signerName}, temp. from ${heldKeys[normalized].from})`);
                } else if (!lentKeys[normalized]) {
                    positions.push(`${key} (With ${signerName})`);
                }
            });

            Object.values(heldKeys).forEach(hk => {
                if (!knownKeys.some(key => normalizeKey(key) === normalizeKey(hk.key))) {
                    positions.push(`${hk.key} (With ${signerName}, temp. from ${hk.from})`);
                }
            });

            keyPositionById[userId] = positions.length > 0 ? positions.join(', ') : 'No key currently held';
        }));

        // Fetch transactions for the day summary
        const [stockSnap, cashSnap, appraisalSnap] = await Promise.all([
            window.db.collection("stock_transactions").where("branch_id", "==", branchId).get(),
            window.db.collection("cash_entries").where("branch_id", "==", branchId).get(),
            window.db.collection("daily_appraisals").where("branch_id", "==", branchId).get()
        ]);

        const getDocDateKey = (data) => {
            if (!data || !data.timestamp || typeof data.timestamp.toDate !== 'function') {
                return data && typeof data.date === 'string' ? data.date : '';
            }
            const dateValue = data.timestamp.toDate();
            const year = dateValue.getFullYear();
            const month = String(dateValue.getMonth() + 1).padStart(2, '0');
            const day = String(dateValue.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const stockInEntries = [];
        const stockOutEntries = [];
        stockSnap.forEach(d => {
            const entry = d.data();
            if (getDocDateKey(entry) !== dateStr) return;
            const stockNum = entry.stock_number || 'Unknown';
            if (entry.type === 'IN') stockInEntries.push(stockNum);
            if (entry.type === 'OUT') stockOutEntries.push(stockNum);
        });

        const isMaker1and1 = declData.user2_id === "Auto-1and1";

        let approvedCashTotal = declData.cash_total || 0;
        let denoms = { '500': 0, '200': 0, '100': 0, '50': 0, '20': 0, '10': 0, 'coins': 0 };
        cashSnap.forEach(d => {
            const entry = d.data();
            if (getDocDateKey(entry) !== dateStr) return;
            if (entry.status === 'approved' || (isMaker1and1 && entry.status === 'pending')) {
                approvedCashTotal = entry.total_amount || 0;
                denoms = entry.denominations || denoms;
            }
        });

        let appraised = declData.appraised || 0;
        let notAppraised = declData.not_appraised || 0;
        let appraisalStatus = 'Pending Approval';
        appraisalSnap.forEach(d => {
            const entry = d.data();
            if (getDocDateKey(entry) !== dateStr) return;
            if (entry.status === 'approved' || (isMaker1and1 && entry.status === 'pending')) {
                appraised = entry.appraised || 0;
                notAppraised = entry.not_appraised || 0;
                appraisalStatus = 'Approved';
            }
        });

        const totalStockInLocker = declData.total_stock !== undefined ? declData.total_stock : (branchData.total_stock || 0);
        const outstandingLoan = declData.outstanding_loan !== undefined ? declData.outstanding_loan : (branchData.outstanding_loan || 0);

        const formatCurrency = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;
        const formatSignatureTime = (timestampVal) => {
            if (!timestampVal) return '';
            try {
                if (typeof timestampVal.toDate === 'function') {
                    return timestampVal.toDate().toLocaleString('en-GB', { hour12: true });
                }
                if (timestampVal instanceof Date) {
                    return timestampVal.toLocaleString('en-GB', { hour12: true });
                }
                return new Date(timestampVal).toLocaleString('en-GB', { hour12: true });
            } catch (e) {
                return 'N/A';
            }
        };

        const u1Time = declData.user1_signed_at ? formatSignatureTime(declData.user1_signed_at) : (declData.timestamp ? formatSignatureTime(declData.timestamp) : '');
        const u2Time = declData.user2_signed_at ? formatSignatureTime(declData.user2_signed_at) : (declData.timestamp ? formatSignatureTime(declData.timestamp) : '');

        const makerKeyPosition = keyPositionById[declData.user1_id] || makerKeys.key1;
        const checkerKeyPosition = keyPositionById[declData.user2_id] || checkerKeys.key1;


        const printContainer = document.getElementById('branch-declaration-print');
        if (printContainer) {
            printContainer.innerHTML = `
                <div class="print-doc-container">
                    <div class="print-header">
                        <h1>${escapeHtml(branchData.company || "GOLD VAULT")}</h1>
                        <h2>Declaration of Branch</h2>
                        <p>Branch Name: <strong>${escapeHtml(branchData.name || "N/A")}</strong> | Locker Position: <strong>${escapeHtml(branchData.locker_number || "N/A")}</strong></p>
                        <p>Report Date: <strong>${formatDateDisplay(dateStr)}</strong> | Printed on: <strong>${new Date().toLocaleString('en-GB', { hour12: true })}</strong></p>
                    </div>

                    <div class="print-meta-grid">
                        <div class="print-meta-item">
                           <strong>Declaration Date:</strong> ${formatDateDisplay(dateStr)}<br> 
                        </div>
                        <div class="print-meta-item" style="text-align: right;">
                            <strong>Status:</strong> COMPLETE
                        </div>
                    </div>

                    <div class="print-section-title">Locker Position & Totals</div>
                    <div class="print-totals-grid">
                        <div class="print-total-card">
                            <span>Total Cash Balance</span>
                            <strong>${formatCurrency(approvedCashTotal)}</strong>
                        </div>
                        <div class="print-total-card">
                            <span>Total No.of Stock</span>
                            <strong>${totalStockInLocker}</strong>
                        </div>
                        <div class="print-total-card">
                            <span>Gold Loan Outstanding</span>
                            <strong>${formatCurrency(outstandingLoan)}</strong>
                        </div>
                        <div class="print-total-card">
                            <span>Not Appraised Packets</span>
                            <strong>${notAppraised}</strong>
                        </div>
                    </div>

                    <div class="print-section-title">Daily Stock Transactions</div>
                    <table class="print-data-table">
                        <thead>
                           <tr>
                               <th style="width: 50%;">Stock IN</th>
                               <th style="width: 50%;">Stock OUT</th>
                           </tr>
                        </thead>
                        <tbody>
                           <tr>
                               <td>${stockInEntries.length > 0 ? stockInEntries.map(s => `<code>${escapeHtml(s)}</code>`).join(', ') : 'No stock items added (IN).'}</td>
                               <td>${stockOutEntries.length > 0 ? stockOutEntries.map(s => `<code>${escapeHtml(s)}</code>`).join(', ') : 'No stock items removed (OUT).'}</td>
                           </tr>
                        </tbody>
                    </table>

                    <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 20px; margin-top: 15px;">
                        <div>
                            <div class="print-section-title">Cash Denomination</div>
                            <table class="print-data-table">
                                <thead>
                                    <tr>
                                        <th>Denomination</th>
                                        <th>Count</th>
                                        <th>Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>₹500</td>
                                        <td>${denoms['500'] || 0}</td>
                                        <td>${formatCurrency((denoms['500'] || 0) * 500)}</td>
                                    </tr>
                                    <tr>
                                        <td>₹200</td>
                                        <td>${denoms['200'] || 0}</td>
                                        <td>${formatCurrency((denoms['200'] || 0) * 200)}</td>
                                    </tr>
                                    <tr>
                                        <td>₹100</td>
                                        <td>${denoms['100'] || 0}</td>
                                        <td>${formatCurrency((denoms['100'] || 0) * 100)}</td>
                                    </tr>
                                    <tr>
                                        <td>₹50</td>
                                        <td>${denoms['50'] || 0}</td>
                                        <td>${formatCurrency((denoms['50'] || 0) * 50)}</td>
                                    </tr>
                                    <tr>
                                        <td>₹20</td>
                                        <td>${denoms['20'] || 0}</td>
                                        <td>${formatCurrency((denoms['20'] || 0) * 20)}</td>
                                    </tr>
                                    <tr>
                                        <td>₹10</td>
                                        <td>${denoms['10'] || 0}</td>
                                        <td>${formatCurrency((denoms['10'] || 0) * 10)}</td>
                                    </tr>
                                    <tr>
                                        <td>Coins</td>
                                        <td>-</td>
                                        <td>${formatCurrency(denoms['coins'] || 0)}</td>
                                    </tr>
                                    <tr style="font-weight: bold; background-color: #f3f4f6;">
                                        <td>Total Cash</td>
                                        <td>-</td>
                                        <td>${formatCurrency(approvedCashTotal)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div>
                            <div class="print-section-title">Appraisals Summary</div>
                            <table class="print-data-table">
                                <thead>
                                    <tr>
                                        <th>Category</th>
                                        <th>Count</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Appraised Packets</td>
                                        <td>${appraised}</td>
                                    </tr>
                                    <tr>
                                        <td>Not Appraised Packets</td>
                                        <td>${notAppraised}</td>
                                    </tr>
                                    <tr style="font-weight: bold; background-color: #f3f4f6;">
                                        <td>Total</td>
                                        <td>${appraised + notAppraised}</td>
                                    </tr>
                                   
                                </tbody>
                            </table>

                            <div style="margin-top: 15px; color: red; border: 1px dashed #000000; padding: 10px; font-size: 10px; line-height: 1.4;">
                                <strong>Locker Declaration Compliance:</strong><br>
                                This branch declaration is signed digitally by key holder. According to company policy, branch activities are not closed until both Maker and Checker physical key verifications are completed.
                           </div>
                        </div>
                    </div>

                    <div class="print-section-title">Digital Verification & Signatures</div>
                    <div class="print-signatures-grid">
                        <div class="print-signature-box complete">
                            <span class="print-signature-badge">Maker Signed</span>
                            <div class="box-title">Maker (User 1) Declaration</div>
                            <div class="verification-details">
                               <p><strong>Verified By:</strong> ${escapeHtml(declData.user1_name || "Maker")}</p>
                                <p><strong>Assigned Key </strong> ${escapeHtml(makerKeys.key2)}</p>
                               <p><strong>Signed At:</strong> ${u1Time || 'N/A'}</p>
                            </div>
                            <div class="signature-line">
                                Digitally Certified by Maker
                            </div>
                        </div>

                        <div class="print-signature-box complete">
                            <span class="print-signature-badge">Checker Signed</span>
                            <div class="box-title">Checker (User 2) Verification</div>
                            <div class="verification-details">
                               <p><strong>Verified By:</strong> ${escapeHtml(declData.user2_name || "Checker")}</p>
                                <p><strong>Assigned Key </strong> ${escapeHtml(checkerKeys.key2)}</p>
                               <p><strong>Signed At:</strong> ${u2Time || 'N/A'}</p>
                            </div>
                            <div class="signature-line">
                                Digitally Certified by Checker
                            </div>
                        </div>
                    </div>

                    <div class="print-section-title">Physical Signatures</div>
                    <div class="print-signatures-grid" style="margin-top: 10px;">
                        <div class="print-signature-box" style="height: 100px; display: flex; flex-direction: column; justify-content: flex-end;">
                            <div class="signature-line" style="margin-top: 0;">
                                ${escapeHtml(declData.user1_name)} Physical Signature
                            </div>
                        </div>
                        <div class="print-signature-box" style="height: 100px; display: flex; flex-direction: column; justify-content: flex-end;">
                            <div class="signature-line" style="margin-top: 0;">
                                 ${escapeHtml(declData.user2_name)} Physical Signature
                            </div>
                        </div>
                    </div>

                    <div class="print-footer">
                    <p>Branch Name: <strong>${escapeHtml(branchData.name || "N/A")}</strong> | Locker Position: <strong>${escapeHtml(branchData.locker_number || "N/A")}</strong></p>
                        <p>Report Date: <strong>${formatDateDisplay(dateStr)}</strong> | Generated: <strong>${new Date().toLocaleString('en-GB', { hour12: true })}</strong></p>
                       
                    </div>
                </div>
            `;
        }

        document.body.setAttribute('data-print-section', 'branch-declaration-print');
        window.print();

        if (!declData.print_taken && window.currentUserData && window.currentUserData.role !== 'admin' && window.currentUserData.role !== 'hr' && window.currentUserData.role !== 'ho') {
            await window.db.collection("declarations").doc(docId).update({
                print_taken: true,
                print_taken_at: firebase.firestore.FieldValue.serverTimestamp(),
                print_taken_by: window.currentUser.uid
            });
            setTimeout(() => {
                if (typeof loadBranchReports === 'function') {
                    loadBranchReports('table-user1-reports');
                    loadBranchReports('table-user2-reports');
                }
            }, 1000);
        }

        // Clean up attribute after print dialog finishes (or cancels)
        setTimeout(() => {
            document.body.removeAttribute('data-print-section');
        }, 1000);

    } catch (e) {
        console.error("Print declaration error:", e);
        if (typeof window.showToast === 'function') {
            window.showToast(e.message, "error");
        } else {
            alert("Error generating print: " + e.message);
        }
    }
    if (typeof window.hideLoader === 'function') window.hideLoader();
};

// Mobile Sidebar Toggle
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    const toggleSidebar = (show) => {
        if (show === undefined) show = !sidebar.classList.contains('active');

        if (show) {
            sidebar.classList.add('active');
            overlay.classList.add('active');
            menuToggle.querySelector('i').classList.replace('fa-bars', 'fa-times');
        } else {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            menuToggle.querySelector('i').classList.replace('fa-times', 'fa-bars');
        }
    };

    if (menuToggle && sidebar && overlay) {
        menuToggle.addEventListener('click', () => toggleSidebar());
        overlay.addEventListener('click', () => toggleSidebar(false));

        // Close sidebar when clicking a nav item on mobile
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    toggleSidebar(false);
                }
            });
        });
    }
});

window.enableKeyTransferPrint = async (transferId) => {
    if (!confirm('Are you sure you want to enable printing for this transfer receipt again?')) return;
    window.showLoader();
    try {
        await window.db.collection('key_transfers').doc(transferId).update({
            print_taken: false
        });
        window.showToast('Print enabled successfully.', 'success');
        if (typeof loadAdminKeyReports === 'function') loadAdminKeyReports();
    } catch (err) {
        window.showToast(err.message, 'error');
    }
    window.hideLoader();
};

window.printKeyTransferReceipt = async (transferId, reloadAfter = false) => {
    if (typeof window.showLoader === 'function') window.showLoader();
    try {
        const transferDoc = await window.db.collection('key_transfers').doc(transferId).get();
        if (!transferDoc.exists) throw new Error('Transfer record not found.');
        const data = transferDoc.data();

        let senderBranchName = data.branch_id;
        let receiverBranchName = data.receiver_branch_id;
        try {
            const [sb, rb] = await Promise.all([
                window.db.collection('branches').doc(data.branch_id).get(),
                window.db.collection('branches').doc(data.receiver_branch_id).get()
            ]);
            if (sb.exists) senderBranchName = sb.data().name || data.branch_id;
            if (rb.exists) receiverBranchName = rb.data().name || data.receiver_branch_id;
        } catch (e) { }

        const formatTime = (ts) => {
            if (!ts) return 'N/A';
            return ts.toDate ? ts.toDate().toLocaleString('en-GB') : new Date(ts).toLocaleString('en-GB');
        };

        const printContainer = document.getElementById('key-transfer-print');
        if (printContainer) {
            printContainer.innerHTML = `
                <div class="print-doc-container">
                    <div class="print-header">
                        <h1>ART GROUP</h1>
                        <h2>Key Transfer & Return Receipt</h2>
                        <p>Generated: <strong>${new Date().toLocaleString('en-GB')}</strong></p>
                    </div>

                    <div class="print-section-title">Transfer Details</div>
                    <table class="print-data-table">
                        <tbody>
                            <tr>
                                <td><strong>Key Number</strong></td>
                                <td>${escapeHtml(data.key_number)}</td>
                            </tr>
                            <tr>
                                <td><strong>Transfer Type</strong></td>
                                <td>${data.transfer_type === 'temporary' ? 'Temporary (' + data.from_date + ' to ' + data.to_date + ')' : 'Permanent'}</td>
                            </tr>
                            <tr>
                                <td><strong>Reason</strong></td>
                                <td>${escapeHtml(data.reason)}</td>
                            </tr>
                            <tr>
                                <td><strong>Sender</strong></td>
                                <td>${escapeHtml(data.sender_name)} (${escapeHtml(senderBranchName)})</td>
                            </tr>
                            <tr>
                                <td><strong>Receiver</strong></td>
                                <td>${escapeHtml(data.receiver_name)} (${escapeHtml(receiverBranchName)})</td>
                            </tr>
                        </tbody>
                    </table>

                    <div class="print-section-title">DATE AND TIME</div>
                    <table class="print-data-table">
                        <tbody>
                            <tr>
                                <td><strong>Request Sent At</strong></td>
                                <td>${formatTime(data.created_at)}</td>
                            </tr>
                            <tr>
                                <td><strong>Accepted At</strong></td>
                                <td>${formatTime(data.accepted_at)}</td>
                            </tr>
                            <tr>
                                <td><strong>Returned At</strong></td>
                                <td>${formatTime(data.returned_at)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div class="print-section-title">Signatures with name </div>
                    <div class="print-signatures-grid" style="margin-top: 10px;">
                        <div class="print-signature-box" style="height: 150px; display: flex; flex-direction: column; justify-content: flex-end;">
                            <div class="signature-line" style="margin-top: 0;">
                                ${escapeHtml(data.sender_name)} Signature
                            </div>
                        </div>
                        <div class="print-signature-box" style="height: 150px; display: flex; flex-direction: column; justify-content: flex-end;">
                            <div class="signature-line" style="margin-top: 0;">
                                 ${escapeHtml(data.receiver_name)} Signature
                            </div>
                        </div>
                          
                    </div>
                    <div class="print-section-title"> 
                          </div>
                </div>
            `;
        }

        document.body.setAttribute('data-print-section', 'key-transfer-print');
        window.print();

        if (!data.print_taken && window.currentUserData && window.currentUserData.role !== 'admin' && window.currentUserData.role !== 'hr' && window.currentUserData.role !== 'ho') {
            await window.db.collection('key_transfers').doc(transferId).update({
                print_taken: true,
                print_taken_at: firebase.firestore.FieldValue.serverTimestamp(),
                print_taken_by: window.currentUser.uid
            });
        }

        setTimeout(() => {
            document.body.removeAttribute('data-print-section');
            if (reloadAfter) {
                window.location.reload();
            } else {
                if (typeof loadKeyTransferHistory === 'function') {
                    loadKeyTransferHistory('table-key-history-user1');
                    loadKeyTransferHistory('table-key-history-user2');
                }
                if (typeof loadAdminKeyReports === 'function' && (window.currentUserData.role === 'admin' || window.currentUserData.role === 'hr' || window.currentUserData.role === 'ho')) {
                    loadAdminKeyReports();
                }
            }
        }, 1000);

    } catch (e) {
        console.error("Print key transfer error:", e);
        if (typeof window.showToast === 'function') {
            window.showToast(e.message, "error");
        } else {
            alert("Error generating print: " + e.message);
        }
        if (reloadAfter) window.location.reload();
    }
    if (typeof window.hideLoader === 'function') window.hideLoader();
};
