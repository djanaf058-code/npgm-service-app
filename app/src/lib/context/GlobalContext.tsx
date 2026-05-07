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
export function useRole() {
    const { user, loading } = useGlobal();
    const role = user?.role ?? null;
    return {
        loading,
        role,
        isOperator: role === 'operator',
        isServiceEngineer: role === 'service_engineer',
        isCompanyAdmin: role === 'company_admin',
        isTier2: role === 'tier2_engineer',
        isPlatformAdmin: role === 'platform_admin',
        // "Manages company" — sees everything inside the company, can invite/admin.
        canManageCompany: role === 'company_admin' || role === 'platform_admin',
        // "Internal" — НПГМ side, cross-tenant view.
        isInternal: role === 'tier2_engineer' || role === 'platform_admin',
    };
}
