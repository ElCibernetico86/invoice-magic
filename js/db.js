// ============================================================
// db.js — IndexedDB Persistence Layer
// ============================================================
// Offline-first storage using IndexedDB. All data stays local
// on the device. Provides a Promise-based API over the raw IDB.
// ============================================================

const DB_NAME = 'InvoiceMagicDB';
const DB_VERSION = 2;

const STORES = {
    DOCUMENTS: 'documents',
    CLIENTS: 'clients',
    COMPANY: 'companyProfile',
    PAYMENTS: 'payments',
    EXPENSES: 'expenses',
    TIME_ENTRIES: 'timeEntries',
    MILEAGE: 'mileageEntries',
    CATALOG: 'catalogItems',
};

class InvoiceMagicDB {
    constructor() {
        this.db = null;
    }

    // ── Open / Upgrade ──

    async open() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Documents store (invoices + estimates)
                if (!db.objectStoreNames.contains(STORES.DOCUMENTS)) {
                    const docStore = db.createObjectStore(STORES.DOCUMENTS, { keyPath: 'id', autoIncrement: true });
                    docStore.createIndex('documentType', 'documentType', { unique: false });
                    docStore.createIndex('status', 'status', { unique: false });
                    docStore.createIndex('creationDate', 'creationDate', { unique: false });
                    docStore.createIndex('clientId', 'clientId', { unique: false });
                }

                // Clients store
                if (!db.objectStoreNames.contains(STORES.CLIENTS)) {
                    const clientStore = db.createObjectStore(STORES.CLIENTS, { keyPath: 'id', autoIncrement: true });
                    clientStore.createIndex('name', 'name', { unique: false });
                }

                // Company profile (single record)
                if (!db.objectStoreNames.contains(STORES.COMPANY)) {
                    db.createObjectStore(STORES.COMPANY, { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains(STORES.PAYMENTS)) {
                    const paymentStore = db.createObjectStore(STORES.PAYMENTS, { keyPath: 'id', autoIncrement: true });
                    paymentStore.createIndex('documentId', 'documentId', { unique: false });
                    paymentStore.createIndex('paymentDate', 'paymentDate', { unique: false });
                    paymentStore.createIndex('clientId', 'clientId', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.EXPENSES)) {
                    const expenseStore = db.createObjectStore(STORES.EXPENSES, { keyPath: 'id', autoIncrement: true });
                    expenseStore.createIndex('expenseDate', 'expenseDate', { unique: false });
                    expenseStore.createIndex('clientId', 'clientId', { unique: false });
                    expenseStore.createIndex('documentId', 'documentId', { unique: false });
                    expenseStore.createIndex('category', 'category', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.TIME_ENTRIES)) {
                    const timeStore = db.createObjectStore(STORES.TIME_ENTRIES, { keyPath: 'id', autoIncrement: true });
                    timeStore.createIndex('entryDate', 'entryDate', { unique: false });
                    timeStore.createIndex('clientId', 'clientId', { unique: false });
                    timeStore.createIndex('documentId', 'documentId', { unique: false });
                    timeStore.createIndex('billable', 'billable', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.MILEAGE)) {
                    const mileageStore = db.createObjectStore(STORES.MILEAGE, { keyPath: 'id', autoIncrement: true });
                    mileageStore.createIndex('tripDate', 'tripDate', { unique: false });
                    mileageStore.createIndex('clientId', 'clientId', { unique: false });
                    mileageStore.createIndex('documentId', 'documentId', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.CATALOG)) {
                    const catalogStore = db.createObjectStore(STORES.CATALOG, { keyPath: 'id', autoIncrement: true });
                    catalogStore.createIndex('name', 'name', { unique: false });
                    catalogStore.createIndex('category', 'category', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    // ── Generic CRUD ──

    async _transaction(storeName, mode, callback) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, mode);
            const store = tx.objectStore(storeName);
            const result = callback(store);

            if (result && result.onsuccess !== undefined) {
                result.onsuccess = () => resolve(result.result);
                result.onerror = () => reject(result.error);
            } else {
                tx.oncomplete = () => resolve(result);
                tx.onerror = () => reject(tx.error);
            }
        });
    }

    async add(storeName, data) {
        return this._transaction(storeName, 'readwrite', (store) => store.add(data));
    }

    async put(storeName, data) {
        return this._transaction(storeName, 'readwrite', (store) => store.put(data));
    }

    async get(storeName, id) {
        return this._transaction(storeName, 'readonly', (store) => store.get(id));
    }

    async getAll(storeName) {
        return this._transaction(storeName, 'readonly', (store) => store.getAll());
    }

    async delete(storeName, id) {
        return this._transaction(storeName, 'readwrite', (store) => store.delete(id));
    }

    async getAllByIndex(storeName, indexName, value) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ── Documents ──

    async saveDocument(doc) {
        if (doc.id) {
            await this.put(STORES.DOCUMENTS, doc);
            return doc.id;
        } else {
            const id = await this.add(STORES.DOCUMENTS, doc);
            return id;
        }
    }

    async getDocument(id) {
        return this.get(STORES.DOCUMENTS, id);
    }

    async getDocumentsByType(type) {
        const docs = await this.getAllByIndex(STORES.DOCUMENTS, 'documentType', type);
        // Sort by creation date descending
        return docs.sort((a, b) => new Date(b.creationDate) - new Date(a.creationDate));
    }

    async getAllDocuments() {
        const docs = await this.getAll(STORES.DOCUMENTS);
        return docs.sort((a, b) => new Date(b.creationDate) - new Date(a.creationDate));
    }

    async deleteDocument(id) {
        return this.delete(STORES.DOCUMENTS, id);
    }

    async duplicateDocument(id) {
        const doc = await this.getDocument(id);
        if (!doc) return null;

        const nextNumber = await this.getNextDocumentNumber(doc.documentType);
        const clone = {
            ...doc,
            documentID: nextNumber,
            status: 'draft',
            creationDate: Utils.today(),
            dueDate: Utils.thirtyDaysFromNow(),
            sourceDocumentId: doc.id,
            lastSentAt: null,
            lastReminderAt: null,
            viewedAt: null,
            signedAt: null,
            signatureName: '',
            activity: [{
                id: `${Date.now()}-duplicated`,
                type: 'duplicated',
                title: 'Duplicated from document',
                detail: doc.documentID || '',
                date: new Date().toISOString(),
            }],
        };
        delete clone.id;
        return this.saveDocument(clone);
    }

    async getNextDocumentNumber(type) {
        const prefix = type === 'invoice' ? 'INV' : 'EST';
        const docs = await this.getAllByIndex(STORES.DOCUMENTS, 'documentType', type);
        const maxSeq = docs.reduce((max, doc) => {
            const parts = doc.documentID ? doc.documentID.split('-') : [];
            const num = parts.length === 2 ? parseInt(parts[1], 10) : 0;
            return isNaN(num) ? max : Math.max(max, num);
        }, 0);
        return `${prefix}-${String(maxSeq + 1).padStart(4, '0')}`;
    }

    // ── Clients ──

    async saveClient(client) {
        if (client.id) {
            await this.put(STORES.CLIENTS, client);
            return client.id;
        } else {
            const id = await this.add(STORES.CLIENTS, client);
            return id;
        }
    }

    async getAllClients() {
        const clients = await this.getAll(STORES.CLIENTS);
        return clients.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    async findClientByName(name) {
        const clients = await this.getAllClients();
        return clients.find(c => c.name.toLowerCase() === name.toLowerCase());
    }

    async findOrCreateClient(name) {
        const trimmed = (name || '').trim();
        if (!trimmed) return null;

        const existing = await this.findClientByName(trimmed);
        if (existing) return existing;

        const newClient = { name: trimmed, email: '', phone: '', address: '' };
        const id = await this.add(STORES.CLIENTS, newClient);
        return { ...newClient, id };
    }

    async deleteClient(id) {
        return this.delete(STORES.CLIENTS, id);
    }

    // ── Company Profile ──

    async getCompanyProfile() {
        const profile = await this.get(STORES.COMPANY, 'main');
        if (profile) return profile;

        const defaultProfile = {
            id: 'main',
            name: '',
            email: '',
            phone: '',
            address: '',
            registrationNumber: '',
            logoData: null,
            defaultTerms: 'Payment due within 30 days.',
            defaultTaxRate: 0,
            mileageRate: 0.67,
            accentTheme: 'blue',
            defaultPresetId: 'apple-clean',
            paymentUrl: '',
            backupReminder: 'weekly',
        };
        await this.put(STORES.COMPANY, defaultProfile);
        return defaultProfile;
    }

    async saveCompanyProfile(profile) {
        profile.id = 'main';
        return this.put(STORES.COMPANY, profile);
    }

    // ── Payments ──

    async savePayment(payment) {
        if (payment.id) {
            await this.put(STORES.PAYMENTS, payment);
            return payment.id;
        }
        return this.add(STORES.PAYMENTS, payment);
    }

    async getPaymentsForDocument(documentId) {
        const payments = await this.getAllByIndex(STORES.PAYMENTS, 'documentId', documentId);
        return payments.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
    }

    async getAllPayments() {
        const payments = await this.getAll(STORES.PAYMENTS);
        return payments.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
    }

    async deletePayment(id) {
        return this.delete(STORES.PAYMENTS, id);
    }

    // ── Business Tools ──

    async saveExpense(expense) {
        if (expense.id) {
            await this.put(STORES.EXPENSES, expense);
            return expense.id;
        }
        return this.add(STORES.EXPENSES, expense);
    }

    async getAllExpenses() {
        const expenses = await this.getAll(STORES.EXPENSES);
        return expenses.sort((a, b) => new Date(b.expenseDate) - new Date(a.expenseDate));
    }

    async deleteExpense(id) {
        return this.delete(STORES.EXPENSES, id);
    }

    async saveTimeEntry(entry) {
        if (entry.id) {
            await this.put(STORES.TIME_ENTRIES, entry);
            return entry.id;
        }
        return this.add(STORES.TIME_ENTRIES, entry);
    }

    async getAllTimeEntries() {
        const entries = await this.getAll(STORES.TIME_ENTRIES);
        return entries.sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate));
    }

    async deleteTimeEntry(id) {
        return this.delete(STORES.TIME_ENTRIES, id);
    }

    async saveMileageEntry(entry) {
        if (entry.id) {
            await this.put(STORES.MILEAGE, entry);
            return entry.id;
        }
        return this.add(STORES.MILEAGE, entry);
    }

    async getAllMileageEntries() {
        const entries = await this.getAll(STORES.MILEAGE);
        return entries.sort((a, b) => new Date(b.tripDate) - new Date(a.tripDate));
    }

    async deleteMileageEntry(id) {
        return this.delete(STORES.MILEAGE, id);
    }

    async saveCatalogItem(item) {
        if (item.id) {
            await this.put(STORES.CATALOG, item);
            return item.id;
        }
        return this.add(STORES.CATALOG, item);
    }

    async getCatalogItems() {
        const items = await this.getAll(STORES.CATALOG);
        return items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    async deleteCatalogItem(id) {
        return this.delete(STORES.CATALOG, id);
    }
}

// Singleton instance
const db = new InvoiceMagicDB();
