// src/lib/context/GlobalContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { createSPASassClientAuthenticated as createSPASassClient } from '@/lib/supabase/client';
import type { UserRole } from '@/lib/types';


type User = {
    email: string;
    id: string;
    registered_at: Date;
    full_name: string | null;
    role: UserRole | null;
    company_id: string | null;
};

interface GlobalContextType {
    loading: boolean;
    user: User | null;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export function GlobalProvider({ children }: { children: React.ReactNode }) {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        async function loadData() {
            try {
                const supabase = await createSPASassClient();
                const client = supabase.getSupabaseClient();

                const { data: { user } } = await client.auth.getUser();
                if (!user) throw new Error('User not found');

                // Pending invite handoff: if a token was stashed by /auth/invite/[token]
                // before sign-up/login, redeem it now that we have a session. The
                // accept_invite RPC patches profiles.role + company_id atomically.
                try {
                    const pendingToken = window.localStorage.getItem('npgm.pending_invite_token');
                    if (pendingToken) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const { error: rpcErr } = await (client as any).rpc('accept_invite', {
                            p_token: pendingToken,
                        });
                        // Always clear the stash so we don't loop on a bad token.
                        window.localStorage.removeItem('npgm.pending_invite_token');
                        if (rpcErr) {
                            console.warn('Не удалось принять приглашение:', rpcErr.message);
                        }
                    }
                } catch (storageErr) {
                    // Private mode / blocked storage — silently skip; user can still
                    // be onboarded normally.
                    void storageErr;
                }

                // Load profile so consumers know role + company without re-querying.
                const { data: profile } = await client
                    .from('profiles')
                    .select('full_name, role, company_id')
                    .eq('id', user.id)
                    .maybeSingle();

                setUser({
                    email: user.email!,
                    id: user.id,
                    registered_at: new Date(user.created_at),
                    full_name: (profile?.full_name as string | null) ?? null,
                    role: (profile?.role as UserRole | null) ?? null,
                    company_id: (profile?.company_id as string | null) ?? null,
                });

            } catch (error) {
                console.error('Error loading data:', error);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, []);

    return (
        <GlobalContext.Provider value={{ loading, user }}>
            {children}
        </GlobalContext.Provider>
    );
}

export const useGlobal = () => {
    const context = useContext(GlobalContext);
    if (context === undefined) {
        throw new Error('useGlobal must be used within a GlobalProvider');
    }
    return context;
};

// Derived role flags for UI gating. Use these instead of comparing role strings
// directly in components — keeps the role taxonomy in one place.
//
// Active roles: operator, service_engineer, project_manager, platform_admin.
// Legacy values still in the DB enum (company_admin, tier2_engineer) are not
// exposed here — nothing in the app should be branching on them.
export function useRole() {
    const { user, loading } = useGlobal();
    const role = user?.role ?? null;
    return {
        loading,
        role,
        isOperator: role === 'operator',
        isServiceEngineer: role === 'service_engineer',
        isProjectManager: role === 'project_manager',
        isPlatformAdmin: role === 'platform_admin',
        // "Manages company" — sees everything inside the company, can invite/admin.
        canManageCompany: role === 'project_manager' || role === 'platform_admin',
        // "Can invite teammates" — service_engineer can pre-register operators
        // and peers; project_manager additionally invites other PMs.
        canInviteTeam:
            role === 'service_engineer' || role === 'project_manager' || role === 'platform_admin',
        // "Manages machines" — service_engineer can also CRUD machines now.
        canManageMachines:
            role === 'service_engineer' || role === 'project_manager' || role === 'platform_admin',
        // "Can assign operators to machines" — same as canManageMachines, kept
        // as its own flag so future changes (e.g. SE loses this) are local.
        canAssignOperators:
            role === 'service_engineer' || role === 'project_manager' || role === 'platform_admin',
    };
}
