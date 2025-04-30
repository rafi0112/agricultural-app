import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  FlatList,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Dimensions,
  Animated,
  RefreshControl,
  ScrollView,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { MaterialIcons, Ionicons, Feather } from '@expo/vector-icons';
import { db, shopsCol, productsCol } from "./firebaseConfig";
import { doc, addDoc, query, where, onSnapshot } from "firebase/firestore";
import SafeScreen from "./SafeScreen";
import { useAuth } from "./AuthContext";

const ShopScreen = () => {
  const { currentUser } = useAuth();
  const [shops, setShops] = useState<{ id: string; name: string; farmerId: string }[]>([]);
  const [selectedShop, setSelectedShop] = useState<{ id: string; name: string } | null>(null);
  const [newShop, setNewShop] = useState({ name: "" });
  const [newProduct, setNewProduct] = useState({
    name: "",
    price: "",
    image: "",
    unit: "kg",
  });
  const [products, setProducts] = useState<{ 
    id: string; 
    name: string; 
    price: number; 
    image?: string; 
    unit: string;
    shopId: string;
    farmerId: string;
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lineChartData, setLineChartData] = useState({
    labels: ['No shops yet'],
    datasets: [{ data: [0] }],
  });
  const fadeAnim = useState(new Animated.Value(0))[0];

  // Fetch shops and products data
  useEffect(() => {
    if (!currentUser?.uid) return;

    setLoading(true);
    
    // Query shops that belong to current farmer
    const qShops = query(shopsCol, where("farmerId", "==", currentUser.uid));
    const unsubscribeShops = onSnapshot(qShops, async (snapshot) => {
      const shopsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || "Unknown Shop",
        farmerId: doc.data().farmerId,
      }));
      setShops(shopsData);

      // Update chart data
      if (shopsData.length === 0) {
        setLineChartData({
          labels: ['No shops yet'],
          datasets: [{ data: [0] }],
        });
        setLoading(false);
        return;
      }

      // Get product counts for each shop
      const shopProductCounts: Record<string, number> = {};
      const promises = shopsData.map((shop) => {
        const qProducts = query(
          productsCol, 
          where("shopId", "==", shop.id),
          where("farmerId", "==", currentUser.uid)
        );
        return new Promise<void>((resolve) => {
          onSnapshot(qProducts, (productSnapshot) => {
            shopProductCounts[shop.name] = productSnapshot.size;
            resolve();
          });
        });
      });

      await Promise.all(promises);
      
      // Update chart with product counts
      const labels = Object.keys(shopProductCounts);
      const data = Object.values(shopProductCounts).map((value) => {
        const num = Number(value);
        return isFinite(num) ? num : 0;
      });

      if (labels.length > 0 && data.length > 0) {
        setLineChartData({
          labels,
          datasets: [{ data }],
        });
      }

      setLoading(false);
    });

    return () => unsubscribeShops();
  }, [currentUser]);

  // Fetch products when shop is selected
  useEffect(() => {
    if (!selectedShop || !currentUser?.uid) return;

    const q = query(
      productsCol, 
      where("shopId", "==", selectedShop.id),
      where("farmerId", "==", currentUser.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map((doc) => ({ 
        id: doc.id, 
        ...(doc.data() as { 
          name: string; 
          price: number; 
          image?: string; 
          unit: string;
          shopId: string;
          farmerId: string;
        }) 
      }));
      setProducts(productsData);
    });
    return unsubscribe;
  }, [selectedShop, currentUser]);

  const handleCreateShop = async () => {
    if (!newShop.name) {
      Alert.alert("Error", "Please enter a shop name");
      return;
    }

    if (!currentUser?.uid) {
      Alert.alert("Error", "You must be logged in to create shops");
      return;
    }

    try {
      await addDoc(shopsCol, {
        name: newShop.name,
        farmerId: currentUser.uid,
      });
      setNewShop({ name: "" });
      Alert.alert("Success", "Shop created successfully!");
    } catch (error) {
      console.error("Error creating shop:", error);
      Alert.alert("Error", "Failed to create shop");
    }
  };

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.price) {
      Alert.alert("Error", "Please fill all required fields");
      return;
    }

    if (!currentUser?.uid || !selectedShop?.id) {
      Alert.alert("Error", "You must select a shop and be logged in to add products");
      return;
    }

    try {
      await addDoc(productsCol, {
        ...newProduct,
        price: parseFloat(newProduct.price),
        shopId: selectedShop.id,
        farmerId: currentUser.uid,
        createdAt: new Date(),
      });
      setNewProduct({ name: "", price: "", image: "", unit: "kg" });
      Alert.alert("Success", "Product added successfully!");
    } catch (error) {
      console.error("Error adding product:", error);
      Alert.alert("Error", "Failed to add product");
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const renderShopItem = ({ item }: { item: { id: string; name: string } }) => (
    <TouchableOpacity 
      style={styles.shopCard}
      onPress={() => setSelectedShop(item)}
    >
      <View style={styles.shopIcon}>
        <MaterialIcons name="storefront" size={24} color="#4CAF50" />
      </View>
      <Text style={styles.shopName}>{item.name}</Text>
      <Ionicons name="chevron-forward" size={20} color="#95a5a6" />
    </TouchableOpacity>
  );

  const renderProductItem = ({ item }: { item: { 
    id: string; 
    name: string; 
    price: number; 
    image?: string; 
    unit: string;
  } }) => (
    <Animated.View style={[styles.productCard, { opacity: fadeAnim }]}>
      <Image
        source={{ uri: item.image || 'https://via.placeholder.com/150' }}
        style={styles.productImage}
      />
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productPrice}>৳{item.price}/{item.unit}</Text>
      </View>
    </Animated.View>
  );

  if (loading) {
    return (
      <SafeScreen>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading your shops...</Text>
        </View>
      </SafeScreen>
    );
  }

  if (!selectedShop) {
    return (
      <SafeScreen style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.farmerName}>{currentUser?.displayName || "Farmer"}'s Shops</Text>
        </View>
        
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              colors={['#4CAF50']}
              tintColor="#4CAF50"
            />
          }
        >
          <View style={styles.createShopCard}>
            <Text style={styles.sectionTitle}>Create New Shop</Text>
            <View style={styles.inputContainer}>
              <Feather name="shopping-bag" size={20} color="#7F7F7F" style={styles.inputIcon} />
              <TextInput
                placeholder="Shop Name"
                value={newShop.name}
                onChangeText={(text) => setNewShop({ ...newShop, name: text })}
                style={styles.input}
                placeholderTextColor="#95a5a6"
              />
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={handleCreateShop}>
              <Text style={styles.buttonText}>Create Shop</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Your Shops ({shops.length})</Text>
          <FlatList
            data={shops}
            renderItem={renderShopItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            scrollEnabled={false}
          />

          <Text style={styles.chartTitle}>Your Products Distribution</Text>
          <View style={styles.chartCard}>
            {lineChartData.labels.length > 1 ? (
              <LineChart
                data={lineChartData}
                width={Dimensions.get("window").width - 64}
                height={220}
                chartConfig={{
                  backgroundColor: "#FFFFFF",
                  backgroundGradientFrom: "#FFFFFF",
                  backgroundGradientTo: "#FFFFFF",
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  propsForDots: {
                    r: "6",
                    strokeWidth: "2",
                    stroke: "#4CAF50",
                  },
                }}
                bezier
                style={{
                  borderRadius: 16,
                }}
              />
            ) : (
              <View style={styles.noDataContainer}>
                <MaterialIcons name="show-chart" size={40} color="#e0e0e0" />
                <Text style={styles.noDataText}>Add more shops and products to see analytics</Text>
              </View>
            )}
          </View>
          <View style={styles.footerSpacer} />
        </ScrollView>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setSelectedShop(null)} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#4CAF50" />
        </TouchableOpacity>
        <Text style={styles.farmerName}>{selectedShop.name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
      >
        <View style={styles.addProductCard}>
          <Text style={styles.sectionTitle}>Add New Product</Text>
          <View style={styles.inputContainer}>
            <Feather name="package" size={20} color="#7F7F7F" style={styles.inputIcon} />
            <TextInput
              placeholder="Product Name"
              value={newProduct.name}
              onChangeText={(text) => setNewProduct({ ...newProduct, name: text })}
              style={styles.input}
              placeholderTextColor="#95a5a6"
            />
          </View>
          <View style={styles.inputContainer}>
            <MaterialIcons name="attach-money" size={20} color="#7F7F7F" style={styles.inputIcon} />
            <TextInput
              placeholder="Price (৳)"
              keyboardType="numeric"
              value={newProduct.price}
              onChangeText={(text) => setNewProduct({ ...newProduct, price: text })}
              style={styles.input}
              placeholderTextColor="#95a5a6"
            />
          </View>
          <View style={styles.inputContainer}>
            <Feather name="image" size={20} color="#7F7F7F" style={styles.inputIcon} />
            <TextInput
              placeholder="Image URL (optional)"
              value={newProduct.image}
              onChangeText={(text) => setNewProduct({ ...newProduct, image: text })}
              style={styles.input}
              placeholderTextColor="#95a5a6"
            />
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={handleAddProduct}>
            <Text style={styles.buttonText}>Add Product</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Your Products ({products.length})</Text>
{products.length > 0 ? (
  <View style={styles.productsContainer}>
    {products.map((product) => (
      <View key={product.id} style={styles.productCard}>
        <Image
          source={{ uri: product.image || 'https://via.placeholder.com/150' }}
          style={styles.productImage}
        />
        <View style={styles.productDetails}>
          <Text style={styles.productName}>{product.name}</Text>
          <View style={styles.priceContainer}>
            <Text style={styles.productPrice}>৳{product.price}</Text>
            <Text style={styles.productUnit}>/{product.unit}</Text>
          </View>
          <View style={styles.productMeta}>
            <Text style={styles.productAdded}>Added: {new Date().toLocaleDateString()}</Text>
          </View>
        </View>
      </View>
    ))}
  </View>
) :  (
  <View style={styles.noProductsContainer}>
    <MaterialIcons name="inventory" size={40} color="#e0e0e0" />
    <Text style={styles.noProductsText}>No products yet. Add your first product!</Text>
  </View>
)}
        <View style={styles.footerSpacer} />
      </ScrollView>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F9F9",
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 20,  // Reduced from 40 to 20
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  farmerName: {
    fontSize: 18,  // Reduced from 20 to 18
    fontWeight: "bold",
    color: "#333",
    flex: 1,
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
  },
  loadingText: {
    marginTop: 16,
    color: "#4CAF50",
    fontSize: 16,
  },
  createShopCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,  // Reduced from 20 to 16
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginHorizontal: 16,
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 50,
    color: "#333",
    fontSize: 16,
  },
  shopCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  shopIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  shopName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  addProductCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,  // Reduced space
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButton: {
    backgroundColor: "#4CAF50",
    borderRadius: 12,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  productCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 16,
  },
  productInfo: {
    flex: 1,
    justifyContent: "center",
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#4CAF50",
  },
  listContent: {
    paddingBottom: 16,
  },
  chartCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
    marginBottom: 16,
    marginTop: 24,
  },
  noDataContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  noDataText: {
    fontSize: 14,
    color: "#95a5a6",
    textAlign: "center",
    marginTop: 16,
  },
  noProductsContainer: {
    alignItems: "center",
    paddingVertical: 40,
    marginHorizontal: 16,
  },
  noProductsText: {
    fontSize: 14,
    color: "#95a5a6",
    textAlign: "center",
    marginTop: 16,
  },
  footerSpacer: {
    height: 80,  // Reduced from 120 to 80
  },
  backButton: {
    padding: 8,
  },
  productsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  
  
  productDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  productUnit: {
    fontSize: 14,
    color: '#95a5a6',
    marginLeft: 4,
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productAdded: {
    fontSize: 12,
    color: '#95a5a6',
  },
  
});

export default ShopScreen;