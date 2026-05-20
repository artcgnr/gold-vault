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

                    if (window.currentUserData.role !== 'admin') {
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

    const activeRoles = userData.active_roles || [userData.role];

    let roleDisplay = "Reserve User";
    if (activeRoles.includes('admin')) {
        roleDisplay = "Administrator";
    } else {
        const parts = [];
        if (activeRoles.includes('user1')) parts.push("Entry (Maker)");
        if (activeRoles.includes('user2')) parts.push("Verifier (Checker)");
        if (parts.length > 0) {
            roleDisplay = parts.join(" & ");
            if (userData.received_role && userData.role === 'user') {
                roleDisplay += " (Acting)";
            }
        }
    }

    document.getElementById('user-display-role').textContent = roleDisplay;

    if (activeRoles.includes('admin')) {
        document.getElementById('nav-admin').classList.remove('hidden');
        switchView('admin-overview');
        document.dispatchEvent(new Event('initAdmin'));
    } else {
        let defaultView = 'reserve-overview';

        if (activeRoles.includes('user1')) {
            document.getElementById('nav-user1').classList.remove('hidden');
            document.dispatchEvent(new Event('initUser1'));
            defaultView = 'user1-entry';
        }

        if (activeRoles.includes('user2')) {
            document.getElementById('nav-user2').classList.remove('hidden');
            document.dispatchEvent(new Event('initUser2'));
            if (!activeRoles.includes('user1')) {
                defaultView = 'user2-verify';
            }
        }

        if (activeRoles.includes('user')) {
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

        if (activeRoles.includes('user1') || activeRoles.includes('user2')) {
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
