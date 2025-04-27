import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Image, StyleSheet, RefreshControl, Button, Dimensions } from 'react-native';
import { PieChart } from 'react-native-chart-kit'; // Import PieChart
import { productsCol, shopsCol } from './firebaseConfig';
import { onSnapshot, query } from 'firebase/firestore';
import { useAuth } from './AuthContext'; // Import AuthContext to get the logout function

export default function MarketScreen() {
  const { currentUser, logout } = useAuth(); // Get the current farmer's name and logout function
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartData, setChartData] = useState([]); // State for pie chart data
  const [shopDetails, setShopDetails] = useState({}); // Store shop details (name and location)

  useEffect(() => {
    const fetchShopsAndProducts = () => {
      const qShops = query(shopsCol); // Fetch all shops
      const qProducts = query(productsCol); // Fetch all products

      const shopsData = {}; // Initialize shopsData at a higher scope

      const unsubscribeShops = onSnapshot(qShops, (snapshot) => {
        if (snapshot.empty) {
          console.log('No shops found in Firestore.');
          setChartData([]);
          setLoading(false);
          return;
        }

        snapshot.docs.forEach((doc) => {
          shopsData[doc.id] = {
            name: doc.data().name || 'Unknown Shop',
            location: doc.data().location || 'Unknown Location',
          };
        });
        setShopDetails(shopsData); // Update shop details
      });

      const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
        const productsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Group products by shop ID
        const groupedProducts = {};
        productsData.forEach((product) => {
          const shopId = product.shopId;
          if (!groupedProducts[shopId]) {
            groupedProducts[shopId] = 0;
          }
          groupedProducts[shopId] += 1;
        });

        // Prepare data for the pie chart
        const pieData = Object.keys(groupedProducts).map((shopId) => ({
          name: shopsData[shopId]?.name || 'Unknown Shop',
          count: groupedProducts[shopId],
          color: `#${Math.floor(Math.random() * 16777215).toString(16)}`, // Random color
          legendFontColor: '#333',
          legendFontSize: 14,
        }));
        setChartData(pieData);

        setProducts(productsData);
        setLoading(false);
        setRefreshing(false);
      });

      return () => {
        unsubscribeShops();
        unsubscribeProducts();
      };
    };

    fetchShopsAndProducts();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    // The useEffect will handle the refresh automatically
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading data...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={products}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.farmerName}>Welcome, {currentUser?.displayName || 'Farmer'}!</Text>
            <Button title="Logout" onPress={logout} color="#FF6347" />
          </View>

          {/* Pie Chart */}
          <Text style={styles.chartTitle}>Products & shop statistics</Text>
          <PieChart
            data={chartData}
            width={Dimensions.get('window').width - 40} // Full width minus padding
            height={220}
            chartConfig={{
              backgroundColor: '#1cc910',
              backgroundGradientFrom: '#ff9ff3',
              backgroundGradientTo: '#feca57',
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            }}
            accessor="count"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute // Show absolute values
          />

          {/* Section Title */}
          <Text style={styles.sectionTitle}>All Products</Text>
        </>
      }
      renderItem={({ item }) => (
        <View style={styles.productCard}>
          <Image
            source={{ uri: item.image || 'https://via.placeholder.com/150' }}
            style={styles.productImage}
          />
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{item.name}</Text>
            <Text style={styles.productPrice}>৳{item.price}/{item.unit}</Text>
            <Text style={styles.productShop}>
              {shopDetails[item.shopId]?.name || 'Unknown Shop'}, {shopDetails[item.shopId]?.location || 'Unknown Location'}
            </Text>
          </View>
        </View>
      )}
      contentContainerStyle={styles.listContainer}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 60,
    marginBottom: 20,
  },
  farmerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333fef',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  listContainer: {
    paddingBottom: 20,
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginVertical: 20,
    textAlign: 'center',
    color: '#4CAF50',
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 15,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  productPrice: {
    fontSize: 16,
    color: '#4CAF50',
    marginTop: 5,
  },
  productShop: {
    fontSize: 14,
    color: '#777',
    marginTop: 5,
  },
});