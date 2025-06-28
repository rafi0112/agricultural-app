import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Alert,
  Linking,
  Modal,
  Platform,
} from "react-native";
import { query, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db, ordersCol } from "./firebaseConfig";
import SafeScreen from "./SafeScreen";
import { useAuth } from "./AuthContext";
import { MaterialIcons, MaterialCommunityIcons, Ionicons, Feather } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

type OrderItem = {
  farmerId: string;
  id: string;
  image: string;
  name: string;
  price: number;
  quantity: number;
  shopId: string;
  shopName: string;
  unit: string;
};

type Order = {
  id: string;
  contactNumber: string;
  createdAt: Date;
  deliveryAddress: string;
  deliveryLocation?: {
    address: string;
    latitude: number;
    longitude: number;
    name: string;
  };
  latitude?: string | number;
  longitude?: string | number;
  items: OrderItem[];
  status: "pending" | "approved" | "rejected" | "completed";
  orderStatus?: string;
  total: number;
  userEmail: string;
  userId: string;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentCompletedAt?: string;
  sslCommerzResponse?: {
    amount: string;
    bank_tran_id: string;
    card_no: string;
    card_type: string;
    currency: string;
    status: string;
    tran_date: string;
    tran_id: string;
  };
  farmerItems?: OrderItem[];
  farmerTotal?: number;
};

const OrdersScreen = () => {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{latitude: number, longitude: number} | null>(null);

  useEffect(() => {
    // Get current location for directions
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          setCurrentLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      } catch (error) {
        console.log('Location permission denied');
      }
    })();
  }, []);

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    const unsubscribeOrders = onSnapshot(
      query(ordersCol),
      (snapshot) => {
        try {
          const allOrders: Order[] = snapshot.docs.map((doc) => {
            const data = doc.data();
            const items = data.items || [];
            
            // Filter items that belong to the current farmer
            const farmerItems = items.filter((item: OrderItem) => 
              item.farmerId === currentUser.uid
            );
            
            // Calculate total for just the farmer's items
            const farmerTotal = farmerItems.reduce(
              (sum: number, item: OrderItem) => sum + (item.price * item.quantity), 
              0
            );

            return {
              id: doc.id,
              contactNumber: data.contactNumber || "Not specified",
              createdAt: data.createdAt?.toDate() || new Date(),
              deliveryAddress: data.deliveryAddress || "Not specified",
              deliveryLocation: data.deliveryLocation || null,
              latitude: data.latitude || null,
              longitude: data.longitude || null,
              items,
              status: data.status || "pending",
              orderStatus: data.orderStatus || "pending",
              total: data.total || 0,
              userEmail: data.userEmail || "No email",
              userId: data.userId || "Unknown user",
              paymentMethod: data.paymentMethod || null,
              paymentStatus: data.paymentStatus || null,
              paymentCompletedAt: data.paymentCompletedAt || null,
              sslCommerzResponse: data.sslCommerzResponse || null,
              farmerItems,
              farmerTotal
            };
          });

          // Filter orders that have at least one item belonging to the farmer
          const farmerOrders = allOrders.filter(order => order.farmerItems && order.farmerItems.length > 0);

          setOrders(farmerOrders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
          setError(null);
        } catch (err) {
          console.error("Error processing orders:", err);
          setError("Failed to load orders. Please try again.");
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error("Firestore error:", err);
        setError("Connection error. Please check your network.");
        setLoading(false);
      }
    );

    return () => unsubscribeOrders();
  }, [currentUser?.uid]);

  const handleUpdateStatus = async (orderId: string, newStatus: Order["status"]) => {
    try {
      setLoading(true);
      await updateDoc(doc(ordersCol, orderId), { status: newStatus });
      Alert.alert("Success", `Order status updated to ${newStatus}`);
    } catch (error) {
      console.error("Update error:", error);
      Alert.alert("Error", "Failed to update order status");
    } finally {
      setLoading(false);
    }
  };

  const openLocationOnMap = (order: Order) => {
    setSelectedOrder(order);
    setMapModalVisible(true);
  };

  const getDirections = (order: Order) => {
    const destLat = order.deliveryLocation?.latitude || parseFloat(order.latitude as string) || 0;
    const destLng = order.deliveryLocation?.longitude || parseFloat(order.longitude as string) || 0;
    
    if (!destLat || !destLng) {
      Alert.alert("Error", "Delivery location not available");
      return;
    }

    const url = Platform.select({
      ios: `maps:?daddr=${destLat},${destLng}`,
      android: `google.navigation:q=${destLat},${destLng}`,
    });

    if (url) {
      Linking.canOpenURL(url).then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          // Fallback to Google Maps web
          const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`;
          Linking.openURL(webUrl);
        }
      });
    }
  };

  const renderOrderItem = ({ item }: { item: Order }) => {
    if (!item.farmerItems || item.farmerItems.length === 0) {
      return null;
    }

    const hasDeliveryLocation = item.deliveryLocation || (item.latitude && item.longitude);

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderIdContainer}>
            <MaterialIcons name="receipt" size={20} color="#059669" />
            <Text style={styles.orderId}>#{item.id.substring(0, 8)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusBackgroundColor(item.status) }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>
        
        {/* Customer & Contact Info */}
        <View style={styles.customerSection}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <View style={styles.infoRow}>
            <MaterialIcons name="email" size={16} color="#64748B" />
            <Text style={styles.infoText}>{item.userEmail}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="phone" size={16} color="#64748B" />
            <Text style={styles.infoText}>{item.contactNumber}</Text>
          </View>
        </View>

        {/* Delivery Information */}
        <View style={styles.deliverySection}>
          <Text style={styles.sectionTitle}>Delivery Information</Text>
          <View style={styles.infoRow}>
            <MaterialIcons name="location-on" size={16} color="#64748B" />
            <Text style={styles.infoText} numberOfLines={2}>
              {item.deliveryLocation?.name ? `${item.deliveryLocation.name} - ` : ''}
              {item.deliveryLocation?.address || item.deliveryAddress}
            </Text>
          </View>
          
          {hasDeliveryLocation && (
            <View style={styles.locationButtons}>
              <TouchableOpacity 
                style={styles.locationButton}
                onPress={() => openLocationOnMap(item)}
              >
                <MaterialIcons name="map" size={16} color="#3B82F6" />
                <Text style={styles.locationButtonText}>View on Map</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.directionsButton}
                onPress={() => getDirections(item)}
              >
                <MaterialIcons name="directions" size={16} color="#059669" />
                <Text style={styles.directionsButtonText}>Get Directions</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Payment Information */}
        {item.paymentStatus && (
          <View style={styles.paymentSection}>
            <Text style={styles.sectionTitle}>Payment Details</Text>
            <View style={styles.paymentInfo}>
              <View style={styles.infoRow}>
                <MaterialIcons name="payment" size={16} color="#64748B" />
                <Text style={styles.infoText}>
                  {item.paymentMethod?.replace('_', ' ').toUpperCase() || 'N/A'}
                </Text>
                <View style={[styles.paymentBadge, { 
                  backgroundColor: item.paymentStatus === 'success' ? '#D1FAE5' : '#FEE2E2' 
                }]}>
                  <Text style={[styles.paymentBadgeText, { 
                    color: item.paymentStatus === 'success' ? '#059669' : '#EF4444' 
                  }]}>
                    {item.paymentStatus?.toUpperCase()}
                  </Text>
                </View>
              </View>
              {item.sslCommerzResponse && (
                <View style={styles.transactionDetails}>
                  <Text style={styles.transactionText}>
                    Card: {item.sslCommerzResponse.card_no} ({item.sslCommerzResponse.card_type})
                  </Text>
                  <Text style={styles.transactionText}>
                    Transaction: {item.sslCommerzResponse.tran_id}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Products */}
        <View style={styles.productsSection}>
          <Text style={styles.sectionTitle}>Your Products ({item.farmerItems.length})</Text>
          
          {item.farmerItems.map((product, index) => (
            <View key={`${item.id}-${product.id}-${index}`} style={styles.productItem}>
              <Image 
                source={{ uri: product.image || "https://via.placeholder.com/300" }} 
                style={styles.productImage} 
              />
              <View style={styles.productDetails}>
                <Text style={styles.productName}>{product.name}</Text>
                <View style={styles.productInfoRow}>
                  <MaterialIcons name="store" size={14} color="#64748B" />
                  <Text style={styles.productInfo}>{product.shopName}</Text>
                </View>
                <View style={styles.productInfoRow}>
                  <MaterialIcons name="attach-money" size={14} color="#64748B" />
                  <Text style={styles.productInfo}>৳{product.price.toFixed(2)}/{product.unit}</Text>
                </View>
                <View style={styles.productInfoRow}>
                  <MaterialIcons name="inventory" size={14} color="#64748B" />
                  <Text style={styles.productInfo}>Qty: {product.quantity}</Text>
                </View>
                <Text style={styles.productSubtotal}>
                  Subtotal: ৳{(product.price * product.quantity).toFixed(2)}
                </Text>
              </View>
            </View>
          ))}
        </View>
        
        {/* Order Summary */}
        <View style={styles.orderSummary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Your Earnings:</Text>
            <Text style={styles.summaryValue}>৳{item.farmerTotal?.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Order Value:</Text>
            <Text style={styles.summaryValue}>৳{item.total.toFixed(2)}</Text>
          </View>
          <View style={styles.orderDate}>
            <MaterialIcons name="schedule" size={14} color="#64748B" />
            <Text style={styles.dateText}>
              {item.createdAt.toLocaleDateString()} at {item.createdAt.toLocaleTimeString()}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {item.status === "pending" && (
            <>
              <ActionButton
                color="#059669"
                text="Approve"
                icon="check-circle"
                onPress={() => handleUpdateStatus(item.id, "approved")}
              />
              <ActionButton
                color="#EF4444"
                text="Reject"
                icon="cancel"
                onPress={() => handleUpdateStatus(item.id, "rejected")}
              />
            </>
          )}
          
          {item.status === "approved" && (
            <ActionButton
              color="#3B82F6"
              text="Mark as Completed"
              icon="done-all"
              onPress={() => handleUpdateStatus(item.id, "completed")}
              fullWidth
            />
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeScreen style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#059669" />
          <Text style={styles.loadingText}>Loading your orders...</Text>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen style={styles.container}>
      <View style={styles.header}>
        <MaterialIcons name="shopping-cart" size={24} color="#059669" />
        <Text style={styles.screenTitle}>Your Orders</Text>
        <View style={{ width: 24 }} />
      </View>
      
      {orders.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="cart-off" size={80} color="#94A3B8" />
          <Text style={styles.emptyText}>No orders found</Text>
          <Text style={styles.emptySubtext}>
            You don't have any orders with your products yet
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryContainer}>
            <View style={styles.summaryRow}>
              <MaterialIcons name="analytics" size={20} color="#059669" />
              <Text style={styles.summaryText}>
                {orders.length} orders with your products
              </Text>
            </View>
            <View style={styles.statusSummary}>
              <StatusChip status="pending" count={orders.filter(o => o.status === "pending").length} />
              <StatusChip status="approved" count={orders.filter(o => o.status === "approved").length} />
              <StatusChip status="completed" count={orders.filter(o => o.status === "completed").length} />
            </View>
          </View>

          <FlatList
            data={orders}
            renderItem={renderOrderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />

          {error && (
            <View style={styles.errorContainer}>
              <MaterialIcons name="error-outline" size={24} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  setError(null);
                  setLoading(true);
                }}
              >
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {/* Map Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={mapModalVisible}
        onRequestClose={() => setMapModalVisible(false)}
      >
        <SafeScreen style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setMapModalVisible(false)}
            >
              <Ionicons name="arrow-back" size={24} color="#059669" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Delivery Location</Text>
            <TouchableOpacity
              style={styles.directionsIconButton}
              onPress={() => selectedOrder && getDirections(selectedOrder)}
            >
              <MaterialIcons name="directions" size={24} color="#059669" />
            </TouchableOpacity>
          </View>
          
          {selectedOrder && (
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: selectedOrder.deliveryLocation?.latitude || 
                         parseFloat(selectedOrder.latitude as string) || 23.8103,
                longitude: selectedOrder.deliveryLocation?.longitude || 
                          parseFloat(selectedOrder.longitude as string) || 90.4125,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              showsUserLocation={true}
              showsMyLocationButton={true}
            >
              <Marker
                coordinate={{
                  latitude: selectedOrder.deliveryLocation?.latitude || 
                           parseFloat(selectedOrder.latitude as string) || 23.8103,
                  longitude: selectedOrder.deliveryLocation?.longitude || 
                            parseFloat(selectedOrder.longitude as string) || 90.4125,
                }}
                title="Delivery Location"
                description={selectedOrder.deliveryLocation?.name || selectedOrder.deliveryAddress}
                pinColor="#EF4444"
              />
              {currentLocation && (
                <Marker
                  coordinate={currentLocation}
                  title="Your Location"
                  description="Current location"
                  pinColor="#059669"
                />
              )}
            </MapView>
          )}
          
          <View style={styles.mapLocationInfo}>
            <Text style={styles.mapLocationTitle}>
              {selectedOrder?.deliveryLocation?.name || 'Delivery Address'}
            </Text>
            <Text style={styles.mapLocationAddress}>
              {selectedOrder?.deliveryLocation?.address || selectedOrder?.deliveryAddress}
            </Text>
          </View>
        </SafeScreen>
      </Modal>
    </SafeScreen>
  );
};

const ActionButton = ({
  color,
  text,
  icon,
  onPress,
  fullWidth = false,
}: {
  color: string;
  text: string;
  icon: string;
  onPress: () => void;
  fullWidth?: boolean;
}) => (
  <TouchableOpacity
    style={[
      styles.actionButton,
      { backgroundColor: color, width: fullWidth ? '100%' : '48%' },
    ]}
    onPress={onPress}
  >
    <MaterialIcons name={icon as any} size={16} color="#FFFFFF" />
    <Text style={styles.actionButtonText}>{text}</Text>
  </TouchableOpacity>
);

const StatusChip = ({ status, count }: { status: string; count: number }) => (
  <View style={[styles.statusChip, { backgroundColor: getStatusBackgroundColor(status) }]}>
    <Text style={[styles.statusChipText, { color: getStatusColor(status) }]}>
      {status}: {count}
    </Text>
  </View>
);

const getStatusColor = (status: string) => {
  switch (status) {
    case "approved": return "#059669";
    case "rejected": return "#EF4444";
    case "completed": return "#3B82F6";
    default: return "#F59E0B";
  }
};

const getStatusBackgroundColor = (status: string) => {
  switch (status) {
    case "approved": return "#D1FAE5";
    case "rejected": return "#FEE2E2";
    case "completed": return "#DBEAFE";
    default: return "#FEF3C7";
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E293B",
    fontFamily: "Inter-Bold",
  },
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.08)",
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  orderIdContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  orderId: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    fontFamily: "Inter-Bold",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Inter-Bold",
  },
  customerSection: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  deliverySection: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  paymentSection: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  productsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 12,
    fontFamily: "Inter-Bold",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
    fontFamily: "Inter-Medium",
    flex: 1,
  },
  locationButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    flex: 1,
  },
  locationButtonText: {
    color: "#3B82F6",
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter-SemiBold",
  },
  directionsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(5, 150, 105, 0.1)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    flex: 1,
  },
  directionsButtonText: {
    color: "#059669",
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter-SemiBold",
  },
  paymentInfo: {
    gap: 8,
  },
  paymentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  paymentBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter-Bold",
  },
  transactionDetails: {
    marginTop: 8,
    padding: 12,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    gap: 4,
  },
  transactionText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
    fontFamily: "Inter-Medium",
  },
  productItem: {
    flexDirection: "row",
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
    backgroundColor: "#F1F5F9",
  },
  productDetails: {
    flex: 1,
    gap: 4,
  },
  productName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 4,
    fontFamily: "Inter-Bold",
  },
  productInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  productInfo: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
    fontFamily: "Inter-Medium",
  },
  productSubtotal: {
    fontSize: 14,
    fontWeight: "700",
    color: "#059669",
    marginTop: 4,
    fontFamily: "Inter-Bold",
  },
  orderSummary: {
    padding: 16,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
    fontFamily: "Inter-SemiBold",
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    fontFamily: "Inter-Bold",
  },
  orderDate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  dateText: {
    fontSize: 12,
    color: "#94A3B8",
    fontStyle: "italic",
    fontWeight: "500",
    fontFamily: "Inter-Medium",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
    fontFamily: "Inter-Bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    color: "#059669",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter-SemiBold",
  },
  errorContainer: {
    backgroundColor: "#FEE2E2",
    padding: 16,
    borderRadius: 16,
    margin: 20,
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    color: "#DC2626",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "Inter-Medium",
  },
  retryButton: {
    backgroundColor: "#059669",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 8,
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontFamily: "Inter-Bold",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#64748B",
    marginTop: 16,
    marginBottom: 8,
    fontFamily: "Inter-Bold",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 20,
    fontWeight: "500",
    fontFamily: "Inter-Medium",
  },
  summaryContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.1)",
  },
  summaryText: {
    color: "#1E293B",
    fontWeight: "600",
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
  },
  statusSummary: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    alignItems: "center",
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter-Bold",
  },
  listContent: {
    paddingBottom: 100,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  modalCloseButton: {
    padding: 12,
    backgroundColor: "rgba(5, 150, 105, 0.1)",
    borderRadius: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    fontFamily: "Inter-Bold",
  },
  directionsIconButton: {
    padding: 12,
    backgroundColor: "rgba(5, 150, 105, 0.1)",
    borderRadius: 16,
  },
  map: {
    flex: 1,
  },
  mapLocationInfo: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  mapLocationTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 4,
    fontFamily: "Inter-Bold",
  },
  mapLocationAddress: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
    fontFamily: "Inter-Medium",
    lineHeight: 20,
  },
});

export default OrdersScreen;