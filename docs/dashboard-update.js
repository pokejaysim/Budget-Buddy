// Enhanced Dashboard with Billing Cycle Support

async function loadDashboardEnhanced() {
    if (!currentUser) return;
    
    // Update period info first
    updatePeriodInfo();
    
    // Check for statement alerts
    checkStatementAlerts();
    
    try {
        let expenses = [];
        let periodStart, periodEnd;
        
        // Get the most recent period marker to determine start date
        const markerSnapshot = await db.collection('period_markers')
            .where('userId', '==', currentUser.uid)
            .orderBy('timestamp', 'desc')
            .limit(1)
            .get();
        
        let periodStart;
        const now = new Date();
        
        if (!markerSnapshot.empty) {
            const marker = markerSnapshot.docs[0].data();
            const markerDate = marker.timestamp.toDate();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            // Use the later of: start of month or period marker
            periodStart = markerDate > startOfMonth ? markerDate : startOfMonth;
        } else {
            periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        
        if (billingCycleManager.viewMode === 'calendar') {
            // Calendar month view
            periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            
            // Get expenses for calendar month
            const snapshot = await db.collection('expenses')
                .where('userId', '==', currentUser.uid)
                .where('timestamp', '>=', periodStart)
                .where('timestamp', '<=', periodEnd)
                .get();
            
            snapshot.forEach(doc => {
                expenses.push({ id: doc.id, ...doc.data() });
            });
        } else {
            // Billing cycle view - get expenses for RBC cycle
            const rbcCycle = billingCycleManager.getCurrentBillingCycle('rbc');
            
            // Get RBC expenses if cycle is configured
            if (rbcCycle) {
                // Use the later of: cycle start or period marker
                const cycleStart = periodStart > rbcCycle.start ? periodStart : rbcCycle.start;
                
                const rbcSnapshot = await db.collection('expenses')
                    .where('userId', '==', currentUser.uid)
                    .where('timestamp', '>=', cycleStart)
                    .where('timestamp', '<=', rbcCycle.end)
                    .get();
                
                rbcSnapshot.forEach(doc => {
                    expenses.push({ id: doc.id, ...doc.data() });
                });
            }
        }
        
        // Calculate totals by category
        const categoryExpenses = {};
        
        // Initialize category totals
        categories.forEach(cat => {
            categoryExpenses[cat] = 0;
        });
        
        let totalSpent = 0;
        
        expenses.forEach(expense => {
            const category = expense.category;
            const amount = expense.amount;
            
            if (categoryExpenses.hasOwnProperty(category)) {
                categoryExpenses[category] += amount;
                totalSpent += amount;
            }
        });
        
        monthlyExpenses = { rbc: categoryExpenses };
        
        // Update card usage displays with cycle-aware information
        updateCardUsageDisplayEnhanced({ rbc: totalSpent });
        
        // Update insights based on view mode
        updateDashboardInsights(expenses, totalSpent, 0);
        
        // Render category budgets
        renderCategoryBudgets({ rbc: categoryExpenses }, { rbc: totalSpent });
        
        // Display budget alerts  
        generateBudgetAlerts({ rbc: categoryExpenses }, totalSpent, 0, 0);
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function updateCardUsageDisplayEnhanced(cardTotalSpent) {
    // RBC Card Display
    const rbcSpent = cardTotalSpent.rbc || 0;
    let rbcBudget = 0;
    
    if (userBudget && userBudget.rbc) {
        if (userBudget.rbc.mode === 'total') {
            rbcBudget = userBudget.rbc.total || 0;
        } else {
            Object.keys(userBudget.rbc).forEach(key => {
                if (key !== 'mode' && typeof userBudget.rbc[key] === 'number') {
                    rbcBudget += userBudget.rbc[key];
                }
            });
        }
    }
    
    document.getElementById('rbcUsageAmount').textContent = `$${rbcSpent.toFixed(2)}`;
    document.getElementById('rbcUsageLimit').textContent = `/ $${rbcBudget.toFixed(0)}`;
    
    if (rbcBudget > 0) {
        const rbcPercentage = Math.round((rbcSpent / rbcBudget) * 100);
        document.getElementById('rbcUsagePercentage').textContent = `${rbcPercentage}%`;
        
        const rbcProgress = document.getElementById('rbcProgress');
        rbcProgress.style.width = `${Math.min(rbcPercentage, 100)}%`;
        
        // Update status with cycle info if in billing mode
        let rbcStatus = '✅ On Track';
        if (rbcPercentage >= 90) rbcStatus = '🚨 Over Budget';
        else if (rbcPercentage >= 70) rbcStatus = '⚠️ Approaching Limit';
        
        if (billingCycleManager.viewMode === 'billing') {
            const rbcCycle = billingCycleManager.getCurrentBillingCycle('rbc');
            if (rbcCycle && rbcCycle.daysRemaining <= 3) {
                rbcStatus += ` (${rbcCycle.daysRemaining}d left)`;
            }
        }
        
        document.getElementById('rbcStatus').textContent = rbcStatus;
        
        // Apply color coding
        rbcProgress.classList.remove('safe', 'warning', 'danger');
        if (rbcPercentage < 70) rbcProgress.classList.add('safe');
        else if (rbcPercentage < 90) rbcProgress.classList.add('warning');
        else rbcProgress.classList.add('danger');
    } else {
        document.getElementById('rbcUsagePercentage').textContent = '—';
        document.getElementById('rbcProgress').style.width = '0%';
        document.getElementById('rbcStatus').textContent = '📊 Set Budget';
    }
}

function updateDashboardInsights(expenses, totalSpent) {
    const now = new Date();
    let daysRemaining, daysInPeriod, daysPassed;
    
    if (billingCycleManager.viewMode === 'calendar') {
        // Calendar month calculations
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        daysInPeriod = endOfMonth.getDate();
        daysPassed = now.getDate();
        daysRemaining = daysInPeriod - daysPassed;
    } else {
        // Use RBC cycle
        const rbcCycle = billingCycleManager.getCurrentBillingCycle('rbc');
        
        if (rbcCycle) {
            daysRemaining = rbcCycle.daysRemaining;
            daysInPeriod = rbcCycle.daysInCycle;
            daysPassed = daysInPeriod - daysRemaining;
        } else {
            // Fallback to calendar month
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            daysInPeriod = endOfMonth.getDate();
            daysPassed = now.getDate();
            daysRemaining = daysInPeriod - daysPassed;
        }
    }
    
    document.getElementById('daysRemaining').textContent = daysRemaining;
    document.getElementById('dailyAverage').textContent = daysPassed > 0 ? `$${(totalSpent / daysPassed).toFixed(2)}` : '$0';
}

function renderCategoryBudgets(cardExpenses) {
    // This function would contain the existing category budget rendering logic
    // Updated to work with both calendar and billing cycle views
    
    const container = document.getElementById('budgetCategories');
    let html = '';
    
    // Get the appropriate categories
    let displayCategories = categories;
    let displayExpenses = cardExpenses.rbc || {};
    let displayBudget = {};
    
    // RBC only view
    if (userBudget.rbc) {
        if (userBudget.rbc.mode === 'total') {
            const totalBudget = userBudget.rbc.total || 0;
            displayCategories.forEach(cat => {
                displayBudget[cat] = totalBudget;
            });
        } else {
            displayCategories.forEach(cat => {
                displayBudget[cat] = userBudget.rbc[cat] || 0;
            });
        }
    }
    
    // Render category cards
    html = displayCategories.map(cat => {
        const spent = displayExpenses[cat] || 0;
        const budget = displayBudget[cat] || 0;
        const percentage = budget > 0 ? (spent / budget) * 100 : 0;
        const icon = getCategoryIcon(cat);
        
        let statusClass = 'safe';
        if (percentage >= 90) statusClass = 'danger';
        else if (percentage >= 70) statusClass = 'warning';
        
        return `
            <div class="budget-category-card ${statusClass}">
                <div class="category-header">
                    <span class="category-icon">${icon}</span>
                    <span class="category-name">${formatCategoryName(cat)}</span>
                </div>
                <div class="category-amounts">
                    <span class="spent">$${spent.toFixed(2)}</span>
                    <span class="budget">/ $${budget.toFixed(0)}</span>
                </div>
                <div class="category-progress">
                    <div class="progress-bar">
                        <div class="progress-fill ${statusClass}" style="width: ${Math.min(percentage, 100)}%"></div>
                    </div>
                    <span class="percentage">${Math.round(percentage)}%</span>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

// Replace the original loadDashboard with the enhanced version
window.loadDashboard = loadDashboardEnhanced;

// Add missing helper functions if not already defined
if (typeof updateDashboardRecurringTotal === 'undefined') {
    window.updateDashboardRecurringTotal = function() {
        // Function removed - no recurring expenses
    };
}