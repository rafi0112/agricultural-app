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
import { MaterialCommunityIcons } from '@expo/vector-icons';

const IMGBB_API_KEY = "ebf4210f4e5360adbcce60890e45a46d"; // Replace with your actual ImgBB API key

const ShopScreen = ({ navigation }: { navigation: any }) => {
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
    stock: "",
  });
  const [editingProduct, setEditingProduct] = useState<{
    id: string;
    name: string;
    price: string;
    image: string;
    unit: string;
    type: string;
    stock: string;
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
    stock: number;
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
          stock: number;
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
    if (!newProduct.name || !newProduct.price || !newProduct.stock) {
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
        stock: parseInt(newProduct.stock),
        shopId: selectedShop.id,
        farmerId: currentUser.uid,
        createdAt: new Date(),
      });
      setNewProduct({ name: "", price: "", image: "", unit: "kg", type: "vegetable", stock: "" });
      Alert.alert("Success", "Product added successfully!");
    } catch (error) {
      console.error("Error adding product:", error);
      Alert.alert("Error", "Failed to add product");
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct || !editingProduct.id || !editingProduct.name || !editingProduct.price || !editingProduct.stock) {
      Alert.alert("Error", "Please fill all required fields");
      return;
    }

    try {
      const productRef = doc(productsCol, editingProduct.id);
      await updateDoc(productRef, {
        name: editingProduct.name,
        price: parseFloat(editingProduct.price),
        stock: parseInt(editingProduct.stock),
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
      stock: product.stock?.toString() || "0",
    });
    setModalVisible(true);
  };

  const handleUpdateLocation = (shopId: string) => {
    navigation.navigate('Map', { 
      shopId: shopId
    });
  };

  const renderShopItem = ({ item }: { item: { id: string; name: string; location?: { latitude: number; longitude: number } } }) => (
    <TouchableOpacity 
      style={styles.shopCard}
      onPress={() => setSelectedShop(item)}
    >
      <View style={styles.shopInfo}>
        <View style={styles.shopIcon}>
          <MaterialIcons name="storefront" size={24} color="#4CAF50" />
        </View>
        <Text style={styles.shopName}>{item.name}</Text>
      </View>
      
      <View style={styles.shopActions}>
        <TouchableOpacity 
          style={styles.locationButton}
          onPress={() => handleUpdateLocation(item.id)}
        >
          <MaterialCommunityIcons name="map-marker" size={20} color="#2196F3" />
          <Text style={styles.locationButtonText}>
            {item.location ? 'Update Location' : 'Set Location'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderProductItem = ({ item }: { item: { 
    id: string; 
    name: string; 
    price: number; 
    image?: string; 
    unit: string;
    type: string;
    stock: number;
  } }) => {
    const stockLevel = item.stock || 0;
    const isLowStock = stockLevel < 10;
    const cardBackgroundStyle = isLowStock 
      ? styles.lowStockCard 
      : styles.normalStockCard;

    return (
      <Animated.View style={[styles.productCard, cardBackgroundStyle, { opacity: fadeAnim }]}>
        <Image
          source={{ uri: item.image || 'https://via.placeholder.com/150' }}
          style={styles.productImage}
        />
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{item.name}</Text>
          <Text style={styles.productPrice}>৳{item.price}/{item.unit}</Text>
          <Text style={styles.productType}>Type: {item.type}</Text>
          <View style={styles.stockContainer}>
            <MaterialIcons 
              name="inventory-2" 
              size={14} 
              color={isLowStock ? "#dc3545" : "#28a745"} 
            />
            <Text style={[
              styles.productStock, 
              { color: isLowStock ? "#dc3545" : "#28a745", fontSize: 12 }
            ]}>
              Stock: {stockLevel}
            </Text>
          </View>
          {isLowStock && (
            <View style={styles.lowStockRow}>
              <Text style={styles.lowStockWarning}>⚠️ Low Stock Alert</Text>
            </View>
          )}
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
  };

  if (loading) {
    return (
      <SafeScreen>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#059669" />
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
              colors={['#059669']}
              tintColor="#059669"
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
                width={Dimensions.get("window").width - 80}
                height={240}
                chartConfig={{
                  backgroundColor: "#FFFFFF",
                  backgroundGradientFrom: "#FFFFFF",
                  backgroundGradientTo: "#FFFFFF",
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(5, 150, 105, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(30, 41, 59, ${opacity})`,
                  propsForDots: {
                    r: "8",
                    strokeWidth: "3",
                    stroke: "#059669",
                    fill: "#059669",
                  },
                  strokeWidth: 3,
                }}
                bezier
                style={{
                  borderRadius: 20,
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
          <Ionicons name="arrow-back" size={24} color="#059669" />
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
            colors={['#059669']}
            tintColor="#059669"
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
            <MaterialIcons name="inventory" size={20} color="#7F7F7F" style={styles.inputIcon} />
            <TextInput
              placeholder="Stock Quantity"
              keyboardType="numeric"
              value={newProduct.stock}
              onChangeText={(text) => setNewProduct({ ...newProduct, stock: text })}
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
            {products.map((product) => {
              // Determine background color based on stock level
              const stockLevel = product.stock || 0;
              const isLowStock = stockLevel < 10;
              const cardBackgroundStyle = isLowStock 
                ? styles.lowStockCard 
                : styles.normalStockCard;

              return (
                <View key={product.id} style={[styles.productCard, cardBackgroundStyle]}>
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
                      <View style={styles.stockContainer}>
                        <MaterialIcons 
                          name="inventory-2" 
                          size={16} 
                          color={isLowStock ? "#dc3545" : "#28a745"} 
                        />
                        <Text style={[
                          styles.productStock, 
                          { color: isLowStock ? "#dc3545" : "#28a745" }
                        ]}>
                          Stock: {stockLevel} units
                        </Text>
                      </View>
                      {isLowStock && (
                        <View style={styles.lowStockRow}>
                          <Text style={styles.lowStockWarning}>⚠️ Low Stock</Text>
                        </View>
                      )}
                      <Text style={styles.productAdded}>Added: {new Date().toLocaleDateString()}</Text>
                    </View>
                  </View>
                  <View style={styles.productActions}>
                    <TouchableOpacity 
                      style={styles.editButton}
                      onPress={() => openEditModal(product)}
                    >
                      <Feather name="edit-3" size={18} color="#3B82F6" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.deleteButton}
                      onPress={() => handleDeleteProduct(product.id)}
                    >
                      <AntDesign name="delete" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
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
              <MaterialIcons name="inventory" size={20} color="#7F7F7F" style={styles.inputIcon} />
              <TextInput
                placeholder="Stock Quantity"
                keyboardType="numeric"
                value={editingProduct?.stock || ''}
                onChangeText={(text) => setEditingProduct({...editingProduct!, stock: text})}
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
    backgroundColor: "#F8FAFC",
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
    borderRadius: 24,
  
  },
  farmerName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E293B",
    flex: 1,
    textAlign: "center",
    fontFamily: "Inter-Bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  loadingText: {
    marginTop: 16,
    color: "#059669",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter-SemiBold",
  },
  createShopCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.1)",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E293B",
    marginHorizontal: 20,
    marginBottom: 16,
    marginTop: 8,
    fontFamily: "Inter-Bold",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 12,
    color: "#64748B",
  },
  input: {
    flex: 1,
    height: 56,
    color: "#1E293B",
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "Inter-Medium",
  },
  picker: {
    flex: 1,
    height: 56,
    color: "#1E293B",
  },
  shopCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 12,
    marginHorizontal: 20,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.08)',
  },
  shopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  shopIcon: {
    marginRight: 16,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    padding: 12,
    borderRadius: 16,
  },
  shopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.2)',
  },
  locationButtonText: {
    color: '#2196F3',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
  },
  addProductCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.1)",
  },
  primaryButton: {
    backgroundColor: "#059669",
    borderRadius: 16,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  uploadButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginLeft: 12,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  uploadButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter-Bold",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter-Bold",
  },
  productCard: {
    flexDirection: "row",
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
  productImage: {
    width: 72,
    height: 72,
    borderRadius: 16,
    marginRight: 20,
    backgroundColor: "#F1F5F9",
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
    fontSize: 17,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 6,
    fontFamily: "Inter-Bold",
  },
  productPrice: {
    fontSize: 18,
    fontWeight: "800",
    color: "#059669",
    fontFamily: "Inter-Bold",
  },
  productType: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 6,
    fontWeight: "600",
    fontFamily: "Inter-SemiBold",
    textTransform: "capitalize",
  },
  productActions: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 16,
    gap: 12,
  },
  editButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  listContent: {
    paddingBottom: 20,
  },
  chartCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 20,
    marginBottom: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.1)",
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 20,
    marginTop: 28,
    fontFamily: "Inter-Bold",
  },
  noDataContainer: {
    alignItems: "center",
    paddingVertical: 48,
  },
  noDataText: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    marginTop: 16,
    fontWeight: "500",
    fontFamily: "Inter-Medium",
    lineHeight: 22,
  },
  noProductsContainer: {
    alignItems: "center",
    paddingVertical: 48,
    marginHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  noProductsText: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    marginTop: 16,
    fontWeight: "500",
    fontFamily: "Inter-Medium",
    lineHeight: 22,
  },
  footerSpacer: {
    height: 100,
  },
  backButton: {
    padding: 12,
    backgroundColor: "rgba(5, 150, 105, 0.1)",
    borderRadius: 16,
  },
  productsContainer: {
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  productUnit: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 4,
    fontWeight: "500",
    fontFamily: "Inter-Medium",
  },
  productMeta: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 4,
  },
  productAdded: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: "500",
    fontFamily: "Inter-Medium",
  },
  // Modal styles
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 24,
    padding: 28,
    width: '90%',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 12
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.1)",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 24,
    textAlign: 'center',
    color: '#1E293B',
    fontFamily: "Inter-Bold",
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  modalButton: {
    borderRadius: 16,
    padding: 16,
    elevation: 4,
    flex: 1,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#EF4444',
  },
  updateButton: {
    backgroundColor: '#059669',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
    fontFamily: "Inter-Bold",
  },
  // Image upload styles
  imagePreviewContainer: {
    position: 'relative',
    marginBottom: 20,
    alignItems: 'center',
  },
  imagePreview: {
    width: 160,
    height: 160,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(5, 150, 105, 0.2)',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  shopName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    fontFamily: "Inter-Bold",
  },
  // Enhanced Stock-related styles
  lowStockCard: {
    backgroundColor: '#FEF2F2', // Light red background for low stock
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  normalStockCard: {
    backgroundColor: '#F0FDF4', // Light green background for normal stock
    borderLeftWidth: 4,
    borderLeftColor: '#059669',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.2)',
  },
  stockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  productStock: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
  },
  lowStockWarning: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '800',
    fontFamily: 'Inter-Bold',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    textAlign: 'center',
  },
  lowStockRow: {
    width: '100%',
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(239, 68, 68, 0.2)',
  },
});

export default ShopScreen;