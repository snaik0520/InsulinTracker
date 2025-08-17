
// Client-side JavaScript for Insulin Tracker Website
// Add this to your existing insulin tracker website

class GoogleSheetsSync {
    constructor(webAppUrl) {
        this.webAppUrl = webAppUrl;
        this.syncInProgress = false;
    }

    // Send inventory data to Google Sheets
    async syncToSheets(inventoryData) {
        if (this.syncInProgress) return;

        this.syncInProgress = true;
        try {
            const response = await fetch(this.webAppUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    action: 'update',
                    data: JSON.stringify(inventoryData)
                })
            });

            const result = await response.text();
            console.log('Sync to Sheets successful:', result);
            return true;
        } catch (error) {
            console.error('Error syncing to Sheets:', error);
            return false;
        } finally {
            this.syncInProgress = false;
        }
    }

    // Get inventory data from Google Sheets
    async getFromSheets() {
        try {
            const response = await fetch(this.webAppUrl + '?action=read');
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error getting data from Sheets:', error);
            return null;
        }
    }

    // Sync local storage with Google Sheets
    async bidirectionalSync() {
        try {
            // Get local data
            const localData = this.getLocalInventory();

            // Get sheets data
            const sheetsData = await this.getFromSheets();

            if (sheetsData && sheetsData.inventory) {
                // Compare timestamps and merge data
                const mergedData = this.mergeInventoryData(localData, sheetsData.inventory);

                // Update local storage
                this.saveLocalInventory(mergedData);

                // Update Google Sheets if local changes are newer
                await this.syncToSheets(mergedData);

                return mergedData;
            }

            return localData;
        } catch (error) {
            console.error('Bidirectional sync failed:', error);
            return this.getLocalInventory();
        }
    }

    // Get inventory from local storage with fallback
    getLocalInventory() {
        try {
            const stored = localStorage.getItem('insulin_inventory');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error reading local inventory:', error);
            return [];
        }
    }

    // Save inventory to local storage
    saveLocalInventory(inventory) {
        try {
            const dataWithTimestamp = {
                inventory: inventory,
                lastModified: new Date().toISOString()
            };
            localStorage.setItem('insulin_inventory', JSON.stringify(dataWithTimestamp));
        } catch (error) {
            console.error('Error saving local inventory:', error);
        }
    }

    // Merge local and sheets data based on timestamps
    mergeInventoryData(localData, sheetsData) {
        const localMap = new Map();
        const result = [];

        // Create map of local items by ID
        if (localData.inventory) {
            localData.inventory.forEach(item => {
                localMap.set(item.id, item);
            });
        }

        // Merge sheets data with local data
        sheetsData.forEach(sheetItem => {
            const localItem = localMap.get(sheetItem.id);

            if (localItem) {
                // Use the item with the most recent timestamp
                const sheetTime = new Date(sheetItem.lastModified || 0);
                const localTime = new Date(localItem.lastModified || 0);

                result.push(sheetTime > localTime ? sheetItem : localItem);
                localMap.delete(sheetItem.id);
            } else {
                result.push(sheetItem);
            }
        });

        // Add remaining local items
        localMap.forEach(item => result.push(item));

        return result;
    }
}

// Initialize the sync system
const GOOGLE_SHEETS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyTQPk0rylE_Rp8qT8IdLa7HAVeUi1fqb5sRIp7wH37OTM6ighKOCIFH402nLxdWsj6/exec';
const sheetsSync = new GoogleSheetsSync(GOOGLE_SHEETS_WEB_APP_URL);

// Enhanced inventory management with auto-sync
class InsulinInventoryManager {
    constructor() {
        this.inventory = [];
        this.initialize();
    }

    async initialize() {
        // Load data with bidirectional sync
        const syncedData = await sheetsSync.bidirectionalSync();
        this.inventory = Array.isArray(syncedData) ? syncedData : syncedData.inventory || [];
        this.renderInventory();

        // Set up periodic sync (every 30 seconds)
        setInterval(() => this.autoSync(), 30000);

        // Sync on visibility change (when user comes back to tab)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.autoSync();
            }
        });
    }

    async autoSync() {
        try {
            const syncedData = await sheetsSync.bidirectionalSync();
            const newInventory = Array.isArray(syncedData) ? syncedData : syncedData.inventory || [];

            if (JSON.stringify(this.inventory) !== JSON.stringify(newInventory)) {
                this.inventory = newInventory;
                this.renderInventory();
                console.log('Inventory updated from sync');
            }
        } catch (error) {
            console.error('Auto-sync failed:', error);
        }
    }

    async addItem(item) {
        const newItem = {
            id: this.generateId(),
            ...item,
            lastModified: new Date().toISOString()
        };

        this.inventory.push(newItem);
        this.saveAndSync();
        this.renderInventory();
    }

    async updateItem(id, updates) {
        const index = this.inventory.findIndex(item => item.id === id);
        if (index !== -1) {
            this.inventory[index] = {
                ...this.inventory[index],
                ...updates,
                lastModified: new Date().toISOString()
            };
            this.saveAndSync();
            this.renderInventory();
        }
    }

    async deleteItem(id) {
        this.inventory = this.inventory.filter(item => item.id !== id);
        this.saveAndSync();
        this.renderInventory();
    }

    async saveAndSync() {
        // Save locally first for immediate response
        sheetsSync.saveLocalInventory(this.inventory);

        // Then sync to sheets asynchronously
        await sheetsSync.syncToSheets(this.inventory);
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    renderInventory() {
        // Your existing rendering logic here
        console.log('Current inventory:', this.inventory);
        // Update your UI elements here
    }
}

// Usage example
document.addEventListener('DOMContentLoaded', () => {
    window.inventoryManager = new InsulinInventoryManager();
});

// Export functions for use in your existing code
window.InsulinTracker = {
    addInsulin: (type, quantity, expiryDate) => {
        window.inventoryManager.addItem({
            type,
            quantity: parseFloat(quantity),
            expiryDate,
            dateAdded: new Date().toISOString()
        });
    },

    updateQuantity: (id, newQuantity) => {
        window.inventoryManager.updateItem(id, { 
            quantity: parseFloat(newQuantity)
        });
    },

    removeInsulin: (id) => {
        window.inventoryManager.deleteItem(id);
    }
};
