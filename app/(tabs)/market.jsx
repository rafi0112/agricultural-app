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
  Pressable,
  PanResponder,
  Alert,
  Platform,
  ScrollView
} from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { productsCol, shopsCol } from './firebaseConfig';
import { onSnapshot, query } from 'firebase/firestore';
import { useAuth } from './AuthContext';

// Replace with your actual API key
const WEATHER_API_KEY = 'd734f951c52155a9771143721b7eb908';
const WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5/forecast';

// Gradient Text Component for true gradient text color
const GradientText = ({ children, style, colors = ['#059669', '#10B981', '#34D399'] }) => {
  return (
    <MaskedView
      style={{ flexDirection: 'row' }}
      maskElement={
        <Text style={[style, { backgroundColor: 'transparent' }]}>
          {children}
        </Text>
      }
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1 }}
      >
        <Text style={[style, { opacity: 0 }]}>
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
};

const getWeatherIcon = (condition) => {
  const getEmojiByCondition = (cond) => {
    // Manual weather emoji mapping
    if (cond.includes('01d') || cond.includes('clear') || cond.includes('sunny')) {
      return '☀️'; // Sunny
    } else if (cond.includes('01n') || cond.includes('night')) {
      return '🌙'; // Night/Moon
    } else if (cond.includes('02') || cond.includes('03') || cond.includes('04') || cond.includes('cloud')) {
      return '☁️'; // Cloudy
    } else if (cond.includes('09') || cond.includes('10') || cond.includes('rain')) {
      return '🌧️'; // Rainy
    } else if (cond.includes('11') || cond.includes('thunder') || cond.includes('storm')) {
      return '⛈️'; // Thunder/Storm
    } else if (cond.includes('13') || cond.includes('snow')) {
      return '❄️'; // Snow
    } else if (cond.includes('50') || cond.includes('mist') || cond.includes('fog')) {
      return '🌫️'; // Mist/Fog
    } else {
      return '☀️'; // Default to sunny
    }
  };
  
  const emoji = getEmojiByCondition(condition);
  
  return (
    <View style={styles.weatherIconContainer}>
      <Text style={styles.weatherEmoji}>
        {emoji}
      </Text>
    </View>
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
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'
  const [shops, setShops] = useState([]);
  const [allShops, setAllShops] = useState([]); // Store all shops before filtering
  const [selectedShop, setSelectedShop] = useState(null);
  const [mapRef, setMapRef] = useState(null);
  const [mapRatio, setMapRatio] = useState(0.65); // Adjusted for mobile - map takes 65% of screen
  const [userLocation, setUserLocation] = useState(null);
  const [nearbyDistance, setNearbyDistance] = useState(50); // Default 50km
  const [distanceModalVisible, setDistanceModalVisible] = useState(false);
  const [locationPermission, setLocationPermission] = useState(null);
  const [expandedShops, setExpandedShops] = useState(new Set()); // Track which shops are expanded
  const [shopProducts, setShopProducts] = useState({}); // Store products for each shop
  const [lastTap, setLastTap] = useState(null); // For double-tap detection
  const [productsModalVisible, setProductsModalVisible] = useState(false); // Products modal
  const [selectedShopForProducts, setSelectedShopForProducts] = useState(null); // Shop for products modal
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
    requestLocationPermission();
    
    const fetchShopsAndProducts = () => {
      const qShops = query(shopsCol);
      const qProducts = query(productsCol);
      const shopsData = {};

      const unsubscribeShops = onSnapshot(qShops, (snapshot) => {
        const shopsArray = [];
        snapshot.docs.forEach((doc) => {
          const shopData = {
            id: doc.id,
            name: doc.data().name || 'Unknown Shop',
            location: doc.data().location || null,
            farmerId: doc.data().farmerId || null,
          };
          
          shopsData[doc.id] = {
            name: shopData.name,
            location: shopData.location,
          };
          
          // Only add shops with valid location data to the shops array
          if (shopData.location && 
              shopData.location.latitude && 
              shopData.location.longitude) {
            shopsArray.push(shopData);
          }
        });
        setShopDetails(shopsData);
        setAllShops(shopsArray); // Store all shops
        
        // Apply distance filtering
        const filteredShops = filterShopsByDistance(shopsArray);
        setShops(filteredShops);
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

        // Group products by farmerId for shop matching
        const productsByFarmer = {};
        productsData.forEach((product) => {
          const farmerId = product.farmerId;
          if (farmerId) {
            if (!productsByFarmer[farmerId]) {
              productsByFarmer[farmerId] = [];
            }
            productsByFarmer[farmerId].push(product);
          }
        });
        setShopProducts(productsByFarmer);

        const pieData = Object.keys(groupedProducts).map((shopId) => ({
          name: shopsData[shopId]?.name || 'Unknown Shop',
          count: groupedProducts[shopId],
          color: getRandomColor(),
          legendFontColor: '#7F7F7F',
          legendFontSize: 12,
        }));
        
        // Sort products by likes (descending order - most liked first)
        const sortedProducts = productsData.sort((a, b) => {
          const likesA = a.likes || 0;
          const likesB = b.likes || 0;
          return likesB - likesA;
        });
        
        setChartData(pieData);
        setProducts(sortedProducts);
        setFilteredProducts(sortedProducts);
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

  // Request location permission and get user location
  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const userLoc = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setUserLocation(userLoc);
        
        // Center map on user location if in map view
        if (mapRef && viewMode === 'map') {
          setTimeout(() => {
            mapRef.animateToRegion({
              latitude: userLoc.latitude,
              longitude: userLoc.longitude,
              latitudeDelta: 0.1,
              longitudeDelta: 0.1,
            }, 1500);
          }, 1000);
        }
      } else {
        Alert.alert(
          'Location Permission',
          'Location permission is required to show nearby shops. You can still view all shops without filtering.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      Alert.alert('Error', 'Unable to get location permission');
    }
  };

  // Re-filter shops when user location or distance changes
  useEffect(() => {
    if (allShops.length > 0) {
      const filteredShops = filterShopsByDistance(allShops);
      setShops(filteredShops);
    }
  }, [userLocation, nearbyDistance, allShops]);

  // Helper function for mobile haptic feedback
  const provideMobileFeedback = () => {
    if (Platform.OS === 'ios') {
      // For iOS, you could use Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      // but keeping it simple for now
    }
    // Could add vibration for Android if needed
  };

  const getRandomColor = () => {
    const colors = [
      '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', 
      '#3F51B5', '#009688', '#FF5722', '#607D8B'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // Calculate distance between two coordinates in kilometers
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance;
  };

  // Filter shops based on distance from user location
  const filterShopsByDistance = (allShopsArray) => {
    if (!userLocation || nearbyDistance === null) {
      return allShopsArray;
    }

    return allShopsArray.filter(shop => {
      if (!shop.location || !shop.location.latitude || !shop.location.longitude) {
        return false;
      }

      const lat = typeof shop.location.latitude === 'string' 
        ? parseFloat(shop.location.latitude) 
        : shop.location.latitude;
      const lng = typeof shop.location.longitude === 'string' 
        ? parseFloat(shop.location.longitude) 
        : shop.location.longitude;

      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        lat,
        lng
      );

      return distance <= nearbyDistance;
    });
  };

  const onRefresh = () => {
    setRefreshing(true);
    fadeAnim.setValue(0);
    fetchWeatherData();
    // The Firestore data will refresh automatically through the snapshot listeners
  };

  const applyFilter = (type) => {
    setSelectedType(type);
    
    let filteredProducts;
    if (type === 'all') {
      filteredProducts = products;
    } else {
      filteredProducts = products.filter(product => product.type === type);
    }
    
    // Sort filtered products by likes (descending order - most liked first)
    const sortedFilteredProducts = filteredProducts.sort((a, b) => {
      const likesA = a.likes || 0;
      const likesB = b.likes || 0;
      return likesB - likesA;
    });
    
    setFilteredProducts(sortedFilteredProducts);
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
                {shopDetails[item.shopId]?.location &&
                typeof shopDetails[item.shopId].location.latitude === 'number' &&
                typeof shopDetails[item.shopId].location.longitude === 'number'
                  ? `${shopDetails[item.shopId].location.latitude.toFixed(6)}, ${shopDetails[item.shopId].location.longitude.toFixed(6)}`
                  : 'Location not available'}
              </Text>
            </View>
          </View>
          
          <View style={styles.productActions}>
            <View style={styles.rating}>
              <MaterialIcons name="star" size={16} color="#FFD700" />
              <Text style={styles.ratingText}>4.5</Text>
            </View>
            <View style={styles.likesContainer}>
              <Feather name="heart" size={16} color="#DC3545" />
              <Text style={styles.likesText}>{item.likes || 0}</Text>
            </View>
            {/* <TouchableOpacity style={styles.favoriteButton}>
              <Feather name="heart" size={18} color="#DC3545" />
            </TouchableOpacity> */}
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

  const focusOnShop = (shop) => {
    const lat = typeof shop.location.latitude === 'string' 
      ? parseFloat(shop.location.latitude) 
      : shop.location.latitude;
    const lng = typeof shop.location.longitude === 'string' 
      ? parseFloat(shop.location.longitude) 
      : shop.location.longitude;

    setSelectedShop(shop);
    if (mapRef) {
      mapRef.animateToRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  };

  // Toggle shop expansion - now opens modal instead
  const toggleShopExpansion = (shopId) => {
    const shop = shops.find(s => s.id === shopId);
    if (shop) {
      setSelectedShopForProducts(shop);
      setProductsModalVisible(true);
    }
  };

  // Get products for a specific shop by farmerId - all products for modal
  const getAllShopProducts = (shop) => {
    if (!shop.farmerId || !shopProducts[shop.farmerId]) {
      return [];
    }
    return shopProducts[shop.farmerId]; // Return all products for modal
  };

  // Get products for a specific shop by farmerId
  const getShopProducts = (shop) => {
    if (!shop.farmerId || !shopProducts[shop.farmerId]) {
      return [];
    }
    return shopProducts[shop.farmerId].slice(0, 3); // Show max 3 products initially
  };

  // Render individual product item in shop
  const renderShopProductItem = (product) => (
    <View key={product.id} style={styles.shopProductItem}>
      <View style={styles.shopProductInfo}>
        <View style={styles.shopProductHeader}>
          <Text style={styles.shopProductName} numberOfLines={1}>
            {product.name}
          </Text>
          <Text style={styles.shopProductPrice}>
            ৳{product.price}
            <Text style={styles.shopProductUnit}>/{product.unit}</Text>
          </Text>
        </View>
        <View style={styles.shopProductMeta}>
          <View style={styles.shopProductType}>
            <MaterialIcons name="category" size={12} color="#6C757D" />
            <Text style={styles.shopProductTypeText}>{product.type}</Text>
          </View>
          {product.image && (
            <View style={styles.shopProductImageContainer}>
              <Image 
                source={{ uri: product.image }} 
                style={styles.shopProductImage}
                resizeMode="cover"
              />
            </View>
          )}
        </View>
      </View>
    </View>
  );

  const renderShopListItem = ({ item }) => {
    const lat = typeof item.location.latitude === 'string' 
      ? parseFloat(item.location.latitude) 
      : item.location.latitude;
    const lng = typeof item.location.longitude === 'string' 
      ? parseFloat(item.location.longitude) 
      : item.location.longitude;

    const isSelected = selectedShop?.id === item.id;

    // Calculate distance if user location is available
    const distance = userLocation ? 
      calculateDistance(userLocation.latitude, userLocation.longitude, lat, lng) : null;

    return (
      <View style={[
        styles.shopListItem,
        isSelected && styles.selectedShopItem
      ]}>
        <TouchableOpacity 
          style={styles.shopInfoTouchable}
          onPress={() => setSelectedShop(item)}
          activeOpacity={0.7}
        >
          <View style={styles.shopInfo}>
            <View style={[
              styles.shopIcon,
              isSelected && styles.selectedShopIcon
            ]}>
              <MaterialIcons 
                name="store" 
                size={20} 
                color={isSelected ? "#FFFFFF" : "#4CAF50"} 
              />
            </View>
            <View style={styles.shopDetails}>
              <Text style={styles.shopName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.shopLocation} numberOfLines={1}>
                📍 {lat.toFixed(4)}, {lng.toFixed(4)}
              </Text>
              {distance !== null && (
                <Text style={styles.shopDistance}>
                  📏 {distance.toFixed(1)} km away
                </Text>
              )}
              <Text style={styles.shopId} numberOfLines={1}>ID: {item.id}</Text>
            </View>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.viewOnMapButton,
            isSelected && styles.selectedFocusButton
          ]}
          onPress={() => focusOnShop(item)}
          activeOpacity={0.8}
        >
          <View style={styles.focusButtonContent}>
            <MaterialIcons 
              name="my-location" 
              size={18} 
              color="#FFFFFF" 
            />
            <Text style={styles.viewOnMapText}>Focus</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderMapView = () => {
    const screenHeight = Dimensions.get('window').height;
    const screenWidth = Dimensions.get('window').width;
    
    // Create enhanced PanResponder for flexible drag to resize functionality
    const panResponder = PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dy) > 3; // More sensitive
      },
      onPanResponderGrant: () => {
        // Provide haptic feedback when drag starts
        provideMobileFeedback();
      },
      onPanResponderMove: (evt, gestureState) => {
        // Real-time smooth feedback during drag
        const { dy } = gestureState;
        const headerHeight = 100;
        const availableHeight = screenHeight - headerHeight;
        
        const currentMapHeight = availableHeight * mapRatio;
        const newMapHeight = Math.max(
          availableHeight * 0.15, // Minimum 15% for shops panel
          Math.min(
            availableHeight * 0.95, // Maximum 95% for map (near full screen)
            currentMapHeight - dy * 0.8 // Smooth multiplier for better control
          )
        );
        
        const newRatio = newMapHeight / availableHeight;
        // Update in real-time for smoother experience
        setMapRatio(newRatio);
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dy, vy } = gestureState; // vy is velocity
        const headerHeight = 100;
        const availableHeight = screenHeight - headerHeight;
        
        // Calculate new ratio based on drag with improved smoothness
        const currentMapHeight = availableHeight * mapRatio;
        let newMapHeight = currentMapHeight - dy * 0.8;
        
        // Add velocity-based snap for better UX with smoother thresholds
        if (Math.abs(vy) > 0.3) {
          if (vy < 0) {
            // Fast upward swipe - expand map
            newMapHeight = availableHeight * 0.85;
          } else {
            // Fast downward swipe - show more shops
            newMapHeight = availableHeight * 0.45;
          }
        }
        
        // Apply constraints with smoother transitions
        newMapHeight = Math.max(
          availableHeight * 0.15, // Minimum 15% - almost full shops view
          Math.min(
            availableHeight * 0.95, // Maximum 95% - almost full map view
            newMapHeight
          )
        );
        
        const newRatio = newMapHeight / availableHeight;
        setMapRatio(newRatio);
        
        // Provide feedback on release
        provideMobileFeedback();
      },
    });
    
    // Calculate current heights
    const headerHeight = 100;
    const availableHeight = screenHeight - headerHeight;
    const mapHeight = availableHeight * mapRatio;
    const shopsHeight = availableHeight * (1 - mapRatio);
    
    return (
      <View style={styles.mapContainer}>
        {/* Map Section - Flexible Height */}
        <View style={[
          styles.mapSection, 
          { 
            height: mapHeight,
            maxHeight: availableHeight * 0.95 
          }
        ]}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => {
              const now = Date.now();
              const DOUBLE_PRESS_DELAY = 300;
              if (lastTap && (now - lastTap) < DOUBLE_PRESS_DELAY) {
                // Double tap detected - toggle between full map and balanced view
                const newRatio = mapRatio > 0.8 ? 0.65 : 0.9;
                setMapRatio(newRatio);
                provideMobileFeedback();
              } else {
                setLastTap(now);
              }
            }}
          >
            <MapView
              ref={setMapRef}
              style={styles.map}
              initialRegion={{
                latitude: userLocation?.latitude || 23.8103,
                longitude: userLocation?.longitude || 90.4125,
                latitudeDelta: 0.5,
                longitudeDelta: 0.5,
              }}
              showsUserLocation={true}
              showsMyLocationButton={true}
            >
            {/* Show range circle if user location is available */}
            {userLocation && locationPermission && (
              <Circle
                center={{
                  latitude: userLocation.latitude,
                  longitude: userLocation.longitude,
                }}
                radius={nearbyDistance * 1000}
                strokeColor="rgba(5, 150, 105, 0.6)"
                fillColor="rgba(5, 150, 105, 0.1)"
                strokeWidth={3}
              />
            )}
            
            {shops.map((shop) => {
              const lat = typeof shop.location.latitude === 'string' 
                ? parseFloat(shop.location.latitude) 
                : shop.location.latitude;
              const lng = typeof shop.location.longitude === 'string' 
                ? parseFloat(shop.location.longitude) 
                : shop.location.longitude;

              const isSelected = selectedShop?.id === shop.id;
              const distance = userLocation ? 
                calculateDistance(userLocation.latitude, userLocation.longitude, lat, lng) : null;

              return (
                <Marker
                  key={shop.id}
                  coordinate={{
                    latitude: lat,
                    longitude: lng,
                  }}
                  title={shop.name}
                  description={distance !== null ? 
                    `📍 ${lat.toFixed(4)}, ${lng.toFixed(4)} (${distance.toFixed(1)} km away)` :
                    `📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}`
                  }
                  onPress={() => setSelectedShop(shop)}
                >
                  <View style={[
                    styles.customMarker,
                    isSelected && styles.selectedMarker
                  ]}>
                    <MaterialIcons 
                      name="store" 
                      size={isSelected ? 28 : 24} 
                      color={isSelected ? "#FFFFFF" : "#059669"} 
                    />
                  </View>
                </Marker>
              );              })}
            </MapView>
          </TouchableOpacity>
        </View>
        
        {/* Enhanced Draggable Resizer with Visual Feedback */}
        <View 
          style={styles.flexibleResizeHandle}
          {...panResponder.panHandlers}
        >
          {/* Visual drag indicator */}
          <View style={styles.dragIndicatorContainer}>
            <View style={styles.dragIndicator} />
            <Text style={styles.dragHintText}>
              {mapRatio > 0.8 ? 'Drag down for shops' : mapRatio < 0.3 ? 'Drag up for map' : 'Drag to resize • Double-tap map for full view'}
            </Text>
          </View>
          
          {/* Quick resize buttons */}
          <View style={styles.quickResizeButtons}>
            <TouchableOpacity 
              style={[styles.quickResizeButton, mapRatio < 0.4 && styles.activeResizeButton]}
              onPress={() => {
                setMapRatio(0.3); // Shops focus
                provideMobileFeedback();
              }}
            >
              <MaterialIcons name="store" size={16} color={mapRatio < 0.4 ? "#FFFFFF" : "#059669"} />
              <Text style={[styles.quickResizeText, mapRatio < 0.4 && styles.activeResizeText]}>
                Shops
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.quickResizeButton, mapRatio > 0.6 && mapRatio < 0.8 && styles.activeResizeButton]}
              onPress={() => {
                setMapRatio(0.65); // Balanced
                provideMobileFeedback();
              }}
            >
              <MaterialIcons name="apps" size={16} color={mapRatio > 0.6 && mapRatio < 0.8 ? "#FFFFFF" : "#059669"} />
              <Text style={[styles.quickResizeText, mapRatio > 0.6 && mapRatio < 0.8 && styles.activeResizeText]}>
                Split
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.quickResizeButton, mapRatio > 0.8 && styles.activeResizeButton]}
              onPress={() => {
                setMapRatio(0.9); // Map focus
                provideMobileFeedback();
              }}
            >
              <MaterialIcons name="map" size={16} color={mapRatio > 0.8 ? "#FFFFFF" : "#059669"} />
              <Text style={[styles.quickResizeText, mapRatio > 0.8 && styles.activeResizeText]}>
                Map
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Flexible Nearby Shops Panel */}
        <View style={[
          styles.flexibleNearbyShopsPanel, 
          { 
            height: shopsHeight,
            minHeight: availableHeight * 0.05, // Minimum height when map is maximized
            maxHeight: availableHeight * 0.85
          }
        ]}>
          {/* Conditional Header - Hide when panel is too small */}
          {shopsHeight > 80 && (
            <View style={styles.nearbyShopsPanelHeader}>
              <View style={styles.panelHeaderContent}>
                <Text style={[
                  styles.nearbyShopsTitle,
                  { fontSize: shopsHeight < 150 ? 14 : 16 } // Responsive font size
                ]}>
                  {userLocation && locationPermission ? 
                    `Nearby Shops (${shops.length})` : 
                    `All Shops (${shops.length})`
                  }
                </Text>
                {shopsHeight > 120 && (
                  <Text style={styles.nearbyShopsSubtitle}>
                    {mapRatio > 0.85 ? 'Drag up for details' : 'Tap to view products • Swipe to explore'}
                  </Text>
                )}
              </View>
              {selectedShop && shopsHeight > 100 && (
                <TouchableOpacity 
                  onPress={() => setSelectedShop(null)}
                  style={styles.clearSelectionButtonMobile}
                >
                  <MaterialIcons name="clear" size={18} color="#4CAF50" />
                </TouchableOpacity>
              )}
            </View>
          )}
          
          {/* Adaptive Shops List */}
          {shopsHeight > 60 && (
            <FlatList
              data={shops}
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              snapToInterval={screenWidth * 0.8 + 12}
              decelerationRate="fast"
              bounces={true}
              bouncesZoom={false}
              renderItem={({ item }) => {
                const shopProductList = getShopProducts(item);
                const allShopProducts = (item.farmerId && shopProducts[item.farmerId]) ? shopProducts[item.farmerId] : [];
                const hasProducts = allShopProducts.length > 0;
                
                const lat = typeof item.location.latitude === 'string' 
                  ? parseFloat(item.location.latitude) 
                  : item.location.latitude;
                const lng = typeof item.location.longitude === 'string' 
                  ? parseFloat(item.location.longitude) 
                  : item.location.longitude;
                
                const isSelected = selectedShop?.id === item.id;
                const distance = userLocation ? 
                  calculateDistance(userLocation.latitude, userLocation.longitude, lat, lng) : null;

                // Adaptive card height based on available space
                const isCompactMode = shopsHeight < 150;

                return (
                  <View style={[
                    isCompactMode ? styles.nearbyShopCardCompact : styles.nearbyShopCardMobile,
                    isSelected && styles.selectedShopCardMobile,
                    expandedShops.has(item.id) && styles.expandedShopCardMobile,
                    { 
                      width: screenWidth * (isCompactMode ? 0.85 : 0.8),
                      maxHeight: shopsHeight - (shopsHeight > 80 ? 60 : 20) // Account for header
                    }
                  ]}>
                    <TouchableOpacity 
                      style={[
                        styles.shopCardHeaderMobile,
                        { padding: isCompactMode ? 8 : 12 }
                      ]}
                      onPress={() => {
                        provideMobileFeedback();
                        setSelectedShop(item);
                        focusOnShop(item);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.shopCardTopRow}>
                        <View style={[
                          styles.shopCardIconMobile,
                          isSelected && styles.selectedShopIconMobile,
                          { padding: isCompactMode ? 4 : 6 }
                        ]}>
                          <MaterialIcons 
                            name="store" 
                            size={isCompactMode ? 14 : 16} 
                            color={isSelected ? "#FFFFFF" : "#059669"} 
                          />
                        </View>
                        <View style={styles.shopCardMainInfo}>
                          <Text style={[
                            styles.shopCardNameMobile,
                            { fontSize: isCompactMode ? 12 : 14 }
                          ]} numberOfLines={1}>
                            {item.name}
                          </Text>
                          {!isCompactMode && (
                            <View style={styles.shopCardMetaRow}>
                              {distance !== null && (
                                <Text style={styles.shopCardDistanceMobile}>
                                  📍 {distance.toFixed(1)}km
                                </Text>
                              )}
                              <Text style={styles.shopCardProductCountMobile}>
                                {hasProducts ? 
                                  `${allShopProducts.length} items • ` : 
                                  'No items'}
                              </Text>
                            </View>
                          )}
                          {isCompactMode && distance !== null && (
                            <Text style={[styles.shopCardDistanceMobile, { fontSize: 10 }]}>
                              📍 {distance.toFixed(1)}km • {hasProducts ? 
                                `${allShopProducts.length} items • Tap arrow` : 
                                'No items'}
                            </Text>
                          )}
                        </View>
                        {hasProducts && !isCompactMode && (
                          <TouchableOpacity 
                            style={styles.expandIndicatorMobile}
                            onPress={(e) => {
                              e.stopPropagation(); // Prevent parent onPress
                              provideMobileFeedback();
                              toggleShopExpansion(item.id);
                            }}
                            activeOpacity={0.6}
                          >
                            <MaterialIcons 
                              name="expand-more"
                              size={18} 
                              color="#059669" 
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              }}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[
                styles.nearbyShopsHorizontalListMobile,
                { paddingVertical: shopsHeight < 100 ? 4 : 8 }
              ]}
              ListEmptyComponent={
                shopsHeight > 100 ? (
                  <View style={styles.emptyStateHorizontalMobile}>
                    <MaterialIcons name="store" size={28} color="#ADB5BD" />
                    <Text style={styles.emptyStateTextHorizontalMobile}>
                      {userLocation && locationPermission ? 
                        `No shops within ${nearbyDistance}km` : 
                        'No shops found'
                      }
                    </Text>
                    {userLocation && locationPermission && (
                      <TouchableOpacity
                        style={styles.increaseRangeButtonMobile}
                        onPress={() => {
                          setNearbyDistance(Math.min(200, nearbyDistance + 25));
                        }}
                      >
                        <Text style={styles.increaseRangeButtonTextMobile}>
                          Increase range
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : null
              }
            />
          )}
          
          {/* Minimal view when panel is very small */}
          {shopsHeight <= 60 && shops.length > 0 && (
            <View style={styles.minimalShopsView}>
              <Text style={styles.minimalShopsText}>
                {shops.length} shops nearby • Drag up to explore
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {viewMode === 'map' ? (
        // Map View
        <View style={styles.mapViewContainer}>
          {/* Enhanced Header for Map View */}
          <View style={styles.mapHeader}>
            <View style={styles.mapHeaderContent}>
              <View style={styles.mapHeaderTextContainer}>
                <GradientText style={styles.mapFarmerNameGradient}>Find shops near you</GradientText>
              </View>
              <View style={styles.mapHeaderActions}>
                <TouchableOpacity 
                  onPress={() => setDistanceModalVisible(true)}
                  style={styles.mapDistanceButton}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="location-on" size={18} color="#FFFFFF" />
                  <Text style={styles.mapDistanceButtonText}>{nearbyDistance}km</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => setViewMode('list')}
                  style={styles.mapViewToggleButton}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="view-list" size={20} color="#FFFFFF" />
                  <Text style={styles.mapToggleButtonText}>List</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          {renderMapView()}
        </View>
      ) : (
        // List View
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              colors={['#059669']}
              tintColor="#059669"
            />
          }
          ListHeaderComponent={
            <>
              {/* Enhanced Header - Now inside ListHeaderComponent */}
              <View style={styles.header}>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.welcomeText}>Welcome back,</Text>
                  <GradientText style={styles.farmerNameGradient}>{currentUser?.displayName || 'Farmer'}</GradientText>
                </View>
                <View style={styles.headerActions}>
                  <TouchableOpacity 
                    onPress={() => setViewMode('map')}
                    style={[styles.viewToggleButton, { marginRight: 8 }]}
                  >
                    <MaterialIcons name="map" size={24} color="#059669" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setFilterModalVisible(true)}
                    style={styles.filterButton}
                  >
                    <Feather name="filter" size={24} color="#059669" />
                  </TouchableOpacity>
                </View>
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
      )}
  
      {/* Filter Modal - Rendered outside to overlay everything */}
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
                  <Feather name="check" size={20} color="#059669" />
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

      {/* Distance Filter Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={distanceModalVisible}
        onRequestClose={() => setDistanceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Set Nearby Distance</Text>
            
            {!locationPermission && (
              <View style={styles.locationWarning}>
                <MaterialIcons name="location-off" size={24} color="#FF9800" />
                <Text style={styles.locationWarningText}>
                  Location permission is required to filter by distance
                </Text>
                <TouchableOpacity
                  style={styles.enableLocationButton}
                  onPress={requestLocationPermission}
                >
                  <Text style={styles.enableLocationButtonText}>Enable Location</Text>
                </TouchableOpacity>
              </View>
            )}
            
            <View style={styles.distanceContainer}>
              <Text style={styles.distanceLabel}>
                Show shops within: {nearbyDistance} km
              </Text>
              
              <View style={styles.distanceAdjuster}>
                <TouchableOpacity
                  style={styles.adjustButton}
                  onPress={() => setNearbyDistance(Math.max(1, nearbyDistance - 5))}
                >
                  <MaterialIcons name="remove" size={20} color="#059669" />
                </TouchableOpacity>
                
                <View style={styles.distanceDisplay}>
                  <Text style={styles.distanceValue}>{nearbyDistance} km</Text>
                </View>
                
                <TouchableOpacity
                  style={styles.adjustButton}
                  onPress={() => setNearbyDistance(Math.min(200, nearbyDistance + 5))}
                >
                  <MaterialIcons name="add" size={20} color="#059669" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.distancePresets}>
                <Text style={styles.presetsLabel}>Quick select:</Text>
                <View style={styles.presetButtons}>
                  {[5, 10, 25, 50, 100].map(distance => (
                    <TouchableOpacity
                      key={distance}
                      style={[
                        styles.presetButton,
                        nearbyDistance === distance && styles.selectedPresetButton
                      ]}
                      onPress={() => setNearbyDistance(distance)}
                    >
                      <Text style={[
                        styles.presetButtonText,
                        nearbyDistance === distance && styles.selectedPresetButtonText
                      ]}>
                        {distance}km
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              {userLocation && locationPermission && (
                <Text style={styles.locationStatus}>
                  📍 Your location: {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
                </Text>
              )}
              
              <Text style={styles.shopCountText}>
                {shops.length} shops found within {nearbyDistance} km
              </Text>
            </View>
            
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setDistanceModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Products Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={productsModalVisible}
        onRequestClose={() => setProductsModalVisible(false)}
      >
        <View style={styles.productsModalOverlay}>
          <View style={styles.productsModalView}>
            <View style={styles.productsModalHeader}>
              <View style={styles.productsModalTitleContainer}>
                <MaterialIcons name="store" size={24} color="#059669" />
                <Text style={styles.productsModalTitle}>
                  {selectedShopForProducts?.name || 'Shop Products'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.productsModalCloseButton}
                onPress={() => setProductsModalVisible(false)}
              >
                <MaterialIcons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.productsModalScroll}
              contentContainerStyle={styles.productsModalContent}
              showsVerticalScrollIndicator={true}
              bounces={true}
            >
              {selectedShopForProducts && getAllShopProducts(selectedShopForProducts).length > 0 ? (
                <View style={styles.productsModalList}>
                  {getAllShopProducts(selectedShopForProducts).map((product, index) => (
                    <View key={product.id || `product-${index}`} style={styles.productsModalItem}>
                      <View style={styles.productsModalItemContent}>
                        <View style={styles.productsModalItemInfo}>
                          <Text style={styles.productsModalItemName} numberOfLines={2}>
                            {product.name || 'Product Name'}
                          </Text>
                          <Text style={styles.productsModalItemPrice}>
                            ৳{product.price || '0'}
                            <Text style={styles.productsModalItemUnit}>/{product.unit || 'piece'}</Text>
                          </Text>
                          <View style={styles.productsModalItemMeta}>
                            <View style={styles.productsModalItemRating}>
                              <MaterialIcons name="star" size={14} color="#FFD700" />
                              <Text style={styles.productsModalItemRatingText}>4.5</Text>
                            </View>
                            <Text style={styles.productsModalItemStock}>• Available</Text>
                          </View>
                        </View>
                        <View style={styles.productsModalItemBadge}>
                          <Text style={styles.productsModalItemBadgeText}>
                            {product.type || 'Product'}
                          </Text>
                        </View>
                      </View>
                      {product.image && (
                        <View style={styles.productsModalItemImageContainer}>
                          <Image 
                            source={{ uri: product.image }} 
                            style={styles.productsModalItemImage}
                            resizeMode="cover"
                          />
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.productsModalEmpty}>
                  <MaterialIcons name="inventory-2" size={48} color="#ADB5BD" />
                  <Text style={styles.productsModalEmptyTitle}>No products available</Text>
                  <Text style={styles.productsModalEmptySubtitle}>
                    This shop doesn't have any products listed yet.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingTop: 50,
  },
  footerSpacer: {
    height: 100,
  },
  listContainer: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  headerTextContainer: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
    fontFamily: 'Inter-Medium',
  },
  farmerName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E293B',
    fontFamily: 'Inter-Bold',
    marginTop: 2,
  },
  gradientContainer: {
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  farmerNameGradient: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: 'Inter-Bold',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  // Enhanced Map Header Styles
  mapHeader: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  mapHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  mapHeaderTextContainer: {
    flex: 1,
  },
  mapWelcomeText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },
  mapFarmerNameGradient: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: 'Inter-Bold',
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  mapHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mapDistanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 24,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    minWidth: 85,
    minHeight: 48,
    gap: 8,
  },
  mapDistanceButtonText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
  },
  mapViewToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
    minWidth: 85,
    minHeight: 48,
    gap: 8,
  },
  mapToggleButtonText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
  },
  filterButton: {
    padding: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewToggleButton: {
    padding: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#059669',
  },
  mapViewContainer: {
    flex: 1,
  },
  // Enhanced Flexible Map Container Styles
  mapContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  mapSection: {
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
    marginHorizontal: 20,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  map: {
    flex: 1,
  },
  // Enhanced Flexible Resize Handle
  flexibleResizeHandle: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'column',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    alignSelf: 'stretch',
  },
  dragIndicatorContainer: {
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
  },
  dragIndicator: {
    width: 50,
    height: 5,
    backgroundColor: '#CBD5E1',
    borderRadius: 3,
    marginBottom: 6,
  },
  dragHintText: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
    fontWeight: '500',
    paddingHorizontal: 8,
    lineHeight: 16,
  },
  quickResizeButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  quickResizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 70,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  activeResizeButton: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  quickResizeText: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Inter-SemiBold',
    marginLeft: 4,
    fontWeight: '600',
  },
  activeResizeText: {
    color: '#FFFFFF',
  },
  // Flexible Nearby Shops Panel
  flexibleNearbyShopsPanel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
    overflow: 'hidden',
  },
  // Enhanced weather icon container for better visibility
  weatherIconContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
  },
  weatherIcon: {
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  // Compact Shop Card for small spaces
  nearbyShopCardCompact: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    minHeight: 60,
  },
  // Minimal view when panel is very small
  minimalShopsView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 20,
    borderRadius: 20,
    marginHorizontal: 20,
  },
  minimalShopsText: {
    fontSize: 14,
    color: '#64748B',
    fontFamily: 'Inter-SemiBold',
    textAlign: 'center',
    fontWeight: '600',
  },
  customMarker: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 8,
    borderWidth: 3,
    borderColor: '#059669',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  selectedMarker: {
    backgroundColor: '#059669',
    borderColor: '#047857',
    padding: 10,
    transform: [{ scale: 1.2 }],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#059669',
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600',
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    fontFamily: 'Inter-Bold',
  },
  filterIndicator: {
    fontSize: 16,
    color: '#059669',
    fontFamily: 'Inter-SemiBold',
    marginLeft: 28,
    marginBottom: 18,
    fontWeight: '600',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 20,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  legendColor: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  legendText: {
    fontSize: 13,
    color: '#475569',
    fontFamily: 'Inter-Medium',
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
    fontFamily: 'Inter-Bold',
  },
  productCount: {
    fontSize: 16,
    color: '#64748B',
    fontFamily: 'Inter-SemiBold',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    fontWeight: '600',
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    overflow: 'hidden',
  },
  productImageContainer: {
    position: 'relative',
    height: 200,
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  productTypeBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  productTypeText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
    textTransform: 'capitalize',
    fontWeight: '700',
  },
  productContent: {
    padding: 20,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  productName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: 'Inter-Bold',
    flex: 1,
    marginRight: 12,
    lineHeight: 24,
  },
  productPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: '#059669',
    fontFamily: 'Inter-Bold',
  },
  productUnit: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  productMeta: {
    marginBottom: 20,
  },
  shopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  productShop: {
    fontSize: 15,
    color: '#475569',
    marginLeft: 8,
    fontFamily: 'Inter-SemiBold',
    flex: 1,
    fontWeight: '600',
  },
  productLocation: {
    fontSize: 13,
    color: '#64748B',
    marginLeft: 8,
    fontFamily: 'Inter-Medium',
    flex: 1,
    fontWeight: '500',
  },
  productActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  favoriteButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
  },
  modalView: {
    width: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 24,
    textAlign: 'center',
    color: '#1E293B',
    fontFamily: 'Inter-Bold',
  },
  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  selectedFilterOption: {
    backgroundColor: '#F0FDF4',
    borderColor: '#059669',
    borderWidth: 2,
  },
  filterOptionText: {
    fontSize: 16,
    color: '#475569',
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600',
  },
  selectedFilterOptionText: {
    color: '#059669',
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
  },
  closeButton: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#475569',
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  weatherContainer: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  weatherList: {
    paddingVertical: 12,
  },
  weatherCard: {
    width: 90,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  weatherDay: {
    fontSize: 15,
    color: '#1E293B',
    fontFamily: 'Inter-Bold',
    marginBottom: 12,
    fontWeight: '700',
  },
  weatherTemps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 12,
  },
  weatherHigh: {
    fontSize: 16,
    color: '#1E293B',
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
  },
  weatherLow: {
    fontSize: 14,
    color: '#64748B',
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600',
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  ratingText: {
    fontSize: 14,
    color: '#92400E',
    marginLeft: 6,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  likesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  likesText: {
    fontSize: 14,
    color: '#DC2626',
    marginLeft: 6,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  // Distance filter styles
  distanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#059669',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  distanceButtonText: {
    fontSize: 13,
    color: '#059669',
    fontFamily: 'Inter-Bold',
    marginLeft: 6,
  },
  shopDistance: {
    fontSize: 13,
    color: '#059669',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
    fontWeight: '600',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  distanceContainer: {
    marginVertical: 20,
  },
  distanceLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    marginBottom: 24,
  },
  distanceAdjuster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  adjustButton: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    borderWidth: 2,
    borderColor: '#059669',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  distanceDisplay: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    minWidth: 120,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  distanceValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    fontFamily: 'Inter-Bold',
  },
  distancePresets: {
    marginVertical: 20,
  },
  presetsLabel: {
    fontSize: 16,
    color: '#64748B',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  presetButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 12,
  },
  presetButton: {
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 60,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedPresetButton: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  presetButtonText: {
    fontSize: 14,
    color: '#64748B',
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600',
  },
  selectedPresetButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  locationStatus: {
    fontSize: 14,
    color: '#64748B',
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
    marginTop: 16,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    fontWeight: '500',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shopCountText: {
    fontSize: 16,
    color: '#059669',
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    marginTop: 16,
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 12,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#059669',
  },
  locationWarning: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#F59E0B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  locationWarningText: {
    fontSize: 15,
    color: '#92400E',
    fontFamily: 'Inter-SemiBold',
    textAlign: 'center',
    marginVertical: 8,
    fontWeight: '600',
  },
  enableLocationButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  enableLocationButtonText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
  },
  increaseRangeButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  increaseRangeButtonText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
  },
  nearbyShopsPanel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    maxHeight: 250,
    minHeight: 180,
  },
  nearbyShopsPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  panelHeaderContent: {
    flex: 1,
  },
  nearbyShopsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: 'Inter-Bold',
  },
  nearbyShopsSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontFamily: 'Inter-Medium',
    marginTop: 2,
    fontWeight: '500',
  },
  clearSelectionButtonMobile: {
    backgroundColor: '#F0FDF4',
    borderRadius: 20,
    padding: 8,
    marginLeft: 12,
    borderWidth: 1,
    borderColor: '#059669',
  },
  nearbyShopsHorizontalListMobile: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  // Mobile-Optimized Shop Cards
  nearbyShopCardMobile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginRight: 16,
    width: 320,
    maxWidth: 320,
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  selectedShopCardMobile: {
    backgroundColor: '#F0FDF4',
    borderColor: '#059669',
    borderWidth: 2,
  },
  expandedShopCardMobile: {
    backgroundColor: '#F8FAFC',
    borderColor: '#059669',
    borderWidth: 2,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  shopCardHeaderMobile: {
    padding: 16,
    minHeight: 60,
  },
  shopCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shopCardIconMobile: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 8,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  selectedShopIconMobile: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  shopCardMainInfo: {
    flex: 1,
  },
  shopCardNameMobile: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: 'Inter-Bold',
    marginBottom: 6,
  },
  shopCardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shopCardDistanceMobile: {
    fontSize: 13,
    color: '#059669',
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  shopCardProductCountMobile: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Inter-Medium',
    fontWeight: '500',
  },
  expandIndicatorMobile: {
    marginLeft: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 32,
    minHeight: 32,
  },
  // Expanded Products Section Styles
  expandedProductsSectionMobile: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingBottom: 20,
    minHeight: 320,
    maxHeight: 450,
  },
  expandedHeaderMobile: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  expandedHeaderDivider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
    marginLeft: 12,
  },
  expandedProductsScrollMobile: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 8,
    minHeight: 280,
  },
  expandedProductsScrollContent: {
    paddingBottom: 20,
    minHeight: 280,
  },
  expandedTitleMobile: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.3,
  },
  expandedProductsListMobile: {
    gap: 12,
    padding: 4,
    backgroundColor: 'transparent',
    minHeight: 280,
  },
  expandedProductItemMobile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginVertical: 6,
    minHeight: 110,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  expandedProductMainMobile: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: 12,
  },
  expandedProductInfoMobile: {
    flex: 1,
    marginRight: 12,
  },
  expandedProductNameMobile: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
    lineHeight: 20,
  },
  expandedProductPriceMobile: {
    fontSize: 14,
    fontWeight: '800',
    color: '#059669',
    fontFamily: 'Inter-Bold',
  },
  expandedProductUnitMobile: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    fontFamily: 'Inter-Medium',
  },
  expandedProductTypeBadgeMobile: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#059669',
    alignSelf: 'flex-start',
  },
  expandedProductTypeTextMobile: {
    fontSize: 11,
    color: '#059669',
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  expandedProductImageContainerMobile: {
    width: 50,
    height: 50,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    marginLeft: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  expandedProductImageMobile: {
    width: '100%',
    height: '100%',
  },
  // Enhanced product rating and stock styles
  expandedProductRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  expandedProductRating: {
    fontSize: 12,
    color: '#F59E0B',
    fontFamily: 'Inter-SemiBold',
    marginLeft: 4,
    fontWeight: '600',
  },
  expandedProductStock: {
    fontSize: 11,
    color: '#059669',
    fontFamily: 'Inter-SemiBold',
    marginLeft: 6,
    fontWeight: '600',
  },
  // No products fallback styles
  noProductsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    marginHorizontal: 8,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noProductsText: {
    fontSize: 14,
    color: '#64748B',
    fontFamily: 'Inter-SemiBold',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  noProductsSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    fontFamily: 'Inter-Medium',
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
  },
  // Empty State - Mobile
  emptyStateHorizontalMobile: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    width: 320,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyStateTextHorizontalMobile: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    fontFamily: 'Inter-SemiBold',
    marginTop: 12,
    textAlign: 'center',
  },
  // Button styles
  increaseRangeButtonMobile: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  increaseRangeButtonTextMobile: {
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
  },
  
  // Products Modal Styles
  productsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    justifyContent: 'flex-end',
  },
  productsModalView: {
    backgroundColor: '#FFFFFF',
    flex: 1,
    marginTop: 50, // Status bar space
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 24,
  },
  productsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  productsModalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  productsModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    fontFamily: 'Inter-Bold',
    marginLeft: 12,
    flex: 1,
  },
  productsModalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  productsModalScroll: {
    flex: 1,
  },
  productsModalContent: {
    padding: 20,
    paddingTop: 8,
  },
  productsModalList: {
    gap: 16,
  },
  productsModalItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  productsModalItemContent: {
    flex: 1,
    marginRight: 16,
  },
  productsModalItemInfo: {
    flex: 1,
  },
  productsModalItemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: 'Inter-Bold',
    marginBottom: 6,
    lineHeight: 22,
  },
  productsModalItemPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: '#059669',
    fontFamily: 'Inter-Bold',
    marginBottom: 8,
  },
  productsModalItemUnit: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    fontFamily: 'Inter-Medium',
  },
  productsModalItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  productsModalItemRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productsModalItemRatingText: {
    fontSize: 13,
    color: '#F59E0B',
    fontFamily: 'Inter-SemiBold',
    marginLeft: 4,
    fontWeight: '600',
  },
  productsModalItemStock: {
    fontSize: 12,
    color: '#059669',
    fontFamily: 'Inter-SemiBold',
    marginLeft: 8,
    fontWeight: '600',
  },
  productsModalItemBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#059669',
    alignSelf: 'flex-start',
  },
  productsModalItemBadgeText: {
    fontSize: 11,
    color: '#059669',
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productsModalItemImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  productsModalItemImage: {
    width: '100%',
    height: '100%',
  },
  productsModalEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  productsModalEmptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748B',
    fontFamily: 'Inter-Bold',
    marginTop: 16,
    textAlign: 'center',
  },
  productsModalEmptySubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    fontFamily: 'Inter-Medium',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Weather emoji style
  weatherEmoji: {
    fontSize: 32,
    textAlign: 'center',
    lineHeight: 36,
  },
});