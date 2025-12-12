import axios from 'axios';

// כתובת השרת שלנו (ה-Gateway)
export const API_URL = 'http://localhost:3000';

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor: מוסיף את הטוקן לכל בקשה באופן אוטומטי אם הוא קיים
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});