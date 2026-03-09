import { useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';

export default function AuthSync() {
    const { user } = useUser();
    const { getToken } = useAuth();

    useEffect(() => {
        const syncUser = async () => {
            if (user) {
                try {
                    const token = await getToken();
                    await fetch('/api/auth/sync', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            email: user.primaryEmailAddress?.emailAddress,
                            firstName: user.firstName,
                            lastName: user.lastName
                        })
                    });
                } catch (error) {
                    console.error('Auth sync error:', error);
                }
            }
        };

        syncUser();
    }, [user, getToken]);

    return null;
}
