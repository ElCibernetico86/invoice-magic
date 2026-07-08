// ============================================================
// cloudSync.js — Cloud Backup via Firebase (Auth + Firestore)
// ============================================================
// Optional cloud layer. When js/firebase-config.js is filled in,
// users can create an account and their data is backed up to
// Firestore under users/{uid}/backup/*. Auto-backup runs a few
// seconds after any local change. Restore pulls the cloud copy
// back into IndexedDB (preserving record IDs so document/client/
// payment references stay intact).
//
// If Firebase isn't configured or the CDN script failed to load
// (offline), every method is a safe no-op and the app behaves
// exactly as the original local-only version.
// ============================================================

const CloudSync = {
    _app: null,
    _auth: null,
    _fs: null,
    _user: null,
    _backupTimer: null,
    _suspended: false,   // true while restoring, so restore writes don't trigger a backup
    _busy: false,
    onAuthChanged: null, // set by views that want to re-render on sign in/out
    onBackupDone: null,

    // Keep each Firestore doc comfortably under the 1MB limit
    CHUNK_BYTES: 700000,

    // ── Availability ──
    sdkLoaded() {
        return typeof firebase !== 'undefined';
    },

    isConfigured() {
        return typeof window.FIREBASE_CONFIG === 'object' &&
            !!window.FIREBASE_CONFIG.apiKey &&
            !window.FIREBASE_CONFIG.apiKey.startsWith('PASTE');
    },

    isReady() {
        return !!this._app;
    },

    isSignedIn() {
        return !!this._user;
    },

    userEmail() {
        return this._user ? this._user.email : '';
    },

    autoBackupEnabled() {
        return localStorage.getItem('invoiceMagic_autoBackup') !== 'off';
    },

    setAutoBackup(enabled) {
        localStorage.setItem('invoiceMagic_autoBackup', enabled ? 'on' : 'off');
    },

    lastBackupAt() {
        return localStorage.getItem('invoiceMagic_lastBackupAt') || null;
    },

    // ── Init (called once from App.init) ──
    init() {
        if (!this.sdkLoaded() || !this.isConfigured() || this._app) return this.isReady();
        try {
            this._app = firebase.initializeApp(window.FIREBASE_CONFIG);
            this._auth = firebase.auth();
            this._fs = firebase.firestore();
            this._auth.onAuthStateChanged(user => {
                this._user = user;
                if (this.onAuthChanged) this.onAuthChanged(user);
                if (user) this._offerRestoreIfLocalEmpty();
            });
            // Surface errors from the Google redirect fallback flow
            this._auth.getRedirectResult().catch(err => {
                if (err && err.code && err.code !== 'auth/no-auth-event') {
                    Toast.show(this.friendlyAuthError(err), 'error');
                }
            });
            return true;
        } catch (err) {
            console.warn('Cloud init failed:', err);
            this._app = null;
            return false;
        }
    },

    _root() {
        return this._fs.collection('users').doc(this._user.uid).collection('backup');
    },

    // ── Auth ──
    async signInWithGoogle() {
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            await this._auth.signInWithPopup(provider);
        } catch (err) {
            // Popups are often blocked in installed/standalone PWAs —
            // fall back to a full-page redirect flow.
            if (err && (err.code === 'auth/popup-blocked' ||
                        err.code === 'auth/operation-not-supported-in-this-environment' ||
                        err.code === 'auth/cancelled-popup-request')) {
                await this._auth.signInWithRedirect(provider);
                return;
            }
            throw err;
        }
    },

    async signIn(email, password) {
        await this._auth.signInWithEmailAndPassword(email, password);
    },

    async signUp(email, password) {
        await this._auth.createUserWithEmailAndPassword(email, password);
    },

    async resetPassword(email) {
        await this._auth.sendPasswordResetEmail(email);
    },

    async signOutUser() {
        clearTimeout(this._backupTimer);
        await this._auth.signOut();
    },

    friendlyAuthError(err) {
        const map = {
            'auth/invalid-email': 'That email address looks invalid.',
            'auth/user-not-found': 'No account found for that email.',
            'auth/wrong-password': 'Incorrect password.',
            'auth/invalid-credential': 'Incorrect email or password.',
            'auth/email-already-in-use': 'An account already exists for that email. Try Sign In.',
            'auth/weak-password': 'Password must be at least 6 characters.',
            'auth/network-request-failed': 'No connection — try again when online.',
            'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
            'auth/popup-closed-by-user': 'Sign-in window was closed before finishing.',
            'auth/unauthorized-domain': 'This domain isn\'t authorized in Firebase yet.',
            'auth/account-exists-with-different-credential': 'This email already has an account — sign in with your password instead.',
        };
        return map[err && err.code] || 'Sign-in failed. Please try again.';
    },

    // ── Auto-backup (debounced; called by db.js after any local write) ──
    scheduleBackup() {
        if (!this._user || this._suspended || this._busy) return;
        if (!this.autoBackupEnabled()) return;
        clearTimeout(this._backupTimer);
        this._backupTimer = setTimeout(() => this.backupNow(true), 8000);
    },

    // ── Full backup of every store ──
    async backupNow(silent = false) {
        if (!this._user) return false;
        if (this._busy) return false;
        this._busy = true;
        clearTimeout(this._backupTimer);
        try {
            const root = this._root();
            const prevMeta = await root.doc('meta').get()
                .then(snap => (snap.exists ? snap.data() : null))
                .catch(() => null);

            const batch = this._fs.batch();
            const storesMeta = {};

            for (const storeName of Object.values(STORES)) {
                // JSON round-trip strips undefined values (Firestore rejects them)
                const records = JSON.parse(JSON.stringify(await db.getAll(storeName)));
                const chunks = this._chunk(records);
                chunks.forEach((chunk, i) => {
                    batch.set(root.doc(`${storeName}_${i}`), { records: chunk });
                });
                // Delete chunks left over from a previously larger backup
                const prevChunks = (prevMeta && prevMeta.stores && prevMeta.stores[storeName] && prevMeta.stores[storeName].chunks) || 0;
                for (let i = chunks.length; i < prevChunks; i++) {
                    batch.delete(root.doc(`${storeName}_${i}`));
                }
                storesMeta[storeName] = { chunks: chunks.length, count: records.length };
            }

            batch.set(root.doc('meta'), {
                updatedAt: new Date().toISOString(),
                stores: storesMeta,
                currency: Utils.getPreferredCurrency(),
                appVersion: '1.1.0',
            });

            await batch.commit();
            localStorage.setItem('invoiceMagic_lastBackupAt', new Date().toISOString());
            if (!silent) Toast.show('Backed up to cloud', 'success');
            if (this.onBackupDone) this.onBackupDone();
            return true;
        } catch (err) {
            console.warn('Cloud backup failed:', err);
            if (!silent) Toast.show('Backup failed — check your connection', 'error');
            return false;
        } finally {
            this._busy = false;
        }
    },

    _chunk(records) {
        const chunks = [];
        let current = [];
        let size = 0;
        for (const record of records) {
            const recordSize = JSON.stringify(record).length;
            if (current.length && size + recordSize > this.CHUNK_BYTES) {
                chunks.push(current);
                current = [];
                size = 0;
            }
            current.push(record);
            size += recordSize;
        }
        chunks.push(current);
        return chunks;
    },

    // ── Restore: replace local data with the cloud copy ──
    async restoreFromCloud() {
        if (!this._user || this._busy) return false;
        this._busy = true;
        this._suspended = true;
        try {
            const root = this._root();
            const metaSnap = await root.doc('meta').get();
            if (!metaSnap.exists) {
                Toast.show('No cloud backup found yet', 'error');
                return false;
            }
            const meta = metaSnap.data();

            for (const storeName of Object.values(STORES)) {
                const info = meta.stores && meta.stores[storeName];
                if (!info) continue;
                const records = [];
                for (let i = 0; i < info.chunks; i++) {
                    const snap = await root.doc(`${storeName}_${i}`).get();
                    if (snap.exists) records.push(...(snap.data().records || []));
                }
                // Replace the store wholesale, keeping original IDs so
                // cross-references (payments→documents, docs→clients) survive.
                await db.clear(storeName);
                for (const record of records) {
                    await db.put(storeName, record);
                }
            }

            if (meta.currency) Utils.setPreferredCurrency(meta.currency);
            localStorage.setItem('invoiceMagic_lastBackupAt', meta.updatedAt || new Date().toISOString());
            Toast.show('Cloud data restored', 'success');
            return true;
        } catch (err) {
            console.warn('Cloud restore failed:', err);
            Toast.show('Restore failed — check your connection', 'error');
            return false;
        } finally {
            this._busy = false;
            this._suspended = false;
        }
    },

    // ── New device flow: local DB empty + cloud backup exists → offer restore ──
    async _offerRestoreIfLocalEmpty() {
        try {
            const localDocs = await db.getAll(STORES.DOCUMENTS);
            const localClients = await db.getAll(STORES.CLIENTS);
            if (localDocs.length > 0 || localClients.length > 0) return;

            const metaSnap = await this._root().doc('meta').get();
            if (!metaSnap.exists) return;
            const meta = metaSnap.data();
            const docCount = (meta.stores && meta.stores.documents && meta.stores.documents.count) || 0;
            if (!docCount) return;

            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.innerHTML = `
                <div class="modal-sheet">
                    <div class="modal-handle"></div>
                    <div class="modal-title">Cloud Backup Found</div>
                    <div class="modal-message">
                        Your account has a backup with ${docCount} document${docCount === 1 ? '' : 's'} from ${Utils.formatDate(meta.updatedAt)}. Restore it to this device?
                    </div>
                    <div class="modal-actions">
                        <button class="modal-action-btn modal-action-primary" id="cloud-restore-yes">Restore Backup</button>
                        <button class="modal-action-btn modal-action-cancel" id="cloud-restore-no">Not Now</button>
                    </div>
                </div>
            `;
            document.getElementById('app').appendChild(overlay);
            overlay.querySelector('#cloud-restore-no').addEventListener('click', () => overlay.remove());
            overlay.querySelector('#cloud-restore-yes').addEventListener('click', async () => {
                overlay.remove();
                const ok = await this.restoreFromCloud();
                if (ok) App.navigate('dashboard');
            });
        } catch (err) {
            // Non-fatal: user can still restore manually from Settings
        }
    },
};
