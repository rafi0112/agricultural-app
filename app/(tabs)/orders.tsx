// OrdersScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ordersCol } from './firebaseConfig';
import { Order } from './types';
import { onSnapshot, query, where, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from './AuthContext';

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);


  const { currentUser } = useAuth();

  if (!currentUser) {
    return <Text>You must be logged in to view orders.</Text>;
  }
  
  useEffect(() => {
    const q = query(ordersCol, where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Order));
      setOrders(ordersData);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const markAsCompleted = async (orderId: string) => {
    try {
      await updateDoc(doc(ordersCol, orderId), {
        status: 'completed'
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading orders...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pending Orders</Text>
      <FlatList
        data={orders}
        renderItem={({ item }) => (
          <View style={styles.orderCard}>
            <Text style={styles.productName}>{item.productName}</Text>
            <Text>Quantity: {item.quantity}</Text>
            <Text>Customer: {item.customerName}</Text>
            <TouchableOpacity
              style={styles.completeButton}
              onPress={() => markAsCompleted(item.id)}
            >
              <Text style={styles.buttonText}>Mark as Completed</Text>
            </TouchableOpacity>
          </View>
        )}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 40
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 20,
    textAlign: 'center',
    backgroundColor: '#fff',
    marginBottom: 10
  },
  listContainer: {
    padding: 10
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5
  },
  completeButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
    alignItems: 'center'
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold'
  }
});