import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather, FontAwesome } from '@expo/vector-icons';
import { useAuth } from './AuthContext';
import { db } from './firebaseConfig';
import { collection, query, where, onSnapshot, DocumentData } from 'firebase/firestore';

type Product = {
  id: string;
  shopId: string;
};

type Shop = {
  id: string;
  productCount: number;
};

const ProfileScreen = () => {
  const { currentUser, logout } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalProducts, setTotalProducts] = useState(0);

  const defaultProfileImage = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

  useEffect(() => {
    if (!currentUser?.uid) return;

    let productsUnsubscribe: () => void;
    let shopsUnsubscribe: () => void;

    const setupRealTimeListeners = async () => {
      try {
        // Real-time listener for products
        productsUnsubscribe = onSnapshot(
          query(
            collection(db, 'products'),
            where('farmerId', '==', currentUser.uid)
          ),
          (productsSnapshot) => {
            const productsData: Product[] = [];
            const shopIds = new Set<string>();
            
            productsSnapshot.forEach((doc) => {
              const productData = doc.data() as DocumentData;
              productsData.push({
                id: doc.id,
                shopId: productData.shopId as string
              });
              
              if (productData.shopId) {
                shopIds.add(productData.shopId as string);
              }
            });
            
            setProducts(productsData);
            setTotalProducts(productsData.length);
            
            // Setup shops listener only if we have shop IDs
            if (shopIds.size > 0) {
              const uniqueShopIds = Array.from(shopIds);
              
              // Real-time listener for shops
              shopsUnsubscribe = onSnapshot(
                query(
                  collection(db, 'shops'),
                  where('__name__', 'in', uniqueShopIds)
                ),
                (shopsSnapshot) => {
                  const shopsData: Shop[] = [];
                  shopsSnapshot.forEach((doc) => {
                    shopsData.push({
                      id: doc.id,
                      productCount: productsData.filter(p => p.shopId === doc.id).length
                    });
                  });
                  setShops(shopsData);
                }
              );
            } else {
              setShops([]);
            }
          }
        );
      } catch (error) {
        console.error("Error setting up listeners:", error);
        Alert.alert("Error", "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    setupRealTimeListeners();

    // Cleanup function to unsubscribe listeners
    return () => {
      if (productsUnsubscribe) productsUnsubscribe();
      if (shopsUnsubscribe) shopsUnsubscribe();
    };
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      Alert.alert("Logout Error", "Failed to logout. Please try again.");
    }
  };

  const handleEditProfile = () => {
    Alert.alert("Coming Soon", "Edit profile functionality will be added soon");
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container} 
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <Image 
            source={{ uri: currentUser?.photoURL || defaultProfileImage }} 
            style={styles.avatar}
          />
        </View>
        
        <Text style={styles.name}>{currentUser?.displayName || "Farmer"}</Text>
        <Text style={styles.uidText}>UID: {currentUser?.uid}</Text>
        
        <View style={styles.infoContainer}>
          <Ionicons name="mail" size={18} color="#4CAF50" />
          <Text style={styles.infoText}>{currentUser?.email || "No email"}</Text>
          {currentUser?.emailVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats Cards - Now updates in real-time */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, styles.statCardPrimary]}>
          <FontAwesome name="shopping-bag" size={28} color="#4CAF50" />
          <Text style={styles.statNumber}>{shops.length}</Text>
          <Text style={styles.statLabel}>Shops</Text>
        </View>
        
        <View style={[styles.statCard, styles.statCardSecondary]}>
          <MaterialCommunityIcons name="food-apple" size={28} color="#2196F3" />
          <Text style={styles.statNumber}>{totalProducts}</Text>
          <Text style={styles.statLabel}>Products</Text>
        </View>
        
        <View style={[styles.statCard, styles.statCardTertiary]}>
          <MaterialCommunityIcons name="account" size={28} color="#FFC107" />
          <Text style={styles.statNumber}>
            {currentUser?.isFarmer ? "Farmer" : "User"}
          </Text>
          <Text style={styles.statLabel}>Account Type</Text>
        </View>
      </View>

      {/* Account Information Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Information</Text>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Farmer UID:</Text>
          <Text style={styles.infoValue}>{currentUser?.uid}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Registered Since:</Text>
          <Text style={styles.infoValue}>
            {currentUser?.metadata?.creationTime 
              ? new Date(currentUser.metadata.creationTime).toLocaleDateString() 
              : "Unknown"}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Last Login:</Text>
          <Text style={styles.infoValue}>
            {currentUser?.metadata?.lastSignInTime 
              ? new Date(currentUser.metadata.lastSignInTime).toLocaleString() 
              : "Unknown"}
          </Text>
        </View>
      </View>

      {/* Shops Section - Updates in real-time */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Shops</Text>
        {shops.length > 0 ? (
          shops.map((shop, index) => (
            <View key={index} style={styles.shopCard}>
              <View style={styles.shopHeader}>
                <FontAwesome name="shopping-bag" size={20} color="#4CAF50" />
                <View style={styles.shopInfo}>
                  <Text style={styles.shopId}>Shop ID: {shop.id}</Text>
                </View>
              </View>
              <View style={styles.shopDetails}>
                <Text style={styles.shopDetail}>
                  <Text style={styles.detailLabel}>Products Count:</Text> {shop.productCount}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.noShopsText}>No shops found for this farmer</Text>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.editButton]}
          onPress={handleEditProfile}
        >
          <Feather name="edit-3" size={20} color="white" />
          <Text style={styles.actionButtonText}>Edit Profile</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.logoutButton]}
          onPress={handleLogout}
        >
          <Feather name="log-out" size={20} color="white" />
          <Text style={styles.actionButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 25,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#4CAF50',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  uidText: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 10,
    fontWeight: '500',
    backgroundColor: '#f0f0f0',
    padding: 5,
    borderRadius: 5,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  infoText: {
    marginLeft: 5,
    color: '#4CAF50',
    fontWeight: '500',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  verifiedText: {
    color: '#4CAF50',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  statCard: {
    width: '30%',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statCardPrimary: {
    backgroundColor: '#E8F5E9',
  },
  statCardSecondary: {
    backgroundColor: '#E3F2FD',
  },
  statCardTertiary: {
    backgroundColor: '#FFF8E1',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    marginVertical: 5,
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#757575',
    textAlign: 'center',
    fontWeight: '500',
  },
  section: {
    marginBottom: 25,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    fontWeight: '600',
    color: '#555',
  },
  infoValue: {
    color: '#616161',
    fontWeight: '500',
  },
  shopCard: {
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
  },
  shopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  shopInfo: {
    marginLeft: 10,
  },
  shopId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  shopDetails: {
    marginLeft: 30,
  },
  shopDetail: {
    fontSize: 14,
    color: '#616161',
    marginBottom: 4,
  },
  detailLabel: {
    fontWeight: '600',
    color: '#555',
  },
  noShopsText: {
    color: '#95a5a6',
    textAlign: 'center',
    marginVertical: 10,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 50,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    padding: 15,
    marginHorizontal: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  editButton: {
    backgroundColor: '#4CAF50',
  },
  logoutButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
  },
});

export default ProfileScreen;