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
  ActivityIndicator,
  Modal,
  Pressable
} from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { productsCol, shopsCol } from './firebaseConfig';
import { onSnapshot, query } from 'firebase/firestore';
import { useAuth } from './AuthContext';

// Replace with your actual API key
const WEATHER_API_KEY = 'd734f951c52155a9771143721b7eb908';
const WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5/forecast';

const getWeatherIcon = (condition) => {
  const weatherIcons = {
    '01d': 'weather-sunny',
    '01n': 'weather-night',
    '02d': 'weather-partly-cloudy',
    '02n': 'weather-partly-cloudy',
    '03d': 'weather-cloudy',
    '03n': 'weather-cloudy',
    '04d': 'weather-cloudy',
    '04n': 'weather-cloudy',
    '09d': 'weather-rainy',
    '09n': 'weather-rainy',
    '10d': 'weather-pouring',
    '10n': 'weather-pouring',
    '11d': 'weather-lightning',
    '11n': 'weather-lightning',
    '13d': 'weather-snowy',
    '13n': 'weather-snowy',
    '50d': 'weather-fog',
    '50n': 'weather-fog',
  };
  
  return (
    <MaterialIcons 
      name={weatherIcons[condition] || 'weather-sunny'} 
      size={24} 
      color={condition.includes('n') ? '#6C757D' : '#FFA500'} 
    />
  );
};

const AnimatedProductCard = ({ children, index }) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(50)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 500,
        delay: index * 100,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY }],
      }}
    >
      {children}
    </Animated.View>
  );
};

export default function MarketScreen({ navigation }) {
  const { currentUser } = useAuth();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [shopDetails, setShopDetails] = useState({});
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedType, setSelectedType] = useState('all');
  const [availableTypes, setAvailableTypes] = useState([]);
  const [weatherData, setWeatherData] = useState([]);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const fadeAnim = useState(new Animated.Value(0))[0];

  // Fetch weather data
  // Update the fetchWeatherData function like this:
const fetchWeatherData = async () => {
  try {
    // Replace with your actual location coordinates
    const lat = 23.8103; // Example: Dhaka latitude
    const lon = 90.4125; // Example: Dhaka longitude
    
    const response = await fetch(
      `${WEATHER_API_URL}?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=metric&cnt=40`
    );
    const data = await response.json();
    
    // Process the data to get daily forecasts
    if (data.list) {
      const dailyForecasts = [];
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const seenDays = new Set();
      
      // Get one forecast per day (around noon)
      data.list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const dayName = days[date.getDay()];
        const hour = date.getHours();
        
        // Only take one reading per day (around noon)
        if (hour >= 11 && hour <= 14 && !seenDays.has(dayName)) {
          seenDays.add(dayName);
          dailyForecasts.push({
            day: dayName,
            condition: item.weather[0].icon,
            high: Math.round(item.main.temp_max),
            low: Math.round(item.main.temp_min),
          });
          
          // Stop after we have 5 days
          if (dailyForecasts.length >= 5) return;
        }
      });
      
      setWeatherData(dailyForecasts);
    }
  } catch (error) {
    console.error('Error fetching weather data:', error);
    // Fallback to mock data if API fails
    setWeatherData([
      { day: 'Mon', condition: '01d', high: 32, low: 24 },
      { day: 'Tue', condition: '02d', high: 30, low: 25 },
      { day: 'Wed', condition: '09d', high: 28, low: 23 },
      { day: 'Thu', condition: '03d', high: 27, low: 22 },
      { day: 'Fri', condition: '01d', high: 31, low: 24 },
    ]);
  } finally {
    setWeatherLoading(false);
  }
};

  useEffect(() => {
    fetchWeatherData();
    
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

        // Extract all unique product types
        const types = [...new Set(productsData.map(product => product.type))];
        setAvailableTypes(['all', ...types]);

        // Group products by shop for the pie chart
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
        setFilteredProducts(productsData);
        setLoading(false);
        setRefreshing(false);
        
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
    fetchWeatherData();
    // The Firestore data will refresh automatically through the snapshot listeners
  };

  const applyFilter = (type) => {
    setSelectedType(type);
    if (type === 'all') {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(product => product.type === type);
      setFilteredProducts(filtered);
    }
    setFilterModalVisible(false);
  };

  const renderProductItem = ({ item, index }) => (
    <AnimatedProductCard index={index}>
      <View style={styles.productCard}>
        <View style={styles.productImageContainer}>
          <Image
            source={{ uri: item.image || 'https://via.placeholder.com/150' }}
            style={styles.productImage}
          />
          <View style={styles.productTypeBadge}>
            <Text style={styles.productTypeText}>{item.type}</Text>
          </View>
        </View>
        
        <View style={styles.productContent}>
          <View style={styles.productHeader}>
            <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.productPrice}>৳{item.price}<Text style={styles.productUnit}>/{item.unit}</Text></Text>
          </View>
          
          <View style={styles.productMeta}>
            <View style={styles.shopInfo}>
              <MaterialIcons name="store" size={16} color="#6C757D" />
              <Text style={styles.productShop} numberOfLines={1}>
                {shopDetails[item.shopId]?.name || 'Unknown Shop'}
              </Text>
            </View>

            <View style={styles.locationInfo}>
              <MaterialIcons name="location-on" size={16} color="#6C757D" />
              <Text style={styles.productLocation} numberOfLines={1}>
                {shopDetails[item.shopId]?.location || 'Unknown Location'}
              </Text>
            </View>
          </View>
          
          <View style={styles.productActions}>
            <View style={styles.rating}>
              <MaterialIcons name="star" size={16} color="#FFD700" />
              <Text style={styles.ratingText}>4.5</Text>
            </View>
            <TouchableOpacity style={styles.favoriteButton}>
              <Feather name="heart" size={18} color="#DC3545" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </AnimatedProductCard>
  );

  const renderWeatherItem = ({ item }) => (
    <View style={styles.weatherCard}>
      <Text style={styles.weatherDay}>{item.day}</Text>
      {getWeatherIcon(item.condition)}
      <View style={styles.weatherTemps}>
        <Text style={styles.weatherHigh}>{item.high}°</Text>
        <Text style={styles.weatherLow}>{item.low}°</Text>
      </View>
    </View>
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
      <FlatList
        data={filteredProducts}
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
            {/* Header - Now inside ListHeaderComponent */}
            <View style={styles.header}>
              <View>
                <Text style={styles.welcomeText}>Welcome back,</Text>
                <Text style={styles.farmerName}>{currentUser?.displayName || 'Farmer'}</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setFilterModalVisible(true)}
                style={styles.filterButton}
              >
                <Feather name="filter" size={24} color="#4CAF50" />
              </TouchableOpacity>
            </View>
  
            {/* Weather Forecast */}
            {!weatherLoading && (
              <View style={styles.weatherContainer}>
                <Text style={styles.sectionTitle}>5-Day Forecast</Text>
                <FlatList
                  data={weatherData}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.weatherList}
                  renderItem={renderWeatherItem}
                  keyExtractor={(item, index) => index.toString()}
                />
              </View>
            )}
  
            {/* Statistics Card */}
            <View style={styles.statsCard}>
              <View style={styles.statsHeader}>
                <Text style={styles.statsTitle}>Market Overview</Text>
              </View>
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
              <Text style={styles.productCount}>{filteredProducts.length} items</Text>
            </View>
            <View>
              <Text style={styles.filterIndicator}>
                Showing: {selectedType === 'all' ? 'All Products' : selectedType}
              </Text>
            </View>
          </>
        }
        renderItem={renderProductItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={<View style={styles.footerSpacer} />}
      />
  
      {/* Filter Modal - Rendered outside FlatList to overlay everything */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Filter Products</Text>
            {availableTypes.map((type, index) => (
              <Pressable
                key={index}
                style={[
                  styles.filterOption,
                  selectedType === type && styles.selectedFilterOption
                ]}
                onPress={() => applyFilter(type)}
              >
                <Text style={[
                  styles.filterOptionText,
                  selectedType === type && styles.selectedFilterOptionText
                ]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
                {selectedType === type && (
                  <Feather name="check" size={20} color="#4CAF50" />
                )}
              </Pressable>
            ))}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setFilterModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingTop: 50,
  },
  footerSpacer: {
    height: 80,
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
    color: '#6C757D',
    fontFamily: 'Inter-Medium',
  },
  farmerName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#212529',
    fontFamily: 'Inter-Bold',
  },
  filterButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    fontFamily: 'Inter-SemiBold',
  },
  filterIndicator: {
    fontSize: 14,
    color: '#4CAF50',
    fontFamily: 'Inter-Italic',
    marginLeft: 25,
    marginBottom: 15,
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
    color: '#6C757D',
    fontFamily: 'Inter-Regular',
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
    color: '#212529',
    fontFamily: 'Inter-Bold',
  },
  productCount: {
    fontSize: 14,
    color: '#6C757D',
    fontFamily: 'Inter-Regular',
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  productImageContainer: {
    position: 'relative',
    height: 160,
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  productTypeBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  productTypeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
    textTransform: 'capitalize',
  },
  productContent: {
    padding: 16,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    fontFamily: 'Inter-SemiBold',
    flex: 1,
    marginRight: 8,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    fontFamily: 'Inter-Bold',
  },
  productUnit: {
    fontSize: 14,
    color: '#6C757D',
  },
  productMeta: {
    marginBottom: 16,
  },
  shopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productShop: {
    fontSize: 14,
    color: '#6C757D',
    marginLeft: 6,
    fontFamily: 'Inter-Regular',
    flex: 1,
  },
  productLocation: {
    fontSize: 13,
    color: '#6C757D',
    marginLeft: 6,
    fontFamily: 'Inter-Regular',
    flex: 1,
  },
  productActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  favoriteButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(220, 53, 69, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#212529',
    fontFamily: 'Inter-Bold',
  },
  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
  },
  selectedFilterOption: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
    borderWidth: 1,
  },
  filterOptionText: {
    fontSize: 16,
    color: '#212529',
    fontFamily: 'Inter-Regular',
  },
  selectedFilterOptionText: {
    color: '#4CAF50',
    fontWeight: '500',
    fontFamily: 'Inter-Medium',
  },
  closeButton: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#212529',
    fontWeight: '500',
    fontFamily: 'Inter-Medium',
  },
  weatherContainer: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  weatherList: {
    paddingVertical: 8,
  },
  weatherCard: {
    width: 70,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  weatherDay: {
    fontSize: 14,
    color: '#212529',
    fontFamily: 'Inter-Medium',
    marginBottom: 8,
  },
  weatherTemps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  weatherHigh: {
    fontSize: 14,
    color: '#212529',
    fontFamily: 'Inter-Medium',
  },
  weatherLow: {
    fontSize: 14,
    color: '#6C757D',
    fontFamily: 'Inter-Regular',
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    color: '#6C757D',
    marginLeft: 4,
  }
});