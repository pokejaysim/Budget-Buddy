// Dual Tracking System - Separate calculation functions for Calendar vs Billing modes

// Calculate Calendar Mode Totals
async function calculateCalendarTotals() {
    if (!currentUser) return { neo: 0, rbc: 0 };
    
    const dateRange = billingCycleManager.getCalendarDateRange();
    console.log('📅 CALENDAR MODE - Date Range:', dateRange.description);
    console.log('📅 CALENDAR MODE - Start:', dateRange.start);
    console.log('📅 CALENDAR MODE - End:', dateRange.end);
    
    try {
        const snapshot = await db.collection('expenses')
            .where('userId', '==', currentUser.uid)
            .where('timestamp', '>=', dateRange.start)
            .where('timestamp', '<=', dateRange.end)
            .get();
        
        let neoTotal = 0;
        let rbcTotal = 0;
        let expenseCount = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const expenseDate = data.timestamp.toDate();
            const dateStr = expenseDate.toLocaleDateString();
            
            // Detailed logging
            const isWithinRange = expenseDate >= dateRange.start && expenseDate <= dateRange.end;
            const reason = isWithinRange 
                ? `✅ Within ${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`
                : `❌ Outside range`;
            
            console.log(`📅 CALENDAR: ${data.card.toUpperCase()} expense $${data.amount} on ${dateStr} - ${reason}`);
            
            if (data.card === 'neo') {
                neoTotal += data.amount;
            } else if (data.card === 'rbc') {
                rbcTotal += data.amount;
            }
            expenseCount++;
        });
        
        console.log(`📅 CALENDAR TOTALS - Neo: $${neoTotal.toFixed(2)}, RBC: $${rbcTotal.toFixed(2)} (${expenseCount} expenses)`);
        
        return { neo: neoTotal, rbc: rbcTotal };
    } catch (error) {
        console.error('Error calculating calendar totals:', error);
        return { neo: 0, rbc: 0 };
    }
}

// Calculate Billing Mode Totals
async function calculateBillingTotals() {
    if (!currentUser) return { neo: 0, rbc: 0 };
    
    console.log('💳 BILLING MODE - Starting calculation');
    
    let neoTotal = 0;
    let rbcTotal = 0;
    
    // Calculate Neo card billing cycle total
    const neoDateRange = billingCycleManager.getBillingDateRange('neo');
    if (neoDateRange) {
        console.log('💳 NEO BILLING CYCLE - Date Range:', neoDateRange.description);
        console.log('💳 NEO BILLING CYCLE - Start:', neoDateRange.start);
        console.log('💳 NEO BILLING CYCLE - End:', neoDateRange.end);
        
        try {
            const neoSnapshot = await db.collection('expenses')
                .where('userId', '==', currentUser.uid)
                .where('card', '==', 'neo')
                .where('timestamp', '>=', neoDateRange.start)
                .where('timestamp', '<=', neoDateRange.end)
                .get();
            
            let neoExpenseCount = 0;
            neoSnapshot.forEach(doc => {
                const data = doc.data();
                const expenseDate = data.timestamp.toDate();
                const dateStr = expenseDate.toLocaleDateString();
                
                const isWithinRange = expenseDate >= neoDateRange.start && expenseDate <= neoDateRange.end;
                const reason = isWithinRange 
                    ? `✅ Within ${neoDateRange.start.toLocaleDateString()} - ${neoDateRange.end.toLocaleDateString()}`
                    : `❌ Outside range`;
                
                console.log(`💳 NEO BILLING: expense $${data.amount} on ${dateStr} - ${reason}`);
                
                neoTotal += data.amount;
                neoExpenseCount++;
            });
            
            console.log(`💳 NEO TOTAL: $${neoTotal.toFixed(2)} (${neoExpenseCount} expenses)`);
        } catch (error) {
            console.error('Error calculating Neo billing total:', error);
        }
    } else {
        console.log('💳 NEO - No billing date configured');
    }
    
    // Calculate RBC card billing cycle total
    const rbcDateRange = billingCycleManager.getBillingDateRange('rbc');
    if (rbcDateRange) {
        console.log('💳 RBC BILLING CYCLE - Date Range:', rbcDateRange.description);
        console.log('💳 RBC BILLING CYCLE - Start:', rbcDateRange.start);
        console.log('💳 RBC BILLING CYCLE - End:', rbcDateRange.end);
        
        try {
            const rbcSnapshot = await db.collection('expenses')
                .where('userId', '==', currentUser.uid)
                .where('card', '==', 'rbc')
                .where('timestamp', '>=', rbcDateRange.start)
                .where('timestamp', '<=', rbcDateRange.end)
                .get();
            
            let rbcExpenseCount = 0;
            rbcSnapshot.forEach(doc => {
                const data = doc.data();
                const expenseDate = data.timestamp.toDate();
                const dateStr = expenseDate.toLocaleDateString();
                
                const isWithinRange = expenseDate >= rbcDateRange.start && expenseDate <= rbcDateRange.end;
                const reason = isWithinRange 
                    ? `✅ Within ${rbcDateRange.start.toLocaleDateString()} - ${rbcDateRange.end.toLocaleDateString()}`
                    : `❌ Outside range`;
                
                console.log(`💳 RBC BILLING: expense $${data.amount} on ${dateStr} - ${reason}`);
                
                rbcTotal += data.amount;
                rbcExpenseCount++;
            });
            
            console.log(`💳 RBC TOTAL: $${rbcTotal.toFixed(2)} (${rbcExpenseCount} expenses)`);
        } catch (error) {
            console.error('Error calculating RBC billing total:', error);
        }
    } else {
        console.log('💳 RBC - No billing date configured');
    }
    
    console.log(`💳 BILLING TOTALS - Neo: $${neoTotal.toFixed(2)}, RBC: $${rbcTotal.toFixed(2)}`);
    
    return { neo: neoTotal, rbc: rbcTotal };
}

// Update Dashboard Totals Based on Current Mode
async function updateDashboardTotals() {
    console.log('\n🔄 UPDATING DASHBOARD TOTALS');
    console.log('🔄 Current View Mode:', billingCycleManager.viewMode);
    
    let totals;
    
    if (billingCycleManager.viewMode === 'calendar') {
        totals = await calculateCalendarTotals();
    } else {
        totals = await calculateBillingTotals();
    }
    
    // Update quick stats (if visible)
    const neoTotalElement = document.getElementById('neoTotal');
    const rbcTotalElement = document.getElementById('rbcTotal');
    
    if (neoTotalElement) neoTotalElement.textContent = `$${totals.neo.toFixed(2)}`;
    if (rbcTotalElement) rbcTotalElement.textContent = `$${totals.rbc.toFixed(2)}`;
    
    // Update dashboard card usage displays
    const neoUsageElement = document.getElementById('neoUsageAmount');
    const rbcUsageElement = document.getElementById('rbcUsageAmount');
    
    if (neoUsageElement) neoUsageElement.textContent = `$${totals.neo.toFixed(2)}`;
    if (rbcUsageElement) rbcUsageElement.textContent = `$${totals.rbc.toFixed(2)}`;
    
    console.log('🔄 Dashboard updated with totals:', totals);
    
    return totals;
}

// Update Date Range Display
function updateDateRangeDisplay() {
    const periodDetails = document.getElementById('periodDetails');
    if (!periodDetails) return;
    
    if (billingCycleManager.viewMode === 'calendar') {
        const dateRange = billingCycleManager.getCalendarDateRange();
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysPassed = now.getDate();
        const progress = Math.round((daysPassed / daysInMonth) * 100);
        
        periodDetails.innerHTML = `
            <div class="period-display calendar-mode">
                <div class="period-header">
                    <div class="period-title">📅 Calendar Month View</div>
                    <div class="period-progress">${progress}% complete</div>
                </div>
                <div class="period-range-display">
                    <div class="date-range-box">
                        <span class="range-label">Showing expenses from:</span>
                        <span class="range-dates">${dateRange.description}</span>
                    </div>
                </div>
            </div>
        `;
    } else {
        const neoRange = billingCycleManager.getBillingDateRange('neo');
        const rbcRange = billingCycleManager.getBillingDateRange('rbc');
        
        let html = '<div class="period-display billing-mode">';
        html += '<div class="period-header">';
        html += '<div class="period-title">💳 Billing Cycle View</div>';
        html += '</div>';
        html += '<div class="billing-ranges">';
        
        if (neoRange) {
            const neoCycle = billingCycleManager.getCurrentBillingCycle('neo');
            const neoProgress = neoCycle ? Math.round(neoCycle.progress) : 0;
            html += `
                <div class="card-range-box neo-range">
                    <div class="card-label">Neo Card</div>
                    <div class="range-dates">${neoRange.description}</div>
                    <div class="cycle-progress">${neoProgress}% complete • ${neoCycle ? neoCycle.daysRemaining : 0} days left</div>
                </div>
            `;
        } else {
            html += `
                <div class="card-range-box neo-range no-date">
                    <div class="card-label">Neo Card</div>
                    <div class="range-dates">No billing date configured</div>
                </div>
            `;
        }
        
        if (rbcRange) {
            const rbcCycle = billingCycleManager.getCurrentBillingCycle('rbc');
            const rbcProgress = rbcCycle ? Math.round(rbcCycle.progress) : 0;
            html += `
                <div class="card-range-box rbc-range">
                    <div class="card-label">RBC Card</div>
                    <div class="range-dates">${rbcRange.description}</div>
                    <div class="cycle-progress">${rbcProgress}% complete • ${rbcCycle ? rbcCycle.daysRemaining : 0} days left</div>
                </div>
            `;
        } else {
            html += `
                <div class="card-range-box rbc-range no-date">
                    <div class="card-label">RBC Card</div>
                    <div class="range-dates">No billing date configured</div>
                </div>
            `;
        }
        
        html += '</div></div>';
        periodDetails.innerHTML = html;
    }
}