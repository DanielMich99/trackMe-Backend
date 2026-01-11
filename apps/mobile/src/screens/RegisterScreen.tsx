import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { Ionicons } from '@expo/vector-icons';
import {
    GoogleSignin,
    statusCodes,
    isSuccessResponse,
    isErrorWithCode
} from '@react-native-google-signin/google-signin';

interface Props {
    onSwitchToLogin: () => void;
}

export default function RegisterScreen({ onSwitchToLogin }: Props) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const register = useAuthStore((state) => state.register);
    const googleLogin = useAuthStore((state) => state.googleLogin);

    useEffect(() => {
        GoogleSignin.configure({
            webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, // From Google Cloud Console (Web)
            scopes: ['profile', 'email'],
        });
    }, []);

    const handleGoogleSignIn = async () => {
        setLoading(true);
        try {
            await GoogleSignin.hasPlayServices();
            const response = await GoogleSignin.signIn();

            if (isSuccessResponse(response)) {
                // response.data.idToken is the one we want
                const { idToken } = response.data;
                if (idToken) {
                    await googleLogin(idToken);
                } else {
                    Alert.alert('Login Error', 'No ID token found');
                }
            } else {
                // sign in was cancelled by user (if flow allows checking this state without error)
            }
        } catch (error: any) {
            if (isErrorWithCode(error)) {
                switch (error.code) {
                    case statusCodes.SIGN_IN_CANCELLED:
                        // user cancelled the login flow
                        break;
                    case statusCodes.IN_PROGRESS:
                        // operation (e.g. sign in) already in progress
                        Alert.alert('In Progress', 'Sign in is already in progress');
                        break;
                    case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
                        Alert.alert('Error', 'Google Play Services not available');
                        break;
                    default:
                        Alert.alert('Google Login Error', error.message);
                }
            } else {
                Alert.alert('Google Login Error', error.message || 'Unknown error');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async () => {
        if (!name || !email || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            await register(name, email, password);
        } catch (error: any) {
            Alert.alert('Registration Failed', error.response?.data?.message || 'Could not register');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>TrackMe</Text>
            <Text style={styles.subtitle}>Create an account</Text>

            <TextInput
                style={styles.input}
                placeholder="Name"
                placeholderTextColor="#666"
                value={name}
                onChangeText={setName}
            />

            <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#666"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
            />

            <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#666"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />

            <TouchableOpacity
                style={styles.button}
                onPress={handleRegister}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.buttonText}>Register</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.button, styles.googleButton]}
                onPress={handleGoogleSignIn}
                disabled={loading}
            >
                <Ionicons name="logo-google" size={24} color="white" style={{ marginRight: 10 }} />
                <Text style={styles.buttonText}>Sign in with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onSwitchToLogin}>
                <Text style={styles.link}>Already have an account? Login</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#0f172a',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#94a3b8',
        textAlign: 'center',
        marginBottom: 40,
    },
    input: {
        backgroundColor: '#1e293b',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
        color: '#fff',
        fontSize: 16,
    },
    button: {
        backgroundColor: '#22c55e',
        borderRadius: 8,
        padding: 16,
        alignItems: 'center',
        marginBottom: 16,
    },
    googleButton: {
        backgroundColor: '#DB4437', // Google Red
        flexDirection: 'row',
        justifyContent: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',

    },
    link: {
        color: '#3b82f6',
        textAlign: 'center',
        fontSize: 14,
    },
});
