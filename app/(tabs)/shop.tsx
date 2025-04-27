import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  FlatList,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from "react-native";
import { LineChart } from "react-native-chart-kit"; // Import LineChart
import { db, shopsCol, productsCol } from "./firebaseConfig";
import { doc, addDoc, query, where, onSnapshot } from "firebase/firestore";
import SafeScreen from "./SafeScreen";
import { useAuth } from "./AuthContext"; // Import AuthContext for authentication

const ShopScreen = () => {
  const { currentUser, logout } = useAuth(); // Access currentUser and logout from AuthContext
  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);
  const [selectedShop, setSelectedShop] = useState<{ id: string; name: string } | null>(null);
  const [newShop, setNewShop] = useState({ name: "" });
  const [newProduct, setNewProduct] = useState({
    name: "",
    price: "",
    image: "",
    unit: "kg",
  });
  const [products, setProducts] = useState<{ id: string; name: string; price: number; image?: string; unit: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [lineChartData, setLineChartData] = useState<{ labels: string[]; datasets: { data: number[] }[] }>({
    labels: [],
    datasets: [{ data: [] }],
  }); // State for line chart data

  // Fetch all shops and products for line chart
  useEffect(() => {
    if (!currentUser) return;
  
    const qShops = query(shopsCol, where("farmerId", "==", currentUser.uid)); // Filter by farmerId
    const unsubscribeShops = onSnapshot(qShops, async (snapshot) => {
      const shopsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || "Unknown Shop",
      }));
      setShops(shopsData);
  
      // Fetch products for all shops and dynamically update chart data
      const shopProductCounts: Record<string, number> = {};
      const promises = shopsData.map((shop) => {
        const qProducts = query(productsCol, where("shopId", "==", shop.id));
        return new Promise<void>((resolve) => {
          onSnapshot(qProducts, (productSnapshot) => {
            shopProductCounts[shop.name] = productSnapshot.size;
  
            // Recalculate and update chart data
            const labels = Object.keys(shopProductCounts);
            const data = Object.values(shopProductCounts).map((value) =>
              isFinite(value) ? value : 0 // Replace invalid values with 0
            );
  
            setLineChartData({
              labels,
              datasets: [{ data }],
            });
  
            resolve(); // Resolve the promise when the snapshot is processed
          });
        });
      });
  
      // Wait for all product listeners to resolve
      await Promise.all(promises);
  
      // Set loading to false after all data is loaded
      setLoading(false);
    });
  
    // Cleanup shop listener
    return () => unsubscribeShops();
  }, [currentUser]);

  // Fetch products for the selected shop
  useEffect(() => {
    if (!selectedShop) return;

    const q = query(productsCol, where("shopId", "==", selectedShop.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as { name: string; price: number; image?: string; unit: string }) })));
    });
    return unsubscribe;
  }, [selectedShop]);

  const handleCreateShop = async () => {
    if (!newShop.name) {
      Alert.alert("Error", "Please enter a shop name");
      return;
    }

    try {
      await addDoc(shopsCol, {
        name: newShop.name,
        farmerId: currentUser?.uid || "", // Associate the shop with the farmer's UID
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

    try {
      await addDoc(productsCol, {
        ...newProduct,
        price: parseFloat(newProduct.price),
        shopId: selectedShop?.id || "",
      });
      setNewProduct({ name: "", price: "", image: "", unit: "kg" });
      Alert.alert("Success", "Product added successfully!");
    } catch (error) {
      console.error("Error adding product:", error);
      Alert.alert("Error", "Failed to add product");
    }
  };

  if (loading) {
    return (
      <SafeScreen>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      </SafeScreen>
    );
  }

  if (!selectedShop) {
    return (
      <SafeScreen style={styles.container}>
        <FlatList
          ListHeaderComponent={
            <>
              {/* Display farmer's name and logout button */}
              <View style={styles.header}>
                <Text style={styles.title}>Welcome, {currentUser?.displayName || "Farmer"}!</Text>
                <Button title="Logout" onPress={logout} />
              </View>
  
              <Text style={styles.title}>Create or Select a Shop</Text>
  
              <View style={styles.createShopForm}>
                <Text style={styles.sectionTitle}>Create a New Shop</Text>
                <TextInput
                  placeholder="Shop Name"
                  value={newShop.name}
                  onChangeText={(text) => setNewShop({ ...newShop, name: text })}
                  style={styles.input}
                />
                <Button title="Create Shop" onPress={handleCreateShop} />
              </View>
  
              <Text style={styles.sectionTitle}>Your Shops</Text>
            </>
          }
          data={shops} // Display all shops owned by the logged-in farmer
          renderItem={({ item }) => (
            <View style={styles.shopItem}>
              <Text style={styles.shopName}>{item.name}</Text>
              <Button title="Select" onPress={() => setSelectedShop(item)} />
            </View>
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            <>
              {/* Line Chart at the Bottom */}
              <Text style={styles.chartTitle}>Total Shops vs Products</Text>
              <LineChart
                    data={lineChartData}
                    width={Dimensions.get("window").width - 40} // Full width minus padding
                    height={220}
                    chartConfig={{
                        backgroundColor: "#e8f5e9", // Very light green background
                        backgroundGradientFrom: "#e8f5e9", // Very light green
                        backgroundGradientTo: "#c8e6c9", // Slightly darker light green
                        decimalPlaces: 0, // No decimal places
                        color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`, // Black for lines
                        labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`, // Black for labels
                        style: {
                        borderRadius: 16,
                        },
                        propsForDots: {
                        r: "6",
                        strokeWidth: "2",
                        stroke: "#4CAF50", // Green stroke for dots
                        },
                    }}
                    bezier // Smooth curve
                    style={{
                        
                        marginVertical: 20,
                        borderRadius: 16,
                    }}
                />
            </>
          }
        />
      </SafeScreen>
    );
  }

  return (
    <SafeScreen style={styles.container}>
      {/* Back button to return to the previous page */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setSelectedShop(null)}
        activeOpacity={0.7}
      >
        <Text style={styles.backButtonText}>←</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Manage {selectedShop.name}</Text>

      <View style={styles.addProductForm}>
        <Text style={styles.sectionTitle}>Add New Product</Text>
        <TextInput
          placeholder="Product Name"
          value={newProduct.name}
          onChangeText={(text) => setNewProduct({ ...newProduct, name: text })}
          style={styles.input}
        />
        <TextInput
          placeholder="Price (৳)"
          keyboardType="numeric"
          value={newProduct.price}
          onChangeText={(text) => setNewProduct({ ...newProduct, price: text })}
          style={styles.input}
        />
        <TextInput
          placeholder="Image URL (optional)"
          value={newProduct.image}
          onChangeText={(text) => setNewProduct({ ...newProduct, image: text })}
          style={styles.input}
        />
        <Button title="Add Product" onPress={handleAddProduct} />
      </View>

      <Text style={styles.sectionTitle}>Products in {selectedShop.name}</Text>
      <FlatList
        data={products}
        renderItem={({ item }) => (
          <View style={styles.productItem}>
            <Image
              source={{ uri: item.image || "https://via.placeholder.com/150" }}
              style={styles.productImage}
            />
            <View style={styles.productDetails}>
              <Text style={styles.productName}>{item.name}</Text>
              <Text style={styles.productPrice}>৳{item.price}/{item.unit}</Text>
            </View>
          </View>
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
      />
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f9f9f9",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  addProductForm: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#333",
  },
  createShopForm: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#4CAF50",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 12,
    marginBottom: 15,
    borderRadius: 8,
    backgroundColor: "#f7f7f7",
    fontSize: 16,
  },
  shopItem: {
    backgroundColor: "#fff",
    padding: 15,
    marginBottom: 10,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  shopName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  productItem: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 15,
    marginBottom: 10,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productImage: {
    width: 60,
    height: 60,
    marginRight: 15,
    borderRadius: 8,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  productPrice: {
    fontSize: 16,
    color: "#4CAF50",
    marginTop: 5,
  },
  listContent: {
    paddingBottom: 20,
  },
  backButton: {
    position: "absolute",
    top: 60,
    left: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
    color: "#333",
  },
});

export default ShopScreen;