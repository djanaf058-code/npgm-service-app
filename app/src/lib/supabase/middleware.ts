import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Do not run code between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    // IMPORTANT: DO NOT REMOVE auth.getUser()

    const {data: userData} = await supabase.auth.getUser()
    const authedUser = userData?.user

    const path = request.nextUrl.pathname
    const isProtectedAppRoute = path.startsWith('/app')
    const isOnboardingRoute = path === '/auth/onboarding'

    // Not logged in → block /app/*
    if (!authedUser && isProtectedAppRoute) {
        const url = request.nextUrl.clone()
        url.pathname = '/auth/login'
        return NextResponse.redirect(url)
    }

    // Logged in → role/onboarding-aware redirects.
    // platform_admin is cross-tenant: they intentionally have company_id=NULL
    // and should never see the onboarding screen — they land in /admin.
    if (authedUser && (isProtectedAppRoute || isOnboardingRoute)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const {data: profile} = await (supabase as any)
            .from('profiles')
            .select('company_id, role, language')
            .eq('id', authedUser.id)
            .maybeSingle()

        const hasCompany = !!profile?.company_id
        const isPlatformAdmin = profile?.role === 'platform_admin'

        if (isPlatformAdmin) {
            // Send admin to /admin from either /app root or onboarding.
            if (path === '/app' || isOnboardingRoute) {
                const url = request.nextUrl.clone()
                url.pathname = '/admin'
                return NextResponse.redirect(url)
            }
            // Other /app/* subpaths are allowed (admin can inspect a tenant).
        } else {
            // Regular users: must have a company to use /app/*.
            if (isProtectedAppRoute && !hasCompany) {
                const url = request.nextUrl.clone()
                url.pathname = '/auth/onboarding'
                return NextResponse.redirect(url)
            }
            if (isOnboardingRoute && hasCompany) {
                const url = request.nextUrl.clone()
                url.pathname = '/app'
                return NextResponse.redirect(url)
            }
        }

        // Sync NEXT_LOCALE cookie from profile.language so that DB is the
        // source of truth across devices. Only writes when value differs.
        const profileLanguage = profile?.language as string | undefined
        const currentCookie = request.cookies.get('NEXT_LOCALE')?.value
        if (
            profileLanguage &&
            (profileLanguage === 'ru' || profileLanguage === 'en') &&
            profileLanguage !== currentCookie
        ) {
            supabaseResponse.cookies.set('NEXT_LOCALE', profileLanguage, {
                path: '/',
                maxAge: 60 * 60 * 24 * 365,
                sameSite: 'lax',
            })
        }
    }

    // IMPORTANT: You *must* return the supabaseResponse object as it is.
    // If you're creating a new response object with NextResponse.next() make sure to:
    // 1. Pass the request in it, like so:
    //    const myNewResponse = NextResponse.next({ request })
    // 2. Copy over the cookies, like so:
    //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
    // 3. Change the myNewResponse object to fit your needs, but avoid changing
    //    the cookies!
    // 4. Finally:
    //    return myNewResponse
    // If this is not done, you may be causing the browser and server to go out
    // of sync and terminate the user's session prematurely!

    return supabaseResponse
}