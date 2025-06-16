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
            
            console.log(`📅 Including expense: ${data.card} $${data.amount} on ${expenseDate.toLocaleDateString()}`);
            
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
                
                console.log(`💳 NEO Including expense: $${data.amount} on ${expenseDate.toLocaleDateString()}`);
                
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
                
                console.log(`💳 RBC Including expense: $${data.amount} on ${expenseDate.toLocaleDateString()}`);
                
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
        periodDetails.innerHTML = `
            <div>
                <div class="period-title">📅 Calendar Month</div>
                <div class="period-dates">Showing expenses from ${dateRange.description}</div>
            </div>
        `;
    } else {
        const neoRange = billingCycleManager.getBillingDateRange('neo');
        const rbcRange = billingCycleManager.getBillingDateRange('rbc');
        
        let html = '<div>';
        html += '<div class="period-title">💳 Billing Cycles</div>';
        
        if (neoRange) {
            html += `<div class="period-dates">Neo: ${neoRange.description}</div>`;
        } else {
            html += '<div class="period-dates">Neo: No billing date set</div>';
        }
        
        if (rbcRange) {
            html += `<div class="period-dates">RBC: ${rbcRange.description}</div>`;
        } else {
            html += '<div class="period-dates">RBC: No billing date set</div>';
        }
        
        html += '</div>';
        periodDetails.innerHTML = html;
    }
}