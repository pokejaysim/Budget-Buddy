// Helper Functions

// Format category name for display
function formatCategoryName(category) {
    const names = {
        // RBC categories
        'food': 'Food',
        'delivery': 'Delivery',
        'groceries': 'Groceries',
        'shopping': 'Shopping',
        'entertainment': 'Entertainment',
        'other': 'Other',
        // Neo categories
        'streaming': 'Streaming',
        'software': 'Software',
        'utilities': 'Utilities',
        'insurance': 'Insurance',
        'memberships': 'Memberships',
        'other-bills': 'Other Bills'
    };
    return names[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

// Apply subscription template
function applyTemplate(index) {
    const template = subscriptionTemplates[index];
    if (template) {
        document.getElementById('amountInput').value = template.amount.toFixed(2);
        document.getElementById('descriptionInput').value = template.name;
        
        // Mark as recurring
        const recurringCheckbox = document.getElementById('isRecurringCheckbox');
        if (recurringCheckbox) recurringCheckbox.checked = true;
        
        // Select the appropriate category
        const categoryButtons = document.querySelectorAll('.category-btn');
        categoryButtons.forEach(btn => {
            if (btn.dataset.category === template.category) {
                btn.click();
            }
        });
    }
}

// Update recent expenses with billing cycle info
async function loadRecentExpensesEnhanced() {
    if (!currentUser) return;
    
    const recentExpensesDiv = document.getElementById('recentExpenses');
    const cardFilter = document.getElementById('cardFilter').value;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    recentExpensesDiv.innerHTML = '<div class="loading">Loading expenses...</div>';
    
    try {
        let expenses = [];
        
        if (billingCycleManager.viewMode === 'billing') {
            // Get expenses for current billing cycles
            const neoCycle = billingCycleManager.getCurrentBillingCycle('neo');
            const rbcCycle = billingCycleManager.getCurrentBillingCycle('rbc');
            
            if (neoCycle && (cardFilter === 'all' || cardFilter === 'neo')) {
                const neoSnapshot = await db.collection('expenses')
                    .where('userId', '==', currentUser.uid)
                    .where('card', '==', 'neo')
                    .where('timestamp', '>=', neoCycle.start)
                    .where('timestamp', '<=', neoCycle.end)
                    .orderBy('timestamp', 'desc')
                    .get();
                
                neoSnapshot.forEach(doc => {
                    expenses.push({ id: doc.id, ...doc.data() });
                });
            }
            
            if (rbcCycle && (cardFilter === 'all' || cardFilter === 'rbc')) {
                const rbcSnapshot = await db.collection('expenses')
                    .where('userId', '==', currentUser.uid)
                    .where('card', '==', 'rbc')
                    .where('timestamp', '>=', rbcCycle.start)
                    .where('timestamp', '<=', rbcCycle.end)
                    .orderBy('timestamp', 'desc')
                    .get();
                
                rbcSnapshot.forEach(doc => {
                    expenses.push({ id: doc.id, ...doc.data() });
                });
            }
            
            // Sort combined results by timestamp
            expenses.sort((a, b) => b.timestamp - a.timestamp);
        } else {
            // Calendar view - get last 14 days
            const fourteenDaysAgo = new Date();
            fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
            
            let query = db.collection('expenses')
                .where('userId', '==', currentUser.uid)
                .where('timestamp', '>=', fourteenDaysAgo)
                .orderBy('timestamp', 'desc');
            
            const snapshot = await query.get();
            
            snapshot.forEach(doc => {
                expenses.push({ id: doc.id, ...doc.data() });
            });
            
            // Filter by card if selected
            if (cardFilter !== 'all') {
                expenses = expenses.filter(exp => exp.card === cardFilter);
            }
        }
        
        // Apply recurring filter
        if (activeRecurringFilter === 'recurring') {
            expenses = expenses.filter(exp => exp.isRecurring === true);
        } else if (activeRecurringFilter === 'one-time') {
            expenses = expenses.filter(exp => !exp.isRecurring);
        }
        
        // Apply search filter
        if (searchTerm) {
            expenses = expenses.filter(exp => 
                exp.description?.toLowerCase().includes(searchTerm) ||
                exp.category.toLowerCase().includes(searchTerm)
            );
        }
        
        // Render expenses
        if (expenses.length === 0) {
            recentExpensesDiv.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <p>No expenses found</p>
                </div>
            `;
        } else {
            recentExpensesDiv.innerHTML = expenses.map(expense => {
                const date = expense.timestamp ? expense.timestamp.toDate() : new Date();
                const dateStr = date.toLocaleDateString();
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                // Add billing cycle info if in billing mode
                let cycleInfo = '';
                if (billingCycleManager.viewMode === 'billing') {
                    const cycle = billingCycleManager.getCurrentBillingCycle(expense.card, date);
                    if (cycle) {
                        cycleInfo = `<span class="cycle-info">${billingCycleManager.formatPeriod(cycle)}</span>`;
                    }
                }
                
                return `
                    <div class="expense-item ${expense.isRecurring ? 'recurring' : ''}">
                        <div class="expense-details">
                            <div class="expense-header">
                                <span class="expense-amount">$${expense.amount.toFixed(2)}</span>
                                <span class="expense-card">${expense.card.toUpperCase()}</span>
                                ${expense.isRecurring ? '<span class="recurring-badge">🔄 Recurring</span>' : ''}
                            </div>
                            <div class="expense-info">
                                <span>${getCategoryIcon(expense.category)} ${formatCategoryName(expense.category)}</span>
                                <span>${dateStr} ${timeStr}</span>
                                ${cycleInfo}
                            </div>
                            ${expense.description ? `<div class="expense-description">${expense.description}</div>` : ''}
                        </div>
                        <div class="expense-actions">
                            <button class="edit-btn" onclick="editExpense('${expense.id}')">✏️</button>
                            <button class="delete-btn" onclick="deleteExpense('${expense.id}')">🗑️</button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Error loading expenses:', error);
        recentExpensesDiv.innerHTML = '<div class="error">Failed to load expenses</div>';
    }
}

// Replace original loadRecentExpenses
window.loadRecentExpenses = loadRecentExpensesEnhanced;