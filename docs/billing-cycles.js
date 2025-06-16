// Billing Cycle Management Module

class BillingCycleManager {
    constructor() {
        this.viewMode = 'calendar'; // 'calendar' or 'billing'
        this.billingDates = {
            neo: null,
            rbc: null
        };
        this.userSettings = null;
    }

    // Initialize billing cycle settings from Firebase
    async initializeSettings(userId) {
        try {
            const userDoc = await firebase.firestore()
                .collection('users')
                .doc(userId)
                .get();
            
            if (userDoc.exists) {
                const data = userDoc.data();
                this.userSettings = data.settings || {};
                this.billingDates.neo = this.userSettings.neoBillingDate || null;
                this.billingDates.rbc = this.userSettings.rbcBillingDate || null;
                this.viewMode = this.userSettings.viewMode || 'calendar';
            }
        } catch (error) {
            console.error('Error loading billing settings:', error);
        }
    }

    // Save billing settings to Firebase
    async saveBillingSettings(userId, settings) {
        try {
            await firebase.firestore()
                .collection('users')
                .doc(userId)
                .set({
                    settings: {
                        ...this.userSettings,
                        ...settings,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }
                }, { merge: true });
            
            // Update local settings
            this.userSettings = { ...this.userSettings, ...settings };
            if (settings.neoBillingDate !== undefined) this.billingDates.neo = settings.neoBillingDate;
            if (settings.rbcBillingDate !== undefined) this.billingDates.rbc = settings.rbcBillingDate;
            if (settings.viewMode !== undefined) this.viewMode = settings.viewMode;
            
            return true;
        } catch (error) {
            console.error('Error saving billing settings:', error);
            return false;
        }
    }

    // Get current billing cycle for a card
    getCurrentBillingCycle(card, referenceDate = new Date()) {
        const billingDate = this.billingDates[card];
        console.log(`Getting billing cycle for ${card}, billing date:`, billingDate);
        if (!billingDate) return null;

        const today = new Date(referenceDate);
        const year = today.getFullYear();
        const month = today.getMonth();
        const day = today.getDate();

        // Calculate cycle start date
        let cycleStart, cycleEnd;
        
        if (day >= billingDate) {
            // Current cycle started this month
            cycleStart = new Date(year, month, billingDate);
            cycleEnd = new Date(year, month + 1, billingDate - 1);
        } else {
            // Current cycle started last month
            cycleStart = new Date(year, month - 1, billingDate);
            cycleEnd = new Date(year, month, billingDate - 1);
        }

        // Handle month-end edge cases
        cycleStart = this.adjustForMonthEnd(cycleStart, billingDate);
        cycleEnd = this.adjustForMonthEnd(cycleEnd, billingDate - 1);

        return {
            start: cycleStart,
            end: cycleEnd,
            daysRemaining: this.getDaysBetween(today, cycleEnd),
            daysInCycle: this.getDaysBetween(cycleStart, cycleEnd) + 1,
            progress: this.getCycleProgress(cycleStart, cycleEnd, today)
        };
    }

    // Adjust date for month-end edge cases
    adjustForMonthEnd(date, targetDay) {
        const year = date.getFullYear();
        const month = date.getMonth();
        const lastDay = new Date(year, month + 1, 0).getDate();
        
        if (targetDay > lastDay) {
            return new Date(year, month, lastDay);
        }
        
        date.setDate(targetDay);
        return date;
    }

    // Get days between two dates
    getDaysBetween(date1, date2) {
        const oneDay = 24 * 60 * 60 * 1000;
        return Math.round((date2 - date1) / oneDay);
    }

    // Calculate cycle progress percentage
    getCycleProgress(start, end, current) {
        const totalDays = this.getDaysBetween(start, end) + 1;
        const daysElapsed = this.getDaysBetween(start, current) + 1;
        return Math.min(100, Math.max(0, (daysElapsed / totalDays) * 100));
    }

    // Get expenses for current period based on view mode
    async getExpensesForPeriod(userId, card = null) {
        const period = this.getCurrentPeriod(card);
        let query = firebase.firestore()
            .collection('users')
            .doc(userId)
            .collection('expenses')
            .where('timestamp', '>=', period.start)
            .where('timestamp', '<=', period.end);

        if (card) {
            query = query.where('card', '==', card);
        }

        const snapshot = await query.get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // Get current period based on view mode
    getCurrentPeriod(card = null) {
        if (this.viewMode === 'calendar') {
            return this.getCurrentCalendarMonth();
        } else if (card && this.billingDates[card]) {
            return this.getCurrentBillingCycle(card);
        } else {
            // Fallback to calendar if no billing date set
            return this.getCurrentCalendarMonth();
        }
    }

    // Get current calendar month period
    getCurrentCalendarMonth() {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        
        return {
            start: start,
            end: end,
            daysRemaining: this.getDaysBetween(now, end),
            daysInCycle: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
            progress: (now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()) * 100
        };
    }

    // Format period for display
    formatPeriod(period) {
        const options = { month: 'short', day: 'numeric' };
        const startStr = period.start.toLocaleDateString('en-US', options);
        const endStr = period.end.toLocaleDateString('en-US', options);
        
        if (period.start.getMonth() === period.end.getMonth()) {
            return `${startStr} - ${period.end.getDate()}`;
        } else {
            return `${startStr} - ${endStr}`;
        }
    }

    // Get period title for display
    getPeriodTitle(card = null) {
        if (this.viewMode === 'calendar') {
            const now = new Date();
            return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        } else if (card) {
            const cycle = this.getCurrentBillingCycle(card);
            if (cycle) {
                return `${card.toUpperCase()} Statement Period`;
            }
        }
        return 'Current Period';
    }

    // Check if statement is closing soon
    isStatementClosingSoon(card, daysThreshold = 3) {
        const cycle = this.getCurrentBillingCycle(card);
        return cycle && cycle.daysRemaining <= daysThreshold;
    }

    // Get all upcoming statement closes
    getUpcomingStatementCloses(daysThreshold = 7) {
        const alerts = [];
        
        ['neo', 'rbc'].forEach(card => {
            if (this.billingDates[card]) {
                const cycle = this.getCurrentBillingCycle(card);
                if (cycle && cycle.daysRemaining <= daysThreshold) {
                    alerts.push({
                        card: card,
                        daysRemaining: cycle.daysRemaining,
                        closeDate: cycle.end
                    });
                }
            }
        });
        
        return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
    }

    // Initialize date selectors in settings
    initializeDateSelectors() {
        const neoSelect = document.getElementById('neoBillingDate');
        const rbcSelect = document.getElementById('rbcBillingDate');
        
        if (!neoSelect || !rbcSelect) {
            console.error('Billing date selectors not found');
            return;
        }
        
        // Clear existing options (except first)
        neoSelect.innerHTML = '<option value="">Not set</option>';
        rbcSelect.innerHTML = '<option value="">Not set</option>';
        
        // Populate date options (1-31)
        for (let i = 1; i <= 31; i++) {
            const suffix = this.getDateSuffix(i);
            const option = `<option value="${i}">${i}${suffix}</option>`;
            neoSelect.insertAdjacentHTML('beforeend', option);
            rbcSelect.insertAdjacentHTML('beforeend', option);
        }
        
        // Set current values
        if (this.billingDates.neo) neoSelect.value = this.billingDates.neo;
        if (this.billingDates.rbc) rbcSelect.value = this.billingDates.rbc;
        
        // Update current cycle display
        this.updateCycleDisplays();
    }

    // Get date suffix (1st, 2nd, 3rd, etc.)
    getDateSuffix(day) {
        if (day >= 11 && day <= 13) return 'th';
        switch (day % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    }

    // Update cycle displays in settings
    updateCycleDisplays() {
        const neoCycle = document.getElementById('neoCurrentCycle');
        const rbcCycle = document.getElementById('rbcCurrentCycle');
        
        if (this.billingDates.neo) {
            const cycle = this.getCurrentBillingCycle('neo');
            neoCycle.textContent = `Current cycle: ${this.formatPeriod(cycle)} (${cycle.daysRemaining} days left)`;
        } else {
            neoCycle.textContent = '';
        }
        
        if (this.billingDates.rbc) {
            const cycle = this.getCurrentBillingCycle('rbc');
            rbcCycle.textContent = `Current cycle: ${this.formatPeriod(cycle)} (${cycle.daysRemaining} days left)`;
        } else {
            rbcCycle.textContent = '';
        }
    }

    // Toggle view mode
    toggleViewMode(mode) {
        console.log('Toggling from', this.viewMode, 'to', mode);
        this.viewMode = mode;
        console.log('Billing dates:', this.billingDates);
        return this.saveBillingSettings(currentUser.uid, { viewMode: mode });
    }
}

// Create global instance
const billingCycleManager = new BillingCycleManager();