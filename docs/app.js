// State Management
let currentUser = null;
let selectedCategory = null;
let currentPeriodStart = null;

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const mainApp = document.getElementById('mainApp');
const signInBtn = document.getElementById('signInBtn');
const signOutBtn = document.getElementById('signOutBtn');
const menuBtn = document.getElementById('menuBtn');
const dropdownMenu = document.getElementById('dropdownMenu');
const newPeriodBtn = document.getElementById('newPeriodBtn');
const exportBtn = document.getElementById('exportBtn');
const expenseForm = document.getElementById('expenseForm');
const amountInput = document.getElementById('amountInput');
const descriptionInput = document.getElementById('descriptionInput');
const categoryBtns = document.querySelectorAll('.category-btn');
const expensesList = document.getElementById('expensesList');
const totalAmount = document.getElementById('totalAmount');
const periodStart = document.getElementById('periodStart');
const dayCount = document.getElementById('dayCount');
const dailyAvg = document.getElementById('dailyAvg');
const currentPeriod = document.getElementById('currentPeriod');
const newPeriodModal = document.getElementById('newPeriodModal');
const modalTotal = document.getElementById('modalTotal');
const modalDays = document.getElementById('modalDays');
const toast = document.getElementById('toast');

// Initialize Firebase Auth
auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    if (user) {
        loginScreen.classList.remove('active');
        mainApp.classList.add('active');
        await loadUserData();
    } else {
        loginScreen.classList.add('active');
        mainApp.classList.remove('active');
    }
});

// Sign In
signInBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .catch(error => {
            console.error('Sign in error:', error);
            showToast('Sign in failed. Please try again.');
        });
});

// Sign Out
signOutBtn.addEventListener('click', () => {
    auth.signOut();
    dropdownMenu.classList.remove('show');
});

// Menu Toggle
menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle('show');
});

// Close dropdown when clicking outside
document.addEventListener('click', () => {
    dropdownMenu.classList.remove('show');
});

// Category Selection
categoryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        categoryBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedCategory = btn.dataset.category;
    });
});

// Expense Form Submission
expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!selectedCategory) {
        showToast('Please select a category');
        return;
    }
    
    const amount = parseFloat(amountInput.value);
    if (isNaN(amount) || amount <= 0) {
        showToast('Please enter a valid amount');
        return;
    }
    
    try {
        await db.collection('expenses').add({
            userId: currentUser.uid,
            amount: amount,
            category: selectedCategory,
            description: descriptionInput.value.trim(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Reset form
        amountInput.value = '';
        descriptionInput.value = '';
        categoryBtns.forEach(b => b.classList.remove('active'));
        selectedCategory = null;
        amountInput.focus();
        
        showToast('Expense added!');
        await loadUserData();
        
    } catch (error) {
        console.error('Error adding expense:', error);
        showToast('Failed to add expense');
    }
});

// Load User Data
async function loadUserData() {
    if (!currentUser) return;
    
    try {
        // Get current period start
        const periodMarker = await getCurrentPeriodStart();
        currentPeriodStart = periodMarker;
        
        // Get expenses since period start
        const expenses = await getExpensesSincePeriod(periodMarker);
        
        // Update UI
        updateSummary(expenses, periodMarker);
        updateExpensesList(expenses);
        updatePeriodLabel();
        
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Get Current Period Start
async function getCurrentPeriodStart() {
    const snapshot = await db.collection('periods')
        .where('userId', '==', currentUser.uid)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();
    
    if (!snapshot.empty) {
        return snapshot.docs[0].data().timestamp.toDate();
    }
    
    // If no period marker, use account creation or 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return thirtyDaysAgo;
}

// Get Expenses Since Period
async function getExpensesSincePeriod(periodStart) {
    const snapshot = await db.collection('expenses')
        .where('userId', '==', currentUser.uid)
        .where('timestamp', '>=', periodStart)
        .orderBy('timestamp', 'desc')
        .get();
    
    const expenses = [];
    snapshot.forEach(doc => {
        expenses.push({ id: doc.id, ...doc.data() });
    });
    
    return expenses;
}

// Update Summary
function updateSummary(expenses, periodStart) {
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const days = Math.max(1, Math.ceil((new Date() - periodStart) / (1000 * 60 * 60 * 24)));
    const daily = total / days;
    
    totalAmount.textContent = `$${total.toFixed(2)}`;
    periodStart.textContent = formatDate(periodStart);
    dayCount.textContent = days;
    dailyAvg.textContent = `$${daily.toFixed(2)}`;
}

// Update Expenses List
function updateExpensesList(expenses) {
    if (expenses.length === 0) {
        expensesList.innerHTML = '<div class="empty-state">No expenses yet</div>';
        return;
    }
    
    expensesList.innerHTML = expenses.map(expense => {
        const date = expense.timestamp ? expense.timestamp.toDate() : new Date();
        return `
            <div class="expense-item">
                <div class="expense-left">
                    <div class="expense-category">${getCategoryIcon(expense.category)}</div>
                    <div class="expense-details">
                        <div class="expense-description">
                            ${expense.description || getCategoryName(expense.category)}
                        </div>
                        <div class="expense-date">${formatDate(date)}</div>
                    </div>
                </div>
                <div class="expense-amount">$${expense.amount.toFixed(2)}</div>
            </div>
        `;
    }).join('');
}

// Update Period Label
function updatePeriodLabel() {
    const now = new Date();
    currentPeriod.textContent = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// New Period
newPeriodBtn.addEventListener('click', async () => {
    dropdownMenu.classList.remove('show');
    
    // Calculate current period stats
    const expenses = await getExpensesSincePeriod(currentPeriodStart);
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const days = Math.max(1, Math.ceil((new Date() - currentPeriodStart) / (1000 * 60 * 60 * 24)));
    
    modalTotal.textContent = `$${total.toFixed(2)}`;
    modalDays.textContent = `${days} days`;
    
    newPeriodModal.classList.add('show');
});

// Start New Period
async function startNewPeriod() {
    try {
        await db.collection('periods').add({
            userId: currentUser.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        closeModal();
        showToast('New period started!');
        await loadUserData();
        
    } catch (error) {
        console.error('Error starting new period:', error);
        showToast('Failed to start new period');
    }
}

// Export Data
exportBtn.addEventListener('click', async () => {
    dropdownMenu.classList.remove('show');
    
    try {
        const expenses = await getExpensesSincePeriod(currentPeriodStart);
        
        let csv = 'Date,Category,Description,Amount\n';
        expenses.forEach(expense => {
            const date = expense.timestamp ? expense.timestamp.toDate() : new Date();
            csv += `"${formatDate(date)}","${getCategoryName(expense.category)}","${expense.description || ''}","${expense.amount.toFixed(2)}"\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `expenses_${formatDate(new Date())}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        showToast('Data exported!');
        
    } catch (error) {
        console.error('Error exporting data:', error);
        showToast('Failed to export data');
    }
});

// Helper Functions
function getCategoryIcon(category) {
    const icons = {
        food: '🍔',
        transport: '🚗',
        shopping: '🛍️',
        bills: '📄',
        entertainment: '🎬',
        other: '📦'
    };
    return icons[category] || '📦';
}

function getCategoryName(category) {
    const names = {
        food: 'Food',
        transport: 'Transport',
        shopping: 'Shopping',
        bills: 'Bills',
        entertainment: 'Entertainment',
        other: 'Other'
    };
    return names[category] || 'Other';
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function closeModal() {
    newPeriodModal.classList.remove('show');
}

// Make functions available globally for onclick handlers
window.closeModal = closeModal;
window.startNewPeriod = startNewPeriod;

// Register Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(registration => console.log('ServiceWorker registered:', registration))
        .catch(error => console.log('ServiceWorker registration failed:', error));
}