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
const categories = ['food', 'delivery', 'groceries', 'shopping', 'entertainment', 'other'];

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
            loadRecentExpenses();
        } else if (targetView === 'summary') {
            loadSummary();
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
    });
});

// Category Selection
const categoryButtons = document.querySelectorAll('.category-btn');
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

auth.onAuthStateChanged(user => {
    currentUser = user;
    if (user) {
        loginScreen.classList.remove('active');
        mainApp.classList.add('active');
        userEmail.textContent = user.email;
        loadUserData();
        loadUserBudget();
        checkFirstTimeUser();
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
    
    const expense = {
        amount: amount,
        card: selectedCard,
        category: selectedCategory,
        description: descriptionInput.value.trim(),
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        userId: currentUser.uid
    };
    
    try {
        await db.collection('expenses').add(expense);
        
        // Show success message
        successMessage.classList.add('show');
        setTimeout(() => {
            successMessage.classList.remove('show');
        }, 2000);
        
        // Check budget status after expense
        checkBudgetAfterExpense(selectedCategory, amount);
        
        // Reset form for quick re-entry
        amountInput.value = '';
        descriptionInput.value = '';
        categoryButtons.forEach(b => b.classList.remove('active'));
        selectedCategory = null;
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

// Load User Data
async function loadUserData() {
    if (!currentUser) return;
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    try {
        const snapshot = await db.collection('expenses')
            .where('userId', '==', currentUser.uid)
            .where('timestamp', '>=', startOfMonth)
            .get();
        
        let neoSum = 0;
        let rbcSum = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.card === 'neo') {
                neoSum += data.amount;
            } else if (data.card === 'rbc') {
                rbcSum += data.amount;
            }
        });
        
        neoTotal.textContent = `$${neoSum.toFixed(2)}`;
        rbcTotal.textContent = `$${rbcSum.toFixed(2)}`;
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

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
                    <div class="expense-item">
                        <div class="expense-details">
                            <div class="expense-header">
                                <span class="expense-amount">$${expense.amount.toFixed(2)}</span>
                                <span class="expense-card">${expense.card.toUpperCase()}</span>
                            </div>
                            <div class="expense-info">
                                <span>${getCategoryIcon(expense.category)} ${expense.category}</span>
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
        food: '🍔',
        delivery: '🚚',
        groceries: '🛒',
        shopping: '🛍️',
        entertainment: '🎬',
        other: '📦'
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
            // Initialize with default budget
            userBudget = {
                food: 0,
                delivery: 0,
                groceries: 0,
                shopping: 0,
                entertainment: 0,
                other: 0
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

manageBudgetBtn.addEventListener('click', showBudgetModal);

function showBudgetModal() {
    // Populate current budget values
    if (userBudget) {
        categories.forEach(category => {
            const input = document.getElementById(`budget${category.charAt(0).toUpperCase() + category.slice(1)}`);
            if (input) {
                input.value = userBudget[category] || 0;
            }
        });
        updateBudgetTotal();
    }
    budgetModal.classList.add('active');
}

function closeBudgetModal() {
    budgetModal.classList.remove('active');
}

// Update total preview as user types
categories.forEach(category => {
    const input = document.getElementById(`budget${category.charAt(0).toUpperCase() + category.slice(1)}`);
    if (input) {
        input.addEventListener('input', updateBudgetTotal);
    }
});

function updateBudgetTotal() {
    let total = 0;
    categories.forEach(category => {
        const input = document.getElementById(`budget${category.charAt(0).toUpperCase() + category.slice(1)}`);
        if (input) {
            total += parseFloat(input.value) || 0;
        }
    });
    document.getElementById('budgetTotalPreview').textContent = `$${total}`;
}

budgetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newBudget = {};
    categories.forEach(category => {
        const input = document.getElementById(`budget${category.charAt(0).toUpperCase() + category.slice(1)}`);
        newBudget[category] = parseFloat(input.value) || 0;
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

// Dashboard Functions
async function loadDashboard() {
    if (!currentUser || !userBudget) return;
    
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
        
        // Calculate totals by category
        const categoryTotals = {};
        let totalSpent = 0;
        
        categories.forEach(cat => categoryTotals[cat] = 0);
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (categoryTotals.hasOwnProperty(data.category)) {
                categoryTotals[data.category] += data.amount;
                totalSpent += data.amount;
            }
        });
        
        monthlyExpenses = categoryTotals;
        
        // Update summary stats
        const totalBudget = Object.values(userBudget).reduce((sum, val) => sum + val, 0);
        const totalRemaining = totalBudget - totalSpent;
        const percentUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
        
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
        renderCategoryCards(categoryTotals);
        
        // Generate alerts
        generateBudgetAlerts(categoryTotals, totalSpent, totalBudget, percentUsed);
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function renderCategoryCards(categoryTotals) {
    const container = document.getElementById('budgetCategories');
    container.innerHTML = '';
    
    categories.forEach(category => {
        const spent = categoryTotals[category] || 0;
        const budget = userBudget[category] || 0;
        const remaining = budget - spent;
        const percentUsed = budget > 0 ? (spent / budget) * 100 : 0;
        
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

async function checkBudgetAfterExpense(category, amount) {
    if (!userBudget || !userBudget[category]) return;
    
    // Get current month's spending for this category
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    try {
        const snapshot = await db.collection('expenses')
            .where('userId', '==', currentUser.uid)
            .where('category', '==', category)
            .where('timestamp', '>=', startOfMonth)
            .get();
        
        let categoryTotal = 0;
        snapshot.forEach(doc => {
            categoryTotal += doc.data().amount;
        });
        
        const budget = userBudget[category];
        const percentUsed = (categoryTotal / budget) * 100;
        
        // Show alert if budget exceeded or close to limit
        if (percentUsed >= 100) {
            showBudgetAlert(`You've exceeded your ${category} budget! Spent: $${categoryTotal.toFixed(2)} of $${budget}`, 'danger');
        } else if (percentUsed >= 90) {
            showBudgetAlert(`Warning: You've used ${percentUsed.toFixed(0)}% of your ${category} budget`, 'warning');
        } else if (percentUsed >= 80) {
            showBudgetAlert(`Heads up: You've used ${percentUsed.toFixed(0)}% of your ${category} budget`, 'info');
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

function generateBudgetAlerts(categoryTotals, totalSpent, totalBudget, percentUsed) {
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
    
    // Category-specific alerts
    categories.forEach(category => {
        const spent = categoryTotals[category] || 0;
        const budget = userBudget[category] || 0;
        const percentUsed = budget > 0 ? (spent / budget) * 100 : 0;
        
        if (budget > 0 && percentUsed >= 100) {
            alerts.push({
                type: 'danger',
                icon: '📊',
                message: `${category.charAt(0).toUpperCase() + category.slice(1)} budget exceeded!`
            });
        }
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