document.querySelectorAll('.cash-input').forEach(input => {
    input.addEventListener('input', updateCashTotal);
});

function updateCashTotal() {
    const c500 = parseInt(document.getElementById('cash-500').value) || 0;
    const c200 = parseInt(document.getElementById('cash-200').value) || 0;
    const c100 = parseInt(document.getElementById('cash-100').value) || 0;
    const c50 = parseInt(document.getElementById('cash-50').value) || 0;
    const c20 = parseInt(document.getElementById('cash-20').value) || 0;
    const c10 = parseInt(document.getElementById('cash-10').value) || 0;
    const coins = parseInt(document.getElementById('cash-coins').value) || 0;

    const total = (c500 * 500) + (c200 * 200) + (c100 * 100) + (c50 * 50) + (c20 * 20) + (c10 * 10) + coins;
    document.getElementById('cash-total-display').textContent = total.toLocaleString();
    return { c500, c200, c100, c50, c20, c10, coins, total };
}

document.addEventListener('initUser1', async () => {
    const userData = window.currentUserData;
    const branchId = userData.branch_id ? String(userData.branch_id) : '';

    try {
        const branchDoc = await window.db.collection("branches").doc(branchId).get();
        if (branchDoc.exists) {
            const bData = branchDoc.data();
            const u1Name = document.getElementById('u1-branch-name');
            if (u1Name) u1Name.textContent = bData.name || branchId;
            const u1Stock = document.getElementById('u1-total-stock');
            if (u1Stock) u1Stock.textContent = bData.total_stock || 0;
            const u1Loan = document.getElementById('u1-total-loan');
            if (u1Loan) u1Loan.textContent = "₹" + (bData.outstanding_loan || 0).toLocaleString();
        } else {
            const u1Name = document.getElementById('u1-branch-name');
            if (u1Name) u1Name.textContent = "Unknown Branch";
        }
    } catch (err) {
        console.error("Error fetching branch data:", err);
    }

    const user1ReportsBtn = document.querySelector('[data-target="user1-reports"]');
    if (user1ReportsBtn) {
        user1ReportsBtn.addEventListener('click', () => loadBranchReports('table-user1-reports'));
    }
    await checkBackdateApproval('user1');
    loadUser1Entries();
});

document.getElementById('btn-u1-exit-backdate').addEventListener('click', () => {
    window.activeBackdate = null;
    document.getElementById('u1-backdate-banner').classList.add('hidden');
    loadUser1Entries();
});

async function loadUser1Entries() {
    try {
        const branchId = window.currentUserData.branch_id ? String(window.currentUserData.branch_id) : '';
        const now = new Date();

        let dateStr = now.toISOString().split('T')[0];
        let startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (window.activeBackdate) {
            dateStr = window.activeBackdate;
            const [y, m, d] = dateStr.split('-').map(Number);
            startOfDay = new Date(y, m - 1, d);
        }

        const dateBadge = document.getElementById('u1-active-date');
        if (dateBadge) dateBadge.textContent = formatDateDisplay(dateStr);

        const endOfDay = new Date(startOfDay);
        endOfDay.setHours(23, 59, 59, 999);

        const tbody = document.querySelector('#table-my-entries tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        let entries = [];

        const btnStockIn = document.querySelector('#form-stock-in button[type="submit"]');
        const btnStockOut = document.querySelector('#form-stock-out button[type="submit"]');
        const btnCash = document.querySelector('#form-cash-entry button[type="submit"]');
        const btnAppraisals = document.querySelector('#form-appraisals button[type="submit"]');
        const btnBranchTotals = document.querySelector('#form-branch-totals button[type="submit"]');

        if (btnStockIn) { btnStockIn.disabled = false; btnStockIn.innerHTML = 'Submit Gold IN'; }
        if (btnStockOut) { btnStockOut.disabled = false; btnStockOut.innerHTML = 'Submit Gold OUT'; }
        if (btnCash) { btnCash.disabled = false; btnCash.innerHTML = '<i class="fa-solid fa-money-bill-wave"></i> Submit Cash'; }
        if (btnAppraisals) { btnAppraisals.disabled = false; btnAppraisals.innerHTML = '<i class="fa-solid fa-upload"></i> Submit Appraisals'; }
        if (btnBranchTotals) { btnBranchTotals.disabled = false; btnBranchTotals.innerHTML = '<i class="fa-solid fa-upload"></i> Update Totals'; }

        try {
            const snapStock = await window.db.collection("stock_transactions").where("branch_id", "==", branchId).get();
            snapStock.forEach(doc => {
                const d = doc.data();
                const txDateObj = d.timestamp && typeof d.timestamp.toDate === 'function' ? d.timestamp.toDate() : new Date();

                if (txDateObj >= startOfDay && txDateObj <= endOfDay) {
                    entries.push({ id: doc.id, collection: 'stock_transactions', time: txDateObj, type: 'Stock ' + d.type, details: d.stock_number, status: d.status });
                    if (d.type === 'IN' && btnStockIn) { btnStockIn.disabled = true; btnStockIn.innerHTML = 'Submitted for Date'; }
                    if (d.type === 'OUT' && btnStockOut) { btnStockOut.disabled = true; btnStockOut.innerHTML = 'Submitted for Date'; }
                }
            });
        } catch (e) { console.error("Stock fetch error:", e); }

        try {
            const snapCash = await window.db.collection("cash_entries").where("branch_id", "==", branchId).get();
            snapCash.forEach(doc => {
                const d = doc.data();
                const txDateObj = d.timestamp && typeof d.timestamp.toDate === 'function' ? d.timestamp.toDate() : new Date();

                if (txDateObj >= startOfDay && txDateObj <= endOfDay) {
                    entries.push({ id: doc.id, collection: 'cash_entries', time: txDateObj, type: 'Cash', details: '₹' + d.total_amount, status: d.status });
                    if (btnCash) { btnCash.disabled = true; btnCash.innerHTML = 'Submitted for Date'; }
                }
            });
        } catch (e) { console.error("Cash fetch error:", e); }

        try {
            const snapAppraisals = await window.db.collection("daily_appraisals").where("branch_id", "==", branchId).get();
            snapAppraisals.forEach(doc => {
                const d = doc.data();
                const txDateObj = d.timestamp && typeof d.timestamp.toDate === 'function' ? d.timestamp.toDate() : new Date();

                if (txDateObj >= startOfDay && txDateObj <= endOfDay) {
                    entries.push({ id: doc.id, collection: 'daily_appraisals', time: txDateObj, type: 'Appraisals', details: `${d.appraised} Appraised, ${d.not_appraised || 0} Not Appraised`, status: d.status });
                    if (btnAppraisals) { btnAppraisals.disabled = true; btnAppraisals.innerHTML = 'Submitted for Date'; }
                }
            });
        } catch (e) { console.error("Appraisals fetch error:", e); }

        try {
            const snapTotals = await window.db.collection("daily_totals").where("branch_id", "==", branchId).where("date", "==", dateStr).get();
            if (!snapTotals.empty) {
                const docSnap = snapTotals.docs[0];
                const d = docSnap.data();
                const txDateObj = d.timestamp && typeof d.timestamp.toDate === 'function' ? d.timestamp.toDate() : new Date();
                entries.push({ id: docSnap.id, collection: 'daily_totals', time: txDateObj, type: 'Branch Totals', details: `Stock: ${d.total_stock}, Loan: ₹${d.outstanding_loan.toLocaleString()}`, status: 'approved' });
                if (btnBranchTotals) { btnBranchTotals.disabled = true; btnBranchTotals.innerHTML = 'Submitted for Date'; }
            }
        } catch (e) { console.error("Totals fetch error:", e); }

        let signed = false;
        try {
            const docId = branchId + "_" + dateStr;
            const decl = await window.db.collection("declarations").doc(docId).get();
            if (decl.exists && decl.data().user1_status === 'Signed') {
                signed = true;
                const d = decl.data();
                const txDateObj = d.timestamp && typeof d.timestamp.toDate === 'function' ? d.timestamp.toDate() : new Date();
                entries.push({ time: txDateObj, type: 'Declaration', details: 'End of Day', status: 'approved' });

                document.getElementById('btn-u1-declare').disabled = true;
                document.getElementById('btn-u1-declare').textContent = 'Signed';
                document.getElementById('u1-declare-status').innerHTML = `<i class="fa-solid fa-check text-success"></i> Declaration already signed for ${formatDateDisplay(dateStr)}.`;

                if (btnBranchTotals) { btnBranchTotals.disabled = true; btnBranchTotals.innerHTML = 'Locked'; }
            } else {
                let allDataEntered = (btnCash && btnCash.disabled) && (btnAppraisals && btnAppraisals.disabled) && (btnBranchTotals && btnBranchTotals.disabled);

                if (allDataEntered) {
                    document.getElementById('btn-u1-declare').disabled = false;
                    document.getElementById('btn-u1-declare').textContent = 'Sign Declaration';
                    document.getElementById('u1-declare-status').innerHTML = '';
                } else {
                    document.getElementById('btn-u1-declare').disabled = true;
                    document.getElementById('btn-u1-declare').textContent = 'Complete Entries First';
                    document.getElementById('u1-declare-status').innerHTML = '<span class="text-warning"><i class="fa-solid fa-triangle-exclamation"></i> Please submit Cash, Appraisals, and Branch Totals before signing.</span>';
                }

                if (btnBranchTotals && btnBranchTotals.innerHTML !== 'Submitted for Date') { btnBranchTotals.disabled = false; btnBranchTotals.innerHTML = '<i class="fa-solid fa-upload"></i> Update Totals'; }
            }
        } catch (e) { console.error("Declaration fetch error:", e); }

        entries.sort((a, b) => b.time - a.time);

        const canDelete = !signed;

        entries.forEach(e => {
            const tr = document.createElement('tr');
            const badgeClass = e.status === 'approved' ? 'status-approved' : 'status-pending';
            const displayTime = e.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            let actionHtml = '-';
            const isDeletableStatus = e.status === 'pending' || e.collection === 'daily_totals';
            if (canDelete && e.id && e.collection && isDeletableStatus) {
                actionHtml = `<button class="btn btn-icon btn-sm text-danger" onclick="deleteUser1Entry('${e.collection}', '${e.id}')" title="Delete Entry"><i class="fa-solid fa-trash-can"></i></button>`;
            }

            tr.innerHTML = `
                <td>${displayTime}</td>
                <td><strong>${e.type}</strong></td>
                <td>${e.details}</td>
                <td><span class="status-badge ${badgeClass}">${e.status}</span></td>
                <td>${actionHtml}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error loading user 1 entries:", error);
    }
}

// Prevent Enter key from submitting forms
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'textarea') {
        const form = e.target.closest('form');
        if (form && (form.id.startsWith('form-') || form.id === 'login-form')) {
            e.preventDefault();
            return false;
        }
    }
});

window.deleteUser1Entry = async (collection, id) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;

    window.showLoader();
    try {
        await window.db.collection(collection).doc(id).delete();
        window.logAuditEvent("Entry Deleted", "deletion", `Deleted ${id} from ${collection}`);
        window.showToast("Entry deleted successfully.", "success");
        loadUser1Entries();
    } catch (error) {
        window.showToast(error.message, "error");
    }
    window.hideLoader();
};

document.getElementById('form-stock-in').addEventListener('submit', async (e) => {
    e.preventDefault();
    const stockNo = document.getElementById('stock-in-number').value.trim();
    if (!stockNo) {
        window.showToast("Please enter the Stock Number.", "error");
        return;
    }

    window.showLoader();
    try {
        await window.db.collection("stock_transactions").add({
            branch_id: window.currentUserData.branch_id,
            stock_number: stockNo,
            type: 'IN',
            status: 'pending',
            entered_by: window.currentUser.uid,
            timestamp: window.activeBackdate ? new Date(window.activeBackdate + 'T12:00:00') : firebase.firestore.FieldValue.serverTimestamp()
        });
        window.showToast("Gold IN submitted for verification.", "success");
        document.getElementById('form-stock-in').reset();
        loadUser1Entries();
    } catch (error) {
        window.showToast(error.message, "error");
    }
    window.hideLoader();
});

document.getElementById('form-stock-out').addEventListener('submit', async (e) => {
    e.preventDefault();
    const stockNo = document.getElementById('stock-out-number').value.trim();
    if (!stockNo) {
        window.showToast("Please enter the Stock Number.", "error");
        return;
    }

    window.showLoader();
    try {
        await window.db.collection("stock_transactions").add({
            branch_id: window.currentUserData.branch_id,
            stock_number: stockNo,
            type: 'OUT',
            status: 'pending',
            entered_by: window.currentUser.uid,
            timestamp: window.activeBackdate ? new Date(window.activeBackdate + 'T12:00:00') : firebase.firestore.FieldValue.serverTimestamp()
        });
        window.showToast("Gold OUT submitted for verification.", "success");
        document.getElementById('form-stock-out').reset();
        loadUser1Entries();
    } catch (error) {
        window.showToast(error.message, "error");
    }
    window.hideLoader();
});

document.getElementById('form-branch-totals').addEventListener('submit', async (e) => {
    e.preventDefault();
    const loanAmountInput = document.getElementById('loan-amount-input').value;
    const stockAmountInput = document.getElementById('stock-amount-input').value;

    if (loanAmountInput === "" || stockAmountInput === "") {
        window.showToast("Please enter the value for both Loan and Stock.", "error");
        return;
    }

    const loanAmount = parseInt(loanAmountInput) || 0;
    const stockAmount = parseInt(stockAmountInput) || 0;
    const branchId = window.currentUserData.branch_id;
    const dateStr = window.activeBackdate || new Date().toISOString().split('T')[0];

    window.showLoader();
    try {
        const existing = await window.db.collection("daily_totals").where("branch_id", "==", branchId).where("date", "==", dateStr).get();
        if (!existing.empty) {
            throw new Error("Branch totals already submitted for today.");
        }

        await window.db.collection("daily_totals").add({
            branch_id: branchId,
            outstanding_loan: loanAmount,
            total_stock: stockAmount,
            date: dateStr,
            entered_by: window.currentUser.uid,
            timestamp: window.activeBackdate ? new Date(window.activeBackdate + 'T12:00:00') : firebase.firestore.FieldValue.serverTimestamp()
        });

        window.showToast("Branch totals submitted for today's report.", "success");
        document.getElementById('form-branch-totals').reset();
        loadUser1Entries();
    } catch (error) {
        window.showToast(error.message, "error");
    }
    window.hideLoader();
});

document.getElementById('form-cash-entry').addEventListener('submit', async (e) => {
    e.preventDefault();
    // Check for empty inputs
    const cashInputs = document.querySelectorAll('.cash-input');
    for (let input of cashInputs) {
        if (input.value === "") {
            window.showToast("Please enter the value (enter 0 if no cash for this denomination).", "error");
            return;
        }
    }

    const { c500, c200, c100, c50, c20, c10, coins, total } = updateCashTotal();

    if (total <= 0) {
        window.showToast("Please enter the cash denominations.", "error");
        return;
    }

    window.showLoader();
    try {
        await window.db.collection("cash_entries").add({
            branch_id: window.currentUserData.branch_id,
            denominations: { '500': c500, '200': c200, '100': c100, '50': c50, '20': c20, '10': c10, 'coins': coins },
            total_amount: total,
            status: 'pending',
            entered_by: window.currentUser.uid,
            timestamp: window.activeBackdate ? new Date(window.activeBackdate + 'T12:00:00') : firebase.firestore.FieldValue.serverTimestamp()
        });
        window.showToast("Cash entry submitted for verification.", "success");
        document.getElementById('form-cash-entry').reset();
        updateCashTotal();
        loadUser1Entries();
    } catch (error) {
        window.showToast(error.message, "error");
    }
    window.hideLoader();
});

document.getElementById('form-appraisals').addEventListener('submit', async (e) => {
    e.preventDefault();
    const appraisedInput = document.getElementById('appraised-amount').value;
    const notAppraisedInput = document.getElementById('not-appraised-amount').value;

    if (appraisedInput === "" || notAppraisedInput === "") {
        window.showToast("Please enter the value for both Appraised and Not Appraised packets.", "error");
        return;
    }

    const appraised = parseInt(appraisedInput) || 0;
    const notAppraised = parseInt(notAppraisedInput) || 0;

    window.showLoader();
    try {
        await window.db.collection("daily_appraisals").add({
            branch_id: window.currentUserData.branch_id,
            appraised: appraised,
            not_appraised: notAppraised,
            status: 'pending',
            entered_by: window.currentUser.uid,
            timestamp: window.activeBackdate ? new Date(window.activeBackdate + 'T12:00:00') : firebase.firestore.FieldValue.serverTimestamp()
        });
        window.showToast("Appraisal counts submitted for verification.", "success");
        document.getElementById('form-appraisals').reset();
        loadUser1Entries();
    } catch (error) {
        window.showToast(error.message, "error");
    }
    window.hideLoader();
});

document.getElementById('btn-u1-declare').addEventListener('click', async () => {
    const btnDeclare = document.getElementById('btn-u1-declare');
    if (btnDeclare.disabled || btnDeclare.textContent.includes('Complete')) {
        window.showToast("Please complete all required entries (Cash, Appraisals, Branch Totals) before signing.", "error");
        return;
    }

    const key1 = document.getElementById('u1-key-1').value.trim();
    const key2 = document.getElementById('u1-key-2').value.trim();
    if (!key1 && !key2) {
        window.showToast("Please enter at least one Key Number.", "error");
        return;
    }

    window.showLoader();
    try {
        const date = window.activeBackdate || new Date().toISOString().split('T')[0];
        const branchId = window.currentUserData.branch_id;
        const docId = branchId + "_" + date;

        let stockIn = 0;
        let stockOut = 0;
        let cashTotal = 0;
        let appraised = 0;
        let notAppraised = 0;

        const snapStock = await window.db.collection("stock_transactions").where("branch_id", "==", branchId).get();
        snapStock.forEach(doc => {
            const data = doc.data();
            const txDate = data.timestamp ? data.timestamp.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            if (txDate === date) {
                if (data.type === 'IN') stockIn++;
                if (data.type === 'OUT') stockOut++;
            }
        });

        const snapCash = await window.db.collection("cash_entries").where("branch_id", "==", branchId).get();
        const snapCashArray = [];
        snapCash.forEach(doc => snapCashArray.push(doc.data()));
        snapCashArray.forEach(data => {
            const txDate = data.timestamp ? data.timestamp.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            if (txDate === date) {
                cashTotal += data.total_amount || 0;
            }
        });

        const snapAppraisals = await window.db.collection("daily_appraisals").where("branch_id", "==", branchId).get();
        snapAppraisals.forEach(doc => {
            const data = doc.data();
            const txDate = data.timestamp ? data.timestamp.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            if (txDate === date) {
                appraised += data.appraised || 0;
                notAppraised += data.not_appraised || 0;
            }
        });

        const branchDoc = await window.db.collection("branches").doc(branchId).get();
        const bData = branchDoc.exists ? branchDoc.data() : {};
        let totalStock = bData.total_stock || 0;
        let outstandingLoan = bData.outstanding_loan || 0;

        const snapTotals = await window.db.collection("daily_totals").where("branch_id", "==", branchId).where("date", "==", date).get();
        if (!snapTotals.empty) {
            const tData = snapTotals.docs[0].data();
            totalStock = tData.total_stock !== undefined ? tData.total_stock : totalStock;
            outstandingLoan = tData.outstanding_loan !== undefined ? tData.outstanding_loan : outstandingLoan;
        }

        const is1and1 = window.currentUserData.active_roles ? window.currentUserData.active_roles.includes('user1and1') : window.currentUserData.role === 'user1and1';

        await window.db.collection("declarations").doc(docId).set({
            branch_id: branchId,
            user1_id: window.currentUser.uid,
            user1_name: window.currentUserData.name,
            user1_status: "Signed",
            user1_key1: key1,
            user1_key2: key2,
            user1_signed_at: window.activeBackdate ? new Date(window.activeBackdate + 'T12:00:00') : new Date(),
            ...(is1and1 ? {
                user2_id: "Auto-1and1",
                user2_name: "System (1 and 1)",
                user2_status: "Signed",
                user2_key1: "N/A",
                user2_key2: "N/A",
                user2_signed_at: window.activeBackdate ? new Date(window.activeBackdate + 'T12:00:00') : new Date()
            } : {}),
            stock_in: stockIn,
            stock_out: stockOut,
            cash_total: cashTotal,
            appraised: appraised,
            not_appraised: notAppraised,
            total_stock: totalStock,
            outstanding_loan: outstandingLoan,
            date: date,
            timestamp: window.activeBackdate ? new Date(window.activeBackdate + 'T12:00:00') : firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        document.getElementById('u1-declare-status').innerHTML = '<i class="fa-solid fa-check text-success"></i> Declaration signed digitally.';
        await window.logAuditEvent("Declaration Signed", "declaration", `End of Day signed for ${date} with keys: ${key1}, ${key2}`);
        window.showToast("Declaration saved.", "success");
        loadUser1Entries();

        if (is1and1 && typeof window.printSingleDeclaration === 'function') {
            window.printSingleDeclaration(branchId, date);
        }
    } catch (e) {
        window.showToast(e.message, "error");
    }
    window.hideLoader();
});

document.addEventListener('initUser2', async () => {
    const userData = window.currentUserData;
    const branchId = userData.branch_id ? String(userData.branch_id) : '';

    try {
        const branchDoc = await window.db.collection("branches").doc(branchId).get();
        if (branchDoc.exists) {
            const bData = branchDoc.data();
            const u2Name = document.getElementById('u2-branch-name');
            if (u2Name) u2Name.textContent = bData.name || branchId;
            const u2Stock = document.getElementById('u2-total-stock');
            if (u2Stock) u2Stock.textContent = bData.total_stock || 0;
            const u2Loan = document.getElementById('u2-total-loan');
            if (u2Loan) u2Loan.textContent = "₹" + (bData.outstanding_loan || 0).toLocaleString();
        } else {
            const u2Name = document.getElementById('u2-branch-name');
            if (u2Name) u2Name.textContent = "Unknown Branch";
        }
    } catch (err) {
        console.error("Error fetching branch data:", err);
    }

    await checkBackdateApproval('user2');
    await loadPendingVerifications(branchId);
    checkUser2Declaration();

    const user2ReportsBtn = document.querySelector('[data-target="user2-reports"]');
    if (user2ReportsBtn) {
        user2ReportsBtn.addEventListener('click', () => loadBranchReports('table-user2-reports'));
    }
});

document.querySelectorAll('[data-target="user2-verify"]').forEach(btn => {
    btn.addEventListener('click', async () => {
        const activeBranchId = window.currentUserData && window.currentUserData.branch_id ? String(window.currentUserData.branch_id) : null;
        if (!activeBranchId) return;
        await checkBackdateApproval('user2');
        await loadPendingVerifications(activeBranchId);
        checkUser2Declaration();
    });
});

document.getElementById('btn-u2-exit-backdate').addEventListener('click', async () => {
    window.activeBackdate = null;
    document.getElementById('u2-backdate-banner').classList.add('hidden');
    const activeBranchId = window.currentUserData && window.currentUserData.branch_id ? String(window.currentUserData.branch_id) : null;
    await loadPendingVerifications(activeBranchId);
    checkUser2Declaration();
});

async function checkBackdateApproval(role) {
    const branchId = window.currentUserData.branch_id ? String(window.currentUserData.branch_id) : '';
    if (!branchId) return;

    try {
        const snap = await window.db.collection("backdate_approvals")
            .where("branch_id", "==", branchId)
            .where("status", "==", "approved")
            .get();

        if (!snap.empty) {
            const data = snap.docs[0].data();
            window.activeBackdate = data.date;
            const banner = document.getElementById(role + '-backdate-banner');
            const text = document.getElementById(role + '-backdate-text');
            if (banner && text) {
                text.textContent = `Backdate Mode: ${role === 'user1' ? 'Entries' : 'Verifying'} for ${formatDateDisplay(data.date)}`;
                banner.classList.remove('hidden');
            }
        } else {
            window.activeBackdate = null;
            const banner = document.getElementById(role + '-backdate-banner');
            if (banner) banner.classList.add('hidden');
        }
    } catch (err) { console.error("Error checking backdate approval:", err); }
}

async function checkUser2Declaration() {
    const branchId = window.currentUserData.branch_id ? String(window.currentUserData.branch_id) : '';
    const date = window.activeBackdate || new Date().toISOString().split('T')[0];
    const docId = branchId + "_" + date;
    try {
        const decl = await window.db.collection("declarations").doc(docId).get();

        let inCount = document.querySelectorAll('#table-pending-stock-in tbody tr td button').length;
        let outCount = document.querySelectorAll('#table-pending-stock-out tbody tr td button').length;
        let cashCount = document.querySelectorAll('#table-pending-cash tbody tr td button').length;
        let appCount = document.querySelectorAll('#table-pending-appraisals tbody tr td button').length;
        let totalPending = inCount + outCount + cashCount + appCount;

        if (decl.exists && decl.data().user2_status === 'Signed') {
            document.getElementById('btn-u2-declare').disabled = true;
            document.getElementById('btn-u2-declare').textContent = 'Signed';
            document.getElementById('u2-declare-status').innerHTML = `<i class="fa-solid fa-check text-success"></i> Declaration already signed for ${formatDateDisplay(date)}.`;
        } else if (!decl.exists || decl.data().user1_status !== 'Signed') {
            document.getElementById('btn-u2-declare').disabled = true;
            document.getElementById('btn-u2-declare').textContent = 'Waiting for Maker';
            document.getElementById('u2-declare-status').innerHTML = '<span class="text-warning"><i class="fa-solid fa-triangle-exclamation"></i> Maker must complete and sign their declaration first.</span>';
        } else if (totalPending > 0) {
            document.getElementById('btn-u2-declare').disabled = true;
            document.getElementById('btn-u2-declare').textContent = 'Pending Approvals';
            document.getElementById('u2-declare-status').innerHTML = '<span class="text-warning"><i class="fa-solid fa-triangle-exclamation"></i> You must approve all pending entries before signing.</span>';
        } else {
            document.getElementById('btn-u2-declare').disabled = false;
            document.getElementById('btn-u2-declare').textContent = 'Sign Declaration';
            document.getElementById('u2-declare-status').innerHTML = '';
        }
    } catch (e) { console.error("Error checking declaration:", e); }
}

async function loadPendingVerifications(branchId) {
    try {
        branchId = String(branchId || '');
        const now = new Date();
        let startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let dateStr = now.toISOString().split('T')[0];

        if (window.activeBackdate) {
            dateStr = window.activeBackdate;
            const [y, m, d] = dateStr.split('-').map(Number);
            startOfDay = new Date(y, m - 1, d);
        }

        const dateBadge = document.getElementById('u2-active-date');
        if (dateBadge) dateBadge.textContent = formatDateDisplay(dateStr);

        const endOfDay = new Date(startOfDay);
        endOfDay.setHours(23, 59, 59, 999);

        let todayAppraised = 0;
        let todayPending = 0;

        const snapAllAppraisals = await window.db.collection("daily_appraisals").where("branch_id", "==", branchId).get();
        snapAllAppraisals.forEach(doc => {
            const data = doc.data();
            let txDate = new Date();
            if (data.timestamp && typeof data.timestamp.toDate === 'function') {
                txDate = data.timestamp.toDate();
            } else if (data.timestamp) {
                txDate = new Date(data.timestamp);
            }
            if (txDate >= startOfDay && txDate <= endOfDay && data.status === 'approved') {
                todayAppraised += data.appraised || 0;
                todayPending += data.not_appraised || 0;
            }
        });

        const elAppraised = document.getElementById('u2-today-appraised');
        const elPending = document.getElementById('u2-today-pending');
        if (elAppraised) elAppraised.textContent = todayAppraised;
        if (elPending) elPending.textContent = todayPending;

        const snapStock = await window.db.collection("stock_transactions").where("branch_id", "==", branchId).get();
        const tbodyStockIn = document.querySelector('#table-pending-stock-in tbody');
        const tbodyStockOut = document.querySelector('#table-pending-stock-out tbody');

        if (tbodyStockIn) tbodyStockIn.innerHTML = '';
        if (tbodyStockOut) tbodyStockOut.innerHTML = '';

        let inCount = 0;
        let outCount = 0;

        snapStock.forEach(docSnap => {
            const data = docSnap.data();
            if (data.status !== 'pending') return;

            let txDate = new Date();
            if (data.timestamp && typeof data.timestamp.toDate === 'function') txDate = data.timestamp.toDate();
            else if (data.timestamp) txDate = new Date(data.timestamp);

            if (txDate < startOfDay || txDate > endOfDay) return;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-size: 1em; font-weight: bold; color: #ffffffff;">${data.stock_number}</td>
                <td><button class="btn btn-primary btn-sm" onclick="approveStock('${docSnap.id}', '${data.type}', '${branchId}')"><i class="fa-solid fa-stamp"></i> Approve</button></td>
            `;
            if (data.type === 'IN') {
                if (tbodyStockIn) tbodyStockIn.appendChild(tr);
                inCount++;
            } else if (data.type === 'OUT') {
                if (tbodyStockOut) tbodyStockOut.appendChild(tr);
                outCount++;
            }
        });

        if (inCount === 0 && tbodyStockIn) {
            tbodyStockIn.innerHTML = `<tr><td colspan="2" class="text-center text-muted">No pending Stock IN</td></tr>`;
        }
        if (outCount === 0 && tbodyStockOut) {
            tbodyStockOut.innerHTML = `<tr><td colspan="2" class="text-center text-muted">No pending Stock OUT</td></tr>`;
        }

        const snapCash = await window.db.collection("cash_entries").where("branch_id", "==", branchId).get();
        const tbodyCash = document.querySelector('#table-pending-cash tbody');
        if (tbodyCash) {
            tbodyCash.innerHTML = '';
            snapCash.forEach(docSnap => {
                const data = docSnap.data();
                if (data.status !== 'pending') return;

                let txDate = new Date();
                if (data.timestamp && typeof data.timestamp.toDate === 'function') txDate = data.timestamp.toDate();
                else if (data.timestamp) txDate = new Date(data.timestamp);

                if (txDate < startOfDay || txDate > endOfDay) return;

                const tr = document.createElement('tr');
                const denoms = data.denominations || {};
                const denomText = `500x${denoms['500'] || 0}, ` +
                    `200x${denoms['200'] || 0}, ` +
                    `100x${denoms['100'] || 0}, ` +
                    `50x${denoms['50'] || 0}, ` +
                    `20x${denoms['20'] || 0}, ` +
                    `10x${denoms['10'] || 0}, ` +
                    `Coins: ₹${denoms['coins'] || 0}`;

                tr.innerHTML = `
                    <td style="font-size: 1em; font-weight: bold; color: #ffffffff;">₹${data.total_amount.toLocaleString()}</td>
                    <td class="text-muted" style="font-size: 0.85em; max-width: 250px; white-space: normal;">${denomText}</td>
                    <td><button class="btn btn-primary btn-sm" onclick="approveCash('${docSnap.id}', ${data.total_amount}, '${branchId}')"><i class="fa-solid fa-stamp"></i> Approve</button></td>
                `;
                tbodyCash.appendChild(tr);
            });
        }

        const snapAppraisals = await window.db.collection("daily_appraisals").where("branch_id", "==", branchId).get();
        const tbodyAppraisals = document.querySelector('#table-pending-appraisals tbody');
        if (tbodyAppraisals) {
            tbodyAppraisals.innerHTML = '';
            snapAppraisals.forEach(docSnap => {
                const data = docSnap.data();
                if (data.status !== 'pending') return;

                let txDate = new Date();
                if (data.timestamp && typeof data.timestamp.toDate === 'function') txDate = data.timestamp.toDate();
                else if (data.timestamp) txDate = new Date(data.timestamp);

                if (txDate < startOfDay || txDate > endOfDay) return;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-size: 1em; font-weight: bold; color: #ffffffff;">${data.appraised}</td>
                    <td style="font-size: 1em; font-weight: bold; color: #ffffffff;">${data.not_appraised}</td>
                    <td><button class="btn btn-primary btn-sm" onclick="approveAppraisal('${docSnap.id}', '${branchId}')"><i class="fa-solid fa-stamp"></i> Approve</button></td>
                `;
                tbodyAppraisals.appendChild(tr);
            });
        }
    } catch (error) {
        console.error("Error in loadPendingVerifications:", error);
    }
}

window.approveStock = async (txId, type, branchId) => {
    window.showLoader();
    try {
        await window.db.collection("stock_transactions").doc(txId).update({ status: 'approved', verified_by: window.currentUser.uid });
        const inc = type === 'IN' ? 1 : -1;
        await window.db.collection("branches").doc(branchId).update({ total_stock: firebase.firestore.FieldValue.increment(inc) });
        window.showToast("Stock entry approved.", "success");
        await loadPendingVerifications(branchId);
        checkUser2Declaration();
    } catch (e) { window.showToast(e.message, "error"); }
    window.hideLoader();
};

window.approveCash = async (txId, amount, branchId) => {
    window.showLoader();
    try {
        await window.db.collection("cash_entries").doc(txId).update({ status: 'approved', verified_by: window.currentUser.uid });
        await window.db.collection("branches").doc(branchId).update({ physical_cash: amount });
        window.showToast("Cash entry approved.", "success");
        await loadPendingVerifications(branchId);
        checkUser2Declaration();
    } catch (e) { window.showToast(e.message, "error"); }
    window.hideLoader();
};

window.approveAppraisal = async (txId, branchId) => {
    window.showLoader();
    try {
        await window.db.collection("daily_appraisals").doc(txId).update({ status: 'approved', verified_by: window.currentUser.uid });
        window.showToast("Appraisal entry approved.", "success");
        await loadPendingVerifications(branchId);
        checkUser2Declaration();
    } catch (e) { window.showToast(e.message, "error"); }
    window.hideLoader();
};

document.getElementById('btn-u2-declare').addEventListener('click', async () => {
    const key1 = document.getElementById('u2-key-1').value.trim();
    const key2 = document.getElementById('u2-key-2').value.trim();
    if (!key1 && !key2) {
        window.showToast("Please enter at least one Key Number.", "error");
        return;
    }

    window.showLoader();
    try {
        const date = window.activeBackdate || new Date().toISOString().split('T')[0];
        const branchId = window.currentUserData.branch_id;
        const docId = branchId + "_" + date;
        await window.db.collection("declarations").doc(docId).set({
            branch_id: branchId,
            user2_id: window.currentUser.uid,
            user2_name: window.currentUserData.name,
            user2_status: "Signed",
            user2_key1: key1,
            user2_key2: key2,
            user2_signed_at: window.activeBackdate ? new Date(window.activeBackdate + 'T12:00:00') : new Date(),
            date: date,
            timestamp: window.activeBackdate ? new Date(window.activeBackdate + 'T12:00:00') : firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        if (window.activeBackdate) {
            // Mark approval as used
            await window.db.collection("backdate_approvals").doc(branchId + "_" + window.activeBackdate).update({ status: 'used' });
            window.activeBackdate = null;
            document.getElementById('u2-backdate-banner').classList.add('hidden');
        }

        document.getElementById('u2-declare-status').innerHTML = '<i class="fa-solid fa-check text-success"></i> Declaration signed digitally.';
        window.showToast("Declaration completed and signed.", "success");
        checkUser2Declaration();
    } catch (e) {
        window.showToast(e.message, "error");
    }
    window.hideLoader();
});

async function loadBranchReports(tableId, filterFrom = null, filterTo = null) {
    window.showLoader();
    try {
        const currentUid = window.currentUser.uid;
        const [snap1, snap2] = await Promise.all([
            window.db.collection("declarations").where("user1_id", "==", currentUid).get(),
            window.db.collection("declarations").where("user2_id", "==", currentUid).get()
        ]);

        const uniqueDocsMap = new Map();
        snap1.forEach(d => uniqueDocsMap.set(d.id, d.data()));
        snap2.forEach(d => uniqueDocsMap.set(d.id, d.data()));
        let docs = Array.from(uniqueDocsMap.values());

        if (filterFrom) {
            docs = docs.filter(d => d.date >= filterFrom);
        }
        if (filterTo) {
            docs = docs.filter(d => d.date <= filterTo);
        }

        docs.sort((a, b) => b.date.localeCompare(a.date));

        const tbody = document.querySelector(`#${tableId} tbody`);
        tbody.innerHTML = '';

        const branchSnap = await window.db.collection("branches").get();
        const branchMap = {};
        const branchDataMap = {};
        branchSnap.forEach(b => {
            branchMap[b.id] = b.data().name || b.id;
            branchDataMap[b.id] = b.data();
        });

        const reportSectionId = tableId === 'table-user2-reports' ? 'user2-reports' : 'user1-reports';
        const summaryText = docs.length
            ? `My Detailed Logs | ${docs.length} report${docs.length === 1 ? '' : 's'}`
            : `My Detailed Logs | No reports available`;
        window.updateReportHeader(reportSectionId, summaryText);

        if (docs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding: 20px; color: #888;">No reports available.</td></tr>';
            window.hideLoader();
            return;
        }

        const escapeHtml = (value) => String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const formatLocalDateKey = (dateValue) => {
            if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) return '';
            const year = dateValue.getFullYear();
            const month = String(dateValue.getMonth() + 1).padStart(2, '0');
            const day = String(dateValue.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const getDocDateKey = (data) => {
            if (!data || !data.timestamp || typeof data.timestamp.toDate !== 'function') {
                return data && typeof data.date === 'string' ? data.date : '';
            }
            return formatLocalDateKey(data.timestamp.toDate());
        };

        const formatCurrencyValue = (amount) => `₹${Number(amount || 0).toLocaleString()}`;
        const formatStockNumbers = (entries) => {
            if (!entries || !entries.length) return '-';
            return entries.map(entry => escapeHtml(entry.stockNumber || 'Unknown')).join(', ');
        };

        const getDeclarationDaySummary = async (specificBranchId, date, declarationData = null) => {
            const summary = {
                stockInEntries: [],
                stockOutEntries: [],
                cashEntries: [],
                appraisalEntries: [],
                approvedCashTotal: 0,
                approvedAppraised: 0,
                approvedNotAppraised: 0
            };

            const isMaker1and1 = declarationData && declarationData.user2_id === "Auto-1and1";

            const [stockSnap, cashSnap, appraisalSnap] = await Promise.all([
                window.db.collection("stock_transactions").where("branch_id", "==", specificBranchId).get(),
                window.db.collection("cash_entries").where("branch_id", "==", specificBranchId).get(),
                window.db.collection("daily_appraisals").where("branch_id", "==", specificBranchId).get()
            ]);

            stockSnap.forEach(docSnap => {
                const entry = docSnap.data();
                if (getDocDateKey(entry) !== date) return;
                const stockEntry = {
                    stockNumber: entry.stock_number || 'Unknown',
                    status: entry.status || 'pending'
                };
                if (entry.type === 'IN') summary.stockInEntries.push(stockEntry);
                if (entry.type === 'OUT') summary.stockOutEntries.push(stockEntry);
            });

            cashSnap.forEach(docSnap => {
                const entry = docSnap.data();
                if (getDocDateKey(entry) !== date) return;
                const totalAmount = entry.total_amount || 0;
                summary.cashEntries.push({
                    totalAmount,
                    denominations: entry.denominations || {},
                    status: entry.status || 'pending'
                });
                summary.approvedCashTotal += totalAmount;
            });

            appraisalSnap.forEach(docSnap => {
                const entry = docSnap.data();
                if (getDocDateKey(entry) !== date) return;
                const appraised = entry.appraised || 0;
                const notAppraised = entry.not_appraised || 0;
                summary.appraisalEntries.push({
                    appraised,
                    notAppraised,
                    status: entry.status || 'pending'
                });
                summary.approvedAppraised += appraised;
                summary.approvedNotAppraised += notAppraised;
            });

            return summary;
        };

        const rows = await Promise.all(docs.map(async (data) => {
            const rowBranchId = data.branch_id;
            const branchName = branchMap[rowBranchId] || "Unknown";
            const rowBranchData = branchDataMap[rowBranchId] || {};

            const daySummary = await getDeclarationDaySummary(rowBranchId, data.date, data);

            const totalsSnap = await window.db.collection("daily_totals")
                .where("branch_id", "==", rowBranchId)
                .where("date", "==", data.date)
                .get();

            let totalStockInLocker = data.total_stock !== undefined ? data.total_stock : (rowBranchData.total_stock || 0);
            let outstandingLoan = data.outstanding_loan !== undefined ? data.outstanding_loan : (rowBranchData.outstanding_loan || 0);

            if (!totalsSnap.empty) {
                const tData = totalsSnap.docs[0].data();
                totalStockInLocker = tData.total_stock !== undefined ? tData.total_stock : totalStockInLocker;
                outstandingLoan = tData.outstanding_loan !== undefined ? tData.outstanding_loan : outstandingLoan;
            }

            const isComplete = (data.user1_status === 'Signed' && data.user2_status === 'Signed');
            const finalStatus = isComplete
                ? '<span class="status-badge status-approved"><i class="fa-solid fa-check"></i></span>'
                : '<span class="status-badge status-pending"><i class="fa-solid fa-exclamation-triangle"></i></span>';
            const makerInfo = data.user1_status === 'Signed' ? escapeHtml(data.user1_name || 'Signed') : '<i class="fa-solid fa-exclamation-triangle"></i>';
            const checkerInfo = data.user2_status === 'Signed' ? escapeHtml(data.user2_name || 'Signed') : '<i class="fa-solid fa-exclamation-triangle"></i>';

            let printBtnHtml = '';
            const isAdmin = window.currentUserData.role === 'admin';

            if (!isComplete) {
                printBtnHtml = `<button class="btn btn-secondary btn-sm" disabled style="padding: 4px 10px; font-size: 12px; opacity: 0.5; cursor: not-allowed; display: inline-flex; align-items: center; gap: 4px;" title="Pending Maker & Checker signatures"><i class="fa-solid fa-print"></i> Print</button>`;
            } else if (data.print_taken && !isAdmin) {
                printBtnHtml = `<span class="status-badge" style="background: rgba(107, 114, 128, 0.2); color: #6b7280; font-size: 11px;"><i class="fa-solid fa-check"></i> Printed</span>`;
            } else {
                printBtnHtml = `<button class="btn btn-primary btn-sm" onclick="window.printSingleDeclaration('${rowBranchId}', '${data.date}')" style="padding: 4px 10px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-print"></i> Print</button>`;
            }

            return `
                <tr>
                    <td style="vertical-align: top;"><strong>${escapeHtml(formatDateDisplay(data.date) || 'N/A')}</strong></td>
                    <td style="vertical-align: top;"><strong>${escapeHtml(branchName)}</strong></td>
                    <td>${makerInfo}</td>
                    <td>${checkerInfo}</td>
                    <td>${formatStockNumbers(daySummary.stockInEntries)}</td>
                    <td>${formatStockNumbers(daySummary.stockOutEntries)}</td>
                    <td>${formatCurrencyValue(daySummary.approvedCashTotal)}</td>
                    <td>${daySummary.approvedAppraised}</td>
                    <td>${daySummary.approvedNotAppraised}</td>
                    <td>${totalStockInLocker}</td>
                    <td>${formatCurrencyValue(outstandingLoan)}</td>
                    <td style="text-align: center;">${finalStatus}</td>
                    <td style="text-align: center;">${printBtnHtml}</td>
                </tr>
            `;
        }));

        tbody.innerHTML = rows.join('');
    } catch (err) {
        console.error("Error loading branch reports:", err);
    }
    window.hideLoader();
}

// ==========================================
// KEY TRANSFER LOGIC
// ==========================================

document.querySelectorAll('[data-target="branch-key-transfer"]').forEach(btn => {
    btn.addEventListener('click', () => {
        initKeyTransferView();
    });
});

document.querySelectorAll('[data-target="user1-key-history"]').forEach(btn => {
    btn.addEventListener('click', () => {
        loadKeyTransferHistory('table-key-history-user1');
    });
});

document.querySelectorAll('[data-target="user2-key-history"]').forEach(btn => {
    btn.addEventListener('click', () => {
        loadKeyTransferHistory('table-key-history-user2');
    });
});

document.querySelectorAll('[data-target="reserve-key-history"]').forEach(btn => {
    btn.addEventListener('click', () => {
        loadKeyTransferHistory('table-key-history-reserve');
    });
});

document.getElementById('key-transfer-type').addEventListener('change', (e) => {
    const val = e.target.value;
    const tempDates = document.getElementById('temp-key-dates');
    const branchSel = document.getElementById('key-transfer-branch').parentElement;
    const userSel = document.getElementById('key-transfer-to').parentElement;
    const toSelect = document.getElementById('key-transfer-to');
    const branchSelect = document.getElementById('key-transfer-branch');

    if (val === 'temporary') {
        tempDates.classList.remove('hidden');
        branchSel.classList.remove('hidden');
        userSel.classList.remove('hidden');
        toSelect.required = true;
        branchSelect.required = true;
    } else if (val === 'resignation') {
        tempDates.classList.add('hidden');
        branchSel.classList.add('hidden');
        userSel.classList.add('hidden');
        toSelect.required = false;
        branchSelect.required = false;
    } else {
        tempDates.classList.add('hidden');
        branchSel.classList.remove('hidden');
        userSel.classList.remove('hidden');
        toSelect.required = true;
        branchSelect.required = true;
    }
});

async function initKeyTransferView() {
    window.showLoader();
    try {
        const branchId = window.currentUserData.branch_id;
        const dateStr = new Date().toISOString().split('T')[0];
        const docId = branchId + "_" + dateStr;

        const decl = await window.db.collection("declarations").doc(docId).get();
        let hasDeclared = false;

        if (decl.exists) {
            const data = decl.data();
            const rolesToCheck = window.currentUserData.active_roles || [window.currentUserData.role];
            if ((rolesToCheck.includes('user1') || rolesToCheck.includes('user1and1')) && data.user1_status === 'Signed') hasDeclared = true;
            if (rolesToCheck.includes('user2') && data.user2_status === 'Signed') hasDeclared = true;
            if (rolesToCheck.includes('admin')) hasDeclared = true; // Admins bypass this block
        }

        if (!hasDeclared) {
            document.getElementById('key-transfer-blocked').classList.remove('hidden');
            document.getElementById('key-transfer-form-container').classList.add('hidden');
        } else {
            document.getElementById('key-transfer-blocked').classList.add('hidden');
            document.getElementById('key-transfer-form-container').classList.remove('hidden');

            const ktSelect = document.getElementById('key-transfer-number');
            if (ktSelect) {
                ktSelect.innerHTML = '';
                let hasKeys = false;
                if (window.currentUserData.key1) {
                    ktSelect.innerHTML += `<option value="${window.currentUserData.key1}">${window.currentUserData.key1}</option>`;
                    hasKeys = true;
                }
                if (window.currentUserData.key2) {
                    ktSelect.innerHTML += `<option value="${window.currentUserData.key2}">${window.currentUserData.key2}</option>`;
                    hasKeys = true;
                }
                if (!hasKeys) {
                    ktSelect.innerHTML = `<option value="" disabled selected>No keys assigned in profile</option>`;
                }
            }

            await loadKeyTransferBranches();
        }

        await loadPendingKeyTransfers();
        await loadActiveTemporaryKeys();
    } catch (err) {
        console.error(err);
        window.showToast("Error loading key transfer view", "error");
    }
    window.hideLoader();
}

async function loadKeyTransferBranches() {
    const selectBranch = document.getElementById('key-transfer-branch');
    selectBranch.innerHTML = '<option value="" disabled selected>Loading...</option>';

    try {
        const snap = await window.db.collection("branches").get();
        selectBranch.innerHTML = '<option value="" disabled selected>Select Branch...</option>';
        snap.forEach(doc => {
            const data = doc.data();
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.textContent = data.name || doc.id;
            selectBranch.appendChild(opt);
        });

        const defaultBranchId = window.currentUserData.original_branch_id || window.currentUserData.branch_id;
        selectBranch.value = defaultBranchId;
        await loadKeyTransferUsers(defaultBranchId);
    } catch (err) {
        console.error("Error loading branches", err);
    }
}

document.getElementById('key-transfer-branch').addEventListener('change', async (e) => {
    await loadKeyTransferUsers(e.target.value);
});

async function loadKeyTransferUsers(branchId) {
    const select = document.getElementById('key-transfer-to');
    select.disabled = true;
    select.innerHTML = '<option value="" disabled selected>Loading Users...</option>';

    const snap = await window.db.collection("users").where("branch_id", "==", branchId).get();
    select.innerHTML = '<option value="" disabled selected>Select User...</option>';
    let hasUsers = false;
    snap.forEach(doc => {
        if (doc.id !== window.currentUser.uid) {
            hasUsers = true;
            const data = doc.data();
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.dataset.name = data.name;
            opt.textContent = `${data.name} (${data.role})`;
            select.appendChild(opt);
        }
    });

    if (hasUsers) {
        select.disabled = false;
    } else {
        select.innerHTML = '<option value="" disabled selected>No other users</option>';
    }
}

document.getElementById('form-key-transfer').addEventListener('submit', async (e) => {
    e.preventDefault();
    const toSelect = document.getElementById('key-transfer-to');
    const keyNumber = document.getElementById('key-transfer-number').value;
    const transferType = document.getElementById('key-transfer-type').value;
    const fromDate = document.getElementById('key-transfer-from').value;
    const toDate = document.getElementById('key-transfer-to-date').value;
    const reason = document.getElementById('key-transfer-reason').value;

    let finalReceiverId = toSelect.value;
    let finalReceiverName = "";
    let finalReceiverBranchId = document.getElementById('key-transfer-branch').value;

    if (transferType === 'resignation') {
        if (!confirm("Are you sure you want to resign and return your key to the Admin? This action cannot be undone.")) return;
        finalReceiverId = 'ADMIN';
        finalReceiverName = 'System Admin';
        finalReceiverBranchId = 'ADMIN';
    } else {
        if (toSelect.selectedIndex !== -1) {
            finalReceiverName = toSelect.options[toSelect.selectedIndex].dataset.name;
        }

        if (transferType === 'temporary' && (!fromDate || !toDate)) {
            window.showToast("Please provide both From and To dates for temporary transfers.", "error");
            return;
        }
        if (!finalReceiverId) {
            window.showToast("Please select a receiver.", "error");
            return;
        }
    }

    window.showLoader();
    try {
        const existingTransfersSnap = await window.db.collection("key_transfers")
            .where("sender_id", "==", window.currentUser.uid)
            .where("key_number", "==", keyNumber)
            .where("status", "in", ["pending", "accepted"])
            .get();

        if (!existingTransfersSnap.empty) {
            window.showToast("You already have an active or pending transfer for this key.", "error");
            window.hideLoader();
            return;
        }

        await window.db.collection("key_transfers").add({
            branch_id: window.currentUserData.original_branch_id || window.currentUserData.branch_id,
            receiver_branch_id: finalReceiverBranchId,
            sender_id: window.currentUser.uid,
            sender_name: window.currentUserData.name,
            receiver_id: finalReceiverId,
            receiver_name: finalReceiverName,
            key_number: keyNumber,
            transfer_type: transferType,
            from_date: fromDate || null,
            to_date: toDate || null,
            reason: reason,
            status: 'pending',
            created_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        window.showToast("Key transfer request sent.", "success");
        document.getElementById('form-key-transfer').reset();
    } catch (err) {
        window.showToast(err.message, "error");
    }
    window.hideLoader();
});

async function loadPendingKeyTransfers() {
    const tbody = document.querySelector('#table-incoming-keys tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const snap = await window.db.collection("key_transfers")
        .where("receiver_id", "==", window.currentUser.uid)
        .get();

    let hasPending = false;
    snap.forEach(doc => {
        const data = doc.data();
        if (data.status !== 'pending') return;
        hasPending = true;

        const tr = document.createElement('tr');
        const dt = data.created_at ? data.created_at.toDate().toLocaleString('en-GB') : 'Just now';

        const typeInfo = data.transfer_type === 'temporary'
            ? `Temporary (${data.from_date} to ${data.to_date})`
            : 'Permanent';

        const escapeHtml = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

        tr.innerHTML = `
            <td style="text-align: center;">${dt}</td>
            <td style="text-align: center;"><strong>${escapeHtml(data.sender_name)}</strong></td>
            <td style="text-align: center;">${escapeHtml(data.key_number)}</td>
            <td style="text-align: center;">${escapeHtml(typeInfo)}</td>
            <td style="text-align: center;">${escapeHtml(data.reason)}</td>
            <td style="text-align: center;">
                <div style="display: flex; gap: 5px;">
                    <button class="btn btn-success btn-sm" style="font-size: 11px; font-weight: 700; background-color: green; color: white;" onclick="openAcceptKeyModal('${doc.id}', '${escapeHtml(data.key_number)}', '${escapeHtml(data.sender_name)}')">Accept</button>
                    <button class="btn btn-danger btn-sm" style="font-size: 11px; font-weight: 700; background-color: red; color: white;" onclick="rejectKeyTransfer('${doc.id}')">Reject</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (!hasPending) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: #888;">No pending incoming requests.</td></tr>';
    }
}

window.loadActiveTemporaryKeys = async function () {
    const tbody = document.querySelector('#table-active-keys tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const snap = await window.db.collection("key_transfers")
        .where("receiver_id", "==", window.currentUser.uid)
        .get();

    const branchSnap = await window.db.collection("branches").get();
    const branchMap = {};
    branchSnap.forEach(b => {
        branchMap[b.id] = b.data().name || b.id;
    });

    let hasKeys = false;
    snap.forEach(doc => {
        const data = doc.data();
        if (data.status !== 'accepted' || data.transfer_type !== 'temporary') return;
        hasKeys = true;

        const tr = document.createElement('tr');
        const dt = data.accepted_at ? data.accepted_at.toDate().toLocaleDateString('en-GB') : 'Unknown';
        const branchName = branchMap[data.branch_id] || data.branch_id || 'Unknown';
        const escapeHtml = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

        tr.innerHTML = `
            <td>${dt}</td>
            <td><strong>${escapeHtml(data.sender_name)}</strong></td>
            <td>${escapeHtml(branchName)}</td>
            <td>${escapeHtml(data.key_number)}</td>
            <td>${escapeHtml(formatDateDisplay(data.from_date))} to ${escapeHtml(formatDateDisplay(data.to_date))}</td>
            <td>
                <button class="btn btn-primary btn-sm" style="font-size: 12px; font-weight: 500; background-color: var(--gold); color: black;" onclick="returnTemporaryKey('${doc.id}')">Return Key</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (!hasKeys) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: #888;">No active temporary keys.</td></tr>';
    }
};

window.returnTemporaryKey = async function (transferId) {
    if (!confirm("Are you sure you want to return this key?")) return;

    window.showLoader();
    try {
        await window.db.collection("key_transfers").doc(transferId).update({
            status: 'returned',
            returned_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        window.showToast("Key returned successfully. Generating printout...", "success");
        if (typeof window.printKeyTransferReceipt === 'function') {
            await window.printKeyTransferReceipt(transferId, true);
        } else {
            setTimeout(() => window.location.reload(), 1000);
        }
    } catch (err) {
        window.showToast(err.message, "error");
        window.hideLoader();
    }
};

window.rejectKeyTransfer = async function (transferId) {
    if (!confirm("Are you sure you want to reject this key transfer request?")) return;

    window.showLoader();
    try {
        await window.db.collection("key_transfers").doc(transferId).update({
            status: 'rejected',
            rejected_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        window.showToast("Key transfer rejected successfully.", "success");
        await loadPendingKeyTransfers();
    } catch (err) {
        window.showToast(err.message, "error");
    }
    window.hideLoader();
};

window.openAcceptKeyModal = async (transferId, keyNumber, senderName) => {
    document.getElementById('accept-key-number').textContent = keyNumber;
    document.getElementById('accept-key-sender').textContent = senderName;
    document.getElementById('accept-key-transfer-id').value = transferId;

    document.getElementById('accept-key-stock').textContent = "Loading...";
    document.getElementById('accept-key-cash').textContent = "Loading...";
    document.getElementById('modal-accept-key').classList.remove('hidden');

    try {
        const transferDoc = await window.db.collection("key_transfers").doc(transferId).get();
        if (!transferDoc.exists) throw new Error("Transfer not found");

        const transferData = transferDoc.data();
        const branchId = transferData.branch_id; // Sender's branch

        let dateStr = new Date().toISOString().split('T')[0];
        if (transferData.created_at) {
            dateStr = transferData.created_at.toDate().toISOString().split('T')[0];
        }

        const docId = branchId + "_" + dateStr;
        const decl = await window.db.collection("declarations").doc(docId).get();

        if (decl.exists) {
            const data = decl.data();

            let stock = data.total_stock;
            if (stock === undefined) {
                const totalsSnap = await window.db.collection("daily_totals").where("branch_id", "==", branchId).where("date", "==", dateStr).get();
                if (!totalsSnap.empty) {
                    stock = totalsSnap.docs[0].data().total_stock;
                }
            }

            document.getElementById('accept-key-stock').textContent = stock !== undefined ? stock + " items" : "Not specified";
            document.getElementById('accept-key-cash').textContent = data.cash_total !== undefined ? "₹" + data.cash_total.toLocaleString() : "Not specified";
        } else {
            document.getElementById('accept-key-stock').textContent = "Declaration missing";
            document.getElementById('accept-key-cash').textContent = "Declaration missing";
        }
    } catch (e) {
        console.error(e);
        document.getElementById('accept-key-stock').textContent = "Error";
        document.getElementById('accept-key-cash').textContent = "Error";
    }
};

document.getElementById('btn-confirm-accept-key').addEventListener('click', async () => {
    const transferId = document.getElementById('accept-key-transfer-id').value;
    window.showLoader();
    try {
        const transferDoc = await window.db.collection("key_transfers").doc(transferId).get();
        if (!transferDoc.exists) throw new Error("Transfer record not found.");

        const data = transferDoc.data();
        const { sender_id, receiver_id, key_number, transfer_type } = data;

        // 1. Update the transfer status
        await window.db.collection("key_transfers").doc(transferId).update({
            status: 'accepted',
            accepted_at: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 2. If permanent, update user assignments
        if (transfer_type === 'permanent') {
            console.log("Processing permanent assignment update...");

            // Update Sender: Clear the key
            const senderDoc = await window.db.collection("users").doc(sender_id).get();
            let senderRole = 'user';
            if (senderDoc.exists) {
                const sData = senderDoc.data();
                senderRole = sData.role || 'user';
                const sUpdates = {};
                if (sData.key1 === key_number) {
                    sUpdates.key1 = null;
                    sUpdates.key1_assigned_at = null;
                }
                if (sData.key2 === key_number) {
                    sUpdates.key2 = null;
                    sUpdates.key2_assigned_at = null;
                }
                if (Object.keys(sUpdates).length > 0) {
                    await window.db.collection("users").doc(sender_id).update(sUpdates);
                }
            }

            // Update Receiver: Assign the key and potentially update role
            const receiverDoc = await window.db.collection("users").doc(receiver_id).get();
            if (receiverDoc.exists) {
                const rData = receiverDoc.data();
                const rUpdates = {};

                // Update Key Assignment
                if (rData.key1 === key_number || rData.key2 === key_number) {
                    // Already assigned
                } else if (!rData.key1) {
                    rUpdates.key1 = key_number;
                    rUpdates.key1_assigned_at = firebase.firestore.FieldValue.serverTimestamp();
                } else {
                    rUpdates.key2 = key_number;
                    rUpdates.key2_assigned_at = firebase.firestore.FieldValue.serverTimestamp();
                }

                // Update Role if receiver is a 'reserve' user or has no role
                // If it's a permanent replacement, they usually take the sender's role
                if (rData.role === 'user' || !rData.role) {
                    rUpdates.role = senderRole;
                }

                if (Object.keys(rUpdates).length > 0) {
                    await window.db.collection("users").doc(receiver_id).update(rUpdates);
                }
            }
        }

        window.showToast("Key accepted successfully. Refreshing permissions...", "success");
        document.getElementById('modal-accept-key').classList.add('hidden');
        setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
        window.showToast(err.message, "error");
        window.hideLoader();
    }
});

async function loadKeyTransferHistory(tableId) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    tbody.innerHTML = '';

    const branchSnap = await window.db.collection("branches").get();
    const branchMap = {};
    branchSnap.forEach(b => {
        branchMap[b.id] = b.data().name || b.id;
    });

    const currentUid = window.currentUser.uid;
    const [sentSnap, receivedSnap] = await Promise.all([
        window.db.collection("key_transfers").where("sender_id", "==", currentUid).get(),
        window.db.collection("key_transfers").where("receiver_id", "==", currentUid).get()
    ]);

    const uniqueMap = new Map();
    sentSnap.forEach(doc => { const d = doc.data(); d.id = doc.id; uniqueMap.set(doc.id, d); });
    receivedSnap.forEach(doc => { const d = doc.data(); d.id = doc.id; uniqueMap.set(doc.id, d); });

    let docs = Array.from(uniqueMap.values());
    docs.sort((a, b) => {
        const timeA = a.created_at ? a.created_at.toDate().getTime() : 0;
        const timeB = b.created_at ? b.created_at.toDate().getTime() : 0;
        return timeB - timeA;
    });

    if (docs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px; color: #888;">No key transfer history.</td></tr>';
        return;
    }

    const escapeLocal = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    docs.forEach(data => {
        const isSent = data.sender_id === currentUid;
        const direction = isSent ? '<span class="status-badge status-approved">Sent</span>' : '<span class="status-badge" style="background:#3b82f6;color:#fff;">Received</span>';

        const otherBranchId = isSent ? data.receiver_branch_id : data.branch_id;
        const otherBranchName = branchMap[otherBranchId] || otherBranchId || 'Unknown';

        const staffName = isSent ? data.receiver_name : data.sender_name;

        const dt = data.created_at ? data.created_at.toDate().toLocaleString('en-GB') : 'Unknown';
        const acceptTime = data.accepted_at ? data.accepted_at.toDate().toLocaleString('en-GB') : '-';
        const returnTime = data.returned_at ? data.returned_at.toDate().toLocaleString('en-GB') : '-';

        let statusBadge = '<span class="status-badge status-pending"><i class="fa-solid fa-spinner"></span>';
        if (data.status === 'accepted') statusBadge = '<span class="status-badge status-approved" title="Approved"><i class="fa-solid fa-check"></i></span>';
        else if (data.status === 'returned') statusBadge = '<span class="status-badge" style="background:#0032d6ff;color:#fff;" title="Returned"><i class="fa-solid fa-undo"></i></span>';
        else if (data.status === 'rejected') statusBadge = '<span class="status-badge" style="background:#e60d0dff;color:#fff;" title="Rejected"><i class="fa-solid fa-times"></i></span>';

        let actionHtml = '-';
        if (data.status === 'returned' || (data.transfer_type === 'permanent' && data.status === 'accepted')) {
            if (data.print_taken) {
                actionHtml = `<span class="status-badge" style="background: rgba(107, 114, 128, 0.2); color: #6b7280; font-size: 11px;"><i class="fa-solid fa-check"></i> Printed</span>`;
            } else {
                actionHtml = `<button class="btn btn-primary btn-sm" style="padding: 4px 10px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;" onclick="window.printKeyTransferReceipt('${data.id}')"><i class="fa-solid fa-print"></i> Print</button>`;
            }
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${dt}</td>
            <td>${direction}</td>
            <td>${escapeLocal(otherBranchName)}</td>
            <td><strong>${escapeLocal(staffName)}</strong></td>
            <td>${escapeLocal(data.key_number)}</td>
            <td>${acceptTime}</td>
            <td>${returnTime}</td>
            <td>${statusBadge}</td>
            <td>${actionHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// USER PROFILE LOGIC
// ==========================================

document.querySelectorAll('[data-target="user-profile"]').forEach(btn => {
    btn.addEventListener('click', () => {
        loadUserProfile();
    });
});

async function loadUserProfile() {
    const userData = window.currentUserData;
    if (!userData) return;

    const elName = document.getElementById('profile-name');
    if (elName) elName.textContent = userData.name || "N/A";

    let branchName = "N/A";
    if (userData.branch_id) {
        try {
            const branchDoc = await window.db.collection('branches').doc(userData.branch_id).get();
            if (branchDoc.exists) {
                branchName = branchDoc.data().name || userData.branch_id;
            } else {
                branchName = userData.branch_id;
            }
        } catch (e) {
            console.error("Error fetching branch name", e);
            branchName = userData.branch_id;
        }
    }
    const elBranch = document.getElementById('profile-branch');
    if (elBranch) elBranch.textContent = branchName;
    const elLocker = document.getElementById('profile-locker');
    if (elLocker) elLocker.textContent = userData.locker_number || "N/A";

    let assignedKeys = [];
    if (userData.key1) assignedKeys.push(userData.key1);
    if (userData.key2) assignedKeys.push(userData.key2);

    const elKey = document.getElementById('profile-key');
    if (elKey) elKey.textContent = assignedKeys.length > 0 ? assignedKeys.join(", ") : "None assigned";
}

document.getElementById('form-change-password').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPass = document.getElementById('profile-new-password').value;
    const confirmPass = document.getElementById('profile-confirm-password').value;

    if (newPass !== confirmPass) {
        window.showToast("Passwords do not match.", "error");
        return;
    }

    if (newPass.length < 6) {
        window.showToast("Password must be at least 6 characters.", "error");
        return;
    }

    window.showLoader();
    try {
        await window.auth.currentUser.updatePassword(newPass);
        window.showToast("Password updated successfully.", "success");
        document.getElementById('form-change-password').reset();
    } catch (err) {
        if (err.code === 'auth/requires-recent-login') {
            window.showToast("Requires recent login. Please log out and log in again before changing password.", "error");
        } else {
            window.showToast(err.message, "error");
        }
    }
    window.hideLoader();
});

// User 1 Report Filter
document.addEventListener('DOMContentLoaded', () => {
    const formUser1Filter = document.getElementById('form-user1-filter-reports');
    if (formUser1Filter) {
        formUser1Filter.addEventListener('submit', (e) => {
            e.preventDefault();
            const fromDate = document.getElementById('user1-filter-from').value;
            const toDate = document.getElementById('user1-filter-to').value;
            loadBranchReports('table-user1-reports', fromDate, toDate);
        });
    }
    const btnUser1FilterClear = document.getElementById('btn-user1-filter-clear');
    if (btnUser1FilterClear) {
        btnUser1FilterClear.addEventListener('click', () => {
            document.getElementById('form-user1-filter-reports').reset();
            loadBranchReports('table-user1-reports');
        });
    }

    // User 2 Report Filter
    const formUser2Filter = document.getElementById('form-user2-filter-reports');
    if (formUser2Filter) {
        formUser2Filter.addEventListener('submit', (e) => {
            e.preventDefault();
            const fromDate = document.getElementById('user2-filter-from').value;
            const toDate = document.getElementById('user2-filter-to').value;
            loadBranchReports('table-user2-reports', fromDate, toDate);
        });
    }
    const btnUser2FilterClear = document.getElementById('btn-user2-filter-clear');
    if (btnUser2FilterClear) {
        btnUser2FilterClear.addEventListener('click', () => {
            document.getElementById('form-user2-filter-reports').reset();
            loadBranchReports('table-user2-reports');
        });
    }
});