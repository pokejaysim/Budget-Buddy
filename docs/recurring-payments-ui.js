// Recurring Payments UI Management

let currentRecurringTab = 'active';
let recurringTemplates = [];

// Open recurring payments modal
function openRecurringPaymentsModal() {
    const modal = document.getElementById('recurringPaymentsModal');
    if (!modal) return;
    
    modal.style.display = 'block';
    loadRecurringPayments();
}

// Close recurring payments modal
function closeRecurringPaymentsModal() {
    const modal = document.getElementById('recurringPaymentsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Load recurring payments
async function loadRecurringPayments() {
    if (!currentUser) return;
    
    try {
        // Get all recurring templates
        recurringTemplates = await recurringExpenseManager.getRecurringTemplates(currentUser.uid);
        
        // Calculate totals
        updateRecurringTotals();
        
        // Display payments based on current tab
        displayRecurringPayments();
        
    } catch (error) {
        console.error('Error loading recurring payments:', error);
    }
}

// Update recurring totals
function updateRecurringTotals() {
    // Calculate total for active recurring payments
    const activeTotal = recurringTemplates
        .filter(t => t.isActive)
        .reduce((sum, t) => sum + t.amount, 0);
    
    // Update modal total
    const modalTotal = document.getElementById('recurringModalTotal');
    if (modalTotal) {
        modalTotal.textContent = `$${activeTotal.toFixed(2)}`;
    }
    
    // Update dashboard total
    const dashboardTotal = document.getElementById('neoRecurringTotal');
    if (dashboardTotal) {
        dashboardTotal.textContent = `$${activeTotal.toFixed(2)}`;
    }
}

// Display recurring payments based on current tab
function displayRecurringPayments() {
    const listContainer = document.getElementById('recurringPaymentsList');
    if (!listContainer) return;
    
    // Filter templates based on current tab
    let filteredTemplates = recurringTemplates;
    if (currentRecurringTab === 'active') {
        filteredTemplates = recurringTemplates.filter(t => t.isActive);
    } else if (currentRecurringTab === 'inactive') {
        filteredTemplates = recurringTemplates.filter(t => !t.isActive);
    }
    
    if (filteredTemplates.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <p>No ${currentRecurringTab} recurring payments found.</p>
                ${currentRecurringTab === 'active' ? '<p>Add new recurring payments to track your subscriptions.</p>' : ''}
            </div>
        `;
        return;
    }
    
    // Sort by amount (highest first)
    filteredTemplates.sort((a, b) => b.amount - a.amount);
    
    listContainer.innerHTML = filteredTemplates.map(template => `
        <div class="recurring-payment-item ${!template.isActive ? 'inactive' : ''}">
            <div class="payment-icon">${getCategoryIcon(template.category)}</div>
            <div class="payment-details">
                <div class="payment-name">${template.description}</div>
                <div class="payment-info">
                    <span>${formatCategoryName(template.category)}</span>
                    <span>Bills on day ${template.billingDay}</span>
                    ${template.lastGeneratedAt ? 
                        `<span>Last charged: ${new Date(template.lastGeneratedAt.toDate()).toLocaleDateString()}</span>` : 
                        '<span>Not yet charged</span>'
                    }
                </div>
            </div>
            <div class="payment-amount">$${template.amount.toFixed(2)}</div>
            <div class="payment-actions">
                ${template.isActive ? 
                    `<button class="payment-action-btn deactivate" onclick="toggleRecurringTemplate('${template.id}', false)">Pause</button>` :
                    `<button class="payment-action-btn activate" onclick="toggleRecurringTemplate('${template.id}', true)">Activate</button>`
                }
                <button class="payment-action-btn delete" onclick="confirmDeleteRecurring('${template.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

// Toggle recurring template status
async function toggleRecurringTemplate(templateId, activate) {
    try {
        await recurringExpenseManager.updateRecurringTemplate(currentUser.uid, templateId, {
            isActive: activate
        });
        
        // Show success message
        const action = activate ? 'activated' : 'paused';
        showNotification(`Recurring payment ${action} successfully`);
        
        // Reload the list
        await loadRecurringPayments();
        
    } catch (error) {
        console.error('Error toggling recurring template:', error);
        alert('Failed to update recurring payment');
    }
}

// Confirm delete recurring payment
function confirmDeleteRecurring(templateId) {
    const template = recurringTemplates.find(t => t.id === templateId);
    if (!template) return;
    
    if (confirm(`Are you sure you want to delete "${template.description}"? This will not affect past charges.`)) {
        deleteRecurringTemplate(templateId);
    }
}

// Delete recurring template
async function deleteRecurringTemplate(templateId) {
    try {
        await recurringExpenseManager.deleteRecurringTemplate(currentUser.uid, templateId);
        
        showNotification('Recurring payment deleted successfully');
        
        // Reload the list
        await loadRecurringPayments();
        
    } catch (error) {
        console.error('Error deleting recurring template:', error);
        alert('Failed to delete recurring payment');
    }
}

// Show notification
function showNotification(message) {
    const successMsg = document.getElementById('successMessage');
    if (successMsg) {
        successMsg.textContent = message;
        successMsg.classList.add('show');
        setTimeout(() => successMsg.classList.remove('show'), 3000);
    }
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
    // View recurring button
    const viewRecurringBtn = document.getElementById('viewRecurringBtn');
    if (viewRecurringBtn) {
        viewRecurringBtn.addEventListener('click', openRecurringPaymentsModal);
    }
    
    // Tab switching
    document.querySelectorAll('.recurring-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            // Update active tab
            document.querySelectorAll('.recurring-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            
            // Update current tab and display
            currentRecurringTab = e.target.dataset.tab;
            displayRecurringPayments();
        });
    });
    
    // Add new recurring payment button
    const addRecurringBtn = document.getElementById('addRecurringBtn');
    if (addRecurringBtn) {
        addRecurringBtn.addEventListener('click', () => {
            // Close recurring modal and switch to entry view with Neo card selected
            closeRecurringPaymentsModal();
            
            // Switch to entry view
            document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelector('[data-view="entry"]').classList.add('active');
            
            document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
            document.getElementById('entryView').classList.add('active');
            
            // Select Neo card
            document.getElementById('cardSelect').value = 'neo';
            handleCardChange();
            
            // Check the recurring checkbox
            const recurringCheckbox = document.getElementById('isRecurringCheckbox');
            if (recurringCheckbox) {
                recurringCheckbox.checked = true;
            }
        });
    }
    
    // Close modal when clicking outside
    const recurringModal = document.getElementById('recurringPaymentsModal');
    if (recurringModal) {
        recurringModal.addEventListener('click', (e) => {
            if (e.target === recurringModal) {
                closeRecurringPaymentsModal();
            }
        });
    }
});

// Update dashboard when recurring total changes
function updateDashboardRecurringTotal() {
    if (!currentUser) return;
    
    recurringExpenseManager.getRecurringTemplates(currentUser.uid).then(templates => {
        const activeTotal = templates
            .filter(t => t.isActive)
            .reduce((sum, t) => sum + t.amount, 0);
        
        const dashboardTotal = document.getElementById('neoRecurringTotal');
        if (dashboardTotal) {
            dashboardTotal.textContent = `$${activeTotal.toFixed(2)}`;
        }
    });
}