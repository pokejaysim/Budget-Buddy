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
        paymentDueAlert: true,
        recurringGeneratedAlert: true
    };
    
    document.getElementById('statementCloseAlert').checked = notificationSettings.statementCloseAlert !== false;
    document.getElementById('budgetAlert').checked = notificationSettings.budgetAlert !== false;
    document.getElementById('paymentDueAlert').checked = notificationSettings.paymentDueAlert !== false;
    document.getElementById('recurringGeneratedAlert').checked = notificationSettings.recurringGeneratedAlert !== false;
    
    // Display current timezone
    const timezoneDisplay = document.getElementById('currentTimezone');
    if (timezoneDisplay) {
        timezoneDisplay.textContent = timezoneManager.getTimezoneDisplay();
    }
    
    // Add timezone change handler
    const changeTimezoneBtn = document.getElementById('changeTimezoneBtn');
    if (changeTimezoneBtn && !changeTimezoneBtn.hasListener) {
        changeTimezoneBtn.hasListener = true;
        changeTimezoneBtn.addEventListener('click', async () => {
            const newTimezone = prompt('Enter your timezone (e.g., America/New_York, Europe/London):', timezoneManager.userTimezone);
            if (newTimezone && newTimezone !== timezoneManager.userTimezone) {
                try {
                    // Validate timezone
                    new Date().toLocaleString('en-US', { timeZone: newTimezone });
                    
                    // Save new timezone
                    await timezoneManager.saveTimezonePreference(currentUser.uid, newTimezone);
                    timezoneDisplay.textContent = timezoneManager.getTimezoneDisplay();
                    
                    // Show success
                    showSettingsSuccess('Timezone updated successfully!');
                } catch (error) {
                    alert('Invalid timezone. Please enter a valid timezone.');
                }
            }
        });
    }
    
    // Add recurring templates management
    const manageRecurringBtn = document.getElementById('manageRecurringBtn');
    const templatesList = document.getElementById('recurringTemplatesList');
    
    if (manageRecurringBtn && !manageRecurringBtn.hasListener) {
        manageRecurringBtn.hasListener = true;
        manageRecurringBtn.addEventListener('click', async () => {
            if (templatesList.style.display === 'none') {
                // Load and display templates
                await loadRecurringTemplates();
                templatesList.style.display = 'block';
                manageRecurringBtn.textContent = 'Hide Templates';
            } else {
                templatesList.style.display = 'none';
                manageRecurringBtn.textContent = 'Manage Recurring Templates';
            }
        });
    }
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

// Dashboard mode toggle handlers - COMPLETELY REBUILT
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const mode = btn.dataset.mode;
        
        console.log('\n🎯 MODE TOGGLE CLICKED:', mode);
        
        // Update active state
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Toggle view mode
        await billingCycleManager.toggleViewMode(mode);
        
        console.log('🎯 View mode changed to:', billingCycleManager.viewMode);
        
        // Update date range display
        updateDateRangeDisplay();
        
        // Trigger complete recalculation using new functions
        await updateDashboardTotals();
        
        // Also reload dashboard for category breakdowns
        if (typeof loadDashboard === 'function') {
            loadDashboard();
        }
        
        console.log('🎯 Toggle complete for mode:', mode);
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
                <div class="period-title">Current Month: ${billingCycleManager.getPeriodTitle()}</div>
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
                                <strong style="color: #8b5cf6;">Neo Card - Current Cycle</strong>
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
                                <strong style="color: #0ea5e9;">RBC Card - Current Cycle</strong>
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
            paymentDueAlert: document.getElementById('paymentDueAlert').checked,
            recurringGeneratedAlert: document.getElementById('recurringGeneratedAlert').checked
        };
        
        await billingCycleManager.saveBillingSettings(currentUser.uid, { notifications });
    });
});

// Load Recurring Templates
async function loadRecurringTemplates() {
    if (!currentUser) return;
    
    const templatesList = document.getElementById('recurringTemplatesList');
    if (!templatesList) return;
    
    try {
        const templates = await recurringExpenseManager.getRecurringTemplates(currentUser.uid);
        
        if (templates.length === 0) {
            templatesList.innerHTML = `
                <div class="empty-state">
                    <p>No recurring templates yet. Mark expenses as recurring when adding them.</p>
                </div>
            `;
        } else {
            templatesList.innerHTML = `
                <div class="templates-grid">
                    ${templates.map(template => `
                        <div class="template-item ${template.isActive ? '' : 'inactive'}">
                            <div class="template-header">
                                <span class="template-amount">$${template.amount.toFixed(2)}</span>
                                <span class="template-card">${template.card.toUpperCase()}</span>
                            </div>
                            <div class="template-details">
                                <p><strong>${template.description}</strong></p>
                                <p>${getCategoryIcon(template.category)} ${formatCategoryName(template.category)}</p>
                                <p>Bills on day ${template.billingDay} of each month</p>
                                <p class="template-status">${template.isActive ? '✅ Active' : '⏸️ Inactive'}</p>
                            </div>
                            <div class="template-actions">
                                ${template.isActive ? 
                                    `<button onclick="toggleRecurringTemplate('${template.id}', false)" class="template-btn">Deactivate</button>` :
                                    `<button onclick="toggleRecurringTemplate('${template.id}', true)" class="template-btn">Activate</button>`
                                }
                                <button onclick="deleteRecurringTemplate('${template.id}')" class="template-btn delete">Delete</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading recurring templates:', error);
        templatesList.innerHTML = '<div class="error">Failed to load templates</div>';
    }
}

// Toggle Recurring Template
async function toggleRecurringTemplate(templateId, activate) {
    if (!currentUser) return;
    
    try {
        await recurringExpenseManager.updateTemplate(currentUser.uid, templateId, { isActive: activate });
        await loadRecurringTemplates();
        
        // Show success message
        showSettingsSuccess(`Template ${activate ? 'activated' : 'deactivated'} successfully!`);
    } catch (error) {
        console.error('Error toggling template:', error);
        alert('Failed to update template');
    }
}

// Delete Recurring Template
async function deleteRecurringTemplate(templateId) {
    if (!currentUser) return;
    
    if (!confirm('Are you sure you want to delete this recurring template?')) return;
    
    try {
        await recurringExpenseManager.deleteTemplate(currentUser.uid, templateId);
        await loadRecurringTemplates();
        
        // Show success message
        showSettingsSuccess('Template deleted successfully!');
    } catch (error) {
        console.error('Error deleting template:', error);
        alert('Failed to delete template');
    }
}

// Show settings success message
function showSettingsSuccess(message) {
    const successMsg = document.getElementById('successMessage');
    if (successMsg) {
        successMsg.textContent = message;
        successMsg.classList.add('show');
        setTimeout(() => successMsg.classList.remove('show'), 3000);
    }
}

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