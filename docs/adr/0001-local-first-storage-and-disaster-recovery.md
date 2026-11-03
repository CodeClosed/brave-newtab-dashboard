# ADR 0001: Local-First Storage Architecture and Disaster Recovery

- **Status:** Accepted
- **Deciders:** Antigravity Team, CodeClosed
- **Date:** 2026-11-03

## Context & Problem Statement
A bookmark manager is a critical personal productivity utility. Users may spend months organizing hierarchical collections and spaces. Losing data due to browser crashes, tab termination during debounced writes, corrupt JSON imports, or schema migration failures destroys user trust.
How do we achieve high performance with frequent drag-and-drop mutations while guaranteeing zero data loss, zero remote servers, and crash-safe rollback?

## Decision Drivers
1. **Privacy:** Zero remote servers, zero user accounts, zero telemetry.
2. **Performance:** Eliminating Flash of Wrong Theme (FOWT) on new tab startup (<20ms first paint) and avoiding disk I/O thrashing during drags.
3. **Resilience:** Uninterrupted recovery even if the browser process is killed mid-save.

## Considered Options
1. *Cloud Sync (Firebase/Supabase):* Requires accounts, network latency, and privacy compromises. (Rejected)
2. *Pure `chrome.storage.local` with immediate writes:* Unthrottled writes during mouse dragging cause storage throttling and frame drops. (Rejected)
3. *Tiered Local Persistence Contract:* Authoritative debounced `chrome.storage.local` + synchronous `localStorage` boot cache + IndexedDB rolling snapshots + emergency unload flush. (Accepted)

## Decision Outcome
We established a strict 4-tier storage hierarchy:
1. **`chrome.storage.local`**: Authoritative store for all dashboard state, spaces, and collections. Writes are debounced at 300ms.
2. **`localStorage` Boot Cache**: Synchronously stores theme/glass tokens (`ntd:boot`) read by `boot.js` before DOM rendering to eliminate FOWT.
3. **`ntd_emergency_recovery`**: On `pagehide` / tab close, `flushPendingSave()` writes any in-flight state to synchronous `localStorage` before initiating `chrome.storage.local.set()`. If the browser kills async I/O prematurely, `loadDashboardData()` automatically recovers the unsaved work on the next tab launch.
4. **IndexedDB Rolling Snapshots**: Maintains up to 10 point-in-time state backups enriched with FNV-1a checksums, schema version, and data sizes. Snapshots are verified for integrity and auto-migrated before restore.

## Consequences
- **Positive:** Zero remote dependencies, instant rendering without theme flicker, and proven disaster recovery.
- **Negative:** Requires custom synchronization and mock IndexedDB testing logic in Node test environments.
