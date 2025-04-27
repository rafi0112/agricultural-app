// ShopAuthModal.tsx
import { getDocs, query, where, collection } from 'firebase/firestore';
import { firestore } from './firebaseConfig'; // Adjust the path to your Firebase config file
import React,  {useState}  from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';

interface ShopAuthModalProps {
    shopId: string;
    onSuccess: () => void;
}

export default function ShopAuthModal({ shopId, onSuccess }: ShopAuthModalProps) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const authenticate = async () => {
        try {
            const shopsCol = collection(firestore, 'shops'); // Replace 'shops' with your Firestore collection name
            const q = query(shopsCol, where("id", "==", shopId), where("password", "==", password));
            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                setError("Invalid password");
            } else {
                onSuccess();
            }
        } catch (err) {
            setError("Authentication failed");
        }
    };

    return (
        <View style={styles.modalContainer}>
            <Text style={styles.title}>Shop Authentication</Text>
            <TextInput
                secureTextEntry
                placeholder="Enter shop password"
                value={password}
                onChangeText={setPassword}
                style={styles.input}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Authenticate" onPress={authenticate} />
        </View>
    );
}

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'white',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    input: {
        width: '100%',
        padding: 10,
        borderWidth: 1,
        borderColor: 'gray',
        borderRadius: 5,
        marginBottom: 10,
    },
    error: {
        color: 'red',
        marginBottom: 10,
    },
});

// Removed conflicting local useState declaration
