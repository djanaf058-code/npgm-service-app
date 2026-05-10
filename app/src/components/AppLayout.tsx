"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {
    Home,
    User,
    Menu,
    X,
    ChevronDown,
    LogOut,
    Key,
    Truck,
    MessageSquareText,
    ClipboardCheck,
    Wrench,
    Box,
    Users,
    Shield,
} from 'lucide-react';
import { useGlobal, useRole } from "@/lib/context/GlobalContext";
import { createSPASassClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isUserDropdownOpen, setUserDropdownOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();


    const { user } = useGlobal();
    const {
        isOperator,
        isServiceEngineer,
        isProjectManager,
        isTier2,
        isPlatformAdmin,
        role,
    } = useRole();

    const handleLogout = async () => {
        try {
            const client = await createSPASassClient();
            await client.logout();
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };
    const handleChangePassword = async () => {
        router.push('/app/user-settings')
    };

    const getInitials = (email: string) => {
        const parts = email.split('@')[0].split(/[._-]/);
        return parts.length > 1
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : parts[0].slice(0, 2).toUpperCase();
    };

    // Sidebar entries differ by role. Operators get a focused view (their work),
    // company admins get the full company-wide management surface, and Tier 2
    // (НПГМ side) gets the cross-tenant view.
    const baseNav = [
        { name: 'Главная', href: '/app', icon: Home, roles: ['all'] },
        { name: 'Парк техники', href: '/app/machines', icon: Truck, roles: ['all'] },
        { name: 'Смены', href: '/app/shifts', icon: ClipboardCheck,
          roles: ['operator', 'service_engineer', 'project_manager'] },
        { name: 'Тикеты', href: '/app/tickets', icon: MessageSquareText, roles: ['all'] },
        { name: 'ТО', href: '/app/maintenance', icon: Wrench,
          roles: ['service_engineer', 'project_manager', 'platform_admin'] },
        { name: 'Гараж', href: '/app/parts', icon: Box,
          roles: ['operator', 'service_engineer', 'project_manager'] },
        { name: 'Команда', href: '/app/team', icon: Users, roles: ['project_manager'] },
        { name: 'Админ-панель', href: '/admin', icon: Shield, roles: ['platform_admin'] },
        { name: 'Профиль', href: '/app/user-settings', icon: User, roles: ['all'] },
    ];
    const navigation = baseNav.filter(
        (n) => n.roles.includes('all') || (role !== null && n.roles.includes(role))
    );

    const roleBadge = isProjectManager
        ? { label: 'Проектный менеджер', tone: 'bg-primary-50 text-primary-700' }
        : isServiceEngineer
        ? { label: 'Сервисный инженер', tone: 'bg-primary-50 text-primary-700' }
        : isTier2
        ? { label: 'НПГМ — Tier 2', tone: 'bg-accent-50 text-accent-700' }
        : isPlatformAdmin
        ? { label: 'НПГМ — Платформа', tone: 'bg-accent-50 text-accent-700' }
        : isOperator
        ? { label: 'Оператор', tone: 'bg-emerald-50 text-emerald-700' }
        : null;

    const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

    return (
        <div className="min-h-screen bg-secondary-50">
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-secondary-900/60 z-20 lg:hidden"
                    onClick={toggleSidebar}
                />
            )}

            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 w-64 bg-white shadow-lg transform transition-transform duration-200 ease-in-out z-30 
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>

                <div className="h-16 flex items-center justify-between px-4 border-b border-secondary-200">
                    <Logo variant="full" width={150} height={30} />
                    <button
                        onClick={toggleSidebar}
                        className="lg:hidden text-secondary-500 hover:text-secondary-700"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="mt-4 px-2 space-y-1">
                    {navigation.map((item) => {
                        const isActive =
                            item.href === '/app'
                                ? pathname === '/app'
                                : pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                                    isActive
                                        ? 'bg-primary-50 text-primary-700'
                                        : 'text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900'
                                }`}
                            >
                                <item.icon
                                    className={`mr-3 h-5 w-5 flex-shrink-0 ${
                                        isActive
                                            ? 'text-primary-600'
                                            : 'text-secondary-400 group-hover:text-secondary-600'
                                    }`}
                                />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

            </div>

            <div className="lg:pl-64">
                <div className="sticky top-0 z-10 flex items-center justify-between h-16 bg-white border-b border-secondary-200 px-4">
                    <button
                        onClick={toggleSidebar}
                        className="lg:hidden text-secondary-500 hover:text-secondary-700"
                    >
                        <Menu className="h-6 w-6"/>
                    </button>

                    <div className="relative ml-auto">
                        <button
                            onClick={() => setUserDropdownOpen(!isUserDropdownOpen)}
                            className="flex items-center space-x-2 text-sm text-secondary-700 hover:text-secondary-900"
                        >
                            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                                <span className="text-primary-700 font-medium">
                                    {user ? getInitials(user.email) : '??'}
                                </span>
                            </div>
                            <span>{user?.email || 'Loading...'}</span>
                            <ChevronDown className="h-4 w-4"/>
                        </button>

                        {isUserDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg border border-secondary-200">
                                <div className="p-3 border-b border-secondary-100">
                                    <p className="text-xs text-secondary-500">Вошли как</p>
                                    <p className="text-sm font-medium text-secondary-900 truncate">
                                        {user?.full_name || user?.email}
                                    </p>
                                    {roleBadge && (
                                        <span className={`inline-block mt-1.5 text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${roleBadge.tone}`}>
                                            {roleBadge.label}
                                        </span>
                                    )}
                                </div>
                                <div className="py-1">
                                    <button
                                        onClick={() => {
                                            setUserDropdownOpen(false);
                                            handleChangePassword()
                                        }}
                                        className="w-full flex items-center px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-50"
                                    >
                                        <Key className="mr-3 h-4 w-4 text-secondary-400"/>
                                        Сменить пароль
                                    </button>
                                    <button
                                        onClick={() => {
                                            handleLogout();
                                            setUserDropdownOpen(false);
                                        }}
                                        className="w-full flex items-center px-4 py-2 text-sm text-accent-700 hover:bg-accent-50"
                                    >
                                        <LogOut className="mr-3 h-4 w-4 text-accent-400"/>
                                        Выйти
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <main className="p-4">
                    {children}
                </main>
            </div>
        </div>
    );
}