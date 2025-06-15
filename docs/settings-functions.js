// Settings View Functions

async function loadSettings() {
    if (!currentUser) return;
    
    // Initialize date selectors
    billingCycleManager.initializeDateSelectors();
    
    // Load current view mode
    const viewMode = billingCycleManager.viewMode;
    document.getElementById('calendarMode').checked = viewMode === 'calendar';
    document.getElementById('billingMode').checked = viewMode === 'billing';
    
    // Load notification preferences
    const notificationSettings = billingCycleManager.userSettings?.notifications || {
        statementCloseAlert: true,
        budgetAlert: true,
        paymentDueAlert: true
    };
    
    document.getElementById('statementCloseAlert').checked = notificationSettings.statementCloseAlert !== false;
    document.getElementById('budgetAlert').checked = notificationSettings.budgetAlert !== false;
    document.getElementById('paymentDueAlert').checked = notificationSettings.paymentDueAlert !== false;
}

// View mode toggle handlers
document.getElementById('calendarMode')?.addEventListener('change', async (e) => {
    if (e.target.checked) {
        await billingCycleManager.toggleViewMode('calendar');
        // Update dashboard if active
        if (document.getElementById('dashboardView').classList.contains('active')) {
            loadDashboard();
        }
    }
});

document.getElementById('billingMode')?.addEventListener('change', async (e) => {
    if (e.target.checked) {
        await billingCycleManager.toggleViewMode('billing');
        // Update dashboard if active
        if (document.getElementById('dashboardView').classList.contains('active')) {
            loadDashboard();
        }
    }
});

// Save billing dates
document.getElementById('saveBillingDates')?.addEventListener('click', async () => {
    const neoDate = document.getElementById('neoBillingDate').value;
    const rbcDate = document.getElementById('rbcBillingDate').value;
    
    const settings = {};
    if (neoDate) settings.neoBillingDate = parseInt(neoDate);
    if (rbcDate) settings.rbcBillingDate = parseInt(rbcDate);
    
    const success = await billingCycleManager.saveBillingSettings(currentUser.uid, settings);
    
    if (success) {
        // Update cycle displays
        billingCycleManager.updateCycleDisplays();
        
        // Show success message
        const btn = document.getElementById('saveBillingDates');
        const originalText = btn.textContent;
        btn.textContent = '✓ Saved';
        btn.style.background = '#34a853';
        
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
        }, 2000);
        
        // Update dashboard if active
        if (document.getElementById('dashboardView').classList.contains('active')) {
            loadDashboard();
        }
    }
});

// Dashboard mode toggle handlers
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const mode = btn.dataset.mode;
        
        // Update active state
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Toggle view mode
        await billingCycleManager.toggleViewMode(mode);
        
        // Reload dashboard
        loadDashboard();
        
        // Also update quick stats if visible
        if (document.getElementById('quickStats').style.display !== 'none') {
            loadUserData();
        }
    });
});

// Update loadUserData to respect view mode
async function loadUserDataWithBilling() {
    if (!currentUser) return;
    
    try {
        let neoSum = 0;
        let rbcSum = 0;
        
        if (billingCycleManager.viewMode === 'billing') {
            // Get expenses for current billing cycles
            const neoCycle = billingCycleManager.getCurrentBillingCycle('neo');
            const rbcCycle = billingCycleManager.getCurrentBillingCycle('rbc');
            
            // Neo card expenses
            if (neoCycle) {
                const neoExpenses = await db.collection('expenses')
                    .where('userId', '==', currentUser.uid)
                    .where('card', '==', 'neo')
                    .where('timestamp', '>=', neoCycle.start)
                    .where('timestamp', '<=', neoCycle.end)
                    .get();
                
                neoExpenses.forEach(doc => {
                    neoSum += doc.data().amount;
                });
            }
            
            // RBC card expenses
            if (rbcCycle) {
                const rbcExpenses = await db.collection('expenses')
                    .where('userId', '==', currentUser.uid)
                    .where('card', '==', 'rbc')
                    .where('timestamp', '>=', rbcCycle.start)
                    .where('timestamp', '<=', rbcCycle.end)
                    .get();
                
                rbcExpenses.forEach(doc => {
                    rbcSum += doc.data().amount;
                });
            }
        } else {
            // Calendar month view (existing logic)
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            
            const snapshot = await db.collection('expenses')
                .where('userId', '==', currentUser.uid)
                .where('timestamp', '>=', startOfMonth)
                .get();
            
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.card === 'neo') {
                    neoSum += data.amount;
                } else if (data.card === 'rbc') {
                    rbcSum += data.amount;
                }
            });
        }
        
        neoTotal.textContent = `$${neoSum.toFixed(2)}`;
        rbcTotal.textContent = `$${rbcSum.toFixed(2)}`;
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Update period info display
function updatePeriodInfo() {
    const periodDetails = document.getElementById('periodDetails');
    if (!periodDetails) return;
    
    if (billingCycleManager.viewMode === 'calendar') {
        const period = billingCycleManager.getCurrentCalendarMonth();
        periodDetails.innerHTML = `
            <div>
                <div class="period-title">${billingCycleManager.getPeriodTitle()}</div>
                <div class="period-dates">Full month view</div>
            </div>
            <div class="period-status">
                <span>Progress: ${Math.round(period.progress)}%</span>
                <span class="days-badge">${period.daysRemaining} days left</span>
            </div>
        `;
    } else {
        // Show combined billing cycle info
        const neoCycle = billingCycleManager.getCurrentBillingCycle('neo');
        const rbcCycle = billingCycleManager.getCurrentBillingCycle('rbc');
        
        let html = '<div style="width: 100%;">';
        
        if (neoCycle || rbcCycle) {
            if (neoCycle) {
                html += `
                    <div class="period-card-info" style="margin-bottom: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong style="color: #8b5cf6;">Neo Card</strong>
                                <span class="period-dates">${billingCycleManager.formatPeriod(neoCycle)}</span>
                            </div>
                            <span class="days-badge">${neoCycle.daysRemaining} days</span>
                        </div>
                        <div class="cycle-progress-container">
                            <div class="cycle-progress-bar">
                                <div class="cycle-progress-fill" style="width: ${neoCycle.progress}%"></div>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            if (rbcCycle) {
                html += `
                    <div class="period-card-info">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong style="color: #0ea5e9;">RBC Card</strong>
                                <span class="period-dates">${billingCycleManager.formatPeriod(rbcCycle)}</span>
                            </div>
                            <span class="days-badge">${rbcCycle.daysRemaining} days</span>
                        </div>
                        <div class="cycle-progress-container">
                            <div class="cycle-progress-bar">
                                <div class="cycle-progress-fill" style="width: ${rbcCycle.progress}%"></div>
                            </div>
                        </div>
                    </div>
                `;
            }
        } else {
            html += '<div class="period-dates">No billing cycles configured. Set them up in Settings.</div>';
        }
        
        html += '</div>';
        periodDetails.innerHTML = html;
    }
}

// Export data for billing cycles
document.getElementById('exportAllData')?.addEventListener('click', async () => {
    if (!currentUser) return;
    
    try {
        let csv = 'Date,Time,Card,Category,Amount,Description,Billing Cycle\n';
        
        // Get all expenses
        const snapshot = await db.collection('expenses')
            .where('userId', '==', currentUser.uid)
            .orderBy('timestamp', 'desc')
            .get();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.timestamp ? data.timestamp.toDate() : new Date();
            const dateStr = date.toLocaleDateString();
            const timeStr = date.toLocaleTimeString();
            
            // Determine billing cycle
            let billingCycle = 'N/A';
            const cycle = billingCycleManager.getCurrentBillingCycle(data.card, date);
            if (cycle) {
                billingCycle = billingCycleManager.formatPeriod(cycle);
            }
            
            csv += `"${dateStr}","${timeStr}","${data.card.toUpperCase()}","${data.category}","${data.amount.toFixed(2)}","${data.description || ''}","${billingCycle}"\n`;
        });
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `budget-buddy-all-data-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting data:', error);
        alert('Failed to export data');
    }
});

// Save notification preferences
document.querySelectorAll('.notification-option input').forEach(checkbox => {
    checkbox.addEventListener('change', async () => {
        const notifications = {
            statementCloseAlert: document.getElementById('statementCloseAlert').checked,
            budgetAlert: document.getElementById('budgetAlert').checked,
            paymentDueAlert: document.getElementById('paymentDueAlert').checked
        };
        
        await billingCycleManager.saveBillingSettings(currentUser.uid, { notifications });
    });
});

// Check for statement closing alerts
function checkStatementAlerts() {
    if (!billingCycleManager.userSettings?.notifications?.statementCloseAlert) return;
    
    const alerts = billingCycleManager.getUpcomingStatementCloses(3);
    
    alerts.forEach(alert => {
        if (alert.daysRemaining <= 3) {
            showBudgetAlert(
                `${alert.card.toUpperCase()} statement closes in ${alert.daysRemaining} day${alert.daysRemaining !== 1 ? 's' : ''}`,
                'info'
            );
        }
    });
}

// Note: loadUserData in app.js already handles billing cycles