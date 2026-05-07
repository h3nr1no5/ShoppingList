# Fix TS2353: Omit collapsing discriminated union

## Problem
`Omit<PendingChange, 'id' | 'timestamp'>` computes `keyof` on the union `PendingToggle | PendingEdit | PendingDelete | PendingAdd`, which yields the **intersection** of keys (`type | id | timestamp`). The result collapses to `{ type: 'toggle' | 'edit' | 'delete' | 'add' }` — a flat type with no `tempId` or `itemId`. Excess property checking (TS2353) then rejects all call sites.

## Changes

### 1. `frontend/src/hooks/useOfflineQueue.ts`

**Add** `DistributiveOmit` helper after the `PendingChange` type:
```typescript
export type PendingChange = PendingToggle | PendingEdit | PendingDelete | PendingAdd;

type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;
```

**Update** `enqueue` parameter type (line 76):
```typescript
// Before:
(change: Omit<PendingChange, 'id' | 'timestamp'>): void
// After:
(change: DistributiveOmit<PendingChange, 'id' | 'timestamp'>): void
```

### 2. `frontend/src/hooks/useOfflineQueue.test.ts`

**Update import** (line 3) to include `DistributiveOmit`:
```typescript
import { useOfflineQueue, type DistributiveOmit, type PendingChange, type PendingToggle, type PendingAdd } from './useOfflineQueue';
```

**Update** `TestComponent` props `onQueue` type (line 11):
```typescript
// Before:
onQueue: (queue: { enqueue: (change: Omit<PendingChange, 'id' | 'timestamp'>) => void; ... }) => void;
// After:
onQueue: (queue: { enqueue: (change: DistributiveOmit<PendingChange, 'id' | 'timestamp'>) => void; ... }) => void;
```

## Why this works
`DistributiveOmit` uses a conditional type `T extends any ? Omit<T, K> : never` which **distributes** over each union member individually, producing:
```
{ type: 'toggle'; itemId: string; is_checked: boolean } |
{ type: 'edit'; itemId: string; name: string; quantity: number } |
{ type: 'delete'; itemId: string } |
{ type: 'add'; tempId: string; name: string; quantity: number }
```
This preserves the discriminated union, so `{ type: 'add', tempId, name, quantity }` narrows to the `add` variant and excess property checking passes.

## No changes needed in ListDetail.tsx / SharedList.tsx
They only call `enqueue(...)` — the parameter type fix in `useOfflineQueue.ts` makes their call sites valid.
