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
  Modal,
  Pressable,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { MaterialIcons, Ionicons, Feather, AntDesign } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { db, shopsCol, productsCol } from "./firebaseConfig";
import { doc, addDoc, query, where, onSnapshot, updateDoc, deleteDoc } from "firebase/firestore";
import SafeScreen from "./SafeScreen";
import { useAuth } from "./AuthContext";

const IMGBB_API_KEY = "ebf4210f4e5360adbcce60890e45a46d"; // Replace with your actual ImgBB API key

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
    type: "vegetable",
  });
  const [editingProduct, setEditingProduct] = useState<{
    id: string;
    name: string;
    price: string;
    image: string;
    unit: string;
    type: string;
  } | null>(null);
  const [products, setProducts] = useState<{ 
    id: string; 
    name: string; 
    price: number; 
    image?: string; 
    unit: string;
    type: string;
    shopId: string;
    farmerId: string;
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lineChartData, setLineChartData] = useState({
    labels: ['No shops yet'],
    datasets: [{ data: [0] }],
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  const productTypes = [
    { label: "Vegetable", value: "vegetable" },
    { label: "Fruit", value: "fruit" },
    { label: "Instrument", value: "instrument" },
    { label: "Poultry Product", value: "poultry" },
    { label: "Fish", value: "fish" },
    { label: "Dairy", value: "dairy" },
    { label: "Grain", value: "grain" },
  ];

  // Request gallery permissions
  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'We need gallery permissions to upload images');
      }
    })();
  }, []);

  // Fetch shops and products data
  useEffect(() => {
    if (!currentUser?.uid) return;

    setLoading(true);
    
    const qShops = query(shopsCol, where("farmerId", "==", currentUser.uid));
    const unsubscribeShops = onSnapshot(qShops, async (snapshot) => {
      const shopsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || "Unknown Shop",
        farmerId: doc.data().farmerId,
      }));
      setShops(shopsData);

      if (shopsData.length === 0) {
        setLineChartData({
          labels: ['No shops yet'],
          datasets: [{ data: [0] }],
        });
        setLoading(false);
        return;
      }

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
          type: string;
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
      setNewProduct({ name: "", price: "", image: "", unit: "kg", type: "vegetable" });
      Alert.alert("Success", "Product added successfully!");
    } catch (error) {
      console.error("Error adding product:", error);
      Alert.alert("Error", "Failed to add product");
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct || !editingProduct.id || !editingProduct.name || !editingProduct.price) {
      Alert.alert("Error", "Please fill all required fields");
      return;
    }

    try {
      const productRef = doc(productsCol, editingProduct.id);
      await updateDoc(productRef, {
        name: editingProduct.name,
        price: parseFloat(editingProduct.price),
        image: editingProduct.image,
        unit: editingProduct.unit,
        type: editingProduct.type,
      });
      setModalVisible(false);
      setEditingProduct(null);
      Alert.alert("Success", "Product updated successfully!");
    } catch (error) {
      console.error("Error updating product:", error);
      Alert.alert("Error", "Failed to update product");
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await deleteDoc(doc(productsCol, productId));
      Alert.alert("Success", "Product deleted successfully!");
    } catch (error) {
      console.error("Error deleting product:", error);
      Alert.alert("Error", "Failed to delete product");
    }
  };

  const uploadImage = async (isEditMode = false) => {
    try {
      setUploading(true);
      
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        const filename = uri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : 'image';

        const formData = new FormData();
        formData.append('image', {
          uri,
          name: filename,
          type,
        } as any);

        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        const data = await response.json();
        
        if (data.success) {
          const imageUrl = data.data.url;
          if (isEditMode && editingProduct) {
            setEditingProduct({...editingProduct, image: imageUrl});
          } else {
            setNewProduct({...newProduct, image: imageUrl});
          }
          Alert.alert("Success", "Image uploaded successfully!");
        } else {
          throw new Error(data.error?.message || 'Failed to upload image');
        }
      }
    } catch (error) {
      console.error('Image upload error:', error);
      Alert.alert("Error", "Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const openEditModal = (product: any) => {
    setEditingProduct({
      id: product.id,
      name: product.name,
      price: product.price.toString(),
      image: product.image || "",
      unit: product.unit,
      type: product.type,
    });
    setModalVisible(true);
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
    type: string;
  } }) => (
    <Animated.View style={[styles.productCard, { opacity: fadeAnim }]}>
      <Image
        source={{ uri: item.image || 'https://via.placeholder.com/150' }}
        style={styles.productImage}
      />
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productPrice}>৳{item.price}/{item.unit}</Text>
        <Text style={styles.productType}>Type: {item.type}</Text>
      </View>
      <View style={styles.productActions}>
        <TouchableOpacity onPress={() => openEditModal(item)}>
          <Feather name="edit" size={20} color="#3498db" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDeleteProduct(item.id)}>
          <AntDesign name="delete" size={20} color="#e74c3c" />
        </TouchableOpacity>
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
              placeholder="Image URL"
              value={newProduct.image}
              onChangeText={(text) => setNewProduct({ ...newProduct, image: text })}
              style={styles.input}
              placeholderTextColor="#95a5a6"
              editable={false}
            />
            <TouchableOpacity 
              style={styles.uploadButton} 
              onPress={() => uploadImage(false)}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.uploadButtonText}>Upload</Text>
              )}
            </TouchableOpacity>
          </View>
          {newProduct.image ? (
            <View style={styles.imagePreviewContainer}>
              <Image
                source={{ uri: newProduct.image }}
                style={styles.imagePreview}
              />
              <TouchableOpacity 
                style={styles.removeImageButton}
                onPress={() => setNewProduct({...newProduct, image: ""})}
              >
                <AntDesign name="close" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.inputContainer}>
            <MaterialIcons name="category" size={20} color="#7F7F7F" style={styles.inputIcon} />
            <Picker
              selectedValue={newProduct.type}
              onValueChange={(itemValue) => setNewProduct({...newProduct, type: itemValue})}
              style={styles.picker}
            >
              {productTypes.map((type) => (
                <Picker.Item key={type.value} label={type.label} value={type.value} />
              ))}
            </Picker>
          </View>
          <TouchableOpacity 
            style={styles.primaryButton} 
            onPress={handleAddProduct}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Add Product</Text>
            )}
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
                    <Text style={styles.productType}>Type: {product.type}</Text>
                    <Text style={styles.productAdded}>Added: {new Date().toLocaleDateString()}</Text>
                  </View>
                </View>
                <View style={styles.productActions}>
                  <TouchableOpacity onPress={() => openEditModal(product)}>
                    <Feather name="edit" size={20} color="#3498db" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteProduct(product.id)}>
                    <AntDesign name="delete" size={20} color="#e74c3c" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.noProductsContainer}>
            <MaterialIcons name="inventory" size={40} color="#e0e0e6" />
            <Text style={styles.noProductsText}>No products yet. Add your first product!</Text>
          </View>
        )}
        <View style={styles.footerSpacer} />
      </ScrollView>

      {/* Edit Product Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(!modalVisible);
        }}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Edit Product</Text>
            
            <View style={styles.inputContainer}>
              <Feather name="package" size={20} color="#7F7F7F" style={styles.inputIcon} />
              <TextInput
                placeholder="Product Name"
                value={editingProduct?.name || ''}
                onChangeText={(text) => setEditingProduct({...editingProduct!, name: text})}
                style={styles.input}
                placeholderTextColor="#95a5a6"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <MaterialIcons name="attach-money" size={20} color="#7F7F7F" style={styles.inputIcon} />
              <TextInput
                placeholder="Price (৳)"
                keyboardType="numeric"
                value={editingProduct?.price || ''}
                onChangeText={(text) => setEditingProduct({...editingProduct!, price: text})}
                style={styles.input}
                placeholderTextColor="#95a5a6"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Feather name="image" size={20} color="#7F7F7F" style={styles.inputIcon} />
              <TextInput
                placeholder="Image URL (optional)"
                value={editingProduct?.image || ''}
                onChangeText={(text) => setEditingProduct({...editingProduct!, image: text})}
                style={styles.input}
                placeholderTextColor="#95a5a6"
                editable={false}
              />
              <TouchableOpacity 
                style={styles.uploadButton} 
                onPress={() => uploadImage(true)}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.uploadButtonText}>Upload</Text>
                )}
              </TouchableOpacity>
            </View>
            {editingProduct?.image ? (
              <View style={styles.imagePreviewContainer}>
                <Image
                  source={{ uri: editingProduct.image }}
                  style={styles.imagePreview}
                />
                <TouchableOpacity 
                  style={styles.removeImageButton}
                  onPress={() => setEditingProduct({...editingProduct, image: ""})}
                >
                  <AntDesign name="close" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ) : null}
            
            <View style={styles.inputContainer}>
              <MaterialIcons name="category" size={20} color="#7F7F7F" style={styles.inputIcon} />
              <Picker
                selectedValue={editingProduct?.type || 'vegetable'}
                onValueChange={(itemValue) => setEditingProduct({...editingProduct!, type: itemValue})}
                style={styles.picker}
              >
                {productTypes.map((type) => (
                  <Picker.Item key={type.value} label={type.label} value={type.value} />
                ))}
              </Picker>
            </View>
            
            <View style={styles.modalButtonContainer}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(!modalVisible)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.updateButton]}
                onPress={handleUpdateProduct}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonText}>Update</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  farmerName: {
    fontSize: 18,
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
    marginTop: 16,
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
  picker: {
    flex: 1,
    height: 60,
    color: "#333",
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
    marginTop: 16,
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
  uploadButton: {
    backgroundColor: "#3498db",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 8,
  },
  uploadButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
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
  productDetails: {
    flex: 1,
    justifyContent: 'center',
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
  productType: {
    fontSize: 14,
    color: "#7F7F7F",
    marginTop: 4,
    fontWeight: "bold"
  },
  productActions: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 10,
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
    height: 80,
  },
  backButton: {
    padding: 8,
  },
  productsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
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
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  productAdded: {
    fontSize: 12,
    color: '#95a5a6',
  },
  // Modal styles
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 25,
    width: '90%',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    borderRadius: 10,
    padding: 12,
    elevation: 2,
    width: '48%',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#e74c3c',
  },
  updateButton: {
    backgroundColor: '#4CAF50',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // Image upload styles
  imagePreviewContainer: {
    position: 'relative',
    marginBottom: 16,
    alignItems: 'center',
  },
  imagePreview: {
    width: 150,
    height: 150,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ShopScreen;