import { Navigate, Route, Routes } from "react-router-dom";
import { Dashboard } from "./screens/Dashboard";
import Login from "./connection/loginConnection";
import { useEffect } from 'react';

export * from "./screens/LoginPage"
export * from "./connection/loginConnection"

// Main initialization function
const initializeApp = async () => {
    try {
        // Initialize core services
        console.log('Initializing core services...');

        // Check if running in browser environment
        const isBrowser = typeof window !== 'undefined';
        if (!isBrowser) {
            console.log('Not running in browser environment');
            return;
        }

        // Request necessary permissions
        try {
            // Request notification permissions
            if ('Notification' in window) {
                const permission = await Notification.requestPermission();
                console.log('Notification permission status:', permission);
            }

            // Request geolocation permissions
            if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        console.log('Success! Initial position obtained:',
                            position.coords.latitude,
                            position.coords.longitude
                        );
                    },
                    (error) => {
                        console.error('Error getting initial position:', error);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 0
                    }
                );
            }
        } catch (error) {
            console.error('Error requesting permissions:', error);
        }

        // Initialize any other services here
        console.log('All services initialized successfully');
    } catch (error) {
        console.error('Error in initialization:', error);
    }
};

// Call initialization when the app starts
initializeApp();

// Main app routing
<Routes>
    <Route path="/" element={<Navigate to="/login" />} />
    <Route path="/login" element={<Login role="default" />} />
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="*" element={<div>Not Found</div>} />
</Routes>
