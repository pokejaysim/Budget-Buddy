// App State
let currentUser = null;
let selectedCard = 'rbc';
let selectedCategory = null;
let expenses = [];
let userBudget = null;
let monthlyExpenses = {};

// Platform detection
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Categories configuration
const categoriesByCard = {
    neo: ['streaming', 'software', 'utilities', 'insurance', 'memberships', 'other-bills'],
    rbc: ['food', 'delivery', 'groceries', 'shopping', 'entertainment', 'other']
};

// Categories object for backward compatibility
const categories = {
    neo: ['streaming', 'software', 'utilities', 'insurance', 'memberships', 'other-bills'],
    rbc: ['food', 'delivery', 'groceries', 'shopping', 'entertainment', 'other']
};

// Subscription templates for Neo card
const subscriptionTemplates = [
    { name: 'Netflix', amount: 15.99, category: 'streaming' },
    { name: 'Spotify', amount: 9.99, category: 'streaming' },
    { name: 'Phone Bill', amount: 50.00, category: 'utilities' },
    { name: 'Internet', amount: 60.00, category: 'utilities' },
    { name: 'Amazon Prime', amount: 14.99, category: 'memberships' }
];

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const mainApp = document.getElementById('mainApp');
const googleSignInBtn = document.getElementById('googleSignInBtn');
const signOutBtn = document.getElementById('signOutBtn');
const userEmail = document.getElementById('userEmail');
const expenseForm = document.getElementById('expenseForm');
const amountInput = document.getElementById('amountInput');
const descriptionInput = document.getElementById('descriptionInput');
const successMessage = document.getElementById('successMessage');
const neoTotal = document.getElementById('neoTotal');
const rbcTotal = document.getElementById('rbcTotal');
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');

// Navigation
const navButtons = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');

navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetView = btn.dataset.view;
        
        // Update active nav button
        navButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update active view
        views.forEach(v => v.classList.remove('active'));
        document.getElementById(`${targetView}View`).classList.add('active');
        
        // Show/hide quick stats based on view
        const quickStats = document.getElementById('quickStats');
        if (targetView === 'dashboard') {
            quickStats.style.display = 'none';
        } else {
            quickStats.style.display = 'grid';
        }
        
        // Load data for specific views
        if (targetView === 'dashboard') {
            loadDashboard();
        } else if (targetView === 'recent') {
            loadUserData(); // Update totals
            loadRecentExpenses();
        } else if (targetView === 'summary') {
            loadSummary();
        } else if (targetView === 'settings') {
            loadSettings();
        }
    });
});

// Card Selection
const cardButtons = document.querySelectorAll('.card-btn');
cardButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        cardButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedCard = btn.dataset.card;
        updateCategoryButtons();
        
        // Update form data attribute for styling
        const expenseForm = document.getElementById('expenseForm');
        if (expenseForm) {
            expenseForm.setAttribute('data-active-card', selectedCard);
        }
        
        // Show/hide recurring checkbox and templates based on card
        const recurringSection = document.getElementById('recurringSection');
        const templatesSection = document.getElementById('templatesSection');
        if (recurringSection) {
            recurringSection.style.display = selectedCard === 'neo' ? 'block' : 'none';
        }
        if (templatesSection) {
            templatesSection.style.display = selectedCard === 'neo' ? 'block' : 'none';
        }
    });
});

// Function to update category buttons based on selected card
function updateCategoryButtons() {
    const categoryGrid = document.querySelector('.category-grid');
    if (!categoryGrid) return;
    
    const categories = categoriesByCard[selectedCard];
    categoryGrid.innerHTML = categories.map(category => `
        <button type="button" class="category-btn" data-category="${category}">
            <span class="category-icon">${getCategoryIcon(category)}</span>
            <span class="category-name">${formatCategoryName(category)}</span>
        </button>
    `).join('');
    
    // Re-attach event listeners to new buttons
    const newCategoryButtons = categoryGrid.querySelectorAll('.category-btn');
    newCategoryButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            newCategoryButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedCategory = btn.dataset.category;
        });
    });
}

// Helper function to format category names
function formatCategoryName(category) {
    return category.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

// Function to apply subscription template
function applyTemplate(templateIndex) {
    const template = subscriptionTemplates[templateIndex];
    if (!template) return;
    
    // Set amount
    const amountInput = document.getElementById('amountInput');
    if (amountInput) amountInput.value = template.amount;
    
    // Set description
    const descriptionInput = document.getElementById('descriptionInput');
    if (descriptionInput) descriptionInput.value = template.name;
    
    // Set category
    selectedCategory = template.category;
    const categoryButtons = document.querySelectorAll('.category-btn');
    categoryButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === template.category);
    });
    
    // Check recurring checkbox
    const recurringCheckbox = document.getElementById('isRecurringCheckbox');
    if (recurringCheckbox) recurringCheckbox.checked = true;
}

// Category Selection - Initial setup
let categoryButtons = document.querySelectorAll('.category-btn');
categoryButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        categoryButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedCategory = btn.dataset.category;
    });
});

// Authentication
googleSignInBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(error => {
        console.error('Sign in error:', error);
        alert('Failed to sign in. Please try again.');
    });
});

signOutBtn.addEventListener('click', () => {
    auth.signOut();
});

auth.onAuthStateChanged(async user => {
    currentUser = user;
    if (user) {
        loginScreen.classList.remove('active');
        mainApp.classList.add('active');
        userEmail.textContent = user.email;
        
        // Initialize billing cycle settings
        await billingCycleManager.initializeSettings(user.uid);
        
        // Initialize dual tracking system
        await loadUserData();
        await loadUserBudget();
        await checkFirstTimeUser();
        
        // Initialize dashboard mode buttons and date range display
        const currentMode = billingCycleManager.viewMode || 'calendar';
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === currentMode);
        });
        
        // Update date range display
        if (typeof updateDateRangeDisplay === 'function') {
            updateDateRangeDisplay();
        }
        // Initialize category buttons for default card (RBC)
        updateCategoryButtons();
        // Set initial form data attribute
        const expenseForm = document.getElementById('expenseForm');
        if (expenseForm) {
            expenseForm.setAttribute('data-active-card', selectedCard);
        }
    } else {
        loginScreen.classList.add('active');
        mainApp.classList.remove('active');
    }
});

// Expense Form Submission
expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!selectedCategory) {
        alert('Please select a category');
        return;
    }
    
    const amount = parseFloat(amountInput.value);
    if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid amount');
        return;
    }
    
    const isRecurring = document.getElementById('isRecurringCheckbox')?.checked || false;
    
    const expense = {
        amount: amount,
        card: selectedCard,
        category: selectedCategory,
        description: descriptionInput.value.trim(),
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        userId: currentUser.uid,
        isRecurring: isRecurring
    };
    
    try {
        await db.collection('expenses').add(expense);
        
        // Show success message
        successMessage.classList.add('show');
        setTimeout(() => {
            successMessage.classList.remove('show');
        }, 2000);
        
        // Check budget status after expense
        checkBudgetAfterExpense(selectedCard, selectedCategory, amount);
        
        // Reset form for quick re-entry
        amountInput.value = '';
        descriptionInput.value = '';
        categoryButtons.forEach(b => b.classList.remove('active'));
        selectedCategory = null;
        
        // Reset recurring checkbox
        const recurringCheckbox = document.getElementById('isRecurringCheckbox');
        if (recurringCheckbox) recurringCheckbox.checked = false;
        
        amountInput.focus();
        
        // Update totals
        loadUserData();
        
        // Update dashboard if it's active
        if (document.getElementById('dashboardView').classList.contains('active')) {
            loadDashboard();
        }
    } catch (error) {
        console.error('Error saving expense:', error);
        alert(`Failed to save expense: ${error.message}`);
    }
});

// Load User Data - COMPLETELY REBUILT to use new dual tracking system
async function loadUserData() {
    if (!currentUser) return;
    
    console.log('\n🔄 LOAD USER DATA CALLED');
    
    // Use the new dual tracking calculation functions
    await updateDashboardTotals();
}

// Track active recurring filter
let activeRecurringFilter = 'all';

// Load Recent Expenses
async function loadRecentExpenses() {
    if (!currentUser) return;
    
    const recentExpensesDiv = document.getElementById('recentExpenses');
    const cardFilter = document.getElementById('cardFilter').value;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    // Show loading state
    recentExpensesDiv.innerHTML = '<div class="loading">Loading expenses...</div>';
    
    try {
        // Get expenses from last 14 days
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        
        let query = db.collection('expenses')
            .where('userId', '==', currentUser.uid)
            .where('timestamp', '>=', fourteenDaysAgo)
            .orderBy('timestamp', 'desc');
        
        const snapshot = await query.get();
        
        expenses = [];
        snapshot.forEach(doc => {
            expenses.push({ id: doc.id, ...doc.data() });
        });
        
        // Filter by card if selected
        let filteredExpenses = expenses;
        if (cardFilter !== 'all') {
            filteredExpenses = expenses.filter(exp => exp.card === cardFilter);
        }
        
        // Filter by recurring status
        if (activeRecurringFilter === 'recurring') {
            filteredExpenses = filteredExpenses.filter(exp => exp.isRecurring === true);
        } else if (activeRecurringFilter === 'one-time') {
            filteredExpenses = filteredExpenses.filter(exp => !exp.isRecurring);
        }
        
        // Filter by search term
        if (searchTerm) {
            filteredExpenses = filteredExpenses.filter(exp => 
                exp.description?.toLowerCase().includes(searchTerm) ||
                exp.category.toLowerCase().includes(searchTerm)
            );
        }
        
        // Render expenses
        if (filteredExpenses.length === 0) {
            recentExpensesDiv.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <p>No expenses found</p>
                </div>
            `;
        } else {
            recentExpensesDiv.innerHTML = filteredExpenses.map(expense => {
                const date = expense.timestamp ? expense.timestamp.toDate() : new Date();
                const dateStr = date.toLocaleDateString();
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
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

// Filter event listeners
document.getElementById('cardFilter').addEventListener('change', loadRecentExpenses);
document.getElementById('searchInput').addEventListener('input', loadRecentExpenses);

// Recurring filter tabs
document.addEventListener('DOMContentLoaded', () => {
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update filter
            activeRecurringFilter = tab.dataset.filter;
            
            // Reload expenses
            loadRecentExpenses();
        });
    });
});

// Load Summary
async function loadSummary() {
    if (!currentUser) return;
    
    const period = document.querySelector('.period-btn.active').dataset.period;
    const categoryBreakdownDiv = document.getElementById('categoryBreakdown');
    
    // Calculate date range
    const now = new Date();
    let startDate, endDate = now;
    let filterText = '';
    
    switch (period) {
        case 'week':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
            filterText = 'Last 7 days';
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            filterText = `${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
            break;
        case 'lastMonth':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            filterText = `${startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            filterText = `Year ${now.getFullYear()}`;
            break;
        case 'custom':
            startDate = new Date(startDateInput.value);
            endDate = new Date(endDateInput.value);
            endDate.setHours(23, 59, 59, 999);
            filterText = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
            break;
    }
    
    // Update filter info
    filterInfo.textContent = filterText;
    
    try {
        let query = db.collection('expenses')
            .where('userId', '==', currentUser.uid)
            .where('timestamp', '>=', startDate);
        
        if (period === 'lastMonth' || period === 'custom') {
            query = query.where('timestamp', '<=', endDate);
        }
        
        const snapshot = await query.get();
        
        // Calculate category totals
        const categoryTotals = {};
        let grandTotal = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (!categoryTotals[data.category]) {
                categoryTotals[data.category] = 0;
            }
            categoryTotals[data.category] += data.amount;
            grandTotal += data.amount;
        });
        
        // Render category breakdown
        const categories = Object.entries(categoryTotals)
            .sort((a, b) => b[1] - a[1]);
        
        if (categories.length === 0) {
            categoryBreakdownDiv.innerHTML = `
                <div class="empty-state">
                    <p>No expenses in this period</p>
                </div>
            `;
        } else {
            categoryBreakdownDiv.innerHTML = `
                <h3>Total: $${grandTotal.toFixed(2)}</h3>
                ${categories.map(([category, total]) => `
                    <div class="category-stat">
                        <div class="category-label">
                            <span>${getCategoryIcon(category)}</span>
                            <span>${category}</span>
                        </div>
                        <span class="category-total">$${total.toFixed(2)}</span>
                    </div>
                `).join('')}
            `;
        }
    } catch (error) {
        console.error('Error loading summary:', error);
        categoryBreakdownDiv.innerHTML = '<div class="error">Failed to load summary</div>';
    }
}

// Period selection
const dateFilterRow = document.getElementById('dateFilterRow');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const applyDateFilterBtn = document.getElementById('applyDateFilter');
const filterInfo = document.getElementById('filterInfo');

document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        if (btn.dataset.period === 'custom') {
            dateFilterRow.style.display = 'flex';
            // Set default dates
            const now = new Date();
            const lastMonth = new Date(now);
            lastMonth.setMonth(now.getMonth() - 1);
            startDateInput.value = lastMonth.toISOString().split('T')[0];
            endDateInput.value = now.toISOString().split('T')[0];
        } else {
            dateFilterRow.style.display = 'none';
            loadSummary();
        }
    });
});

applyDateFilterBtn.addEventListener('click', () => {
    loadSummary();
});

// Edit Expense
function editExpense(expenseId) {
    const expense = expenses.find(e => e.id === expenseId);
    if (!expense) return;
    
    document.getElementById('editExpenseId').value = expenseId;
    document.getElementById('editCard').value = expense.card;
    document.getElementById('editAmount').value = expense.amount;
    document.getElementById('editCategory').value = expense.category;
    document.getElementById('editDescription').value = expense.description || '';
    
    editModal.classList.add('active');
}

// Close Edit Modal
function closeEditModal() {
    editModal.classList.remove('active');
}

// Save Edit
editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const expenseId = document.getElementById('editExpenseId').value;
    const updatedData = {
        card: document.getElementById('editCard').value,
        amount: parseFloat(document.getElementById('editAmount').value),
        category: document.getElementById('editCategory').value,
        description: document.getElementById('editDescription').value.trim()
    };
    
    try {
        await db.collection('expenses').doc(expenseId).update(updatedData);
        closeEditModal();
        loadRecentExpenses();
        loadUserData();
    } catch (error) {
        console.error('Error updating expense:', error);
        alert('Failed to update expense');
    }
});

// Delete Expense
async function deleteExpense(expenseId) {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    
    try {
        await db.collection('expenses').doc(expenseId).delete();
        loadRecentExpenses();
        loadUserData();
    } catch (error) {
        console.error('Error deleting expense:', error);
        alert('Failed to delete expense');
    }
}

// Export to CSV
document.getElementById('exportBtn').addEventListener('click', async () => {
    if (!currentUser) return;
    
    try {
        const snapshot = await db.collection('expenses')
            .where('userId', '==', currentUser.uid)
            .orderBy('timestamp', 'desc')
            .get();
        
        let csv = 'Date,Time,Card,Category,Amount,Description\n';
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.timestamp ? data.timestamp.toDate() : new Date();
            const dateStr = date.toLocaleDateString();
            const timeStr = date.toLocaleTimeString();
            
            csv += `"${dateStr}","${timeStr}","${data.card.toUpperCase()}","${data.category}","${data.amount.toFixed(2)}","${data.description || ''}"\n`;
        });
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `budget-buddy-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting data:', error);
        alert('Failed to export data');
    }
});

// Helper function to get category icon
function getCategoryIcon(category) {
    const icons = {
        // RBC categories
        food: '🍔',
        delivery: '🚚',
        groceries: '🛒',
        shopping: '🛍️',
        entertainment: '🎬',
        other: '📦',
        // Neo categories
        streaming: '📺',
        software: '💻',
        utilities: '⚡',
        insurance: '🛡️',
        memberships: '🎫',
        'other-bills': '📄'
    };
    return icons[category] || '📦';
}

// PWA Installation
let deferredPrompt;
const installBtn = document.createElement('button');
installBtn.className = 'install-btn';
installBtn.textContent = 'Install Budget Buddy';
installBtn.id = 'installBtn';

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.querySelector('.login-container').appendChild(installBtn);
    installBtn.classList.add('show');
});

installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
    }
    
    deferredPrompt = null;
    installBtn.classList.remove('show');
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => console.log('SW registered:', registration))
            .catch(error => console.log('SW registration failed:', error));
    });
}

// Platform-specific optimizations
document.addEventListener('DOMContentLoaded', () => {
    // Add platform class to body
    if (isMobile) {
        document.body.classList.add('mobile');
    } else {
        document.body.classList.add('desktop');
    }
    
    if (isIOS) {
        document.body.classList.add('ios');
    }
    
    if (isTouchDevice) {
        document.body.classList.add('touch');
    }
    
    // Prevent iOS bounce scrolling
    if (isIOS) {
        document.addEventListener('touchmove', function(e) {
            if (e.target.closest('.modal-content') || e.target.closest('.expenses-list')) {
                return; // Allow scrolling in these areas
            }
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });
    }
    
    // Optimize input focus on mobile
    if (isMobile) {
        const amountInput = document.getElementById('amountInput');
        amountInput.addEventListener('focus', () => {
            setTimeout(() => {
                window.scrollTo(0, amountInput.offsetTop - 100);
            }, 300);
        });
    }
    
    // Add keyboard shortcuts for desktop
    if (!isMobile) {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + 1,2,3 for navigation
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case '1':
                        document.querySelector('[data-view="add"]').click();
                        e.preventDefault();
                        break;
                    case '2':
                        document.querySelector('[data-view="recent"]').click();
                        e.preventDefault();
                        break;
                    case '3':
                        document.querySelector('[data-view="summary"]').click();
                        e.preventDefault();
                        break;
                }
            }
        });
    }
});

// Budget Management Functions
async function loadUserBudget() {
    if (!currentUser) return;
    
    try {
        const budgetDoc = await db.collection('budgets').doc(currentUser.uid).get();
        if (budgetDoc.exists) {
            userBudget = budgetDoc.data();
        } else {
            // Initialize with default card-specific budget structure
            userBudget = {
                neo: {
                    food: 0,
                    delivery: 0,
                    groceries: 0,
                    shopping: 0,
                    entertainment: 0,
                    other: 0
                },
                rbc: {
                    food: 0,
                    delivery: 0,
                    groceries: 0,
                    shopping: 0,
                    entertainment: 0,
                    other: 0
                }
            };
        }
    } catch (error) {
        console.error('Error loading budget:', error);
    }
}

async function checkFirstTimeUser() {
    if (!currentUser) return;
    
    try {
        const budgetDoc = await db.collection('budgets').doc(currentUser.uid).get();
        if (!budgetDoc.exists) {
            // Show budget setup modal for first-time users
            showBudgetModal();
        }
    } catch (error) {
        console.error('Error checking first time user:', error);
    }
}

// Budget Modal Functions
const budgetModal = document.getElementById('budgetModal');
const budgetForm = document.getElementById('budgetForm');
const manageBudgetBtn = document.getElementById('manageBudgetBtn');
let currentBudgetCard = 'neo';
let budgetModes = { neo: 'total', rbc: 'total' };

manageBudgetBtn.addEventListener('click', showBudgetModal);

// Initialize budget modal after DOM loads
document.addEventListener('DOMContentLoaded', () => {
    initializeBudgetModal();
});

function initializeBudgetModal() {
    // Budget tab functionality
    document.querySelectorAll('.budget-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const card = tab.dataset.card;
            
            // Update active tab
            document.querySelectorAll('.budget-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show corresponding budget section
            document.querySelectorAll('.card-budget-section').forEach(section => {
                section.classList.remove('active');
            });
            document.querySelector(`.card-budget-section[data-card="${card}"]`).classList.add('active');
            
            currentBudgetCard = card;
            updateBudgetTotal();
        });
    });

    // Budget mode toggles
    ['neo', 'rbc'].forEach(card => {
        const modeInputs = document.querySelectorAll(`input[name="${card}BudgetMode"]`);
        modeInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                if (e.target.checked) {
                    budgetModes[card] = e.target.value;
                    toggleBudgetMode(card, e.target.value);
                    updateBudgetTotal();
                }
            });
        });
    });

    // Add input listeners for all budget inputs
    setupBudgetInputListeners();
}

function toggleBudgetMode(card, mode) {
    const totalSection = document.querySelector(`.total-budget-section[data-card="${card}"]`);
    const individualSection = document.querySelector(`.individual-budget-section[data-card="${card}"]`);
    
    if (mode === 'total') {
        totalSection.style.display = 'block';
        individualSection.style.display = 'none';
    } else {
        totalSection.style.display = 'none';
        individualSection.style.display = 'block';
    }
}

function setupBudgetInputListeners() {
    // Total budget inputs
    ['neo', 'rbc'].forEach(card => {
        const totalInput = document.getElementById(`budget${card.charAt(0).toUpperCase() + card.slice(1)}Total`);
        if (totalInput) {
            totalInput.addEventListener('input', updateBudgetTotal);
        }
        
        // Individual category inputs
        categoriesByCard[card].forEach(category => {
            const input = document.getElementById(`budget${card.charAt(0).toUpperCase() + card.slice(1)}${category.charAt(0).toUpperCase() + category.slice(1)}`);
            if (input) {
                input.addEventListener('input', () => {
                    updateCategorySubtotal(card);
                    updateBudgetTotal();
                });
            }
        });
    });
}

function showBudgetModal() {
    // Populate current budget values
    if (userBudget) {
        ['neo', 'rbc'].forEach(card => {
            // Check if we have stored budget mode or data structure
            const cardBudget = userBudget[card];
            if (cardBudget) {
                // Check if it's total mode (single number) or individual mode (object)
                if (typeof cardBudget === 'number' || (cardBudget.total !== undefined)) {
                    // Total budget mode
                    budgetModes[card] = 'total';
                    const totalInput = document.getElementById(`budget${card.charAt(0).toUpperCase() + card.slice(1)}Total`);
                    if (totalInput) {
                        totalInput.value = cardBudget.total || cardBudget || 0;
                    }
                    document.querySelector(`input[name="${card}BudgetMode"][value="total"]`).checked = true;
                    toggleBudgetMode(card, 'total');
                } else {
                    // Individual category mode
                    budgetModes[card] = 'individual';
                    categoriesByCard[card].forEach(category => {
                        const input = document.getElementById(`budget${card.charAt(0).toUpperCase() + card.slice(1)}${category.charAt(0).toUpperCase() + category.slice(1)}`);
                        if (input) {
                            input.value = cardBudget[category] || 0;
                        }
                    });
                    document.querySelector(`input[name="${card}BudgetMode"][value="individual"]`).checked = true;
                    toggleBudgetMode(card, 'individual');
                    updateCategorySubtotal(card);
                }
            }
        });
        updateBudgetTotal();
    }
    budgetModal.classList.add('active');
}

function closeBudgetModal() {
    budgetModal.classList.remove('active');
}

function updateCategorySubtotal(card) {
    let total = 0;
    categoriesByCard[card].forEach(category => {
        const input = document.getElementById(`budget${card.charAt(0).toUpperCase() + card.slice(1)}${category.charAt(0).toUpperCase() + category.slice(1)}`);
        if (input) {
            total += parseFloat(input.value) || 0;
        }
    });
    
    const subtotalElement = document.getElementById(`budget${card.charAt(0).toUpperCase() + card.slice(1)}Subtotal`);
    if (subtotalElement) {
        subtotalElement.textContent = `$${total}`;
    }
}

function updateBudgetTotal() {
    let grandTotal = 0;
    
    ['neo', 'rbc'].forEach(card => {
        let cardTotal = 0;
        
        if (budgetModes[card] === 'total') {
            const totalInput = document.getElementById(`budget${card.charAt(0).toUpperCase() + card.slice(1)}Total`);
            if (totalInput) {
                cardTotal = parseFloat(totalInput.value) || 0;
            }
        } else {
            categoriesByCard[card].forEach(category => {
                const input = document.getElementById(`budget${card.charAt(0).toUpperCase() + card.slice(1)}${category.charAt(0).toUpperCase() + category.slice(1)}`);
                if (input) {
                    cardTotal += parseFloat(input.value) || 0;
                }
            });
        }
        
        grandTotal += cardTotal;
    });
    
    const totalPreview = document.getElementById('budgetTotalPreview');
    if (totalPreview) {
        totalPreview.textContent = `$${grandTotal}`;
    }
}

budgetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newBudget = {
        neo: {},
        rbc: {}
    };
    
    ['neo', 'rbc'].forEach(card => {
        if (budgetModes[card] === 'total') {
            const totalInput = document.getElementById(`budget${card.charAt(0).toUpperCase() + card.slice(1)}Total`);
            newBudget[card] = {
                mode: 'total',
                total: parseFloat(totalInput.value) || 0
            };
        } else {
            newBudget[card] = {
                mode: 'individual'
            };
            categoriesByCard[card].forEach(category => {
                const input = document.getElementById(`budget${card.charAt(0).toUpperCase() + card.slice(1)}${category.charAt(0).toUpperCase() + category.slice(1)}`);
                newBudget[card][category] = parseFloat(input.value) || 0;
            });
        }
    });
    
    try {
        await db.collection('budgets').doc(currentUser.uid).set(newBudget);
        userBudget = newBudget;
        closeBudgetModal();
        loadDashboard();
        
        // Show success message
        const successMsg = document.getElementById('successMessage');
        successMsg.textContent = 'Budget updated successfully!';
        successMsg.classList.add('show');
        setTimeout(() => successMsg.classList.remove('show'), 2000);
    } catch (error) {
        console.error('Error saving budget:', error);
        alert('Failed to save budget. Please try again.');
    }
});

// Dashboard card view functionality
let currentDashboardView = 'combined';

document.querySelectorAll('.card-view-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const view = tab.dataset.view;
        
        // Update active tab
        document.querySelectorAll('.card-view-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        currentDashboardView = view;
        loadDashboard();
    });
});

// Function to load subscription overview
async function loadSubscriptionOverview() {
    if (!currentUser) return;
    
    const subscriptionOverview = document.getElementById('subscriptionOverview');
    const subscriptionList = document.getElementById('subscriptionList');
    
    try {
        // Get current month's recurring expenses
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const snapshot = await db.collection('expenses')
            .where('userId', '==', currentUser.uid)
            .where('timestamp', '>=', startOfMonth)
            .where('isRecurring', '==', true)
            .orderBy('timestamp', 'desc')
            .get();
        
        const subscriptions = [];
        snapshot.forEach(doc => {
            subscriptions.push({ id: doc.id, ...doc.data() });
        });
        
        if (subscriptions.length > 0) {
            subscriptionOverview.style.display = 'block';
            
            subscriptionList.innerHTML = subscriptions.map(sub => {
                const date = sub.timestamp ? sub.timestamp.toDate() : new Date();
                return `
                    <div class="subscription-item">
                        <div class="subscription-icon">${getCategoryIcon(sub.category)}</div>
                        <div class="subscription-details">
                            <div class="subscription-name">${sub.description || formatCategoryName(sub.category)}</div>
                            <div class="subscription-info">
                                <span class="subscription-amount">$${sub.amount.toFixed(2)}/month</span>
                                <span class="subscription-card">${sub.card.toUpperCase()}</span>
                            </div>
                        </div>
                        <div class="subscription-date">
                            Last charged: ${date.toLocaleDateString()}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            subscriptionOverview.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading subscriptions:', error);
        subscriptionOverview.style.display = 'none';
    }
}

// Function to update card usage displays
function updateCardUsageDisplay(cardTotalSpent, recurringTotal) {
    // Default Neo budget to $700
    const neoBudget = 700;
    const neoSpent = cardTotalSpent.neo || 0;
    const neoPercentage = Math.round((neoSpent / neoBudget) * 100);
    
    // Update Neo card display
    document.getElementById('neoUsageAmount').textContent = `$${neoSpent.toFixed(2)}`;
    document.getElementById('neoUsagePercentage').textContent = `${neoPercentage}%`;
    
    const neoProgress = document.getElementById('neoProgress');
    neoProgress.style.width = `${Math.min(neoPercentage, 100)}%`;
    
    // Apply color coding for Neo
    neoProgress.classList.remove('safe', 'warning', 'danger');
    if (neoPercentage < 70) {
        neoProgress.classList.add('safe');
        document.getElementById('neoStatus').textContent = '✅ On Track';
    } else if (neoPercentage < 90) {
        neoProgress.classList.add('warning');
        document.getElementById('neoStatus').textContent = '⚠️ Approaching Limit';
    } else {
        neoProgress.classList.add('danger');
        document.getElementById('neoStatus').textContent = '🚨 Over Budget';
    }
    
    // Update RBC card display
    const rbcSpent = cardTotalSpent.rbc || 0;
    let rbcBudget = 0;
    
    if (userBudget && userBudget.rbc) {
        if (userBudget.rbc.mode === 'total') {
            rbcBudget = userBudget.rbc.total || 0;
        } else {
            // Sum individual category budgets
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
        
        // Apply color coding for RBC
        rbcProgress.classList.remove('safe', 'warning', 'danger');
        if (rbcPercentage < 70) {
            rbcProgress.classList.add('safe');
            document.getElementById('rbcStatus').textContent = '✅ On Track';
        } else if (rbcPercentage < 90) {
            rbcProgress.classList.add('warning');
            document.getElementById('rbcStatus').textContent = '⚠️ Approaching Limit';
        } else {
            rbcProgress.classList.add('danger');
            document.getElementById('rbcStatus').textContent = '🚨 Over Budget';
        }
    } else {
        document.getElementById('rbcUsagePercentage').textContent = '—';
        document.getElementById('rbcProgress').style.width = '0%';
        document.getElementById('rbcStatus').textContent = '📊 Set Budget';
    }
}

// Dashboard Functions
async function loadDashboard() {
    if (!currentUser) return;
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysInMonth = endOfMonth.getDate();
    const daysPassed = now.getDate();
    const daysRemaining = daysInMonth - daysPassed;
    
    try {
        // Load current month's expenses
        const snapshot = await db.collection('expenses')
            .where('userId', '==', currentUser.uid)
            .where('timestamp', '>=', startOfMonth)
            .get();
        
        // Calculate totals by card and category
        const cardExpenses = {
            neo: {},
            rbc: {}
        };
        
        // Initialize category totals for both cards
        Object.keys(categoriesByCard).forEach(card => {
            categoriesByCard[card].forEach(cat => {
                if (!cardExpenses[card][cat]) cardExpenses[card][cat] = 0;
            });
        });
        
        let totalSpent = 0;
        let cardTotalSpent = { neo: 0, rbc: 0 };
        let recurringTotal = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const card = data.card;
            const category = data.category;
            const amount = data.amount;
            
            if (cardExpenses[card] && cardExpenses[card].hasOwnProperty(category)) {
                cardExpenses[card][category] += amount;
                cardTotalSpent[card] += amount;
                totalSpent += amount;
                
                // Track recurring expenses
                if (data.isRecurring) {
                    recurringTotal += amount;
                }
            }
        });
        
        monthlyExpenses = cardExpenses;
        
        // Update enhanced card usage displays
        updateCardUsageDisplay(cardTotalSpent, recurringTotal);
        
        // Update month insights
        document.getElementById('daysRemaining').textContent = daysRemaining;
        document.getElementById('dailyAverage').textContent = `$${(totalSpent / daysPassed).toFixed(2)}`;
        document.getElementById('recurringTotal').textContent = `$${recurringTotal.toFixed(2)}`;
        
        // Load subscription overview if Neo card is selected
        if (currentDashboardView === 'neo' || (currentDashboardView === 'combined' && recurringTotal > 0)) {
            loadSubscriptionOverview();
        } else {
            document.getElementById('subscriptionOverview').style.display = 'none';
        }
        
        // Calculate budgets and display based on current view
        let displayBudget = {};
        let displayExpenses = {};
        let viewTitle = '';
        let totalBudget = 0;
        
        if (currentDashboardView === 'combined') {
            // Combine both cards
            const allCategories = [...new Set([...categoriesByCard.neo, ...categoriesByCard.rbc])];
            allCategories.forEach(cat => {
                let neoBudget = 0;
                let rbcBudget = 0;
                
                // Handle different budget modes
                if (userBudget.neo.mode === 'total') {
                    // For total mode, we'll show the category breakdown but budget will be the total
                    neoBudget = userBudget.neo.total || 0;
                } else {
                    neoBudget = userBudget.neo[cat] || 0;
                }
                
                if (userBudget.rbc.mode === 'total') {
                    rbcBudget = userBudget.rbc.total || 0;
                } else {
                    rbcBudget = userBudget.rbc[cat] || 0;
                }
                
                displayBudget[cat] = neoBudget + rbcBudget;
                displayExpenses[cat] = cardExpenses.neo[cat] + cardExpenses.rbc[cat];
            });
            
            // Calculate total budget for combined view
            totalBudget = (userBudget.neo.mode === 'total' ? userBudget.neo.total : Object.values(userBudget.neo).filter(v => typeof v === 'number').reduce((sum, val) => sum + val, 0)) +
                         (userBudget.rbc.mode === 'total' ? userBudget.rbc.total : Object.values(userBudget.rbc).filter(v => typeof v === 'number').reduce((sum, val) => sum + val, 0));
            
            viewTitle = 'Combined Monthly Status';
        } else {
            // Show specific card
            const card = currentDashboardView;
            const cardBudget = userBudget[card];
            displayExpenses = { ...cardExpenses[card] };
            totalSpent = cardTotalSpent[card];
            viewTitle = `${card.toUpperCase()} Card Monthly Status`;
            
            if (cardBudget.mode === 'total') {
                // For total mode, show total budget tracked across all categories
                totalBudget = cardBudget.total || 0;
                categoriesByCard[card].forEach(cat => {
                    displayBudget[cat] = totalBudget; // This will be handled specially in rendering
                });
            } else {
                // Individual category budgets
                categoriesByCard[card].forEach(cat => {
                    displayBudget[cat] = cardBudget[cat] || 0;
                });
                totalBudget = Object.values(displayBudget).reduce((sum, val) => sum + val, 0);
            }
        }
        const totalRemaining = totalBudget - totalSpent;
        const percentUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
        
        document.getElementById('summaryTitle').textContent = viewTitle;
        document.getElementById('totalSpent').textContent = `$${totalSpent.toFixed(2)}`;
        document.getElementById('totalBudget').textContent = `$${totalBudget.toFixed(2)}`;
        document.getElementById('totalRemaining').textContent = `$${totalRemaining.toFixed(2)}`;
        
        // Update overall progress bar
        const progressBar = document.getElementById('overallProgress');
        const progressText = document.getElementById('overallProgressText');
        progressBar.style.width = `${Math.min(percentUsed, 100)}%`;
        progressText.textContent = `${percentUsed.toFixed(0)}% of budget used`;
        
        // Apply color based on percentage
        progressBar.classList.remove('warning', 'danger');
        if (percentUsed >= 90) {
            progressBar.classList.add('danger');
        } else if (percentUsed >= 70) {
            progressBar.classList.add('warning');
        }
        
        // Update insights
        document.getElementById('daysRemaining').textContent = `${daysRemaining} days remaining`;
        const dailyAverage = daysPassed > 0 ? totalSpent / daysPassed : 0;
        document.getElementById('dailyAverage').textContent = `$${dailyAverage.toFixed(2)}/day average`;
        
        // Render category cards
        renderCategoryCards(displayExpenses, displayBudget, currentDashboardView, totalBudget, totalSpent);
        
        // Generate alerts
        generateBudgetAlerts(cardExpenses, totalSpent, totalBudget, percentUsed);
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function renderCategoryCards(categoryTotals, budgetTotals, view, totalBudget, totalSpent) {
    const container = document.getElementById('budgetCategories');
    container.innerHTML = '';
    
    // Check if we're in single card view with total budget mode
    const isSingleCardTotalMode = view !== 'combined' && userBudget[view] && userBudget[view].mode === 'total';
    
    if (isSingleCardTotalMode) {
        // For total budget mode, show one overall card instead of category breakdown
        const card = document.createElement('div');
        card.className = 'budget-category-card total-budget-card';
        
        const percentUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
        const remaining = totalBudget - totalSpent;
        
        let progressClass = '';
        if (percentUsed >= 90) progressClass = 'danger';
        else if (percentUsed >= 70) progressClass = 'warning';
        
        card.innerHTML = `
            <div class="category-header">
                <div class="category-name">
                    <span>💳</span>
                    <span>${view.toUpperCase()} Card Total Budget</span>
                </div>
                <div class="category-amount">
                    <span class="amount-spent">$${totalSpent.toFixed(2)}</span>
                    <span class="amount-budget">of $${totalBudget}</span>
                </div>
            </div>
            <div class="category-progress">
                <div class="progress-bar">
                    <div class="progress-fill ${progressClass}" style="width: ${Math.min(percentUsed, 100)}%"></div>
                </div>
            </div>
            <div class="category-footer">
                <span>${percentUsed.toFixed(0)}% used</span>
                <span>$${Math.max(remaining, 0).toFixed(2)} left</span>
            </div>
        `;
        
        container.appendChild(card);
        
        // Show spending breakdown by category (informational only)
        const breakdownCard = document.createElement('div');
        breakdownCard.className = 'spending-breakdown-card';
        breakdownCard.innerHTML = `
            <h4>Spending Breakdown</h4>
            <div class="breakdown-list">
                ${categories.map(category => {
                    const spent = categoryTotals[category] || 0;
                    const percentage = totalSpent > 0 ? (spent / totalSpent) * 100 : 0;
                    return spent > 0 ? `
                        <div class="breakdown-item">
                            <span>${getCategoryIcon(category)} ${category.charAt(0).toUpperCase() + category.slice(1)}</span>
                            <span>$${spent.toFixed(2)} (${percentage.toFixed(0)}%)</span>
                        </div>
                    ` : '';
                }).filter(item => item).join('')}
            </div>
        `;
        
        container.appendChild(breakdownCard);
    } else {
        // Standard category cards for individual budget mode or combined view
        const viewCategories = view === 'combined' 
            ? [...new Set([...categoriesByCard.neo, ...categoriesByCard.rbc])]
            : categoriesByCard[view] || [];
        viewCategories.forEach(category => {
            const spent = categoryTotals[category] || 0;
            const budget = budgetTotals[category] || 0;
            const remaining = budget - spent;
            const percentUsed = budget > 0 ? (spent / budget) * 100 : 0;
            
            // Skip categories with no budget and no spending
            if (budget === 0 && spent === 0) return;
            
            const card = document.createElement('div');
            card.className = 'budget-category-card';
            
            let progressClass = '';
            if (percentUsed >= 90) progressClass = 'danger';
            else if (percentUsed >= 70) progressClass = 'warning';
            
            card.innerHTML = `
                <div class="category-header">
                    <div class="category-name">
                        <span>${getCategoryIcon(category)}</span>
                        <span>${category.charAt(0).toUpperCase() + category.slice(1)}</span>
                    </div>
                    <div class="category-amount">
                        <span class="amount-spent">$${spent.toFixed(2)}</span>
                        <span class="amount-budget">of $${budget}</span>
                    </div>
                </div>
                <div class="category-progress">
                    <div class="progress-bar">
                        <div class="progress-fill ${progressClass}" style="width: ${Math.min(percentUsed, 100)}%"></div>
                    </div>
                </div>
                <div class="category-footer">
                    <span>${percentUsed.toFixed(0)}% used</span>
                    <span>$${Math.max(remaining, 0).toFixed(2)} left</span>
                </div>
            `;
            
            container.appendChild(card);
        });
    }
}

async function checkBudgetAfterExpense(card, category, amount) {
    if (!userBudget || !userBudget[card]) return;
    
    const cardBudget = userBudget[card];
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    try {
        if (cardBudget.mode === 'total') {
            // Check total card spending against total budget
            const snapshot = await db.collection('expenses')
                .where('userId', '==', currentUser.uid)
                .where('card', '==', card)
                .where('timestamp', '>=', startOfMonth)
                .get();
            
            let totalSpent = 0;
            snapshot.forEach(doc => {
                totalSpent += doc.data().amount;
            });
            
            const totalBudget = cardBudget.total || 0;
            const percentUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
            
            // Show alert based on total budget usage
            if (percentUsed >= 100) {
                showBudgetAlert(`${card.toUpperCase()} Card: You've exceeded your monthly budget! Spent: $${totalSpent.toFixed(2)} of $${totalBudget}`, 'danger');
            } else if (percentUsed >= 90) {
                showBudgetAlert(`${card.toUpperCase()} Card: Warning! You've used ${percentUsed.toFixed(0)}% of your monthly budget`, 'warning');
            } else if (percentUsed >= 80) {
                showBudgetAlert(`${card.toUpperCase()} Card: You've used ${percentUsed.toFixed(0)}% of your monthly budget`, 'info');
            }
        } else {
            // Check individual category budget
            if (!cardBudget[category]) return;
            
            const snapshot = await db.collection('expenses')
                .where('userId', '==', currentUser.uid)
                .where('card', '==', card)
                .where('category', '==', category)
                .where('timestamp', '>=', startOfMonth)
                .get();
            
            let categoryTotal = 0;
            snapshot.forEach(doc => {
                categoryTotal += doc.data().amount;
            });
            
            const budget = cardBudget[category];
            const percentUsed = budget > 0 ? (categoryTotal / budget) * 100 : 0;
            
            // Show alert if budget exceeded or close to limit
            if (percentUsed >= 100) {
                showBudgetAlert(`${card.toUpperCase()} Card: You've exceeded your ${category} budget! Spent: $${categoryTotal.toFixed(2)} of $${budget}`, 'danger');
            } else if (percentUsed >= 90) {
                showBudgetAlert(`${card.toUpperCase()} Card: Warning! You've used ${percentUsed.toFixed(0)}% of your ${category} budget`, 'warning');
            } else if (percentUsed >= 80) {
                showBudgetAlert(`${card.toUpperCase()} Card: You've used ${percentUsed.toFixed(0)}% of your ${category} budget`, 'info');
            }
        }
    } catch (error) {
        console.error('Error checking budget:', error);
    }
}

function showBudgetAlert(message, type = 'info') {
    const alert = document.createElement('div');
    alert.className = `budget-alert-popup ${type}`;
    alert.innerHTML = `
        <span class="alert-icon">${type === 'danger' ? '🚨' : type === 'warning' ? '⚠️' : '💡'}</span>
        <span>${message}</span>
    `;
    
    document.body.appendChild(alert);
    
    // Animate in
    setTimeout(() => alert.classList.add('show'), 10);
    
    // Remove after 4 seconds
    setTimeout(() => {
        alert.classList.remove('show');
        setTimeout(() => alert.remove(), 300);
    }, 4000);
}

function generateBudgetAlerts(cardExpenses, totalSpent, totalBudget, percentUsed) {
    const alertsContainer = document.getElementById('budgetAlerts');
    const alerts = [];
    
    // Overall budget alerts
    if (percentUsed >= 100) {
        alerts.push({
            type: 'danger',
            icon: '🚨',
            message: 'You have exceeded your monthly budget!'
        });
    } else if (percentUsed >= 90) {
        alerts.push({
            type: 'warning',
            icon: '⚠️',
            message: 'You\'ve used 90% of your monthly budget'
        });
    }
    
    // Card and category-specific alerts
    ['neo', 'rbc'].forEach(card => {
        categoriesByCard[card].forEach(category => {
            const spent = cardExpenses[card][category] || 0;
            const budget = userBudget[card][category] || 0;
            const percentUsed = budget > 0 ? (spent / budget) * 100 : 0;
            
            if (budget > 0 && percentUsed >= 100) {
                alerts.push({
                    type: 'danger',
                    icon: '📊',
                    message: `${card.toUpperCase()} Card: ${category.charAt(0).toUpperCase() + category.slice(1)} budget exceeded!`
                });
            }
        });
    });
    
    // Spending insights
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const expectedProgress = (dayOfMonth / daysInMonth) * 100;
    
    if (percentUsed > expectedProgress + 20) {
        alerts.push({
            type: 'info',
            icon: '💡',
            message: `You're spending faster than planned. Consider slowing down to stay within budget.`
        });
    }
    
    // Display alerts
    if (alerts.length > 0) {
        alertsContainer.style.display = 'block';
        alertsContainer.innerHTML = alerts.map(alert => `
            <div class="alert ${alert.type}">
                <span class="alert-icon">${alert.icon}</span>
                <span>${alert.message}</span>
            </div>
        `).join('');
    } else {
        alertsContainer.style.display = 'none';
    }
}