// Timezone Utilities for Budget Buddy

class TimezoneManager {
    constructor() {
        this.userTimezone = null;
        this.initialized = false;
    }

    // Initialize timezone settings
    async initialize(userId) {
        try {
            // Get user's local timezone
            this.userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            console.log('🌍 Detected user timezone:', this.userTimezone);

            // Load saved timezone preference if exists
            if (userId && typeof firebase !== 'undefined') {
                const userDoc = await firebase.firestore()
                    .collection('users')
                    .doc(userId)
                    .get();
                
                if (userDoc.exists && userDoc.data().settings?.timezone) {
                    this.userTimezone = userDoc.data().settings.timezone;
                    console.log('🌍 Using saved timezone preference:', this.userTimezone);
                } else {
                    // Save detected timezone
                    await this.saveTimezonePreference(userId, this.userTimezone);
                }
            }

            this.initialized = true;
            return this.userTimezone;
        } catch (error) {
            console.error('Error initializing timezone:', error);
            // Fallback to detected timezone
            this.userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            this.initialized = true;
            return this.userTimezone;
        }
    }

    // Save timezone preference to Firebase
    async saveTimezonePreference(userId, timezone) {
        if (!userId || !timezone) return false;

        try {
            await firebase.firestore()
                .collection('users')
                .doc(userId)
                .set({
                    settings: {
                        timezone: timezone,
                        timezoneUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }
                }, { merge: true });

            this.userTimezone = timezone;
            console.log('✅ Timezone preference saved:', timezone);
            return true;
        } catch (error) {
            console.error('Error saving timezone preference:', error);
            return false;
        }
    }

    // Get current date in user's timezone
    getCurrentLocalDate() {
        const timezone = this.userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        const now = new Date();
        
        // Create a date string in the user's timezone
        const localDateString = now.toLocaleDateString('en-CA', { 
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        
        return localDateString; // Returns YYYY-MM-DD format
    }

    // Get current datetime in user's timezone
    getCurrentLocalDateTime() {
        const timezone = this.userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        const now = new Date();
        
        return new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    }

    // Convert a date to user's local timezone for display
    toLocalDate(date) {
        if (!date) return null;
        
        const timezone = this.userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        // Handle Firestore Timestamp
        if (date.toDate && typeof date.toDate === 'function') {
            date = date.toDate();
        }
        
        // Ensure we have a valid Date object
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        
        // Get the date components in the user's timezone
        const options = {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        };
        
        const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
        const dateObj = {};
        
        parts.forEach(part => {
            if (part.type !== 'literal') {
                dateObj[part.type] = part.value;
            }
        });
        
        return {
            date: date,
            localDateString: `${dateObj.year}-${dateObj.month}-${dateObj.day}`,
            localTimeString: `${dateObj.hour}:${dateObj.minute}`,
            displayDate: date.toLocaleDateString('en-US', { timeZone: timezone }),
            displayTime: date.toLocaleTimeString('en-US', { 
                timeZone: timezone,
                hour: '2-digit',
                minute: '2-digit'
            })
        };
    }

    // Create a date for a specific day in user's timezone
    createLocalDate(dateString, timeString = '00:00:00') {
        const timezone = this.userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        // Parse the date string
        const [year, month, day] = dateString.split('-').map(num => parseInt(num));
        const [hour, minute, second] = timeString.split(':').map(num => parseInt(num) || 0);
        
        // Create a date in the user's timezone
        const localDate = new Date(year, month - 1, day, hour, minute, second);
        
        // Adjust for timezone offset to ensure the date is correct
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        
        const formattedDate = formatter.format(localDate);
        
        // Return the date object
        return localDate;
    }

    // Get start of day in user's timezone
    getStartOfDay(date = new Date()) {
        const timezone = this.userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        // Handle Firestore Timestamp
        if (date.toDate && typeof date.toDate === 'function') {
            date = date.toDate();
        }
        
        const dateString = date.toLocaleDateString('en-CA', { timeZone: timezone });
        return this.createLocalDate(dateString, '00:00:00');
    }

    // Get end of day in user's timezone
    getEndOfDay(date = new Date()) {
        const timezone = this.userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        // Handle Firestore Timestamp
        if (date.toDate && typeof date.toDate === 'function') {
            date = date.toDate();
        }
        
        const dateString = date.toLocaleDateString('en-CA', { timeZone: timezone });
        return this.createLocalDate(dateString, '23:59:59');
    }

    // Check if two dates are on the same day in user's timezone
    isSameLocalDay(date1, date2) {
        const timezone = this.userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        const localDate1 = this.toLocalDate(date1);
        const localDate2 = this.toLocalDate(date2);
        
        return localDate1.localDateString === localDate2.localDateString;
    }

    // Get timezone display string
    getTimezoneDisplay() {
        const timezone = this.userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        const now = new Date();
        
        // Get timezone abbreviation
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            timeZoneName: 'short'
        });
        
        const parts = formatter.formatToParts(now);
        const timezoneName = parts.find(part => part.type === 'timeZoneName')?.value || timezone;
        
        return `${timezone} (${timezoneName})`;
    }

    // Format date for display with timezone awareness
    formatDateForDisplay(date, includeTime = false) {
        const localDate = this.toLocalDate(date);
        
        if (includeTime) {
            return `${localDate.displayDate} ${localDate.displayTime}`;
        }
        
        return localDate.displayDate;
    }

    // Get date input value (YYYY-MM-DD) for form inputs
    getDateInputValue(date = new Date()) {
        const localDate = this.toLocalDate(date);
        return localDate.localDateString;
    }
}

// Create global instance
const timezoneManager = new TimezoneManager();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TimezoneManager, timezoneManager };
}