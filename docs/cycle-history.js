// Cycle History Modal Functions

let currentHistoryCard = 'all';
let currentHistoryCycle = null;

// Open cycle history modal
function openCycleHistoryModal() {
    const modal = document.getElementById('cycleHistoryModal');
    if (!modal) return;
    
    modal.style.display = 'block';
    loadCycleOptions();
}

// Close cycle history modal
function closeCycleHistoryModal() {
    const modal = document.getElementById('cycleHistoryModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Load available cycles into the dropdown
function loadCycleOptions() {
    const cardSelect = document.getElementById('historyCardSelect');
    const cycleSelect = document.getElementById('historyCycleSelect');
    
    if (!cardSelect || !cycleSelect) return;
    
    // Set default card
    currentHistoryCard = cardSelect.value || 'all';
    
    // Clear existing options
    cycleSelect.innerHTML = '';
    
    if (billingCycleManager.viewMode === 'calendar') {
        // Load previous months
        const months = billingCycleManager.getPreviousMonths(12);
        months.forEach((month, index) => {
            const option = document.createElement('option');
            option.value = month.key;
            option.textContent = month.monthName + (month.isCurrent ? ' (Current)' : '');
            if (index === 1) option.selected = true; // Select previous month by default
            cycleSelect.appendChild(option);
        });
    } else {
        // Load previous billing cycles based on selected card
        if (currentHistoryCard === 'all') {
            cycleSelect.innerHTML = '<option value="">Select a specific card to view cycles</option>';
        } else {
            const cycles = billingCycleManager.getPreviousCycles(currentHistoryCard, 12);
            cycles.forEach((cycle, index) => {
                const option = document.createElement('option');
                option.value = cycle.key;
                option.textContent = billingCycleManager.formatPeriod(cycle) + (cycle.isCurrent ? ' (Current)' : '');
                if (index === 1) option.selected = true; // Select previous cycle by default
                cycleSelect.appendChild(option);
            });
        }
    }
    
    // Load initial history
    if (cycleSelect.value) {
        loadCycleHistory();
    }
}

// Load expenses for selected cycle
async function loadCycleHistory() {
    const cardSelect = document.getElementById('historyCardSelect');
    const cycleSelect = document.getElementById('historyCycleSelect');
    const contentDiv = document.getElementById('cycleHistoryContent');
    
    if (!cardSelect || !cycleSelect || !contentDiv) return;
    
    currentHistoryCard = cardSelect.value;
    currentHistoryCycle = cycleSelect.value;
    
    if (!currentHistoryCycle) {
        contentDiv.innerHTML = '<p class="empty-state">Please select a cycle to view history.</p>';
        return;
    }
    
    contentDiv.innerHTML = '<p>Loading...</p>';
    
    try {
        // Parse cycle dates from the key
        let startDate, endDate;
        
        if (billingCycleManager.viewMode === 'calendar') {
            // Calendar month format: YYYY-MM
            const [year, month] = currentHistoryCycle.split('-').map(n => parseInt(n));
            startDate = new Date(year, month - 1, 1);
            endDate = new Date(year, month, 0, 23, 59, 59);
        } else {
            // Billing cycle format: YYYY-MM-DD_YYYY-MM-DD
            const [startStr, endStr] = currentHistoryCycle.split('_');
            const [startYear, startMonth, startDay] = startStr.split('-').map(n => parseInt(n));
            const [endYear, endMonth, endDay] = endStr.split('-').map(n => parseInt(n));
            startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0);
            endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59);
        }
        
        // Query expenses
        let query = db.collection('expenses')
            .where('userId', '==', currentUser.uid)
            .where('timestamp', '>=', startDate)
            .where('timestamp', '<=', endDate);
        
        if (currentHistoryCard !== 'all') {
            query = query.where('card', '==', currentHistoryCard);
        }
        
        const snapshot = await query.get();
        const expenses = [];
        
        snapshot.forEach(doc => {
            expenses.push({ id: doc.id, ...doc.data() });
        });
        
        // Calculate statistics
        const stats = calculateCycleStats(expenses);
        
        // Display results
        displayCycleHistory(expenses, stats, startDate, endDate);
        
    } catch (error) {
        console.error('Error loading cycle history:', error);
        contentDiv.innerHTML = '<p class="error">Failed to load cycle history.</p>';
    }
}

// Calculate statistics for a cycle
function calculateCycleStats(expenses) {
    const stats = {
        total: 0,
        neoTotal: 0,
        rbcTotal: 0,
        categories: {},
        count: expenses.length,
        avgPerDay: 0,
        recurringTotal: 0
    };
    
    expenses.forEach(expense => {
        stats.total += expense.amount;
        
        if (expense.card === 'neo') {
            stats.neoTotal += expense.amount;
        } else if (expense.card === 'rbc') {
            stats.rbcTotal += expense.amount;
        }
        
        if (!stats.categories[expense.category]) {
            stats.categories[expense.category] = 0;
        }
        stats.categories[expense.category] += expense.amount;
        
        if (expense.isRecurring) {
            stats.recurringTotal += expense.amount;
        }
    });
    
    return stats;
}

// Display cycle history
function displayCycleHistory(expenses, stats, startDate, endDate) {
    const contentDiv = document.getElementById('cycleHistoryContent');
    if (!contentDiv) return;
    
    const periodName = billingCycleManager.viewMode === 'calendar' 
        ? startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
    
    let html = `
        <div class="cycle-summary">
            <h3>${periodName}</h3>
            <div class="cycle-stats">
                <div class="stat-item">
                    <span class="stat-label">Total Spent</span>
                    <span class="stat-value">$${stats.total.toFixed(2)}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Transactions</span>
                    <span class="stat-value">${stats.count}</span>
                </div>
                ${currentHistoryCard === 'all' ? `
                    <div class="stat-item">
                        <span class="stat-label">Neo Card</span>
                        <span class="stat-value">$${stats.neoTotal.toFixed(2)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">RBC Card</span>
                        <span class="stat-value">$${stats.rbcTotal.toFixed(2)}</span>
                    </div>
                ` : ''}
                <div class="stat-item">
                    <span class="stat-label">Recurring</span>
                    <span class="stat-value">$${stats.recurringTotal.toFixed(2)}</span>
                </div>
            </div>
            
            <div class="category-breakdown-history">
                <h4>Category Breakdown</h4>
                ${Object.entries(stats.categories)
                    .sort(([,a], [,b]) => b - a)
                    .map(([category, amount]) => `
                        <div class="category-row">
                            <span class="category-name">
                                ${getCategoryIcon(category)} ${formatCategoryName(category)}
                            </span>
                            <span class="category-amount">$${amount.toFixed(2)}</span>
                        </div>
                    `).join('')}
            </div>
        </div>
    `;
    
    contentDiv.innerHTML = html;
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Cycle history button
    const cycleHistoryBtn = document.getElementById('cycleHistoryBtn');
    if (cycleHistoryBtn) {
        cycleHistoryBtn.addEventListener('click', openCycleHistoryModal);
    }
    
    // Card select change
    const historyCardSelect = document.getElementById('historyCardSelect');
    if (historyCardSelect) {
        historyCardSelect.addEventListener('change', () => {
            loadCycleOptions();
        });
    }
    
    // Cycle select change
    const historyCycleSelect = document.getElementById('historyCycleSelect');
    if (historyCycleSelect) {
        historyCycleSelect.addEventListener('change', loadCycleHistory);
    }
    
    // Close modal when clicking outside
    const cycleHistoryModal = document.getElementById('cycleHistoryModal');
    if (cycleHistoryModal) {
        cycleHistoryModal.addEventListener('click', (e) => {
            if (e.target === cycleHistoryModal) {
                closeCycleHistoryModal();
            }
        });
    }
});

// Helper function to get category icon
function getCategoryIcon(category) {
    const icons = {
        'streaming': '📺',
        'software': '💻',
        'utilities': '🔌',
        'insurance': '🛡️',
        'memberships': '🎫',
        'other-bills': '📄',
        'food': '🍔',
        'delivery': '🚚',
        'groceries': '🛒',
        'shopping': '🛍️',
        'entertainment': '🎬',
        'other': '📦'
    };
    return icons[category] || '📦';
}

// Helper function to format category name
function formatCategoryName(category) {
    return category.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}