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
} from "react-native";
import { query, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db, ordersCol } from "./firebaseConfig";
import SafeScreen from "./SafeScreen";
import { useAuth } from "./AuthContext";

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
  items: OrderItem[];
  status: "pending" | "approved" | "rejected" | "completed";
  total: number;
  userEmail: string;
  userId: string;
  farmerItems?: OrderItem[];
  farmerTotal?: number;
};

const OrdersScreen = () => {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
              items,
              status: data.status || "pending",
              total: data.total || 0,
              userEmail: data.userEmail || "No email",
              userId: data.userId || "Unknown user",
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

  const renderOrderItem = ({ item }: { item: Order }) => {
    if (!item.farmerItems || item.farmerItems.length === 0) {
      return null;
    }

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <Text style={styles.orderId}>Order #{item.id.substring(0, 8)}</Text>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
        
        <View style={styles.customerInfo}>
          <Text style={styles.customerEmail}>{item.userEmail}</Text>
          <Text style={styles.contactInfo}>Contact: {item.contactNumber}</Text>
        </View>
        
        <Text style={styles.deliveryInfo}>Delivery: {item.deliveryAddress}</Text>
        
        <Text style={styles.itemsTitle}>Your Products ({item.farmerItems.length}):</Text>
        
        {item.farmerItems.map((product, index) => (
          <View key={`${item.id}-${product.id}-${index}`} style={styles.productItem}>
            <Image 
              source={{ uri: product.image || "https://via.placeholder.com/300" }} 
              style={styles.productImage} 
            />
            <View style={styles.productDetails}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productInfo}>Shop: {product.shopName}</Text>
              <Text style={styles.productInfo}>Price: ৳{product.price.toFixed(2)}/{product.unit}</Text>
              <Text style={styles.productInfo}>Qty: {product.quantity}</Text>
              <Text style={styles.productInfo}>Subtotal: ৳{(product.price * product.quantity).toFixed(2)}</Text>
            </View>
          </View>
        ))}
        
        <View style={styles.orderFooter}>
          <Text style={styles.totalText}>Your Total: ৳{item.farmerTotal?.toFixed(2)}</Text>
          <Text style={styles.totalText}>Order Total: ৳{item.total.toFixed(2)}</Text>
          <Text style={styles.dateText}>
            Ordered on {item.createdAt.toLocaleDateString()} at {item.createdAt.toLocaleTimeString()}
          </Text>
        </View>

        <View style={styles.actionButtons}>
          {item.status === "pending" && (
            <>
              <ActionButton
                color="#4CAF50"
                text="Approve"
                onPress={() => handleUpdateStatus(item.id, "approved")}
              />
              <ActionButton
                color="#F44336"
                text="Reject"
                onPress={() => handleUpdateStatus(item.id, "rejected")}
              />
            </>
          )}
          
          {item.status === "approved" && (
            <ActionButton
              color="#2196F3"
              text="Mark as Completed"
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
      <SafeScreen>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading your orders...</Text>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen style={styles.container}>
      <Text style={styles.screenTitle}>Your Orders</Text>
      
      {orders.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No orders found</Text>
          <Text style={styles.emptySubtext}>
            You don't have any orders with your products
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryText}>
              Showing {orders.length} orders with your products
            </Text>
            <Text style={styles.summaryText}>
              Pending: {orders.filter(o => o.status === "pending").length} | 
              Approved: {orders.filter(o => o.status === "approved").length} | 
              Completed: {orders.filter(o => o.status === "completed").length}
            </Text>
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
    </SafeScreen>
  );
};

const ActionButton = ({
  color,
  text,
  onPress,
  fullWidth = false,
}: {
  color: string;
  text: string;
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
    <Text style={styles.actionButtonText}>{text}</Text>
  </TouchableOpacity>
);

const getStatusColor = (status: string) => {
  switch (status) {
    case "approved": return "#4CAF50";
    case "rejected": return "#F44336";
    case "completed": return "#2196F3";
    default: return "#FF9800";
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f8f9fa",
    
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#2c3e50",
    textAlign: "center",
  },
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  orderId: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  customerInfo: {
    marginBottom: 8,
  },
  customerEmail: {
    fontSize: 14,
    color: "#616161",
  },
  contactInfo: {
    fontSize: 14,
    color: "#616161",
  },
  deliveryInfo: {
    fontSize: 14,
    color: "#616161",
    marginBottom: 12,
  },
  itemsTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#2c3e50",
  },
  productItem: {
    flexDirection: "row",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212529",
    marginBottom: 4,
  },
  productInfo: {
    fontSize: 14,
    color: "#616161",
    marginBottom: 2,
  },
  orderFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  totalText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
    color: "#9e9e9e",
    fontStyle: "italic",
  },
  actionButtons: {
    flexDirection:'row-reverse',
    marginTop: 16,
    gap:10
  },
  actionButton: {
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
    marginBottom: 8,
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "500",
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    color: "#616161",
  },
  errorContainer: {
    backgroundColor: "#ffebee",
    padding: 16,
    borderRadius: 8,
    margin: 16,
    alignItems: "center",
  },
  errorText: {
    color: "#d32f2f",
    textAlign: "center",
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  retryText: {
    color: "#fff",
    fontWeight: "500",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: "#616161",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9e9e9e",
    textAlign: "center",
    marginBottom: 20,
  },
  summaryContainer: {
    padding: 12,
    backgroundColor: "#e3f2fd",
    borderRadius: 8,
    marginBottom: 12,
  },
  summaryText: {
    color: "#0d47a1",
    fontWeight: "500",
    marginBottom: 4,
  },
  listContent: {
    paddingBottom: 20,
    
  },
});

export default OrdersScreen;