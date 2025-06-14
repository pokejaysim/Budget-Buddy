// App State
let currentUser = null;
let selectedCard = 'rbc';
let selectedCategory = null;
let expenses = [];

// Platform detection
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

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
        
        // Load data for specific views
        if (targetView === 'recent') {
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
        
        // Reset form for quick re-entry
        amountInput.value = '';
        descriptionInput.value = '';
        categoryButtons.forEach(b => b.classList.remove('active'));
        selectedCategory = null;
        amountInput.focus();
        
        // Update totals
        loadUserData();
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