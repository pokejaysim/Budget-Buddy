// Recurring Expense Manager for Budget Buddy

class RecurringExpenseManager {
    constructor() {
        this.templates = [];
        this.lastProcessedDate = null;
    }

    // Initialize recurring expense system
    async initialize(userId) {
        if (!userId) return;

        try {
            // Load recurring templates
            await this.loadRecurringTemplates(userId);
            
            // Check and process any pending recurring expenses
            await this.processRecurringExpenses(userId);
            
            console.log('🔄 Recurring expense manager initialized');
        } catch (error) {
            console.error('Error initializing recurring manager:', error);
        }
    }

    // Load recurring expense templates from database
    async loadRecurringTemplates(userId) {
        try {
            const snapshot = await firebase.firestore()
                .collection('users')
                .doc(userId)
                .collection('recurringTemplates')
                .where('isActive', '==', true)
                .get();

            this.templates = [];
            snapshot.forEach(doc => {
                this.templates.push({ id: doc.id, ...doc.data() });
            });

            console.log(`📋 Loaded ${this.templates.length} recurring templates`);
            return this.templates;
        } catch (error) {
            console.error('Error loading recurring templates:', error);
            return [];
        }
    }

    // Create a recurring template from an expense
    async createRecurringTemplate(userId, expense) {
        if (!expense.isRecurring) return null;

        try {
            const template = {
                amount: expense.amount,
                card: expense.card,
                category: expense.category,
                description: expense.description || `${expense.card.toUpperCase()} - ${expense.category}`,
                billingDay: expense.timestamp.toDate().getDate(),
                isActive: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastGeneratedMonth: expense.timestamp.toDate().getMonth(),
                lastGeneratedYear: expense.timestamp.toDate().getFullYear()
            };

            const docRef = await firebase.firestore()
                .collection('users')
                .doc(userId)
                .collection('recurringTemplates')
                .add(template);

            console.log('✅ Created recurring template:', docRef.id);
            return { id: docRef.id, ...template };
        } catch (error) {
            console.error('Error creating recurring template:', error);
            return null;
        }
    }

    // Process and generate recurring expenses for new billing periods
    async processRecurringExpenses(userId) {
        if (!userId) return;

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const currentDay = now.getDate();

        console.log(`🔄 Processing recurring expenses for ${currentMonth + 1}/${currentYear}`);

        try {
            // Get all active recurring templates
            const templates = await this.loadRecurringTemplates(userId);

            for (const template of templates) {
                // Check if we need to generate expense for this month
                const needsGeneration = this.shouldGenerateExpense(
                    template,
                    currentMonth,
                    currentYear,
                    currentDay
                );

                if (needsGeneration) {
                    await this.generateRecurringExpense(userId, template, currentMonth, currentYear);
                }
            }

            // Update last processed date
            this.lastProcessedDate = now;
            await this.saveProcessingStatus(userId, now);

        } catch (error) {
            console.error('Error processing recurring expenses:', error);
        }
    }

    // Check if expense should be generated
    shouldGenerateExpense(template, currentMonth, currentYear, currentDay) {
        // If we haven't generated for this month yet
        if (template.lastGeneratedMonth !== currentMonth || 
            template.lastGeneratedYear !== currentYear) {
            
            // Check if we've passed the billing day
            if (currentDay >= template.billingDay) {
                return true;
            }
        }
        return false;
    }

    // Generate a recurring expense from template
    async generateRecurringExpense(userId, template, month, year) {
        try {
            // Calculate the expense date
            let expenseDate = new Date(year, month, template.billingDay);
            
            // Handle month-end edge cases
            const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
            if (template.billingDay > lastDayOfMonth) {
                expenseDate = new Date(year, month, lastDayOfMonth);
            }

            // Set to noon to avoid timezone issues
            expenseDate.setHours(12, 0, 0, 0);

            const expense = {
                amount: template.amount,
                card: template.card,
                category: template.category,
                description: template.description + ` (Auto-generated for ${month + 1}/${year})`,
                timestamp: firebase.firestore.Timestamp.fromDate(expenseDate),
                userId: userId,
                isRecurring: true,
                recurringTemplateId: template.id,
                autoGenerated: true,
                userTimezone: timezoneManager.userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone
            };

            // Add the expense
            const docRef = await firebase.firestore()
                .collection('expenses')
                .add(expense);

            // Update template with last generated info
            await firebase.firestore()
                .collection('users')
                .doc(userId)
                .collection('recurringTemplates')
                .doc(template.id)
                .update({
                    lastGeneratedMonth: month,
                    lastGeneratedYear: year,
                    lastGeneratedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

            console.log(`✅ Generated recurring expense: ${template.description} for ${month + 1}/${year}`);
            
            // Show notification
            this.showRecurringNotification(template.description, expense.amount);

            return docRef.id;
        } catch (error) {
            console.error('Error generating recurring expense:', error);
            return null;
        }
    }

    // Save processing status
    async saveProcessingStatus(userId, lastProcessedDate) {
        try {
            await firebase.firestore()
                .collection('users')
                .doc(userId)
                .set({
                    recurringProcessing: {
                        lastProcessedDate: firebase.firestore.Timestamp.fromDate(lastProcessedDate),
                        lastProcessedMonth: lastProcessedDate.getMonth(),
                        lastProcessedYear: lastProcessedDate.getFullYear()
                    }
                }, { merge: true });
        } catch (error) {
            console.error('Error saving processing status:', error);
        }
    }

    // Show notification for auto-generated expense
    showRecurringNotification(description, amount) {
        const notification = document.createElement('div');
        notification.className = 'recurring-notification show';
        notification.innerHTML = `
            <span class="notification-icon">🔄</span>
            <div class="notification-content">
                <strong>Recurring Expense Added</strong>
                <p>${description} - $${amount.toFixed(2)}</p>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 4 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    // Get all recurring templates
    async getRecurringTemplates(userId) {
        return await this.loadRecurringTemplates(userId);
    }

    // Update recurring template
    async updateTemplate(userId, templateId, updates) {
        try {
            await firebase.firestore()
                .collection('users')
                .doc(userId)
                .collection('recurringTemplates')
                .doc(templateId)
                .update({
                    ...updates,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

            console.log('✅ Updated recurring template:', templateId);
            return true;
        } catch (error) {
            console.error('Error updating template:', error);
            return false;
        }
    }

    // Deactivate recurring template
    async deactivateTemplate(userId, templateId) {
        return await this.updateTemplate(userId, templateId, { isActive: false });
    }

    // Delete recurring template
    async deleteTemplate(userId, templateId) {
        try {
            await firebase.firestore()
                .collection('users')
                .doc(userId)
                .collection('recurringTemplates')
                .doc(templateId)
                .delete();

            console.log('✅ Deleted recurring template:', templateId);
            return true;
        } catch (error) {
            console.error('Error deleting template:', error);
            return false;
        }
    }

    // Check for billing period change and process expenses
    async checkBillingPeriodChange(userId) {
        const now = new Date();
        const storedStatus = await this.getProcessingStatus(userId);
        
        if (!storedStatus || 
            storedStatus.lastProcessedMonth !== now.getMonth() ||
            storedStatus.lastProcessedYear !== now.getFullYear()) {
            
            console.log('📅 New billing period detected, processing recurring expenses...');
            await this.processRecurringExpenses(userId);
        }
    }

    // Get processing status
    async getProcessingStatus(userId) {
        try {
            const userDoc = await firebase.firestore()
                .collection('users')
                .doc(userId)
                .get();

            if (userDoc.exists && userDoc.data().recurringProcessing) {
                return userDoc.data().recurringProcessing;
            }
            return null;
        } catch (error) {
            console.error('Error getting processing status:', error);
            return null;
        }
    }

    // Create template from existing subscription templates
    async createFromSubscriptionTemplate(userId, template, billingDay) {
        try {
            const recurringTemplate = {
                amount: template.amount,
                card: 'neo', // Subscriptions are typically on Neo card
                category: template.category,
                description: template.name,
                billingDay: billingDay || new Date().getDate(),
                isActive: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastGeneratedMonth: -1, // Will generate on next check
                lastGeneratedYear: -1
            };

            const docRef = await firebase.firestore()
                .collection('users')
                .doc(userId)
                .collection('recurringTemplates')
                .add(recurringTemplate);

            console.log('✅ Created recurring template from subscription:', docRef.id);
            return { id: docRef.id, ...recurringTemplate };
        } catch (error) {
            console.error('Error creating template from subscription:', error);
            return null;
        }
    }
}

// Create global instance
const recurringExpenseManager = new RecurringExpenseManager();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RecurringExpenseManager, recurringExpenseManager };
}