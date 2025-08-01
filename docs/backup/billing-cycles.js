// Billing Cycle Management Module

class BillingCycleManager {
    constructor() {
        this.viewMode = 'calendar'; // 'calendar' or 'billing'
        this.rbcBillingDate = null;
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
                this.rbcBillingDate = this.userSettings.rbcBillingDate || null;
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
            if (settings.rbcBillingDate !== undefined) this.rbcBillingDate = settings.rbcBillingDate;
            if (settings.viewMode !== undefined) this.viewMode = settings.viewMode;
            
            return true;
        } catch (error) {
            console.error('Error saving billing settings:', error);
            return false;
        }
    }

    // Get current billing cycle for RBC
    getCurrentBillingCycle(card = 'rbc', referenceDate = new Date()) {
        const billingDate = this.rbcBillingDate;
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

        // Set time to start and end of day for proper comparison
        cycleStart.setHours(0, 0, 0, 0);
        cycleEnd.setHours(23, 59, 59, 999);
        
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

    // Get cycle key for a given date (format: YYYY-MM-DD for calendar, YYYY-MM-DD_YYYY-MM-DD for billing)
    getCycleKey(date, card = null) {
        if (this.viewMode === 'calendar') {
            const d = new Date(date);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        } else if (card && this.billingDates[card]) {
            const cycle = this.getCurrentBillingCycle(card, date);
            if (cycle) {
                const startStr = `${cycle.start.getFullYear()}-${String(cycle.start.getMonth() + 1).padStart(2, '0')}-${String(cycle.start.getDate()).padStart(2, '0')}`;
                const endStr = `${cycle.end.getFullYear()}-${String(cycle.end.getMonth() + 1).padStart(2, '0')}-${String(cycle.end.getDate()).padStart(2, '0')}`;
                return `${startStr}_${endStr}`;
            }
        }
        // Fallback to calendar month
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    // Check if a cycle is the current cycle
    isCurrentCycle(cycleKey, card = null) {
        const now = new Date();
        const currentKey = this.getCycleKey(now, card);
        return cycleKey === currentKey;
    }

    // Get current period based on view mode
    getCurrentPeriod(card = null) {
        if (this.viewMode === 'calendar') {
            return this.getCurrentCalendarMonth();
        } else if (card === 'rbc' && this.rbcBillingDate) {
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
        
        if (this.rbcBillingDate) {
            const cycle = this.getCurrentBillingCycle('rbc');
            if (cycle && cycle.daysRemaining <= daysThreshold) {
                alerts.push({
                    card: 'rbc',
                    daysRemaining: cycle.daysRemaining,
                    closeDate: cycle.end
                });
            }
        }
        
        return alerts;
    }

    // Initialize date selectors in settings
    initializeDateSelectors() {
        const rbcSelect = document.getElementById('rbcBillingDate');
        
        if (!neoSelect || !rbcSelect) {
            console.error('Billing date selectors not found');
            return;
        }
        
        // Clear existing options (except first)
        rbcSelect.innerHTML = '<option value="">Not set</option>';
        
        // Populate date options (1-31)
        for (let i = 1; i <= 31; i++) {
            const suffix = this.getDateSuffix(i);
            const option = `<option value="${i}">${i}${suffix}</option>`;
            rbcSelect.insertAdjacentHTML('beforeend', option);
        }
        
        // Set current values
        if (this.rbcBillingDate) rbcSelect.value = this.rbcBillingDate;
        
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
        const rbcCycle = document.getElementById('rbcCurrentCycle');
        
        if (this.rbcBillingDate) {
            const cycle = this.getCurrentBillingCycle('rbc');
            rbcCycle.textContent = `Current cycle: ${this.formatPeriod(cycle)} (${cycle.daysRemaining} days left)`;
        } else {
            rbcCycle.textContent = '';
        }
    }

    // Get Calendar Month Date Range
    getCalendarDateRange() {
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        
        return {
            start: startDate,
            end: endDate,
            description: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
            type: 'calendar'
        };
    }
    
    // Get Billing Cycle Date Range for RBC
    getBillingDateRange(card = 'rbc') {
        const billingDate = this.rbcBillingDate;
        if (!billingDate) {
            return null;
        }
        
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const day = today.getDate();

        let cycleStart, cycleEnd;
        
        if (day >= billingDate) {
            // Current cycle started this month
            cycleStart = new Date(year, month, billingDate, 0, 0, 0);
            cycleEnd = new Date(year, month + 1, billingDate - 1, 23, 59, 59);
        } else {
            // Current cycle started last month
            cycleStart = new Date(year, month - 1, billingDate, 0, 0, 0);
            cycleEnd = new Date(year, month, billingDate - 1, 23, 59, 59);
        }

        // Handle month-end edge cases
        cycleStart = this.adjustForMonthEnd(cycleStart, billingDate);
        cycleEnd = this.adjustForMonthEnd(cycleEnd, billingDate - 1);
        
        return {
            start: cycleStart,
            end: cycleEnd,
            description: `${cycleStart.toLocaleDateString()} - ${cycleEnd.toLocaleDateString()}`,
            type: 'billing',
            card: card
        };
    }

    // Toggle view mode
    toggleViewMode(mode) {
        this.viewMode = mode;
        return this.saveBillingSettings(currentUser.uid, { viewMode: mode });
    }

    // Get previous billing cycles (for historical view)
    getPreviousCycles(card, count = 6) {
        const cycles = [];
        const now = new Date();
        
        for (let i = 0; i < count; i++) {
            // Calculate date for i months ago
            const referenceDate = new Date(now.getFullYear(), now.getMonth() - i, now.getDate());
            const cycle = this.getCurrentBillingCycle(card, referenceDate);
            
            if (cycle) {
                const cycleKey = this.getCycleKey(referenceDate, card);
                cycles.push({
                    ...cycle,
                    key: cycleKey,
                    isCurrent: i === 0
                });
            }
        }
        
        return cycles;
    }

    // Get previous calendar months (for historical view)
    getPreviousMonths(count = 6) {
        const months = [];
        const now = new Date();
        
        for (let i = 0; i < count; i++) {
            const year = now.getFullYear();
            const month = now.getMonth() - i;
            const start = new Date(year, month, 1);
            const end = new Date(year, month + 1, 0, 23, 59, 59);
            
            const monthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
            
            months.push({
                start: start,
                end: end,
                key: monthKey,
                isCurrent: i === 0,
                monthName: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            });
        }
        
        return months;
    }
}

// Create global instance
const billingCycleManager = new BillingCycleManager();