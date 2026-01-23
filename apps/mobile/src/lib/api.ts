import axios from 'axios';
import { storage } from './storage';

// Change this to your computer's IP when testing on physical device
export const API_URL = 'http://track-me-prod-api-alb-2058165755.us-east-1.elb.amazonaws.com';

export const api = axios.create({
    baseURL: API_URL,
});

// Add token to all requests
api.interceptors.request.use(async (config) => {
    const token = await storage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle 401 errors
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            await storage.removeItem('token');
        }
        return Promise.reject(error);
    }
);
