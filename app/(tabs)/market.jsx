import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  Image, 
  StyleSheet, 
  RefreshControl, 
  TouchableOpacity, 
  Dimensions,
  Animated,
  ActivityIndicator
} from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { productsCol, shopsCol } from './firebaseConfig';
import { onSnapshot, query } from 'firebase/firestore';
import { useAuth } from './AuthContext';

export default function MarketScreen({ navigation }) {
  const { currentUser, logout } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [shopDetails, setShopDetails] = useState({});
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    const fetchShopsAndProducts = () => {
      const qShops = query(shopsCol);
      const qProducts = query(productsCol);
      const shopsData = {};

      const unsubscribeShops = onSnapshot(qShops, (snapshot) => {
        snapshot.docs.forEach((doc) => {
          shopsData[doc.id] = {
            name: doc.data().name || 'Unknown Shop',
            location: doc.data().location || 'Unknown Location',
          };
        });
        setShopDetails(shopsData);
      });

      const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
        const productsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const groupedProducts = {};
        productsData.forEach((product) => {
          const shopId = product.shopId;
          if (!groupedProducts[shopId]) {
            groupedProducts[shopId] = 0;
          }
          groupedProducts[shopId] += 1;
        });

        const pieData = Object.keys(groupedProducts).map((shopId) => ({
          name: shopsData[shopId]?.name || 'Unknown Shop',
          count: groupedProducts[shopId],
          color: getRandomColor(),
          legendFontColor: '#7F7F7F',
          legendFontSize: 12,
        }));
        setChartData(pieData);
        setProducts(productsData);
        setLoading(false);
        setRefreshing(false);
        
        // Fade in animation
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      });

      return () => {
        unsubscribeShops();
        unsubscribeProducts();
      };
    };

    fetchShopsAndProducts();
  }, []);

  const getRandomColor = () => {
    const colors = [
      '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', 
      '#3F51B5', '#009688', '#FF5722', '#607D8B'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const onRefresh = () => {
    setRefreshing(true);
    fadeAnim.setValue(0);
  };

  const renderProductItem = ({ item }) => (
    <Animated.View 
      style={[styles.productCard, { opacity: fadeAnim }]}
    >
      <Image
        source={{ uri: item.image || 'https://via.placeholder.com/150' }}
        style={styles.productImage}
      />
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productPrice}>৳{item.price}/{item.unit}</Text>
        <View style={styles.shopInfo}>
          <MaterialIcons name="store" size={16} color="#7F7F7F" />
          <Text style={styles.productShop}>
            {shopDetails[item.shopId]?.name || 'Unknown Shop'}
          </Text>
        </View>
        <View style={styles.locationInfo}>
          <MaterialIcons name="location-on" size={16} color="#7F7F7F" />
          <Text style={styles.productLocation}>
            {shopDetails[item.shopId]?.location || 'Unknown Location'}
          </Text>
        </View>
      </View>
    </Animated.View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.farmerName}>{currentUser?.displayName || 'Farmer'}</Text>
        </View>
        {/* <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#FF6347" />
        </TouchableOpacity> */}
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
        ListHeaderComponent={
          <>
            {/* Statistics Card */}
            <View style={styles.statsCard}>
              <Text style={styles.statsTitle}>Market Overview</Text>
              <PieChart
                data={chartData}
                width={Dimensions.get('window').width - 40}
                height={200}
                chartConfig={{
                  backgroundColor: '#FFFFFF',
                  backgroundGradientFrom: '#FFFFFF',
                  backgroundGradientTo: '#FFFFFF',
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                }}
                accessor="count"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
                hasLegend={false}
              />
              <View style={styles.legendContainer}>
                {chartData.map((item, index) => (
                  <View key={index} style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: item.color }]} />
                    <Text style={styles.legendText}>{item.name} ({item.count})</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Products Title */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Available Products</Text>
              <Text style={styles.productCount}>{products.length} items</Text>
            </View>
          </>
        }
        renderItem={renderProductItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={<View style={styles.footerSpacer} />} // Add this
      />
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
    paddingTop: 50,
  },
  footerSpacer: {
    height: 80, // Adjust this value based on your navbar height
  },
  listContainer: {
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 14,
    color: '#7F7F7F',
  },
  farmerName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  logoutButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#7F7F7F',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  productCount: {
    fontSize: 14,
    color: '#7F7F7F',
  },
  listContainer: {
    paddingBottom: 24,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 16,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
  },
  shopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productShop: {
    fontSize: 14,
    color: '#7F7F7F',
    marginLeft: 4,
  },
  productLocation: {
    fontSize: 12,
    color: '#7F7F7F',
    marginLeft: 4,
  },
});