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
        
        if (billingCycleManager.viewMode === 'calendar') {
            // Calendar month view
            const now = new Date();
            periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
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
            // Billing cycle view - get expenses for each card's cycle
            const neoCycle = billingCycleManager.getCurrentBillingCycle('neo');
            const rbcCycle = billingCycleManager.getCurrentBillingCycle('rbc');
            
            // Get Neo expenses if cycle is configured
            if (neoCycle) {
                const neoSnapshot = await db.collection('expenses')
                    .where('userId', '==', currentUser.uid)
                    .where('card', '==', 'neo')
                    .where('timestamp', '>=', neoCycle.start)
                    .where('timestamp', '<=', neoCycle.end)
                    .get();
                
                neoSnapshot.forEach(doc => {
                    expenses.push({ id: doc.id, ...doc.data() });
                });
            }
            
            // Get RBC expenses if cycle is configured
            if (rbcCycle) {
                const rbcSnapshot = await db.collection('expenses')
                    .where('userId', '==', currentUser.uid)
                    .where('card', '==', 'rbc')
                    .where('timestamp', '>=', rbcCycle.start)
                    .where('timestamp', '<=', rbcCycle.end)
                    .get();
                
                rbcSnapshot.forEach(doc => {
                    expenses.push({ id: doc.id, ...doc.data() });
                });
            }
        }
        
        // Calculate totals by card and category
        const cardExpenses = {
            neo: {},
            rbc: {}
        };
        
        // Initialize category totals
        Object.keys(categoriesByCard).forEach(card => {
            categoriesByCard[card].forEach(cat => {
                if (!cardExpenses[card][cat]) cardExpenses[card][cat] = 0;
            });
        });
        
        let totalSpent = 0;
        let cardTotalSpent = { neo: 0, rbc: 0 };
        let recurringTotal = 0;
        
        expenses.forEach(expense => {
            const card = expense.card;
            const category = expense.category;
            const amount = expense.amount;
            
            if (cardExpenses[card] && cardExpenses[card].hasOwnProperty(category)) {
                cardExpenses[card][category] += amount;
                cardTotalSpent[card] += amount;
                totalSpent += amount;
                
                if (expense.isRecurring) {
                    recurringTotal += amount;
                }
            }
        });
        
        monthlyExpenses = cardExpenses;
        
        // Update card usage displays with cycle-aware information
        updateCardUsageDisplayEnhanced(cardTotalSpent, recurringTotal);
        
        // Update insights based on view mode
        updateDashboardInsights(expenses, totalSpent, recurringTotal);
        
        // Continue with existing category budget display logic
        if (currentDashboardView === 'neo' || (currentDashboardView === 'combined' && recurringTotal > 0)) {
            loadSubscriptionOverview();
        } else {
            document.getElementById('subscriptionOverview').style.display = 'none';
        }
        
        // Render category budgets
        renderCategoryBudgets(cardExpenses, cardTotalSpent);
        
        // Display budget alerts
        displayBudgetAlerts(cardExpenses, cardTotalSpent);
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function updateCardUsageDisplayEnhanced(cardTotalSpent, recurringTotal) {
    // Neo Card Display
    const neoBudget = 700;
    const neoSpent = cardTotalSpent.neo || 0;
    const neoPercentage = Math.round((neoSpent / neoBudget) * 100);
    
    document.getElementById('neoUsageAmount').textContent = `$${neoSpent.toFixed(2)}`;
    document.getElementById('neoUsagePercentage').textContent = `${neoPercentage}%`;
    
    const neoProgress = document.getElementById('neoProgress');
    neoProgress.style.width = `${Math.min(neoPercentage, 100)}%`;
    
    // Update status with cycle info if in billing mode
    let neoStatus = '✅ On Track';
    if (neoPercentage >= 90) neoStatus = '🚨 Over Budget';
    else if (neoPercentage >= 70) neoStatus = '⚠️ Approaching Limit';
    
    if (billingCycleManager.viewMode === 'billing') {
        const neoCycle = billingCycleManager.getCurrentBillingCycle('neo');
        if (neoCycle && neoCycle.daysRemaining <= 3) {
            neoStatus += ` (${neoCycle.daysRemaining}d left)`;
        }
    }
    
    document.getElementById('neoStatus').textContent = neoStatus;
    
    // Apply color coding
    neoProgress.classList.remove('safe', 'warning', 'danger');
    if (neoPercentage < 70) neoProgress.classList.add('safe');
    else if (neoPercentage < 90) neoProgress.classList.add('warning');
    else neoProgress.classList.add('danger');
    
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

function updateDashboardInsights(expenses, totalSpent, recurringTotal) {
    const now = new Date();
    let daysRemaining, daysInPeriod, daysPassed;
    
    if (billingCycleManager.viewMode === 'calendar') {
        // Calendar month calculations
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        daysInPeriod = endOfMonth.getDate();
        daysPassed = now.getDate();
        daysRemaining = daysInPeriod - daysPassed;
    } else {
        // Use average of both card cycles
        const neoCycle = billingCycleManager.getCurrentBillingCycle('neo');
        const rbcCycle = billingCycleManager.getCurrentBillingCycle('rbc');
        
        if (neoCycle && rbcCycle) {
            daysRemaining = Math.min(neoCycle.daysRemaining, rbcCycle.daysRemaining);
            daysInPeriod = Math.max(neoCycle.daysInCycle, rbcCycle.daysInCycle);
            daysPassed = daysInPeriod - daysRemaining;
        } else if (neoCycle) {
            daysRemaining = neoCycle.daysRemaining;
            daysInPeriod = neoCycle.daysInCycle;
            daysPassed = daysInPeriod - daysRemaining;
        } else if (rbcCycle) {
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
    document.getElementById('recurringTotal').textContent = `$${recurringTotal.toFixed(2)}`;
}

function renderCategoryBudgets(cardExpenses, cardTotalSpent) {
    // This function would contain the existing category budget rendering logic
    // Updated to work with both calendar and billing cycle views
    
    const container = document.getElementById('budgetCategories');
    let html = '';
    
    // Get the appropriate categories based on current view
    let displayCategories = [];
    let displayExpenses = {};
    let displayBudget = {};
    
    if (currentDashboardView === 'combined') {
        // Combined view logic
        const allCategories = [...new Set([...categoriesByCard.neo, ...categoriesByCard.rbc])];
        displayCategories = allCategories;
        
        allCategories.forEach(cat => {
            displayExpenses[cat] = (cardExpenses.neo[cat] || 0) + (cardExpenses.rbc[cat] || 0);
            
            let budget = 0;
            if (userBudget.neo[cat]) budget += userBudget.neo[cat];
            if (userBudget.rbc[cat]) budget += userBudget.rbc[cat];
            displayBudget[cat] = budget;
        });
    } else {
        // Single card view
        const card = currentDashboardView;
        displayCategories = categoriesByCard[card] || [];
        displayExpenses = cardExpenses[card] || {};
        
        if (userBudget[card]) {
            if (userBudget[card].mode === 'total') {
                const totalBudget = userBudget[card].total || 0;
                displayCategories.forEach(cat => {
                    displayBudget[cat] = totalBudget;
                });
            } else {
                displayCategories.forEach(cat => {
                    displayBudget[cat] = userBudget[card][cat] || 0;
                });
            }
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