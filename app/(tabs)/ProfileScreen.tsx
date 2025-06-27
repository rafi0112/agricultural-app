import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather, FontAwesome } from '@expo/vector-icons';
import { useAuth } from './AuthContext';
import { useNavigation } from '@react-navigation/native';
import { db } from './firebaseConfig';
import { collection, query, where, onSnapshot, DocumentData } from 'firebase/firestore';
import { NavigationProp } from './types';
import SafeScreen from './SafeScreen';

type Product = {
  id: string;
  shopId: string;
};

// First, update the Shop type to include location
type Shop = {
  id: string;
  productCount: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  name: string;
};

const ProfileScreen = () => {
  const navigation = useNavigation<NavigationProp>();
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
              // Update the shops listener in your useEffect
              shopsUnsubscribe = onSnapshot(
                query(
                  collection(db, 'shops'),
                  where('__name__', 'in', uniqueShopIds)
                ),
                (shopsSnapshot) => {
                  const shopsData: Shop[] = [];
                  shopsSnapshot.forEach((doc) => {
                    const shopData = doc.data();
                    shopsData.push({
                      id: doc.id,
                      name: shopData.name || 'Unnamed Shop',
                      productCount: productsData.filter(p => p.shopId === doc.id).length,
                      location: shopData.location || undefined
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

  const getLocationName = async (latitude: number, longitude: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
      );
      const data = await response.json();
      return data.display_name || 'Location name not available';
    } catch (error) {
      console.error('Error fetching location name:', error);
      return 'Location name not available';
    }
  };

  if (loading) {
    return (
      <SafeScreen style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
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
          <Ionicons name="mail" size={18} color="#059669" />
          <Text style={styles.infoText}>{currentUser?.email || "No email"}</Text>
          {currentUser?.emailVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#059669" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats Cards - Now updates in real-time */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, styles.statCardPrimary]}>
          <FontAwesome name="shopping-bag" size={28} color="#059669" />
          <Text style={styles.statNumber}>{shops.length}</Text>
          <Text style={styles.statLabel}>Shops</Text>
        </View>
        
        <View style={[styles.statCard, styles.statCardSecondary]}>
          <MaterialCommunityIcons name="food-apple" size={28} color="#3B82F6" />
          <Text style={styles.statNumber}>{totalProducts}</Text>
          <Text style={styles.statLabel}>Products</Text>
        </View>
        
        <View style={[styles.statCard, styles.statCardTertiary]}>
          <MaterialCommunityIcons name="account" size={28} color="#F59E0B" />
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
                <FontAwesome name="shopping-bag" size={20} color="#059669" />
                <View style={styles.shopInfo}>
                  <Text style={styles.shopId}>Shop ID: {shop.id}</Text>
                  <Text style={styles.shopName}>{shop.name}</Text>
                </View>
              </View>
              <View style={styles.shopDetails}>
                <Text style={styles.shopDetail}>
                  <Text style={styles.detailLabel}>Products Count:</Text> {shop.productCount}
                </Text>
                {shop.location ? (
                  <>
                    <Text style={styles.shopDetail}>
                      <Text style={styles.detailLabel}>Location: </Text>
                      {shop.location && typeof shop.location.latitude === 'number' && typeof shop.location.longitude === 'number'
                        ? `${shop.location.latitude.toFixed(6)}, ${shop.location.longitude.toFixed(6)}`
                        : 'No location set'}
                    </Text>
                    <TouchableOpacity
                      style={styles.viewOnMapButton}
                      onPress={() => {
                        if (shop.location?.latitude && shop.location?.longitude) {
                          navigation.navigate('Map', { 
                            shopId: shop.id,
                            readOnly: true,
                            initialLocation: {
                              latitude: shop.location.latitude,
                              longitude: shop.location.longitude
                            }
                          });
                        }
                      }}
                    >
                      <MaterialCommunityIcons name="map-marker" size={16} color="#3B82F6" />
                      <Text style={styles.viewOnMapText}>View on Map</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={styles.noLocationText}>No location set</Text>
                )}
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

        {/* <TouchableOpacity 
          style={[styles.actionButton, styles.mapButton]}
          onPress={() => navigation.navigate('Map')}
        >
          <MaterialCommunityIcons name="map-marker" size={20} color="white" />
          <Text style={styles.actionButtonText}>Update Location</Text>
        </TouchableOpacity> */}
      </View>
      </ScrollView>
    </SafeScreen>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120, // Increased bottom padding for mobile visibility
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    color: '#059669',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 20,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#059669',
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
  },
  uidText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
    fontWeight: '600',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    fontFamily: 'Inter-SemiBold',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(5, 150, 105, 0.05)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
  },
  infoText: {
    marginLeft: 8,
    color: '#059669',
    fontWeight: '600',
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  verifiedText: {
    color: '#059669',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
  },
  statCardPrimary: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(5, 150, 105, 0.2)',
    borderLeftWidth: 4,
    borderLeftColor: '#059669',
  },
  statCardSecondary: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(59, 130, 246, 0.2)',
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  statCardTertiary: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(245, 158, 11, 0.2)',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    marginVertical: 8,
    color: '#1E293B',
    fontFamily: 'Inter-Bold',
  },
  statLabel: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  section: {
    marginBottom: 28,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.08)',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 20,
    fontFamily: 'Inter-Bold',
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoLabel: {
    fontWeight: '700',
    color: '#374151',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  infoValue: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    flex: 1,
    textAlign: 'right',
  },
  shopCard: {
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  shopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  shopInfo: {
    marginLeft: 12,
    flex: 1,
  },
  shopId: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: 'Inter-Bold',
  },
  shopName: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  shopDetails: {
    marginLeft: 32,
    gap: 8,
  },
  shopDetail: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    fontFamily: 'Inter-Medium',
  },
  detailLabel: {
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Inter-Bold',
  },
  noShopsText: {
    color: '#94A3B8',
    textAlign: 'center',
    marginVertical: 20,
    fontSize: 15,
    fontWeight: '500',
    fontFamily: 'Inter-Medium',
    fontStyle: 'italic',
  },
  actionsContainer: {
    gap: 16,
    marginTop: 32,
    marginBottom: 60, // Extra margin for mobile visibility
  },
  actionButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    gap: 12,
  },
  editButton: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
  },
  logoutButton: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  mapButton: {
    backgroundColor: '#3B82F6',
    shadowColor: '#3B82F6',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  viewOnMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    gap: 6,
  },
  viewOnMapText: {
    color: '#3B82F6',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
  },
  noLocationText: {
    color: '#94A3B8',
    fontStyle: 'italic',
    marginTop: 8,
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'Inter-Medium',
  },
});

export default ProfileScreen;