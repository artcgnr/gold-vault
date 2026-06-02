// Global variable to store all users for search filtering
window.allUsersData = [];

const adminFilterCompany = document.getElementById('admin-filter-company');
if (adminFilterCompany && !adminFilterCompany.dataset.listenerAdded) {
    adminFilterCompany.addEventListener('change', (e) => {
        updateAdminFilterBranches(e.target.value);
    });
    adminFilterCompany.dataset.listenerAdded = "true";
}

document.addEventListener('initAdmin', async () => {
    loadBranches();
    loadUsers();
    loadResignedUsers();
    loadStats();
    loadDeclarations();
    initAdminTransfers();
    initBackdateApproval();
    if (window.loadAuditLogs) loadAuditLogs();

    const adminReportsBtn = document.querySelector('[data-target="admin-reports"]');
    if (adminReportsBtn) {
        adminReportsBtn.addEventListener('click', loadAdminReports);
    }

    const adminTransferHistoryBtn = document.querySelector('[data-target="admin-transfer-history"]');
    if (adminTransferHistoryBtn) {
        adminTransferHistoryBtn.addEventListener('click', loadAdminKeyReports);
    }

    const adminBackdateBtn = document.querySelector('[data-target="admin-backdate-approval"]');
    if (adminBackdateBtn) {
        adminBackdateBtn.addEventListener('click', loadBackdateApprovals);
    }

    const adminReturnedKeysBtn = document.querySelector('[data-target="admin-returned-keys"]');
    if (adminReturnedKeysBtn) {
        adminReturnedKeysBtn.addEventListener('click', loadReturnedKeys);
    }

    const adminResignedBtn = document.querySelector('[data-target="admin-resigned-users"]');
    if (adminResignedBtn) {
        adminResignedBtn.addEventListener('click', loadResignedUsers);
    }

    const overviewDateInput = document.getElementById('admin-overview-date');
    if (overviewDateInput) {
        overviewDateInput.value = new Date().toISOString().split('T')[0];
        overviewDateInput.addEventListener('change', (e) => {
            loadStats(e.target.value);
            loadDeclarations(e.target.value);
        });
    }

    // Add change listeners to audit filters
    ['audit-filter-action', 'audit-filter-from', 'audit-filter-to'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.dataset.listenerAdded) {
            el.addEventListener('change', loadAuditLogs);
            el.dataset.listenerAdded = "true";
        }
    });

    // Admin Branches Company Filter
    const branchFilterCompany = document.getElementById('branch-filter-company');
    if (branchFilterCompany && !branchFilterCompany.dataset.listenerAdded) {
        branchFilterCompany.addEventListener('change', () => {
            loadBranches();
        });
        branchFilterCompany.dataset.listenerAdded = "true";
    }

    // Admin Reports Filter
    const reportFilterForm = document.getElementById('form-admin-filter-reports');
    if (reportFilterForm) {
        reportFilterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const company = document.getElementById('admin-filter-company').value;
            const branchId = document.getElementById('admin-filter-branch').value;
            const fromDate = document.getElementById('admin-filter-from').value;
            const toDate = document.getElementById('admin-filter-to').value;
            loadAdminReports({ company, branchId, fromDate, toDate });
        });
    }

    const reportClearBtn = document.getElementById('btn-admin-filter-clear');
    if (reportClearBtn) {
        reportClearBtn.addEventListener('click', () => {
            document.getElementById('form-admin-filter-reports').reset();
            loadAdminReports();
        });
    }

    // Key Transfer Reports Filter & Branch Population
    const filterTransferBranchSelect = document.getElementById('admin-filter-transfer-branch');
    if (filterTransferBranchSelect) {
        try {
            const snap = await window.db.collection("branches").get();
            // Clear but keep first option
            filterTransferBranchSelect.innerHTML = '<option value="all">All Branches</option>';
            snap.forEach(doc => {
                const opt = document.createElement('option');
                opt.value = doc.id;
                opt.textContent = doc.data().name || doc.id;
                filterTransferBranchSelect.appendChild(opt);
            });
        } catch (err) {
            console.error("Error populating key transfer report branches:", err);
        }
    }

    const transferFilterForm = document.getElementById('form-admin-filter-transfer-history');
    if (transferFilterForm) {
        transferFilterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const branchId = document.getElementById('admin-filter-transfer-branch').value;
            const fromDate = document.getElementById('admin-filter-transfer-from').value;
            const toDate = document.getElementById('admin-filter-transfer-to').value;
            const status = document.getElementById('admin-filter-transfer-status').value;
            loadAdminKeyReports({ branchId, fromDate, toDate, status });
        });
    }

    // User Search Filter
    const userSearchInput = document.getElementById('user-branch-filter-search');
    if (userSearchInput && !userSearchInput.dataset.listenerAdded) {
        userSearchInput.addEventListener('input', (e) => {
            const searchText = e.target.value.toLowerCase().trim();
            filterUsers(searchText);
        });
        userSearchInput.dataset.listenerAdded = "true";
    }
});

document.getElementById('form-add-branch').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('branch-name').value;
    const company = document.getElementById('branch-company').value;
    const lockerNumber = document.getElementById('branch-locker-number').value;
    const key1 = document.getElementById('branch-key1').value;
    const key2 = document.getElementById('branch-key2').value;

    window.showLoader();
    try {
        await window.db.collection("branches").add({
            name: name,
            company: company,
            locker_number: lockerNumber,
            key1: key1,
            key2: key2,
            total_stock: 0,
            physical_cash: 0,
            created_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        window.showToast("Branch created successfully!", "success");
        document.getElementById('form-add-branch').reset();
        document.getElementById('modal-add-branch').classList.add('hidden');
        loadBranches();
    } catch (error) {
        window.showToast(error.message, "error");
    }
    window.hideLoader();
});

async function loadBranches() {
    try {
        const [branchSnapshot, usersSnapshot] = await Promise.all([
            window.db.collection("branches").orderBy("created_at", "desc").get(),
            window.db.collection("users").get()
        ]);
        const tbody = document.querySelector('#table-branches tbody');
        const newUserBranch = document.getElementById('new-user-branch');
        const editUserBranch = document.getElementById('edit-user-branch');

        const companyFilter = document.getElementById('branch-filter-company')?.value || 'all';

        tbody.innerHTML = '';
        newUserBranch.innerHTML = '<option value="">Select Branch...</option>';
        if (editUserBranch) editUserBranch.innerHTML = '<option value="">Select Branch...</option>';

        window.branchDataCache = {};
        window.assignedKeys = new Set();

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.key1) {
                window.assignedKeys.add(userData.key1);
            }
            if (userData.key2) {
                window.assignedKeys.add(userData.key2);
            }
        });

        const branches = [];
        branchSnapshot.forEach(docSnap => {
            branches.push(docSnap);
        });

        // Sort branches A to Z by name
        branches.sort((a, b) => {
            const nameA = (a.data().name || '').trim().toLowerCase();
            const nameB = (b.data().name || '').trim().toLowerCase();
            return nameA.localeCompare(nameB);
        });

        branches.forEach(docSnap => {
            const data = docSnap.data();
            const date = data.created_at ? data.created_at.toDate().toLocaleDateString('en-GB') : 'N/A';
            window.branchDataCache[docSnap.id] = data;

            // Populate option dropdowns for users first (so all branches are available for assignments)
            const option = document.createElement('option');
            option.value = docSnap.id;
            option.textContent = data.name;
            option.dataset.locker = data.locker_number || '';
            option.dataset.key1 = data.key1 || '';
            option.dataset.key2 = data.key2 || '';
            newUserBranch.appendChild(option);

            if (editUserBranch) {
                const editOption = document.createElement('option');
                editOption.value = docSnap.id;
                editOption.textContent = data.name;
                editOption.dataset.locker = data.locker_number || '';
                editOption.dataset.key1 = data.key1 || '';
                editOption.dataset.key2 = data.key2 || '';
                editUserBranch.appendChild(editOption);
            }

            // Apply company filter to table list only
            if (companyFilter !== 'all' && data.company !== companyFilter) {
                return;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${data.name}</strong></td>
                <td>${data.company || '-'}</td>
                <td>${data.locker_number || '-'}</td>
                <td>${data.key1 || '-'}</td>
                <td>${data.key2 || '-'}</td>
                
                <td>${date}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="openEditBranch('${docSnap.id}', '${escapeHtml(data.name)}', '${escapeHtml(data.company || '')}', ${data.total_stock}, ${data.physical_cash}, ${data.outstanding_loan || 0}, '${escapeHtml(data.locker_number || '')}', '${escapeHtml(data.key1 || '')}', '${escapeHtml(data.key2 || '')}')"title="Edit branch">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error loading branches:", error);
    }
}

function updateUserFormLockerKey(branchId, lockerSelectId, keySelectId, currentUserId = null) {
    const lockerSelect = document.getElementById(lockerSelectId);
    const keySelect = document.getElementById(keySelectId);

    if (!branchId || !window.branchDataCache || !window.branchDataCache[branchId]) {
        lockerSelect.disabled = true;
        keySelect.disabled = true;
        lockerSelect.innerHTML = '<option value="">Select Branch First...</option>';
        keySelect.innerHTML = '<option value="">Select Branch First...</option>';
        return;
    }

    const branchData = window.branchDataCache[branchId];
    lockerSelect.disabled = false;
    keySelect.disabled = false;

    lockerSelect.innerHTML = `<option value="${branchData.locker_number}">${branchData.locker_number}</option>`;

    keySelect.innerHTML = '<option value="">None / Remove Key</option>';
    if (branchData.key1 && (!window.assignedKeys || !window.assignedKeys.has(branchData.key1) || (currentUserId && window.currentEditingUserKey === branchData.key1))) {
        keySelect.innerHTML += `<option value="${branchData.key1}">${branchData.key1}</option>`;
    }
    if (branchData.key2 && (!window.assignedKeys || !window.assignedKeys.has(branchData.key2) || (currentUserId && window.currentEditingUserKey === branchData.key2))) {
        keySelect.innerHTML += `<option value="${branchData.key2}">${branchData.key2}</option>`;
    }

    // No longer disabling if empty, as "None / Remove Key" is always an option
}

// Add event listeners for branch select in new user form
const newUserBranch = document.getElementById('new-user-branch');
if (newUserBranch) {
    newUserBranch.addEventListener('change', (e) => {
        updateUserFormLockerKey(e.target.value, 'new-user-locker', 'new-user-key');
    });
}

// Add event listeners for branch select in edit user form
const editUserBranch = document.getElementById('edit-user-branch');
if (editUserBranch) {
    editUserBranch.addEventListener('change', (e) => {
        updateUserFormLockerKey(e.target.value, 'edit-user-locker', 'edit-user-key', window.currentEditingUserId);
    });
}

document.getElementById('form-add-user').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-user-name').value;
    const email = document.getElementById('new-user-email').value;
    const password = document.getElementById('new-user-password').value;
    const role = document.getElementById('new-user-role').value;
    const branchId = document.getElementById('new-user-branch').value;
    const lockerNumber = document.getElementById('new-user-locker').value;
    const assignedKey = document.getElementById('new-user-key').value;

    if (role !== 'admin' && role !== 'hr' && role !== 'ho' && !branchId) {
        return window.showToast("Please select a branch for non-admin/HR users.", "error");
    }

    window.showLoader();
    try {
        const secondaryApp = firebase.initializeApp(window.firebaseConfig, "SecondaryApp" + Date.now());
        const userCredential = await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
        const newUserUid = userCredential.user.uid;

        await window.db.collection("users").doc(newUserUid).set({
            name: name,
            email: email,
            password: password,
            role: role,
            branch_id: branchId || null,
            locker_number: lockerNumber || null,
            key1: assignedKey || null,
            key2: null,
            created_at: firebase.firestore.FieldValue.serverTimestamp()
        });

        await secondaryApp.auth().signOut();
        await secondaryApp.delete();

        window.showToast("User created successfully!", "success");
        document.getElementById('form-add-user').reset();
        document.getElementById('modal-add-user').classList.add('hidden');
        loadBranches();
        loadUsers();
    } catch (error) {
        window.showToast(error.message, "error");
    }
    window.hideLoader();
});

let showResignedUsers = false;

window.toggleResignedUsers = () => {
    showResignedUsers = !showResignedUsers;
    const btn = document.getElementById('btn-toggle-users');
    const activeContainer = document.getElementById('active-users-container');
    const resignedContainer = document.getElementById('resigned-users-container');

    if (showResignedUsers) {
        btn.classList.add('active');
        btn.innerHTML = '<i class="fa-solid fa-users"></i> <span>View Active Users</span>';

        activeContainer.classList.add('hidden');
        resignedContainer.classList.remove('hidden');
        loadResignedUsers();
    } else {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="fa-solid fa-user-slash"></i> <span>View Resigned Users</span>';

        resignedContainer.classList.add('hidden');
        activeContainer.classList.remove('hidden');
        loadUsers();
    }
};

async function loadUsers() {
    console.log("loadUsers started");
    try {
        const snapshot = await window.db.collection("users").get();
        const tbody = document.querySelector('#table-users tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const branchSnap = await window.db.collection("branches").get();
        const branchMap = {};
        branchSnap.forEach(b => branchMap[b.id] = b.data().name);

        const users = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.is_resigned) return; // Skip resigned

            const branchName = data.role === 'admin' ? 'Admin' : (branchMap[data.branch_id] || data.branch_id || '-');
            users.push({ docSnap, data, branchName });
        });

        // Sort users A to Z by branch name (and by user name if branch name is the same)
        users.sort((a, b) => {
            const bNameA = a.branchName.toLowerCase();
            const bNameB = b.branchName.toLowerCase();
            if (bNameA !== bNameB) {
                return bNameA.localeCompare(bNameB);
            }
            const uNameA = (a.data.name || '').toLowerCase();
            const uNameB = (b.data.name || '').toLowerCase();
            return uNameA.localeCompare(uNameB);
        });

        // Store users data for search filtering
        window.allUsersData = users;

        // Clear search input
        const searchInput = document.getElementById('user-branch-filter-search');
        if (searchInput) searchInput.value = '';

        // Display all users
        displayUsers(users);
        console.log("loadUsers completed");
    } catch (error) {
        console.error("Error loading users:", error);
    }
}

function displayUsers(usersToDisplay) {
    const tbody = document.querySelector('#table-users tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    usersToDisplay.forEach(({ docSnap, data, branchName }) => {
        let roleBadge = '';
        if (data.role === 'admin') roleBadge = '<span class="status-badge status-approved">Admin</span>';
        else if (data.role === 'hr') roleBadge = '<span class="status-badge status-approved" style="background:#f59e0b;color:#fff;">HR</span>';
        else if (data.role === 'ho') roleBadge = '<span class="status-badge status-approved" style="background:#14b8a6;color:#fff;">HO</span>';
        else if (data.role === 'user1') roleBadge = '<span class="status-badge status-pending" style="color:#3b82f6; background:rgba(59, 130, 246, 0.2)">User 1</span>';
        else if (data.role === 'user1and1') roleBadge = '<span class="status-badge status-pending" style="color:#3b82f6; background:rgba(59, 130, 246, 0.2)">Maker (1&1)</span>';
        else if (data.role === 'user2') roleBadge = '<span class="status-badge status-pending" style="color:#8b5cf6; background:rgba(139, 92, 246, 0.2)">User 2</span>';
        else roleBadge = '<span class="status-badge status-pending">Reserve</span>';

        const statusBadge = '<span class="status-badge" style="background:#dcfce7; color:#15803d;"><i class="fa-solid fa-user-check"></i></span>';

        const keys = [];
        if (data.key1) keys.push(data.key1);
        if (data.key2) keys.push(data.key2);
        const keyDisplay = keys.length ? keys.join(', ') : 'None';

        const tr = document.createElement('tr');
        const safeName = escapeHtml(data.name).replace(/'/g, "\\'");
        const safeRole = (data.role || '').replace(/'/g, "\\'");
        const safeBranch = (data.branch_id || '').replace(/'/g, "\\'");
        const safeKey1 = (data.key1 || '').replace(/'/g, "\\'");
        const safeKey2 = (data.key2 || '').replace(/'/g, "\\'");
        const safeEmail = (data.email || '').replace(/'/g, "\\'");

        tr.innerHTML = `
            <td><strong>${escapeHtml(data.name)}</strong></td>
            <td>${escapeHtml(data.email)}</td>
            <td>${escapeHtml(branchName)}</td>
            <td>${escapeHtml(keyDisplay)}</td>
            <td>${roleBadge}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="openEditUser('${docSnap.id}', '${safeName}', '${safeRole}', '${safeBranch}', '${safeKey1}', '${safeKey2}', false, '${safeEmail}')" title="Edit User">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>               
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterUsers(searchText) {
    if (!searchText) {
        displayUsers(window.allUsersData);
        return;
    }

    const filtered = window.allUsersData.filter(({ data }) => {
        const name = (data.name || '').toLowerCase();
        const email = (data.email || '').toLowerCase();
        return name.includes(searchText) || email.includes(searchText);
    });

    displayUsers(filtered);
}

window.resetUserPassword = async (email) => {
    if (!email) {
        window.showToast("Email address is required to reset password.", "error");
        return;
    }
    if (!confirm(`Are you sure you want to send a password reset email to ${email}?`)) return;

    window.showLoader();
    try {
        await window.auth.sendPasswordResetEmail(email);
        window.showToast("Password reset email sent successfully!", "success");
        if (typeof window.logAuditEvent === 'function') {
            window.logAuditEvent("Admin Password Reset Sent", "admin", `Sent password reset email to: ${email}`);
        }
    } catch (err) {
        window.showToast(err.message, "error");
    }
    window.hideLoader();
};

window.openEditUser = (id, name, role, branchId, key1, key2, isResigned = false, email = '') => {
    window.currentEditingUserId = id;
    window.currentEditingUserKey = key1;
    window.currentEditingUserEmail = email;

    document.getElementById('edit-user-id').value = id;
    document.getElementById('edit-user-name').value = name;
    const emailInput = document.getElementById('edit-user-email');
    if (emailInput) emailInput.value = email;
    document.getElementById('edit-user-role').value = role;
    document.getElementById('edit-user-status').value = isResigned ? 'resigned' : 'active';
    const pwdInput = document.getElementById('edit-user-password');
    if (pwdInput) pwdInput.value = '';

    const branchSelect = document.getElementById('edit-user-branch');
    const newBranchSelect = document.getElementById('new-user-branch');
    branchSelect.innerHTML = newBranchSelect.innerHTML;
    branchSelect.value = branchId;

    if (branchId) {
        updateUserFormLockerKey(branchId, 'edit-user-locker', 'edit-user-key', id);
        const editLocker = document.getElementById('edit-user-locker');
        const editKey = document.getElementById('edit-user-key');
        if (editLocker && window.branchDataCache && window.branchDataCache[branchId]) {
            editLocker.value = window.branchDataCache[branchId].locker_number;
        }
        if (editKey && key1) {
            editKey.value = key1;
        }
    }

    document.getElementById('modal-edit-user').classList.remove('hidden');
};

// Add event listener for the Reset Password button inside the Edit User modal
const btnEditUserResetPassword = document.getElementById('btn-edit-user-reset-password');
if (btnEditUserResetPassword) {
    btnEditUserResetPassword.addEventListener('click', () => {
        if (window.currentEditingUserEmail) {
            window.resetUserPassword(window.currentEditingUserEmail);
        } else {
            window.showToast("No email found for this user.", "error");
        }
    });
}

document.getElementById('form-edit-user').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-user-id').value;
    const name = document.getElementById('edit-user-name').value;
    const role = document.getElementById('edit-user-role').value;
    const branchId = document.getElementById('edit-user-branch').value;
    const lockerNumber = document.getElementById('edit-user-locker').value;
    const assignedKey = document.getElementById('edit-user-key').value;
    const status = document.getElementById('edit-user-status').value;
    const isResigned = (status === 'resigned');

    if (role !== 'admin' && role !== 'hr' && role !== 'ho' && !branchId) {
        return window.showToast("Please select a branch for non-admin/HR users.", "error");
    }

    window.showLoader();
    try {
        const updates = {
            name: name,
            role: role,
            branch_id: branchId || null,
            locker_number: lockerNumber || null,
            is_resigned: isResigned
        };

        const newPassword = document.getElementById('edit-user-password').value;
        const newEmail = document.getElementById('edit-user-email') ? document.getElementById('edit-user-email').value : '';
        const userSnap = await window.db.collection("users").doc(id).get();
        const userData = userSnap.data();

        let needsAuth = false;
        if (newPassword && newPassword.trim().length > 0) needsAuth = true;
        if (newEmail && newEmail.trim() !== '' && newEmail !== userData.email) needsAuth = true;

        if (needsAuth) {
            let currentPassword = userData.password;
            const email = userData.email;

            if (!currentPassword) {
                currentPassword = prompt(`This user was created without a saved password. Please enter the user's CURRENT password to allow changing credentials, or click Cancel:`);
                if (!currentPassword) {
                    window.hideLoader();
                    return;
                }
            }

            const secAppName = "UpdateCredsApp" + Date.now();
            const secondaryApp = firebase.initializeApp(window.firebaseConfig, secAppName);
            try {
                const userCreds = await secondaryApp.auth().signInWithEmailAndPassword(email, currentPassword);

                if (newPassword && newPassword.trim().length > 0) {
                    if (newPassword.trim().length < 6) throw new Error("Password must be at least 6 characters long.");
                    await userCreds.user.updatePassword(newPassword);
                    updates.password = newPassword;
                }

                if (newEmail && newEmail.trim() !== '' && newEmail !== userData.email) {
                    await userCreds.user.updateEmail(newEmail);
                    updates.email = newEmail;
                }

                await secondaryApp.auth().signOut();
                await secondaryApp.delete();
            } catch (authErr) {
                await secondaryApp.delete();
                window.hideLoader();
                return window.showToast("Authentication failed: " + authErr.message, "error");
            }
        }

        if (isResigned) {
            updates.key1 = null;
            updates.key2 = null;
            updates.resigned_at = firebase.firestore.FieldValue.serverTimestamp();
        } else {
            updates.key1 = assignedKey || null;
            updates.key2 = null;
        }

        await window.db.collection("users").doc(id).update(updates);
        window.logAuditEvent("Admin User Edit", "admin", `Updated user: ${name} (Status: ${status}, Role: ${role})`);
        window.showToast("User updated successfully!", "success");
        document.getElementById('modal-edit-user').classList.add('hidden');
        loadBranches();
        loadUsers();
        loadResignedUsers();
    } catch (err) {
        window.showToast(err.message, "error");
    }
    window.hideLoader();
});

async function loadStats(selectedDate = null) {
    const gridArt = document.getElementById('admin-stats-grid-art');
    const gridNidhi = document.getElementById('admin-stats-grid-nidhi');
    try {
        const branchSnap = await window.db.collection("branches").get();

        let lastActiveDateStr = selectedDate || new Date().toISOString().split('T')[0];

        if (!selectedDate) {
            const latestTx = await window.db.collection("stock_transactions").orderBy("timestamp", "desc").limit(1).get();
            if (!latestTx.empty) {
                const data = latestTx.docs[0].data();
                if (data.timestamp) {
                    lastActiveDateStr = data.timestamp.toDate().toISOString().split('T')[0];
                }
            }
            const overviewDateInput = document.getElementById('admin-overview-date');
            if (overviewDateInput) overviewDateInput.value = lastActiveDateStr;
        }

        const declarationsSnap = await window.db.collection("declarations").where("date", "==", lastActiveDateStr).get();
        const totalsSnap = await window.db.collection("daily_totals").where("date", "==", lastActiveDateStr).get();
        const appraisalSnap = await window.db.collection("daily_appraisals").get();

        const buildGridHTML = (companyName) => {
            let activeBranches = [];
            branchSnap.forEach(b => {
                if (b.data().company === companyName) {
                    activeBranches.push(b);
                }
            });
            let totalBranches = activeBranches.length;

            let totalStock = 0;
            let totalCash = 0;
            let totalLoan = 0;

            if (!declarationsSnap.empty) {
                declarationsSnap.forEach(d => {
                    const data = d.data();
                    const branchData = branchSnap.docs.find(b => b.id === data.branch_id)?.data() || {};
                    if (branchData.company !== companyName) return;

                    let bStock = data.total_stock !== undefined ? data.total_stock : (branchData.total_stock || 0);
                    let bLoan = data.outstanding_loan !== undefined ? data.outstanding_loan : (branchData.outstanding_loan || 0);

                    const tDoc = totalsSnap.docs.find(t => t.data().branch_id === data.branch_id);
                    if (tDoc) {
                        const tData = tDoc.data();
                        if (tData.total_stock !== undefined) bStock = tData.total_stock;
                        if (tData.outstanding_loan !== undefined) bLoan = tData.outstanding_loan;
                    }

                    totalStock += bStock;
                    totalLoan += bLoan;
                    totalCash += branchData.physical_cash || 0;
                });
            } else {
                activeBranches.forEach(b => {
                    totalStock += b.data().total_stock || 0;
                    totalCash += b.data().physical_cash || 0;
                    totalLoan += b.data().outstanding_loan || 0;
                });
            }

            let targetAppraised = 0;
            let targetPending = 0;

            appraisalSnap.forEach(doc => {
                const data = doc.data();
                const branchData = branchSnap.docs.find(b => b.id === data.branch_id)?.data();
                if (!branchData || branchData.company !== companyName) return;

                const txDate = data.timestamp ? data.timestamp.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                if (txDate === lastActiveDateStr && data.status === 'approved') {
                    targetAppraised += data.appraised || 0;
                    targetPending += data.not_appraised || 0;
                }
            });

            return `
                <div class="stat-card glass-panel">
                    <div class="stat-icon"><i class="fa-solid fa-building"></i></div>
                    <div class="stat-info">
                        <h4>Active Branches</h4>
                        <p>${totalBranches}</p>
                    </div>
                </div>
                <div class="stat-card glass-panel">
                    <div class="stat-icon"><i class="fa-solid fa-check-circle text-success"></i></div>
                    <div class="stat-info">
                        <h4>Total Appraised</h4>
                        <p>${targetAppraised}</p>
                    </div>
                </div>
                <div class="stat-card glass-panel">
                    <div class="stat-icon"><i class="fa-solid fa-clock text-warning"></i></div>
                    <div class="stat-info">
                        <h4>Not Appraised</h4>
                        <p>${targetPending}</p>
                    </div>
                </div>
                <div class="stat-card glass-panel">
                    <div class="stat-icon"><i class="fa-solid fa-money-bill-wave"></i></div>
                    <div class="stat-info">
                        <h4>Total Physical Cash</h4>
                        <p>₹${totalCash.toLocaleString()}</p>
                    </div>
                </div>
                <div class="stat-card glass-panel">
                    <div class="stat-icon"><i class="fa-solid fa-money-bill-trend-up text-success"></i></div>
                    <div class="stat-info">
                        <h4>Total Outstanding Loan</h4>
                        <p>₹${totalLoan.toLocaleString()}</p>
                    </div>
                </div>
            `;
        };

        if (gridArt) gridArt.innerHTML = buildGridHTML('ART LEASING');
        if (gridNidhi) gridNidhi.innerHTML = buildGridHTML('CHEGANNUR NIDHI');
    } catch (error) {
        console.error("Error loading stats:", error);
    }
}

function escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatLocalDateKey(dateValue) {
    if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) return '';
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getDocDateKey(data) {
    if (!data || !data.timestamp || typeof data.timestamp.toDate !== 'function') {
        return data && typeof data.date === 'string' ? data.date : '';
    }
    return formatLocalDateKey(data.timestamp.toDate());
}

function formatCashBreakdown(denominations = {}) {
    const parts = [];
    ['500', '200', '100', '50'].forEach(key => {
        const count = denominations[key] || 0;
        if (count > 0) parts.push(`${key}x${count}`);
    });
    return parts.length ? parts.join(', ') : 'No denomination details';
}

async function getDeclarationDaySummary(branchId, date, declarationData = null) {
    const summary = {
        stockInEntries: [], stockOutEntries: [], cashEntries: [], appraisalEntries: [],
        approvedCashTotal: 0, approvedAppraised: 0, approvedNotAppraised: 0
    };
    
    const isMaker1and1 = declarationData && declarationData.user2_id === "Auto-1and1";

    branchId = String(branchId || '');
    const [stockSnap, cashSnap, appraisalSnap] = await Promise.all([
        window.db.collection("stock_transactions").where("branch_id", "==", branchId).get(),
        window.db.collection("cash_entries").where("branch_id", "==", branchId).get(),
        window.db.collection("daily_appraisals").where("branch_id", "==", branchId).get()
    ]);

    stockSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (getDocDateKey(data) !== date) return;
        const entry = { stockNumber: data.stock_number || 'Unknown', status: data.status || 'pending' };
        if (data.type === 'IN') summary.stockInEntries.push(entry);
        if (data.type === 'OUT') summary.stockOutEntries.push(entry);
    });

    cashSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (getDocDateKey(data) !== date) return;
        const totalAmount = data.total_amount || 0;
        summary.cashEntries.push({ totalAmount, denominations: data.denominations || {}, status: data.status || 'pending' });
        summary.approvedCashTotal += totalAmount;
    });

    appraisalSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (getDocDateKey(data) !== date) return;
        const appraised = data.appraised || 0;
        const notAppraised = data.not_appraised || 0;
        summary.appraisalEntries.push({ appraised, notAppraised, status: data.status || 'pending' });
        summary.approvedAppraised += appraised;
        summary.approvedNotAppraised += notAppraised;
    });
    return summary;
}

function formatCurrencyValue(amount) {
    return `₹${Number(amount || 0).toLocaleString()}`;
}

function formatStockNumbers(entries) {
    if (!entries || !entries.length) return '-';
    return entries.map(entry => escapeHtml(entry.stockNumber || 'Unknown')).join(', ');
}

async function renderDeclarationTable(tableSelector, limit = null, filters = {}, showActions = true, showPrintButtons = true) {
    let query = window.db.collection("declarations").orderBy("date", "desc");
    if (limit) query = query.limit(limit);

    const snap = await query.get();
    const tbody = document.querySelector(`${tableSelector} tbody`);
    if (!tbody) return 0;
    tbody.innerHTML = '';

    if (snap.empty) {
        tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding: 20px; color: #888;">No declarations found yet.</td></tr>';
        return 0;
    }

    const branchSnap = await window.db.collection("branches").get();
    const branchMap = {};
    branchSnap.forEach(b => branchMap[b.id] = b.data());

    let parsedDocs = snap.docs.map(d => Object.assign(d.data(), { _id: d.id }));
    if (filters.branchId && filters.branchId !== 'all') {
        const filterId = String(filters.branchId);
        parsedDocs = parsedDocs.filter(d => String(d.branch_id) === filterId);
    }
    if (filters.company && filters.company !== 'all') {
        parsedDocs = parsedDocs.filter(d => {
            const bData = branchMap[d.branch_id];
            return bData && bData.company === filters.company;
        });
    }
    if (filters.fromDate) parsedDocs = parsedDocs.filter(d => d.date >= filters.fromDate);
    if (filters.toDate) parsedDocs = parsedDocs.filter(d => d.date <= filters.toDate);

    if (filters.fromDate && filters.fromDate === filters.toDate) {
        const declaredBranchIds = new Set(parsedDocs.map(d => String(d.branch_id)));
        const targetDate = filters.fromDate;
        Object.keys(branchMap).forEach(branchId => {
            const bData = branchMap[branchId];
            if (filters.company && filters.company !== 'all' && bData.company !== filters.company) {
                return;
            }
            if (!declaredBranchIds.has(String(branchId))) {
                if (!filters.branchId || filters.branchId === 'all' || filters.branchId === branchId) {
                    parsedDocs.push({ branch_id: branchId, date: targetDate, user1_status: "Pending", user2_status: "Pending", isDummy: true });
                }
            }
        });
    }

    if (parsedDocs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding: 20px; color: #888;">No matches.</td></tr>';
        return 0;
    }

    // Sort by branch name A to Z
    parsedDocs.sort((a, b) => {
        const branchNameA = (branchMap[a.branch_id]?.name || 'Unknown').toLowerCase();
        const branchNameB = (branchMap[b.branch_id]?.name || 'Unknown').toLowerCase();
        return branchNameA.localeCompare(branchNameB);
    });

    const rows = await Promise.all(parsedDocs.map(async data => {
        const branchDataObj = branchMap[data.branch_id] || {};
        const branchName = branchDataObj.name || "Unknown";
        if (data.isDummy) {
            return `<tr style="background: rgba(239, 68, 68, 0.02);">
                <td style="vertical-align: center;"><strong>${escapeHtml(formatDateDisplay(data.date))}</strong></td>
                <td style="vertical-align: center;"><strong>${escapeHtml(branchName)}</strong></td>
                <td><span class="status-badge status-pending" style="color:#ef4444; background:rgba(239, 68, 68, 0.1);"><i class="fa-solid fa-hourglass-start"></i></span></td>
                <td><span class="status-badge status-pending" style="color:#ef4444; background:rgba(239, 68, 68, 0.1);"><i class="fa-solid fa-hourglass-start"></span></td>
                <td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td>
                <td style="vertical-align: center; font-size: .6em;"><span class="status-badge status-pending" style="color:#ef4444; background:rgba(239, 68, 68, 0.1);"><i class="fa-solid fa-x"></i></span></td>
                
            </tr>`;
        }

        const approvedSummary = await getDeclarationDaySummary(data.branch_id, data.date, data);
        const branchData = branchSnap.docs.find(branchDoc => branchDoc.id === data.branch_id)?.data() || {};
        const totalsSnap = await window.db.collection("daily_totals").where("branch_id", "==", data.branch_id).where("date", "==", data.date).get();

        let totalStockInLocker = data.total_stock !== undefined ? data.total_stock : (branchData.total_stock || 0);
        let outstandingLoan = data.outstanding_loan !== undefined ? data.outstanding_loan : (branchData.outstanding_loan || 0);
        if (!totalsSnap.empty) {
            const tData = totalsSnap.docs[0].data();
            totalStockInLocker = tData.total_stock !== undefined ? tData.total_stock : totalStockInLocker;
            outstandingLoan = tData.outstanding_loan !== undefined ? tData.outstanding_loan : outstandingLoan;
        }

        const mKeyStr = (data.user1_key1 || data.user1_key2) ? `<br><small class="text-primary"><i class="fa-solid fa-key" style="font-size: 0.5rem;"></i> ${escapeHtml([data.user1_key1, data.user1_key2].filter(Boolean).join(', '))}</small>` : '';
        const cKeyStr = (data.user2_key1 || data.user2_key2) ? `<br><small class="text-primary"><i class="fa-solid fa-key" style="font-size: 0.5rem;"></i> ${escapeHtml([data.user2_key1, data.user2_key2].filter(Boolean).join(', '))}</small>` : '';
        const makerInfo = data.user1_status === 'Signed' ? `${escapeHtml(data.user1_name || 'Signed')}${mKeyStr}` : '<span class="status-badge status-pending"><i class="fa-solid fa-hourglass-start"></i></span>';
        const checkerInfo = data.user2_status === 'Signed' ? `${escapeHtml(data.user2_name || 'Signed')}${cKeyStr}` : '<span class="status-badge status-pending"><i class="fa-solid fa-hourglass-start"></i></span>';
        let finalStatus = data.user1_status === 'Signed' && data.user2_status === 'Signed' ? '<span class="status-badge status-approved"><i class="fa-solid fa-check"></i></span>' : '<span class="status-badge status-pending"><i class="fa-solid fa-clock"></i></span>';


        const isComplete = (data.user1_status === 'Signed' && data.user2_status === 'Signed');
        let printBtnHtml = '';
        let unlockPrintHtml = '';

        if (showPrintButtons) {
            if (isComplete && data.print_taken) {
                printBtnHtml = `<button class="btn btn-icon btn-sm text-primary" onclick="window.printSingleDeclaration('${data.branch_id}', '${data.date}')" title="Print A4 Declaration" style="margin-right: 6px;">
                    <i class="fa-solid fa-print"></i>
                   </button>`;
            } else if (isComplete && !data.print_taken) {
                printBtnHtml = `<button class="btn btn-icon btn-sm" disabled style="opacity: 0.4; cursor: not-allowed; margin-right: 6px; color: #f59e0b;" title="Waiting for Branch to Print">
                    <i class="fa-solid fa-print"></i>
                   </button>`;
            } else {
                printBtnHtml = `<button class="btn btn-icon btn-sm" disabled style="opacity: 0.4; cursor: not-allowed; margin-right: 6px;" title="Pending Maker & Checker signatures">
                    <i class="fa-solid fa-print"></i>
                   </button>`;
            }

            unlockPrintHtml = data.print_taken
                ? `<button class="btn btn-icon btn-sm text-success" onclick="enableBranchPrint('${data._id}')" title="Re-enable Branch Print">
                    <i class="fa-solid fa-unlock"></i>
                   </button>`
                : '';
        }

        let deleteBtn = '';
        let adminActionHtml = '';
        if (showActions && window.currentUserData && window.currentUserData.role === 'admin') {

            deleteBtn = `<button class="btn btn-icon btn-sm text-primary" onclick="deleteDeclaration('${data._id}')" title="Delete Declaration">
                <i class="fa-solid fa-trash-can"></i>
            </button>`;
        }

        const actionHtml = data._id ? `
            <div style="display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 2px;">
                ${adminActionHtml}
                ${printBtnHtml}
                ${unlockPrintHtml}
                ${deleteBtn}
            </div>
        ` : '-';

        return `<tr>
            <td style="vertical-align: top;">${escapeHtml(formatDateDisplay(data.date))}</td>
            <td style="vertical-align: top;">${escapeHtml(branchName)}</td>
            <td>${makerInfo}</td><td>${checkerInfo}</td>
            <td>${formatStockNumbers(approvedSummary.stockInEntries)}</td>
            <td>${formatStockNumbers(approvedSummary.stockOutEntries)}</td>
            <td>${formatCurrencyValue(approvedSummary.approvedCashTotal)}</td>
            <td>${approvedSummary.approvedAppraised}</td>
            <td>${approvedSummary.approvedNotAppraised}</td>
            <td>${totalStockInLocker}</td>
            <td>${formatCurrencyValue(outstandingLoan)}</td>
            <td style="vertical-align: center;">${finalStatus}</td>
            <td>${actionHtml}</td>
        </tr>`;
    }));
    tbody.innerHTML = rows.join('');
    return rows.length;
}

window.adminAcceptDeclaration = async function (id) {
    if (!confirm("Are you sure you want to Accept this declaration?")) return;
    window.showLoader();
    try {
        await window.db.collection("declarations").doc(id).update({
            admin_status: 'Accepted',
            admin_action_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        window.showToast("Declaration accepted.", "success");
        if (document.getElementById('form-admin-filter-reports')) {
            document.getElementById('form-admin-filter-reports').dispatchEvent(new Event('submit'));
        }
    } catch (err) {
        window.showToast(err.message, "error");
    }
    window.hideLoader();
};

window.adminRejectDeclaration = async function (id) {
    if (!confirm("Are you sure you want to Reject this declaration?")) return;
    window.showLoader();
    try {
        await window.db.collection("declarations").doc(id).update({
            admin_status: 'Rejected',
            admin_action_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        window.showToast("Declaration rejected.", "success");
        if (document.getElementById('form-admin-filter-reports')) {
            document.getElementById('form-admin-filter-reports').dispatchEvent(new Event('submit'));
        }
    } catch (err) {
        window.showToast(err.message, "error");
    }
    window.hideLoader();
};

window.enableBranchPrint = async (id) => {
    if (!confirm("Are you sure you want to re-enable branch printing for this declaration?")) return;

    window.showLoader();
    try {
        await window.db.collection("declarations").doc(id).update({
            print_taken: false
        });
        window.logAuditEvent("Admin Print Enable", "admin", `Re-enabled branch print for declaration ID: ${id}`);
        window.showToast("Branch printing re-enabled.", "success");
        loadDeclarations();
        loadAdminReports();
    } catch (err) {
        window.showToast(err.message, "error");
    }
    window.hideLoader();
};

window.deleteDeclaration = async (id) => {
    if (!confirm("Are you sure you want to delete this declaration? This will unlock the day for the branch and delete all associated entries (Stock, Cash, Appraisals, and Daily Totals). Proceed?")) return;

    window.showLoader();
    try {
        const declDoc = await window.db.collection("declarations").doc(id).get();
        if (declDoc.exists) {
            const declData = declDoc.data();
            const branchId = declData.branch_id;
            const dateStr = declData.date;

            if (branchId && dateStr) {
                const [stockSnap, cashSnap, appraisalSnap, totalsSnap] = await Promise.all([
                    window.db.collection("stock_transactions").where("branch_id", "==", branchId).get(),
                    window.db.collection("cash_entries").where("branch_id", "==", branchId).get(),
                    window.db.collection("daily_appraisals").where("branch_id", "==", branchId).get(),
                    window.db.collection("daily_totals").where("branch_id", "==", branchId).where("date", "==", dateStr).get()
                ]);

                const deletePromises = [];
                let stockChange = 0;

                stockSnap.forEach(docSnap => {
                    const data = docSnap.data();
                    if (getDocDateKey(data) === dateStr) {
                        if (data.status === 'approved') {
                            if (data.type === 'IN') {
                                stockChange -= 1;
                            } else if (data.type === 'OUT') {
                                stockChange += 1;
                            }
                        }
                        deletePromises.push(window.db.collection("stock_transactions").doc(docSnap.id).delete());
                    }
                });

                cashSnap.forEach(docSnap => {
                    const data = docSnap.data();
                    if (getDocDateKey(data) === dateStr) {
                        deletePromises.push(window.db.collection("cash_entries").doc(docSnap.id).delete());
                    }
                });

                appraisalSnap.forEach(docSnap => {
                    const data = docSnap.data();
                    if (getDocDateKey(data) === dateStr) {
                        deletePromises.push(window.db.collection("daily_appraisals").doc(docSnap.id).delete());
                    }
                });

                totalsSnap.forEach(docSnap => {
                    deletePromises.push(window.db.collection("daily_totals").doc(docSnap.id).delete());
                });

                if (stockChange !== 0) {
                    deletePromises.push(
                        window.db.collection("branches").doc(branchId).update({
                            total_stock: firebase.firestore.FieldValue.increment(stockChange)
                        })
                    );
                }

                if (deletePromises.length > 0) {
                    await Promise.all(deletePromises);
                    window.logAuditEvent("Admin Declaration Children Deleted", "deletion", `Deleted ${deletePromises.length} associated entries (Stock, Cash, Appraisals, Totals) for branch ${branchId} on ${dateStr}`);
                }
            }
        }

        await window.db.collection("declarations").doc(id).delete();
        window.logAuditEvent("Admin Declaration Deleted", "deletion", `Deleted declaration ID: ${id}`);
        window.showToast("Declaration and associated entries deleted successfully.", "success");
        loadDeclarations();
        loadAdminReports();
        loadStats();
    } catch (err) {
        window.showToast(err.message, "error");
    }
    window.hideLoader();
};

window.openEditBranch = (id, name, company, stock, cash, loan, lockerNumber, key1, key2) => {
    document.getElementById('edit-branch-id').value = id;
    document.getElementById('edit-branch-name').textContent = name;
    document.getElementById('edit-branch-company').value = company || '';
    document.getElementById('edit-branch-stock').value = stock;
    document.getElementById('edit-branch-cash').value = cash;
    document.getElementById('edit-branch-loan').value = loan;
    document.getElementById('edit-branch-locker-number').value = lockerNumber || '';
    document.getElementById('edit-branch-key1').value = key1 || '';
    document.getElementById('edit-branch-key2').value = key2 || '';
    document.getElementById('modal-edit-branch').classList.remove('hidden');
};

document.getElementById('form-edit-branch').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-branch-id').value;
    const company = document.getElementById('edit-branch-company').value;
    const stock = parseInt(document.getElementById('edit-branch-stock').value) || 0;
    const cash = parseInt(document.getElementById('edit-branch-cash').value) || 0;
    const loan = parseInt(document.getElementById('edit-branch-loan').value) || 0;
    const lockerNumber = document.getElementById('edit-branch-locker-number').value;
    const key1 = document.getElementById('edit-branch-key1').value;
    const key2 = document.getElementById('edit-branch-key2').value;
    window.showLoader();
    try {
        await window.db.collection("branches").doc(id).update({ company: company, total_stock: stock, physical_cash: cash, outstanding_loan: loan, locker_number: lockerNumber, key1: key1, key2: key2 });
        window.logAuditEvent("Admin Branch Edit", "admin", `Updated branch: ${id} (Stock: ${stock}, Cash: ${cash}, Loan: ${loan})`);
        window.showToast("Branch updated successfully!", "success");
        document.getElementById('modal-edit-branch').classList.add('hidden');
        loadBranches(); loadStats();
    } catch (err) { window.showToast(err.message, "error"); }
    window.hideLoader();
});

async function loadDeclarations(selectedDate = null) {
    try {
        let lastActiveDateStr = selectedDate || new Date().toISOString().split('T')[0];
        if (!selectedDate) {
            const latestTx = await window.db.collection("stock_transactions").orderBy("timestamp", "desc").limit(1).get();
            if (!latestTx.empty && latestTx.docs[0].data().timestamp) {
                lastActiveDateStr = latestTx.docs[0].data().timestamp.toDate().toISOString().split('T')[0];
            }
        }
        await renderDeclarationTable('#table-declarations-art', 60, { fromDate: lastActiveDateStr, toDate: lastActiveDateStr, company: 'ART LEASING' }, false, false);
        await renderDeclarationTable('#table-declarations-nidhi', 70, { fromDate: lastActiveDateStr, toDate: lastActiveDateStr, company: 'CHEGANNUR NIDHI' }, false, false);
    } catch (err) { console.error(err); }
}

async function updateAdminFilterBranches(selectedCompany = 'all') {
    const filterBranchSelect = document.getElementById('admin-filter-branch');
    if (!filterBranchSelect) return;

    const currentSelected = filterBranchSelect.value;
    filterBranchSelect.innerHTML = '<option value="all">All Branches</option>';

    try {
        if (!window.adminBranchesListCache) {
            const snap = await window.db.collection("branches").get();
            window.adminBranchesListCache = [];
            snap.forEach(doc => {
                window.adminBranchesListCache.push({ id: doc.id, ...doc.data() });
            });
        }

        let filtered = window.adminBranchesListCache;
        if (selectedCompany !== 'all') {
            filtered = window.adminBranchesListCache.filter(b => b.company === selectedCompany);
        }

        // Sort alphabetically A to Z
        filtered.sort((a, b) => {
            const nameA = (a.name || '').trim().toLowerCase();
            const nameB = (b.name || '').trim().toLowerCase();
            return nameA.localeCompare(nameB);
        });

        filtered.forEach(branch => {
            const opt = document.createElement('option');
            opt.value = branch.id;
            opt.textContent = branch.name || branch.id;
            if (branch.id === currentSelected) {
                opt.selected = true;
            }
            filterBranchSelect.appendChild(opt);
        });
    } catch (err) {
        console.error("Error updating admin filter branches:", err);
    }
}

async function loadAdminReports(filters = {}) {
    window.showLoader();
    try {
        // Set default filters to today's date if not provided
        if (!filters.fromDate && !filters.toDate) {
            const today = new Date().toISOString().split('T')[0];
            filters.fromDate = today;
            filters.toDate = today;
        }
        
        const totalReports = await renderDeclarationTable('#table-admin-reports', null, filters);
        const summText = document.querySelector('.report-summary');
        if (summText) summText.textContent = `Total: ${totalReports} Report(s)`;

        const companySelect = document.getElementById('admin-filter-company');
        const selectedCompany = companySelect ? companySelect.value : 'all';
        await updateAdminFilterBranches(selectedCompany);
    } catch (err) { console.error(err); }
    window.hideLoader();
}

async function loadAdminKeyReports(filters = {}) {
    if (filters instanceof Event || !filters) {
        filters = {};
    }
    try {
        const snap = await window.db.collection("key_transfers").orderBy("created_at", "desc").get();
        const tbody = document.querySelector('#table-admin-key-reports tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (snap.empty) { tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:20px;">No transfers found.</td></tr>'; return; }
        let filteredDocs = snap.docs;
        if (filters.branchId && filters.branchId !== 'all') {
            filteredDocs = filteredDocs.filter(doc => doc.data().sender_branch_id === filters.branchId || doc.data().branch_id === filters.branchId);
        }
        if (filters.fromDate) {
            const fDate = new Date(filters.fromDate); fDate.setHours(0, 0, 0, 0);
            filteredDocs = filteredDocs.filter(doc => doc.data().created_at && doc.data().created_at.toDate() >= fDate);
        }
        if (filters.toDate) {
            const tDate = new Date(filters.toDate); tDate.setHours(23, 59, 59, 999);
            filteredDocs = filteredDocs.filter(doc => doc.data().created_at && doc.data().created_at.toDate() <= tDate);
        }
        if (filters.status && filters.status !== 'all') {
            filteredDocs = filteredDocs.filter(doc => doc.data().status === filters.status);
        }

        const branchSnap = await window.db.collection("branches").get();
        const branchMap = {};
        branchSnap.forEach(b => {
            branchMap[b.id] = b.data().name || b.id;
        });

        tbody.innerHTML = filteredDocs.map(docSnap => {
            const data = docSnap.data();
            const senderBranchName = branchMap[data.branch_id] || data.branch_id || 'Unknown';
            const receiverBranchName = branchMap[data.receiver_branch_id] || data.receiver_branch_id || 'Unknown';
            const senderDisplay = `${escapeHtml(data.sender_name)} (${escapeHtml(senderBranchName)})`;
            const receiverDisplay = `${escapeHtml(data.receiver_name)} (${escapeHtml(receiverBranchName)})`;
            const typeInfo = data.transfer_type === 'temporary' ? `Temp (${formatDateDisplay(data.from_date)} to ${formatDateDisplay(data.to_date)})` : 'Permanent';
            let statusBadge = data.status === 'accepted' ? '<span class="status-badge status-approved" title="Accepted"><i class="fa-solid fa-check-double"></i></span>' :
                (data.status === 'returned' ? '<span class="status-badge" style="background:#2868ce;color:#fff;" title="Returned"><i class="fa-solid fa-arrow-rotate-left"></i></span>' :
                    (data.status === 'rejected' || data.status === 'deleted' ? '<span class="status-badge status-pending" style="color:red" title="Rejected"><i class="fa-solid fa-xmark"></i></span>' : '<span class="status-badge status-pending" title="Pending"><i class="fa-solid fa-spinner"></i></span>'));

            let actionHtml = '-';
            if (data.status === 'returned') {
                if (data.print_taken) {
                    actionHtml = `<div style="display: flex; gap: 2px; flex-direction: row; justify-content: center;">
                                    <button class="btn btn-icon btn-sm text-primary" onclick="window.enableKeyTransferPrint('${docSnap.id}')" title="Enable Print"><i class="fa-solid fa-unlock"></i></button>
                                    <button class="btn btn-icon btn-sm text-primary" onclick="window.printKeyTransferReceipt('${docSnap.id}')" title="Print"><i class="fa-solid fa-print"></i></button>
                                  </div>`;
                } else {
                    actionHtml = `<div style="display: flex; gap: 2px; flex-direction: row; justify-content: center;">
                                    <button class="btn btn-icon btn-sm text-primary" onclick="window.printKeyTransferReceipt('${docSnap.id}')" title="Print"><i class="fa-solid fa-print"></i></button>
                                  </div>`;
                }
            } else if (data.status === 'pending') {
                actionHtml = `<div style="display: flex; gap: 2px; flex-direction: row; justify-content: center;">
                                <button class="btn btn-icon btn-sm text-primary" onclick="window.adminAcceptKeyTransfer('${docSnap.id}')" title="Accept on behalf of user"><i class="fa-solid fa-check"></i></button>
                                <button class="btn btn-icon btn-sm text-warning" onclick="window.adminRejectKeyTransfer('${docSnap.id}')" title="Reject on behalf of user"><i class="fa-solid fa-xmark"></i></button>
                              </div>`;
            }

            if (actionHtml === '-') {
                actionHtml = `<div style="display: flex; gap: 2px; flex-direction: row; align-items: center; justify-content: center;">`;
            } else {
                actionHtml = actionHtml.replace('</div>', '');
            }

            if (window.currentUserData && window.currentUserData.role === 'admin') {
                actionHtml += `<button class="btn btn-icon btn-sm text-primary" onclick="window.adminDeleteKeyTransfer('${docSnap.id}')" title="Delete Transfer"><i class="fa-solid fa-trash-can"></i></button>`;
            }

            actionHtml += `</div>`;

            return `<tr>
                <td style="font-size: 0.7rem;">${data.created_at ? data.created_at.toDate().toLocaleString('en-GB') : 'N/A'}</td>
                <td style="font-size: 0.7rem;">${data.accepted_at ? data.accepted_at.toDate().toLocaleString('en-GB') : '-'}</td>
                <td style="font-size: 0.7rem;">${data.returned_at ? data.returned_at.toDate().toLocaleString('en-GB') : '-'}</td>
                <td style="font-size: 0.7rem;">${senderDisplay}</td>
                <td style="font-size: 0.7rem;">${receiverDisplay}</td>
                <td style="font-size: 0.7rem;">${escapeHtml(data.key_number)}</td>
                <td style="font-size: 0.7rem;">${escapeHtml(typeInfo)}</td>
                <td style="font-size: 0.7rem;">${escapeHtml(data.reason)}</td>
                <td style="font-size: 0.7rem;">${statusBadge}</td>
                <td>${actionHtml}</td>
            </tr>`;
        }).join('');
    } catch (err) { console.error(err); }
}

window.adminDeleteKeyTransfer = async function (transferId) {
    if (!confirm("Are you sure you want to delete this key transfer? This action cannot be undone.")) return;
    window.showLoader();
    try {
        await window.db.collection("key_transfers").doc(transferId).delete();
        window.showToast("Transfer deleted successfully.", "success");
        document.getElementById('form-admin-filter-transfer-history').dispatchEvent(new Event('submit'));
    } catch (err) {
        window.showToast(err.message, "error");
    }
    window.hideLoader();
};

window.adminRejectKeyTransfer = async function (transferId) {
    if (!confirm("Are you sure you want to forcefully reject this key transfer?")) return;
    window.showLoader();
    try {
        await window.db.collection("key_transfers").doc(transferId).update({
            status: 'rejected',
            rejected_at: firebase.firestore.FieldValue.serverTimestamp(),
            rejected_by: 'admin'
        });
        window.showToast("Transfer rejected.", "success");
        document.getElementById('form-admin-filter-transfer-history').dispatchEvent(new Event('submit'));
    } catch (err) {
        window.showToast(err.message, "error");
    }
    window.hideLoader();
};

window.adminAcceptKeyTransfer = async function (transferId) {
    if (!confirm("Are you sure you want to forcefully accept this key transfer on behalf of the user?")) return;
    window.showLoader();
    try {
        const transferDoc = await window.db.collection("key_transfers").doc(transferId).get();
        if (!transferDoc.exists) throw new Error("Transfer not found");

        const data = transferDoc.data();
        if (data.status !== 'pending') throw new Error("Transfer is not pending.");

        await window.db.collection("key_transfers").doc(transferId).update({
            status: 'accepted',
            accepted_at: firebase.firestore.FieldValue.serverTimestamp(),
            accepted_by: 'admin'
        });

        if (data.transfer_type === 'permanent') {
            const senderDoc = await window.db.collection("users").doc(data.sender_id).get();
            let senderRole = 'user';
            if (senderDoc.exists) {
                const sData = senderDoc.data();
                senderRole = sData.role || 'user';
                const sUpdates = {};
                if (sData.key1 === data.key_number) sUpdates.key1 = null;
                if (sData.key2 === data.key_number) sUpdates.key2 = null;
                if (Object.keys(sUpdates).length > 0) {
                    await window.db.collection("users").doc(data.sender_id).update(sUpdates);
                }
            }

            const receiverDoc = await window.db.collection("users").doc(data.receiver_id).get();
            if (receiverDoc.exists) {
                const rData = receiverDoc.data();
                const rUpdates = {};
                if (rData.key1 !== data.key_number && rData.key2 !== data.key_number) {
                    if (!rData.key1) rUpdates.key1 = data.key_number;
                    else rUpdates.key2 = data.key_number;
                }
                if (rData.role === 'user' || !rData.role) {
                    rUpdates.role = senderRole;
                }
                if (Object.keys(rUpdates).length > 0) {
                    await window.db.collection("users").doc(data.receiver_id).update(rUpdates);
                }
            }
        }
        window.showToast("Transfer accepted.", "success");
        document.getElementById('form-admin-filter-transfer-history').dispatchEvent(new Event('submit'));
    } catch (err) {
        window.showToast(err.message, "error");
    }
    window.hideLoader();
};

async function initAdminTransfers() {
    const sBS = document.getElementById('admin-kt-sender-branch');
    const rBS = document.getElementById('admin-kt-receiver-branch');
    const psBS = document.getElementById('admin-pkt-sender-branch');
    const prBS = document.getElementById('admin-pkt-receiver-branch');
    if (!sBS || !rBS) return;
    try {
        const snap = await window.db.collection("branches").get();
        sBS.innerHTML = rBS.innerHTML = '<option value="" disabled selected>Select Branch...</option>';
        if (psBS && prBS) {
            psBS.innerHTML = prBS.innerHTML = '<option value="" disabled selected>Select Branch...</option>';
        }
        snap.forEach(doc => {
            const opt = `<option value="${doc.id}">${escapeHtml(doc.data().name || doc.id)}</option>`;
            sBS.innerHTML += opt; rBS.innerHTML += opt;
            if (psBS && prBS) {
                psBS.innerHTML += opt; prBS.innerHTML += opt;
            }
        });
    } catch (err) { console.error(err); }
}

async function loadAdminKTUsers(branchId, selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.disabled = true;
    select.innerHTML = '<option value="" disabled selected>Loading...</option>';
    try {
        const snap = await window.db.collection("users").where("branch_id", "==", String(branchId)).get();
        select.innerHTML = '<option value="" disabled selected>Select User...</option>';
        snap.forEach(doc => {
            const data = doc.data();
            const opt = document.createElement('option');
            opt.value = doc.id; opt.dataset.name = data.name; opt.dataset.key1 = data.key1 || ''; opt.dataset.key2 = data.key2 || '';
            opt.textContent = `${data.name} (${data.role})`;
            select.appendChild(opt);
        });
        select.disabled = false;
    } catch (err) { console.error(err); }
}

async function loadReturnedKeys() {
    window.showLoader();
    try {
        console.log("Loading returned keys...");
        const snap = await window.db.collection("key_transfers").get();

        const tbody = document.querySelector('#table-admin-returned-keys tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const branchSnap = await window.db.collection("branches").get();
        const branchMap = {};
        branchSnap.forEach(b => branchMap[b.id] = b.data().name || b.id);

        const usersSnap = await window.db.collection("users").get();
        const usersMap = {};
        usersSnap.forEach(u => usersMap[u.id] = u.data());

        let count = 0;
        snap.forEach(docSnap => {
            const data = docSnap.data();
            if (data.receiver_id !== 'ADMIN' || data.status !== 'pending') return;

            count++;
            const branchName = branchMap[data.branch_id] || data.branch_id;
            const userData = usersMap[data.sender_id] || {};
            const role = userData.role || 'N/A';
            const dt = data.created_at ? data.created_at.toDate().toLocaleString('en-GB') : 'Just now';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${dt}</td>
                <td><strong>${escapeHtml(branchName)}</strong></td>
                <td><strong>${escapeHtml(data.sender_name)}</strong></td>
                <td><span class="status-badge" style="background:rgba(0,0,0,0.05); color:#666;">${role}</span></td>
                <td><span class="text-primary" style="font-weight:600;">${escapeHtml(data.key_number)}</span></td>
                <td>${escapeHtml(data.reason || '-')}</td>
                <td>
                    <button class="btn btn-success btn-sm mb-1" onclick="acceptResignationKey('${docSnap.id}', '${data.sender_id}', '${escapeHtml(data.key_number)}')">
                        <i class="fa-solid fa-check"></i> Accept & Clear Key
                    </button>
                    <button class="btn btn-danger btn-sm mb-1" onclick="rejectResignationKey('${docSnap.id}', '${data.sender_id}', '${escapeHtml(data.key_number)}')">
                        <i class="fa-solid fa-xmark"></i> Reject Return
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        if (count === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px; color: #888;">No pending key returns.</td></tr>';
        }
        console.log(`Found ${count} pending key returns.`);
    } catch (err) {
        console.error("Error loading returned keys:", err);
        window.showToast("Error loading returned keys", "error");
    }
    window.hideLoader();
}

window.acceptResignationKey = async (transferId, userId, keyNumber) => {
    if (!confirm(`Are you sure you want to accept this key (${keyNumber}) and clear it from the user's profile?`)) return;

    window.showLoader();
    try {
        const userDoc = await window.db.collection("users").doc(userId).get();
        if (!userDoc.exists) {
            throw new Error("User not found");
        }
        const userData = userDoc.data();
        const updates = {
            is_resigned: true,
            resigned_at: firebase.firestore.FieldValue.serverTimestamp(),
            locker_number: null
        };
        if (userData.key1 === keyNumber) updates.key1 = null;
        if (userData.key2 === keyNumber) updates.key2 = null;

        await window.db.collection("users").doc(userId).update(updates);
        console.log(`User ${userId} marked as resigned.`);

        await window.db.collection("key_transfers").doc(transferId).update({
            status: 'accepted',
            accepted_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Transfer ${transferId} marked as accepted.`);

        window.showToast("Key accepted and staff marked as resigned.", "success");

        // Explicitly refresh all views
        await loadReturnedKeys();
        await loadUsers();
        await loadResignedUsers();
        await loadBranches();

        // Prompt to add new user
        if (confirm("Staff has resigned and key is now available. Would you like to add a new user to this branch now?")) {
            const transferDoc = await window.db.collection("key_transfers").doc(transferId).get();
            const branchId = transferDoc.data().branch_id;

            document.getElementById('modal-add-user').classList.remove('hidden');
            const branchSelect = document.getElementById('new-user-branch');
            branchSelect.value = branchId;
            updateUserFormLockerKey(branchId, 'new-user-locker', 'new-user-key');
        }
    } catch (err) {
        console.error("Acceptance error:", err);
        window.showToast(err.message, "error");
    }
    window.hideLoader();
};

window.rejectResignationKey = async (transferId, userId, keyNumber) => {
    if (!confirm(`Are you sure you want to reject this key return (${keyNumber})? The user will continue using this key and branch.`)) return;

    window.showLoader();
    try {
        await window.db.collection("key_transfers").doc(transferId).update({
            status: 'rejected',
            rejected_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Transfer ${transferId} marked as rejected.`);

        window.showToast("Key return rejected. User will retain the key.", "success");

        await loadReturnedKeys();
        await loadUsers();
    } catch (err) {
        console.error("Rejection error:", err);
        window.showToast(err.message, "error");
    }
    window.hideLoader();
};

async function loadAdminKeyHoldingsReport(filters = {}) {
    window.showLoader();
    try {
        const dateStr = filters.date || new Date().toISOString().split('T')[0];
        const targetDate = new Date(dateStr);
        targetDate.setHours(23, 59, 59, 999);

        const branchSnap = await window.db.collection("branches").get();
        const branchMap = {};
        branchSnap.forEach(b => branchMap[b.id] = b.data().name || b.id);

        const usersSnap = await window.db.collection("users").get();
        const users = [];
        usersSnap.forEach(doc => {
            const data = doc.data();
            users.push({ id: doc.id, name: data.name, role: data.role, branch_id: data.branch_id, key1: data.key1, key1_assigned_at: data.key1_assigned_at, key2: data.key2, key2_assigned_at: data.key2_assigned_at, temporaryKeys: [], lentKeys: [], permanentlyTransferredTo: [] });
        });

        const transfersSnap = await window.db.collection("key_transfers").where("status", "in", ["accepted", "returned", "rejected"]).get();
        const transfers = [];
        transfersSnap.forEach(doc => { const d = doc.data(); d.id = doc.id; transfers.push(d); });
        transfers.sort((a, b) => (a.accepted_at?.toDate() || 0) - (b.accepted_at?.toDate() || 0));

        users.forEach(u => u.effective_branch_id = String(u.branch_id || ''));

        transfers.forEach(data => {
            const acceptedAt = data.accepted_at ? data.accepted_at.toDate() : null;
            const returnedAt = data.returned_at ? data.returned_at.toDate() : null;

            if (acceptedAt && acceptedAt <= targetDate) {
                const isActiveAtDate = (data.status === 'accepted' || data.status === 'returned' || data.status === 'pending') && (!returnedAt || returnedAt > targetDate);

                if (isActiveAtDate) {
                    const receiverUser = users.find(u => String(u.id) === String(data.receiver_id));
                    const senderUser = users.find(u => String(u.id) === String(data.sender_id));

                    if (data.transfer_type === 'temporary' && receiverUser) {
                        receiverUser.temporaryKeys.push({
                            key_number: String(data.key_number || '').trim().toUpperCase(),
                            branch_id: data.branch_id
                        });
                        receiverUser.effective_branch_id = String(data.branch_id || '');
                    }

                    if (senderUser) {
                        let displayName = data.receiver_name || 'Unknown';
                        let isResignation = data.transfer_type === 'resignation' || data.receiver_id === 'ADMIN';

                        if (isResignation) {
                            displayName = 'System Admin (Returned)';
                        }

                        senderUser.lentKeys.push({
                            key_number: String(data.key_number || '').trim().toUpperCase(),
                            receiver_name: displayName,
                            isResignation: isResignation,
                            transferId: data.id
                        });
                    }
                } else if (data.transfer_type === 'permanent' && data.status === 'accepted') {
                    const senderUser = users.find(u => String(u.id) === String(data.sender_id));
                    const receiverUser = users.find(u => String(u.id) === String(data.receiver_id));
                    if (senderUser) {
                        senderUser.permanentlyTransferredTo.push({
                            key_number: String(data.key_number || '').trim().toUpperCase(),
                            receiver_name: receiverUser ? receiverUser.name : (data.receiver_name || 'Unknown'),
                            date: acceptedAt,
                            transferId: data.id
                        });
                    }
                }
            }
        });

        const tbody = document.querySelector('#table-admin-key-holdings tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        let shownCount = 0;

        Object.keys(branchMap).forEach(branchId => {
            if (filters.branchId && filters.branchId !== 'all' && branchId !== filters.branchId) return;
            const assignedUsers = users.filter(u => String(u.branch_id || '') === branchId);
            const activeUsers = users.filter(u => u.effective_branch_id === branchId);
            let key1Info = null, key2Info = null;
            const otherKeys = [], warnings = [];

            assignedUsers.forEach(user => {
                let permKeys = [];
                if (user.key1 && (!user.key1_assigned_at || user.key1_assigned_at.toDate() <= targetDate)) permKeys.push(user.key1);
                if (user.key2 && (!user.key2_assigned_at || user.key2_assigned_at.toDate() <= targetDate)) permKeys.push(user.key2);
                permKeys.forEach(k => {
                    const searchKey = String(k || '').trim().toUpperCase();
                    const lentEntries = user.lentKeys.filter(lk => lk.key_number === searchKey);
                    const lent = lentEntries.length > 0 ? lentEntries[lentEntries.length - 1] : null;

                    const keyData = { number: k, assignedTo: user.name, role: user.role, currentlyWith: lent ? lent.receiver_name : user.name, isLent: !!lent, isResignation: lent ? lent.isResignation : false, transferId: lent ? lent.transferId : null };
                    if (!key1Info && (user.role === 'user1' || user.role === 'user1and1' || !key2Info)) key1Info = keyData;
                    else if (!key2Info && (user.role === 'user2' || key1Info.number !== k)) key2Info = keyData;
                    else otherKeys.push(keyData);
                });
            });

            activeUsers.forEach(user => {
                user.temporaryKeys.forEach(tk => {
                    if (String(tk.branch_id) !== branchId) {
                        warnings.push(`<small class="text-info d-block mt-1"><i class="fa-solid fa-key"></i> Holding ${escapeHtml(tk.key_number)} from ${escapeHtml(branchMap[tk.branch_id] || tk.branch_id)} (${escapeHtml(user.name)})</small>`);
                    }
                });
                if (String(user.branch_id || '') !== branchId) {
                    [user.key1, user.key2].filter(Boolean).forEach(k => {
                        const searchKey = String(k || '').trim().toUpperCase();
                        if (!user.lentKeys.find(lk => lk.key_number === searchKey)) {
                            warnings.push(`<small class="text-info d-block mt-1"><i class="fa-solid fa-person-walking-luggage"></i> Brought ${escapeHtml(k)} from ${escapeHtml(branchMap[user.branch_id] || user.branch_id)} (${escapeHtml(user.name)})</small>`);
                        }
                    });
                }
                if (user.branch_id === branchId && user.permanentlyTransferredTo.length > 0) {
                    const seen = new Set();
                    user.permanentlyTransferredTo.sort((a, b) => b.date - a.date).forEach(pt => {
                        if (!seen.has(pt.key_number)) { seen.add(pt.key_number); warnings.push(`<small class="text-danger d-block mt-1"><i class="fa-solid fa-arrow-right-from-bracket"></i> ${escapeHtml(user.name)} gave ${escapeHtml(pt.key_number)} to ${escapeHtml(pt.receiver_name)} <button class="btn btn-danger btn-sm mt-1" onclick="undoKeyTransfer('${pt.transferId}', '${escapeHtml(pt.key_number)}', 'permanent')" style="font-size:0.75em;"><i class="fa-solid fa-rotate-left"></i> Undo Transfer</button></small>`); }
                    });
                }
            });

            if (!key1Info && !key2Info && otherKeys.length === 0 && warnings.length === 0) return;
            const formatKey = (info) => info ? `<strong>${escapeHtml(info.number)}</strong><br><small class="text-muted">Assigned: ${escapeHtml(info.assignedTo)}</small>` : '<span class="text-muted">None</span>';
            const formatHolder = (info) => {
                if (!info) return '<span class="text-muted">-</span>';
                if (info.isResignation) {
                    return `<span class="status-badge" style="background:#ef4444; color:#fff; font-size:0.8em;"><i class="fa-solid fa-building-shield"></i> ${escapeHtml(info.currentlyWith)}</span>`;
                }
                if (info.isLent) {
                    let btnHtml = info.transferId ? `<br><button class="btn btn-warning btn-sm mt-1" onclick="undoKeyTransfer('${info.transferId}', '${escapeHtml(info.number)}', 'temporary')" style="font-size:0.75em;"><i class="fa-solid fa-rotate-left"></i> Send Back</button>` : '';
                    return `<span class="text-warning fw-bold"><i class="fa-solid fa-hand-holding-hand"></i> ${escapeHtml(info.currentlyWith)}</span>${btnHtml}`;
                }
                return `<span>${escapeHtml(info.currentlyWith)}</span>`;
            };
            let detailsHtml = otherKeys.map(k => `<span>${escapeHtml(k.number)} assigned to ${escapeHtml(k.assignedTo)}${k.isLent ? ' (Lent to ' + escapeHtml(k.currentlyWith) + ')' : ''}</span><br>`).join('') + warnings.join('');

            const tr = document.createElement('tr');
            tr.innerHTML = `<td><strong>${escapeHtml(branchMap[branchId] || branchId)}</strong></td><td>${formatKey(key1Info)}</td><td>${formatHolder(key1Info)}</td><td>${formatKey(key2Info)}</td><td>${formatHolder(key2Info)}</td><td>${detailsHtml || '-'}</td>`;
            tbody.appendChild(tr); shownCount++;
        });
        if (shownCount === 0) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">No records.</td></tr>';
    } catch (err) { console.error(err); }
    window.hideLoader();
}

setTimeout(() => {
    const fHF = document.getElementById('form-admin-filter-key-holdings');
    if (fHF) {
        document.getElementById('admin-filter-holdings-date').value = new Date().toISOString().split('T')[0];
        fHF.addEventListener('submit', (e) => { e.preventDefault(); loadAdminKeyHoldingsReport({ date: document.getElementById('admin-filter-holdings-date').value, branchId: document.getElementById('admin-filter-holdings-branch').value }); });
    }
    const kHB = document.querySelector('[data-target="admin-key-holdings"]');
    if (kHB) {
        kHB.addEventListener('click', () => {
            loadAdminKeyHoldingsReport({ date: new Date().toISOString().split('T')[0], branchId: 'all' });
            const fBS = document.getElementById('admin-filter-holdings-branch');
            if (fBS && fBS.options.length <= 1) window.db.collection("branches").get().then(snap => snap.forEach(doc => { const opt = document.createElement('option'); opt.value = doc.id; opt.textContent = doc.data().name || doc.id; fBS.appendChild(opt); }));
        });
    }
    const ktForm = document.getElementById('form-admin-emergency-transfer');
    if (ktForm) {
        document.getElementById('admin-kt-sender-branch').addEventListener('change', async (e) => {
            await loadAdminKTUsers(e.target.value, 'admin-kt-sender-user');
        });

        document.getElementById('admin-kt-receiver-branch').addEventListener('change', async (e) => {
            await loadAdminKTUsers(e.target.value, 'admin-kt-receiver-user');
        });

        document.getElementById('admin-kt-sender-user').addEventListener('change', (e) => {
            const select = e.target;
            const opt = select.options[select.selectedIndex];
            const keySelect = document.getElementById('admin-kt-number');
            keySelect.innerHTML = '<option value="" disabled selected>Select Key...</option>';

            if (opt.dataset.key1) keySelect.innerHTML += `<option value="${opt.dataset.key1}">${opt.dataset.key1}</option>`;
            if (opt.dataset.key2) keySelect.innerHTML += `<option value="${opt.dataset.key2}">${opt.dataset.key2}</option>`;

            if (keySelect.options.length <= 1) {
                keySelect.innerHTML = '<option value="" disabled selected>No keys assigned</option>';
            }
        });



        ktForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const senderSelect = document.getElementById('admin-kt-sender-user');
            const receiverSelect = document.getElementById('admin-kt-receiver-user');

            if (!senderSelect.value || !receiverSelect.value) {
                return window.showToast("Please select both sender and receiver.", "error");
            }

            const senderId = senderSelect.value;
            const senderName = senderSelect.options[senderSelect.selectedIndex].dataset.name;
            const receiverId = receiverSelect.value;
            const receiverName = receiverSelect.options[receiverSelect.selectedIndex].dataset.name;
            const keyNumber = document.getElementById('admin-kt-number').value;
            const transferType = document.getElementById('admin-kt-type').value;
            const fromDate = document.getElementById('admin-kt-from').value;
            const toDate = document.getElementById('admin-kt-to').value;
            const reason = document.getElementById('admin-kt-reason').value;

            const senderBranchId = document.getElementById('admin-kt-sender-branch').value;
            const receiverBranchId = document.getElementById('admin-kt-receiver-branch').value;

            if (!fromDate || !toDate) {
                return window.showToast("Please select both dates for temporary transfer.", "error");
            }

            window.showLoader();
            try {
                await window.db.collection("key_transfers").add({
                    branch_id: senderBranchId,
                    sender_id: senderId,
                    sender_name: senderName,
                    receiver_id: receiverId,
                    receiver_name: receiverName,
                    receiver_branch_id: receiverBranchId,
                    key_number: keyNumber,
                    transfer_type: transferType,
                    from_date: fromDate || null,
                    to_date: toDate || null,
                    reason: reason,
                    status: 'pending',
                    created_at: firebase.firestore.FieldValue.serverTimestamp()
                });
                window.showToast("Emergency key transfer request sent successfully!", "success");
                ktForm.reset();
            } catch (error) {
                window.showToast(error.message, "error");
            }
            window.hideLoader();
        });
    }

    const pktForm = document.getElementById('form-admin-permanent-transfer');
    if (pktForm) {
        document.getElementById('admin-pkt-sender-branch').addEventListener('change', async (e) => {
            await loadAdminKTUsers(e.target.value, 'admin-pkt-sender-user');
        });

        document.getElementById('admin-pkt-receiver-branch').addEventListener('change', async (e) => {
            await loadAdminKTUsers(e.target.value, 'admin-pkt-receiver-user');
        });

        document.getElementById('admin-pkt-sender-user').addEventListener('change', (e) => {
            const select = e.target;
            const opt = select.options[select.selectedIndex];
            const keySelect = document.getElementById('admin-pkt-number');
            keySelect.innerHTML = '<option value="" disabled selected>Select Key...</option>';

            if (opt.dataset.key1) keySelect.innerHTML += `<option value="${opt.dataset.key1}">${opt.dataset.key1}</option>`;
            if (opt.dataset.key2) keySelect.innerHTML += `<option value="${opt.dataset.key2}">${opt.dataset.key2}</option>`;

            if (keySelect.options.length <= 1) {
                keySelect.innerHTML = '<option value="" disabled selected>No keys assigned</option>';
            }
        });

        pktForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const senderSelect = document.getElementById('admin-pkt-sender-user');
            const receiverSelect = document.getElementById('admin-pkt-receiver-user');

            if (!senderSelect.value || !receiverSelect.value) {
                return window.showToast("Please select both sender and receiver.", "error");
            }

            const senderId = senderSelect.value;
            const senderName = senderSelect.options[senderSelect.selectedIndex].dataset.name;
            const receiverId = receiverSelect.value;
            const receiverName = receiverSelect.options[receiverSelect.selectedIndex].dataset.name;
            const keyNumber = document.getElementById('admin-pkt-number').value;
            const transferType = document.getElementById('admin-pkt-type').value;
            const reason = document.getElementById('admin-pkt-reason').value;

            const senderBranchId = document.getElementById('admin-pkt-sender-branch').value;
            const receiverBranchId = document.getElementById('admin-pkt-receiver-branch').value;

            window.showLoader();
            try {
                await window.db.collection("key_transfers").add({
                    branch_id: senderBranchId,
                    sender_id: senderId,
                    sender_name: senderName,
                    receiver_id: receiverId,
                    receiver_name: receiverName,
                    receiver_branch_id: receiverBranchId,
                    key_number: keyNumber,
                    transfer_type: transferType,
                    from_date: null,
                    to_date: null,
                    reason: reason,
                    status: 'pending',
                    created_at: firebase.firestore.FieldValue.serverTimestamp()
                });
                window.showToast("Permanent key transfer request sent successfully!", "success");
                pktForm.reset();
            } catch (error) {
                window.showToast(error.message, "error");
            }
            window.hideLoader();
        });
    }
}, 600);

async function initBackdateApproval() {
    const branchSelect = document.getElementById('backdate-branch');
    if (!branchSelect) return;

    try {
        const snap = await window.db.collection("branches").get();
        branchSelect.innerHTML = '<option value="" disabled selected>Select Branch...</option>';
        snap.forEach(doc => {
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.textContent = doc.data().name || doc.id;
            branchSelect.appendChild(opt);
        });
    } catch (err) { console.error("Error loading branches for backdate:", err); }

    const form = document.getElementById('form-backdate-approval');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const branchId = branchSelect.value;
            const date = document.getElementById('backdate-date').value;

            if (!branchId || !date) return;

            window.showLoader();
            try {
                // Check if already exists/approved
                const docId = branchId + "_" + date;
                await window.db.collection("backdate_approvals").doc(docId).set({
                    branch_id: branchId,
                    date: date,
                    status: 'approved',
                    approved_by: window.currentUser.uid,
                    approved_at: firebase.firestore.FieldValue.serverTimestamp()
                });
                window.showToast("Backdate approval granted successfully.", "success");
                form.reset();
                loadBackdateApprovals();
            } catch (err) {
                window.showToast(err.message, "error");
            }
            window.hideLoader();
        });
    }
}

async function loadBackdateApprovals() {
    const tbody = document.querySelector('#table-backdate-approvals tbody');
    if (!tbody) return;

    window.showLoader();
    try {
        const [snap, branchSnap] = await Promise.all([
            window.db.collection("backdate_approvals").orderBy("approved_at", "desc").get(),
            window.db.collection("branches").get()
        ]);

        const branchMap = {};
        branchSnap.forEach(b => branchMap[b.id] = b.data().name || b.id);

        tbody.innerHTML = '';
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No backdate approvals found.</td></tr>';
        } else {
            snap.forEach(docSnap => {
                const data = docSnap.data();
                const branchName = branchMap[data.branch_id] || 'Unknown';
                const approvedAt = data.approved_at ? data.approved_at.toDate().toLocaleString('en-GB') : 'N/A';
                const statusClass = data.status === 'approved' ? 'status-approved' : 'status-pending';

                let deleteBtnHtml = '';
                if (window.currentUserData && window.currentUserData.role === 'admin') {
                    deleteBtnHtml = `<button class="btn btn-icon" onclick="deleteBackdateApproval('${docSnap.id}')" title="Delete Approval">
                                        <i class="fa-solid fa-trash"></i>
                                     </button>`;
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${branchName}</strong></td>
                    <td>${formatDateDisplay(data.date)}</td>
                    <td class="text-muted" style="font-size:0.9em;">${approvedAt}</td>
                    <td><span class="status-badge ${statusClass}">${data.status}</span></td>
                    <td>${deleteBtnHtml}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (err) {
        console.error("Error loading backdate approvals:", err);
    }
    window.hideLoader();
}

window.deleteBackdateApproval = async (id) => {
    if (!confirm("Are you sure you want to remove this backdate approval?")) return;

    window.showLoader();
    try {
        await window.db.collection("backdate_approvals").doc(id).delete();
        window.showToast("Approval removed.", "success");
        loadBackdateApprovals();
    } catch (err) {
        window.showToast(err.message, "error");
    }
    window.hideLoader();
};

async function loadResignedUsers() {
    window.showLoader();
    try {
        console.log("Loading resigned users...");
        const snap = await window.db.collection("users").get();

        const tbody = document.querySelector('#table-resigned-users tbody');
        if (!tbody) {
            console.error("Resigned users table body not found!");
            window.hideLoader();
            return;
        }
        tbody.innerHTML = '';

        const branchSnap = await window.db.collection("branches").get();
        const branchMap = {};
        branchSnap.forEach(b => branchMap[b.id] = b.data().name || b.id);

        const users = [];
        snap.forEach(docSnap => {
            const data = docSnap.data();
            if (!data.is_resigned) return;

            // Try to get branch name from map, then from the user record directly if stored, then ID
            const branchName = (data.role === 'admin' || data.role === 'hr' || data.role === 'ho') ? 'N/A' : (branchMap[data.branch_id] || data.branch_name || data.branch_id || '-');
            users.push({ docSnap, data, branchName });
        });

        // Sort resigned users A to Z by branch name (and by user name if branch name is the same)
        users.sort((a, b) => {
            const bNameA = a.branchName.toLowerCase();
            const bNameB = b.branchName.toLowerCase();
            if (bNameA !== bNameB) {
                return bNameA.localeCompare(bNameB);
            }
            const uNameA = (a.data.name || '').toLowerCase();
            const uNameB = (b.data.name || '').toLowerCase();
            return uNameA.localeCompare(uNameB);
        });

        let count = 0;
        users.forEach(({ docSnap, data, branchName }) => {
            count++;
            const resignedDt = data.resigned_at ? data.resigned_at.toDate().toLocaleString('en-GB') : 'N/A';

            const tr = document.createElement('tr');
            // Use safer onclick with escaped values
            const safeName = escapeHtml(data.name).replace(/'/g, "\\'");
            const safeRole = (data.role || '').replace(/'/g, "\\'");
            const safeBranch = (data.branch_id || '').replace(/'/g, "\\'");
            const safeKey1 = (data.key1 || '').replace(/'/g, "\\'");
            const safeKey2 = (data.key2 || '').replace(/'/g, "\\'");
            const safeEmail = (data.email || '').replace(/'/g, "\\'");

            tr.innerHTML = `
                <td><strong>${escapeHtml(data.name)}</strong></td>
                <td>${escapeHtml(data.email)}</td>
                <td><span class="status-badge" style="background:rgba(0,0,0,0.05); color:#666;">${data.role}</span></td>
                <td>${escapeHtml(branchName)}</td>
                <td>${resignedDt}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="openEditUser('${docSnap.id}', '${safeName}', '${safeRole}', '${safeBranch}', '${safeKey1}', '${safeKey2}', true, '${safeEmail}')" title="View/Edit Details">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        if (count === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: #888;">No resigned users found.</td></tr>';
        }
        console.log(`Found ${count} resigned users.`);
    } catch (err) {
        console.error("Error loading resigned users:", err);
        window.showToast("Error loading resigned users", "error");
    }
    window.hideLoader();
}

async function loadAuditLogs() {
    window.showLoader();
    try {
        const typeFilter = document.getElementById('audit-filter-action').value;
        const fromDateStr = document.getElementById('audit-filter-from').value;
        const toDateStr = document.getElementById('audit-filter-to').value;

        let query = window.db.collection("audit_logs").orderBy("timestamp", "desc").limit(200);

        if (typeFilter && typeFilter !== 'all') {
            query = query.where("type", "==", typeFilter);
        }

        const [snap, branchSnap] = await Promise.all([
            query.get(),
            window.db.collection("branches").get()
        ]);
        const branchMap = {};
        branchSnap.forEach(b => branchMap[b.id] = b.data().name || b.id);

        const tbody = document.querySelector('#table-audit-logs tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: #888;">No audit logs found.</td></tr>';
            window.hideLoader();
            return;
        }

        let logs = snap.docs.map(doc => doc.data());

        // Client-side date filtering
        if (fromDateStr) {
            const fDate = new Date(fromDateStr); fDate.setHours(0, 0, 0, 0);
            logs = logs.filter(l => l.timestamp && l.timestamp.toDate() >= fDate);
        }
        if (toDateStr) {
            const tDate = new Date(toDateStr); tDate.setHours(23, 59, 59, 999);
            logs = logs.filter(l => l.timestamp && l.timestamp.toDate() <= tDate);
        }

        tbody.innerHTML = logs.map(data => {
            const ts = data.timestamp ? data.timestamp.toDate().toLocaleString('en-GB') : 'N/A';
            const actionBadge = `<span class="status-badge" style="background: rgba(79, 240, 47, 0.75); color: #333; font-size:0.8em; margin-right:5px;">${data.type.toUpperCase()}</span>`;
            const branchName = branchMap[data.branch_id] || data.branch_name || data.branch_id || 'N/A';
            return `<tr>
                <td style="font-size: 0.85em; white-space: nowrap; color: #ffffffff;">${ts}</td>
                <td><strong>${escapeHtml(data.user_name)}</strong><br><small class="text-muted" style="font-size:0.9em; color:#fff">${escapeHtml(branchName)}</small></td>
                <td><span style="font-size:0.85em;">${escapeHtml(data.user_role)}</span></td>
                <td>${actionBadge} <strong>${escapeHtml(data.action)}</strong></td>
                <td style="font-size: 0.85em; color: #ffffffff;">${escapeHtml(data.details)}</td>
            </tr>`;
        }).join('');

    } catch (err) {
        console.error("Error loading audit logs:", err);
    }
    window.hideLoader();
}
window.loadAuditLogs = loadAuditLogs;

window.undoKeyTransfer = async (transferId, keyNumber, type) => {
    if (!confirm(`Are you sure you want to forcefully send back key ${keyNumber}?`)) return;
    window.showLoader();
    try {
        const transferDoc = await window.db.collection("key_transfers").doc(transferId).get();
        if (transferDoc.exists) {
            const data = transferDoc.data();
            if (type === 'permanent') {
                const senderId = data.sender_id;
                const receiverId = data.receiver_id;
                const senderDoc = await window.db.collection("users").doc(senderId).get();
                const receiverDoc = await window.db.collection("users").doc(receiverId).get();

                if (senderDoc.exists) {
                    const sData = senderDoc.data();
                    const sUpdates = {};
                    if (!sData.key1) sUpdates.key1 = keyNumber;
                    else if (!sData.key2) sUpdates.key2 = keyNumber;
                    if (Object.keys(sUpdates).length > 0) await window.db.collection("users").doc(senderId).update(sUpdates);
                }
                if (receiverDoc.exists) {
                    const rData = receiverDoc.data();
                    const rUpdates = {};
                    if (rData.key1 === keyNumber) rUpdates.key1 = null;
                    if (rData.key2 === keyNumber) rUpdates.key2 = null;
                    if (Object.keys(rUpdates).length > 0) await window.db.collection("users").doc(receiverId).update(rUpdates);
                }
            }
            await window.db.collection("key_transfers").doc(transferId).update({
                status: 'returned',
                returned_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            window.showToast("Key sent back successfully.", "success");
            const dateStr = document.getElementById('admin-filter-holdings-date') ? document.getElementById('admin-filter-holdings-date').value : undefined;
            const branchId = document.getElementById('admin-filter-holdings-branch') ? document.getElementById('admin-filter-holdings-branch').value : undefined;
            loadAdminKeyHoldingsReport({ date: dateStr, branchId: branchId });
        }
    } catch (e) {
        window.showToast(e.message, "error");
    }
    window.hideLoader();
};